# Установка

## Быстрая установка

```bash
curl -fsSL https://hub.wippy.ai/install.sh | bash
```

Или скачайте с [hub.wippy.ai/releases](https://hub.wippy.ai/releases).

## Проверка

```bash
wippy version
```

## Быстрый старт

```bash
# Создаём проект
mkdir myapp && cd myapp
wippy init

# Добавляем зависимости
wippy add wippy/http
wippy install

# Запускаем
wippy run
```

## Команды

| Команда | Описание |
|---------|----------|
| `wippy init` | Создать новый проект |
| `wippy run` | Запустить приложение |
| `wippy lint` | Проверить код на ошибки |
| `wippy add` | Добавить зависимость |
| `wippy install` | Установить зависимости |
| `wippy update` | Обновить зависимости |
| `wippy pack` | Собрать снапшот |
| `wippy publish` | Опубликовать в hub |
| `wippy search` | Найти модули |
| `wippy auth` | Управление авторизацией |
| `wippy version` | Показать версию |

Подробнее в [справочнике CLI](guides/cli.md).

## Что дальше

- [Hello World](tutorials/hello-world.md) — первый проект
- [Структура проекта](start/structure.md) — как всё устроено
- [Справочник CLI](guides/cli.md) — все команды и флаги
