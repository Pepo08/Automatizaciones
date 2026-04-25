#!/usr/bin/env node
/**
 * Crea un workflow nuevo en n8n via REST API.
 *
 * Uso:
 *   node scripts/create-workflow.js <path-to-json>              # modo dry-run (default)
 *   node scripts/create-workflow.js <path-to-json> --apply      # crea el workflow
 *
 * Lee N8N_BASE_URL y N8N_API_KEY desde .env
 */

const fs = require('fs');
const path = require('path');

// ────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────

function loadEnv(filePath) {
  if (!fs.existsSync(filePath)) throw new Error(`No existe .env en: ${filePath}`);
  const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIndex = trimmed.indexOf('=');
    if (eqIndex === -1) continue;
    process.env[trimmed.slice(0, eqIndex).trim()] = trimmed.slice(eqIndex + 1).trim();
  }
}

// ────────────────────────────────────────────────────────────
// Main
// ────────────────────────────────────────────────────────────

async function main() {
  const ROOT = path.resolve(__dirname, '..');
  loadEnv(path.join(ROOT, '.env'));

  const filePath = process.argv[2];
  if (!filePath) {
    console.error('Uso: node scripts/create-workflow.js <path-to-json> [--apply]');
    process.exit(1);
  }

  const applyMode = process.argv.includes('--apply');
  const baseUrl = (process.env.N8N_BASE_URL || '').replace(/\/+$/, '');
  const apiKey = process.env.N8N_API_KEY || '';

  if (!baseUrl || !apiKey) {
    console.error('Faltan N8N_BASE_URL o N8N_API_KEY en .env');
    process.exit(1);
  }

  const absPath = path.resolve(filePath);
  if (!fs.existsSync(absPath)) {
    console.error('No existe:', absPath);
    process.exit(1);
  }

  const workflow = JSON.parse(fs.readFileSync(absPath, 'utf8'));

  const required = ['name', 'nodes', 'connections'];
  const missing = required.filter(k => !(k in workflow));
  if (missing.length > 0) {
    console.error('Faltan campos en el JSON:', missing.join(', '));
    process.exit(1);
  }

  console.log('JSON local valido');
  console.log('  name:', workflow.name);
  console.log('  nodes:', workflow.nodes.length);
  console.log('  connections:', Object.keys(workflow.connections).length, 'fuentes');

  const payload = {
    name: workflow.name,
    nodes: workflow.nodes,
    connections: workflow.connections,
    settings: workflow.settings || {},
  };

  const endpoint = `${baseUrl}/api/v1/workflows`;

  console.log('\n-- Payload --');
  console.log('  Metodo:  POST');
  console.log('  URL:    ', endpoint);
  console.log('  Header:  X-N8N-API-KEY: ****' + apiKey.slice(-8));
  console.log('  Body:');
  console.log('    name:', payload.name);
  console.log('    nodes:', payload.nodes.length);
  console.log('    connections:', Object.keys(payload.connections).length, 'fuentes');

  if (!applyMode) {
    console.log('\n-- DRY RUN --');
    console.log('No se creo nada. Usa --apply para crear el workflow.');
    return;
  }

  console.log('\n-- Creando workflow... --');

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'X-N8N-API-KEY': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const body = await res.text();

  if (!res.ok) {
    console.error('Error en POST:', res.status);
    console.error(body);
    process.exit(1);
  }

  const result = JSON.parse(body);
  console.log('\nWorkflow creado');
  console.log('  id:', result.id);
  console.log('  name:', result.name);
  console.log('  active:', result.active);
  console.log('  versionId:', result.versionId);
  console.log('  createdAt:', result.createdAt);

  // Guardar id y versionId en el JSON local
  workflow.id = result.id;
  workflow.versionId = result.versionId;
  fs.writeFileSync(absPath, JSON.stringify(workflow, null, 2) + '\n', 'utf8');
  console.log('\nid y versionId guardados en', absPath);
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
