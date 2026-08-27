---
title: "Componentes web de chat"
description: "Referencia para integrar los elementos personalizados de chat, lista de mensajes, editor y selector de sesiones proporcionados por el host."
---

# Componentes web de chat

**Clasificación: referencia de API con ejemplos parciales de integración.** Los bloques HTML y JavaScript presuponen un hijo alojado donde está disponible el shell de elementos de chat, un UUID de sesión o token de inicio de agente válido y código de montaje y teardown controlado por la aplicación.

La UI de chat de Wippy está disponible como **elementos personalizados componibles** en contextos donde el Host inyecta el shell de chat. Un hijo en iframe srcdoc puede integrar chat en vivo mediante etiquetas, sin imports de Vue ni registro. Los elementos usan los mismos componentes de chat y la misma capa de datos `ChatTransport` → `SessionManager` que el host.

Estos elementos los proporciona el host para su consumo. A diferencia de un [componente web](./web-component.md) creado por usted, no los implementa ni registra. El inyector del iframe srcdoc los hace disponibles mediante etiqueta. El gateway de Web Fragment de la versión fijada del Framework omite deliberadamente `chat.js`, por lo que una página Fragment no puede presuponer que existan estas etiquetas; use allí los controles de chat del host, como explica [Cómo se cargan](#cómo-se-cargan).

> Úselos cuando quiera una superficie de chat *dentro de su propia página o panel*. Para abrir imperativamente el panel de chat del host, use `host.startChat(token)` / `host.openSession(sessionUUID)` de `@wippy-fe/proxy`; consulte [API Proxy](./proxy-api.md).

## Los elementos

| Etiqueta | Renderiza | Atributos principales | Eventos |
|-----|---------|----------------|--------|
| `<wippy-chat>` | Chat completo: cabecera, mensajes e input | `session-id`, `start-token`, `agent`, `show-selector`, `hide-header` | `session-started`, `error` |
| `<wippy-chat-messages>` | Solo lista de mensajes | `session-id` | — |
| `<wippy-chat-input>` | Solo editor | `session-id` | — |
| `<wippy-session-selector>` | Selector de sesiones | `active-session-id` | `select` |

Cada elemento acepta además dos atributos de tema por instancia —**`custom-css`** y **`css-variables`**— descritos en [Temas](#temas).

## Cómo se cargan

Los elementos de chat se distribuyen como [`<wippy-loading>`](../web-host/packages.md#wippy-feloading): un pequeño shell `@wippy-fe/chat.js` registra automáticamente las cuatro etiquetas. El inyector del iframe srcdoc lo incluye en el array `scripts` del host junto con `loading.js` y `proxy.js`, por lo que las páginas entregadas mediante iframe no instalan ningún paquete ni llaman a `customElements.define()`.

El gateway de Web Fragment del Framework inyecta `loading.js` y `proxy-fragment.js`, pero no `chat.js`. Las páginas entregadas como fragmentos deben usar `host.startChat()` o `host.openSession()`, salvo que un contrato de plataforma posterior añada un opt-in explícito del shell de chat. Los componentes web directos montados en el documento del host tampoco deben presuponer que otro realm hijo haya registrado las etiquetas.

Las dependencias de implementación se dividen en un chunk `chat-internals.[hash].js` independiente y **se cargan de forma diferida en el primer montaje**. Mientras se descarga, el elemento muestra un placeholder `<wippy-loading>`; si la carga falla, muestra `<wippy-error>`. Las páginas que nunca montan una etiqueta de chat no cargan los internos.

## `<wippy-chat>`

El control reactivo de sesiones requiere Web Host `1.0.51` o posterior. El shell del elemento es un asset inyectado por el Host, no un paquete público `@wippy-fe/chat`; las versiones anteriores del Host solo admiten de forma fiable el montaje inicial.

La superficie completa de chat: cabecera, lista desplazable de mensajes y editor.

| Atributo | Tipo | Predeterminado | Descripción |
|-----------|------|---------|-------------|
| `session-id` | string | — | Renderiza esta sesión existente (UUID de sesión). |
| `start-token` | string | — | Token de inicio de agente; inicia una sesión **nueva** al montar si no se define `session-id`. |
| `agent` | string | — | Nombre o título del agente que se preselecciona en el estado vacío cuando no hay sesión abierta. |
| `show-selector` | boolean | `false` | Renderiza el selector de sesiones integrado en la cabecera. |
| `hide-header` | boolean | `false` | Oculta la barra de cabecera de agente y modelo para integraciones compactas. |

**Eventos** (se emiten como `CustomEvent` en el elemento; lea `event.detail`):

| Evento | `detail` | Cuándo |
|-------|----------|------|
| `session-started` | `{ sessionId: string }` | Se inicia una sesión mediante `start-token` al montar o por una acción del usuario. |
| `error` | `{ message: string }` | Falla la inicialización de sesión, por ejemplo por un `start-token` no válido. |

```html
<!-- Start a new session from an agent start token -->
<wippy-chat start-token="agent-start-token" agent="researcher"></wippy-chat>

<!-- Pin an existing session -->
<wippy-chat session-id="019eb2ae-1234-5678-abcd-ef1234567890"></wippy-chat>

<!-- Built-in selector, no header bar -->
<wippy-chat show-selector hide-header></wippy-chat>
```

```javascript
document.querySelector('wippy-chat')
  .addEventListener('session-started', (e) => {
    console.log('session:', e.detail.sessionId)
  })
```

### Control reactivo sin volver a montar

Mantenga montado un único elemento `<wippy-chat>` y actualice sus atributos. Un cambio de `session-id` abre esa sesión en el mismo elemento. Definir `session-id=""` o eliminar un atributo previamente controlado es una transición explícita a **Nuevo chat**: borra tanto la sesión fijada como la sesión activa compartida. Un elemento que nunca tuvo `session-id` sigue controlado por el selector; la ausencia en el primer montaje no es una orden de borrado.

Cuando existe `start-token`, borrar `session-id` vuelve a iniciar desde ese token. Cambiar el token también inicia en el mismo elemento. El elemento consume cada token una vez por host del elemento personalizado, por lo que reconectar o mover el mismo elemento no repite un inicio activo. Si un token más reciente, una sesión controlada, una selección manual o una desconexión sustituye un inicio en curso, el resultado obsoleto no puede reemplazar la sesión actual; cualquier sesión creada tarde se cierra.

```javascript
const chat = document.querySelector('wippy-chat')

chat.setAttribute('session-id', existingSessionId)

// New Chat with an agent. No element replacement is required.
chat.setAttribute('start-token', agentStartToken)
chat.removeAttribute('session-id')
```

Los resolvers de componentes del layout gestionado actualizan y eliminan props en el elemento personalizado existente. Solo vuelven a montarlo cuando cambia `tagName`, conservando el input de chat, la posición de desplazamiento y el estado de ciclo de vida controlado por el elemento durante las actualizaciones del panel.

## `<wippy-chat-messages>` y `<wippy-chat-input>`

La lista de mensajes y el editor como elementos independientes, para que pueda distribuirlos usted mismo. Cada uno acepta un único `session-id`; sin un `session-id` explícito siguen la [sesión activa compartida](#composición-y-sesión-compartida) establecida por `<wippy-session-selector>`. Ninguno emite eventos.

```html
<!-- Custom layout: messages above, composer below -->
<div style="display:flex; flex-direction:column; height:100%;">
  <wippy-chat-messages session-id="019eb2ae-…"></wippy-chat-messages>
  <wippy-chat-input    session-id="019eb2ae-…"></wippy-chat-input>
</div>
```

## `<wippy-session-selector>`

Un selector de sesiones. Controla la sesión activa compartida que siguen los demás elementos.

| Atributo | Tipo | Predeterminado | Descripción |
|-----------|------|---------|-------------|
| `active-session-id` | string | — | Resalta esta sesión como activa. |

**Evento:**

| Evento | `detail` | Cuándo |
|-------|----------|------|
| `select` | `{ sessionId: string }` | El usuario elige una sesión. La sesión seleccionada se convierte en la sesión activa compartida. |

```html
<wippy-session-selector></wippy-session-selector>
```

```javascript
document.querySelector('wippy-session-selector')
  .addEventListener('select', (e) => {
    console.log('picked:', e.detail.sessionId)
  })
```

## Composición y sesión compartida

Los elementos **sin `session-id` explícito** siguen la selección de `<wippy-session-selector>` mediante el `activeSessionId` compartido del manager. Así, un selector junto con un chat —o con mensajes e input independientes— permanecen sincronizados en una página: seleccione una sesión y los demás se actualizarán. Los elementos que **sí** tienen un `session-id` o `start-token` explícito quedan fijados e ignoran el selector.

```html
<!-- Selector + chat: the chat follows the picked session -->
<wippy-session-selector></wippy-session-selector>
<wippy-chat></wippy-chat>

<!-- Selector + split message list / composer, all following the selector -->
<wippy-session-selector></wippy-session-selector>
<wippy-chat-messages></wippy-chat-messages>
<wippy-chat-input></wippy-chat-input>

<!-- Pinned chat alongside a selector-driven one -->
<wippy-chat session-id="019eb2ae-…"></wippy-chat>  <!-- ignores the selector -->
<wippy-chat></wippy-chat>                            <!-- follows the selector -->
```

## Temas

Cada elemento se renderiza en una raíz shadow, por lo que los estilos de la página host no se filtran hacia dentro ni hacia fuera. Dos mecanismos aplican el tema:

- **Variables CSS heredadas.** Las propiedades personalizadas del tema (`--p-primary-*`, `--p-text-color`, …) se heredan a través del límite shadow desde el tema del host, por lo que el chat sigue la paleta activa y el modo oscuro o claro. Los estilos basados en selectores (PrimeVue, markdown, Tailwind) se incluyen en una hoja `chat-elements.css` que se inyecta en la raíz shadow. `PrimeVuePlugin` redirige el destino Portal predeterminado body/null a una capa de overlay fijada dentro de la raíz shadow propietaria. No defina habitualmente `appendTo: 'self'`: es un opt-in explícito de colocación inline y puede recortarse dentro del contenido desplazable de Dialog o Drawer. Los toasts se delegan al **toast nativo del host** mediante el proxy, en vez de renderizarse en shadow.
- **Overrides por instancia.** Cada elemento acepta dos atributos:

| Atributo | Tipo | Efecto |
|-----------|------|--------|
| `custom-css` | string | CSS sin procesar añadido **al final** de la raíz shadow del elemento, por lo que prevalece por orden. |
| `css-variables` | object (JSON) | Overrides de variables CSS por instancia aplicados a `:host`. Las claves pueden omitir el prefijo `--`. |

Trate ambos atributos como configuración de aplicación de confianza. No copie input de usuario no confiable en CSS sin procesar ni en valores de variables; el CSS puede modificar u ocultar la interfaz integrada e iniciar solicitudes de recursos externos.

```html
<wippy-chat
  session-id="019eb2ae-…"
  custom-css=".message-item { max-width: 80%; }"
></wippy-chat>
```

Omitir `css-variables` es la ruta normal que respeta la fachada. Los overrides de color por instancia sirven para un aislamiento deliberado de la integración, no para cambios de estilo rutinarios.

Para conocer el modelo completo —variables semánticas, cambio claro/oscuro e inyección de CSS de Shadow DOM por el host— consulte [Temas: componentes web](./web-component-theming.md).

## Conexión de runtime

Dentro de un hijo en iframe srcdoc, los elementos no requieren configuración adicional. La autenticación y la configuración proceden del runtime proxy inyectado; REST y WebSocket usan las URL de entorno de la configuración. Cuando se monta una etiqueta de chat, el shell ya registrado carga los internos bajo demanda y se conecta con la sesión existente del hijo. Los contextos Web Fragment y directos del host tienen los límites de disponibilidad descritos en [Cómo se cargan](#cómo-se-cargan).

## Consulte también

- [Componente web (`view.component`)](./web-component.md): creación de su propio elemento personalizado
- [Paquetes @wippy-fe](../web-host/packages.md): mapa de importación del host y shells de elementos inyectados (`@wippy-fe/chat`, `@wippy-fe/loading`)
- [Temas: componentes web](./web-component-theming.md): CSS de Shadow DOM y variables semánticas
- [API Proxy](./proxy-api.md): `host.startChat` / `host.openSession` y el resto de `@wippy-fe/proxy`
- [Proxy y aislamiento](../web-host/proxy-isolation.md): cómo inyecta el host scripts y configuración en los hijos
