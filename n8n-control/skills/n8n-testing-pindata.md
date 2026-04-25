---
name: n8n-testing-pindata
description: >
  Patrones para testear workflows de n8n: pinData para datos de prueba,
  manual trigger, ejecución paso a paso, y estrategias de testing.
  Activar cuando el usuario mencione: testear, probar, test, pinData,
  datos de prueba, mock data, "cómo pruebo esto", debugging, o cuando
  se genere un workflow y se necesite validar que funciona.
---

# n8n Testing & pinData

## pinData: datos de prueba embebidos

pinData permite fijar datos de salida de un nodo para testing sin depender de fuentes reales.

```json
{
  "pinData": {
    "Recibir mensaje Telegram": [
      {
        "json": {
          "message": {
            "message_id": 1,
            "from": { "id": 123456, "first_name": "Test", "username": "test_user" },
            "chat": { "id": 123456, "type": "private" },
            "text": "/compra tornillo 100",
            "date": 1700000000
          }
        }
      }
    ],
    "Leer stock completo": [
      {
        "json": {
          "insumo_id": "INS001",
          "nombre": "Tornillo 3/4",
          "stock_actual": "500",
          "stock_minimo": "100",
          "unidad": "unidad"
        }
      },
      {
        "json": {
          "insumo_id": "INS002",
          "nombre": "Clavo 2 pulgadas",
          "stock_actual": "50",
          "stock_minimo": "200",
          "unidad": "unidad"
        }
      }
    ]
  }
}
```

### Cómo funciona
- Los nodos con pinData **no se ejecutan** realmente
- Producen los datos fijos como si hubieran corrido
- Permite testear el flujo sin Telegram, Google Sheets, etc.

### Datos de prueba recomendados por nodo

| Nodo | Datos de prueba a incluir |
|------|--------------------------|
| Telegram Trigger | Mensaje con /comando, mensaje de texto libre, callback query |
| Webhook | Body con campos válidos, body con campos faltantes |
| Google Sheets Read | Rows con datos normales, row con campos vacíos |
| Google Sheets Read (usuarios) | Usuario autorizado, usuario no autorizado |

## Manual Trigger para testing

Agregar un Manual Trigger alternativo conectado al mismo flujo:

```json
{
  "parameters": {},
  "type": "n8n-nodes-base.manualTrigger",
  "typeVersion": 1,
  "name": "Test manual"
}
```

Conectar al mismo nodo que el trigger real para poder testear sin esperar un webhook/cron.

## Estrategia de testing

### 1. Generar el workflow con pinData
Incluir datos de prueba para nodos de entrada (triggers, reads).

### 2. Ejecutar con manual trigger
Click en "Execute Workflow" para correr con datos pinned.

### 3. Inspeccionar cada nodo
Verificar input/output de cada nodo en la UI.

### 4. Quitar pinData y probar con datos reales
Remover pinData del JSON y activar el workflow.

## Casos de prueba mínimos para un bot de stock

```
Caso 1: Compra exitosa
  Input: /compra tornillo 100
  Expected: stock actualizado, movimiento registrado, respuesta OK

Caso 2: Consumo con stock insuficiente  
  Input: /consumo tornillo 9999
  Expected: respuesta de error, stock NO modificado

Caso 3: Consulta de stock
  Input: /stock
  Expected: lista formateada de insumos con emojis de estado

Caso 4: Usuario no autorizado
  Input: mensaje de user_id desconocido
  Expected: respuesta "no autorizado"

Caso 5: Comando no reconocido
  Input: /xyz
  Expected: menú de ayuda

Caso 6: Texto libre (sin sesión activa)
  Input: "hola"
  Expected: menú de ayuda o "no entendí"
```
