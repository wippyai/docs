---
title: "Almacenamiento en la Nube"
description: "<secondary-label ref='external'/"
---

# Almacenamiento en la Nube
<secondary-label ref="external"/>

Almacenamiento de objetos compatible con S3 con URLs prefirmadas, cargas multiparte y lecturas por rango.

## Tipos de Entrada

| Tipo | Descripción |
|------|-------------|
| `config.aws` | Configuración de credenciales y región AWS |
| `cloudstorage.s3` | Conexión a bucket S3 |

## Configuración AWS

```yaml
- name: aws_config
  kind: config.aws
  region: ${env:AWS_REGION}
  access_key_id: ${env:AWS_ACCESS_KEY_ID}
  secret_access_key: ${env:AWS_SECRET_ACCESS_KEY}
```

| Campo | Tipo | Requerido | Descripción |
|-------|------|----------|-------------|
| `region` | string | Sí | Región AWS. Proporciónela mediante `${env:NAME}` cuando difiera por despliegue |
| `access_key_id` | string | No | ID de la access key de AWS (en línea o `${env:NAME}`) |
| `secret_access_key` | string | No | Secret access key de AWS (en línea o `${env:NAME}`) |

Las credenciales se resuelven desde el [registro de entorno](system/env.md) en el momento de la decodificación. Tanto `access_key_id` como `secret_access_key` deben resolverse a valores no vacíos para que se apliquen credenciales estáticas; en caso contrario se usa la cadena de credenciales por defecto del SDK de AWS (roles IAM, perfiles de instancia, etc.).

Las solicitudes son firmadas con AWS Signature Version 4 por el SDK de AWS usando las credenciales resueltas. No se requiere configuración de firma.

<note>
Las configuraciones antiguas usan una directiva hermana <code>&lt;field&gt;_env</code> (<code>region_env</code>, <code>access_key_id_env</code>, <code>secret_access_key_env</code>) que se resuelve de la misma manera. Esta forma está <b>obsoleta</b> — migre a la sustitución <code>${env:NAME}</code> mostrada arriba.
</note>

<note>
Una sola entrada <code>config.aws</code> puede reutilizarse en distintos servicios respaldados por AWS. <code>queue.driver.sqs</code> referencia la misma entrada mediante su campo <code>config:</code>.
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
| `bucket` | string | Condicional | Nombre del bucket S3. Proporciónelo mediante `${env:NAME}` cuando difiera por despliegue |
| `config` | referencia | Sí | Referencia a entrada de config AWS |
| `endpoint` | string | No | Endpoint personalizado para servicios compatibles con S3 (en línea o `${env:NAME}`) |

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

## Cargas Multiparte

Las cargas multiparte prefirmadas son una capacidad del proveedor, no una característica del runtime. El tipo `cloudstorage.s3` las implementa; un proveedor que no soporta el protocolo multiparte falla `create_multipart_upload`, `presigned_part_urls`, `complete_multipart_upload` y `abort_multipart_upload` con `errors.UNAVAILABLE`.

Las partes de una carga que nunca se completa ni se aborta permanecen almacenadas y se facturan. Las aplicaciones abortan en cada ruta de fallo, pero un cliente que se cae no deja nada que ejecute ese abort. Configure una regla de ciclo de vida `AbortIncompleteMultipartUpload` en el bucket como respaldo:

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

## Lecturas por Rango

`open_reader` lee un objeto mediante GETs por rango y fija el ETag del objeto con `If-Match` en cada lectura. Un proveedor que no devuelve un ETag en el stat inicial falla la llamada con `errors.UNAVAILABLE`, y un proveedor que ignora `If-Match` pierde la protección contra sobrescritura - la lectura entonces no puede detectar que mezcló dos generaciones del objeto.

## API Lua

Ver [Módulo Cloud Storage](lua/storage/cloud.md) para operaciones (list, upload, download, delete, URLs prefirmadas, cargas multiparte, lectores por rango).

## Ver También

- [Módulo Cloud Storage](lua/storage/cloud.md) - Referencia de la API Lua
- [Filesystem](system/filesystem.md) - Entradas de filesystem local
- [Queue](system/queue.md) - El handler SQS comparte las mismas entradas `config.aws`
