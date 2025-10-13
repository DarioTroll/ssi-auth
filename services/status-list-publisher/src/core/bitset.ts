// src/core/bitset.ts
export class Bitset {
  private bytes: Uint8Array;
  constructor(sizeBits: number, init?: Uint8Array) {
    const sizeBytes = Math.ceil(sizeBits / 8);
    this.bytes = init ?? new Uint8Array(sizeBytes);
  }

  set(index: number, value: boolean) {
    const byte = index >> 3;
    const bit = index & 7;
    if (byte >= this.bytes.length) throw new RangeError(`Index ${index} out of bounds`);
    if (value) this.bytes[byte]! |= (1 << bit);
    else this.bytes[byte]! &= ~(1 << bit);
  }
  get(index: number): boolean {
    const byte = index >> 3, bit = index & 7;
    return (this.bytes[byte]! & (1 << bit)) !== 0;
  }
  toBase64(): string {
    return Buffer.from(this.bytes).toString('base64url');
  }
  static fromBase64(b64: string, sizeBits: number): Bitset {
    const buf = Buffer.from(b64, 'base64url');
    return new Bitset(sizeBits, new Uint8Array(buf));
  }
  raw(): Uint8Array { return this.bytes; }
}