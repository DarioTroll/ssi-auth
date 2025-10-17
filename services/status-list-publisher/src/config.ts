// src/config.ts
import 'dotenv/config';
import { readFileSync } from 'fs';

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v || v.trim() === '') {
    throw new Error(`Missing required env var ${name}`);
  }
  return v;
}

function loadSigningJwk(): any {
  const inline = process.env.SIGNING_JWK;
  const file = process.env.SIGNING_JWK_FILE;
  const source = inline ?? (file ? readFileSync(file, 'utf-8') : undefined);
  if (!source) {
    throw new Error('Provide SIGNING_JWK (inline JSON) or SIGNING_JWK_FILE (path to JSON)');
  }
  try {
    return JSON.parse(source);
  } catch (e) {
    throw new Error(`SIGNING_JWK is not valid JSON: ${(e as Error).message}`);
  }
}

export const cfg = {
  port: parseInt(process.env.PORT || '3002', 10),
  baseUrl: requireEnv('BASE_URL'),           // e.g., https://host/public
  issuerDid: requireEnv('ISSUER_DID'),
  signingKid: requireEnv('SIGNING_KID'),
  signingJwk: loadSigningJwk(),
  listSize: parseInt(process.env.LIST_SIZE || '16384', 10),
  listId: process.env.LIST_ID || 'main',
};
