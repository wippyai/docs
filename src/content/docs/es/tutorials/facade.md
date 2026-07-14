---
title: "Frontend Facade"
---

# Frontend Facade

Sirve la UI web de Wippy desde una app solo de backend con `wippy/facade`. El facade es un
shell estático delgado: carga el bundle del frontend de Wippy Web Host desde una CDN y
lo configura desde un endpoint JSON que sirve tu app — sin paso de build de frontend en tu
proyecto. El branding, el theming y los feature flags se controlan mediante parámetros de dependencia.

## Lo que construirás

Una app de backend que sirve la UI de Wippy:

1. Un servidor HTTP y un router público.
2. La dependencia `wippy/facade`, conectada a ese servidor y router, con branding personalizado.
3. Un shell en ejecución en `/` y su configuración en `/api/public/facade/config`.

## Requisitos previos

- Un proyecto Wippy (clona [app-template](https://github.com/wippyai/app-template), o
  `wippy init`).
- El facade instalado:

  ```bash
  wippy add wippy/facade
  wippy install
  ```

## Cómo funciona

1. `index.html` se sirve como archivo estático desde tu servidor HTTP.
2. Al cargar, hace fetch de `GET /api/public/facade/config`.
3. Comprueba `localStorage` en busca de un token de autenticación, redirigiendo a `login_path` si falta.
4. Importa el bundle de Web Host desde la CDN (`facade_url + '/module.js'`) y llama a
   `initWippyApp(...)` con la configuración.

Tu app solo envía el shell y la configuración; la UI en sí proviene de la CDN.

## Dependencias

El facade necesita dos cosas de tu app: un `http.service` desde el cual servir archivos, y
el `http.router` en el que se monta su endpoint de configuración. Todo lo demás es branding opcional
con valores por defecto sensatos.

```yaml
version: "1.0"
namespace: app

entries:
  - name: gateway
    kind: http.service
    addr: :8087
    lifecycle:
      auto_start: true

  - name: api.public
    kind: http.router
    meta:
      server: app:gateway
    prefix: /api/public

  - name: facade
    kind: ns.dependency
    component: wippy/facade
    parameters:
      - name: server
        value: app:gateway
      - name: router
        value: app:api.public
      - name: app_title
        value: Verify App
```

El `index.html` incluido hace fetch de `/api/public/facade/config`, por lo que el prefijo del router
público debe ser `/api/public` para que el shell por defecto encuentre su configuración.

## Ejecutarlo

```bash
wippy run
```

El shell se sirve en la raíz del servidor, y el endpoint de configuración retorna la configuración
en tiempo de ejecución:

```bash
curl http://localhost:8087/api/public/facade/config
```

```json
{
  "mode": "compat",
  "facade_url": "https://web-host.wippy.ai/webcomponents-1.0.32",
  "iframe_origin": "https://web-host.wippy.ai",
  "iframe_url": "https://web-host.wippy.ai/webcomponents-1.0.32/iframe.html?waitForCustomConfig",
  "module_file": "/module.js",
  "login_path": "/login.html",
  "env": { "APP_API_URL": "", "APP_AUTH_API_URL": "", "APP_WEBSOCKET_URL": "" },
  "theming": {
    "host": { "i18n": { "app": { "title": "Verify App", "icon": "wippy:logo", "appName": "Wippy AI" } } }
  },
  "hostConfig": {
    "showAdmin": true, "allowSelectModel": false, "hideNavBar": false,
    "session": { "type": "non-persistent" }, "history": "hash"
  }
}
```

Observa cómo el parámetro `app_title` aparece como `theming.host.i18n.app.title`.

## Configuración

Los parámetros se pasan como `parameters` de la dependencia (los valores son cadenas; los valores JSON son
cadenas codificadas en JSON). Los más comunes:

| Parámetro | Propósito |
|---|---|
| `server` / `router` | _(requerido)_ Servidor HTTP y router público |
| `app_title` / `app_name` / `app_icon` | Branding (el icono es una referencia de Iconify) |
| `show_admin` / `hide_nav_bar` | Feature flags (`"true"` / `"false"`) |
| `login_path` | A dónde redirige el shell cuando no hay token de autenticación presente |
| `session_type` | `non-persistent` o `cookie` |
| `history_mode` | `hash` o `browser` |
| `css_variables` | Cadena JSON de propiedades CSS personalizadas, p. ej. `'{"--p-primary":"#6366f1"}'` |
| `fe_facade_url` | URL del bundle de la CDN (fijada por release del facade; deja el valor por defecto salvo que la sobrescribas) |

Dos valores se derivan en tiempo de ejecución de la variable de entorno `PUBLIC_API_URL` en lugar
de parámetros: la URL base de la API y la URL de WebSocket (`http`→`ws`, `https`→`wss`). Si
no está definida, el navegador recurre a `window.location.origin`.

## Notas

- El facade no provee autenticación. Espera un flujo de autenticación que escriba un
  token en `localStorage`; sin uno, redirige a `login_path`. Combínalo con
  `userspace/users` o tu propia autenticación.
- El bundle de la UI se carga desde la CDN (`fe_facade_url`), por lo que la app en ejecución necesita
  acceso de red saliente para renderizar.

## Siguientes Pasos

- [Hello World](tutorials/hello-world.md) — la disposición mínima de un proyecto
- [Authentication](tutorials/auth.md) — conecta el flujo de login que el shell espera
- [HTTP Endpoints](http/endpoint.md) — routers, archivos estáticos y handlers
