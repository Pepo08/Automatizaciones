---
name: n8n-state-machine-sessions
description: >
  Patrones para implementar máquinas de estado y sesiones de conversación en n8n.
  Necesario para bots multi-paso (Telegram, WhatsApp, formularios) donde el
  usuario interactúa en varios mensajes y el bot necesita recordar en qué paso 
  está. Cubre: almacenamiento de sesión en Google Sheets, lógica de transición
  de estados, timeouts de sesión, y patrones de confirmación. Activar cuando
  el usuario mencione: sesión, estado, multi-paso, conversación, "recordar
  en qué paso está", máquina de estados, state machine, flujo conversacional,
  "el bot debe preguntar paso a paso", confirmación, "esperar respuesta del
  usuario", contexto entre mensajes, o cualquier bot que necesite más de
  un mensaje para completar una operación.
---

# n8n State Machine & Sessions

## Concepto

Un bot multi-paso necesita recordar el estado de cada conversación entre mensajes. Como n8n no tiene memoria entre ejecuciones, el estado se almacena externamente (Google Sheets, base de datos).

## Modelo de estado

```
Estados de una compra:
  null (sin sesión) 
    → /compra → "compra_esperando_insumo"
    → usuario envía "tornillo" → "compra_esperando_cantidad"
    → usuario envía "100" → "compra_esperando_confirmacion"  
    → usuario envía "si" → ejecutar compra → null (sesión terminada)
    → usuario envía "no" o "cancelar" → null (sesión cancelada)
```

## Almacenamiento de sesión

### Google Sheets: Hoja "Sesiones"

| chat_id | estado | datos_temp | updated_at |
|---------|--------|------------|------------|
| 456789 | compra_esperando_cantidad | {"insumo":"tornillo"} | 2024-01-15T10:30:00Z |

### Leer sesión

```json
{
  "parameters": {
    "operation": "read",
    "documentId": { "__rl": true, "value": "SPREADSHEET_ID", "mode": "id" },
    "sheetName": { "__rl": true, "value": "Sesiones", "mode": "name" },
    "filtersUI": {
      "values": [{
        "lookupColumn": "chat_id",
        "lookupValue": "={{ $json.chat_id }}"
      }]
    }
  },
  "type": "n8n-nodes-base.googleSheets",
  "typeVersion": 4.5,
  "name": "Leer sesion usuario"
}
```

### Guardar/actualizar sesión

```json
{
  "parameters": {
    "operation": "update",
    "documentId": { "__rl": true, "value": "SPREADSHEET_ID", "mode": "id" },
    "sheetName": { "__rl": true, "value": "Sesiones", "mode": "name" },
    "columns": {
      "mappingMode": "defineBelow",
      "value": {
        "estado": "={{ $json.next_state }}",
        "datos_temp": "={{ JSON.stringify($json.session_data) }}",
        "updated_at": "={{ $now.toISO() }}"
      }
    },
    "matchingColumns": ["chat_id"]
  },
  "type": "n8n-nodes-base.googleSheets",
  "typeVersion": 4.5,
  "name": "Guardar sesion"
}
```

### Crear sesión nueva (append)

```json
{
  "parameters": {
    "operation": "append",
    "documentId": { "__rl": true, "value": "SPREADSHEET_ID", "mode": "id" },
    "sheetName": { "__rl": true, "value": "Sesiones", "mode": "name" },
    "columns": {
      "mappingMode": "defineBelow",
      "value": {
        "chat_id": "={{ $json.chat_id }}",
        "estado": "={{ $json.next_state }}",
        "datos_temp": "={{ JSON.stringify($json.session_data) }}",
        "updated_at": "={{ $now.toISO() }}"
      }
    }
  },
  "type": "n8n-nodes-base.googleSheets",
  "typeVersion": 4.5,
  "name": "Crear sesion nueva"
}
```

## Flujo completo del router de estados

```
[Telegram Trigger] → [Parsear entrada] → [Leer sesion] → [Merge: entrada + sesion]
  → [Code: Router de estados]
    → Output 0: comando nuevo (sin sesión) → [Switch: comando]
    → Output 1: paso de sesión → [Code: Procesar paso] → [Guardar sesion] → [Responder]
    → Output 2: cancelar → [Limpiar sesion] → [Responder "Cancelado"]
```

### Code: Router de estados

```javascript
const input = $input.first().json;
const sessionRaw = input.session_estado || null;
const sessionData = input.session_datos_temp 
  ? JSON.parse(input.session_datos_temp) 
  : {};
const command = input.command;
const text = input.text;

// Comando /cancelar siempre limpia la sesión
if (command === 'cancelar') {
  return [[], [], [{ json: { ...input, flow: 'cancelar' } }]];
}

// Si hay sesión activa, procesar como paso de sesión
if (sessionRaw) {
  // Verificar timeout (sesiones de más de 30 min se expiran)
  const updatedAt = new Date(input.session_updated_at);
  const now = new Date();
  const diffMinutes = (now - updatedAt) / 60000;
  
  if (diffMinutes > 30) {
    // Sesión expirada, tratar como comando nuevo
    return [[{ json: { ...input, flow: 'nuevo_comando', session_expired: true } }], [], []];
  }
  
  return [[], [{ 
    json: { 
      ...input, 
      flow: 'paso_sesion',
      current_state: sessionRaw,
      session_data: sessionData
    } 
  }], []];
}

// Sin sesión → comando nuevo
return [[{ json: { ...input, flow: 'nuevo_comando' } }], [], []];
```

**Nota**: Este Code node tiene 3 outputs. En n8n, se puede hacer retornando un array de arrays: `return [output0_items, output1_items, output2_items]`.

### Code: Procesar paso de sesión

```javascript
const input = $input.first().json;
const state = input.current_state;
const data = input.session_data;
const text = input.text;

let response = '';
let nextState = null;
let nextData = { ...data };

switch (state) {
  case 'compra_esperando_insumo':
    // El usuario envió el nombre del insumo
    if (!text || text.length < 2) {
      response = '❌ Nombre de insumo no válido. Enviá el nombre del insumo:';
      nextState = state; // Se queda en el mismo estado
    } else {
      nextData.insumo = text.trim().toLowerCase();
      response = `📦 Insumo: *${nextData.insumo}*\n\n¿Cuántas unidades? Enviá la cantidad:`;
      nextState = 'compra_esperando_cantidad';
    }
    break;
    
  case 'compra_esperando_cantidad':
    const cantidad = parseInt(text);
    if (isNaN(cantidad) || cantidad <= 0) {
      response = '❌ Cantidad no válida. Enviá un número positivo:';
      nextState = state;
    } else {
      nextData.cantidad = cantidad;
      response = `📋 *Confirmar compra:*\n\n` +
        `• Insumo: ${nextData.insumo}\n` +
        `• Cantidad: ${nextData.cantidad}\n\n` +
        `¿Confirmar? (si/no)`;
      nextState = 'compra_esperando_confirmacion';
    }
    break;
    
  case 'compra_esperando_confirmacion':
    const respuesta = text.toLowerCase().trim();
    if (respuesta === 'si' || respuesta === 'sí') {
      // Ejecutar la compra → pasar al flujo de procesamiento
      return [{
        json: {
          ...input,
          flow: 'ejecutar_compra',
          insumo: nextData.insumo,
          cantidad: nextData.cantidad,
          response_text: null, // Se genera después de ejecutar
          next_state: null, // Limpiar sesión
          session_data: {}
        }
      }];
    } else {
      response = '❌ Compra cancelada.';
      nextState = null; // Limpiar sesión
      nextData = {};
    }
    break;
    
  default:
    response = '⚠️ Estado no reconocido. Enviá /cancelar para empezar de nuevo.';
    nextState = null;
    nextData = {};
}

return [{
  json: {
    ...input,
    flow: 'responder_sesion',
    response_text: response,
    next_state: nextState,
    session_data: nextData
  }
}];
```

## Patrones de sesión

### Patrón: Inicio de sesión desde comando

```
/compra → crear sesión "compra_esperando_insumo" → responder "¿Qué insumo?"
```

En el Switch de comandos, la rama "compra" hace:

```javascript
return [{
  json: {
    ...input,
    response_text: '📥 *Nueva compra*\n\n¿Qué insumo querés registrar?',
    next_state: 'compra_esperando_insumo',
    session_data: {},
    flow: 'iniciar_sesion'
  }
}];
```

### Patrón: Timeout de sesión

Verificar en el router si la sesión expiró:
```javascript
const TIMEOUT_MINUTES = 30;
const diffMinutes = (Date.now() - new Date(session.updated_at)) / 60000;
if (diffMinutes > TIMEOUT_MINUTES) {
  // Sesión expirada, tratar como nuevo
}
```

### Patrón: Limpiar sesión

Después de completar una operación o cancelar:

```
→ [Google Sheets: Delete row] (si se usa delete)
o
→ [Google Sheets: Update] con estado = null y datos_temp = "{}"
```

## Diagrama completo del flujo con sesiones

```
[Telegram Trigger]
  → [Parsear entrada]
  → [Leer sesion por chat_id]
  → [Merge: entrada + sesion]
  → [Code: Router]
    → sin sesión → [Switch comando]
      → /compra → [Set: iniciar sesión compra] → [Guardar sesion] → [Responder]
      → /consumo → [Set: iniciar sesión consumo] → [Guardar sesion] → [Responder]
      → /stock → [Leer stock] → [Formatear] → [Responder]
    → con sesión → [Code: Procesar paso]
      → responder_sesion → [Guardar sesion] → [Responder]
      → ejecutar_compra → [Procesar compra] → [Limpiar sesion] → [Responder]
    → cancelar → [Limpiar sesion] → [Responder "Cancelado"]
```

## Checklist de sesiones

- [ ] ¿La hoja de sesiones tiene: chat_id, estado, datos_temp, updated_at?
- [ ] ¿El router verifica timeout de sesión?
- [ ] ¿/cancelar siempre limpia la sesión?
- [ ] ¿Cada estado valida el input antes de avanzar?
- [ ] ¿La sesión se limpia al completar la operación?
- [ ] ¿Los datos temporales se serializan con JSON.stringify?
- [ ] ¿El bot indica al usuario en qué paso está y qué espera?
