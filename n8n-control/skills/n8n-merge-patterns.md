---
name: n8n-merge-patterns
description: >
  Guía completa del nodo Merge en n8n v3: modos, patrones de uso, y cuándo usar 
  cada tipo de merge. El Merge es el nodo más mal entendido y más frecuentemente 
  omitido al generar workflows. Sin un Merge correcto, los datos de ramas 
  paralelas nunca se combinan y el workflow falla silenciosamente. Activar 
  SIEMPRE que un workflow tenga ramas paralelas, lecturas múltiples, o 
  reconvergencia después de IF/Switch. Activar cuando el usuario mencione:
  merge, combinar datos, unir ramas, juntar datos, "no se combinan", join,
  append, reconverger, "después del IF quiero que sigan juntos", o cualquier
  escenario donde datos de 2+ fuentes deben confluir en un punto.
---

# n8n Merge Patterns

## El Merge node v3

El Merge node tiene 2 inputs (Input 1 e Input 2) y combina sus datos según el modo elegido.

### IMPORTANTE: Cómo conectar al Merge

```json
{
  "connections": {
    "Fuente A": {
      "main": [[{ "node": "Merge", "type": "main", "index": 0 }]]
    },
    "Fuente B": {
      "main": [[{ "node": "Merge", "type": "main", "index": 1 }]]
    }
  }
}
```

- **index: 0** = Input 1 (arriba en el canvas)
- **index: 1** = Input 2 (abajo en el canvas)

**ERROR COMÚN**: Conectar ambas fuentes al `index: 0`. Esto causa ejecución doble.

## Modos del Merge

### 1. Append

Concatena todos los items de ambos inputs en una sola lista.

```
Input 1: [{a: 1}, {a: 2}]
Input 2: [{b: 3}, {b: 4}]
Output:  [{a: 1}, {a: 2}, {b: 3}, {b: 4}]
```

**Cuándo usar**: 
- Juntar registros del mismo tipo de diferentes fuentes
- Combinar resultados de ramas IF/Switch (si los datos tienen la misma estructura)

```json
{
  "parameters": {
    "mode": "append"
  },
  "type": "n8n-nodes-base.merge",
  "typeVersion": 3
}
```

### 2. Combine → Merge by Position

Combina item 0 de Input 1 con item 0 de Input 2, item 1 con item 1, etc.

```
Input 1: [{name: "Tornillo"}, {name: "Clavo"}]
Input 2: [{price: 10}, {price: 5}]
Output:  [{name: "Tornillo", price: 10}, {name: "Clavo", price: 5}]
```

**Cuándo usar**:
- Las dos fuentes tienen la misma cantidad de items en el mismo orden
- Una lectura trae campos A y otra trae campos B del mismo registro

```json
{
  "parameters": {
    "mode": "combine",
    "combinationMode": "mergeByPosition",
    "options": {}
  },
  "type": "n8n-nodes-base.merge",
  "typeVersion": 3
}
```

### 3. Combine → Merge by Fields (JOIN)

Como un SQL JOIN: combina items que tienen el mismo valor en un campo clave.

```
Input 1: [{id: 1, name: "Tornillo"}, {id: 2, name: "Clavo"}]
Input 2: [{id: 1, stock: 100}, {id: 2, stock: 50}]
Output:  [{id: 1, name: "Tornillo", stock: 100}, {id: 2, name: "Clavo", stock: 50}]
```

**Cuándo usar**:
- Datos de diferentes fuentes que comparten un campo clave (id, email, sku)
- Enriquecer datos de una fuente con datos de otra

```json
{
  "parameters": {
    "mode": "combine",
    "combinationMode": "mergeByFields",
    "mergeByFields": {
      "values": [
        {
          "field1": "id",
          "field2": "id"
        }
      ]
    },
    "joinMode": "keepMatches",
    "options": {}
  },
  "type": "n8n-nodes-base.merge",
  "typeVersion": 3
}
```

**joinMode opciones**:
- `"keepMatches"` — Solo items que matchean en ambos (INNER JOIN)
- `"keepNonMatches"` — Solo items que NO matchean (anti-join)
- `"keepEverything"` — Todos los items (OUTER JOIN)
- `"enrichInput1"` — Todos de Input 1, enriquecidos con matches de Input 2 (LEFT JOIN)
- `"enrichInput2"` — Todos de Input 2, enriquecidos con matches de Input 1 (RIGHT JOIN)

### 4. Combine → Multiplex

Producto cartesiano: cada item de Input 1 con cada item de Input 2.

```
Input 1: [{color: "rojo"}, {color: "azul"}]
Input 2: [{size: "S"}, {size: "M"}]
Output:  [{color: "rojo", size: "S"}, {color: "rojo", size: "M"}, 
          {color: "azul", size: "S"}, {color: "azul", size: "M"}]
```

**Cuándo usar**:
- Generar todas las combinaciones posibles
- Raro en workflows normales

```json
{
  "parameters": {
    "mode": "combine",
    "combinationMode": "multiplex",
    "options": {}
  },
  "type": "n8n-nodes-base.merge",
  "typeVersion": 3
}
```

### 5. Choose Branch

No combina datos. Elige QUÉ RAMA de datos usar.

```
Input 1: [{name: "de rama A"}]
Input 2: [{name: "de rama B"}]
Output:  [{name: "de rama A"}]  ← si se configura para elegir Input 1
```

**Cuándo usar**:
- Reconverger después de un IF cuando cada rama produce datos diferentes
- "Si condición → usar datos de A, sino → usar datos de B"

```json
{
  "parameters": {
    "mode": "chooseBranch",
    "output": "input1"
  },
  "type": "n8n-nodes-base.merge",
  "typeVersion": 3
}
```

**output opciones**:
- `"input1"` — Usar datos de Input 1
- `"input2"` — Usar datos de Input 2
- `"empty"` — No pasar datos (útil para sincronización)

## Patrones comunes

### Patrón 1: Lectura paralela + procesamiento

Leer datos de 2 fuentes y combinarlos para procesamiento.

```
[Trigger] ──→ [Leer Google Sheets: Stock] ──→ [Merge: Append] ──→ [Code: Procesar]
          ──→ [Leer Google Sheets: Config] ──→ [Merge: Append]
```

### Patrón 2: Enriquecimiento de datos

Tomar datos base y enriquecerlos con datos de otra fuente.

```
[Leer pedidos] ──→ [Merge: Join por cliente_id] ──→ [Set: Formatear]
[Leer clientes] ──→ [Merge: Join por cliente_id]
```

### Patrón 3: Reconvergencia post-IF

Después de un IF, las ramas vuelven a unirse.

```
[IF: ¿Stock OK?] ──true──→  [Set: Status = "disponible"] ──→ [Merge: Choose Branch] ──→ [Guardar]
                  ──false──→ [Set: Status = "agotado"]    ──→ [Merge: Choose Branch]
```

**NOTA**: Si las ramas hacen cosas completamente diferentes y no necesitan reconverger, NO necesitás Merge. Solo si después hay un paso común.

### Patrón 4: Datos maestros + transacciones

Combinar datos maestros (config, BOM) con datos de transacción.

```
[Execute Workflow Trigger] ──→ [Leer BOM formulas] ──→ [Merge: By Fields] ──→ [Calcular]
                           ──→ [Leer stock actual] ──→ [Merge: By Fields]
```

## Cuándo NO usar Merge

- **Fan-out intencional**: 1 nodo → 2 destinos diferentes que no reconvergen
- **Ramas independientes**: IF true → Guardar en A; IF false → Guardar en B (cada una termina ahí)
- **Secuencia lineal**: Nodo A → Nodo B → Nodo C (no hay paralismo)

## Tabla de decisión rápida

| Situación | Modo de Merge |
|-----------|--------------|
| 2 fuentes con los mismos campos, quiero todos los registros | **Append** |
| 2 fuentes con campos distintos, misma cantidad y orden | **Merge by Position** |
| 2 fuentes con campo clave común (JOIN) | **Merge by Fields** |
| Reconverger después de IF/Switch | **Choose Branch** |
| Todas las combinaciones posibles de 2 listas | **Multiplex** |
| Una fuente enriquecida con datos de otra | **Merge by Fields** (enrichInput1) |
