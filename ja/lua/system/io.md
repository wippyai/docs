# ターミナルI/O
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="io"/>

CLIアプリケーション用のstdinからの読み取りとstdout/stderrへの書き込み。

<note>
このモジュールはターミナルコンテキスト内でのみ動作。通常の関数からは使用できず、<a href="system-terminal.md">ターミナルホスト</a>で実行されているプロセスからのみ使用可能。
</note>

## ロード

```lua
local io = require("io")
```

## Stdoutへの書き込み

改行なしでstdoutに文字列を書き込み:

```lua
local ok, err = io.write("text", "more")
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `...` | string | 書き込む可変数の文字列 |

**戻り値:** `boolean, error`

## 改行付きPrint

値をタブ区切りで末尾に改行付きでstdoutに書き込み:

```lua
io.print("value1", "value2", 123)
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `...` | any | 出力する可変数の値 |

**戻り値:** `boolean, error`

## Stderrへの書き込み

値をタブ区切りで末尾に改行付きでstderrに書き込み:

```lua
io.eprint("Error:", message)
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `...` | any | 出力する可変数の値 |

**戻り値:** `boolean, error`

## バイトの読み取り

stdinから最大nバイトを読み取り:

```lua
local data, err = io.read(1024)
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `n` | integer | 読み取るバイト数（デフォルト: 1024、0以下は1024になる） |

**戻り値:** `string, error`

## 行の読み取り

stdinから改行までの1行を読み取り:

```lua
local line, err = io.readline()
```

**戻り値:** `string, error`

## 出力のフラッシュ

stdoutバッファをフラッシュ:

```lua
local ok, err = io.flush()
```

**戻り値:** `boolean, error`

## コマンドライン引数

コマンドライン引数を取得:

```lua
local args = io.args()
```

**戻り値:** `string[]`

## エラー

| 条件 | 種別 | 再試行可能 |
|-----------|------|-----------|
| ターミナルコンテキストがない | `errors.UNAVAILABLE` | no |
| 書き込み操作失敗 | `errors.INTERNAL` | no |
| 読み取り操作失敗 | `errors.INTERNAL` | no |
| フラッシュ操作失敗 | `errors.INTERNAL` | no |

エラーの処理については[エラー処理](lua-errors.md)を参照。

