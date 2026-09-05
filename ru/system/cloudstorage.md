---
title: "Облачное хранилище"
description: "<secondary-label ref='external'/"
---

# Облачное хранилище
<secondary-label ref="external"/>

S3-совместимое объектное хранилище с presigned URLs, multipart-загрузками и чтением по диапазонам.

## Типы записей

| Тип | Описание |
|-----|----------|
| `config.aws` | Учётные данные и регион AWS |
| `cloudstorage.s3` | Подключение к S3-бакету |

## Настройка AWS

```yaml
- name: aws_config
  kind: config.aws
  region: "us-east-1"
  access_key_id_env: "AWS_ACCESS_KEY_ID"
  secret_access_key_env: "AWS_SECRET_ACCESS_KEY"
```

| Поле | Тип | Обязательно | Описание |
|------|-----|-------------|----------|
| `region` | string | Условно | Регион AWS. Обязателен, если не задан `region_env` |
| `region_env` | string | Условно | Имя переменной окружения, содержащей регион |
| `access_key_id_env` | string | Нет | Переменная окружения для access key |
| `secret_access_key_env` | string | Нет | Переменная окружения для secret key |

Учётные данные загружаются из указанных переменных окружения. Чтобы применить статические учётные данные, и `access_key_id_env`, и `secret_access_key_env` должны разрешаться в непустые значения; иначе используется стандартная цепочка учётных данных AWS SDK (IAM-роли, профили инстансов и т.д.).

Запросы подписываются AWS Signature Version 4 силами AWS SDK с использованием разрешённых учётных данных. Настройка подписи не требуется.

<note>
Используйте варианты <code>_env</code> (<code>region_env</code>, а также <code>bucket_env</code>/<code>endpoint_env</code> ниже), когда значение различается между развёртываниями. Имя переменной разрешается из реестра окружения при старте.
</note>

<note>
Конфигурация AWS планируется для использования с другими сервисами AWS (SQS и др.) в будущих версиях.
</note>

## S3-хранилище

```yaml
- name: files
  kind: cloudstorage.s3
  bucket: "my-bucket"
  config: app.infra:aws_config
```

| Поле | Тип | Обязательно | Описание |
|------|-----|-------------|----------|
| `bucket` | string | Условно | Имя S3-бакета. Обязательно, если не задан `bucket_env` |
| `bucket_env` | string | Условно | Имя переменной окружения, содержащей имя бакета |
| `config` | reference | Да | Ссылка на запись конфигурации AWS |
| `endpoint` | string | Нет | Кастомный endpoint для S3-совместимых сервисов |
| `endpoint_env` | string | Нет | Имя переменной окружения, содержащей кастомный endpoint |

### S3-совместимые сервисы

Для MinIO и других S3-совместимых сервисов укажите кастомный endpoint:

```yaml
- name: local_storage
  kind: cloudstorage.s3
  bucket: "local-bucket"
  config: app.infra:aws_config
  endpoint: "http://localhost:9000"
```

При указании endpoint автоматически включается path-style доступ.

## Multipart-загрузки

Presigned multipart-загрузки — это возможность провайдера, а не функция среды исполнения. Тип `cloudstorage.s3` их реализует; провайдер, не поддерживающий протокол multipart, завершает `create_multipart_upload`, `presigned_part_urls`, `complete_multipart_upload` и `abort_multipart_upload` ошибкой `errors.UNAVAILABLE`.

Части загрузки, которая так и не была завершена или отменена, остаются в хранилище и тарифицируются. Приложения отменяют загрузку на каждом пути сбоя, но упавший клиент не оставляет никого, кто выполнит эту отмену. Настройте на бакете правило жизненного цикла `AbortIncompleteMultipartUpload` в качестве подстраховки:

```json
{
  "Rules": [
    {
      "ID": "abort-incomplete-multipart",
      "Status": "Enabled",
      "Filter": { "Prefix": "" },
      "AbortIncompleteMultipartUpload": { "DaysAfterInitiation": 7 }
    }
  ]
}
```

## Чтение по диапазонам

`open_reader` читает объект через ranged GET и закрепляет ETag объекта заголовком `If-Match` при каждом чтении. Провайдер, не возвращающий ETag при первичном stat, завершает вызов ошибкой `errors.UNAVAILABLE`, а провайдер, игнорирующий `If-Match`, лишает защиты от перезаписи — тогда чтение не сможет обнаружить, что смешало два поколения объекта.

## Lua API

См. [Модуль Cloud Storage](lua/storage/cloud.md) для операций (list, upload, download, delete, presigned URLs, multipart-загрузки, чтение по диапазонам).

## См. также

- [Модуль Cloud Storage](lua/storage/cloud.md) — справочник Lua API
- [Файловая система](system/filesystem.md) — записи локальной файловой системы
- [Очередь](system/queue.md) — обработчик SQS использует те же записи `config.aws`
