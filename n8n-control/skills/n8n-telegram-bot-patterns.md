---
name: n8n-telegram-bot-patterns
description: >
  Patrones para construir bots de Telegram en n8n: cómo recibir y parsear 
  mensajes, manejar comandos, callback queries, sesiones de conversación,
  respuestas con formato, teclados inline, y flujos conversacionales multi-paso.
  Activar cuando el usuario mencione: Telegram, bot, chat, mensaje, comando,
  /start, /help, callback, inline keyboard, "bot que responda", conversación,
  sesión, estado del chat, o cualquier automatización que involucre un bot de
  Telegram como entrada o salida. También activar cuando se diseñe un bot
  conversacional que necesite mantener estado entre mensajes.
---

# n8n Telegram Bot Patterns

## Estructura de datos del Telegram Trigger

Cuando llega un mensaje de Telegram, el trigger produce:

```javascript
// Mensaje de texto normal
{
  "message": {
    "message_id": 123,
    "from": {
      "id": 456789,
      "first_name": "Ralph",
      "username": "ralph_user"
    },
    "chat": {
      "id": 456789,
      "type": "private"
    },
    "text": "/compra tornillo 100",
    "date": 1700000000
  }
}
```

```javascript
// Callback query (botón inline presionado)
{
  "callback_query": {
    "id": "query_123",
    "from": { "id": 456789, "..." : "..." },
    "message": { "..." : "..." },
    "data": "confirmar_compra_tornillo_100"
  }
}
```

### Acceso a datos en expressions

```javascript
// Chat ID (necesario para responder)
{{ $json.message.chat.id }}
// o en callback
{{ $json.callback_query.message.chat.id }}

// Texto del mensaje
{{ $json.message.text }}

// User ID (para autorización)
{{ $json.message.from.id }}

// Username
{{ $json.message.from.username }}
```

## Patrón 1: Bot con comandos (el más común)

### Flujo completo

```
[Telegram Trigger] → [Parsear entrada] → [Switch: comando]
  → /compra   → [Procesar compra]   → [Responder]
  → /consumo  → [Procesar consumo]  → [Responder]
  → /stock    → [Consultar stock]   → [Responder]
  → /ayuda    → [Generar ayuda]     → [Responder]
  → default   → [Responder: comando no reconocido]
```

### Code node: Parsear entrada

```javascript
// Mode: Run Once for All Items
const items = $input.all();
const results = [];

for (const item of items) {
  const msg = item.json.message || {};
  const callback = item.json.callback_query;
  
  let chat_id, user_id, username, text, command, args, is_callback;
  
  if (callback) {
    // Es un callback de botón inline
    chat_id = callback.message.chat.id;
    user_id = callback.from.id;
    username = callback.from.username || '';
    text = callback.data;
    command = 'callback';
    args = callback.data.split('_');
    is_callback = true;
  } else {
    // Es un mensaje normal
    chat_id = msg.chat?.id;
    user_id = msg.from?.id;
    username = msg.from?.username || '';
    text = (msg.text || '').trim();
    
    if (text.startsWith('/')) {
      const parts = text.split(' ');
      command = parts[0].toLowerCase().replace('/', '');
      args = parts.slice(1);
    } else {
      command = 'texto_libre';
      args = text.split(' ');
    }
    is_callback = false;
  }
  
  results.push({
    json: {
      chat_id,
      user_id,
      username,
      text,
      command,
      args,
      is_callback,
      raw: item.json
    }
  });
}

return results;
```

### Switch node para comandos

```json
{
  "parameters": {
    "rules": {
      "values": [
        {
          "conditions": {
            "conditions": [{
              "leftValue": "={{ $json.command }}",
              "rightValue": "compra",
              "operator": { "type": "string", "operation": "equals" }
            }],
            "combinator": "and"
          },
          "renameOutput": true,
          "outputKey": "compra"
        },
        {
          "conditions": {
            "conditions": [{
              "leftValue": "={{ $json.command }}",
              "rightValue": "consumo",
              "operator": { "type": "string", "operation": "equals" }
            }],
            "combinator": "and"
          },
          "renameOutput": true,
          "outputKey": "consumo"
        },
        {
          "conditions": {
            "conditions": [{
              "leftValue": "={{ $json.command }}",
              "rightValue": "stock",
              "operator": { "type": "string", "operation": "equals" }
            }],
            "combinator": "and"
          },
          "renameOutput": true,
          "outputKey": "stock"
        }
      ]
    },
    "options": {
      "fallbackOutput": "extra"
    }
  },
  "type": "n8n-nodes-base.switch",
  "typeVersion": 3.2
}
```

## Patrón 2: Autorización por user ID

```javascript
// Code node: Verificar autorización
const AUTHORIZED_USERS = [456789, 111222, 333444]; // IDs de Telegram
const userId = $json.user_id;

if (!AUTHORIZED_USERS.includes(userId)) {
  return [{
    json: {
      ...($input.first().json),
      authorized: false,
      response_text: '⛔ No estás autorizado para usar este bot.'
    }
  }];
}

return [{
  json: {
    ...($input.first().json),
    authorized: true
  }
}];
```

O mejor, con Google Sheets de usuarios autorizados:

```
[Parsear entrada] → [Leer Sheets: Usuarios autorizados] → [Merge: Join por user_id]
                                                          → [IF: autorizado?]
                                                            → true → [Switch comando]
                                                            → false → [Responder no autorizado]
```

## Patrón 3: Sesiones de conversación

Para bots que necesitan recordar contexto entre mensajes (ej: flujo multi-paso):

### Guardar sesión en Google Sheets

Hoja "Sesiones" con columnas: `chat_id | estado | datos_temp | timestamp`

```
[Parsear entrada] → [Leer sesión de Sheets por chat_id] → [Merge] → [Code: Máquina de estados]
  → estado = "esperando_cantidad" → [Procesar cantidad] → [Actualizar sesión] → [Responder]
  → estado = "esperando_confirmacion" → [Confirmar] → [Actualizar sesión] → [Responder]
  → estado = null (nuevo) → [Switch por comando] → ...
```

### Code node: Máquina de estados

```javascript
const input = $input.first().json;
const session = input.session_state || null;
const command = input.command;
const args = input.args;
const text = input.text;

let nextState = null;
let responseText = '';
let sessionData = {};

if (!session || command === 'cancelar') {
  // Sin sesión activa o cancelar → procesar como comando nuevo
  return [{ json: { ...input, flow: 'nuevo_comando' } }];
}

switch (session) {
  case 'compra_esperando_cantidad':
    const cantidad = parseInt(text);
    if (isNaN(cantidad) || cantidad <= 0) {
      responseText = '❌ Ingresá una cantidad válida (número positivo).';
      nextState = session; // Mantener el estado
    } else {
      sessionData = { ...input.session_data, cantidad };
      responseText = `¿Confirmar compra de ${cantidad}x ${input.session_data.insumo}? (si/no)`;
      nextState = 'compra_esperando_confirmacion';
    }
    break;
    
  case 'compra_esperando_confirmacion':
    if (text.toLowerCase() === 'si' || text.toLowerCase() === 'sí') {
      return [{ json: { ...input, flow: 'ejecutar_compra', ...input.session_data } }];
    } else {
      responseText = '❌ Compra cancelada.';
      nextState = null;
    }
    break;
}

return [{
  json: {
    ...input,
    flow: 'responder_sesion',
    response_text: responseText,
    next_state: nextState,
    session_data: sessionData
  }
}];
```

## Patrón 4: Respuestas con formato

### Texto con Markdown (parse_mode: Markdown)

```javascript
const text = `*📦 Stock actual*\n\n` +
  `• Tornillos: *${stock.tornillos}* unidades\n` +
  `• Clavos: *${stock.clavos}* unidades\n` +
  `• Tuercas: *${stock.tuercas}* unidades\n\n` +
  `_Actualizado: ${new Date().toLocaleString('es-AR')}_`;
```

### Telegram Send Message node

```json
{
  "parameters": {
    "chatId": "={{ $json.chat_id }}",
    "text": "={{ $json.response_text }}",
    "additionalFields": {
      "parse_mode": "Markdown"
    }
  },
  "type": "n8n-nodes-base.telegram",
  "typeVersion": 1.2,
  "name": "Enviar respuesta"
}
```

### Teclado inline (botones)

```json
{
  "parameters": {
    "chatId": "={{ $json.chat_id }}",
    "text": "¿Qué querés hacer?",
    "additionalFields": {
      "replyMarkup": "inlineKeyboard",
      "inlineKeyboard": {
        "rows": [
          {
            "row": [
              { "text": "📥 Compra", "callbackData": "compra" },
              { "text": "📤 Consumo", "callbackData": "consumo" }
            ]
          },
          {
            "row": [
              { "text": "📊 Stock", "callbackData": "stock" },
              { "text": "❓ Ayuda", "callbackData": "ayuda" }
            ]
          }
        ]
      }
    }
  },
  "type": "n8n-nodes-base.telegram",
  "typeVersion": 1.2,
  "name": "Enviar menú"
}
```

## Patrón 5: Responder callback queries

Cuando el usuario presiona un botón inline, Telegram espera un "answer callback query":

```json
{
  "parameters": {
    "resource": "callback",
    "callbackQueryId": "={{ $json.raw.callback_query.id }}",
    "additionalFields": {}
  },
  "type": "n8n-nodes-base.telegram",
  "typeVersion": 1.2,
  "name": "Responder callback"
}
```

## Patrón 6: Mensajes largos

Telegram tiene límite de 4096 caracteres por mensaje. Para reportes largos:

```javascript
// Dividir en chunks de 4000 caracteres
const text = generarReporteLargo();
const chunks = [];
for (let i = 0; i < text.length; i += 4000) {
  chunks.push(text.substring(i, i + 4000));
}

return chunks.map(chunk => ({
  json: { chat_id, text: chunk }
}));
```

Luego usar **Split In Batches** → **Telegram Send** para enviar secuencialmente.

## Estructura recomendada del workflow

```
SECCIÓN: ENTRADA (azul)
[Telegram Trigger] → [Parsear entrada]

SECCIÓN: AUTORIZACIÓN (naranja)
→ [Leer usuarios autorizados] → [Merge] → [IF: autorizado?]
  → false → [Responder no autorizado]

SECCIÓN: SESIÓN (naranja)
→ [Leer sesión de Sheets] → [Merge] → [Code: Router de estado]
  → sesión activa → [Procesar paso de sesión]

SECCIÓN: PROCESAMIENTO (verde)
→ [Switch por comando]
  → compra → [Procesar compra] → [Actualizar stock] → [Guardar sesión]
  → consumo → [Procesar consumo] → [Registrar] → [Guardar sesión]
  → stock → [Consultar] → [Formatear]
  → default → [Generar ayuda]

SECCIÓN: RESPUESTA (amarillo)
→ [Telegram: Enviar respuesta]
```

## Checklist del bot de Telegram

- [ ] ¿El trigger recibe "message" y "callback_query"?
- [ ] ¿El parseo maneja mensajes de texto Y callbacks?
- [ ] ¿Se extrae chat_id correctamente para responder?
- [ ] ¿Hay autorización por user_id o es público?
- [ ] ¿Los mensajes de respuesta usan Markdown/HTML para formato?
- [ ] ¿Hay manejo de comando no reconocido (default)?
- [ ] ¿Los errores se notifican al usuario con mensaje amigable?
- [ ] ¿Los textos largos se dividen en chunks de <4096 chars?
