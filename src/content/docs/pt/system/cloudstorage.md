---
title: "Armazenamento em Nuvem"
---

# Armazenamento em Nuvem

Armazenamento de objetos compatível com S3 com URLs pré-assinadas.

## Tipos de Entradas

| Tipo | Descrição |
|------|-----------|
| `config.aws` | Configuração de credenciais e região AWS |
| `cloudstorage.s3` | Conexão com bucket S3 |

## Configuração AWS

```yaml
- name: aws_config
  kind: config.aws
  region: "us-east-1"
  access_key_id_env: "AWS_ACCESS_KEY_ID"
  secret_access_key_env: "AWS_SECRET_ACCESS_KEY"
```

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| `region` | string | Condicional | Região AWS. Obrigatório a menos que `region_env` seja definido |
| `region_env` | string | Condicional | Nome da variável de ambiente que contém a região |
| `access_key_id_env` | string | Não | Nome da variável de ambiente para chave de acesso |
| `secret_access_key_env` | string | Não | Nome da variável de ambiente para chave secreta |

Credenciais carregam das variáveis de ambiente especificadas. Tanto `access_key_id_env` quanto `secret_access_key_env` devem resolver para valores não vazios para que credenciais estáticas se apliquem; caso contrário, a cadeia de credenciais padrão do SDK AWS é usada (roles IAM, perfis de instância, etc.).

Requisições são assinadas com AWS Signature Version 4 pelo SDK AWS usando as credenciais resolvidas. Nenhuma configuração de assinatura é necessária.

<note>
Use as variantes <code>_env</code> (<code>region_env</code>, e <code>bucket_env</code>/<code>endpoint_env</code> abaixo) quando um valor difere por deployment. O nome da variável é resolvido do registro de ambiente na inicialização.
</note>

<note>
A configuração AWS está planejada para ser compartilhada com outros serviços AWS (SQS, etc.) em releases futuros.
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
| `bucket` | string | Condicional | Nome do bucket S3. Obrigatório a menos que `bucket_env` seja definido |
| `bucket_env` | string | Condicional | Nome da variável de ambiente que contém o nome do bucket |
| `config` | referência | Sim | Referência da entrada de configuração AWS |
| `endpoint` | string | Não | Endpoint personalizado para serviços compatíveis com S3 |
| `endpoint_env` | string | Não | Nome da variável de ambiente que contém o endpoint personalizado |

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

## API Lua

Veja [Módulo Cloud Storage](lua/storage/cloud.md) para operações (list, upload, download, delete, URLs pré-assinadas).

## Veja Também

- [Módulo Cloud Storage](lua/storage/cloud.md) - Referência da API Lua
- [Filesystem](system/filesystem.md) - Entradas de filesystem local
- [Queue](system/queue.md) - O handler SQS compartilha as mesmas entradas `config.aws`
