import { promises as fs } from 'fs';
import path from 'path';
export class FSStorage {
  constructor(private base: string) {}
  async write(relPath: string, data: object) {
    const p = path.join(this.base, relPath);
    await fs.mkdir(path.dirname(p), { recursive: true });
    await fs.writeFile(p, JSON.stringify(data, null, 2));
    return p;
  }
  async read<T>(relPath: string): Promise<T | null> {
    try {
      const p = path.join(this.base, relPath);
      const buf = await fs.readFile(p, 'utf-8');
      return JSON.parse(buf) as T;
    } catch { return null; }
  }
}