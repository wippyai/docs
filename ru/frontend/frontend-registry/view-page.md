---
title: "Микрофронтенд-приложения (view.page)"
description: "Запись view.page описывает полноценное одностраничное приложение, которое Web Host загружает внутри iframe. Каждая запись страницы занимает путь URL в роутере хоста…"
---

# Микрофронтенд-приложения (view.page)

Запись `view.page` описывает полноценное одностраничное приложение, которое Web Host загружает внутри iframe. Каждая запись страницы занимает путь URL в роутере хоста, получает собственный изолированный контекст просмотра и принимает от хоста через слой прокси вставляемые CSS и конфигурацию.

## Поля фронтенда (блок wippy в package.json)

Эти поля пишет фронтенд-разработчик в блоке `wippy` файла `package.json`. Vite-плагин запекает их в `wippy-meta.json` во время сборки, а `wippy/views` читает их оттуда как значения по умолчанию.

> **Все поля этого раздела оператор может переопределить в `_index.yaml`. YAML всегда имеет приоритет.**

### Отображение и навигация

| Поле | Тип | По умолчанию | Описание |
|---|---|---|---|
| `title` | string | — | Подпись в боковой панели навигации и во вкладке браузера |
| `icon` | string | — | Ссылка на иконку Iconify, например `tabler:layout-dashboard` |
| `type` | string | — | Должно быть `"page"` |
| `path` | string | — | Путь к собранному входному HTML-файлу внутри выходной директории бандла |

### Движок рендеринга

`renderEngine` выбирает [движок рендеринга страницы](../web-host/render-engines.md) для этой страницы (только для `view.page`). Движок прозрачен для кода приложения — одна и та же страница отображается одинаково в обоих случаях, — поэтому задавайте его только чтобы исключить страницу из fragment-движка или, наоборот, включить в него.

| Значение | Эффект |
|-------|--------|
| `"auto"` _(по умолчанию либо при отсутствии)_ | Следовать глобальному переключателю развёртывания (`hostConfig.renderEngine`, задаётся параметром фасада [`render_engine`](../../framework/facade.md#render-engine)). |
| `"iframe"` | Всегда рендерить как srcdoc-iframe, независимо от переключателя. Используйте для страниц с технологиями, несовместимыми с reframed: hit-тестирование указателя (`elementFromPoint`), вёрстка на единицах viewport (`vh`/`vw`, `matchMedia`), `position: fixed`. |
| `"fragment"` | Предпочитать движок [Web Fragment](../web-host/render-engines.md). При глобальном развёртывании `fragment`: всегда. При глобальном развёртывании `iframe`: только если рантайм-проба возможностей подтвердит наличие [шлюза `/@fragment`](../../framework/views.md#web-fragments-gateway) и прокси (иначе безопасный откат к iframe). |

```json
{
  "wippy": {
    "type": "page",
    "renderEngine": "auto"
  }
}
```

Полную модель движков и ограничения fragment см. в [Движки рендеринга](../web-host/render-engines.md).

### Настройка прокси

У инъекции прокси две поверхности. Фронтенд-разработчик пишет значения по
умолчанию в блоке `wippy` фронтенд-файла `package.json` ключами в нижнем
camelCase (`themeConfig`, `primevue`, `customCss`); Vite-плагин запекает их в
`wippy-meta.json`. Оператор переопределяет их блоком `proxy:` под `meta:` в
YAML реестра. Поля реестра следуют своей документированной схеме, а не
универсальному правилу регистра. Вложенные ключи прокси сохраняют свои
определённые имена в нижнем camelCase, и хост выполняет глубокое слияние этого
YAML поверх запечённых фронтенд-умолчаний без преобразования ключей.

```json
{
  "wippy": {
    "type": "page",
    "proxy": {
      "enabled": true,
      "injections": {
        "css": {
          "themeConfig": true,
          "iframe": true,
          "primevue": true,
          "markdown": false,
          "customCss": true,
          "customVariables": true
        },
        "tailwindConfig": false,
        "resizeObserver": false,
        "preventLinkClicks": false,
        "iconifyIcons": false,
        "errorCapture": true
      }
    }
  }
}
```

`proxy.enabled: true` означает, что Web Host оборачивает страницу в свою прокси-обвязку iframe, которая записывает `window.__WIPPY_APP_CONFIG__` и связанные глобальные переменные до вычисления бандла страницы.

Если `proxy.injections` опущен, прокси iframe использует разрешительные рантайм-умолчания и включает большинство инъекций. Список ниже показывает **рекомендуемые явные значения для типичного микрофронтенд-приложения на Vite**, а не рантайм-умолчания, чтобы рецензенты пакета видели намерение страницы.

#### Рекомендуемые явные значения инъекций

Это флаги, которые обычно объявляет микрофронтенд-приложение, и значение, которое стоит задать для типичного SPA на Vite. Это не рантайм-умолчания.

- `css.themeConfig` (`true`) — пользовательские CSS-свойства активной темы
- `css.iframe` (`true`) — обязательное стилевое оформление полос прокрутки по теме; `iframe` — историческое имя, и текущая таблица стилей не содержит сбросов вёрстки
- `css.primevue` (`true`) — базовые стили компонентов PrimeVue
- `css.markdown` (`false`) — стили рендеринга markdown
- `css.customCss` (`true`) — пользовательский CSS, проецируемый в дочерний контекст
- `css.customVariables` (`true`) — переопределения CSS-переменных, проецируемые в дочерний контекст
- `tailwindConfig` (`false`) — объект конфигурации Tailwind хоста (только Tailwind через CDN)
- `resizeObserver` (`false` для полноценных SPA) — передача размеров body дочернего документа хосту
- `preventLinkClicks` (`false` для страниц) — направлять клики по `<a>` через `classifyLink`
- `iconifyIcons` (`false`) — предзагрузка коллекций Iconify хоста
- `errorCapture` (`true`) — пересылка неперехваченных ошибок iframe хосту

Большинство полноценных SPA-страниц ставят `resizeObserver: false` и `preventLinkClicks: false`, поскольку сами управляют своей вёрсткой и маршрутизацией. Приложение `main` в шаблоне ставит `errorCapture: true`, чтобы неперехваченные ошибки были видны во время разработки.

Отдельного флага инъекции веб-шрифтов нет. Google Fonts доставляются через `theming.global.customCSS` (директива `@import` в пользовательском CSS темы) и вставляются существующим флагом `css.customCss`.

Полный справочник флагов и рантайм-умолчаний: [Инъекция CSS](../web-host/css-injection.md).

## Конфигурация оператора (_index.yaml)

Эти поля задаёт оператор в блоке `meta` записи реестра `_index.yaml`. Большинство из них — `announced`, `secure`, `url`, `base_path`, `mountRoute`, `auto_register`, `inline` — представляют политику развёртывания (маршрутизацию, контроль доступа и раздачу), которая имеет смысл только на этапе развёртывания и не имеет поверхности описания в `package.json`. Единственное исключение — `entry_point`: он **задаётся фронтендом** (vite-плагин требует `wippy.path` в `package.json` и запекает его в `wippy-meta.json`), а поле `meta.entry_point` — лишь **необязательное переопределение этого запечённого значения для конкретного развёртывания**.

> **Обязательная форма YAML:** запись страницы — это `kind: registry.entry` с `meta.type: view.page`. Не пишите `kind: view.page`.

```yaml
- name: main
  kind: registry.entry
  meta:
    type: view.page
    name: main
```

> **Поля политики развёртывания (`announced`, `secure`, `url`, `base_path`, `mountRoute`, `auto_register`, `inline`) нельзя задать в `package.json` — их задаёт оператор для каждой среды. С `entry_point` иначе: он пишется как `wippy.path` в `package.json`, а значение в YAML лишь переопределяет это умолчание.**

### URL и раздача файлов

| Поле | Тип | По умолчанию | Описание |
|---|---|---|---|
| `url` | string | — | Базовый префикс URL, по которому смонтирован бандл (origin CDN или локальный путь `http.static`). Только YAML — поверхности в `package.json` нет |
| `base_path` | string | — | Поддиректория внутри статического монтирования. Только YAML — поверхности в `package.json` нет |
| `entry_point` | string | `index.html` | HTML-файл для загрузки; комбинируется с `url` и `base_path`. Задаётся фронтендом как `wippy.path` в `package.json` (запекается в `wippy-meta.json`); значение в YAML — необязательное переопределение для конкретного развёртывания |

Итоговый URL входа — `<url>/<base_path>/<entry_point>`. Оператор разворачивает один и тот же бандл под несколькими записями, направляя разные записи `_index.yaml` на один `base_path` с разными значениями `entry_point` или `config_overrides`.

В отличие от `url` и `base_path`, `entry_point` — не поле, существующее только на этапе развёртывания. Его пишет фронтенд-разработчик как `wippy.path` в блоке `wippy` файла `package.json`, а vite-плагин запекает его в `wippy-meta.json` — плагин **требует** его и выбрасывает `wippy.path is required for a page package`, если он опущен. Поле `meta.entry_point` в `_index.yaml` лишь переопределяет это запечённое значение для конкретного развёртывания; порядок разрешения: `entry_point` из YAML → `wippy.path` из бандла → `index.html`.

### Видимость и доступ

| Поле | Тип | По умолчанию | Описание |
|---|---|---|---|
| `announced` | boolean | — | `true` → страница появляется в `GET /api/public/pages/list` и в боковой панели навигации |
| `secure` | boolean | `false` | `true` → требуется аутентификация; неаутентифицированные запросы получают 401 |
| `inline` | boolean | `false` | `true` → страница скрыта из всех списков (боковая панель, API); используйте для встроенных просмотрщиков артефактов или вспомогательных маршрутов |

`announced: false` скрывает страницу из навигации, но не препятствует её загрузке. Iframe или прямой URL по-прежнему работают. `inline: true` строже — он убирает страницу из всех публичных списков.

### Маршрут монтирования

| Поле | Тип | По умолчанию | Описание |
|---|---|---|---|
| `mountRoute` | string | — | Занимает путь URL в роутере хоста; хост отображает эту страницу, когда браузер переходит по совпадающему пути |

> **Временное совместимое написание:** `meta.mountRoute` — текущая ошибка
> регистра на бэкенде. Предполагаемое поле бэкенда — `meta.mount_route`, и
> ожидается, что будущий релиз бэкенда его изменит. Используйте
> `meta.mountRoute`, пока это изменение бэкенда не выйдет; при обновлении
> перепроверяйте целевую версию Wippy.

`mountRoute` принимает только catch-all-форму v1 — `/:part(.*)*` (корень) или `/<literal-prefix>/:part(.*)*`, где префикс — один или несколько сегментов из строчных букв, цифр и дефисов, оканчивающихся обязательным подстановочным знаком `:part(.*)*`. Произвольные шаблоны Vue Router — именованные параметры, собственные регулярные выражения или другое имя параметра (например, `/home/:id`, `/users/:userId(\d+)`) — отклоняются: хост поднимает конфликт маршрута монтирования вида `syntax`, а `GET /api/public/pages/routes` возвращает HTTP 500, что отображается как фатальная полноэкранная ошибка. Подстановочный знак `:part(.*)*` позволяет дочернему приложению управлять собственными подмаршрутами, пока хост сохраняет владение путём верхнего уровня.

```yaml
mountRoute: /home/:part(.*)*
```

При запуске Web Host запрашивает `GET /api/public/pages/routes` и вызывает `router.addRoute()` для каждой записи, у которой есть `mountRoute`. Полный механизм синхронизации см. в [Динамическая маршрутизация](./dynamic-routing.md).

### Переопределения конфигурации на уровне страницы

| Поле | Тип | Описание |
|---|---|---|
| `config_overrides` | object | Глубоко сливается поверх значений AppConfig, которые Web Host вставляет в iframe |

`config_overrides` — имя обёртки со стороны реестра. Вложенный объект уже
использует ключи фронтенд-схемы в нижнем camelCase, такие как
`customization.customCSS` и `customization.cssVariables`. Web Host глубоко
сливает именно эти ключи поверх `wippy.configOverrides` из бандла в
`wippy-meta.json`; значение из YAML побеждает по каждому вложенному ключу.

`config_overrides` меняет вставляемый в страницу AppConfig. Он **не** меняет флаги инъекции прокси. В частности, `config_overrides` никогда не влияет на `proxy.injections`, `wippy.proxy.injections` или рантайм-умолчания инъекции CSS/скриптов. Чтобы переопределить флаги инъекции прокси для развёртывания, используйте `meta.proxy`, как описано в разделе [Переопределение прокси оператором](#operator-proxy-override-_indexyaml).

Типичный сценарий — запуск одного и того же бандла с собственной цветовой палитрой:

```yaml
- name: iframe-demo-themed
  kind: registry.entry
  meta:
    type: view.page
    name: iframe-demo-themed
    title: Iframe Demo (Custom Palette)
    icon: tabler:paint
    order: 4
    announced: false
    secure: false
    url: /app
    base_path: app/iframe-demo
    entry_point: app.html
    mountRoute: /demo-themed/:part(.*)*
    config_overrides:
      customization:
        cssVariables:
          "--p-primary": "#7c9ed9"
          "--p-primary-color": "#7c9ed9"
          "--p-danger": "#e8a0a0"
        customCSS: |
          /* Значения палитры здесь — намеренное определение темы страницы, а не CSS модуля. */
          :root { font-family: var(--wippy-brand-font, sans-serif); }
```

Обратите внимание, что `announced: false` допустимо для записей `view.page` — страница достижима через свой `mountRoute`, но не появляется в боковой панели.

### Переопределение прокси оператором (_index.yaml)

Умолчания инъекции прокси, запечённые в `wippy-meta.json` (из блока `wippy`
файла `package.json`), можно переопределить для каждого развёртывания блоком
`proxy:`, размещённым **под `meta:`** в записи реестра. Имена требований
фасада используют свои документированные имена в snake_case. Поля реестра
сейчас содержат одну временную ошибку регистра на бэкенде: обёртка называется
`config_overrides`, тогда как поле маршрута по-прежнему читается как
`mountRoute`, пока его не исправят на `mount_route`. Вложенные объекты
прокси/конфигурации передаются как есть и сохраняют свои определённые ключи в
нижнем camelCase. Хост глубоко сливает `meta.proxy` поверх `wippy.proxy` из
бандла.

Короткий ответ: используйте `meta.proxy`, а не `data.proxy`; держите поля
бэкенда верхнего уровня, такие как `config_overrides`, в snake_case, но
сохраняйте вложенные ключи прокси/конфигурации, такие как `themeConfig` и
`customCss`; сохраняйте обёртку `injections`.
Не выдумывайте `meta.config` или `meta.configOverrides`; точная обёртка
переопределений на уровне страницы — `meta.config_overrides`.

Различайте два фронтенд-написания:

- Бэкендовый `meta.proxy.injections.css.customCss` остаётся
  `wippy.proxy.injections.css.customCss`.
- Бэкендовый `meta.config_overrides.customization.customCSS` проецируется во
  фронтендовый `wippy.configOverrides.customization.customCSS` и в рантайм
  `config.theming.global.customCSS`.
- Не выдумывайте обёртку `appConfig` ни для одной из фронтенд-форм.

```yaml
- name: dashboard
  kind: registry.entry
  meta:
    type: view.page
    name: dashboard
    url: /app
    base_path: app/dashboard
    entry_point: app.html
    proxy:
      enabled: true
      injections:
        css:
          themeConfig: true
          iframe: true
          primevue: true
          customCss: true
          customVariables: true
        tailwindConfig: false
        iconifyIcons: false
```

Переопределяются только те ключи, которые вы задали; всё остальное сохраняет значение, запечённое в `wippy-meta.json`. Полный справочник флагов и рантайм-умолчаний: [Инъекция CSS](../web-host/css-injection.md).
