---
title: "Topología de la plataforma"
description: "Cómo el código frontend de Wippy se convierte en una página o componente web con routing y recibe contexto y CSS en runtime."
---

# Topología de la plataforma

Esta página es una referencia de arquitectura y diagnóstico. La cadena de entrega y los diagramas describen límites del sistema; no proporcionan un proyecto ejecutable.

## Cadena de entrega

| Etapa | Propietario | Verificación |
|-------|-------------|--------------|
| Código fuente y compilación del paquete | Módulo frontend | La compilación del paquete emite el archivo de entrada previsto. |
| Ubicación del artefacto | Target de compilación del despliegue | El comando de compilación recibe `--outDir`; Vite no lo fija en el código. |
| Entrada del registro | Módulo backend | `view.page` o `view.component` apunta a la entrada emitida. |
| URL servida | Entradas de sistema de archivos y HTTP del registro | Una solicitud directa al recurso devuelve el JavaScript o HTML compilado. |
| Contenedor de runtime | Web Host | Una página usa el motor configurado: un iframe heredado `about:srcdoc` o un Web Fragment. Un componente usa un elemento personalizado, normalmente con shadow DOM. |
| Contexto | AppConfig y paquetes Wippy | El routing, acceso a API y datos del tema llegan mediante paquetes compatibles. |

La presencia del código fuente, una compilación correcta o una entrada válida en el registro no demuestran la siguiente etapa. Verifique cada límite.

## Páginas

Una `view.page` se ejecuta mediante uno de dos motores: un iframe heredado `about:srcdoc` o un Web Fragment. El ajuste global `hostConfig.renderEngine` selecciona la base; `wippy.renderEngine` de una página puede seguirla, excluirse con `iframe` o solicitar `fragment` cuando el despliegue lo admite. El código de aplicación es independiente del motor. En ninguno de ellos la ubicación del navegador es el contrato compatible para rutas hijas. Use AppConfig y `@wippy-fe/router`; el paquete gestiona la integración con las rutas de Wippy.

La inyección CSS `iframe` proporciona actualmente estilos temáticos predeterminados para las barras de desplazamiento. Su nombre es histórico y más amplio que su función actual. Manténgala activada para que las barras sean coherentes; no la describa como un reset de layout.

## Componentes web

Un `view.component` se ejecuta en el documento host y normalmente posee un shadow root. Los selectores CSS no atraviesan el límite del shadow. Web Host puede entregar hojas de estilos aprobadas y CSS de la fachada a esa raíz según la configuración del componente.

La herencia de variables CSS y la inyección de hojas de estilos son mecanismos diferentes:

- Las variables públicas heredadas pueden atravesar el límite entre host y shadow.
- Las reglas de selectores solo afectan a un shadow root cuando se entregan dentro de él.
- La entrega no convierte un selector arbitrario en una API portable.

## Tema y overlays

La fachada proporciona el tema PrimeVue. Las reglas `.p-*` compartidas en `custom_css` son una implementación válida del tema y pueden ser globales cuando están destinadas al host y a los hijos. Use `.wippy-host-app` solo para el chrome específico del host.

El modo de tema es estado de AppConfig, no una API de clases CSS. Las aplicaciones, componentes, fixtures y pruebas de navegador cambian el modo con `host.setThemeMode('auto' | 'light' | 'dark')` de `@wippy-fe/proxy`, esperan `@theme` y verifican `host.getThemeMode()`. AppConfig transporta el cambio del host al hijo. El host actualiza su documento, vuelve a enviar AppConfig a los realms activos de páginas iframe y Web Fragment, y replica el modo en las raíces de componentes web. Nunca fuerce directamente las clases `w-theme-dark` o `w-theme-light`.

Los overlays de PrimeVue pueden teletransportarse. Verifique la raíz real del overlay en el documento superior, documentos iframe y shadow roots descubiertos recursivamente. No suponga una ubicación genérica de PrimeVue.

## Orden de depuración en runtime

1. Confirme que el backend está escuchando.
2. Examine los logs del backend para detectar respuestas 5xx inesperadas.
3. Confirme el propietario del registro y la URL del recurso servido.
4. Confirme que la compilación del paquete exacto emitió ese recurso.
5. Cargue la raíz del host antes de navegar por la SPA cuando no se admitan enlaces profundos directos.
6. Examine los errores de consola y red después de navegar e interactuar.
7. Para escenarios de tema, llame al método público del proxy, observe `@theme` y verifique `host.getThemeMode()` antes de aceptar una captura.
