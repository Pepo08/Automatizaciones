# CRM Scoring - Reglas de Scoring

## Resumen

Score numérico de 0 a 100+ calculado por 5 dimensiones.
Cada contacto recibe puntos por actividad positiva y penalizaciones por datos faltantes o inactividad.

## Dimensiones de Scoring

### 1. Recencia (máx +30 pts)

Mide cuántos días pasaron desde el último contacto.

| Condición | Puntos |
|-----------|--------|
| Últimos 7 días | +30 |
| Últimos 14 días | +20 |
| Últimos 30 días | +10 |
| Últimos 60 días | +5 |
| Más de 60 días | +0 |
| Sin fecha | +0 |

### 2. Interacciones (máx +25 pts)

Cantidad de interacciones registradas.

| Condición | Puntos |
|-----------|--------|
| Más de 5 | +25 |
| Entre 3 y 5 | +20 |
| Entre 1 y 2 | +10 |
| Ninguna | +0 |

### 3. Origen del Lead (máx +15 pts)

Canal por el que llegó el contacto.

| Origen | Puntos |
|--------|--------|
| Referido | +15 |
| Evento | +12 |
| Web | +8 |
| Red social / LinkedIn | +6 |
| Otro | +3 |
| Desconocido | +0 |

### 4. Cargo (máx +15 pts)

Nivel de decisión del contacto.

| Nivel | Ejemplos | Puntos |
|-------|----------|--------|
| Alto | Dueño, Director, CEO, Fundador, Presidente, Socio | +15 |
| Medio | Gerente, Jefe, Responsable, Encargado, Manager, Supervisor | +10 |
| Bajo | Coordinador, Analista, Asistente, Ejecutivo, Vendedor | +5 |
| Sin dato | (vacío o no reconocido) | +0 |

### 5. Penalizaciones

| Condición | Puntos |
|-----------|--------|
| Estado = Inactivo | -20 |
| Sin teléfono | -10 |
| Sin empresa | -5 |
| Sin nombre | -5 |

**Score mínimo**: 0 (nunca negativo)

## Clasificación por Umbrales

| Score | Label | Categoría | Descripción |
|-------|-------|-----------|-------------|
| ≥ 60 | HIGH | HOT | Lead de alta prioridad. Contactar inmediatamente. |
| ≥ 35 | MEDIUM | WARM | Lead con potencial. Nutrir con contenido. |
| ≥ 15 | LOW | COLD | Lead frío. Incluir en campañas generales. |
| < 15 | NONE | DESCARTADO | Sin potencial actual. No sincronizar con MC. |

## Ejemplos

### Ejemplo HOT (Score: 75)
- Recencia: contacto hace 3 días → +30
- Interacciones: 6 → +25
- Origen: referido → +15
- Cargo: gerente general → +15
- Sin penalizaciones → 0
- **Total: 85 → HOT**

### Ejemplo WARM (Score: 43)
- Recencia: contacto hace 20 días → +10
- Interacciones: 4 → +20
- Origen: web → +8
- Cargo: analista → +5
- **Total: 43 → WARM**

### Ejemplo COLD (Score: 18)
- Recencia: contacto hace 45 días → +5
- Interacciones: 1 → +10
- Origen: desconocido → +0
- Cargo: sin dato → +0
- Sin teléfono → -10
- Sin empresa → -5
- **Total: 0 (floor) → DESCARTADO** (en este caso cae a descartado)

## Cómo Editar las Reglas

Dentro del nodo **"Calcular Score"** en n8n:

1. **Cambiar puntos**: Editar el objeto `RULES` al inicio del código
2. **Agregar criterios**: Agregar un nuevo bloque numerado (ej: "6. INDUSTRIA")
3. **Cambiar umbrales**: Editar `THRESHOLDS` en el nodo **"Clasificar Leads"**
4. **Agregar cargos**: Agregar strings a los arrays `CARGOS_ALTO`, `CARGOS_MEDIO`, `CARGOS_BAJO`

El archivo `config/mapping.json` refleja la configuración actual como referencia.
Los valores reales que usa el workflow están en los Code nodes.
