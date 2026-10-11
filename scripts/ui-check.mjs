// Drives the live site in headless Chrome with a throwaway Cognito user:
// sign in, pick a name, open a zone, make a choice, check HUD and leaderboard.
// Usage: node scripts/ui-check.mjs <site-url> <screenshot-dir>
import { mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import puppeteer from 'puppeteer-core';
import {
  AdminCreateUserCommand, AdminDeleteUserCommand, AdminGetUserCommand, AdminSetUserPasswordCommand, CognitoIdentityProviderClient,
} from '@aws-sdk/client-cognito-identity-provider';
import { DynamoDBClient, ListTablesCommand } from '@aws-sdk/client-dynamodb';
import { DeleteCommand, DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';

const [site, shotDir] = process.argv.slice(2);
mkdirSync(shotDir, { recursive: true });
const outputs = JSON.parse(readFileSync('amplify_outputs.json', 'utf8'));
const poolId = outputs.auth.user_pool_id;
const cognito = new CognitoIdentityProviderClient({});
const email = `uicheck-${Date.now()}@example.com`;
const password = `Ui!${Math.random().toString(36).slice(2, 10)}Z9`;
const results = [];
const check = (ok, name) => { results.push(`${ok ? 'PASS' : 'FAIL'}  ${name}`); };

await cognito.send(new AdminCreateUserCommand({
  UserPoolId: poolId, Username: email, MessageAction: 'SUPPRESS',
  UserAttributes: [{ Name: 'email', Value: email }, { Name: 'email_verified', Value: 'true' }],
}));
await cognito.send(new AdminSetUserPasswordCommand({ UserPoolId: poolId, Username: email, Password: password, Permanent: true }));
const sub = (await cognito.send(new AdminGetUserCommand({ UserPoolId: poolId, Username: email }))).UserAttributes.find((a) => a.Name === 'sub').Value;

const browser = await puppeteer.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: true,
  defaultViewport: { width: 1440, height: 900, deviceScaleFactor: 1 },
});
const consoleErrors = [];
const page = await browser.newPage();
try {
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
  page.on('pageerror', (e) => consoleErrors.push(e.message));
  const shot = (n) => page.screenshot({ path: join(shotDir, n) });
  const text = () => page.evaluate(() => document.body.innerText);

  await page.goto(site, { waitUntil: 'networkidle0' });
  await page.waitForSelector('#email');
  await shot('live-01-signin.png');
  check(true, 'sign-in screen loads');

  await page.type('#email', email);
  await page.type('#password', password);
  await page.click('button[type=submit]');
  await page.waitForSelector('#display-name', { timeout: 20000 });
  check(true, 'sign in through the pixel form reaches the name prompt');
  await page.focus('#display-name');
  await page.keyboard.down('Control'); await page.keyboard.press('KeyA'); await page.keyboard.up('Control');
  await page.keyboard.press('Backspace');
  await page.type('#display-name', 'UI_Check');
  await shot('live-02-name.png');
  await page.click('button[type=submit]');
  await page.waitForFunction(() => /choose a zone/i.test(document.body.innerText), { timeout: 20000 });
  await new Promise((r) => setTimeout(r, 800));
  await shot('live-03-zones.png');
  check(true, 'name saved, zone select shown');

  await page.evaluate(() => [...document.querySelectorAll('button')].find((b) => b.innerText.includes('COLLEGE CAMPUS')).click());
  await page.waitForFunction(() => /campus impact/i.test(document.body.innerText));
  await page.waitForFunction(() => document.body.innerText.includes('UI_Check (you)') || document.body.innerText.includes('No scores yet'), { timeout: 20000 });
  await shot('live-04-campus.png');
  check(true, 'campus map, HUD and leaderboard render');

  await page.evaluate(() => [...document.querySelectorAll('button')].find((b) => b.innerText.startsWith('Engineering Block roof')).click());
  await page.waitForSelector('[role=dialog]');
  await page.evaluate(() => [...document.querySelectorAll('[role=dialog] button')].find((b) => b.innerText.includes('Install on the full usable roof')).click());
  await page.waitForFunction(() => document.body.innerText.includes('+1,160 PTS'), { timeout: 20000 });
  await new Promise((r) => setTimeout(r, 900));
  await shot('live-05-solar-result.png');
  const t = await text();
  check(t.includes('73%'), 'HUD grid dependency dropped to 73%');
  check(t.includes('1,62,000'), 'HUD solar offset shows 1,62,000 kWh');

  await page.evaluate(() => [...document.querySelectorAll('[role=dialog] button')].find((b) => b.innerText.includes('Back to map')).click());
  await page.waitForFunction(() => /UI_Check \(you\)\s*1,160/.test(document.body.innerText), { timeout: 20000 });
  check(true, 'leaderboard shows the new score');
  await shot('live-06-after.png');

  await page.evaluate(() => [...document.querySelectorAll('button')].find((b) => b.innerText.includes('Zones')).click());
  await page.evaluate(() => [...document.querySelectorAll('button')].find((b) => b.innerText.includes('OMKARESHWAR')).click());
  await page.waitForFunction(() => /ghat impact/i.test(document.body.innerText));
  await page.evaluate(() => [...document.querySelectorAll('button')].find((b) => b.innerText.startsWith('Nirmalya segregation')).click());
  await page.waitForSelector('[role=dialog]');
  await new Promise((r) => setTimeout(r, 500));
  await shot('live-07-sort.png');
  check(true, 'temple map and sorting game open');
} catch (e) {
  results.push(`FAIL  ${e.message}`);
  await page.screenshot({ path: join(shotDir, 'live-failure.png') }).catch(() => {});
  results.push('      page text: ' + (await page.evaluate(() => document.body.innerText).catch(() => '')).replace(/s+/g, ' ').slice(0, 600));
} finally {
  await browser.close();
  await cognito.send(new AdminDeleteUserCommand({ UserPoolId: poolId, Username: email })).catch(() => {});
  const ddb = new DynamoDBClient({});
  const tables = (await ddb.send(new ListTablesCommand({}))).TableNames.filter((n) => n.includes('PlayersTable'));
  for (const tn of tables) await DynamoDBDocumentClient.from(ddb).send(new DeleteCommand({ TableName: tn, Key: { userId: sub } }));
  results.push(consoleErrors.length ? `WARN  browser console errors: ${consoleErrors.slice(0, 3).join(' | ')}` : 'PASS  no browser console errors');
  console.log(results.join('\n'));
  console.log('Cleaned up test user and data');
}
