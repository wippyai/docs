# Sistema de Ambiente

Gerencia variáveis de ambiente através de backends de armazenamento configuráveis.

## Visão Geral

O sistema de ambiente separa armazenamento de acesso:

- **Armazenamentos** - Onde valores são armazenados (SO, arquivos, memória)
- **Variáveis** - Referências nomeadas a valores em armazenamentos

Variáveis podem ser referenciadas por:
- **Nome público** - O valor do campo `variable` (deve ser único no sistema)
- **ID de entrada** - Referência completa `namespace:name`

Se você não quer que uma variável seja publicamente acessível pelo nome, omita o campo `variable`.

## Tipos de Entradas

| Tipo | Descrição |
|------|-----------|
| `env.storage.memory` | Armazenamento chave-valor em memória |
| `env.storage.file` | Armazenamento baseado em arquivo (formato .env) |
| `env.storage.os` | Acesso somente leitura ao ambiente do SO |
| `env.storage.router` | Encadeia múltiplos armazenamentos |
| `env.variable` | Variável nomeada referenciando um armazenamento |

## Backends de Armazenamento

### Armazenamento em Memória

Armazenamento volátil em memória.

```yaml
- name: runtime_env
  kind: env.storage.memory
```

### Armazenamento em Arquivo

Armazenamento persistente usando formato de arquivo `.env` (`KEY=VALUE` com comentários `#`).

```yaml
- name: app_config
  kind: env.storage.file
  file_path: /etc/app/config.env
  auto_create: true
  file_mode: 0600
  dir_mode: 0700
```

| Propriedade | Tipo | Padrão | Descrição |
|-------------|------|--------|-----------|
| `file_path` | string | obrigatório | Caminho para arquivo .env |
| `auto_create` | boolean | false | Cria arquivo se ausente |
| `file_mode` | integer | 0644 | Permissões do arquivo |
| `dir_mode` | integer | 0755 | Permissões do diretório |

### Armazenamento do SO

Acesso somente leitura a variáveis de ambiente do sistema operacional.

```yaml
- name: os_env
  kind: env.storage.os
```

Sempre somente leitura. Operações de escrita retornam `PERMISSION_DENIED`.

### Armazenamento Router

Encadeia múltiplos armazenamentos. Leituras buscam em ordem até encontrar. Escritas vão para o primeiro armazenamento apenas.

```yaml
- name: config
  kind: env.storage.router
  storages:
    - app.config:memory    # Principal (escreve aqui)
    - app.config:file      # Fallback
    - app.config:os        # Fallback
```

| Propriedade | Tipo | Descrição |
|-------------|------|-----------|
| `storages` | array | Lista ordenada de referências de armazenamento |

## Variáveis

Variáveis fornecem acesso nomeado a valores de armazenamento.

```yaml
- name: DATABASE_URL
  kind: env.variable
  variable: DATABASE_URL
  storage: app.config:file
  default: postgres://localhost/app
  read_only: false
```

| Propriedade | Tipo | Descrição |
|-------------|------|-----------|
| `variable` | string | Nome público da variável (opcional, deve ser único) |
| `storage` | string | Referência de armazenamento (`namespace:name`) |
| `default` | string | Valor padrão se não encontrado |
| `read_only` | boolean | Previne modificações |

### Nomenclatura de Variáveis

Nomes de variáveis devem conter apenas: `a-z`, `A-Z`, `0-9`, `_`

### Padrões de Acesso

```yaml
# Variável pública - acessível pelo nome "PORT"
- name: port_var
  kind: env.variable
  variable: PORT
  storage: app.config:os
  default: "8080"

# Variável privada - acessível apenas pelo ID "app.config:internal_key"
- name: internal_key
  kind: env.variable
  storage: app.config:secrets
```

## Erros

| Condição | Tipo | Retentável |
|----------|------|------------|
| Variável não encontrada | `errors.NOT_FOUND` | não |
| Armazenamento não encontrado | `errors.NOT_FOUND` | não |
| Variável é somente leitura | `errors.PERMISSION_DENIED` | não |
| Armazenamento é somente leitura | `errors.PERMISSION_DENIED` | não |
| Nome de variável inválido | `errors.INVALID` | não |

## Acesso em Tempo de Execução

- [módulo env](lua/system/env.md) - Acesso em tempo de execução Lua

## Veja Também

- [Modelo de Segurança](system/security.md) - Controle de acesso para variáveis de ambiente
- [Guia de Configuração](guides/configuration.md) - Padrões de configuração de aplicação
