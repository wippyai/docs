---
title: "Bootloader"
description: "Configure funções de bootloader ordenadas para tarefas idempotentes de inicialização da aplicação."
---

# Bootloader

O módulo `wippy/bootloader` orquestra a inicialização da aplicação descobrindo e executando funções de bootloader em uma ordem definida. Outros módulos do framework — migrações, criptografia e atualização de índices — registram bootloaders para executar suas próprias etapas de inicialização.

Esta página é uma receita parcial de integração e uma referência de API, não uma aplicação independente. A definição abaixo é estruturalmente completa, mas `apply_seed()` representa código da aplicação que precisa implementar a operação de semeadura real e sua verificação de idempotência. Qualquer limpeza ou reversão persistente depende dessa operação específica da aplicação.

## Configuracao

Adicione o modulo ao seu projeto:

```bash
wippy add wippy/bootloader
wippy install
```

Declare a dependencia e o host de aplicacao requerido:

```yaml
version: "1.0"
namespace: app

entries:
  - name: processes
    kind: process.host
    lifecycle:
      auto_start: true

  - name: os_env
    kind: env.storage.os

  - name: dep.bootloader
    kind: ns.dependency
    component: wippy/bootloader
    version: "*"
    parameters:
      - name: application_host
        value: app:processes
      - name: env_storage
        value: app:os_env
```

O bootloader em si executa como `wippy.bootloader:bootloader.service` (um `process.service` com `auto_start: true`). Nada mais e necessario para ativa-lo.

## Como Funciona

Na inicializacao o bootloader:

1. Descobre cada entrada com `meta.type: bootloader` no registro.
2. Ordena-as por `meta.order` em ordem ascendente (menor primeiro).
3. Executa cada uma sequencialmente como uma funcao Lua.
4. Para no primeiro erro que retorna `status = "error"`.
5. Reporta os totais / sucessos / falhas / ignorados quando termina.

Os bootloaders sao autonomos -- cada um verifica suas proprias condicoes, faz seu trabalho e reporta um resultado estruturado.

## Definindo um Bootloader

Um bootloader é qualquer entrada `function.*` com `meta.type: bootloader`. A maioria dos bootloaders de aplicações usa `function.lua`:

```yaml
- name: seed_defaults
  kind: function.lua
  meta:
    type: bootloader
    order: 50
    description: Seed default rows for a new install
  source: file://seed_defaults.lua
  method: run
  modules:
    - logger
  imports:
    sql: :sql
```

| Campo | Obrigatorio | Descricao |
|-------|----------|-------------|
| `meta.type` | Sim | Deve ser `bootloader` |
| `meta.order` | Não | Ordem de execução (padrão `999`); valores menores executam primeiro |
| `meta.description` | Nao | Resumo legivel por humanos |
| `meta.requires` | Nao | Dicas de dependencia exibidas nos logs |

### Contrato de Retorno

O `method` retorna uma tabela descrevendo o resultado:

```lua
local function run()
    local ok, err = apply_seed()
    if err then
        return {
            status = "error",
            message = "seed failed: " .. tostring(err)
        }
    end

    if not ok then
        return {
            status = "skipped",
            message = "already seeded"
        }
    end

    return {
        status = "success",
        message = "seeded default rows"
    }
end

return { run = run }
```

| Status | Significado |
|--------|---------|
| `success` | Trabalho concluido |
| `skipped` | Sem operacao (ja feito, pre-condicao nao atendida) |
| `error` | Falha -- interrompe a sequencia de boot |

Um bootloader que gera um erro Lua, retorna um erro de execução ou retorna um valor que não seja uma tabela é convertido em um resultado `error`. O orquestrador mede e sobrescreve `duration`; um valor `details` retornado é preservado para logging.

Use exatamente as três strings de status. Outro valor é registrado como `UNKNOWN`, não é incluído em um contador de status e atualmente não interrompe os bootloaders posteriores.

## Ordem de Execucao

Valores menores de `order` executam primeiro. Reserve ordens baixas para infraestrutura:

| Ordem | Uso típico |
|-------|-------------|
| `10` | Segredos e chaves de criptografia (fornecido pelo modulo) |
| `20` | Migracoes de schema (fornecido por `wippy/migration`) |
| `50` | Semeadura de dados, aquecimento de indice de busca |
| `100` | Tarefas no nível da aplicação (convenção) |

Quando dois bootloaders compartilham uma ordem, eles executam em ordem alfabética pelo ID totalmente qualificado da entrada.

## Bootloaders Integrados

### Chave de Criptografia (ordem `10`)

Gera 32 bytes aleatórios, codifica-os como uma `ENCRYPTION_KEY` hexadecimal de 64 caracteres e armazena o valor pelo `env_storage` configurado quando nenhum valor está presente. É ignorado quando a variável já existe.

### Bootloader de Migracao (ordem `20`)

Fornecido por `wippy/migration`. Descobre cada entrada com `meta.type: migration`, agrupa-as por `meta.target_db` e aplica as pendentes. Veja [Migrações](framework/migration.md).

## Observando o Status de Boot

O serviço registra a contagem descoberta e depois uma linha de resultado por bootloader executado (`SUCCESS`, `FAILED`, `SKIPPED`), com o ID da entrada, a ordem e a duração. O resumo final informa as contagens executadas e por status. Um bootloader com falha interrompe os posteriores e faz o orquestrador retornar `false` com suas estatísticas; ele não gera sozinho um erro de processo Lua.

<tip>
Mantenha os bootloaders idempotentes. Eles executam novamente sempre que `bootloader.service` é iniciado, portanto verifique as pré-condições — linha existente, arquivo presente, variável de ambiente definida — antes de realizar o trabalho.
</tip>

## Veja Tambem

- [Migrações](framework/migration.md) — Bootloader de migração e DSL
- [Supervisão](guides/supervision.md) — Ciclo de vida do serviço e política de reinicialização
- [Visão Geral do Framework](framework/overview.md) — Uso dos módulos do framework
