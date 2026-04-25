---
name: n8n-stock-inventory-patterns
description: >
  Patrones de dominio para sistemas de control de stock e inventario en n8n.
  Cubre: registro de compras, consumo de materiales, cálculo de BOM (bill of 
  materials), alertas de stock bajo, pedidos de reposición, y trazabilidad 
  de movimientos. Activar cuando el usuario mencione: stock, inventario, 
  insumos, materiales, compra de insumos, consumo, BOM, bill of materials,
  fórmula de producto, stock mínimo, alerta de stock, pedido, reposición,
  movimientos de stock, trazabilidad, control de materiales, mueblería,
  producción, o cualquier sistema que controle entrada y salida de materiales
  o productos.
---

# n8n Stock & Inventory Patterns

## Modelo de datos estándar

### Hoja "Stock" (inventario actual)

| insumo_id | nombre | categoria | unidad | stock_actual | stock_minimo | costo_unitario | proveedor | ultima_actualizacion |
|-----------|--------|-----------|--------|-------------|-------------|---------------|-----------|---------------------|
| INS001 | Tornillo 3/4 | Ferretería | unidad | 500 | 100 | 0.15 | Bulonera SA | 2024-01-15T... |
| INS002 | MDF 18mm | Tableros | plancha | 25 | 10 | 4500 | Maderex | 2024-01-14T... |

### Hoja "Movimientos" (log de transacciones)

| mov_id | fecha | tipo | insumo_id | cantidad | stock_anterior | stock_posterior | usuario | notas |
|--------|-------|------|-----------|----------|---------------|----------------|---------|-------|
| MOV001 | 2024-01-15T10:30:00Z | compra | INS001 | 200 | 300 | 500 | ralph | Proveedor X, factura 123 |
| MOV002 | 2024-01-15T14:00:00Z | consumo | INS001 | 50 | 500 | 450 | juan | Pedido PED-2024-001 |

### Hoja "BOM" (fórmulas/recetas de producto)

| producto | insumo_id | cantidad_por_unidad | unidad |
|----------|-----------|--------------------| ------|
| Mesa 1.20 | INS001 | 16 | unidad |
| Mesa 1.20 | INS002 | 2 | plancha |
| Mesa 1.20 | INS003 | 1 | litro |
| Silla Standard | INS001 | 8 | unidad |

### Hoja "Pedidos"

| pedido_id | fecha | producto | cantidad | estado | solicitante | notas |
|-----------|-------|----------|----------|--------|-------------|-------|
| PED-2024-001 | 2024-01-15 | Mesa 1.20 | 5 | pendiente | cliente X | Entrega 30 enero |

## Patrón: Registrar compra

```
[Recibir datos compra] → [Leer stock actual del insumo] → [Merge]
  → [Code: Calcular nuevo stock]
  → [Google Sheets: Update stock]
  → [IF: update OK?]
    → true  → [Google Sheets: Append movimiento] → [Responder OK]
    → false → [Responder error]
```

### Code: Calcular nuevo stock (compra)

```javascript
const input = $input.first().json;
const stockActual = parseInt(input.stock_actual) || 0;
const cantidad = parseInt(input.cantidad);

const nuevoStock = stockActual + cantidad;

return [{
  json: {
    insumo_id: input.insumo_id,
    nombre: input.nombre,
    stock_anterior: stockActual,
    nuevo_stock: nuevoStock,
    cantidad: cantidad,
    tipo: 'compra',
    usuario: input.username,
    timestamp: new Date().toISOString(),
    // Para el movimiento
    mov_id: `MOV-${Date.now()}`
  }
}];
```

## Patrón: Registrar consumo

```
[Recibir datos consumo] → [Leer stock actual] → [Merge]
  → [Code: Validar stock suficiente + calcular]
  → [IF: stock suficiente?]
    → true  → [Update stock] → [Append movimiento] → [Responder OK]
    → false → [Responder: stock insuficiente]
```

### Code: Validar y calcular consumo

```javascript
const input = $input.first().json;
const stockActual = parseInt(input.stock_actual) || 0;
const cantidad = parseInt(input.cantidad);

if (stockActual < cantidad) {
  return [{
    json: {
      suficiente: false,
      stock_actual: stockActual,
      cantidad_pedida: cantidad,
      deficit: cantidad - stockActual,
      mensaje: `⚠️ Stock insuficiente de ${input.nombre}.\n` +
        `Stock actual: ${stockActual}\nPedido: ${cantidad}\nFaltan: ${cantidad - stockActual}`
    }
  }];
}

return [{
  json: {
    suficiente: true,
    insumo_id: input.insumo_id,
    nombre: input.nombre,
    stock_anterior: stockActual,
    nuevo_stock: stockActual - cantidad,
    cantidad: cantidad,
    tipo: 'consumo',
    usuario: input.username,
    timestamp: new Date().toISOString(),
    mov_id: `MOV-${Date.now()}`
  }
}];
```

## Patrón: Cálculo BOM (materiales para un pedido)

Dado un pedido (producto + cantidad), calcular qué materiales se necesitan y si hay stock.

```
[Recibir pedido: producto + cantidad]
  → [Leer BOM del producto] → [Merge: BOM + stock actual]
  → [Leer stock actual]     → [Merge]
  → [Code: Calcular materiales necesarios vs disponibles]
  → resultado
```

### Code: Calcular BOM

```javascript
const items = $input.all();
// Asumiendo Merge by Fields por insumo_id
const producto = $node['Recibir datos del pedido'].first().json.producto;
const cantidadPedido = parseInt($node['Recibir datos del pedido'].first().json.cantidad);

const bomItems = $node['Leer formulas BOM'].all()
  .filter(i => i.json.producto === producto);
const stockItems = $node['Leer stock disponible'].all();

// Crear mapa de stock
const stockMap = {};
for (const item of stockItems) {
  stockMap[item.json.insumo_id] = {
    nombre: item.json.nombre,
    stock_actual: parseInt(item.json.stock_actual) || 0,
    unidad: item.json.unidad
  };
}

// Calcular materiales necesarios
const materiales = bomItems.map(bom => {
  const necesario = parseFloat(bom.json.cantidad_por_unidad) * cantidadPedido;
  const stock = stockMap[bom.json.insumo_id] || { stock_actual: 0, nombre: bom.json.insumo_id };
  const disponible = stock.stock_actual >= necesario;
  
  return {
    insumo_id: bom.json.insumo_id,
    nombre: stock.nombre,
    unidad: bom.json.unidad,
    necesario,
    disponible_actual: stock.stock_actual,
    sobrante: stock.stock_actual - necesario,
    tiene_stock: disponible
  };
});

const todoDisponible = materiales.every(m => m.tiene_stock);
const faltantes = materiales.filter(m => !m.tiene_stock);

return [{
  json: {
    producto,
    cantidad_pedido: cantidadPedido,
    materiales,
    todo_disponible: todoDisponible,
    faltantes,
    resumen: todoDisponible 
      ? `✅ Hay stock para producir ${cantidadPedido}x ${producto}`
      : `❌ Faltan ${faltantes.length} insumos para ${cantidadPedido}x ${producto}:\n` +
        faltantes.map(f => `  • ${f.nombre}: necesario ${f.necesario}, disponible ${f.disponible_actual}`).join('\n')
  }
}];
```

## Patrón: Consulta de stock formateada

```javascript
// Code: Formatear stock para Telegram
const items = $input.all();

let text = '📦 *Stock actual:*\n\n';

// Agrupar por categoría
const categorias = {};
for (const item of items) {
  const cat = item.json.categoria || 'Sin categoría';
  if (!categorias[cat]) categorias[cat] = [];
  categorias[cat].push(item.json);
}

for (const [cat, insumos] of Object.entries(categorias)) {
  text += `*${cat}:*\n`;
  for (const ins of insumos) {
    const actual = parseInt(ins.stock_actual) || 0;
    const minimo = parseInt(ins.stock_minimo) || 0;
    const emoji = actual < minimo ? '🔴' : actual < minimo * 1.5 ? '🟡' : '🟢';
    text += `  ${emoji} ${ins.nombre}: ${actual} ${ins.unidad}`;
    if (actual < minimo) text += ` *(mín: ${minimo})*`;
    text += '\n';
  }
  text += '\n';
}

return [{ json: { text, chat_id: $json.chat_id } }];
```

## Estructura de workflow recomendada para stock

```
WORKFLOW 1: Bot de operaciones (Trigger: Telegram)
  ├── ENTRADA: Telegram trigger + parseo
  ├── AUTH: Verificar usuario autorizado  
  ├── SESIÓN: Leer/router de estado
  ├── COMANDOS:
  │   ├── /compra → sesión multi-paso → ejecutar compra
  │   ├── /consumo → sesión multi-paso → ejecutar consumo
  │   ├── /stock → consultar y formatear
  │   ├── /pedido → calcular BOM + crear pedido
  │   └── /ayuda → mostrar menú
  └── RESPUESTA: Telegram send + guardar sesión

WORKFLOW 2: Alertas (Trigger: Cron diario 8am)
  ├── Leer stock + config
  ├── Filtrar bajo mínimo
  └── Si hay alertas → enviar email

WORKFLOW 3: Reporte semanal (Trigger: Cron lunes 8am)
  ├── Leer stock + movimientos + pedidos
  ├── Calcular métricas
  └── Generar HTML → enviar email
```

3 workflows con triggers distintos. NO 5 o más.

## Checklist de sistema de stock

- [ ] ¿Las hojas tienen insumo_id como clave primaria?
- [ ] ¿Cada movimiento registra stock_anterior y stock_posterior?
- [ ] ¿El consumo valida stock suficiente antes de descontar?
- [ ] ¿Las compras suman, los consumos restan?
- [ ] ¿Los números se parsean con parseInt (Sheets devuelve strings)?
- [ ] ¿Hay log de auditoría completo en la hoja Movimientos?
- [ ] ¿El BOM permite calcular materiales por producto?
- [ ] ¿Las alertas de stock bajo están configuradas?
