---
title: "Future"
description: "<secondary-label ref='function'/ <secondary-label ref='process'/"
---

# Future
<secondary-label ref="function"/>
<secondary-label ref="process"/>

非同期操作の結果。Futureは`funcs.async()`およびコントラクト非同期呼び出しによって返されます。

## ロード

ロード可能なモジュールではありません。Futureは非同期操作によって作成されます：

```lua
local funcs = require("funcs")
local future, err = funcs.async("app.compute:task", data)
if err then
    return nil, err
end
```

## レスポンスチャネル

結果を受信するためのチャネルを取得：

```lua
local ch = future:response()
local _, open = ch:receive()
if not open then
    return nil, errors.new("future response channel closed")
end

local payload, err = future:result()
if err then
    return nil, err
end
local result, data_err = payload:data()
if data_err then return nil, data_err end
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
local canceled, err = future:cancel()
```

操作が既に進行中の場合でも完了する可能性あり。

**戻り値:** `boolean, error`

<warning>
ランタイムv0.3.32aでは、関数Futureとcontract Futureがプロセス全体で1つのキャンセルコールバックを共有します。両方のproviderが読み込まれている場合、<code>cancel()</code>と<code>is_canceled()</code>はproviderをまたぐ安定した契約ではありません。アプリケーションの正しさをキャンセルに依存させず、ローカルでタイムアウトし、ランタイムがproviderごとのキャンセルを分離するまでは遅れて届いた結果を無視してください。
</warning>

## タイムアウトパターン

```lua
local time = require("time")

local future, err = funcs.async("app.compute:slow", data)
if err then
    return nil, err
end

local timeout, err = time.after("5s")
if err then
    return nil, err
end

local r = channel.select {
    future:channel():case_receive(),
    timeout:case_receive()
}

if r.channel == timeout then
    -- The operation may still complete; this caller ignores the late result.
    return nil, errors.new({
        message = "Operation timed out",
        kind = errors.TIMEOUT
    })
end

local payload, result_err = future:result()
if result_err then
    return nil, result_err
end
local value, data_err = payload:data()
if data_err then return nil, data_err end
return value
```

## 最初に完了したもの

```lua
local f1, err = funcs.async("app.cache:get", key)
if err then
    return nil, err
end
local f2, err = funcs.async("app.db:get", key)
if err then
    return nil, err
end

local ch1 = f1:channel()
local ch2 = f2:channel()

local r = channel.select {
    ch1:case_receive(),
    ch2:case_receive()
}

-- The slower operation may still complete; this caller ignores its result.
local winner
if r.channel == ch1 then
    winner = f1
else
    winner = f2
end

local payload, result_err = winner:result()
if result_err then
    return nil, result_err
end
local value, data_err = payload:data()
if data_err then return nil, data_err end
return value
```

## エラー

| 条件 | 種別 |
|-----------|------|
| 操作がキャンセルされた | `CANCELED` |
| 非同期操作が失敗 | 様々 |
