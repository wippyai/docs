---
title: "Persistencia del Tema"
description: "Por defecto el Web Host resuelve claro/oscuro a partir de thememode (el valor por defecto del facade) y lo mantiene en memoria, de modo que la elección explícita del usuario se pierde en la…"
---

# Persistencia del Tema

Por defecto, el Web Host resuelve claro/oscuro a partir de `theme_mode` (el valor por defecto del facade) y lo mantiene
en memoria, de modo que la elección explícita del usuario se pierde en la siguiente recarga. La persistencia del tema permite que esa
elección sobreviva a las recargas almacenándola en una **cookie** o en **localStorage**, y la carga lo antes
posible para que no haya un destello con el tema equivocado.

La persistencia reside enteramente en el facade. El Web Host permanece agnóstico respecto al almacenamiento: solo emite un
evento `themeChanged` que el facade (o cualquier embebedor) usa para persistir la elección.

> **Opt-in.** `theme_persist` tiene como valor por defecto **`none`**: la persistencia está **desactivada** salvo que un despliegue
> la establezca explícitamente en `cookie` o `localStorage`. Con el valor por defecto, el comportamiento es exactamente el de siempre
> (el tema siempre proviene de `theme_mode` y no se recuerda entre recargas). No se almacena nada,
> no se escribe ninguna cookie y el script generado no hace nada hasta que usted opte por activarlo.

## Configuración

Dos parámetros del facade lo controlan (vea [Facade de Frontend](../../framework/facade.md)):

| Parámetro | Por defecto | Valores | Descripción |
|-----------|---------|--------|-------------|
| `theme_persist` | `none` | `none` \| `cookie` \| `localStorage` | Dónde se almacena el modo elegido. `none` = comportamiento actual. |
| `theme_storage_key` | `@wippy-theme-mode` | string | Clave de cookie / localStorage. |

Ambos los devuelve el endpoint público de configuración como `themePersist` y `themeStorageKey`, de modo que las páginas
servidas fuera del Web Host también pueden leerlos.

```yaml
# en los parámetros de dependencia de su facade
- name: theme_persist
  value: cookie
- name: theme_storage_key
  value: "@wippy-theme-mode"
```

### cookie frente a localStorage

- **`cookie`**: el shell del host renderizado con Jet lee la cookie **en el servidor** y escribe la
  clase `w-theme-*` en `<html>` antes de enviar la respuesta, de modo que el primer pintado ya está
  tematizado. **Sin destello.** El mejor valor por defecto.
- **`localStorage`**: el servidor no puede leer localStorage, así que el valor almacenado se aplica mediante un
  script inline síncrono lo antes posible. Un breve destello es técnicamente posible, pero queda minimizado.

## El script generado

Cuando la persistencia está habilitada, el facade **genera y sirve** un pequeño script en:

```
GET /api/public/facade/theme-persist.js
```

La clave y el modo configurados quedan integrados; no hay nada que configurar en la página. Inclúyalo
una sola vez, lo antes posible en `<head>`:

```html
<script src="/api/public/facade/theme-persist.js"></script>
```

Al cargarse lee el valor almacenado y aplica la clase `w-theme-*`, y a continuación expone una pequeña API:

```js
window.wippyThemePersist = {
  mode,            // 'none' | 'cookie' | 'localStorage'
  key,             // la clave de almacenamiento
  read(),          // -> 'auto' | 'light' | 'dark' | null
  write(mode),     // persiste un modo (no hace nada cuando mode === 'none')
  apply(mode),     // alterna la clase w-theme-* en <html>
}
```

El shell del host (`index.html` / el `index.jet` de Jet) ya incluye este script, siembra el valor
almacenado en la aplicación y persiste los cambios; no necesita tocarlo. Las secciones siguientes son para
**otras** páginas.

## Cómo encaja todo (shell del host)

1. **Primer pintado**: en modo cookie, el servidor estableció `<html class="w-theme-dark">`. En modo localStorage,
   lo estableció el script de aplicación temprana. En cualquier caso, la página está tematizada antes de que se cargue el bundle.
2. **Bootstrap**: el shell siembra el valor persistido en el host:
   `themeMode: window.wippyThemePersist.read() ?? cfg.themeMode`, de modo que el host aplica el mismo modo.
3. **Al cambiar**: el host emite `themeChanged(mode)`; el shell lo persiste:
   `events.on('themeChanged', window.wippyThemePersist.write)`.

### El evento de host `themeChanged`

`globalEvents` — el emisor devuelto por `window.initWippyApp(...)` — dispara `themeChanged(mode)`
(`'auto' | 'light' | 'dark'`) en la inicialización y en cada cambio de tema. Es agnóstico respecto a la persistencia: el host
nunca toca el almacenamiento; los embebedores deciden qué hacer con ello.

```js
const events = window.initWippyApp(config, '#app')
events.on('themeChanged', (mode) => {
  // p. ej. persistir, o notificar a una ventana padre
})
```

## Páginas no alojadas por Wippy

Un documento fuera del contrato de módulos portables de Wippy puede respetar y persistir
el mismo tema. Los botones nativos de abajo solo son apropiados para un
documento estático externo de ese tipo. Una página o componente de Wippy con estos controles debe
usar PrimeVue conforme al [Contrato de UI Portable](../portable-ui-contract.md).
Incluya el script generado y llame a `write()` desde su propio conmutador:

```html
<head>
  <!-- lo antes posible: aplica el tema almacenado y expone window.wippyThemePersist -->
  <script src="/api/public/facade/theme-persist.js"></script>
  <!-- opcional: reutilizar también el tema de marca del facade -->
  <link rel="stylesheet" href="/api/public/facade/variables.css">
</head>
<body>
  <button type="button" data-mode="auto">Auto</button>
  <button type="button" data-mode="light">Claro</button>
  <button type="button" data-mode="dark">Oscuro</button>

  <script>
    document.querySelectorAll('[data-mode]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const mode = btn.dataset.mode
        window.wippyThemePersist.apply(mode)   // actualiza <html> ahora
        window.wippyThemePersist.write(mode)   // persiste para la siguiente carga / el host
      })
    })
  </script>
</body>
```

Como la clave y el modo de almacenamiento son compartidos (el script se genera a partir de la misma configuración del facade),
una elección hecha en la página de inicio de sesión pasa directamente al Web Host, y viceversa.

> Si prefiere no cargar el script, puede solicitar `/api/public/facade/config`, leer
> `themePersist` / `themeStorageKey` e implementar la lectura/escritura usted mismo; pero el script generado
> mantiene la lógica de almacenamiento en un solo lugar.

## Renderizado de cookie en el servidor (cero destello)

Para una página renderizada en servidor a medida (p. ej. una plantilla de inicio de sesión de Jet) puede aplicar el tema en el servidor,
exactamente como hace el shell del host: lea de la petición la cookie nombrada por `theme_storage_key` y
emita la clase correspondiente en `<html>`:

```html
<html lang="en"{{ if hasTheme }} class="{{ themeClass }}" style="color-scheme: {{ colorScheme }};"{{ end }}>
```

donde el handler estableció `themeClass` a `w-theme-dark` / `w-theme-light` (y `colorScheme` a
`dark` / `light`) según la cookie. Incluya igualmente `theme-persist.js` para que la página pueda escribir
los cambios de vuelta.
