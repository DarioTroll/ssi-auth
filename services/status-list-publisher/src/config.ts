// src/config.ts
import 'dotenv/config';
export const cfg = {
  port: parseInt(process.env.PORT || '3002', 10),
  baseUrl: process.env.BASE_URL!,              // https://.../status
  issuerDid: process.env.ISSUER_DID!,
  signingKid: process.env.SIGNING_KID!,
  signingJwk: JSON.parse(process.env.SIGNING_JWK!),
  listSize: parseInt(process.env.LIST_SIZE || '16384', 10),
  listId: process.env.LIST_ID || 'main',
};