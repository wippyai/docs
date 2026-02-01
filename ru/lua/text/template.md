# Шаблоны
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="external"/>

Рендеринг динамического контента с помощью шаблонизатора [Jet](https://github.com/CloudyKit/jet). Подходит для генерации HTML-страниц, писем и документов с поддержкой наследования и включений.

Настройка наборов шаблонов описана в разделе [Шаблонизатор](system/template.md).

## Подключение

```lua
local templates = require("templates")
```

## Получение набора шаблонов

Для работы с шаблонами сначала нужно получить набор по его идентификатору в реестре:

```lua
local set, err = templates.get("app.views:emails")
if err then
    return nil, err
end

-- Работа с набором...

set:release()
```

| Параметр | Тип | Описание |
|----------|-----|----------|
| `id` | string | Идентификатор набора в реестре |

**Возвращает:** `Set, error`

## Рендеринг

Для рендеринга укажите имя шаблона и данные:

```lua
local set = templates.get("app.views:emails")

local html, err = set:render("welcome", {
    user = {name = "Алексей", email = "alex@example.com"},
    activation_url = "https://example.com/activate?token=abc"
})

if err then
    set:release()
    return nil, err
end

set:release()
return html
```

| Параметр | Тип | Описание |
|----------|-----|----------|
| `name` | string | Имя шаблона в наборе |
| `data` | table | Данные для шаблона (необязательно) |

**Возвращает:** `string, error`

## Методы набора

| Метод | Возвращает | Описание |
|-------|------------|----------|
| `render(name, data?)` | `string, error` | Рендеринг шаблона |
| `release()` | `boolean` | Освобождение набора |

## Синтаксис Jet

Jet использует `{{ }}` для выражений и управляющих конструкций, `{* *}` для комментариев.

### Переменные

```html
{{ user.name }}
{{ user.email }}
{{ items[0].price }}
```

### Условия

```html
{{ if order.shipped }}
    <p>Заказ отправлен!</p>
{{ else if order.processing }}
    <p>Заказ обрабатывается...</p>
{{ else }}
    <p>Заказ принят.</p>
{{ end }}
```

### Циклы

```html
{{ range items }}
    <li>{{ .name }} — {{ .price }} ₽</li>
{{ end }}

{{ range i, item := items }}
    <p>{{ i }}. {{ item.name }}</p>
{{ end }}
```

### Наследование

```html
{* Базовый шаблон: layout.jet *}
<html>
<head><title>{{ yield title() }}</title></head>
<body>{{ yield body() }}</body>
</html>

{* Дочерний шаблон: page.jet *}
{{ extends "layout" }}
{{ block title() }}Моя страница{{ end }}
{{ block body() }}<p>Содержимое</p>{{ end }}
```

### Включения

```html
{{ include "partials/header" }}
<main>Основной контент</main>
{{ include "partials/footer" }}
```

## Ошибки

| Ситуация | Тип | Повтор |
|----------|-----|--------|
| Пустой идентификатор | `errors.INVALID` | нет |
| Пустое имя шаблона | `errors.INVALID` | нет |
| Нет доступа | `errors.PERMISSION_DENIED` | нет |
| Шаблон не найден | `errors.NOT_FOUND` | нет |
| Ошибка рендеринга | `errors.INTERNAL` | нет |
| Набор уже освобождён | `errors.INTERNAL` | нет |

Подробнее см. [Обработка ошибок](lua/core/errors.md).
