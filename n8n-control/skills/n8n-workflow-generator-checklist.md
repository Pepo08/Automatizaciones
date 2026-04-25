---
name: n8n-workflow-generator-checklist
description: >
  Checklist maestro y proceso obligatorio para generar cualquier workflow de n8n.
  ESTA SKILL SE ACTIVA ANTES QUE TODAS LAS DEMÁS cuando se va a generar un 
  workflow JSON para n8n. Define el proceso paso a paso: primero arquitectura,
  luego diseño de conexiones, luego JSON, luego validación. Evita los errores
  más comunes: demasiados workflows, conexiones sin merge, JSONs con estructura
  inválida. ACTIVAR SIEMPRE, SIN EXCEPCIÓN, cuando se vaya a generar un 
  workflow de n8n completo. Activar cuando el usuario pida: generar workflow,
  crear flujo, armar automatización, "haceme un workflow", "automatizá esto",
  o cualquier pedido que resulte en la generación de un JSON de workflow n8n.
  Esta skill es el punto de entrada obligatorio para toda generación de workflows.
---

# n8n Workflow Generator — Checklist Maestro

## Proceso obligatorio (seguir EN ORDEN)

### PASO 1: Entender el pedido
- ¿Qué quiere automatizar el usuario?
- ¿Qué sistemas están involucrados?
- ¿Cuáles son los triggers?
- ¿Cuál es el output esperado?

### PASO 2: Definir arquitectura (ANTES de generar JSON)
Consultar skill: **n8n-workflow-architecture**

- ¿Cuántos workflows necesito? (mínimo posible)
- ¿Hay lógica reutilizable para subflows?
- **PRESENTAR LA ARQUITECTURA AL USUARIO Y ESPERAR CONFIRMACIÓN**

```
Ejemplo de propuesta:
"Propongo 2 workflows:
1. Bot principal (Telegram trigger) — compras, consumo, consultas
2. Reporte semanal (Cron lunes 8am) — métricas por email
¿Está bien?"
```

### PASO 3: Diseñar el data flow de cada workflow
Consultar skill: **n8n-data-flow-engine**

Para cada workflow, trazar:
```
[Nodo] → produce N items → [Nodo] → produce M items → ...
```

Verificar:
- ¿Algún nodo recibe de 2+ fuentes? → Necesita Merge
- ¿Las ramas IF/Switch reconvergen? → Necesitan Merge Choose Branch
- ¿Hay lecturas paralelas? → Necesitan Merge antes de procesamiento

### PASO 4: Diseñar las conexiones
Consultar skill: **n8n-connection-rules**

Verificar para CADA nodo:
- ¿Cuántos inputs recibe?
- Si recibe 2+, ¿hay un Merge con los index correctos (0 y 1)?
- ¿Los outputs van a los destinos correctos?
- ¿Los IF/Switch tienen todas sus ramas conectadas?

### PASO 5: Elegir el tipo de Merge correcto
Consultar skill: **n8n-merge-patterns**

Para cada Merge en el workflow:
- ¿Qué tipo de combinación necesito?
- ¿Append, Join by Fields, By Position, Choose Branch?
- ¿Los index son 0 y 1 (no ambos 0)?

### PASO 6: Generar el JSON
Consultar skill: **n8n-json-structure**

- Usar los typeVersion correctos
- UUIDs únicos para cada nodo
- Nombres descriptivos (no "Set", "IF", "Code")
- Posicionamiento visual correcto
- executionOrder: "v1"

### PASO 7: Agregar sticky notes y layout
Consultar skill: **n8n-sticky-notes-layout**

- Sticky notes para cada sección
- Colores correctos
- Nombres descriptivos en todos los nodos

### PASO 8: Validar el JSON generado
Consultar skill: **n8n-validation-expert**

Verificación final:
- [ ] Todos los nodos referenciados en connections existen en nodes
- [ ] No hay fan-in sin Merge
- [ ] Los Merge tienen index 0 y 1
- [ ] Los typeVersion son correctos
- [ ] Las credenciales tienen la estructura correcta
- [ ] El JSON es válido (parseable)

## Reglas que NUNCA violar

### 1. NUNCA generar JSON sin proponer arquitectura primero
El usuario debe confirmar cuántos workflows se van a generar.

### 2. NUNCA conectar 2+ nodos al mismo destino sin Merge
Esto causa ejecución múltiple. SIEMPRE poner Merge en el medio.

### 3. NUNCA generar más workflows de los necesarios
Regla: si comparten trigger, van en el mismo workflow.

### 4. NUNCA dejar nodos con nombres genéricos
"Code", "Set", "IF", "HTTP Request" → PROHIBIDO. 
Siempre: "Calcular materiales", "Preparar datos para Sheets", "¿Es compra?", etc.

### 5. NUNCA omitir sticky notes en workflows de 8+ nodos
Las secciones deben estar visualmente marcadas.

### 6. NUNCA usar Code node si un nodo nativo lo resuelve
Consultar skill: **n8n-native-first**

### 7. NUNCA generar JSON sin verificar la estructura de connections
Los errores más difíciles de debuggear están en las connections.

## Template mental para cada workflow

Antes de escribir el JSON, completar esta plantilla mental:

```
WORKFLOW: [nombre]
TRIGGER: [tipo y configuración]
SECCIONES:
  1. [ENTRADA]: [nodos]
  2. [VALIDACIÓN]: [nodos]  
  3. [PROCESAMIENTO]: [nodos, incluyendo Merges necesarios]
  4. [OUTPUT]: [nodos]

CONEXIONES CRÍTICAS:
  - [Nodo A] →(output 0)→ [Nodo B] (index 0)
  - [Nodo C] →(output 0)→ [Merge] (index 0)
  - [Nodo D] →(output 0)→ [Merge] (index 1)
  - [Merge] →(output 0)→ [Nodo E] (index 0)

DATA FLOW:
  - Trigger produce 1 item
  - Leer datos produce N items
  - Merge combina N+M items
  - Procesamiento produce N items modificados
```

## Orden de lectura de skills al generar un workflow

```
1. n8n-workflow-generator-checklist  ← ESTA (siempre primera)
2. n8n-workflow-architecture         ← cuántos workflows
3. n8n-data-flow-engine              ← cómo fluyen los datos
4. n8n-connection-rules              ← reglas de conexión
5. n8n-merge-patterns                ← si hay ramas paralelas
6. n8n-native-first                  ← priorizar nodos nativos
7. n8n-json-structure                ← estructura del JSON
8. n8n-sticky-notes-layout           ← organización visual
9. n8n-subflow-design                ← si hay subflows
10. n8n-validation-expert            ← validar al final
```
