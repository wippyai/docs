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
| `region` | string | Sim | Região AWS |
| `access_key_id_env` | string | Não | Nome da variável de ambiente para chave de acesso |
| `secret_access_key_env` | string | Não | Nome da variável de ambiente para chave secreta |

Credenciais carregam das variáveis de ambiente especificadas. Se omitido, usa cadeia de credenciais padrão do SDK AWS (roles IAM, perfis de instância, etc.).

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
| `bucket` | string | Sim | Nome do bucket S3 |
| `config` | referência | Sim | Referência da entrada de configuração AWS |
| `endpoint` | string | Não | Endpoint personalizado para serviços compatíveis com S3 |

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

Veja [Módulo Cloud Storage](lua-cloudstorage.md) para operações (list, upload, download, delete, URLs pré-assinadas).
