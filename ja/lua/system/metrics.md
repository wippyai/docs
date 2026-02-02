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
metrics.counter_inc("requests_total", {method = "POST"})
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `name` | string | メトリクス名 |
| `labels` | table? | ラベルのキーバリューペア |

**戻り値:** `boolean, error`

### カウンターに加算

```lua
metrics.counter_add("bytes_total", 1024, {direction = "out"})
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
metrics.gauge_set("queue_depth", 42, {queue = "emails"})
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `name` | string | メトリクス名 |
| `value` | number | 現在の値 |
| `labels` | table? | ラベルのキーバリューペア |

**戻り値:** `boolean, error`

### ゲージをインクリメント

```lua
metrics.gauge_inc("connections", {pool = "db"})
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `name` | string | メトリクス名 |
| `labels` | table? | ラベルのキーバリューペア |

**戻り値:** `boolean, error`

### ゲージをデクリメント

```lua
metrics.gauge_dec("connections", {pool = "db"})
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `name` | string | メトリクス名 |
| `labels` | table? | ラベルのキーバリューペア |

**戻り値:** `boolean, error`

## ヒストグラム

### 観測値の記録

```lua
metrics.histogram("duration_seconds", 0.123, {method = "GET"})
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

エラーの処理については[エラー処理](lua/core/errors.md)を参照。

