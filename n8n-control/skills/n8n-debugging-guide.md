---
name: n8n-debugging-guide
description: >
  Guía para debuggear workflows de n8n: cómo identificar por qué un workflow
  no funciona, errores comunes de ejecución, cómo leer los logs, cómo testear
  paso a paso, y patrones de diagnóstico. Activar cuando el usuario mencione:
  "no funciona", "no anda", debug, error, "se rompe", "no hace nada",
  "datos vacíos", "se ejecuta mal", "el resultado es incorrecto", troubleshoot,
  logs, "no entiendo por qué falla", o cualquier problema con un workflow
  que ya fue creado pero no funciona como se espera.
---

# n8n Debugging Guide

## Proceso de diagnóstico

### Paso 1: Identificar DÓNDE falla

Ejecutar el workflow manualmente y observar:
- ¿Qué nodo tiene el ícono rojo de error?
- ¿Qué nodo produce datos inesperados?
- ¿Qué nodo no se ejecuta cuando debería?

### Paso 2: Inspeccionar datos en cada nodo

Click en cada nodo después de la ejecución para ver:
- **Input data**: qué datos recibió
- **Output data**: qué datos produjo
- **Error**: si falló, cuál fue el error

### Paso 3: Verificar el flujo de datos

Seguir los datos desde el trigger hasta el punto de falla:
```
Trigger → ¿datos OK? → Nodo 2 → ¿datos OK? → Nodo 3 → ¿AQUÍ FALLA?
```

## Top 10 errores y soluciones

### 1. "El nodo se ejecuta 2 veces"

**Causa**: Fan-in sin Merge (2+ nodos conectan al mismo destino).
```
❌ [Leer A] ──→ [Procesar]
   [Leer B] ──→ [Procesar]
```
**Fix**: Agregar Merge entre las fuentes y el destino.

### 2. "Los datos están vacíos / undefined"

**Causas posibles**:
- El nodo anterior no produjo items (IF/Filter descartó todo)
- Accedés a un campo que no existe en la estructura
- Usás `$json.campo` pero el campo está anidado en `$json.body.campo` (webhook)

**Fix**: Inspeccionar el output del nodo anterior. Verificar la estructura exacta del JSON.

### 3. "Expression error: Cannot read property X of undefined"

**Causa**: Intentás acceder a un campo de un objeto que no existe.
```javascript
// Si $json.user no existe:
❌ {{ $json.user.name }}  // Error: Cannot read property 'name' of undefined
✅ {{ $json.user?.name }}  // undefined, no error
✅ {{ $json.user?.name || 'sin nombre' }}  // fallback
```

### 4. "El IF siempre va por la misma rama"

**Causas**:
- Comparás un número con un string: `"100" !== 100`
- El campo tiene espacios invisibles
- La condición está invertida

**Fix**: 
```javascript
// En el IF, usar expression para parsear:
={{ parseInt($json.stock_actual) }}  // Convertir a número
={{ $json.campo.trim() }}             // Eliminar espacios
```

### 5. "Google Sheets devuelve error 429"

**Causa**: Rate limit de Google Sheets API.
**Fix**: Agregar retry al nodo:
```json
{
  "retryOnFail": true,
  "maxTries": 3,
  "waitBetweenTries": 2000
}
```

### 6. "El webhook no recibe datos"

**Causas**:
- El workflow no está activo (solo funciona en test con "Listen for test event")
- La URL es incorrecta (production vs test URL)
- El body no se envía como JSON

**Fix**: 
- Verificar que el workflow esté activo
- Usar la URL de producción (sin `/test/`)
- Verificar que el cliente envía `Content-Type: application/json`

### 7. "El Code node no retorna datos"

**Causa**: El Code node debe retornar un array de objetos `{json: {...}}`.
```javascript
// ❌ Mal
return { resultado: "ok" };

// ✅ Bien
return [{ json: { resultado: "ok" } }];
```

### 8. "$node['Nombre'] devuelve undefined"

**Causas**:
- El nombre del nodo no coincide exactamente (case sensitive)
- El nodo referenciado está en una rama paralela que no se ejecutó
- El nodo no se ejecutó todavía (orden de ejecución)

**Fix**: Verificar el nombre exacto. Si está en otra rama, usar Merge.

### 9. "El Merge no combina los datos"

**Causas**:
- Ambas fuentes conectan al mismo index (ambas a 0)
- El modo de Merge no es el correcto
- Una de las fuentes no produjo datos

**Fix**: Verificar que una fuente va a index 0 y otra a index 1.

### 10. "El workflow funciona en test pero no en producción"

**Causas**:
- En test se usa "Execute Workflow" (trigger manual), en prod se usa el trigger real
- Las credenciales expiran
- Los datos de test son diferentes a los de producción

**Fix**: Testear con datos reales simulados. Verificar credenciales.

## Técnicas de debug

### Técnica 1: Nodo Set de debug

Agregar un Set node temporal para inspeccionar datos en un punto específico:
```json
{
  "parameters": {
    "mode": "manual",
    "assignments": {
      "assignments": [
        { "name": "debug_input", "value": "={{ JSON.stringify($json) }}", "type": "string" },
        { "name": "debug_items_count", "value": "={{ $input.all().length }}", "type": "string" }
      ]
    }
  },
  "name": "🔍 DEBUG: ver datos aquí"
}
```

### Técnica 2: Code node de logging

```javascript
// Agregar al inicio de un Code node para debug
console.log('Items recibidos:', $input.all().length);
console.log('Primer item:', JSON.stringify($input.first().json, null, 2));

// ... resto del código
```

Los console.log aparecen en la consola del servidor n8n.

### Técnica 3: Ejecución paso a paso

En n8n, podés ejecutar nodo por nodo:
1. Click derecho en un nodo → "Execute this node only"
2. Inspeccionar el output
3. Avanzar al siguiente nodo

### Técnica 4: Pin data

Para testear sin depender de datos reales:
1. Ejecutar el workflow hasta el nodo que querés testear
2. Click en el output → "Pin data"
3. Los datos quedan fijos para las siguientes ejecuciones

## Checklist de debugging

- [ ] ¿El workflow está activo (para webhooks/triggers)?
- [ ] ¿Cada nodo produce los datos esperados? (inspeccionar output)
- [ ] ¿Hay fan-in sin Merge? (2+ nodos → mismo destino)
- [ ] ¿Los tipos de datos son correctos? (string vs number)
- [ ] ¿Los nombres de nodos en $node["..."] son exactos?
- [ ] ¿Las credenciales están configuradas y vigentes?
- [ ] ¿El Code node retorna [{ json: {...} }]?
- [ ] ¿Los datos del webhook están en $json.body?
