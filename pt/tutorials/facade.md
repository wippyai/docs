---
title: "Frontend Facade"
description: "Sirva a UI web do Wippy a partir de uma aplicação somente-backend com wippy/facade. O facade é um shell estático fino: ele carrega o bundle frontend do…"
---

# Frontend Facade

Sirva a UI web do Wippy a partir de uma aplicação somente-backend com `wippy/facade`. O
facade é um shell estático fino: ele carrega o bundle frontend do Wippy Web Host a partir
de uma CDN e o configura a partir de um endpoint JSON que sua aplicação serve — sem etapa
de build de frontend no seu projeto. Branding, temas e feature flags são todos
controlados por parâmetros de dependência.

## O que você construirá

Uma aplicação backend que serve a UI do Wippy:

1. Um servidor HTTP e um router público.
2. A dependência `wippy/facade`, conectada a esse servidor e router, com branding personalizado.
3. Um shell em execução em `/` e sua configuração em `/api/public/facade/config`.

## Pré-requisitos

- Um projeto Wippy (clone o [app-template](https://github.com/wippyai/app-template), ou
  `wippy init`).
- O facade instalado:

  ```bash
  wippy add wippy/facade
  wippy install
  ```

## Como funciona

1. `index.html` é servido como arquivo estático a partir do seu servidor HTTP.
2. Ao carregar, ele busca `GET /api/public/facade/config`.
3. Ele verifica o `localStorage` por um token de autenticação, redirecionando para
   `login_path` se ausente.
4. Ele importa o bundle do Web Host a partir da CDN (`facade_url + '/module.js'`) e chama
   `initWippyApp(...)` com a configuração.

Sua aplicação envia apenas o shell e a configuração; a própria UI vem da CDN.

## Dependências

O facade precisa de duas coisas da sua aplicação: um `http.service` a partir do qual servir
arquivos, e o `http.router` no qual seu endpoint de configuração é montado. Todo o resto é
branding opcional com padrões sensatos.

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

O `index.html` enviado busca `/api/public/facade/config`, então o prefixo do router
público deve ser `/api/public` para que o shell padrão encontre sua configuração.

## Execute

```bash
wippy run
```

O shell é servido na raiz do servidor, e o endpoint de configuração retorna a configuração
de runtime:

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

Note como o parâmetro `app_title` aparece como `theming.host.i18n.app.title`.

## Configuração

Os parâmetros são passados como `parameters` de dependência (os valores são strings;
valores JSON são strings codificadas em JSON). Os mais comuns:

| Parâmetro | Propósito |
|---|---|
| `server` / `router` | _(obrigatório)_ Servidor HTTP e router público |
| `app_title` / `app_name` / `app_icon` | Branding (o ícone é uma referência Iconify) |
| `show_admin` / `hide_nav_bar` | Feature flags (`"true"` / `"false"`) |
| `login_path` | Para onde o shell redireciona quando não há token de autenticação presente |
| `session_type` | `non-persistent` ou `cookie` |
| `history_mode` | `hash` ou `browser` |
| `css_variables` | String JSON de propriedades CSS customizadas, por exemplo `'{"--p-primary":"#6366f1"}'` |
| `fe_facade_url` | URL do bundle na CDN (fixada por release do facade; deixe o padrão a menos que sobrescreva) |

Dois valores são derivados em runtime a partir da variável de ambiente `PUBLIC_API_URL`
em vez de parâmetros: a URL base da API e a URL do WebSocket (`http`→`ws`, `https`→`wss`).
Se não definida, o navegador recorre a `window.location.origin`.

## Notas

- O facade não fornece autenticação. Ele espera um fluxo de autenticação que escreva um
  token no `localStorage`; sem um, ele redireciona para `login_path`. Combine-o com
  `userspace/users` ou sua própria autenticação.
- O bundle da UI carrega a partir da CDN (`fe_facade_url`), então a aplicação em execução
  precisa de acesso de rede de saída para renderizar.

## Próximos Passos

- [Hello World](tutorials/hello-world.md) — o layout mínimo de projeto
- [Authentication](tutorials/auth.md) — conecte o fluxo de login que o shell espera
- [HTTP Endpoints](http/endpoint.md) — routers, arquivos estáticos e handlers
