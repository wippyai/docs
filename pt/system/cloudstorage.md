---
title: "Armazenamento em nuvem"
description: "Configure credenciais AWS e armazenamento de objetos compatível com S3."
---

# Armazenamento em nuvem
<secondary-label ref="external"/>

Entradas de armazenamento em nuvem configuram credenciais AWS e buckets compatíveis com S3 usados pela API de armazenamento Lua. Esta página é uma referência de configuração; os exemplos pressupõem que o bucket e as credenciais indicados, ou a cadeia de credenciais do SDK, já existam.

## Tipos de entrada

| Tipo | Descrição |
|------|-------------|
| `config.aws` | Configuração de credenciais e região AWS |
| `cloudstorage.s3` | Conexão com bucket S3 |

## Configuração AWS

Credenciais estáticas registradas pelo sistema de ambiente:

```yaml
- name: aws_config
  kind: config.aws
  region: ${env:AWS_REGION}
  access_key_id: ${env:AWS_ACCESS_KEY_ID}
  secret_access_key: ${env:AWS_SECRET_ACCESS_KEY}
```

Cadeia padrão de credenciais do SDK AWS (por exemplo, funções IAM ou perfis de instância):

```yaml
- name: aws_config
  kind: config.aws
  region: ${env:AWS_REGION}
```

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|----------|-------------|
| `region` | string | Sim | Região AWS. Forneça via `${env:NAME}` quando variar por implantação |
| `access_key_id` | string | Não | ID da chave de acesso AWS (inline ou `${env:NAME}`) |
| `secret_access_key` | string | Não | Chave secreta de acesso AWS (inline ou `${env:NAME}`) |

Os campos de credenciais são resolvidos pelo [registro de ambiente](./env.md) durante a decodificação. Um placeholder moderno `${env:NAME}` sem valor padrão faz a decodificação falhar quando a variável não existe; para usar a cadeia padrão de credenciais do SDK AWS, omita `access_key_id` e `secret_access_key`. Credenciais estáticas só são aplicadas quando ambos os campos resolvem para valores não vazios.

As solicitações são assinadas pelo SDK AWS com AWS Signature Version 4 usando as credenciais resolvidas. Nenhuma configuração de assinatura é necessária.

<note>
Configurações antigas usam uma diretiva irmã <code>&lt;field&gt;_env</code> (<code>region_env</code>, <code>access_key_id_env</code>, <code>secret_access_key_env</code>), que também consulta o registro de ambiente. Ao contrário de um placeholder moderno sem valor padrão, uma consulta legada não registrada ou vazia preserva o valor inline ou zero. A forma legada está <b>obsoleta</b> — migre-a deliberadamente e adicione valores padrão aos placeholders quando precisar manter o comportamento de fallback equivalente.
</note>

<note>
Uma única entrada <code>config.aws</code> pode ser reutilizada por serviços baseados na AWS. <code>queue.driver.sqs</code> referencia a mesma entrada pelo campo <code>config:</code>.
</note>

## Armazenamento S3

```yaml
- name: files
  kind: cloudstorage.s3
  bucket: "my-bucket"
  config: app.infra:aws_config
```

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|----------|-------------|
| `bucket` | string | Sim | Nome do bucket S3. Forneça via `${env:NAME}` quando variar por implantação |
| `config` | reference | Sim | Referência da entrada de configuração AWS |
| `endpoint` | string | Não | Endpoint personalizado para serviços compatíveis com S3 (inline ou `${env:NAME}`) |

### Serviços compatíveis com S3

Defina um endpoint personalizado para o MinIO ou outro serviço compatível com S3:

```yaml
- name: local_storage
  kind: cloudstorage.s3
  bucket: "local-bucket"
  config: app.infra:aws_config
  endpoint: "http://localhost:9000"
```

Quando um endpoint é fornecido, o acesso em estilo de caminho é ativado automaticamente.

## API Lua

Consulte o [módulo Cloud Storage](../lua/storage/cloud.md) para operações de listagem, upload, download, exclusão e URLs pré-assinadas.

## Veja também

- [Módulo Cloud Storage](../lua/storage/cloud.md) - Referência da API Lua
- [Sistema de arquivos](./filesystem.md) - Entradas de sistema de arquivos local
- [Fila](./queue.md) - O handler SQS compartilha as mesmas entradas `config.aws`
