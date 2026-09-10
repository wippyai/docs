---
title: "Layout Multipanel"
description: "El modo managed-layout reemplaza el chrome estándar de Wippy por un árbol de paneles totalmente declarativo. En lugar del shell fijo de chat y barra lateral, usted…"
---

# Layout Multipanel

> **Estado: Draft 1 (vista previa), acceso anticipado, no para producción.** La API de managed-layout está entregada pero aún no probada a fondo en un consumidor de producción. Los nombres de campo, los valores por defecto y las reglas de validación todavía pueden cambiar entre releases menores. Fije una versión exacta del CDN hasta que se retire esta etiqueta. **Para casi todas las aplicaciones el modo estándar `compat` es el modo de producción recomendado**: recurra al layout managed solo cuando realmente necesite componer el chrome en sí.

El modo managed-layout reemplaza el chrome estándar de Wippy por un árbol de paneles totalmente declarativo. En lugar del shell fijo de chat y barra lateral, usted describe un árbol de paneles con nombre en su YAML de backend. El Web Host ensambla el layout al arrancar, lo valida y lo mantiene de forma reactiva en runtime. Los paneles pueden redimensionarse, colapsarse, intercambiarse, añadirse y eliminarse sin recargar la página.

## Cuándo usar el layout managed

El modo estándar `compat` (el predeterminado) le da el producto Wippy fijo: barra lateral de navegación, panel de chat, área de página y un panel derecho de artefactos. Es el modo de producción actual y más usado, y es suficiente para casi todas las aplicaciones.

Adopte `fe_mode = managed` (acceso anticipado) solo cuando necesite componer el chrome en sí:

| Necesidad | Compat | Managed |
|------|--------|---------|
| Chat + navegación estándar de Wippy | Sí | Reemplazable |
| Varios slots de página en paralelo | No | Sí |
| Barra lateral o componente coordinador personalizados | Limitado | Sí: cualquier tipo de panel |
| Layouts responsive por breakpoint | No | Sí |
| Paneles overlay flotantes | No | Sí |
| Componente coordinador sin interfaz | No | Sí (`coordinators`) |
| Enrutamiento consciente de la URL por panel | Solo panel principal | Cada panel `kind: page` |
| Bus de mensajes entre paneles | No | Sí (`broadcast`/`send`/`on`) |

## Compatibilidad

El layout managed abarca el Web Host, el facade y varios paquetes `@wippy-fe/*`. Use una familia de paquetes compatible con la release exacta del Web Host de destino y verifique su import map servido; no mezcle versiones de paquetes de releases no relacionadas.

### Mapa de releases

| Release | Añadidos de managed-layout |
|---|---|
| Web Host `1.0.50`, Wippy FE `0.0.50` | Intents tipados de compat, `@HOST/compat-coordinator`, sincronización de la URL del navegador y de Atrás/Adelante, pestañas de panel incorporadas, paneles flotantes anclados y `useSwapBuffer()`. |
| Web Host `1.0.51`, Wippy FE `0.0.51` | Control reactivo y seguro frente a carreras de sesión/token de `<wippy-chat>`, asas de splitter tematizadas opcionales, restricciones de tamaño solo en el eje de división, correcciones de geometría y apilado de drawers, y el source map del proxy empaquetado. |
| Web Host `1.0.52`, Wippy FE `0.0.52` | Visibilidad tipada de WC retenidos y `useHostVisibilityRefresh()`, disponibilidad inmediata de la página en lugar de esperar al respaldo de 14 segundos, rechazo de claves de renderizador obsoletas, actualizaciones de props de componente en el sitio, y la capa aislada del splitter con `--wippy-layout-splitter-z-index`. |

La revelación de página a los 14 segundos es un respaldo del Web Host `1.0.52`,
no una característica de 1.0.51 ni un retardo de carga de la aplicación. El
dimensionado por eje de división y el chat reactivo llegaron en 1.0.51; la
visibilidad retenida, la disponibilidad con clave y el apilado del splitter
llegaron en 1.0.52.

La visibilidad retenida de web components directos requiere Web Host `1.0.52` y
`@wippy-fe/webcomponent-core`, `@wippy-fe/webcomponent-vue` y
`@wippy-fe/shared` `0.0.52`. Las releases anteriores de managed-layout no
proporcionan el contrato tipado `data-wippy-visible` ni
`useHostVisibilityRefresh()`.

### Actividad retenida de web components

Los layouts managed mantienen los paneles montados a través de los intercambios
de buffer, los cambios de breakpoint y los ciclos de cierre/apertura de drawers.
El host establece `data-wippy-visible="true" | "false"` antes de conectar un
elemento personalizado directo y lo actualiza en el sitio cuando cambia la
propiedad lógica. Esto no es visibilidad de CSS, de viewport ni de documento, y
nunca implica un remontaje.

Los componentes Vue leen el estado con `useHostVisibility()` o combinan la carga
inicial ordinaria con refrescos de revelación mediante
`useHostVisibilityRefresh(task)`. Este último se ejecuta tras el montaje y luego
solo en un `false -> true` exacto. No use el topic `@visibility` del proxy en un
WC directo; es el canal de mensajes de iframe/Web Fragment.

Fije un tag exacto del CDN, al menos `https://web-host.wippy.ai/webcomponents-1.0.52`, hasta que se retire la etiqueta Draft 1.

## Habilitar el layout managed

Habilite la entrada managed en la configuración de su facade y proporcione una declaración `host_config.layout` en el backend:

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

Cuando se selecciona la entrada managed, el facade sirve `managed-layout.js` en lugar de `module.js`. `fe_mode` es un parámetro de requisito actual del facade (por defecto `compat`, opcional `managed`); se establece en el requisito `wippy.facade`, no viaja dentro del payload de `AppConfig`. No hay un campo `AppConfig.feature`: el layout managed se transmite al hijo íntegramente mediante `AppConfig.hostConfig.layout`. La *superficie* de la API del proxy es idéntica en ambos modos, pero algunos comandos solo surten efecto en uno; vea [Qué funciona en cada modo](#what-works-in-which-mode).

## La `HostLayoutDeclaration`

Todo el layout se describe con un único objeto `HostLayoutDeclaration` anidado bajo `host_config.layout` del backend en la configuración de su facade y proyectado a `AppConfig.hostConfig.layout` en el frontend. El host lo valida antes de montar: cualquier `LayoutValidationError` aparece en la consola del navegador con `{ kind, message, panelId? }`.

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `layouts` | `Record<string, PanelTree> & { default: PanelTree }` | Árboles de paneles indexados por breakpoint. La clave `default` es obligatoria. |
| `breakpoints?` | `Record<string, number>` | Anchuras en píxeles que activan claves de layout distintas de la predeterminada. |
| `panels` | `Record<string, HostPanelDef>` | Definiciones de contenido de los paneles con nombre. |
| `floating?` | `Record<string, HostFloatingDef>` | Paneles overlay flotantes definidos al arrancar. |
| `modals?` | `Record<string, HostModalDef>` | Definiciones de modales al arrancar. |
| `coordinators?` | `Record<string, HostCoordinatorDef>` | Componentes coordinadores sin interfaz. |
| `services?` | `Record<string, HostCoordinatorDef>` | Alias obsoleto de `coordinators`; las declaraciones nuevas deben usar `coordinators`. |
| `dragEnabled?` | boolean | Permite arrastrar los splitters por el usuario. Por defecto `true`. |

## Tipos de panel

Cada entrada de `panels`, `floating`, `modals` y `coordinators` es una unión etiquetada por `kind`:

| Tipo | Descripción | Campos obligatorios |
|------|-------------|-----------------|
| `page` | Un módulo de página de Wippy montado en un iframe srcdoc | `id` (id de registry de la página) |
| `artifact` | Un artefacto de Wippy montado en un iframe srcdoc | `id` (UUID del artefacto) |
| `component` | Un web component montado directamente en el DOM del host | `tagName` |
| `builtin` | Un componente del host propiedad del framework (vea abajo) | `id` |

Exactamente un panel del árbol de layout debe llevar `main: true`. La propiedad de la URL del navegador sigue requiriendo sincronización de rutas mediante `@HOST/compat-coordinator` o una coordinación equivalente del consumidor. Todos los demás paneles enrutan de forma independiente dentro de sus iframes.

### IDs de paneles incorporados

`kind: builtin` acepta los siguientes valores de `id`. El prefijo `@HOST/` está reservado para los paneles propiedad del framework:

| ID | Qué renderiza |
|----|-----------------|
| `@HOST/nav-sidebar` | Barra lateral de navegación estándar de Wippy (sesiones, páginas, ajustes) |
| `@HOST/chat-wrapper` | Panel de chat estándar de Wippy para la sesión activa |
| `@HOST/artifact-viewer` | Visor genérico de artefactos (combínelo con la ruta `/:uuid`) |
| `@HOST/session-selector` | Lista y selector de sesiones |
| `@HOST/compat-coordinator` | Coordinador sin interfaz de intents de compat y de la ruta principal; decláre­lo bajo `coordinators` |
| `@HOST/panel-tab` | Pestaña de borde para revelar un panel colapsado; decláre­la bajo `floating` |

Un `@HOST/<id>` desconocido provoca un `LayoutValidationError` al cargar la declaración, en lugar de renderizar en silencio un slot vacío.

## Layouts indexados por breakpoint

El campo `layouts` mapea claves de breakpoint a árboles de paneles. `default` se usa siempre salvo que coincida un breakpoint más estrecho. Las anchuras en píxeles de los breakpoints se definen bajo `breakpoints`:

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

Cuando cambia el breakpoint, los paneles con el mismo `id` conservan un único host de contenido estable que sigue visualmente al slot activo sin reparentar. El `contentWindow` del iframe, el estado del web component, el estado de Vue y la posición de scroll sobreviven a la transición; se evita deliberadamente reparentar con Teleport, porque eliminar y reinsertar un iframe lo recarga.

### Paneles en modo drawer

Un slot de panel puede declarar `display: 'drawer-left' | 'drawer-right' | 'drawer-bottom'` para renderizarse como un overlay deslizante en lugar de como un elemento flex en línea. Los paneles drawer:

- No participan en el dimensionado de pistas de su contenedor padre (`size` se ignora)
- Se renderizan como overlays de posición absoluta anclados al borde indicado
- Tienen un estado de apertura/cierre que se conmuta con `host.layout.openDrawer(id)` / `closeDrawer(id)` / `toggleDrawer(id)`
- Muestran un backdrop cuando están abiertos; hacer clic en el backdrop cierra todos los drawers abiertos

Los slots con `main: true` no pueden estar en modo drawer: la validación del host lanza un error. El campo `drawerSize.width` controla la anchura de los drawers izquierdo y derecho; `drawerSize.height`, la de los drawers inferiores. El valor por defecto es `320px`.

## Paneles flotantes

Los paneles flotantes son overlays de posición libre declarados bajo `floating`. No participan en el árbol de layout flex y pueden añadirse o eliminarse en runtime:

```yaml
floating:
  flap:
    kind: component
    tagName: my-right-flap
    position: { x: 0, y: 200 }
    size: { width: 48, height: 80 }
```

Gestión en runtime:
```typescript
// Anadir un panel flotante
host.layout.addFloating('inspector', {
  kind: 'component',
  tagName: 'my-inspector',
  position: { x: 100, y: 100 },
  size: { width: 400, height: 300 },
})

// Eliminarlo
host.layout.removeFloating('inspector')
```

## Coordinadores sin interfaz

Los coordinadores son componentes montados en un host oculto. No tienen slot visible pero reciben la API del host con ámbito de panel. Úselos para lógica transversal, de modo que los paneles de presentación se mantengan centrados en renderizar. El campo antiguo `services` sigue siendo un alias de compatibilidad obsoleto.

```yaml
coordinators:
  coordinator:
    kind: component
    tagName: my-coordinator
```

Un componente coordinador recibe el envoltorio del host con ámbito de panel y puede suscribirse a canales del bus de inmediato en `onMount`:

```typescript
import { WippyElement } from '@wippy-fe/webcomponent-core'

class MyCoordinator extends WippyElement {
  protected onMount() {
    this.host?.layout.on('open-chat', ({ payload }) => {
      this.host?.layout.updatePanel('right', { route: `/open-chat/${payload.token}` })
      this.host?.layout.expandPanel('right')
    })
  }
  protected onUnmount() {}
  static get wippyConfig() { return { propsSchema: { properties: {} } } }
}
customElements.define('my-coordinator', MyCoordinator)
```

### Coordinador de compat entregado

El layout managed contiene solo superficies declaradas. Llamadas como
`host.openArtifact()`, `host.startChat()`, `host.openSession()` y
`host.navigate()` publican por tanto intents tipados en el canal reservado
`@HOST/intent`. Declare el coordinador entregado para actuar sobre ellos y para
ligar la URL del navegador al panel principal:

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

Mantenga `routeSync: true` cuando use el contrato de navegación estándar. Sin un
coordinador o lógica equivalente del consumidor, los enlaces profundos,
Atrás/Adelante y la navegación de `@HOST/nav-sidebar` no tienen ninguna ruta de
panel que dirigir. Los intents lanzados durante el arranque del hijo se retienen
en una cola acotada hasta que se suscribe el primer coordinador.

`@HOST/` está reservado en ambas direcciones: los paneles ordinarios no pueden
publicar tráfico del sistema, y solo las entradas bajo `coordinators` lo reciben
a través de APIs soportadas del host. Este límite se aplica a los paneles de
iframe/Web Fragment. Un componente directo montado en el reino del host comparte
el DOM del host y no es un sandbox de seguridad. Al arrancar, el host imprime una
tabla de paridad cuando falta el manejo de coordinadores, una superficie de
destino para modales, la vinculación de la URL al panel principal o una etiqueta
de coordinador declarada; una declaración completa no produce ninguna
advertencia.

## El bus de difusión dentro de la pestaña

Los paneles se comunican mediante un bus con ámbito en la pestaña actual del navegador. El bus nunca cruza a otras pestañas: use un topic de WebSocket propio si necesita sincronización entre pestañas.

| Método | Descripción |
|--------|-------------|
| `host.layout.broadcast(channel, payload)` | Publica a todos los paneles; el emisor queda excluido |
| `host.layout.send(targetPanelId, channel, payload)` | Publica a un panel concreto |
| `host.layout.on(channel, handler)` | Se suscribe; devuelve una función `off()` para cancelar |

El `sourcePanelId` de los mensajes recibidos lo establece el host a partir de la ventana emisora y no puede falsificarse. Los nombres de canal son cadenas planas sensibles a mayúsculas.

**Importante:** los componentes que importan `host` directamente de `@wippy-fe/proxy` se saltan el ámbito de panel: las llamadas al bus pasan, pero pierden `sourcePanelId`. Use siempre el envoltorio con ámbito de panel:

```typescript
// HTMLElement en crudo
import { getWippyHost } from '@wippy-fe/webcomponent-core'
const host = getWippyHost(this)

// Subclase de WippyElement: this.host ya tiene ambito de panel
this.host?.layout.broadcast('open-chat', { token: 'abc' })

// Componente Vue
import { useHost } from '@wippy-fe/webcomponent-vue'
// ProxyApiInstance es un tipo global ambiental (de @wippy-fe/types-global-proxy): referencielo sin import.
const host = useHost<ProxyApiInstance['host']>()
host?.layout.broadcast('open-chat', { token: 'abc' })
```

## Referencia de la API de layout (`host.layout`)

| Método | Descripción |
|--------|-------------|
| `.snapshot` | Getter síncrono que devuelve el snapshot completo del layout, o `null` fuera del modo managed-layout |
| `.resizePanel(id, size)` | Redimensiona el panel indicado en el breakpoint activo |
| `.collapsePanel(id)` | Colapsa un panel declarado como `collapsible: true` |
| `.expandPanel(id)` | Expande un panel colapsado |
| `.openDrawer(id)` | Abre un panel en modo drawer |
| `.closeDrawer(id)` | Cierra un panel en modo drawer |
| `.toggleDrawer(id)` | Conmuta un panel en modo drawer |
| `.movePanel(id, target)` | Mueve el panel a una nueva posición del árbol |
| `.removePanel(id)` | Elimina el panel de todos los layouts de breakpoint |
| `.updatePanel(id, def)` | Parchea la definición del panel en runtime; `props` se fusiona superficialmente, los campos de nivel superior reemplazan |
| `.addFloating(id, def)` | Añade un panel flotante |
| `.removeFloating(id)` | Elimina un panel flotante |
| `.openModal(id, def?)` | Abre por id un modal declarado, sobrescribiendo opcionalmente su definición. Los modales solo de runtime requieren `def`. El `<dialog>.showModal()` nativo es el comportamiento por defecto; pase `useNativeDialog: false` para el overlay heredado con div. Reabrir un id ya abierto es un no-op silencioso. |
| `.closeModal(id)` | Cierra un modal abierto |
| `.broadcast(channel, payload)` | Publica a todos los paneles |
| `.send(target, channel, payload)` | Publica a un panel |
| `.on(channel, handler)` | Se suscribe a un canal del bus |

`openModal()` documenta infraestructura de layout interna del host, no una receta para componentes de aplicación. La UI de producto en Vue entregada debería usar el `Dialog` de PrimeVue o la API de confirmación del host, en lugar de clonar este comportamiento de diálogo nativo con estilos de modal propios.

### Semántica de fusión de `updatePanel`

`host.layout.updatePanel(id, def)` parchea una definición de panel existente: no la reemplaza. El objeto `props` se **fusiona superficialmente** con las props actuales del panel: las claves suministradas se añaden o se sobrescriben, las omitidas se conservan. Cualquier **otro** campo de nivel superior de `def` (`route`, `kind`, `id`, `tagName`, `title`, `icon`, …) **reemplaza** el valor actual por completo.

Dado un panel cuyas props actuales son `{ artifactId: 'old', zoom: 2 }`:

```typescript
// props se fusiona superficialmente -> { artifactId: 'abc', zoom: 2 }
host.layout.updatePanel('right', { props: { artifactId: 'abc' } })

// route reemplaza por completo; props queda intacto
host.layout.updatePanel('right', { route: '/x' })
```

Dos advertencias: la fusión de props es **superficial** (un objeto anidado dentro de `props` se reemplaza entero, no se fusiona en profundidad) y una fusión superficial no puede borrar una clave de prop (solo puede sobrescribirla).

## Composables de Vue: `@wippy-fe/vue-host`

Estos composables envuelven la API de layout del proxy en refs reactivas de Vue 3. La suscripción subyacente tiene ámbito de módulo y vive durante toda la vida del iframe, así que no hay limpieza por componente al desmontar:

| Composable | Devuelve |
|------------|---------|
| `useWippyLayout()` | Estado completo del layout y métodos de mutación |
| `useWippyPanel(panelId)` | Estado en vivo del panel indicado (`panelId` es obligatorio: `string`, `Ref<string>` o getter) |
| `useWippyBreakpoint()` | Nombre del breakpoint activo como ref reactiva |
| `useWippyMainRoute()` | Ref reactiva a la ruta actual del panel principal |

Los composables nunca devuelven `null`: siempre devuelven objetos/refs cuyo `.value` interno se degrada cuando no hay un host de managed-layout presente: `useWippyLayout().snapshot.value` es `null` (e `isManaged.value` es `false`, así que las mutaciones son no-ops silenciosas), `useWippyBreakpoint().value` y `useWippyMainRoute().value` son cadenas vacías, y `useWippyPanel(id).value` es `null` cuando el id está ausente. Compruebe la presencia del host con `layout.isManaged.value` (o `layout.snapshot.value !== null`) en lugar de con una comprobación `=== null` sobre el valor devuelto. Esto mantiene los composables usables en playgrounds independientes y pruebas unitarias donde no hay host de managed-layout.

## Buffering de intercambio sin remontajes

`useSwapBuffer()` de `@wippy-fe/layout` mantiene montada la superficie saliente
hasta que el contenido entrante informa de que está listo, con un techo de
timeout explícito. Use el `slot.index` inmutable como clave del DOM, pase tanto
el índice como la clave de contenido a `markReady()` / `markFailed()` para que
se rechacen las señales asíncronas obsoletas, y mantenga los errores acotados por
buffer. La identidad del contenido pertenece a `keyOf`; cambiar la clave del DOM
reinsertaría un iframe y destruiría el estado que el buffering pretende
conservar.

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
// o: swap.markFailed(slot.index, error, slot.key)
```

Los valores mostrados son los predeterminados. Un timeout de disponibilidad
revela el contenido por defecto en lugar de dejar contenido obsoleto tras un
loader. Ligue la UI de carga a `swap.showLoader`, no directamente a la
disponibilidad. Un buffer fallido queda aislado de su hermano; tras gestionar el
error, llame a `clearError(index)` para reintentar.

### Disponibilidad de páginas en el Web Host

El Web Host usa la misma disciplina de disponibilidad con clave para las
superficies de página managed, con un techo final de revelación de 14 segundos.
Los renderizadores de iframe y de Web Component directo emiten `load` / `error`
mediante listeners de eventos de Vue e incluyen la clave de contenido inmutable
propiedad de ese renderizador. El contenido pintado se revela por tanto de
inmediato; el techo es solo un respaldo para el contenido que nunca informa.
Un evento tardío de un renderizador desalojado se rechaza cuando su índice de
buffer ya se ha reutilizado.

No use el techo de 14 segundos del host como retardo de carga de la aplicación, y
no añada un segundo temporizador alrededor de la disponibilidad normal de una
página. Una página que alcanza el techo con regularidad tiene una ruta de
disponibilidad o de ciclo de vida rota que debe corregirse en su propietario.

### Actualizaciones estables de componentes y dimensionado de paneles

Para `kind: component`, cambiar las `props` del panel actualiza o elimina
atributos del elemento personalizado existente. El host reemplaza el elemento
solo cuando cambia `tagName`. Esto preserva el estado propiedad del elemento
durante las llamadas a `updatePanel()` y las transiciones de breakpoint.

`minSize` y `maxSize` restringen únicamente el eje de división activo: la anchura
en un árbol horizontal y la altura en uno vertical. No limitan el eje transversal,
así que la navegación, el chat y otros montajes de altura completa pueden llenar
su pista. Los montajes de drawer siguen la geometría animada del drawer y se
promueven por encima de su ancla y de su backdrop solo mientras están abiertos,
sin remontar su contenido.

## Estilos del splitter y del asa

El área de impacto del splitter es más ancha que su línea visible y vive en la
pila de capas aislada del paquete. `--wippy-layout-splitter-z-index` vale `700`
por defecto, por debajo de los drawers y de los backdrops de modal. El asa
circular es opcional:

| Variable | Por defecto | Propósito |
|---|---|---|
| `--wippy-layout-splitter-size` | `1px` | Grosor de la línea visible del splitter |
| `--wippy-layout-splitter-hit-size` | `10px` | Área de impacto del puntero alrededor de la línea; `24px` en punteros gruesos |
| `--wippy-layout-splitter-z-index` | `700` | Capa del splitter y del asa |
| `--wippy-layout-splitter-handle-size` | `0` | Diámetro del asa; `0` la deshabilita |
| `--wippy-layout-splitter-handle-bg` | `transparent` | Relleno del asa |
| `--wippy-layout-splitter-handle-border` | `0 solid transparent` | Atajo de borde |
| `--wippy-layout-splitter-handle-shadow` | `none` | Sombra del asa |
| `--wippy-layout-splitter-handle-icon-color` | `transparent` | Color SVG consciente del tema mediante `currentColor` |

Establezca tamaño, relleno, borde/sombra y color de icono a la vez al activarla.
El SVG rota 90 grados en los splitters verticales y permanece oculto en las
divisiones bloqueadas.

## Qué funciona en cada modo

La *superficie* de la API del proxy es idéntica en los modos compat y managed (los mismos imports de `@wippy-fe/proxy` resuelven en ambos), pero dos partes de ella son **específicas de modo en cuanto a su efecto**. Este desajuste es lo principal a vigilar al mover una app al layout managed (y una razón por la que managed sigue en acceso anticipado).

### `host.layout` solo surte efecto en modo managed

El host instala el receptor de layout **solo cuando se declara un layout** (la entrada managed, condicionada a `hostConfig.layout`). En modo compat `host.layout` sigue existiendo, pero `host.layout.snapshot` es `null` y toda mutación y llamada al bus (`resizePanel`, `updatePanel`, `movePanel`, `openModal`, `addFloating`, `broadcast`, `send`, `on`, …) es un **no-op silencioso**: el mensaje se publica pero nada en el host está escuchando. Condicione al snapshot antes de mutar:

```typescript
if (host.layout.snapshot) {
  host.layout.updatePanel('right', { route: '/details' })   // solo managed
}
// Vue: const { isManaged } = useWippyLayout(); if (isManaged.value) { … }
```

(Aparte, en un eje distinto: `addPanel` y `setLayout` no se exponen sobre el proxy *en absoluto*, en ninguno de los dos modos; vea [Limitaciones conocidas](#known-limitations).)

### Comandos `host.*` que asumen el shell de compat

El shell managed renderiza **solo el layout que usted declara**. A partir del Web Host 1.0.50, los comandos que normalmente apuntan al chrome de compat publican mensajes tipados `@HOST/intent` en lugar de fallar en silencio. Declare `@HOST/compat-coordinator` o implemente un coordinador equivalente para mapear esos intents a sus paneles:

| Comando `host.*` | Compat (por defecto) | Managed |
|---|---|---|
| `setContext`, `toast`, `confirm`, `handleError`, `logout`, `bridge.*`, `state` / `ws` / `on` de nivel superior | Funciona | Funciona directamente; managed monta las superficies globales de toast y de confirmación |
| `openArtifact(id, ...)` | Abre en el panel derecho o en un modal | Publica un intent; el coordinador de compat apunta a `artifactPanel` o a `modalId` |
| `startChat(token)` / `openSession(uuid)` | Abre y muestra la sesión | Publica un intent; el coordinador de compat resuelve los tokens de inicio y actualiza el `chatPanel` declarado |
| `navigate(url)` | Hace push en el router raíz de compat | Publica un intent; `routeSync` lo aplica al panel principal y mantiene alineado el historial del navegador |
| `onRouteChanged(route, navId?)` | Dirige la URL del navegador del host | Actualiza el estado de ruta del panel; `routeSync` proyecta la ruta del panel principal a la URL del navegador |

Si todavía no hay un coordinador disponible, los intents de arranque se retienen en una cola acotada hasta la primera suscripción de un coordinador. Una declaración sin manejador la informa la tabla de paridad del arranque. Los intents reservados solo son legibles por las entradas de `coordinators` y no pueden ser falsificados por paneles ordinarios.

## Enfoque de gestión de estado

Tres niveles, por orden de preferencia:

**Ruta**: si el usuario pudiera marcar como favorito o compartir el estado de forma significativa, póngalo en la URL. Cada panel `kind: page` ejecuta su propio router y reacciona a los eventos `@history`. Esto está desacoplado, admite enlaces profundos y es consciente del historial del navegador.

**Snapshot del layout**: si afecta a la forma del layout (tamaños, flags de colapsado, props de componente), póngalo en el snapshot mediante `updatePanel` o `resizePanel`. Cada panel suscrito ve cada cambio del snapshot, así que mantenga los payloads pequeños.

**Local al panel**: todo lo demás (borradores de formulario, estado de modales, UI transitoria) se queda dentro de los stores de Pinia o de las refs del propio panel y nunca lo abandona.

## Patrón canónico de coordinación

El patrón recomendado para la interacción entre paneles es: evento del bus → servicio coordinador → `updatePanel` → el panel reacciona mediante su propio router.

```typescript
// En el servicio coordinador
this.host?.layout.on('open-chat', ({ payload }) => {
  this.host?.layout.updatePanel('right', { route: `/open-chat/${payload.token}` })
  this.host?.layout.expandPanel('right')
})

// En la app del panel derecho (un modulo de pagina Vue normal)
const router = createAppRouter([...])
// createAppRouter ya refleja los eventos de historial del host en el router
// con una guarda de eco/ruta actual; no anada ninguna suscripcion manual de enrutamiento.
```

Mantenga los coordinadores finos. Mantenga a los paneles como dueños de su propia UI.

## Limitaciones conocidas

A fecha del Draft 1, lo siguiente aún no está implementado:

- **`addPanel` / `setLayout` sobre el proxy**: no entregados. Existen solo en el `LayoutManager` interno de `@wippy-fe/layout` y no se exponen a través del límite del proxy del iframe. (`openModal`, `closeModal` y `movePanel` sí están entregados; vea la Referencia de la API de layout.)
- **UI de arrastre para reordenar paneles**: el modelo de datos y la API `movePanel()` funcionan; el arrastre de cara al usuario aún no está implementado.
- **Primitiva de pestañas**: aún no implementada.
- **Contenedor de mosaico en cuadrícula**: previsto para una entrega posterior.
- **Persistencia de mutaciones en runtime**: las mutaciones no se persisten entre recargas. Persístalas manualmente si lo necesita:
  ```typescript
  on('@layout-change', () =>
    state.set('layout', host.layout.snapshot)
  )
  ```
- **Puntos de extensión de slots en la cabecera de `nav-sidebar`**: las posiciones del logo, el nombre de la app y el botón de conmutación son fijas en este borrador.

## Vea también

- [Punto de Entrada del Facade](./entry-point.md): cómo el facade carga el punto de entrada de módulo JS y entrega la configuración
- [Secuencia de Arranque](./bootstrap.md): cómo el host despacha al punto de entrada de managed-layout al arrancar
- [Paquetes](./packages.md): `@wippy-fe/layout`, `@wippy-fe/vue-host`, `@wippy-fe/webcomponent-core`, `@wippy-fe/webcomponent-vue`
