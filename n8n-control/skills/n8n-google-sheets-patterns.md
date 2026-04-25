---
name: n8n-google-sheets-patterns
description: >
  Patrones para usar Google Sheets como base de datos en n8n: leer, escribir,
  actualizar, buscar, y usar como almacenamiento de estado. Google Sheets es el
  "backend" más común en automatizaciones simples/medianas y tiene particularidades
  que causan errores si no se conocen. Activar cuando el usuario mencione:
  Google Sheets, planilla, spreadsheet, hoja de cálculo, "guardar en sheets",
  "leer de sheets", stock en planilla, base de datos en sheets, sesiones en
  sheets, configuración en sheets, o cualquier workflow que use Google Sheets
  como fuente o destino de datos. También activar cuando se use Google Sheets
  como pseudo-base-de-datos para almacenar estado, configuración, o logs.
---

# n8n Google Sheets Patterns

## Configuración del nodo Google Sheets v4.5

### Leer hoja completa

```json
{
  "parameters": {
    "operation": "read",
    "documentId": {
      "__rl": true,
      "value": "SPREADSHEET_ID_AQUI",
      "mode": "id"
    },
    "sheetName": {
      "__rl": true,
      "value": "Stock",
      "mode": "name"
    },
    "options": {}
  },
  "type": "n8n-nodes-base.googleSheets",
  "typeVersion": 4.5,
  "name": "Leer stock completo",
  "credentials": {
    "googleSheetsOAuth2Api": {
      "id": "CREDENTIAL_ID",
      "name": "Google Sheets Account"
    }
  }
}
```

Cada fila de la hoja se convierte en un item. La primera fila son los headers (nombres de campos).

### Leer con filtro (buscar fila específica)

```json
{
  "parameters": {
    "operation": "read",
    "documentId": { "__rl": true, "value": "SPREADSHEET_ID", "mode": "id" },
    "sheetName": { "__rl": true, "value": "Usuarios", "mode": "name" },
    "filtersUI": {
      "values": [
        {
          "lookupColumn": "user_id",
          "lookupValue": "={{ $json.user_id }}"
        }
      ]
    },
    "options": {}
  },
  "type": "n8n-nodes-base.googleSheets",
  "typeVersion": 4.5,
  "name": "Buscar usuario por ID"
}
```

### Append (agregar fila nueva)

```json
{
  "parameters": {
    "operation": "append",
    "documentId": { "__rl": true, "value": "SPREADSHEET_ID", "mode": "id" },
    "sheetName": { "__rl": true, "value": "Movimientos", "mode": "name" },
    "columns": {
      "mappingMode": "defineBelow",
      "value": {
        "fecha": "={{ $now.toISO() }}",
        "tipo": "={{ $json.tipo }}",
        "insumo": "={{ $json.insumo }}",
        "cantidad": "={{ $json.cantidad }}",
        "usuario": "={{ $json.username }}"
      }
    },
    "options": {}
  },
  "type": "n8n-nodes-base.googleSheets",
  "typeVersion": 4.5,
  "name": "Registrar movimiento"
}
```

### Update (actualizar fila existente)

```json
{
  "parameters": {
    "operation": "update",
    "documentId": { "__rl": true, "value": "SPREADSHEET_ID", "mode": "id" },
    "sheetName": { "__rl": true, "value": "Stock", "mode": "name" },
    "columns": {
      "mappingMode": "defineBelow",
      "value": {
        "stock_actual": "={{ $json.nuevo_stock }}",
        "ultima_actualizacion": "={{ $now.toISO() }}"
      }
    },
    "matchingColumns": ["insumo_id"],
    "options": {}
  },
  "type": "n8n-nodes-base.googleSheets",
  "typeVersion": 4.5,
  "name": "Actualizar stock"
}
```

**CLAVE**: `matchingColumns` define por qué campo buscar la fila a actualizar (como un WHERE en SQL).

## Google Sheets como base de datos

### Estructura recomendada de hojas

Para un sistema de stock típico:

**Hoja "Stock":**
| insumo_id | nombre | unidad | stock_actual | stock_minimo | ultima_actualizacion |
|-----------|--------|--------|-------------|-------------|---------------------|
| INS001 | Tornillo 3/4 | unidad | 500 | 100 | 2024-01-15T... |

**Hoja "Movimientos":**
| id | fecha | tipo | insumo_id | cantidad | usuario | notas |
|----|-------|------|-----------|----------|---------|-------|
| MOV001 | 2024-01-15T... | compra | INS001 | 200 | ralph | Proveedor X |

**Hoja "Usuarios_Autorizados":**
| user_id | nombre | username | rol | activo |
|---------|--------|----------|-----|--------|
| 456789 | Ralph | ralph_user | admin | true |

**Hoja "Sesiones":**
| chat_id | estado | datos_temp | timestamp |
|---------|--------|------------|-----------|
| 456789 | compra_esperando_cantidad | {"insumo":"tornillo"} | 2024-01-15T... |

**Hoja "Configuracion":**
| clave | valor |
|-------|-------|
| SPREADSHEET_ID | abc123 |
| ALERTA_EMAIL | admin@empresa.com |
| HORA_REPORTE | 08:00 |

### Patrón: Leer configuración al inicio

```
[Trigger] → [Leer config de Sheets] → [Code: Parsear config a objeto] → [Merge con datos] → [Procesar]
```

```javascript
// Code: Parsear config a objeto
const items = $input.all();
const config = {};
for (const item of items) {
  config[item.json.clave] = item.json.valor;
}
return [{ json: { config } }];
```

### Patrón: Buscar y actualizar stock

```
[Obtener insumo_id y cantidad] 
  → [Leer stock actual de Sheets (filtro por insumo_id)]
  → [Merge: combinar con datos de entrada]
  → [Code: Calcular nuevo stock]
  → [IF: stock suficiente?]
    → true  → [Google Sheets: Update stock] → [Google Sheets: Append movimiento]
    → false → [Responder: stock insuficiente]
```

## Errores comunes con Google Sheets

### Error 1: "No matching row found"
Al hacer update, si `matchingColumns` no encuentra la fila.
**Fix**: Verificar que el valor de match existe. Usar IF para validar.

### Error 2: Rate limits (429)
Google Sheets tiene límite de ~100 requests por 100 segundos.
**Fix**: Usar `retryOnFail: true, maxTries: 3, waitBetweenTries: 2000`.

### Error 3: Tipos de datos
Google Sheets trata todo como string. Números pueden venir como "100" no 100.
**Fix**: Parsear explícitamente:
```javascript
const stock = parseInt($json.stock_actual) || 0;
```

### Error 4: Hojas vacías
Si la hoja no tiene datos, el read devuelve 0 items.
**Fix**: Manejar el caso de 0 items con IF:
```
[Leer Sheets] → [IF: items.length > 0?]
  → true → [Procesar]
  → false → [Crear registro inicial]
```

### Error 5: Campos con espacios
Si el header tiene espacios: "Stock Actual" → acceder como `$json["Stock Actual"]`
**Recomendación**: Usar headers sin espacios ni caracteres especiales: `stock_actual`

## Patrón: Transacción pseudo-atómica

Google Sheets no tiene transacciones. Para simular atomicidad:

```
1. Leer datos actuales
2. Calcular cambios en memoria (Code node)
3. Validar que los datos no cambiaron (re-leer y comparar)
4. Si ok → Escribir cambios
5. Si cambió → Retry o abortar
```

## Patrón: Log de auditoría

Siempre agregar un append al log después de cada operación de escritura:

```
[Actualizar stock] → [Append a Movimientos: log del cambio]
```

El log debe incluir: quién, qué, cuándo, valor anterior, valor nuevo.

## Checklist de Google Sheets

- [ ] ¿Los headers de las hojas son sin espacios? (snake_case preferido)
- [ ] ¿Los matchingColumns del update son correctos?
- [ ] ¿Se manejan los rate limits con retry?
- [ ] ¿Se parsean correctamente los números (parseInt/parseFloat)?
- [ ] ¿Se maneja el caso de 0 items (hoja vacía)?
- [ ] ¿Hay log de auditoría para operaciones de escritura?
- [ ] ¿Las credenciales son por OAuth (no API key)?
