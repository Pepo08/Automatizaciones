# Mailchimp — Mantenimiento de Audiencia

Workflow de n8n para sincronización y mantenimiento automatizado de audiencias de Mailchimp.
Pensado como base real para campañas de marketing segmentadas.

## Qué hace

1. Carga contactos desde una fuente estructurada (demo JSON, reemplazable por Google Sheets, CSV, API)
2. Normaliza campos: emails a lowercase, birthday a `MM/DD`, trim de espacios, tags a lowercase
3. Valida emails y deduplica por email
4. Consulta la audiencia actual de Mailchimp via API (con paginación)
5. Compara fuente vs Mailchimp y clasifica en 5 grupos:
   - `toCreate` — contactos nuevos a dar de alta
   - `toUpdate` — contactos existentes con campos diferentes
   - `toUnsubscribe` — contactos en Mailchimp que ya no están en la fuente
   - `unchanged` — contactos que no requieren cambios
   - `invalid` — emails inválidos o duplicados
6. Según el modo:
   - **DRY_RUN=true**: genera reporte de preview sin tocar Mailchimp
   - **DRY_RUN=false**: envía cada grupo a su nodo HTTP Request correspondiente

## Arquitectura

```
Trigger → Config → Load Source → Normalize → Validate & Dedup → Fetch MC → Compare → DRY_RUN?
                                                                                        │
                                                                          ┌──────────────┴──────────────┐
                                                                     DRY_RUN=true              DRY_RUN=false
                                                                          │                          │
                                                                   Preview Report          Prepare Items → Switch
                                                                                              │    │    │    │
                                                                                         Create Update Unsub Report
                                                                                          [MC]   [MC]  [MC]    │
                                                                                                          Execution
                                                                                                           Report
```

### 15 nodos

| # | Nodo | Tipo | Función |
|---|---|---|---|
| 1 | Manual Trigger | Trigger | Inicia el flujo |
| 2 | Config | Set | DRY_RUN, list ID, default status |
| 3 | Load Source Contacts | Code | Demo data (reemplazable) |
| 4 | Normalize Contacts | Code | Normaliza email, nombres, birthday, tags |
| 5 | Validate & Deduplicate | Code | Valida emails, deduplica, separa inválidos |
| 6 | **Mailchimp: Get Audience** | **Mailchimp** | **getAll** — descarga todos los miembros |
| 7 | Compare & Classify | Code | Compara y clasifica en 5 grupos |
| 8 | Check DRY_RUN | IF | Rutea por modo |
| 9 | Build Preview Report | Code | Reporte dry run |
| 10 | Prepare Items for Mailchimp | Code | Prepara items individuales para los nodos nativos |
| 11 | Route by Action | Switch | Rutea por _action: create/update/unsubscribe/report |
| 12 | **Mailchimp: Create Member** | **Mailchimp** | **create** — alta + merge fields + tags |
| 13 | **Mailchimp: Update Member** | **Mailchimp** | **update** — actualiza merge fields |
| 14 | **Mailchimp: Unsubscribe** | **Mailchimp** | **update** — cambia status a unsubscribed |
| 15 | Build Execution Report | Code | Reporte final |

## Modelo de datos

Campos soportados por contacto:

| Campo | Merge Field | Uso en segmentación |
|---|---|---|
| email | email_address | Clave principal |
| first_name | FNAME | Personalización |
| last_name | LNAME | Personalización |
| phone | PHONE | Contacto directo |
| birthday | BIRTHDAY (MM/DD) | Campaña de cumpleaños |
| zone | ZONE | Segmentación por región |
| city | CITY | Segmentación por ciudad |
| country | COUNTRY | Segmentación por país |
| customer_type | CTYPE | cliente / prospecto / representante |
| role | ROLE | comprador / representante |
| representative | REP | Campañas por representante |
| tags | tags | Segmentación flexible |
| source_system | - | Trazabilidad (no se envía a MC) |
| updated_at | - | Trazabilidad (no se envía a MC) |

## Inicio rápido

### 1. Importar
Workflows > Import from File > `workflows/clean/mailchimp-list-maintenance.json`

### 2. Crear merge fields en Mailchimp
Audience > Settings > Audience fields > crear: PHONE, BIRTHDAY, ZONE, CITY, COUNTRY, CTYPE, ROLE, REP
(ver detalle en [setup.md](docs/setup.md))

### 3. Configurar credencial Mailchimp en n8n
Settings > Credentials > Add > Mailchimp API > ingresar tu API key.
Después vincular la credencial a los 4 nodos Mailchimp del workflow.

### 4. Completar Config

| Variable | Qué poner |
|---|---|
| `MAILCHIMP_LIST_ID` | ID de tu audiencia |
| `DEFAULT_STATUS` | `subscribed` (default) |
| `DRY_RUN` | `true` para probar, `false` para ejecutar |

> La API key se gestiona como credencial nativa de n8n, no en Config.

### 5. Probar en dry run
`DRY_RUN = true` → ejecutar → revisar Build Preview Report

### 6. Ejecutar real
`DRY_RUN = false` → ejecutar → revisar cada nodo Mailchimp + Build Execution Report

## Estructura del proyecto

```
mailchimp/
  workflows/clean/
    mailchimp-list-maintenance.json     ← workflow n8n (15 nodos)
  docs/
    flow-overview.md                    ← arquitectura técnica detallada
    setup.md                            ← guía de configuración
    testing.md                          ← plan de prueba (5 tests + checklist)
  samples/
    source-contacts.sample.json         ← ejemplo de entrada (8 contactos)
    expected-output.sample.json         ← ejemplo de salida (dry run)
  mappings/
    field-mappings.json                 ← mapeo completo fuente → Mailchimp + casos de segmentación
```

## Campañas soportadas por este modelo

- **Cumpleaños**: segmentar por `BIRTHDAY` = mes actual
- **Por zona**: segmentar por `ZONE` (Litoral, Pampeana, Cuyo, NOA, Patagonia)
- **Por tipo de cliente**: segmentar por `CTYPE` (cliente, prospecto, representante)
- **Por representante**: segmentar por `REP` (campañas dirigidas a clientes de un representante)
- **Por tags**: filtrar por tags específicos (premium, activo, etc)
- **Por ciudad**: segmentar por `CITY` para campañas locales

## Docs adicionales

- [Arquitectura del flujo](docs/flow-overview.md)
- [Setup y configuración](docs/setup.md)
- [Plan de prueba](docs/testing.md)
- [Mapeo de campos](mappings/field-mappings.json)
