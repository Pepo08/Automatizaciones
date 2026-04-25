---
name: n8n-api-integration-patterns
description: >
  Patrones para integrar APIs externas en n8n: OpenAI, Google Maps, 
  MercadoLibre, AFIP, APIs de envío (Andreani, OCA), y APIs custom.
  Cubre autenticación OAuth2, paginación, webhooks bidireccionales,
  y manejo de respuestas. Activar cuando el usuario mencione cualquier
  API externa, integración con servicio, o necesite conectar n8n con
  un sistema que no tiene nodo nativo.
---

# n8n API Integration Patterns

## Patrón: OAuth2 refresh manual

Para APIs que necesitan refresh de token:

```
[Schedule: cada 50 min] → [HTTP Request: Refresh token]
  → [Google Sheets: Guardar nuevo token]
```

```
[Workflow principal] → [Leer token de Sheets] → [HTTP Request con token]
  → [IF: 401?] → [Refresh token] → [Retry request]
```

## Patrón: Paginación automática

```javascript
// Code node: Fetch all pages
let allResults = [];
let page = 1;
let hasMore = true;

while (hasMore) {
  const response = await $helpers.httpRequest({
    method: 'GET',
    url: `https://api.ejemplo.com/data?page=${page}&limit=100`,
    headers: { 'Authorization': `Bearer ${$env.API_TOKEN}` }
  });
  
  allResults = allResults.concat(response.data);
  hasMore = response.data.length === 100; // Si vino llena, hay más
  page++;
  
  if (page > 50) break; // Safety limit
}

return allResults.map(item => ({ json: item }));
```

## Patrón: Webhook bidireccional

Tu sistema recibe webhooks Y envía requests:

```
WORKFLOW 1: Recibir webhooks de servicio externo
[Webhook POST /api/callback] → [Validar signature] → [Procesar evento]

WORKFLOW 2: Llamar API del servicio
[Trigger] → [Preparar datos] → [HTTP Request: POST a API] → [Manejar respuesta]
```

## APIs comunes en LatAm

### MercadoLibre API

```javascript
// Buscar productos
const response = await $helpers.httpRequest({
  method: 'GET',
  url: `https://api.mercadolibre.com/sites/MLA/search?q=${encodeURIComponent($json.query)}&limit=10`,
});
return response.results.map(r => ({ json: { id: r.id, title: r.title, price: r.price } }));
```

### Dólar/Cotizaciones API (Argentina)

```javascript
const response = await $helpers.httpRequest({
  method: 'GET',
  url: 'https://dolarapi.com/v1/dolares'
});
return response.map(d => ({ json: d }));
```

### AFIP (facturación)
No tiene nodo nativo. Usar HTTP Request con certificados digitales. Complejidad alta — considerar wrappers como Afip.js.

## Manejo de errores de API

```javascript
try {
  const response = await $helpers.httpRequest({
    method: 'POST',
    url: 'https://api.ejemplo.com/data',
    body: $json.data,
    returnFullResponse: true // Incluye status code
  });
  
  if (response.statusCode >= 400) {
    return [{ json: { success: false, error: response.body, statusCode: response.statusCode } }];
  }
  
  return [{ json: { success: true, data: response.body } }];
} catch (error) {
  return [{ json: { success: false, error: error.message } }];
}
```
