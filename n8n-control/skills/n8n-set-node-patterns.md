---
name: n8n-set-node-patterns
description: >
  Patrones para el Set node v3.4 en n8n: mapeo de campos, transformaciones,
  preparar datos para otros nodos, y renombrar/restructurar JSON. El Set es
  el nodo más usado en cualquier workflow y el que hace la transformación de
  datos entre nodos. Activar cuando el usuario mencione: Set, mapear campos,
  transformar datos, preparar datos, renombrar campos, agregar campos,
  "cambiar el formato", "pasar datos de un nodo a otro", o cualquier
  transformación simple de datos entre nodos. También activar implícitamente
  cuando se necesite adaptar la salida de un nodo a la entrada del siguiente.
---

# n8n Set Node Patterns

## Set node v3.4 — Configuración básica

### Modo Manual (recomendado)

```json
{
  "parameters": {
    "mode": "manual",
    "duplicateItem": false,
    "assignments": {
      "assignments": [
        {
          "id": "uuid-1",
          "name": "insumo",
          "value": "={{ $json.body.insumo_nombre }}",
          "type": "string"
        },
        {
          "id": "uuid-2",
          "name": "cantidad",
          "value": "={{ parseInt($json.body.cantidad) }}",
          "type": "number"
        },
        {
          "id": "uuid-3",
          "name": "timestamp",
          "value": "={{ $now.toISO() }}",
          "type": "string"
        }
      ]
    },
    "options": {
      "includeBinary": false
    }
  },
  "type": "n8n-nodes-base.set",
  "typeVersion": 3.4,
  "name": "Preparar datos de compra"
}
```

### Opciones importantes

- `duplicateItem: false` — Reemplaza los campos del item (solo quedan los definidos en assignments)
- `duplicateItem: true` — MANTIENE todos los campos originales Y agrega/sobreescribe los definidos
- `options.includeBinary: false` — No incluir datos binarios

### Cuándo usar cada modo

| duplicateItem | Comportamiento | Usar cuando |
|--------------|---------------|-------------|
| `false` | Solo los campos definidos pasan | Querés un output limpio y controlado |
| `true` | Campos originales + nuevos/modificados | Querés agregar o modificar sin perder datos |

## Patrones comunes

### 1. Renombrar campos (adaptador)

Adaptar la salida de un nodo al formato que espera el siguiente:

```json
{
  "assignments": {
    "assignments": [
      { "id": "1", "name": "chat_id", "value": "={{ $json.message.chat.id }}", "type": "number" },
      { "id": "2", "name": "user_id", "value": "={{ $json.message.from.id }}", "type": "number" },
      { "id": "3", "name": "text", "value": "={{ $json.message.text }}", "type": "string" }
    ]
  }
}
```

### 2. Agregar campos calculados

```json
{
  "mode": "manual",
  "duplicateItem": true,
  "assignments": {
    "assignments": [
      { "id": "1", "name": "stock_nuevo", "value": "={{ parseInt($json.stock_actual) + parseInt($json.cantidad) }}", "type": "number" },
      { "id": "2", "name": "ultima_actualizacion", "value": "={{ $now.toISO() }}", "type": "string" },
      { "id": "3", "name": "mov_id", "value": "={{ 'MOV-' + Date.now() }}", "type": "string" }
    ]
  }
}
```

### 3. Preparar respuesta para Telegram

```json
{
  "mode": "manual",
  "duplicateItem": false,
  "assignments": {
    "assignments": [
      { "id": "1", "name": "chatId", "value": "={{ $json.chat_id }}", "type": "string" },
      { "id": "2", "name": "text", "value": "✅ Compra registrada:\n• {{ $json.insumo }}: +{{ $json.cantidad }}\n• Stock nuevo: {{ $json.stock_nuevo }}", "type": "string" }
    ]
  }
}
```

### 4. Preparar datos para Google Sheets update

```json
{
  "mode": "manual",
  "duplicateItem": false,
  "assignments": {
    "assignments": [
      { "id": "1", "name": "insumo_id", "value": "={{ $json.insumo_id }}", "type": "string" },
      { "id": "2", "name": "stock_actual", "value": "={{ $json.stock_nuevo }}", "type": "number" },
      { "id": "3", "name": "ultima_actualizacion", "value": "={{ $now.toISO() }}", "type": "string" }
    ]
  }
}
```

### 5. Construir objeto JSON complejo

```json
{
  "mode": "manual",
  "duplicateItem": false,
  "assignments": {
    "assignments": [
      { 
        "id": "1", 
        "name": "session_data", 
        "value": "={{ JSON.stringify({ insumo: $json.insumo, cantidad: $json.cantidad, paso: 'confirmacion' }) }}", 
        "type": "string" 
      }
    ]
  }
}
```

### 6. Valores fijos (constantes)

```json
{
  "assignments": {
    "assignments": [
      { "id": "1", "name": "tipo", "value": "compra", "type": "string" },
      { "id": "2", "name": "version", "value": "1", "type": "number" },
      { "id": "3", "name": "activo", "value": "true", "type": "boolean" }
    ]
  }
}
```

## Expressions útiles en Set

```javascript
// Strings
"={{ $json.nombre.trim().toLowerCase() }}"
"={{ $json.nombre || 'sin nombre' }}"
"={{ $json.first_name + ' ' + $json.last_name }}"

// Numbers  
"={{ parseInt($json.cantidad) || 0 }}"
"={{ parseFloat($json.precio) * 1.21 }}"
"={{ Math.round($json.total * 100) / 100 }}"

// Dates
"={{ $now.toISO() }}"
"={{ $now.toFormat('dd/MM/yyyy HH:mm') }}"
"={{ DateTime.fromISO($json.fecha).toFormat('dd/MM/yyyy') }}"

// Conditional
"={{ $json.stock < $json.minimo ? '🔴 BAJO' : '🟢 OK' }}"
"={{ $json.tipo === 'compra' ? '+' : '-' }}{{ $json.cantidad }}"

// Arrays/Objects
"={{ $json.items?.length || 0 }}"
"={{ JSON.stringify($json.datos) }}"
"={{ JSON.parse($json.datos_temp || '{}') }}"
```

## Set vs Code: cuándo usar cada uno

| Tarea | Set | Code |
|-------|-----|------|
| Renombrar 3 campos | ✅ | ❌ overkill |
| Agregar timestamp | ✅ | ❌ |
| Cálculo simple (suma, resta) | ✅ con expression | ❌ |
| Loop sobre array interno | ❌ | ✅ |
| Lógica con múltiples if/else | ❌ | ✅ |
| Agrupar/sumarizar datos | ❌ | ✅ |
| Transformar 1-5 campos | ✅ | ❌ |
| Transformar 15+ campos con lógica | ❌ | ✅ |

## Errores comunes

### 1. Olvidar `=` al inicio de expressions
```
❌ "value": "{{ $json.nombre }}"     // Texto literal "{{ $json.nombre }}"
✅ "value": "={{ $json.nombre }}"    // Evalúa la expression
```

### 2. duplicateItem incorrecto
```
❌ duplicateItem: false + no incluir campos necesarios → se pierden datos
✅ duplicateItem: true si querés mantener todo y solo agregar/modificar
```

### 3. Tipos incorrectos
```
❌ type: "string" con value: "={{ parseInt($json.x) }}" → se guarda como string "100"
✅ type: "number" → se guarda como number 100
```
