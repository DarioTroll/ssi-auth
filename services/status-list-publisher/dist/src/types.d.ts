export type StatusPurpose = 'revocation' | 'suspension';
export interface StatusListDocument {
    id: string;
    issuer: string;
    statusPurpose: StatusPurpose;
    encodedList: string;
    version: string;
    hash: string;
    createdAt: string;
    updatedAt: string;
}
export interface StatusListCredential {
    '@context': string[];
    id: string;
    type: ['VerifiableCredential', 'StatusList2021Credential'];
    issuer: string;
    issuanceDate: string;
    credentialSubject: {
        id: string;
        type: 'StatusList2021';
        statusPurpose: StatusPurpose;
        encodedList: string;
    };
    proof?: any;
}
//# sourceMappingURL=types.d.ts.map