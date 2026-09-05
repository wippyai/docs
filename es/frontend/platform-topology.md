---
title: "Topología de la Plataforma"
description: "Cómo el código fuente de frontend de Wippy se convierte en una página enrutada o en un web component y recibe contexto de runtime y CSS."
---

# Topología de la Plataforma

## Cadena de entrega

| Etapa | Propietario | Verificación |
|---|---|---|
| Fuente y build del paquete | Módulo de frontend | El build del paquete emite el archivo de entrada esperado. |
| Ubicación del artefacto | Target de build del despliegue | El comando de build recibe `--outDir`; Vite no lo fija en el código. |
| Entrada de registry | Módulo de backend | `view.page` o `view.component` apunta al archivo de entrada emitido. |
| URL servida | Entradas de registry de filesystem y HTTP | Una petición directa del asset devuelve el JavaScript o HTML compilado. |
| Contenedor de runtime | Web Host | Una página usa `about:srcdoc`; un componente usa un elemento personalizado, normalmente con shadow DOM. |
| Contexto | AppConfig y paquetes de Wippy | El enrutamiento, el acceso a la API y los datos de tema llegan a través de paquetes soportados. |

La existencia del código fuente, un build exitoso o una entrada de registry válida no prueban la etapa siguiente. Verifique cada límite.

## Páginas

Un `view.page` se ejecuta en un iframe `about:srcdoc`. La URL del iframe no es la ruta del host. No inspeccione `window.location`, `window.parent.location` ni parámetros de query para descubrir el estado del host. Use AppConfig y `@wippy-fe/router`; el paquete gestiona la integración con las rutas de Wippy.

La inyección de CSS `iframe` proporciona actualmente el estilo por defecto tematizado de las barras de desplazamiento. Su nombre es histórico y más amplio que su propósito actual. Manténgala habilitada para la consistencia de las barras de desplazamiento; no la describa como un reset de layout.

## Web components

Un `view.component` se ejecuta en el documento del host y normalmente es propietario de un shadow root. Los selectores CSS no se propagan en cascada a través de un límite de shadow. El Web Host puede entregar hojas de estilo aprobadas y CSS del facade dentro de ese root según la configuración del componente.

La herencia de variables CSS y la inyección de hojas de estilo son mecanismos distintos:

- Las variables públicas heredadas pueden cruzar el límite host-shadow.
- Las reglas de selector afectan a un shadow root solo cuando se entregan dentro de ese root.
- La entrega no convierte un selector arbitrario en una API portable.

## Tema y overlays

El facade suministra el tema de PrimeVue. Las reglas `.p-*` compartidas en el `custom_css` del facade son implementación de tema válida y pueden ser globales cuando están pensadas para el host y sus hijos. Use `.wippy-host-app` solo para el chrome específico del host.

El modo de tema es estado de AppConfig, no una API de clases CSS. Las aplicaciones, componentes,
fixtures y pruebas de navegador cambian el modo con
`host.setThemeMode('auto' | 'light' | 'dark')` de `@wippy-fe/proxy`, luego esperan
`@theme` y verifican `host.getThemeMode()`. AppConfig transporta el cambio
a través del transporte host-hijo. El host actualiza su documento,
retransmite AppConfig a los iframes `about:srcdoc` activos y refleja el modo en
los roots de los web components. Nunca fuerce directamente las clases `w-theme-dark`
o `w-theme-light`.

Nunca fuerce directamente las clases `w-theme-dark` o `w-theme-light`.

Los overlays de PrimeVue pueden ser teletransportados. Verifique el root real del overlay en el documento superior, en los documentos de los iframes y en los shadow roots descubiertos recursivamente. No asuma la ubicación genérica de PrimeVue.

## Orden de depuración en runtime

1. Confirme que el backend está escuchando.
2. Inspeccione los logs del backend en busca de respuestas 5xx inesperadas.
3. Confirme el propietario en el registry y la URL del asset servido.
4. Confirme que el build exacto del paquete emitió ese asset.
5. Cargue la raíz del host antes de navegar por la SPA cuando los deep links directos no estén soportados.
6. Inspeccione los errores de consola y de red tras la navegación y la interacción.
7. Para escenarios de tema, llame al método público de tema del proxy, observe `@theme`
   y verifique `host.getThemeMode()` antes de aceptar una captura de pantalla.
