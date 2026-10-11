import { Amplify } from 'aws-amplify';
import outputs from '../amplify_outputs.json';

Amplify.configure(outputs);

const custom = (outputs as { custom?: { api?: { endpoint?: string } } }).custom;
if (!custom?.api?.endpoint) {
  throw new Error('amplify_outputs.json has no API endpoint. Run "npm run deploy:backend" first.');
}

/** Base URL of the API Gateway stage, without a trailing slash. */
export const API_URL = custom.api.endpoint.replace(/\/+$/, '');
