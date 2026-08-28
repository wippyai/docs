---
title: "Listeners y observers de entradas"
description: "Cómo listeners y observers gestionan mutaciones del registro para patrones de kind de entrada coincidentes."
---

# Listeners y observers de entradas

Los listeners y observers de entradas procesan mutaciones del registro para patrones coincidentes de kind de entrada.

Esta es una referencia de extensión Go. Los fragmentos de registro y configuración suponen un componente de boot, manager, transcoder y tipo de configuración de aplicación ya existentes.

## Cómo Funciona

El boot reúne listeners y observers con sus patrones de kind. Cuando cambia una entrada:

1. Registry emite evento (`entry.create`, `entry.update`, `entry.delete`)
2. Cada envoltorio de listener compara el kind de entrada con su patrón registrado
3. Handlers matcheados reciben la entrada
4. Handlers procesan o rechazan la entrada

## Patrones de Kind

Los handlers se suscriben usando patrones:

| Patrón | Matchea |
|--------|---------|
| `http.service` | Solo match exacto |
| `http.*` | `http.service`, `http.router`, `http.endpoint` |
| `function.**` | `function.lua`, `function.lua.bc` |

## Interfaz Entry Listener

Los handlers implementan `registry.EntryListener`:

```go
type EntryListener interface {
    Add(ctx context.Context, entry Entry) error
    Update(ctx context.Context, entry Entry) error
    Delete(ctx context.Context, entry Entry) error
}
```

Retornar un error desde `Add`, `Update` o `Delete` rechaza esa operación.

## Listener vs Observer

| Tipo | Propósito | Puede Rechazar |
|------|-----------|----------------|
| Listener | Handler primario | Sí |
| Observer | Handler secundario (logging, métricas) | No |

```go
handlers.RegisterListener("http.*", httpManager)
handlers.RegisterObserver("function.*", metricsCollector)
```

Los errores de observers en `Add`, `Update` y `Delete` se ignoran y no emiten un evento de aceptación ni rechazo. Un listener u observer que también implementa `TransactionListener` participa en las barreras de transacción, donde un error de `Begin`, `Commit` o `Discard` rechaza esa fase de la transacción.

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

Use `entry.DecodeEntryConfig` de `github.com/wippyai/runtime/system/entry` para deserializar datos de entrada. Las extensiones externas al árbol pueden importar este paquete:

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

El decoder:
1. Resuelve los placeholders modernos `${env:...}` en los datos de entrada
2. Deserializa los datos resueltos en su struct de config
3. Completa `ID` y `Meta` desde la entrada cuando los campos decodificados son cero o nil
4. Llama `InitDefaults()` si está implementado
5. Resuelve los campos heredados `*_env` mediante el registro de entorno
6. Llama `Validate()` si está implementado

## Estructura de Config

Los configs de entrada típicamente incluyen:

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

Para operaciones atómicas a través de múltiples entradas, implemente `TransactionListener`:

```go
type TransactionListener interface {
    Begin(ctx context.Context) error
    Commit(ctx context.Context) error
    Discard(ctx context.Context) error
}
```

El registry llama `Begin` antes de procesar un batch, luego `Commit` en éxito o `Discard` en fallo.

## Ver También

- [Registry](internals/registry.md) - Almacenamiento de entradas
- [Architecture](internals/architecture.md) - Secuencia de boot
