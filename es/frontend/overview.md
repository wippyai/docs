---
title: "Contrato de Frontend: Empiece Aquí"
description: "El punto de entrada para páginas portables de Wippy, web components, builds, enrutamiento e integración de temas."
---

# Contrato de Frontend: Empiece Aquí

Los módulos de frontend de Wippy son portables por defecto. Un módulo debe seguir funcionando cuando se importa en otro proyecto Wippy cuyo facade suministra un tema PrimeVue conforme distinto y ningún CSS privado del proyecto.

## Elija la ruta correcta

1. Use un `view.page` para una aplicación renderizada en un iframe `about:srcdoc`.
2. Use un `view.component` para un elemento personalizado renderizado en el documento del host, normalmente con un shadow root.
3. Si la UI renderiza un botón, input, campo de formulario, menú, overlay u otro control similar a PrimeVue, use PrimeVue salvo que no pueda proporcionar la semántica y la affordance requeridas.
4. Un componente de solo contenido, como una visualización de Chart.js sin controles, puede omitir PrimeVue y Tailwind.
5. Si es necesario un control personalizado, siga el [Contrato de UI Portable](./portable-ui-contract.md) y [Composites Personalizados](./micro-frontends/custom-composites.md).

PrimeVue es el vocabulario de componentes compartido. El preset de Tailwind de Wippy es un vocabulario soportado en tiempo de build. Solo las utilidades documentadas como respaldadas en runtime siguen respondiendo a los cambios de tema del facade después de la compilación.

## Mapa de propiedad

```text
module source
  -> build command
  -> emitted artifact
  -> registry owner
  -> served URL
  -> Web Host
  -> page srcdoc iframe or component shadow root
  -> AppConfig / router / theme delivery
```

No deduzca una etapa a partir de otra. Antes de depurar un asset faltante, identifique el paquete fuente, el target de build, el archivo emitido, la entrada de registry, el punto de montaje del sistema de archivos y la URL servida.

## Páginas del contrato

- [Topología de la Plataforma](./platform-topology.md): límites del runtime, enrutamiento, entrega de CSS, overlays y propiedad.
- [Contrato de UI Portable](./portable-ui-contract.md): reglas normativas de componentes y estilos.
- [Autoría de Temas](./micro-frontends/theming.md): qué pertenece al `custom_css` del facade, al CSS del tema de PrimeVue o a un módulo.
- [Contrato de Tailwind](./micro-frontends/tailwind-contract.md): utilidades respaldadas en runtime frente a constantes compiladas.
- [Catálogo de Tokens](./micro-frontends/token-catalogue.md): referencia de tokens generada y su procedencia.
- [La Capa de Diseño](./design-layer.md): dónde ubicar algo cuando varios de sus propios módulos lo necesitan y el tema no tiene un componente para ello.
- [Receta de Página](./micro-frontends/micro-frontend-app.md) y [Receta de Web Component](./micro-frontends/web-component.md).
- [Contrato de Build y Dependencias](./micro-frontends/build-system.md).
- [Configuración y Casing](./micro-frontends/configuration-casing.md).
- [Índice de Reglas de Conformidad](./micro-frontends/compliance-checklist.md).

## Comprobaciones no negociables

- Nunca invente una prop de PrimeVue, una API de componente, una variable CSS o una utilidad semántica de Tailwind. Verifíquela en el código fuente del paquete seleccionado y en el catálogo generado.
- Nunca construya un nombre de token `--p-*` por analogía.
- Nunca exija una clase arbitraria del facade desde un módulo portable.
- Nunca deduzca el contexto de ruta del host a partir de la location del navegador. Las páginas reciben el contexto del host a través de AppConfig y usan `@wippy-fe/router`.
- Reconstruya el paquete propietario exacto en la salida servida antes de verificar en el navegador.
- Verifique la consola del navegador después de navegar y tras una interacción relevante.

Los módulos ligados al proyecto quedan fuera del contrato portable. Solo están documentados en la página [Módulos Ligados al Proyecto No Soportados](./micro-frontends/unsupported-project-bound.md); la conformidad estándar devuelve `UNSUPPORTED` y el CI estándar falla.
