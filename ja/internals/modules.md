---
title: "Lua モジュール"
description: "同期関数、userdata、yield、エラー、セキュリティチェック、テストを備えた型付き Lua ランタイムモジュールを定義します。"
---

# Lua モジュール

ランタイムモジュールは、決定論的ユーティリティ、I/O 操作、または非同期コマンドを Lua 環境へ追加します。

これは Go 拡張リファレンスです。スニペットはパッケージレベルの部分的な例であり、各セクションで示す import、コマンド API、dispatcher、セキュリティリソース、テスト fixture を前提としています。

## モジュール定義

すべてのモジュールは`luaapi.ModuleDef`を使用：

```go
var Module = &luaapi.ModuleDef{
    Name:        "mymodule",
    Description: "My custom module",
    Class:       []string{luaapi.ClassDeterministic},
    Types:       ModuleTypes,  // Type definitions for tooling
    Build: func() (*lua.LTable, []luaapi.YieldType) {
        mod := lua.CreateTable(0, 2)
        mod.RawSetString("hello", lua.LGoFunc(helloFunc))
        mod.RawSetString("greet", lua.LGoFunc(greetFunc))
        mod.Immutable = true
        return mod, nil
    },
}
```

`Build`関数は以下を返す：
- エクスポートされた関数を持つモジュールテーブル
- 非同期操作用のyieldタイプのリスト（またはnil）

モジュールテーブルは一度構築され、すべてのLua状態で再利用するためにキャッシュ。

## モジュール分類

`Class`フィールドはモジュールを使用できる場所を決定：

| クラス | 説明 |
|-------|------|
| `ClassDeterministic` | 同じ入力は常に同じ出力を生成 |
| `ClassNondeterministic` | 出力が変動（時間、乱数） |
| `ClassIO` | 外部I/O操作 |
| `ClassNetwork` | ネットワーク操作 |
| `ClassEncoding` | エンコードおよびデコード操作 |
| `ClassTime` | 時間関連の操作 |
| `ClassProcess` | プロセス関連の操作 |
| `ClassSecurity` | セキュリティ関連の操作 |
| `ClassStorage` | データ永続化 |
| `ClassWorkflow` | ワークフロー安全な操作 |

ワークフローのコンパイルでは、`ClassDeterministic` または `ClassWorkflow` の少なくとも一方を持つモジュールが許可されます。クラスフィルタリングは包含方式であり、いずれかのクラスが許可されていればモジュールは通過します。

## 関数の公開

関数は`func(l *lua.LState) int`のシグネチャを持ち、戻り値はスタックにプッシュされた値の数：

```go
func greetFunc(l *lua.LState) int {
    name := l.CheckString(1)           // Required argument
    greeting := l.OptString(2, "Hello") // Optional with default

    l.Push(lua.LString(greeting + ", " + name + "!"))
    return 1
}
```

| メソッド | 説明 |
|---------|------|
| `l.CheckString(n)` | 位置nの必須文字列 |
| `l.CheckInt(n)` | 必須整数 |
| `l.CheckNumber(n)` | 必須数値 |
| `l.CheckTable(n)` | 必須テーブル |
| `l.OptString(n, def)` | デフォルト付きオプション文字列 |
| `l.OptInt(n, def)` | オプション整数 |

## テーブル

GoとLua間で渡されるテーブルはデフォルトで可変。モジュールエクスポートテーブルはイミュータブルにマークすべき：

```go
mod := lua.CreateTable(0, 5)
mod.RawSetString("func1", lua.LGoFunc(func1))
mod.Immutable = true  // Prevent Lua from modifying exports
```

データテーブルは通常使用のため可変のまま：

```go
result := l.CreateTable(0, 3)
result.RawSetString("name", lua.LString("value"))
result.RawSetString("count", lua.LNumber(42))
l.Push(result)
```

## 型システム

モジュールは2つの別々だが補完的な型付けメカニズムを使用。

### 型定義（ツーリング）

`Types`フィールドはIDEサポートとドキュメント用の型シグネチャを提供：

```go
import (
    "github.com/wippyai/go-lua/types/io"
    "github.com/wippyai/go-lua/types/typ"
)

func ModuleTypes() *io.Manifest {
    m := io.NewManifest("mymodule")

    objectType := typ.NewInterface("mymodule.Object", []typ.Method{
        {Name: "get_value", Type: typ.Func().Param("self", typ.Self).
            Returns(typ.String, typ.NewOptional(typ.LuaError)).Build()},
        {Name: "set_value", Type: typ.Func().Param("self", typ.Self).
            Param("value", typ.String).Returns(typ.NewOptional(typ.LuaError)).Build()},
    })

    m.DefineType("Object", objectType)
    m.SetExport(objectType)
    return m
}
```

**利用可能な型構成：**

| 型 | 説明 |
|----|------|
| `typ.String` | 文字列プリミティブ |
| `typ.Number` | 数値 |
| `typ.Integer` | 整数値 |
| `typ.Boolean` | ブール値 |
| `typ.Any` | 任意の Lua 値 |
| `typ.Self` | メソッドの receiver 型 |
| `typ.LuaError` | エラー型 |
| `typ.NewOptional(t)` | 型 t のオプション値 |
| `typ.NewInterface(name, methods)` | メソッドを持つオブジェクト |
| `typ.Func()` | パラメータ/戻り値を持つ関数シグネチャ builder |
| `typ.NewRecord()` | 構造体的な型の builder（`.Field`/`.OptField` でフィールドを指定） |
| `typ.NewArray(t)` | 要素型 t の配列 |
| `typ.NewMap(k, v)` | キー/値型を持つマップ |

関数シグネチャは可変長パラメータをサポート：

```go
// (string, ...any) -> (string, error?)
typ.Func().
    Param("first", typ.String).
    Variadic(typ.Any).
    Returns(typ.String, typ.NewOptional(typ.LuaError)).
    Build()
```

レコードは必須フィールドとオプションフィールドを組み合わせられます。

```go
typ.NewRecord().
    Field("key", typ.String).
    Field("value", typ.Any).
    OptField("ttl", typ.Number).
    Build()
```

追加の builder と型定義については、go-lua の `typ` パッケージを参照してください。

### UserDataバインディング（ランタイム）

`RegisterTypeMethods`は実際のGoからLuaへのバインディングを作成：

```go
func init() {
    value.RegisterTypeMethods(nil, "mymodule.Object",
        map[string]lua.LGoFunc{
            "__tostring": objectToString,  // Metamethods
        },
        map[string]lua.LGoFunc{
            "get_value": objectGetValue,   // Regular methods
            "set_value": objectSetValue,
        },
    )
}
```

メタテーブルはイミュータブルでスレッドセーフな再利用のためにグローバルにキャッシュ。

| システム | 目的 | 定義 |
|---------|------|------|
| 型定義 | IDE、ドキュメント、型チェック | シグネチャ |
| UserDataバインディング | ランタイムメソッド呼び出し | 実行可能関数 |

## 非同期操作

外部システムを待つ操作には、結果の代わりにyieldを返す。yieldはGoハンドラにディスパッチされ、ハンドラ完了時にプロセスが再開。

### Yieldの定義

モジュールの`Build`関数でyieldタイプを宣言：

```go
Build: func() (*lua.LTable, []luaapi.YieldType) {
    mod := lua.CreateTable(0, 1)
    mod.RawSetString("fetch", lua.LGoFunc(fetchFunc))
    mod.Immutable = true

    yields := []luaapi.YieldType{
        {Sample: &FetchYield{}, CmdID: myapi.FetchCommand},
    }

    return mod, yields
}
```

### Yieldの作成

通常の戻り値の代わりにyieldをシグナルするには-1を返す：

```go
func fetchFunc(l *lua.LState) int {
    url := l.CheckString(1)

    yield := AcquireFetchYield()
    yield.URL = url

    l.Push(yield)
    return -1  // Signal yield, not stack count
}
```

### Yield実装

YieldはLua値とディスパッチャコマンドをブリッジ：

```go
type FetchYield struct {
    *myapi.FetchCmd
}

func (y *FetchYield) String() string              { return "<fetch_yield>" }
func (y *FetchYield) Type() lua.LValueType        { return lua.LTUserData }
func (y *FetchYield) CmdID() dispatcher.CommandID { return myapi.FetchCommand }
func (y *FetchYield) ToCommand() dispatcher.Command { return y.FetchCmd }
func (y *FetchYield) Release() { releaseFetchYield(y) }

func (y *FetchYield) HandleResult(l *lua.LState, data any, err error) []lua.LValue {
    if err != nil {
        return []lua.LValue{lua.LNil, lua.NewLuaError(l, err.Error())}
    }
    resp := data.(*myapi.FetchResponse)
    return []lua.LValue{lua.LString(resp.Body), lua.LNil}
}
```

ディスパッチャーはコマンドをハンドラへルーティングします。ハンドラの実装については[コマンドディスパッチ](./dispatch.md)を参照してください。

## エラー処理

構造化エラーを使用してエラーを2番目の値として返す：

```go
func myFunc(l *lua.LState) int {
    result, err := doSomething()
    if err != nil {
        lerr := lua.NewLuaError(l, err.Error()).
            WithKind(lua.Internal).
            WithRetryable(true)
        l.Push(lua.LNil)
        l.Push(lerr)
        return 2
    }

    l.Push(lua.LString(result))
    l.Push(lua.LNil)
    return 2
}
```

## セキュリティ

センシティブな操作を実行する前に権限をチェック：

```go
func myFunc(l *lua.LState) int {
    ctx := l.Context()

    if !security.IsAllowed(ctx, "mymodule.action", resource, nil) {
        l.Push(lua.LNil)
        l.Push(lua.NewLuaError(l, "permission denied").WithKind(lua.PermissionDenied))
        return 2
    }

    // Proceed with operation
}
```

## テスト

基本的なモジュールテストは構造と同期関数を検証：

```go
func TestModule(t *testing.T) {
    l := lua.NewState()
    defer l.Close()

    mod, _ := Module.Build()
    l.SetGlobal("mymodule", mod)

    err := l.DoString(`
        local m = mymodule
        assert(m.hello() == "Hello, World!")
    `)
    if err != nil {
        t.Fatal(err)
    }
}
```

### Yield付きモジュールのテスト

yielding関数を使用するLuaコードをテストするには、必要なディスパッチャを持つ最小限のスケジューラを作成：

```go
type testScheduler struct {
    *actor.Scheduler
    clock   *clock.Dispatcher
    node    *sysrelay.Node
    mu      sync.Mutex
    pending map[string]chan *runtime.Result
}

func newTestScheduler() *testScheduler {
    ts := &testScheduler{pending: make(map[string]chan *runtime.Result)}
    reg := scheduler.NewRegistry()

    // Register dispatchers for yields your module uses
    clockSvc := clock.NewDispatcher()
    clockSvc.RegisterAll(func(id dispatcher.CommandID, h dispatcher.Handler) {
        reg.Register(id, h)
    })
    ts.clock = clockSvc

    ts.Scheduler = actor.NewScheduler(reg, actor.WithWorkers(4), actor.WithLifecycle(ts))

    // Clock events return through the relay to the process host named by PID.Host.
    ts.node = sysrelay.NewNode("module-test-node")
    if err := ts.node.RegisterHost("module.test", ts.Scheduler); err != nil {
        panic(err)
    }
    return ts
}

// Stop wraps Scheduler.Stop, which requires a context.
func (ts *testScheduler) Stop() {
    ts.Scheduler.Stop(context.Background())
    _ = ts.clock.Stop(context.Background())
}

// OnStart satisfies process.Lifecycle alongside OnComplete.
func (ts *testScheduler) OnStart(context.Context, pid.PID, process.Process) error { return nil }

func (ts *testScheduler) OnComplete(_ context.Context, p pid.PID, result *runtime.Result) {
    ts.mu.Lock()
    ch, ok := ts.pending[p.UniqID]
    delete(ts.pending, p.UniqID)
    ts.mu.Unlock()
    if ok {
        ch <- result
    }
}

func (ts *testScheduler) Execute(ctx context.Context, p pid.PID, proc process.Process,
    method string, input payload.Payloads) (*runtime.Result, error) {
    resultCh := make(chan *runtime.Result, 1)
    ts.mu.Lock()
    ts.pending[p.UniqID] = resultCh
    ts.mu.Unlock()

    // relay.WithNode requires an application context. Preserve the caller's
    // frame context while attaching the relay used by the clock dispatcher.
    if ctxapi.AppFromContext(ctx) == nil {
        ctx = ctxapi.WithAppContext(ctx, ctxapi.NewAppContext())
    }
    ctx = relayapi.WithNode(ctx, ts.node)

    _, err := ts.Scheduler.Submit(ctx, p, proc, method, input)
    if err != nil {
        ts.mu.Lock()
        delete(ts.pending, p.UniqID)
        ts.mu.Unlock()
        return nil, err
    }

    select {
    case result := <-resultCh:
        return result, nil
    case <-ctx.Done():
        ts.mu.Lock()
        delete(ts.pending, p.UniqID)
        ts.mu.Unlock()
        return nil, ctx.Err()
    }
}

func testPID() pid.PID {
    return pid.PID{Host: "module.test", UniqID: "test"}.Precomputed()
}
```

スクリプトで使用するモジュールを組み込んでプロセスを作成します。この例では time モジュールを使用し、上で登録した clock dispatcher が実際の yield を処理します。

```go
func bindTimeModule(l *lua.LState) error {
    tbl, _ := timemod.Module.Build()
    l.SetGlobal(timemod.Module.Name, tbl)
    return nil
}

func newLuaProcessWithChannels(script string) (*engine.Process, error) {
    proto, err := lua.CompileString(script, "test.lua")
    if err != nil {
        return nil, err
    }
    proc, err := engine.NewProcess(
        engine.WithProto(proto),
        engine.WithModuleBinder(func(l *lua.LState) error {
            engine.LoadModuleDef(l, engine.ChannelModule)
            return nil
        }),
        engine.WithModuleBinder(bindTimeModule),
    )
    if err != nil {
        return nil, err
    }
    return proc, nil
}

func TestYieldDispatcher(t *testing.T) {
    sched := newTestScheduler()
    sched.Start()
    defer sched.Stop()

    script := `
        local ticker, ticker_err = time.ticker(10 * time.MILLISECOND)
        if ticker_err then error(ticker_err) end

        local _, open = ticker:response():receive()
        local stopped = ticker:stop()
        if not stopped then error("ticker did not stop") end
        if not open then error("ticker channel closed before the first tick") end
        return "tick"
    `

    ctx, _ := ctxapi.OpenFrameContext(context.Background())
    if err := runtime.SetFramePID(ctx, testPID()); err != nil {
        t.Fatal(err)
    }

    proc, err := newLuaProcessWithChannels(script)
    if err != nil {
        t.Fatal(err)
    }

    started := time.Now()
    result, err := sched.Execute(ctx, testPID(), proc, "", nil)
    if err != nil {
        t.Fatal(err)
    }
    if result == nil {
        t.Fatal("nil result")
    }
    if result.Error != nil {
        t.Fatalf("script failed: %v", result.Error)
    }
    if elapsed := time.Since(started); elapsed < 5*time.Millisecond {
        t.Fatalf("yield completed before the clock fired: %v", elapsed)
    }
}
```

統合テストの例については `runtime/lua/modules/time/integration_test.go` を参照してください。

## 関連項目

- [コマンドディスパッチ](./dispatch.md) - yield コマンドの処理
- [スケジューラ](./scheduler.md) - プロセスの実行
