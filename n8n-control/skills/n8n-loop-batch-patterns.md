---
name: n8n-loop-batch-patterns
description: >
  Patrones para Split In Batches y loops en n8n: procesar items en lotes,
  loops controlados, paginación, y procesamiento secuencial. Activar cuando
  el usuario mencione: batch, lote, loop, paginación, "procesar de a N",
  "recorrer uno por uno", Split In Batches, "son muchos items",
  o cuando se necesite procesar grandes cantidades de datos.
---

# n8n Loop & Batch Patterns

## Split In Batches (v3.1)

Procesa N items a la vez, luego repite con los siguientes N:

```json
{
  "parameters": {
    "batchSize": 10,
    "options": {}
  },
  "type": "n8n-nodes-base.splitInBatches",
  "typeVersion": 3.1,
  "name": "Procesar de a 10"
}
```

### Flujo de loop

```
[Leer datos (100 items)] → [Split In Batches (10)]
                              ↓ (10 items)
                           [Procesar batch]
                              ↓
                           [Wait 1s (rate limit)]
                              ↓
                           [Loop back a Split In Batches]
                              ↓ (siguientes 10)
                           ... (repite 10 veces)
                              ↓ (cuando no hay más)
                           [Segundo output: Done]
```

### Conexiones del loop

```json
{
  "connections": {
    "Procesar de a 10": {
      "main": [
        [{ "node": "Procesar batch", "type": "main", "index": 0 }],
        [{ "node": "Siguiente paso post-loop", "type": "main", "index": 0 }]
      ]
    },
    "Wait 1s": {
      "main": [
        [{ "node": "Procesar de a 10", "type": "main", "index": 0 }]
      ]
    }
  }
}
```

- `main[0]` = items del batch actual → procesar
- `main[1]` = sale cuando terminó todos los batches → continuar

### IMPORTANTE: El loop vuelve AL Split In Batches

El último nodo del procesamiento debe conectar DE VUELTA al Split In Batches:

```
[Split In Batches] → [Procesar] → [Wait] → [Split In Batches] (loop)
         ↓ (done)
[Siguiente paso]
```

## Cuándo usar batches

| Situación | Batch size recomendado |
|-----------|----------------------|
| Google Sheets writes | 10 (rate limit ~100/100s) |
| API calls con rate limit | Depende del límite |
| Envío de emails masivo | 5-10 |
| Telegram mensajes masivos | 1 (con Wait 0.5s) |
| Procesamiento pesado en Code | 50-100 |

## Alternativa: Sin loop explícito

Si no hay rate limits y el volumen es bajo (<100 items), muchos nodos procesan TODOS los items automáticamente sin necesidad de batching:

```
[Leer 50 items] → [Set: transformar] → [Google Sheets: Append]
```

Google Sheets append procesará los 50 items automáticamente. Solo usar Split In Batches cuando necesitás controlar el rate o el procesamiento secuencial.
