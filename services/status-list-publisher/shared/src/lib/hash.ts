import { blake2b } from 'blakejs';

export function blake2b256Hex(input: string | Uint8Array): string {
  const bytes = typeof input === 'string' ? new TextEncoder().encode(input) : input;
  const out = blake2b(bytes, undefined, 32); // 32 bytes = 256 bit
  return Buffer.from(out).toString('hex');
}

// variante per bytes32 (on-chain)
export function blake2b256Bytes32(input: string | Uint8Array): `0x${string}` {
  const hex = blake2b256Hex(input);
  return `0x${hex}`;
}