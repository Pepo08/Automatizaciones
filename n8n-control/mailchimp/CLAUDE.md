# CLAUDE.md

## Contexto general

Este repo contiene automatizaciones en n8n y proyectos relacionados.
La prioridad es trabajar de forma ordenada, modular y sin romper workflows existentes.

El usuario trabaja con:

- Visual Studio Code
- Claude Code
- n8n
- repositorios con múltiples automatizaciones
- enfoque práctico: crear, ajustar, subir a n8n y probar

## Forma de trabajo esperada

Trabajá como si fueras responsable técnico del proyecto dentro del repo.

### Reglas de trabajo

- No romper nada que ya funcione.
- No modificar proyectos existentes salvo que sea estrictamente necesario.
- Todo proyecto nuevo debe quedar aislado en su propia carpeta.
- Priorizar soluciones simples, mantenibles y fáciles de probar.
- Evitar sobrearquitectura.
- Si faltan credenciales o IDs reales, dejar placeholders claros.
- No asumir datos sensibles reales.
- No pedir confirmación en cada micro paso.
- Avanzar de punta a punta con criterio técnico.
- Documentar lo suficiente para que después se pueda subir y probar en n8n sin confusión.

## Estándar de entrega

Cada nuevo proyecto dentro del repo debe incluir, como mínimo:

1. **Carpeta propia**

   - nombre claro y separado de otros proyectos
2. **Workflow exportable de n8n**

   - JSON listo para importar o revisar
   - nombre de nodos claro
   - estructura limpia
3. **Documentación**

   - objetivo del flujo
   - entradas esperadas
   - salidas esperadas
   - variables a completar
   - credenciales necesarias
   - pasos de prueba
4. **Ejemplos**

   - ejemplo de input
   - ejemplo de transformación
   - ejemplo de output esperado
5. **Separación de configuración**

   - usar placeholders para IDs, API keys, list IDs, tags, etc.
   - no hardcodear valores sensibles reales

---

# Proyecto actual a construir

## Nombre tentativo

`mailchimp-list-maintenance`

## Objetivo del proyecto

Construir un workflow de n8n para mantenimiento de bases/listados de Mailchimp.

La idea es que el flujo:

- tome una fuente de contactos estructurada
- compare esa fuente con el estado actual de Mailchimp
- detecte:
  - contactos nuevos para crear
  - contactos existentes para actualizar
  - contactos que ya no deben estar y deben removerse o marcarse
- deje la operación lista para correr de forma controlada y testeable

## Alcance funcional esperado

### Entrada

La fuente de entrada debe ser clara y fácilmente reemplazable.Puede ser una de estas:

- Google Sheets
- CSV
- JSON estático de prueba
- API
- otra fuente estructurada

Para la primera versión, priorizar simplicidad.
Si hay que elegir una fuente dummy o fácil de testear, hacerlo.

### Normalización

Antes de comparar con Mailchimp, normalizar los datos de entrada a un esquema único.

Campos base esperados por contacto:

- email
- first_name
- last_name
- phone
- status
- tags
- merge_fields
- external_id u otro identificador si aporta valor

### Reglas mínimas

- email válido como clave principal
- deduplicación de entrada
- normalización de casing y espacios
- comparación robusta contra Mailchimp
- clasificación por acción:
  - `toCreate`
  - `toUpdate`
  - `toArchive` o `toRemove`
  - `unchanged`
  - `invalid`

### Resultado esperado del flujo

El workflow debe poder:

1. leer la fuente
2. normalizar
3. consultar Mailchimp
4. comparar
5. separar por acciones
6. ejecutar las acciones o dejarlas listas según modo de prueba
7. devolver un resumen final

## Modos de ejecución

El flujo debe contemplar dos modos:

### 1. Dry run / preview

No ejecuta cambios reales.
Solo informa:

- cuántos se crearían
- cuántos se actualizarían
- cuántos se removerían/archivarían
- cuáles quedaron inválidos
- ejemplos de cada grupo

### 2. Apply / ejecución real

Ejecuta cambios reales en Mailchimp.

La forma más simple de controlar esto puede ser una variable tipo:

- `DRY_RUN=true/false`

## Requisitos técnicos

### n8n

El workflow debe estar armado para n8n con nodos claros y nombres legibles.

### Naming

Usar nombres de nodos descriptivos, por ejemplo:

- `Manual Trigger`
- `Load Source Contacts`
- `Normalize Contacts`
- `Get Mailchimp Audience Members`
- `Compare Source vs Mailchimp`
- `Split To Create`
- `Split To Update`
- `Split To Archive`
- `Apply Mailchimp Changes`
- `Build Summary`

### Código

Si se usan nodos Code/Function:

- escribir JavaScript claro
- evitar lógica innecesariamente rebuscada
- dejar comentarios mínimos pero útiles
- exponer variables para que luego sea fácil mapear en n8n

### Mailchimp

Contemplar placeholders para:

- API Key
- Server Prefix
- Audience/List ID
- status por defecto
- tags opcionales
- merge fields

No asumir endpoints mágicos sin documentarlos.

## Estructura de carpeta sugerida

Crear una carpeta nueva y aislada.
Ejemplo sugerido:

/n8n-control/mailchimp-list-maintenance/

- README.md
- CLAUDE_NOTES.md
- workflow/
  - mailchimp-list-maintenance.json
- samples/
  - source-contacts.sample.json
  - expected-output.sample.json
- docs/
  - flow-overview.md
  - setup.md
  - testing.md

Si la estructura real del repo sugiere una mejor convención, adaptarla sin romper consistencia.

## Regla especial para workflows de marketing / Mailchimp

Cuando el proyecto esté orientado a Mailchimp, audiencias, campañas, listas o mantenimiento de contactos:

- No entregar solo un flujo abstracto.
- No resolver todo con Code nodes si existen nodos de integración reales más adecuados.
- Usar nodos reales de Mailchimp para las acciones operativas siempre que sea viable.
- Diseñar el workflow pensando en sincronización real y segmentación futura.
- El modelo de datos debe servir no solo para alta/baja/update, sino también para campañas segmentadas posteriores.

### El workflow debe contemplar, como mínimo

- fuente de contactos externa
- normalización
- validación
- deduplicación
- comparación con audiencia actual
- clasificación por acción
- ejecución en Mailchimp
- reporte final

### El modelo de datos debe estar orientado a marketing

Siempre que sea razonable, contemplar:

- email
- first_name
- last_name
- phone
- birthday
- zone
- city
- country
- customer_type
- role
- representative
- status
- tags
- merge_fields
- source_system
- updated_at

### Casos de uso futuros que deben tenerse en cuenta al diseñar

- campañas de cumpleaños
- campañas por zona
- campañas por rebate/promoción
- campañas por tipo de cliente
- campañas para representantes
- limpieza y mantenimiento periódico de audiencia

### Requisito de calidad

Si el primer diseño queda demasiado genérico, abstracto o limitado a una demo débil, debe ser mejorado antes de darse por terminado.
La prioridad es una base reutilizable, clara y operativa.

## Entregables obligatorios

### 1. Workflow JSON

Un archivo exportable de n8n con el flujo armado.

### 2. README.md

Debe explicar:

- qué hace el flujo
- cómo configurarlo
- qué completar
- cómo probarlo
- cómo correr dry run
- cómo ejecutar cambios reales

### 3. Archivo de muestras

Ejemplos de input y output.

### 4. Notas técnicas

Qué decisiones tomaste y por qué.

## Criterios de calidad

La solución debe ser:

- simple
- estable
- entendible
- modular
- testeable
- fácil de subir a n8n

Evitar:

- dependencias innecesarias
- ramas duplicadas
- lógica escondida
- nombres genéricos confusos
- mezcla con otros proyectos del repo

## Qué hacer al empezar

1. Analizar la estructura actual del repo.
2. Detectar dónde conviene ubicar este nuevo proyecto.
3. Crear la carpeta del proyecto sin tocar los existentes.
4. Armar la documentación base.
5. Crear el workflow inicial de n8n.
6. Dejar placeholders claros para configuración.
7. Preparar un modo de prueba simple.
8. Entregar un resumen final de:
   - archivos creados
   - archivos modificados
   - variables pendientes de completar
   - pasos para importar/subir el workflow a n8n

## Qué NO hacer

- No modificar rendiciones ni otros proyectos existentes.
- No mezclar archivos del nuevo flujo con carpetas viejas.
- No asumir credenciales reales.
- No dejar lógica clave sin documentar.
- No hacer una solución “demasiado enterprise” para algo que debe ser práctico.
- No pedirme aprobación por cada cambio chico.

## Resultado ideal

Quiero terminar con un proyecto nuevo dentro del repo que ya esté listo para:

- revisar
- subir a n8n
- completar credenciales/IDs
- probar primero en dry run
- luego ejecutar en real
