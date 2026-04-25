---
name: n8n-scheduled-reports
description: >
  Patrones para workflows con Schedule Trigger en n8n: reportes periódicos,
  alertas automáticas, tareas de mantenimiento, y generación de HTML para
  emails. Activar cuando el usuario mencione: reporte, report, alerta,
  cron, schedule, programado, "todos los lunes", "cada día a las 8",
  reporte semanal, alerta de stock, email automático, métricas, dashboard,
  "mandar un resumen por email", o cualquier tarea que se ejecute en un
  horario fijo.
---

# n8n Scheduled Reports & Alerts

## Schedule Trigger

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
  "typeVersion": 1.2,
  "name": "Ejecutar reporte semanal"
}
```

### Cron expressions comunes

| Expresión | Significado |
|-----------|------------|
| `0 8 * * *` | Todos los días a las 8:00 |
| `0 8 * * 1` | Lunes a las 8:00 |
| `0 8 * * 1-5` | Lunes a viernes a las 8:00 |
| `0 */6 * * *` | Cada 6 horas |
| `0 8 1 * *` | Primer día del mes a las 8:00 |
| `*/15 * * * *` | Cada 15 minutos |

**NOTA**: La timezone depende de la configuración del servidor n8n.

## Patrón 1: Reporte semanal por email

```
SECCIÓN: TRIGGER
[Schedule: Lunes 8am]

SECCIÓN: LECTURA (lecturas en paralelo → MERGE)
→ [Leer stock] ──→ [Merge: Append todos los datos]
→ [Leer movimientos] ──→ [Merge]
→ [Leer pedidos] ──→ [Merge]

SECCIÓN: PROCESAMIENTO
→ [Code: Calcular métricas]
→ [Code: Generar HTML del reporte]

SECCIÓN: ENVÍO
→ [Gmail: Enviar reporte]
```

### Code: Calcular métricas

```javascript
const items = $input.all();

// Separar por tipo (si se usó Append en el Merge)
const stockItems = items.filter(i => i.json._source === 'stock');
const movimientos = items.filter(i => i.json._source === 'movimientos');
const pedidos = items.filter(i => i.json._source === 'pedidos');

// O si se usaron nodos separados con $node:
// const stockItems = $node['Leer stock'].all();

const metrics = {
  total_insumos: stockItems.length,
  insumos_bajo_minimo: stockItems.filter(i => 
    parseInt(i.json.stock_actual) < parseInt(i.json.stock_minimo)
  ).length,
  total_movimientos_semana: movimientos.length,
  compras_semana: movimientos.filter(i => i.json.tipo === 'compra').length,
  consumos_semana: movimientos.filter(i => i.json.tipo === 'consumo').length,
  pedidos_pendientes: pedidos.filter(i => i.json.estado === 'pendiente').length,
  fecha_reporte: new Date().toLocaleDateString('es-AR'),
  hora_reporte: new Date().toLocaleTimeString('es-AR')
};

return [{ json: metrics }];
```

### Code: Generar HTML del reporte

```javascript
const m = $input.first().json;

const html = `
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; }
    h1 { color: #2c3e50; border-bottom: 2px solid #3498db; padding-bottom: 10px; }
    .metric { display: inline-block; width: 45%; margin: 10px 2%; 
              padding: 15px; background: #f8f9fa; border-radius: 8px; 
              text-align: center; vertical-align: top; }
    .metric .number { font-size: 32px; font-weight: bold; color: #2c3e50; }
    .metric .label { font-size: 14px; color: #7f8c8d; margin-top: 5px; }
    .alert { background: #fff3cd; border-left: 4px solid #ffc107; 
             padding: 10px; margin: 10px 0; border-radius: 4px; }
    .ok { background: #d4edda; border-left: 4px solid #28a745; 
          padding: 10px; margin: 10px 0; border-radius: 4px; }
    .footer { color: #95a5a6; font-size: 12px; margin-top: 20px; 
              border-top: 1px solid #eee; padding-top: 10px; }
  </style>
</head>
<body>
  <h1>📊 Reporte Semanal de Stock</h1>
  <p>Generado: ${m.fecha_reporte} a las ${m.hora_reporte}</p>
  
  <div>
    <div class="metric">
      <div class="number">${m.total_insumos}</div>
      <div class="label">Insumos totales</div>
    </div>
    <div class="metric">
      <div class="number">${m.compras_semana}</div>
      <div class="label">Compras esta semana</div>
    </div>
    <div class="metric">
      <div class="number">${m.consumos_semana}</div>
      <div class="label">Consumos esta semana</div>
    </div>
    <div class="metric">
      <div class="number">${m.pedidos_pendientes}</div>
      <div class="label">Pedidos pendientes</div>
    </div>
  </div>
  
  ${m.insumos_bajo_minimo > 0 
    ? `<div class="alert">⚠️ <strong>${m.insumos_bajo_minimo} insumos</strong> por debajo del stock mínimo.</div>`
    : `<div class="ok">✅ Todos los insumos por encima del stock mínimo.</div>`
  }
  
  <div class="footer">
    Reporte generado automáticamente por el sistema de control de stock.
  </div>
</body>
</html>`;

return [{ json: { html, subject: `📊 Reporte Semanal - ${m.fecha_reporte}` } }];
```

### Gmail: Enviar reporte

```json
{
  "parameters": {
    "sendTo": "={{ $json.config_email || 'admin@empresa.com' }}",
    "subject": "={{ $json.subject }}",
    "emailType": "html",
    "message": "={{ $json.html }}",
    "options": {}
  },
  "type": "n8n-nodes-base.gmail",
  "typeVersion": 2.1,
  "name": "Enviar reporte por Email"
}
```

## Patrón 2: Alerta de stock bajo

```
[Schedule: Diario 8am] → [Leer stock] → [Leer config] → [Merge]
  → [Code: Filtrar bajo mínimo]
  → [IF: hay alertas?]
    → true  → [Code: Generar email alerta] → [Gmail: Enviar]
    → false → (fin, no hacer nada)
```

### Code: Filtrar bajo mínimo

```javascript
const items = $input.all();

const alertas = items.filter(item => {
  const actual = parseInt(item.json.stock_actual) || 0;
  const minimo = parseInt(item.json.stock_minimo) || 0;
  return actual < minimo;
}).map(item => ({
  json: {
    nombre: item.json.nombre,
    stock_actual: parseInt(item.json.stock_actual) || 0,
    stock_minimo: parseInt(item.json.stock_minimo) || 0,
    deficit: (parseInt(item.json.stock_minimo) || 0) - (parseInt(item.json.stock_actual) || 0)
  }
}));

if (alertas.length === 0) {
  return [{ json: { hay_alertas: false } }];
}

return [{ json: { hay_alertas: true, alertas: alertas.map(a => a.json), count: alertas.length } }];
```

## Patrón 3: Lectura paralela con Merge (CORRECTO)

Cuando un reporte lee de múltiples hojas:

```json
// Conexiones:
{
  "Schedule Trigger": {
    "main": [[
      { "node": "Leer stock", "type": "main", "index": 0 },
      { "node": "Leer movimientos", "type": "main", "index": 0 },
      { "node": "Leer pedidos", "type": "main", "index": 0 }
    ]]
  },
  "Leer stock": {
    "main": [[{ "node": "Combinar datos", "type": "main", "index": 0 }]]
  },
  "Leer movimientos": {
    "main": [[{ "node": "Combinar datos", "type": "main", "index": 1 }]]
  }
}
```

**PROBLEMA**: Merge solo tiene 2 inputs. Para 3+ fuentes, encadenar Merges:

```
[Leer stock] ──→ [Merge 1: stock + movimientos] ──→ [Merge 2: + pedidos] → [Procesar]
[Leer movimientos] ──→ [Merge 1]
[Leer pedidos] ──→ [Merge 2]
```

**Alternativa mejor con Code node:**

```
[Schedule] → [Leer stock] → [Leer movimientos] → [Leer pedidos] → [Code: Combinar]
```

Si las lecturas son secuenciales (cada una tarda poco), simplemente encadenarlas y en el Code final acceder a cada una con `$node["nombre"]`.

```javascript
// Code: Combinar todos los datos
const stock = $node['Leer stock'].all().map(i => ({ ...i.json, _source: 'stock' }));
const movimientos = $node['Leer movimientos'].all().map(i => ({ ...i.json, _source: 'movimientos' }));
const pedidos = $node['Leer pedidos'].all().map(i => ({ ...i.json, _source: 'pedidos' }));

return [{ json: { stock, movimientos, pedidos } }];
```

## Checklist de reportes/alertas

- [ ] ¿El cron expression es correcto para la frecuencia deseada?
- [ ] ¿Las lecturas paralelas pasan por Merge (o son secuenciales con $node)?
- [ ] ¿Las métricas se calculan correctamente (parseInt para números de Sheets)?
- [ ] ¿El HTML del email es responsive y se ve bien en clientes de email?
- [ ] ¿Hay un IF que evite enviar alertas vacías?
- [ ] ¿El email tiene subject descriptivo con fecha?
- [ ] ¿Se manejan errores de lectura de Sheets?
