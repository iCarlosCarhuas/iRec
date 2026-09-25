import { readFile, writeFile } from 'node:fs/promises';

const VERSION = '0.3.0';
const RELEASE_DATE = '2026-09-25';

const packageFiles = [
  'package.json',
  'apps/api/package.json',
  'apps/web/package.json',
  'packages/contracts/package.json',
];

async function read(path) {
  return readFile(path, 'utf8');
}

async function write(path, value) {
  await writeFile(path, value.replace(/\r\n/g, '\n'), 'utf8');
}

async function updatePackageVersion(path) {
  const source = await read(path);
  const json = JSON.parse(source);
  if (json.version !== '0.2.0' && json.version !== VERSION) {
    throw new Error(`${path}: version inesperada ${json.version}`);
  }
  json.version = VERSION;
  await write(path, `${JSON.stringify(json, null, 2)}\n`);
  console.log(`[OK] ${path} -> ${VERSION}`);
}

for (const path of packageFiles) {
  await updatePackageVersion(path);
}

{
  const path = 'compose.yaml';
  let source = (await read(path)).replace(/\r\n/g, "\n");

  source = source
    .replaceAll('irec-api:0.2.0-dev', 'irec-api:0.3.0-dev')
    .replaceAll('irec-web:0.2.0-dev', 'irec-web:0.3.0-dev');

  if (source.includes('irec-api:0.2.0-dev') || source.includes('irec-web:0.2.0-dev')) {
    throw new Error('compose.yaml todavía contiene tags Docker 0.2.0-dev');
  }

  await write(path, source);
  console.log('[OK] compose.yaml -> Docker tags 0.3.0-dev');
}

const techSection = `## [${VERSION}] - ${RELEASE_DATE}

### Album Core

#### Added
- Dominio persistente de álbumes con propietario, título, descripción y visibilidad \`public|private\`.
- Membresías por álbum con roles \`owner|member\` y estados \`active|invited|removed\`.
- Invariante de creación: el propietario queda registrado como miembro \`owner/active\` dentro de la misma transacción.
- API para crear, listar, consultar y editar álbumes.
- API de miembros para listar, invitar por correo, aceptar invitaciones y remover membresías sin borrar el registro.
- Propuestas de contenido de texto con estados \`pending|approved|rejected\`.
- Moderación owner-only para aprobar o rechazar propuestas.
- UI Angular para listado, creación, detalle, edición, miembros, invitaciones, propuestas y moderación.
- Ruta de aceptación de invitación autenticada.
- Vista pública anónima de solo lectura en \`/a/:albumId\`.
- Estado público genérico para álbum privado o inexistente, evitando revelar sus datos.
- Baseline de Data Safety para backup, verificación, restore-test y restore protegido de PostgreSQL.
- Gates versionados AD-1 a AD-6 y documentación técnica de Album Core.

#### Database
- Migración aditiva \`0001_spotty_forgotten_one.sql\` para álbumes y membresías.
- Migración aditiva \`0002_volatile_raza.sql\` para propuestas y moderación.
- Sin operaciones de borrado, truncado o reset como parte del release.

#### Security / Authorization
- Álbum privado accesible solo por owner o miembro activo.
- Edición del álbum y administración de miembros restringidas al owner.
- Creación de propuestas restringida a miembros activos distintos del owner.
- Moderación restringida al owner.
- Vista pública no expone roster, propuestas ni controles autenticados.

#### Validation
- Source gates AD-1 a AD-6 incorporados al repositorio.
- Gate de release \`scripts/release/verify-v030.ps1\` para contracts, API, OpenAPI y Web.
- Matriz Runtime/E2E documentada en \`docs/RELEASE/V0.3.0-E2E.md\`.

`;

const nontechSection = `## [${VERSION}] - ${RELEASE_DATE}

### Album Core

#### Added
- Los usuarios autenticados pueden crear y administrar múltiples álbumes.
- Cada álbum puede mantenerse privado o publicarse.
- El propietario puede invitar a otro usuario registrado al álbum.
- El invitado puede aceptar su participación y pasar a ser miembro activo.
- Los miembros pueden proponer contenido para el álbum.
- El propietario puede aprobar o rechazar esas propuestas.
- La interfaz muestra funciones distintas según el rol del usuario.
- Un álbum público puede compartirse mediante un enlace de solo lectura sin iniciar sesión.
- Un álbum privado no revela su contenido desde el enlace público.

#### Scope
- Este release cubre identidad + núcleo de álbumes.
- Fotos/R2, generación temática con IA, YouTube y transmisión en vivo permanecen fuera de v0.3.0.

`;

async function updateTechChangelog() {
  const path = 'docs/TECH/CHANGELOG.md';
  let source = (await read(path)).replace(/\r\n/g, "\n");

  if (!source.includes(`## [${VERSION}] - ${RELEASE_DATE}`)) {
    const marker = '## [Unreleased]\n';
    if (!source.includes(marker)) {
      throw new Error(`${path}: no se encontró [Unreleased]`);
    }
    source = source.replace(marker, `${marker}\n${techSection}`);
  }

  source = source.replace(
    '### v0.2.0 — Identity (en integración)',
    '## [0.2.0]\n\n### Identity',
  );

  await write(path, source);
  console.log('[OK] TECH changelog preparado para v0.3.0');
}

async function updateNonTechChangelog() {
  const path = 'docs/NONTECH/CHANGELOG.md';
  let source = (await read(path)).replace(/\r\n/g, "\n");

  if (!source.includes(`## [${VERSION}] - ${RELEASE_DATE}`)) {
    const marker = '## [Unreleased]\n';
    if (!source.includes(marker)) {
      throw new Error(`${path}: no se encontró [Unreleased]`);
    }
    source = source.replace(marker, `${marker}\n${nontechSection}`);
  }

  source = source.replace(
    '### v0.2.0 — Identity (en integración)',
    '## [0.2.0]\n\n### Identity',
  );

  source = source.replace(
    '- Identity backend está validado; las pantallas frontend todavía no forman\n  parte de una release pública.',
    '- Identity backend y frontend forman parte de la release v0.2.0.',
  );

  source = source.replace(
    '- E2E: pendiente.\n- `v0.2.0`: todavía no liberado.',
    '- `v0.2.0`: liberado y versionado.',
  );

  await write(path, source);
  console.log('[OK] NONTECH changelog preparado para v0.3.0');
}

await updateTechChangelog();
await updateNonTechChangelog();

console.log('');
console.log('[OK] Preparación de v0.3.0 completada.');
console.log('[NEXT] Revisar git diff y ejecutar scripts/release/verify-v030.ps1.');
