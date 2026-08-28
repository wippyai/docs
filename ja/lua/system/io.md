---
title: "ターミナルI/O"
description: "ターミナル入力を読み取り、標準出力と標準エラー出力へ書き込みます。"
---

# ターミナルI/O
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="io"/>

`io` モジュールは、ターミナルアプリケーションで標準入力を読み取り、標準出力と標準エラー出力へ書き込みます。

このページは API リファレンスです。各スニペットは独立した呼び出しであり、結果が制御フローに影響する場合、ターミナルプロセスは返された構造化 Lua エラーを伝播する必要があります。

<note>
このモジュールはターミナルコンテキスト内でのみ動作。通常の関数からは使用できず、<a href="../../system/terminal.md">ターミナルホスト</a>で実行されているプロセスからのみ使用可能。
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
| `...` | any | 書き込む可変数の値（文字列に変換される） |

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

ターミナルコンテキストの取得に成功した後は、出力書き込みエラーを無視して `true` を返します。ターミナルコンテキストがない場合は `nil, "no terminal context"` を返します。

## Stderrへの書き込み

値をタブ区切りで末尾に改行付きでstderrに書き込み:

```lua
io.eprint("Error:", message)
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `...` | any | 出力する可変数の値 |

**戻り値:** `boolean, error`

ターミナルコンテキストの取得に成功した後は、出力書き込みエラーを無視して `true` を返します。ターミナルコンテキストがない場合は `nil, "no terminal context"` を返します。

## バイトの読み取り

stdinから最大nバイトを読み取り:

```lua
local data, err = io.read(1024)
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `n` | integer | 読み取るバイト数（デフォルト: 1024、0以下は1024になる） |

**戻り値:** `string, error`。読み取りに成功しても、`n` バイト未満または空文字列を返すことがあります。

## 行の読み取り

stdinから改行までの1行を読み取り:

```lua
local line, err = io.readline()
```

**戻り値:** `string, error`。末尾の `\n` と `\r` は削除されます。部分入力後の EOF はその部分行を返し、入力なしの EOF は `nil` と構造化エラーを返します。

## Rawモード

Raw端末モードを有効化または無効化します（行バッファリングとエコーを無効化）:

```lua
local ok, err = io.raw(true)   -- enable
local ok, err = io.raw(false)  -- disable
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `enable` | boolean | `true` で有効化、`false` で無効化（デフォルト: `true`） |

**戻り値:** `boolean, error`。標準出力が `Sync()` を実装していない場合、この呼び出しは成功する no-op です。

Rawモードは参照カウント方式 — 各 `io.raw(true)` には対応する `io.raw(false)` が必要です。プロセス終了時に端末は自動的に通常モードにリセットされます。

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

`io.args()` は失敗しません。ターミナルコンテキストがない場合は空のテーブルを返します。

## エラー

このモジュールは構造化 Lua エラーを返します。ターミナルコンテキストがない場合は `errors.UNAVAILABLE`、直接の write/flush および無効な yield レスポンスの失敗には `errors.INTERNAL` を使用します。ディスパッチャー経由の read、readline、raw-mode の失敗は、取得できる場合に基礎となるエラーメタデータを保持します。`io.args()` にはエラー戻り値がありません。
