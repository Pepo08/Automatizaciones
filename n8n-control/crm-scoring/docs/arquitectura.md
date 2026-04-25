# CRM Scoring - Arquitectura del Workflow

## Diagrama de Flujo

```
┌──────────────┐   ┌───────────────────┐
│Inicio Manual │──▶│                   │
└──────────────┘   │  Leer Contactos   │
┌──────────────┐   │  (Google Sheets)  │
│Trigger Cron  │──▶│                   │
└──────────────┘   └────────┬──────────┘
                            ▼
                   ┌───────────────────┐
                   │ Normalizar Datos  │  ← Mapeo ES/EN, limpieza, validación
                   └────────┬──────────┘
                            ▼
                   ┌───────────────────┐
                   │  Calcular Score   │  ← Reglas modulares (recencia, interacciones, origen, cargo)
                   └────────┬──────────┘
                            ▼
                   ┌───────────────────┐
                   │ Clasificar Leads  │  ← HOT / WARM / COLD / DESCARTADO
                   └────────┬──────────┘
                            ▼
                   ┌───────────────────┐
                   │  Obtener Miembros │  ← Get All de lista Mailchimp
                   │    Mailchimp      │
                   └────────┬──────────┘
                            ▼
                   ┌───────────────────┐
                   │ Comparar y Decidir│  ← Detecta: nuevo / cambios / sin cambios / unsub
                   └────────┬──────────┘
                            ▼
                   ┌───────────────────┐
                   │ Switch: Acción    │
                   └───┬─────┬─────┬───┘
                       ▼     ▼     ▼
                   ┌─────┐┌─────┐┌─────┐
                   │Crear││Upd. ││NoOp │
                   │ MC  ││ MC  ││     │
                   └──┬──┘└──┬──┘└──┬──┘
                      └──────┼──────┘
                             ▼
                   ┌───────────────────┐
                   │ Reagrupar (Merge) │
                   └───┬───────────┬───┘
                       ▼           ▼
              ┌─────────────┐ ┌──────────────────┐
              │Filtrar+Tags │ │Preparar Sheet Upd│
              │  Mailchimp  │ └────────┬─────────┘
              └─────────────┘          ▼
                             ┌──────────────────┐
                             │ Actualizar Sheet  │
                             └────────┬─────────┘
                                      ▼
                             ┌──────────────────┐
                             │ Generar Reporte   │
                             └──────────────────┘
```

## Nodos y Responsabilidades

| # | Nodo | Tipo | Función |
|---|------|------|---------|
| 1 | Inicio Manual | Manual Trigger | Ejecución bajo demanda |
| 2 | Trigger Programado | Schedule Trigger | Ejecución automática cada 6hs |
| 3 | Leer Contactos | Google Sheets | Lee todos los contactos del sheet fuente |
| 4 | Normalizar Datos | Code | Mapea columnas ES/EN, limpia datos, valida email |
| 5 | Calcular Score | Code | Aplica reglas de scoring (5 categorías de puntos) |
| 6 | Clasificar Leads | Code | Asigna categoría: HOT/WARM/COLD/DESCARTADO |
| 7 | Obtener Miembros MC | Mailchimp | Trae todos los miembros actuales de la lista |
| 8 | Comparar y Decidir | Code | Compara contactos con MC, decide crear/actualizar/ignorar |
| 9 | Switch: Acción | Switch | Rutea a la rama correcta según decisión |
| 10 | Crear en Mailchimp | Mailchimp | Crea miembro nuevo con merge fields |
| 11 | Actualizar en MC | Mailchimp | Actualiza merge fields de miembro existente |
| 12 | Sin Cambios | NoOp | Pasa contactos sin cambios (para tracking) |
| 13 | Reagrupar | Merge | Reúne las 3 ramas en un solo flujo |
| 14 | Filtrar para Tags | Code | Filtra solo creados/actualizados, genera MD5 hash |
| 15 | Aplicar Tags MC | HTTP Request | POST de tags (HOT/WARM/COLD) vía API Mailchimp |
| 16 | Preparar Update Sheet | Code | Formatea datos para escribir en Sheet |
| 17 | Actualizar Sheet | Google Sheets | Escribe score, categoría y fecha en el sheet |
| 18 | Generar Reporte | Code | Genera resumen con conteos y lista de HOT leads |

## Reglas de Idempotencia

1. **Comparación antes de acción**: Cada contacto se compara con su estado actual en Mailchimp antes de decidir
2. **Respeto a unsubscribed**: Si un contacto está `unsubscribed` o `cleaned` en MC, NO se toca
3. **Detección de cambios**: Solo se actualiza si hay diferencias reales en merge fields o tags
4. **Upsert en Sheet**: Se usa `appendOrUpdate` con email como clave para no duplicar filas

## Configuración Requerida

Antes de importar:
1. Configurar credenciales de **Google Sheets OAuth2**
2. Configurar credenciales de **Mailchimp API**
3. Seleccionar el **Spreadsheet** y **Sheet** en los nodos de Sheets
4. Configurar el **List ID** de Mailchimp en los nodos correspondientes
5. Opcionalmente, crear merge fields custom en Mailchimp (EMPRESA, CARGO, SCORE)

## Escalabilidad

- El scoring es modular: agregar reglas es editar constantes en el Code node
- Los umbrales son independientes: ajustar sin tocar lógica
- La normalización soporta columnas en ES e EN automáticamente
- El `config/mapping.json` sirve como referencia de configuración
