---
name: n8n-workflow-architecture
description: >
  Reglas de arquitectura de workflows en n8n: cuándo usar 1 workflow vs múltiples,
  cuándo usar subflows (Execute Workflow), cómo dimensionar un workflow, y cómo
  estructurar proyectos complejos. El error SEGUNDO MÁS COMÚN al generar workflows
  es crear demasiados workflows separados cuando podrían ser 1 o 2, o al revés,
  meter todo en un workflow gigante cuando debería estar separado. Activar SIEMPRE
  que se diseñe un proyecto con múltiples workflows o un workflow complejo. 
  Activar cuando el usuario mencione: muchos flujos, demasiados workflows,
  "son muchos flujos", "podría ser uno solo", subflow, execute workflow,
  arquitectura, organizar workflows, proyecto grande, dividir workflow,
  separar lógica, o cuando el prompt del usuario describe funcionalidad
  que podría resolverse con menos workflows de los que el modelo planea generar.
---

# n8n Workflow Architecture

## Principio fundamental

> **Un workflow = una responsabilidad principal con un trigger claro.**
> Si dos flujos comparten el mismo trigger y datos de entrada, probablemente deberían ser uno solo.

## Cuándo usar 1 workflow

### ✅ Un solo workflow cuando:

- **Mismo trigger** — todo arranca del mismo evento (webhook, cron, mensaje Telegram)
- **Datos compartidos** — las ramas necesitan los mismos datos base
- **Flujo secuencial o con branching** — es una cadena con bifurcaciones (IF/Switch)
- **Menos de ~30 nodos** — cabe razonablemente en la pantalla

### Ejemplo: Bot de Telegram con comandos

```
UN SOLO WORKFLOW:
[Telegram Trigger] → [Parsear comando] → [Switch por comando]
  → compra  → [Procesar compra] → [Actualizar stock] → [Responder]
  → consumo → [Procesar consumo] → [Registrar] → [Responder]
  → stock   → [Consultar stock] → [Formatear] → [Responder]
  → ayuda   → [Generar ayuda] → [Responder]
```

NO hacer 4 workflows separados para cada comando — todos comparten el mismo trigger y la misma lógica de entrada.

## Cuándo separar en múltiples workflows

### ✅ Separar cuando:

- **Triggers diferentes** — uno es webhook, otro es cron, otro es manual
- **Responsabilidades independientes** — uno procesa pedidos, otro genera reportes
- **Reutilización** — una lógica se usa desde múltiples lugares (→ subflow)
- **Más de ~35-40 nodos** — el workflow se vuelve difícil de debuggear
- **Equipos diferentes** — personas distintas mantienen lógicas distintas

### Ejemplo: Sistema de stock completo

```
WORKFLOW 1: Bot de operaciones (Trigger: Telegram/Webhook)
  → Recibe comandos → Procesa compra/consumo/consulta → Responde

WORKFLOW 2: Alertas de stock bajo (Trigger: Cron diario o subflow)
  → Lee stock → Filtra bajo mínimo → Envía alerta email

WORKFLOW 3: Reporte semanal (Trigger: Cron lunes 8am)
  → Lee métricas → Genera HTML → Envía por email
```

Estos SÍ merecen ser 3 workflows porque tienen 3 triggers distintos y 3 responsabilidades distintas.

## Subflows (Execute Workflow)

### Qué es un subflow

Un workflow que se llama desde otro workflow usando el nodo **Execute Workflow** (o Execute Sub-Workflow). Es como una función reutilizable.

### Cuándo usar subflows

- **Lógica reutilizable** — calcular BOM de materiales, validar datos, etc.
- **Encapsular complejidad** — un cálculo complejo que ensuciaría el flujo principal
- **Separar por dominio** — lógica de negocio separada de lógica de integración

### Cuándo NO usar subflows

- **Lógica que solo se usa una vez** — meter un IF en un subflow es overkill
- **Para "organizar"** — si el workflow es legible, no separar solo por estética
- **Cuando agrega latencia** — cada subflow tiene overhead de invocación

### Patrón de subflow correcto

```
WORKFLOW PRINCIPAL (Bot):
[Telegram] → [Parsear] → [Switch]
  → compra  → [Procesar compra] → [Execute Workflow: Calcular materiales] → [Responder]
  → consulta → [Formatear stock] → [Responder]

SUBFLOW (Calcular materiales):
[Execute Workflow Trigger] → [Leer BOM] → [Leer stock] → [Merge] → [Calcular] → [Return]
```

El subflow tiene su propio trigger (`Execute Workflow Trigger`) y devuelve datos al workflow principal.

## Dimensionamiento de workflows

### Tabla de referencia

| Complejidad | Nodos | Ramas | Recomendación |
|------------|-------|-------|---------------|
| Simple | 3-8 | 1 | 1 workflow, sin subflows |
| Media | 8-20 | 2-3 | 1 workflow con IF/Switch |
| Compleja | 20-35 | 3-5 | 1 workflow + 1-2 subflows para lógica reutilizable |
| Muy compleja | 35+ | 5+ | Separar por responsabilidad/trigger en 2-3 workflows |

### Regla del "prompt único"

> Si el usuario describe todo en UN prompt, intentar resolver en 1-2 workflows máximo.
> Solo separar si hay triggers claramente distintos o si supera 35 nodos.

### Cómo decidir cuántos workflows

```
1. ¿Cuántos triggers distintos hay?
   → 1 trigger = empezar con 1 workflow
   → N triggers = N workflows candidatos

2. ¿Alguna lógica se reutiliza entre workflows?
   → Sí = extraer a subflow
   → No = dejar inline

3. ¿El workflow principal supera 35 nodos?
   → Sí = buscar lógica extraíble a subflow
   → No = mantener en 1 workflow

4. ¿Las ramas del Switch/IF son muy largas (10+ nodos)?
   → Sí = considerar subflow por rama
   → No = mantener inline
```

## Estructura de un proyecto tipo

### Ejemplo: Sistema de control de stock para mueblería

```
PROMPT del usuario: "Bot de Telegram para registrar compras de insumos, 
consumo en producción, consultar stock, alertas de stock bajo, y reporte semanal."

ARQUITECTURA CORRECTA (3 workflows):

1. bot-stock-operaciones (Trigger: Telegram)
   → Recibe mensaje → Autoriza → Switch por comando
   → compra: valida + actualiza stock + registra movimiento + responde
   → consumo: valida + genera pedido + actualiza stock + responde  
   → stock: consulta + formatea + responde
   → ayuda: genera menú + responde
   (20-25 nodos)

2. alertas-stock-bajo (Trigger: Cron diario 8am O subflow llamado post-consumo)
   → Lee stock → Filtra bajo mínimo → Genera email → Envía si hay alertas
   (6-8 nodos)

3. reporte-semanal (Trigger: Cron lunes 8am)
   → Lee stock + movimientos + pedidos → Genera HTML → Envía email
   (6-8 nodos)

TOTAL: 3 workflows, ~35 nodos total
```

### Ejemplo de arquitectura INCORRECTA (demasiados workflows):

```
❌ 5+ WORKFLOWS PARA LO MISMO:
1. bot-telegram (solo parsea y rutea)
2. procesador-compras (solo compras)
3. procesador-consumo (solo consumo) 
4. alertas-stock (alertas)
5. reporte-semanal (reporte)
6. calculador-materiales (subflow)

PROBLEMAS:
- Workflows 1, 2, 3 comparten el mismo trigger y deberían ser uno
- El "bot-telegram" hace solo routing, es overhead innecesario
- Más workflows = más cosas que mantener y más puntos de falla
```

## Comunicación con el usuario

### Antes de generar, explicar la arquitectura

Siempre ANTES de generar JSONs, presentar al usuario:

```
"Para este proyecto propongo la siguiente arquitectura:

WORKFLOW 1: [nombre] (Trigger: [tipo])
- Responsabilidad: [qué hace]
- Nodos estimados: [N]
- Ramas: [descripción breve]

WORKFLOW 2: [nombre] (Trigger: [tipo])
- Responsabilidad: [qué hace]
- Nodos estimados: [N]

SUBFLOW: [nombre] (si aplica)
- Se llama desde: [workflow X]
- Responsabilidad: [qué hace]

¿Querés que avance con esta estructura o preferís ajustar algo?"
```

### Si el usuario quiere menos workflows

Respetar la preferencia del usuario. Si dice "hacelo en 1 solo", buscar la forma de consolidar usando Switch/IF con ramas más largas. Solo advertir si realmente no es viable (ej: 2 triggers completamente distintos que no pueden compartir).

## Reglas de oro

1. **Empezar simple** — 1 workflow, agregar complejidad solo si es necesario
2. **Trigger = workflow** — cada trigger distinto justifica un workflow
3. **Subflow = función** — solo si la lógica se reutiliza o es muy compleja
4. **Comunicar antes de generar** — nunca generar 5 JSONs sin preguntar
5. **Mínimo viable** — la menor cantidad de workflows que resuelva el problema
