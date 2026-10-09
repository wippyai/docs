---
title: "Последовательность запуска"
description: "После получения конфигурации Web Host выполняет фиксированную последовательность инициализации до отрисовки какого-либо UI. Последовательность немного различается в зависимости…"
---

# Последовательность запуска

После того как Web Host получает свою конфигурацию, он выполняет фиксированную последовательность инициализации до отрисовки какого-либо UI. Последовательность немного различается в зависимости от того, загружается ли Web Host как JS-модуль, забирающий страницу себе (стандартный путь через фасад), или работает внутри iframe (ручной путь без фасада), но внутренние шаги после того, как конфигурация доступна, идентичны.

## Путь A — JS-модуль (стандартный, через фасад)

Это путь, который использует текущий `wippy/facade`. Фасад раздаёт страницу, загружающую точку входа Web Host в виде JS-модуля — `module.js` для режима **compat** или `managed-layout.js` для режима **managed**, — и модуль забирает себе всю страницу и её историю браузера.

1. **Получить конфигурацию и зарегистрировать карту.** Требование фасада называется `import_map`; `/facade/config` возвращает его как `cfg.importMap`. Shell загружает общий bootstrap import map и регистрирует составленную карту до импорта модулей Host.

2. **Импортировать модуль Host и инициализировать приложение.** Shell импортирует `module.js` или `managed-layout.js`, который предоставляет `window.initWippyApp`. Затем он вызывает `initWippyApp(appConfig, rootContainer?)` с начальной `AppConfig`, включая `importMap: cfg.importMap`. Рукопожатия PostMessage нет.

3. **Инициализация продолжается** — см. [Внутреннюю последовательность инициализации](#internal-init-sequence) ниже.

## Путь B — iframe (ручной, без фасада)

Этот путь используется, когда вы сами встраиваете полный хост внутрь iframe — для частичного встраивания в страницу с более сильной изоляцией. Он загружает `iframe.html?waitForCustomConfig` и получает конфигурацию через PostMessage `SetConfig`. Текущий фасад этого не создаёт; путь существует для ручных вставок.

1. **Родитель подготавливает iframe.** Добавьте `?waitForCustomConfig` к versioned URL `iframe.html`. Установите обработчик `message` до задания `iframe.src`. Standalone bootstrap ожидает родительский `SetConfig` до регистрации import map и импорта модулей приложения Host. Это происходит до монтирования приложения Host.

2. **Родитель отвечает на `GetConfig`.** Дождитесь сообщения `get-config` от
   iframe. Принимайте его, только если `event.origin` совпадает с доверенным
   origin iframe, а `event.source` — именно `iframe.contentWindow`. Затем
   отправьте полный `AppConfig` сообщением `set-config`, указав доверенный origin
   как `targetOrigin`. `/facade/config` содержит настройки развертывания, но
   родитель должен добавить `$schema`, `auth` и `context`. См. [полный пример iframe](./entry-point.md#manual-facade-less-iframe-embedding).

3. **Web Host получает `AppConfig`.** Он проверяет конверт сообщения, принимает `SetConfig` в iframe только от физического родительского окна и сравнивает `event.origin` с origin родителя, если тот доступен. В Web Fragment также требуется, чтобы `fragmentId` совпадал с собственным ID этого экземпляра. Последующие допустимые сообщения `SetConfig` могут обновлять конфигурацию этого документа.

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
  $schema: 'wippy-context-2.2'
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
shell facade получает /facade/config (требование import_map → cfg.importMap)
  │
  ├─ получает карту Host и загружает общий bootstrap import map
  ├─ регистрирует составленную import map
  ├─ импортирует module.js / managed-layout.js
  ├─ модуль предоставляет window.initWippyApp
  ├─ shell вызывает initWippyApp({ ..., importMap: cfg.importMap }, '#app')
  ├─ resolveConfig() → мигрирует, нормализует config/auth/env
  ├─ ожидает GET /api/public/pages/routes
  ├─ создает Vue app и router
  │     статические system routes + проверенные backend mount routes
  ├─ setupApp() → Pinia, Axios, PrimeVue, theme и другие providers
  ├─ монтирует App.vue → разрешает текущий URL
  └─ компоненты запрашивают WebSocket-клиенты
```

## См. также

- [Точка входа фасада](./entry-point.md) — как `AppConfig` формируется и доставляется модулем `wippy/facade`
- [Многопанельная раскладка](./multi-panel-layout.md) — путь запуска управляемой раскладки, обслуживаемый `managed-layout.js`
- [Движки отрисовки](./render-engines.md) — как страница отрисовывается после загрузки (srcdoc iframe против Web Fragment)


## Источники Iconify

`AppConfig.iconify.providers` задает источник Iconify. Если поле не указано, используются онлайн-значения по умолчанию. Явно заданные значения передаются дочерним приложениям через AppConfig. См. [Провайдеры Iconify](./iconify.md).

## PrimeVue и браузерные realms

Приложения импортируют PrimeVue по точным спецификаторам из закрепленной import
map Host. Пересобранные приложения используют общий граф vendor PrimeVue внутри
своего JavaScript realm. У каждого iframe и Web Fragment свой realm и граф
модулей. Import map не добавляет стили; запрашивайте нужный CSS PrimeVue через
документированные CSS-ключи Host. Уже встроенные bundle необходимо пересобрать
с новой картой.

## AppConfig import map

`AppConfig.importMap` — необязательная браузерная карта импортов верхнего уровня со стандартными полями `imports` и `scopes`.

```typescript
interface AppConfig {
  importMap?: {
    imports?: Record<string, string>
    scopes?: Record<string, Record<string, string>>
  } | null
}
```

Для документов страниц srcdoc Host объединяет карту страницы, сгенерированные значения Host по умолчанию, затем `AppConfig.importMap`. У standalone- и facade-документов, а также у каждого вхождения Web Fragment нет карты страницы srcdoc; они объединяют значения Host по умолчанию и `AppConfig.importMap`. Каждое вхождение Web Fragment работает в собственном физическом realm iframe. В `imports` и каждом scope последнее значение совпадающего ключа заменяет предыдущее, остальные записи сохраняются. Конфигурация может заменить записи страницы или Host, включая Vue, PrimeVue и Wippy. Точный ключ соответствует одному specifier. Ключ с завершающим `/` задаёт префикс specifier, и целевой URL тоже должен заканчиваться на `/`. `scopes` выбирают записи по URL импортирующего модуля. Относительные целевые URL разрешаются относительно базового URL документа.

Host должен сформировать карту и зарегистрировать native import map до загрузки модулей. Позднее добавление другой карты не заменяет уже зарегистрированный ключ. Если в обновлении нет `importMap`, текущая настройка сохраняется. Значения `null` и `{}` очищают расширение.

Обновление import map применяется при создании документа. Оно не меняет разрешение модулей в уже существующем документе. Перезагрузите его, чтобы применить обновление; новые документы используют последнюю конфигурацию. Каждый экземпляр Web Fragment работает в собственном физическом realm iframe и регистрирует карту в этом realm до загрузки модулей.

Замена общей записи Vue, PrimeVue или Wippy может разделить идентичность модулей или сервисов между Host и дочерним кодом. Перед публикацией проверяйте интеграцию по точной опубликованной карте.

Используйте это поле только с развернутой версией Host, в документации которой указана поддержка.
