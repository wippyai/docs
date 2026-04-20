# Bootloader

O modulo `wippy/bootloader` orquestra a inicializacao da aplicacao descobrindo e executando funcoes de bootloader em uma ordem definida na inicializacao. Outros modulos do framework (migracoes, criptografia, atualizacao de indices) registram bootloaders para executar seus proprios passos de inicializacao.

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

Um bootloader e qualquer entrada `function.lua` com `meta.type: bootloader`:

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
| `meta.order` | Nao | Ordem de execucao (padrao `100`); menor executa primeiro |
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

Um bootloader que lanca um erro Lua e tratado como `error`.

## Ordem de Execucao

Valores menores de `order` executam primeiro. Reserve ordens baixas para infraestrutura:

| Order | Uso Tipico |
|-------|-------------|
| `10` | Segredos e chaves de criptografia (fornecido pelo modulo) |
| `20` | Migracoes de schema (fornecido por `wippy/migration`) |
| `50` | Semeadura de dados, aquecimento de indice de busca |
| `100` | Padrao -- tarefas em nivel de aplicacao |

Quando dois bootloaders compartilham uma ordem, a ordem de execucao entre eles nao e garantida.

## Bootloaders Integrados

### Chave de Criptografia (ordem `10`)

Gera uma `ENCRYPTION_KEY` de 256 bits e a armazena atraves do `env_storage` configurado se nenhum valor estiver presente. Outros modulos (seguranca, rastreamento de uso) leem esta variavel para criptografia envelope. E ignorado quando a variavel ja existe.

### Bootloader de Migracao (ordem `20`)

Fornecido por `wippy/migration`. Descobre cada entrada com `meta.type: migration`, agrupa-as por `meta.target_db` e aplica as pendentes. Veja [Migracoes](framework/migration.md).

## Observando o Status de Boot

O servico registra uma linha por bootloader (`SUCCESS`, `FAILED`, `SKIPPED`) com o ID da entrada, ordem e duracao. A linha de resumo final reporta os totais agregados. Um bootloader que falha aborta a inicializacao -- a politica de reinicio do supervisor entao se aplica a `bootloader.service`.

<tip>
Mantenha os bootloaders idempotentes. Eles podem executar novamente apos um reinicio por crash, entao verifique pre-condicoes (linha existe, arquivo presente, variavel env definida) antes de fazer o trabalho.
</tip>

## Veja Tambem

- [Migracoes](framework/migration.md) - Bootloader de migracao e DSL
- [Supervisao](guides/supervision.md) - Ciclo de vida do servico e politica de reinicio
- [Visao Geral do Framework](framework/overview.md) - Uso de modulos do framework
