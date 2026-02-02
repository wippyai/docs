# Entry Handlers

Entry handlers processam entradas do registro por tipo. Quando entradas são adicionadas, atualizadas ou deletadas, o registro despacha eventos para handlers correspondentes.

## Como Funciona

O registro mantém um mapa de padrões de tipo para handlers. Quando uma entrada muda:

1. Registry emite evento (`entry.create`, `entry.update`, `entry.delete`)
2. Registry de handlers faz match do tipo da entrada contra padrões registrados
3. Handlers correspondentes recebem a entrada
4. Handlers processam ou rejeitam a entrada

## Padrões de Tipo

Handlers se inscrevem usando padrões:

| Padrão | Corresponde |
|--------|-------------|
| `http.service` | Apenas match exato |
| `http.*` | `http.service`, `http.router`, `http.endpoint` |
| `function.*` | `function.lua`, `function.lua.bc` |

## Interface EntryListener

Handlers implementam `registry.EntryListener`:

```go
type EntryListener interface {
    Add(ctx context.Context, entry Entry) error
    Update(ctx context.Context, entry Entry) error
    Delete(ctx context.Context, entry Entry) error
}
```

Retornar erro de `Add` rejeita a entrada.

## Listener vs Observer

| Tipo | Propósito | Pode Rejeitar |
|------|-----------|---------------|
| Listener | Handler primário | Sim |
| Observer | Handler secundário (logging, métricas) | Não |

```go
handlers.RegisterListener("http.*", httpManager)
handlers.RegisterObserver("function.*", metricsCollector)
```

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

Use `entry.DecodeEntryConfig` para deserializar dados da entrada:

```go
func (m *Manager) Add(ctx context.Context, ent registry.Entry) error {
    cfg, err := entry.DecodeEntryConfig[ComponentConfig](ctx, m.dtt, ent)
    if err != nil {
        return err
    }
    // Processar cfg...
    return nil
}
```

O decoder:
1. Deserializa `entry.Data` em sua struct de config
2. Popula `ID` e `Meta` da entrada
3. Chama `InitDefaults()` se implementado
4. Chama `Validate()` se implementado

## Estrutura de Config

Configs de entrada tipicamente incluem:

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
    Begin(ctx context.Context)
    Commit(ctx context.Context)
    Discard(ctx context.Context)
}
```

O registry chama `Begin` antes de processar um batch, depois `Commit` em sucesso ou `Discard` em falha.

## Veja Também

- [Registry](internals/registry.md) - Armazenamento de entradas
- [Architecture](internals/architecture.md) - Sequência de boot
