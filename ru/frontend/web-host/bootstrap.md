---
title: "Последовательность запуска"
description: "После получения конфигурации Web Host выполняет фиксированную последовательность инициализации до отрисовки какого-либо UI. Последовательность немного различается в зависимости…"
---

# Последовательность запуска

После того как Web Host получает свою конфигурацию, он выполняет фиксированную последовательность инициализации до отрисовки какого-либо UI. Последовательность немного различается в зависимости от того, загружается ли Web Host как JS-модуль, забирающий страницу себе (стандартный путь через фасад), или работает внутри iframe (ручной путь без фасада), но внутренние шаги после того, как конфигурация доступна, идентичны.

## Путь A — JS-модуль (стандартный, через фасад)

Это путь, который использует текущий `wippy/facade`. Фасад раздаёт страницу, загружающую точку входа Web Host в виде JS-модуля — `module.js` для режима **compat** или `managed-layout.js` для режима **managed**, — и модуль забирает себе всю страницу и её историю браузера.

1. **Страница загружает модуль.** Скрипт регистрирует `window.initWippyApp` в `window` страницы.

2. **Страница вызывает `initWippyApp(config, rootContainer?)`.** Страница уже получила `/facade/config` и передаёт полезную нагрузку напрямую аргументом функции. Рукопожатия через PostMessage нет.
   ```javascript
   const events = window.initWippyApp(config, '#app')
   events.on('ready', () => console.log('App ready'))
   ```

3. **Инициализация продолжается** — см. [Внутреннюю последовательность инициализации](#internal-init-sequence) ниже.

## Путь B — iframe (ручной, без фасада)

Этот путь используется, когда вы сами встраиваете полный хост внутрь iframe — для частичного встраивания в страницу с более сильной изоляцией. Он загружает `iframe.html?waitForCustomConfig` и получает конфигурацию через PostMessage `SetConfig`. Текущий фасад этого не создаёт; путь существует для ручных вставок.

1. **Iframe загружается.** Web Host загружается в браузере. Поскольку в URL присутствует `?waitForCustomConfig`, приложение монтирует минимальный каркас и приостанавливается — оно ещё не пытается читать токены аутентификации или вызывать какие-либо конечные точки API.

2. **Родитель отправляет `SetConfig`.** Родитель уже получил `/facade/config` (или подготовил эквивалентную полезную нагрузку) и пересылает её через PostMessage:
   ```javascript
   iframe.contentWindow.postMessage(
     { type: '@gen2-chat', action: 'set-config', ...configPayload },
     config.iframe_origin
   )
   ```

3. **Web Host получает `AppConfig`.** Обработчик сообщений проверяет тип конверта и действие, затем извлекает полный объект конфигурации.

4. **Инициализация продолжается** — начиная с этого момента внутренний путь идентичен пути A.

## Внутренняя последовательность инициализации

Как только `AppConfig` доступен (любым из путей), Web Host выполняет следующие шаги по порядку:

**1. Инициализация хранилища Pinia.**
Создаётся корневой экземпляр Pinia и регистрируются все модули хранилищ. Состояние аутентификации загружается из `AppConfig.auth` — токен хранится в памяти (или в cookie, если `hostConfig.session.type = 'cookie'`). URL окружения из `AppConfig.env` записываются в хранилище для использования Axios и WebSocket-клиентом.

**2. Настройка Axios.**
Экземпляр Axios настраивается с `APP_API_URL` в качестве `baseURL` и токеном аутентификации, подставляемым в заголовок по умолчанию. Любые `axiosDefaults` из конфигурации подмешиваются. Именно этот экземпляр дочерние iframe получают через proxy API.

**3. Инициализация Vue Router.**
Маршрутизатор создаётся с режимом истории, указанным в `AppConfig.hostConfig.history` (`"hash"` или `"browser"`). Регистрируются системные маршруты (`/c/:id`, `/chat/:id`, `/keeper/:id` и т. д.). Это статический набор — динамические маршруты монтирования добавляются на более позднем шаге.

**4. Внедрение PrimeVue и темы.**
PrimeVue устанавливается во Vue-приложение. Пользовательские CSS-свойства из `AppConfig.theming.global` и `AppConfig.theming.host` внедряются как переопределения `:root { --key: value; }` для соответствующих областей. Строки `customCSS` из `theming.global` и `theming.host` внедряются как теги `<style>`, а иконки из `theming.global` / `theming.host` регистрируются в Iconify. Этот шаг выполняется до монтирования приложения, чтобы первая отрисовка имела корректную тему.

**5. Монтирование Vue-приложения.**
Корневой компонент `App.vue` монтируется в DOM. В этот момент пользователи видят обрамление — боковую панель, панель чата, каркас раскладки, — хотя содержимое страницы может ещё загружаться.

**6. Регистрация динамических маршрутов.**
Приложение вызывает `GET /api/public/pages/routes`, чтобы получить список зарегистрированных страниц представлений. Для каждой страницы, чья запись реестра объявляет `mountRoute`, вызывается `router.addRoute('app', ...)`, чтобы добавить маршрут в работающий маршрутизатор. Именованный маршрут `app` — родительский маршрут раскладки, оборачивающий всё содержимое.

Любой конфликт маршрутов монтирования (дублирующиеся пути, зарезервированные сегменты, некорректный синтаксис) на этом этапе устанавливает фатальную ошибку в хранилище страниц. `App.vue` обнаруживает её и вместо обычного UI отрисовывает полноэкранный `<wippy-error>` с описательным сообщением.

**7. Разрешение URL.**
Маршрутизатор разрешает текущий URL (из `window.location` в режиме browser-history или из хэша в режиме hash). Если URL совпадает с системным маршрутом или зарегистрированным маршрутом монтирования, отрисовывается соответствующая страница. Если совпадений нет, маршрутизатор откатывается к домашнему представлению чата.

**8. Соединение WebSocket.**
WebSocket-клиент подключается к `APP_WEBSOCKET_URL`, используя токен аутентификации. Начинают поступать события реального времени (входящие сообщения, обновления сессий, изменения состояния артефактов). Соединение поддерживается на протяжении всей жизни страницы.

## Интерфейс AppConfig на TypeScript

Полный тип конфигурации, принимаемый и `initWippyApp`, и `SetConfig`. Обратите внимание: в `AppConfig` нет поля `feature` и поля `fe_mode` — `fe_mode` является параметром требования фасада, выбирающим точку входа модуля, а режим managed передаётся хосту через `hostConfig.layout`:

```typescript
interface AppConfig {
  $schema: 'wippy-context-2.0'
  auth: AppAuthConfig
  env: AppEnv
  axiosDefaults?: Partial<AxiosDefaults>
  routePrefix?: string
  apiRoutes?: ApiRoutesOverride
  tanstack?: TanstackConfig    // значения по умолчанию TanStack Query (глобальные + по категориям на основе ролей)
  theming: AppTheming
  hostConfig: HostConfig
  context: AppContext
}

interface AppAuthConfig {
  token: string            // Bearer-токен
  expiresAt: string        // отметка времени истечения в ISO 8601
}

interface AppEnv {
  APP_API_URL: string
  APP_AUTH_API_URL: string
  APP_WEBSOCKET_URL: string
  [key: string]: string | undefined
}

interface AppTheming {
  global?: ThemingScope
  host?: ThemingScope
  children?: ThemingScope
}

interface ThemingScope {
  customCSS?: string
  cssVariables?: Record<string, string>
  icons?: Record<string, unknown>
  iconSets?: Record<string, Record<string, unknown>>
}

interface HostConfig {
  session?: { type: 'non-persistent' | 'cookie' }
  history?: 'browser' | 'hash'
  showAdmin?: boolean
  allowSelectModel?: boolean
  startNavOpen?: boolean
  hideNavBar?: boolean
  disableRightPanel?: boolean
  hideSessionSelector?: boolean
  additionalNavItems?: PageApi.Page[]
  stateCache?: { maxPages?: number; maxSizePerPage?: number }
  allowAdditionalTags?: Record<string, string[]>   // тег → разрешённые атрибуты
  chat?: {
    convertPasteToFile?: {
      enabled: boolean
      minFileSize: number
      allowHtml: boolean
    }
  }
  layout?: HostLayoutDeclaration
}

// Значения по умолчанию TanStack Query. Поле верхнего уровня (общее для хоста и потомков, как
// apiRoutes). Поведение по умолчанию (без конфигурации) — refetchOnWindowFocus: false, чтобы
// возврат по alt-tab не перезагружал загружающееся содержимое.
interface TanstackConfig {
  default?: TanstackQueryOptions   // переопределяет глобальные значения по умолчанию для запросов
  content?: TanstackQueryOptions   // отрисовка одного ресурса (page/artifact/session/entry/model/upload)
  lists?: TanstackQueryOptions     // запросы навигации / индексов / списков
}

// JSON-безопасное подмножество опций запросов TanStack (без функций — конфигурация в JSON).
interface TanstackQueryOptions {
  refetchOnWindowFocus?: boolean
  refetchOnReconnect?: boolean
  refetchOnMount?: boolean
  staleTime?: number
  gcTime?: number
  retry?: boolean | number
  refetchInterval?: number | false
}

interface AppContext {
  resourceId: string
  resourceType: 'page' | 'artifact'
  route?: string
  [key: string]: unknown
}
```

## Источники конфигурации и приоритет

Web Host разрешает конфигурацию из нескольких источников, в порядке приоритета от низшего к высшему:

1. **Встроенные значения по умолчанию** — определены в самом бандле Web Host.
2. **Параметры запроса URL** — `?token=<token>`, `?expiresAt=<timestamp>`, `?persist` для cookie-сессий. Полезно для прямого доступа при разработке без родительской страницы.
3. **Аргумент `initWippyApp()`** — стандартный путь через фасад (JS-модуль); имеет приоритет над параметрами URL.
4. **PostMessage `SetConfig`** — ручной путь через iframe без фасада, используется при наличии `?waitForCustomConfig`.

На практике продуктовые развёртывания всегда используют `initWippyApp()` (путь через фасад) или PostMessage (ручное встраивание в iframe). Параметры URL — удобство разработки для прямой загрузки хоста в браузере с токеном.

## Схема запуска

Стандартный путь через фасад (JS-модуль):

```
на странице загружен module.js / managed-layout.js
  │
  ├─ window.initWippyApp(config, '#app')
  │     config.AppConfig = { $schema, auth, env, theming, hostConfig, context }
  │
  ├─ Инициализация Pinia (хранилище аутентификации, хранилище конфигурации)
  ├─ Настройка Axios (baseURL, заголовок аутентификации)
  ├─ Создание Vue Router (режим истории, системные маршруты)
  ├─ Установка PrimeVue, внедрение CSS темы
  ├─ Монтирование App.vue
  │
  ├─ GET /api/public/pages/routes
  │     router.addRoute('app', ...) для каждого mountRoute с бэкенда
  │
  ├─ Разрешение текущего URL → отрисовка совпавшего представления
  └─ Подключение WebSocket
```

## См. также

- [Точка входа фасада](./entry-point.md) — как `AppConfig` формируется и доставляется модулем `wippy/facade`
- [Многопанельная раскладка](./multi-panel-layout.md) — путь запуска управляемой раскладки, обслуживаемый `managed-layout.js`
- [Движки отрисовки](./render-engines.md) — как страница отрисовывается после загрузки (srcdoc iframe против Web Fragment)
