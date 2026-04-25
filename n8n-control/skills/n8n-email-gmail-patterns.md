---
name: n8n-email-gmail-patterns
description: >
  Patrones para enviar emails con Gmail node en n8n: emails de texto,
  HTML con diseño, adjuntos, y templates de reportes/alertas. Activar
  cuando el usuario mencione: email, Gmail, correo, enviar mail,
  notificación por email, "mandar un email", reporte por mail,
  alerta por email, HTML email, o cualquier workflow que envíe emails.
---

# n8n Gmail Patterns

## Gmail Send (v2.1)

### Email de texto simple

```json
{
  "parameters": {
    "sendTo": "admin@empresa.com",
    "subject": "Alerta de stock bajo",
    "emailType": "text",
    "message": "={{ $json.mensaje }}",
    "options": {}
  },
  "type": "n8n-nodes-base.gmail",
  "typeVersion": 2.1,
  "name": "Enviar alerta por Email",
  "credentials": {
    "gmailOAuth2": {
      "id": "GMAIL_CREDENTIAL_ID",
      "name": "Gmail Account"
    }
  }
}
```

### Email HTML (para reportes)

```json
{
  "parameters": {
    "sendTo": "={{ $json.destinatario || 'admin@empresa.com' }}",
    "subject": "={{ $json.subject }}",
    "emailType": "html",
    "message": "={{ $json.html }}",
    "options": {
      "ccList": "",
      "replyTo": ""
    }
  },
  "type": "n8n-nodes-base.gmail",
  "typeVersion": 2.1,
  "name": "Enviar reporte por Email"
}
```

### Email con destinatario dinámico

```json
{
  "parameters": {
    "sendTo": "={{ $json.config.email_alertas }}",
    "subject": "⚠️ Stock bajo - {{ $now.toFormat('dd/MM/yyyy') }}",
    "emailType": "html",
    "message": "={{ $json.html_alerta }}"
  }
}
```

## Template HTML para alertas

```javascript
// Code node para generar HTML de alerta
const alertas = $json.alertas; // Array de insumos con stock bajo

const html = `
<div style="font-family: Arial; max-width: 600px; margin: 0 auto;">
  <h2 style="color: #e74c3c;">⚠️ Alerta de Stock Bajo</h2>
  <p>Los siguientes insumos están por debajo del stock mínimo:</p>
  <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
    <tr style="background: #e74c3c; color: white;">
      <th style="padding: 10px; text-align: left;">Insumo</th>
      <th style="padding: 10px; text-align: center;">Stock Actual</th>
      <th style="padding: 10px; text-align: center;">Stock Mínimo</th>
      <th style="padding: 10px; text-align: center;">Déficit</th>
    </tr>
    ${alertas.map(a => `
    <tr style="border-bottom: 1px solid #ddd;">
      <td style="padding: 8px;">${a.nombre}</td>
      <td style="padding: 8px; text-align: center; color: #e74c3c; font-weight: bold;">${a.stock_actual}</td>
      <td style="padding: 8px; text-align: center;">${a.stock_minimo}</td>
      <td style="padding: 8px; text-align: center; color: #e74c3c;">-${a.deficit}</td>
    </tr>`).join('')}
  </table>
  <p style="color: #666; font-size: 12px;">
    Generado automáticamente · ${new Date().toLocaleDateString('es-AR')}
  </p>
</div>`;

return [{ json: { html, subject: `⚠️ ${alertas.length} insumos con stock bajo` } }];
```

## Buenas prácticas

1. **Siempre usar HTML** para reportes y alertas (se ve mucho mejor)
2. **Inline CSS** solamente (muchos clientes de email ignoran `<style>` tags)
3. **Max-width 600px** para que se vea bien en mobile
4. **Subject descriptivo** con fecha y contexto
5. **No enviar emails vacíos** — verificar con IF antes de enviar
