---
name: n8n-data-transformation
description: >
  Patrones avanzados de transformación de datos en n8n: pivotear tablas,
  agrupar y sumarizar, normalizar datos, denormalizar, aplanar JSONs anidados,
  generar reportes agregados, y transformaciones que requieren Code node.
  Activar cuando el usuario mencione: transformar datos, pivotar, agrupar,
  sumarizar, agregar, normalizar, aplanar JSON, flatten, reshape, "convertir
  filas en columnas", "agrupar por campo", totales, subtotales, o cualquier
  transformación de datos compleja más allá de rename/add fields.
---

# n8n Data Transformation Patterns

## Agrupar y sumarizar

### Con Item Lists Summarize (sin código)

Para agrupaciones simples:
```
[Datos] → [Item Lists: Summarize by "categoria", sum "cantidad"]
```

### Con Code node (para lógica compleja)

```javascript
const items = $input.all();

// Agrupar por categoría
const grupos = {};
for (const item of items) {
  const key = item.json.categoria;
  if (!grupos[key]) {
    grupos[key] = { categoria: key, total_stock: 0, count: 0, items: [] };
  }
  grupos[key].total_stock += parseInt(item.json.stock_actual) || 0;
  grupos[key].count += 1;
  grupos[key].items.push(item.json.nombre);
}

return Object.values(grupos).map(g => ({ json: g }));
```

## Pivotar datos (filas → columnas)

Input:
```
[{mes: "Enero", tipo: "compra", total: 100},
 {mes: "Enero", tipo: "consumo", total: 80},
 {mes: "Febrero", tipo: "compra", total: 120}]
```

Output deseado:
```
[{mes: "Enero", compras: 100, consumos: 80},
 {mes: "Febrero", compras: 120, consumos: 0}]
```

```javascript
const items = $input.all();
const pivot = {};

for (const item of items) {
  const key = item.json.mes;
  if (!pivot[key]) pivot[key] = { mes: key, compras: 0, consumos: 0 };
  if (item.json.tipo === 'compra') pivot[key].compras += item.json.total;
  if (item.json.tipo === 'consumo') pivot[key].consumos += item.json.total;
}

return Object.values(pivot).map(row => ({ json: row }));
```

## Aplanar JSON anidado

Input: `{ user: { name: "Ralph", address: { city: "BA" } }, orders: [1,2,3] }`

```javascript
const items = $input.all();

return items.map(item => {
  const flat = {};
  
  function flatten(obj, prefix = '') {
    for (const [key, value] of Object.entries(obj)) {
      const newKey = prefix ? `${prefix}_${key}` : key;
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        flatten(value, newKey);
      } else {
        flat[newKey] = value;
      }
    }
  }
  
  flatten(item.json);
  return { json: flat };
});
// Output: { user_name: "Ralph", user_address_city: "BA", orders: [1,2,3] }
```

## Lookup / enriquecer datos

Agregar información de una tabla de referencia:

```javascript
// Asumiendo que los datos de referencia vienen del Merge
const items = $input.all();

// Crear lookup table
const categorias = {
  'INS001': { categoria: 'Ferretería', proveedor: 'Bulonera SA' },
  'INS002': { categoria: 'Tableros', proveedor: 'Maderex' }
};

return items.map(item => ({
  json: {
    ...item.json,
    ...(categorias[item.json.insumo_id] || { categoria: 'Sin categoría', proveedor: 'N/A' })
  }
}));
```

## Generar estadísticas

```javascript
const items = $input.all();
const values = items.map(i => parseInt(i.json.stock_actual) || 0);

const stats = {
  count: values.length,
  sum: values.reduce((a, b) => a + b, 0),
  avg: Math.round(values.reduce((a, b) => a + b, 0) / values.length),
  min: Math.min(...values),
  max: Math.max(...values),
  median: values.sort((a, b) => a - b)[Math.floor(values.length / 2)]
};

return [{ json: stats }];
```

## Deduplicación avanzada

```javascript
// Deduplicar por campo, quedándose con el más reciente
const items = $input.all();
const seen = new Map();

for (const item of items) {
  const key = item.json.insumo_id;
  const existing = seen.get(key);
  
  if (!existing || new Date(item.json.updated_at) > new Date(existing.json.updated_at)) {
    seen.set(key, item);
  }
}

return Array.from(seen.values());
```

## Template: Generar CSV en memoria

```javascript
const items = $input.all();
const headers = Object.keys(items[0].json);
const csv = [
  headers.join(','),
  ...items.map(item => headers.map(h => `"${item.json[h] || ''}"`).join(','))
].join('\n');

return [{ json: { csv, filename: `stock_${new Date().toISOString().split('T')[0]}.csv` } }];
```
