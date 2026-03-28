# Mailchimp — Sync Contactos desde Sheets

Workflow de n8n para sincronización unidireccional: **Google Sheets → Mailchimp**.

## Qué hace

1. Lee contactos desde Google Sheets
2. Normaliza campos (email, teléfono, estado, tipo)
3. Upsert en Mailchimp (crea o actualiza automáticamente)
4. Asigna tag según tipo de contacto

## Flujo

```
Trigger Manual → Config → Leer Contactos (Sheets) → Normalizar Contactos → Upsert Contacto (MC) → Asignar Tag (MC)
```

6 nodos operativos + 3 notas. Lineal, sin ramas.

## Nodos

| # | Nodo | Tipo | Función |
|---|------|------|---------|
| 1 | Trigger Manual | Trigger | Inicia el flujo |
| 2 | Config | Set | `MAILCHIMP_LIST_ID` |
| 3 | Leer Contactos | Google Sheets | Lee todas las filas |
| 4 | Normalizar Contactos | Code | Mapea columnas, normaliza, filtra inválidos |
| 5 | Upsert Contacto | **Mailchimp** | Crea o actualiza miembro + merge fields + status |
| 6 | Asignar Tag | **Mailchimp** | Asigna tipo como tag |

## Campos del Sheets

| Columna | Uso |
|---------|-----|
| Email | Email del contacto (obligatorio) |
| Nombre (FNAME) | Nombre → merge field FNAME |
| Apellido (LNAME) | Apellido → merge field LNAME |
| Teléfono (PHONE) | Teléfono → merge field PHONE |
| Estado (Activo/Inactivo) | Activo → subscribed, Inactivo → unsubscribed |
| Tipo (Tag) | Se asigna como tag en MC (ej: cliente, empleado) |

El normalizer acepta variantes de nombre de columna (con/sin tildes, paréntesis, mayúsculas).

## Setup

### 1. Importar

Workflows > Import from File > `workflows/clean/mailchimp-contacts-sync.json`

### 2. Credenciales

- **Google Sheets**: Settings > Credentials > Google Sheets OAuth2 → vincular al nodo `Leer Contactos`
- **Mailchimp**: Settings > Credentials > Mailchimp API → vincular a `Upsert Contacto` y `Asignar Tag`

### 3. Configurar

- Nodo `Config`: poner tu `MAILCHIMP_LIST_ID` (Audience > Settings > Audience ID)
- Nodo `Leer Contactos`: seleccionar spreadsheet y hoja

### 4. Ejecutar

Click en "Execute Workflow". Revisar output de cada nodo.

## Lógica

- **Upsert nativo**: Mailchimp crea el contacto si no existe, actualiza si ya existe. Una sola llamada.
- **Status**: se setea en cada ejecución según el valor del Sheets (Activo/Inactivo).
- **Tags**: se asignan en cada ejecución. El tipo del Sheets se usa como tag.
- **Errores**: `continueRegularOutput` + retry x3. Un contacto con error no rompe el flujo.
- **Duplicados**: Mailchimp los maneja nativamente via upsert. No hay deduplicación manual.

## Estructura

```
mailchimp/
  workflows/clean/
    mailchimp-contacts-sync.json   ← workflow (6 nodos + 3 notas)
  scripts/
    push-to-n8n.js                 ← deploy via API
  README.md
```
