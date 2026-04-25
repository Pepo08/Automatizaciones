---
name: n8n-database-patterns
description: >
  Patrones para integrar bases de datos en n8n: Postgres, MySQL, Supabase,
  MongoDB. Cubre queries, inserts, updates, upserts, transacciones, y
  migración desde Google Sheets a DB real. Activar cuando el usuario mencione:
  base de datos, database, Postgres, PostgreSQL, MySQL, Supabase, MongoDB,
  SQL, query, tabla, "migrar de Sheets a DB", "necesito algo más robusto
  que Sheets", o cuando el proyecto escale más allá de Google Sheets.
---

# n8n Database Patterns

## Cuándo migrar de Sheets a DB

| Señal | Acción |
|-------|--------|
| >5000 filas | Considerar DB |
| >50 writes/minuto | Migrar a DB |
| Necesitás JOINs complejos | Migrar a DB |
| Múltiples workflows escriben al mismo Sheets | Migrar a DB |
| Necesitás transacciones atómicas | Migrar a DB |
| <1000 filas, pocas writes | Sheets está bien |

## Postgres node (recomendado)

### Select

```json
{
  "parameters": {
    "operation": "select",
    "schema": "public",
    "table": "stock",
    "returnAll": true,
    "options": {}
  },
  "type": "n8n-nodes-base.postgres",
  "typeVersion": 2.5,
  "name": "Leer stock completo"
}
```

### Select con filtro

```json
{
  "parameters": {
    "operation": "select",
    "schema": "public",
    "table": "stock",
    "returnAll": false,
    "limit": 1,
    "where": {
      "values": [
        {
          "column": "insumo_id",
          "condition": "equal",
          "value": "={{ $json.insumo_id }}"
        }
      ]
    }
  },
  "type": "n8n-nodes-base.postgres",
  "typeVersion": 2.5,
  "name": "Buscar insumo por ID"
}
```

### Insert

```json
{
  "parameters": {
    "operation": "insert",
    "schema": "public",
    "table": "movimientos",
    "columns": {
      "mappingMode": "defineBelow",
      "value": {
        "tipo": "={{ $json.tipo }}",
        "insumo_id": "={{ $json.insumo_id }}",
        "cantidad": "={{ $json.cantidad }}",
        "usuario": "={{ $json.username }}",
        "created_at": "={{ $now.toISO() }}"
      }
    }
  },
  "type": "n8n-nodes-base.postgres",
  "typeVersion": 2.5,
  "name": "Registrar movimiento"
}
```

### Upsert (insert or update)

```json
{
  "parameters": {
    "operation": "upsert",
    "schema": "public",
    "table": "stock",
    "columns": {
      "mappingMode": "defineBelow",
      "value": {
        "insumo_id": "={{ $json.insumo_id }}",
        "stock_actual": "={{ $json.nuevo_stock }}",
        "updated_at": "={{ $now.toISO() }}"
      }
    },
    "conflictColumns": ["insumo_id"]
  },
  "type": "n8n-nodes-base.postgres",
  "typeVersion": 2.5,
  "name": "Actualizar stock (upsert)"
}
```

### Raw SQL Query

Para queries complejos:

```json
{
  "parameters": {
    "operation": "executeQuery",
    "query": "SELECT s.*, m.total_movimientos FROM stock s LEFT JOIN (SELECT insumo_id, COUNT(*) as total_movimientos FROM movimientos WHERE created_at > NOW() - INTERVAL '7 days' GROUP BY insumo_id) m ON s.insumo_id = m.insumo_id WHERE s.stock_actual < s.stock_minimo ORDER BY s.stock_actual ASC",
    "options": {}
  },
  "type": "n8n-nodes-base.postgres",
  "typeVersion": 2.5,
  "name": "Insumos bajo mínimo con actividad"
}
```

## Supabase (Postgres managed + API REST)

Supabase es Postgres + API REST + Auth. Podés usar el nodo Postgres directamente O el nodo Supabase.

```json
{
  "parameters": {
    "resource": "row",
    "operation": "getAll",
    "tableId": "stock",
    "returnAll": true,
    "filters": {
      "conditions": []
    }
  },
  "type": "n8n-nodes-base.supabase",
  "typeVersion": 1,
  "name": "Leer stock de Supabase",
  "credentials": {
    "supabaseApi": { "id": "CRED_ID", "name": "Supabase" }
  }
}
```

## Schema recomendado para stock

```sql
-- Stock actual
CREATE TABLE stock (
  insumo_id VARCHAR(20) PRIMARY KEY,
  nombre VARCHAR(100) NOT NULL,
  categoria VARCHAR(50),
  unidad VARCHAR(20),
  stock_actual DECIMAL(10,2) DEFAULT 0,
  stock_minimo DECIMAL(10,2) DEFAULT 0,
  costo_unitario DECIMAL(10,2),
  proveedor VARCHAR(100),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Log de movimientos
CREATE TABLE movimientos (
  id SERIAL PRIMARY KEY,
  tipo VARCHAR(10) CHECK (tipo IN ('compra', 'consumo')),
  insumo_id VARCHAR(20) REFERENCES stock(insumo_id),
  cantidad DECIMAL(10,2) NOT NULL,
  stock_anterior DECIMAL(10,2),
  stock_posterior DECIMAL(10,2),
  usuario VARCHAR(50),
  notas TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- BOM (fórmulas)
CREATE TABLE bom (
  id SERIAL PRIMARY KEY,
  producto VARCHAR(100) NOT NULL,
  insumo_id VARCHAR(20) REFERENCES stock(insumo_id),
  cantidad_por_unidad DECIMAL(10,4) NOT NULL,
  unidad VARCHAR(20)
);

-- Sesiones de bot
CREATE TABLE sessions (
  chat_id BIGINT PRIMARY KEY,
  estado VARCHAR(50),
  datos_temp JSONB DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

## Ventajas de DB vs Sheets

| Aspecto | Google Sheets | Postgres/Supabase |
|---------|--------------|-------------------|
| Rate limits | 60 req/min | Sin límite práctico |
| Transacciones | No | Sí (ACID) |
| JOINs | Manual (Merge) | Nativo SQL |
| Concurrencia | Conflictos | Manejada |
| Volumen | ~50K filas | Millones |
| Costo | Gratis | Free tier Supabase / $5+/mes |
| Setup | Inmediato | Crear tables |
