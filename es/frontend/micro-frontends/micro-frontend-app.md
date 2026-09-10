---
title: "Receta de Página"
description: "Una receta portable de view.page con enrutamiento soportado, entrega de tema, dependencias y propiedad del build."
---

# Receta de Página

Una página es una aplicación construida con Vite y renderizada en un iframe `about:srcdoc`. Su ruta y el contexto del host provienen de AppConfig y de los paquetes de Wippy, no de la location del navegador.

## Configuración requerida

1. Registre un `view.page` y sus entradas de filesystem/router de servicio.
2. Habilite la entrega de CSS requerida. Mantenga habilitado el bloque de CSS `iframe` para la consistencia por defecto de las barras de desplazamiento.
3. Use `@wippy-fe/router` para el enrutamiento de Vue.
4. Instale PrimeVue y el plugin de PrimeVue de Wippy cuando la página renderice cualquier control similar a PrimeVue.
5. Use el preset compartido de Tailwind de Wippy cuando la página escriba utilidades de Tailwind.
6. Genere los externals a partir del snapshot fijado del import-map del Web Host.
7. Compile hacia el directorio de salida seleccionado por el despliegue.

```ts
import { createApp } from 'vue'
import PrimeVue from '@wippy-fe/theme/primevue-plugin'
import { createAppRouter } from '@wippy-fe/router'
import App from './App.vue'
import { routes } from './routes'

const app = createApp(App)
app.use(PrimeVue)
app.use(createAppRouter(routes))
app.mount('#app')
```

Verifique las firmas exportadas exactas contra la versión del paquete seleccionada. No cree una capa local de sincronización del router.

## Inyección de tema

La página consume el tema del facade entregado en su iframe. Use componentes públicos de PrimeVue, variables públicas del tema, utilidades de Tailwind documentadas como respaldadas en runtime y utilidades de tiempo de compilación explícitamente invariantes.

No use un parámetro de query del host como fixture de la aplicación. AppConfig es el propietario del contexto del host.

## Build

Invoque el target de Make del repositorio del módulo de Wippy. Su receta suministra
la salida de despliegue con:

```text
npm run build -- --outDir <target> --emptyOutDir
```

`vite.config.ts` mantiene el comportamiento de assets relativos y no fija el `outDir` de despliegue.

No invoque directamente el gestor de paquetes subyacente ni el comando de build de Vite.
En Windows, invoque `make.bat`; delega en la implementación `make.ps1`
del target.

Vea [Contrato de Build y Dependencias](./build-system.md), [Topología de la Plataforma](../platform-topology.md) y [Configuración y Casing](./configuration-casing.md).
