# Шаблонизатор
<secondary-label ref="external"/>

Рендеринг шаблонов с помощью [CloudyKit Jet](https://github.com/CloudyKit/jet).

## Типы записей

| Тип | Описание |
|-----|----------|
| `template.set` | Набор шаблонов с общей конфигурацией |
| `template.jet` | Отдельный шаблон |

## Наборы шаблонов

Набор — это пространство имён для связанных шаблонов. Шаблоны внутри набора разделяют конфигурацию и могут ссылаться друг на друга по имени.

```yaml
- name: views
  kind: template.set
```

Все настройки необязательны и имеют разумные значения по умолчанию:

| Поле | Тип | По умолчанию | Описание |
|------|-----|--------------|----------|
| `engine.development_mode` | bool | false | Отключить кеширование шаблонов |
| `engine.delimiters.left` | string | `{{` | Открывающий разделитель |
| `engine.delimiters.right` | string | `}}` | Закрывающий разделитель |
| `engine.globals` | map | - | Переменные, доступные во всех шаблонах |

## Шаблоны

Шаблоны принадлежат набору и идентифицируются по имени для внутреннего разрешения ссылок.

```yaml
- name: layout
  kind: template.jet
  set: app.views:views
  source: |
    <html>
    <body>{{ yield content() }}</body>
    </html>

- name: home
  kind: template.jet
  set: app.views:views
  source: |
    {{ extends "layout" }}
    {{ block content() }}
      <h1>Добро пожаловать, {{ name }}</h1>
    {{ end }}
```

| Поле | Тип | Обязательно | Описание |
|------|-----|-------------|----------|
| `set` | reference | Да | Родительский набор шаблонов |
| `source` | string | Да | Содержимое шаблона |

## Разрешение шаблонов

Шаблоны ссылаются друг на друга по именам, а не по ID реестра. Разрешение работает как виртуальная файловая система внутри набора:

1. По умолчанию имя записи (`entry.ID.Name`) становится именем шаблона
2. Переопределите через `meta.name` для кастомного именования:

```yaml
- name: email-welcome-v2
  kind: template.jet
  set: app.emails:templates
  meta:
    name: welcome
  source: |
    {{ include "header" }}
    Привет, {{ user }}!
```

Этот шаблон регистрируется как `welcome` в наборе, так что другие шаблоны используют `{{ include "welcome" }}` или `{{ extends "welcome" }}`.

## Наследование

Шаблоны могут расширять родительские и переопределять блоки:

```yaml
# Родитель определяет точки вставки
- name: base
  kind: template.jet
  set: app.views:views
  source: |
    <html>
    <head><title>{{ yield title() }}</title></head>
    <body>{{ yield body() }}</body>
    </html>

# Потомок расширяет и заполняет блоки
- name: page
  kind: template.jet
  set: app.views:views
  source: |
    {{ extends "base" }}
    {{ block title() }}Моя страница{{ end }}
    {{ block body() }}<p>Контент</p>{{ end }}
```

## Lua API

См. [Модуль Template](lua/text/template.md) для операций рендеринга.
