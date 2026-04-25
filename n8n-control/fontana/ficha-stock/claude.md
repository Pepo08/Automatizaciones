# PROMPT — Sistema de Gestión de Stock para Mueblería

## Contexto del proyecto

Sos un experto en automatización con n8n, Google Sheets, Telegram Bot API y desarrollo de formularios web. Tu tarea es diseñar, documentar y generar el flujo completo de un sistema de gestión de stock de materia prima para una mueblería/carpintería PyME en Argentina.

La empresa fabrica muebles a medida por pedido. No manejan stock de producto terminado — solo de materia prima (placas de melamina MDF, placas de fondo, filos/cantos, herrajes, tornillería, adhesivos, etc.). Cuando un cliente hace un pedido, se consumen materiales del depósito para fabricar el mueble.

---

## Arquitectura general del sistema

El sistema tiene **7 módulos principales** que deben funcionar integrados:

1. **Módulo de entrada de datos** (Telegram Bot + Formulario Web)
2. **Motor de cálculo de materiales** (pedido → lista de insumos necesarios)
3. **Módulo de stock** (Google Sheets como base de datos central)
4. **Módulo de movimientos** (registro de compras, consumos, ajustes)
5. **Módulo de alertas y reportes** (stock bajo, faltantes, reportes periódicos)
6. **Módulo de autorización** (control de acceso por usuario)
7. **Dashboard visual** (Google Sheets con gráficos automáticos)

---

## MÓDULO 1 — Entrada de datos (Telegram Bot + Formulario Web)

### Canal: Telegram Bot

El bot debe ofrecer un menú principal con las siguientes opciones:

```
🏭 MENÚ PRINCIPAL
├── 📦 Registrar compra de insumos
├── 🔨 Registrar pedido nuevo (consumo de materiales)
├── ✏️ Editar último movimiento
├── 📊 Ver stock actual (por categoría o SKU)
├── ⚠️ Ver insumos con stock bajo
├── 📋 Reporte completo
└── ❓ Ayuda
```

#### Flujo: Registrar compra de insumos

1. El bot pregunta: "¿Qué insumo compraste?" → el usuario puede buscar por nombre, SKU o categoría
2. El bot muestra las coincidencias y el usuario selecciona
3. El bot pregunta: "¿Cuántas unidades?"
4. El bot pregunta: "¿Precio de compra por unidad?" (para actualizar precio costo si cambió)
5. El bot pregunta: "¿Proveedor?" → sugiere el proveedor habitual del insumo, permite cambiarlo
6. **Confirmación** : "Vas a registrar: COMPRA de 10 unidades de Melamina MDF Blanco (MDF-001) a $45.648/u de Masisa/Egger. ¿Confirmar? ✅❌"
7. Si confirma → actualiza stock, registra movimiento, responde con stock actualizado
8. Si cancela → vuelve al menú

#### Flujo: Registrar pedido nuevo (consumo de materiales)

1. El bot pregunta: "¿Qué tipo de mueble?" → opciones inline (mesa, rack, estante, placard, escritorio, otro)
2. El bot pregunta: "¿Medidas?" → el usuario ingresa (ej: "1.20 x 0.60 x 0.75")
3. El bot pregunta: "¿Color/material?" → lista los colores disponibles en stock con cantidad actual
4. El bot pregunta: "¿Cantidad de unidades del mismo mueble?"
5. **El motor de cálculo** procesa el pedido y devuelve:
   * Lista de materiales necesarios (MDF, fondo, filo, herrajes, etc.)
   * Cantidad de cada uno
   * Stock actual de cada uno
   * ✅ si alcanza / ⚠️ si no alcanza
6. **Si alcanza todo** : "El pedido consume: [lista]. Stock suficiente. ¿Confirmar descuento de stock? ✅❌"
7. **Si NO alcanza** : genera un **REPORTE DE FALTANTES** con:

* Insumo faltante
* Cantidad que falta
* Proveedor sugerido (el que tiene cargado en la ficha)
* Precio estimado de compra (precio costo × cantidad faltante)
* Total estimado de compra
* El reporte se envía por Telegram Y por Gmail al dueño

1. El usuario puede confirmar el descuento parcial (lo que sí hay) o esperar a tener todo

#### Flujo: Editar último movimiento

1. El bot muestra los últimos 5 movimientos registrados
2. El usuario selecciona cuál editar
3. Puede modificar: cantidad, insumo, tipo de movimiento
4. **Confirmación obligatoria** antes de aplicar el cambio
5. El movimiento original queda logueado como "editado" con timestamp

#### Flujo: Ver stock actual

1. El usuario elige ver por categoría (MDF 18mm, Fondos 3mm, Filos, etc.) o buscar por SKU/nombre
2. El bot devuelve una tabla resumida con: SKU | Producto | Stock | Stock Mínimo | Estado (✅/⚠️/🔴)

### Canal: Formulario Web (hosting gratuito)

Un formulario web que replique las mismas funciones del bot, hosteado gratuitamente (opciones: Google Sites + Google Apps Script, Netlify + frontend estático, o Vercel). El formulario debe:

* Tener las mismas opciones que el bot (compra, pedido, consulta)
* Ser responsive (funcionar en celular)
* Conectarse a la misma Google Sheet que el bot
* Validar todos los campos antes de enviar
* Mostrar confirmación visual del movimiento registrado

---

## MÓDULO 2 — Motor de cálculo de materiales

### Estructura de fórmulas de fabricación

En la Google Sheet debe existir una hoja llamada **"Fórmulas_BOM"** (Bill of Materials) con la siguiente estructura:

| TIPO_MUEBLE | COMPONENTE     | DESCRIPCION                   | FORMULA_CALCULO                                      | CATEGORIA_INSUMO | UNIDAD |
| ----------- | -------------- | ----------------------------- | ---------------------------------------------------- | ---------------- | ------ |
| Mesa        | Tapa           | Superficie principal          | largo × ancho (en m²) → convertir a placas MDF    | MDF 18mm         | placas |
| Mesa        | Laterales      | 2 laterales                   | 2 × (alto × profundidad) → convertir a placas MDF | MDF 18mm         | placas |
| Mesa        | Fondo          | Panel trasero                 | largo × alto → convertir a placas Fondo 3mm        | Fondo 3mm        | placas |
| Mesa        | Filo tapa      | Canto perimetral tapa         | 2×(largo + ancho) en metros lineales                | Filo/Canto       | metros |
| Mesa        | Filo laterales | Canto bordes vistos laterales | [fórmula]                                           | Filo/Canto       | metros |

> **⚠️ PLACEHOLDER — COMPLETAR** : Las fórmulas exactas de cada tipo de mueble deben ser provistas por el dueño de la mueblería. Esta hoja está preparada para ser completada manualmente. La ubicación es: Google Sheet principal → Hoja "Fórmulas_BOM".

### Lógica de conversión placa-piezas

Para calcular cuántas placas enteras se necesitan a partir de las piezas:

* Tamaño placa MDF estándar: **2600 × 1830 mm**
* Tamaño placa Fondo estándar: **2600 × 1830 mm**
* Filo fino: rollo de **100 metros lineales** (22mm)
* Filo grueso: rollo de **50 metros lineales** (45mm)

> **⚠️ PLACEHOLDER — COMPLETAR** : Definir si el cálculo de aprovechamiento de placa será:
>
> * **Opción A (simple)** : calcular área total de piezas ÷ área de placa, redondear para arriba. Menos preciso pero más fácil.
> * **Opción B (avanzado)** : integrar un optimizador de corte que considere el layout real de las piezas en la placa. Más preciso, más complejo.
>   Por ahora implementar Opción A. Dejar preparada la estructura para migrar a Opción B en el futuro.

### El motor debe:

1. Recibir: tipo de mueble + medidas + color + cantidad
2. Buscar la fórmula en "Fórmulas_BOM"
3. Calcular los materiales necesarios para la cantidad pedida
4. Consultar stock actual de cada material en el color elegido
5. Devolver: lista de materiales con cantidad necesaria vs. disponible
6. Clasificar cada insumo como: ✅ suficiente / ⚠️ justo (queda menos del mínimo después) / 🔴 insuficiente

---

## MÓDULO 3 — Base de datos de stock (Google Sheets)

### Estructura de la Sheet principal

La Google Sheet debe tener las siguientes hojas:

#### Hoja 1: "Stock" (base de datos principal de insumos)

Columnas exactas:

| # | CATEGORÍA | PRODUCTO/COLOR | MEDIDA/VARIANTE | SKU | STOCK | STOCK_MINIMO | PRECIO_COSTO | PRECIO_VENTA | MARGEN_% | VALOR_STOCK | PROVEEDOR | NOTAS |
| - | ---------- | -------------- | --------------- | --- | ----- | ------------ | ------------ | ------------ | -------- | ----------- | --------- | ----- |

* **STOCK_MINIMO** : columna nueva a completar. Cuando STOCK < STOCK_MINIMO → alerta.

> **⚠️ PLACEHOLDER — COMPLETAR** : El dueño debe definir el stock mínimo de cada insumo. Mientras tanto, dejar la columna vacía y que el sistema la ignore si está vacía (no generar alertas para insumos sin mínimo definido).

Categorías del catálogo:

* MDF 18mm (placas melamínicas)
* Fondo 3mm (placas de fondo)
* Filo/Canto (filos finos 22mm y gruesos 45mm)
* [Otras categorías que existan: herrajes, tornillería, adhesivos, etc.]

#### Hoja 2: "Movimientos" (log de todas las operaciones)

| TIMESTAMP | TIPO_MOVIMIENTO | SKU | PRODUCTO | CANTIDAD | STOCK_ANTERIOR | STOCK_NUEVO | PRECIO_UNITARIO | PROVEEDOR | PEDIDO_REF | CANAL | EDITADO | FECHA_EDICION |
| --------- | --------------- | --- | -------- | -------- | -------------- | ----------- | --------------- | --------- | ---------- | ----- | ------- | ------------- |

* **TIPO_MOVIMIENTO** : COMPRA / CONSUMO_PEDIDO / AJUSTE_MANUAL / EDICION
* **PEDIDO_REF** : si fue por un pedido, referencia al ID del pedido
* **CANAL** : TELEGRAM / FORMULARIO_WEB
* **EDITADO** : TRUE/FALSE — si fue modificado después
* **FECHA_EDICION** : timestamp de la última edición (si aplica)

#### Hoja 3: "Pedidos" (registro de pedidos de clientes)

| ID_PEDIDO | FECHA | TIPO_MUEBLE | MEDIDAS | COLOR | CANTIDAD | ESTADO | MATERIALES_JSON | FALTANTES | NOTAS |
| --------- | ----- | ----------- | ------- | ----- | -------- | ------ | --------------- | --------- | ----- |

* **ESTADO** : PENDIENTE_MATERIAL / EN_PRODUCCION / COMPLETADO / CANCELADO
* **MATERIALES_JSON** : lista de materiales calculados por el motor (JSON stringificado)
* **FALTANTES** : si hubo insumos faltantes, cuáles y cuánto

#### Hoja 4: "Usuarios_Autorizados"

| TELEGRAM_ID | NOMBRE      | ROL   | ACTIVO |
| ----------- | ----------- | ----- | ------ |
| 123456789   | Juan Dueño | ADMIN | TRUE   |
| 987654321   | Pedro Socio | ADMIN | TRUE   |

* Solo los TELEGRAM_ID que figuren acá con ACTIVO = TRUE pueden usar el bot
* Si alguien no autorizado intenta usarlo → respuesta: "⛔ No estás autorizado para usar este sistema. Contactá al administrador."

#### Hoja 5: "Fórmulas_BOM" (descrita en Módulo 2)

#### Hoja 6: "Proveedores"

| ID_PROVEEDOR | NOMBRE | TELEFONO | EMAIL | DIRECCION | CATEGORIAS                | NOTAS           |
| ------------ | ------ | -------- | ----- | --------- | ------------------------- | --------------- |
| PROV-001     | Masisa | +54...   | ...   | ...       | MDF 18mm, Fondo 3mm       | Entrega en 48hs |
| PROV-002     | Egger  | +54...   | ...   | ...       | MDF 18mm, Fondo 3mm, Filo | ...             |

#### Hoja 7: "Config"

| PARAMETRO          | VALOR           | DESCRIPCION                        |
| ------------------ | --------------- | ---------------------------------- |
| ALERTA_EMAIL       | email@gmail.com | Email para recibir reportes        |
| REPORTE_FRECUENCIA | SEMANAL         | DIARIO / SEMANAL / QUINCENAL       |
| REPORTE_DIA        | LUNES           | Día de envío del reporte semanal |
| REPORTE_HORA       | 08:00           | Hora de envío                     |
| MONEDA             | ARS             | Moneda para precios                |

---

## MÓDULO 4 — Movimientos y actualización de stock

### Reglas de negocio para movimientos:

1. **COMPRA** : suma al stock. Actualiza PRECIO_COSTO si el nuevo precio es distinto (y registra el cambio).
2. **CONSUMO_PEDIDO** : resta del stock. Vinculado a un ID_PEDIDO. Solo se ejecuta tras confirmación.
3. **AJUSTE_MANUAL** : suma o resta para correcciones. Requiere nota obligatoria explicando el motivo.
4. **EDICION** : modifica un movimiento anterior. El original queda con EDITADO=TRUE y se registra la fecha.

### Validaciones obligatorias:

* **Stock negativo** : NUNCA permitir que el stock quede en negativo. Si una operación lo llevaría a negativo → rechazar y avisar.
* **SKU inválido** : si el usuario ingresa un SKU que no existe → "No encontré ese insumo. ¿Quisiste decir [sugerencias]?"
* **Cantidad = 0 o negativa** : rechazar → "La cantidad debe ser mayor a 0."
* **Doble confirmación** : todo movimiento requiere confirmación explícita antes de aplicarse.
* **Formato de precio** : validar que sea numérico y positivo. Aceptar formatos argentinos (punto como separador de miles, coma como decimal).

---

## MÓDULO 5 — Alertas y reportes

### Alerta de stock bajo (automática)

* **Trigger** : cada vez que se registra un CONSUMO_PEDIDO o al momento del reporte periódico
* **Condición** : STOCK < STOCK_MINIMO (solo para insumos que tengan mínimo definido)
* **Clasificación** :
* ⚠️ Stock bajo: STOCK < STOCK_MINIMO pero > 0
* 🔴 Sin stock: STOCK = 0
* **Destino** : Gmail (dirección configurada en hoja Config)
* **Contenido del email** :

```
Asunto: ⚠️ Alerta de Stock — [FECHA]

Insumos con stock bajo o agotado:

🔴 SIN STOCK:
- [SKU] [Producto] — Stock: 0 — Proveedor sugerido: [Proveedor] — Costo estimado reposición (última compra × stock mínimo): $XX.XXX

⚠️ STOCK BAJO:
- [SKU] [Producto] — Stock: X — Mínimo: Y — Faltan: Z unidades — Proveedor: [Proveedor] — Costo estimado: $XX.XXX

💰 COSTO TOTAL ESTIMADO DE REPOSICIÓN: $XXX.XXX
```

### Alerta por pedido con faltantes (inmediata)

Cuando se registra un pedido y faltan materiales:

```
Asunto: 🔨 Pedido #[ID] — Faltan materiales

Pedido: [TIPO_MUEBLE] [MEDIDAS] en [COLOR] × [CANTIDAD]

Materiales faltantes para completar este pedido:

| Insumo | Necesario | Disponible | Faltante | Proveedor | Costo estimado |
|--------|-----------|------------|----------|-----------|----------------|
| MDF Blanco | 4 | 2 | 2 | Masisa/Egger | $91.296 |
| Filo Blanco 22mm | 1 | 0 | 1 | Egger/Rehau | $6.971 |

💰 COSTO TOTAL ESTIMADO DE COMPRA: $98.267

Proveedor principal sugerido: Masisa/Egger (cubre 2 de 2 insumos faltantes)
```

### Reporte periódico programado

* **Frecuencia** : configurable (diario/semanal/quincenal) desde hoja Config
* **Destino** : Gmail
* **Contenido** :

1. Resumen de movimientos del período (compras, consumos, ajustes)
2. Top 10 insumos más consumidos
3. Insumos con stock bajo o agotado
4. Valor total del stock actual
5. Pedidos en estado PENDIENTE_MATERIAL

---

## MÓDULO 6 — Autorización

### Lógica:

1. Cuando alguien envía un mensaje al bot de Telegram, el sistema obtiene su `telegram_id`
2. Busca ese ID en la hoja "Usuarios_Autorizados"
3. Si está y ACTIVO = TRUE → permite operar
4. Si no está o ACTIVO = FALSE → responde: "⛔ No estás autorizado para usar este sistema. Contactá al administrador."
5. Para el formulario web: implementar un campo "código de acceso" o autenticación simple (un PIN compartido como MVP, con posibilidad de migrar a login real)

### Agregar/quitar usuarios:

* Se hace editando directamente la hoja "Usuarios_Autorizados" en Google Sheets
* No es necesario hacerlo desde el bot (simplifica el flujo)

---

## MÓDULO 7 — Dashboard visual (Google Sheets)

### Hoja "Dashboard" con gráficos automáticos:

1. **Gráfico de barras** : Stock actual por categoría (MDF, Fondos, Filos, etc.)
2. **Gráfico de torta** : Valor del stock por categoría ($ invertido en cada tipo de insumo)
3. **Semáforo visual** : tabla con todos los insumos coloreados por estado:

* 🟢 Verde: stock > stock mínimo × 1.5
* 🟡 Amarillo: stock entre stock mínimo y stock mínimo × 1.5
* 🔴 Rojo: stock < stock mínimo

1. **Gráfico de líneas** : evolución del consumo de los últimos 30 días (top 5 insumos más usados)
2. **KPIs en cards** : stock total (unidades), valor total ($), cantidad de insumos en rojo, pedidos pendientes de material
3. **Tabla de últimos movimientos** : últimos 20 movimientos registrados

Los gráficos deben actualizarse automáticamente cuando cambian los datos (usar fórmulas nativas de Google Sheets que referencien las hojas de Stock y Movimientos).

---

## Especificaciones técnicas

### Stack:

* **Orquestador** : n8n (self-hosted o cloud)
* **Base de datos** : Google Sheets (API v4)
* **Bot** : Telegram Bot API (via n8n node nativo)
* **Email** : Gmail (via n8n node nativo)
* **Formulario web** : Google Apps Script + HTML Service (hosting gratuito) O Netlify/Vercel con frontend estático que llame a un webhook de n8n
* **Dashboard** : Google Sheets nativo (gráficos + formato condicional)

### Flujos de n8n necesarios:

1. **flow_telegram_bot** : webhook de Telegram → router por comando → lógica de cada operación → respuesta
2. **flow_formulario_webhook** : webhook del formulario → misma lógica que el bot → respuesta JSON
3. **flow_calculo_materiales** : subflow que recibe pedido → consulta fórmulas BOM → calcula → devuelve lista
4. **flow_reporte_programado** : cron trigger → consulta stock → genera reporte → envía por Gmail
5. **flow_alerta_stock_bajo** : se ejecuta después de cada consumo → verifica mínimos → alerta si corresponde

### Principios de diseño:

* **Nodos nativos primero** : usar nodos nativos de n8n (Google Sheets, Telegram, Gmail) antes que Code nodes o HTTP Request
* **Nombres descriptivos** : cada nodo debe tener nombre claro que explique qué hace
* **Error handling** : cada flujo debe tener manejo de errores con notificación al admin
* **Modular** : los subflows deben ser reutilizables (el cálculo de materiales lo usan tanto el bot como el formulario)
* **Idempotente** : registrar un movimiento dos veces no debe duplicar el efecto (usar ID de transacción)

---

## Validaciones y edge cases a contemplar

1. **Búsqueda fuzzy** : si el usuario escribe "blnaco" en vez de "blanco", sugerir la coincidencia más cercana
2. **Múltiples resultados** : si la búsqueda devuelve más de un insumo, mostrar lista y pedir que elija
3. **Placa compartida entre piezas** : si un pedido necesita 2 piezas que caben en la misma placa, no contar 2 placas
4. **Color sin stock** : si el color elegido no tiene stock de algún componente (ej: tiene MDF pero no fondo), avisarlo antes de confirmar
5. **Actualización de precios** : si al registrar una compra el precio cambió respecto al registrado, preguntar si actualizar el precio en la ficha base
6. **Concurrencia** : si dos usuarios registran movimientos al mismo tiempo, evitar race conditions (usar locking o queue)
7. **Timeout del bot** : si el usuario no responde en 5 minutos, cancelar la operación en curso y volver al menú
8. **Formato argentino** : aceptar precios con punto como separador de miles y coma como decimal ($45.648,50)
9. **Unidades mixtas** : el filo se mide en metros lineales, las placas en unidades, los tornillos en unidades — respetar la unidad de cada categoría

---

## Entregables esperados

1. **JSON de cada flujo de n8n** importable directamente
2. **Google Sheet template** con todas las hojas, columnas, fórmulas y formatos condicionales listos
3. **Código del formulario web** (HTML + JS + CSS) listo para deployar
4. **Documentación de setup** : paso a paso para configurar el bot de Telegram, conectar Google Sheets, deployar el formulario
5. **Manual de usuario** : guía simple para el dueño y empleados explicando cómo usar cada función

---

## Notas adicionales

* El tono del bot debe ser  **profesional pero amigable** , sin ser robótico. Ejemplo: "Dale, registré la compra. Te quedaron 25 placas de MDF Blanco en stock 👍" en lugar de "Operación registrada exitosamente. Stock actualizado."
* El sistema debe estar preparado para  **escalar** : agregar nuevas categorías de insumos, nuevos tipos de mueble, nuevos usuarios, sin rediseñar.
* Toda la data queda en Google Sheets para que el dueño pueda verla, editarla y auditarla directamente si quiere.
* **Prioridad 1** : que funcione el ciclo básico (compra → stock sube, pedido → stock baja, alerta si falta).
* **Prioridad 2** : motor de cálculo de materiales, reportes, dashboard.
* **Prioridad 3** : formulario web, optimización de corte, features avanzados.
