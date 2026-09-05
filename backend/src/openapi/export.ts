/**
 * Build-time script: exports OpenAPI spec to dist/openapi.json
 *
 * Usage: npm run build:openapi
 *
 * This is a standalone script — it does NOT start the server.
 * The output file can be committed, uploaded to a portal, or used by CI.
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { generateOpenApiDocument } from "./registry.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, "../../dist");
const outFile = join(outDir, "openapi.json");

mkdirSync(outDir, { recursive: true });
const spec = generateOpenApiDocument();
writeFileSync(outFile, JSON.stringify(spec, null, 2), "utf8");

console.log(`OpenAPI spec written to ${outFile}`);
console.log(`  OpenAPI version: ${spec.openapi}`);
console.log(`  Title: ${spec.info.title} v${spec.info.version}`);
console.log(`  Paths: ${Object.keys(spec.paths ?? {}).length}`);
