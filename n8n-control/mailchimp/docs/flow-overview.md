# Arquitectura del flujo — Mailchimp List Maintenance

## Diagrama de nodos

```
Manual Trigger → Config → Load Source Contacts → Normalize Contacts → Validate & Deduplicate
  → Fetch Mailchimp Audience → Compare & Classify → Check DRY_RUN
                                                       │
                                      ┌────────────────┴────────────────┐
                                      │                                 │
                                 DRY_RUN=true                     DRY_RUN=false
                                      │                                 │
                              Build Preview Report          Prepare Items for Mailchimp
                                                                        │
                                                                Route by Action (Switch)
                                                                   │    │    │    │
                                                              Create Update Unsub Report
                                                                   │    │    │    │
                                                              HTTP   HTTP  HTTP  Build
                                                              POST  PATCH PATCH  Execution
                                                                                 Report
```

## Fases del flujo

### Fase 1: Configuración
**Nodo: Config (Set)**
- Define todas las variables del flujo
- `DRY_RUN`: controla si se ejecutan cambios reales
- Credenciales de Mailchimp como placeholders
- `DEFAULT_STATUS`: status para nuevos miembros

### Fase 2: Carga de fuente
**Nodo: Load Source Contacts (Code)**
- Carga contactos desde la fuente configurada
- La versión demo trae 8 contactos de ejemplo
- Incluye casos edge: emails sucios, duplicados, inválidos
- Reemplazable por Google Sheets, HTTP Request, CSV

### Fase 3: Normalización
**Nodo: Normalize Contacts (Code)**
- Normaliza emails a lowercase
- Trimea espacios de todos los campos
- Convierte birthday de `YYYY-MM-DD` a `MM/DD` (formato Mailchimp)
- Normaliza tags a lowercase
- Normaliza customer_type y role a lowercase

### Fase 4: Validación
**Nodo: Validate & Deduplicate (Code)**
- Valida formato de email con regex
- Detecta y separa duplicados por email
- Separa contactos inválidos con razón (`email_invalido`, `duplicado`)
- Genera estadísticas: total input, válidos, inválidos

### Fase 5: Lectura de Mailchimp
**Nodo: Mailchimp: Get Audience (nativo `n8n-nodes-base.mailchimp`)**
- Operación `getAll` con `returnAll: true`
- Trae todos los miembros de la audiencia automáticamente (paginación incluida)
- Usa credencial nativa de Mailchimp configurada en n8n
- No requiere código — es un nodo visual configurable

### Fase 6: Comparación
**Nodo: Compare & Classify (Code)**
- Cruza contactos validados contra miembros de Mailchimp por email
- Clasifica cada contacto:
  - **toCreate**: email no existe en Mailchimp
  - **toUpdate**: email existe pero algún merge field difiere
  - **toUnsubscribe**: email existe en Mailchimp pero no en la fuente (y está suscrito)
  - **unchanged**: email existe y todos los campos coinciden
  - **invalid**: emails inválidos o duplicados (del paso anterior)
- Genera summary con contadores

### Fase 7: Ejecución

#### Modo DRY RUN (DRY_RUN=true)
**Nodo: Build Preview Report (Code)**
- Genera reporte con contadores y muestras de cada grupo
- No toca Mailchimp
- Indica next step para ejecutar cambios reales

#### Modo APPLY (DRY_RUN=false)

**Nodo: Prepare Items for Mailchimp (Code)**
- Toma los arrays clasificados y los convierte en items individuales
- Cada item lleva:
  - `_action`: create / update / unsubscribe / report
  - Datos del contacto (email, first_name, zone, tags, etc.)
  - `tags_csv`: tags como string separado por comas (para el nodo Create)
- Siempre agrega un item `_action=report` para que el reporte se ejecute

**Nodo: Route by Action (Switch)**
- Rutea items individuales a su nodo Mailchimp correspondiente según `_action`
- 4 outputs: Create, Update, Unsubscribe, Report

**Nodos nativos de Mailchimp (`n8n-nodes-base.mailchimp`):**
- **Mailchimp: Create Member** — operación `create`, con 10 merge fields editables en UI + tags
- **Mailchimp: Update Member** — operación `update`, con 10 merge fields editables en UI
- **Mailchimp: Unsubscribe** — operación `update` con `status=unsubscribed`
- Los 3 usan credencial nativa de Mailchimp configurada en n8n
- Todos con `onError: continueRegularOutput` para no cortar el flujo si falla un contacto

**Nodo: Build Execution Report (Code)**
- Recibe el item de reporte del Switch
- Genera resumen final con contadores y timestamp

## Modelo de datos

### Campos del contacto normalizado

| Campo | Tipo | Merge Field | Requerido | Uso en segmentación |
|---|---|---|---|---|
| email | string | email_address | Sí | Clave principal |
| first_name | string | FNAME | No | Personalización |
| last_name | string | LNAME | No | Personalización |
| phone | string | PHONE | No | Contacto directo |
| birthday | string (MM/DD) | BIRTHDAY | No | Campaña de cumpleaños |
| zone | string | ZONE | No | Segmentación geográfica |
| city | string | CITY | No | Segmentación por ciudad |
| country | string | COUNTRY | No | Segmentación por país |
| customer_type | string | CTYPE | No | cliente/prospecto/representante |
| role | string | ROLE | No | comprador/representante |
| representative | string | REP | No | Campañas por representante |
| tags | array | tags | No | Segmentación flexible |
| source_system | string | - | No | Trazabilidad interna |
| updated_at | string | - | No | Trazabilidad interna |

## Decisiones técnicas

1. **Nodos nativos de Mailchimp en vez de HTTP Request**: el workflow usa `n8n-nodes-base.mailchimp` para todas las operaciones de Mailchimp (Get Audience, Create, Update, Unsubscribe). Esto permite editar merge fields, tags, audience ID y status visualmente desde n8n sin tocar código. La API key se gestiona como credencial nativa de n8n.

2. **Unsubscribe en vez de Archive**: cambia status a `unsubscribed` (member/update) en lugar de archivar (member/delete). Más conservador — el contacto queda en la audiencia pero no recibe campañas. Para archivar en su lugar, cambiar el nodo por una operación `delete`.

3. **Item de reporte en el Switch**: se agrega un item con `_action=report` para garantizar que el Build Execution Report se ejecute siempre, sin depender de que las ramas Mailchimp tengan items.

4. **onError: continueRegularOutput**: los nodos Mailchimp de ejecución no cortan el flujo si un contacto individual falla. Los errores quedan visibles en el historial de ejecución de n8n.

5. **Credenciales centralizadas**: la API key no viaja en el flujo. Se configura una vez como credencial de n8n y se vincula a los 4 nodos Mailchimp. Esto es más seguro y más fácil de mantener.

6. **Merge fields editables**: cada nodo Create/Update tiene los 10 merge fields configurados como campos individuales en la UI de n8n. El usuario puede agregar, quitar o modificar campos sin tocar código.
