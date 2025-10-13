import type { StatusListDocument, StatusListCredential } from '../types.js';
export declare function computeHash(doc: Omit<StatusListDocument, 'hash'>): string;
export declare function computeHashBytes32(doc: Omit<StatusListDocument, 'hash'>): `0x${string}`;
export declare function makeStatusListVC(doc: StatusListDocument, vcId: string): StatusListCredential;
//# sourceMappingURL=statuslist.d.ts.map