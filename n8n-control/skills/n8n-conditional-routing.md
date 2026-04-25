---
name: n8n-conditional-routing
description: >
  Patrones para IF, Switch, y Filter en n8n: cómo configurar condiciones,
  comparar valores, rutear por múltiples criterios, y manejar las ramas
  correctamente. El IF y Switch son los nodos más usados después de Set y
  los que más errores causan por mala configuración de condiciones.
  Activar cuando el usuario mencione: IF, Switch, condición, filtro, 
  "si pasa X hacer Y", condicional, ramas, routing, router, bifurcación,
  "separar por tipo", "depende del valor", o cualquier lógica condicional.
---

# n8n Conditional Routing

## IF node (v2.2) — 2 salidas: true/false

### Estructura JSON

```json
{
  "parameters": {
    "conditions": {
      "options": {
        "caseSensitive": true,
        "leftValue": "",
        "typeValidation": "strict",
        "version": 2
      },
      "conditions": [
        {
          "id": "uuid-unico",
          "leftValue": "={{ $json.tipo }}",
          "rightValue": "compra",
          "operator": {
            "type": "string",
            "operation": "equals"
          }
        }
      ],
      "combinator": "and"
    },
    "options": {}
  },
  "type": "n8n-nodes-base.if",
  "typeVersion": 2.2,
  "name": "¿Es compra?"
}
```

### Combinator
- `"and"` — TODAS las condiciones deben ser true
- `"or"` — AL MENOS UNA debe ser true

### Operators por tipo

**String:**
- `equals`, `notEquals`, `contains`, `notContains`
- `startsWith`, `endsWith`, `regex`, `isEmpty`, `isNotEmpty`

**Number:**
- `equals`, `notEquals`, `gt` (>), `gte` (>=), `lt` (<), `lte` (<=)
- `isEmpty`, `isNotEmpty`

**Boolean:**
- `true`, `false`, `isEmpty`, `isNotEmpty`

### Conexiones del IF

```json
{
  "connections": {
    "¿Es compra?": {
      "main": [
        [{ "node": "Procesar compra", "type": "main", "index": 0 }],
        [{ "node": "No es compra", "type": "main", "index": 0 }]
      ]
    }
  }
}
```
- `main[0]` = rama TRUE
- `main[1]` = rama FALSE

## Switch node (v3.2) — N salidas

### Estructura JSON

```json
{
  "parameters": {
    "rules": {
      "values": [
        {
          "conditions": {
            "options": {
              "caseSensitive": true,
              "leftValue": "",
              "typeValidation": "strict",
              "version": 2
            },
            "conditions": [
              {
                "id": "uuid-1",
                "leftValue": "={{ $json.command }}",
                "rightValue": "compra",
                "operator": { "type": "string", "operation": "equals" }
              }
            ],
            "combinator": "and"
          },
          "renameOutput": true,
          "outputKey": "compra"
        },
        {
          "conditions": {
            "options": {
              "caseSensitive": true,
              "leftValue": "",
              "typeValidation": "strict",
              "version": 2
            },
            "conditions": [
              {
                "id": "uuid-2",
                "leftValue": "={{ $json.command }}",
                "rightValue": "consumo",
                "operator": { "type": "string", "operation": "equals" }
              }
            ],
            "combinator": "and"
          },
          "renameOutput": true,
          "outputKey": "consumo"
        },
        {
          "conditions": {
            "options": {
              "caseSensitive": true,
              "leftValue": "",
              "typeValidation": "strict",
              "version": 2
            },
            "conditions": [
              {
                "id": "uuid-3",
                "leftValue": "={{ $json.command }}",
                "rightValue": "stock",
                "operator": { "type": "string", "operation": "equals" }
              }
            ],
            "combinator": "and"
          },
          "renameOutput": true,
          "outputKey": "stock"
        }
      ]
    },
    "options": {
      "fallbackOutput": "extra"
    }
  },
  "type": "n8n-nodes-base.switch",
  "typeVersion": 3.2,
  "name": "Router de comandos"
}
```

### Conexiones del Switch (N+1 salidas)

```json
{
  "connections": {
    "Router de comandos": {
      "main": [
        [{ "node": "Procesar compra", "type": "main", "index": 0 }],
        [{ "node": "Procesar consumo", "type": "main", "index": 0 }],
        [{ "node": "Consultar stock", "type": "main", "index": 0 }],
        [{ "node": "Comando no reconocido", "type": "main", "index": 0 }]
      ]
    }
  }
}
```
- `main[0]` = primera regla (compra)
- `main[1]` = segunda regla (consumo)
- `main[2]` = tercera regla (stock)
- `main[3]` = fallback (si `fallbackOutput: "extra"`)

### fallbackOutput opciones
- `"extra"` — output adicional al final para items que no matchean ninguna regla
- `"none"` — items que no matchean se descartan

## Filter node (v2.2) — 1 salida (pasa/no pasa)

A diferencia del IF, el Filter DESCARTA los items que no cumplen. No tiene rama false.

```json
{
  "parameters": {
    "conditions": {
      "options": { "caseSensitive": true, "leftValue": "", "typeValidation": "strict", "version": 2 },
      "conditions": [
        {
          "id": "uuid",
          "leftValue": "={{ $json.stock_actual }}",
          "rightValue": "={{ $json.stock_minimo }}",
          "operator": { "type": "number", "operation": "lt" }
        }
      ],
      "combinator": "and"
    },
    "options": {}
  },
  "type": "n8n-nodes-base.filter",
  "typeVersion": 2.2,
  "name": "Filtrar insumos con stock bajo"
}
```

## Errores comunes

### 1. Comparar string con number
```
❌ leftValue: "={{ $json.stock }}" (string "100")
   rightValue: 50
   operator: number > gt
   → FALLA: compara "100" (string) > 50 (number)

✅ leftValue: "={{ parseInt($json.stock) }}"
   rightValue: 50
   → OK: compara 100 (number) > 50 (number)
```

### 2. No usar fallback en Switch
Sin fallback, items que no matchean NINGUNA regla se pierden silenciosamente.
**Siempre usar** `"fallbackOutput": "extra"`.

### 3. Ramas vacías
Si una condición no matchea ningún item, esa rama no se ejecuta.
Los nodos conectados a esa rama simplemente no corren (no es un error).

## Cuándo usar IF vs Switch vs Filter

| Situación | Usar |
|-----------|------|
| Una condición, 2 caminos | **IF** |
| Múltiples valores posibles del mismo campo | **Switch** |
| Filtrar items de una lista | **Filter** |
| Validar datos (pasa/no pasa) | **IF** |
| Rutear por tipo de comando | **Switch** |
| Eliminar items inválidos de un batch | **Filter** |
