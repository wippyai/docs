---
title: "Справочник CLI"
description: "Интерфейс командной строки среды выполнения Wippy."
---

# Справочник CLI

Интерфейс командной строки среды выполнения Wippy.

## Глобальные флаги

Доступны для всех команд:

| Флаг | Сокр. | Описание |
|------|-------|----------|
| `--config` | | Файл конфигурации (по умолчанию: .wippy.yaml) |
| `--verbose` | `-v` | Включить отладочное логирование |
| `--very-verbose` | | Отладка с трассировкой стека |
| `--console` | `-c` | Цветное консольное логирование |
| `--silent` | `-s` | Отключить консольное логирование |
| `--event-streams` | `-e` | Потоковая передача логов в шину событий |
| `--profiler` | `-p` | Включить pprof на localhost:6060 |
| `--memory-limit` | `-m` | Лимит памяти (например, 1G, 512M) |

Приоритет лимита памяти: флаг `--memory-limit` > переменная окружения `GOMEMLIMIT` > 1GB по умолчанию.

## wippy init

Создать новый lock-файл.

```bash
wippy init
wippy init --src-dir ./src --modules-dir .wippy
```

| Флаг | Сокр. | По умолчанию | Описание |
|------|-------|--------------|----------|
| `--src-dir` | `-d` | ./src | Директория исходного кода |
| `--modules-dir` | | .wippy | Директория модулей |
| `--lock-file` | `-l` | wippy.lock | Путь к lock-файлу |

## wippy run

Запустить среду выполнения или выполнить команду.

```bash
wippy run                                   # Запустить среду выполнения
wippy run list                              # Список доступных команд
wippy run test                              # Запустить тесты
wippy run snapshot.wapp                     # Запустить из pack-файла
wippy run acme/http                         # Запустить модуль из хаба
wippy run acme/http@1.2.3                   # Запустить конкретную версию
wippy run --exec app:worker                 # Запустить среду и выполнить один процесс
```

| Флаг | Сокр. | Описание |
|------|-------|----------|
| `--override` | `-o` | Переопределить значения записи (`namespace:entry:field=value`); `field` может быть `kind` для изменения вида записи |
| `--set` | | Переопределить значение конфигурации (`section.path=value`, повторяемый, имеет приоритет над файлом конфигурации) |
| `--exec` | `-x` | Выполнить процесс и завершить (`namespace:entry`) |
| `--host` | | ID терминального хоста для `--exec` (определяется автоматически, если существует только один `terminal.host`) |
| `--registry` | | URL реестра для модулей хаба |

`--set` записывает любое значение конфигурации среды выполнения из командной строки, объединяя с `.wippy.yaml` по каждому листу:

```bash
wippy run --set cluster.enabled=true \
          --set cluster.membership.join_addrs=node-2:7946,node-3:7946 \
          --set cluster.raft.bootstrap_expect=3
```

Значения преобразуются по форме: `true`/`false` в bool, целые и дробные числа в числа, остальное остаётся строкой (длительности вроде `5s` разбираются там, где опция этого ожидает).

## wippy lint

Проверить Lua-код на ошибки типов и предупреждения.

```bash
wippy lint
wippy lint --level warning
wippy lint --json
wippy lint --rules
```

Проверяет все Lua-записи: `function.lua`, `library.lua`, `process.lua`, `workflow.lua` (включая их `.bc`-варианты).

| Флаг | Сокр. | По умолчанию | Описание |
|------|-------|--------------|----------|
| `--lock-file` | `-l` | `wippy.lock` | Путь к lock-файлу |
| `--level` | | `warning` | Минимальная серьёзность: `error`, `warning`, `hint` |
| `--ns` | | | Фильтр по шаблонам пространства имён (например, `app`, `lib.*`) |
| `--code` | | | Фильтр по кодам ошибок (например, `E0001,E0004`) |
| `--rules` | | `false` | Включить правила стиля/качества |
| `--summary` | | `false` | Группировать вывод по коду ошибки |
| `--limit` | | `0` | Максимум показанных диагностик (0 = без ограничений) |
| `--json` | | `false` | Вывод в JSON |
| `--no-color` | | `false` | Отключить цветной вывод |
| `--cache-reset` | | `false` | Очистить кэш Lua перед линтингом |

## wippy add

Добавить зависимость модуля.

```bash
wippy add acme/http
wippy add acme/http@1.2.3
wippy add acme/http@latest
```

| Флаг | Сокр. | По умолчанию | Описание |
|------|-------|--------------|----------|
| `--lock-file` | `-l` | wippy.lock | Путь к lock-файлу |
| `--registry` | | | URL реестра |

## wippy install

Установить зависимости из lock-файла.

```bash
wippy install                            # Установить все
wippy install acme/http                  # Установить конкретный модуль
wippy install --refresh acme/http        # Перекачать конкретный модуль
```

| Флаг | Сокр. | По умолчанию | Описание |
|------|-------|--------------|----------|
| `--lock-file` | `-l` | wippy.lock | Путь к lock-файлу |
| `--refresh` | | false | Перекачать каждый модуль, минуя кэш |
| `--force` | | false | Псевдоним для `--refresh` |
| `--repair` | | false | Псевдоним для `--refresh` |
| `--registry` | | | URL реестра |

## wippy update

Обновить зависимости и пересоздать lock-файл.

```bash
wippy update                      # Обновить все
wippy update acme/http            # Обновить конкретный модуль
wippy update acme/http demo/sql   # Обновить несколько
```

| Флаг | Сокр. | По умолчанию | Описание |
|------|-------|--------------|----------|
| `--lock-file` | `-l` | wippy.lock | Путь к lock-файлу |
| `--src-dir` | `-d` | ./src | Директория исходного кода |
| `--modules-dir` | | .wippy | Директория модулей |
| `--registry` | | | URL реестра |

## wippy pack

Создать snapshot-пакет (файл .wapp).

```bash
wippy pack snapshot.wapp
wippy pack release.wapp --description "Release 1.0"
wippy pack app.wapp --embed app:assets --bytecode **
```

| Флаг | Сокр. | Описание |
|------|-------|----------|
| `--lock-file` | `-l` | Путь к lock-файлу |
| `--description` | `-d` | Описание пакета |
| `--tags` | `-t` | Теги пакета (через запятую) |
| `--meta` | | Пользовательские метаданные (key=value) |
| `--embed` | | Встроить записи fs.directory (паттерны) |
| `--list` | | Список записей fs.directory (пробный запуск) |
| `--exclude-ns` | | Исключить пространства имён (паттерны) |
| `--exclude` | | Исключить записи (паттерны) |
| `--bytecode` | | Компилировать Lua в байткод (** для всех) |

## wippy publish

Опубликовать модуль в хаб.

```bash
wippy publish
wippy publish --version 1.0.0
wippy publish --dry-run
```

Читает из `wippy.yaml` в текущей директории.

| Флаг | Описание |
|------|----------|
| `--version` | Версия для публикации |
| `--dry-run` | Проверить без публикации |
| `--label` | Опубликовать как изменяемую метку вместо версии |
| `--release-notes` | Заметки к релизу |
| `--protected` | Пометить версию как защищённую |
| `--embed` | Встроить записи fs.directory по id или имени |
| `--config` | Путь к директории с wippy.yaml (по умолчанию: .) |
| `--registry` | URL реестра |
| `--create` | Создать модуль в реестре, если он ещё не существует |
| `--module-visibility` | Видимость для новых модулей (только с `--create`): `public` или `private` (по умолчанию: private) |
| `--module-type` | Тип для новых модулей (только с `--create`): `library`, `application`, `agent` или `plugin` (по умолчанию: application) |
| `--module-display-name` | Отображаемое имя для новых модулей (только с `--create`) |

## wippy search

Поиск модулей в хабе.

```bash
wippy search http
wippy search "sql driver" --limit 20
wippy search auth --json
```

| Флаг | По умолчанию | Описание |
|------|--------------|----------|
| `--json` | false | Вывод в формате JSON |
| `--limit` | 20 | Максимальное количество результатов |
| `--registry` | | URL реестра |

## wippy auth

Управление аутентификацией в реестре.

### wippy auth login

```bash
wippy auth login
wippy auth login --token YOUR_TOKEN
```

| Флаг | Описание |
|------|----------|
| `--token` | API-токен |
| `--registry` | URL реестра |
| `--local` | Сохранить учётные данные локально |

### wippy auth logout

```bash
wippy auth logout
```

| Флаг | Описание |
|------|----------|
| `--registry` | URL реестра |
| `--local` | Удалить локальные учётные данные |

### wippy auth status

```bash
wippy auth status
wippy auth status --json
```

| Флаг | Описание |
|------|----------|
| `--json` | Вывод в JSON |

## wippy readme

Получить README модуля из хаба.

```bash
wippy readme wippy/terminal
wippy readme wippy/terminal@1.2.3
wippy readme --json wippy/terminal@latest
```

| Флаг | Описание |
|------|----------|
| `--json` | Вывод в формате JSON |
| `--registry` | URL реестра (по умолчанию: из учётных данных) |

## wippy registry

Запрос и просмотр записей реестра.

### wippy registry list

```bash
wippy registry list
wippy registry list --kind "function.lua.*"
wippy registry list --ns "app.*" --json
wippy registry list --meta "type=api" --meta "enabled=true"
```

| Флаг | Сокр. | Описание |
|------|-------|----------|
| `--kind` | `-k` | Фильтр по типу (glob-шаблон) |
| `--ns` | `-n` | Фильтр по пространству имён (glob-шаблон) |
| `--name` | | Фильтр по имени (glob-шаблон) |
| `--meta` | | Фильтр по метаданным (можно повторять) |
| `--json` | | Вывод в формате JSON |
| `--yaml` | | Вывод в формате YAML |
| `--lock-file` | `-l` | Путь к lock-файлу |

Операторы метаданных для `--meta`:

| Оператор | Значение |
|----------|----------|
| `field=value` | Точное совпадение |
| `field~regex` | Совпадение по regex |
| `field*substr` | Содержит подстроку |
| `field^prefix` | Начинается с префикса |
| `field$suffix` | Заканчивается на суффикс |

### wippy registry show

```bash
wippy registry show app:http:handler
wippy registry show app:config --yaml
```

| Флаг | Сокр. | Описание |
|------|-------|----------|
| `--field` | `-f` | Показать конкретное поле |
| `--json` | | Вывод в формате JSON |
| `--yaml` | | Вывод в формате YAML |
| `--raw` | | Сырой вывод |
| `--lock-file` | `-l` | Путь к lock-файлу |

## wippy version

Вывести информацию о версии.

```bash
wippy version
wippy version --short
```

## Пользовательские команды

Любая запись `process.lua` или `process.wasm` может быть зарегистрирована как именованная команда с помощью метаданных `command`:

```yaml
entries:
  - name: test_runner
    kind: process.lua
    meta:
      command:
        name: test
        short: Run application tests
    source: file://runner.lua
    method: main
    modules:
      - io
      - registry
      - funcs
```

Запуск:

```bash
wippy run test
```

Список всех доступных команд:

```bash
wippy run list
```

### Поля метаданных команды

| Поле | Обязательное | Описание |
|------|--------------|----------|
| `name` | Да | Имя команды для использования с `wippy run <name>` |
| `short` | Нет | Краткое описание, отображаемое в `wippy run list` |
| `main` | Нет | Пометить эту запись как команду по умолчанию (автоматически выбирается pack-файлами и модулями хаба, поставляющими одну команду) |

Подходит любой тип записи процесса (`process.lua`, `process.wasm`). Имя команды должно быть уникальным среди всех загруженных записей. Аргументы после имени команды передаются процессу в виде строкового payload.

## Примеры

### Рабочий процесс разработки

```bash
# Инициализация проекта
wippy init
wippy add wippy/http wippy/sql
wippy install

# Проверка на ошибки
wippy lint

# Запуск с отладочным выводом
wippy run -c -v

# Переопределение конфигурации для локальной разработки
wippy run -o app:db:host=localhost -o app:db:port=5432
```

### Развёртывание в продакшен

```bash
# Создание релизного пакета с байткодом
wippy pack release.wapp --bytecode ** --exclude-ns test.**

# Запуск из пакета с лимитом памяти
wippy run release.wapp -m 2G
```

### Отладка

```bash
# Выполнение одного процесса
wippy run --exec app:worker

# С включённым профилировщиком
wippy run -p -v
# Затем: go tool pprof http://localhost:6060/debug/pprof/heap
```

### Управление зависимостями

```bash
# Добавить новую зависимость
wippy add acme/http@latest

# Принудительно перескачать
wippy install --force

# Обновить конкретный модуль
wippy update acme/http
```

### Публикация

```bash
# Вход в хаб
wippy auth login

# Проверка модуля
wippy publish --dry-run

# Публикация
wippy publish --version 1.0.0 --release-notes "Initial release"
```

## Файл конфигурации

Создайте `.wippy.yaml` для постоянных настроек:

```yaml
logger:
  encoding: console

logmanager:
  min_level: -1  # debug

profiler:
  enabled: true
  address: localhost:6060

override:
  app:gateway:addr: ":9090"
  app:db:host: "localhost"
```

## Смотрите также

- [Конфигурация](guides/configuration.md) — справочник по файлу конфигурации
- [Наблюдаемость](guides/observability.md) — мониторинг и логирование
