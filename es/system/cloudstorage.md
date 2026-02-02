# Almacenamiento en la Nube
<secondary-label ref="external"/>

Almacenamiento de objetos compatible con S3 con URLs prefirmadas.

## Tipos de Entrada

| Tipo | Descripción |
|------|-------------|
| `config.aws` | Configuración de credenciales y región AWS |
| `cloudstorage.s3` | Conexión a bucket S3 |

## Configuración AWS

```yaml
- name: aws_config
  kind: config.aws
  region: "us-east-1"
  access_key_id_env: "AWS_ACCESS_KEY_ID"
  secret_access_key_env: "AWS_SECRET_ACCESS_KEY"
```

| Campo | Tipo | Requerido | Descripción |
|-------|------|----------|-------------|
| `region` | string | Sí | Región AWS |
| `access_key_id_env` | string | No | Nombre de variable de entorno para access key |
| `secret_access_key_env` | string | No | Nombre de variable de entorno para secret key |

Las credenciales se cargan desde las variables de entorno especificadas. Si se omiten, recurre a la cadena de credenciales por defecto del SDK de AWS (roles IAM, perfiles de instancia, etc.).

<note>
La configuración AWS está planeada para compartirse con otros servicios AWS (SQS, etc.) en futuras versiones.
</note>

## Almacenamiento S3

```yaml
- name: files
  kind: cloudstorage.s3
  bucket: "my-bucket"
  config: app.infra:aws_config
```

| Campo | Tipo | Requerido | Descripción |
|-------|------|----------|-------------|
| `bucket` | string | Sí | Nombre del bucket S3 |
| `config` | referencia | Sí | Referencia a entrada de config AWS |
| `endpoint` | string | No | Endpoint personalizado para servicios compatibles con S3 |

### Servicios Compatibles con S3

Para MinIO u otros servicios compatibles con S3, establezca un endpoint personalizado:

```yaml
- name: local_storage
  kind: cloudstorage.s3
  bucket: "local-bucket"
  config: app.infra:aws_config
  endpoint: "http://localhost:9000"
```

Cuando se proporciona un endpoint, el acceso por estilo de ruta se habilita automáticamente.

## API Lua

Ver [Módulo Cloud Storage](lua/storage/cloud.md) para operaciones (list, upload, download, delete, URLs prefirmadas).
