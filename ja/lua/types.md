# 型システム

Wippyはフロー感知チェック付きの漸進的型システムを含みます。型はデフォルトでnull不可。

## プリミティブ

```lua
local n: number = 3.14
local i: integer = 42         -- integerはnumberのサブタイプ
local s: string = "hello"
local b: boolean = true
local a: any = "anything"     -- 明示的動的（チェックのオプトアウト）
local u: unknown = something  -- 使用前にnarrowが必要
```

### any vs unknown

```lua
-- any: 型チェックのオプトアウト
local a: any = get_data()
a.foo.bar.baz()              -- エラーなし、ランタイムでクラッシュの可能性

-- unknown: 安全な不明、使用前にnarrowが必要
local u: unknown = get_data()
u.foo                        -- エラー: unknownのプロパティにアクセスできない
if type(u) == "table" then
    -- uはここでtableにnarrow
end
```

## Nil安全性

型はデフォルトでnull不可。オプション値には`?`を使用：

```lua
local x: number = nil         -- エラー: nilはnumberに割り当て不可
local y: number? = nil        -- OK: number?は「numberまたはnil」
local z: number? = 42         -- OK
```

### 制御フローナローイング

型チェッカーは制御フローを追跡：

```lua
local function process(x: number?): number
    if x ~= nil then
        return x              -- xはここでnumber
    end
    return 0
end

-- 早期リターンパターン
local user, err = get_user(123)
if err then return nil, err end
-- userはここで非nilにnarrow

-- またはデフォルト
local val = get_value() or 0  -- val: number
```

## ユニオン型

```lua
local val: number | string = get_value()

if type(val) == "number" then
    print(val + 1)            -- val: number
else
    print(val:upper())        -- val: string
end
```

### リテラル型

```lua
type Status = "pending" | "active" | "done"

local s: Status = "pending"   -- OK
local s: Status = "invalid"   -- エラー
```

## 関数型

```lua
local function add(a: number, b: number): number
    return a + b
end

-- 複数の戻り値
local function div_mod(a: number, b: number): (number, number)
    return math.floor(a / b), a % b
end

-- エラー戻り値（Luaイディオム）
local function fetch(url: string): (string?, error?)
    -- (data, nil)または(nil, error)を返す
end

-- ファーストクラス関数型
local double: (number) -> number = function(x: number): number
    return x * 2
end
```

### 可変長関数

```lua
local function sum(...: number): number
    local total: number = 0
    for _, v in ipairs({...}) do
        total = total + v
    end
    return total
end
```

## レコード型

```lua
type User = {name: string, age: number}

local u: User = {name = "alice", age = 25}
```

### オプションフィールド

```lua
type Config = {
    host: string,
    port: number,
    timeout?: number,
    debug?: boolean
}

local cfg: Config = {host = "localhost", port = 8080}  -- OK
```

## ジェネリクス

```lua
local function identity<T>(x: T): T
    return x
end

local n: number = identity(42)
local s: string = identity("hello")
```

### 制約付きジェネリクス

```lua
type HasName = {name: string}

local function greet<T: HasName>(obj: T): string
    return "Hello, " .. obj.name
end

greet({name = "Alice"})       -- OK
greet({age = 30})             -- エラー: 'name'がない
```

## 交差型

複数の型を結合：

```lua
type Named = {name: string}
type Aged = {age: number}
type Person = Named & Aged

local p: Person = {name = "Alice", age = 30}
```

## タグ付きユニオン

```lua
type Result<T, E> =
    | {ok: true, value: T}
    | {ok: false, error: E}

type LoadState =
    | {status: "loading"}
    | {status: "loaded", data: User}
    | {status: "error", message: string}

local function render(state: LoadState): string
    if state.status == "loading" then
        return "Loading..."
    elseif state.status == "loaded" then
        return "Hello, " .. state.data.name
    elseif state.status == "error" then
        return "Error: " .. state.message
    end
end
```

## never型

`never`はボトム型 - 値が存在しない：

```lua
function fail(msg: string): never
    error(msg)
end
```

## エラー処理パターン

チェッカーはLuaエラーイディオムを理解：

```lua
local value, err = call()
if err then
    -- valueはここでnil
    return nil, err
end
-- valueはここで非nil、errはnil
print(value)
```

## 非Nilアサーション

式が非nilであることをアサートするには`!`を使用：

```lua
local user: User? = get_user()
local name = user!.name              -- userが非nilであることをアサート
```

ランタイムで値がnilの場合、エラーが発生します。値がnilになり得ないことを知っているが、型チェッカーが証明できない場合に使用。

## 型キャスト

### 安全なキャスト（検証）

検証とキャストのために型を関数として呼び出し：

```lua
local data: any = get_json()
local user = User(data)              -- 検証してUserを返す
local name = user.name               -- 安全なフィールドアクセス
```

プリミティブとカスタム型で動作：

```lua
local x: any = get_value()
local s = string(x)                  -- stringにキャスト
local n = integer(x)                 -- integerにキャスト
local b = boolean(x)                 -- booleanにキャスト

type Point = {x: number, y: number}
local p = Point(data)                -- レコード構造を検証
```

### Type:is()メソッド

スローせずに検証、`(value, nil)`または`(nil, error)`を返す：

```lua
type Point = {x: number, y: number}
local data: any = get_input()

local p, err = Point:is(data)
if p then
    local sum = p.x + p.y            -- pは有効なPoint
else
    return nil, err                  -- 検証失敗
end
```

結果は条件でnarrow：

```lua
if Point:is(data) then
    local p: Point = data            -- dataはPointにnarrow
end
```

### 安全でないキャスト

チェックなしのキャストには`::`または`as`を使用：

```lua
local data: any = get_data()
local user = data :: User            -- ランタイムチェックなし
local user = data as User            -- ::と同じ
```

控えめに使用。安全でないキャストは検証をバイパスし、値が型に一致しない場合ランタイムエラーを引き起こす可能性。

## 型リフレクション

型はイントロスペクションメソッドを持つファーストクラス値。

### KindとName

```lua
print(Number:kind())                 -- "number"
print(Point:kind())                  -- "record"
print(Point:name())                  -- "Point"
```

### レコードフィールド

レコードフィールドをイテレート：

```lua
type User = {name: string, age: number}

for name, typ in User:fields() do
    print(name, typ:kind())
end
-- name    string
-- age     number
```

個別のフィールド型にアクセス：

```lua
local nameType = User.name           -- 'name'フィールドの型
print(nameType:kind())               -- "string"
```

### コレクション型

```lua
local arr: {number} = {1, 2, 3}
local arrType = typeof(arr)
print(arrType:elem():kind())         -- "number"

local map: {[string]: number} = {}
local mapType = typeof(map)
print(mapType:key():kind())          -- "string"
print(mapType:val():kind())          -- "number"
```

### オプション型

```lua
local opt: number? = nil
local optType = typeof(opt)
print(optType:kind())                -- "optional"
print(optType:inner():kind())        -- "number"
```

### ユニオン型

```lua
type Status = "pending" | "active" | "done"

for variant in Status:variants() do
    print(variant)
end
```

### 関数型

```lua
local fn: (number, string) -> boolean

local fnType = typeof(fn)
for param in fnType:params() do
    print(param:kind())
end
print(fnType:ret():kind())           -- "boolean"
```

### 型比較

```lua
print(Number == Number)              -- true
print(Integer <= Number)             -- true（サブタイプ）
print(Integer < Number)              -- true（厳密なサブタイプ）
```

### テーブルキーとしての型

```lua
local handlers = {}
handlers[Number] = function() return "number handler" end
handlers[String] = function() return "string handler" end

local h = handlers[typeof(value)]
if h then h() end
```

## 型アノテーション

関数シグネチャに型を追加：

```lua
-- パラメータと戻り値の型
local function process(input: string): number
    return #input
end

-- ローカル変数の型
local count: number = 0

-- 型エイリアス
type StringArray = {string}
type StringMap = {[string]: number}
```

## 変性規則

| ポジション | 変性 | 説明 |
|----------|----------|-------------|
| 読み取り専用フィールド | 共変 | サブタイプを使用可能 |
| 可変フィールド | 不変 | 正確に一致する必要 |
| 関数パラメータ | 反変 | スーパータイプを使用可能 |
| 関数戻り値 | 共変 | サブタイプを使用可能 |

## サブタイピング

- `integer`は`number`のサブタイプ
- `never`はすべての型のサブタイプ
- すべての型は`any`のサブタイプ
- ユニオンサブタイピング：`A`は`A | B`のサブタイプ

## 漸進的採用

型を段階的に追加 - 型のないコードは引き続き動作：

```lua
-- 既存のコードは変更なしで動作
function old_function(x)
    return x + 1
end

-- 新しいコードは型を取得
function new_function(x: number): number
    return x + 1
end
```

以下から型を追加開始：
1. API境界での関数シグネチャ
2. HTTPハンドラとキューコンシューマ
3. 重要なビジネスロジック

## 型チェック

型チェッカーを実行：

```bash
wippy lint
```

コードを実行せずに型エラーを報告。

