import type { StatusListDocument, StatusListCredential } from '../types.js';
import type { StatusPurpose } from '../types.js';
import { blake2b256Hex } from '../../shared/src/lib/hash.js';

export function computeHash(doc: Omit<StatusListDocument, 'hash'>): string {
  const payload = JSON.stringify({
    id: doc.id,
    issuer: doc.issuer,
    statusPurpose: doc.statusPurpose,
    encodedList: doc.encodedList,
    version: doc.version,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt
  });
  return blake2b256Hex(payload);
}

export function computeHashBytes32(doc: Omit<StatusListDocument, 'hash'>): `0x${string}` {
  const payload = JSON.stringify({ ...doc, hash: undefined });
  return (`0x${blake2b256Hex(payload)}`) as `0x${string}`;
}

export function makeStatusListVC(doc: StatusListDocument, vcId: string): StatusListCredential {
  return {
    '@context': [
      'https://www.w3.org/2018/credentials/v1',
      'https://w3id.org/vc/status-list/2021/v1'
    ],
    id: vcId,
    type: ['VerifiableCredential', 'StatusList2021Credential'],
    issuer: doc.issuer,
    issuanceDate: new Date().toISOString(),
    credentialSubject: {
      id: doc.id,
      type: 'StatusList2021',
      statusPurpose: doc.statusPurpose,
      encodedList: doc.encodedList
    }
  };
}