# エントリハンドラ

エントリハンドラはkindごとにレジストリエントリを処理します。エントリが追加、更新、削除されると、レジストリがマッチするハンドラにイベントをディスパッチします。

## 動作原理

レジストリはkindパターンからハンドラへのマップを維持。エントリが変更されると：

1. レジストリがイベントを発行（`entry.create`、`entry.update`、`entry.delete`）
2. ハンドラレジストリがエントリkindを登録されたパターンとマッチング
3. マッチするハンドラがエントリを受信
4. ハンドラがエントリを処理または拒否

## Kindパターン

ハンドラはパターンを使用してサブスクライブ：

| パターン | マッチ |
|---------|------|
| `http.service` | 完全一致のみ |
| `http.*` | `http.service`、`http.router`、`http.endpoint` |
| `function.*` | `function.lua`、`function.lua.bc` |

## EntryListenerインターフェース

ハンドラは`registry.EntryListener`を実装：

```go
type EntryListener interface {
    Add(ctx context.Context, entry Entry) error
    Update(ctx context.Context, entry Entry) error
    Delete(ctx context.Context, entry Entry) error
}
```

`Add`からエラーを返すとエントリを拒否。

## ListenerとObserver

| タイプ | 目的 | 拒否可能 |
|-------|------|---------|
| Listener | 主要ハンドラ | はい |
| Observer | 二次ハンドラ（ログ、メトリクス） | いいえ |

```go
handlers.RegisterListener("http.*", httpManager)
handlers.RegisterObserver("function.*", metricsCollector)
```

## ハンドラの登録

ブート時にハンドラを登録：

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

## エントリデータのデコード

`entry.DecodeEntryConfig`を使用してエントリデータをアンマーシャル：

```go
func (m *Manager) Add(ctx context.Context, ent registry.Entry) error {
    cfg, err := entry.DecodeEntryConfig[ComponentConfig](ctx, m.dtt, ent)
    if err != nil {
        return err
    }
    // cfgを処理...
    return nil
}
```

デコーダーは：
1. `entry.Data`を設定構造体にアンマーシャル
2. エントリから`ID`と`Meta`を設定
3. 実装されていれば`InitDefaults()`を呼び出し
4. 実装されていれば`Validate()`を呼び出し

## Config構造体

エントリ設定は通常以下を含む：

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

## トランザクションサポート

複数エントリにまたがるアトミック操作には`TransactionListener`を実装：

```go
type TransactionListener interface {
    Begin(ctx context.Context)
    Commit(ctx context.Context)
    Discard(ctx context.Context)
}
```

レジストリはバッチ処理前に`Begin`を呼び出し、成功時に`Commit`、失敗時に`Discard`を呼び出します。

## 関連項目

- [レジストリ](internals/registry.md) - エントリストレージ
- [アーキテクチャ](internals/architecture.md) - ブートシーケンス

