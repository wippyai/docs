---
title: "Keeper через MCP"
description: "Wippy Keeper — это control plane для работающего приложения Wippy: рабочее место реестра, управление синхронизацией файловая система↔реестр, оркестрация агентов и задач, Hub…"
---

# Keeper через MCP

Wippy Keeper — это control plane для работающего приложения Wippy: рабочее место реестра,
управление синхронизацией файловая система↔реестр, оркестрация агентов и задач, установка из Hub,
база знаний, просмотр логов и процессов, а также поток ревью/пуша Git — всё это за встроенным UI.
Его определяющая особенность в том, что он предоставляет эти операторские возможности AI-клиентам
(Claude, Codex, …) по **MCP (Model Context Protocol)**. На этой странице мы добавим Keeper в
приложение и подключим к нему MCP-клиент.

## Что вы построите

1. Keeper, добавленный в приложение, созданное из `app-template`.
2. UI Keeper по адресу `/app/keeper` и MCP-эндпоинт по адресу `/keeper-mcp/`.
3. MCP-токен с ограниченной областью и MCP-клиент, настроенный на управление приложением через Keeper.

## Предварительные требования

- Приложение из [app-template](https://github.com/wippyai/app-template). Оно уже
  предоставляет всё, к чему привязывается Keeper: `app:gateway`, `app:api`, `app:db`,
  `app:processes`, `app.security:admin` и `app.env:store`.
- Установленный модуль Keeper:

  ```bash
  wippy add keeper/keeper
  wippy install
  ```

## Добавление Keeper

Объявите зависимость и привяжите её к ресурсам приложения. Обязателен только `admin_scope`
(значения по умолчанию у него нет); остальные по умолчанию равны именам, которые уже использует
`app-template`, и показаны здесь явно для наглядности:

```yaml
# src/app/deps/_index.yaml
- name: keeper
  kind: ns.dependency
  component: keeper/keeper
  parameters:
    - { name: app_db,         value: app:db }
    - { name: admin_scope,    value: app.security:admin }
    - { name: env_storage,    value: app.env:store }
    - { name: public_gateway, value: app:gateway }   # размещает /keeper-mcp/
    - { name: mcp_route,      value: /keeper-mcp/ }
    - { name: ui_server,      value: app:gateway }
    - { name: process_host,   value: app:processes }
```

Запустите приложение:

```bash
wippy run
```

Keeper автоматически монтирует три поверхности:

- **UI** — `/app/keeper`
- **Транспорт MCP** — `/keeper-mcp/` на публичном шлюзе
- **API токенов** — на `app:api` (`/keeper/mcp/tokens`, `/keeper/mcp/scopes`)

Транспорт MCP управляется переменной окружения `MCP_ENABLED` (по умолчанию `true`);
установите её в `false`, чтобы закрыть эндпоинт.

## Выпуск MCP-токена

Токены выпускаются администратором, имеют ограниченную область и показываются ровно один раз.
Создайте токен через API токенов (или на странице MCP в UI Keeper):

```bash
curl -X POST http://localhost:8085/api/v1/keeper/mcp/tokens \
  -H 'Authorization: Bearer <admin-session-token>' \
  -H 'Content-Type: application/json' \
  -d '{"label": "claude-dev", "preset": "developer"}'
# -> { "success": true, "token": { "token": "wkmcp_<64 hex>", ... } }
```

`preset` объединяет набор областей. Доступные пресеты: `root`, `developer`,
`wippy_operator`, `observer`, `knowledge_manager`, `explorer_tools_only`. Для более
тонкого контроля передайте вместо этого явный массив `scopes` (например, `registry.read`,
`state.write`, `git.pr`, `tasks.run`, `knowledge.read`). Сырой токен `wkmcp_...`
возвращается один раз и хранится только в виде хеша — скопируйте его сразу.

## Подключение клиента

Направьте MCP-клиент на эндпоинт, передав токен в заголовке bearer. Для Claude Code /
Codex это `.mcp.json` в корне проекта:

```json
{
  "mcpServers": {
    "keeper": {
      "type": "http",
      "url": "http://localhost:8085/keeper-mcp/",
      "headers": { "Authorization": "Bearer wkmcp_<token>" }
    }
  }
}
```

В развёрнутом окружении вместо `http://localhost:8085` используйте публичный базовый URL
приложения.

## Как устроена поверхность MCP

Keeper не предоставляет плоский фиксированный список инструментов. Он показывает несколько
**мета-инструментов** плюс **трейты**, которые активируют конкретные инструменты по требованию,
так что поверхность остаётся небольшой, пока вы не включите нужную возможность:

- `session_info` — доступен всегда; сообщает области сессии и активные трейты.
- `list_traits` / `describe_trait` — узнать, что доступно.
- `use_trait` / `drop_trait` (и `set_traits`) — активировать или убрать трейт; при этом
  отправляется MCP-уведомление `notifications/tools/list_changed`, так что видимые инструменты
  меняются на лету.
- `list_tools` / `call_tool` — перечислить и вызвать инструменты, материализованные трейтом.

То, что токен может активировать, ограничено его **областями** — примерно `registry.*`,
`state.*`, `hub.*`, `knowledge.*`, `git.*`, `components.*`, `tasks.*`, `agents.*`,
`tests.run`, `logger.*`, `env.*`, `functions.call`, `app.ui` (плюс `mcp.root` для полного
административного обхода). Параметр токена `access_mode` (`any` / `traits` / `tools_only`)
дополнительно ограничивает то, как он может вызывать инструменты.

## Примечания

- **Область управления** — задайте `GOV_MANAGED_NAMESPACES=app`, чтобы синхронизация
  файловая система↔реестр в Keeper управляла только пространством имён вашего приложения.
  Не добавляйте `keeper`, `wippy` или `userspace`, если вы не разрабатываете эти модули.
- **Безопасность** — токены привязаны к выпустившей их административной личности и набору
  областей, хранятся как SHA-256 и отзываются через `POST /keeper/mcp/tokens/revoke`. Маршрут
  `/keeper-mcp/` не использует middleware аутентификации; обработчик сам проверяет bearer-токен.
- **Эталонное приложение** — `app-keeper` — это разобранный пример, встраивающий Keeper в
  оболочку приложения; скопируйте его блок `src/app/deps/_index.yaml`, если хотите заведомо
  рабочую конфигурацию.

## Следующие шаги

- [Hello World](tutorials/hello-world.md) — минимальная структура проекта
- [Аутентификация](tutorials/auth.md) — административная личность, выпускающая токены
- [Агенты](framework/agents.md) — агенты и инструменты, предоставляемые трейтами Keeper
