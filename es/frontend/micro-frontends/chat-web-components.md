---
title: "Web Components de Chat"
description: "La UI de chat de Wippy está disponible como un conjunto de elementos personalizados componibles, de modo que cualquier micro frontend (o cualquier página que se ejecute en un contexto hijo) puede incorporar un…"
---

# Web Components de Chat

La UI de chat de Wippy está disponible como un conjunto de **elementos personalizados componibles**, de modo que cualquier micro frontend (o cualquier página que se ejecute en un contexto hijo) puede incorporar un chat de Wippy en vivo por etiqueta: sin Vue, sin importaciones, sin registro. Envuelven los mismos componentes que usa el propio chat del host (una única fuente de verdad), respaldados por la misma capa de datos `ChatTransport` → `SessionManager`.

Son elementos listos para usar que usted *consume*; a diferencia de un [Web Component](./web-component.md) que construye usted mismo, no los escribe ni los registra. El host los pone disponibles por etiqueta en cada hijo (vea [Cómo se cargan](#how-they-load)).

> Úselos cuando quiera una superficie de chat *dentro de su propia página o panel*. Para abrir en su lugar el propio panel de chat del host de forma imperativa, use `host.startChat(token)` / `host.openSession(sessionUUID)` de `@wippy-fe/proxy` (vea [API del Proxy](./proxy-api.md)).

## Los elementos

| Etiqueta | Renderiza | Atributos clave | Eventos |
|-----|---------|----------------|--------|
| `<wippy-chat>` | Chat completo: cabecera + mensajes + entrada | `session-id`, `start-token`, `agent`, `show-selector`, `hide-header` | `session-started`, `error` |
| `<wippy-chat-messages>` | Solo la lista de mensajes | `session-id` | — |
| `<wippy-chat-input>` | Solo el compositor | `session-id` | — |
| `<wippy-session-selector>` | Selector de sesiones | `active-session-id` | `select` |

Cada elemento acepta además dos atributos de tema por instancia — **`custom-css`** y **`css-variables`** — tratados en [Temas](#theming).

## Cómo se cargan

Los elementos de chat se entregan exactamente como [`<wippy-loading>`](../web-host/packages.md#wippy-feloading): un shell diminuto, `@wippy-fe/chat.js` (~21 KB), registra automáticamente las cuatro etiquetas y se inyecta en cada contexto hijo mediante el array `scripts` del host (junto a `loading.js` y `proxy.js`). Así que las etiquetas están disponibles por nombre en cualquier micro frontend hijo con **cero registro por aplicación**: no instala un paquete ni llama a `customElements.define()`.

Los internos pesados — el árbol de Vue más PrimeVue, Shiki y el renderizador de markdown (~2 MB) — se separan en un chunk `chat-internals.[hash].js` distinto y se **cargan de forma diferida en el primer montaje**. Mientras el chunk se descarga, el elemento muestra un marcador `<wippy-loading>`; si la carga falla, muestra `<wippy-error>`. Las páginas que nunca usan una etiqueta de chat nunca pagan por los internos.

## `<wippy-chat>`

El control reactivo de sesión requiere Web Host `1.0.51` o posterior. Fije la familia
de paquetes `@wippy-fe/*` `0.0.51+` correspondiente; los elementos de chat inyectados más antiguos solo
soportan de forma fiable el montaje inicial.

La superficie de chat completa: cabecera, lista de mensajes desplazable y compositor.

| Atributo | Tipo | Por defecto | Descripción |
|-----------|------|---------|-------------|
| `session-id` | string | — | Renderiza esta sesión existente (un UUID de sesión). |
| `start-token` | string | — | Token de inicio del agente; inicia una **nueva** sesión al montar cuando no hay `session-id` establecido. |
| `agent` | string | — | Nombre (o título) del agente que se preselecciona en el estado vacío, mostrado cuando no hay ninguna sesión abierta. |
| `show-selector` | boolean | `false` | Renderiza el selector de sesiones integrado en la cabecera. |
| `hide-header` | boolean | `false` | Oculta la barra de cabecera de agente/modelo (para embebidos compactos). |

**Eventos** (despachados como `CustomEvent` sobre el elemento; lea `event.detail`):

| Evento | `detail` | Cuándo |
|-------|----------|------|
| `session-started` | `{ sessionId: string }` | Se inicia una sesión, ya sea desde `start-token` al montar o por acción del usuario. |
| `error` | `{ message: string }` | Falla la inicialización de la sesión (p. ej. un `start-token` inválido). |

```html
<!-- Inicia una nueva sesión a partir de un token de inicio de agente -->
<wippy-chat start-token="agent-start-token" agent="researcher"></wippy-chat>

<!-- Fija una sesión existente -->
<wippy-chat session-id="019eb2ae-1234-5678-abcd-ef1234567890"></wippy-chat>

<!-- Selector integrado, sin barra de cabecera -->
<wippy-chat show-selector hide-header></wippy-chat>
```

```javascript
document.querySelector('wippy-chat')
  .addEventListener('session-started', (e) => {
    console.log('session:', e.detail.sessionId)
  })
```

### Control reactivo sin volver a montar

Mantenga un único elemento `<wippy-chat>` montado y actualice sus atributos. Un
`session-id` modificado abre esa sesión in situ. Establecer `session-id=""` o eliminar un
atributo previamente controlado es una transición explícita de **Nuevo Chat**: limpia
tanto la sesión fijada como la sesión activa compartida. Un elemento que nunca tuvo un
`session-id` sigue guiado por el selector; la ausencia en el primer montaje no es una
orden explícita.

Cuando hay un `start-token` presente, limpiar `session-id` vuelve a iniciar desde ese token.
Cambiar el token también inicia in situ. El elemento consume un token
una vez por host de elemento personalizado, de modo que reconectar o mover el mismo elemento no
repite un inicio en vivo. Si un token más reciente, una sesión controlada, una selección manual
o una desconexión reemplazan a un inicio en curso, el resultado obsoleto no puede sustituir
a la sesión actual; cualquier sesión creada tardíamente se cierra.

```javascript
const chat = document.querySelector('wippy-chat')

chat.setAttribute('session-id', existingSessionId)

// New Chat with an agent. No element replacement is required.
chat.setAttribute('start-token', agentStartToken)
chat.removeAttribute('session-id')
```

Los resolvedores de componentes de layout gestionado actualizan y eliminan props en el
elemento personalizado existente. Solo vuelven a montar cuando cambia `tagName`, preservando la entrada
de chat, la posición de desplazamiento y el estado de ciclo de vida propiedad del elemento entre actualizaciones del panel.

## `<wippy-chat-messages>` y `<wippy-chat-input>`

La lista de mensajes y el compositor como elementos separados, para que usted mismo los disponga. Cada uno toma un único `session-id`; sin un `session-id` explícito siguen la [sesión activa compartida](#composition--shared-session) establecida por un `<wippy-session-selector>`. Ninguno emite eventos.

```html
<!-- Layout personalizado: mensajes arriba, compositor abajo -->
<div style="display:flex; flex-direction:column; height:100%;">
  <wippy-chat-messages session-id="019eb2ae-…"></wippy-chat-messages>
  <wippy-chat-input    session-id="019eb2ae-…"></wippy-chat-input>
</div>
```

## `<wippy-session-selector>`

Un selector de sesiones. Gobierna la sesión activa compartida que siguen los demás elementos.

| Atributo | Tipo | Por defecto | Descripción |
|-----------|------|---------|-------------|
| `active-session-id` | string | — | Resalta esta sesión como activa. |

**Evento:**

| Evento | `detail` | Cuándo |
|-------|----------|------|
| `select` | `{ sessionId: string }` | El usuario elige una sesión. La sesión elegida pasa a ser la sesión activa compartida. |

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

Los elementos **sin `session-id` explícito** siguen la elección del `<wippy-session-selector>` mediante el `activeSessionId` compartido del gestor. Así, un selector más un chat (o un selector más una lista de mensajes y una entrada separadas) en una misma página permanecen sincronizados: elija una sesión en el selector y los demás se actualizan. Los elementos que **sí** llevan un `session-id` explícito (o `start-token`) quedan fijados e ignoran el selector.

```html
<!-- Selector + chat: el chat sigue la sesión elegida -->
<wippy-session-selector></wippy-session-selector>
<wippy-chat></wippy-chat>

<!-- Selector + lista de mensajes / compositor separados, todos siguiendo al selector -->
<wippy-session-selector></wippy-session-selector>
<wippy-chat-messages></wippy-chat-messages>
<wippy-chat-input></wippy-chat-input>

<!-- Chat fijado junto a uno guiado por el selector -->
<wippy-chat session-id="019eb2ae-…"></wippy-chat>  <!-- ignora el selector -->
<wippy-chat></wippy-chat>                            <!-- sigue al selector -->
```

## Temas

Cada elemento se renderiza en un shadow root, así que los estilos de la página del host no se filtran ni hacia dentro ni hacia fuera. Se aplican dos mecanismos de tema:

- **Variables CSS heredadas.** Las propiedades personalizadas del tema (`--p-primary-*`, `--p-text-color`, …) se heredan a través del límite del shadow desde el tema del host, de modo que el chat adopta la paleta activa y el modo claro/oscuro sin coste. Los estilos basados en selectores (PrimeVue, markdown, Tailwind) se empaquetan en una hoja `chat-elements.css` y se inyectan en el shadow root. `PrimeVuePlugin` redirige el destino de Portal por defecto (body/null) a una capa de overlay fijada dentro del shadow root propietario. No establezca `appendTo: 'self'` de forma rutinaria: es una activación explícita de colocación inline y puede recortarse dentro de contenido desplazable de Dialog o Drawer. Los toasts se delegan al **toast nativo del host** a través del proxy en lugar de renderizarse dentro del shadow.
- **Anulaciones por instancia.** Cada elemento acepta dos atributos:

| Atributo | Tipo | Efecto |
|-----------|------|--------|
| `custom-css` | string | CSS en bruto añadido **al final** dentro del shadow root del elemento, de modo que gana por orden. |
| `css-variables` | object (JSON) | Anulaciones de variables CSS por instancia aplicadas a `:host`. Las claves pueden omitir el `--` inicial. |

```html
<wippy-chat
  session-id="019eb2ae-…"
  custom-css=".message-item { max-width: 80%; }"
></wippy-chat>
```

Omitir `css-variables` es la vía normal que respeta el facade. Las anulaciones de color por instancia son para un aislamiento deliberado del embebido, no para un reestilizado rutinario.

Para el modelo de temas completo — variables semánticas, alternancia claro/oscuro y cómo inyecta el host el CSS del shadow DOM — vea [Temas: Web Components](./web-component-theming.md).

## Cableado en runtime

Dentro de un hijo del Web Host, los elementos no necesitan configuración. La autenticación y la configuración provienen de las globales del proxy que el host ya inyecta (`window.__WIPPY_APP_CONFIG__` / `window.__WIPPY_APP_API__`); REST y WebSocket usan las URLs de entorno de la configuración. Basta con colocar una etiqueta de chat en la página: el shell la registra, los internos se cargan de forma diferida y el chat se conecta con la sesión existente del hijo.

## Vea También

- [Web Component (`view.component`)](./web-component.md) — construir su propio elemento personalizado
- [Paquetes @wippy-fe](../web-host/packages.md) — el import map del host y los shells de elementos inyectados (`@wippy-fe/chat`, `@wippy-fe/loading`)
- [Temas: Web Components](./web-component-theming.md) — CSS de shadow DOM y variables semánticas
- [API del Proxy](./proxy-api.md) — `host.startChat` / `host.openSession` y el resto de `@wippy-fe/proxy`
- [Proxy y Aislamiento](../web-host/proxy-isolation.md) — cómo inyecta el host scripts y configuración en los hijos
