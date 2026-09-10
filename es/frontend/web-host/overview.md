---
title: "Visión General del Web Host"
description: "El Wippy Web Host es una aplicación de página única en Vue 3 construida con la metodología Feature-Sliced Design y entregada desde un CDN en…"
---

# Visión General del Web Host

El Wippy Web Host es una aplicación de página única en Vue 3 construida con la metodología Feature-Sliced Design y entregada desde un CDN en `https://web-host.wippy.ai`. Aloja todas las páginas y componentes de UI de cara al usuario de una aplicación Wippy. Usted no lo compila ni lo despliega: lo configura a través del módulo de backend `wippy/facade` y se carga automáticamente.

![Wippy FE architecture](../diagrams/fe-arch-overview.svg)

## Modelo de tres capas

Una aplicación Wippy en ejecución se compone de tres capas anidadas:

**Capa 1: página servida por `wippy/facade`.** Esta es su página HTML renderizada por el backend. El módulo `wippy/facade` registra un servidor de archivos estáticos y un endpoint `/facade/config` en su gateway de Wippy. Cuando un usuario navega a su aplicación, `wippy/facade` sirve una página HTML fina que carga el punto de entrada de módulo JS del Web Host desde el CDN (`module.js` para compat, `managed-layout.js` para managed) y lo inicializa con la configuración de `/facade/config`. La página en sí no lleva Vue ni React: es fina a propósito.

**Capa 2: Web Host.** El bundle del Web Host se carga como un módulo JS que toma el control de toda la página y de su historial del navegador. Es dueño del chrome de Wippy: la barra lateral de navegación, el panel de chat, la gestión de sesiones y la superficie de renderizado de páginas. Recibe su configuración completa de la llamada de inicialización de la página y nunca contiene URLs ni tokens específicos del despliegue en el propio bundle. Eso es lo que hace portable entre despliegues al bundle alojado en el CDN. (Para incrustaciones manuales sin facade, el mismo host puede ejecutarse dentro de un iframe mediante el punto de entrada `iframe.html`; vea la tabla de puntos de entrada más abajo.)

**Capa 3: microfrontends hijos.** El Web Host, a su vez, incrusta vistas definidas por el usuario como iframes anidados (módulos `view.page`) o como web components (módulos `view.component`). Cada hijo se ejecuta de forma aislada. El Web Host inyecta un script de proxy que da a los hijos acceso a la API de Wippy, al contexto de autenticación, al CSS del tema y a los canales de comunicación, todo sin que el hijo necesite saber dónde está desplegado.

```
Page (wippy/facade HTML — loads module.js / managed-layout.js)
  └─ Web Host (takes over the page + browser history)
       ├─ Chat UI, navigation, sidebar
       └─ Child micro-frontends
            ├─ view.page  → srcdoc iframe + proxy.js
            └─ view.component → custom element + @wippy-fe/proxy ESM
```

## Puntos de entrada

El CDN del Web Host sirve varios puntos de entrada desde el mismo directorio versionado. El adecuado depende de cómo esté integrando:

Cada entrada se sirve desde el CDN en `<release-tag>/<entry>` (p. ej. `/<release-tag>/module.js`).

| Entrada | Caso de uso |
|-------|----------|
| `module.js` | App completa en modo **compat**: el shell estándar de barra lateral de navegación + área de página + panel derecho de chat. Se monta directamente en la página mediante `window.initWippyApp()`; toma el control de toda la página y de su historial del navegador. Es la entrada que el `wippy/facade` actual sirve por defecto. |
| `managed-layout.js` | App completa en modo **managed**: el layout multipanel declarativo. La sirve el facade cuando `fe_mode = managed`. Acceso anticipado (vea [Layout Multipanel](./multi-panel-layout.md)). |
| `iframe.html` | App completa ejecutada **dentro de un iframe** para aislamiento o incrustación parcial de página. Úselo para incrustaciones manuales sin facade donde usted suministra la configuración mediante un handshake de PostMessage `SetConfig`. El propio facade carga los puntos de entrada de módulo JS de arriba, no este. |
| `chat-iframe.html` | Interfaz de chat mínima sin barra lateral ni páginas. Útil para incrustar un widget de chat enfocado. |
| `chat.js` | Módulo ESM sin interfaz que expone los stores de chat y el cliente WebSocket. Úselo para construir UIs completamente personalizadas. |
| `ws.js` | Servicio WebSocket independiente sin dependencia de Vue ni Pinia. Úselo para integraciones de tiempo real de bajo nivel. |

Para los despliegues estándar basados en `wippy/facade` nunca referencia estas rutas directamente. El facade lee `fe_facade_url` de su configuración, selecciona el punto de entrada de módulo JS que corresponde a `fe_mode` (`module.js` para compat, `managed-layout.js` para managed) y construye la URL correcta automáticamente.

## Versionado del CDN

El Web Host se versiona por tag de git. El patrón canónico de URL de producción es:

```
https://web-host.wippy.ai/<release-tag>/
```

Donde `<release-tag>` es el tag de release de git del Web Host, ya sea una release estable o un despliegue de vista previa de una rama de funcionalidad. El CDN de staging está en `https://web-host.staging.wippy.ai/<release-tag>/`.

Normalmente no fija la versión en absoluto. El módulo `wippy/facade` se entrega con un `fe_facade_url` por defecto que apunta a un build del Web Host correspondiente, así que **la versión del Web Host se mueve con el módulo del facade**: actualizar `wippy/facade` es la forma de pasar a un Web Host más nuevo. Las apps hijas que comparten bibliotecas de terceros mediante el import map reciben exactamente las versiones que ese build proporciona.

Para fijar una versión concreta del Web Host, ya sea para quedarse en un build conocido como bueno o para adoptar un tag de rama de funcionalidad o de acceso anticipado, sobrescriba el parámetro `fe_facade_url`:

```yaml
- name: fe_facade_url
  value: https://web-host.wippy.ai/<release-tag>
```

Esto fija todo el despliegue a ese build. Vea [overrides de la CLI](../../guides/cli.md) para la sintaxis `-o` / `--override` que permite fijarlo en runtime.

## Stack tecnológico

El Web Host está construido con Vue 3 (Composition API), PrimeVue + Tailwind CSS 3 para los componentes de UI, Pinia para la gestión de estado, Vue Router para la navegación y Axios para HTTP. Durante el desarrollo, obtenga `<fe_facade_url>/import-map.json` y ponga cada clave de su objeto `imports` en los externals de Rollup, incluso si el artefacto actual no importa esa clave. Empaquete una dependencia importada solo cuando su especificador exacto esté ausente. Vuelva a obtenerlo cuando cambie el tag del Web Host o se añada una dependencia nueva.

## Vea también

- [Punto de Entrada del Facade](./entry-point.md): cómo el facade entrega el Web Host a los usuarios y cómo es el flujo de configuración
- [Secuencia de Arranque](./bootstrap.md): qué ocurre dentro del Web Host después de que recibe la configuración
- [Layout Multipanel](./multi-panel-layout.md): el modo de layout managed para shells multipanel personalizados
- [Paquetes](./packages.md): los paquetes npm `@wippy-fe/*` disponibles para los desarrolladores de apps hijas
- [Módulo facade](../../framework/facade.md): configuración de backend para `wippy/facade`
- [Motores de Renderizado](./render-engines.md): los dos motores de renderizado de página (iframe srcdoc frente a Web Fragment)
