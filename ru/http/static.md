# Статические файлы

Раздача статических файлов из любой файловой системы через `http.static`. Обработчики статики монтируются напрямую на сервер и могут раздавать SPA, ассеты или пользовательские загрузки с любого пути.

## Конфигурация

```yaml
- name: static
  kind: http.static
  meta:
    server: gateway
  path: /
  fs: app:public
  directory: dist
  static_options:
    spa: true
    index: index.html
    cache: "public, max-age=3600"
```

| Поле | Тип | Описание |
|------|-----|----------|
| `meta.server` | Registry ID | Родительский HTTP-сервер |
| `path` | string | URL-путь монтирования (начинается с `/`) |
| `fs` | Registry ID | Запись файловой системы для раздачи |
| `directory` | string | Поддиректория внутри файловой системы |
| `static_options.spa` | bool | SPA-режим — отдавать index для несопоставленных путей |
| `static_options.index` | string | Index-файл (обязателен при spa=true) |
| `static_options.cache` | string | Значение заголовка Cache-Control |
| `middleware` | []string | Цепочка middleware |
| `options` | map | Опции middleware (точечная нотация) |

<tip>
Обработчики статики можно монтировать на любой путь сервера. Несколько обработчиков могут сосуществовать — монтируйте ассеты на <code>/static</code>, а SPA на <code>/</code>.
</tip>

## Интеграция с файловой системой

Статические файлы раздаются из записей файловых систем. Подходит любой тип:

```yaml
entries:
  # Локальная директория
  - name: public
    kind: fs.directory
    directory: ./public

  # Обработчик статики
  - name: static
    kind: http.static
    meta:
      server: gateway
    path: /static
    fs: public
```

Запрос `/static/css/style.css` отдаёт `./public/css/style.css`.

Поле `directory` выбирает поддиректорию внутри файловой системы:

```yaml
- name: docs
  kind: http.static
  meta:
    server: gateway
  path: /docs
  fs: app:content
  directory: documentation/html
```

## SPA-режим

Single Page Applications требуют, чтобы все маршруты отдавали один index-файл для клиентской маршрутизации:

```yaml
- name: spa
  kind: http.static
  meta:
    server: gateway
  path: /
  fs: app:frontend
  static_options:
    spa: true
    index: index.html
```

| Запрос | Ответ |
|--------|-------|
| `/app.js` | Отдаёт `app.js` (файл существует) |
| `/users/123` | Отдаёт `index.html` (SPA fallback) |
| `/api/data` | Отдаёт `index.html` (SPA fallback) |

<note>
При <code>spa: true</code> файл <code>index</code> обязателен. Существующие файлы отдаются напрямую; все остальные пути возвращают index-файл.
</note>

## Управление кешем

Настройте кеширование для разных типов ассетов:

```yaml
entries:
  - name: app_fs
    kind: fs.directory
    directory: ./dist

  # Версионированные ассеты — кешировать навсегда
  - name: assets
    kind: http.static
    meta:
      server: gateway
    path: /assets
    fs: app_fs
    directory: assets
    static_options:
      cache: "public, max-age=31536000, immutable"

  # HTML — короткий кеш, обязательная ревалидация
  - name: app
    kind: http.static
    meta:
      server: gateway
    path: /
    fs: app_fs
    static_options:
      spa: true
      index: index.html
      cache: "public, max-age=0, must-revalidate"
```

Типовые паттерны кеширования:
- **Версионированные ассеты**: `public, max-age=31536000, immutable`
- **HTML/index**: `public, max-age=0, must-revalidate`
- **Пользовательские загрузки**: `private, max-age=3600`

## Middleware

Применение middleware для сжатия, CORS и другой обработки:

```yaml
- name: static
  kind: http.static
  meta:
    server: gateway
  path: /
  fs: app:public
  middleware:
    - compress
    - cors
  options:
    compress.level: "best"
    cors.allow.origins: "*"
```

Middleware оборачивают обработчик статики по порядку — запросы проходят через каждый middleware до файлового сервера.

<warning>
Сопоставление путей работает по префиксу. Обработчик на <code>/</code> перехватывает все несопоставленные запросы. Используйте роутеры для API-эндпоинтов, чтобы избежать конфликтов.
</warning>

## См. также

- [Сервер](http/server.md) — конфигурация HTTP-сервера
- [Маршрутизация](http/router.md) — роутеры и эндпоинты
- [Файловая система](lua/storage/filesystem.md) — модуль файловой системы
- [Middleware](http/middleware.md) — доступные middleware
