---
title: "メトリクス & テレメトリ"
description: "アプリケーションのカウンター、ゲージ、ヒストグラム観測値を記録します。"
---

# メトリクス & テレメトリ
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="io"/>

`metrics` モジュールは、アプリケーションのカウンター、ゲージ、ヒストグラム観測値を記録します。

このページは API リファレンスです。各スニペットは一度に 1 つの観測値を示し、コレクターのエラーを伝播します。

各関数は、アクティブなコレクターへ観測値を渡した後に `true, nil` を返します。実行コンテキストにコレクターがない場合は、`nil` と再試行不可の `errors.INTERNAL` エラーを返します。

ラベルは省略できます。キーと値の両方が文字列であるエントリだけを記録し、それ以外は暗黙に無視します。テーブルではない labels 引数は、ラベルが指定されなかったものとして扱います。

メトリクス名はローカル検証なしで転送されます。

## ロード

```lua
local metrics = require("metrics")
```

## カウンター

### `metrics.counter_inc`

カウンターを 1 増やします。

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

### `metrics.counter_add`

カウンターに値を加算します。

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

ランタイムは値を変更せず転送し、正の値であることを要求しません。

## ゲージ

### `metrics.gauge_set`

ゲージを現在値に設定します。

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

### `metrics.gauge_inc`

ゲージを 1 増やします。

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

### `metrics.gauge_dec`

ゲージを 1 減らします。

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

### `metrics.histogram`

ヒストグラム観測値を記録します。

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
| コレクターが利用不可 | `errors.INTERNAL` | いいえ |

無効な名前型または値型は、構造化エラーを返すのではなく Lua 引数エラーを発生させます。

エラーの処理については[エラー処理](../core/errors.md)を参照。
