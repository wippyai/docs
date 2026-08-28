---
title: "Diseño multipanel"
description: "Referencia de acceso anticipado para declarar y controlar el layout multipanel gestionado de Web Host."
---

# Diseño multipanel

Esta es una referencia de configuración y API de acceso anticipado. Los bloques YAML y TypeScript son declaraciones parciales, no un shell listo para producción.

> **Estado: vista previa Draft 1; no usar en producción.** La API existe, pero no se ha validado con un consumidor de producción. Campos, valores y validación pueden cambiar entre versiones menores. Fije una versión exacta de CDN hasta retirar esta etiqueta. Use `compat` en producción salvo que necesite componer el chrome del host.

El modo managed sustituye el chrome estándar por un árbol declarativo de paneles. Defina paneles con nombre en YAML; Web Host construye y valida al arrancar y lo mantiene de forma reactiva. Se pueden redimensionar, colapsar, intercambiar, añadir y eliminar sin recargar.

## Cuándo usarlo

`compat` es el modo de producción predeterminado con navegación, chat, área de página y panel de artefactos fijos. Active `fe_mode = managed` solo si necesita componer el chrome:

| Necesidad | Compat | Managed |
|-----------|--------|---------|
| Chat y navegación estándar | Sí | Sustituibles |
| Varias páginas lado a lado | No | Sí |
| Sidebar o coordinador personalizado | Limitado | Sí |
| Layouts por breakpoint | No | Sí |
| Paneles flotantes | No | Sí |
| Coordinador headless | No | Sí (`coordinators`) |
| Routing por panel | Solo principal | Cada panel page |
| Bus entre paneles | No | Sí |

## Compatibilidad

Use una familia compatible con la versión exacta de Web Host y verifique su import map; no mezcle versiones de releases distintas.

### Mapa de releases

| Versión | Adiciones administradas |
|---------|-------------------|
| Host `1.0.50`, FE `0.0.50` | Intents compat tipados, `@HOST/compat-coordinator`, sincronización URL, tabs laterales, flotantes anclados y `useSwapBuffer()`. |
| `1.0.51` / `0.0.51` | Control reactivo de sesión/token de `<wippy-chat>`, handles de splitter, límites por eje, correcciones de drawers y source map del proxy. |
| `1.0.52` / `0.0.52` | Visibilidad tipada de WC retenidos, `useHostVisibilityRefresh()`, disponibilidad inmediata con una alternativa tras 14 s, rechazo de claves obsoletas, actualización de props y capa de splitter. |
| `1.0.53` / `0.0.53` | Tokens de tema correctos al forzar claro u oscuro. |
| `1.0.54` / `0.0.54` | Contrato de superficies v1 para iframe y Fragment. |
| `1.0.55` / `0.0.55` | Contratos de artefactos managed y chat independiente, deep links fríos y splitters temáticos. |
| `1.0.56` / `0.0.56` | Correcciones de artefactos/modal, motivos de apertura publicados y ciclo de selector/slots de chat. |

El reveal de 14 segundos es un fallback de 1.0.52, no una función de 1.0.51 ni una demora de aplicación.

### Actividad de web components retenidos

La visibilidad de componentes directos retenidos exige Web Host `1.0.52` y `@wippy-fe/webcomponent-core`, `@wippy-fe/webcomponent-vue` y `@wippy-fe/shared` `0.0.52`. El host establece `data-wippy-visible="true" | "false"` antes de conectar el elemento y lo actualiza sin remontar. No es visibilidad CSS, del viewport ni del documento, y nunca implica un remontaje.

En Vue, use `useHostVisibility()` o `useHostVisibilityRefresh(task)`, que se ejecuta después de montar y en transiciones exactas `false -> true`. No use el topic proxy `@visibility` en un WC directo; pertenece a iframe/Fragment.

Esta referencia está validada con `https://web-host.wippy.ai/webcomponents-1.0.56` y `@wippy-fe/*` 0.0.56.

## Activación

Seleccione la entrada managed y declare `host_config.layout`:

```yaml
host_config:
  layout:
    layouts:
      default:
        direction: horizontal
        children:
          - panel: nav
            size: 240px
          - panel: main
            size: 1fr
            main: true
    panels:
      nav:  { kind: builtin, id: '@HOST/nav-sidebar' }
      main: { kind: page,    id: home }
```

La fachada sirve `managed-layout.js` en vez de `module.js`. `fe_mode` es un requisito de fachada, no un campo de `AppConfig`; el layout llega mediante `AppConfig.hostConfig.layout`. No existe un campo `AppConfig.feature`. La superficie proxy es igual en ambos modos, pero algunos comandos solo tienen efecto en uno; consulta [Qué funciona en cada modo](#qué-funciona-en-cada-modo).

## `HostLayoutDeclaration`

Se anida en `host_config.layout` y se proyecta a `AppConfig.hostConfig.layout`. El host valida antes de montar; `LayoutValidationError` aparece con `{ kind, message, panelId? }`.

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `layouts` | `Record<string, PanelTree> & { default: PanelTree }` | Árboles por breakpoint; `default` obligatorio |
| `breakpoints?` | `Record<string, number>` | Anchuras en píxeles |
| `panels` | `Record<string, HostPanelDef>` | Contenido de paneles con nombre |
| `floating?` | `Record<string, HostFloatingDef>` | Overlays flotantes iniciales |
| `modals?` | `Record<string, HostModalDef>` | Modales iniciales |
| `coordinators?` | `Record<string, HostCoordinatorDef>` | Coordinadores headless |
| `services?` | `Record<string, HostCoordinatorDef>` | Alias obsoleto; use `coordinators` |
| `dragEnabled?` | boolean | Permite arrastrar splitters; `true` |

## Tipos de panel

| `kind` | Descripción | Obligatorio |
|--------|-------------|-------------|
| `page` | Página Wippy mediante iframe o Fragment | `id` de página |
| `artifact` | Artefacto mediante resolver del host | UUID `id` |
| `component` | Componente web en DOM del host | `tagName` |
| `builtin` | Componente del framework | `id` |

Exactamente un slot del árbol debe tener `main: true`. La propiedad de la URL requiere `@HOST/compat-coordinator` o coordinación equivalente. Los demás paneles de página enrutan dentro de sus realms.

### ID integrados

| ID | Renderiza |
|----|-----------|
| `@HOST/nav-sidebar` | Navegación estándar |
| `@HOST/chat-wrapper` | Chat de la sesión activa |
| `@HOST/artifact-viewer` | Visor de artefactos |
| `@HOST/session-selector` | Lista y selector de sesiones |
| `@HOST/compat-coordinator` | Coordinador de intents y ruta principal; bajo `coordinators` |
| `@HOST/panel-tab` | Tab lateral para revelar un panel; bajo `floating` |

Un ID `@HOST/` desconocido produce `LayoutValidationError`.

## Layouts por breakpoint

`default` se usa salvo que coincida uno más estrecho:

```yaml
host_config:
  layout:
    breakpoints:
      sm: 768
    layouts:
      default:
        direction: horizontal
        children:
          - panel: side
            size: 300px
          - panel: main
            size: 1fr
            main: true
      sm:
        direction: vertical
        children:
          - panel: main
            size: 1fr
            main: true
          - panel: side
            display: drawer-left
            drawerSize: { width: 320px }
    panels:
      side: { kind: page, id: app-sidebar, route: / }
      main: { kind: page, id: app-home,    route: / }
```

Los paneles con el mismo `id` conservan un host de contenido estable entre breakpoints, sin reparenting. Sobreviven `contentWindow`, estado de WC/Vue y scroll; Teleport se evita porque reinsertar un iframe lo recarga.

### Drawers

`display: 'drawer-left' | 'drawer-right' | 'drawer-bottom'` crea un overlay deslizante. No participa en el tamaño del track, se ancla al borde y se controla con openDrawer/closeDrawer/toggleDrawer. Un slot main no puede ser drawer. `drawerSize.width` controla izquierda/derecha y height el inferior; predeterminado `320px`.

## Paneles flotantes

```yaml
floating:
  flap:
    kind: component
    tagName: my-right-flap
    position: { x: 0, y: 200 }
    size: { width: 48, height: 80 }
```

```typescript
// Add a floating panel
host.layout.addFloating('inspector', {
  kind: 'component',
  tagName: 'my-inspector',
  position: { x: 100, y: 100 },
  size: { width: 400, height: 300 },
})

// Remove it
host.layout.removeFloating('inspector')
```

## Coordinadores headless

Se montan en un host oculto, reciben la API limitada al panel y gestionan lógica transversal. `services` es alias obsoleto.

```yaml
coordinators:
  coordinator:
    kind: component
    tagName: my-coordinator
```

```typescript
import { WippyElement } from '@wippy-fe/webcomponent-core'

class MyCoordinator extends WippyElement {
  private offOpenChat: (() => void) | null = null

  protected onMount() {
    this.offOpenChat = this.host?.layout.on('open-chat', ({ payload }) => {
      this.host?.layout.updatePanel('right', { route: `/open-chat/${payload.token}` })
      this.host?.layout.expandPanel('right')
    }) ?? null
  }
  protected onUnmount() {
    this.offOpenChat?.()
    this.offOpenChat = null
  }
  static get wippyConfig() { return { propsSchema: { properties: {} } } }
}
customElements.define('my-coordinator', MyCoordinator)
```

### Coordinador compat incluido

Managed solo renderiza superficies declaradas. `host.openArtifact()`, startChat(), openSession() y navigate() publican intents tipados en `@HOST/intent`. Declare:

```yaml
coordinators:
  compat:
    kind: builtin
    id: '@HOST/compat-coordinator'
    props:
      artifactPanel: right
      chatPanel: chat
      modalId: artifact-modal
      routeSync: true
      wsActions: true
```

Mantenga `routeSync: true` para navegación estándar. Sin coordinador, deep links, atrás/adelante y navegación no controlan una ruta de panel. Los intents durante boot se guardan en una cola limitada. `@HOST/` está reservado: paneles normales no publican tráfico de sistema y solo coordinadores lo reciben. Esto se aplica a iframe/Fragment; un componente directo comparte DOM y no es sandbox. El host imprime una tabla de paridad si falta coordinación, modal, enlace URL o tag.

## Bus dentro de la pestaña

No cruza pestañas; para eso use WebSocket.

| Método | Descripción |
|--------|-------------|
| `host.layout.broadcast(channel, payload)` | Publica a todos salvo emisor |
| `host.layout.send(targetPanelId, channel, payload)` | Publica a un panel |
| `host.layout.on(channel, handler)` | Suscribe y devuelve `off()` |

El host fija `sourcePanelId` y no puede falsificarse. Los canales distinguen mayúsculas. Importar `host` directamente evita el ámbito y pierde `sourcePanelId`; use el wrapper:

```typescript
// raw HTMLElement
import { getWippyHost } from '@wippy-fe/webcomponent-core'
const host = getWippyHost(this)

// WippyElement subclass — this.host is already panel-scoped
this.host?.layout.broadcast('open-chat', { token: 'abc' })

// Vue component
import { useHost } from '@wippy-fe/webcomponent-vue'
// ProxyApiInstance is an ambient global type (from @wippy-fe/types-global-proxy) — reference it without an import.
const host = useHost<ProxyApiInstance['host']>()
host?.layout.broadcast('open-chat', { token: 'abc' })
```

## API `host.layout`

| Método | Descripción |
|--------|-------------|
| `.snapshot` | Snapshot síncrono o `null` fuera de managed |
| `.resizePanel(id, size)` | Redimensiona en el breakpoint activo |
| `.collapsePanel(id)` | Colapsa un panel declarado con `collapsible: true` |
| `.expandPanel(id)` | Expande un panel colapsado |
| `.openDrawer(id)` | Abre un panel en modo drawer |
| `.closeDrawer(id)` | Cierra un panel en modo drawer |
| `.toggleDrawer(id)` | Alterna un panel en modo drawer |
| `.movePanel(id, target)` | Mueve en el árbol |
| `.removePanel(id)` | Elimina de todos los breakpoints |
| `.updatePanel(id, def)` | Aplica patch; `props` se fusiona superficialmente y los campos superiores sustituyen |
| `.addFloating(id, def)` | Añade un panel flotante |
| `.removeFloating(id)` | Elimina un panel flotante |
| `.openModal(id, def)` | Abre modal; en 0.0.56 `def` es obligatorio y se fusiona con la declaración. Usa `<dialog>.showModal()` salvo `useNativeDialog: false`. Reabrir el mismo ID no hace nada |
| `.closeModal(id)` | Cierra modal |
| `.broadcast(channel, payload)` | Publica a todos los paneles |
| `.send(target, channel, payload)` | Publica a un panel |
| `.on(channel, handler)` | Se suscribe a un canal del bus |

`openModal()` documenta infraestructura interna; la interfaz Vue debe usar `Dialog` de PrimeVue o confirmación del host.

### Semántica de `updatePanel`

Aplica un patch, no reemplaza. `props` se fusiona superficialmente; otros campos se sustituyen por completo.

```typescript
// props shallow-merges → { artifactId: 'abc', zoom: 2 }
host.layout.updatePanel('right', { props: { artifactId: 'abc' } })

// route replaces wholesale; props left untouched
host.layout.updatePanel('right', { route: '/x' })
```

Los objetos anidados se reemplazan y una fusión superficial no elimina claves.

## Composables Vue: `@wippy-fe/vue-host`

| Composable | Devuelve |
|------------|----------|
| `useWippyLayout()` | Estado completo y mutaciones |
| `useWippyPanel(panelId)` | Estado del panel; ID obligatorio |
| `useWippyBreakpoint()` | Breakpoint reactivo |
| `useWippyMainRoute()` | Ruta principal reactiva |

La suscripción vive durante el iframe. Nunca devuelven `null`; sus `.value` degradan: snapshot/panel a `null`, breakpoint/ruta a string vacío, mutaciones no hacen nada. Compruebe `layout.isManaged.value` o snapshot.

## Buffer de intercambio sin remontar

`useSwapBuffer()` de `@wippy-fe/layout` conserva la superficie saliente hasta que la entrante está lista, con timeout. Use `slot.index` inmutable como clave DOM y pase índice y clave a readiness para rechazar señales obsoletas.

```typescript
const swap = useSwapBuffer<Surface>({
  keyOf: surface => surface.ownerId,
  buffers: 2,
  readyTimeoutMs: 8_000,
  loaderDelayMs: 250,
  loaderMinMs: 400,
})

const slot = swap.push(surface)
swap.markReady(slot.index, slot.key)
// or: swap.markFailed(slot.index, error, slot.key)
```

Son valores predeterminados. El timeout revela contenido por defecto. Enlace el loader a `swap.showLoader`; los errores quedan por buffer y se reintentan con `clearError(index)`.

### Readiness de páginas

El Host usa el mismo modelo con techo final de 14 segundos. Los renderers emiten `load`/`error` con clave inmutable; contenido pintado se revela de inmediato y eventos tardíos se rechazan. No use el techo como demora de aplicación ni añada otro timer; alcanzarlo regularmente indica un ciclo roto.

### Actualizaciones y tamaños

En componentes, cambiar `props` actualiza atributos del mismo elemento; solo `tagName` lo reemplaza. `minSize`/`maxSize` limitan el eje de split activo, no el transversal. Los drawers siguen su geometría y suben sobre ancla/backdrop solo abiertos, sin remontar.

## Estilo del splitter

El área de hit es mayor que la línea. `--wippy-layout-splitter-z-index` vale `700`, debajo de drawers y modales. El handle es opcional:

| Variable | Predeterminado | Propósito |
|----------|----------------|-----------|
| `--wippy-layout-splitter-size` | `1px` | Grosor visible |
| `--wippy-layout-splitter-hit-size` | `10px` | Área; `24px` en punteros gruesos |
| `--wippy-layout-splitter-z-index` | `700` | Capa |
| `--wippy-layout-splitter-handle-size` | `0` | Diámetro; 0 lo desactiva |
| `--wippy-layout-splitter-handle-bg` | `transparent` | Fondo |
| `--wippy-layout-splitter-handle-border` | `0 solid transparent` | Borde |
| `--wippy-layout-splitter-handle-shadow` | `none` | Sombra |
| `--wippy-layout-splitter-handle-icon-color` | `transparent` | Color SVG mediante `currentColor` |

Configure tamaño, fondo, borde/sombra y color juntos. SVG rota 90° en splitters verticales y se oculta si están bloqueados.

## Qué funciona en cada modo

La superficie proxy es igual, pero algunos métodos dependen del modo.

### `host.layout` solo tiene efecto en modo managed

`host.layout` solo tiene efecto cuando se declara un layout. En compat, snapshot es `null` y las mutaciones y el bus son no-op silenciosos. Comprueba:

```typescript
if (host.layout.snapshot) {
  host.layout.updatePanel('right', { route: '/details' })   // managed only
}
// Vue: const { isManaged } = useWippyLayout(); if (isManaged.value) { … }
```

`addPanel` y `setLayout` no se exponen en ningún modo.

### Comandos `host.*` que presuponen el shell compat

Los comandos de chrome compat publican intents en managed. El coordinador compat los traduce:

| Comando | Compat | Managed |
|---------|--------|---------|
| `setContext`, `toast`, `confirm`, `handleError`, `logout`, `bridge.*`, `state`/`ws`/`on` | Funciona | Funciona directamente |
| openArtifact | Panel derecho/modal | Intent al panel/modal configurado |
| startChat / openSession | Abre sesión | Intent al panel de chat |
| navigate | Router raíz | Intent a ruta principal y URL |
| onRouteChanged | URL del navegador | Estado del panel; `routeSync` proyecta principal |

Sin coordinador, los intents iniciales esperan en cola limitada. Solo coordinadores leen intents reservados.

## Gestión de estado

1. **Ruta** para estado que debe poder marcarse o compartirse.
2. **Snapshot** para forma del layout: tamaños, colapso, props; mantenga payloads pequeños.
3. **Local al panel** para borradores, modales y estado transitorio.

## Patrón canónico de coordinación

El patrón recomendado es: evento de bus → coordinador → `updatePanel` → el panel reacciona mediante su router.

```typescript
// In the coordinator service
this.host?.layout.on('open-chat', ({ payload }) => {
  this.host?.layout.updatePanel('right', { route: `/open-chat/${payload.token}` })
  this.host?.layout.expandPanel('right')
})

// In the right-panel app (a normal Vue page module)
const router = createAppRouter([...])
// createAppRouter already mirrors host history events into the router
// with an echo/current-route guard; add no manual routing subscription.
```

Mantenga coordinadores finos y paneles propietarios de su interfaz.

**Detalles normativos del contrato**

La declaración backend `HostLayoutDeclaration` se proyecta a
`hostConfig.layout`. Sus colecciones principales son `layouts`, `breakpoints`,
`panels`, `floating`, `modals` y `coordinators`. Cada definición contiene un
`id`, un `kind` y, según el caso, `title`, `icon`, `size`, `route`, `props` o
`tagName`. Los tags válidos incluyen `kind: page`, `kind: component` y
`kind: builtin`; el árbol exige exactamente un `main: true`. Un segundo
`kind: page` puede ocupar cualquier slot no principal. El ID reservado
`@HOST/<id>` incluye `@HOST/nav-sidebar` y
`@HOST/compat-coordinator`.

El modo `compat` mantiene el shell estándar; `managed` activa el
`LayoutManager`. La dependencia se declara en `wippy.facade`, y el runtime se
consume desde `@wippy-fe/proxy`. Los componentes directos usan
`@wippy-fe/webcomponent-core` y `@wippy-fe/webcomponent-vue`; los composables
proceden de `@wippy-fe/vue-host`. El paquete `@wippy-fe/layout` proporciona el
buffer y `@wippy-fe/layout` también define sus contratos de slot. Mantenga toda
la familia `@wippy-fe/*` en una release compatible. La visibilidad retenida
requiere como mínimo `1.0.52`/0.0.52; el contrato actual documentado llega a
`0.0.56` y expone `data-wippy-visible` con valor `false` cuando el panel no está
activo. Use `useHostVisibilityRefresh()` para el refresco al reaparecer.

La API de bus presenta las firmas `.broadcast(channel, payload)`,
`.send(target, channel, payload)` y `.on(channel, handler)`. Las operaciones
subyacentes son `broadcast`, `send` y `on`; el coordinador vuelve a usar
`broadcast`, `send` y `on` al distribuir intents de `@HOST/intent`. No importe
`host` directamente desde `@wippy-fe/proxy` para un componente, porque pierde
el `sourcePanelId`. Obtenga el wrapper con scope mediante `getWippyHost(this)`
de `@wippy-fe/webcomponent-core` o `useHost()` de
`@wippy-fe/webcomponent-vue`.

La API del layout incluye `host.layout.snapshot`,
`host.layout.updatePanel(id, def)`, `host.layout.openDrawer(id)`,
`closeDrawer(id)`, `toggleDrawer(id)`, `addFloating`, `closeModal`,
`movePanel`, `resizePanel`, `updatePanel` y `openModal`. Las mutaciones
`movePanel`, `resizePanel`, `updatePanel` y `openModal` conservan las reglas de
merge descritas arriba. El argumento `def` identifica la definición de modal o
panel y `panelId` identifica el panel receptor. En código Vue, compruebe
`layout.snapshot.value !== null` o `isManaged.value`.

Los coordinadores traducen `host.openSession()`, `host.startChat()` y
`host.navigate()` a intents configurados mediante `artifactPanel`,
`chatPanel`, `modalId` y `routeSync`. Las firmas transportadas son
`openArtifact(id, ...)`, `startChat(token)`, `openSession(uuid)`,
`navigate(url)` y `onRouteChanged(route, navId?)`. La sincronización de la URL
principal usa `@history`; el visor de artefactos usa la ruta `/:uuid`. El
namespace `host.*` no implica por sí mismo que una operación tenga efecto en
ambos modos.

En drawers, `collapsible: true` habilita el colapso y `drawerSize.height`
dimensiona el drawer inferior. En el buffer, `keyOf`, `markReady()` y
`markFailed()` evitan que una señal obsoleta revele otro slot. El ejemplo de
merge conserva `{ artifactId: 'old', zoom: 2 }`; `updatePanel()` fusiona
superficialmente props. Un handle oculto usa el valor `0` y su capa se
controla con `--wippy-layout-splitter-z-index`.

Los composables exponen `useWippyLayout().snapshot.value`,
`useWippyPanel(id).value`, `useWippyBreakpoint().value` y
`useWippyMainRoute().value`. Los dos últimos son `Ref<string>` y los valores
degradan a `null` o a cadena vacía fuera de managed, según el contrato descrito
arriba. El snapshot ausente se puede comprobar con `=== null`.

Los `coordinators` se montan sin slot visible. Cada entrada de `coordinators`
recibe el API con scope, y el mapa `coordinators` puede incluir servicios de
compatibilidad. Los overlays `floating` comparten el identificador `id`. El
ciclo de un coordinador comienza en `onMount`, y las rutas reactivas se exponen
como `string`.

## Limitaciones conocidas

- `addPanel` / `setLayout` no se exponen por proxy; solo existen internamente.
- No hay interfaz drag-to-rearrange, aunque `movePanel()` funciona.
- No hay contenedor genérico de pestañas; `@HOST/panel-tab` solo revela un panel colapsado.
- No hay contenedor grid-tile.
- Las mutaciones no persisten al recargar; persista manualmente si hace falta:

  ```typescript
  on('@layout-change', () =>
    state.set('layout', host.layout.snapshot)
  )
  ```

- Las posiciones del header de `nav-sidebar` son fijas.

## Véase también

- [Punto de entrada](./entry-point.md) — Carga del módulo y configuración
- [Bootstrap](./bootstrap.md) — Selección de la entrada managed
- [Paquetes](./packages.md) — Paquetes de layout y componentes
