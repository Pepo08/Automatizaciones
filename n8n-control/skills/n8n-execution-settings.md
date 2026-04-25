---
name: n8n-execution-settings
description: >
  Configuración de ejecución de workflows en n8n: execution order v0 vs v1,
  settings del workflow, timeout, save executions, error workflow, y
  configuraciones que afectan cómo se ejecuta un workflow. Activar cuando
  el usuario mencione: execution order, settings, configuración del workflow,
  timeout, "se ejecuta en orden raro", "los nodos se ejecutan desordenados",
  v0, v1, o problemas de orden de ejecución.
---

# n8n Execution Settings

## Execution Order: v0 vs v1

### v1 (SIEMPRE usar esto)

```json
{
  "settings": {
    "executionOrder": "v1"
  }
}
```

**v1**: Los nodos se ejecutan siguiendo las CONEXIONES. Un nodo se ejecuta cuando TODOS sus inputs tienen datos.

### v0 (legacy, NO usar)

Los nodos se ejecutan de arriba a abajo por posición visual. Causa comportamiento impredecible.

## Settings completos del workflow

```json
{
  "settings": {
    "executionOrder": "v1",
    "saveManualExecutions": true,
    "saveDataSuccessExecution": "all",
    "saveDataErrorExecution": "all",
    "executionTimeout": 300,
    "timezone": "America/Argentina/Buenos_Aires",
    "errorWorkflow": "ERROR_WORKFLOW_ID",
    "callerPolicy": "workflowsFromSameOwner"
  }
}
```

### Campos importantes

| Campo | Descripción | Valor recomendado |
|-------|------------|-------------------|
| `executionOrder` | Orden de ejecución | `"v1"` (siempre) |
| `executionTimeout` | Timeout en segundos (0=sin límite) | `300` (5 min) |
| `saveManualExecutions` | Guardar ejecuciones manuales | `true` |
| `errorWorkflow` | ID del workflow de error global | ID del workflow |
| `callerPolicy` | Quién puede llamar este workflow como subflow | `"workflowsFromSameOwner"` |
| `timezone` | Timezone para Schedule Trigger | `"America/Argentina/Buenos_Aires"` |

### callerPolicy opciones
- `"any"` — Cualquier workflow puede llamarlo
- `"workflowsFromSameOwner"` — Solo workflows del mismo owner
- `"none"` — No se puede llamar como subflow

## Workflow meta-información

```json
{
  "name": "Bot Stock Fontana - Operaciones",
  "nodes": [...],
  "connections": {...},
  "settings": {...},
  "staticData": null,
  "tags": [
    { "name": "stock" },
    { "name": "telegram" },
    { "name": "produccion" }
  ]
}
```
