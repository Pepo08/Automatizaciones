---
name: n8n-rag-patterns
description: >
  Patrones para construir sistemas RAG (Retrieval-Augmented Generation) en n8n:
  ingesta de documentos, embeddings, vector stores, retrieval, y generación
  con contexto. Cubre Pinecone, Supabase pgvector, Qdrant, y ChromaDB como
  vector stores. Activar cuando el usuario mencione: RAG, retrieval augmented
  generation, embeddings, vector store, vectores, Pinecone, Qdrant, ChromaDB,
  Supabase vectors, pgvector, "buscar en documentos", knowledge base,
  "chatbot que sepa de mis documentos", semantic search, búsqueda semántica,
  chunks, ingesta de documentos, o cualquier sistema que combine búsqueda
  por similaridad con generación de texto con LLM.
---

# n8n RAG Patterns

## Arquitectura RAG en n8n

### 2 workflows separados:

```
WORKFLOW 1: Ingesta (Trigger: Manual o Schedule)
  [Leer documentos] → [Chunking] → [Generar embeddings] → [Guardar en vector store]

WORKFLOW 2: Query (Trigger: Webhook o Telegram)
  [Recibir pregunta] → [Generar embedding de query] → [Buscar similares en vector store]
  → [Construir prompt con contexto] → [LLM genera respuesta] → [Responder]
```

## Workflow 1: Ingesta

### Paso 1: Leer documentos

Fuentes comunes:
- Google Drive: PDFs, Docs
- URLs: páginas web
- Google Sheets: datos estructurados
- Archivos locales: CSV, TXT, MD

```
[Manual Trigger] → [Google Drive: Listar archivos] → [Loop: por cada archivo]
  → [Google Drive: Download] → [Extract text from PDF/Doc] → [Chunking]
```

### Paso 2: Chunking (dividir en fragmentos)

```javascript
// Code node: Chunking por párrafos con overlap
const text = $json.content;
const CHUNK_SIZE = 1000; // caracteres
const OVERLAP = 200;
const chunks = [];

for (let i = 0; i < text.length; i += CHUNK_SIZE - OVERLAP) {
  const chunk = text.substring(i, i + CHUNK_SIZE);
  if (chunk.trim().length > 50) { // Ignorar chunks muy cortos
    chunks.push({
      json: {
        text: chunk.trim(),
        source: $json.filename,
        chunk_index: chunks.length,
        metadata: {
          source: $json.filename,
          page: $json.page || null
        }
      }
    });
  }
}

return chunks;
```

### Paso 3: Embeddings + Vector Store

**Opción A: Con nodos nativos de n8n (AI nodes)**

```
[Chunks] → [Embeddings OpenAI] → [Vector Store Insert (Pinecone/Supabase/Qdrant)]
```

n8n tiene nodos langchain integrados:
- `@n8n/n8n-nodes-langchain.embeddingsOpenAi` — Genera embeddings
- `@n8n/n8n-nodes-langchain.vectorStorePinecone` — Pinecone
- `@n8n/n8n-nodes-langchain.vectorStoreSupabase` — Supabase pgvector
- `@n8n/n8n-nodes-langchain.vectorStoreQdrant` — Qdrant

**Opción B: Con HTTP Request (más control)**

```javascript
// Code node: Llamar API de OpenAI para embeddings
const chunks = $input.all();
const results = [];

for (const chunk of chunks) {
  const response = await $helpers.httpRequest({
    method: 'POST',
    url: 'https://api.openai.com/v1/embeddings',
    headers: {
      'Authorization': `Bearer ${$env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: {
      model: 'text-embedding-3-small',
      input: chunk.json.text
    }
  });
  
  results.push({
    json: {
      ...chunk.json,
      embedding: response.data[0].embedding
    }
  });
}

return results;
```

## Workflow 2: Query (Retrieval + Generation)

### Flujo completo

```
[Webhook/Telegram] → [Generar embedding de la pregunta]
  → [Buscar top-K en vector store]
  → [Code: Construir prompt con contexto]
  → [LLM: Generar respuesta]
  → [Responder]
```

### Construir prompt con contexto

```javascript
// Code node
const question = $json.question;
const retrievedChunks = $node['Buscar en vector store'].all();

const context = retrievedChunks
  .map((chunk, i) => `[Fuente ${i+1}: ${chunk.json.metadata?.source || 'desconocido'}]\n${chunk.json.text}`)
  .join('\n\n---\n\n');

const prompt = `Sos un asistente experto. Respondé la pregunta usando SOLO la información del contexto proporcionado. Si la respuesta no está en el contexto, decí "No tengo información sobre eso."

CONTEXTO:
${context}

PREGUNTA: ${question}

RESPUESTA:`;

return [{ json: { prompt, question, sources: retrievedChunks.map(c => c.json.metadata?.source) } }];
```

### Llamar al LLM

**Con nodo nativo de n8n:**
```
[OpenAI Chat Model] con system prompt + user message
```

**Con HTTP Request:**
```javascript
const response = await $helpers.httpRequest({
  method: 'POST',
  url: 'https://api.openai.com/v1/chat/completions',
  headers: {
    'Authorization': `Bearer ${$env.OPENAI_API_KEY}`,
    'Content-Type': 'application/json'
  },
  body: {
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: 'Respondé basándote solo en el contexto proporcionado.' },
      { role: 'user', content: $json.prompt }
    ],
    temperature: 0.3,
    max_tokens: 1000
  }
});

return [{ json: { answer: response.choices[0].message.content, sources: $json.sources } }];
```

## Vector Stores: comparación

| Vector Store | Costo | Hosting | Nodo nativo n8n | Mejor para |
|-------------|-------|---------|----------------|-----------|
| Pinecone | Free tier + paid | Cloud | ✅ | Producción, escalable |
| Supabase pgvector | Free tier | Cloud/Self | ✅ | Si ya usás Supabase |
| Qdrant | Free self-hosted | Self/Cloud | ✅ | Self-hosted, gratis |
| ChromaDB | Free | Self-hosted | ❌ (HTTP) | Desarrollo local |
| Weaviate | Free tier | Cloud/Self | ❌ (HTTP) | Enterprise |

## Embedding Models

| Modelo | Dimensiones | Costo | Calidad |
|--------|------------|-------|---------|
| text-embedding-3-small | 1536 | $0.02/1M tokens | Bueno para la mayoría |
| text-embedding-3-large | 3072 | $0.13/1M tokens | Mejor calidad |
| text-embedding-ada-002 | 1536 | $0.10/1M tokens | Legacy, no usar |

## Chunking strategies

| Estrategia | Cuándo usar |
|-----------|------------|
| Por caracteres fijo (1000 chars, 200 overlap) | Default, funciona para la mayoría |
| Por párrafos | Textos bien estructurados |
| Por secciones/headers | Documentos con headers claros |
| Por oraciones | Textos cortos, alta precisión |
| Recursive (LangChain style) | Mejor calidad general |

## Checklist RAG

- [ ] ¿Los chunks tienen tamaño adecuado? (500-1500 chars típico)
- [ ] ¿Hay overlap entre chunks? (10-20% recomendado)
- [ ] ¿Los chunks tienen metadata? (source, page, date)
- [ ] ¿El top-K es adecuado? (3-5 para la mayoría)
- [ ] ¿El prompt instruye a usar SOLO el contexto?
- [ ] ¿Se manejan preguntas sin contexto relevante?
- [ ] ¿Hay un workflow de re-ingesta para actualizar docs?
