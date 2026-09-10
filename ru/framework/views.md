---
title: "Views"
description: "Модуль wippy/views предоставляет систему виртуальных страниц и компонентов с рендерингом шаблонов, управлением ресурсами и маппингом переменных…"
---

# Views

Модуль `wippy/views` предоставляет систему виртуальных страниц и компонентов с рендерингом шаблонов, управлением ресурсами и маппингом переменных окружения. Страницы бывают двух видов:

- **Jet-шаблонные страницы** (`kind: template.jet`) — HTML, рендерится на сервере. Данные и ресурсы страницы собираются и внедряются на сервере, затем движок Jet рендерит итоговый HTML. Это унаследованная серверная модель. См. [Шаблонные страницы](#template-pages).
- **Фронтенды на записях реестра** (`kind: registry.entry`) — два вида: микро-фронтенд-приложения (`view.page`, полноценные SPA) и переиспользуемые веб-компоненты (`view.component`), отдаваемые с CDN или статического монтирования. Запись реестра содержит только маршрутизацию и политику развёртывания; внедрение прокси и CSS описывается в `package.json` фронтенд-пакета. См. [Компонентные страницы](#component-pages) и [View-компоненты](#view-components).

## Установка

Добавьте модуль в проект:

```bash
wippy add wippy/views
wippy install
```

Объявите зависимость:

```yaml
version: "1.0"
namespace: app

entries:
  - name: dep.views
    kind: ns.dependency
    component: wippy/views
    version: "*"
    parameters:
      - name: api_router
        value: app:api.public
      - name: env_storage
        value: app:env.storage
```

| Параметр | Обязательный | По умолчанию | Описание |
|-----------|----------|---------|-------------|
| `api_router` | да | — | HTTP-роутер для API-эндпоинтов представлений |
| `env_storage` | да | — | Хранилище переменных окружения, обеспечивающее переменную `PUBLIC_API_URL` |
| `server` | нет | `app:gateway` | HTTP-сервис, к которому привязывается самомонтируемый роутер [шлюза Web Fragments](#web-fragments-gateway) (`/@fragment`). Переопределяйте только если ID вашей `http.service` отличается от `app:gateway`. |

## Шаблонные страницы

> **Серверная модель рендеринга.** Шаблонные страницы — унаследованный механизм серверного рендеринга: `wippy/views` собирает данные и ресурсы страницы на сервере и рендерит итоговый HTML движком Jet. Здесь нет ни iframe-прокси, ни клиентского микро-фронтенда — ответ является обычным HTML. Для внешних SPA и компонентов см. [Компонентные страницы](#component-pages).

Шаблонные страницы рендерятся на сервере с помощью Jet-шаблонов. Данные внедряются через `data.set`, `data.data_func` и `data.resources` (серверное внедрение ресурсов):

```yaml
entries:
  - name: contact_page
    kind: template.jet
    meta:
      type: view.page
      name: contact
      title: Contact Us
      icon: mail
      order: 5
      group: main
      group_icon: layout-grid
      group_order: 1
      announced: true
      secure: false
    data:
      set: app.templates:default
      data_func: app:contact_data
      resources:
        - contact_styles
```

### Метаданные страницы

| Поле | Тип | По умолчанию | Описание |
|-------|------|---------|-------------|
| `meta.type` | string | — | Должно быть `view.page` |
| `meta.name` | string | имя записи | Идентификатор страницы |
| `meta.title` | string | — | Отображаемый заголовок |
| `meta.icon` | string | — | Идентификатор иконки |
| `meta.order` | number | `9999` | Порядок сортировки в группе |
| `meta.group` | string | — | Категория группы |
| `meta.group_icon` | string | — | Иконка группы |
| `meta.group_order` | number | `9999` | Порядок сортировки группы |
| `meta.group_placement` | string | `"default"` | Размещение: `"default"`, `"sidebar"` |
| `meta.secure` | boolean | `false` | Требует аутентификации |
| `meta.public` | boolean | `false` | Публично доступна |
| `meta.announced` | boolean | `= public` | Показывать в навигации |
| `meta.inline` | boolean | `false` | Скрыта из UI |
| `meta.content_type` | string | `text/html` | MIME-тип ответа |
| `meta.parent` | string | — | ID родительской страницы |

### Данные шаблона

| Поле | Описание |
|-------|-------------|
| `data.set` | ID набора шаблонов в реестре |
| `data.data_func` | ID функции, возвращающей данные страницы |
| `data.resources` | Массив ID ресурсов в реестре |

`data_func` получает `{ params, query }` и возвращает таблицу, которая становится контекстом `data` в шаблоне.

### Конвейер рендеринга

1. Загрузить страницу из реестра
2. Проверить доступ (security)
3. Вызвать `data_func`, если определена
4. Собрать ресурсы: глобальные + ресурсы набора шаблонов + ресурсы страницы
5. Загрузить переменные окружения
6. Отрендерить Jet-шаблон с контекстом: `{ data, resources, query_params, route_params, env }`

## Компонентные страницы

Компонентные страницы указывают на внешние одностраничные приложения (SPA, микро-фронтенды), которые Web Host загружает внутри iframe. Запись реестра содержит **только поля маршрутизации в реестре и политики развёртывания** — отдачу URL, контроль доступа, маршрут монтирования и постраничные переопределения конфигурации:

> **Обязательная форма записи реестра:** компонентные страницы — это `kind: registry.entry` с `meta.type: view.page`. `view.page` никогда не является значением `kind`. Переопределения развёртывания прокси располагаются в `meta.proxy`, а не в `data.proxy`.

```yaml
entries:
  - name: dashboard
    kind: registry.entry
    meta:
      type: view.page
      name: dashboard
      title: Dashboard
      icon: chart-bar
      url: /app
      base_path: app/dashboard
      entry_point: index.html
      mountRoute: /dashboard/:part(.*)*
      secure: true
      announced: true
      config_overrides:
        customization:
          cssVariables:
            "--p-primary": "#7c9ed9"
```

API возвращает дескриптор компонента с разрешённым базовым URL. Web Host рендерит SPA в iframe и применяет внедрения прокси, запрошенные фронтенд-пакетом.

### Поля компонента

| Поле | Тип | По умолчанию | Описание |
|-------|------|---------|-------------|
| `meta.url` | string | — | Префикс базового URL, по которому смонтирован бандл (origin CDN или путь `http.static`) |
| `meta.base_path` | string | — | Подкаталог внутри статического монтирования |
| `meta.entry_point` | string | `index.html` | HTML-файл точки входа; составляется как `<url>/<base_path>/<entry_point>` |
| `meta.mountRoute` | string | — | Занимает путь URL в роутере хоста; допустима только форма catch-all `/:part(.*)*` (корень) или `/<literal-prefix>/:part(.*)*` — произвольные шаблоны Vue Router отклоняются (HTTP 500). См. [view-page.md](../frontend/frontend-registry/view-page.md) / [dynamic-routing.md](../frontend/frontend-registry/dynamic-routing.md) |
| `meta.announced` | boolean | — | Показывать в навигации и `pages/list` |
| `meta.secure` | boolean | `false` | Требует аутентификации |
| `meta.config_overrides` | object | — | Постраничные переопределения AppConfig (camelCase), глубоко объединяемые поверх значений по умолчанию из бандла |

### Конфигурация прокси

Внедрение прокси для SPA-страниц настраивается в блоке `wippy.proxy.injections` (camelCase) в package.json фронтенда и запекается в `wippy-meta.json` во время сборки. Его также можно переопределить для конкретного развёртывания через блок `proxy:` в camelCase, вложенный в `meta:` записи реестра (та же форма и та же обёртка `injections`, что и в блоке `wippy.proxy` из package.json); хост глубоко объединяет его поверх `wippy.proxy` из бандла, и значение из YAML побеждает для каждого вложенного ключа. Формы в snake_case не существует, нормализации регистра нет. Учтите, что `config_overrides` глубоко объединяет только `customization`, `axiosDefaults`, `routePrefix` и `apiRoutes` — он никогда не влияет на `proxy.injections`. См. [Микро-фронтенд-приложения (view.page)](../frontend/frontend-registry/view-page.md) и [Внедрение CSS](../frontend/web-host/css-injection.md).

Минимальная корректная форма переопределения при развёртывании:

```yaml
entries:
  - name: dashboard
    kind: registry.entry
    meta:
      type: view.page
      proxy:
        enabled: true
        injections:
          css:
            themeConfig: true
            customCss: true
            customVariables: true
          tailwindConfig: false
```

## View-компоненты

View-компоненты — это переиспользуемые пользовательские элементы (веб-компоненты, микро-фронтенды), которые Web Host обнаруживает и регистрирует; они не являются страницами и не имеют записи в навигации. Как и у компонентных страниц, запись реестра несёт только маршрутизацию и политику развёртывания:

```yaml
entries:
  - name: reaction-bar
    kind: registry.entry
    meta:
      type: view.component
      name: reaction-bar
      tag_name: example-reaction-bar
      announced: true
      auto_register: true
      secure: false
      url: /app/wc/reaction-bar
      entry_point: index.js
```

Компоненты используют `meta.type: view.component` вместо `view.page`, идентифицируют себя через `meta.tag_name` и по умолчанию используют `index.js` как точку входа. Внедрение прокси и CSS темы для компонентов точно так же описываются в package.json фронтенда (camelCase), а CSS для shadow DOM объявляется через `hostCssKeys` — не в YAML реестра. См. [Веб-компоненты (view.component)](../frontend/frontend-registry/view-component.md) и [Внедрение CSS](../frontend/web-host/css-injection.md).

## Ресурсы

Ресурсы — это файлы CSS, JS и шрифтов, связанные со страницами:

```yaml
entries:
  - name: global_styles
    kind: registry.entry
    meta:
      type: view.resource
      name: Global Styles
      resource_type: style
      global: true
      order: 1
      url: https://cdn.example.com/global.css

  - name: app_script
    kind: registry.entry
    meta:
      type: view.resource
      name: App Script
      resource_type: script
      template_set: app.templates:default
      order: 10
      url: https://cdn.example.com/app.js
      defer: true
```

### Поля ресурса

| Поле | Тип | Описание |
|-------|------|-------------|
| `meta.type` | string | Должно быть `view.resource` |
| `meta.resource_type` | string | Произвольное (по умолчанию `"other"`); распространённые значения — `"style"`, `"script"`, `"font"` |
| `meta.order` | number | Порядок сортировки внутри типа |
| `meta.global` | boolean | Применяется ко всем страницам |
| `meta.template_set` | string | Специфичен для набора шаблонов |
| `meta.url` | string | URL ресурса |
| `meta.integrity` | string | SRI-хеш |
| `meta.crossorigin` | string | `"anonymous"` или `"use-credentials"` |
| `meta.media` | string | CSS media query |
| `meta.defer` | boolean | Отложенная загрузка скрипта |
| `meta.async` | boolean | Асинхронная загрузка скрипта |

### Сбор ресурсов

Ресурсы собираются в три слоя, объединяемых по порядку:

1. **Глобальные ресурсы** — `global: true`, применяются ко всем страницам
2. **Ресурсы набора шаблонов** — сопоставляются по ID `template_set`
3. **Ресурсы страницы** — перечислены в массиве `data.resources`

Внутри каждого слоя ресурсы группируются по `resource_type` и сортируются по `order`.

## Маппинг переменных окружения

Загрузчик env сопоставляет переменные окружения с ключами контекста шаблона через систему приоритетов.

### Определение маппингов

```yaml
entries:
  - name: app_env
    kind: registry.entry
    meta:
      type: view.env_mapping
      priority: 20
    data:
      mappings:
        api_endpoint: API_BASE_URL
        app_title: APP_NAME
        debug_mode: DEBUG_ENABLED
```

Каждая запись маппинга связывает ключи контекста (используются в шаблонах как `env.api_endpoint`) с именами переменных окружения.

### Система приоритетов

| Диапазон | Категория | Описание |
|-------|----------|-------------|
| 0–9 | Значения по умолчанию фреймворка | Встроенные маппинги фреймворка |
| 10–19 | Системные переопределения | Конфигурация системного уровня |
| 20–29 | Прикладные маппинги | Маппинги, специфичные для приложения |
| 30–100 | Переопределения окружения | Runtime-переопределения |

Более высокий приоритет побеждает, если несколько маппингов определяют один и тот же ключ контекста.

### Использование в шаблонах

Разрешённые значения окружения доступны в объекте контекста `env`:

```html
<script>
    window.API_URL = "{{ env.api_endpoint }}";
    document.title = "{{ env.app_title }}";
</script>
```

## HTTP API эндпоинты

Модуль views регистрирует следующие эндпоинты на настроенном роутере:

| Метод | Путь | Описание |
|--------|------|-------------|
| GET | `/pages/list` | Список доступных, объявленных страниц |
| GET | `/components/list` | Список доступных, объявленных view-компонентов |
| GET | `/pages/content/{id}` | Отрендерить страницу или вернуть дескриптор компонента |
| GET | `/pages/public/{id}` | Получить базовый URL компонента |
| GET | `/components/by-tag/{tag}` | Разрешить имя тега пользовательского элемента в дескриптор `view.component` (используется хостом в `loadByTagName`) |
| GET | `/pages/routes` | Вернуть карту `mountRoute` → `pageId`; HTTP 500 при некорректном или дублирующемся `mountRoute`. Не фильтруется по `announced` (скрытым страницам всё равно нужно разрешение URL); контроль доступа применяется к защищённым страницам |

### Ответ рендеринга

Для шаблонных страниц возвращается отрендеренный HTML с `content_type` страницы.

Для компонентных страниц возвращается дескриптор:

```json
{
    "name": "dashboard",
    "version": "1.0.0",
    "specification": "wippy-component-1.0",
    "title": "Dashboard",
    "baseUrl": "https://cdn.example.com/dashboard/",
    "wippy": {
        "type": "page",
        "path": "index.html",
        "proxy": {
            "enabled": true,
            "injections": {
                "css": { "themeConfig": true, "iframe": true },
                "tailwindConfig": false,
                "resizeObserver": true,
                "preventLinkClicks": true
            }
        }
    }
}
```

Флаги внедрения `css` — это `themeConfig`, `iframe`, `primevue`, `markdown`, `customCss` и `customVariables`. Флага `fonts` нет — Google Fonts доставляются через `theming.global.customCSS` (правило `@import`) и внедряются флагом `customCss`.

## Шлюз Web Fragments

Когда Web Host рендерит страницу с [движком рендеринга fragment](../frontend/web-host/render-engines.md), страница монтируется как `<web-fragment src="/@fragment/{id}/">`. `wippy/views` обслуживает этот контракт reframing через отдельный эндпоинт шлюза по адресу **`/@fragment/{id}/{path...}`**.

В отличие от view API (который монтируется на `api_router` потребителя), шлюз **предоставляется самим `wippy/views` (≥ 0.5.9)**: модуль внутренне объявляет собственный корневой `http.router` `/@fragment`, поэтому он кэшируем и маршрутизируем через CDN и свободен от `token_auth` — шлюз не зависит от аутентификации (внедряемый прокси фрагмента выполняет handshake с хостом на стороне клиента). **Потребителю не нужна никакая обвязка для фрагментов** — ни записи роутера, ни параметра `fragment_router`. Приложение загружается штатно на движке iframe независимо от того, включены фрагменты или нет.

Самомонтируемый роутер привязывается к требованию `server`, которое **по умолчанию равно `app:gateway`**. Единственное необязательное переопределение: если запись `http.service` вашего приложения имеет ID, отличный от `app:gateway`, задайте параметр `server` модуля `wippy/views` соответствующим образом:

```yaml
entries:
  - name: dep.views
    kind: ns.dependency
    component: wippy/views
    version: "*"
    parameters:
      - name: api_router
        value: app:api.public
      - name: env_storage
        value: app:env.storage
      - name: server                 # необязательно — только если ID вашей http.service ≠ app:gateway
        value: app:my_http_service
```

> **Нет обвязки фрагментов — нет риска при старте.** Поскольку `wippy/views` владеет роутером `/@fragment` и привязывает его к `server` (по умолчанию `app:gateway`), потребитель, обновивший модуль, загружается штатно на движке iframe при нулевой конфигурации фрагментов. Страница, которая включает фрагменты постранично (`wippy.renderEngine: "fragment"`) в остальном iframe-развёртывании, защищена runtime-**проверкой возможностей**, которая **молча оставляет её на движке iframe**, если шлюз или `proxy-fragment.js` недоступны. Глобальный переключатель `render_engine: fragment` доверяет оператору и проверку не выполняет.

### Контракт reframing

Шлюз отвечает на один и тот же URL `/@fragment/{id}/` тремя способами, различая их по заголовку запроса `Sec-Fetch-Dest` и подпути:

| Запрос | Ответ |
|---------|----------|
| Загрузка iframe realm (`Sec-Fetch-Dest: iframe`) | Крошечная **reframed-заглушка** с import map хоста, `loading.js` и `proxy-fragment.js`. |
| Запрос документа (пустой подпуть) | HTML приложения страницы, преобразованный для realm (`<base>`, ссылки на CSS хоста, переименование `<html>`/`<head>`/`<body>` → `<wf-*>`). |
| Ресурс (непустой подпуть) | Проксируется на реальный `base_url` страницы + подпуть. |

Ответы несут `Cache-Control`: заглушка кэшируема совместно (`public, max-age=300`); документ и ресурсы, закрытые контролем доступа, помечены `private` (они проходят проверку `can_access` для каждого пользователя, поэтому общий кэш утекал бы между пользователями). Ошибки времени выполнения — это явные HTTP-ответы: `400 Missing fragment id`, `404 Fragment page not found`, `401 Access denied`, `502 Fragment document fetch failed: … (url: …)`.

Фронтенд выбирает движок и монтирует фрагмент — см. [Движки рендеринга](../frontend/web-host/render-engines.md).

## Контроль доступа

Страницы с `secure: true` требуют аутентификации. Реестр страниц проверяет `security.can("view", "page:<page_id>")` относительно текущего актора и области.

Незащищённые страницы всегда доступны. Флаг `announced` контролирует видимость в списках навигации, не влияя на доступ.

## Квалификация ID

Относительные ID в определениях страниц квалифицируются пространством имён записи:

```yaml
# В пространстве имён "app"
data:
  data_func: my_data_func       # разрешается в app:my_data_func
  set: templates:default         # остаётся как templates:default (уже квалифицирован)
  resources:
    - page_styles                # разрешается в app:page_styles
```

## См. также

- [Facade](./facade.md) — Iframe-фасад фронтенда и боковая панель навигации
- [Template](../system/template.md) — Движок Jet-шаблонов
- [Security](../system/security.md) — Акторы безопасности и контроль доступа
- [Environment](../system/env.md) — Хранение переменных окружения
- [Обзор фреймворка](./overview.md) — Использование модулей фреймворка
- [Микро-фронтенд-приложения (view.page)](../frontend/frontend-registry/view-page.md) — Полный справочник по метаданным view.page и внедрению прокси
- [Веб-компоненты (view.component)](../frontend/frontend-registry/view-component.md) — Полный справочник по автозагрузке и props для view.component
- [Движки рендеринга](../frontend/web-host/render-engines.md) — Рендеринг страниц через iframe и Web Fragment (потребитель шлюза `/@fragment`)
