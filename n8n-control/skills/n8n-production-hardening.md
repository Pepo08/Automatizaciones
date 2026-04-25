---
name: n8n-production-hardening
description: >
  Checklist y patrones para llevar un workflow de n8n de desarrollo a producción:
  error handling completo, monitoring, logging, rate limits, idempotency,
  backups, y configuraciones de seguridad. Activar cuando el usuario mencione:
  producción, deploy, "poner en producción", "está listo?", production-ready,
  hardening, robustecer, "que no se rompa", monitoreo, uptime, o cuando
  un workflow esté funcionando en dev y se quiera activar para uso real.
---

# n8n Production Hardening

## Checklist pre-producción

### 1. Error Handling (obligatorio)
- [ ] Cada nodo que llama API/DB tiene `onError` configurado
- [ ] Hay Error Trigger workflow para notificar fallos globales
- [ ] Las ramas de error envían notificación (email/Slack/Telegram)
- [ ] Los Code nodes tienen try-catch
- [ ] Los errores se loguean con contexto (qué datos causaron el error)

### 2. Retry Logic
- [ ] Nodos de API tienen `retryOnFail: true, maxTries: 3`
- [ ] Wait between retries es >=1s para APIs externas
- [ ] Las operaciones de retry son idempotentes (no duplican datos)

### 3. Validación de datos
- [ ] Toda entrada (webhook/trigger) se valida antes de procesar
- [ ] Campos obligatorios se verifican
- [ ] Tipos de datos se parsean explícitamente (parseInt, etc.)
- [ ] Inputs vacíos/null se manejan con defaults

### 4. Rate Limiting
- [ ] Google Sheets: máx 60 reads/min, 60 writes/min
- [ ] Telegram: máx 30 mensajes/segundo
- [ ] OpenAI: depende del tier
- [ ] Batching con Wait para operaciones masivas

### 5. Logging y Observabilidad
- [ ] Cada workflow tiene un log de ejecución (Sheets/DB)
- [ ] Se registra: timestamp, input, output, errores, duración
- [ ] Hay alertas para ejecuciones fallidas
- [ ] Métricas de éxito/fallo accesibles

### 6. Seguridad
- [ ] Webhooks tienen autenticación (PIN/token/header)
- [ ] Credenciales configuradas por OAuth, no API keys en parámetros
- [ ] No hay datos sensibles en logs
- [ ] Los workflows de subflow tienen `callerPolicy` configurado

### 7. Configuración
- [ ] `executionOrder: "v1"` en todos los workflows
- [ ] Timeout configurado (no dejar en 0/infinito)
- [ ] Timezone correcta para Schedule triggers
- [ ] `saveDataErrorExecution: "all"` para poder diagnosticar

### 8. Testing
- [ ] Testeado con datos reales (no solo pinData)
- [ ] Probado cada rama del IF/Switch
- [ ] Probado con datos inválidos (edge cases)
- [ ] Probado el error handling (forzar fallos)

## Patrón: Log de ejecución

Agregar al final de cada workflow:

```javascript
// Code node: Generar log de ejecución
const startTime = $node['Trigger'].json?.timestamp || $now.toISO();
const endTime = $now.toISO();

return [{
  json: {
    workflow: 'bot-stock-operaciones',
    execution_id: $executionId,
    started_at: startTime,
    finished_at: endTime,
    status: 'success',
    items_processed: $input.all().length,
    trigger_type: 'telegram',
    user: $json.username || 'unknown',
    action: $json.command || 'unknown',
    details: JSON.stringify({ insumo: $json.insumo, cantidad: $json.cantidad })
  }
}];
```

→ Append a Google Sheets "Execution_Log"

## Patrón: Idempotency

Para operaciones que podrían ejecutarse 2 veces (retry, webhook duplicado):

```javascript
// Generar idempotency key
const key = `${$json.tipo}_${$json.insumo}_${$json.cantidad}_${$json.timestamp}`;

// Verificar si ya se procesó
// → Leer de Sheets/DB si este key ya existe
// → Si existe, skip
// → Si no existe, procesar y guardar el key
```

## Patrón: Circuit breaker manual

Si un servicio externo está caído, no seguir intentando:

```
[Leer config: servicio_habilitado] → [IF: habilitado?]
  → true → [Llamar servicio] 
    → error → [Incrementar error_count en config] → [IF: >5 errores?]
      → true → [Deshabilitar servicio en config] → [Alertar admin]
  → false → [Skip: servicio deshabilitado] → [Alertar: servicio offline]
```

## Ambientes: Dev vs Prod

```
DEV:
- Spreadsheet ID de prueba
- Webhook URL de test
- Trigger manual
- PinData para testing

PROD:
- Spreadsheet ID real
- Webhook URL de producción
- Trigger real (Telegram, Schedule, Webhook)
- Sin pinData
```

Usar variables de entorno (`$env.SPREADSHEET_ID`) o una hoja de configuración que tenga diferentes valores por ambiente.
