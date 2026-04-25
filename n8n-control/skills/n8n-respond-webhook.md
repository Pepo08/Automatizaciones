---
name: n8n-respond-webhook
description: >
  Patrones para responder a webhooks en n8n: Respond to Webhook node,
  response codes, JSON responses, y manejo de respuestas de éxito/error.
  Activar cuando el workflow tenga un Webhook trigger y necesite devolver
  una respuesta HTTP al cliente. Activar cuando mencionen: respond,
  respuesta HTTP, response, status code, 200, 400, 401, "devolver datos",
  "responder al formulario", o webhooks con responseMode responseNode.
---

# n8n Respond to Webhook

## Configuración del Webhook para usar Respond node

```json
{
  "parameters": {
    "path": "mi-endpoint",
    "httpMethod": "POST",
    "responseMode": "responseNode"
  },
  "type": "n8n-nodes-base.webhook",
  "typeVersion": 2
}
```

`responseMode: "responseNode"` → el workflow NO responde hasta llegar a un Respond to Webhook node.

## Respond to Webhook node

### Respuesta exitosa (200)

```json
{
  "parameters": {
    "respondWith": "json",
    "responseBody": "={{ JSON.stringify({ success: true, message: 'Operación completada', data: { stock_nuevo: $json.stock_nuevo } }) }}",
    "options": {
      "responseCode": 200
    }
  },
  "type": "n8n-nodes-base.respondToWebhook",
  "typeVersion": 1.1,
  "name": "Responder OK"
}
```

### Respuesta de error (400)

```json
{
  "parameters": {
    "respondWith": "json",
    "responseBody": "={{ JSON.stringify({ success: false, error: $json.error_message, details: $json.errors }) }}",
    "options": {
      "responseCode": 400
    }
  },
  "type": "n8n-nodes-base.respondToWebhook",
  "typeVersion": 1.1,
  "name": "Responder error validación"
}
```

### No autorizado (401)

```json
{
  "parameters": {
    "respondWith": "json",
    "responseBody": "={{ JSON.stringify({ success: false, error: 'No autorizado' }) }}",
    "options": {
      "responseCode": 401
    }
  },
  "type": "n8n-nodes-base.respondToWebhook",
  "typeVersion": 1.1,
  "name": "Responder no autorizado"
}
```

## Patrón: Múltiples puntos de respuesta

Un webhook puede tener varios Respond nodes en diferentes ramas:

```
[Webhook] → [Validar] → [IF: válido?]
  → true  → [Procesar] → [IF: éxito?]
    → true  → [Respond 200: OK]
    → false → [Respond 500: Error interno]
  → false → [Respond 400: Datos inválidos]
```

**IMPORTANTE**: Solo UN Respond node se ejecuta por request. Si hay múltiples ramas, cada rama debe tener su propio Respond para cubrir todos los casos.

## Response modes del Webhook

| Mode | Comportamiento | Respond node? |
|------|---------------|--------------|
| `immediately` | Responde 200 al instante | No necesita |
| `lastNode` | Responde con output del último nodo | No necesita |
| `responseNode` | Espera Respond to Webhook | Sí, obligatorio |

- `immediately` — Para webhooks fire-and-forget (el cliente no espera resultado)
- `lastNode` — Simple, responde con los datos del último nodo
- `responseNode` — Control total sobre la respuesta (status code, headers, body)
