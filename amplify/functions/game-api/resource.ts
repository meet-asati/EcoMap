import { defineFunction } from '@aws-amplify/backend';

export const gameApi = defineFunction({
  name: 'game-api',
  entry: './handler.ts',
  runtime: 22,
  timeoutSeconds: 10,
  memoryMB: 256,
});
