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
