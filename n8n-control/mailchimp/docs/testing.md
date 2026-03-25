# Testing — Mailchimp List Maintenance

## Plan de prueba progresivo

### Test 1: Dry run con audiencia vacía (sin credenciales)

**Objetivo:** Verificar normalización, validación y comparación.

**Pasos:**
1. Importar el workflow en n8n
2. Dejar `DRY_RUN = true` en Config
3. En el nodo **Fetch Mailchimp Audience**, reemplazar el código por:
   ```javascript
   // Mock: audiencia vacía
   return [{ json: { members: [], total: 0 } }];
   ```
4. Ejecutar el workflow

**Resultado esperado:**
- 6 contactos válidos (de 8 en la fuente)
- 2 inválidos (1 email sin @, 1 duplicado)
- 6 en `to_create` (audiencia vacía = todos nuevos)
- 0 en `to_update`, `to_unsubscribe`, `unchanged`
- Preview Report muestra contadores y samples correctos

### Test 2: Dry run con mock de audiencia existente

**Objetivo:** Verificar clasificación completa.

**Pasos:**
1. En **Fetch Mailchimp Audience**, usar este mock:
   ```javascript
   const mockMembers = [
     {
       id: "mock-001",
       email_address: "juan.perez@example.com",
       status: "subscribed",
       merge_fields: { FNAME: "Juan", LNAME: "Pérez", PHONE: "+5491155551234", BIRTHDAY: "03/15", ZONE: "Litoral", CITY: "Rosario", COUNTRY: "Argentina", CTYPE: "cliente", ROLE: "comprador", REP: "Carlos Ruiz" },
       tags: [{ id: 1, name: "cliente" }]
     },
     {
       id: "mock-002",
       email_address: "maria.gomez@example.com",
       status: "subscribed",
       merge_fields: { FNAME: "Maria", LNAME: "Gomez", PHONE: "", BIRTHDAY: "", ZONE: "", CITY: "", COUNTRY: "", CTYPE: "", ROLE: "", REP: "" },
       tags: []
     },
     {
       id: "mock-003",
       email_address: "viejo.contacto@example.com",
       status: "subscribed",
       merge_fields: { FNAME: "Viejo", LNAME: "Contacto" },
       tags: []
     }
   ];
   return [{ json: { members: mockMembers, total: mockMembers.length } }];
   ```
2. Ejecutar con `DRY_RUN = true`

**Resultado esperado:**

| Acción | Cant. | Detalle |
|---|---|---|
| to_create | 4 | carlos, ana, roberto, laura (no existen en MC) |
| to_update | 1 | maria (LNAME difiere: "Gómez" vs "Gomez", más otros campos) |
| to_unsubscribe | 1 | viejo.contacto (en MC pero no en la fuente) |
| unchanged | 1 | juan (todos los campos coinciden) |
| invalid | 2 | email sin @, duplicado |

### Test 3: Dry run contra Mailchimp real

**Objetivo:** Verificar conexión real con la API.

**Pasos:**
1. Completar credenciales reales en **Config**
2. Restaurar el código original de **Fetch Mailchimp Audience**
3. Ejecutar con `DRY_RUN = true`

**Verificar:**
- [ ] No hay error de autenticación
- [ ] `mailchimp_total` coincide con el dashboard de Mailchimp
- [ ] La clasificación tiene sentido según tus datos reales
- [ ] No se ejecutaron cambios

### Test 4: Apply controlado

**Objetivo:** Probar ejecución real con datos acotados.

**Pasos:**
1. Reducir la fuente a 2-3 contactos de prueba con emails de test
2. Poner `DRY_RUN = false`
3. Ejecutar
4. Verificar en Mailchimp

**Verificar:**
- [ ] Contactos nuevos aparecen en la audiencia
- [ ] Merge fields (FNAME, LNAME, PHONE, ZONE, CTYPE, etc.) correctos
- [ ] Tags asignados correctamente
- [ ] Contactos a desuscribir cambiaron a status "unsubscribed"
- [ ] Los nodos HTTP muestran responses 200/OK en el historial
- [ ] Build Execution Report muestra contadores correctos

### Test 5: Manejo de errores

**Objetivo:** Verificar que errores individuales no cortan el flujo.

**Pasos:**
1. Incluir un email ya existente en la fuente para forzar error en create
2. Incluir un email con formato raro
3. Ejecutar con `DRY_RUN = false`

**Verificar:**
- [ ] El flujo no se detiene por un error individual
- [ ] Los nodos HTTP muestran el error en su output pero continúan
- [ ] Los contactos válidos se procesan correctamente
- [ ] El reporte se genera

## Checklist general

### Importación
- [ ] Workflow importa sin errores en n8n
- [ ] Todos los nodos son visibles y están conectados
- [ ] Config muestra los 5 placeholders

### Dry run
- [ ] Funciona con datos de ejemplo (mock vacío)
- [ ] Funciona con mock de audiencia existente
- [ ] Funciona contra Mailchimp real
- [ ] Preview Report genera summary correcto

### Apply
- [ ] Create funciona (POST /members)
- [ ] Update funciona (PATCH /members/{hash})
- [ ] Unsubscribe funciona (PATCH status=unsubscribed)
- [ ] Errores individuales no cortan el flujo
- [ ] Execution Report se genera siempre

### Datos
- [ ] Emails se normalizan a lowercase
- [ ] Espacios se trimean correctamente
- [ ] Birthday se convierte a MM/DD
- [ ] Duplicados se detectan y separan
- [ ] Merge fields custom se envían correctamente
