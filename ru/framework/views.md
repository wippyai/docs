# Views

Модуль `wippy/views` предоставляет систему виртуальных страниц и компонентов с рендерингом шаблонов, управлением ресурсами и маппингом переменных окружения. Страницы могут опираться на Jet-шаблоны или внешние компоненты (SPA, микро-фронтенды).

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
      - name: api_url_env
        value: PUBLIC_API_URL
```

| Параметр | Обязательный | По умолчанию | Описание |
|-----------|----------|---------|-------------|
| `api_router` | да | — | HTTP-роутер для API-эндпоинтов представлений |
| `api_url_env` | нет | `PUBLIC_API_URL` | Переменная окружения с публичным URL API |

## Шаблонные страницы

Шаблонные страницы рендерятся на сервере с помощью Jet-шаблонов:

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

Компонентные страницы указывают на внешние приложения (SPA, микро-фронтенды):

```yaml
entries:
  - name: dashboard
    kind: registry.entry
    meta:
      type: view.page
      name: dashboard
      title: Dashboard
      icon: chart-bar
      url: https://cdn.example.com/dashboard/
      secure: true
      announced: true
    data:
      proxy:
        enabled: true
        css:
          prime_vue: true
          theme_config: true
        tailwind_config: true
```

API возвращает дескриптор компонента с базовым URL и конфигурацией прокси. Фронтенд рендерит компонент в iframe или inline.

### Поля компонента

| Поле | Тип | По умолчанию | Описание |
|-------|------|---------|-------------|
| `meta.url` | string | — | Публичный URL компонента |
| `meta.entry_point` | string | `index.html` (страницы), `index.js` (компоненты) | Файл точки входа |

### Конфигурация прокси

Прокси контролирует, какие CSS и поведение внедряются в компонент:

| Опция | По умолчанию | Описание |
|--------|---------|-------------|
| `proxy.enabled` | `true` | Включить обёртку прокси |
| `proxy.css.fonts` | `true` | Внедрять стили шрифтов |
| `proxy.css.theme_config` | `true` | Внедрять переменные темы |
| `proxy.css.iframe` | `true` | Стили, специфичные для iframe |
| `proxy.css.prime_vue` | `false` | Стили компонентов PrimeVue |
| `proxy.css.markdown` | `false` | Стили рендеринга Markdown |
| `proxy.css.custom_css` | `false` | Пользовательский CSS |
| `proxy.css.custom_variables` | `false` | Пользовательские CSS-переменные |
| `proxy.tailwind_config` | `false` | Внедрять конфигурацию Tailwind |
| `proxy.resize_observer` | `true` | Авторесайз iframe |
| `proxy.prevent_link_clicks` | `true` | Перехватывать навигацию по ссылкам |
| `proxy.iconify_icons` | `false` | Загружать набор иконок Iconify |

## View-компоненты

Самостоятельные компоненты, не являющиеся страницами (без записи в навигации):

```yaml
entries:
  - name: widget
    kind: registry.entry
    meta:
      type: view.component
      name: chat-widget
      title: Chat Widget
      url: https://cdn.example.com/chat-widget/
    data:
      proxy:
        enabled: true
```

Компоненты используют `meta.type: view.component` вместо `view.page`. По умолчанию точкой входа является `index.js`.

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
| `meta.resource_type` | string | `"style"`, `"script"`, `"font"` |
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
| GET | `/components/list` | Список view-компонентов |
| GET | `/pages/content/{id}` | Отрендерить страницу или вернуть дескриптор компонента |
| GET | `/pages/public/{id}` | Получить базовый URL компонента |

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
                "css": { "fonts": true, "themeConfig": true, "iframe": true },
                "tailwindConfig": false,
                "resizeObserver": true,
                "preventLinkClicks": true
            }
        }
    }
}
```

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

- [Facade](facade.md) — Iframe-фасад фронтенда и боковая панель навигации
- [Template](../system/template.md) — Движок Jet-шаблонов
- [Security](../system/security.md) — Акторы безопасности и контроль доступа
- [Environment](../system/env.md) — Хранение переменных окружения
- [Обзор фреймворка](overview.md) — Использование модулей фреймворка
