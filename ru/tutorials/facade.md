# Frontend Facade

Раздавайте веб-UI Wippy из приложения, состоящего только из бэкенда, с помощью
`wippy/facade`. Фасад — это тонкая статическая оболочка: она загружает фронтенд-бандл
Wippy Web Host из CDN и конфигурирует его из JSON-эндпоинта, который раздаёт ваше
приложение — без шага сборки фронтенда в вашем проекте. Брендинг, темизация и
фича-флаги полностью управляются параметрами зависимости.

## Что вы построите

Бэкенд-приложение, которое раздаёт UI Wippy:

1. HTTP-сервер и публичный роутер.
2. Зависимость `wippy/facade`, подключённую к этому серверу и роутеру, с собственным брендингом.
3. Работающую оболочку по адресу `/` и её конфигурацию по `/api/public/facade/config`.

## Предварительные требования

- Проект Wippy (склонируйте [app-template](https://github.com/wippyai/app-template) или
  выполните `wippy init`).
- Установленный фасад:

  ```bash
  wippy add wippy/facade
  wippy install
  ```

## Как это работает

1. `index.html` раздаётся как статический файл с вашего HTTP-сервера.
2. При загрузке он запрашивает `GET /api/public/facade/config`.
3. Он проверяет `localStorage` на наличие токена авторизации, перенаправляя на `login_path`, если его нет.
4. Он импортирует бандл Web Host из CDN (`facade_url + '/module.js'`) и вызывает
   `initWippyApp(...)` с конфигурацией.

Ваше приложение поставляет только оболочку и конфигурацию; сам UI приходит из CDN.

## Зависимости

Фасаду нужны две вещи от вашего приложения: `http.service` для раздачи файлов и
`http.router`, на который монтируется его эндпоинт конфигурации. Всё остальное —
необязательный брендинг с разумными значениями по умолчанию.

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

Поставляемый `index.html` запрашивает `/api/public/facade/config`, поэтому префикс
публичного роутера должен быть `/api/public`, чтобы оболочка по умолчанию нашла свою
конфигурацию.

## Запуск

```bash
wippy run
```

Оболочка раздаётся из корня сервера, а эндпоинт конфигурации возвращает рантайм-конфигурацию:

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

Обратите внимание, как параметр `app_title` проявляется как `theming.host.i18n.app.title`.

## Конфигурация

Параметры передаются как `parameters` зависимости (значения — строки; JSON-значения —
JSON-кодированные строки). Распространённые из них:

| Параметр | Назначение |
|---|---|
| `server` / `router` | _(обязательные)_ HTTP-сервер и публичный роутер |
| `app_title` / `app_name` / `app_icon` | Брендинг (иконка — ссылка Iconify) |
| `show_admin` / `hide_nav_bar` | Фича-флаги (`"true"` / `"false"`) |
| `login_path` | Куда оболочка перенаправляет, когда токен авторизации отсутствует |
| `session_type` | `non-persistent` или `cookie` |
| `history_mode` | `hash` или `browser` |
| `css_variables` | JSON-строка с CSS-переменными, например `'{"--p-primary":"#6366f1"}'` |
| `fe_facade_url` | URL бандла CDN (зафиксирован для каждого релиза фасада; оставьте по умолчанию, если не переопределяете) |

Два значения выводятся в рантайме из переменной окружения `PUBLIC_API_URL`, а не из
параметров: базовый URL API и URL WebSocket (`http`→`ws`, `https`→`wss`). Если она не
задана, браузер откатывается на `window.location.origin`.

## Заметки

- Фасад не предоставляет аутентификацию. Он ожидает поток авторизации, который
  записывает токен в `localStorage`; без него он перенаправляет на `login_path`.
  Сочетайте его с `userspace/users` или вашей собственной авторизацией.
- Бандл UI загружается из CDN (`fe_facade_url`), поэтому работающему приложению нужен
  исходящий сетевой доступ для отрисовки.

## Следующие шаги

- [Hello World](tutorials/hello-world.md) — минимальная структура проекта
- [Authentication](tutorials/auth.md) — подключите поток входа, который ожидает оболочка
- [HTTP Endpoints](http/endpoint.md) — роутеры, статические файлы и обработчики
