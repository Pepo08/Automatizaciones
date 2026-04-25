---
name: n8n-environment-config
description: >
  Manejo de variables de entorno, configuración centralizada, y secrets en n8n.
  Cubre: $env, hojas de configuración, .env files, y patrones para manejar
  settings que cambian entre ambientes. Activar cuando el usuario mencione:
  variables de entorno, .env, configuración, settings, secrets, $env,
  "cambiar entre dev y prod", "configuración centralizada", o cualquier
  manejo de configuración externa al workflow.
---

# n8n Environment & Config

## $env — Variables de entorno

En n8n, las variables de entorno se acceden con `$env`:

```javascript
{{ $env.SPREADSHEET_ID }}
{{ $env.OPENAI_API_KEY }}
{{ $env.WHATSAPP_TOKEN }}
{{ $env.ADMIN_EMAIL }}
```

### Configurar en n8n

**Docker:**
```yaml
environment:
  - SPREADSHEET_ID=abc123
  - ADMIN_EMAIL=admin@empresa.com
  - ALERTA_STOCK_HABILITADA=true
```

**n8n Cloud:** Settings → Variables

### En expressions dentro de nodos:
```json
{
  "parameters": {
    "documentId": {
      "__rl": true,
      "value": "={{ $env.SPREADSHEET_ID }}",
      "mode": "id"
    }
  }
}
```

## Patrón: Hoja de configuración en Sheets

Para configuración que cambia frecuentemente sin tocar n8n:

**Hoja "Config":**
| clave | valor | descripcion |
|-------|-------|-------------|
| ADMIN_EMAIL | admin@empresa.com | Email para alertas |
| STOCK_MINIMO_DEFAULT | 50 | Stock mínimo si no está definido |
| ALERTA_HABILITADA | true | Enviar alertas de stock bajo |
| HORA_REPORTE | 08:00 | Hora del reporte diario |
| MAX_COMPRA | 10000 | Máxima cantidad por compra |

### Leer y parsear config

```javascript
// Code node después de leer la hoja Config
const items = $input.all();
const config = {};

for (const item of items) {
  let valor = item.json.valor;
  // Auto-parse tipos
  if (valor === 'true') valor = true;
  else if (valor === 'false') valor = false;
  else if (!isNaN(valor) && valor !== '') valor = Number(valor);
  
  config[item.json.clave] = valor;
}

return [{ json: { config } }];
```

## Cuándo usar $env vs Hoja Config

| Tipo de config | $env | Hoja Config |
|---------------|------|-------------|
| API keys, tokens | ✅ | ❌ (no seguro) |
| IDs de spreadsheets | ✅ | ❌ |
| Emails de notificación | ✅ o ✅ | ✅ (más flexible) |
| Parámetros de negocio (stock mínimo) | ❌ | ✅ |
| Feature flags (habilitar/deshabilitar) | ❌ | ✅ |
| Valores que cambian seguido | ❌ | ✅ |

**Regla**: Secrets en $env, configuración de negocio en Sheets/DB.
