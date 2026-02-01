# Armazenamento em Nuvem

Armazenamento de objetos compativel com S3 com URLs pre-assinadas.

## Tipos de Entradas

| Tipo | Descricao |
|------|-----------|
| `config.aws` | Configuracao de credenciais e regiao AWS |
| `cloudstorage.s3` | Conexao com bucket S3 |

## Configuracao AWS

```yaml
- name: aws_config
  kind: config.aws
  region: "us-east-1"
  access_key_id_env: "AWS_ACCESS_KEY_ID"
  secret_access_key_env: "AWS_SECRET_ACCESS_KEY"
```

| Campo | Tipo | Obrigatorio | Descricao |
|-------|------|-------------|-----------|
| `region` | string | Sim | Regiao AWS |
| `access_key_id_env` | string | Nao | Nome da variavel de ambiente para chave de acesso |
| `secret_access_key_env` | string | Nao | Nome da variavel de ambiente para chave secreta |

Credenciais carregam das variaveis de ambiente especificadas. Se omitido, usa cadeia de credenciais padrao do SDK AWS (roles IAM, perfis de instancia, etc.).

<note>
A configuracao AWS esta planejada para ser compartilhada com outros servicos AWS (SQS, etc.) em releases futuros.
</note>

## Armazenamento S3

```yaml
- name: files
  kind: cloudstorage.s3
  bucket: "my-bucket"
  config: app.infra:aws_config
```

| Campo | Tipo | Obrigatorio | Descricao |
|-------|------|-------------|-----------|
| `bucket` | string | Sim | Nome do bucket S3 |
| `config` | referencia | Sim | Referencia da entrada de configuracao AWS |
| `endpoint` | string | Nao | Endpoint personalizado para servicos compativeis com S3 |

### Servicos Compativeis com S3

Para MinIO ou outros servicos compativeis com S3, defina um endpoint personalizado:

```yaml
- name: local_storage
  kind: cloudstorage.s3
  bucket: "local-bucket"
  config: app.infra:aws_config
  endpoint: "http://localhost:9000"
```

Quando um endpoint e fornecido, o acesso por estilo de caminho e habilitado automaticamente.

## API Lua

Veja [Modulo Cloud Storage](lua-cloudstorage.md) para operacoes (list, upload, download, delete, URLs pre-assinadas).
