---
title: "Persistencia del tema"
description: "Configure la fachada para conservar el modo claro, oscuro o automático en una cookie o localStorage."
---

# Persistencia del tema

Esta página es una guía de configuración de la fachada. El bloque HTML de página externa es un ejemplo parcial de integración y presupone que los endpoints de fachada ya existen.

Por defecto, Web Host resuelve el modo claro u oscuro desde `theme_mode` (valor predeterminado de la fachada) y conserva la elección en memoria. Por ello, una elección explícita se pierde al recargar. La persistencia guarda la elección en una **cookie** o en **localStorage** y la carga pronto para evitar un destello del tema incorrecto.

La persistencia reside por completo en la fachada. Web Host no depende del almacenamiento: solo emite un evento `themeChanged` que la fachada u otro integrador usa para conservar la elección.

> **Activación explícita.** El valor predeterminado de `theme_persist` es **`none`**: la persistencia está **desactivada** salvo que un despliegue indique `cookie` o `localStorage`. Con el valor predeterminado, el tema procede de `theme_mode` y no se recuerda entre recargas. No se almacena nada, no se escribe ninguna cookie y el script generado no hace nada.

## Configuración

Dos parámetros de la fachada lo controlan; consulte [Frontend Facade](../../framework/facade.md):

| Parámetro | Predeterminado | Valores | Descripción |
|-----------|----------------|---------|-------------|
| `theme_persist` | `none` | `none` \| `cookie` \| `localStorage` | Dónde se almacena el modo elegido. `none` conserva el comportamiento actual. |
| `theme_storage_key` | `@wippy-theme-mode` | string | Clave de cookie o localStorage. |

Ambos se devuelven en el endpoint público de configuración como `themePersist` y `themeStorageKey`, por lo que también pueden leerlos las páginas servidas fuera de Web Host.

```yaml
# in your facade dependency parameters
- name: theme_persist
  value: cookie
- name: theme_storage_key
  value: "@wippy-theme-mode"
```

### Cookie frente a localStorage

- **`cookie`** — el shell del host renderizado con Jet lee la cookie **en el servidor** y escribe la clase `w-theme-*` en `<html>` antes de enviar la respuesta, de modo que el primer frame ya usa el tema. Evita el destello y es la opción preferida cuando importa la coherencia del primer renderizado.
- **`localStorage`** — el servidor no puede leer localStorage, por lo que el shell distribuido carga `theme-persist.js` de forma síncrona como primer script de `<head>`. Aplica la clase almacenada antes de renderizar la hoja de estilos de marca, la interfaz de carga o el bundle de Web Host.

## Script generado

Cuando la persistencia está activada, la fachada **genera y sirve** un script pequeño en:

```
GET /api/public/facade/theme-persist.js
```

La clave y el modo configurados están incorporados; no hay nada que configurar en la página. Inclúyalo una vez, lo antes posible en `<head>`:

```html
<script src="/api/public/facade/theme-persist.js"></script>
```

Al cargar, lee el valor almacenado y aplica la clase `w-theme-*`; después expone una API pequeña:

```js
window.wippyThemePersist = {
  mode,            // 'none' | 'cookie' | 'localStorage'
  key,             // the storage key
  read(),          // -> 'auto' | 'light' | 'dark' | null
  write(mode),     // persist a mode (no-op when mode === 'none')
  apply(mode),     // toggle the w-theme-* class on <html>
}
```

El shell del host (`index.html` / `index.jet` de Jet) ya incluye este script, introduce el valor almacenado en la aplicación y conserva los cambios. Las siguientes secciones se aplican a **otras** páginas.

## Cómo encaja todo en el shell del host

1. **Primer renderizado** — modo cookie: el servidor estableció `<html class="w-theme-dark">`. Modo localStorage: el script temprano aplicó la clase. En ambos casos, la página tiene tema antes de cargar el bundle.
2. **Bootstrap** — el shell introduce el valor persistido en el host: `themeMode: window.wippyThemePersist.read() ?? cfg.themeMode`, por lo que el host aplica el mismo modo.
3. **Al cambiar** — el host emite `themeChanged(mode)` y el shell lo conserva: `events.on('themeChanged', window.wippyThemePersist.write)`.

### Evento `themeChanged` del host

`globalEvents`, el emitter devuelto por `window.initWippyApp(...)`, emite `themeChanged(mode)` (`'auto' | 'light' | 'dark'`) al inicializar y en cada cambio. No depende de la persistencia: el host nunca toca el almacenamiento; el integrador decide qué hacer.

```js
const events = window.initWippyApp(config, '#app')
events.on('themeChanged', (mode) => {
  // e.g. persist, or notify a parent window
})
```

## Páginas no alojadas por Wippy

Un documento fuera del contrato de módulos portables de Wippy puede respetar y conservar el mismo tema. Los botones nativos siguientes solo son apropiados para un documento estático externo. Una página o componente Wippy con estos controles debe usar PrimeVue según el [Contrato de interfaz portable](../portable-ui-contract.md). Incluya el script generado y llame a `write()` desde su propio selector:

```html
<head>
  <!-- as early as possible: applies the stored theme + exposes window.wippyThemePersist -->
  <script src="/api/public/facade/theme-persist.js"></script>
  <!-- optional: reuse the facade brand theme too -->
  <link rel="stylesheet" href="/api/public/facade/variables.css">
</head>
<body>
  <button type="button" data-mode="auto">Auto</button>
  <button type="button" data-mode="light">Light</button>
  <button type="button" data-mode="dark">Dark</button>

  <script>
    document.querySelectorAll('[data-mode]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const mode = btn.dataset.mode
        window.wippyThemePersist.apply(mode)   // update <html> now
        window.wippyThemePersist.write(mode)   // persist for next load / the host
      })
    })
  </script>
</body>
```

Como la clave y el modo de almacenamiento son compartidos, una elección realizada en la página de inicio de sesión llega a Web Host y viceversa. El script recibe ambos valores de la misma configuración de fachada.

> También puede solicitar `/api/public/facade/config`, leer `themePersist` y `themeStorageKey`, e implementar el almacenamiento directamente. El script generado mantiene esa lógica en un único lugar.

## Renderizado de cookies en el servidor sin destellos

En una página personalizada renderizada por servidor, como una plantilla de inicio de sesión Jet, puede aplicar el tema en el servidor igual que el shell del host: lea de la solicitud la cookie cuyo nombre indica `theme_storage_key` y emita la clase correspondiente en `<html>`:

```html
<html lang="en"{{ if hasTheme }} class="{{ themeClass }}" style="color-scheme: {{ colorScheme }};"{{ end }}>
```

El handler debe establecer `themeClass` en `w-theme-dark` / `w-theme-light` y `colorScheme` en `dark` / `light` según la cookie. Incluya de todos modos `theme-persist.js` para que la página pueda escribir cambios.
