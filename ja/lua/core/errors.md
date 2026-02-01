# エラー
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="workflow"/>

カテゴリ分けとリトライメタデータ付きの構造化エラー処理。グローバル`errors`テーブルはrequireなしで利用可能。

## エラーの作成

```lua
-- シンプルなメッセージ（kindはデフォルトでUNKNOWN）
local err = errors.new("something went wrong")

-- kind付き
local err = errors.new(errors.NOT_FOUND, "user not found")

-- フルコンストラクタ
local err = errors.new({
    message = "user not found",
    kind = errors.NOT_FOUND,
    retryable = false,
    details = {user_id = 123}
})
```

## エラーのラップ

kind、retryable、detailsを保持しながらコンテキストを追加：

```lua
local data, err = db.query("SELECT * FROM users")
if err then
    return nil, errors.wrap(err, "failed to load users")
end
```

## エラーメソッド

| メソッド | 戻り値 | 説明 |
|--------|---------|-------------|
| `err:kind()` | string | エラーカテゴリ |
| `err:message()` | string | エラーメッセージ |
| `err:retryable()` | boolean/nil | 操作を再試行できるかどうか |
| `err:details()` | table/nil | 構造化メタデータ |
| `err:stack()` | string | Luaスタックトレース |
| `tostring(err)` | string | 完全な表現 |

## Kindのチェック

```lua
if errors.is(err, errors.INVALID) then
    -- 無効な入力を処理
end

-- または直接比較
if err:kind() == errors.NOT_FOUND then
    -- 見つからないリソースを処理
end
```

## エラー種別

| 定数 | ユースケース |
|----------|----------|
| `errors.NOT_FOUND` | リソースが存在しない |
| `errors.ALREADY_EXISTS` | リソースが既に存在 |
| `errors.INVALID` | 不正な入力または引数 |
| `errors.PERMISSION_DENIED` | アクセス拒否 |
| `errors.UNAVAILABLE` | サービスが一時的にダウン |
| `errors.INTERNAL` | 内部エラー |
| `errors.CANCELED` | 操作がキャンセルされた |
| `errors.CONFLICT` | リソース状態のコンフリクト |
| `errors.TIMEOUT` | 操作がタイムアウト |
| `errors.RATE_LIMITED` | リクエストが多すぎる |
| `errors.UNKNOWN` | 未指定のエラー |

## コールスタック

構造化されたコールスタックを取得：

```lua
local stack = errors.call_stack(err)
if stack then
    print("Thread:", stack.thread)
    for _, frame in ipairs(stack.frames) do
        print(frame.source .. ":" .. frame.line, frame.name)
    end
end
```

## 再試行可能なエラー

| 通常再試行可能 | 再試行不可 |
|---------------------|---------------|
| `TIMEOUT` | `INVALID` |
| `UNAVAILABLE` | `NOT_FOUND` |
| `RATE_LIMITED` | `PERMISSION_DENIED` |
| | `ALREADY_EXISTS` |

```lua
if err:retryable() then
    -- 安全に再試行
end
```

## エラー詳細

```lua
local err = errors.new({
    message = "validation failed",
    kind = errors.INVALID,
    details = {
        errors = {
            {field = "email", message = "invalid format"},
            {field = "age", message = "must be positive"}
        }
    }
})

local details = err:details()
for _, e in ipairs(details.errors) do
    print(e.field, e.message)
end
```

