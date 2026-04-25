---
name: n8n-anti-patterns
description: >
  Anti-patrones comunes en n8n: errores de diseño que causan workflows
  rotos, inmantenibles, o ineficientes. Esta skill es una lista de
  "qué NO hacer" que complementa las skills de "qué SÍ hacer". ACTIVAR
  siempre como referencia cuando se genere o revise un workflow.
  Especialmente útil para detectar problemas en workflows existentes.
---

# n8n Anti-Patterns (Qué NO hacer)

## 🔴 Anti-patrón 1: Fan-in sin Merge
```
❌ [Leer A] ──→ [Procesar]
   [Leer B] ──→ [Procesar]

✅ [Leer A] ──→ [Merge] ──→ [Procesar]
   [Leer B] ──→ [Merge]
```
**Efecto**: Procesar se ejecuta 2 veces con datos parciales.

## 🔴 Anti-patrón 2: Demasiados workflows
```
❌ 5 workflows para funcionalidades que comparten trigger
✅ 1 workflow con Switch para rutear por comando
```
**Efecto**: Mantenimiento multiplicado, más puntos de falla.

## 🔴 Anti-patrón 3: Code node para todo
```
❌ Code node que hace: parsear + validar + transformar + formatear
✅ Set (parsear) → IF (validar) → Set (transformar) → Set (formatear)
```
**Efecto**: Imposible de debuggear, invisible el flujo de datos.

## 🔴 Anti-patrón 4: Nombres genéricos
```
❌ "Code", "Set", "IF", "HTTP Request", "Merge"
✅ "Calcular stock nuevo", "Preparar datos para Sheets", "¿Es compra?", "Combinar stock + config"
```
**Efecto**: Nadie entiende qué hace cada nodo.

## 🔴 Anti-patrón 5: Sin error handling
```
❌ [Webhook] → [Procesar] → [Guardar] (sin manejo de errores)
✅ [Webhook] → [Validar] → [Procesar (onError: continueErrorOutput)] → [Guardar]
                                        └─error─→ [Notificar error]
```
**Efecto**: Fallos silenciosos, datos perdidos.

## 🔴 Anti-patrón 6: HTTP Request para APIs con nodo nativo
```
❌ HTTP Request a api.telegram.org/bot.../sendMessage
✅ Telegram node: sendMessage
```
**Efecto**: Más código, sin manejo de credenciales integrado.

## 🔴 Anti-patrón 7: Hardcodear valores
```
❌ "spreadsheetId": "1abc123..."  directo en el nodo
✅ "spreadsheetId": "={{ $env.SPREADSHEET_ID }}"  o leer de config
```
**Efecto**: Imposible cambiar entre ambientes sin editar el workflow.

## 🔴 Anti-patrón 8: Sin sticky notes
```
❌ 25 nodos sin ninguna documentación visual
✅ 25 nodos organizados en 4 secciones con sticky notes
```
**Efecto**: Incomprensible para quien no lo diseñó.

## 🔴 Anti-patrón 9: Reconvergencia sin Merge después de IF
```
❌ [IF] ──true──→  [Set A] ──→ [Guardar]
        ──false──→ [Set B] ──→ [Guardar]
   (Guardar se ejecuta 2 veces)

✅ [IF] ──true──→  [Set A] ──→ [Merge: Choose Branch] ──→ [Guardar]
        ──false──→ [Set B] ──→ [Merge: Choose Branch]
```

## 🔴 Anti-patrón 10: Ignorar tipos de datos de Sheets
```
❌ if ($json.stock_actual > 100) // "500" > 100 → comparación string
✅ if (parseInt($json.stock_actual) > 100) // 500 > 100 → comparación numérica
```

## 🔴 Anti-patrón 11: Code node sin return correcto
```
❌ return { resultado: "ok" };
✅ return [{ json: { resultado: "ok" } }];
```

## 🔴 Anti-patrón 12: Execution order v0
```
❌ "executionOrder": "v0" (ejecuta por posición visual)
✅ "executionOrder": "v1" (ejecuta por conexiones)
```

## 🔴 Anti-patrón 13: Mega-workflow de 50+ nodos sin subflows
```
❌ 1 workflow con 60 nodos haciendo todo
✅ 1 workflow principal + 2-3 subflows para lógica reutilizable
```

## 🔴 Anti-patrón 14: No validar input de webhooks
```
❌ [Webhook] → [Procesar body directamente]
✅ [Webhook] → [Validar campos] → [IF: válido?] → [Procesar]
```

## 🔴 Anti-patrón 15: Generar JSON sin probar
```
❌ Generar JSON y entregarlo sin verificar estructura
✅ Generar JSON → verificar connections → verificar typeVersions → entregar
```
