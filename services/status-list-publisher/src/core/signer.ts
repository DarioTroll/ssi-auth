import { SignJWT, importJWK} from 'jose';
import type {JWK} from 'jose';

export async function signVC(vc: object, kid: string, jwk: JWK) {
  const key = await importJWK(jwk, jwk.crv === 'Ed25519' ? 'EdDSA' : 'ES256');
  const jws = await new SignJWT({ vc })
    .setProtectedHeader({ alg: jwk.crv === 'Ed25519' ? 'EdDSA' : 'ES256', kid, typ: 'JWT' })
    .setIssuedAt()
    .setIssuer((vc as any).issuer)
    .setJti((vc as any).id)
    .sign(key);
  return { proof: { type: 'JsonWebSignature2020', jws } };
}
