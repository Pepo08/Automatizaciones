/* ========================================
   Fontana - Clientes & Pedidos
   App logic
   ======================================== */

/*
 * Estructura de datos — Cliente (hoja "Clientes"):
 * {
 *   cliente_id: string,    // ID unico generado por n8n (ej: "CLI-001")
 *   nombre: string,        // Nombre completo
 *   telefono: string,      // Telefono de contacto
 *   email: string,         // Email (opcional)
 *   direccion: string,     // Direccion (opcional)
 *   localidad: string,     // Localidad (opcional)
 *   notas: string          // Notas (opcional)
 * }
 *
 * Estructura de datos — Pedido (hoja "Pedidos_Proceso", cabecera):
 * {
 *   pedido_id: string,       // ID unico generado por n8n (ej: "PED-001")
 *   cliente_id: string,      // FK -> Clientes
 *   cliente_nombre: string,  // Denormalizado para display
 *   fecha_entrega: string,   // YYYY-MM-DD
 *   sena: number,            // $ sena
 *   total: number,           // $ total
 *   estado: string,          // Pendiente | En producción | Listo para entregar | Entregado
 *   notas: string,
 *   items: [Item]            // Array de items (viene del join con Pedido_Items)
 * }
 *
 * Estructura de datos — Item (hoja "Pedido_Items", detalle):
 * {
 *   item_id: string,         // ID unico (ej: "ITEM-001")
 *   pedido_id: string,       // FK -> Pedidos_Proceso
 *   tipo_mueble: string,     // Bajo mesada | Alacena | Vanitory | Placard | Otro
 *   alto: number,            // cm
 *   ancho: number,           // cm
 *   profundidad: number,     // cm
 *   color: string,
 *   nivel: number,            // 2 | 3 | 4 | 5
 *   completado: boolean,     // true/false
 *   notas_item: string       // (opcional)
 * }
 */

const WEBHOOK_URL = 'https://joaquingonzalezmenza.app.n8n.cloud/webhook/fontana-stock-form';

// ---- DOM helpers ----
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

// ---- Constants ----
const VALID_COLORES = [
  'Blanco', 'Gris Arcilla', 'Gris Macadan', 'Gris Perla', 'Gris Cubanita',
  'Gris Sombra', 'Negro', 'Cerezo Locarno', 'Roble Kendal Conac',
  'Pino Aland Polar', 'Roble Termo Negro', 'Hormigon Chicago Gris Oscuro',
  'Roble Whiteriver Gris Marron', 'Castano Kentucky Arena', 'Lino Antracita',
  'Fineline Metallic Antracita', 'Roble Kendal Natural', 'Amarillo Girasol',
  'Rosa Antiguo', 'Rojo Cereza', 'Naranja de Siena', 'Azul Cosmico',
  'Verde Kiwi', 'Roble Denver Marron Trufa', 'Coco Bolo',
  'Roble de Nebraska Natural', 'Roble de Nebraska Gris', 'Nogal Warmia Marron',
  'Roble Kendal Encerado', 'Textil Beige', 'Blanco Alpino', 'Chromix Blanco',
  'Textil Gris', 'Pino Cascina', 'Roble Davos Natural',
  'Roble Davos Marron Trufa', 'Hickory Natural', 'Lino Blanco', 'Lino Topo',
  'Roble Norwich', 'Roble Lorenzo Arena', 'Roble Bardolino Natural',
  'Chromix Plata', 'Roble Whiteriver Beige Arena', 'Pino Aland Blanco',
  'Pietra Grigia Negro', 'Nogal del Pacifico Natural', 'Nogal Lincoln',
  'Roble Vicenza Gris', 'Roble Kaiserberg', 'Metal Cepillado Oro',
  'Metal Cepillado Bronce', 'Metallic Inox', 'Caoba Floreada', 'Caoba Rayada',
  'Cedrillo / Curupixa', 'Cedro Jeketiba', 'Cerejeira', 'Fresno', 'Guatambu',
  'Guayubira', 'Guindo / Lenga AMH', 'Haya', 'Incienso', 'Kiri', 'Laurel',
  'Nogal', 'Paraiso', 'Peteriby', 'Peteriby Brasilero', 'Pino',
  'Roble Americano', 'Roble 250 Reconstituido', 'Roble Rojo',
  'Peteriby Ray Reconstituido', 'Incienso Reconstituido'
];

// Canonical: usamos ortografía correcta (tilde + infinitivo).
// normalizeEstado() mapea los valores viejos de la sheet a estos.
const ESTADOS_PEDIDO = ['Pendiente', 'En producción', 'Listo para entregar', 'Entregado'];
const ESTADOS_ITEM = ['Pendiente', 'En producción', 'Listo para entregar', 'Entregado'];

function normalizeEstado(s) {
  if (!s) return '';
  const n = String(s).trim().toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (n === 'pendiente') return 'Pendiente';
  if (n === 'en produccion') return 'En producción';
  if (n === 'listo para entregar' || n === 'listo para entrega') return 'Listo para entregar';
  if (n === 'entregado') return 'Entregado';
  return s; // valor desconocido, se deja como está
}

// ---- State ----
let currentPin = '';
let clientesData = [];
let pedidosData = [];
let editingClienteId = null;
let pedidosFetched = false;
let currentEstadoFilter = '';

// ========================================
// INIT
// ========================================

// ---- PIN check (hash-based, sin PIN literal en el source) ----
const _PH = ['b56e59e3e3ea6171', '1b844fd3410e00ee', '164ed39b78807a2e', 'c6fc6ac136240940'].join('');
async function _sha256Hex(s) {
  const b = new TextEncoder().encode(String(s || ''));
  const d = await crypto.subtle.digest('SHA-256', b);
  return Array.from(new Uint8Array(d))
    .map(x => x.toString(16).padStart(2, '0'))
    .join('');
}
async function isValidPin(p) {
  if (!p) return false;
  return (await _sha256Hex(p)) === _PH;
}

document.addEventListener('DOMContentLoaded', async () => {
  createColoresDatalist();
  bindEvents();

  const storedPin = sessionStorage.getItem('fontana_pin');
  if (await isValidPin(storedPin)) {
    currentPin = storedPin;
    showApp();
  } else {
    $('#pin-input').focus();
  }
});

function createColoresDatalist() {
  const dl = document.createElement('datalist');
  dl.id = 'colores-list';
  VALID_COLORES.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c;
    dl.appendChild(opt);
  });
  document.body.appendChild(dl);
}

// ========================================
// PIN HANDLING
// ========================================

function bindEvents() {
  // PIN
  $('#pin-submit').addEventListener('click', handlePinSubmit);
  $('#pin-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handlePinSubmit();
  });

  // Tabs
  $$('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  // Clientes
  $('#cli-nuevo-btn').addEventListener('click', () => openClienteEdit(null));
  $('#cli-back-lista').addEventListener('click', closeClienteEdit);
  $('#cli-buscar').addEventListener('input', renderClientesFiltered);
  $('#form-cliente').addEventListener('submit', handleClienteSubmit);

  // Pedidos
  $('#ped-nuevo-btn').addEventListener('click', openPedidoEdit);
  $('#ped-back-lista').addEventListener('click', closePedidoEdit);
  $('#ped-refresh-btn').addEventListener('click', fetchPedidos);
  $('#ped-add-item').addEventListener('click', () => addPedidoItemRow({}));
  $('#form-pedido').addEventListener('submit', handlePedidoSubmit);

  // Status filter buttons
  $$('.status-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      $$('.status-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentEstadoFilter = btn.dataset.estado;
      renderPedidosFiltered();
    });
  });

  // Argentine number restrictions on money inputs
  applyArgentineNumberRestriction($('#ped-sena'));
  applyArgentineNumberRestriction($('#ped-total'));
}

async function handlePinSubmit() {
  const pin = $('#pin-input').value.trim();
  if (!pin) {
    $('#pin-input').classList.add('input-error');
    toast('Ingrese un PIN valido', 'error');
    return;
  }
  if (!(await isValidPin(pin))) {
    $('#pin-input').classList.add('input-error');
    toast('PIN incorrecto', 'error');
    return;
  }
  $('#pin-input').classList.remove('input-error');
  currentPin = pin;
  sessionStorage.setItem('fontana_pin', pin);
  showApp();
}

function showApp() {
  $('#pin-overlay').classList.add('hidden');
  $('#app').classList.remove('hidden');
  fetchClientes();
}

// ========================================
// TAB NAVIGATION
// ========================================

function switchTab(tab) {
  $$('.tab-btn').forEach(b => b.classList.remove('active'));
  $(`.tab-btn[data-tab="${tab}"]`).classList.add('active');

  $$('.tab-content').forEach(c => c.classList.add('hidden'));
  $(`#tab-${tab}`).classList.remove('hidden');

  if (tab === 'pedidos' && !pedidosFetched) {
    fetchPedidos();
  }
}

// ========================================
// TOAST
// ========================================

function toast(message, type = 'info') {
  const container = $('#toast-container');
  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  el.textContent = message;
  container.appendChild(el);

  // Warning toasts llevan más info → dejarlos más tiempo visibles.
  const duracion = type === 'warning' ? 8000 : 3500;
  setTimeout(() => {
    el.classList.add('toast-out');
    el.addEventListener('animationend', () => el.remove());
  }, duracion);
}

// ========================================
// HELPERS
// ========================================

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function parseArgentineNumber(str) {
  if (!str) return null;
  const cleaned = str.replace(/\./g, '').replace(',', '.');
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

function formatArgentineNumber(num) {
  const parts = num.toFixed(2).split('.');
  const intPart = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return intPart + ',' + parts[1];
}

function clearErrors(form) {
  form.querySelectorAll('.input-error').forEach((el) => el.classList.remove('input-error'));
  form.querySelectorAll('.field-error').forEach((el) => (el.textContent = ''));
}

function showFieldError(input, message) {
  input.classList.add('input-error');
  const errorEl = input.closest('.form-group')
    ? input.closest('.form-group').querySelector('.field-error')
    : null;
  if (errorEl) errorEl.textContent = message;
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function formatFecha(fecha) {
  if (!fecha) return '-';
  try {
    const parts = fecha.match(/(\d{4})-(\d{2})-(\d{2})/);
    if (parts) return `${parts[3]}/${parts[2]}/${parts[1]}`;
    return fecha;
  } catch (_) { return fecha; }
}

// ---- Input restriction helpers ----

function applyArgentineNumberRestriction(input) {
  input.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (['Backspace','Delete','Tab','Escape','Enter','ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End'].includes(e.key)) return;
    if (e.key >= '0' && e.key <= '9') return;
    const val = input.value;
    if (e.key === '.') {
      if (val.length === 0 || val.includes('.') || val.includes(',')) { e.preventDefault(); return; }
      return;
    }
    if (e.key === ',') {
      if (val.length === 0 || val.includes(',')) { e.preventDefault(); return; }
      return;
    }
    e.preventDefault();
  });
  input.addEventListener('paste', (e) => {
    e.preventDefault();
    const text = (e.clipboardData || window.clipboardData).getData('text');
    const current = input.value;
    let cleaned = text.replace(/[^0-9.,]/g, '');
    let hasDot = current.includes('.');
    let hasComma = current.includes(',');
    let result = '';
    for (const ch of cleaned) {
      if (ch === '.') { if (hasDot || hasComma) continue; hasDot = true; }
      if (ch === ',') { if (hasComma) continue; hasComma = true; }
      result += ch;
    }
    if (current.length === 0) result = result.replace(/^[.,]+/, '');
    document.execCommand('insertText', false, result);
  });
}

function applyIntegerRestriction(input) {
  input.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (['Backspace','Delete','Tab','Escape','Enter','ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End'].includes(e.key)) return;
    if (e.key >= '0' && e.key <= '9') return;
    e.preventDefault();
  });
  input.addEventListener('paste', (e) => {
    e.preventDefault();
    const text = (e.clipboardData || window.clipboardData).getData('text');
    const cleaned = text.replace(/[^0-9]/g, '');
    document.execCommand('insertText', false, cleaned);
  });
}

// ========================================
// WEBHOOK SENDER
// ========================================

async function sendToWebhook(action, data) {
  const payload = {
    action,
    data,
    pin: currentPin,
  };

  let response;
  try {
    response = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': 'true'
      },
      body: JSON.stringify(payload),
    });
  } catch (networkError) {
    throw new Error('Error de red. Verifique su conexion e intente nuevamente.');
  }

  let body;
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    try {
      body = await response.json();
    } catch (_) {
      body = null;
    }
  } else {
    const text = await response.text();
    try {
      body = JSON.parse(text);
    } catch (_) {
      body = text;
    }
  }

  if (!response.ok) {
    const msg =
      (body && typeof body === 'object' && (body.message || body.error)) ||
      (typeof body === 'string' && body) ||
      `Error del servidor (${response.status})`;
    throw new Error(msg);
  }

  return body;
}

// ========================================
// CLIENTES — CRUD
// ========================================

async function fetchClientes() {
  const loading = $('#cli-loading');
  const lista = $('#cli-lista');
  loading.classList.remove('hidden');
  lista.innerHTML = '';

  try {
    const data = await sendToWebhook('listar_clientes', {});
    clientesData = Array.isArray(data) ? data : (data.clientes || data.items || data.data || []);
    renderClientesFiltered();
  } catch (err) {
    toast('Error al cargar clientes: ' + err.message, 'error');
    lista.innerHTML = '<div class="empty-state"><div class="empty-state-icon">&#10060;</div><p>Error al cargar clientes</p></div>';
  } finally {
    loading.classList.add('hidden');
  }
}

function renderClientesFiltered() {
  const buscar = ($('#cli-buscar').value || '').toLowerCase().trim();
  const filtered = buscar
    ? clientesData.filter(c =>
        (c.nombre || '').toLowerCase().includes(buscar) ||
        (c.telefono || '').toLowerCase().includes(buscar))
    : clientesData;

  renderClientesList(filtered);
}

function renderClientesList(items) {
  const lista = $('#cli-lista');

  if (!items || items.length === 0) {
    lista.innerHTML = '<div class="empty-state"><div class="empty-state-icon">&#128100;</div><p>No hay clientes registrados</p></div>';
    return;
  }

  let html = '';
  items.forEach(c => {
    const detailParts = [];
    if (c.telefono) detailParts.push('&#128222; ' + escapeHtml(c.telefono));
    if (c.email) detailParts.push('&#9993; ' + escapeHtml(c.email));
    if (c.localidad) detailParts.push('&#128205; ' + escapeHtml(c.localidad));

    html += `<div class="cli-card">
      <div class="cli-card-info">
        <div class="cli-card-name">${escapeHtml(c.nombre || '-')}</div>
        <div class="cli-card-detail">${detailParts.join(' &middot; ')}</div>
        ${c.notas ? `<div class="cli-card-notas">${escapeHtml(c.notas)}</div>` : ''}
      </div>
      <div class="cli-card-actions">
        <button class="btn-icon" onclick="openClienteEdit('${escapeHtml(c.cliente_id)}')" title="Editar">&#9998;</button>
      </div>
    </div>`;
  });

  lista.innerHTML = html;
}

function openClienteEdit(clienteId) {
  editingClienteId = clienteId;
  $('#cli-list-view').classList.add('hidden');
  $('#cli-edit-view').classList.remove('hidden');

  const form = $('#form-cliente');
  clearErrors(form);

  if (clienteId) {
    const c = clientesData.find(c => c.cliente_id === clienteId);
    if (!c) { toast('Cliente no encontrado', 'error'); return; }
    $('#cli-edit-title').textContent = 'Editar Cliente';
    $('#cli-id').value = c.cliente_id;
    $('#cli-nombre').value = c.nombre || '';
    $('#cli-telefono').value = c.telefono || '';
    $('#cli-email').value = c.email || '';
    $('#cli-direccion').value = c.direccion || '';
    $('#cli-localidad').value = c.localidad || '';
    $('#cli-notas').value = c.notas || '';
    $('#cli-submit-btn').textContent = 'Guardar Cambios';
  } else {
    $('#cli-edit-title').textContent = 'Nuevo Cliente';
    $('#cli-id').value = '';
    form.reset();
    $('#cli-submit-btn').textContent = 'Guardar Cliente';
  }
}

function closeClienteEdit() {
  $('#cli-edit-view').classList.add('hidden');
  $('#cli-list-view').classList.remove('hidden');
  editingClienteId = null;
}

async function handleClienteSubmit(e) {
  e.preventDefault();
  const form = $('#form-cliente');
  clearErrors(form);

  const nombre = $('#cli-nombre').value.trim();
  const telefono = $('#cli-telefono').value.trim();
  const email = $('#cli-email').value.trim();
  const direccion = $('#cli-direccion').value.trim();
  const localidad = $('#cli-localidad').value.trim();
  const notas = $('#cli-notas').value.trim();

  let valid = true;

  if (!nombre) {
    showFieldError($('#cli-nombre'), 'El nombre es obligatorio');
    valid = false;
  }

  if (!telefono) {
    showFieldError($('#cli-telefono'), 'El telefono es obligatorio');
    valid = false;
  }

  if (email && !isValidEmail(email)) {
    showFieldError($('#cli-email'), 'Email no valido');
    valid = false;
  }

  if (!valid) return;

  const submitBtn = $('#cli-submit-btn');
  submitBtn.disabled = true;
  submitBtn.textContent = 'Guardando...';

  const payload = { nombre, telefono, email, direccion, localidad, notas };
  const action = editingClienteId ? 'editar_cliente' : 'registrar_cliente';

  if (editingClienteId) {
    payload.cliente_id = editingClienteId;
  }

  try {
    await sendToWebhook(action, payload);
    toast(editingClienteId ? 'Cliente actualizado' : 'Cliente registrado', 'success');
    closeClienteEdit();
    await fetchClientes();
  } catch (err) {
    toast(err.message, 'error');
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = editingClienteId ? 'Guardar Cambios' : 'Guardar Cliente';
  }
}

// ========================================
// PEDIDOS — CRUD (multi-item, Opcion B)
// ========================================

async function fetchPedidos() {
  const loading = $('#ped-loading');
  const lista = $('#ped-lista');
  loading.classList.remove('hidden');
  lista.innerHTML = '';

  try {
    const data = await sendToWebhook('listar_pedidos', {});
    pedidosData = Array.isArray(data) ? data : (data.pedidos || data.items || data.data || []);
    pedidosFetched = true;
    renderPedidosFiltered();
  } catch (err) {
    toast('Error al cargar pedidos: ' + err.message, 'error');
    lista.innerHTML = '<div class="empty-state"><div class="empty-state-icon">&#10060;</div><p>Error al cargar pedidos</p></div>';
  } finally {
    loading.classList.add('hidden');
  }
}

function renderPedidosFiltered() {
  const filtered = currentEstadoFilter
    ? pedidosData.filter(p => getPedidoEstado(p) === currentEstadoFilter)
    : pedidosData;

  renderPedidosList(filtered);
}

// ---- Estado derivado del pedido cabecera desde los items ----
function getPedidoEstado(p) {
  const items = (p && p.items) || [];
  if (items.length === 0) return p && p.estado ? normalizeEstado(p.estado) : 'Pendiente';
  const statuses = items.map(i => normalizeEstado(i.estado_item) || 'Pendiente');
  if (statuses.every(s => s === 'Entregado')) return 'Entregado';
  if (statuses.every(s => s === 'Listo para entregar' || s === 'Entregado')) return 'Listo para entregar';
  if (statuses.some(s => s === 'En producción')) return 'En producción';
  return 'Pendiente';
}

// ---- Agrupar items idénticos para display, conservando cada item_id ----
function groupItemsForDisplay(items) {
  const groups = new Map();
  items.forEach(item => {
    const alto = item.alto != null ? item.alto : item.alto_cm;
    const ancho = item.ancho != null ? item.ancho : item.ancho_cm;
    const prof = item.profundidad != null ? item.profundidad : item.profundidad_cm;
    const nivel = item.nivel != null ? item.nivel : item.categoria;
    const sig = [
      (item.tipo_mueble || '').trim().toLowerCase(),
      alto || '', ancho || '', prof || '',
      (item.color || '').trim().toLowerCase(),
      nivel || ''
    ].join('|');
    if (!groups.has(sig)) groups.set(sig, []);
    groups.get(sig).push(item);
  });
  const flat = [];
  groups.forEach(groupItems => {
    const size = groupItems.length;
    groupItems.forEach((it, idx) => {
      flat.push({ item: it, idxInGroup: idx + 1, groupSize: size });
    });
  });
  return flat;
}

// ---- CSS class por estado de item (para colorear el select) ----
function estadoItemClass(estado) {
  switch (normalizeEstado(estado)) {
    case 'Pendiente': return 'estado-pendiente';
    case 'En producción': return 'estado-en-produccion';
    case 'Listo para entregar': return 'estado-listo';
    case 'Entregado': return 'estado-entregado';
    default: return 'estado-pendiente';
  }
}

// ---- Texto compacto de progreso para el header de la card ----
function estadoPedidoCounter(items) {
  const total = items.length;
  if (total === 0) return '';
  const entregados = items.filter(i => normalizeEstado(i.estado_item) === 'Entregado').length;
  const listosOMas = items.filter(i => {
    const e = normalizeEstado(i.estado_item);
    return e === 'Listo para entregar' || e === 'Entregado';
  }).length;
  const enProd = items.filter(i => normalizeEstado(i.estado_item) === 'En producción').length;
  if (entregados === total) return total + ' entregado' + (total > 1 ? 's' : '');
  if (listosOMas === total) return total + ' listo' + (total > 1 ? 's' : '');
  if (entregados > 0) return entregados + '/' + total + ' entregados';
  if (listosOMas > 0) return listosOMas + '/' + total + ' listos';
  if (enProd > 0) return enProd + '/' + total + ' en prod.';
  return total + ' mueble' + (total > 1 ? 's' : '');
}

function renderPedidosList(pedidos) {
  const lista = $('#ped-lista');

  if (!pedidos || pedidos.length === 0) {
    const msg = currentEstadoFilter
      ? 'No hay pedidos con estado "' + escapeHtml(currentEstadoFilter) + '"'
      : 'No hay pedidos registrados';
    lista.innerHTML = `<div class="empty-state"><div class="empty-state-icon">&#128203;</div><p>${msg}</p></div>`;
    return;
  }

  let html = '';
  pedidos.forEach(p => {
    const sena = parseFloat(p.sena) || 0;
    const total = parseFloat(p.total) || 0;
    const saldo = total - sena;
    const items = p.items || [];
    const totalCount = items.length;

    const estadoDerivado = getPedidoEstado(p);
    const allEntregado = totalCount > 0 && items.every(i => i.estado_item === 'Entregado');
    const estadoClass = getEstadoClass(estadoDerivado);
    const allDoneClass = allEntregado ? ' ped-card-all-done' : '';
    const counter = estadoPedidoCounter(items);

    // Items HTML — agrupados visualmente (N de M) pero con estado individual
    let itemsHtml = '';
    const grouped = groupItemsForDisplay(items);
    grouped.forEach(({ item, idxInGroup, groupSize }) => {
      const alto = item.alto != null ? item.alto : item.alto_cm;
      const ancho = item.ancho != null ? item.ancho : item.ancho_cm;
      const prof = item.profundidad != null ? item.profundidad : item.profundidad_cm;
      const nivel = item.nivel != null ? item.nivel : item.categoria;

      const medidas = [alto, ancho, prof].filter(v => v != null && v !== '').join(' \u00D7 ');
      const detailParts = [];
      if (item.color) detailParts.push(item.color);
      if (medidas) detailParts.push(medidas + ' cm');
      if (nivel) detailParts.push('Nivel ' + nivel);

      const estadoItem = normalizeEstado(item.estado_item) || 'Pendiente';
      const itemClass = estadoItemClass(estadoItem);
      const groupLabel = groupSize > 1
        ? `<span class="ped-item-group-count">${idxInGroup} de ${groupSize}</span>`
        : '';

      const optionsHtml = ESTADOS_ITEM.map(e =>
        `<option value="${escapeHtml(e)}" ${e === estadoItem ? 'selected' : ''}>${escapeHtml(e)}</option>`
      ).join('');

      itemsHtml += `<div class="ped-item-row" data-item-id="${escapeHtml(item.item_id || '')}">
        <div class="ped-item-info">
          <div class="ped-item-tipo"><span class="ped-item-tipo-name">${escapeHtml(item.tipo_mueble || '-')}</span>${groupLabel}</div>
          ${detailParts.length ? `<div class="ped-item-detail">${escapeHtml(detailParts.join(' \u00b7 '))}</div>` : ''}
        </div>
        <select class="input input-sm ped-item-estado-select ${itemClass}"
                data-pedido-id="${escapeHtml(p.pedido_id)}"
                data-item-id="${escapeHtml(item.item_id || '')}"
                onchange="handleItemEstadoChange(this)">
          ${optionsHtml}
        </select>
      </div>`;
    });

    html += `<div class="ped-card${allDoneClass}" data-pedido-id="${escapeHtml(p.pedido_id)}">
      <div class="ped-card-header" onclick="togglePedidoExpand(this)">
        <span class="badge ${estadoClass}">${escapeHtml(estadoDerivado)}</span>
        <span class="ped-card-cliente">&#128100; ${escapeHtml(p.cliente_nombre || '-')}</span>
        ${counter ? `<span class="ped-card-progress">${escapeHtml(counter)}</span>` : ''}
        <span class="ped-card-expand-hint">&#9660;</span>
      </div>
      ${allEntregado ? '<div class="ped-card-all-badge">Pedido entregado</div>' : ''}
      <div class="ped-card-body">
        ${p.fecha_entrega ? `<div class="ped-card-fecha">&#128197; Entrega: ${escapeHtml(formatFecha(p.fecha_entrega))}</div>` : ''}
        ${p.notas ? `<div class="ped-card-notas-preview">${escapeHtml(p.notas)}</div>` : ''}
      </div>
      ${totalCount > 0
        ? `<div class="ped-card-items">${itemsHtml}</div>`
        : `<div class="ped-card-items-empty">Sin detalle de muebles</div>`}
      <div class="ped-card-footer">
        <div class="ped-card-importes">
          ${total > 0 ? `<span class="ped-card-total">Total: $${formatArgentineNumber(total)}</span>` : ''}
          ${saldo > 0 ? `<span class="ped-card-saldo">Saldo: $${formatArgentineNumber(saldo)}</span>` : ''}
          ${saldo === 0 && total > 0 ? '<span class="ped-card-pagado">Pagado</span>' : ''}
        </div>
      </div>
    </div>`;
  });

  lista.innerHTML = html;
}

function getEstadoClass(estado) {
  switch (normalizeEstado(estado)) {
    case 'Pendiente': return 'badge-yellow';
    case 'En producción': return 'badge-blue';
    case 'Listo para entregar': return 'badge-green';
    case 'Entregado': return 'badge-muted';
    default: return 'badge-yellow';
  }
}

// ---- Expand / Collapse ----

function togglePedidoExpand(headerEl) {
  headerEl.closest('.ped-card').classList.toggle('expanded');
}

// ---- Cambiar estado de un item individual (optimista + revert on error) ----

async function handleItemEstadoChange(select) {
  const pedidoId = select.dataset.pedidoId;
  const itemId = select.dataset.itemId;
  const nuevoEstado = select.value;

  const pedido = pedidosData.find(p => p.pedido_id === pedidoId);
  const item = pedido && pedido.items ? pedido.items.find(i => i.item_id === itemId) : null;
  if (!item) { toast('Item no encontrado', 'error'); return; }

  const estadoAnterior = normalizeEstado(item.estado_item) || 'Pendiente';
  const estadoPedidoAnterior = getPedidoEstado(pedido);

  // Optimistic update
  item.estado_item = nuevoEstado;
  applyItemSelectColor(select, nuevoEstado);
  updatePedidoDerivedUI(pedidoId);

  select.disabled = true;

  try {
    await sendToWebhook('cambiar_estado_item', {
      pedido_id: pedidoId,
      item_id: itemId,
      estado_item: nuevoEstado,
    });

    // Si el estado derivado del pedido cambió, lo reflejamos también en la cabecera
    const estadoPedidoNuevo = getPedidoEstado(pedido);
    if (estadoPedidoNuevo !== estadoPedidoAnterior) {
      pedido.estado = estadoPedidoNuevo;
      // Sincronizamos la cabecera en background. Si falla, igual la UI ya quedó consistente
      sendToWebhook('cambiar_estado_pedido', {
        pedido_id: pedidoId,
        estado: estadoPedidoNuevo,
      }).catch(() => { /* silent */ });
    }
  } catch (err) {
    // Revert
    item.estado_item = estadoAnterior;
    applyItemSelectColor(select, estadoAnterior);
    select.value = estadoAnterior;
    updatePedidoDerivedUI(pedidoId);
    toast(err.message, 'error');
  } finally {
    select.disabled = false;
  }
}

function applyItemSelectColor(select, estado) {
  select.classList.remove('estado-pendiente', 'estado-en-produccion', 'estado-listo', 'estado-entregado');
  select.classList.add(estadoItemClass(estado));
}

function updatePedidoDerivedUI(pedidoId) {
  const pedido = pedidosData.find(p => p.pedido_id === pedidoId);
  if (!pedido) return;
  const card = document.querySelector(`.ped-card[data-pedido-id="${pedidoId}"]`);
  if (!card) return;

  const items = pedido.items || [];
  const estadoDerivado = getPedidoEstado(pedido);
  const allEntregado = items.length > 0 && items.every(i => i.estado_item === 'Entregado');

  // Badge
  const badge = card.querySelector('.ped-card-header .badge');
  if (badge) {
    badge.className = 'badge ' + getEstadoClass(estadoDerivado);
    badge.textContent = estadoDerivado;
  }

  // Progress counter
  const counter = card.querySelector('.ped-card-progress');
  if (counter) counter.textContent = estadoPedidoCounter(items);

  // Clase all-done y badge "Pedido entregado"
  card.classList.toggle('ped-card-all-done', allEntregado);
  let allDoneBadge = card.querySelector('.ped-card-all-badge');
  if (allEntregado && !allDoneBadge) {
    allDoneBadge = document.createElement('div');
    allDoneBadge.className = 'ped-card-all-badge';
    allDoneBadge.textContent = 'Pedido entregado';
    card.querySelector('.ped-card-header').insertAdjacentElement('afterend', allDoneBadge);
  } else if (!allEntregado && allDoneBadge) {
    allDoneBadge.remove();
  }
}

// ---- Pedido form: multi-item ----

function openPedidoEdit() {
  // Populate client dropdown (muestra ID + nombre)
  const select = $('#ped-cliente');
  select.innerHTML = '<option value="">Seleccionar cliente...</option>';
  clientesData.forEach(c => {
    const id = c.cliente_id || '';
    const nombre = c.nombre || '';
    const label = nombre ? `${id} - ${nombre}` : id;
    select.innerHTML += `<option value="${escapeHtml(id)}" data-nombre="${escapeHtml(nombre)}">${escapeHtml(label)}</option>`;
  });

  if (clientesData.length === 0) {
    toast('Registra al menos un cliente primero', 'info');
    return;
  }

  $('#ped-list-view').classList.add('hidden');
  $('#ped-edit-view').classList.remove('hidden');

  const form = $('#form-pedido');
  clearErrors(form);
  form.reset();

  // No permitir fechas pasadas en fecha de entrega
  const fechaInput = $('#ped-fecha-entrega');
  const today = new Date();
  const todayStr = today.getFullYear() + '-' +
    String(today.getMonth() + 1).padStart(2, '0') + '-' +
    String(today.getDate()).padStart(2, '0');
  fechaInput.min = todayStr;
  fechaInput.value = '';

  $('#ped-items-list').innerHTML = '';
  addPedidoItemRow({});
  $('#ped-submit-btn').textContent = 'Registrar Pedido';
}

function closePedidoEdit() {
  $('#ped-edit-view').classList.add('hidden');
  $('#ped-list-view').classList.remove('hidden');
}

function addPedidoItemRow(item) {
  const container = $('#ped-items-list');
  const row = document.createElement('div');
  row.className = 'ped-item-row';

  row.innerHTML = `
    <div class="ped-item-row-header">
      <span class="ped-item-row-num">Mueble</span>
      <button type="button" class="est-mat-remove" title="Quitar">&times;</button>
    </div>
    <div class="ped-item-field">
      <label class="ped-item-label">Tipo de mueble *</label>
      <select class="input item-tipo">
        <option value="">Seleccionar tipo...</option>
        <option value="Bajo Mesada 2 Puertas" ${item.tipo_mueble === 'Bajo Mesada 2 Puertas' ? 'selected' : ''}>Bajo Mesada 2 Puertas</option>
        <option value="Bajo Mesada Cajonera" ${item.tipo_mueble === 'Bajo Mesada Cajonera' ? 'selected' : ''}>Bajo Mesada Cajonera</option>
        <option value="Alacena 2 Puertas" ${item.tipo_mueble === 'Alacena 2 Puertas' ? 'selected' : ''}>Alacena 2 Puertas</option>
        <option value="Placard Estándar" ${item.tipo_mueble === 'Placard Estándar' ? 'selected' : ''}>Placard Estándar</option>
        <option value="Rack de TV" ${item.tipo_mueble === 'Rack de TV' ? 'selected' : ''}>Rack de TV</option>
      </select>
    </div>
    <div class="ped-item-field">
      <label class="ped-item-label">Medidas (cm) *</label>
      <div class="ped-item-field-row">
        <div class="ped-item-col">
          <input type="text" class="input item-alto" placeholder="Alto" inputmode="numeric" value="${item.alto || ''}" />
          <span class="input-hint">Alto</span>
        </div>
        <div class="ped-item-col">
          <input type="text" class="input item-ancho" placeholder="Ancho" inputmode="numeric" value="${item.ancho || ''}" />
          <span class="input-hint">Ancho</span>
        </div>
        <div class="ped-item-col">
          <input type="text" class="input item-prof" placeholder="Profundidad" inputmode="numeric" value="${item.profundidad || ''}" />
          <span class="input-hint">Profundidad</span>
        </div>
      </div>
    </div>
    <div class="ped-item-field">
      <label class="ped-item-label">Color *</label>
      <input type="text" class="input item-color" placeholder="Buscar color..." list="colores-list" value="${escapeHtml(item.color || '')}" />
    </div>
    <div class="ped-item-field">
      <label class="ped-item-label">Nivel de terminación *</label>
      <select class="input item-nivel">
        <option value="" ${!item.nivel ? 'selected' : ''}>Seleccionar nivel...</option>
        <option value="2" ${item.nivel == 2 ? 'selected' : ''}>2 - Intermedio (Melamina blanca)</option>
        <option value="3" ${item.nivel == 3 ? 'selected' : ''}>3 - Premium (Melamina color + ABS)</option>
        <option value="4" ${item.nivel == 4 ? 'selected' : ''}>4 - Lujo Laqueado (MDF crudo laqueado)</option>
        <option value="5" ${item.nivel == 5 ? 'selected' : ''}>5 - Ultra Premium (Rauvisio Brillante)</option>
      </select>
    </div>`;

  // Apply integer restriction to medida inputs
  row.querySelectorAll('.item-alto, .item-ancho, .item-prof').forEach(input => {
    applyIntegerRestriction(input);
  });

  // Remove button
  row.querySelector('.est-mat-remove').addEventListener('click', () => {
    row.remove();
    renumberPedidoItems();
  });

  container.appendChild(row);
  renumberPedidoItems();
}

function renumberPedidoItems() {
  $$('#ped-items-list .ped-item-row').forEach((row, i) => {
    row.querySelector('.ped-item-row-num').textContent = `Mueble ${i + 1}`;
  });
}

function collectPedidoItems() {
  const rows = $$('#ped-items-list .ped-item-row');
  const items = [];
  let allValid = true;

  rows.forEach((row, i) => {
    const tipo = row.querySelector('.item-tipo').value;
    const alto = parseInt(row.querySelector('.item-alto').value, 10);
    const ancho = parseInt(row.querySelector('.item-ancho').value, 10);
    const prof = parseInt(row.querySelector('.item-prof').value, 10);
    const color = row.querySelector('.item-color').value.trim();
    const nivel = row.querySelector('.item-nivel').value ? parseInt(row.querySelector('.item-nivel').value, 10) : null;

    if (!tipo) {
      row.querySelector('.item-tipo').classList.add('input-error');
      allValid = false;
    } else {
      row.querySelector('.item-tipo').classList.remove('input-error');
    }

    if (!alto || alto <= 0 || !ancho || ancho <= 0 || !prof || prof <= 0) {
      ['.item-alto', '.item-ancho', '.item-prof'].forEach(sel => {
        const inp = row.querySelector(sel);
        const v = parseInt(inp.value, 10);
        if (!v || v <= 0) inp.classList.add('input-error');
        else inp.classList.remove('input-error');
      });
      allValid = false;
    } else {
      ['.item-alto', '.item-ancho', '.item-prof'].forEach(sel => {
        row.querySelector(sel).classList.remove('input-error');
      });
    }

    // Color: obligatorio (el flujo BOM lo requiere para matchear material coloreable)
    const colorInput = row.querySelector('.item-color');
    if (!color) {
      colorInput.classList.add('input-error');
      allValid = false;
    } else {
      colorInput.classList.remove('input-error');
    }

    // Nivel: obligatorio (normalizar pedido valida contra 2-5)
    const nivelInput = row.querySelector('.item-nivel');
    if (!nivel || ![2, 3, 4, 5].includes(nivel)) {
      nivelInput.classList.add('input-error');
      allValid = false;
    } else {
      nivelInput.classList.remove('input-error');
    }

    items.push({ tipo_mueble: tipo, alto, ancho, profundidad: prof, color, nivel });
  });

  return { items, valid: allValid };
}

async function handlePedidoSubmit(e) {
  e.preventDefault();
  const form = $('#form-pedido');
  clearErrors(form);

  const clienteId = $('#ped-cliente').value;
  const clienteSeleccionado = clientesData.find(c => c.cliente_id === clienteId);
  const clienteNombre = clienteSeleccionado ? (clienteSeleccionado.nombre || '') : '';
  const fechaEntrega = $('#ped-fecha-entrega').value;
  const senaRaw = $('#ped-sena').value.trim();
  const totalRaw = $('#ped-total').value.trim();
  const notas = $('#ped-notas').value.trim();

  let valid = true;

  if (!clienteId) {
    showFieldError($('#ped-cliente'), 'Seleccione un cliente');
    valid = false;
  }

  // Validar fecha de entrega: no puede ser pasada
  if (fechaEntrega) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const parts = fechaEntrega.split('-');
    const fechaSel = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
    if (fechaSel < today) {
      showFieldError($('#ped-fecha-entrega'), 'La fecha de entrega no puede ser pasada');
      valid = false;
    }
  }

  // Collect & validate items
  const itemRows = $$('#ped-items-list .ped-item-row');
  if (itemRows.length === 0) {
    toast('Agrega al menos un mueble al pedido', 'error');
    valid = false;
  }

  const { items, valid: itemsValid } = collectPedidoItems();
  if (!itemsValid) {
    toast('Complete los campos obligatorios de cada mueble (tipo, medidas, color y nivel)', 'error');
    valid = false;
  }

  // Money validation
  const sena = senaRaw ? parseArgentineNumber(senaRaw) : 0;
  const total = totalRaw ? parseArgentineNumber(totalRaw) : 0;

  if (senaRaw && (sena === null || sena < 0)) {
    const importeGroup = $('#ped-sena').closest('.form-group');
    if (importeGroup) {
      const errEl = importeGroup.querySelector('.field-error');
      if (errEl) errEl.textContent = 'Sena no valida';
    }
    valid = false;
  }

  if (totalRaw && (total === null || total < 0)) {
    const importeGroup = $('#ped-total').closest('.form-group');
    if (importeGroup) {
      const errEl = importeGroup.querySelector('.field-error');
      if (errEl) errEl.textContent = 'Total no valido';
    }
    valid = false;
  }

  if (sena !== null && total !== null && sena > total && total > 0) {
    const importeGroup = $('#ped-sena').closest('.form-group');
    if (importeGroup) {
      const errEl = importeGroup.querySelector('.field-error');
      if (errEl) errEl.textContent = 'La sena no puede superar el total';
    }
    valid = false;
  }

  if (!valid) return;

  const submitBtn = $('#ped-submit-btn');
  submitBtn.disabled = true;
  submitBtn.textContent = 'Registrando...';

  try {
    const resp = await sendToWebhook('registrar_pedido', {
      cliente_id: clienteId,
      cliente_nombre: clienteNombre,
      fecha_entrega: fechaEntrega,
      sena: sena || 0,
      total: total || 0,
      notas,
      items,
    });
    notifyPedidoResult(resp);
    closePedidoEdit();
    await fetchPedidos();
  } catch (err) {
    toast(err.message, 'error');
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Registrar Pedido';
  }
}

// ---- Notificacion post-pedido (stock descontado + faltantes) ----
function notifyPedidoResult(resp) {
  // Respuesta del webhook contiene: { ok, pedido_id, estado, mensaje, descontado[], faltantes[], costo_total_faltantes }
  const r = resp || {};
  const pedidoId = r.pedido_id || '';
  const faltantes = Array.isArray(r.faltantes) ? r.faltantes : [];
  const descontado = Array.isArray(r.descontado) ? r.descontado.filter(d => d.cantidad > 0) : [];
  const erroresItems = Array.isArray(r.errores_items) ? r.errores_items : [];

  if (faltantes.length === 0 && erroresItems.length === 0) {
    const suffix = pedidoId ? ' ' + pedidoId : '';
    toast('Pedido registrado' + suffix + '. Stock descontado completo.', 'success');
    return;
  }

  // Pedido parcial: mostramos una notificacion combinada con todo lo relevante
  const faltantesResumen = faltantes.map(f =>
    `${f.material || f.sku}: faltan ${f.cantidad} ${f.unidad || ''}`.trim()
  ).join(' | ');
  const descontadoResumen = descontado.length > 0
    ? `Se descontaron ${descontado.length} items del stock.`
    : 'No hubo stock disponible para descontar.';

  const costoStr = r.costo_total_faltantes
    ? ' Costo estimado reposicion: $' + formatArgentineNumber(r.costo_total_faltantes) + '.'
    : '';

  toast(
    'Pedido registrado como PENDIENTE_MATERIAL. ' + descontadoResumen +
    ' Faltantes cargados: ' + faltantesResumen + '.' + costoStr,
    'warning'
  );

  if (erroresItems.length > 0) {
    const erroresResumen = erroresItems.slice(0, 3).map(e => e.mensaje).join(' · ');
    toast('Avisos de BOM: ' + erroresResumen, 'error');
  }
}
