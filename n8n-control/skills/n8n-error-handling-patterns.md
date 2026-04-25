---
name: n8n-error-handling-patterns
description: >
  Patrones de manejo de errores en workflows de n8n: Error Trigger workflow,
  onError por nodo (continueRegularOutput, continueErrorOutput, stopWorkflow),
  retry logic, try-catch en Code nodes, y cómo diseñar ramas de error.
  Un workflow sin error handling falla silenciosamente y es imposible de debuggear.
  Activar SIEMPRE que se genere un workflow de n8n — todo workflow debe tener
  al menos una estrategia de error handling. Activar cuando el usuario mencione:
  errores, "se rompe", "falla", manejo de errores, retry, try catch, error trigger,
  "qué pasa si falla", notificación de error, "no sé por qué falla",
  o cuando se esté diseñando un workflow que interactúa con APIs externas,
  bases de datos, o cualquier servicio que pueda fallar.
---

# n8n Error Handling Patterns

## Las 3 capas de error handling

### Capa 1: Por nodo (onError)

Cada nodo puede configurar qué hacer cuando falla:

```json
{
  "parameters": { ... },
  "onError": "continueErrorOutput",
  "retryOnFail": true,
  "maxTries": 3,
  "waitBetweenTries": 1000
}
```

**Opciones de onError:**

| Opción | Comportamiento | Cuándo usar |
|--------|---------------|-------------|
| `stopWorkflow` | Para todo el workflow (default) | Errores críticos, datos corruptos |
| `continueRegularOutput` | Ignora el error, sigue normal | Errores tolerables (notificación que falla) |
| `continueErrorOutput` | Envía el error a un output separado | Cuando querés manejar el error explícitamente |

### Capa 2: Error Trigger Workflow

Un workflow separado que se ejecuta cuando CUALQUIER workflow falla.

```json
{
  "nodes": [
    {
      "parameters": {},
      "type": "n8n-nodes-base.errorTrigger",
      "typeVersion": 1,
      "name": "Error trigger",
      "position": [250, 300]
    },
    {
      "parameters": {
        "assignments": {
          "assignments": [
            {
              "name": "error_message",
              "value": "={{ $json.execution.error.message }}",
              "type": "string"
            },
            {
              "name": "workflow_name",
              "value": "={{ $json.workflow.name }}",
              "type": "string"
            },
            {
              "name": "timestamp",
              "value": "={{ $now.toISO() }}",
              "type": "string"
            }
          ]
        }
      },
      "type": "n8n-nodes-base.set",
      "typeVersion": 3.4,
      "name": "Formatear error"
    }
  ]
}
```

Configurar en el workflow principal:
```json
{
  "settings": {
    "errorWorkflow": "ID_DEL_WORKFLOW_DE_ERRORES"
  }
}
```

### Capa 3: Try-Catch en Code nodes

```javascript
const items = $input.all();
const results = [];
const errors = [];

for (const item of items) {
  try {
    // Lógica que puede fallar
    const processed = someOperation(item.json);
    results.push({ json: { ...processed, status: 'ok' } });
  } catch (error) {
    errors.push({ 
      json: { 
        original: item.json, 
        error: error.message, 
        status: 'error' 
      } 
    });
  }
}

// Retornar ambos: exitosos y fallidos
return results.concat(errors);
```

## Patrones de error handling

### Patrón 1: Nodo crítico con rama de error

Para nodos que PUEDEN fallar (APIs, Google Sheets, etc.):

```
[Actualizar stock] ──main──→  [Registrar éxito] → [Responder OK]
  (onError: continueErrorOutput)
                   ──error──→ [Log error] → [Responder error al usuario]
```

```json
{
  "parameters": { "operation": "update", "..." : "..." },
  "onError": "continueErrorOutput",
  "type": "n8n-nodes-base.googleSheets",
  "name": "Actualizar stock"
}
```

### Patrón 2: Retry automático para APIs

Para servicios que tienen rate limits o fallos transitorios:

```json
{
  "parameters": { "..." : "..." },
  "onError": "continueRegularOutput",
  "retryOnFail": true,
  "maxTries": 3,
  "waitBetweenTries": 2000,
  "type": "n8n-nodes-base.httpRequest",
  "name": "Llamar API externa"
}
```

### Patrón 3: Validación antes de ejecución

Prevenir errores validando datos antes de llegar al nodo que puede fallar:

```
[Recibir datos] → [IF: datos válidos?]
  → true  → [Ejecutar operación]
  → false → [Responder: datos inválidos]
```

### Patrón 4: Error handling global con notificación

Workflow de error que notifica por email/Slack/Telegram:

```
[Error Trigger] → [Formatear mensaje de error] → [Enviar notificación]
```

### Patrón 5: Graceful degradation

Si una parte no crítica falla, seguir con el resto:

```
[Procesar pedido] → [Actualizar stock] → [Enviar email de confirmación]
                                            (onError: continueRegularOutput)
                                          → [Log: email no enviado]
```

El pedido se procesa y el stock se actualiza aunque el email falle.

## Qué errores manejar según el nodo

| Nodo | Errores comunes | Estrategia |
|------|----------------|------------|
| Google Sheets | Rate limit, permisos, hoja no existe | Retry 3x + error output |
| HTTP Request | Timeout, 500, 429 rate limit | Retry 3x + error output |
| Telegram | Bot bloqueado, chat no existe | continueRegularOutput + log |
| Gmail | Cuota excedida, autenticación | Retry 2x + error output + alerta |
| Code node | Datos inesperados, null/undefined | Try-catch interno |
| Webhook | Datos malformados | Validar con IF antes de procesar |

## Datos disponibles en el error output

Cuando un nodo falla con `continueErrorOutput`, el error output contiene:

```javascript
{
  "json": {
    "error": {
      "message": "Error description",
      "description": "Detailed error info",
      "httpCode": "429"  // si aplica
    },
    // Los datos originales que causaron el error
    ...originalInputData
  }
}
```

## Template de respuesta de error para bots

Para bots de Telegram/WhatsApp, siempre tener una respuesta de error amigable:

```javascript
// En el Code node de la rama de error
const error = $input.first().json.error;
const userMessage = `⚠️ Hubo un problema procesando tu solicitud.\n\n` +
  `Error: ${error.message || 'Error desconocido'}\n\n` +
  `Por favor intentá de nuevo. Si el problema persiste, contactá al administrador.`;

return [{ json: { text: userMessage, chat_id: $json.chat_id } }];
```

## Checklist de error handling

- [ ] ¿Los nodos que llaman APIs externas tienen retry + error output?
- [ ] ¿Hay un workflow de error global configurado?
- [ ] ¿Las ramas de error notifican al usuario (si es un bot)?
- [ ] ¿Los Code nodes tienen try-catch para datos inesperados?
- [ ] ¿Se loguean los errores (Google Sheets, Slack, etc.)?
- [ ] ¿Los errores no críticos usan continueRegularOutput?
- [ ] ¿Los datos de entrada se validan antes de procesarlos?
