---
name: n8n-credentials-handling
description: >
  Cómo manejar credenciales en workflows generados de n8n: estructura JSON
  de credenciales, placeholders, cómo referenciar credenciales existentes,
  y buenas prácticas. Las credenciales mal configuradas son la causa #1 de
  que un workflow importado no funcione inmediatamente. Activar cuando se
  genere un JSON de workflow que use nodos con autenticación: Google Sheets,
  Gmail, Telegram, Slack, HTTP Request con auth, o cualquier servicio externo.
  También activar cuando el usuario mencione: credenciales, autenticación,
  API key, OAuth, "no conecta", "error de permisos", token, secret.
---

# n8n Credentials Handling

## Estructura de credenciales en el JSON

```json
{
  "parameters": { "..." : "..." },
  "type": "n8n-nodes-base.googleSheets",
  "credentials": {
    "googleSheetsOAuth2Api": {
      "id": "GOOGLE_SHEETS_CREDENTIAL_ID",
      "name": "Google Sheets Account"
    }
  }
}
```

### Campos
- **key** del objeto: tipo de credencial que espera el nodo
- **id**: ID de la credencial guardada en n8n (string)
- **name**: Nombre descriptivo (para referencia visual)

## Tipos de credenciales por nodo

| Nodo | Credential key | Tipo de auth |
|------|---------------|-------------|
| Google Sheets | `googleSheetsOAuth2Api` | OAuth2 |
| Gmail | `gmailOAuth2` | OAuth2 |
| Telegram | `telegramApi` | Bot Token |
| Slack | `slackOAuth2Api` | OAuth2 |
| HTTP Request | `httpBasicAuth` / `httpHeaderAuth` / `oAuth2Api` | Varies |
| Webhook | (no necesita) | — |

## Placeholder strategy para workflows generados

Cuando generas un JSON que el usuario va a importar, usar placeholders claros:

```json
{
  "credentials": {
    "googleSheetsOAuth2Api": {
      "id": "REEMPLAZAR_CON_TU_CREDENTIAL_ID",
      "name": "Google Sheets - Configurar después de importar"
    }
  }
}
```

### Instrucciones post-importación

Siempre incluir una nota al usuario:

```
Después de importar el workflow:
1. Abrí cada nodo con ícono de advertencia (triángulo amarillo)
2. En la sección "Credentials", seleccioná tu credencial existente
3. Si no tenés credenciales configuradas:
   - Google Sheets: Settings → Credentials → New → Google Sheets OAuth2
   - Telegram: Settings → Credentials → New → Telegram (usar Bot Token de @BotFather)
   - Gmail: Settings → Credentials → New → Gmail OAuth2
```

## Nodos que NO necesitan credenciales

- Webhook
- Schedule Trigger
- Manual Trigger
- Execute Workflow Trigger
- Set
- IF / Switch / Filter
- Merge
- Code
- Sticky Note
- NoOp
- Wait
- Item Lists
- Date & Time
- Respond to Webhook

## HTTP Request con autenticación

### Header Auth (API Key)
```json
{
  "parameters": {
    "method": "GET",
    "url": "https://api.ejemplo.com/data",
    "authentication": "genericCredentialType",
    "genericAuthType": "httpHeaderAuth",
    "options": {}
  },
  "credentials": {
    "httpHeaderAuth": {
      "id": "CREDENTIAL_ID",
      "name": "API Key"
    }
  }
}
```

### Sin auth (público)
```json
{
  "parameters": {
    "method": "GET",
    "url": "https://api.ejemplo.com/public",
    "authentication": "none",
    "options": {}
  }
}
```

## Buenas prácticas

1. **Nunca hardcodear tokens/keys** en los parameters — siempre usar credentials
2. **Usar nombres descriptivos** para las credentials ("Google Sheets - Stock Fontana")
3. **Documentar qué credentials necesita** el workflow en un Sticky Note
4. **Separar credentials por entorno** si tenés dev/prod
5. **Al generar JSONs**, siempre poner placeholders obvios
