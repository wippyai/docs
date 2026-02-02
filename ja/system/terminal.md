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

## Lua API

[IOモジュール](lua/system/io.md)がターミナル操作を提供します：

```lua
local io = require("io")

io.write("Enter name: ")
local name = io.readline()
io.print("Hello, " .. name)

local args = io.args()
```

ターミナルコンテキスト外で呼び出された場合、関数はエラーを返します。
