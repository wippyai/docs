---
title: "イベントバス"
description: "イベントバスは単一のディスパッチャgoroutineを使用するPub/Subシステムです。パブリッシャーがアクションをエンキューし、ディスパッチャが順次処理し、サブスクライバーがマッチするイベントをチャネルで受信します。"
---

# イベントバス

イベントバスは単一のディスパッチャgoroutineを使用するPub/Subシステムです。パブリッシャーがアクションをエンキューし、ディスパッチャが順次処理し、サブスクライバーがマッチするイベントをチャネルで受信します。

## イベント構造

```go
type Event struct {
    System string  // コンポーネント/モジュール（例: "registry", "process"）
    Kind   string  // イベントタイプ（例: "create", "update", "exit"）
    Path   string  // エンティティ識別子
    Data   any     // ペイロード
}
```

## バスアーキテクチャ

```mermaid
flowchart LR
    subgraph Publishers
        P1[コンポーネント]
        P2[コンポーネント]
    end

    subgraph Bus
        Q[actionQueue]
        D[ディスパッチャgoroutine]
        S[subscribers map]
    end

    subgraph Subscribers
        S1[chan Event]
        S2[chan Event]
    end

    P1 & P2 -->|enqueue| Q
    Q -->|signal| D
    D -->|match & deliver| S1 & S2
    D <-->|manage| S
```

バスはシンプルな構造で状態を格納：

```go
type Bus struct {
    subscribers       map[SubscriberID]sub
    subscriberCounter uint64
    maxSubscribers    int

    actionQueue []action
    spareQueue  []action
    actionMu    sync.Mutex
    actionReady chan struct{}  // buffered=1

    closed atomic.Bool
}
```

すべての変更はディスパッチャgoroutineを通過し、複雑なロックなしで競合状態を排除。

## アクション

4種類のアクションがキューを流れる：

| アクション | 動作 |
|----------|------|
| Subscribe | サブスクライバーをマップに追加、doneチャネルで応答 |
| Unsubscribe | サブスクライバーを削除、doneチャネルで応答 |
| Send | マッチするサブスクライバーにイベントを配信 |
| Stop | サブスクライバーをクリア、キューをドレイン、ループを終了 |

SubscribeとUnsubscribeはディスパッチャが確認するまでブロック。Sendはファイアアンドフォーゲット。

バスが`DefaultMaxSubscribers`（4096）個のアクティブなサブスクリプションを保持すると、`Subscribe`は`ErrSubscribersCapReached`で拒否される。

`Subscribe`は、サブスクリプションのコンテキストが既にキャンセルされている場合は即座に失敗し、所有権の判断が下される前にキャンセルされた場合はディスパッチャ側で再度失敗する。バスは自身がインストールしていないチャネルを決して受け取らない。

`Unsubscribe`はベストエフォートのヒントではなく、所有権のバリアである。ディスパッチャが確認応答した後にのみ戻るため、呼び出し側はバスが送信中の参照を保持していないことを前提にチャネルを解放できる。`Stop`の後に到着した場合、確認応答はディスパッチャが既にドレイン済みのバッチの配信を終えるまで待機する。

`Stop`も同様に終端的である。並行する2回目の`Stop`は、クローズ済みフラグを見て早期に戻ることはなく、ディスパッチャがドレインして終了するまで待機する。

## キュースワッピング

ディスパッチャは定常状態でアロケーションを避けるためにスライススワッピングを使用：

```go
func (b *Bus) processActions() bool {
    b.actionMu.Lock()
    actions := b.actionQueue
    b.actionQueue = b.spareQueue[:0]
    b.spareQueue = nil
    b.actionMu.Unlock()

    for i := range actions {
        // アクションを処理
    }

    clear(actions)
    b.actionMu.Lock()
    b.spareQueue = actions[:0]
    b.actionMu.Unlock()
    return true
}
```

2つのスライスが交互：1つは処理用、1つは新着用。`actionReady`チャネルは1にバッファされ、シグナリングがブロックせず、複数のエンキューが1回のウェイクアップにまとまります。

## パターンマッチング

サブスクリプションはサブスクライブ時に一度パターンをコンパイル：

```go
type sub struct {
    subID   SubscriberID
    ctx     context.Context
    system  *wildcard.Wildcard
    kind    *wildcard.Wildcard
    eventCh chan<- Event
}
```

ワイルドカードパッケージは3種類のパターンをサポート：

| パターン | マッチ |
|---------|------|
| `registry` | 完全一致のみ |
| `*` | 任意の単一セグメント |
| `**` | 0個以上のセグメント |
| `(a\|b)` | セグメント内の選択 |

パターンは`.`で分割されるため、`registry.*`は`registry.create`にマッチしますが`registry.entry.create`にはマッチしません。パターン`registry.**`は`registry`、`registry.create`、`registry.entry.create`の3つすべてにマッチ。

## イベント配信

Send処理中、ディスパッチャはサブスクライバーを反復：

```go
for id, s := range b.subscribers {
    if s.system != nil && !s.system.Match(a.event.System) {
        continue
    }
    if s.kind != nil && !s.kind.Match(a.event.Kind) {
        continue
    }

    select {
    case <-a.ctx.Done():
        goto cleanup
    case <-s.ctx.Done():
        expiredSubs = append(expiredSubs, id)
    case s.eventCh <- a.event:
    }
}
```

サブスクライバーのコンテキストがキャンセルされると、その配信パス中に削除対象としてマーク。イベントコンテキストも反復中に配信をキャンセル可能。

## Luaプロセスブリッジ

イベントディスパッチャはGoイベントをLuaプロセスにブリッジ。すべてのイベント（`"**"`）に一度サブスクライブし、プロセスサブスクリプションに基づいて内部でルーティング：

```go
type Dispatcher struct {
    bus    event.Bus
    node   relay.Node
    subID  SubscriberID
    eventC chan event.Event

    mu   sync.RWMutex
    subs map[string]*subscription  // topic -> subscription
}
```

Luaプロセスが`events.subscribe()`でサブスクライブすると、ディスパッチャがパターンとターゲットPIDを格納。マッチするイベントはパッケージ化されてリレー経由で送信：

```go
func (d *Dispatcher) routeEvent(evt event.Event) {
    d.mu.RLock()
    defer d.mu.RUnlock()

    for _, sub := range d.subs {
        if !matchPattern(sub.system, evt.System) {
            continue
        }
        if sub.kind != "" && sub.kind != "*" && !matchPattern(sub.kind, evt.Kind) {
            continue
        }

        data := map[string]any{
            "system": evt.System,
            "kind":   evt.Kind,
            "path":   evt.Path,
        }
        if evt.Data != nil {
            data["data"] = evt.Data
        }

        pkg := relay.NewPackage(pid.PID{}, sub.pid, sub.topic, payload.New(data))
        d.node.Send(pkg)
    }
}
```

## ヘルパー型

### Subscriber

チャネルサブスクリプションをコールバックでラップ：

```go
handler, err := eventbus.NewSubscriber(ctx, bus, "registry", "*.created",
    func(evt Event) {
        // handle
    })
defer handler.Close()
```

2つのgoroutineを生成：1つはイベントを読んでハンドラを呼び出し、もう1つはコンテキストキャンセルを待ってアンサブスクライブ。

### EventRouter

複数のハンドラを一元化されたライフサイクルで管理：

```go
router, err := eventbus.StartRouter(ctx, bus,
    WithHandlers(handler1, handler2),
    WithLogger(log))
defer router.Stop()
```

各ハンドラは`Pattern()`と`Handle()`を実装。RouterはそれぞれにSubscriberを作成し、Stop時にすべてをクローズ。

### AwaitService

pub/sub上でのリクエスト・レスポンス。`(system, kind)`ペアごとに単一のサブスクリプションを保持し、`Path`によってイベントをwaiterにルーティング：

```go
svc := eventbus.NewAwaitService(bus)
svc.Start(ctx)
defer svc.Stop()

waiter, _ := svc.Prepare(ctx, "test", "response.(accept|reject)", "test/path", 5*time.Second)
defer waiter.Close()

bus.Send(ctx, triggeringEvent)

result := waiter.Wait()  // AwaitResult{Event, Accepted, Error}を返す
```

`Prepare`はトリガーとなるイベントを送信する前にwaiterを登録し、待機の登録前にレスポンスが到着する競合状態を回避する。`Wait`は`Path`がマッチするイベントの到着、またはタイムアウト（非正の値の場合はデフォルトの`DefaultAwaitTimeout`、30秒）の満了までブロック。`Accepted`はイベント種別が`accept`、`*.accept`、`*.accepted`のいずれかの場合にtrueとなり、それ以外の種別は拒否として扱われ、`Data`内の`error`は`Error`として返される。便宜的な`Await(ctx, system, kind, path, timeout)`はPrepareとWaitを組み合わせたもの。ブートインフラストラクチャはAwaitServiceをコンテキストに登録する（`event.GetAwaitService`）。

## シャットダウン

1. `Stop()`がclosedフラグをアトミックに設定しStopアクションをエンキュー
2. ディスパッチャがサブスクライバーマップをクリア
3. 残りのキューされたアクションをドレイン：
   - Subscribeリクエストは"bus is closed"エラーを取得
   - Unsubscribeリクエストは即座に完了
   - Sendイベントはドロップ
4. WaitGroupが完了

## 関連項目

- [レジストリ](internals/registry.md) - 主要なイベントプロデューサー
- [コマンドディスパッチ](internals/dispatch.md) - プロセスからハンドラへのルーティング

