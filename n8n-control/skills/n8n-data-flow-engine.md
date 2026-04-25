---
name: n8n-data-flow-engine
description: >
  Cómo fluyen los datos (items) entre nodos en n8n. Explica el modelo de ejecución
  de n8n: qué son los items, cómo se pasan entre nodos, qué pasa cuando un nodo 
  recibe múltiples inputs, cómo funciona el "Run Once for Each Item" vs 
  "Run Once for All Items", y cómo los datos se transforman en cada paso.
  OBLIGATORIA para generar workflows que funcionen correctamente. Sin entender
  el data flow, los workflows generados producen datos duplicados, vacíos, o
  se ejecutan más veces de lo esperado. Activar SIEMPRE que se diseñe o debuggee
  un workflow. Activar cuando el usuario mencione: datos duplicados, se ejecuta 
  dos veces, items vacíos, no llegan los datos, "pierde datos", "datos repetidos",
  $json, $input, items, ejecución de nodos, o cualquier problema de flujo de datos.
---

# n8n Data Flow Engine

## Concepto fundamental: Items

En n8n, los datos fluyen como **arrays de items**. Cada item es un objeto JSON.

```
Nodo A produce: [
  { json: { name: "Tornillo", stock: 100 } },
  { json: { name: "Clavo", stock: 50 } },
  { json: { name: "Tuerca", stock: 200 } }
]
```

Estos 3 items se pasan al siguiente nodo. El siguiente nodo recibe los 3 items como input.

## Modelo de ejecución: cómo un nodo procesa items

### La mayoría de nodos: procesan CADA item

Cuando un nodo recibe N items, por defecto procesa cada uno individualmente:

```
Input: [item1, item2, item3]

Set node (agrega campo "doble"):
  → Procesa item1 → { name: "Tornillo", stock: 100, doble: 200 }
  → Procesa item2 → { name: "Clavo", stock: 50, doble: 100 }
  → Procesa item3 → { name: "Tuerca", stock: 200, doble: 400 }

Output: [item1_modificado, item2_modificado, item3_modificado]
```

### Code node: puede procesar todos juntos

```javascript
// Mode: "Run Once for All Items"
// $input.all() devuelve TODOS los items
const items = $input.all();
const total = items.reduce((sum, item) => sum + item.json.stock, 0);
return [{ json: { totalStock: total } }];
// Output: 1 item con el total
```

```javascript
// Mode: "Run Once for Each Item"
// $input.item devuelve EL item actual
const item = $input.item;
return [{ json: { ...item.json, doble: item.json.stock * 2 } }];
// Se ejecuta 3 veces, output: 3 items modificados
```

## Qué pasa con múltiples inputs (SIN Merge)

> **REGLA CRÍTICA: Si 2 nodos conectan al mismo destino sin Merge, el destino se ejecuta 2 VECES, cada vez con los datos de UNA sola fuente.**

```
[Leer stock] (produce 10 items) ──→ [Code: Procesar]
[Leer config] (produce 1 item)  ──→ [Code: Procesar]
```

**Ejecución real:**
1. "Leer stock" termina → "Code: Procesar" se ejecuta con 10 items de stock
2. "Leer config" termina → "Code: Procesar" se ejecuta OTRA VEZ con 1 item de config

**El Code node NO tiene acceso a ambos datasets a la vez.** Esto es el error más común.

### Solución: Merge antes del procesamiento

```
[Leer stock] (10 items) ──→ [Merge: Append] ──→ [Code: Procesar]
[Leer config] (1 item)  ──→ [Merge: Append]

Ejecución:
1. Merge espera ambos inputs
2. Merge combina: 11 items totales
3. Code se ejecuta UNA vez con los 11 items
```

O si necesitás acceder a stock Y config por separado:

```
[Leer stock] (10 items) ──→ [Merge: Combine by Position] ──→ [Code]
[Leer config] (1 item)  ──→ [Merge: Combine by Position]

Resultado del Merge: items con campos de ambas fuentes combinados
```

## Acceso a datos entre nodos

### $json — datos del item actual
```javascript
{{ $json.name }}        // Campo del item actual
{{ $json.stock }}       // Otro campo
{{ $json["campo con espacios"] }}  // Campo con caracteres especiales
```

### $input — datos del nodo inmediato anterior
```javascript
{{ $input.first().json.name }}   // Primer item del input
{{ $input.last().json.name }}    // Último item del input
{{ $input.all() }}                // Todos los items (en Code node)
{{ $input.item.json.name }}       // Item actual (en Run Once for Each Item)
```

### $node["nombre"] — datos de un nodo específico
```javascript
{{ $node["Leer stock"].json.stock }}           // Primer item de ese nodo
{{ $node["Leer stock"].first().json.stock }}   // Primer item explícito
```

**ADVERTENCIA**: `$node["nombre"]` solo funciona si ese nodo está en la MISMA RAMA de ejecución. No podés acceder a datos de una rama paralela sin Merge.

## Patrones de data flow

### Patrón 1: Lineal (más simple)
```
[Trigger] → [Leer datos] → [Transformar] → [Guardar] → [Notificar]
    1 item      10 items      10 items      10 items     10 items
```
Cada nodo recibe los items del anterior.

### Patrón 2: Branching (IF/Switch)
```
[Trigger] → [Leer datos] → [IF stock > 0]
    1 item      10 items        ├── true (7 items con stock) → [Procesar]
                                └── false (3 items sin stock) → [Alertar]
```
El IF divide los items según la condición. Cada rama recibe SOLO los items que matchean.

### Patrón 3: Parallel + Merge
```
[Trigger] ──→ [Leer stock] (10 items) ──→ [Merge] ──→ [Procesar]
          ──→ [Leer config] (1 item)  ──→ [Merge]
```
El trigger dispara ambas ramas. El Merge espera ambas y combina.

### Patrón 4: Loop (Split in Batches)
```
[Leer datos] → [Split in Batches (3)] → [HTTP Request] → [Loop back]
  100 items        3 items por batch       3 items          ↑ repite
```
Procesa en lotes de 3 hasta terminar los 100.

### Patrón 5: Aggregation (reducir items)
```
[Leer datos] → [Code: Sumarizar]
  100 items        1 item (con totales)
```

### Patrón 6: Expansion (multiplicar items)
```
[Leer pedidos] → [Item Lists: Split Out Items (campo: items)]
  5 pedidos          15 líneas de pedido (3 items promedio por pedido)
```

## Errores comunes de data flow

### Error 1: "El nodo no recibe datos"
**Causa**: El nodo no está conectado, o está en una rama que no se ejecuta.
**Fix**: Verificar conexiones y condiciones de IF/Switch.

### Error 2: "Se ejecuta más veces de lo esperado"
**Causa**: Múltiples inputs sin Merge (fan-in directo).
**Fix**: Agregar Merge node entre las fuentes y el destino.

### Error 3: "Los datos están vacíos"
**Causa**: El nodo anterior no produjo items (condición IF falló para todos).
**Fix**: Contemplar el caso de 0 items con un IF que verifique.

### Error 4: "Solo procesa el primer item"
**Causa**: Se usa `$json` en un contexto que solo evalúa el primero.
**Fix**: En Code node, usar `$input.all()` para acceder a todos.

### Error 5: "Datos duplicados"
**Causa**: Fan-out no intencional (1 nodo → 2 destinos que convergen después).
**Fix**: Revisar que las conexiones fan-out sean intencionales.

### Error 6: "$node['X'] devuelve undefined"
**Causa**: El nodo referenciado está en otra rama paralela.
**Fix**: Usar Merge para traer datos de ramas paralelas al mismo flujo.

## Regla de oro del data flow

> **Antes de generar un workflow, trazar mentalmente cuántos items produce y recibe cada nodo. Si un nodo recibe items de 2+ fuentes sin Merge, el workflow tiene un bug.**

### Plantilla mental para cada nodo:
```
[Nombre del nodo]
  Input: N items de [nodo anterior]
  Proceso: [qué hace con cada item]
  Output: M items hacia [nodo siguiente]
```
