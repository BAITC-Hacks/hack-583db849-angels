import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv2020 from 'ajv/dist/2020';
import addFormats from 'ajv-formats';
import { parse } from 'yaml';

/**
 * Validates fixtures against the stand's frozen contract.
 *
 * OpenAPI 3.1 schemas are JSON Schema 2020-12, so AJV validates them directly.
 * Strict mode is off because the document carries OpenAPI keywords — `example`,
 * `discriminator`, the `x-` extensions — that are not JSON Schema vocabulary and
 * would otherwise be reported as faults in the schema rather than in the data.
 *
 * This checks that mock responses match the contract. It is not the runtime
 * conformance work in #21, which validates the real API and is owned elsewhere.
 */
const here = dirname(fileURLToPath(import.meta.url));
const document = parse(readFileSync(join(here, '../../../packages/stand-client/openapi.yaml'), 'utf8'));

const ajv = new Ajv2020({ strict: false, allErrors: true });
addFormats(ajv);
ajv.addSchema(document, 'openapi.yaml');

export function assertMatchesSchema(schemaName: string, data: unknown): void {
  const validate = ajv.getSchema(`openapi.yaml#/components/schemas/${schemaName}`);
  if (!validate) throw new Error(`openapi.yaml has no schema named ${schemaName}`);

  if (!validate(data)) {
    const errors = (validate.errors ?? [])
      .map((error) => `  ${error.instancePath || '/'} ${error.message ?? ''}`)
      .join('\n');
    throw new Error(`Response does not match ${schemaName}:\n${errors}\n\nReceived: ${JSON.stringify(data, null, 2)}`);
  }
}
