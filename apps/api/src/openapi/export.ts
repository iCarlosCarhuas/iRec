import { writeFile } from 'node:fs/promises';
import { openApiDocument } from './document.js';

const output = new URL('../../openapi.generated.json', import.meta.url);
await writeFile(output, `${JSON.stringify(openApiDocument, null, 2)}\n`, 'utf8');
console.log(`OpenAPI exportado en ${output.pathname}`);
