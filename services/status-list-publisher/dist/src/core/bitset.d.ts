export declare class Bitset {
    private bytes;
    constructor(sizeBits: number, init?: Uint8Array);
    set(index: number, value: boolean): void;
    get(index: number): boolean;
    toBase64(): string;
    static fromBase64(b64: string, sizeBits: number): Bitset;
    raw(): Uint8Array;
}
//# sourceMappingURL=bitset.d.ts.map