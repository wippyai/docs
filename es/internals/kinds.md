# Entry Handlers

Los entry handlers procesan entradas de registry por kind. Cuando las entradas son agregadas, actualizadas, o eliminadas, el registry despacha eventos a handlers matcheados.

## Como Funciona

El registry mantiene un mapa de patrones de kind a handlers. Cuando una entrada cambia:

1. Registry emite evento (`entry.create`, `entry.update`, `entry.delete`)
2. Registry de handlers matchea kind de entrada contra patrones registrados
3. Handlers matcheados reciben la entrada
4. Handlers procesan o rechazan la entrada

## Patrones de Kind

Los handlers se suscriben usando patrones:

| Patron | Matchea |
|--------|---------|
| `http.service` | Solo match exacto |
| `http.*` | `http.service`, `http.router`, `http.endpoint` |
| `function.*` | `function.lua`, `function.lua.bc` |

## Interfaz Entry Listener

Los handlers implementan `registry.EntryListener`:

```go
type EntryListener interface {
    Add(ctx context.Context, entry Entry) error
    Update(ctx context.Context, entry Entry) error
    Delete(ctx context.Context, entry Entry) error
}
```

Retornar un error desde `Add` rechaza la entrada.

## Listener vs Observer

| Tipo | Proposito | Puede Rechazar |
|------|-----------|----------------|
| Listener | Handler primario | Si |
| Observer | Handler secundario (logging, metricas) | No |

```go
handlers.RegisterListener("http.*", httpManager)
handlers.RegisterObserver("function.*", metricsCollector)
```

## Registrar Handlers

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

## Decodificar Datos de Entrada

Use `entry.DecodeEntryConfig` para deserializar datos de entrada:

```go
func (m *Manager) Add(ctx context.Context, ent registry.Entry) error {
    cfg, err := entry.DecodeEntryConfig[ComponentConfig](ctx, m.dtt, ent)
    if err != nil {
        return err
    }
    // Procesar cfg...
    return nil
}
```

El decoder:
1. Deserializa `entry.Data` en su struct de config
2. Completa `ID` y `Meta` desde la entrada
3. Llama `InitDefaults()` si esta implementado
4. Llama `Validate()` si esta implementado

## Estructura de Config

Los configs de entrada tipicamente incluyen:

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

## Soporte de Transacciones

Para operaciones atomicas a traves de multiples entradas, implemente `TransactionListener`:

```go
type TransactionListener interface {
    Begin(ctx context.Context)
    Commit(ctx context.Context)
    Discard(ctx context.Context)
}
```

El registry llama `Begin` antes de procesar un batch, luego `Commit` en exito o `Discard` en fallo.

## Ver Tambien

- [Registry](internal-registry.md) - Almacenamiento de entradas
- [Architecture](internal-architecture.md) - Secuencia de boot
