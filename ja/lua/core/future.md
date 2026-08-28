---
title: "Future"
description: "非同期の関数呼び出しとコントラクト呼び出しの結果を受信、調査、キャンセルします。"
---

# Future
<secondary-label ref="function"/>
<secondary-label ref="process"/>

Future は非同期操作の結果を表し、`funcs.async()` および非同期コントラクト呼び出しから返されます。このページは API リファレンスです。例にあるターゲット ID と引数はアプリケーションが定義します。

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

レスポンスチャネルで完了を待ち、その後 Future からキャッシュ済み結果を読み取ります。

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

チャネル値は操作のペイロード、ペイロードテーブル、またはエラーです。チャネルが準備完了になった後に `result()` を呼ぶと、成功と失敗を一貫した形で処理でき、チャネルを読み終えた後もキャッシュ済み値が返ります。

## 完了チェック

Futureが完了したかどうかのノンブロッキングチェック：

```lua
if future:is_complete() then
    local result, err = future:result()
end
```

## キャンセルチェック

Future がプロバイダーによってキャンセル済みとマークされたかどうかを確認します。

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

操作が失敗した場合、`error()` は再試行不可の `INTERNAL` ラッパーを返します。呼び出した関数の元のエラー種別と再試行可能性を保持する必要がある場合は `result()` を使用してください。

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

| 条件 | 種別 | 再試行可能 |
|-----------|------|-----------|
| `result()` を通じて操作がキャンセルされた | `errors.CANCELED` | no |
| `result()` が返す操作エラー | 関数エラーの種別を保持 | 関数エラーから保持 |
| `error()` が返す操作エラー | `errors.INTERNAL` | no |
| キャンセルのディスパッチに失敗 | `errors.INTERNAL` | no |
