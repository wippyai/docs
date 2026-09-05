---
title: "Micro Frontends de Wippy"
description: "El código de frontend de Wippy se ejecuta dentro del límite de aislamiento del Web Host. Hay dos tipos de artefacto que puede construir: apps de micro frontend y web…"
---

# Micro Frontends de Wippy

El código de frontend de Wippy se ejecuta dentro del límite de aislamiento del Web Host. Hay dos tipos de artefacto que puede construir: **apps de micro frontend** y **web components**. Ambos son proyectos Vite independientes, ambos se comunican con la plataforma mediante `@wippy-fe/proxy` y ambos se declaran al backend mediante una entrada de registry en `_index.yaml`. La diferencia está en cómo se renderizan y para qué son adecuados.

## App de micro frontend frente a web component

| | App de micro frontend (`view.page`) | Web component (`view.component`) |
|---|---|---|
| **Se renderiza como** | Iframe completo, contexto de navegación aislado | Elemento personalizado en Shadow DOM, dentro de una página |
| **Tiene su propia URL / entrada de navegación** | Sí: reclama un `mountRoute` del backend | No: se incrusta dentro de otra página o de un artefacto de chat |
| **Enrutamiento interno** | Sí: `vue-router` con historial en memoria | No: un solo componente, sin router |
| **Controla el viewport** | Sí | No: lo dimensiona el layout circundante |
| **Reutilizable entre páginas** | No: una URL, un sitio | Sí: cualquier página puede incrustar la etiqueta |
| **Recibe props tipadas** | No: lee `AppConfig` | Sí: atributos HTML declarados por esquema |
| **Emite eventos tipados** | No: se comunica vía la API del proxy | Sí: `CustomEvent`s declarados por esquema |
| **Aislamiento de CSS** | Límite del iframe | Shadow DOM (encapsulación completa) |

**Regla rápida:** si necesita `vue-router`, una URL dedicada o es dueño del viewport completo, es una app de micro frontend. Si es incrustable, reutilizable y autocontenido, es un web component.

En caso de duda, empiece con un web component. Es más fácil promoverlo después a app de micro frontend que al revés.

## Qué leer a continuación

¿Con prisa? [Quickstart](./quickstart.md) tiene ejemplos mínimos de extremo a extremo tanto para una app de micro frontend en Vue como para un web component en Vue, con enlaces al repositorio público [`app`](https://github.com/wippyai/app).

Construir una app de micro frontend:
1. [Micro Frontend App](./micro-frontend-app.md): andamiaje, bloque wippy de `package.json`, configuración de Vite, secuencia de arranque, sincronización del router
2. [Sistema de Build](./build-system.md): `@wippy-fe/vite-plugin`, `wippy-meta.json`, externals
3. [API del Proxy](./proxy-api.md): referencia de `@wippy-fe/proxy` para comunicarse con el host
4. [Temas](./theming.md) → [Temas: Apps de Micro Frontend](./micro-frontend-app-theming.md): catálogo de variables CSS y, después, cómo recibirlo mediante inyecciones del proxy

Construir un web component:
1. [Web Component](./web-component.md): andamiaje, `WippyVueElement`, props, eventos, CSS en shadow DOM
2. [Sistema de Build](./build-system.md): la misma cadena de herramientas de Vite, distinto plugin y formato de salida
3. [API del Proxy](./proxy-api.md): la misma API, importada directamente de `@wippy-fe/proxy`
4. [Temas](./theming.md) → [Temas: Web Components](./web-component-theming.md): catálogo de variables CSS y, después, cómo recibirlo a través del límite del shadow DOM

Para ambos:
- [Modo Host-less](./host-less-mode.md): desarrollar y probar sin ejecutar el Web Host completo
- [Índice de Reglas de Conformidad](./compliance-checklist.md): propietarios canónicos de las reglas y puertas deterministas
- [Depuración](./debugging.md): guía orientada a síntomas para los escenarios de fallo más comunes

## Requisitos previos

- Módulo de backend de Wippy con `wippy/views` declarado como dependencia (vea [Views](../../framework/views.md))
- `wippy/facade` para el punto de entrada del Web Host (vea [Punto de Entrada del Facade](../web-host/entry-point.md))
- Node.js 22 o posterior y Vite 7, según lo declarado por la fuente del Web Host
  seleccionada; vuelva a comprobar su paquete cuando cambie la release de destino
