# CLIアプリケーション

入力を読み取り、出力を書き込み、ユーザーと対話するコマンドラインツールを構築します。

## 構築するもの

ユーザーに挨拶するシンプルなCLI：

```
$ wippy run -x app:cli
Hello from CLI!
```

## プロジェクト構造

```
cli-app/
├── wippy.lock
└── src/
    ├── _index.yaml
    └── cli.lua
```

## ステップ1: プロジェクトの作成

```bash
mkdir cli-app && cd cli-app
mkdir src
```

## ステップ2: エントリ定義

`src/_index.yaml`を作成：

```yaml
version: "1.0"
namespace: app

entries:
  # ターミナルホストはプロセスをstdin/stdoutに接続
  - name: terminal
    kind: terminal.host
    lifecycle:
      auto_start: true

  # CLIプロセス
  - name: cli
    kind: process.lua
    source: file://cli.lua
    method: main
    modules:
      - io
```

<tip>
<code>terminal.host</code>はLuaプロセスをターミナルに接続します。これがないと、<code>io.print()</code>の出力先がありません。
</tip>

## ステップ3: CLIコード

`src/cli.lua`を作成：

```lua
local io = require("io")

local function main()
    io.print("Hello from CLI!")
    return 0
end

return { main = main }
```

## ステップ4: 実行

```bash
wippy init
wippy run -x app:cli
```

出力：
```
Hello from CLI!
```

<note>
<code>-x</code>フラグは<code>terminal.host</code>を自動検出し、クリーンな出力のためにサイレントモードで実行します。
</note>

## ユーザー入力の読み取り

```lua
local io = require("io")

local function main()
    io.write("Enter your name: ")
    local name = io.readline()

    if name and #name > 0 then
        io.print("Hello, " .. name .. "!")
    else
        io.print("Hello, stranger!")
    end

    return 0
end

return { main = main }
```

## カラー出力

ANSIエスケープコードで色を付ける：

```lua
local io = require("io")

local reset = "\027[0m"
local function red(s) return "\027[31m" .. s .. reset end
local function green(s) return "\027[32m" .. s .. reset end
local function yellow(s) return "\027[33m" .. s .. reset end
local function cyan(s) return "\027[36m" .. s .. reset end
local function bold(s) return "\027[1m" .. s .. reset end

local function main()
    io.print(bold(cyan("Welcome!")))
    io.write(yellow("Enter a number: "))

    local input = io.readline()
    local n = tonumber(input)

    if n then
        io.print("Squared: " .. green(tostring(n * n)))
        return 0
    else
        io.print(red("Error: ") .. "not a number")
        return 1
    end
end

return { main = main }
```

## システム情報

`system`モジュールでランタイム統計にアクセス：

```yaml
# エントリ定義に追加
modules:
  - io
  - system
```

```lua
local io = require("io")
local system = require("system")

local function main()
    io.print("Host: " .. system.process.hostname())
    io.print("CPUs: " .. system.runtime.cpu_count())
    io.print("Goroutines: " .. system.runtime.goroutines())

    local mem = system.memory.stats()
    io.print("Memory: " .. string.format("%.1f MB", mem.heap_alloc / 1024 / 1024))

    return 0
end

return { main = main }
```

## 終了コード

`main()`から戻り値で終了コードを設定：

```lua
local function main()
    if error_occurred then
        return 1  -- エラー
    end
    return 0      -- 成功
end
```

## I/Oリファレンス

| 関数 | 説明 |
|------|------|
| `io.print(...)` | 改行付きでstdoutに書き込み |
| `io.write(...)` | 改行なしでstdoutに書き込み |
| `io.eprint(...)` | 改行付きでstderrに書き込み |
| `io.readline()` | stdinから1行読み取り |
| `io.flush()` | 出力バッファをフラッシュ |

## CLIフラグ

| フラグ | 説明 |
|--------|------|
| `wippy run -x app:cli` | CLIプロセスを実行（terminal.hostを自動検出） |
| `wippy run -x app:cli --host app:term` | 明示的なターミナルホスト |
| `wippy run -x app:cli -v` | 詳細ログ付き |

## 次のステップ

- [I/Oモジュール](lua-io.md) - 完全なI/Oリファレンス
- [Systemモジュール](lua-system.md) - ランタイムとシステム情報
- [Echoサービス](echo-service.md) - マルチプロセスアプリケーション

