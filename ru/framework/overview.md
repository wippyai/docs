# Фреймворк

Wippy предоставляет официальные модули фреймворка через хаб. Эти модули поддерживаются организацией `wippy` и могут быть добавлены в любой проект.

## Добавление модулей фреймворка

```bash
wippy add wippy/test
wippy install
```

Это добавляет модуль в lock-файл и скачивает его в `.wippy/vendor/`.

## Объявление зависимостей в исходниках

Модули фреймворка также можно объявить как зависимости в `_index.yaml`:

```yaml
version: "1.0"
namespace: app

entries:
  - name: dependency.test
    kind: ns.dependency
    component: wippy/test
    version: "^0.3.0"
```

Затем разрешите и установите:

```bash
wippy update
```

## Импорт библиотек фреймворка

После установки импортируйте библиотеки фреймворка в свои записи:

```yaml
entries:
  - name: my_test
    kind: function.lua
    meta:
      type: test
      suite: my-suite
    source: file://my_test.lua
    method: run
    imports:
      test: wippy.test:test
```

Импорт связывает `wippy.test:test` (запись `test` из пространства имен `wippy.test`) с локальным именем `test`, которое затем используется через `require("test")` в Lua.

## Доступные модули

| Module | Описание |
|--------|----------|
| `wippy/test` | BDD-фреймворк для тестирования с утверждениями и моками |
| `wippy/terminal` | Компоненты терминального UI |

Дополнительные модули доступны и регулярно публикуются. Поиск в хабе:

```bash
wippy search wippy
```

## См. также

- [Управление зависимостями](guides/dependency-management.md) - Lock-файл и ограничения версий
- [Публикация](guides/publishing.md) - Публикация собственных модулей
- [CLI-справочник](guides/cli.md) - CLI-команды
