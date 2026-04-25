---
name: n8n-ai-agent-patterns
description: >
  Patrones para construir AI Agents en n8n con los nodos LangChain: Agent node,
  Chat Model, Tools, Memory, y Output Parsers. Cubre agentes conversacionales,
  agentes con herramientas (buscar en DB, llamar APIs, ejecutar código), y
  agentes con memoria de conversación. Activar cuando el usuario mencione:
  AI agent, agente, LangChain, OpenAI, GPT, Claude API, chat model, tools,
  memory, "bot inteligente", "que entienda lenguaje natural", NLP, 
  "agente con herramientas", function calling, o cualquier workflow que use
  LLMs para procesar o generar texto.
---

# n8n AI Agent Patterns

## Arquitectura del AI Agent en n8n

```
[Trigger] → [AI Agent]
              ├── ai_languageModel: [OpenAI Chat Model / Anthropic]
              ├── ai_tool: [Tool 1: HTTP Request]
              ├── ai_tool: [Tool 2: Database Query]
              ├── ai_tool: [Tool 3: Calculator]
              └── ai_memory: [Window Buffer Memory]
           → [Output]
```

El AI Agent node orquesta: recibe el input, decide qué herramientas usar, las ejecuta, y genera la respuesta.

## Nodos de AI disponibles en n8n

### Language Models
- `@n8n/n8n-nodes-langchain.lmChatOpenAi` — OpenAI (GPT-4o, GPT-4o-mini)
- `@n8n/n8n-nodes-langchain.lmChatAnthropic` — Anthropic (Claude)
- `@n8n/n8n-nodes-langchain.lmChatOllama` — Ollama (local)
- `@n8n/n8n-nodes-langchain.lmChatGoogleGemini` — Google Gemini

### Agent
- `@n8n/n8n-nodes-langchain.agent` — Agent principal (tools + reasoning)

### Tools (herramientas del agente)
- `@n8n/n8n-nodes-langchain.toolHttpRequest` — Llamar APIs
- `@n8n/n8n-nodes-langchain.toolCode` — Ejecutar JavaScript
- `@n8n/n8n-nodes-langchain.toolCalculator` — Matemáticas
- `@n8n/n8n-nodes-langchain.toolWikipedia` — Búsqueda Wikipedia
- `@n8n/n8n-nodes-langchain.toolWorkflow` — Ejecutar otro workflow como tool
- `@n8n/n8n-nodes-langchain.toolVectorStore` — Buscar en vector store (RAG)

### Memory
- `@n8n/n8n-nodes-langchain.memoryBufferWindow` — Últimos N mensajes
- `@n8n/n8n-nodes-langchain.memoryMotorhead` — Motorhead (external)
- `@n8n/n8n-nodes-langchain.memoryXata` — Xata
- `@n8n/n8n-nodes-langchain.memoryRedisChat` — Redis

### Output Parsers
- `@n8n/n8n-nodes-langchain.outputParserStructured` — JSON estructurado
- `@n8n/n8n-nodes-langchain.outputParserAutofixing` — Auto-corrige formato

## Patrón 1: Chatbot simple (sin tools)

```
[Telegram Trigger] → [AI Agent]
                       ├── ai_languageModel: [OpenAI GPT-4o-mini]
                       └── ai_memory: [Window Buffer (últimos 10 mensajes)]
                    → [Telegram: Send Message]
```

El agente responde usando solo su conocimiento + memoria de conversación.

## Patrón 2: Agente con herramientas

```
[Webhook] → [AI Agent]
              ├── ai_languageModel: [OpenAI GPT-4o]
              ├── ai_tool: [Buscar en Google Sheets (stock)]
              ├── ai_tool: [Calcular materiales BOM]
              ├── ai_tool: [Enviar email]
              └── ai_memory: [Window Buffer]
           → [Respond to Webhook]
```

El agente DECIDE cuándo usar cada herramienta según la pregunta del usuario.

### Tool: Buscar en Google Sheets

```json
{
  "type": "@n8n/n8n-nodes-langchain.toolWorkflow",
  "parameters": {
    "name": "Consultar stock",
    "description": "Busca el stock actual de un insumo. Input: nombre del insumo. Output: stock actual, stock mínimo, última actualización.",
    "workflowId": "ID_DEL_SUBFLOW_CONSULTA_STOCK"
  }
}
```

La `description` es CRÍTICA — el agente decide si usar el tool basándose en esta descripción.

### Tool: Código custom

```json
{
  "type": "@n8n/n8n-nodes-langchain.toolCode",
  "parameters": {
    "name": "Calcular precio con IVA",
    "description": "Calcula el precio final con IVA 21%. Input: precio base (número). Output: precio con IVA.",
    "jsCode": "const precio = parseFloat(query);\nreturn (precio * 1.21).toFixed(2);"
  }
}
```

## Patrón 3: Output estructurado

Para que el agente devuelva JSON en vez de texto libre:

```
[Input] → [AI Agent] → [Output Parser: Structured] → [Procesar JSON]
            ├── ai_languageModel: [OpenAI]
            └── ai_outputParser: [Structured Output Parser]
```

### Structured Output Parser

```json
{
  "type": "@n8n/n8n-nodes-langchain.outputParserStructured",
  "parameters": {
    "schemaType": "manual",
    "jsonSchema": "{\n  \"type\": \"object\",\n  \"properties\": {\n    \"insumo\": { \"type\": \"string\" },\n    \"cantidad\": { \"type\": \"number\" },\n    \"tipo\": { \"type\": \"string\", \"enum\": [\"compra\", \"consumo\"] }\n  },\n  \"required\": [\"insumo\", \"cantidad\", \"tipo\"]\n}"
  }
}
```

Esto le dice al agente: "tu respuesta debe ser un JSON con estos campos". Útil para parsear input del usuario en lenguaje natural.

## Patrón 4: RAG Agent (busca en documentos)

```
[Webhook: pregunta] → [AI Agent]
                        ├── ai_languageModel: [OpenAI]
                        ├── ai_tool: [Vector Store Tool (buscar documentos)]
                        └── ai_memory: [Buffer Window]
                     → [Respond]
```

El tool de Vector Store hace la búsqueda semántica y el agente genera la respuesta con el contexto.

## Conexiones especiales de AI nodes

Los nodos AI no se conectan por `main` sino por sus tipos especiales:

```json
{
  "connections": {
    "OpenAI Chat Model": {
      "ai_languageModel": [
        [{ "node": "AI Agent", "type": "ai_languageModel", "index": 0 }]
      ]
    },
    "Buscar stock tool": {
      "ai_tool": [
        [{ "node": "AI Agent", "type": "ai_tool", "index": 0 }]
      ]
    },
    "Window Buffer Memory": {
      "ai_memory": [
        [{ "node": "AI Agent", "type": "ai_memory", "index": 0 }]
      ]
    }
  }
}
```

**IMPORTANTE**: Los connections de AI nodes usan `ai_languageModel`, `ai_tool`, `ai_memory` en vez de `main`.

## System prompts efectivos

```
Sos un asistente de control de stock para una mueblería. 

REGLAS:
- Solo respondés sobre temas de stock, compras, consumo y producción
- Si no sabés algo, usá la herramienta de consulta de stock
- Respondé en español, de forma concisa
- Si el usuario pide registrar una compra o consumo, confirmá los datos antes de ejecutar
- Siempre incluí emojis relevantes en las respuestas

HERRAMIENTAS DISPONIBLES:
- Consultar stock: busca stock actual de un insumo
- Calcular materiales: calcula materiales necesarios para un producto
- Registrar movimiento: registra una compra o consumo
```

## Costos estimados

| Modelo | Costo input | Costo output | Uso típico por query |
|--------|------------|-------------|---------------------|
| GPT-4o-mini | $0.15/1M | $0.60/1M | ~$0.001 por query |
| GPT-4o | $2.50/1M | $10/1M | ~$0.01 por query |
| Claude Sonnet | $3/1M | $15/1M | ~$0.015 por query |

Para un bot con ~100 queries/día con GPT-4o-mini: ~$3/mes.

## Checklist AI Agent

- [ ] ¿El system prompt es claro y acotado?
- [ ] ¿Las descripciones de tools son descriptivas?
- [ ] ¿Hay memoria configurada? (si es conversacional)
- [ ] ¿Se manejan errores del LLM? (timeout, rate limit)
- [ ] ¿El modelo es el correcto para el caso? (mini para simple, 4o para complejo)
- [ ] ¿Las tools tienen subflows que funcionan independientemente?
