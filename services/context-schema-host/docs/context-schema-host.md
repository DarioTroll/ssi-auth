# Context Schema Host Module Documentation

## Why This Service Exists
- Hosts JSON-LD contexts and JSON Schemas that define the data model for the SSI platform’s Verifiable Credentials.
- Restricts exposure to the `/contexts/` and `/schemas/` trees so only vetted artefacts are publicly reachable.
- Computes BLAKE2b-256 hashes on demand for published files, enabling downstream integrity checks and on-chain anchoring.
- Offers auxiliary tooling to validate schemas and example payloads during development and CI.

## High-Level Flow
1. **Configuration**: `src/server.ts` reads `PORT` and `HOST` (default `3000` / `0.0.0.0`) to decide where to listen.
2. **Static Serving**: Fastify + `@fastify/static` serve files from `public/`, with an `allowedPath` guard to expose only `/contexts/*` and `/schemas/*`.
3. **Discovery & Health**: `/ping` returns a health heartbeat; `/list` enumerates the exact files currently exposed under the whitelisted roots.
4. **Integrity Hashing**: `/hash/<path>` validates the path, reads the file from disk, and responds with a BLAKE2b-256 digest.
5. **Tooling**: `src/tools/validator.ts` can be run manually or in CI to ensure schemas compile and example payloads conform before deployment.

## Environment & Runtime Expectations
- Optional `.env` values:
  - `PORT`: listening port (defaults to `3000`).
  - `HOST`: interface to bind (defaults to `0.0.0.0`).
- Files in `public/contexts/` and `public/schemas/` must be committed or deployed before starting the server; the service does not generate them at runtime.
- All public URLs are expected to be reverse-proxied CDN endpoints aligning with the directory layout.

## Code and Asset Inventory

### `.env`
- Optional configuration file for local development. Define `PORT`/`HOST` here if you do not want the defaults.

### `package.json`
- Declares Fastify, `@fastify/static`, `blakejs`, and `ajv` dependencies.
- Scripts:
  - `npm run dev`: start the Fastify server via `ts-node/esm`.
  - `npm run build`: transpile TypeScript sources into the `dist/` directory.
  - `npm run validate`: (if configured) typically wraps `ts-node src/tools/validator.ts` to validate schemas; create this script if needed.

### `package-lock.json`
- Locks dependency versions for reproducible installs.

### `tsconfig.json`
- TypeScript compiler options targeting modern Node ESM, aligning module resolution for both runtime and the validator tool.

### `dist/`
- Compiled JavaScript output after running `npm run build`. Mirrors the runtime logic of `src/`.

### `node_modules/`
- Installed third-party packages. Not edited directly.

### `types/fastify-static.d.ts`
- Declares module typings for `@fastify/static` (missing from DefinitelyTyped for the version in use) so TS compilation succeeds without errors.

### `public/`
- Root for all publicly served assets. Structured as follows:
  - `public/contexts/v1/*.jsonld`: JSON-LD context documents (e.g., `degree.jsonld`, `nationality.jsonld`, `age-over.jsonld`) referenced by issued credentials. These define term mappings and embed semantics for consumers.
  - `public/schemas/v1/*.schema.json`: JSON Schemas describing credential payloads and proofs (`vc-base`, `vc-proof-jwt`, `vc-proof-di`, domain-specific credential schemas such as `vc-degree.schema.json`).
  - `public/examples/*.json`: Sample credential payloads used by the validator tool. Each embeds `$schemaRef` (and optionally `$vcSchemaRef`) to declare which schema should validate it.

### `src/server.ts`
- Program entrypoint.
- Configures Fastify server with logging enabled.
- Registers `@fastify/static` pointing at `public/`, but restricts `allowedPath` to `/contexts/` and `/schemas/` to prevent accidental leakage of other files under `public/`.
- Implements `getFileHash` using `blake2bHex` to produce 32-byte (256-bit) hashes for any served resource.
- Defines guard helpers (`isAllowedUrlPath`, `isInside`) to block path traversal and enforce whitelist constraints on `/hash/*` requests.
- Recursively walks directories via `walkFiles` to power the `/list` endpoint response.
- Exposes endpoints:
  - `GET /ping`: returns `{ ok: true, ts: <timestamp> }` for monitoring.
  - `GET /list`: lists all exposed files grouped by root (`contexts`, `schemas`).
  - `GET /hash/<path>`: returns `{ file, hash }` if the file exists under the allowed roots; otherwise returns appropriate HTTP errors (403, 400, 404).
- Logs startup information (address, serving directory, allowed roots) after binding the socket.

### `src/hashFile.ts`
- Currently empty placeholder. Intended for future extraction of the hashing logic shared between the server and tooling. Documented here to flag its availability for future refactoring.

### `src/routes/contexts.ts` & `src/routes/schemas.ts`
- Empty stubs. Reserved for potential route modularisation (if the service evolves towards dynamic behaviour). Kept to signal intended separation should additional context or schema management routes be added.

### `src/tools/validator.ts`
- Standalone Node script to validate schemas and examples. Steps:
  1. **Discovery**: Recursively loads all `*.schema.json` files under `public/schemas` and JSON example files under `public/examples`.
  2. **Registration**: Registers each schema with AJV (draft-07) using either `$id` or file path as identifier.
  3. **Compilation**: Calls `ajv.getSchema(id)` to ensure every schema compiles without unresolved references.
  4. **Example Validation**: For each example JSON:
     - Requires `$schemaRef` to choose the primary schema.
     - Strips metadata fields (`$schemaRef`, `$vcSchemaRef`) before validation.
     - Validates the document against the primary schema.
     - If the primary schema equals the JWT profile schema (`vc-proof-jwt.schema.json`), it optionally validates the embedded `payload.vc` against `$vcSchemaRef` or a sensible default (`vc-age-over.schema.json`).
  5. **Reporting**: Logs successes with relative paths, aggregates failures, and exits with status `1` if any schema or example is invalid.
- Designed to run via `ts-node` so TypeScript type checking is retained during tooling execution.

### `public/contexts/v1/*`
- Individual JSON-LD files. For example:
  - `degree.jsonld`: Defines terms for degree-related credentials.
  - `nationality.jsonld`: Captures nationality credential vocabulary.
  - `age-over.jsonld`: Supports minimum-age assertions.
- These documents are resolved by credential verifiers when processing JSON-LD credentials.

### `public/schemas/v1/*`
- JSON Schema files guiding issuer/verifier validation. Highlights:
  - `vc-base.schema.json`: Base attributes shared across credentials.
  - `vc-proof-di.schema.json`: Di-signature proof profile.
  - `vc-proof-jwt.schema.json`: JWT credential proof structure.
  - `vc-age-over.schema.json`, `vc-degree.schema.json`, `vc-nationality.schema.json`: Domain-specific credential shapes.

### `public/examples/*`
- Sample payloads demonstrating valid credentials (`age-over-valid.json`, `degree-di-valid.json`, etc.).
- Used by the validator tool to verify schema coverage and catch regressions.

## Operational Steps
1. **Install dependencies**: `npm install` (from `services/context-schema-host`).
2. **Validate assets**: `npx ts-node src/tools/validator.ts` (or run the equivalent npm script) to ensure schemas and examples are consistent.
3. **Run locally**: `npm run dev` to start the server at `http://localhost:3000`.
4. **Monitor**: Hit `/ping` for health checks, `/list` to audit exposed files, and `/hash/<path>` to retrieve content digests.
5. **Deploy**: Build artefacts (`npm run build`) and run `node dist/server.js` behind your preferred process manager or container runtime.

## Extensibility Notes
- To expose additional directories, update `ALLOWED_ROOTS` and adjust the `@fastify/static` `allowedPath` guard accordingly.
- If server-side transformations are needed (e.g., automatic schema bundling), populate the currently empty `src/routes/*.ts` with modular route handlers and register them from `src/server.ts`.
- Consider extracting the hashing logic into `src/hashFile.ts` to share between HTTP handlers and future CLI tools.
- Extend the validator to cover negative test cases or to emit machine-readable reports suitable for CI pipelines.

