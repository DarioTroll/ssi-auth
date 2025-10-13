import { promises as fs } from 'fs';
import path from 'path';
export class FSStorage {
    base;
    constructor(base) {
        this.base = base;
    }
    async write(relPath, data) {
        const p = path.join(this.base, relPath);
        await fs.mkdir(path.dirname(p), { recursive: true });
        await fs.writeFile(p, JSON.stringify(data, null, 2));
        return p;
    }
    async read(relPath) {
        try {
            const p = path.join(this.base, relPath);
            const buf = await fs.readFile(p, 'utf-8');
            return JSON.parse(buf);
        }
        catch {
            return null;
        }
    }
}
//# sourceMappingURL=storage.js.map