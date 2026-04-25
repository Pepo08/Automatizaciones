---
name: n8n-whatsapp-bot-patterns
description: >
  Patrones para construir bots de WhatsApp en n8n vía la API de WhatsApp
  Business (Meta) o servicios como Twilio/360dialog. Cubre: recibir mensajes,
  enviar respuestas, templates, media, y flujos conversacionales. Activar
  cuando el usuario mencione: WhatsApp, WA, "bot de WhatsApp", WhatsApp
  Business, Meta API, Twilio WhatsApp, 360dialog, "enviar por WhatsApp",
  o cualquier automatización que involucre WhatsApp.
---

# n8n WhatsApp Bot Patterns

## Opciones de integración

| Servicio | Nodo nativo | Costo | Mejor para |
|----------|------------|-------|-----------|
| WhatsApp Business API (Meta) | ❌ (HTTP Request) | Gratis + por conversación | Producción |
| Twilio WhatsApp | ✅ (Twilio node) | Por mensaje | Rápido de configurar |
| 360dialog | ❌ (HTTP Request) | Por mensaje | Europa/LatAm |

## Recibir mensajes (Webhook)

Meta envía un webhook POST cuando llega un mensaje:

```
[Webhook POST /whatsapp] → [Code: Parsear mensaje de WhatsApp]
```

### Parsear mensaje de Meta WhatsApp API

```javascript
const body = $json.body;

// Verificar que es un mensaje (no una notificación de status)
const entry = body.entry?.[0];
const changes = entry?.changes?.[0];
const value = changes?.value;

if (!value?.messages?.[0]) {
  return [{ json: { type: 'status_update', skip: true } }];
}

const message = value.messages[0];
const contact = value.contacts?.[0];

return [{
  json: {
    phone: message.from, // Número del remitente
    name: contact?.profile?.name || 'Desconocido',
    message_id: message.id,
    timestamp: message.timestamp,
    type: message.type, // text, image, document, etc.
    text: message.text?.body || '',
    // Para botones/listas
    button_reply: message.interactive?.button_reply?.id || null,
    list_reply: message.interactive?.list_reply?.id || null
  }
}];
```

## Enviar mensajes (HTTP Request)

### Texto simple

```javascript
// Code node o HTTP Request
const response = await $helpers.httpRequest({
  method: 'POST',
  url: `https://graph.facebook.com/v18.0/${$env.WHATSAPP_PHONE_ID}/messages`,
  headers: {
    'Authorization': `Bearer ${$env.WHATSAPP_TOKEN}`,
    'Content-Type': 'application/json'
  },
  body: {
    messaging_product: 'whatsapp',
    to: $json.phone,
    type: 'text',
    text: { body: $json.response_text }
  }
});
```

### Mensaje con botones

```javascript
body: {
  messaging_product: 'whatsapp',
  to: $json.phone,
  type: 'interactive',
  interactive: {
    type: 'button',
    body: { text: '¿Qué querés hacer?' },
    action: {
      buttons: [
        { type: 'reply', reply: { id: 'compra', title: '📥 Compra' } },
        { type: 'reply', reply: { id: 'consumo', title: '📤 Consumo' } },
        { type: 'reply', reply: { id: 'stock', title: '📊 Stock' } }
      ]
    }
  }
}
```

### Mensaje con lista

```javascript
body: {
  messaging_product: 'whatsapp',
  to: $json.phone,
  type: 'interactive',
  interactive: {
    type: 'list',
    body: { text: 'Seleccioná un insumo:' },
    action: {
      button: 'Ver insumos',
      sections: [{
        title: 'Insumos disponibles',
        rows: [
          { id: 'tornillo', title: 'Tornillo 3/4', description: 'Stock: 500' },
          { id: 'clavo', title: 'Clavo 2"', description: 'Stock: 200' },
          { id: 'mdf', title: 'MDF 18mm', description: 'Stock: 25' }
        ]
      }]
    }
  }
}
```

## Webhook verification (obligatorio para Meta)

Meta verifica tu webhook con un GET request al registrar:

```
[Webhook GET /whatsapp] → [Code: Verificar challenge]
  → [Respond: challenge token]
```

```javascript
const mode = $json.query['hub.mode'];
const token = $json.query['hub.verify_token'];
const challenge = $json.query['hub.challenge'];

if (mode === 'subscribe' && token === $env.WHATSAPP_VERIFY_TOKEN) {
  return [{ json: { response: challenge } }];
}
return [{ json: { response: 'Forbidden', status: 403 } }];
```

## Diferencias clave con Telegram

| Aspecto | Telegram | WhatsApp |
|---------|----------|----------|
| Identificador | chat_id (número) | phone (con código país) |
| Formato texto | Markdown | Sin formato rico en texto normal |
| Botones | Inline keyboard | Interactive buttons (máx 3) |
| Listas | No nativo | Interactive list |
| Templates | No necesita | Obligatorio para iniciar conversación |
| Costo | Gratis | Por conversación/mensaje |
| Rate limit | 30 msg/s | Varía por tier |
