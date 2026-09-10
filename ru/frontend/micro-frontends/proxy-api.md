---
title: "Proxy API"
description: "Дочерние приложения и веб-компоненты общаются с хостом Wippy через среду выполнения прокси (proxy.js). Ваш код никогда не обращается к ней напрямую —…"
---

# Proxy API

Дочерние приложения и веб-компоненты общаются с хостом Wippy через среду выполнения прокси (`proxy.js`). Ваш код никогда не обращается к ней напрямую — вы импортируете именованные геттеры из **`@wippy-fe/proxy`**, тонкого синхронного фасада над ней. Один и тот же импорт работает для обеих поверхностей:

- **Микрофронтенд-приложения (`view.page`)** работают внутри srcdoc-iframe, куда хост вставляет `proxy.js`.
- **Веб-компоненты (`view.component`)** работают как ESM-модули на странице хоста; хост предоставляет `@wippy-fe/proxy` через import map.

О том, как среда выполнения загружается в каждый контекст, см. [Прокси и изоляция](../web-host/proxy-isolation.md).

## Инициализация

`@wippy-fe/proxy` экспортирует синхронные геттеры — `host`, `api`, `on`, `config`, `state`, `ws`, `logger`, `sanitize`, `html`, `loadCss`, `loadWebComponent`, `loadByTagName`, `hostCss`, `define`, `classifyLink`, `installVueWarnSuppressor`, `addIcons`, `tailwindConfig`. Импортируйте нужное и используйте напрямую. Нет **никаких** `getWippyApi`, `instance` и рукопожатия `GetConfig`/`SetConfig`, которого нужно было бы ждать.

Шаблон синхронных геттеров общий для микрофронтенд-приложений и веб-компонентов:

```ts
import { host, api, config, state, ws, logger } from '@wippy-fe/proxy'

host.navigate('/dashboard')
const agents = await api.get('/api/v1/agents')   // api — это axios; await относится к HTTP-вызову, а не к получению `api`
const token = config.auth.token
```

Приложения в iframe и Web Fragment получают сведения о видимости жизненного
цикла через тему прокси `@visibility`. Прямые веб-компоненты — нет: используйте
`useHostVisibility()` или `useHostVisibilityRefresh()` из
`@wippy-fe/webcomponent-vue` либо эквивалентные API `WippyElement`.

Эти геттеры **синхронны** — `host`, `api`, `on`, `config` и т. д. доступны в тот момент, когда ваш код начинает выполняться. Хост вставляет дочернюю конфигурацию **синхронно, до** загрузки среды выполнения (и для приложений `view.page`, и для веб-компонентов `view.component`), поэтому среда выполнения инициализируется до выполнения вашего скрипта. Вам никогда не нужно `await`, чтобы *получить* геттер, и никакого рукопожатия `GetConfig`/`SetConfig` нет. Единственный `await`, который вы пишете, относится к реальной асинхронной операции (HTTP-вызов через `api`, чтение `state` и т. п.).

Один раз во время разработки загрузите `import-map.json` целевого релиза Web
Host и используйте каждый ключ его объекта `imports` как внешнюю зависимость
Rollup. Это касается и `@wippy-fe/proxy`; не поддерживайте список внешних
зависимостей из одного пакета или только из импортированных. Загружайте заново
только при смене тега Web Host или при добавлении зависимости, чтобы проверить,
может ли её точный спецификатор быть внешним:

```typescript
// vite.config.ts (после сохранения загруженного ответа как import-map.json)
import { readFileSync } from 'node:fs'

const hostImportMap = JSON.parse(
  readFileSync(new URL('./import-map.json', import.meta.url), 'utf8'),
)

export default defineConfig({
  build: {
    rollupOptions: {
      external: Object.keys(hostImportMap.imports),
    },
  },
})
```

### Типы TypeScript

Типы прокси — `AppConfig`, `ProxyApiInstance`, `StateApi`, `ProxyWsApi` и типы сообщений WebSocket — поставляются как **ambient-декларации** в `@wippy-fe/types-global-proxy`, а не как именованные экспорты какого-либо пакета. Добавьте пакет в `types` вашего `tsconfig.json` (или используйте triple-slash-ссылку), и они станут доступны глобально — без импорта:

```jsonc
// tsconfig.json
{ "compilerOptions": { "types": ["@wippy-fe/types-global-proxy"] } }
```

```typescript
// AppConfig, ProxyApiInstance, … — ambient-глобальные типы; аннотируйте ими напрямую, без импорта:
function render(cfg: AppConfig) { /* … */ }
type HostApi = ProxyApiInstance['host']   // HostApi — это индексный тип, а не отдельный экспорт
```

Для перечисленных выше API прокси **не существует** `import … from '@wippy-fe/shared'`. `@wippy-fe/shared` несёт межпакетные типы и константы имён `GLOBAL_*`; начиная с `0.0.52` он также экспортирует рантайм-помощники для удерживаемых веб-компонентов
`readWippyVisibility`, `setWippyVisibility` и
`WIPPY_VISIBILITY_ATTRIBUTE`. Авторы прямых веб-компонентов обычно используют
`useHostVisibility()` или `useHostVisibilityRefresh()` из
`@wippy-fe/webcomponent-vue`; событие прокси `@visibility` остаётся каналом
iframe/Web Fragment.

### Внутреннее устройство (не использовать)

Среда выполнения устанавливает несколько глобальных переменных для собственных нужд — `window.$W`, `window.getWippyApi`, `window.initWippyApi` и набор `window.__WIPPY_*`. **Код приложений и компонентов никогда не должен их читать или переопределять.** Вместо этого всегда идите через `@wippy-fe/proxy`. Они перечислены лишь для того, чтобы вы случайно их не затёрли — см. [Прокси и изоляция § Внутреннее устройство](../web-host/proxy-isolation.md#internals--do-not-read-or-override).

> `@wippy-fe/proxy` (описанный здесь) — это API, который использует ваш дочерний код. Собственный bootstrap хоста, `initWippyApp(config, rootContainer?)`, монтирует весь Web Host на пути module-embed / фасада — код дочернего приложения никогда его не вызывает.

---

## Конфигурация

### `config`

Конфигурация дочернего приложения, доставленная хостом. Это обычный объект (не функция) — импортируется напрямую и готов к синхронному чтению. Новая документация ориентируется только на текущий контракт `wippy-context-2.0`.

```typescript
import { config } from '@wippy-fe/proxy'

const token = config.auth.token
```

```typescript
interface ChildAppConfig {
  $schema: 'wippy-context-2.0'
  auth: {
    token: string
    expiresAt: string
  }
  env: {
    APP_API_URL: string
    APP_AUTH_API_URL: string
    APP_WEBSOCKET_URL: string
    [key: string]: string | undefined
  }
  axiosDefaults?: Partial<AxiosDefaults>
  routePrefix?: string
  apiRoutes?: Record<string, string>
  themeMode?: 'auto' | 'light' | 'dark'
  theming: {
    global?: {
      customCSS?: string
      cssVariables?: Record<string, string>
      icons?: Record<string, unknown>
      iconSets?: Record<string, Record<string, unknown>>
    }
  }
  context: {
    resourceId: string
    resourceType: 'page' | 'artifact'
    route?: string
    [key: string]: unknown
  }
  selfPageId?: string
  mountRoutes?: Record<string, string>
}
```

Для динамических страниц, если URL хоста — `/c/page-id/something/else?foo=1`:
- `config.context?.route` несёт `/something/else?foo=1`.
- `config.path` — устаревшее поле совместимости из полезных нагрузок до `wippy-context-2.0`, его не следует использовать в новом коде.

---

## Управление хостом

### `host`

API взаимодействия с хостом (`HostApi`). Импортируется напрямую и используется синхронно.

```typescript
import { host } from '@wippy-fe/proxy'
```

---

### `host.setThemeMode(mode)` и `host.getThemeMode()`

Режим темы — это состояние хоста, переносимое в AppConfig. Переключайте его
только через публичный API прокси:

```typescript
import { host, on } from '@wippy-fe/proxy'

async function setThemeMode(mode: 'auto' | 'light' | 'dark') {
  await new Promise<void>((resolve, reject) => {
    const unsubscribe = on('@theme', (appliedMode) => {
      if (appliedMode !== mode) return
      unsubscribe()
      const currentMode = host.getThemeMode()
      if (currentMode !== mode) {
        reject(new Error(`Theme propagation mismatch: ${currentMode}`))
        return
      }
      resolve()
    })

    // Подписка до команды, чтобы быстрое событие распространения не потерялось.
    host.setThemeMode(mode)
  })
}

await setThemeMode('dark')
```

Допустимые режимы: `auto`, `light` и `dark`. `auto` следует настройке
операционной системы. Изменение применяется к хосту, записывается обратно в
AppConfig, транслируется в живые iframe страниц и веб-компоненты и передаётся
через вложенные контейнеры Wippy. Подписывайтесь на `@theme`, когда коду нужно
дождаться применённого состояния дочернего контекста. Освобождайте подписку при
размонтировании компонента.

Хост не владеет сохранением. Встраивающий фасад слушает событие смены темы
хоста и сохраняет пользовательский выбор так, как описано в
[Сохранение темы](../web-host/theme-persistence.md).

Не добавляйте и не удаляйте классы `w-theme-dark` / `w-theme-light`, не
вызывайте внутренний `applyThemeMode`, не изменяйте хранилища AppConfig, не
синтезируйте сообщения прокси и не используйте `window.getWippyApi`. Это детали
реализации Web Host, а не API приложений или браузерных тестов. Рантайм-тесты
должны вызывать `host.setThemeMode()`, дожидаться распространённого события
`@theme` и проверять `host.getThemeMode()` перед снятием внешнего вида.
AppConfig — это транспорт от хоста к дочернему контексту; не изменяйте его
внутреннее хранилище и не полагайтесь на ранее импортированный снимок
конфигурации как на сигнал завершения.

Метода `host.applyTheme()` не существует.

---

### `host.startChat(agentToken, options?)`

Открывает новую сессию чата, используя предоставленный стартовый токен агента.

```typescript
host.startChat(agentToken: string, options?: { sidebar?: boolean }): void
```

| Параметр | Тип | По умолчанию | Описание |
|-----------|------|---------|-------------|
| `agentToken` | `string` | — | Токен, определяющий, какого агента запустить |
| `options.sidebar` | `boolean` | `false` | `true` открывает чат в правой боковой панели; `false` — в основной области |

```typescript
host.startChat('my-agent-token')                     // Основная область
host.startChat('my-agent-token', { sidebar: true })  // Правая боковая панель
```

---

### `host.openSession(sessionId, options?)`

Открывает существующую сессию чата по UUID.

```typescript
host.openSession(sessionId: string, options?: { sidebar?: boolean }): void
```

```typescript
host.openSession('abc-123-uuid', { sidebar: false })
```

---

### `host.navigate(url)`

Запрашивает у хоста SPA-навигацию. Поддерживаемые шаблоны:

- `/c/<page-id>` — переход к динамической странице
- `/c/<page-id>/<sub-path>` — динамическая страница с подпутём
- `/chat/<session-id>` — открыть сессию чата
- Любой маршрут монтирования, занятый страницей с `mountRoute` в её записи реестра

```typescript
host.navigate(url: string): void
```

```typescript
host.navigate('/c/my-page-id')
host.navigate('/chat/session-uuid')
host.navigate('/keeper')
```

> **Оговорка про управляемую вёрстку.** `startChat`, `openSession`, `openArtifact` и `navigate` нацелены на стандартную совместимую оболочку (представление чата, правую панель и корневой маршрут). При `fe_mode = managed` они по-прежнему отправляются, но не имеют встроенной поверхности отрисовки — вместо этого отображайте чат, артефакты и подмаршруты через объявленные панели. См. [Многопанельная вёрстка § Что работает в каком режиме](../web-host/multi-panel-layout.md#what-works-in-which-mode).

---

### `host.onRouteChanged(internalRoute, navId?)` — низкоуровневая интеграция с роутером

Уведомляет хост об изменении внутреннего маршрута страницы. Хост обновляет адресную строку браузера, включая в неё маршрут дочернего приложения. Этот вызов **обязателен** — без него URL хоста остаётся на корне страницы, а кнопка «Назад» браузера не работает для дочерней навигации.

```typescript
host.onRouteChanged(internalRoute: string, navId?: number): void
```

Переносимые Vue-приложения используют `createAppRouter()` из `@wippy-fe/router`; пакет владеет этим вызовом, соответствующей подпиской `@history`, нормализацией и подавлением эхо-циклов. Не собирайте эти части вручную в коде приложения. Этот метод остаётся документированным для авторов платформенных адаптеров и не-Vue-интеграций.

---

### `host.confirm(options)` → `Promise<boolean>`

Показывает диалог подтверждения PrimeVue. Разрешается в `true`, если пользователь соглашается, и в `false`, если отклоняет или закрывает диалог.

```typescript
host.confirm(options: LimitedConfirmationOptions): Promise<boolean>
```

```typescript
const confirmed = await host.confirm({
  message: 'Delete this item permanently?',
  header: 'Confirm Delete',
  icon: 'tabler:trash',
  acceptLabel: 'Delete',
  rejectLabel: 'Cancel',
  acceptClass: 'p-button-danger',
})

if (confirmed) {
  await api.delete('/api/v1/items/123')
}
```

---

### `host.toast(options)`

Показывает всплывающее уведомление PrimeVue.

```typescript
host.toast(options: ToastMessageOptions): void
```

| `severity` | Внешний вид |
|------------|-----------|
| `success` | Зелёный |
| `info` | Синий |
| `warn` | Жёлтый |
| `error` | Красный |

```typescript
host.toast({
  severity: 'success',
  summary: 'Saved',
  detail: 'Your changes have been saved.',
  life: 3000,
})
```

---

### `host.openArtifact(artifactUUID, options?)`

Открывает артефакт в боковой панели или модальном окне.

```typescript
host.openArtifact(
  artifactUUID: string,
  options?: { target?: 'sidebar' | 'modal' }
): void
```

Цель по умолчанию — `'sidebar'`.

```typescript
host.openArtifact('artifact-uuid-123', { target: 'modal' })
```

---

### `host.setContext(context, sessionUUID?, source?)`

Отправляет контекстные данные в текущую сессию чата. Если ни одна сессия ещё не открыта, контекст ставится в очередь и применяется к следующей сессии, открытой через `startChat` или `openSession`. При необходимости ограничьте контекст конкретным UUID сессии или пометьте его дескриптором источника.

```typescript
host.setContext(
  context: Record<string, unknown>,
  sessionUUID?: string,
  source?: { type: 'page' | 'artifact', uuid: string, instanceUUID?: string }
): void
```

```typescript
host.setContext({
  currentPage: 'dashboard',
  selectedItemIds: [1, 2, 3],
})
```

---

### `host.classifyLink(url)` → `LinkClassification`

Классифицирует href как навигацию хоста, навигацию дочернего приложения, внешнюю ссылку или игнорируемую. Использует `mountRoutes` и `routePrefix` из дочерней конфигурации плюс встроенные сегменты системных маршрутов. Чистая функция — без побочных эффектов.

```typescript
host.classifyLink(href: string): LinkClassification

interface LinkClassification {
  kind: 'host-nav' | 'child-nav' | 'external' | 'ignore'
  href: string
  normalizedPath?: string
  targetPageId?: string  // задаётся, когда host-nav совпал с конкретным mountRoute
}
```

```typescript
// Обработчик ссылок с учётом классификатора
import { host } from '@wippy-fe/proxy'

document.addEventListener('click', (ev) => {
  const a = (ev.target as HTMLElement)?.closest('a')
  if (!a) return
  const cls = host.classifyLink(a.getAttribute('href') ?? '')

  if (cls.kind === 'host-nav') {
    ev.preventDefault()
    host.navigate(cls.normalizedPath ?? cls.href)
  }
  // child-nav / external / ignore: пусть отработают существующие обработчики
})
```

Для Vue-приложений замените `RouterLink` из `vue-router` на `RouterLink` из `@wippy-fe/router` — он использует `classifyLink` внутри и совместим по props с настоящим `RouterLink`.

---

### `host.handleError(code, error)`

Сообщает об ошибке хосту для централизованной обработки.

```typescript
host.handleError(
  code: 'auth-expired' | 'other',
  error: Record<string, unknown>
): void
```

- `'auth-expired'` — запускает поток повторной аутентификации хоста
- `'other'` — общая ошибка; логируется и при необходимости показывается пользователю

```typescript
try {
  await api.get('/protected-endpoint')
} catch (error) {
  if ((error as any).response?.status === 401) {
    host.handleError('auth-expired', error as Record<string, unknown>)
  } else {
    host.handleError('other', error as Record<string, unknown>)
  }
}
```

---

### `host.logout()`

Выполняет выход текущего пользователя и завершает его сессию.

```typescript
host.logout(): void
```

---

### `host.bridge`

Обмен сообщениями между родителем и потомком по каналам, когда страница встроена внутрь `<w-iframe>`. Полный протокол см. в [Прокси и изоляция § Мост родитель-потомок](../web-host/proxy-isolation.md#parent-child-bridge).

```typescript
// Отправка родителю без ожидания ответа
host.bridge.post(channel: string, payload?: unknown): void

// Запрос/ответ (разрешается возвращаемым значением обработчика родителя)
host.bridge.request<T>(
  channel: string,
  payload?: unknown,
  options?: { timeoutMs?: number }
): Promise<T>

// Регистрация обработчика входящих сообщений от родителя
host.bridge.on(
  channel: string,
  handler: (payload: unknown) => unknown | Promise<unknown>
): () => void  // возвращает функцию отписки
```

Если вы опустите `options.timeoutMs`, `host.bridge.request()` использует срок по умолчанию в 10 секунд (`10000` мс). По истечении срока возвращённый промис отклоняется с `Error`, сообщение которого — `` Bridge request <id> timed out after <ms>ms ``. Запрос к каналу, для которого у родителя нет обработчика, отклоняется немедленно с `` No handler registered for channel "<channel>" ``, а не ждёт истечения срока.

---

### `host.layout`

Доступ к API управляемой вёрстки. Доступен только когда задан `hostConfig.layout` (то есть `fe_mode = managed`). Вне этого контекста `host.layout.snapshot` равен `null`, а вызовы изменений ничего не делают.

```typescript
const layout = host.layout

// Чтение текущего снимка
if (layout.snapshot) {
  console.log(layout.snapshot.activeBreakpoint)  // 'default' | 'sm' | ...
  console.log(layout.snapshot.panels)             // карта определений панелей
  console.log(layout.snapshot.layouts)            // деревья панелей по контрольным точкам
}

// Подписка на изменения (свежий снимок передаётся в обработчик)
import { on } from '@wippy-fe/proxy'

on('@layout-change', (snapshot) => {
  console.log(snapshot.activeBreakpoint)
})

// Изменения
layout.resizePanel('right', '40%')
layout.collapsePanel('nav')
layout.expandPanel('nav')
layout.movePanel('right', { relativeTo: 'main', position: 'after' })
layout.removePanel('right')
layout.updatePanel('right', { kind: 'page', id: 'chat-panel' })  // {kind,id} заменяет содержимое целиком
layout.updatePanel('right', { props: { artifactId: 'abc-123' } })  // {props} поверхностно сливается с существующими props

layout.addFloating('flap', {
  kind: 'component',
  tagName: 'w-right-flap',
  position: { x: 0, y: 200 },
  size: { width: 48, height: 80 },
  dismissable: false,
})
layout.removeFloating('flap')
layout.closeModal('confirm-discard')

// Шина внутри вкладки
layout.broadcast('open-chat', { token: 'abc' })       // 1:N (отправитель исключён)
layout.send('right', 'open-chat', { token: 'abc' })   // 1:1 именованной панели

const off = layout.on('open-chat', ({ payload, sourcePanelId, targetPanelId }) => {
  // обработка
})
off()  // отписка
```

Полную модель управляемой вёрстки см. в [Многопанельная вёрстка](../web-host/multi-panel-layout.md).

---

## API

### `api`

Предварительно настроенный экземпляр axios с:
- базовым URL из окружения развёртывания
- автоматической подстановкой `Authorization: Bearer <token>` в каждый запрос

```typescript
import { api } from '@wippy-fe/proxy'

const response = await api.get('/api/v1/users')
const result   = await api.post('/api/v1/items', { name: 'New item' })
```

### Загрузка файлов

```typescript
import { api, on } from '@wippy-fe/proxy'

const formData = new FormData()
formData.append('file', file)

const abort = new AbortController()

const response = await api.post('/api/v1/uploads', formData, {
  signal: abort.signal,
  headers: { 'Content-Type': 'multipart/form-data' },
  onUploadProgress: (evt) => {
    if (!evt.total) return
    const pct = Math.round((evt.loaded * 100) / evt.total)
    uploadProgress.value = pct
  },
})

const uploadedUuid = response.data.uuid  // { success: boolean, uuid: string }

// Отслеживание статуса обработки через WebSocket
on(`upload:${uploadedUuid}`, (msg) => {
  // msg.data.status: 'uploaded' | 'completed' | 'error' | 'processing'
})

// Отмена загрузки в процессе
abort.abort()
```

Максимальный размер файла: 100 МБ.

### Скачивание файлов

```typescript
const response = await api.get('/api/v1/uploads/{uuid}/download', {
  responseType: 'blob',
})

const url = URL.createObjectURL(response.data)
const a = document.createElement('a')
a.href = url
a.download = 'filename.pdf'
a.click()
URL.revokeObjectURL(url)
```

### Получение информации о загрузках

```typescript
// Постраничный список
const list = await api.get('/api/v1/uploads/list', {
  params: { limit: 10, offset: 0 },
})
// list.data.uploads: Array<{ uuid, mime_type, size, status, meta: { filename } }>

// Одна загрузка
const upload = await api.get(`/api/v1/uploads/${uuid}`)
// upload.data: { uuid, mime_type, size, status, meta: { filename, content_sample? } }
```

### Потоковая передача SSE

`api` прокси поддерживает потоки server-sent events через fetch-адаптер. Используйте это для потокенной генерации LLM, длительных потоков прогресса или любого ответа `text/event-stream`.

> Не используйте нативный браузерный `EventSource` — он не может добавлять собственные заголовки и потому не может нести токен `Authorization: Bearer` прокси.

```typescript
import { api } from '@wippy-fe/proxy'

const abort = new AbortController()

const response = await api.post('/api/v1/agents/stream', { prompt: 'Hello' }, {
  adapter: 'fetch',          // обязательно — адаптер xhr по умолчанию буферизует всё тело
  responseType: 'stream',
  headers: { Accept: 'text/event-stream' },
  signal: abort.signal,
})

const reader = (response.data as ReadableStream<Uint8Array>).getReader()
const decoder = new TextDecoder()
let buffer = ''

try {
  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })

    while (true) {
      const sep = buffer.indexOf('\n\n')
      if (sep === -1) break
      const rawEvent = buffer.slice(0, sep)
      buffer = buffer.slice(sep + 2)

      const dataLines = rawEvent
        .split('\n')
        .filter(line => line.startsWith('data:'))
        .map(line => line.slice(5).trimStart())

      if (dataLines.length === 0) continue
      const payload = dataLines.join('\n')
      if (payload === '[DONE]') return

      try {
        const evt = JSON.parse(payload)
        handleEvent(evt)
      } catch {
        handleText(payload)
      }
    }
  }
} finally {
  reader.releaseLock()
}

// Отмена потока
abort.abort()
```

Чтобы по умолчанию направлять все запросы через fetch-адаптер:

```jsonc
// В package.json → wippy.configOverrides или в window.__WIPPY_CONFIG_OVERRIDES__
{
  "axiosDefaults": { "adapter": "fetch" }
}
```

---

## Surface

Геометрия области, которую Web Host выделил этому приложению. Эта область обычно **не** совпадает с окном браузера — приложение может быть одной панелью из нескольких, — поэтому `window.innerWidth` и единицы viewport не подходят для расчёта размеров. Полный контракт см. в [Переносимость surface](./surface-portability.md), а рецепты преобразования — в [Миграция surface](./surface-migration.md).

### `host.surface.snapshot`

Текущая геометрия, читаемая из тех же вычисленных пользовательских свойств, которые разрешает CSS приложения, — поэтому она не может разойтись с тем, что видят `@container wippy-surface (…)` и `cqw`.

```typescript
const { contract, revision, engine, sizing, width, widthUnit, height, heightUnit } = host.surface.snapshot
```

| Поле | Тип | Примечания |
|-------|------|-------|
| `contract` | `1` | версия контракта |
| `revision` | `number` | монотонная; растёт при изменении геометрии |
| `engine` | `'iframe' \| 'fragment' \| 'host'` | `host` означает, что surface не выделен |
| `sizing` | `'container' \| 'content'` | |
| `width` / `widthUnit` | `number` | полная ширина и 1% от неё в CSS-пикселях |
| `height` / `heightUnit` | `number \| null` | `null` при content-размерности — блочная ось действительно недоступна |

### `host.surface.onChange(listener)` → `() => void`

Подписка на изменения геометрии. Возвращает идемпотентную функцию отписки, которую **обязательно** нужно вызвать при разрушении.

```typescript
const off = host.surface.onChange((snapshot) => {
  canvas.width = snapshot.width
})
```

### `host.surface.supports(capability)` → `boolean`

```typescript
if (host.surface.supports('block-size')) {
  // блочная ось доступна (container-размерность)
}
```

Возможности: `block-size` и `surface-scroll` сегодня отвечают правдиво. `registered-hit-testing`, `native-document-hit-testing` и `owner-visibility` — зарезервированный словарь и всегда возвращают `false`.

Предпочитайте `supports()` ветвлению по `engine` — важно, доступна ли возможность, а не какой движок выполняет отрисовку.

### `host.surface.engine` и `host.surface.sizing`

Сокращения только для чтения тех же значений из снимка. `engine: 'host'` означает, что код смонтирован непосредственно в документ хоста (или работает под автономным dev-прокси) без выделенного surface; снимок по замыслу сообщает `width: 0` и `sizing: 'content'`.

`engine` — ненадёжная проверка того, «был ли выделен surface». Страница, встроенная через `<w-iframe>`/`<w-artifact>`, тоже не получает surface — вложенные встраивания отказываются от него, пока не появится поддержка вложенных surface, — и всё же сообщает `engine: 'iframe'` с `width: 0`. Когда это различие важно, проверяйте `snapshot.width`.

---

## События

### `on(topic, handler)` → `() => void`

`on` подписывается на события из слоя WebSocket хоста или на внутренние события прокси. Возвращает функцию отписки.

```typescript
on(topic: string, handler: (event: unknown) => void): () => void
```

Темы состоят из сегментов, разделённых двоеточиями. `*` — подстановочный знак для одного сегмента. Шаблон должен иметь столько же сегментов, сколько тема, которой он соответствует.

```typescript
import { on } from '@wippy-fe/proxy'

// Отписаться по завершении
const unsub = on('session:abc:message:*', (msg) => {
  console.log(msg.data)
})
unsub()
```

Каждый вызов `on()` возвращает функцию отписки. Всегда вызывайте её при размонтировании компонента, чтобы избежать утечек. При выгрузке iframe оставшиеся подписки очищаются автоматически, но для компонентов, монтируемых и размонтируемых внутри долгоживущего iframe, явная очистка всё равно обязательна.

```typescript
// Vue Composition API
import { onUnmounted } from 'vue'

const unsub1 = on('session:*:message:*', handler)
const unsub2 = on('artifact:*', handler)

onUnmounted(() => {
  unsub1()
  unsub2()
})
```

```typescript
// Vanilla / веб-компонент
import { on } from '@wippy-fe/proxy'

class MyEl extends HTMLElement {
  private unsubs: Array<() => void> = []

  connectedCallback() {
    this.unsubs.push(on('session:*:message:*', handler))
  }

  disconnectedCallback() {
    this.unsubs.forEach(fn => fn())
    this.unsubs = []
  }
}
```

### Встроенные темы

| Тема | Полезная нагрузка обработчика | Описание |
|-------|-----------------|-------------|
| `@history` | `{ path: string }` | URL хоста изменился (SPA-навигация). Срабатывает, когда родитель проталкивает новый маршрут. |
| `@visibility` | `boolean` | Изменилась видимость iframe/Web Fragment. Прямые веб-компоненты вместо этого используют типизированный контракт видимости хоста. |
| `@message` | Полное WS-сообщение | Все сообщения WebSocket. Внутренне подписывается на `*`, `*:*`, `*:*:*`, `*:*:*:*`. |
| `@state-error` | `{ error: string, key?: string }` | Операция сохранения состояния не удалась (превышена квота, ошибка сериализации). |
| `@layout-change` | `LayoutSnapshot` | Снимок управляемой вёрстки обновлён; свежий снимок передаётся в обработчик. Эквивалентно чтению `host.layout.snapshot`. |
| `@layout-breakpoint` | `{ name: string, width: number }` | Активная контрольная точка управляемой вёрстки изменилась; `name` — новая точка, `width` — её порог (px). |

### Шаблоны с подстановочными знаками

```typescript
// Только страницы iframe/Web Fragment; прямые веб-компоненты используют useHostVisibility().
on('@visibility', (visible: boolean) => { /* показано или скрыто */ })

// Все сообщения в конкретной сессии
on('session:abc-123:message:*', (msg) => { /* ... */ })

// Все сообщения во всех сессиях
on('@message', (msg) => { /* ... */ })

// Темы, части которых содержат ':', должны быть закодированы
on(`session:${encodeURIComponent('id:with:colons')}:message:*`, handler)
```

`@history` перечислена для полноты протокола. Переносимые Vue-приложения должны позволить `@wippy-fe/router` подписаться на неё; не добавляйте второй обработчик на стороне приложения.

Многократная подписка на одну и ту же тему из одного фрейма безопасна. Прокси выполняет дедупликацию на уровне хоста. Каждый вызов `on()` всё равно получает собственный независимый хэндл отписки.

---

## Состояние

### `state` — межфреймовое хранилище ключ-значение

`state` предоставляет опосредованное хостом хранилище, переживающее уничтожение iframe. Состояние ограничено областью страницы или UUID артефакта; каждое приложение получает изолированное пространство имён.

Все методы принимают необязательный параметр `{ scope?: string }` для переопределения области по умолчанию. Используйте `scope`, когда нескольким экземплярам одного компонента нужны отдельные корзины состояния.

> **Уникальность области:** значения области передаются как есть сырым API `state` и должны быть глобально уникальными в пределах вашего приложения. Плагин `@wippy-fe/pinia-persist` автоматически добавляет к пользовательским областям префикс `@custom:`, чтобы предотвратить коллизии с системными областями.

```typescript
import { state } from '@wippy-fe/proxy'

// Запись (без ожидания результата; при превышении квоты срабатывает @state-error)
await state.set('filters', { search: 'john', status: 'active' })

// Чтение (возвращает null, если ключ не найден)
const filters = await state.get<{ search: string, status: string }>('filters')

// Удаление ключа
await state.remove('filters')

// Очистка всего состояния этой страницы
await state.clear()

// Чтение всего сразу (удобно для массовой гидратации)
const all = await state.getAll()

// Пользовательская область
await state.set('count', 42, { scope: 'my-widget-instance-1' })
const count = await state.get<number>('count', { scope: 'my-widget-instance-1' })
```

**Сигнатуры методов:**

```typescript
state.get<T = unknown>(key: string, options?: { scope?: string }): Promise<T | null>
state.set(key: string, value: unknown, options?: { scope?: string }): Promise<void>
state.remove(key: string, options?: { scope?: string }): Promise<void>
state.clear(options?: { scope?: string }): Promise<void>
state.getAll(options?: { scope?: string }): Promise<Record<string, unknown>>
```

**Рекомендуемый шаблон сохранения для iframe/Web Fragment** — сохранять, когда страница уходит в фон, а не при каждом изменении. Прямые веб-компоненты используют `useHostVisibility()` для того же решения по жизненному циклу:

```typescript
on('@visibility', async (visible) => {
  if (!visible) {
    await state.set('scrollY', document.documentElement.scrollTop)
    await state.set('formData', currentFormData)
  }
})
```

**Ограничения:** 2 МБ на страницу (в JSON-сериализованном виде, настраивается хостом через `hostConfig.stateCache`). Состояние живёт в памяти хоста — переживает перезагрузку iframe, но не полное обновление страницы браузера.

### Интеграция с Pinia

Для Vue-приложений, использующих Pinia, `@wippy-fe/pinia-persist` автоматизирует сохранение:

```typescript
import { createWippyPersist, preloadWippyState } from '@wippy-fe/pinia-persist'

const preloaded = await preloadWippyState()
const pinia = createPinia()
pinia.use(createWippyPersist(preloaded))
app.use(pinia)
```

Затем пометьте хранилища:

```typescript
const useMyStore = defineStore('my-store', () => {
  const filters = ref({ search: '' })
  return { filters }
}, {
  wippyPersist: true,
  // или: wippyPersist: { pick: ['filters'], debounce: 500 }
})
```

---

## WebSocket

### `ws`

`ws` отправляет команды через WebSocket-соединение хоста. Ответы приходят через подписки на темы `on()`.

### `ws.send(command)`

Без ожидания ответа. Ответ не доставляется — сначала подпишитесь на нужную тему.

```typescript
ws.send(command: WsCommand): void
```

```typescript
import { ws, on } from '@wippy-fe/proxy'

on('session:my-session:message:*', (msg) => {
  console.log('Response:', msg.data)
})

ws.send({
  type: 'session_message',
  session_id: 'my-session',
  message_id: crypto.randomUUID(),
  data: { text: 'Hello from child app' },
})
```

### `ws.sendWithResponse(command)` → `Promise<WsMessage>`

Отправляет команду и ждёт соответствующего ответа сервера. Тайм-аут — 30 секунд.

```typescript
ws.sendWithResponse(command: WsCommand): Promise<WsMessage>
```

```typescript
const response = await ws.sendWithResponse({
  type: 'session_open',
  start_token: 'my-token',
})
console.log('Session opened:', response.data)
```

### `ws.sendCommand(sessionId, data)`

Удобная обёртка для команд управления сессией.

```typescript
ws.sendCommand(sessionId: string, data: { command: string, [key: string]: unknown }): void
```

```typescript
ws.sendCommand('session-uuid', { command: 'stop' })
ws.sendCommand('session-uuid', { command: 'model', name: 'gpt-4' })
ws.sendCommand('session-uuid', { command: 'agent', name: 'my-agent' })
```

---

## Логгер

### `logger`

Структурированное логирование, пересекающее границы iframe. Логи идут от потомка к хосту и далее к родительскому сайту, где их обрабатывают транспорты (Sentry, Graylog, консоль). Контекст каждого потомка (`resourceId`, `resourceType`, глубина вложенности) автоматически прикрепляется к каждой записи лога.

Используйте `logger` вместо `console.log/error` для всего, что должно попадать в продакшн-мониторинг.

```typescript
import { logger } from '@wippy-fe/proxy'

logger.debug('Component mounted', { pageId: 'abc' })
logger.info('User loaded page', { pageId: 'abc' })
logger.warn('Slow API response', { ms: 3200 })
logger.error('Failed to save', { endpoint: '/api/save' })
```

### `logger.captureException(error, context?)`

Перехватывает и пересылает исключение. Необработанные ошибки (`window.onerror`, `unhandledrejection`) перехватываются автоматически, когда `ProxyConfig.injections.errorCapture` равен `true`.

```typescript
try {
  await riskyOperation()
} catch (error) {
  logger.captureException(error, { operation: 'riskyOperation' })
}
```

### Хлебные крошки и контекст

```typescript
// Хлебные крошки прикрепляются к следующему исключению как отладочный контекст
logger.addBreadcrumb({ category: 'navigation', message: 'Navigated to /settings' })
logger.addBreadcrumb({ category: 'ui', message: 'Clicked Save button' })

// Постоянный контекст — прикрепляется ко всем последующим логам этого потомка
logger.setContext('user', { id: 'user-123', role: 'admin' })

// Теги — пары ключ/значение для фильтрации и поиска
logger.setTag('version', '1.2.0')
logger.setTag('feature', 'dashboard')
```

---

## Веб-компоненты

### `loadByTagName(tagName, options?)` → `Promise<void>`

Загружает и регистрирует соседний веб-компонент по имени его HTML-тега. Разрешается после срабатывания `customElements.define` — сразу после этого безопасно вызывать `document.createElement(tagName)`. При успехе тег автоматически добавляется в список разрешённых `sanitize`.

```typescript
import { loadByTagName } from '@wippy-fe/proxy'

await loadByTagName('wc-thread-picker')
await loadByTagName('wc-slow-pkg', { timeoutMs: 60_000 })

// Можно использовать сразу
document.body.appendChild(document.createElement('wc-thread-picker'))
```

`options.timeoutMs` переопределяет 30-секундный срок ожидания `customElements.define` по умолчанию после добавления скрипта. Выявляет зависшие или сломанные компоненты (404, ошибка разбора, отсутствие вызова `define`) как отклонение промиса, а не бесконечное ожидание.

### `loadWebComponent(componentId, tagName?)` → `Promise<void>`

Загружает веб-компонент по идентификатору артефакта в реестре Wippy, а не по имени тега. Полезно, когда идентификатор реестра приходит из значения конфигурации или ответа бэкенда.

```typescript
import { loadWebComponent } from '@wippy-fe/proxy'

await loadWebComponent('wippy.components:my-chart')
```

### Загрузчик по сканированию DOM (`<script type="wippy-components-loader">`)

Для страниц, которым нужно несколько компонентов, прокси при инициализации сканирует такие теги скриптов и загружает каждую запись через `loadWebComponent`:

```html
<script type="wippy-components-loader">
{ "wc-foo": "wippy.components:foo", "wc-bar": "wippy.components:bar" }
</script>
```

Поведение дедупликации и автоматического обновления списка разрешённых тегов то же, что у `loadByTagName`.

---

## Утилиты

### `sanitize(html, options?)` → `string`

Санитайзер HTML со списком разрешённого по умолчанию, ограниченный текущим контекстом прокси. Совмещает умолчания отрисовки чата (`<p>`, `<a>`, `<code>`, `<table>` и т. д.) со всеми тегами веб-компонентов, зарегистрированными в данный момент в этой среде выполнения.

```typescript
import { sanitize, loadByTagName } from '@wippy-fe/proxy'

const safe = sanitize('<p>hi</p><script>alert(1)</script>')
// → '<p>hi</p>'

// После loadByTagName тег разрешается автоматически:
await loadByTagName('wc-thread-picker')
sanitize('<wc-thread-picker thread-id="42"></wc-thread-picker>')
// → '<wc-thread-picker thread-id="42"></wc-thread-picker>'

// Разовые дополнительные теги
sanitize(dialogBody, { extraTags: { 'iconify-icon': ['icon'] } })
```

`sanitize` перечитывает список разрешённых тегов при каждом вызове, поэтому теги, зарегистрированные после импорта, тоже подхватываются.

### `html.inject(sourceHtml, options)` → `Promise<string>`

Применяет преобразование исходного HTML в srcdoc без монтирования элемента. Для обычного использования предпочтительнее `<w-iframe>`; применяйте это только при построении собственной инфраструктуры размещения.

```typescript
import { html } from '@wippy-fe/proxy'

const processed = await html.inject(sourceHtml, {
  baseUrl: 'https://example.com/app/',
  resourceId: 'child-id',
  resourceType: 'page',
  route: '/initial',
})
```

---

## Переопределения конфигурации

Страницы могут переопределять отдельные поля конфигурации, обращённые к дочернему контексту, без отдельного развёртывания. Форма переопределения по-прежнему использует `customization` ради совместимости, а хост проецирует эти значения в текущий результат `theming.global` дочернего контекста до того, как страница получит конфигурацию `wippy-context-2.0`.

### Задание переопределений

**Страницы реестра (рекомендуется):** задайте `meta.config_overrides` в `_index.yaml` страницы. Хост включает их в ответ content API и вставляет автоматически.

**Автономные пакеты:** задайте `wippy.configOverrides` в `package.json` страницы.

**Вручную / для тестов:** задайте `window.__WIPPY_CONFIG_OVERRIDES__` в теге `<script>`, выполняющемся до `proxy.js`.

```typescript
window.__WIPPY_CONFIG_OVERRIDES__ = {
  customization: {
    cssVariables: {
      '--p-primary': '#ff6b00',
    },
    customCSS: '.my-page-header { border-radius: 12px; }',
  },
}
```

### Правила слияния

| Поле | Поведение при слиянии |
|-------|---------------|
| `cssVariables` | **Заменяет** значения хоста — страница задаёт собственную тему |
| `customCSS` | **Заменяет** значение хоста |
| `iconSets` | **Сливается** дополняюще |
| `axiosDefaults` | **Глубокое слияние** |
| `routePrefix` | **Заменяется** |
| `apiRoutes` | **Глубокое слияние** |

Каждый вложенный потомок, встраиваемый страницей — `<w-iframe>`, `<w-artifact>` и содержимое `html.inject`, — строится из уже слитой конфигурации страницы и наследует её автоматически, рекурсивно вниз по поддереву. Поэтому переопределения страницы (особенно оформление) распространяются на всё, что под ней, а не только на саму страницу.

---

## Утилиты Vue

### `installVueWarnSuppressor(app)`

Доступна в текущем согласованном семействе `@wippy-fe/proxy`. Заглушает `[Vue warn]: Failed to resolve component: foo-bar` для тегов, зарегистрированных через `customElements.define(...)`, а не через `app.component(...)`. Компилятор шаблонов Vue выдаёт эти предупреждения для незнакомых ему тегов веб-компонентов — элементы отображаются корректно, но консоль заполняется шумом.

```typescript
import { installVueWarnSuppressor } from '@wippy-fe/proxy'
import { createApp } from 'vue'
import App from './App.vue'

const app = createApp(App)
installVueWarnSuppressor(app)
app.use(router)
app.mount('#app')
```

Что он подавляет:

- Теги, уже зарегистрированные через `customElements.define(...)` — системные теги (`w-iframe`, `w-artifact`, `wippy-loading`, `wippy-error`) и каждый тег, зарегистрированный конвейером автозагрузки (`loadByTagName`, сканер).
- Теги, соответствующие форме имени пользовательского элемента (`^[a-z][a-z0-9]*-[a-z0-9-]*$`), но ещё не зарегистрированные — это покрывает окно гонки, когда Vue отрисовывает до того, как подгрузился скрипт автозагрузки.

О чём он по-прежнему предупреждает:

- **Опечатки в PascalCase-компонентах** (`<UsreCard />`). Подавитель не сопоставляет их с kebab-шаблоном, а `customElements.get` возвращает `undefined`, поэтому они проходят в консоль, сохраняя сигнал, который отличает настоящие ошибки от шума.

Функция идемпотентна: повторный вызов на том же `app` действительно ничего не делает. На `app.config` устанавливается маркер `Symbol.for('@wippy-fe/proxy/vue-warn-suppressor-installed')`; маркер экспортируется как `VUE_WARN_SUPPRESSOR_INSTALLED_MARKER` для тестовых окружений, которым нужно сбрасывать его между перезагрузками.

Если `warnHandler` уже был установлен, он сохраняется как `previous` и вызывается для предупреждений, которые подавитель не заглушает.

### `createAppRouter(routes, options?)` из `@wippy-fe/router`

Канонический фабричный метод memory-роутера для srcdoc-подприложений. Заменяет шаблонный код, который сейчас дублирует каждое подприложение (memory history, синхронизация маршрута с хостом через `afterEach`, подписка на `@history`):

```typescript
import { createAppRouter } from '@wippy-fe/router'
import { config } from '@wippy-fe/proxy'
import { routes } from './routes'

const router = createAppRouter(routes, {
  initialPath: config.context?.route,
})
app.use(router)
```

---

## Компоненты загрузки и ошибок

Два веб-компонента автоматически регистрируются через `loading.js` (вставляется до `proxy.js`). Импорты и ручная регистрация не нужны.

### `<wippy-loading>`

Полноэкранный индикатор загрузки с цветами, учитывающими тему.

| Атрибут | Описание |
|-----------|-------------|
| `title` | Основной текст (например, "Loading...") |
| `subtitle` | Второстепенный текст |
| `no-bg` | Boolean — прозрачный фон для использования как оверлей |

```html
<wippy-loading title="Loading..." subtitle="Please wait"></wippy-loading>
<wippy-loading no-bg title="Loading page content..."></wippy-loading>
```

### `<wippy-error>`

Полноэкранное отображение ошибки с окраской по уровню серьёзности.

| Атрибут | Значения | По умолчанию |
|-----------|--------|---------|
| `title` | Любая строка | "Something went wrong" |
| `message` | Любая строка | (пусто) |
| `icon` | `circle`, `triangle`, `sad` | `circle` |
| `severity` | `danger`, `warning` | `danger` |
| `no-bg` | Boolean | (отсутствует) |

```html
<wippy-error title="Failed to load" message="Server returned 500" severity="danger"></wippy-error>
<wippy-error title="Connection Lost" message="Retrying..." icon="triangle" severity="warning"></wippy-error>
```

Оба компонента используют Shadow DOM с CSS-переменными из `@wippy-fe/theme` и содержат зашитые запасные значения для контекстов без темы.

**Рекомендуемый шаблон для обычных HTML-страниц:**

```html
<body>
  <wippy-loading id="loader" title="Loading..."></wippy-loading>
  <div id="content" style="display:none"><!-- содержимое --></div>

  <script type="module">
    import { api, host } from '@wippy-fe/proxy'

    async function init() {
      try {
        // получить данные, подготовить страницу...
        document.getElementById('loader').remove()
        document.getElementById('content').style.display = 'block'
      } catch (error) {
        const errorEl = document.createElement('wippy-error')
        errorEl.setAttribute('title', 'Initialization failed')
        errorEl.setAttribute('message', error.message)
        document.getElementById('loader').replaceWith(errorEl)
      }
    }
    init()
  </script>
</body>
```

**Vue 3 — точка входа `app.html`:**
```html
<div id="app">
  <wippy-loading title="Loading..."></wippy-loading>
</div>
<script type="module" src="./src/app.ts"></script>
```

Когда Vue монтируется в `#app`, он автоматически заменяет элемент `<wippy-loading>`.
