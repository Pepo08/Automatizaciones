---
name: n8n-subflow-design
description: >
  Patrones para diseñar subflows (Execute Workflow) en n8n: cómo pasar datos 
  al subflow, cómo retornar resultados, cuándo extraer lógica a un subflow,
  y errores comunes. Activar cuando el usuario mencione: subflow, execute workflow,
  sub-workflow, "llamar a otro workflow", workflow reutilizable, workflow hijo,
  "extraer lógica", modularizar, o cuando un workflow tenga lógica que se 
  reutiliza en múltiples lugares.
---

# n8n Subflow Design

## Anatomía de un subflow

### Workflow principal (caller)
```
[Trigger] → [Preparar datos] → [Execute Workflow] → [Usar resultado]
```

### Subflow (callee)
```
[Execute Workflow Trigger] → [Procesar] → [Return resultado]
```

## Cómo pasar datos al subflow

El nodo `Execute Workflow` pasa los items de su input al subflow. El subflow los recibe en su trigger.

### En el workflow principal:
```json
{
  "parameters": {
    "source": "database",
    "workflowId": "ID_DEL_SUBFLOW",
    "options": {}
  },
  "type": "n8n-nodes-base.executeWorkflow",
  "typeVersion": 1
}
```

### En el subflow:
```json
{
  "parameters": {},
  "type": "n8n-nodes-base.executeWorkflowTrigger",
  "typeVersion": 1.1
}
```

Los items que entran al Execute Workflow llegan al Execute Workflow Trigger del subflow.

## Cómo retornar datos del subflow

El último nodo del subflow que produce output devuelve esos datos al workflow principal. El Execute Workflow node recibe los items de retorno y los pasa al siguiente nodo.

```
PRINCIPAL:  ... → [Execute Workflow] → [Set: usar resultado] → ...
                       ↕ (datos van y vienen)
SUBFLOW:   [Trigger] → [Procesar] → [Set: resultado final]
                                     ↑ este output se devuelve al principal
```

## Patrones de subflow

### 1. Cálculo reutilizable

```
SUBFLOW "Calcular materiales BOM":
[Trigger] → [Leer fórmulas BOM] → [Leer stock] → [Merge] → [Code: Calcular] → [Output]

Se llama desde:
- Workflow de pedidos (para saber si hay stock)
- Workflow de compras (para saber qué comprar)
- Workflow de reportes (para proyecciones)
```

### 2. Notificación estándar

```
SUBFLOW "Enviar alerta":
[Trigger] → [Formatear mensaje] → [IF: canal] 
  → email → [Gmail]
  → slack → [Slack]
  → telegram → [Telegram]

Se llama desde cualquier workflow que necesite alertar.
Input esperado: { mensaje, nivel, canal }
```

### 3. Validación de datos

```
SUBFLOW "Validar entrada":
[Trigger] → [Code: Validar campos] → [IF: válido?]
  → true → [Return: { valid: true, data: parsedData }]
  → false → [Return: { valid: false, error: "mensaje" }]
```

## Cuándo extraer a subflow

✅ **Sí extraer cuando**:
- La misma lógica se usa en 2+ workflows
- Un bloque de 8+ nodos encapsula una función clara
- La lógica es un "servicio" independiente (calcular, validar, notificar)

❌ **No extraer cuando**:
- Solo se usa en 1 lugar
- Son menos de 5 nodos
- Agrega complejidad sin beneficio real
- Los datos son difíciles de serializar entre workflows

## Errores comunes

### 1. No configurar callerPolicy
El subflow debe permitir ser llamado. En settings del subflow:
```json
{
  "settings": {
    "callerPolicy": "workflowsFromSameOwner"
  }
}
```

### 2. Esperar datos que no llegan
El subflow solo recibe lo que el Execute Workflow le pasa. Si necesitás datos adicionales, prepararlos ANTES del Execute Workflow en el principal.

### 3. No manejar errores del subflow
Si el subflow falla, el Execute Workflow falla. Configurar `onError` en el Execute Workflow node.

## Checklist de subflow

- [ ] ¿El subflow tiene Execute Workflow Trigger (no Webhook ni Manual)?
- [ ] ¿El caller prepara los datos que el subflow necesita?
- [ ] ¿El subflow retorna datos en el formato que el caller espera?
- [ ] ¿El callerPolicy permite la invocación?
- [ ] ¿Hay error handling en el Execute Workflow node del caller?
- [ ] ¿El subflow es realmente reutilizable (se usa en 2+ lugares)?
