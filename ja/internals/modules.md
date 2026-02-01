# Luaモジュール

ランタイムモジュールはLua環境を新しい機能で拡張します。モジュールは決定論的ユーティリティ、I/O操作、または外部システムにyieldする非同期コマンドを提供できます。

> Luaランタイムの実装は将来のバージョンで変更される可能性があります。

## モジュール定義

すべてのモジュールは`luaapi.ModuleDef`を使用：

```go
var Module = &luaapi.ModuleDef{
    Name:        "mymodule",
    Description: "My custom module",
    Class:       []string{luaapi.ClassDeterministic},
    Types:       ModuleTypes,  // ツーリング用型定義
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
| `ClassStorage` | データ永続化 |
| `ClassWorkflow` | ワークフロー安全な操作 |

`ClassDeterministic`のみでタグ付けされたモジュールはワークフロー安全。I/Oやネットワーククラスを追加すると、モジュールは関数とプロセスに制限。

## 関数の公開

関数は`func(l *lua.LState) int`のシグネチャを持ち、戻り値はスタックにプッシュされた値の数：

```go
func greetFunc(l *lua.LState) int {
    name := l.CheckString(1)           // 必須引数
    greeting := l.OptString(2, "Hello") // デフォルト付きオプション

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
mod.Immutable = true  // Luaがエクスポートを変更するのを防止
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
func ModuleTypes() *types.TypeManifest {
    m := types.NewManifest("mymodule")

    objectType := &types.InterfaceType{
        Name: "mymodule.Object",
        Methods: map[string]*types.FunctionType{
            "get_value": types.NewFunction(nil, []types.Type{types.String}),
            "set_value": types.NewFunction([]types.Type{types.String}, nil),
        },
    }

    m.DefineType("Object", objectType)
    m.SetExport(moduleType)
    return m
}
```

**利用可能な型構成：**

| 型 | 説明 |
|----|------|
| `types.String` | 文字列プリミティブ |
| `types.Number` | 数値 |
| `types.Boolean` | ブール値 |
| `types.Any` | 任意のLua値 |
| `types.LuaError` | エラー型 |
| `types.Optional(t)` | 型tのオプション値 |
| `types.InterfaceType` | メソッドを持つオブジェクト |
| `types.FunctionType` | パラメータ/戻り値を持つ関数シグネチャ |
| `types.RecordType` | 構造体的な型（フィールド付き） |
| `types.TableType` | キー/値型を持つテーブル |

関数シグネチャは可変長パラメータをサポート：

```go
// (string, ...any) -> (string, error?)
types.FunctionType{
    Params:   []types.Type{types.String},
    Variadic: types.Any,
    Returns:  []types.Type{types.String, types.Optional(types.LuaError)},
}
```

完全な型システムについてはgo-luaの`types`パッケージを参照。

### UserDataバインディング（ランタイム）

`RegisterTypeMethods`は実際のGoからLuaへのバインディングを作成：

```go
func init() {
    value.RegisterTypeMethods(nil, "mymodule.Object",
        map[string]lua.LGoFunc{
            "__tostring": objectToString,  // メタメソッド
        },
        map[string]lua.LGoFunc{
            "get_value": objectGetValue,   // 通常メソッド
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
    return -1  // yieldをシグナル、スタックカウントではない
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

ディスパッチャはコマンドをハンドラにルーティング。ハンドラの実装については[コマンドディスパッチ](internal-dispatch.md)を参照。

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

    // 操作を続行
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
    mu      sync.Mutex
    pending map[string]chan *runtime.Result
}

func newTestScheduler() *testScheduler {
    ts := &testScheduler{pending: make(map[string]chan *runtime.Result)}
    reg := scheduler.NewRegistry()

    // モジュールが使用するyield用のディスパッチャを登録
    clockSvc := clock.NewDispatcher()
    clockSvc.RegisterAll(func(id dispatcher.CommandID, h dispatcher.Handler) {
        reg.Register(id, h)
    })
    ts.clock = clockSvc

    ts.Scheduler = actor.NewScheduler(reg, actor.WithWorkers(4), actor.WithLifecycle(ts))
    return ts
}
```

完全な例については`runtime/lua/modules/time/integration_test.go`を参照。

## 関連項目

- [コマンドディスパッチ](internal-dispatch.md) - yieldコマンドの処理
- [スケジューラ](internal-scheduler.md) - プロセス実行

