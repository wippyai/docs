---
title: "ターミナル"
description: "ターミナルホストは、stdin、stdout、stderr にアクセスできる Lua スクリプトを実行します。"
---

# ターミナル

`terminal.host` は、標準入力、標準出力、標準エラー出力のストリームを使用して Lua スクリプトを実行します。このページは設定リファレンスです。Lua ブロックは、そのホストを通じて実行されることを前提としたハンドラーの断片です。

<note>
ターミナルホストは、一度に 1 つのプロセスだけを実行します。プロセス自体は、ターミナル I/O コンテキストにアクセスできる通常の Lua プロセスです。
</note>

## エントリ種別

| 種別 | 説明 |
|------|------|
| `terminal.host` | ターミナルセッションホスト |

## 設定

```yaml
- name: cli_host
  kind: terminal.host
  hide_logs: false
  lifecycle:
    auto_start: true
```

| フィールド | 型 | デフォルト | 説明 |
|------------|-----|------------|------|
| `hide_logs` | bool | false | イベントバスにログをストリーミングしながら、下流へのログ伝播を抑制 |

## ターミナルコンテキスト

ターミナルホストで実行されるスクリプトは、次の値を持つターミナルコンテキストを受け取ります。

- **stdin** — 標準入力リーダー
- **stdout** — 標準出力ライター
- **stderr** — 標準エラー出力ライター
- **args** — コマンドライン引数

## Lua API

[IO モジュール](../lua/system/io.md)がターミナル操作を提供します。

```lua
local io = require("io")

local _, write_err = io.write("Enter name: ")
if write_err then return nil, write_err end

local name, read_err = io.readline()
if read_err then return nil, read_err end

local _, print_err = io.print("Hello, " .. name)
if print_err then return nil, print_err end

local args = io.args()
```

`io.write`、`io.print`、`io.readline` は、ターミナルコンテキスト外ではエラーを返します。`io.args()` は、ターミナルコンテキストを利用できない場合に空のテーブルを返します。

## 関連項目

- [Terminal I/O](../lua/system/io.md) — stdin、stdout、stderr の操作
- [TTY](../lua/system/tty.md) — 生の入力イベント、スタイル、レイアウト
