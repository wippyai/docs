# Sistema de Ambiente

Gerencia variaveis de ambiente atraves de backends de armazenamento configuraveis.

## Visao Geral

O sistema de ambiente separa armazenamento de acesso:

- **Armazenamentos** - Onde valores sao armazenados (SO, arquivos, memoria)
- **Variaveis** - Referencias nomeadas a valores em armazenamentos

Variaveis podem ser referenciadas por:
- **Nome publico** - O valor do campo `variable` (deve ser unico no sistema)
- **ID de entrada** - Referencia completa `namespace:name`

Se voce nao quer que uma variavel seja publicamente acessivel pelo nome, omita o campo `variable`.

## Tipos de Entradas

| Tipo | Descricao |
|------|-----------|
| `env.storage.memory` | Armazenamento chave-valor em memoria |
| `env.storage.file` | Armazenamento baseado em arquivo (formato .env) |
| `env.storage.os` | Acesso somente leitura ao ambiente do SO |
| `env.storage.router` | Encadeia multiplos armazenamentos |
| `env.variable` | Variavel nomeada referenciando um armazenamento |

## Backends de Armazenamento

### Armazenamento em Memoria

Armazenamento volatil em memoria.

```yaml
- name: runtime_env
  kind: env.storage.memory
```

### Armazenamento em Arquivo

Armazenamento persistente usando formato de arquivo `.env` (`KEY=VALUE` com comentarios `#`).

```yaml
- name: app_config
  kind: env.storage.file
  file_path: /etc/app/config.env
  auto_create: true
  file_mode: 0600
  dir_mode: 0700
```

| Propriedade | Tipo | Padrao | Descricao |
|-------------|------|--------|-----------|
| `file_path` | string | obrigatorio | Caminho para arquivo .env |
| `auto_create` | boolean | false | Cria arquivo se ausente |
| `file_mode` | integer | 0644 | Permissoes do arquivo |
| `dir_mode` | integer | 0755 | Permissoes do diretorio |

### Armazenamento do SO

Acesso somente leitura a variaveis de ambiente do sistema operacional.

```yaml
- name: os_env
  kind: env.storage.os
```

Sempre somente leitura. Operacoes de escrita retornam `PERMISSION_DENIED`.

### Armazenamento Router

Encadeia multiplos armazenamentos. Leituras buscam em ordem ate encontrar. Escritas vao para o primeiro armazenamento apenas.

```yaml
- name: config
  kind: env.storage.router
  storages:
    - app.config:memory    # Principal (escreve aqui)
    - app.config:file      # Fallback
    - app.config:os        # Fallback
```

| Propriedade | Tipo | Descricao |
|-------------|------|-----------|
| `storages` | array | Lista ordenada de referencias de armazenamento |

## Variaveis

Variaveis fornecem acesso nomeado a valores de armazenamento.

```yaml
- name: DATABASE_URL
  kind: env.variable
  variable: DATABASE_URL
  storage: app.config:file
  default: postgres://localhost/app
  read_only: false
```

| Propriedade | Tipo | Descricao |
|-------------|------|-----------|
| `variable` | string | Nome publico da variavel (opcional, deve ser unico) |
| `storage` | string | Referencia de armazenamento (`namespace:name`) |
| `default` | string | Valor padrao se nao encontrado |
| `read_only` | boolean | Previne modificacoes |

### Nomenclatura de Variaveis

Nomes de variaveis devem conter apenas: `a-z`, `A-Z`, `0-9`, `_`

### Padroes de Acesso

```yaml
# Variavel publica - acessivel pelo nome "PORT"
- name: port_var
  kind: env.variable
  variable: PORT
  storage: app.config:os
  default: "8080"

# Variavel privada - acessivel apenas pelo ID "app.config:internal_key"
- name: internal_key
  kind: env.variable
  storage: app.config:secrets
```

## Erros

| Condicao | Tipo | Retentavel |
|----------|------|------------|
| Variavel nao encontrada | `errors.NOT_FOUND` | nao |
| Armazenamento nao encontrado | `errors.NOT_FOUND` | nao |
| Variavel e somente leitura | `errors.PERMISSION_DENIED` | nao |
| Armazenamento e somente leitura | `errors.PERMISSION_DENIED` | nao |
| Nome de variavel invalido | `errors.INVALID` | nao |

## Acesso em Tempo de Execucao

- [modulo env](lua-env.md) - Acesso em tempo de execucao Lua

## Veja Tambem

- [Modelo de Seguranca](system-security.md) - Controle de acesso para variaveis de ambiente
- [Guia de Configuracao](guide-configuration.md) - Padroes de configuracao de aplicacao
