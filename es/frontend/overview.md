---
title: "Contrato frontend: empiece aquí"
description: "Punto de entrada para páginas Wippy portables, componentes web, compilación, routing e integración de temas."
---

# Contrato frontend: empiece aquí

Esta página es una guía de orientación y una referencia de navegación. Identifica los contratos que debe seguir un módulo frontend; no es un tutorial de compilación ni un ejemplo completo de aplicación.

Los módulos frontend de Wippy son portables por defecto. Un módulo debe seguir funcionando cuando se importe en otro proyecto Wippy cuya fachada proporcione un tema PrimeVue compatible diferente y no incluya CSS privado del proyecto.

## Elegir la ruta correcta

1. Use una `view.page` para una aplicación renderizada por el motor de páginas configurado: un iframe heredado `about:srcdoc` o un Web Fragment.
2. Use un `view.component` para un elemento personalizado renderizado en el documento host, normalmente con shadow root.
3. Si la interfaz muestra un botón, input, campo de formulario, menú, overlay u otro control similar a PrimeVue, use PrimeVue salvo que no pueda proporcionar la semántica y affordance necesarias.
4. Un componente solo de contenido, como una visualización Chart.js sin controles, puede omitir PrimeVue y Tailwind.
5. Si necesita un control personalizado, siga el [Contrato de interfaz portable](./portable-ui-contract.md) y [Composites personalizados](./micro-frontends/custom-composites.md).

PrimeVue es el vocabulario compartido de componentes. El preset Tailwind de Wippy es un vocabulario compatible en tiempo de compilación. Solo las utilidades documentadas como respaldadas por el runtime responden a cambios del tema de la fachada después de compilar.

## Mapa de propiedad

```text
module source
  -> build command
  -> emitted artifact
  -> registry owner
  -> served URL
  -> Web Host
  -> page surface (srcdoc iframe or Web Fragment) or component shadow root
  -> AppConfig / router / theme delivery
```

No deduzca una etapa a partir de otra. Antes de depurar un recurso ausente, identifique el paquete fuente, target de compilación, archivo emitido, entrada del registro, montaje del sistema de archivos y URL servida.

## Páginas del contrato

- [Topología de la plataforma](./platform-topology.md): límites del runtime, routing, entrega de CSS, overlays y propiedad.
- [Contrato de interfaz portable](./portable-ui-contract.md): reglas normativas de componentes y estilos.
- [Creación de temas](./micro-frontends/theming.md): qué pertenece al `custom_css` de la fachada, al CSS del tema PrimeVue o a un módulo.
- [Contrato Tailwind](./micro-frontends/tailwind-contract.md): utilidades respaldadas por el runtime frente a constantes compiladas.
- [Catálogo de tokens](./micro-frontends/token-catalogue.md): referencia generada de tokens y procedencia.
- [La capa de diseño](./design-layer.md): dónde situar algo cuando varios módulos propios lo necesitan y el tema no tiene un componente para ello.
- [Receta de página](./micro-frontends/micro-frontend-app.md) y [receta de componente web](./micro-frontends/web-component.md).
- [Contrato de compilación y dependencias](./micro-frontends/build-system.md).
- [Configuración y uso de mayúsculas](./micro-frontends/configuration-casing.md).
- [Índice de reglas de conformidad](./micro-frontends/compliance-checklist.md).

## Comprobaciones obligatorias

- Nunca invente una propiedad de PrimeVue, API de componente, variable CSS ni utilidad semántica de Tailwind. Verifíquela en el código fuente del paquete seleccionado y en el catálogo generado.
- Nunca construya por analogía el nombre de un token `--p-*`.
- Nunca exija una clase arbitraria de la fachada desde un módulo portable.
- Nunca deduzca el contexto de ruta del host a partir de la ubicación del navegador. Las páginas reciben el contexto del host mediante AppConfig y usan `@wippy-fe/router`.
- Vuelva a compilar el paquete propietario exacto en la salida servida antes de verificarlo en el navegador.
- Compruebe la consola del navegador después de navegar e interactuar de forma significativa.

Los módulos ligados a un proyecto quedan fuera del contrato portable. Solo se documentan en [Módulos ligados a proyectos no compatibles](./micro-frontends/unsupported-project-bound.md); la comprobación estándar devuelve `UNSUPPORTED` y el CI estándar falla.
