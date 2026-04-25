---
name: n8n-webhook-form-patterns
description: >
  Patrones para recibir datos vía Webhook y formularios en n8n: configuración
  del webhook, validación de datos entrantes, autenticación por PIN/token,
  respuestas HTTP, y patrones de formulario web → n8n. Activar cuando el 
  usuario mencione: webhook, formulario, form, POST, recibir datos, endpoint,
  PIN, token, validar request, respuesta HTTP, "recibir de un formulario web",
  "endpoint para recibir datos", o cualquier workflow que reciba datos externos
  vía HTTP. También activar cuando se diseñe un sistema donde una web o app
  envía datos a n8n para procesarlos.
---

# n8n Webhook & Form Patterns

## Configuración del Webhook node

### Webhook básico POST

```json
{
  "parameters": {
    "path": "stock-form",
    "httpMethod": "POST",
    "responseMode": "lastNode",
    "options": {}
  },
  "type": "n8n-nodes-base.webhook",
  "typeVersion": 2,
  "name": "Recibir formulario",
  "webhookId": "uuid-unico"
}
```

**responseMode opciones:**
- `"immediately"` — Responde 200 OK inmediatamente, procesa en background
- `"lastNode"` — Espera que el workflow termine y responde con el output del último nodo
- `"responseNode"` — Responde cuando llega al nodo "Respond to Webhook"

### Acceso a datos del webhook

```javascript
// Body del POST
{{ $json.body }}
{{ $json.body.insumo }}
{{ $json.body.cantidad }}

// Headers
{{ $json.headers }}
{{ $json.headers.authorization }}

// Query parameters (?key=value)
{{ $json.query }}
{{ $json.query.action }}

// Path parameters (si configuraste :param en el path)
{{ $json.params }}
```

## Patrón 1: Formulario web con validación

```
[Webhook POST] → [Code: Validar y parsear] → [IF: datos válidos?]
  → true  → [Procesar] → [Respond to Webhook: 200 OK]
  → false → [Respond to Webhook: 400 Error]
```

### Code node: Validar request

```javascript
const body = $input.first().json.body;

// Validaciones
const errors = [];

if (!body) {
  errors.push('Body vacío');
}

if (!body.insumo || typeof body.insumo !== 'string') {
  errors.push('Campo "insumo" requerido (string)');
}

if (!body.cantidad || isNaN(parseInt(body.cantidad)) || parseInt(body.cantidad) <= 0) {
  errors.push('Campo "cantidad" requerido (número positivo)');
}

if (!body.tipo || !['compra', 'consumo'].includes(body.tipo)) {
  errors.push('Campo "tipo" debe ser "compra" o "consumo"');
}

if (errors.length > 0) {
  return [{
    json: {
      valid: false,
      status: 400,
      errors,
      message: 'Datos inválidos: ' + errors.join(', ')
    }
  }];
}

return [{
  json: {
    valid: true,
    insumo: body.insumo.trim().toLowerCase(),
    cantidad: parseInt(body.cantidad),
    tipo: body.tipo,
    pin: body.pin || null,
    timestamp: new Date().toISOString()
  }
}];
```

## Patrón 2: Autenticación por PIN

```
[Webhook] → [Leer config (PINs válidos)] → [Merge] → [Code: Validar PIN]
  → PIN válido → [Procesar]
  → PIN inválido → [Respond: 401 No autorizado]
```

```javascript
// Code: Validar PIN
const input = $input.first().json;
const config = $node['Leer config'].json;

const validPins = (config.pines_validos || '').split(',').map(p => p.trim());
const providedPin = String(input.pin || '');

if (!validPins.includes(providedPin)) {
  return [{
    json: {
      authorized: false,
      status: 401,
      message: 'PIN inválido'
    }
  }];
}

return [{
  json: {
    ...input,
    authorized: true,
    authenticated_by: 'pin'
  }
}];
```

## Patrón 3: Respond to Webhook node

Cuando usás `responseMode: "responseNode"`, necesitás un nodo Respond to Webhook:

```json
{
  "parameters": {
    "respondWith": "json",
    "responseBody": "={{ JSON.stringify({ success: true, message: $json.message, data: $json.result }) }}",
    "options": {
      "responseCode": 200,
      "responseHeaders": {
        "entries": [
          {
            "name": "Content-Type",
            "value": "application/json"
          }
        ]
      }
    }
  },
  "type": "n8n-nodes-base.respondToWebhook",
  "typeVersion": 1.1,
  "name": "Responder OK"
}
```

### Para errores:

```json
{
  "parameters": {
    "respondWith": "json",
    "responseBody": "={{ JSON.stringify({ success: false, error: $json.message }) }}",
    "options": {
      "responseCode": 400
    }
  },
  "type": "n8n-nodes-base.respondToWebhook",
  "typeVersion": 1.1,
  "name": "Responder error"
}
```

## Patrón 4: Webhook + Switch por tipo de operación

Para un endpoint único que maneja múltiples operaciones:

```
[Webhook POST /api/stock] → [Parsear body] → [Switch: body.tipo]
  → compra   → [Procesar compra]   → [Respond OK]
  → consumo  → [Procesar consumo]  → [Respond OK]
  → consulta → [Consultar stock]   → [Respond con datos]
  → default  → [Respond: tipo no reconocido (400)]
```

## Patrón 5: CORS para formularios web

Si el formulario está en otro dominio, configurar CORS:

```json
{
  "parameters": {
    "path": "stock-form",
    "httpMethod": "POST",
    "responseMode": "responseNode",
    "options": {
      "allowedOrigins": "https://mi-formulario.com"
    }
  },
  "type": "n8n-nodes-base.webhook",
  "typeVersion": 2
}
```

## Estructura recomendada del workflow

```
SECCIÓN: ENTRADA (azul)
[Webhook POST] → [Leer config de Sheets]

SECCIÓN: VALIDACIÓN (naranja)
→ [Merge: datos + config] → [Code: Validar PIN + datos]
  → [IF: request válido?]
    → false → [Respond: error de validación]

SECCIÓN: ROUTING (naranja)
  → true → [IF/Switch: tipo de operación]

SECCIÓN: PROCESAMIENTO (verde, una sub-sección por tipo)
  → compra → [Procesar] → [Actualizar stock] → [IF: escritura OK?]
    → true → [Registrar movimiento] → [Respond: compra OK]
    → false → [Respond: error de escritura]
  → consulta → [Formatear stock] → [Respond: datos de stock]

SECCIÓN: ERROR (rojo)
[Error handling global]
```

## Checklist de webhooks

- [ ] ¿El responseMode es correcto para el caso de uso?
- [ ] ¿Se validan TODOS los campos del body antes de procesar?
- [ ] ¿Hay autenticación (PIN, token, API key)?
- [ ] ¿Los errores devuelven HTTP status codes correctos (400, 401, 500)?
- [ ] ¿Los datos se parsean correctamente (números, strings, booleans)?
- [ ] ¿Hay manejo de body vacío o malformado?
- [ ] ¿CORS está configurado si el formulario es externo?
- [ ] ¿Hay rate limiting o protección contra abuso?
