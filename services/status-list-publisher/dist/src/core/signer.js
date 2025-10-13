import { SignJWT, importJWK } from 'jose';
export async function signVC(vc, kid, jwk) {
    const key = await importJWK(jwk, jwk.crv === 'Ed25519' ? 'EdDSA' : 'ES256');
    const jws = await new SignJWT({ vc })
        .setProtectedHeader({ alg: jwk.crv === 'Ed25519' ? 'EdDSA' : 'ES256', kid, typ: 'JWT' })
        .setIssuedAt()
        .setIssuer(vc.issuer)
        .setJti(vc.id)
        .sign(key);
    return { proof: { type: 'JsonWebSignature2020', jws } };
}
//# sourceMappingURL=signer.js.map