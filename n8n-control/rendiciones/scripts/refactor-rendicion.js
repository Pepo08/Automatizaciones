#!/usr/bin/env node

/**
 * Script de refactorización para el workflow "Rendición de gastos".
 *
 * Cambios que aplica:
 *   1. Renombra nodos genéricos a nombres descriptivos
 *   2. Corrige typos (rendision → rendición)
 *   3. Actualiza TODAS las referencias $('...') en expresiones y jsCode
 *   4. Actualiza TODAS las conexiones (keys + targets)
 *   5. Corrige chatId hardcodeado en confirmacion_carga_usuario
 *   6. Limpia código muerto (comentarios) en Validador de datos pdf/fotos
 *   7. Limpia código muerto en idempotencia img code
 *
 * Uso:  node rendiciones/scripts/refactor-rendicion.js
 */

const fs = require('fs');
const path = require('path');

// ────────────────────────────────────────────────────────────
// Rutas
// ────────────────────────────────────────────────────────────
const WORKFLOW_PATH = path.resolve(
  __dirname, '..', 'workflows', 'clean', 'rendicion-de-gastos.json'
  // __dirname = rendiciones/scripts/, '..' = rendiciones/
);

// ────────────────────────────────────────────────────────────
// Mapa de renombramientos
// ────────────────────────────────────────────────────────────
const RENAMES = {
  // ── If genéricos ──
  'If':  'tiene_contenido_valido',
  'If2': 'es_del_usuario',
  'If3': 'decision_OK',

  // ── Get a file genéricos ──
  'Get a file':  'descargar_imagen',
  'Get a file2': 'descargar_archivo_item',
  'Get a file3': 'descargar_pdf',
  'Get a file4': 'descargar_archivo_items',

  // ── Send a text message genéricos ──
  'Send a text message':  'respuesta_rechazo',
  'Send a text message1': 'respuesta_chat',
  'Send a text message4': 'respuesta_aclaracion',
  'Send a text message5': 'error_subida_archivo',
  'Send a text message6': 'resumen_rendiciones',
  'Send a text message8': 'confirmacion_carga_usuario',

  // ── Code / NoOp / Loop / Aggregate ──
  'Code in JavaScript':       'parsear_mensajes_telegram',
  'No Operation, do nothing':  'descarte_sin_mensajes',
  'No Operation, do nothing1': 'descarte_tipo_desconocido',
  'Loop Over Items':           'iterar_rendiciones',
  'Loop Over Items1':          'iterar_items_gasto',
  'Aggregate':                 'agregar_rendiciones',
  'Aggregate1':                'agregar_items_con_iva',

  // ── Google Sheets genéricos ──
  'Get row(s) in sheet':  'obtener_conversacion',
  'Get row(s) in sheet1': 'obtener_rendiciones_pendientes',
  'Get row(s) in sheet4': 'obtener_datos_idemp_text',
  'Get row(s) in sheet5': 'obtener_datos_idemp_pdf',
  'Get row(s) in sheet6': 'obtener_datos_idemp_img',
  'Update row in sheet':  'actualizar_conv_post_chat',
  'Update row in sheet1': 'actualizar_conv_post_envio',
  'Update row in sheet2': 'actualizar_conv_post_aclaracion',

  // ── AI / LLM ──
  'OpenAI Chat Model':  'modelo_parser_rendicion',
  'OpenAI Chat Model1': 'modelo_chat_conversacional',
  'AI Agent':           'agente_chat',
  'AI Agent1':          'agente_parser_rendicion',

  // ── Typos ──
  'Crear rendision':  'crear_rendicion',
  'Enviar Rendision': 'enviar_rendicion',

  // ── Validaciones duplicadas → nombres claros ──
  'Estan bien los datos?':  'validacion_datos_text',
  'Estan bien los datos?1': 'validacion_datos_pdf_img',
};

// ────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────

/** Escapa caracteres especiales de regex */
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Recorre recursivamente un valor JSON y reemplaza todas las
 * ocurrencias de $('OldName') y $("OldName") en strings.
 */
function replaceRefs(value, renames) {
  if (typeof value === 'string') {
    let result = value;
    for (const [oldName, newName] of Object.entries(renames)) {
      const esc = escapeRegex(oldName);
      // $('OldName')  →  $('NewName')
      result = result.replace(
        new RegExp(`\\$\\('${esc}'\\)`, 'g'),
        `$('${newName}')`
      );
      // $("OldName")  →  $("NewName")
      result = result.replace(
        new RegExp(`\\$\\("${esc}"\\)`, 'g'),
        `$("${newName}")`
      );
    }
    return result;
  }
  if (Array.isArray(value)) {
    return value.map(v => replaceRefs(v, renames));
  }
  if (value !== null && typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      out[k] = replaceRefs(v, renames);
    }
    return out;
  }
  return value;
}

/** Renombra targets ("node": "X") en el objeto de conexiones */
function renameTargets(obj, renames) {
  if (Array.isArray(obj)) {
    obj.forEach(item => renameTargets(item, renames));
  } else if (obj !== null && typeof obj === 'object') {
    if (typeof obj.node === 'string' && renames[obj.node]) {
      obj.node = renames[obj.node];
    }
    for (const val of Object.values(obj)) {
      renameTargets(val, renames);
    }
  }
}

/**
 * Limpia código comentado de un jsCode.
 * Elimina líneas que empiezan con // y colapsa líneas vacías consecutivas.
 */
function cleanDeadCode(jsCode, headerComment) {
  const lines = jsCode.split('\n');
  const cleaned = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('//')) continue;   // eliminar líneas comentadas
    cleaned.push(line);
  }

  // Colapsar líneas vacías consecutivas (máximo 1)
  const collapsed = [];
  for (let i = 0; i < cleaned.length; i++) {
    const isEmpty = cleaned[i].trim() === '';
    const prevEmpty = collapsed.length > 0 && collapsed[collapsed.length - 1].trim() === '';
    if (isEmpty && prevEmpty) continue;
    collapsed.push(cleaned[i]);
  }

  // Agregar header si se proporcionó
  if (headerComment) {
    return headerComment + '\n' + collapsed.join('\n');
  }
  return collapsed.join('\n');
}

// ────────────────────────────────────────────────────────────
// Main
// ────────────────────────────────────────────────────────────
const raw = fs.readFileSync(WORKFLOW_PATH, 'utf8');
const workflow = JSON.parse(raw);

// ── Validación previa ──────────────────────────────────────
const existingNames = new Set(workflow.nodes.map(n => n.name));
const connKeys = new Set(Object.keys(workflow.connections));
const allKnown = new Set([...existingNames, ...connKeys]);

let hasError = false;
for (const oldName of Object.keys(RENAMES)) {
  if (!allKnown.has(oldName)) {
    console.warn(`⚠  '${oldName}' no existe en el workflow`);
    hasError = true;
  }
}
for (const newName of Object.values(RENAMES)) {
  if (existingNames.has(newName) && !RENAMES[newName]) {
    console.error(`✖  Conflicto: nuevo nombre '${newName}' ya existe`);
    hasError = true;
  }
}
if (hasError) {
  console.error('\nAbortando por errores de validación.');
  process.exit(1);
}

// ── 1. Renombrar nodos ────────────────────────────────────
let renamedCount = 0;
for (const node of workflow.nodes) {
  if (RENAMES[node.name]) {
    console.log(`  ✔ ${node.name}  →  ${RENAMES[node.name]}`);
    node.name = RENAMES[node.name];
    renamedCount++;
  }
  // Reemplazar $() refs en parámetros
  if (node.parameters) {
    node.parameters = replaceRefs(node.parameters, RENAMES);
  }
}

// ── 2. Renombrar conexiones ────────────────────────────────
const newConns = {};
for (const [src, data] of Object.entries(workflow.connections)) {
  const newSrc = RENAMES[src] || src;
  const cloned = JSON.parse(JSON.stringify(data));
  renameTargets(cloned, RENAMES);
  newConns[newSrc] = cloned;
}
workflow.connections = newConns;

// ── 3. Fix chatId hardcodeado ──────────────────────────────
const confirmNode = workflow.nodes.find(
  n => n.name === 'confirmacion_carga_usuario'
);
if (confirmNode && confirmNode.parameters) {
  const old = confirmNode.parameters.chatId;
  confirmNode.parameters.chatId =
    "={{ $('Telegram Trigger').item.json.message.chat.id }}";
  console.log(`\n  ✔ chatId fix: '${old}' → dinámico`);
}

// ── 4. Limpiar código muerto: Validador de datos pdf/fotos ─
const validadorNode = workflow.nodes.find(
  n => n.name === 'Validador de datos pdf/fotos'
);
if (validadorNode?.parameters?.jsCode) {
  const before = validadorNode.parameters.jsCode.split('\n').length;
  const header =
`// NOTA: Validaciones deshabilitadas intencionalmente:
// - tipo_comprobante, tipo_factura, numero_factura, fecha
// - proveedor (nombre, cuit, direccion)
// - cliente (nombre, cuit_dni, direccion)
// - moneda, subtotal, iva, otros_impuestos, cae, vto_cae
// - Cruce de totales (subtotal + iva + otros vs total)
// - Cruce de items (suma items vs subtotal)
// - Validacion individual de cada item (descripcion, cantidad, precio)`;

  validadorNode.parameters.jsCode = cleanDeadCode(
    validadorNode.parameters.jsCode, header
  );
  const after = validadorNode.parameters.jsCode.split('\n').length;
  console.log(`\n  ✔ Validador limpiado: ${before} → ${after} líneas`);
}

// ── 5. Limpiar código muerto: idempotencia img code ────────
const idempImgNode = workflow.nodes.find(
  n => n.name === 'idempotencia img code'
);
if (idempImgNode?.parameters?.jsCode) {
  const before = idempImgNode.parameters.jsCode.split('\n').length;
  idempImgNode.parameters.jsCode = cleanDeadCode(
    idempImgNode.parameters.jsCode, null
  );
  const after = idempImgNode.parameters.jsCode.split('\n').length;
  console.log(`  ✔ idempotencia img code limpiado: ${before} → ${after} líneas`);
}

// ── 6. Escribir resultado ──────────────────────────────────
fs.writeFileSync(WORKFLOW_PATH, JSON.stringify(workflow, null, 2) + '\n', 'utf8');

console.log(`\n✔ Refactorización completada: ${renamedCount} nodos renombrados.`);
console.log(`  Archivo: ${WORKFLOW_PATH}`);
