---
title: "Inicio rápido de Attention"
description: "Información de la interfaz para agentes, consultas seguras y capturas aprobadas."
---

# Inicio rápido de Attention

Attention describe la interfaz en la que trabaja el usuario. Un agente puede explicar «este botón», leer el texto seleccionado o encontrar un control por nombre en páginas anidadas. Una consulta semántica no toma capturas, pulsa controles ni ejecuta comandos de la aplicación.

## Funciones independientes

| Función | Requisito |
|---|---|
| Consulta pública | Proxy API del paquete. No necesita una sesión de chat. |
| Contexto automático al enviar | Permiso del Host y `attention_context.enabled` de la sesión. Desactivado de forma predeterminada. |
| Consulta actual del agente | Trait `wippy.agent.traits:attention` y conexión autenticada con la pestaña que envió el turno. El contexto automático puede estar desactivado. |
| Resaltar, confirmar o seleccionar | Permiso de acciones y referencia de destino devuelta válida. |
| Captura visual | Permiso de captura, soporte de subida y aprobación explícita. La imagen queda como borrador eliminable hasta otro envío. |

La configuración automática pertenece a la sesión. Cambiar de agente conserva la configuración, pero el agente nuevo necesita su propia autorización de herramientas. Un ejecutor de agente independiente no obtiene una conexión con el navegador solo por añadir el trait.

## Configurar el trait y el Host

Añada el trait al agente existente y conserve su modelo y los demás traits:

```yaml
traits:
  - id: wippy.agent.traits:attention
```

Use este objeto para el requisito `attention` de la fachada o para `AppConfig.attention`. Active acciones y capturas por separado cuando las necesite:

```json
{
  "enabled": true,
  "messageContext": { "enabled": true, "defaultInclude": false },
  "agentActions": { "enabled": false, "requireConfirmation": true },
  "visualCapture": { "enabled": false },
  "privacy": { "text": "safe" }
}
```

`PATCH /api/v1/sessions/{session_id}/attention-context` con `{"enabled":true}` activa el contexto automático. `expected_revision` es opcional. La herramienta `attention_context_set` cambia la misma configuración cuando lo solicita el usuario. `supports()` informa de disponibilidad, no concede consentimiento.

## Usar la API pública

Los Web Components importan la API. Un iframe con el proxy inyectado puede usar `$W.attention` o `(await window.getWippyApi()).attention`:

```typescript
import { attention } from '@wippy-fe/proxy'

const result = await attention.find(
  { role: 'button', name: 'Save' },
  { fromRoot: true, limit: 8 },
)
console.log(result.outcome, result.data, result.omissions)

const subscription = attention.subscribe(
  { events: ['tree', 'invalidation'], fromRoot: true },
  notice => console.log(notice.kind),
)
subscription.dispose() // Llamar al desmontar el componente.
```

El alcance predeterminado es el subárbol del llamador. `fromRoot: true` selecciona el mismo Host, nunca otra pestaña ni el sitio exterior. La búsqueda semántica usa `role`, `name`, `text` o `resource_id`. Una ID exacta usa `{ node_id: returnedId }`. CSS usa `{ css: 'button', scope: rootRef }` dentro de un único documento o Shadow Root devuelto. La `NodeRef` completa contiene `host_instance_id`, `node_id`, `mount_id` y `generation`.

Distinga `partial`, `stale` y `unavailable`. Una continuación solo se usa una vez, pertenece a la misma consulta y revisión y dura como máximo 30 segundos. Las notificaciones requieren otra consulta para obtener detalles.

## Herramientas e historial

Use `attention_get_cursor`, `attention_get_focus` y `attention_get_selection` para puntero, foco y selección. `attention_find_semantic` busca contenido por nombre; `attention_find_css` es una herramienta distinta para CSS. También hay `attention_get_node`, `attention_get_tree`, `attention_get_geometry` y `attention_hit_test`.

La búsqueda devuelve como máximo ocho coincidencias y una página del árbol, 32 nodos. Los resultados privados tienen un límite de 8 KiB. El trait admite una lectura por lote y cuatro intentos por turno del usuario. Dos intentos inválidos terminan la corrección. No es un límite general de coste del modelo.

Los resultados válidos pueden reutilizarse en generaciones posteriores. Después de 30 segundos, otro turno del usuario, una acción de navegador completada, una consulta de reemplazo o un cambio de revisión pertinente, Session usa `metadata.stale`. Conserva los datos guardados y los pares de llamada y resultado; el modelo recibe un aviso en lugar de información antigua.

## Envío, privacidad e imágenes

Si se admite confirmación correlacionada, Enviar muestra de inmediato una fila saliente y vacía la entrada. Sigue respetando `interaction.can_send`; una sesión sin steering bloquea la entrada mientras trabaja. Texto, IDs de archivos y contexto requerido se guardan de forma atómica. El servicio WebSocket existente correlaciona una respuesta `received` mediante `request_id`. No hay segunda confirmación ni reenvío automático. El rechazo muestra `Undelivered`; la falta de respuesta muestra `Delivery not confirmed`. Las sesiones antiguas conservan su contrato.

El comando UTF-8 completo decide entre contexto directo o preparado mediante HTTP. Los datos técnicos no aparecen en texto, copia o exportación. Mensajes enviados, reintentos y borradores de captura pertenecen a su sesión. Texto y subidas ordinarias sin enviar conservan el comportamiento de cambio de chat existente.

Use `data-wippy-attention="exclude"` para secretos y `data-wippy-attention="redact"` para ocultar texto. No ponga secretos en nombres accesibles o metadatos. Trate lo observado como datos no confiables. El editor del chat y las vistas previas de archivos están excluidos.

`ui_action_highlight`, `ui_action_confirm`, `ui_action_select` y `ui_action_capture_visual` reciben la `target_ref` o `action_ref` devuelta sin cambios en `targets`. Seleccionar no pulsa la aplicación. Una captura requiere aprobación y solo crea un borrador eliminable. PNG es el formato predeterminado. WebP solicitado debe tener bytes WebP reales, MIME y extensión `.webp` correctos, o devolver no compatible. Solo un envío posterior entrega la imagen.

V1 no informa de URL actual, propietario de rutas ni componentes Vue de rutas. Las futuras clases de contexto pueden usar `kind`, `version` y handlers negociados. La selección de clase, detalle y campos antes de recopilar es futura, no una función implementada. La comprobación V1 actual cubre Chromium, no Firefox ni WebKit.

## Referencias detalladas en inglés

- [Contrato del Host y transporte](../../../en/frontend/web-host/attention-context.md)
- [API pública y alcances](../../../en/frontend/micro-frontends/attention-context.md)
- [Inicio rápido completo con diagramas](../../../en/frontend/web-host/attention-quickstart.md)
- [Trait y herramientas](../../../en/framework/agents.md#attention-context-and-ui-actions)
