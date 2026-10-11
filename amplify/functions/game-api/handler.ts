import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand, QueryCommand, TransactWriteCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { ScoringError, scoreAction, type MetricKey } from '../../../shared/hotspots';

const TABLE = process.env.TABLE_NAME ?? '';
const NAMES_TABLE = process.env.NAMES_TABLE_NAME ?? '';
const LEADERBOARD_INDEX = 'LeaderboardIndex';
const LEADERBOARD_ID = 'GLOBAL';
const NAME_PATTERN = /^[A-Za-z0-9_.\- ]{2,20}$/;

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}), {
  marshallOptions: { removeUndefinedValues: true },
});

interface CompletedRecord { choiceId?: string; points: number; correct?: number; reasonCorrect?: boolean; predictionHit?: boolean; at: string }
interface Player {
  userId: string;
  displayName?: string;
  leaderboardId?: string;
  totalScore: number;
  completed: Record<string, CompletedRecord>;
  metrics: Partial<Record<MetricKey, number>>;
  createdAt: string;
  updatedAt: string;
}

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,OPTIONS',
};

function json(statusCode: number, body: unknown): APIGatewayProxyResult {
  return { statusCode, headers: { 'Content-Type': 'application/json', ...CORS }, body: JSON.stringify(body) };
}

function publicProfile(p: Player) {
  return {
    displayName: p.displayName ?? null,
    totalScore: p.totalScore ?? 0,
    completed: p.completed ?? {},
    metrics: p.metrics ?? {},
  };
}

function isConditionalFailure(e: unknown): boolean {
  return (e as { name?: string })?.name === 'ConditionalCheckFailedException';
}

function parseBody(event: APIGatewayProxyEvent): Record<string, unknown> {
  if (!event.body) return {};
  try {
    const raw = event.isBase64Encoded ? Buffer.from(event.body, 'base64').toString('utf8') : event.body;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    throw new ScoringError('The request body was not valid JSON.');
  }
}

async function getPlayer(userId: string): Promise<Player | undefined> {
  const res = await ddb.send(new GetCommand({ TableName: TABLE, Key: { userId }, ConsistentRead: true }));
  return res.Item as Player | undefined;
}

/** Fetch the player row, creating an empty one on first visit. */
async function ensurePlayer(userId: string): Promise<Player> {
  const existing = await getPlayer(userId);
  if (existing) return existing;
  const now = new Date().toISOString();
  const fresh: Player = { userId, totalScore: 0, completed: {}, metrics: {}, createdAt: now, updatedAt: now };
  try {
    await ddb.send(new PutCommand({ TableName: TABLE, Item: fresh, ConditionExpression: 'attribute_not_exists(userId)' }));
    return fresh;
  } catch (e) {
    if (isConditionalFailure(e)) return (await getPlayer(userId))!;
    throw e;
  }
}

async function setDisplayName(userId: string, body: Record<string, unknown>) {
  const name = String(body.displayName ?? '').trim().replace(/\s+/g, ' ');
  if (!NAME_PATTERN.test(name)) {
    return json(400, { message: 'Use 2 to 20 letters, numbers, spaces, dots, dashes or underscores.' });
  }
  const player = await ensurePlayer(userId);
  const nameKey = name.toLowerCase();
  const oldKey = player.displayName?.toLowerCase();
  const mine = { ':u': userId };

  // One transaction: claim the new name, rename the player, release the old name.
  // The claim fails if another player already holds the name (case-insensitive).
  try {
    await ddb.send(new TransactWriteCommand({
      TransactItems: [
        {
          Put: {
            TableName: NAMES_TABLE,
            Item: { nameKey, userId },
            ConditionExpression: 'attribute_not_exists(nameKey) OR userId = :u',
            ExpressionAttributeValues: mine,
          },
        },
        {
          // Setting leaderboardId here makes the GSI sparse: only named players appear on the board.
          Update: {
            TableName: TABLE,
            Key: { userId },
            UpdateExpression: 'SET displayName = :n, leaderboardId = :g, updatedAt = :now',
            ExpressionAttributeValues: { ':n': name, ':g': LEADERBOARD_ID, ':now': new Date().toISOString() },
          },
        },
        ...(oldKey && oldKey !== nameKey ? [{
          Delete: {
            TableName: NAMES_TABLE,
            Key: { nameKey: oldKey },
            ConditionExpression: 'attribute_not_exists(nameKey) OR userId = :u',
            ExpressionAttributeValues: mine,
          },
        }] : []),
      ],
    }));
  } catch (e) {
    const reasons = (e as { CancellationReasons?: { Code?: string }[] })?.CancellationReasons;
    if (reasons?.[0]?.Code === 'ConditionalCheckFailed') {
      return json(409, { code: 'UsernameExistsException', message: `The name "${name}" is taken. Pick another one.` });
    }
    throw e;
  }
  return json(200, publicProfile((await getPlayer(userId))!));
}

async function submitAction(userId: string, body: Record<string, unknown>) {
  const result = scoreAction(body);
  await ensurePlayer(userId);

  // "metrics" is a DynamoDB reserved word, so it is always referenced through #metrics.
  const names: Record<string, string> = { '#h': result.hotspotId, '#metrics': 'metrics' };
  const values: Record<string, unknown> = {
    ':pts': result.points,
    ':now': new Date().toISOString(),
    ':zero': 0,
    ':rec': { choiceId: result.choiceId, points: result.points, correct: result.correct, reasonCorrect: result.reasonCorrect, predictionHit: result.predictionHit, at: new Date().toISOString() },
  };
  const sets = ['totalScore = if_not_exists(totalScore, :zero) + :pts', 'completed.#h = :rec', 'updatedAt = :now'];
  Object.entries(result.delta).forEach(([key, amount], i) => {
    names[`#m${i}`] = key;
    values[`:d${i}`] = amount;
    sets.push(`#metrics.#m${i} = if_not_exists(#metrics.#m${i}, :zero) + :d${i}`);
  });

  try {
    const res = await ddb.send(new UpdateCommand({
      TableName: TABLE,
      Key: { userId },
      UpdateExpression: 'SET ' + sets.join(', '),
      ConditionExpression: 'attribute_not_exists(completed.#h)',
      ExpressionAttributeNames: names,
      ExpressionAttributeValues: values,
      ReturnValues: 'ALL_NEW',
    }));
    return json(200, { result, profile: publicProfile(res.Attributes as Player) });
  } catch (e) {
    if (isConditionalFailure(e)) {
      return json(409, { message: 'You already completed this hotspot. Reset your progress to play it again.' });
    }
    throw e;
  }
}

async function resetProgress(userId: string) {
  await ensurePlayer(userId);
  const res = await ddb.send(new UpdateCommand({
    TableName: TABLE,
    Key: { userId },
    UpdateExpression: 'SET totalScore = :zero, completed = :empty, #metrics = :empty, updatedAt = :now',
    ExpressionAttributeNames: { '#metrics': 'metrics' },
    ExpressionAttributeValues: { ':zero': 0, ':empty': {}, ':now': new Date().toISOString() },
    ReturnValues: 'ALL_NEW',
  }));
  return json(200, publicProfile(res.Attributes as Player));
}

async function leaderboard(userId: string) {
  // One Query on the GSI, highest score first. No table scan.
  const res = await ddb.send(new QueryCommand({
    TableName: TABLE,
    IndexName: LEADERBOARD_INDEX,
    KeyConditionExpression: 'leaderboardId = :g',
    ExpressionAttributeValues: { ':g': LEADERBOARD_ID },
    ScanIndexForward: false,
    Limit: 10,
  }));
  const entries = (res.Items ?? []).map((item, i) => ({
    rank: i + 1,
    displayName: String(item.displayName ?? 'Player'),
    totalScore: Number(item.totalScore ?? 0),
    isMe: item.userId === userId,
  }));
  let me = null;
  if (!entries.some((e) => e.isMe)) {
    const p = await getPlayer(userId);
    if (p) me = { displayName: p.displayName ?? null, totalScore: p.totalScore ?? 0 };
  }
  return json(200, { entries, me });
}

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  const userId = event.requestContext?.authorizer?.claims?.sub as string | undefined;
  if (!userId) return json(401, { message: 'Your session expired. Sign in again.' });

  const route = `${event.httpMethod} ${event.resource}`;
  try {
    switch (route) {
      case 'GET /me':
        return json(200, publicProfile(await ensurePlayer(userId)));
      case 'PUT /me':
        return await setDisplayName(userId, parseBody(event));
      case 'POST /me/reset':
        return await resetProgress(userId);
      case 'POST /actions':
        return await submitAction(userId, parseBody(event));
      case 'GET /leaderboard':
        return await leaderboard(userId);
      default:
        return json(404, { message: `No route for ${route}.` });
    }
  } catch (e) {
    if (e instanceof ScoringError) return json(400, { message: e.message });
    console.error('Unhandled error', route, e);
    return json(500, { message: 'Something went wrong on the server. Try again in a moment.' });
  }
};
