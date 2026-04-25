---
name: n8n-utility-nodes
description: >
  Nodos utilitarios de n8n: NoOp (No Operation), Stop and Error, 
  Execute Command, Convert to File, Read Binary File, Date & Time,
  Crypto, y otros nodos de soporte. Activar cuando se necesite un nodo 
  de utilidad que no sea transformación de datos principal.
---

# n8n Utility Nodes

## NoOp (No Operation)

Punto de convergencia que no hace nada con los datos. Útil para limpiar el flujo visual.

```json
{
  "parameters": {},
  "type": "n8n-nodes-base.noOp",
  "typeVersion": 1,
  "name": "Convergir ramas"
}
```

**Uso**: Cuando múltiples ramas terminan y querés un punto visual de "fin" sin procesamiento.

**IMPORTANTE**: Si 2+ nodos conectan a un NoOp, se ejecuta una vez por cada input (igual que cualquier otro nodo). NO combina datos — para eso usar Merge.

## Stop and Error

Detiene el workflow con un error explícito:

```json
{
  "parameters": {
    "errorMessage": "Error crítico: stock negativo detectado para {{ $json.insumo }}"
  },
  "type": "n8n-nodes-base.stopAndError",
  "typeVersion": 1,
  "name": "Error: stock negativo"
}
```

**Uso**: Cuando una condición irrecuperable se detecta y el workflow DEBE parar.

## Date & Time (v2.2)

Transformar fechas sin Code node:

```json
{
  "parameters": {
    "operation": "formatDate",
    "date": "={{ $json.fecha }}",
    "format": "dd/MM/yyyy HH:mm",
    "options": {
      "timezone": "America/Argentina/Buenos_Aires"
    }
  },
  "type": "n8n-nodes-base.dateTime",
  "typeVersion": 2.2,
  "name": "Formatear fecha"
}
```

Operaciones: `formatDate`, `addToDate`, `subtractFromDate`, `getTimeBetweenDates`, `extractDate`

## Crypto

Para generar hashes, UUIDs:

```json
{
  "parameters": {
    "action": "generate",
    "type": "uuid"
  },
  "type": "n8n-nodes-base.crypto",
  "typeVersion": 1,
  "name": "Generar UUID"
}
```

## Resumen: cuándo usar cada utilidad

| Necesidad | Nodo |
|-----------|------|
| Punto de convergencia visual | NoOp |
| Parar workflow con error | Stop and Error |
| Formatear/manipular fechas | Date & Time |
| Generar UUID o hash | Crypto |
| Esperar tiempo | Wait |
| No hacer nada en rama false | NoOp o simplemente no conectar |
