# Entry Handler

Entry handler 按 kind 处理 registry entry。当 entry 被添加、更新或删除时，registry 将事件分发给匹配的 handler。

## 工作原理

Registry 维护 kind 模式到 handler 的映射。当 entry 变更时：

1. Registry 发出事件（`entry.create`, `entry.update`, `entry.delete`）
2. Handler registry 将 entry kind 与注册的模式匹配
3. 匹配的 handler 接收 entry
4. Handler 处理或拒绝 entry

## Kind 模式

Handler 使用模式订阅：

| 模式 | 匹配 |
|---------|---------|
| `http.service` | 仅完全匹配 |
| `http.*` | `http.service`, `http.router`, `http.endpoint` |
| `function.*` | `function.lua`, `function.lua.bc` |

## Entry Listener 接口

Handler 实现 `registry.EntryListener`：

```go
type EntryListener interface {
    Add(ctx context.Context, entry Entry) error
    Update(ctx context.Context, entry Entry) error
    Delete(ctx context.Context, entry Entry) error
}
```

从 `Add` 返回错误会拒绝该 entry。

## Listener vs Observer

| 类型 | 用途 | 可以拒绝 |
|------|---------|------------|
| Listener | 主要 handler | 是 |
| Observer | 次要 handler（日志、指标） | 否 |

```go
handlers.RegisterListener("http.*", httpManager)
handlers.RegisterObserver("function.*", metricsCollector)
```

## 注册 Handler

在启动期间注册 handler：

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

## 解码 Entry Data

使用 `entry.DecodeEntryConfig` 反序列化 entry 数据：

```go
func (m *Manager) Add(ctx context.Context, ent registry.Entry) error {
    cfg, err := entry.DecodeEntryConfig[ComponentConfig](ctx, m.dtt, ent)
    if err != nil {
        return err
    }
    // 处理 cfg...
    return nil
}
```

解码器：
1. 将 `entry.Data` 反序列化到你的配置结构体
2. 从 entry 填充 `ID` 和 `Meta`
3. 如果实现了 `InitDefaults()` 则调用
4. 如果实现了 `Validate()` 则调用

## Config 结构

Entry 配置通常包括：

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

## 事务支持

对于跨多个 entry 的原子操作，实现 `TransactionListener`：

```go
type TransactionListener interface {
    Begin(ctx context.Context)
    Commit(ctx context.Context)
    Discard(ctx context.Context)
}
```

Registry 在处理批次前调用 `Begin`，然后在成功时调用 `Commit` 或在失败时调用 `Discard`。

## 另请参阅

- [Registry](internals/registry.md) - Entry 存储
- [Architecture](internals/architecture.md) - 启动序列
