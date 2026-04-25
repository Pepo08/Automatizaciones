---
name: n8n-json-structure
description: >
  Especificación técnica del formato JSON de workflows de n8n. Define la estructura
  exacta de nodes, connections, settings, y pinData. OBLIGATORIA cuando se genera
  un JSON de workflow para importar en n8n. Sin esta skill, los JSONs generados
  tienen errores de estructura que impiden la importación o causan comportamiento 
  inesperado. Activar SIEMPRE que se genere un archivo .json de workflow para n8n,
  se edite un workflow existente, se debuggee un JSON que no importa, o se 
  construya un workflow programáticamente. Activar cuando el usuario mencione:
  JSON de n8n, exportar workflow, importar workflow, "no me importa", "tiene 
  errores el json", estructura del workflow, generar workflow, crear workflow json.
---

# n8n JSON Structure

## Estructura base de un workflow

```json
{
  "name": "Nombre del workflow",
  "nodes": [],
  "connections": {},
  "settings": {
    "executionOrder": "v1"
  },
  "pinData": {}
}
```

## Estructura de un nodo

```json
{
  "parameters": {},
  "id": "uuid-unico",
  "name": "Nombre descriptivo del nodo",
  "type": "n8n-nodes-base.tipoDeNodo",
  "typeVersion": 1,
  "position": [x, y]
}
```

### Campos obligatorios
- **id**: UUID único (formato: `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`)
- **name**: Nombre único dentro del workflow (se usa para referenciar en connections)
- **type**: Tipo del nodo (ej: `n8n-nodes-base.set`, `n8n-nodes-base.if`)
- **typeVersion**: Versión del nodo (IMPORTANTE: varía por nodo, usar la versión correcta)
- **position**: Array [x, y] para ubicación visual en el canvas

### Campos opcionales
- **parameters**: Configuración específica del nodo
- **credentials**: Referencia a credenciales guardadas
- **onError**: Manejo de errores (`"stopWorkflow"`, `"continueRegularOutput"`, `"continueErrorOutput"`)

## Versiones de nodos comunes (typeVersion)

| Nodo | typeVersion actual | Notas |
|------|-------------------|-------|
| Webhook | 2 | v2 soporta opciones avanzadas |
| Set | 3.4 | v3+ usa modo "Manual Mapping" por defecto |
| IF | 2.2 | v2+ usa conditions con rules |
| Switch | 3.2 | v3+ usa conditions con rules |
| Code | 2 | v2 soporta Python |
| Merge | 3 | v3 tiene modos mejorados |
| Google Sheets | 4.5 | v4+ usa nueva API |
| HTTP Request | 4.2 | v4+ tiene mejor UI |
| Telegram | 1.2 | |
| Gmail | 2.1 | |
| Execute Workflow | 1 | Para subflows |
| Execute Workflow Trigger | 1.1 | Trigger de subflow |
| Schedule Trigger | 1.2 | Cron trigger |
| Filter | 2.2 | Similar a IF pero solo pasa/no pasa |
| Item Lists | 3.1 | Sort, limit, split, deduplicate |
| Date & Time | 2.2 | |

## Estructura de connections

### Concepto clave
Las connections se definen DESDE el nodo origen, NO desde el destino.

```json
{
  "connections": {
    "Nombre nodo origen": {
      "main": [
        [
          { "node": "Nombre nodo destino", "type": "main", "index": 0 }
        ]
      ]
    }
  }
}
```

### main[N] = Output N del nodo origen

```json
{
  "connections": {
    "Mi nodo IF": {
      "main": [
        [
          { "node": "Rama true", "type": "main", "index": 0 }
        ],
        [
          { "node": "Rama false", "type": "main", "index": 0 }
        ]
      ]
    }
  }
}
```

- `main[0]` = Output 0 (true en IF, primer caso en Switch)
- `main[1]` = Output 1 (false en IF, segundo caso en Switch)

### index = Input N del nodo destino

Para la mayoría de nodos, `index` es siempre `0` (solo tienen 1 input).

**Excepción: Merge node** — tiene 2 inputs:
```json
{
  "connections": {
    "Fuente A": {
      "main": [[{ "node": "Merge datos", "type": "main", "index": 0 }]]
    },
    "Fuente B": {
      "main": [[{ "node": "Merge datos", "type": "main", "index": 1 }]]
    }
  }
}
```

### Fan-out: 1 nodo → múltiples destinos

```json
{
  "connections": {
    "Set datos": {
      "main": [
        [
          { "node": "Google Sheets", "type": "main", "index": 0 },
          { "node": "Slack notif", "type": "main", "index": 0 },
          { "node": "Gmail", "type": "main", "index": 0 }
        ]
      ]
    }
  }
}
```

Notar: múltiples destinos van DENTRO del mismo array `main[0]`.

## Configuración de nodos específicos

### Trigger: Webhook
```json
{
  "parameters": {
    "path": "mi-webhook-path",
    "httpMethod": "POST",
    "responseMode": "responseNode",
    "options": {}
  },
  "type": "n8n-nodes-base.webhook",
  "typeVersion": 2
}
```

### Trigger: Schedule
```json
{
  "parameters": {
    "rule": {
      "interval": [
        {
          "field": "cronExpression",
          "expression": "0 8 * * 1"
        }
      ]
    }
  },
  "type": "n8n-nodes-base.scheduleTrigger",
  "typeVersion": 1.2
}
```

### Trigger: Telegram
```json
{
  "parameters": {
    "updates": ["message", "callback_query"],
    "additionalFields": {}
  },
  "type": "n8n-nodes-base.telegramTrigger",
  "typeVersion": 1.1,
  "credentials": {
    "telegramApi": {
      "id": "CREDENTIAL_ID",
      "name": "Telegram Bot"
    }
  }
}
```

### Trigger: Execute Workflow (subflow)
```json
{
  "parameters": {},
  "type": "n8n-nodes-base.executeWorkflowTrigger",
  "typeVersion": 1.1
}
```

### Set node (v3.4)
```json
{
  "parameters": {
    "mode": "manual",
    "duplicateItem": false,
    "assignments": {
      "assignments": [
        {
          "id": "uuid",
          "name": "campo_destino",
          "value": "={{ $json.campo_origen }}",
          "type": "string"
        }
      ]
    },
    "options": {}
  },
  "type": "n8n-nodes-base.set",
  "typeVersion": 3.4
}
```

### IF node (v2.2)
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
          "id": "uuid",
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
  "typeVersion": 2.2
}
```

### Switch node (v3.2)
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
                "id": "uuid",
                "leftValue": "={{ $json.command }}",
                "rightValue": "compra",
                "operator": {
                  "type": "string",
                  "operation": "equals"
                }
              }
            ],
            "combinator": "and"
          },
          "renameOutput": true,
          "outputKey": "compra"
        }
      ]
    },
    "options": {
      "fallbackOutput": "extra"
    }
  },
  "type": "n8n-nodes-base.switch",
  "typeVersion": 3.2
}
```

### Merge node (v3)
```json
{
  "parameters": {
    "mode": "combine",
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

#### Modos del Merge v3:
- `"mode": "append"` — concatena items de ambos inputs
- `"mode": "combine"` + `"combinationMode": "mergeByPosition"` — merge por posición
- `"mode": "combine"` + `"combinationMode": "mergeByFields"` — merge por campo clave
- `"mode": "combine"` + `"combinationMode": "multiplex"` — producto cartesiano
- `"mode": "chooseBranch"` — elige qué rama usar

### Code node (v2)
```json
{
  "parameters": {
    "jsCode": "// JavaScript code here\nreturn items;",
    "mode": "runOnceForAllItems"
  },
  "type": "n8n-nodes-base.code",
  "typeVersion": 2
}
```

### Google Sheets (v4.5)
```json
{
  "parameters": {
    "operation": "read",
    "documentId": {
      "__rl": true,
      "value": "SPREADSHEET_ID",
      "mode": "id"
    },
    "sheetName": {
      "__rl": true,
      "value": "Nombre de la hoja",
      "mode": "name"
    },
    "options": {}
  },
  "type": "n8n-nodes-base.googleSheets",
  "typeVersion": 4.5,
  "credentials": {
    "googleSheetsOAuth2Api": {
      "id": "CREDENTIAL_ID",
      "name": "Google Sheets"
    }
  }
}
```

### Execute Workflow (llamar subflow)
```json
{
  "parameters": {
    "source": "database",
    "workflowId": "WORKFLOW_ID",
    "options": {}
  },
  "type": "n8n-nodes-base.executeWorkflow",
  "typeVersion": 1
}
```

## Posicionamiento visual

### Grid de posicionamiento
- n8n usa un grid donde cada "paso" horizontal es ~250px
- Cada "fila" vertical es ~160px
- Empezar el trigger en [250, 300]

### Ejemplo de layout para workflow con Switch de 3 ramas:
```
Trigger:   [250, 300]
Parse:     [500, 300]
Switch:    [750, 300]
Rama A:    [1000, 100]  [1250, 100]  [1500, 100]
Rama B:    [1000, 300]  [1250, 300]  [1500, 300]
Rama C:    [1000, 500]  [1250, 500]  [1500, 500]
```

### Reglas de layout
- Flujo de izquierda a derecha
- Ramas IF/Switch se abren verticalmente
- Merge cierra las ramas y vuelve al centro
- Dejar espacio entre ramas (mínimo 160px vertical)
- Sticky notes van fuera del flujo principal (arriba o abajo)

## Settings del workflow

```json
{
  "settings": {
    "executionOrder": "v1",
    "saveManualExecutions": true,
    "callerPolicy": "workflowsFromSameOwner",
    "errorWorkflow": "ERROR_WORKFLOW_ID"
  }
}
```

- `executionOrder: "v1"` — SIEMPRE usar v1 (execution por conexiones, no por posición)
- `callerPolicy` — para subflows, quién puede llamarlos

## Sticky Notes

```json
{
  "parameters": {
    "content": "## ENTRADA\nRecibe mensaje de Telegram y parsea el comando.",
    "height": 200,
    "width": 400,
    "color": 4
  },
  "type": "n8n-nodes-base.stickyNote",
  "typeVersion": 1,
  "position": [100, 100]
}
```

Colores: 1=amarillo, 2=verde, 3=azul, 4=rojo, 5=gris, 6=naranja, 7=violeta

## Checklist de JSON válido

- [ ] Todos los nodos tienen `id` único (UUID v4)
- [ ] Todos los nodos tienen `name` único
- [ ] Todas las connections referencian nodos que existen (por nombre exacto)
- [ ] Los `index` de Merge son 0 y 1 (no ambos 0)
- [ ] Los `typeVersion` son los correctos para cada nodo
- [ ] `executionOrder` está en `"v1"`
- [ ] Las credentials tienen la estructura `{ "id": "...", "name": "..." }`
- [ ] Las posiciones no se superponen
- [ ] Los nombres de nodos en connections coinciden EXACTAMENTE con los names en nodes
