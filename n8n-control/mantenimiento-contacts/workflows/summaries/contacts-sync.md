# Contacts Sync

## Objetivo

Sincronizar la data entre Google Sheets y Google Contacts.

## Flujo general

1. Schedule Trigger inicia el proceso.
2. Se leen filas desde Google Sheets.
3. Se obtienen contactos desde Google Contacts.
4. Se normalizan ambos datasets.
5. Se comparan los registros.
6. Si no hay cambios, termina.
7. Si hay diferencias:
   - crea contactos faltantes
   - elimina contactos sobrantes

## Nodos principales

- Schedule Trigger
- Get row(s) in sheet
- Get many contacts
- Merge
- Aggregate
- Code in JavaScript
- If
- Loop Over Items
- Create a contact
- Delete a contact

## Archivos

- raw/contacts-sync.raw.json: export crudo desde n8n
- clean/contacts-sync.json: versión limpia para edición y versionado
