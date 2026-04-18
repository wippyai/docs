# Сетевые оверлеи

Маршрутизация исходящего трафика и привязка слушателей через оверлейные сети (SOCKS5-прокси, Tor, Tailscale mesh, I2P). Выбор оверлея включается по запросу для каждого вызова и наследуется через границы функций, процессов и HTTP.

## Виды записей

| Kind | Описание |
|------|-------------|
| `network.socks5` | Обобщённый SOCKS5-прокси (также покрывает SOCKS5-слушатель Tor) |
| `network.tailscale` | Оверлейный узел Tailscale tsnet |
| `network.i2p` | Мост I2P SAM v3 |

## SOCKS5

```yaml
- name: proxy
  kind: network.socks5
  host: 127.0.0.1
  port: 1080
  username: "optional"
  password: "optional"
  isolate_streams: false
```

| Поле | Тип | Описание |
|-------|------|-------------|
| `host` | string | Хост прокси |
| `port` | int | Порт прокси (1-65535) |
| `username` | string | Опциональная SOCKS5-аутентификация |
| `password` | string | Опциональная SOCKS5-аутентификация |
| `isolate_streams` | bool | Случайные учётные данные для каждого соединения (изоляция потоков Tor) |

## Tailscale

```yaml
- name: tailnet
  kind: network.tailscale
  hostname: "wippy-node"
  auth_key_env: "TS_AUTHKEY"
  ephemeral: false
  control_url: ""
```

| Поле | Тип | Описание |
|-------|------|-------------|
| `hostname` | string | Имя узла tsnet (используется в каталоге состояния для каждого узла) |
| `auth_key` | string | Встроенный ключ аутентификации tailnet |
| `auth_key_env` | string | Имя переменной окружения с ключом аутентификации (разрешается через env-реестр) |
| `state_dir` | string | Переопределение каталога состояния tsnet |
| `control_url` | string | Альтернативный координационный сервер |
| `ephemeral` | bool | Регистрация как эфемерного узла tailnet |

Требуется либо `auth_key`, либо `auth_key_env`.

## I2P

```yaml
- name: i2p_bridge
  kind: network.i2p
  host: 127.0.0.1
  port: 7656
  session_name: "wippy"
```

| Поле | Тип | Описание |
|-------|------|-------------|
| `host` | string | Хост моста SAM v3 |
| `port` | int | Порт моста SAM v3 |
| `session_name` | string | Опциональный идентификатор сессии |

## Выбор оверлея

### На http.service

Привязка слушателя сервера через оверлей (Tailscale, I2P):

```yaml
- name: gateway
  kind: http.service
  addr: ":8080"
  network: app.net:tailnet
```

SOCKS5 не поддерживает входящее прослушивание — используйте его только для исходящих соединений.

### Из Lua

Маршрутизируйте вызванную функцию или порождённый процесс через оверлей с помощью `with_options`:

```lua
local funcs = require("funcs")

local result, err = funcs.new()
    :with_options({ network = "app.net:proxy" })
    :call("app.api:fetch_data")
```

```lua
local pid, err = process.with_options({ network = "app.net:tailnet" })
    :spawn_monitored("app.workers:probe", "app:processes")
```

Модуль `httpclient` принимает тот же ключ в опциях для каждого вызова.

## Наследование

Выбор оверлея передаётся через стек вызовов. Функция, вызванная через `funcs.new():with_options({network=...})`, видит оверлей в каждом внутреннем соединении, в каждом вложенном `funcs.call` и в каждом `process.spawn`, который она выполняет — до тех пор, пока потомок явно не выберет другой оверлей или не очистит его.

Неявное наследование обходит собственные правила запрета `network.select` потомка. Проверяется только явный выбор на границе Lua.

## Разрешения

| Действие | Ресурс | Описание |
|--------|----------|-------------|
| `network.select` | Registry ID сети | Явный выбор оверлея в `funcs.call`, `process.spawn`, `http_client` |

Запретите `network.select` на области, чтобы код внутри неё не мог явно выбирать оверлей. Унаследованные оверлеи не затрагиваются — они были авторизованы у вызывающего.

## См. также

- [Безопасность](system/security.md) - Политики и акторы
- [HTTP-сервис](http/server.md) - Привязка сервера
- [HTTP-клиент](lua/http/client.md) - Выбор оверлея для каждого вызова
