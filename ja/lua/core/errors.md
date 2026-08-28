---
title: "エラー"
description: "Luaエントリで構造化エラーを作成、ラップ、検査、分類する方法。"
---

# エラー
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="workflow"/>

グローバルな `errors` テーブルは、カテゴリ、詳細、再試行メタデータを持つ構造化エラーを作成し、検査します。`require` なしで利用できます。

このページはAPIリファレンスです。各コードブロックは独立したスニペットであり、完全なエントリではありません。`err` などの変数は周囲のアプリケーションコードから返されるか作成されたエラーを指します。ラップの例では、`db` がアプリケーションから提供されるデータベースクライアントであると想定しています。

## エラーの作成

```lua
-- Simple message (kind defaults to UNKNOWN)
local err = errors.new("something went wrong")

-- With kind, retryable, and details
local err = errors.new({
    message = "user not found",
    kind = errors.NOT_FOUND,
    retryable = false,
    details = {user_id = 123}
})
```

`errors.new`は文字列メッセージか、少なくとも`message`フィールドを持つテーブルを受け付けます。`(kind, message)`形式はサポートされていません。

## エラーのラップ

エラーをラップすると、kind、再試行メタデータ、detailsを保持したままコンテキストを追加できます。

```lua
local data, err = db:query("SELECT * FROM users")
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
    -- handle invalid input
end

-- Or compare directly
if err:kind() == errors.NOT_FOUND then
    -- handle missing resource
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

構造化されたコールスタックを調べるには、`errors.call_stack` を使用します。

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

再試行可能性はエラーのメタデータであり、エラー種別によって保証される特性ではありません。`err:kind()` から推測せず、`err:retryable()` の戻り値を確認してください。`nil` は、再試行が適切かどうかをエラーが指定していないことを意味します。

```lua
if err:retryable() then
    -- safe to retry
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
