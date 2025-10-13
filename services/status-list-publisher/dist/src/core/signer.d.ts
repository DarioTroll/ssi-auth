import type { JWK } from 'jose';
export declare function signVC(vc: object, kid: string, jwk: JWK): Promise<{
    proof: {
        type: string;
        jws: string;
    };
}>;
//# sourceMappingURL=signer.d.ts.map