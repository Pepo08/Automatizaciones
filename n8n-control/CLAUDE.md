## Contexto del proyecto

Este repositorio se usa para trabajar workflows de n8n como código.

Objetivos:

- exportar workflows desde n8n
- generar una versión cruda de backup
- generar una versión limpia para revisión y edición
- generar resúmenes para análisis rápido
- después proponer refactors y cambios controlados

## Reglas de trabajo

1. Nunca editar archivos dentro de `workflows/raw/`
2. Priorizar análisis y edición sobre `workflows/clean/`
3. Consultar también `workflows/summaries/` antes de proponer cambios grandes
4. No tocar `.env`
5. No exponer credenciales ni secretos
6. Mantener cambios mínimos, claros y trazables
7. No borrar nodos ni conexiones sin explicar impacto
8. Si se modifica un workflow limpio, considerar también regenerar su summary
9. No asumir que un workflow está bien diseñado solo porque funciona
10. Separar, cuando tenga sentido, parsing, validación, branching, commit y notificación

## Flujo esperado

Cuando se trabaje con un workflow:

1. identificar el archivo limpio correspondiente
2. leer el summary si existe
3. entender trigger, nodos clave, servicios externos y conexiones
4. proponer cambios puntuales
5. explicar impacto de cada cambio
6. preservar consistencia estructural del JSON

## Qué debe priorizar Claude

- claridad arquitectónica
- cambios determinísticos
- reducción de acoplamiento
- nombres consistentes
- separación de responsabilidades
- diffs pequeños y auditables

## Qué no debe hacer Claude

- editar raw
- inventar IDs o conexiones sin revisar el JSON real
- mezclar múltiples cambios grandes sin explicarlos
- reestructurar todo si el pedido es puntual
- introducir secretos en archivos del repo

## Convenciones del repo

- un workflow por archivo
- `raw` = exportación exacta desde n8n
- `clean` = versión para revisión y edición
- `summaries` = vista rápida para navegación y análisis
- `scripts` = automatizaciones auxiliares del repo
- `snippets` = fragmentos reutilizables, no scripts operativos principales

## Tareas típicas a resolver

- analizar workflow
- resumir arquitectura
- detectar nodos clave
- detectar servicios externos
- detectar puntos de acoplamiento
- proponer refactors
- comparar workflows
- documentar comportamiento
- preparar cambios seguros para aplicar después en n8n

## Forma preferida de responder dentro de este proyecto

- concreta
- técnica
- sin relleno
- enfocada en impacto real
- con pasos accionables

## Skills de n8n (referencia obligatoria al generar workflows)

Las siguientes guías están en `skills/` y DEBEN consultarse al generar cualquier workflow de n8n:

1. `skills/n8n-workflow-generator-checklist.md` — Proceso obligatorio paso a paso
2. `skills/n8n-workflow-architecture.md` — Cuántos workflows, cuándo subflows
3. `skills/n8n-data-flow-engine.md` — Cómo fluyen los items entre nodos
4. `skills/n8n-connection-rules.md` — Reglas de conexión, fan-in requiere Merge
5. `skills/n8n-merge-patterns.md` — Modos del Merge v3
6. `skills/n8n-json-structure.md` — Formato JSON + typeVersions de esta instancia
7. `skills/n8n-sticky-notes-layout.md` — Organización visual
8. `skills/n8n-subflow-design.md` — Patrones de Execute Workflow

**Regla crítica de esta instancia n8n:**
- Google Sheets v4.7, IF v2.3, Switch v3.3 (requieren typeValidation/version)
- NO incluir credentials vacías (crashean el editor)
- Máximo 3 conexiones entrantes a un nodo
- reply_markup de Telegram como STRING (JSON.stringify), no objeto anidado
