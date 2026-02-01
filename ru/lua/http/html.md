# Санитизация HTML
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="workflow"/>

Очистка ненадёжного HTML для предотвращения XSS-атак. Основано на [bluemonday](https://github.com/microcosm-cc/bluemonday).

Санитизация работает через разбор HTML и фильтрацию по белому списку. Элементы и атрибуты, не разрешённые явно, удаляются. На выходе всегда корректный HTML.

## Загрузка

```lua
local html = require("html")
```

## Предустановленные политики

Три встроенные политики для типичных сценариев:

| Политика | Применение | Разрешает |
|----------|------------|-----------|
| `new_policy` | Произвольная санитизация | Ничего (строим с нуля) |
| `ugc_policy` | Комментарии, форумы | Типичное форматирование (`p`, `b`, `i`, `a`, списки и т.д.) |
| `strict_policy` | Извлечение текста | Ничего (удаляет весь HTML) |

### Пустая политика

Создаёт политику, которая ничего не разрешает. Используйте для построения своего белого списка с нуля.

```lua
local policy, err = html.sanitize.new_policy()

policy:allow_elements("p", "strong", "em")
policy:allow_attrs("class"):globally()

local clean = policy:sanitize(user_input)
```

**Возвращает:** `Policy, error`

### Политика для пользовательского контента

Предварительно настроена для пользовательского контента. Разрешает типичные элементы форматирования.

```lua
local policy = html.sanitize.ugc_policy()

local safe = policy:sanitize('<p>Hello <strong>world</strong></p>')
-- '<p>Hello <strong>world</strong></p>'

local xss = policy:sanitize('<p>Hello <script>alert("xss")</script></p>')
-- '<p>Hello </p>'
```

**Возвращает:** `Policy, error`

### Строгая политика

Удаляет весь HTML, возвращает только текст.

```lua
local policy = html.sanitize.strict_policy()

local text = policy:sanitize('<p>Hello <b>world</b>!</p>')
-- 'Hello world!'
```

**Возвращает:** `Policy, error`

## Управление элементами

### Разрешение элементов

Добавление HTML-элементов в белый список.

```lua
local policy = html.sanitize.new_policy()
policy:allow_elements("p", "strong", "em", "br")
policy:allow_elements("h1", "h2", "h3")
policy:allow_elements("a", "img")

local result = policy:sanitize('<p>Hello <strong>world</strong></p>')
-- '<p>Hello <strong>world</strong></p>'
```

| Параметр | Тип | Описание |
|----------|-----|----------|
| `...` | string | Имена тегов |

**Возвращает:** `Policy`

## Управление атрибутами

### Разрешение атрибутов

Начало разрешения атрибутов. Цепочка с `on_elements()` или `globally()`.

```lua
policy:allow_attrs("href"):on_elements("a")
policy:allow_attrs("src", "alt"):on_elements("img")
policy:allow_attrs("class", "id"):globally()
```

| Параметр | Тип | Описание |
|----------|-----|----------|
| `...` | string | Имена атрибутов |

**Возвращает:** `AttrBuilder`

### На конкретных элементах

Разрешить атрибуты только на определённых элементах.

```lua
policy:allow_elements("a", "img")
policy:allow_attrs("href", "target"):on_elements("a")
policy:allow_attrs("src", "alt", "width", "height"):on_elements("img")
```

| Параметр | Тип | Описание |
|----------|-----|----------|
| `...` | string | Имена тегов |

**Возвращает:** `Policy`

### На всех элементах

Разрешить атрибуты глобально на любом разрешённом элементе.

```lua
policy:allow_attrs("class"):globally()
policy:allow_attrs("id"):globally()
```

**Возвращает:** `Policy`

### С проверкой по шаблону

Валидация значений атрибутов по регулярному выражению.

```lua
-- Разрешить только hex-цвета в style
local builder, err = policy:allow_attrs("style"):matching("^color:#[0-9a-fA-F]{6}$")
if err then
    return nil, err
end
builder:on_elements("span")

policy:sanitize('<span style="color:#ff0000">Red</span>')
-- '<span style="color:#ff0000">Red</span>'

policy:sanitize('<span style="background:red">Bad</span>')
-- '<span>Bad</span>'
```

| Параметр | Тип | Описание |
|----------|-----|----------|
| `pattern` | string | Регулярное выражение |

**Возвращает:** `AttrBuilder, error`

## Безопасность URL

### Стандартные URL

Включить обработку URL с безопасными настройками по умолчанию.

```lua
policy:allow_elements("a")
policy:allow_attrs("href"):on_elements("a")
policy:allow_standard_urls()
```

**Возвращает:** `Policy`

### URL-схемы

Ограничить разрешённые схемы URL.

```lua
policy:allow_url_schemes("https", "mailto")

policy:sanitize('<a href="https://example.com">OK</a>')
-- '<a href="https://example.com">OK</a>'

policy:sanitize('<a href="javascript:alert(1)">XSS</a>')
-- '<a>XSS</a>'
```

| Параметр | Тип | Описание |
|----------|-----|----------|
| `...` | string | Разрешённые схемы |

**Возвращает:** `Policy`

### Относительные URL

Разрешить или запретить относительные URL.

```lua
policy:allow_relative_urls(true)

policy:sanitize('<a href="/page">Link</a>')
-- '<a href="/page">Link</a>'
```

| Параметр | Тип | Описание |
|----------|-----|----------|
| `allow` | boolean | Разрешить относительные URL |

**Возвращает:** `Policy`

### Nofollow для ссылок

Добавить `rel="nofollow"` ко всем ссылкам. Защита от SEO-спама.

```lua
policy:allow_attrs("href", "rel"):on_elements("a")
policy:require_nofollow_on_links(true)

policy:sanitize('<a href="https://example.com">Link</a>')
-- '<a href="https://example.com" rel="nofollow">Link</a>'
```

| Параметр | Тип | Описание |
|----------|-----|----------|
| `require` | boolean | Добавлять nofollow |

**Возвращает:** `Policy`

### Noreferrer для ссылок

Добавить `rel="noreferrer"` ко всем ссылкам. Защита от утечки referrer.

```lua
policy:require_noreferrer_on_links(true)
```

| Параметр | Тип | Описание |
|----------|-----|----------|
| `require` | boolean | Добавлять noreferrer |

**Возвращает:** `Policy`

### Внешние ссылки в новой вкладке

Добавить `target="_blank"` к полным URL.

```lua
policy:allow_attrs("href", "target"):on_elements("a")
policy:add_target_blank_to_fully_qualified_links(true)

policy:sanitize('<a href="https://example.com">Link</a>')
-- '<a href="https://example.com" target="_blank">Link</a>'
```

| Параметр | Тип | Описание |
|----------|-----|----------|
| `add` | boolean | Добавлять target blank |

**Возвращает:** `Policy`

## Вспомогательные методы

### Разрешить изображения

Разрешить `<img>` со стандартными атрибутами.

```lua
policy:allow_images()

policy:sanitize('<img src="photo.jpg" alt="Photo">')
-- '<img src="photo.jpg" alt="Photo">'
```

**Возвращает:** `Policy`

### Разрешить data URI для изображений

Разрешить встроенные изображения в base64.

```lua
policy:allow_elements("img")
policy:allow_attrs("src"):on_elements("img")
policy:allow_data_uri_images()

policy:sanitize('<img src="data:image/png;base64,iVBORw...">')
-- '<img src="data:image/png;base64,iVBORw...">'
```

**Возвращает:** `Policy`

### Разрешить списки

Разрешить элементы списков: `ul`, `ol`, `li`, `dl`, `dt`, `dd`.

```lua
policy:allow_lists()

policy:sanitize('<ul><li>Item 1</li><li>Item 2</li></ul>')
-- '<ul><li>Item 1</li><li>Item 2</li></ul>'
```

**Возвращает:** `Policy`

### Разрешить таблицы

Разрешить элементы таблиц: `table`, `thead`, `tbody`, `tfoot`, `tr`, `td`, `th`, `caption`.

```lua
policy:allow_tables()

policy:sanitize('<table><tr><td>Cell</td></tr></table>')
-- '<table><tr><td>Cell</td></tr></table>'
```

**Возвращает:** `Policy`

### Разрешить стандартные атрибуты

Разрешить типичные атрибуты: `id`, `class`, `title`, `dir`, `lang`.

```lua
policy:allow_elements("p")
policy:allow_standard_attributes()

policy:sanitize('<p id="intro" class="text" title="Introduction">Hello</p>')
-- '<p id="intro" class="text" title="Introduction">Hello</p>'
```

**Возвращает:** `Policy`

## Санитизация

Применить политику к HTML-строке.

```lua
local policy = html.sanitize.ugc_policy()
policy:require_nofollow_on_links(true)

local dirty = '<p>Hello</p><script>alert("xss")</script>'
local clean = policy:sanitize(dirty)
-- '<p>Hello</p>'
```

| Параметр | Тип | Описание |
|----------|-----|----------|
| `html` | string | HTML для очистки |

**Возвращает:** `string`

## Ошибки

| Условие | Kind | Повторяемо |
|---------|------|------------|
| Некорректное регулярное выражение | `errors.INVALID` | нет |

См. [Обработка ошибок](lua-errors.md) для работы с ошибками.
