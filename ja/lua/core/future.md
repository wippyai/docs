# Future
<secondary-label ref="function"/>
<secondary-label ref="process"/>

非同期操作の結果。Futureは`funcs.async()`およびコントラクト非同期呼び出しによって返されます。

## ロード

ロード可能なモジュールではありません。Futureは非同期操作によって作成されます：

```lua
local funcs = require("funcs")
local future, err = funcs.async("app.compute:task", data)
```

## レスポンスチャネル

結果を受信するためのチャネルを取得：

```lua
local ch = future:response()
local payload, ok = ch:receive()
if ok then
    local result = payload:data()
end
```

`channel()`は`response()`のエイリアス。

## 完了チェック

Futureが完了したかどうかのノンブロッキングチェック：

```lua
if future:is_complete() then
    local result, err = future:result()
end
```

## キャンセルチェック

`cancel()`が呼び出されたかどうかをチェック：

```lua
if future:is_canceled() then
    print("Operation was canceled")
end
```

## 結果の取得

キャッシュされた結果を取得（ノンブロッキング）：

```lua
local val, err = future:result()
```

**戻り値:**
- 未完了：`nil, nil`
- キャンセル済み：`nil, error`（kind `CANCELED`）
- エラー：`nil, error`
- 成功：`Payload, nil`または`table, nil`（複数ペイロード）

## エラーの取得

Futureが失敗した場合のエラーを取得：

```lua
local err, has_error = future:error()
if has_error then
    print("Failed:", err:message())
end
```

**戻り値:** `error, boolean`

## キャンセル

非同期操作をキャンセル（ベストエフォート）：

```lua
future:cancel()
```

操作が既に進行中の場合でも完了する可能性あり。

## タイムアウトパターン

```lua
local future = funcs.async("app.compute:slow", data)
local timeout = time.after("5s")

local r = channel.select {
    future:channel():case_receive(),
    timeout:case_receive()
}

if r.channel == timeout then
    future:cancel()
    return nil, errors.new("TIMEOUT", "Operation timed out")
end

return r.value:data()
```

## 最初に完了したもの

```lua
local f1 = funcs.async("app.cache:get", key)
local f2 = funcs.async("app.db:get", key)

local r = channel.select {
    f1:channel():case_receive(),
    f2:channel():case_receive()
}

-- 遅い方をキャンセル
if r.channel == f1:channel() then
    f2:cancel()
else
    f1:cancel()
end

return r.value:data()
```

## エラー

| 条件 | 種別 |
|-----------|------|
| 操作がキャンセルされた | `CANCELED` |
| 非同期操作が失敗 | 様々 |

