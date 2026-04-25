---
name: n8n-http-request-patterns
description: >
  Patrones para el nodo HTTP Request v4.2 en n8n: GET, POST, PUT, DELETE,
  autenticación, headers, body, paginación, retry, y manejo de respuestas.
  Usar HTTP Request solo cuando NO hay nodo nativo para el servicio.
  Activar cuando el usuario mencione: HTTP Request, API call, REST,
  llamar endpoint, fetch, request, "consultar una API", "enviar datos a",
  o cuando se necesite integrar con un servicio que no tiene nodo nativo en n8n.
---

# n8n HTTP Request Patterns

## HTTP Request v4.2 — GET

```json
{
  "parameters": {
    "method": "GET",
    "url": "https://api.ejemplo.com/data",
    "authentication": "none",
    "sendQuery": true,
    "queryParameters": {
      "parameters": [
        { "name": "limit", "value": "100" },
        { "name": "offset", "value": "={{ $json.offset || 0 }}" }
      ]
    },
    "options": {
      "response": {
        "response": {
          "responseFormat": "autodetect"
        }
      },
      "timeout": 10000
    }
  },
  "type": "n8n-nodes-base.httpRequest",
  "typeVersion": 4.2,
  "name": "Consultar API de stock"
}
```

## HTTP Request — POST con JSON body

```json
{
  "parameters": {
    "method": "POST",
    "url": "https://api.ejemplo.com/orders",
    "authentication": "none",
    "sendBody": true,
    "specifyBody": "json",
    "jsonBody": "={{ JSON.stringify({ insumo: $json.insumo, cantidad: $json.cantidad, fecha: $now.toISO() }) }}",
    "options": {
      "response": {
        "response": { "responseFormat": "autodetect" }
      }
    }
  },
  "type": "n8n-nodes-base.httpRequest",
  "typeVersion": 4.2,
  "name": "Crear pedido en API"
}
```

## Autenticación

### Header Auth (API Key)
```json
{
  "parameters": {
    "method": "GET",
    "url": "https://api.ejemplo.com/data",
    "authentication": "genericCredentialType",
    "genericAuthType": "httpHeaderAuth"
  },
  "credentials": {
    "httpHeaderAuth": { "id": "CRED_ID", "name": "API Key" }
  }
}
```

### Bearer Token (manual en header)
```json
{
  "parameters": {
    "method": "GET",
    "url": "https://api.ejemplo.com/data",
    "authentication": "none",
    "sendHeaders": true,
    "headerParameters": {
      "parameters": [
        { "name": "Authorization", "value": "Bearer {{ $json.token }}" }
      ]
    }
  }
}
```

## Retry y error handling

```json
{
  "parameters": { "..." : "..." },
  "onError": "continueErrorOutput",
  "retryOnFail": true,
  "maxTries": 3,
  "waitBetweenTries": 2000
}
```

## Paginación

```
[Set: offset=0] → [HTTP Request: GET /data?offset={{offset}}]
  → [IF: hay más datos?]
    → true → [Set: offset += 100] → [Loop back to HTTP Request]
    → false → [Merge resultados] → [Procesar]
```

O con Split In Batches para procesamiento por lotes.

## Acceso a la respuesta

```javascript
// Status code
{{ $json.statusCode }}

// Body (la respuesta parseada)
{{ $json.data }}
{{ $json.results[0].name }}

// Headers de respuesta
{{ $json.headers }}
```

## Recordatorio: usar nodo nativo cuando exista

Antes de usar HTTP Request, verificar si hay nodo nativo:
- Google Sheets → `n8n-nodes-base.googleSheets`
- Telegram → `n8n-nodes-base.telegram`
- Gmail → `n8n-nodes-base.gmail`
- Slack → `n8n-nodes-base.slack`

HTTP Request solo para APIs sin nodo nativo o cuando el nodo nativo no soporta la operación.
