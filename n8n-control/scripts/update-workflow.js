#!/usr/bin/env node

/**
 * Actualiza un workflow en n8n vía REST API.
 *
 * Uso:
 *   node scripts/update-workflow.js                          # modo dry-run (default)
 *   node scripts/update-workflow.js --apply                  # ejecuta la actualización
 *
 * Lee N8N_BASE_URL y N8N_API_KEY desde .env
 * Lee el workflow desde rendiciones/workflows/clean/rendicion-de-gastos.json
 */

const fs = require('fs');
const path = require('path');

// ────────────────────────────────────────────────────────────
// Config
// ────────────────────────────────────────────────────────────
const ROOT = path.resolve(__dirname, '..');
const ENV_PATH = path.join(ROOT, '.env');
const WORKFLOW_PATH = path.join(ROOT, 'rendiciones', 'workflows', 'clean', 'rendicion-de-gastos.json');
const WORKFLOW_ID = 'brquKOgljLZruZBl';

// ────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────

/** Parsea .env manualmente (sin dependencias) */
function loadEnv(filePath) {
  const vars = {};
  const lines = fs.readFileSync(filePath, 'utf8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim();
    vars[key] = val;
  }
  return vars;
}

// ────────────────────────────────────────────────────────────
// Main
// ────────────────────────────────────────────────────────────
async function main() {
  const applyMode = process.argv.includes('--apply');

  // 1. Leer .env
  if (!fs.existsSync(ENV_PATH)) {
    console.error('✖ No se encontró .env en', ENV_PATH);
    process.exit(1);
  }
  const env = loadEnv(ENV_PATH);
  const baseUrl = (env.N8N_BASE_URL || '').replace(/\/+$/, '');
  const apiKey = env.N8N_API_KEY || '';

  if (!baseUrl || !apiKey) {
    console.error('✖ Faltan N8N_BASE_URL o N8N_API_KEY en .env');
    process.exit(1);
  }

  // 2. Leer workflow local
  if (!fs.existsSync(WORKFLOW_PATH)) {
    console.error('✖ No se encontró el workflow en', WORKFLOW_PATH);
    process.exit(1);
  }
  const local = JSON.parse(fs.readFileSync(WORKFLOW_PATH, 'utf8'));

  // 3. Validar campos requeridos
  const required = ['name', 'nodes', 'connections', 'settings'];
  const missing = required.filter(k => !(k in local));
  if (missing.length > 0) {
    console.error('✖ Faltan campos en el JSON local:', missing.join(', '));
    process.exit(1);
  }
  console.log('✔ JSON local válido');
  console.log('  name:', local.name);
  console.log('  nodes:', local.nodes.length);
  console.log('  connections:', Object.keys(local.connections).length, 'fuentes');

  // 4. GET workflow remoto para comparar versionId
  const endpoint = `${baseUrl}/api/v1/workflows/${WORKFLOW_ID}`;
  console.log('\n── GET', endpoint);

  const getRes = await fetch(endpoint, {
    method: 'GET',
    headers: { 'X-N8N-API-KEY': apiKey },
  });

  if (!getRes.ok) {
    const body = await getRes.text();
    console.error('✖ Error al obtener workflow remoto:', getRes.status, body);
    process.exit(1);
  }

  const remote = await getRes.json();
  console.log('✔ Workflow remoto obtenido');
  console.log('  name:', remote.name);
  console.log('  active:', remote.active);
  console.log('  versionId remoto:', remote.versionId);
  console.log('  versionId local: ', local.versionId);

  if (local.versionId !== remote.versionId) {
    console.warn('\n⚠  CONFLICTO DE VERSION');
    console.warn('   El versionId local no coincide con el remoto.');
    console.warn('   Esto significa que el workflow fue editado en n8n desde la última exportación.');
    console.warn('   Si continuás, se sobreescriben los cambios remotos.');
    if (!applyMode) {
      console.log('\n   Usá --apply para forzar la actualización de todas formas.');
    }
  }

  // 5. Construir payload
  // NOTA: "active" es read-only en PUT; se gestiona con /activate y /deactivate
  // NOTA: "settings" es requerido pero el schema del PUT no acepta todas las
  //       propiedades que devuelve el GET (availableInMCP, timeSavedMode, etc.)
  //       Enviando {} n8n preserva los settings existentes.
  const payload = {
    name: local.name,
    nodes: local.nodes,
    connections: local.connections,
    settings: {},
  };

  console.log('\n── Payload a enviar ──');
  console.log('  Método:  PUT');
  console.log('  URL:    ', endpoint);
  console.log('  Header:  X-N8N-API-KEY: ****' + apiKey.slice(-8));
  console.log('  Body:');
  console.log('    name:', payload.name);
  console.log('    nodes:', payload.nodes.length);
  console.log('    connections:', Object.keys(payload.connections).length, 'fuentes');
  console.log('    settings: {} (n8n preserva los existentes)');
  console.log('    active: (no enviado, read-only — estado actual:', remote.active + ')');

  // 6. Dry run o apply
  if (!applyMode) {
    console.log('\n── DRY RUN ──');
    console.log('No se aplicaron cambios. Usá --apply para ejecutar la actualización.');
    return;
  }

  console.log('\n── Aplicando actualización... ──');

  const putRes = await fetch(endpoint, {
    method: 'PUT',
    headers: {
      'X-N8N-API-KEY': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const putBody = await putRes.text();

  if (!putRes.ok) {
    console.error('✖ Error en PUT:', putRes.status);
    console.error(putBody);
    process.exit(1);
  }

  const result = JSON.parse(putBody);
  console.log('\n✔ Actualización aplicada');
  console.log('  id:', result.id);
  console.log('  name:', result.name);
  console.log('  active:', result.active);
  console.log('  versionId nuevo:', result.versionId);
  console.log('  updatedAt:', result.updatedAt);

  // 7. Actualizar versionId local para mantener sincronía
  local.versionId = result.versionId;
  fs.writeFileSync(WORKFLOW_PATH, JSON.stringify(local, null, 2) + '\n', 'utf8');
  console.log('\n✔ versionId local actualizado a', result.versionId);
}

main().catch(err => {
  console.error('✖ Error inesperado:', err.message);
  process.exit(1);
});
