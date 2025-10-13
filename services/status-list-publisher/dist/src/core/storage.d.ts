export declare class FSStorage {
    private base;
    constructor(base: string);
    write(relPath: string, data: object): Promise<string>;
    read<T>(relPath: string): Promise<T | null>;
}
//# sourceMappingURL=storage.d.ts.map