---
title: "Descripción general de Web Host"
description: "Cómo encajan Web Host alojado en CDN, la página de fachada y los micro frontends hijos en una aplicación Wippy."
---

# Descripción general de Web Host

Esta página es una referencia de arquitectura. Explica los límites del despliegue y los puntos de entrada; la configuración se describe en las guías enlazadas de fachada y micro frontends.

Wippy Web Host es una aplicación de una sola página con Vue 3, construida con la metodología Feature-Sliced Design y distribuida desde `https://web-host.wippy.ai`. Aloja las páginas y componentes de interfaz de una aplicación Wippy. Se configura mediante el módulo backend `wippy/facade`; no se compila ni despliega junto con la aplicación.

![Arquitectura de Wippy FE](../diagrams/fe-arch-overview.svg)

## Modelo de tres capas

Una aplicación Wippy en ejecución se compone de tres capas anidadas:

**Capa 1 — Página servida por `wippy/facade`.** Es la página HTML renderizada por el backend. El módulo `wippy/facade` registra un servidor de archivos estáticos y un endpoint `/facade/config` en el gateway de Wippy. Cuando un usuario abre la aplicación, `wippy/facade` sirve una página HTML mínima que carga desde la CDN la entrada de Web Host como módulo JavaScript (`module.js` para compat, `managed-layout.js` para managed) y la inicializa con la configuración de `/facade/config`. La página no contiene Vue ni React de por sí: es deliberadamente mínima.

**Capa 2 — Web Host.** El bundle de Web Host se carga como módulo JavaScript y toma el control de toda la página y su historial. Es propietario del chrome de Wippy: navegación, chat, gestión de sesiones y superficie de renderizado. Recibe toda su configuración mediante la llamada de inicialización de la página y no contiene URL ni tokens específicos del despliegue. Por ello, el mismo bundle de CDN puede servir despliegues diferentes. En integraciones manuales sin fachada, el host puede ejecutarse dentro de un iframe mediante la entrada `iframe.html` descrita más adelante.

**Capa 3 — Micro frontends hijos.** Web Host renderiza módulos `view.page` mediante el motor configurado: un iframe srcdoc heredado o un Web Fragment. Monta módulos `view.component` como elementos personalizados. El motor iframe proporciona un contexto de navegación separado. Un Web Fragment usa un realm reframed reflejado en el documento host y no constituye un límite de aislamiento; el shadow root de un componente aísla selectores, no autoridad. Cada superficie recibe el adaptador proxy adecuado para acceso a la API de Wippy, contexto de autenticación, entrega del tema y comunicación sin necesitar URL específicas del despliegue.

```
Page (wippy/facade HTML — loads module.js / managed-layout.js)
  └─ Web Host (takes over the page + browser history)
       ├─ Chat UI, navigation, sidebar
       └─ Child micro-frontends
            ├─ view.page → srcdoc iframe or Web Fragment + proxy adapter
            └─ view.component → custom element + @wippy-fe/proxy ESM
```

## Puntos de entrada

La CDN de Web Host sirve varios puntos de entrada desde el mismo directorio versionado. Elija uno según la integración. Cada entrada está disponible en `<release-tag>/<entry>`, por ejemplo `/<release-tag>/module.js`.

| Entrada | Caso de uso |
|---------|-------------|
| `module.js` | Aplicación completa en modo **compat**: shell estándar con barra lateral de navegación, área de página y panel derecho de chat. Se monta directamente en la página mediante `window.initWippyApp()`, controla toda la página y su historial. Es la entrada que sirve actualmente `wippy/facade` por defecto. |
| `managed-layout.js` | Aplicación completa en modo **managed**: layout declarativo multipanel. La fachada la sirve cuando `fe_mode = managed`. Acceso anticipado; consulte [Layout multipanel](./multi-panel-layout.md). |
| `iframe.html` | Aplicación completa **dentro de un iframe** para aislamiento o integración en parte de una página. Úsela en integraciones manuales sin fachada en las que proporcione la configuración mediante un handshake PostMessage `SetConfig`. La fachada carga las entradas de módulo JavaScript anteriores, no esta. |
| `chat-iframe.html` | Interfaz de chat mínima sin barra lateral ni páginas. Útil para integrar un widget de chat específico. |
| `chat.js` | Módulo ESM headless que expone stores de chat y cliente WebSocket. Úselo para crear interfaces totalmente personalizadas. |
| `ws.js` | Servicio WebSocket independiente sin dependencias de Vue ni Pinia. Úselo en integraciones de tiempo real de bajo nivel. |

En despliegues estándar basados en `wippy/facade`, nunca se referencian estas rutas directamente. La fachada lee `fe_facade_url` de su configuración, selecciona la entrada JavaScript correspondiente a `fe_mode` (`module.js` para compat, `managed-layout.js` para managed) y construye automáticamente la URL correcta.

## Versionado de CDN

Web Host se versiona por etiqueta Git. El patrón canónico de URL de producción es:

```
https://web-host.wippy.ai/<release-tag>/
```

`<release-tag>` es la etiqueta de release Git de Web Host: una versión estable o un despliegue de vista previa de una rama. La CDN de staging está en `https://web-host.staging.wippy.ai/<release-tag>/`.

Normalmente, `wippy/facade` selecciona la versión mediante su `fe_facade_url` predeterminada, que apunta a una compilación de Web Host compatible. Actualizar `wippy/facade` mueve por tanto el despliegue a su versión correspondiente de Web Host. Las aplicaciones hijas que comparten bibliotecas de proveedor mediante import map reciben las versiones proporcionadas por esa compilación.

Para fijar una versión concreta de Web Host —mantener una compilación conocida o usar una etiqueta de acceso anticipado— sobrescriba el parámetro `fe_facade_url`:

```yaml
- name: fe_facade_url
  value: https://web-host.wippy.ai/<release-tag>
```

Esto fija todo el despliegue a esa compilación. Consulte [overrides de CLI](../../guides/cli.md) para la sintaxis `-o` / `--override` que permite establecerlo en runtime.

## Stack tecnológico

Web Host usa Vue 3 (Composition API), PrimeVue + Tailwind CSS 3 para componentes de interfaz, Pinia para gestión de estado, Vue Router para navegación y Axios para HTTP.

### Externalización de dependencias de hijos

Durante el desarrollo, obtenga `<fe_facade_url>/import-map.json` e incluya en los externals de Rollup todas las claves de su objeto `imports`, aunque el artefacto actual no importe alguna de ellas. Empaquete una dependencia importada solo cuando su especificador exacto esté ausente. Vuelva a obtenerlo cuando cambie la etiqueta de Web Host o se añada una dependencia.

## Véase también

- [Punto de entrada de la fachada](./entry-point.md) — Cómo entrega la fachada Web Host a los usuarios y cómo fluye la configuración
- [Secuencia de bootstrap](./bootstrap.md) — Qué ocurre dentro de Web Host después de recibir la configuración
- [Layout multipanel](./multi-panel-layout.md) — Modo managed para shells multipanel personalizados
- [Paquetes](./packages.md) — Paquetes npm `@wippy-fe/*` disponibles para aplicaciones hijas
- [Módulo Facade](../../framework/facade.md) — Configuración backend de `wippy/facade`
- [Motores de renderizado](./render-engines.md) — Los dos motores de páginas: iframe srcdoc y Web Fragment
