---
title: "Пакеты @wippy-fe"
description: "Пакеты @wippy-fe/* публикуются в npm и используются при сборке дочерних микрофронтендов — страниц представлений (view.page) и веб-компонентов (view.component)…"
---

# Пакеты @wippy-fe

Пакеты `@wippy-fe/*` публикуются в npm и используются при сборке дочерних микрофронтендов — страниц представлений (`view.page`) и веб-компонентов (`view.component`), — которые работают внутри Wippy Web Host. Для сборки самого Web Host они не используются. Все пакеты версионируются синхронно; все пакеты в данном релизе Web Host имеют один и тот же номер версии `0.0.x`.

Установите нужные пакеты:

```bash
npm install @wippy-fe/proxy @wippy-fe/webcomponent-vue @wippy-fe/router
```

## Доступ к хосту — `@wippy-fe/proxy`

И приложения-микрофронтенды (`view.page`), и веб-компоненты (`view.component`) общаются с хостом одинаково: синхронными именованными импортами из `@wippy-fe/proxy`, используемыми напрямую. Ни `await` для их получения, ни рукопожатия — хост внедряет конфигурацию до запуска вашего кода.

| Задача | Импорт из `@wippy-fe/proxy` |
|---|---|
| Аутентифицированный HTTP | `api` (экземпляр axios) |
| Связь с хостом | `host` |
| Подписки на события | `on` |
| Состояние между iframe | `state` |
| WebSocket | `ws` |
| Логирование | `logger` |
| Конфигурация потомка | `config` |

Смежные вспомогательные средства (не доступ к прокси):

| Задача | Где |
|---|---|
| Маршрутизация Vue | `createAppRouter()` + `<HostRouterLink>` из `@wippy-fe/router` |
| База веб-компонента | `WippyVueElement` из `@wippy-fe/webcomponent-vue` |
| Props/события компонента | `useProps()` / `useEvents()` из `@wippy-fe/webcomponent-vue` (обычно обёрнуты как `useComponentProps()` / `useComponentEvents()` в вашем `src/constants.ts`) |
| Типы TypeScript | ambient через `@wippy-fe/types-global-proxy` (добавьте в `types` в tsconfig) — `AppConfig` / `ProxyApiInstance` становятся глобальными; `HostApi` = `ProxyApiInstance['host']` |
| Экраны загрузки/ошибки | `<wippy-loading>` / `<wippy-error>` из `@wippy-fe/loading` |

`window.$W` и `window.getWippyApi` — **внутренние** глобальные переменные, устанавливаемые средой выполнения; не используйте их напрямую (см. [Прокси и изоляция § Внутреннее устройство](./proxy-isolation.md#internals--do-not-read-or-override)).

## Пакеты

### `@wippy-fe/proxy`

Модуль Proxy API — основной пакет, который каждый дочерний микрофронтенд использует для общения с хостом Wippy. Это тонкий **синхронный** фасад над средой выполнения прокси (`proxy.js`): среда выполнения устанавливает API во внутренние глобальные переменные, а `@wippy-fe/proxy` реэкспортирует его как синхронные геттеры. Приложения-микрофронтенды (в своём внедрённом iframe) и веб-компоненты (на странице хоста) импортируют одни и те же геттеры — синхронные, без `await` для их получения:

```typescript
import { host, api, ws, on, state, html, sanitize } from '@wippy-fe/proxy'

// Навигация хоста
host.navigate('/some-path')

// Вызов конечной точки API бэкенда
const data = await api.get('/api/v1/agents/list')

// Отправка команды по WebSocket
ws.sendCommand(sessionId, { text: 'Hello' })

// Подписка на событие хоста, не связанное с маршрутизацией
on('@visibility', (visible) => { /* приостановить или возобновить работу */ })

// Состояние между iframe
state.set('my-key', { value: 42 })
state.get('my-key').then(v => console.log(v))
```

Ключевые экспорты: `host`, `api`, `ws`, `on`, `state`, `html`, `sanitize`, `loadByTagName`, `loadWebComponent`, `classifyLink`.

Пометьте `@wippy-fe/proxy` как `external` в конфигурации Vite — хост предоставляет его через import map, и вы не должны включать в бандл собственную копию.

### `@wippy-fe/router`

Готовые к подстановке вспомогательные средства Vue Router, обеспечивающие осведомлённость о навигации хоста, которой стандартный `<RouterLink>` не даёт. Предоставляет `createAppRouter()` для создания маршрутизаторов с memory history, подходящих для srcdoc-iframe; `AutoRouterLink` (также экспортируется под устаревшим псевдонимом `RouterLink`) — классифицирующую замену `<RouterLink>` из vue-router, которая анализирует каждую цель и направляет её как `host-nav`, `child-nav`, `external` или `ignore`; и `HostRouterLink` — явную ссылку, всегда передающую навигацию хосту через `host.navigate()` (используйте её, когда нужна навигация на уровне хоста независимо от вложенности).

```typescript
import { createAppRouter, HostRouterLink } from '@wippy-fe/router'

const router = createAppRouter(
  [
    { path: '/', component: Home },
    { path: '/settings', component: Settings },
  ],
  { initialPath: config.context?.route ?? '/' },
)
```

`createAppRouter()` использует memory history, поэтому одно и то же приложение остаётся переносимым между доставкой через iframe, Fragment и `auto`. Передавайте `config.context?.route` как `initialPath`; фабрика синхронизирует свой внутренний маршрут с хостом через события `@history`. Прямой `createWebHistory()` работает только с Fragment и не должен использоваться приложением, способным откатиться к iframe.

### `@wippy-fe/theme`

CSS-переменные темы, объект конфигурации Tailwind CSS и интеграция стилей PrimeVue. Предоставляет `PrimeVuePlugin` для установки PrimeVue во Vue-приложение с корректным пресетом темы Wippy. Содержит файл `theme-config.css` со всеми переменными палитры `--p-primary-*`, `--p-surface-*` и `--p-secondary-*`, а также конфигурацию Tailwind, сопоставляющую эти переменные с классами-утилитами.

Вынесение JavaScript во внешние зависимости и доставка CSS — отдельные решения. Выносите JavaScript-спецификатор `@wippy-fe/theme` во внешние зависимости только когда именно этот ключ присутствует в закреплённом import map Web Host; иначе включайте его в бандл при импорте. Для веб-компонента отдельно запрашивайте CSS-ресурсы, нужные его shadow root, через `hostCssKeys` (например, `themeConfigUrl` или `primeVueCssUrl`). О конвейере CSS см. [Темизация](../micro-frontends/theming.md).

### `@wippy-fe/webcomponent-core`

Независимый от фреймворка базовый класс для сборки веб-компонентов Wippy. Предоставляет `WippyElement`, расширяющий `HTMLElement` хуками жизненного цикла (`onMount`, `onUnmount`), подключением контекста панели (`this.host` — обёртка proxy API, ограниченная панелью) и опциональными реактивными привязками props и событий.

```typescript
import { api } from '@wippy-fe/proxy'
import { WippyElement } from '@wippy-fe/webcomponent-core'

class MyWidget extends WippyElement {
  protected async onMount() {
    const { data } = await api.get('/api/v1/ping')
    this.innerHTML = `<div>Hello from ${data.name}</div>`
    this.host?.layout.on('update', ({ payload }) => {
      // реакция на межпанельные сообщения
    })
  }
  protected onUnmount() {}
  static get wippyConfig() {
    return { propsSchema: { properties: { label: { type: 'string' } } } }
  }
}
customElements.define('my-widget', MyWidget)
```

Также экспортирует `getWippyHost(el)`, `getWippyHostBus(el)` и `getWippyPanelId(el)` для подклассов обычного `HTMLElement`, не наследующих `WippyElement`. В версии `0.0.52+` `WippyElement.hostVisible`, `onHostVisibilityChanged(visible, previous)` и `reactive.hostVisibility` предоставляют сохраняемую логическую активность, не трактуя зарезервированный атрибут как prop компонента.

### `@wippy-fe/webcomponent-vue`

Слой интеграции Vue 3 для веб-компонентов Wippy. Предоставляет `WippyVueElement` (подкласс `WippyElement`, монтирующий Vue-приложение в shadow root), `define()` для регистрации пользовательского элемента и composable-функции для доступа к контексту хоста внутри Vue-компонентов. Экспортируемые composable-функции: `useProps`, `useEvents`, `usePropsErrors`, `useContent`, `useHost`, `useHostVisibility`, `useHostVisibilityRefresh`, `usePanelId` и `useLayoutBus`.

```typescript
import { define, WippyVueElement, useProps, useEvents, useHost } from '@wippy-fe/webcomponent-vue'
// ProxyApiInstance — ambient-глобальный тип из @wippy-fe/types-global-proxy (tsconfig "types") — импорт не нужен
import MyApp from './MyApp.vue'

class MyVueWidget extends WippyVueElement {
  static get vueConfig() {
    return { rootComponent: MyApp }
  }
  static get wippyConfig() {
    return { propsSchema: { properties: { label: { type: 'string' } } } }
  }
}

// Стандартный паттерн автозагрузки — читает ?declare-tag=tagName из URL во время выполнения
define(import.meta.url, MyVueWidget)
// Ручная регистрация (используйте только вне системы автозагрузки):
// define('my-vue-widget', MyVueWidget)
```

У `define` два соглашения о вызове:

- `define(import.meta.url, Class)` — стандартный паттерн автозагрузки. Функция читает параметр запроса `?declare-tag=tagName` из URL модуля, чтобы определить имя элемента. Используйте его во всех компонентах Wippy, создаваемых для автозагрузки, — это единственная форма, корректно работающая с автоматической регистрацией `wippy/views`.
- `define('tag-name', Class)` — прямая регистрация. Немедленно регистрирует пользовательский элемент под указанным именем в обход механизма `?declare-tag=`. Используйте только для программной или ручной регистрации вне системы автозагрузки (например, в автономной песочнице или тестовой обвязке).

Внутри `MyApp.vue`:
```typescript
import { useProps, useEvents, useHost } from '@wippy-fe/webcomponent-vue'

// Чтение props, объявленных в wippyConfig.propsSchema
const props = useProps<{ label: string }>()

// Испускание событий для хоста
const emit = useEvents()
emit('selected', { id: 42 })

// Доступ к обёртке хоста, ограниченной панелью
const host = useHost<ProxyApiInstance['host']>()
host?.layout.broadcast('my-event', { data: 'hello' })
```

`useProps()` и `useEvents()` — composable-функции библиотеки. Проекты обычно добавляют тонкие типизированные обёртки — `useComponentProps()` / `useComponentEvents()` — в собственном `src/constants.ts` (например, `export const useComponentProps = () => useProps<ComponentProps>()`); эти имена локальны для проекта и не являются экспортами `@wippy-fe/webcomponent-vue`.

`useContent()` также доступна для чтения содержимого, похожего на `slot`, которое хост внедряет в компонент.

`useHostVisibility()` возвращает принадлежащий хосту ref логической активности для
сохраняемого пользовательского элемента. `useHostVisibilityRefresh(task)` выполняет `task` после монтирования и
затем только при точном переходе `false -> true`, не заменяя элемент.
Она сериализует выполняющуюся задачу и объединяет промежуточные показы в одно
завершающее обновление.
Эти экспорты требуют `@wippy-fe/webcomponent-vue` версии `0.0.52` или новее.

### `@wippy-fe/layout`

Авторы прямых оболочек используют `LayoutManagerView` для стабильного монтирования панелей и
`useSwapBuffer()` для подмены сохраняемого содержимого без мигания. В версии `0.0.52+` асинхронную
готовность можно контролировать и по неизменяемому индексу буфера, и по ключу содержимого,
а стек разделителей предоставляет `--wippy-layout-splitter-z-index`. Круглая
рукоятка разделителя остаётся опциональной через
`--wippy-layout-splitter-handle-size` (`0` по умолчанию).

Чистые, независимые от фреймворка примитивы раскладки, используемые внутри движка управляемой раскладки Web Host. Большинство разработчиков дочерних приложений используют их косвенно через composable-функции `@wippy-fe/vue-host`. Прямое использование уместно при создании инструментов, учитывающих раскладку, или пользовательских оболочек.

Предоставляет `LayoutManager` — основной класс, управляющий деревом панелей, обрабатывающий переключение брейкпойнтов, валидирующий `HostLayoutDeclaration` и выполняющий мутации вроде `resizePanel` и `collapsePanel`. Без зависимости от Vue.

### `@wippy-fe/vue-host`

Composable-функции Vue 3, оборачивающие proxy-API раскладки в реактивные ref для использования внутри модулей страниц, работающих в панелях управляемой раскладки. Эти composable-функции никогда не возвращают `null` — они всегда возвращают объекты/ref, чьё внутреннее `.value` деградирует при отсутствии хоста с управляемой раскладкой: `snapshot.value` равен `null`, а `isManaged.value` равен `false` (мутации становятся молчаливыми no-op), `useWippyBreakpoint().value` и `useWippyMainRoute().value` — пустые строки, а `useWippyPanel(id).value` равен `null` для отсутствующего id. Проверяйте наличие хоста через `layout.isManaged.value` (или `layout.snapshot.value !== null`), а не проверкой `=== null` на возвращаемом значении. Нижележащая подписка на раскладку имеет модульную область и живёт весь срок жизни iframe — очистки на уровне компонента при демонтировании нет.

| Composable | Возвращает |
|------------|---------|
| `useWippyLayout()` | Реактивные `snapshot`, `activeBreakpoint`, `panels` и `isManaged`, плюс доступные мутации: `resizePanel`, `collapsePanel`, `expandPanel`, `movePanel`, `removePanel`, `closeModal`, `removeFloating` |
| `useWippyPanel(panelId)` | `ComputedRef` на живое состояние названной панели (или `null`, если её нет); `panelId` — обязательный `string \| Ref<string> \| getter` |
| `useWippyBreakpoint()` | Имя активного брейкпойнта |
| `useWippyMainRoute()` | Реактивный ref на текущий маршрут главной панели |

### `@wippy-fe/shared`

Типы контрактов через границы, константы глобальных имён и не имеющие зависимостей DOM-хелперы, разделяемые хостом и пакетами `@wippy-fe/*`. Экспортирует типы шины раскладки (`BroadcastEnvelope`, `LayoutBusBound`, `PanelTarget`, `DropPosition`, `SizeValue`, `PixelSize`) и константы глобальных имён (`GLOBAL_API_PROVIDER`, `GLOBAL_CONFIG_VAR`, …). В версии `0.0.52+` также экспортирует `readWippyVisibility`, `setWippyVisibility` и `WIPPY_VISIBILITY_ATTRIBUTE` для контракта сохраняемых WC. Он **не** экспортирует `AppConfig` / `ProxyApiInstance` / `HostApi` — это ambient-типы из `@wippy-fe/types-global-proxy` (ниже).

### `@wippy-fe/types-global-proxy`

Ambient-объявления TypeScript для глобальных переменных прокси, доступных в srcdoc-iframe: `window.$W`, `window.getWippyApi()`, `window.__WIPPY_APP_CONFIG__`, `window.__WIPPY_APP_API__` и `window.__WIPPY_PROXY_CONFIG__`. Добавьте этот пакет в `devDependencies` и сошлитесь на него в `tsconfig.json`, чтобы получить типизированный доступ к этим глобальным переменным без импорта чего-либо во время выполнения. Он также делает сами типы прокси — `AppConfig`, `ProxyApiInstance`, `StateApi`, `ProxyWsApi` и типы сообщений WebSocket — доступными как **ambient-типы**, которыми можно аннотировать напрямую (без импорта).

```json
{
  "compilerOptions": {
    "types": ["@wippy-fe/types-global-proxy"]
  }
}
```

### `@wippy-fe/pinia-persist`

Плагин Pinia для сохранения состояния между iframe. Направляет записи в хранилища Pinia через API `state` прокси, чтобы состояние страницы переживало навигацию iframe и могло разделяться между панелями. Полезен для сохранения черновиков форм или пользовательских настроек без реализации собственной логики персистентности.

```typescript
import { createPinia } from 'pinia'
import { createWippyPersist, preloadWippyState } from '@wippy-fe/pinia-persist'

const pinia = createPinia()
const preloaded = await preloadWippyState()
pinia.use(createWippyPersist(preloaded))
```

Хранилища подключаются, объявляя `wippyPersist: true` в опциях `defineStore` (а не `persist: true`). Пользовательские значения `scope` автоматически получают префикс `@custom:` во избежание коллизий с системными областями (UUID страницы/артефакта) и должны быть глобально уникальными; чтобы дать двум экземплярам хранилища отдельные корзины, передайте отдельный `scope` для каждого экземпляра.

### `@wippy-fe/vue-utils`

Небольшие утилиты для приложений Vue 3, работающих внутри iframe Wippy. В настоящее время экспортирует `installVueWarnSuppressor(app)`, которая принимает ваше Vue-приложение и подавляет предупреждения `[Vue warn]: Failed to resolve component` для пользовательских элементов с kebab-именами, зарегистрированных через `customElements.define(...)` (системные теги `w-iframe` / `w-artifact` / `wippy-loading` / `wippy-error`, а также теги автозагрузки). Вызовите её один раз при запуске приложения, передав экземпляр приложения:

```typescript
import { installVueWarnSuppressor } from '@wippy-fe/vue-utils'
import { createApp } from 'vue'
import App from './App.vue'

const app = createApp(App)
installVueWarnSuppressor(app)
app.mount('#app')
```

Без неё в консоли может появляться шум `[Vue warn]: Failed to resolve component` для тегов пользовательских элементов, которые компилятор шаблонов Vue не распознаёт (элементы при этом отрисовываются корректно). Опечатки в PascalCase-именах компонентов по-прежнему вызывают предупреждения, сохраняя этот сигнал. Пакет `@wippy-fe/proxy` реэкспортирует этот хелпер для удобства.

### `@wippy-fe/vite-plugin`

Плагины Vite, закрывающие требования этапа сборки для микрофронтендов Wippy. Предоставляет два плагина:

`wippyPagePlugin()` — для модулей `view.page`. Читает и валидирует поле `wippy` в `package.json`, разрешает поддерживаемые ссылки `file://`, выдаёт `wippy-meta.json` и внедряет метаданные пакета для режима без хоста в собранный HTML. Он **не** настраивает внешние зависимости Rollup; приложение должно само согласовать свои внешние зависимости с import map целевого Web Host.

`wippyComponentPlugin()` — для модулей `view.component`. Аналогичен `wippyPagePlugin()`, но нацелен на формат вывода веб-компонента (ESM, без HTML-оболочки). Также выдаёт `wippy-meta.json` с `tagName` и схемой компонента.

```typescript
// vite.config.ts для модуля view.page
import { wippyPagePlugin } from '@wippy-fe/vite-plugin'

export default {
  plugins: [
    vue(),
    wippyPagePlugin(),
  ],
}
```

### `@wippy-fe/log`

Структурированный логгер без продуктовых зависимостей. Предоставляет функции логирования `debug`, `info`, `warn`, `error`, `captureException` для отчётов об ошибках и цепочку breadcrumb. Поддерживает подключаемые транспорты: консоль (по умолчанию), Sentry и GELF. Все вызовы логирования включают контекстные теги, по которым хост может сопоставлять записи логов из дочерних iframe с родительской сессией.

```typescript
import { createChildLogger } from '@wippy-fe/log/logger'

const log = createChildLogger({ resourceId: 'my-widget' })
log.info('Widget mounted', { panelId: 'main' })
log.error('Request failed', { url: '/api/data', status: 500 })
```

### `@wippy-fe/loading`

Не имеющие зависимостей пользовательские элементы `<wippy-loading>` и `<wippy-error>`, поставляемые в виде IIFE (`loading.js`). Хост автоматически внедряет `loading.js` в каждый дочерний iframe перед `proxy.js`, поэтому эти элементы всегда доступны в дочерних приложениях без какого-либо импорта.

`<wippy-loading>` — полноэкранный индикатор загрузки. Атрибуты: `title`, `subtitle`, `no-bg` (режим оверлея без фона).

`<wippy-error>` — полноэкранное отображение ошибки. Атрибуты: `title`, `message`, `icon` (`circle` | `triangle` | `sad`), `severity` (`danger` | `warning`).

```html
<!-- Показать во время загрузки -->
<wippy-loading title="Loading data..." subtitle="Please wait"></wippy-loading>

<!-- Показать при ошибке -->
<wippy-error
  title="Something went wrong"
  message="Could not load the dashboard."
  icon="sad"
  severity="danger">
</wippy-error>
```

Эти элементы также зарегистрированы в самом хосте для использования в состояниях фатальной ошибки.

### `@wippy-fe/chat`

В версии `0.0.51+` `<wippy-chat>` реагирует на `session-id` и `start-token` без
необходимости заменять элемент. Очистка или удаление ранее контролируемой
сессии начинает новый чат на основе токена, если токен присутствует, тогда как переподключения
не проигрывают уже использованный токен. Вытесненные запуски безопасны к гонкам.

Набор компонуемых пользовательских элементов чата — `<wippy-chat>`, `<wippy-chat-messages>`, `<wippy-chat-input>` и `<wippy-session-selector>`, — которые встраивают живой чат Wippy в любого потомка по тегу. Как и в `@wippy-fe/loading`, крошечная оболочка (`chat.js`) автоматически регистрирует все четыре тега и внедряется в каждый дочерний контекст через массив `scripts` хоста, поэтому элементы доступны по имени тега без импорта и регистрации. Тяжёлое внутреннее устройство чата (Vue + PrimeVue/Shiki/markdown) выделено в отдельные чанки и лениво загружается при первом монтировании.

```html
<wippy-session-selector></wippy-session-selector>
<wippy-chat></wippy-chat>
```

Полный справочник элементов — атрибуты, события, композиция и темизация — см. в разделе [Веб-компоненты чата](../micro-frontends/chat-web-components.md).

### `@wippy-fe/markdown-iframe`

Тяжёлый бандл отрисовки markdown (markdown-it + подсветка синтаксиса Shiki). Динамически импортируется компонентом хоста `<w-artifact>`, когда тому нужно отрисовать содержимое Markdown внутри артефакта в iframe. Дочерние приложения, отрисовывающие Markdown самостоятельно, могут импортировать этот пакет, чтобы получить тот же рендерер с согласованным оформлением, хотя для простых случаев достаточно одного `markdown-it` (доступного как внешняя зависимость).

---

## Import map хоста

Используйте тот же закреплённый `<version-tag>`, что и в `fe_facade_url`, и однократно загрузите артефакт релиза во время разработки:

```bash
curl.exe -fsS "https://web-host.wippy.ai/<version-tag>/import-map.json" -o import-map.json
```

Точные ключи полученного объекта `imports` и есть контракт вынесения JavaScript во внешние зависимости:

- Поместите **каждый ключ** в `build.rollupOptions.external`, включая пакеты, которые текущее приложение не импортирует. Карта хоста только пополняется, поэтому не поддерживайте меньшее вручную отобранное подмножество.
- Скопируйте тот же полный объект `imports` в `app.html` для режима без хоста.
- Включайте импортируемый спецификатор в бандл только когда его точного bare-спецификатора нет в закреплённой карте.
- Перезагружайте карту при смене тега Web Host или при добавлении зависимости, чтобы проверить, может ли её точный спецификатор быть внешним.
- PrimeVue подчиняется тому же правилу точного подпути: `primevue/button` не подразумевает `primevue/dialog`.

Объясняя этот контракт, не выдавайте частичный `<script type="importmap">` или его заготовку.
Комментарии в JSON и записи-многоточия невалидны и
вводят в заблуждение. Либо покажите полный полученный объект для одного явного тега, либо
скажите читателю загрузить и скопировать его дословно.

```typescript
// vite.config.ts
import { readFileSync } from 'node:fs'

const hostImportMap = JSON.parse(
  readFileSync(new URL('./import-map.json', import.meta.url), 'utf8'),
) as { imports: Record<string, string> }

const hostExternals = Object.keys(hostImportMap.imports)

export default {
  build: {
    rollupOptions: {
      external: hostExternals,
    },
  },
}
```

`peerDependencies` не является идентичной копией этого списка. Объявляйте только корни npm-пакетов, которые артефакт действительно импортирует; подпути import map вроде `@wippy-fe/log/logger` не являются отдельными peer-пакетами.

Этот контракт не определяет универсального слияния или приоритета переопределений между хостом и приложением. Режим с хостом использует карту, доставляемую закреплённым релизом Web Host. Автономный режим использует полную скопированную карту в `app.html`.
