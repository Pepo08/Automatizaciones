# Setup — Mailchimp List Maintenance

## Requisitos

- n8n 1.0+
- Cuenta de Mailchimp con API key
- Audiencia/lista creada en Mailchimp

## Paso 1: Crear credencial de Mailchimp en n8n

El workflow usa **nodos nativos de Mailchimp** que requieren una credencial configurada en n8n.

1. En n8n, ir a **Settings > Credentials > Add Credential**
2. Buscar **Mailchimp API**
3. Ingresar tu API key completa (formato: `xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx-usX`)
4. Guardar

### Cómo obtener la API Key
1. Ir a Mailchimp > Account & Billing > Extras > API Keys
2. Crear una nueva API key
3. Copiar la key completa

### Audience/List ID
1. Ir a Mailchimp > Audience > Settings > Audience name and defaults
2. Copiar el Audience ID (formato alfanumérico tipo `a1b2c3d4e5`)

## Paso 1b: Vincular la credencial a los nodos

Después de importar el workflow, los nodos Mailchimp van a mostrar "credential not found".
Para cada uno de estos 4 nodos, hacer click y seleccionar la credencial que creaste:

- **Mailchimp: Get Audience**
- **Mailchimp: Create Member**
- **Mailchimp: Update Member**
- **Mailchimp: Unsubscribe**

## Paso 2: Crear merge fields en Mailchimp

El flujo usa merge fields custom que **no vienen por defecto**.
Crearlos antes de ejecutar:

1. Ir a Mailchimp > Audience > Settings > Audience fields and *|MERGE|* tags
2. Crear estos campos:

| Tag | Nombre | Tipo |
|---|---|---|
| `PHONE` | Phone | Phone |
| `BIRTHDAY` | Birthday | Birthday |
| `ZONE` | Zone | Text |
| `CITY` | City | Text |
| `COUNTRY` | Country | Text |
| `CTYPE` | Customer Type | Text |
| `ROLE` | Role | Text |
| `REP` | Representative | Text |

Los campos `FNAME` y `LNAME` ya existen por defecto.

Si no necesitás algún campo (ej: `COUNTRY`), podés omitirlo en Mailchimp y simplemente no va a tener valor.

## Paso 3: Importar el workflow

1. Abrir n8n
2. Workflows > Import from File
3. Seleccionar `workflows/clean/mailchimp-list-maintenance.json`

## Paso 4: Configurar variables

Abrir el nodo **Config** y completar:

| Variable | Qué poner | Ejemplo |
|---|---|---|
| `DRY_RUN` | `true` para preview, `false` para ejecutar | `true` |
| `MAILCHIMP_LIST_ID` | ID de tu audiencia | `a1b2c3d4e5` |
| `DEFAULT_STATUS` | Status para contactos nuevos | `subscribed` |

> La API key ya no va en Config — se gestiona como credencial nativa de n8n (ver Paso 1).

## Paso 5: Configurar la fuente de contactos

El nodo **Load Source Contacts** trae datos de ejemplo por defecto.

### Para usar datos reales:

#### Opción A: Google Sheets
1. Reemplazar el Code node por un nodo Google Sheets
2. Configurar credenciales de Google en n8n
3. Apuntar al spreadsheet y hoja correctos
4. Mapear columnas a los campos del esquema (ver `mappings/field-mappings.json`)

#### Opción B: CSV / Excel
1. Subir el archivo a n8n o configurar lectura desde ruta
2. Usar nodo Read Binary File + Spreadsheet File
3. Conectar la salida al nodo Normalize Contacts

#### Opción C: API externa
1. Usar nodo HTTP Request apuntando a tu API
2. Asegurar que el JSON de salida tenga los campos esperados
3. Conectar la salida al nodo Normalize Contacts

### Estructura mínima por contacto

```json
{
  "email": "contacto@example.com",
  "first_name": "Nombre",
  "last_name": "Apellido"
}
```

Todos los demás campos son opcionales. El flujo maneja valores vacíos.

### Estructura completa

```json
{
  "email": "contacto@example.com",
  "first_name": "Nombre",
  "last_name": "Apellido",
  "phone": "+5491155551234",
  "birthday": "1985-03-15",
  "zone": "Litoral",
  "city": "Rosario",
  "country": "Argentina",
  "customer_type": "cliente",
  "role": "comprador",
  "representative": "Carlos Ruiz",
  "tags": ["cliente", "litoral"],
  "source_system": "mi_crm",
  "updated_at": "2026-03-20T10:00:00Z"
}
```

## Paso 6: Habilitar Continue On Fail en los nodos Mailchimp

Los nodos Mailchimp de ejecución tienen `onError: continueRegularOutput` configurado.
Si tu versión de n8n no lo reconoce, habilitalo manualmente:

1. Abrir cada nodo Mailchimp (Create, Update, Unsubscribe)
2. Click en Settings (engranaje)
3. Activar "Continue On Fail"

Esto evita que un error individual (ej: email ya existe) detenga todo el flujo.

## Notas

- Los tags solo se asignan al **crear** contactos. Para actualizar tags de miembros existentes, usar el nodo **Mailchimp > Member Tag > Create** por separado.
- Las operaciones son una por una. Para audiencias grandes (+1000 cambios), considerar usar el endpoint batch de Mailchimp vía HTTP Request.
- Los merge fields son editables visualmente en cada nodo Mailchimp desde n8n (click en el nodo → Merge Fields).
