---
title: "メトリクス & テレメトリ"
description: "<secondary-label ref='function'/ <secondary-label ref='process'/ <secondary-label ref='io'/"
---

# メトリクス & テレメトリ
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="io"/>

カウンター、ゲージ、ヒストグラムを使用してアプリケーションメトリクスを記録します。

## ロード

```lua
local metrics = require("metrics")
```

## カウンター

### カウンターをインクリメント

```lua
local recorded, err = metrics.counter_inc("requests_total", {method = "POST"})
if err then return nil, err end
return recorded
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `name` | string | メトリクス名 |
| `labels` | table? | ラベルのキーバリューペア |

**戻り値:** `boolean, error`

### カウンターに加算

```lua
local recorded, err = metrics.counter_add("bytes_total", 1024, {direction = "out"})
if err then return nil, err end
return recorded
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `name` | string | メトリクス名 |
| `value` | number | 加算する値 |
| `labels` | table? | ラベルのキーバリューペア |

**戻り値:** `boolean, error`

## ゲージ

### ゲージを設定

```lua
local recorded, err = metrics.gauge_set("queue_depth", 42, {queue = "emails"})
if err then return nil, err end
return recorded
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `name` | string | メトリクス名 |
| `value` | number | 現在の値 |
| `labels` | table? | ラベルのキーバリューペア |

**戻り値:** `boolean, error`

### ゲージをインクリメント

```lua
local recorded, err = metrics.gauge_inc("connections", {pool = "db"})
if err then return nil, err end
return recorded
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `name` | string | メトリクス名 |
| `labels` | table? | ラベルのキーバリューペア |

**戻り値:** `boolean, error`

### ゲージをデクリメント

```lua
local recorded, err = metrics.gauge_dec("connections", {pool = "db"})
if err then return nil, err end
return recorded
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `name` | string | メトリクス名 |
| `labels` | table? | ラベルのキーバリューペア |

**戻り値:** `boolean, error`

## ヒストグラム

### 観測値の記録

```lua
local recorded, err = metrics.histogram("duration_seconds", 0.123, {method = "GET"})
if err then return nil, err end
return recorded
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `name` | string | メトリクス名 |
| `value` | number | 観測値 |
| `labels` | table? | ラベルのキーバリューペア |

**戻り値:** `boolean, error`

## エラー

| 条件 | 種別 | 再試行可能 |
|-----------|------|-----------|
| コレクターが利用不可 | `errors.INTERNAL` | no |

エラーの処理については[エラー処理](../core/errors.md)を参照。
