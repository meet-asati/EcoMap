// End-to-end check of the deployed API with a throwaway Cognito user.
// Creates the user, exercises every route, then deletes the user and its row.
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { Amplify } from 'aws-amplify';
import { fetchAuthSession, signIn, signOut } from 'aws-amplify/auth';
import {
  AdminCreateUserCommand,
  AdminDeleteUserCommand,
  AdminGetUserCommand,
  AdminSetUserPasswordCommand,
  CognitoIdentityProviderClient,
} from '@aws-sdk/client-cognito-identity-provider';
import { DynamoDBClient, ListTablesCommand } from '@aws-sdk/client-dynamodb';
import { DeleteCommand, DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';

const outputs = JSON.parse(readFileSync('amplify_outputs.json', 'utf8'));
Amplify.configure(outputs);
const API = outputs.custom.api.endpoint.replace(/\/+$/, '');
const poolId = outputs.auth.user_pool_id;
const cognito = new CognitoIdentityProviderClient({});

const email = `smoke-${Date.now()}@example.com`;
const password = `Smoke!${Math.random().toString(36).slice(2, 10)}A1`;
let token;
let userSub;

async function call(method, path, body, auth = true) {
  const res = await fetch(API + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(auth ? { Authorization: token } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, cors: res.headers.get('access-control-allow-origin'), data };
}

const steps = [];
const step = async (name, fn) => {
  try { await fn(); steps.push(['PASS', name]); }
  catch (e) { steps.push(['FAIL', `${name}: ${e.message}`]); throw e; }
};

try {
  await cognito.send(new AdminCreateUserCommand({
    UserPoolId: poolId, Username: email, MessageAction: 'SUPPRESS',
    UserAttributes: [{ Name: 'email', Value: email }, { Name: 'email_verified', Value: 'true' }],
  }));
  await cognito.send(new AdminSetUserPasswordCommand({ UserPoolId: poolId, Username: email, Password: password, Permanent: true }));
  const u = await cognito.send(new AdminGetUserCommand({ UserPoolId: poolId, Username: email }));
  userSub = u.UserAttributes.find((a) => a.Name === 'sub').Value;

  await step('sign in through Cognito (SRP)', async () => {
    const r = await signIn({ username: email, password });
    assert.equal(r.isSignedIn, true);
    token = (await fetchAuthSession()).tokens.idToken.toString();
  });

  await step('request without token is rejected with CORS headers', async () => {
    const r = await call('GET', '/leaderboard', undefined, false);
    assert.equal(r.status, 401);
    assert.equal(r.cors, '*');
  });

  await step('GET /me creates an empty profile', async () => {
    const r = await call('GET', '/me');
    assert.equal(r.status, 200);
    assert.equal(r.data.totalScore, 0);
    assert.equal(r.data.displayName, null);
  });

  await step('PUT /me rejects a bad name', async () => {
    const r = await call('PUT', '/me', { displayName: 'x' });
    assert.equal(r.status, 400);
  });

  await step('PUT /me sets the display name', async () => {
    const r = await call('PUT', '/me', { displayName: 'SmokeTest' });
    assert.equal(r.status, 200);
    assert.equal(r.data.displayName, 'SmokeTest');
  });

  await step('POST /actions scores a choice on the server', async () => {
    const r = await call('POST', '/actions', { hotspotId: 'solar-eng', choiceId: 'full', points: 999999 });
    assert.equal(r.status, 200);
    assert.equal(r.data.result.points, 1160);
    assert.equal(r.data.profile.totalScore, 1160);
    assert.equal(r.data.profile.metrics.kwh, 162000);
  });

  await step('the same hotspot cannot be scored twice', async () => {
    const r = await call('POST', '/actions', { hotspotId: 'solar-eng', choiceId: 'full' });
    assert.equal(r.status, 409);
  });

  await step('an invalid choice is rejected', async () => {
    const r = await call('POST', '/actions', { hotspotId: 'ewaste-lab', choiceId: 'nope' });
    assert.equal(r.status, 400);
  });

  await step('the Nirmalya sort is scored', async () => {
    const placements = { marigold: 'compost', 'banana-leaf': 'compost', coconut: 'compost', 'carry-bag': 'recycle',
      'incense-box': 'recycle', 'plastic-flower': 'recycle', thermocol: 'reject', bangles: 'reject' };
    const r = await call('POST', '/actions', { hotspotId: 'nirmalya-ghat', placements });
    assert.equal(r.status, 200);
    assert.equal(r.data.result.correct, 8);
    assert.equal(r.data.profile.totalScore, 2360);
  });

  await step('leaderboard query returns this player', async () => {
    const r = await call('GET', '/leaderboard');
    assert.equal(r.status, 200);
    const me = r.data.entries.find((e) => e.isMe);
    assert.ok(me, 'player not in top 10');
    assert.equal(me.totalScore, 2360);
    for (let i = 1; i < r.data.entries.length; i++) assert.ok(r.data.entries[i - 1].totalScore >= r.data.entries[i].totalScore, 'not sorted');
  });

  await step('POST /me/reset clears progress', async () => {
    const r = await call('POST', '/me/reset');
    assert.equal(r.status, 200);
    assert.equal(r.data.totalScore, 0);
    assert.deepEqual(r.data.completed, {});
  });
} finally {
  await signOut().catch(() => {});
  await cognito.send(new AdminDeleteUserCommand({ UserPoolId: poolId, Username: email })).catch((e) => console.error('user cleanup failed', e.message));
  if (userSub) {
    const ddb = new DynamoDBClient({});
    const tables = (await ddb.send(new ListTablesCommand({}))).TableNames.filter((t) => t.includes('ecomap') && t.includes('PlayersTable'));
    for (const t of tables) await DynamoDBDocumentClient.from(ddb).send(new DeleteCommand({ TableName: t, Key: { userId: userSub } }));
    console.log(`Cleaned up test user and row in ${tables.length} table(s)`);
  }
  for (const [s, n] of steps) console.log(`${s}  ${n}`);
}
