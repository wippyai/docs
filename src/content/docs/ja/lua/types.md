---
title: "型システム"
---

# 型システム

> **試験的。** 一部の制限が予想されます。

Wippy には、フローセンシティブなチェックを伴う段階的型システムが含まれています。型はデフォルトで非 nullable です。

## プリミティブ

```lua
local n: number = 3.14
local i: integer = 42         -- integer は number のサブタイプ
local s: string = "hello"
local b: boolean = true
local a: any = "anything"     -- 明示的な動的型（チェックを無効化）
local u: unknown = something  -- 使用前にナローイングが必要
```

### any vs unknown

```lua
-- any: 型チェックを無効化
local a: any = get_data()
a.foo.bar.baz()              -- エラーなし、ランタイムでクラッシュする可能性がある

-- unknown: 安全な未知の型、使用前にナローイングが必要
local u: unknown = get_data()
u.foo                        -- エラー: unknown のプロパティにはアクセスできません
if type(u) == "table" then
    -- ここで u は table にナローイングされる
end
```

## nil 安全性

型はデフォルトで非 nullable です。任意の値には `?` を使用します：

```lua
local x: number = nil         -- エラー: nil は number に代入できない
local y: number? = nil        -- OK: number? は「number または nil」を意味する
local z: number? = 42         -- OK
```

### 制御フローのナローイング

型チェッカーは制御フローを追跡します：

```lua
local function process(x: number?): number
    if x ~= nil then
        return x              -- ここで x は number
    end
    return 0
end

-- 早期リターンパターン
local user, err = get_user(123)
if err then return nil, err end
-- ここで user は非 nil にナローイングされる

-- またはデフォルト値
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

-- エラー戻り値（Lua のイディオム）
local function fetch(url: string): (string?, error?)
    -- (data, nil) または (nil, error) を返す
end

-- ファーストクラスの関数型
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
greet({age = 30})             -- エラー: 'name' がない
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

## never 型

`never` はボトム型です — 値は存在しません：

```lua
function fail(msg: string): never
    error(msg)
end
```

## エラー処理パターン

チェッカーは Lua のエラーイディオムを理解します：

```lua
local value, err = call()
if err then
    -- ここで value は nil
    return nil, err
end
-- ここで value は非 nil、err は nil
print(value)
```

## 非 nil アサーション

`!` を使用して式が非 nil であることをアサートします：

```lua
local user: User? = get_user()
local name = user!.name              -- user が非 nil であることをアサート
```

ランタイム時に値が nil の場合、エラーが発生します。値が nil でないことが分かっているが、型チェッカーがそれを証明できない場合に使用します。

## 型キャスト

### 安全なキャスト（検証）

検証してキャストするために、型を関数として呼び出します：

```lua
local data: any = get_json()
local user = User(data)              -- 検証して User を返す
local name = user.name               -- 安全なフィールドアクセス
```

プリミティブ型とカスタム型の両方で動作します：

```lua
local x: any = get_value()
local s = string(x)                  -- string にキャスト
local n = integer(x)                 -- integer にキャスト
local b = boolean(x)                 -- boolean にキャスト

type Point = {x: number, y: number}
local p = Point(data)                -- レコード構造を検証する
```

### Type:is() メソッド

スローせずに検証し、`(value, nil)` または `(nil, error)` を返します：

```lua
type Point = {x: number, y: number}
local data: any = get_input()

local p, err = Point:is(data)
if p then
    local sum = p.x + p.y            -- p は有効な Point
else
    return nil, err                  -- 検証失敗
end
```

結果は条件文内でナローイングされます：

```lua
if Point:is(data) then
    local p: Point = data            -- data は Point にナローイングされる
end
```

### 安全でないキャスト

チェックなしのキャストには `::` または `as` を使用します：

```lua
local data: any = get_data()
local user = data :: User            -- ランタイムチェックなし
local user = data as User            -- :: と同じ
```

控えめに使用してください。安全でないキャストは検証をバイパスし、値が型に一致しない場合にランタイムエラーを引き起こす可能性があります。

## 型のリフレクション

型はイントロスペクションメソッドを持つファーストクラスの値です。

### 種別と名前

```lua
print(Number:kind())                 -- "number"
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
local nameType = User.name           -- 'name' フィールドの型
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

### 型の比較

```lua
print(Number == Number)              -- true
print(Integer <= Number)             -- true (サブタイプ)
print(Integer < Number)              -- true (厳密なサブタイプ)
```

### テーブルキーとしての型

```lua
local handlers = {}
handlers[Number] = function() return "number handler" end
handlers[String] = function() return "string handler" end

local h = handlers[typeof(value)]
if h then h() end
```

## 型注釈

関数シグネチャに型を追加します：

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

## 型バリデータ

注釈を使用して型にランタイム検証制約を追加します：

```lua
-- 単一バリデータ
local x: number @min(0) = 1

-- 複数バリデータ
local x: number @min(0) @max(100) = 50

-- 文字列パターン
local email: string @pattern("^.+@.+$") = "test@example.com"

-- 引数なしバリデータ
local x: number @integer = 42
```

### 組み込みバリデータ

| バリデータ | 適用対象 | 例 |
|-----------|------------|---------|
| `@min(n)` | number | `local x: number @min(0) = 1` |
| `@max(n)` | number | `local x: number @max(100) = 50` |
| `@min_len(n)` | string、配列 | `local s: string @min_len(1) = "hi"` |
| `@max_len(n)` | string、配列 | `local s: string @max_len(10) = "hi"` |
| `@pattern(regex)` | string | `local email: string @pattern("^.+@.+$") = "a@b.com"` |

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
| ミュータブルフィールド | 不変 | 完全に一致する必要がある |
| 関数パラメータ | 反変 | スーパータイプを使用可能 |
| 関数戻り値 | 共変 | サブタイプを使用可能 |

## サブタイピング

- `integer` は `number` のサブタイプ
- `never` はすべての型のサブタイプ
- すべての型は `any` のサブタイプ
- ユニオンサブタイピング: `A` は `A | B` のサブタイプ

## 段階的な導入

型を段階的に追加します — 型のないコードは引き続き動作します：

```lua
-- 既存のコードは変更なしで動作
function old_function(x)
    return x + 1
end

-- 新しいコードに型を付ける
function new_function(x: number): number
    return x + 1
end
```

以下の箇所から型を追加し始めます：
1. API 境界の関数シグネチャ
2. HTTP ハンドラとキューコンシューマ
3. 重要なビジネスロジック

## 型チェック

型チェッカーを実行します：

```bash
wippy lint
```

コードを実行せずに型エラーをレポートします。
