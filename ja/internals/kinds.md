---
title: "エントリリスナーとオブザーバー"
description: "リスナーとオブザーバーが、一致するエントリ種別パターンのレジストリ変更を処理する仕組み。"
---

# エントリリスナーとオブザーバー

エントリリスナーとオブザーバーは、一致するエントリ種別パターンのレジストリ変更を処理します。

これは Go 拡張リファレンスです。登録と設定の断片は、既存のブートコンポーネント、manager、transcoder、アプリケーション設定型を前提としています。

## 動作の仕組み

ブートはリスナーとオブザーバーを、その種別パターンとともに収集します。エントリが変更されると、次の処理が行われます。

1. レジストリがイベント（`entry.create`、`entry.update`、`entry.delete`）を発行
2. 各リスナーラッパーがエントリ種別を登録済みパターンと照合
3. 一致するハンドラがエントリを受信
4. ハンドラがエントリを処理または reject

## 種別パターン

ハンドラはパターンを使用して subscribe します。

| パターン | 一致対象 |
|---------|---------|
| `http.service` | 完全一致のみ |
| `http.*` | `http.service`、`http.router`、`http.endpoint` |
| `function.**` | `function.lua`、`function.lua.bc` |

## エントリリスナーインターフェース

ハンドラは `registry.EntryListener` を実装します。

```go
type EntryListener interface {
    Add(ctx context.Context, entry Entry) error
    Update(ctx context.Context, entry Entry) error
    Delete(ctx context.Context, entry Entry) error
}
```

`Add`、`Update`、`Delete` からエラーを返すと、その操作を reject します。

## リスナーとオブザーバー

| 種類 | 目的 | Reject 可能 |
|------|---------|------------|
| Listener | プライマリハンドラ | はい |
| Observer | セカンダリハンドラ（logging、metrics） | いいえ |

```go
handlers.RegisterListener("http.*", httpManager)
handlers.RegisterObserver("function.*", metricsCollector)
```

オブザーバーの `Add`、`Update`、`Delete` から返されたエラーは無視され、accept または reject イベントを発行しません。`TransactionListener` も実装するリスナーまたはオブザーバーはトランザクション barrier に参加し、`Begin`、`Commit`、`Discard` からのエラーはそのトランザクションフェーズを reject します。

## ハンドラの登録

ブート中にハンドラを登録します。

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

エントリデータを unmarshal するには、`github.com/wippyai/runtime/system/entry` の `entry.DecodeEntryConfig` を使用します。このパッケージはリポジトリ外の拡張からも import できます。

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

decoder は次の処理を行います。

1. エントリデータ内の新しい形式の `${env:...}` プレースホルダーを解決
2. 解決済みデータを設定構造体へ unmarshal
3. デコードしたフィールドが zero または nil の場合、エントリから `ID` と `Meta` を設定
4. 実装されていれば `InitDefaults()` を呼び出す
5. 環境レジストリを通じて従来の `*_env` フィールドを解決
6. 実装されていれば `Validate()` を呼び出す

## 設定構造体

エントリ設定には通常、次の要素が含まれます。

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

## トランザクション対応

複数エントリをまたぐ atomic な操作には `TransactionListener` を実装します。

```go
type TransactionListener interface {
    Begin(ctx context.Context) error
    Commit(ctx context.Context) error
    Discard(ctx context.Context) error
}
```

レジストリはバッチ処理前に `Begin` を呼び出し、成功時には `Commit`、失敗時には `Discard` を呼び出します。

## 関連項目

- [レジストリ](./registry.md) - エントリストレージ
- [アーキテクチャ](./architecture.md) - ブートシーケンス
