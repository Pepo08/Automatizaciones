---
name: n8n-wait-timing-patterns
description: >
  Patrones para el nodo Wait y manejo de tiempos en n8n: delays, timeouts,
  esperar entre operaciones, y rate limiting manual. Activar cuando el
  usuario mencione: wait, esperar, delay, timeout, rate limit,
  "esperar X segundos", "no enviar todo junto", throttle, o cuando se
  necesite controlar el timing entre operaciones.
---

# n8n Wait & Timing Patterns

## Wait node

```json
{
  "parameters": {
    "amount": 2,
    "unit": "seconds"
  },
  "type": "n8n-nodes-base.wait",
  "typeVersion": 1.1,
  "name": "Esperar 2 segundos"
}
```

Units: `seconds`, `minutes`, `hours`, `days`

## Wait Until (esperar hasta fecha/hora)

```json
{
  "parameters": {
    "resume": "timeInterval",
    "amount": 1,
    "unit": "hours"
  },
  "type": "n8n-nodes-base.wait",
  "typeVersion": 1.1,
  "name": "Esperar 1 hora"
}
```

## Rate limiting manual

Para APIs con rate limits, agregar Wait entre llamadas:

```
[Split In Batches (10)] → [HTTP Request] → [Wait 1s] → [Loop back]
```

## Casos de uso

| Situación | Solución |
|-----------|---------|
| Google Sheets rate limit | Wait 1-2s entre writes |
| Enviar mensajes de Telegram sin spam | Wait 0.5s entre envíos |
| Esperar procesamiento externo | Wait + check status |
| Carrito abandonado | Wait 1h → verificar si compró |
