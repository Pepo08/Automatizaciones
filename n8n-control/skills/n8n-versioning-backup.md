---
name: n8n-versioning-backup
description: >
  Patrones para versionar y backupear workflows de n8n: exportar JSONs,
  Git integration, naming conventions, changelog, y rollback. Activar
  cuando el usuario mencione: versión, backup, Git, "guardar una copia",
  rollback, "volver a la versión anterior", changelog, historial,
  o gestión de cambios en workflows.
---

# n8n Versioning & Backup

## Naming convention para workflows

```
[proyecto]-[función]-[versión]

Ejemplos:
fontana-bot-stock-v2
fontana-alertas-diarias-v1
fontana-reporte-semanal-v1
```

## Exportar workflows a JSON

### Manual
n8n UI → Workflow → ⋯ → Download

### Automático (workflow que backupea otros)
```
[Schedule: Diario] → [HTTP Request: GET /api/v1/workflows]
  → [Code: Por cada workflow, guardar JSON]
  → [Google Drive: Upload] o [Git commit]
```

## Estructura de carpetas recomendada

```
proyecto/
├── workflows/
│   ├── clean/          ← JSONs limpios listos para importar
│   │   ├── bot-stock.json
│   │   ├── alertas.json
│   │   └── reporte.json
│   ├── raw/            ← Exports directos de n8n (con IDs, etc)
│   └── archive/        ← Versiones anteriores
│       ├── bot-stock-v1.json
│       └── bot-stock-v2.json
├── scripts/            ← Scripts de setup/deploy
├── skills/             ← Skills de Claude
├── docs/               ← Documentación
└── claude.md           ← Prompt principal
```

## Clean vs Raw JSON

**Raw**: Export directo de n8n. Tiene IDs, credentials con IDs específicos, posiciones exactas.

**Clean**: JSON procesado para ser importable en cualquier instancia:
- Credenciales con placeholders
- Sin IDs de ejecución
- Documentado con comments

## Changelog pattern

Mantener un CHANGELOG.md:

```markdown
# Changelog - Bot Stock Fontana

## v3 (2024-01-20)
- Agregado: cálculo BOM con fórmulas de Sheets
- Fix: Merge faltante entre lecturas paralelas
- Mejora: respuestas con formato Markdown

## v2 (2024-01-15)
- Agregado: sesiones multi-paso para compras
- Agregado: autorización por user_id
- Fix: error handling en Google Sheets update

## v1 (2024-01-10)
- Release inicial: compra, consumo, stock query
```
