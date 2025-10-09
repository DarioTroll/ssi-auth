// src/tools/validator.ts
import fs from "fs";
import path from "path";
import Ajv from "ajv";
import addFormats from "ajv-formats";

// cartelle di lavoro
const SCHEMAS_DIR = path.join(process.cwd(), "public", "schemas");
const EXAMPLES_DIR = path.join(process.cwd(), "public", "examples");

// setup AJV per draft-07
const ajv = new Ajv({ allErrors: true, strict: false, schemaId: "$id" });
addFormats(ajv);
// meta-schema draft-07
// @ts-ignore
// ajv.addMetaSchema(require("ajv/dist/refs/json-schema-draft-07.json"));

// utility
function listFiles(dir: string, predicate: (f: string) => boolean): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .flatMap((e) => {
      const p = path.join(dir, e);
      const st = fs.statSync(p);
      if (st.isDirectory()) return listFiles(p, predicate);
      return predicate(p) ? [p] : [];
    });
}

function readJson(p: string) {
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

let failed = false;

// --- PASSO A: carica TUTTI gli schemi in memoria
const schemaFiles = listFiles(SCHEMAS_DIR, (p) => p.endsWith(".schema.json"));
const schemas = schemaFiles.map((file) => ({ file, schema: readJson(file) }));

// --- PASSO B: registra tutti (nessuna compilazione qui)
for (const { file, schema } of schemas) {
  try {
    const id = schema.$id || file;
    ajv.removeSchema(id);
    ajv.addSchema(schema, id); // registra, ma non compila ancora
  } catch (err: any) {
    failed = true;
    console.error(`Schema NON registrato: ${file}`);
    console.error(err?.message || err);
  }
}

// --- PASSO C: ora "compila" (getSchema) quando TUTTI i $id sono noti
for (const { file, schema } of schemas) {
  try {
    const id = schema.$id || file;
    const compiled = ajv.getSchema(id); // qui compila davvero
    if (!compiled) throw new Error("Schema non compilato");
    console.log(`Schema OK: ${path.relative(process.cwd(), file)}`);
  } catch (err: any) {
    failed = true;
    console.error(`Schema NON valido: ${file}`);
    console.error(err?.message || err);
  }
}


// 2) Valida esempi VC (se presenti) contro lo schema “giusto”
/**
 * Convenzioni per gli esempi (consigliate):
 * - public/examples/<name>.json
 * - $schemaRef:   <$id dello schema primario>     (OBBLIGATORIO)
 * - $vcSchemaRef: <$id dello schema della VC>     (OPZIONALE; usato per profilo JWT-VC)
 */
const exampleFiles = listFiles(EXAMPLES_DIR, (p) => p.endsWith(".json"));

function isJwtSchemaRef(ref: string): boolean {
  return ref.trim().toLowerCase() === "https://localhost:3000/schemas/v1/vc-proof-jwt.schema.json";
}

for (const file of exampleFiles) {
  try {
    const doc = readJson(file);

    // --- 1) recupera schema primario
    const schemaRef: string | undefined = doc.$schemaRef;
    if (!schemaRef) {
      throw new Error('Manca "$schemaRef" nell\'esempio');
    }
    const validatePrimary = ajv.getSchema(schemaRef);
    if (!validatePrimary) {
      throw new Error(`Schema non registrato: ${schemaRef}`);
    }

    // --- 2) rimuovi metadati dal documento prima della validazione
    const { $schemaRef, $vcSchemaRef, ...docForValidation } = doc;

    // --- 3) valida contro lo schema primario
    let ok = !!validatePrimary(docForValidation);
    const errors: any[] = [];
    if (!ok) {
      errors.push(...(validatePrimary.errors || []));
    }

    // --- 4) se profilo JWT-VC, valida anche payload.vc contro schema VC esteso
    if (ok && isJwtSchemaRef(schemaRef)) {
      const vc = (docForValidation as any).vc;
      if (!vc) {
        ok = false;
        errors.push({ message: "payload.vc mancante per profilo JWT-VC" });
      } else {
        // preferisci il riferimento esplicito se presente; altrimenti fallback ragionevole
        const vcSchemaRef: string =
          (typeof $vcSchemaRef === "string" && $vcSchemaRef.length > 0)
            ? $vcSchemaRef
            : "https://localhost:3000/schemas/v1/vc-age-over.schema.json";

        const validateVC = ajv.getSchema(vcSchemaRef);
        if (!validateVC) {
          ok = false;
          errors.push({ message: `Schema VC non registrato: ${vcSchemaRef}` });
        } else {
          const okVC = !!validateVC(vc);
          if (!okVC) errors.push(...(validateVC.errors || []));
          ok = ok && okVC;
        }
      }
    }

    if (!ok) {
      failed = true;
      console.error(`Esempio NON valido: ${file}`);
      console.error(errors);
    } else {
      console.log(`Esempio OK: ${path.relative(process.cwd(), file)} (→ ${schemaRef})`);
    }
  } catch (err: any) {
    failed = true;
    console.error(`Errore esempio: ${file}`);
    console.error(err?.message || err);
  }
}

// 3) Exit code per CI
if (failed) {
  console.error("Validazione fallita.");
  process.exit(1);
} else {
  console.log("Tutto valido.");
  process.exit(0);
}
