---
name: n8n-sticky-notes-layout
description: >
  Reglas para organización visual de workflows en n8n: sticky notes para secciones,
  colores por función, posicionamiento de nodos, y layout patterns. Un workflow
  bien organizado visualmente es más fácil de debuggear, mantener y entender.
  Activar cuando se genere cualquier workflow de n8n para agregar sticky notes
  que documenten las secciones. Activar cuando el usuario mencione: organizar
  workflow, sticky notes, notas, documentar workflow, secciones, layout, 
  "no se entiende el flujo", colores, o cuando el workflow generado tenga
  más de 8 nodos.
---

# n8n Sticky Notes & Layout

## Sticky Notes: Secciones obligatorias

Todo workflow con más de 8 nodos DEBE tener sticky notes que dividan el flujo en secciones lógicas.

### Estructura estándar de secciones

```
[ENTRADA]          → [VALIDACIÓN]       → [PROCESAMIENTO]     → [OUTPUT/RESPUESTA]
Trigger + parse     Autorización, parse   Lógica de negocio     Guardar + notificar
Color: azul (3)     Color: naranja (6)    Color: verde (2)      Color: amarillo (1)
```

### JSON de una Sticky Note

```json
{
  "parameters": {
    "content": "## ENTRADA\nRecibe webhook POST y parsea los datos de entrada.",
    "height": 240,
    "width": 500,
    "color": 3
  },
  "id": "uuid-unico",
  "name": "Nota: Entrada",
  "type": "n8n-nodes-base.stickyNote",
  "typeVersion": 1,
  "position": [100, 80]
}
```

### Colores por tipo de sección

| Color | Código | Uso |
|-------|--------|-----|
| Azul | 3 | **ENTRADA** — triggers, recepción de datos |
| Naranja | 6 | **VALIDACIÓN** — auth, parsing, validación |
| Verde | 2 | **PROCESAMIENTO** — lógica de negocio, cálculos |
| Amarillo | 1 | **OUTPUT** — guardar, responder, notificar |
| Rojo | 4 | **ERROR** — manejo de errores, alertas |
| Gris | 5 | **NOTAS** — documentación, explicaciones |
| Violeta | 7 | **SUBFLOW** — llamadas a otros workflows |

### Contenido de cada Sticky Note

Formato recomendado:
```markdown
## NOMBRE DE SECCIÓN
Descripción breve de qué hace esta sección (1-2 líneas).
```

Ejemplo real:
```markdown
## COMPRA
Update stock + log. Actualiza la hoja de stock, registra el movimiento, y responde al usuario.
```

## Reglas de posicionamiento

### Grid base
```
X: cada paso horizontal = 250px
Y: cada fila vertical = 160px
Inicio del trigger: [250, 300]
```

### Layout para flujo lineal
```
Position:  [250,300]  [500,300]  [750,300]  [1000,300]  [1250,300]
Nodo:      Trigger    Parse      Validar    Procesar    Guardar
```

### Layout para IF/Switch con ramas
```
                                  [1000, 100] → [1250, 100] → [1500, 100]   ← Rama true
[250,300] → [500,300] → [750,300]
                                  [1000, 500] → [1250, 500] → [1500, 500]   ← Rama false
```

### Layout para lecturas paralelas + Merge
```
                    [500, 150] Leer A ──→ [750, 300] Merge
[250, 300] Trigger ─┤                                     ──→ [1000, 300] Procesar
                    [500, 450] Leer B ──→ [750, 300] Merge
```

### Posicionamiento de Sticky Notes

La sticky note va DETRÁS (capa Z inferior) de los nodos que cubre.

```
Sticky position: [startX - 50, startY - 80]
Sticky width: abarca todos los nodos de la sección + 100px margen
Sticky height: abarca la altura de la sección + 100px margen
```

Ejemplo para sección de ENTRADA con 2 nodos:
```
Nodo 1: [250, 300]
Nodo 2: [500, 300]
Sticky: position=[200, 220], width=500, height=240
```

## Template de workflow con sticky notes

Para un workflow estándar con 4 secciones:

```json
{
  "nodes": [
    {
      "parameters": { "content": "## ENTRADA\nWebhook POST.", "height": 240, "width": 400, "color": 3 },
      "name": "Nota: Entrada", "type": "n8n-nodes-base.stickyNote", "typeVersion": 1,
      "position": [100, 180]
    },
    {
      "parameters": { "content": "## VALIDACIÓN\nPIN + parsing.", "height": 240, "width": 400, "color": 6 },
      "name": "Nota: Validación", "type": "n8n-nodes-base.stickyNote", "typeVersion": 1,
      "position": [550, 180]
    },
    {
      "parameters": { "content": "## PROCESAMIENTO\nLógica de negocio.", "height": 400, "width": 600, "color": 2 },
      "name": "Nota: Procesamiento", "type": "n8n-nodes-base.stickyNote", "typeVersion": 1,
      "position": [1000, 80]
    },
    {
      "parameters": { "content": "## OUTPUT\nGuardar y responder.", "height": 400, "width": 500, "color": 1 },
      "name": "Nota: Output", "type": "n8n-nodes-base.stickyNote", "typeVersion": 1,
      "position": [1650, 80]
    }
  ]
}
```

## Reglas de nombrado de nodos (refuerzo)

Cada nodo DEBE tener un nombre que responda: "¿Qué hace este nodo?"

```
✅ Bueno:
- "Recibir webhook formulario"
- "Validar PIN y parsear"
- "¿Es compra?"
- "Actualizar stock en Sheets"
- "Enviar respuesta OK"
- "Combinar stock + config"

❌ Malo:
- "Webhook"
- "Code"
- "IF"
- "Set"
- "Merge"
- "HTTP Request"
```

## Checklist visual antes de entregar un workflow

- [ ] ¿Cada sección tiene una Sticky Note con título y descripción?
- [ ] ¿Los colores de las sticky notes corresponden al tipo de sección?
- [ ] ¿Los nodos fluyen de izquierda a derecha?
- [ ] ¿Las ramas IF/Switch se abren verticalmente sin cruzarse?
- [ ] ¿Hay suficiente espacio entre secciones para legibilidad?
- [ ] ¿Todos los nodos tienen nombres descriptivos?
- [ ] ¿No hay nodos superpuestos visualmente?
