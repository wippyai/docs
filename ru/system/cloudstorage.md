---
title: "Облачное хранилище"
description: "S3-совместимое объектное хранилище с presigned URLs, multipart-загрузками и чтением по диапазонам."
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
  region: ${env:AWS_REGION}
  access_key_id: ${env:AWS_ACCESS_KEY_ID}
  secret_access_key: ${env:AWS_SECRET_ACCESS_KEY}
```

| Поле | Тип | Обязательно | Описание |
|------|-----|-------------|----------|
| `region` | string | Да | Регион AWS. Передавайте через `${env:NAME}`, если он различается между развёртываниями |
| `access_key_id` | string | Нет | AWS access key ID (напрямую или через `${env:NAME}`) |
| `secret_access_key` | string | Нет | AWS secret access key (напрямую или через `${env:NAME}`) |

Учётные данные разрешаются из [реестра окружения](system/env.md) во время декодирования. Чтобы применить статические учётные данные, и `access_key_id`, и `secret_access_key` должны разрешаться в непустые значения; иначе используется стандартная цепочка учётных данных AWS SDK (IAM-роли, профили инстансов и т.д.).

Запросы подписываются AWS Signature Version 4 силами AWS SDK с использованием разрешённых учётных данных. Настройка подписи не требуется.

<note>
Более старые конфигурации используют парную директиву <code>&lt;field&gt;_env</code> (<code>region_env</code>, <code>access_key_id_env</code>, <code>secret_access_key_env</code>), которая разрешается тем же способом. Эта форма <b>устарела</b> — переведите её на плейсхолдер <code>${env:NAME}</code>, показанный выше.
</note>

<note>
Одну запись <code>config.aws</code> можно переиспользовать в разных сервисах на базе AWS. <code>queue.driver.sqs</code> ссылается на ту же запись через своё поле <code>config:</code>.
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
| `bucket` | string | Условно | Имя S3-бакета. Передавайте через `${env:NAME}`, если оно различается между развёртываниями |
| `config` | reference | Да | Ссылка на запись конфигурации AWS |
| `endpoint` | string | Нет | Кастомный endpoint для S3-совместимых сервисов (напрямую или через `${env:NAME}`) |

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
