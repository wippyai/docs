---
title: "Linter"
description: "Use o linter Lua integrado para verificação de tipos, análise estática, filtragem, cache e saída para CI."
---

# Linter

Execute `wippy lint` para verificar tipos e analisar estaticamente entradas Lua.

## Uso

```bash
wippy lint                        # Check all Lua entries
wippy lint --level hint           # Show all diagnostics including hints
wippy lint --json                 # Output in JSON format
wippy lint --ns app               # Check only the app namespace
wippy lint --summary              # Group results by error code
```

## O Que É Verificado

O linter valida todos os kinds de entrada Lua:

- `function.lua` — Funções
- `library.lua` — Bibliotecas
- `process.lua` — Processos
- `workflow.lua` — Workflows

Entradas de bytecode contêm bytecode compilado (fs/path/hash), não código-fonte, portanto não podem ser analisadas sintaticamente nem ter seus tipos verificados. O linter verifica somente entradas Lua que contêm código-fonte; suas variantes `.bc` são ignoradas, embora ainda possam aparecer na contagem total de entradas.

Cada entrada é analisada sintaticamente, tem seus tipos verificados e é examinada em busca de problemas de correção.

## Níveis de Severidade

Os diagnósticos têm três níveis de severidade:

| Nível | Descrição |
|-------|-----------|
| `error` | Erros de tipo e problemas de correção que precisam ser corrigidos |
| `warning` | Bugs prováveis ou padrões problemáticos |
| `hint` | Sugestões de estilo e notas informativas |

Controle quais níveis aparecem com `--level`:

```bash
wippy lint --level error          # Errors only
wippy lint --level warning        # Warnings and errors (default)
wippy lint --level hint           # Everything
```

## Códigos de Erro

### Erros de Análise Sintática

| Código | Descrição |
|--------|-----------|
| `P0001` | Erro de sintaxe Lua — o código-fonte não pode ser analisado |

### Erros de Verificação de Tipos (Série E)

Os erros do verificador de tipos (`E0001`+) informam problemas encontrados pelo sistema de tipos: incompatibilidades de tipo, variáveis indefinidas, operações inválidas e problemas semelhantes de correção. Eles sempre são apresentados como erros.

```lua
local x: number = "hello"         -- E: string not assignable to number

local function add(a: number, b: number): number
    return a + b
end

add("one", "two")                  -- E: string not assignable to number
```

### Requires Não Declarados

Um `require("name")` com literal de string cujo módulo não esteja nas declarações `imports`/`modules` da entrada nem seja um builtin ambiente falha com:

```
require("name") is not declared in _index.yaml imports or modules
```

Essa verificação sempre é executada — não depende de `--rules` — e é apresentada como erro. Declare o módulo para satisfazê-la:

```yaml
imports:
  json: wippy.stdlib:json    # alias -> registry id
modules:
  - funcs                    # bare module name
```

Requires dinâmicos (`require(variable)`) não são inspecionados. O linter e o runtime compartilham o conjunto de módulos ambientes, que inclui módulos disponíveis sem declaração, como `process` em kinds executáveis.

### Avisos das Regras de Lint (Série W)

As regras de lint realizam verificações de estilo e qualidade. Habilite-as com `--rules`:

```bash
wippy lint --rules
```

| Código | Regra | Descrição |
|--------|-------|-----------|
| `W0001` | no-empty-blocks | Blocos de instruções vazios |
| `W0002` | no-global-assign | Atribuição a variáveis globais |
| `W0003` | no-self-compare | Comparação de um valor consigo mesmo |
| `W0004` | no-unused-vars | Variáveis locais não utilizadas |
| `W0005` | no-unused-params | Parâmetros de função não utilizados |
| `W0006` | no-unused-imports | Instruções de importação não utilizadas |
| `W0007` | no-shadowed-vars | Variável que oculta um escopo externo |

Sem `--rules`, somente a verificação de tipos — códigos P e E — é realizada.

## Filtragem

### Por Namespace

Verifique namespaces específicos com `--ns`:

```bash
wippy lint --ns app               # Exact namespace match
wippy lint --ns "app.*"           # All under app
wippy lint --ns app --ns lib      # Multiple namespaces
```

As dependências das entradas selecionadas são carregadas para a verificação de tipos, mas seus diagnósticos não são apresentados.

### Por Código de Erro

Filtre diagnósticos por código:

```bash
wippy lint --code E0001
wippy lint --code E0001 --code E0004
```

### Por Quantidade

Limite o número de diagnósticos exibidos:

```bash
wippy lint --limit 10             # Show first 10 issues
```

## Formatos de Saída

### Formato de Tabela (Padrão)

Cada diagnóstico é exibido com o contexto do código-fonte, a localização do arquivo e a mensagem de erro. Os resultados são ordenados por entrada, severidade e número da linha.

Uma linha de resumo apresenta os totais:

```
Checked 42 entries: 5 errors, 12 warnings
```

### Formato de Resumo

Agrupa os diagnósticos por namespace e código de erro:

```bash
wippy lint --summary
```

```
By namespace:

  app                              15 issues (5 errors, 10 warnings)
  lib                               2 issues (2 warnings)

By error code:

  E0001      [error  ]    5 occurrences
  E0004      [error  ]    3 occurrences

Checked 42 entries: 5 errors, 12 warnings
```

### Formato JSON

Saída legível por máquina para processamento em CI/CD:

```bash
wippy lint --json
```

```json
{
  "diagnostics": [
    {
      "entry_id": "app:handler",
      "code": "E0001",
      "severity": "error",
      "message": "string not assignable to number",
      "line": 10,
      "column": 5
    }
  ],
  "total_entries": 42,
  "error_count": 5,
  "warning_count": 12,
  "hint_count": 0
}
```

## Cache

O linter mantém os resultados em cache entre execuções. As chaves do cache incluem o hash do código-fonte, o nome do método, as dependências e a configuração do sistema de tipos.

Limpe o cache se os resultados parecerem desatualizados:

```bash
wippy lint --cache-reset
```

## Integração com CI

Nos modos de tabela e resumo, o comando retorna um código diferente de zero quando o resultado filtrado contém erros. Warnings e hints não afetam o código de saída, mesmo quando `--level warning` ou `--level hint` os exibe.

O modo JSON é diferente: depois de codificar o resultado com sucesso, `wippy lint --json` retorna o código 0 mesmo quando `error_count` é diferente de zero. Um job de CI que use a saída JSON precisa analisar `error_count` por conta própria. Para usar o código de saída do comando como critério, execute uma chamada sem JSON:

```bash
wippy lint --level error
```

Você pode gerar um relatório separadamente, sem tratar seu código de saída como o resultado do lint:

```bash
wippy lint --json --level error > lint-results.json
```

Exemplo de etapa do GitHub Actions:

```yaml
- name: Lint
  run: wippy lint --level warning
```

## Referência de Flags

| Flag | Curta | Padrão | Descrição |
|------|-------|--------|-----------|
| `--level` | | warning | Nível mínimo de severidade (error, warning, hint) |
| `--json` | | false | Saída em formato JSON |
| `--ns` | | | Filtrar por padrões de namespace |
| `--code` | | | Filtrar por códigos de erro |
| `--limit` | | 0 | Número máximo de diagnósticos exibidos (0 = ilimitado) |
| `--summary` | | false | Agrupar por código de erro |
| `--no-color` | | false | Desabilitar a saída colorida |
| `--rules` | | false | Habilitar regras de lint (verificações de estilo/qualidade da série W) |
| `--cache-reset` | | false | Limpar o cache antes do lint |
| `--profile` | | | Aplicar um profile do workspace a partir da configuração de runtime mesclada; repita para aplicar profiles em ordem |
| `--set` | | | Sobrescrever um valor da configuração mesclada como `section.path=value`; repita para várias sobrescritas |
| `--lock-file` | `-l` | wippy.lock | Caminho do arquivo de lock |

## Consulte Também

- [CLI](guides/cli.md) — Referência completa do CLI
- [Tipos](lua/types.md) — Documentação do sistema de tipos
- [LSP](guides/lsp.md) — Integração com editores e diagnósticos em tempo real
