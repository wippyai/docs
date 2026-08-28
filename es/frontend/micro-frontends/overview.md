---
title: "Micro frontends de Wippy"
description: "Elija entre una aplicación micro frontend y un componente web, y siga las guías correspondientes de compilación, routing, proxy y temas."
---

# Micro frontends de Wippy

**Clasificación: guía conceptual de decisión.** Esta página compara los dos
tipos de artefacto y dirige al lector a las referencias de compilación y API;
no es un tutorial de proyecto independiente.

El código frontend de Wippy se ejecuta dentro del límite de aislamiento de Web
Host. Puede crear dos tipos de artefacto: **aplicaciones micro frontend** y
**componentes web**. Ambos son proyectos Vite independientes, se comunican con
la plataforma mediante `@wippy-fe/proxy` y se declaran al backend en una
entrada de registro `_index.yaml`. Se diferencian en cómo se renderizan y dónde
se usan.

## Aplicación micro frontend o componente web

| | Aplicación micro frontend (`view.page`) | Componente web (`view.component`) |
|---|---|---|
| **Se renderiza como** | Superficie de página: iframe srcdoc o Web Fragment | Elemento personalizado en Shadow DOM, dentro de una página |
| **Tiene URL o entrada de navegación propia** | Sí: reclama un `mountRoute` del backend | No: se integra dentro de otra página o artefacto de chat |
| **Routing interno** | Sí: `vue-router` con historial en memoria | No: un solo componente, sin router |
| **Controla la superficie asignada** | Sí: la superficie puede ser un panel, no el viewport del navegador | No: su tamaño depende del layout circundante |
| **Reutilizable entre páginas** | No: una URL, un lugar | Sí: cualquier página puede integrar la etiqueta |
| **Recibe props tipadas** | No: lee `AppConfig` | Sí: atributos HTML declarados mediante esquema |
| **Emite eventos tipados** | No: se comunica mediante la API proxy | Sí: `CustomEvent` declarados mediante esquema |
| **Aislamiento CSS** | Depende del motor: límite de iframe; un Web Fragment comparte el documento del host | Límite de selectores de Shadow DOM |

**Regla rápida:** use una aplicación micro frontend cuando necesite
`vue-router`, una URL propia o el control de una superficie de página
enrutada. Use un componente web cuando deba ser integrable, reutilizable y
autocontenido.

## Qué leer a continuación

El [inicio rápido](./quickstart.md) ofrece ejemplos mínimos completos de una
aplicación micro frontend Vue y un componente web Vue, con enlaces al
repositorio público [`app`](https://github.com/wippyai/app).

Para crear una aplicación micro frontend:

1. [Aplicación micro frontend](./micro-frontend-app.md): estructura, bloque wippy de `package.json`, configuración de Vite, secuencia de arranque y sincronización del router
2. [Sistema de compilación](./build-system.md): `@wippy-fe/vite-plugin`, `wippy-meta.json` y dependencias externas
3. [API Proxy](./proxy-api.md): referencia de `@wippy-fe/proxy` para comunicarse con el host
4. [Temas](./theming.md) → [Temas de aplicaciones micro frontend](./micro-frontend-app-theming.md): catálogo de variables CSS y recepción mediante inyecciones proxy

Para crear un componente web:

1. [Componente web](./web-component.md): estructura, `WippyVueElement`, props, eventos y CSS de Shadow DOM
2. [Sistema de compilación](./build-system.md): la misma cadena de herramientas Vite, con otro plugin y formato de salida
3. [API Proxy](./proxy-api.md): la misma API, importada directamente desde `@wippy-fe/proxy`
4. [Temas](./theming.md) → [Temas de componentes web](./web-component-theming.md): catálogo de variables CSS y recepción a través del límite de Shadow DOM

Para ambos:

- [Modo sin host](./host-less-mode.md): desarrollo y pruebas sin ejecutar Web Host completo
- [Índice de reglas de conformidad](./compliance-checklist.md): propietarios canónicos de las reglas y comprobaciones deterministas
- [Depuración](./debugging.md): guía por síntomas para los problemas más comunes

## Requisitos previos

- Un módulo backend de Wippy que declare `wippy/views` como dependencia; consulte [Views](../../framework/views.md)
- `wippy/facade` como punto de entrada de Web Host; consulte [Punto de entrada de la fachada](../web-host/entry-point.md)
- Node.js 22.12 o posterior y Vite 7 para la versión de referencia de esta documentación. El paquete fuente de Host declara Node 22+ y usa Vite 7; Vite 7 requiere Node 20.19+ o 22.12+. `@wippy-fe/vite-plugin` 0.0.56 también admite Vite 5 y 6, pero quien elija esas versiones debe seguir los requisitos de Node de la versión de Vite correspondiente
