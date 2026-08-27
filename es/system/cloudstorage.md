---
title: "Almacenamiento en la nube"
description: "Configure credenciales de AWS y almacenamiento de objetos compatible con S3."
---

# Almacenamiento en la Nube
<secondary-label ref="external"/>

Las entradas de almacenamiento en la nube configuran credenciales de AWS y buckets compatibles con S3 usados por la API de almacenamiento de Lua. Esta página es una referencia de configuración; los fragmentos presuponen que ya existen el bucket indicado y las credenciales o la cadena de credenciales del SDK.

## Tipos de Entrada

| Tipo | Descripción |
|------|-------------|
| `config.aws` | Configuración de credenciales y región AWS |
| `cloudstorage.s3` | Conexión a bucket S3 |

## Configuración de AWS

Credenciales estáticas registradas mediante el sistema de entorno:

```yaml
- name: aws_config
  kind: config.aws
  region: ${env:AWS_REGION}
  access_key_id: ${env:AWS_ACCESS_KEY_ID}
  secret_access_key: ${env:AWS_SECRET_ACCESS_KEY}
```

Cadena de credenciales predeterminada del SDK de AWS (por ejemplo, roles IAM o perfiles de instancia):

```yaml
- name: aws_config
  kind: config.aws
  region: ${env:AWS_REGION}
```

| Campo | Tipo | Requerido | Descripción |
|-------|------|----------|-------------|
| `region` | string | Sí | Región de AWS. Proporciónela mediante `${env:NAME}` cuando cambie por deployment |
| `access_key_id` | string | No | ID de clave de acceso de AWS (en línea o `${env:NAME}`) |
| `secret_access_key` | string | No | Clave de acceso secreta de AWS (en línea o `${env:NAME}`) |

Los campos de credenciales se resuelven desde el [registro de entorno](./env.md) al decodificarse. Un marcador moderno `${env:NAME}` sin valor predeterminado hace fallar la decodificación cuando falta su variable; por tanto, omita `access_key_id` y `secret_access_key` para usar la cadena de credenciales predeterminada del SDK de AWS. Las credenciales estáticas solo se aplican cuando ambos campos se resuelven a valores no vacíos.

Las solicitudes son firmadas con AWS Signature Version 4 por el SDK de AWS usando las credenciales resueltas. No se requiere configuración de firma.

<note>
Las configuraciones antiguas usan una directiva hermana <code>&lt;field&gt;_env</code> (<code>region_env</code>, <code>access_key_id_env</code>, <code>secret_access_key_env</code>) que también consulta el registro de entorno. A diferencia de un marcador moderno sin valor predeterminado, una consulta heredada no registrada o vacía conserva el valor en línea o cero. La forma heredada está <b>obsoleta</b>: migre de forma deliberada y añada valores predeterminados en los marcadores cuando necesite un comportamiento alternativo equivalente.
</note>

<note>
Una sola entrada <code>config.aws</code> puede reutilizarse entre servicios respaldados por AWS. <code>queue.driver.sqs</code> referencia la misma entrada mediante su campo <code>config:</code>.
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
| `bucket` | string | Sí | Nombre del bucket S3. Proporciónelo mediante `${env:NAME}` cuando cambie por deployment |
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

## API Lua

Consulte el [módulo Cloud Storage](../lua/storage/cloud.md) para las operaciones (listar, subir, descargar, eliminar y URLs prefirmadas).

## Ver También

- [Módulo Cloud Storage](../lua/storage/cloud.md) - Referencia de la API Lua
- [Filesystem](./filesystem.md) - Entradas de filesystem local
- [Queue](./queue.md) - El handler SQS comparte las mismas entradas `config.aws`
