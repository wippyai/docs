---
title: "Almacenamiento en la Nube"
description: "<secondary-label ref='external'/"
---

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
| `region` | string | Condicional | Región AWS. Requerido salvo que se establezca `region_env` |
| `region_env` | string | Condicional | Nombre de variable de entorno que contiene la región |
| `access_key_id_env` | string | No | Nombre de variable de entorno para access key |
| `secret_access_key_env` | string | No | Nombre de variable de entorno para secret key |

Las credenciales se cargan desde las variables de entorno especificadas. Tanto `access_key_id_env` como `secret_access_key_env` deben resolverse a valores no vacíos para que se apliquen credenciales estáticas; en caso contrario se usa la cadena de credenciales por defecto del SDK de AWS (roles IAM, perfiles de instancia, etc.).

Las solicitudes son firmadas con AWS Signature Version 4 por el SDK de AWS usando las credenciales resueltas. No se requiere configuración de firma.

<note>
Usa las variantes <code>_env</code> (<code>region_env</code>, y <code>bucket_env</code>/<code>endpoint_env</code> más abajo) cuando un valor difiere por despliegue. El nombre de la variable se resuelve desde el registro de entorno en el arranque.
</note>

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
| `bucket` | string | Condicional | Nombre del bucket S3. Requerido salvo que se establezca `bucket_env` |
| `bucket_env` | string | Condicional | Nombre de variable de entorno que contiene el nombre del bucket |
| `config` | referencia | Sí | Referencia a entrada de config AWS |
| `endpoint` | string | No | Endpoint personalizado para servicios compatibles con S3 |
| `endpoint_env` | string | No | Nombre de variable de entorno que contiene el endpoint personalizado |

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

## Ver También

- [Módulo Cloud Storage](lua/storage/cloud.md) - Referencia de la API Lua
- [Filesystem](system/filesystem.md) - Entradas de filesystem local
- [Queue](system/queue.md) - El handler SQS comparte las mismas entradas `config.aws`
