import { defineBackend } from '@aws-amplify/backend';
import { RemovalPolicy, Stack } from 'aws-cdk-lib';
import {
  AuthorizationType,
  CognitoUserPoolsAuthorizer,
  Cors,
  LambdaIntegration,
  ResponseType,
  RestApi,
} from 'aws-cdk-lib/aws-apigateway';
import { AttributeType, BillingMode, ProjectionType, Table } from 'aws-cdk-lib/aws-dynamodb';
import { auth } from './auth/resource';
import { gameApi } from './functions/game-api/resource';

const backend = defineBackend({ auth, gameApi });

const gameLambda = backend.gameApi.resources.lambda;

// ---------- DynamoDB ----------
// Lives in the function's stack so granting access does not create a cross-stack cycle.
const playersTable = new Table(Stack.of(gameLambda), 'PlayersTable', {
  partitionKey: { name: 'userId', type: AttributeType.STRING },
  billingMode: BillingMode.PAY_PER_REQUEST,
  removalPolicy: RemovalPolicy.DESTROY,
});

// Leaderboard GSI: fixed partition "GLOBAL", sorted by totalScore.
playersTable.addGlobalSecondaryIndex({
  indexName: 'LeaderboardIndex',
  partitionKey: { name: 'leaderboardId', type: AttributeType.STRING },
  sortKey: { name: 'totalScore', type: AttributeType.NUMBER },
  projectionType: ProjectionType.INCLUDE,
  nonKeyAttributes: ['displayName'],
});

playersTable.grantReadWriteData(gameLambda);
backend.gameApi.addEnvironment('TABLE_NAME', playersTable.tableName);

// ---------- API Gateway (REST) ----------
const apiStack = backend.createStack('api-stack');

const restApi = new RestApi(apiStack, 'EcoMapApi', {
  restApiName: 'ecomap-api',
  description: 'EcoMap game API',
  deployOptions: { stageName: 'prod', throttlingRateLimit: 50, throttlingBurstLimit: 100 },
  defaultCorsPreflightOptions: {
    allowOrigins: Cors.ALL_ORIGINS,
    allowMethods: Cors.ALL_METHODS,
    allowHeaders: ['Content-Type', 'Authorization'],
  },
});

// Authorizer rejections also need CORS headers, or the browser hides the real error.
for (const [id, type] of [['Cors4xx', ResponseType.DEFAULT_4XX], ['Cors5xx', ResponseType.DEFAULT_5XX]] as const) {
  restApi.addGatewayResponse(id, {
    type,
    responseHeaders: {
      'Access-Control-Allow-Origin': "'*'",
      'Access-Control-Allow-Headers': "'Content-Type,Authorization'",
    },
  });
}

const authorizer = new CognitoUserPoolsAuthorizer(apiStack, 'CognitoAuthorizer', {
  cognitoUserPools: [backend.auth.resources.userPool],
});
const integration = new LambdaIntegration(gameLambda);
const secured = { authorizer, authorizationType: AuthorizationType.COGNITO };

const me = restApi.root.addResource('me');
me.addMethod('GET', integration, secured);
me.addMethod('PUT', integration, secured);
me.addResource('reset').addMethod('POST', integration, secured);
restApi.root.addResource('actions').addMethod('POST', integration, secured);
restApi.root.addResource('leaderboard').addMethod('GET', integration, secured);

backend.addOutput({
  custom: {
    api: {
      endpoint: restApi.url,
      region: Stack.of(restApi).region,
      name: restApi.restApiName,
    },
  },
});
