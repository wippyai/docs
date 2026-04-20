# Оверлейные сети

Маршрутизация исходящих HTTP-запросов и порождаемых процессов через оверлеи SOCKS5, Tailscale или I2P.

## Обзор

Wippy поддерживает оверлейные сети, прозрачно передающие трафик, исходящий от функций, процессов и HTTP-клиентов. Каждый оверлей — это запись в реестре; код подключается к нему при каждом вызове, и выбор наследуется во вложенных вызовах, пока потомок явно не переопределит его.

Поддерживаемые оверлеи:

- `network.socks5` — универсальный SOCKS5-прокси (в том числе SOCKS5-слушатель Tor)
- `network.tailscale` — оверлейный узел tsnet
- `network.i2p` — мост I2P SAM v3

## Структура проекта

```
netdemo/
├── wippy.lock
└── src/
    ├── _index.yaml
    └── probe.lua
```

## Шаг 1: Определение оверлея

Создайте `src/_index.yaml`:

```yaml
version: "1.0"
namespace: app

entries:
  - name: processes
    kind: process.host
    lifecycle:
      auto_start: true

  - name: terminal
    kind: terminal.host
    lifecycle:
      auto_start: true

  # SOCKS5 proxy entry (Tor exposes one at 127.0.0.1:9050 by default)
  - name: tor
    kind: network.socks5
    host: 127.0.0.1
    port: 9050
    isolate_streams: true

  - name: probe
    kind: process.lua
    meta:
      command:
        name: probe
        short: Check outbound IP through overlays
    source: file://probe.lua
    method: main
    modules:
      - io
      - http_client
      - json
```

`isolate_streams: true` заставляет SOCKS5-драйвер генерировать случайные учётные данные для каждого соединения, чтобы Tor открывал новую цепочку при каждом подключении.

## Шаг 2: Маршрутизация исходящих вызовов

Создайте `src/probe.lua`:

```lua
local io = require("io")
local http_client = require("http_client")
local json = require("json")

local function fetch_ip(overlay)
    local options = { timeout = "15s" }
    if overlay then
        options.overlay_network = overlay
    end

    local resp, err = http_client.get("https://api.ipify.org?format=json", options)
    if err then
        return nil, tostring(err)
    end
    if resp.status_code ~= 200 then
        return nil, "HTTP " .. resp.status_code
    end

    local body = json.decode(resp.body or "")
    return body and body.ip, nil
end

local function main()
    local direct, d_err = fetch_ip(nil)
    if d_err then
        io.print("direct failed: " .. d_err)
    else
        io.print("direct IP: " .. direct)
    end

    local routed, r_err = fetch_ip("app:tor")
    if r_err then
        io.print("tor failed: " .. r_err)
    else
        io.print("tor IP:    " .. routed)
    end

    return 0
end

return { main = main }
```

Опция `overlay_network` в `http_client` выбирает оверлей только для данного вызова. Без неё соединение идёт через дефолтный оверлей процесса (либо `network_service.default_network` в `.wippy.yaml`, либо напрямую).

## Шаг 3: Запуск

```bash
wippy init
wippy run probe
```

При запущенном локально Tor:

```
direct IP: 203.0.113.42
tor IP:    185.220.101.61
```

Если Tor не запущен, строка `tor IP` выведет ошибку подключения — SOCKS5-оверлей не падает обратно на прямое соединение молча.

## Наследование

Выбор оверлея распространяется на вложенные вызовы. Укажите оверлей один раз на границе `funcs.call` или `process.spawn`, и все внутренние HTTP-вызовы, вложенные `funcs.call` и `process.spawn` будут использовать его до явного переопределения:

```lua
local funcs = require("funcs")

local result, err = funcs.new()
    :with_options({ network = "app:tor" })
    :call("app:scrape_site", url)
```

```lua
local pid, err = process.with_options({ network = "app:tor" })
    :spawn_monitored("app.workers:probe", "app:processes")
```

Вложенная функция или порождённый процесс видит оверлей на каждом исходящем вызове без явной передачи.

## Привязка слушателя

Оверлеи с поддержкой входящего трафика (Tailscale, I2P) могут также принимать HTTP-слушателей. Привяжите оверлей к `http.service` вместо клиента:

```yaml
  - name: tailnet
    kind: network.tailscale
    hostname: wippy-node
    auth_key_env: TS_AUTHKEY
    ephemeral: true

  - name: gateway
    kind: http.service
    addr: ":8080"
    network: app:tailnet
    lifecycle:
      auto_start: true
```

Сервер привязывается на интерфейсе tailnet; клиенты обращаются к нему через Tailscale-адрес. SOCKS5 работает только на исходящий трафик — назначение его `http.service` отклоняется.

## Глобальный дефолт

Задайте дефолтный оверлей в `.wippy.yaml`, чтобы все вызовы использовали его, если не переопределено:

```yaml
network_service:
  state_dir: .wippy/net
  default_network: app:tor
```

Явное указание `network = nil` сбрасывает дефолт для данного вызова.

## Разрешения

Действие `network.select` контролирует явный выбор оверлея. Запретите его для scope, чтобы код не мог выбирать оверлей:

```yaml
  - name: deny_network
    kind: security.policy
    policy:
      actions: "network.select"
      resources: "*"
      effect: deny
    groups:
      - untrusted
```

Унаследованные оверлеи обходят эту проверку — они были авторизованы на границе вызывающего кода. Под контролем находится только явный повторный выбор на границе Lua.

## Следующие шаги

- [Сетевая система](system/network.md) - Справочник по entry kind
- [HTTP Client](lua/http/client.md) - Опции оверлея для отдельного вызова
- [Модель безопасности](system/security.md) - Политики и scope
- [Аутентификация](tutorials/auth.md) - Безопасность на основе токенов
