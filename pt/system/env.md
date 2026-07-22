---
title: "Sistema de Ambiente"
description: "Gerencia variáveis de ambiente através de backends de armazenamento configuráveis."
---

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
| `env.storage.static` | Armazenamento estático somente leitura de chave-valor |
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

### Armazenamento Estático

Armazenamento somente leitura com valores definidos diretamente na configuração. Os valores são incorporados na entrada e não podem ser alterados em tempo de execução. Útil para constantes de configuração públicas que acompanham um módulo ou pacote.

```yaml
- name: defaults
  kind: env.storage.static
  values:
    PUBLIC_API_HOST: "https://api.example.com"
    PUBLIC_WS_HOST: "wss://api.example.com/ws"
    APP_ENV: "production"
```

| Propriedade | Tipo | Descrição |
|-------------|------|-----------|
| `values` | map | Pares chave-valor (string para string) |

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

## Interpolação de Placeholders

Variáveis registradas são trazidas para a configuração de entradas com placeholders `${env:NAME}`, resolvidos centralmente no momento do decode contra este registro. Qualquer campo string nos dados de uma entrada pode referenciar uma variável dessa forma.

| Sintaxe | Significado |
|---------|-------------|
| `${env:NAME}` | Resolve `NAME` pelo registro de env; erro se não definida e sem default |
| `${env:NAME\|default}` | Resolve `NAME`, recorrendo a `default` quando não definida |
| `${NAME\|default}` | Forma abreviada; `NAME` deve ser upper-snake (`A-Z0-9_`) e o `\|default` é obrigatório — um `${VAR}` puro é deixado intacto para que trechos de shell/template embutidos não sejam confundidos com referências |
| `$${` | `${` literal (escape) |

`NAME` é o nome público de uma variável registrada ou seu ID de entrada (forma de id de registro com pontos/dois-pontos, p. ex. `app.env:tls_cert`). **Não** é uma variável de ambiente crua do SO: um valor do SO só é alcançável quando uma variável com backend `env.storage.os` está registrada sob esse nome.

```yaml
- name: api
  kind: http.service
  addr: ":443"
  tls:
    mode: manual
    cert: ${env:app.env:tls_cert}
    key:  ${env:app.env:tls_key}
```

Um campo cujo valor inteiro é um único placeholder recebe o valor tipado da variável (coagido para bool/int/float quando um default tipado é dado); um placeholder misturado com texto ao redor interpola para uma string. O `default` próprio da variável é honrado antes do `|default` inline do placeholder. Uma referência que resolve para nada e não tem default falha o decode.

A resolução acontece apenas no momento do decode: a entrada armazenada no registro mantém os placeholders crus, então segredos resolvidos nunca aparecem em resultados de `registry.get` nem em estado persistido. Entradas que referenciam `${env:...}` são ordenadas automaticamente depois dos armazenamentos e variáveis de env dos quais dependem no boot.

<note>
Configurações mais antigas usam uma diretiva irmã <code>&lt;campo&gt;_env</code> (por exemplo <code>cert_env: app.env:tls_cert</code>) que resolve da mesma forma. Essa forma está <b>obsoleta</b> — migre-a para o placeholder <code>${env:NAME}</code>. Uma chave <code>&lt;campo&gt;_env</code> que nomeia uma variável não registrada não é tratada como diretiva e é deixada como está; uma que nomeia uma variável registrada mas vazia mantém o valor inline de <code>&lt;campo&gt;</code>. Apenas um <code>${env:NAME}</code> explícito sem default falha de forma definitiva com uma variável ausente.
</note>

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
