---
name: n8n-slack-patterns
description: >
  Patrones para integrar Slack en n8n: enviar mensajes, notificaciones,
  comandos slash, interacciones con botones, y canales de alerta. Activar
  cuando el usuario mencione: Slack, canal, notificación Slack, slash command,
  "mandar a Slack", "alertar por Slack", o cualquier integración con Slack.
---

# n8n Slack Patterns

## Enviar mensaje a canal

```json
{
  "parameters": {
    "resource": "message",
    "operation": "post",
    "channel": {
      "__rl": true,
      "value": "#alertas-stock",
      "mode": "name"
    },
    "text": "={{ $json.mensaje }}",
    "otherOptions": {
      "mrkdwn": true
    }
  },
  "type": "n8n-nodes-base.slack",
  "typeVersion": 2.2,
  "name": "Notificar en Slack",
  "credentials": {
    "slackOAuth2Api": { "id": "CRED_ID", "name": "Slack" }
  }
}
```

## Mensaje con bloques (formato rico)

```javascript
// Code node: Construir mensaje Slack con blocks
const alertas = $json.alertas;

const blocks = [
  {
    type: 'header',
    text: { type: 'plain_text', text: '⚠️ Alerta de Stock Bajo' }
  },
  {
    type: 'section',
    text: {
      type: 'mrkdwn',
      text: `*${alertas.length} insumos* por debajo del stock mínimo:`
    }
  },
  { type: 'divider' },
  ...alertas.slice(0, 10).map(a => ({
    type: 'section',
    text: {
      type: 'mrkdwn',
      text: `🔴 *${a.nombre}*\nActual: ${a.stock_actual} | Mínimo: ${a.stock_minimo} | Faltan: ${a.deficit}`
    }
  })),
  {
    type: 'context',
    elements: [{ type: 'mrkdwn', text: `Generado: ${new Date().toLocaleString('es-AR')}` }]
  }
];

return [{ json: { blocks: JSON.stringify(blocks), text: `⚠️ ${alertas.length} insumos con stock bajo` } }];
```

## Patrón: Canal de alertas por severidad

```
#alertas-criticas  → Stock en 0, errores de sistema
#alertas-stock     → Stock bajo mínimo
#operaciones       → Compras/consumos registrados
#reportes          → Reportes semanales
```

## Patrón: Slash command → n8n

```
[Webhook GET /slack-command] → [Parsear slash command] → [Procesar] → [Respond]
```

Slack envía: `text=stock tornillo&user_name=ralph&channel_name=general`
