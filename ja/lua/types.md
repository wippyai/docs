---
title: "型システム"
description: "ユニオン、レコード、ジェネリクス、検証、リフレクションを含む、Wippyの漸進的型システムの構文と実行時動作。"
---

# 型システム

> **実験的。** 型システムは現在も進化しており、いくつかの制限があります。

Wippyの漸進的型システムは、段階的な型注釈とフロー依存のチェックをサポートします。型はデフォルトでnilを許容しません。

このページは言語リファレンスであり、完全なプログラムではありません。各コードブロックは独立した型チェック例であり、同一ブロック内の代替例を組み合わせることを意図していない場合があります。`get_data`、`get_user`、`call`、`User` などの名前はアプリケーションコードを表し、`ERROR` と記された行は意図的に診断を示します。これらの例は言語構文と組み込み型値を使用するため、ランタイムモジュールは不要です。

## プリミティブ

```lua
local n: number = 3.14
local i: integer = 42         -- integer is subtype of number
local s: string = "hello"
local b: boolean = true
local a: any = "anything"     -- dynamic member and method access
local u: unknown = { source = "example" }  -- must narrow before use
```

### `any` と `unknown`

```lua
-- any: dynamic member and method access
local a: any = get_data()
a.foo.bar.baz()              -- no error, may crash at runtime
local s: string = a          -- ERROR: any is not assignable to string

-- unknown: safe unknown, must narrow before use as a concrete type
local u: unknown = get_data()
u.foo                        -- no error: member access on unknown behaves like any
local n: number = u          -- ERROR: unknown not assignable to number, narrow first
if type(u) == "table" then
    -- u narrowed to table here
end
```

## nil 安全性

型はデフォルトで非 nullable です。任意の値には `?` を使用します：

```lua
local x: number = nil         -- ERROR: nil not assignable to number
local y: number? = nil        -- OK: number? means "number or nil"
local z: number? = 42         -- OK
```

### 制御フローのナローイング

型チェッカーは制御フローを追跡します：

```lua
local function process(x: number?): number
    if x ~= nil then
        return x              -- x is number here
    end
    return 0
end

-- Early return pattern
local user, err = get_user(123)
if err then return nil, err end
-- user narrowed to non-nil here

-- Or default
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
local s: Status = "invalid"   -- ERROR
```

## 関数型

```lua
local function add(a: number, b: number): number
    return a + b
end

-- Multiple returns
local function div_mod(a: number, b: number): (number, number)
    return math.floor(a / b), a % b
end

-- Error returns (Lua idiom)
local function fetch(url: string): (string?, error?)
    -- returns (data, nil) or (nil, error)
end

-- First-class function types
local double: (number) -> number = function(x: number): number
    return x * 2
end
```

### 可変長引数関数

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
greet({age = 30})             -- ERROR: missing 'name'
```

## インターセクション型

複数の型を組み合わせます：

```lua
type Named = {name: string}
type Aged = {age: number}
type Person = Named & Aged

local p: Person = {name = "Alice", age = 30}
```

## タグ付きユニオン

```lua
type Result<T, E> =
    {ok: true, value: T}
    | {ok: false, error: E}

type LoadState =
    {status: "loading"}
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

## `never` 型

`never` はボトム型であり、取り得る値はありません。

```lua
function fail(msg: string): never
    error(msg)
end
```

## エラー処理パターン

チェッカーは、Luaで一般的な `value, error` の戻り値パターンを理解します。

```lua
local value, err = call()
if err then
    -- value is nil here
    return nil, err
end
-- value is non-nil here, err is nil
print(value)
```

## 非 nil アサーション

`!` を使用して式が非 nil であることをアサートします：

```lua
local user: User? = get_user()
local name = (user!).name            -- assert user is non-nil
```

`!` は型チェッカーだけに作用するアサーションです。型を非nilに絞り込みますが、ランタイムチェックは生成しません。実際の値がnilの場合、その後の操作は通常のエラー（nilへのインデックスアクセスなど）で失敗します。値がnilにならないと分かっていても、型チェッカーが証明できない場合に使用してください。

## 型キャスト

### ランタイム検証

型を関数として呼び出し、値を検証します。検証は、要求された静的型を持つ元の値を返します。値の変換や型強制は行いません。

```lua
local data: any = get_json()
local user = User(data)              -- validates and returns User
local name = user.name               -- safe field access
```

プリミティブ型とカスタム型の両方で使用できます。

```lua
local x: any = get_value()
local s = string(x)                  -- requires an existing string
local n = integer(x)                 -- requires an existing integer
local b = boolean(x)                 -- requires an existing boolean

type Point = {x: number, y: number}
local p = Point(data)                -- validates record structure
```

たとえば `string(42)` は検証エラーを発生させます。変換が目的の場合は `tostring(42)` を使用してください。

### Type:is() メソッド

`Type:is` は例外を投げずに検証し、`(value, nil)` または `(nil, error)` を返します。

```lua
type Point = {x: number, y: number}
local data: any = get_input()

local p, err = Point:is(data)
if p then
    local sum = p.x + p.y            -- p is valid Point
else
    return nil, err                  -- validation failed
end
```

結果は条件文内でナローイングされます：

```lua
if Point:is(data) then
    local p: Point = data            -- data narrowed to Point
end
```

### 安全でないキャスト

チェックなしのキャストには `::` または `as` を使用します：

```lua
local data: any = get_data()
local user = data :: User            -- no runtime check
local user = data as User            -- same as ::
```

控えめに使用してください。安全でないキャストは検証をバイパスし、値が型に一致しない場合にランタイムエラーを引き起こす可能性があります。

## 型のリフレクション

型は、イントロスペクションメソッドを提供するファーストクラスの値です。

### 種別と名前

```lua
type NumberType = number
print(NumberType:kind())             -- "number"
print(Point:kind())                  -- "record"
print(Point:name())                  -- "Point"
```

### レコードフィールド

レコードフィールドを反復処理します：

```lua
type User = {name: string, age: number}

for name, typ in User:fields() do
    print(name, typ:kind())
end
-- name    string
-- age     number
```

個々のフィールド型へアクセスします：

```lua
local nameType = User.name           -- type of 'name' field
print(nameType:kind())               -- "string"
```

### コレクション型

```lua
type NumberArray = {number}
print(NumberArray:elem():kind())     -- "number"

type NumberMap = {[string]: number}
print(NumberMap:key():kind())        -- "string"
print(NumberMap:val():kind())        -- "number"
```

### オプション型

```lua
type OptionalNumber = number?
print(OptionalNumber:kind())         -- "optional"
print(OptionalNumber:inner():kind()) -- "number"
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
type Predicate = (number, string) -> boolean
for param in Predicate:params() do
    print(param:kind())
end
print(Predicate:ret():kind())        -- "boolean"
```

`typeof(expression)` はランタイムのリフレクション関数ではなく、型構文です。`type Config = typeof(default_config)` のようなエイリアス内で使用します。作成されたエイリアスがランタイム型値になります。

### 型の比較

```lua
type NumberType = number
type IntegerType = integer

print(NumberType == NumberType)      -- true
print(IntegerType <= NumberType)     -- true (subtype)
print(IntegerType < NumberType)      -- true (strict subtype)
```

### テーブルキーとしての型

```lua
type NumberType = number
type StringType = string

local handlers = {}
handlers[NumberType] = function() return "number handler" end
handlers[StringType] = function() return "string handler" end

local h = handlers[NumberType]
if h then h() end
```

## 型注釈

関数シグネチャに型を追加します：

```lua
-- Parameter and return types
local function process(input: string): number
    return #input
end

-- Local variable types
local count: number = 0

-- Type aliases
type StringArray = {string}
type StringMap = {[string]: number}
```

## 型バリデータ

注釈を使用して型エイリアスに検証制約を付加し、型を呼び出すか `Type:is()` を使用して実行時に制約を適用します。

```lua
type NonNegative = number @min(0)
type Percentage = number @min(0) @max(100)
type Email = string @pattern("^.+@.+$")

local x = NonNegative(1)
local percent, err = Percentage:is(50)
local email = Email("test@example.com")
```

ローカル変数の注釈はリンターによって静的に検査されます。代入時に自動的なランタイムチェックが挿入されるわけではありません。ランタイムでの適用は、型値が値を検証するときに行われます。

### 組み込みバリデータ

| バリデータ | 適用対象 | 例 |
|-----------|------------|---------|
| `@min(n)` | number | `type Positive = number @min(1)` |
| `@max(n)` | number | `type Percentage = number @max(100)` |
| `@min_len(n)` | string、配列 | `type NonEmpty = string @min_len(1)` |
| `@max_len(n)` | string、配列 | `type ShortName = string @max_len(10)` |
| `@pattern(regex)` | string | `type Email = string @pattern("^.+@.+$")` |

### レコードフィールドバリデータ

```lua
type User = {
    age: number @min(0) @max(150),
    name: string @min_len(1) @max_len(100)
}
```

### 配列要素バリデータ

```lua
local scores: {number @min(0) @max(100)} = {85, 90}
```

### ユニオンメンバーバリデータ

```lua
local id: number @min(1) | string @min_len(1) = 1
```

## 変性のルール

| 位置 | 変性 | 説明 |
|----------|----------|-------------|
| 読み取り専用フィールド | 共変 | サブタイプを使用可能 |
| ミュータブルフィールド | 準不変 | 通常は不変ですが、新しいリテラルと絞り込みでは基底型へ拡張される場合があります |
| 関数パラメータ | 反変 | スーパータイプを使用可能 |
| 関数戻り値 | 共変 | サブタイプを使用可能 |

## サブタイピング

- `integer` は `number` のサブタイプ
- `never` はすべての型のサブタイプ
- すべての型は `any` のサブタイプ
- ユニオンサブタイピング: `A` は `A | B` のサブタイプ

## 段階的な導入

型は段階的に追加でき、型のないコードも引き続き動作します。

```lua
-- Existing code works unchanged
function old_function(x)
    return x + 1
end

-- New code gets types
function new_function(x: number): number
    return x + 1
end
```

型を追加する際は、次の箇所から始めると効果的です。

1. API 境界の関数シグネチャ
2. HTTP ハンドラとキューコンシューマ
3. 重要なビジネスロジック

## 型チェック

次のコマンドで型チェッカーを実行します。

```bash
wippy lint
```

このコマンドは、コードを実行せずに型エラーを報告します。
