# Облачное хранилище
<secondary-label ref="external"/>

S3-совместимое объектное хранилище с presigned URLs.

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
| `region` | string | Да | Регион AWS |
| `access_key_id_env` | string | Нет | Переменная окружения для access key |
| `secret_access_key_env` | string | Нет | Переменная окружения для secret key |

Учётные данные загружаются из указанных переменных окружения. Если не указаны, используется стандартная цепочка AWS SDK (IAM-роли, профили инстансов и т.д.).

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
| `bucket` | string | Да | Имя S3-бакета |
| `config` | reference | Да | Ссылка на запись конфигурации AWS |
| `endpoint` | string | Нет | Кастомный endpoint для S3-совместимых сервисов |

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

## Lua API

См. [Модуль Cloud Storage](lua/storage/cloud.md) для операций (list, upload, download, delete, presigned URLs).
