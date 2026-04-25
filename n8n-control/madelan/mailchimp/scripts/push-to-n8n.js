#!/usr/bin/env node

/**
 * Push workflow a n8n vía REST API.
 *
 * Uso:
 *   node scripts/push-to-n8n.js                # dry-run (default)
 *   node scripts/push-to-n8n.js --apply        # crear o actualizar en n8n
 *
 * Lee N8N_BASE_URL y N8N_API_KEY desde ../../.env (raíz de n8n-control)
 */

const fs = require('fs');
const path = require('path');

// ── Config ───────────────────────────────────────────────────
const ROOT = path.resolve(__dirname, '..', '..', '..');
const MAILCHIMP_DIR = path.resolve(__dirname, '..');
const ENV_PATH = path.join(ROOT, 'n8n-control', '.env');
const WORKFLOW_PATH = path.join(MAILCHIMP_DIR, 'workflows', 'clean', 'mailchimp-contacts-sync.json');
const ID_FILE = path.join(MAILCHIMP_DIR, '.workflow-id');

// ── Helpers ──────────────────────────────────────────────────

function loadEnv(filePath) {
  const vars = {};
  if (!fs.existsSync(filePath)) return vars;
  const lines = fs.readFileSync(filePath, 'utf8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    vars[trimmed.slice(0, eqIdx).trim()] = trimmed.slice(eqIdx + 1).trim();
  }
  return vars;
}

function readWorkflowId() {
  if (fs.existsSync(ID_FILE)) {
    return fs.readFileSync(ID_FILE, 'utf8').trim();
  }
  return null;
}

function saveWorkflowId(id) {
  fs.writeFileSync(ID_FILE, id + '\n', 'utf8');
}

// ── Main ─────────────────────────────────────────────────────

async function main() {
  const applyMode = process.argv.includes('--apply');

  // 1. Leer .env
  const env = loadEnv(ENV_PATH);
  const baseUrl = (env.N8N_BASE_URL || process.env.N8N_BASE_URL || '').replace(/\/+$/, '');
  const apiKey = env.N8N_API_KEY || process.env.N8N_API_KEY || '';

  if (!baseUrl || !apiKey) {
    console.error('✖ Faltan N8N_BASE_URL o N8N_API_KEY');
    console.error('  Buscado en:', ENV_PATH);
    process.exit(1);
  }

  // 2. Leer workflow local
  if (!fs.existsSync(WORKFLOW_PATH)) {
    console.error('✖ No se encontró el workflow en', WORKFLOW_PATH);
    process.exit(1);
  }
  const local = JSON.parse(fs.readFileSync(WORKFLOW_PATH, 'utf8'));

  const required = ['name', 'nodes', 'connections'];
  const missing = required.filter(k => !(k in local));
  if (missing.length > 0) {
    console.error('✖ Faltan campos en el JSON:', missing.join(', '));
    process.exit(1);
  }

  console.log('✔ JSON local válido');
  console.log('  name:', local.name);
  console.log('  nodes:', local.nodes.length);
  console.log('  connections:', Object.keys(local.connections).length, 'fuentes');

  // 3. Determinar si crear o actualizar
  const existingId = readWorkflowId();
  const isUpdate = !!existingId;

  const payload = {
    name: local.name,
    nodes: local.nodes,
    connections: local.connections,
    settings: local.settings || {},
  };

  if (isUpdate) {
    console.log('\n── Modo: ACTUALIZAR workflow existente ──');
    console.log('  ID:', existingId);
  } else {
    console.log('\n── Modo: CREAR workflow nuevo ──');
  }

  console.log('  URL base:', baseUrl);
  console.log('  API Key: ****' + apiKey.slice(-8));

  // 4. Dry run o apply
  if (!applyMode) {
    console.log('\n── DRY RUN ──');
    console.log('No se aplicaron cambios. Usá --apply para ejecutar.');
    return;
  }

  // 5. Ejecutar
  let endpoint, method;

  if (isUpdate) {
    endpoint = `${baseUrl}/api/v1/workflows/${existingId}`;
    method = 'PUT';
  } else {
    endpoint = `${baseUrl}/api/v1/workflows`;
    method = 'POST';
  }

  console.log(`\n── ${method} ${endpoint} ──`);

  const res = await fetch(endpoint, {
    method,
    headers: {
      'X-N8N-API-KEY': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const body = await res.text();

  if (!res.ok) {
    console.error(`✖ Error ${method}:`, res.status);
    console.error(body);
    process.exit(1);
  }

  const result = JSON.parse(body);

  console.log('\n✔ Workflow ' + (isUpdate ? 'actualizado' : 'creado'));
  console.log('  id:', result.id);
  console.log('  name:', result.name);
  console.log('  active:', result.active);
  console.log('  versionId:', result.versionId);

  // 6. Guardar ID para futuras actualizaciones
  saveWorkflowId(result.id);
  console.log('\n✔ ID guardado en', ID_FILE);

  // 7. Actualizar versionId en el JSON local
  local.versionId = result.versionId;
  local.id = result.id;
  fs.writeFileSync(WORKFLOW_PATH, JSON.stringify(local, null, 2) + '\n', 'utf8');
  console.log('✔ versionId local actualizado');
}

main().catch(err => {
  console.error('✖ Error inesperado:', err.message);
  process.exit(1);
});
