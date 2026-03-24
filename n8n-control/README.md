# n8n-control

Repositorio para exportar, limpiar, resumir, versionar y editar workflows de n8n de forma controlada.

## Objetivo

Trabajar los workflows de n8n como código:

- exportarlos desde n8n
- guardar una copia cruda
- generar una versión limpia para Git y edición
- crear resúmenes legibles
- después editar y volver a aplicar cambios

## Estructura

```txt
n8n-control/
  workflows/
    raw/
    clean/
    summaries/
  scripts/
    list-workflows.js
    export-workflow.js
    sanitize-workflow.js
    summarize-workflow.js
  snippets/
  docs/
  .env
  .gitignore
  README.md
  CLAUDE.md
```
