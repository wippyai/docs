---
title: "ターミナル"
description: "ターミナルホストはstdin/stdout/stderrアクセスを持つLuaスクリプトを実行します。"
---

# ターミナル

ターミナルホストはstdin/stdout/stderrアクセスを持つLuaスクリプトを実行します。

<note>
ターミナルホストは一度に正確に1つのプロセスを実行します。プロセス自体はターミナルI/Oコンテキストへのアクセスを持つ通常のLuaプロセスです。
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
| `hide_logs` | bool | false | イベントバスへのログ出力を抑制 |

## ターミナルコンテキスト

ターミナルホストで実行されるスクリプトは以下を含むターミナルコンテキストを受け取ります：

- **stdin** - 標準入力リーダー
- **stdout** - 標準出力ライター
- **stderr** - 標準エラーライター
- **args** - コマンドライン引数

## 合成可能なターミナル

プロセスから見えるターミナルはデバイスではなくポートです。これによりターミナルの所有権を合成できます。

ターミナルホスト上のプロセスは物理ポートを保持します。`tty.surface()`を呼び出してポートのプレゼンテーションリースを取得し、完成したフレームを公開します — 画面全体を所有します。

シェルプロセスは`tty.viewport()`で仮想ターミナルを作成して他のプロセスをホストします。`viewport:grant()`を`terminal`スポーンオプションで子プロセスに渡すと、子プロセスはそのグラントを通常のターミナルポートとして解決し、デバイスに接続されていないことを意識せずそのまま動作します。シェルは`viewport:snapshot()`で子プロセスのフレームを読み取り、自身のレイアウト内の任意の場所に配置し、`viewport:send()`で入力を子プロセスの座標系に変換します。

```lua
local view = assert(tty.viewport({width = 78, height = 20}))
local child = assert(process.with_options({terminal = assert(view:grant())})
    :spawn_monitored("app:child", "app:workers"))
```

グラントはワンショットです。プロセスのアドミッションがこれを消費し、起動が拒否された場合は未解決のまま残り、ターミナルをアタッチできないホストはオプションを黙って破棄するのではなくスポーンを拒否します。

バイト指向のプログラムは`exec`を通じて同じモデルに参加します。子プロセスがPTYプロセスを割り当て、`process:attach_terminal()`を呼び出します。このアダプターがPTYエミュレーション、入力エンコーディング、リサイズ、終了処理を担い、子プロセスが保持するポート（物理・仮想を問わず）へ描画します。

```text
physical terminal -> shell surface -> viewport -> child process -> PTY proxy
```

## Lua API

[IOモジュール](lua/system/io.md)が行指向のターミナル操作を提供します：

```lua
local io = require("io")

io.write("Enter name: ")
local name = io.readline()
io.print("Hello, " .. name)

local args = io.args()
```

ターミナルコンテキスト外で呼び出された場合、関数はエラーを返します。

生の入力イベント、スタイル付きレンダリング、サーフェス、ビューポートについては[TTY](lua/system/tty.md)を参照してください。PTYプロセスとターミナルセッションについては[コマンド実行](lua/dynamic/exec.md)を参照してください。

## 関連項目

- [Terminal I/O](lua/system/io.md) — stdin/stdout/stderr操作
- [TTY](lua/system/tty.md) — 入力イベント、サーフェス、キャンバス、ビューポート
- [コマンド実行](lua/dynamic/exec.md) — PTYプロセスとターミナルセッション
- [ターミナルUI](tutorials/tty.md) — ビューポートで子プロセスをホストするシェルを構築する
