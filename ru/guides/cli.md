# Справочник CLI

Интерфейс командной строки Wippy.

## Глобальные флаги

Доступны для всех команд:

| Флаг | Сокращение | Описание |
|------|------------|----------|
| `--config` | | Файл конфигурации (по умолчанию .wippy.yaml) |
| `--verbose` | `-v` | Включить отладочный вывод |
| `--very-verbose` | | Отладка со стектрейсами |
| `--console` | `-c` | Цветной консольный вывод |
| `--silent` | `-s` | Отключить вывод в консоль |
| `--event-streams` | `-e` | Транслировать логи в шину событий |
| `--profiler` | `-p` | Включить pprof на localhost:6060 |
| `--memory-limit` | `-m` | Лимит памяти (например, 1G, 512M) |

Приоритет лимита памяти: флаг `--memory-limit` > переменная `GOMEMLIMIT` > 1GB по умолчанию.

## wippy init

Создать lock-файл.

```bash
wippy init
wippy init --src-dir ./src --modules-dir .wippy
```

| Флаг | Сокращение | По умолчанию | Описание |
|------|------------|--------------|----------|
| `--src-dir` | `-d` | ./src | Каталог исходников |
| `--modules-dir` | | .wippy | Каталог модулей |
| `--lock-file` | `-l` | wippy.lock | Путь к lock-файлу |

## wippy run

Запустить приложение или выполнить команду.

```bash
wippy run                                    # Запустить приложение
wippy run list                               # Список команд
wippy run test                               # Запустить тесты
wippy run snapshot.wapp                      # Запустить из pack-файла
wippy run acme/http                          # Запустить модуль
wippy run --exec app:processes/app:worker   # Выполнить один процесс
```

| Флаг | Сокращение | Описание |
|------|------------|----------|
| `--override` | `-o` | Переопределить значения (namespace:entry:field=value) |
| `--exec` | `-x` | Выполнить процесс и завершиться (host/namespace:entry) |
| `--host` | | Хост для выполнения |
| `--registry` | | URL реестра |

## wippy lint

Проверить Lua-код на ошибки типов и предупреждения.

```bash
wippy lint
wippy lint --level warning
```

Проверяет все Lua-записи: `function.lua.*`, `library.lua.*`, `process.lua.*`, `workflow.lua.*`.

| Флаг | Описание |
|------|----------|
| `--level` | Минимальный уровень для отчёта |

## wippy add

Добавить зависимость.

```bash
wippy add acme/http
wippy add acme/http@1.2.3
wippy add acme/http@latest
```

| Флаг | Сокращение | По умолчанию | Описание |
|------|------------|--------------|----------|
| `--lock-file` | `-l` | wippy.lock | Путь к lock-файлу |
| `--registry` | | | URL реестра |

## wippy install

Установить зависимости из lock-файла.

```bash
wippy install
wippy install --force
wippy install --repair
```

| Флаг | Сокращение | Описание |
|------|------------|----------|
| `--lock-file` | `-l` | Путь к lock-файлу |
| `--force` | | Игнорировать кэш, скачать заново |
| `--repair` | | Проверить хэши, перекачать при несовпадении |
| `--registry` | | URL реестра |

## wippy update

Обновить зависимости и перегенерировать lock-файл.

```bash
wippy update                      # Обновить всё
wippy update acme/http            # Обновить конкретный модуль
wippy update acme/http demo/sql   # Обновить несколько
```

| Флаг | Сокращение | По умолчанию | Описание |
|------|------------|--------------|----------|
| `--lock-file` | `-l` | wippy.lock | Путь к lock-файлу |
| `--src-dir` | `-d` | . | Каталог исходников |
| `--modules-dir` | | .wippy | Каталог модулей |
| `--registry` | | | URL реестра |

## wippy pack

Создать pack-файл (.wapp).

```bash
wippy pack snapshot.wapp
wippy pack release.wapp --description "Release 1.0"
wippy pack app.wapp --embed app:assets --bytecode **
```

| Флаг | Сокращение | Описание |
|------|------------|----------|
| `--lock-file` | `-l` | Путь к lock-файлу |
| `--description` | `-d` | Описание |
| `--tags` | `-t` | Теги (через запятую) |
| `--meta` | | Метаданные (key=value) |
| `--embed` | | Встроить fs.directory (паттерны) |
| `--list` | | Показать fs.directory (dry-run) |
| `--exclude-ns` | | Исключить пространства имён (паттерны) |
| `--exclude` | | Исключить записи (паттерны) |
| `--bytecode` | | Компилировать Lua в байткод (** для всех) |

## wippy publish

Опубликовать модуль в hub.

```bash
wippy publish
wippy publish --version 1.0.0
wippy publish --dry-run
```

Читает `wippy.yaml` в текущем каталоге.

| Флаг | Описание |
|------|----------|
| `--version` | Версия для публикации |
| `--dry-run` | Проверить без публикации |
| `--label` | Метка версии |
| `--release-notes` | Заметки о релизе |
| `--protected` | Пометить как защищённую |
| `--registry` | URL реестра |

## wippy search

Поиск модулей в hub.

```bash
wippy search http
wippy search "sql driver" --limit 20
wippy search auth --json
```

| Флаг | Описание |
|------|----------|
| `--json` | Вывод в JSON |
| `--limit` | Максимум результатов |
| `--registry` | URL реестра |

## wippy auth

Управление авторизацией в реестре.

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

## wippy registry

Запросы к реестру записей.

### wippy registry list

```bash
wippy registry list
wippy registry list --kind function.lua
wippy registry list --ns app --json
```

| Флаг | Сокращение | Описание |
|------|------------|----------|
| `--kind` | `-k` | Фильтр по типу |
| `--ns` | `-n` | Фильтр по пространству имён |
| `--name` | | Фильтр по имени |
| `--meta` | | Фильтр по метаданным |
| `--json` | | Вывод в JSON |
| `--yaml` | | Вывод в YAML |
| `--lock-file` | `-l` | Путь к lock-файлу |

### wippy registry show

```bash
wippy registry show app:http:handler
wippy registry show app:config --yaml
```

| Флаг | Сокращение | Описание |
|------|------------|----------|
| `--field` | `-f` | Показать конкретное поле |
| `--json` | | Вывод в JSON |
| `--yaml` | | Вывод в YAML |
| `--raw` | | Сырой вывод |
| `--lock-file` | `-l` | Путь к lock-файлу |

## wippy version

Показать версию.

```bash
wippy version
wippy version --short
```

## Примеры

### Рабочий процесс разработки

```bash
# Инициализация
wippy init
wippy add wippy/http wippy/sql
wippy install

# Проверка на ошибки
wippy lint

# Запуск с отладкой
wippy run -c -v

# Переопределение конфига для локальной разработки
wippy run -o app:db:host=localhost -o app:db:port=5432
```

### Деплой в продакшен

```bash
# Создать релизный pack с байткодом
wippy pack release.wapp --bytecode ** --exclude-ns test.**

# Запустить из pack с лимитом памяти
wippy run release.wapp -m 2G
```

### Отладка

```bash
# Выполнить один процесс
wippy run --exec app:processes/app:worker

# С профилировщиком
wippy run -p -v
# Затем: go tool pprof http://localhost:6060/debug/pprof/heap
```

### Управление зависимостями

```bash
# Добавить зависимость
wippy add acme/http@latest

# Починить повреждённые модули
wippy install --repair

# Принудительно перекачать
wippy install --force

# Обновить конкретный модуль
wippy update acme/http
```

### Публикация

```bash
# Авторизация в hub
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
  mode: development
  level: debug
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

## См. также

- [Конфигурация](guides/configuration.md) — справочник по конфигурации
- [Наблюдаемость](guides/observability.md) — мониторинг и логирование
