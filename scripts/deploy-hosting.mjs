// Deploys ./dist to AWS Amplify Hosting as a manual (zip) deployment.
// Creates the "EcoMap" Amplify app and "main" branch on first run.
// Credentials and region come from the environment (see .env).
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { zipSync } from 'fflate';
import {
  AmplifyClient,
  CreateAppCommand,
  CreateBranchCommand,
  CreateDeploymentCommand,
  GetBranchCommand,
  GetJobCommand,
  ListAppsCommand,
  StartDeploymentCommand,
} from '@aws-sdk/client-amplify';

const APP_NAME = 'EcoMap';
const BRANCH = 'main';
const DIST = 'dist';

function collect(dir, out = {}) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) collect(full, out);
    else out[relative(DIST, full).split(sep).join('/')] = readFileSync(full);
  }
  return out;
}

const client = new AmplifyClient({});

async function findOrCreateApp() {
  let nextToken;
  do {
    const page = await client.send(new ListAppsCommand({ maxResults: 50, nextToken }));
    const hit = page.apps?.find((a) => a.name === APP_NAME);
    if (hit) return hit;
    nextToken = page.nextToken;
  } while (nextToken);
  const { app } = await client.send(new CreateAppCommand({ name: APP_NAME, platform: 'WEB', description: 'EcoMap hackathon app' }));
  console.log(`Created Amplify app ${app.appId}`);
  return app;
}

async function ensureBranch(appId) {
  try {
    await client.send(new GetBranchCommand({ appId, branchName: BRANCH }));
  } catch (e) {
    if (e.name !== 'NotFoundException') throw e;
    await client.send(new CreateBranchCommand({ appId, branchName: BRANCH, stage: 'PRODUCTION' }));
    console.log(`Created branch ${BRANCH}`);
  }
}

const files = collect(DIST);
if (!files['index.html']) throw new Error('dist/index.html is missing. Run "npm run build" first.');
const zip = zipSync(files, { level: 9 });
console.log(`Packed ${Object.keys(files).length} files (${(zip.length / 1024).toFixed(0)} KB)`);

const app = await findOrCreateApp();
await ensureBranch(app.appId);

const dep = await client.send(new CreateDeploymentCommand({ appId: app.appId, branchName: BRANCH }));
const upload = await fetch(dep.zipUploadUrl, { method: 'PUT', body: zip });
if (!upload.ok) throw new Error(`Zip upload failed with HTTP ${upload.status}: ${await upload.text()}`);
await client.send(new StartDeploymentCommand({ appId: app.appId, branchName: BRANCH, jobId: dep.jobId }));
console.log(`Deployment job ${dep.jobId} started`);

for (;;) {
  await new Promise((r) => setTimeout(r, 4000));
  const { job } = await client.send(new GetJobCommand({ appId: app.appId, branchName: BRANCH, jobId: dep.jobId }));
  const status = job.summary.status;
  process.stdout.write(`  status: ${status}\n`);
  if (status === 'SUCCEED') break;
  if (['FAILED', 'CANCELLED'].includes(status)) throw new Error(`Deployment ${status}`);
}

console.log(`\nLive at https://${BRANCH}.${app.defaultDomain}`);
