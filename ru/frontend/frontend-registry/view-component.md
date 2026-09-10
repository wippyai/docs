---
title: "Веб-компоненты (view.component)"
description: "Запись view.component описывает переиспользуемый пользовательский элемент (веб-компонент), который Web Host может обнаружить, внедрить и зарегистрировать автоматически. В отличие от…"
---

# Веб-компоненты (view.component)

Запись `view.component` описывает переиспользуемый пользовательский элемент (веб-компонент), который Web Host может обнаружить, внедрить и зарегистрировать автоматически. В отличие от страницы, у компонента нет собственного iframe — это пользовательский HTML-тег, который может появиться везде, где его размещает шаблон страницы или хоста.

Рекомендации по написанию реализации компонента см. в разделе [Веб-компонент](../micro-frontends/web-component.md).

## Поля фронтенда (блок wippy в package.json)

Эти поля пишет FE-разработчик в блоке `wippy` файла `package.json`. Плагин vite запекает их в `wippy-meta.json` на этапе сборки, а `wippy/views` читает их оттуда как значения по умолчанию.

> **Все поля этого раздела могут быть переопределены оператором в `_index.yaml`. YAML всегда имеет приоритет.**

| Поле | Тип | По умолчанию | Описание |
|---|---|---|---|
| `type` | string | — | Должно быть `"component"` или `"widget"`; `"widget"` — соглашение шаблона |
| `tagName` | string | — | Имя пользовательского элемента; по спецификации HTML должно содержать дефис |
| `props` | object | — | JSON Schema, описывающая принимаемые компонентом атрибуты |
| `events` | object | — | JSON Schema, описывающая пользовательские DOM-события, которые компонент испускает |

### `wippy.type` в `package.json`

Пакеты веб-компонентов устанавливают `"type": "widget"` или `"type": "component"` (не `"page"`) внутри своего блока `wippy`. app-template в настоящее время использует `"widget"`, а плагин vite принимает оба имени компонента для этого контракта среды исполнения.

```json
{
  "specification": "wippy-component-1.0",
  "wippy": {
    "tagName": "example-reaction-bar",
    "type": "widget",
    "props": { ... },
    "events": { ... }
  }
}
```

На этапе развёртывания YAML-поле оператора `meta.tag_name` авторитетно и переопределяет значение из бандла; `wippy.tagName` (запечённое в `wippy-meta.json` из `package.json`) — лишь запасной вариант, который `wippy/views` использует, когда YAML-запись опускает `tag_name` (порядок разрешения: YAML `meta.tag_name` → `wippy.tagName` из бандла). Держите эти два значения синхронными во избежание сюрпризов, но при расхождении побеждает YAML.

### Схема props

Ключ `wippy.props` в `package.json` — объект JSON Schema, описывающий принимаемые компонентом атрибуты. Плагин vite включает его в `wippy-meta.json`, и Web Host использует его при предоставлении метаданных компонента таким потребителям, как рендерер артефактов чата и санитайзер тегов (которому нужно знать, какие атрибуты легитимны, чтобы не вырезать их).

```json
{
  "wippy": {
    "props": {
      "type": "object",
      "properties": {
        "reactions": {
          "type": "array",
          "items": { "type": "string" },
          "default": ["👍", "👎", "❤️", "🎉", "🤔"],
          "description": "Array of emoji reactions to display"
        },
        "allow-multiple": {
          "type": "boolean",
          "default": false,
          "description": "Whether multiple reactions can be active simultaneously"
        }
      }
    }
  }
}
```

Имена атрибутов в `properties` следуют соглашению HTML-атрибутов (kebab-case). Значения `default` из схемы также применяются во время выполнения парсером props веб-компонента, когда атрибут отсутствует.

### Схема events

Ключ `wippy.events` повторяет форму props, но описывает пользовательские DOM-события, которые компонент испускает через `useEvents()`. Каждый ключ — имя события; значение — JSON Schema для полезной нагрузки `detail` события.

```json
{
  "wippy": {
    "events": {
      "type": "object",
      "properties": {
        "reaction": {
          "type": "object",
          "properties": {
            "emoji": { "type": "string" },
            "count": { "type": "number" },
            "active": { "type": "boolean" }
          },
          "description": "Fired when a reaction is toggled"
        }
      }
    }
  }
}
```

Санитайзер сообщений чата в Web Host добавляет в список разрешённых атрибуты компонента из `props.properties` в `wippy-meta.json`. Схемы событий документируют испускаемые пользовательские события для инструментов и потребителей; они не используются для пропуска атрибутов-обработчиков DOM-событий через санитизированное содержимое чата.

## Конфигурация оператора (_index.yaml)

Эти поля задаёт оператор в блоке `meta` записи реестра `_index.yaml`. Большинство из них представляют чистую политику развёртывания — маршрутизацию, контроль доступа и раздачу, — которая имеет смысл только на этапе развёртывания и не имеет поверхности для описания в `package.json` (`announced`, `secure`, `url`, `auto_register`). Два поля, `tag_name` и `entry_point`, отличаются: они **пишутся на стороне FE** в `package.json` (запекаются в `wippy-meta.json`), а YAML-ключи — лишь **необязательные переопределения на конкретное развёртывание** этих значений из бандла.

> **`announced`, `secure`, `url` и `auto_register` — чистая политика развёртывания, их нельзя задать в package.json: их устанавливает оператор для каждого окружения. `tag_name` и `entry_point` — значения по умолчанию, задаваемые FE, которые оператор может переопределить в YAML.**

| Поле | Тип | По умолчанию | Описание |
|---|---|---|---|
| `tag_name` | string | `wippy.tagName` | Задаётся FE как `wippy.tagName` в `package.json` (обязательно для плагина vite); YAML-ключ переопределяет значение из бандла. Имя пользовательского элемента; по спецификации HTML должно содержать дефис |
| `announced` | boolean | `false` | Должно быть `true`, чтобы компонент появился в `/api/public/components/list`. Откатывается к `meta.public`, если оно задано. |
| `auto_register` | boolean | `false` | `true` → Web Host автоматически загружает и регистрирует компонент при запуске |
| `secure` | boolean | `false` | Требует аутентификации |
| `url` | string | — | Статический путь монтирования для собранного бандла компонента |
| `base_path` | string | `""` | Необязательный подпуть, добавляемый к `url` для формирования корня проекта; итоговый URL бандла складывается как `<url>/<base_path>/<entry_point>`. Обрабатывается так же, как для страниц, хотя текущие записи компонентов в app-template его опускают |
| `entry_point` | string | `wippy.browser` → `index.js` | Задаётся FE как поле верхнего уровня `browser` в `package.json` (запекается в `wippy-meta.json`); YAML-ключ переопределяет значение из бандла, откатываясь к `index.js`. Файл входного модуля; хост внедряет его как `<script type="module">` |

Минимальная запись выглядит так:

```yaml
- name: reaction-bar
  kind: registry.entry
  meta:
    type: view.component
    name: reaction-bar
    tag_name: example-reaction-bar
    announced: true
    secure: false
    auto_register: true
    url: /app/wc/reaction-bar
    entry_point: index.js
```

## Три условия автозагрузки

Чтобы Web Host автоматически загрузил компонент, все три условия должны выполняться одновременно:

1. **`announced: true`** — `wippy/views` фильтрует по этому флагу на стороне сервера в `list_components.lua`. Параметра запроса для обхода нет. Компонент с `announced: false` никогда не появится в `/api/public/components/list` независимо от любых других настроек.

2. **`auto_register: true`** — функция хоста `loadGlobalAutoloadWidgets` запрашивает конечную точку списка с `?auto_register=true`. Компоненты без этого флага исключаются из отфильтрованного ответа.

3. **Тег ещё не зарегистрирован** — перед внедрением скрипта хост проверяет `customElements.get(tagName)`. Если тег уже определён (например, после предыдущего перехода), хост пропускает внедрение, чтобы избежать повторного определения.

Если какое-либо из условий не выполнено, компонент молча отсутствует. Для проверки: `curl /api/public/components/list?auto_register=true` — ваш тег должен появиться в ответе.

## Последовательность автозагрузки

Когда страница внутри Web Host заканчивает монтирование, хост выполняет следующую последовательность:

1. `GET /api/public/components/list?auto_register=true` — получает все объявленные, автоматически регистрируемые компоненты.

2. Для каждого компонента, у которого `customElements.get(tagName)` равно `undefined`, хост добавляет в `document.head`:

   ```html
   <script type="module" src="/app/wc/reaction-bar/index.js?declare-tag=example-reaction-bar"></script>
   ```

   Параметр запроса `?declare-tag=` — канал, сообщающий входному чанку, под каким именем пользовательского элемента регистрироваться.

3. Входной чанк вызывает `define(import.meta.url, ElementClass)`. Авторы компонентов импортируют `define` из `@wippy-fe/webcomponent-vue` (или `@wippy-fe/webcomponent-core`), которые реэкспортируют `define` из прокси; во время выполнения import map разрешает его в единственный экземпляр `@wippy-fe/proxy`. Хелпер `define` читает `new URL(import.meta.url).searchParams.get('declare-tag')` и вызывает `customElements.define(tagName, ElementClass)`.

4. Vue (или любой другой фреймворк) отрисовывает элемент `<example-reaction-bar>`. Браузер апгрейдит элемент, срабатывает `connectedCallback`, и `WippyVueElement` монтирует своё Vue-приложение внутри shadow root.

## Зачем нужен `auto_register: false`

Установка `auto_register: false` исключает компонент из глобального прохода автозагрузки. Это уместно, когда:

- Компонент велик и должен загружаться только на страницах, которым он явно нужен.
- Компонент регистрируется программно через `loadByTagName('example-heavy-chart')` (импортируется из `@wippy-fe/proxy`) в месте вызова.
- Компонент — внутренний строительный блок, используемый только внутри другого бандла, а не как самостоятельный пользовательский элемент.

```ts
import { loadByTagName } from '@wippy-fe/proxy'

await loadByTagName('example-heavy-chart')
```

Ленивая регистрация позволяет первоначальной загрузке страницы оставаться лёгкой. Компоненту всё же нужен `announced: true`, чтобы `loadByTagName()` разрешил его через API: конечная точка `GET /components/by-tag/{tag}` возвращает `404 "Component is not announced"`, когда флаг равен `false`.
