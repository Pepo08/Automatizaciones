---
name: n8n-connection-rules
description: >
  Reglas fundamentales de conexión entre nodos en n8n. ESTA SKILL ES OBLIGATORIA 
  en TODA generación de workflow. Define qué conexiones son válidas, cuáles rompen 
  la ejecución, y cómo resolver problemas de fan-in (múltiples nodos conectando 
  al mismo destino). El error MÁS COMÚN al generar workflows es conectar 2+ nodos 
  de output a un solo nodo de input sin un Merge intermedio — esto causa que el 
  nodo destino se ejecute N veces con datos parciales en vez de una vez con todos 
  los datos. Activar SIEMPRE que se genere, edite, diseñe o valide un workflow 
  de n8n. Activar cuando el usuario mencione: conexiones, nodos conectados, 
  "no funciona", "se ejecuta dos veces", merge, combinar datos, fan-in, 
  múltiples inputs, o cualquier problema de flujo de datos entre nodos.
---

# n8n Connection Rules

## REGLA #1: Fan-In requiere Merge (CRÍTICA)

> **Si 2+ nodos conectan al mismo nodo destino SIN un Merge en el medio, el nodo destino se ejecuta una vez POR CADA input, no una sola vez con todos los datos combinados.**

Esto es el error más frecuente al generar workflows con IA.

### ❌ INCORRECTO — Fan-in directo (se ejecuta 2 veces)

```
[Leer stock]        ──→ [Procesar datos]
[Leer configuracion] ──→ [Procesar datos]
```

**Resultado**: "Procesar datos" se ejecuta 2 veces:
- 1era ejecución: solo recibe datos de "Leer stock"
- 2da ejecución: solo recibe datos de "Leer configuracion"

### ✅ CORRECTO — Fan-in con Merge (se ejecuta 1 vez con todo)

```
[Leer stock]         ──→ [Merge: Combinar datos] ──→ [Procesar datos]
[Leer configuracion] ──→ [Merge: Combinar datos]
```

**Resultado**: "Procesar datos" se ejecuta 1 vez con datos combinados.

### Modos del Merge node relevantes

| Modo | Cuándo usar | Ejemplo |
|------|------------|---------|
| **Combine → Merge by Position** | Datos paralelos que van juntos (row 1 con row 1) | Stock + Config del mismo producto |
| **Combine → Merge by Fields** | Join por campo clave (como SQL JOIN) | Pedidos + Clientes por `cliente_id` |
| **Combine → Multiplex** | Combinar cada item de Input1 con cada item de Input2 | Productos × Colores |
| **Append** | Simplemente concatenar todos los items | Todos los registros de ambas fuentes |
| **Choose Branch** | Elegir una de las ramas (sin combinar) | Usar solo la rama que llegó primero |

## REGLA #2: Conexiones válidas de output

Cada nodo tiene outputs definidos. Las conexiones deben respetar estos outputs:

### Nodos con 1 output (main)
La mayoría de nodos: Set, Code, HTTP Request, Google Sheets, etc.
```
[Nodo] ──main──→ [Siguiente]
```

### Nodos con 2 outputs (true/false)
IF node, Filter node:
```
[IF] ──true──→  [Rama verdadera]
     ──false──→ [Rama falsa]
```

### Nodos con N outputs
Switch node (tantos outputs como condiciones + fallback):
```
[Switch] ──output0──→ [Caso A]
         ──output1──→ [Caso B]
         ──output2──→ [Caso C]
         ──fallback─→ [Default]
```

### Nodos con output de error
Cualquier nodo con `onError: "continueErrorOutput"`:
```
[Nodo] ──main──→  [Éxito]
       ──error──→ [Manejo de error]
```

## REGLA #3: Fan-out es válido (1 nodo → N destinos)

Un nodo puede conectar su output a múltiples nodos destino. Esto es válido y CADA destino recibe una COPIA de los mismos datos.

```
[Set datos] ──→ [Google Sheets: Guardar]
            ──→ [Slack: Notificar]
            ──→ [Gmail: Enviar email]
```

Los 3 destinos reciben los mismos items. Esto NO requiere Merge.

## REGLA #4: Cadena lineal — 1 transformación mínima entre lecturas paralelas y uso

Cuando leés datos de múltiples fuentes en paralelo, SIEMPRE hay un Merge antes de usarlos juntos:

```
                                        ┌──→ [Actualizar A]
[Trigger] ──→ [Leer A] ──→ [Merge] ──→ [Procesar] ──→ ...
          ──→ [Leer B] ──→ [Merge]      └──→ [Actualizar B]
```

NUNCA:
```
[Trigger] ──→ [Leer A] ──→ [Procesar]   ← se ejecuta sin datos de B
          ──→ [Leer B] ──→ [Procesar]   ← se ejecuta sin datos de A
```

## REGLA #5: Estructura de connections en el JSON

Las conexiones en el JSON de n8n siguen esta estructura:

```json
{
  "connections": {
    "Nombre del nodo origen": {
      "main": [
        [
          { "node": "Nombre del nodo destino", "type": "main", "index": 0 }
        ]
      ]
    }
  }
}
```

### Para nodos con múltiples outputs (IF, Switch):

```json
{
  "connections": {
    "Es compra?": {
      "main": [
        [
          { "node": "Procesar compra", "type": "main", "index": 0 }
        ],
        [
          { "node": "No es compra", "type": "main", "index": 0 }
        ]
      ]
    }
  }
}
```

- `main[0]` = primer output (true en IF, caso 0 en Switch)
- `main[1]` = segundo output (false en IF, caso 1 en Switch)
- `main[N]` = N-ésimo output

### Para Merge (recibe de múltiples fuentes):

El Merge recibe por diferentes inputs (`index`):

```json
{
  "connections": {
    "Leer stock": {
      "main": [
        [
          { "node": "Combinar datos", "type": "main", "index": 0 }
        ]
      ]
    },
    "Leer config": {
      "main": [
        [
          { "node": "Combinar datos", "type": "main", "index": 1 }
        ]
      ]
    }
  }
}
```

**CLAVE**: Notar el `"index": 0` vs `"index": 1` — esto indica Input 1 e Input 2 del Merge.

## REGLA #6: Nodos que SÍ aceptan múltiples inputs sin Merge

Algunos nodos están diseñados para recibir múltiples conexiones directas:

- **NoOp (No Operation)** — punto de convergencia que pasa datos sin modificar
- **Wait** — cada input reinicia o continua el wait
- **Error Trigger** — recibe errores de cualquier nodo

Pero incluso estos ejecutan una vez por cada input que llega, no combinan datos.

## Checklist de conexiones antes de generar un workflow

- [ ] ¿Hay nodos con 2+ conexiones de entrada? → Necesitan Merge
- [ ] ¿Los IF/Switch tienen todas sus ramas conectadas?
- [ ] ¿Los Merge reciben por index 0 e index 1 (no ambos por index 0)?
- [ ] ¿Los fan-out (1→N) son intencionales?
- [ ] ¿Cada nodo tiene al menos 1 conexión de entrada (excepto el trigger)?
- [ ] ¿No hay nodos sueltos/desconectados?
- [ ] ¿Las ramas que divergen (IF/Switch) se reconverguen correctamente con Merge si necesitan compartir datos después?

## Patrones comunes de conexión

### Patrón: Lectura paralela + procesamiento
```
[Trigger] ──→ [Leer fuente A] ──→ [Merge: Combinar] ──→ [Procesar]
          ──→ [Leer fuente B] ──→ [Merge: Combinar]
```

### Patrón: Branch y reconvergencia
```
[IF condición] ──true──→  [Acción A] ──→ [Merge: Choose Branch] ──→ [Siguiente paso]
               ──false──→ [Acción B] ──→ [Merge: Choose Branch]
```

### Patrón: Procesamiento con error handling
```
[Acción principal] ──main──→  [Siguiente]
                   ──error──→ [Log error] ──→ [Notificar]
```

### Patrón: Switch con múltiples ramas
```
[Switch tipo] ──caso A──→ [Procesar A] ──→ (fin de rama, o merge si reconvergen)
              ──caso B──→ [Procesar B]
              ──default─→ [Procesar default]
```

## Anti-patrones que NUNCA generar

### 1. Doble conexión al mismo input
```
❌ [Leer A] ──→ [Procesar]  (index 0)
   [Leer B] ──→ [Procesar]  (index 0)
```
Ambos conectan al mismo index 0. "Procesar" se ejecuta 2 veces.

### 2. Bypass del Merge
```
❌ [Leer A] ──→ [Merge] ──→ [Procesar]
   [Leer B] ──→ [Merge]
   [Leer B] ──→ [Procesar]  ← conexión extra que bypasea el merge
```

### 3. Reconvergencia sin Merge después de IF
```
❌ [IF] ──true──→  [Set A] ──→ [Guardar]
        ──false──→ [Set B] ──→ [Guardar]
```
"Guardar" se ejecuta 2 veces (una por rama). Usar Merge Choose Branch.

### 4. Cadena de lecturas paralelas sin combinar
```
❌ [Trigger] ──→ [Leer stock] ──→ [Leer sesion] ──→ [Procesar]
```
Si Leer stock y Leer sesion son independientes, ponerlos en paralelo con Merge.
Si Leer sesion depende de datos de Leer stock, entonces la cadena lineal es correcta.
