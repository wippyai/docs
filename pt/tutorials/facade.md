---
title: "Facade Frontend"
description: "Sirva e configure o Wippy Web Host a partir de uma aplicação backend com wippy/facade."
---

# Facade Frontend

Use `wippy/facade` para servir o Wippy Web Host a partir de uma aplicação backend. A facade carrega o bundle frontend de uma CDN e o configura por um endpoint JSON da aplicação, sem build frontend. Parâmetros da dependência controlam identidade, temas e feature flags.

**Classificação:** receita de integração parcial. Ela configura e verifica completamente o shell e o endpoint de configuração, mas não cria um sistema de autenticação nem as APIs consumidas pelo Web Host.

## O Que Você Criará

Uma aplicação backend que serve a UI Wippy:

1. Um servidor HTTP e router público.
2. Uma dependência `wippy/facade` conectada a ambos, com identidade personalizada.
3. O shell em `/` e sua configuração em `/api/public/facade/config`.

## Pré-requisitos

- Runtime Wippy `v0.3.32a` e projeto criado com `wippy init` ou o [template de aplicação Wippy](https://github.com/wippyai/app).
- Para renderizar no navegador, um login na mesma origem que obtenha um token real do backend e grave `{"token":"..."}` na chave localStorage `@wippy_token_info`. A facade não emite nem valida esse token.
- A facade instalada:

  ```bash
  wippy add wippy/facade@0.6.37
  wippy install
  ```

## Como Funciona

1. O shell é renderizado a partir do template do facade e servido em `/` pelo seu servidor
   HTTP; seus assets e o fallback de deep link vêm de um mount estático no mesmo servidor.
2. Ao carregar, ele busca `GET /api/public/facade/config`.
3. Lê `@wippy_token_info` de `localStorage` e redireciona para `login_path` somente quando o item está ausente ou não é JSON válido.
4. Importa o bundle da CDN (`facade_url + '/module.js'`) e chama `initWippyApp(...)` com a configuração.

A aplicação serve o shell e sua configuração; o bundle da UI vem da CDN.

## Dependências

A facade exige um `http.service` para o shell e um `http.router` para seu endpoint de configuração. Outros parâmetros personalizam identidade e comportamento.

```yaml
version: "1.0"
namespace: app

entries:
  - name: gateway
    kind: http.service
    addr: ":8087"
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
    version: "*"
    parameters:
      - name: server
        value: app:gateway
      - name: router
        value: app:api.public
      - name: app_title
        value: Verify App
```

O shell requisita sua configuração, script de tema e variáveis CSS sob
`/api/public/facade/`, então o prefixo do router público deve ser `/api/public`.

## Executar

```bash
wippy run
```

O shell fica na raiz do servidor, e o endpoint retorna a configuração de runtime:

```bash
curl http://localhost:8087/api/public/facade/config
```

Campos selecionados da resposta:

```json
{
  "facade_url": "https://web-host.wippy.ai/webcomponents-1.0.58",
  "iframe_origin": "https://web-host.wippy.ai",
  "iframe_url": "https://web-host.wippy.ai/webcomponents-1.0.58/iframe.html?waitForCustomConfig",
  "module_file": "/module.js",
  "mode": "compat",
  "login_path": "/login.html",
  "themeMode": "auto",
  "themePersist": "none",
  "themeStorageKey": "@wippy-theme-mode",
  "env": { "APP_API_URL": "", "APP_AUTH_API_URL": "", "APP_WEBSOCKET_URL": "" },
  "themeMode": "auto",
  "themePersist": "none",
  "themeStorageKey": "@wippy-theme-mode",
  "theming": {
    "host": { "i18n": { "app": { "title": "Verify App", "icon": "wippy:logo", "appName": "Wippy AI" } } }
  },
  "hostConfig": {
    "showAdmin": true, "allowSelectModel": false, "hideNavBar": false,
    "disableRightPanel": false, "startNavOpen": false, "hideSessionSelector": false,
    "renderEngine": "iframe", "session": { "type": "non-persistent" }, "history": "hash"
  }
}
```

O parâmetro `app_title` aparece como `theming.host.i18n.app.title`.

Busque também o documento raiz:

```bash
curl http://localhost:8087/
```

Ele deve retornar um shell HTML que busca a configuração e verifica `@wippy_token_info`. Esses dois checks validam a receita sem contornar autenticação.

## Autenticação e Renderização no Navegador

O contrato de localStorage é limitado à origem. Uma página de login em outra porta ou hostname não consegue preencher o token para `http://localhost:8087`. Após uma troca de token bem-sucedida na mesma origem, o login grava o token real e retorna ao shell:

```js
localStorage.setItem('@wippy_token_info', JSON.stringify({token: result.token}));
window.location.assign('/');
```

O shell lê o token, importa `https://web-host.wippy.ai/webcomponents-1.0.56/module.js` e o passa ao Host. A renderização só está completa quando o navegador mostra o Host sem redirecionar e suas requisições autenticam com sucesso. Não use um token placeholder apenas para evitar o redirect: o shell não o valida, e a falha apenas passa para a primeira API protegida.

## Configuração

Parâmetros são enviados em `parameters`; valores JSON são strings JSON codificadas.

| Parâmetro | Finalidade |
|---|---|
| `server` / `router` | Servidor HTTP e router público obrigatórios |
| `app_title` / `app_name` / `app_icon` | Identidade; o ícone é uma referência Iconify |
| `show_admin` / `hide_nav_bar` | Feature flags (`"true"` / `"false"`) |
| `login_path` | Destino quando não há token |
| `session_type` | `non-persistent` ou `cookie` |
| `history_mode` | `hash` ou `browser` |
| `css_variables` | String JSON de propriedades CSS, como `'{"--p-primary":"#6366f1"}'` |
| `fe_facade_url` | URL do bundle CDN; deixe o padrão salvo ao sobrescrever deliberadamente |

Dois valores são derivados em runtime a partir de `PUBLIC_API_URL` em vez de parâmetros: a
URL base da API e a URL do WebSocket (`http`→`ws`, `https`→`wss`). O facade a lê através do
registry de ambiente, então declare-a como uma `env.variable` na sua aplicação. Se não
definida, o navegador recorre a `window.location.origin`.

## Limitações

- A facade não fornece autenticação. Ela espera um fluxo que grave um token em `localStorage`; sem ele, redireciona para `login_path`. Combine-a com `userspace/users` ou autenticação própria.
- O bundle vem de `fe_facade_url`, que deve estar acessível ao navegador do usuário.

## Solução de Problemas

- Um loop para `/login.html` significa que a origem não contém `@wippy_token_info` válido. Um objeto sem `token` evita o redirect, mas falha na API protegida.
- HTTP 404 em `/api/public/facade/config` indica prefixo diferente ou parâmetro `router` apontando para outra entrada.
- Configuração correta com shell vazio geralmente significa que o navegador não carregou `facade_url + module_file`.
- Erros de API autenticada após o Host renderizar pertencem à API e validação de token da aplicação, não ao shell.

## Próximos Passos

- [Hello World](tutorials/hello-world.md) — Estrutura mínima do projeto
- [Autenticação](tutorials/auth.md) — Adicione o login esperado pelo shell
- [Endpoints HTTP](http/endpoint.md) — Routers, arquivos estáticos e handlers
