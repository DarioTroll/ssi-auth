import { z } from 'zod';
import { Bitset } from '../core/bitset.js';
import { FSStorage } from '../core/storage.js';
import { computeHash, makeStatusListVC } from '../core/statuslist.js';
import { signVC } from '../core/signer.js';
import { cfg } from '../config.js';
const storage = new FSStorage('public');
export async function statusRoutes(app) {
    // GET /status/:listId  -> StatusListDocument
    app.get('/status/:listId', async (req, reply) => {
        const { listId } = req.params;
        const doc = await storage.read(`statuslists/${listId}.json`);
        if (!doc)
            return reply.code(404).send({ error: 'Not found' });
        return doc;
    });
    // GET /status/:listId/vc  -> StatusListCredential (firmata)
    app.get('/status/:listId/vc', async (req, reply) => {
        const { listId } = req.params;
        const doc = await storage.read(`statuslists/${listId}.json`);
        if (!doc)
            return reply.code(404).send({ error: 'Not found' });
        const vcId = `${cfg.baseUrl}/vc/${listId}.json`;
        let vc = makeStatusListVC(doc, vcId);
        const proof = await signVC(vc, cfg.signingKid, cfg.signingJwk);
        vc = { ...vc, proof };
        await storage.write(`vc/${listId}.json`, vc);
        return vc;
    });
    // POST /status/init  -> crea nuova lista (idempotente)
    app.post('/status/init', async (req, reply) => {
        const body = z.object({
            listId: z.string().default(cfg.listId),
            statusPurpose: z.enum(['revocation', 'suspension']).default('revocation'),
            size: z.number().int().positive().default(cfg.listSize)
        }).parse(req.body ?? {});
        const url = `${cfg.baseUrl}/${body.listId}.json`;
        const bitset = new Bitset(body.size);
        const encoded = bitset.toBase64();
        const base = {
            id: url,
            issuer: cfg.issuerDid,
            statusPurpose: body.statusPurpose,
            encodedList: encoded,
            version: new Date().toISOString(),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        const doc = { ...base, hash: computeHash(base) };
        await storage.write(`statuslists/${body.listId}.json`, doc);
        return reply.code(201).send(doc);
    });
    // POST /status/update -> set/unset bit
    app.post('/status/update', async (req, reply) => {
        const body = z.object({
            listId: z.string(),
            index: z.number().int().nonnegative(),
            value: z.boolean()
        }).parse(req.body);
        const path = `statuslists/${body.listId}.json`;
        const doc = await storage.read(path);
        if (!doc)
            return reply.code(404).send({ error: 'List not found' });
        const bitset = Bitset.fromBase64(doc.encodedList, cfg.listSize);
        bitset.set(body.index, body.value);
        const encodedList = bitset.toBase64();
        const updated = {
            ...doc,
            encodedList,
            updatedAt: new Date().toISOString(),
            version: `${new Date().toISOString()}#${doc.hash.slice(0, 8)}`
        };
        updated.hash = computeHash(updated);
        await storage.write(path, updated);
        return updated;
    });
}
//# sourceMappingURL=status.js.map