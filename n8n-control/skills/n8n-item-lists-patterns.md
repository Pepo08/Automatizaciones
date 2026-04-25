---
name: n8n-item-lists-patterns
description: >
  Patrones para el nodo Item Lists en n8n: sort, limit, split out items,
  remove duplicates, summarize, y concatenate. Reemplaza Code nodes para
  operaciones comunes sobre arrays de items. Activar cuando el usuario
  mencione: ordenar, sort, limitar, limit, duplicados, deduplicar,
  split array, separar items, agrupar, summarize, concatenar,
  "sacar los primeros N", "eliminar repetidos", o cualquier operación
  sobre listas de items que se pueda hacer sin código.
---

# n8n Item Lists Patterns

## Operaciones disponibles (v3.1)

### Sort (ordenar items)

```json
{
  "parameters": {
    "operation": "sort",
    "sortFieldsUi": {
      "sortField": [
        {
          "fieldName": "stock_actual",
          "order": "ascending"
        }
      ]
    },
    "options": {}
  },
  "type": "n8n-nodes-base.itemLists",
  "typeVersion": 3.1,
  "name": "Ordenar por stock (menor a mayor)"
}
```

### Limit (primeros/últimos N items)

```json
{
  "parameters": {
    "operation": "limit",
    "maxItems": 10,
    "options": {}
  },
  "type": "n8n-nodes-base.itemLists",
  "typeVersion": 3.1,
  "name": "Tomar los primeros 10"
}
```

### Remove Duplicates

```json
{
  "parameters": {
    "operation": "removeDuplicates",
    "compare": "selectedFields",
    "fieldsToCompare": {
      "fields": [
        { "fieldName": "insumo_id" }
      ]
    },
    "options": {}
  },
  "type": "n8n-nodes-base.itemLists",
  "typeVersion": 3.1,
  "name": "Eliminar insumos duplicados"
}
```

### Split Out Items (desanidar array)

Si un item tiene un array interno, esto lo "explota" en items individuales:

```
Input:  [{ pedido: "PED-001", items: [{sku: "A"}, {sku: "B"}] }]
Output: [{ pedido: "PED-001", sku: "A" }, { pedido: "PED-001", sku: "B" }]
```

```json
{
  "parameters": {
    "operation": "splitOutItems",
    "fieldToSplitOut": "items",
    "options": {
      "include": "allOtherFields"
    }
  },
  "type": "n8n-nodes-base.itemLists",
  "typeVersion": 3.1,
  "name": "Separar líneas de pedido"
}
```

### Summarize (agrupar y agregar)

```json
{
  "parameters": {
    "operation": "summarize",
    "fieldsToSummarize": {
      "values": [
        {
          "field": "cantidad",
          "aggregation": "sum"
        },
        {
          "field": "insumo_id",
          "aggregation": "count"
        }
      ]
    },
    "fieldsToSplitBy": "categoria",
    "options": {}
  },
  "type": "n8n-nodes-base.itemLists",
  "typeVersion": 3.1,
  "name": "Sumar cantidades por categoría"
}
```

Aggregation options: `sum`, `count`, `countUnique`, `min`, `max`, `average`, `concatenate`, `first`, `last`

### Concatenate Items

Combina todos los items en uno solo, con arrays:

```
Input:  [{ name: "A" }, { name: "B" }, { name: "C" }]
Output: [{ name: ["A", "B", "C"] }]
```

```json
{
  "parameters": {
    "operation": "concatenateItems",
    "aggregate": "aggregateAllItemData",
    "options": {}
  },
  "type": "n8n-nodes-base.itemLists",
  "typeVersion": 3.1,
  "name": "Concatenar todos los items"
}
```

## Set vs Item Lists vs Code

| Operación | Set | Item Lists | Code |
|-----------|-----|-----------|------|
| Modificar campos de cada item | ✅ | ❌ | ✅ |
| Ordenar items | ❌ | ✅ Sort | ✅ |
| Tomar primeros N | ❌ | ✅ Limit | ✅ |
| Eliminar duplicados | ❌ | ✅ Remove Duplicates | ✅ |
| Agrupar y sumar | ❌ | ✅ Summarize | ✅ |
| Explotar array en items | ❌ | ✅ Split Out | ✅ |
| Lógica compleja | ❌ | ❌ | ✅ |

**Regla**: Si Item Lists lo puede hacer, usarlo en vez de Code (es más visual y debuggeable).
