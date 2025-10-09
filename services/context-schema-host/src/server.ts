// src/server.ts
import Fastify from "fastify";
import fastifyStatic from "@fastify/static";
import path from "path";
import fs from "fs";
import { blake2bHex } from "blakejs";

const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || "0.0.0.0";
const PUBLIC_DIR = path.join(process.cwd(), "public");

// cartelle whitelisted
const ALLOWED_ROOTS = ["/contexts/", "/schemas/"];

function getFileHash(filePath: string): string {
  const data = fs.readFileSync(filePath);
  return blake2bHex(data, undefined, 32); // Blake2b-256
}

function isAllowedUrlPath(p: string): boolean {
  const norm = path.posix.normalize(p.startsWith("/") ? p : "/" + p);
  return ALLOWED_ROOTS.some((root) => norm.startsWith(root));
}

function isInside(base: string, target: string): boolean {
  // sicurezza: il path finale deve restare dentro PUBLIC_DIR
  const rel = path.relative(base, target);
  return !!rel && !rel.startsWith("..") && !path.isAbsolute(rel);
}

function walkFiles(rootAbs: string, relBase = ""): string[] {
  // lista ricorsiva dei file
  const out: string[] = [];
  for (const entry of fs.readdirSync(rootAbs, { withFileTypes: true })) {
    const abs = path.join(rootAbs, entry.name);
    const rel = path.posix.join(relBase, entry.name);
    if (entry.isDirectory()) {
      out.push(...walkFiles(abs, rel));
    } else if (entry.isFile()) {
      out.push(rel);
    }
  }
  return out;
}

async function main() {
  const fastify = Fastify({ logger: true });

  // --- STATIC HOSTING (solo contexts/ e schemas/) ---------------------------
  await fastify.register(fastifyStatic, {
    root: PUBLIC_DIR,
    prefix: "/",        // URL base
    index: false,       // no index implicito
    list: false as any, // no directory listing
    serveDotFiles: false,
    allowedPath: (pathname) => {
      // consente SOLO ciò che inizia con /contexts/ o /schemas/
      const norm = path.posix.normalize(pathname);
      return ALLOWED_ROOTS.some((root) => norm.startsWith(root));
    },
  });

  // --- HEALTHCHECK ----------------------------------------------------------
  fastify.get("/ping", async () => ({ ok: true, ts: Date.now() }));

  // --- LIST: mostra SOLO ciò che è esposto ----------------------------------
  fastify.get("/list", async () => {
    const exposed: Record<string, string[]> = {};
    for (const root of ALLOWED_ROOTS) {
      const dir = root.replace(/\//g, ""); // "contexts" | "schemas"
      const abs = path.join(PUBLIC_DIR, dir);
      if (fs.existsSync(abs) && fs.statSync(abs).isDirectory()) {
        exposed[dir] = walkFiles(abs).map((r) => `${dir}/${r}`);
      } else {
        exposed[dir] = [];
      }
    }
    return { exposed };
  });

  // --- HASH: solo su contexts/ e schemas/, con guardie ----------------------
  fastify.get("/hash/*", async (req, reply) => {
    const rel = String((req.params as any)["*"] || "");
    const urlPath = path.posix.normalize("/" + rel);

    // whitelist URL
    if (!isAllowedUrlPath(urlPath)) {
      return reply.code(403).send({ error: "Forbidden" });
    }

    const filePath = path.join(PUBLIC_DIR, urlPath); // converte in path di FS
    // anti-traversal: deve restare dentro PUBLIC_DIR
    if (!isInside(PUBLIC_DIR, filePath)) {
      return reply.code(400).send({ error: "Invalid path" });
    }

    if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
      return reply.code(404).send({ error: "File not found" });
    }

    return { file: urlPath.slice(1), hash: getFileHash(filePath) };
  });

  // --- STARTUP --------------------------------------------------------------
  try {
    const address = await fastify.listen({ port: PORT, host: HOST });
    console.log('ContextSchemaHost running on ${address}');
    console.log('Serving from: ${PUBLIC_DIR}');
    console.log('Exposed roots: ${ALLOWED_ROOTS.join(", ")}');
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
}

main();
