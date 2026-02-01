# Обработчики записей

Обработчики записей обрабатывают записи реестра по kind. При добавлении, обновлении или удалении записей реестр диспатчит события соответствующим обработчикам.

## Принцип работы

Реестр поддерживает карту паттернов kind к обработчикам. При изменении записи:

1. Реестр отправляет событие (`entry.create`, `entry.update`, `entry.delete`)
2. Реестр обработчиков сопоставляет kind записи с зарегистрированными паттернами
3. Соответствующие обработчики получают запись
4. Обработчики обрабатывают или отклоняют запись

## Паттерны kind

Обработчики подписываются с использованием паттернов:

| Паттерн | Совпадает |
|---------|-----------|
| `http.service` | Только точное совпадение |
| `http.*` | `http.service`, `http.router`, `http.endpoint` |
| `function.*` | `function.lua`, `function.lua.bc` |

## Интерфейс Entry Listener

Обработчики реализуют `registry.EntryListener`:

```go
type EntryListener interface {
    Add(ctx context.Context, entry Entry) error
    Update(ctx context.Context, entry Entry) error
    Delete(ctx context.Context, entry Entry) error
}
```

Возврат ошибки из `Add` отклоняет запись.

## Listener vs Observer

| Тип | Назначение | Может отклонить |
|-----|------------|-----------------|
| Listener | Основной обработчик | Да |
| Observer | Вторичный обработчик (логирование, метрики) | Нет |

```go
handlers.RegisterListener("http.*", httpManager)
handlers.RegisterObserver("function.*", metricsCollector)
```

## Регистрация обработчиков

Регистрация обработчиков при загрузке:

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

## Декодирование данных записи

Используйте `entry.DecodeEntryConfig` для десериализации данных записи:

```go
func (m *Manager) Add(ctx context.Context, ent registry.Entry) error {
    cfg, err := entry.DecodeEntryConfig[ComponentConfig](ctx, m.dtt, ent)
    if err != nil {
        return err
    }
    // Обработка cfg...
    return nil
}
```

Декодер:
1. Десериализует `entry.Data` в вашу структуру конфига
2. Заполняет `ID` и `Meta` из записи
3. Вызывает `InitDefaults()`, если реализован
4. Вызывает `Validate()`, если реализован

## Структура конфига

Конфиги записей обычно включают:

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

## Поддержка транзакций

Для атомарных операций над несколькими записями реализуйте `TransactionListener`:

```go
type TransactionListener interface {
    Begin(ctx context.Context)
    Commit(ctx context.Context)
    Discard(ctx context.Context)
}
```

Реестр вызывает `Begin` перед обработкой пакета, затем `Commit` при успехе или `Discard` при неудаче.

## См. также

- [Реестр](internal-registry.md) — хранение записей
- [Архитектура](internal-architecture.md) — последовательность загрузки
