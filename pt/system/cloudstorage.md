---
title: "Armazenamento em Nuvem"
description: "Armazenamento de objetos compatível com S3 com URLs pré-assinadas, uploads multipart e leituras por intervalo."
---

# Armazenamento em Nuvem
<secondary-label ref="external"/>

Armazenamento de objetos compatível com S3 com URLs pré-assinadas, uploads multipart e leituras por intervalo.

## Tipos de Entradas

| Tipo | Descrição |
|------|-----------|
| `config.aws` | Configuração de credenciais e região AWS |
| `cloudstorage.s3` | Conexão com bucket S3 |

## Configuração AWS

```yaml
- name: aws_config
  kind: config.aws
  region: ${env:AWS_REGION}
  access_key_id: ${env:AWS_ACCESS_KEY_ID}
  secret_access_key: ${env:AWS_SECRET_ACCESS_KEY}
```

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| `region` | string | Sim | Região AWS. Forneça via `${env:NAME}` quando difere por deployment |
| `access_key_id` | string | Não | ID da chave de acesso AWS (inline ou `${env:NAME}`) |
| `secret_access_key` | string | Não | Chave de acesso secreta AWS (inline ou `${env:NAME}`) |

Credenciais são resolvidas a partir do [registro de ambiente](system/env.md) no momento da decodificação. Tanto `access_key_id` quanto `secret_access_key` devem resolver para valores não vazios para que credenciais estáticas se apliquem; caso contrário, a cadeia de credenciais padrão do SDK AWS é usada (roles IAM, perfis de instância, etc.).

Requisições são assinadas com AWS Signature Version 4 pelo SDK AWS usando as credenciais resolvidas. Nenhuma configuração de assinatura é necessária.

<note>
Configurações antigas usam uma diretiva irmã <code>&lt;field&gt;_env</code> (<code>region_env</code>, <code>access_key_id_env</code>, <code>secret_access_key_env</code>) que resolve da mesma forma. Essa forma está <b>obsoleta</b> — migre-a para o placeholder <code>${env:NAME}</code> mostrado acima.
</note>

<note>
Uma única entrada <code>config.aws</code> pode ser reutilizada entre serviços apoiados pela AWS. <code>queue.driver.sqs</code> referencia a mesma entrada através de seu campo <code>config:</code>.
</note>

## Armazenamento S3

```yaml
- name: files
  kind: cloudstorage.s3
  bucket: "my-bucket"
  config: app.infra:aws_config
```

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| `bucket` | string | Condicional | Nome do bucket S3. Forneça via `${env:NAME}` quando difere por deployment |
| `config` | referência | Sim | Referência da entrada de configuração AWS |
| `endpoint` | string | Não | Endpoint personalizado para serviços compatíveis com S3 (inline ou `${env:NAME}`) |

### Serviços Compatíveis com S3

Para MinIO ou outros serviços compatíveis com S3, defina um endpoint personalizado:

```yaml
- name: local_storage
  kind: cloudstorage.s3
  bucket: "local-bucket"
  config: app.infra:aws_config
  endpoint: "http://localhost:9000"
```

Quando um endpoint é fornecido, o acesso por estilo de caminho é habilitado automaticamente.

## Uploads Multipart

Uploads multipart pré-assinados são uma capacidade do provedor, não um recurso do runtime. O kind `cloudstorage.s3` os implementa; um provedor que não suporta o protocolo multipart falha `create_multipart_upload`, `presigned_part_urls`, `complete_multipart_upload` e `abort_multipart_upload` com `errors.UNAVAILABLE`.

As partes de um upload que nunca é concluído ou abortado permanecem armazenadas e cobradas. As aplicações abortam em todos os caminhos de falha, mas um cliente que trava não deixa nada para executar esse abort. Configure uma regra de ciclo de vida `AbortIncompleteMultipartUpload` no bucket como salvaguarda:

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

## Leituras por Intervalo

`open_reader` lê um objeto através de GETs por intervalo e fixa o ETag do objeto com `If-Match` em cada leitura. Um provedor que não retorna um ETag no stat inicial falha a chamada com `errors.UNAVAILABLE`, e um provedor que ignora `If-Match` perde a proteção contra sobrescrita - a leitura então não consegue detectar que misturou duas gerações do objeto.

## API Lua

Veja [Módulo Cloud Storage](lua/storage/cloud.md) para operações (list, upload, download, delete, URLs pré-assinadas, uploads multipart, leitores por intervalo).

## Veja Também

- [Módulo Cloud Storage](lua/storage/cloud.md) - Referência da API Lua
- [Filesystem](system/filesystem.md) - Entradas de filesystem local
- [Queue](system/queue.md) - O handler SQS compartilha as mesmas entradas `config.aws`
