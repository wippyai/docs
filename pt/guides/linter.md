# Linter

O Wippy inclui um linter integrado que realiza verificacao de tipos e analise estatica em codigo Lua. Execute-o com `wippy lint`.

## Uso

```bash
wippy lint                        # Verifica todas as entradas Lua
wippy lint --level hint           # Mostra todos os diagnosticos incluindo hints
wippy lint --json                 # Saida em formato JSON
wippy lint --ns app               # Verifica apenas o namespace app
wippy lint --summary              # Agrupa resultados por codigo de erro
```

## O Que e Verificado

O linter valida todos os tipos de entradas Lua:

- `function.lua.*` - Funcoes
- `library.lua.*` - Bibliotecas
- `process.lua.*` - Processos
- `workflow.lua.*` - Workflows

Cada entrada e analisada sintaticamente, verificada quanto a tipos e analisada para problemas de corretude.

## Niveis de Severidade

Os diagnosticos possuem tres niveis de severidade:

| Nivel | Descricao |
|-------|-----------|
| `error` | Erros de tipo e problemas de corretude que devem ser corrigidos |
| `warning` | Provaveis bugs ou padroes problematicos |
| `hint` | Sugestoes de estilo e notas informativas |

Controle quais niveis aparecem com `--level`:

```bash
wippy lint --level error          # Apenas erros
wippy lint --level warning        # Warnings e erros (padrao)
wippy lint --level hint           # Tudo
```

## Codigos de Erro

### Erros de Parse

| Codigo | Descricao |
|--------|-----------|
| `P0001` | Erro de sintaxe Lua - codigo-fonte nao pode ser analisado |

### Erros de Verificacao de Tipos (serie E)

Os erros do verificador de tipos (`E0001`+) reportam problemas encontrados pelo sistema de tipos: incompatibilidades de tipo, variaveis indefinidas, operacoes invalidas e problemas de corretude similares. Estes sao sempre reportados como erros.

```lua
local x: number = "hello"         -- E: string not assignable to number

local function add(a: number, b: number): number
    return a + b
end

add("one", "two")                  -- E: string not assignable to number
```

### Avisos de Regras de Lint (Serie W)

As regras de lint fornecem verificacoes de estilo e qualidade. Ative-as com `--rules`:

```bash
wippy lint --rules
```

| Codigo | Regra | Descricao |
|--------|-------|-----------|
| `W0001` | no-empty-blocks | Blocos de instrucoes vazios |
| `W0002` | no-global-assign | Atribuicao a variaveis globais |
| `W0003` | no-self-compare | Comparacao de um valor consigo mesmo |
| `W0004` | no-unused-vars | Variaveis locais nao utilizadas |
| `W0005` | no-unused-params | Parametros de funcao nao utilizados |
| `W0006` | no-unused-imports | Importacoes nao utilizadas |
| `W0007` | no-shadowed-vars | Variavel oculta o escopo externo |

Sem `--rules`, apenas a verificacao de tipos (codigos P e E) e realizada.

## Filtragem

### Por Namespace

Verifique namespaces especificos usando `--ns`:

```bash
wippy lint --ns app               # Correspondencia exata de namespace
wippy lint --ns "app.*"           # Tudo dentro de app
wippy lint --ns app --ns lib      # Multiplos namespaces
```

Dependencias das entradas selecionadas sao carregadas para verificacao de tipos, mas seus diagnosticos nao sao reportados.

### Por Codigo de Erro

Filtre diagnosticos por codigo:

```bash
wippy lint --code E0001
wippy lint --code E0001 --code E0004
```

### Por Quantidade

Limite o numero de diagnosticos exibidos:

```bash
wippy lint --limit 10             # Mostra os primeiros 10 problemas
```

## Formatos de Saida

### Formato Tabela (Padrao)

Cada diagnostico e exibido com contexto do codigo-fonte, localizacao do arquivo e a mensagem de erro. Os resultados sao ordenados por entrada, severidade e numero de linha.

Uma linha de resumo mostra os totais:

```
Checked 42 entries: 5 errors, 12 warnings
```

### Formato Resumo

Agrupa diagnosticos por namespace e codigo de erro:

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

Saida legivel por maquina para integracao com CI/CD:

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

O linter armazena resultados em cache para acelerar execucoes repetidas. As chaves de cache sao baseadas no hash do codigo-fonte, nome do metodo, dependencias e configuracao do sistema de tipos.

Limpe o cache se os resultados parecerem desatualizados:

```bash
wippy lint --cache-reset
```

## Integracao CI/CD

Use a saida JSON e codigos de saida para verificacoes automatizadas:

```bash
wippy lint --json --level error > lint-results.json
```

O linter retorna codigo de saida 0 quando nenhum erro e encontrado, e diferente de zero quando ha erros.

Exemplo de step no GitHub Actions:

```yaml
- name: Lint
  run: wippy lint --level warning
```

## Referencia de Flags

| Flag | Curta | Padrao | Descricao |
|------|-------|--------|-----------|
| `--level` | | warning | Nivel minimo de severidade (error, warning, hint) |
| `--json` | | false | Saida em formato JSON |
| `--ns` | | | Filtrar por padroes de namespace |
| `--code` | | | Filtrar por codigos de erro |
| `--limit` | | 0 | Maximo de diagnosticos a exibir (0 = ilimitado) |
| `--summary` | | false | Agrupar por codigo de erro |
| `--no-color` | | false | Desabilitar saida colorida |
| `--rules` | | false | Ativar regras de lint (verificacoes de estilo/qualidade serie W) |
| `--cache-reset` | | false | Limpar cache antes de executar o lint |
| `--lock-file` | `-l` | wippy.lock | Caminho para o arquivo de lock |

## Veja Tambem

- [CLI](guides/cli.md) - Referencia completa da CLI
- [Tipos](lua/types.md) - Documentacao do sistema de tipos
- [LSP](guides/lsp.md) - Integracao com editor com diagnosticos em tempo real
