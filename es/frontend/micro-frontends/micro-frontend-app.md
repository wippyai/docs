---
title: "Receta de página"
description: "Una receta portable de view.page con routing, entrega de temas, dependencias y propiedad de compilación admitidos."
---

# Receta de página

Una página es una aplicación compilada con Vite que se renderiza mediante el motor iframe heredado `about:srcdoc` o mediante Web Fragment. Su ruta y el contexto del host proceden de AppConfig y de los paquetes de Wippy, no de la ubicación del navegador.

Esta es una receta de integración para un proyecto Vue/Vite existente. Identifica el código de entrada específico de Wippy y el contrato de despliegue; no proporciona una estructura de proyecto independiente ni configuración backend.

## Configuración necesaria

1. Registre una `view.page` y sus entradas de filesystem y router de servicio.
2. Active la entrega CSS necesaria. Cuando pueda seleccionarse el motor iframe, mantenga habilitado el bloque CSS `iframe` para conservar la coherencia predeterminada de las barras de desplazamiento.
3. Use `@wippy-fe/router` para el routing de Vue.
4. Instale PrimeVue y el plugin PrimeVue de Wippy cuando la página renderice algún control similar a PrimeVue.
5. Use el preset compartido de Tailwind de Wippy cuando la página cree utilidades Tailwind.
6. Genere las dependencias externas desde la instantánea del mapa de importación de Web Host fijada.
7. Monte la aplicación en `#app`; los Web Fragments cuyo tamaño depende del contenido requieren ese id exacto de raíz.
8. Compile en el directorio de salida elegido por el despliegue.

```ts
import { createApp } from 'vue'
import PrimeVue from '@wippy-fe/theme/primevue-plugin'
import { createAppRouter } from '@wippy-fe/router'
import { config } from '@wippy-fe/proxy'
import App from './App.vue'
import { routes } from './routes'

const app = createApp(App)
app.use(PrimeVue)
app.use(createAppRouter(routes, {
  initialPath: config.context?.route ?? '/',
}))
app.mount('#app')
```

Verifique las firmas exportadas exactas en la versión de paquete elegida. No cree una capa local de sincronización del router.

## Inyección del tema

La página consume el tema de la fachada entregado en el realm de página seleccionado. Use componentes públicos de PrimeVue, variables públicas de tema, utilidades Tailwind documentadas respaldadas en runtime y utilidades de tiempo de compilación explícitamente invariantes.

No use un parámetro de query del host como fixture de la aplicación. AppConfig es la fuente del contexto del host.

## Compilación

Invoque el target de Make del repositorio del módulo Wippy. Su receta proporciona la salida del despliegue con:

```text
npm run build -- --outDir <target> --emptyOutDir
```

`vite.config.ts` conserva el comportamiento relativo de los assets y no fija `outDir` en el código.

No invoque directamente el gestor de paquetes ni el comando de compilación de Vite subyacente. En Windows, invoque `make.bat`; este delega en la implementación `make.ps1` del target.

Consulte [Contrato de compilación y dependencias](./build-system.md), [Topología de la plataforma](../platform-topology.md) y [Configuración y uso de mayúsculas](./configuration-casing.md).
