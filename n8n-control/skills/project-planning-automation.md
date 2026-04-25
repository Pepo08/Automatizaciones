---
name: project-planning-automation
description: >
  Framework para planificar proyectos de automatización ANTES de construir.
  Cubre: relevamiento de requisitos, definición de alcance, identificación de
  sistemas, modelo de datos, y plan de implementación por fases. ACTIVAR SIEMPRE
  como primer paso cuando el usuario describa un proyecto nuevo de automatización,
  antes de tocar n8n o código. Activar cuando mencione: proyecto nuevo, "quiero 
  automatizar", "necesito un sistema de", planificar, relevamiento, requisitos,
  alcance, "por dónde empiezo", MVP, fases, o cualquier descripción de un
  sistema que todavía no existe.
---

# Project Planning for Automation

## Paso 1: Relevamiento rápido (5 preguntas)

Antes de diseñar CUALQUIER automatización, responder:

1. **¿Qué proceso manual reemplaza?** — Describir el flujo actual paso a paso
2. **¿Quiénes son los usuarios?** — Quién interactúa, quién recibe output
3. **¿Qué sistemas ya existen?** — Sheets, ERPs, apps, bases de datos
4. **¿Cuál es el volumen?** — Cuántas transacciones/día, cuántos usuarios
5. **¿Qué es el MVP?** — Lo mínimo que resuelve el 80% del problema

## Paso 2: Modelo de datos

Antes de tocar n8n, definir las "tablas" (hojas de Sheets, tablas de DB):

```
ENTIDADES:
- [Entidad 1]: campos, clave primaria, relaciones
- [Entidad 2]: campos, clave primaria, relaciones
- ...

RELACIONES:
- [Entidad 1] 1→N [Entidad 2] (por campo X)
```

## Paso 3: Definir interfaces

¿Cómo entra y sale la información?

| Interfaz | Tipo | Usuarios | Datos |
|----------|------|----------|-------|
| Bot Telegram | Input/Output | Operarios | Comandos + respuestas |
| Formulario web | Input | Externos | Datos de pedido |
| Email reportes | Output | Gerencia | Métricas semanales |
| Google Sheets | Storage | Sistema | Datos persistentes |

## Paso 4: Plan de fases

### Fase 1 — MVP (1-2 semanas)
- Funcionalidad core que resuelve el problema principal
- 1 workflow, datos en Sheets, sin reportes elaborados
- Testing con datos reales

### Fase 2 — Completar (1-2 semanas)
- Agregar funcionalidades secundarias
- Error handling completo
- Alertas y notificaciones

### Fase 3 — Pulir (1 semana)
- Reportes
- Optimizaciones
- Documentación

## Paso 5: Estimar complejidad

| Complejidad | Nodos totales | Workflows | Tiempo estimado |
|------------|--------------|-----------|----------------|
| Simple | 5-15 | 1 | 2-4 horas |
| Media | 15-35 | 1-2 | 1-2 días |
| Compleja | 35-60 | 2-3 + subflows | 3-5 días |
| Muy compleja | 60+ | 3-5 + subflows | 1-2 semanas |

## Template de documento de proyecto

```markdown
# [Nombre del proyecto]

## Objetivo
[1 párrafo: qué problema resuelve]

## Usuarios
- [Rol 1]: [qué hace]
- [Rol 2]: [qué hace]

## Modelo de datos
[Tablas/hojas con campos]

## Interfaces
[Cómo entra/sale la info]

## Arquitectura de workflows
[Diagrama: cuántos workflows, triggers, relaciones]

## Fases
[MVP → Completar → Pulir]

## Riesgos
[Qué puede salir mal]
```
