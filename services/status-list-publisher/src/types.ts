// src/types.ts
export type StatusPurpose = 'revocation' | 'suspension';

export interface StatusListDocument {
  id: string;                   // URL stabile della lista
  issuer: string;               // DID
  statusPurpose: StatusPurpose; // "revocation" o "suspension"
  encodedList: string;          // base64url della bitmap
  version: string;              // es. "2025-01-15T10:00:00Z#b3f..."
  hash: string;                 // hash del contenuto
  createdAt: string;
  updatedAt: string;
}

export interface StatusListCredential {
  '@context': string[];
  id: string;                   // URL della VC
  type: ['VerifiableCredential', 'StatusList2021Credential'];
  issuer: string;               // DID
  issuanceDate: string;
  credentialSubject: {
    id: string; // stesso di document.id
    type: 'StatusList2021';
    statusPurpose: StatusPurpose;
    encodedList: string;
  };
  proof?: any; // JWS
}
