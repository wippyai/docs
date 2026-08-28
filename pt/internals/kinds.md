---
title: "Listeners e Observers de Entradas"
description: "Como listeners e observers tratam mutações do registro para padrões de tipos de entrada correspondentes."
---

# Listeners e Observers de Entradas

Listeners e observers de entradas processam mutações do registro para padrões de tipos de entrada correspondentes.

Esta é uma referência de extensão em Go. Os exemplos de registro e configuração pressupõem um componente de boot, um manager, um transcoder e um tipo de configuração da aplicação já existentes.

## Como Funciona

O boot coleta listeners e observers com seus padrões de tipo. Quando uma entrada muda:

1. O registro emite um evento (`entry.create`, `entry.update`, `entry.delete`)
2. Cada wrapper de listener compara o tipo da entrada ao padrão registrado
3. Os handlers correspondentes recebem a entrada
4. Os handlers processam ou rejeitam a entrada

## Padrões de Tipo

Os handlers se inscrevem usando padrões:

| Padrão | Corresponde |
|--------|-------------|
| `http.service` | Apenas correspondência exata |
| `http.*` | `http.service`, `http.router`, `http.endpoint` |
| `function.**` | `function.lua`, `function.lua.bc` |

## Interface EntryListener

Handlers implementam `registry.EntryListener`:

```go
type EntryListener interface {
    Add(ctx context.Context, entry Entry) error
    Update(ctx context.Context, entry Entry) error
    Delete(ctx context.Context, entry Entry) error
}
```

Retornar um erro de `Add`, `Update` ou `Delete` rejeita a operação.

## Listener vs Observer

| Tipo | Propósito | Pode Rejeitar |
|------|-----------|---------------|
| Listener | Handler primário | Sim |
| Observer | Handler secundário (logging, métricas) | Não |

```go
handlers.RegisterListener("http.*", httpManager)
handlers.RegisterObserver("function.*", metricsCollector)
```

Erros de observers em `Add`, `Update` e `Delete` são ignorados e não emitem um evento de aceitação ou rejeição. Um listener ou observer que também implemente `TransactionListener` participa das barreiras de transação, nas quais um erro de `Begin`, `Commit` ou `Discard` rejeita essa fase da transação.

## Registrando Handlers

Registre handlers durante boot:

```go
func MyService() boot.Component {
    return boot.New(boot.P{
        Name:      "myservice",
        DependsOn: []boot.Name{core.RegistryName},
        Load: func(ctx context.Context) (context.Context, error) {
            handlers := bootpkg.GetHandlerRegistry(ctx)
            handlers.RegisterListener("myservice.*", manager)
            return ctx, nil
        },
    })
}
```

## Decodificando Dados de Entrada

Use `entry.DecodeEntryConfig` do pacote `github.com/wippyai/runtime/system/entry` para desserializar os dados da entrada. O pacote pode ser importado por extensões externas ao repositório:

```go
func (m *Manager) Add(ctx context.Context, ent registry.Entry) error {
    cfg, err := entry.DecodeEntryConfig[ComponentConfig](ctx, m.dtt, ent)
    if err != nil {
        return err
    }
    // Process cfg...
    return nil
}
```

O decoder:
1. Resolve os placeholders modernos `${env:...}` nos dados da entrada
2. Desserializa os dados resolvidos na struct de configuração
3. Preenche `ID` e `Meta` com os dados da entrada quando os campos decodificados são zero ou nil
4. Chama `InitDefaults()` quando implementado
5. Resolve os campos legados `*_env` pelo registro de ambiente
6. Chama `Validate()` quando implementado

## Estrutura de configuração

As configurações de entrada normalmente incluem:

```go
type ComponentConfig struct {
    ID      registry.ID `json:"id"`
    Meta    attrs.Bag   `json:"meta"`
    Name    string      `json:"name"`
    Timeout int         `json:"timeout,omitempty"`
}

func (c *ComponentConfig) InitDefaults() {
    if c.Timeout == 0 {
        c.Timeout = 30
    }
}

func (c *ComponentConfig) Validate() error {
    if c.Name == "" {
        return fmt.Errorf("name is required")
    }
    return nil
}
```

## Suporte a Transações

Para operações atômicas através de múltiplas entradas, implemente `TransactionListener`:

```go
type TransactionListener interface {
    Begin(ctx context.Context) error
    Commit(ctx context.Context) error
    Discard(ctx context.Context) error
}
```

O registro chama `Begin` antes de processar um lote e, depois, `Commit` em caso de sucesso ou `Discard` em caso de falha.

## Consulte também

- [Registro](internals/registry.md) — Armazenamento de entradas
- [Arquitetura](internals/architecture.md) — Sequência de boot
