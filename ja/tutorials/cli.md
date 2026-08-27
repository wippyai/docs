---
title: "CLIアプリケーション"
description: "入力を読み取り、出力を書き込み、ユーザーと対話するコマンドラインツールを構築します。"
---

# CLIアプリケーション

ターミナルに出力するコマンドラインプロセスを構築し、入力、色、システム情報、名前付きコマンドへと拡張します。

**分類:** 実行可能なチュートリアルです。挨拶アプリケーションは完全な構成です。
後半の各セクションは、記載されているとおり`src/cli.lua`または`app:cli`エントリを
置き換えて試せるオプションです。

## 構築するもの

挨拶を表示するCLIプロセス：

```
$ wippy run -x app:cli
Hello from CLI!
```

## 前提条件

- `wippy`として実行できるWippyランタイム`v0.3.32a`。`wippy version --short`で確認してください。
- 対話型ターミナル。入力例には標準入力が必要で、カラー表示にはANSIエスケープシーケンスを
  表示できるターミナルが必要です。

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
  # Terminal host connects processes to stdin/stdout
  - name: terminal
    kind: terminal.host
    lifecycle:
      auto_start: true

  # CLI process
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

期待される出力：
```
Hello from CLI!
```

<note>
<code>-x</code>フラグはプロセスをコマンドとして実行します。レジストリ内に1つだけある
<code>terminal.host</code>を自動検出します。複数のターミナルホストがある場合は<code>--host</code>を
使用してください。ログフラグを指定しないコマンドモードではランタイムログが抑制され、
プロセスの出力を読みやすく保ちます。
</note>

## ユーザー入力の読み取り

`src/cli.lua`を次のバージョンに置き換えます。ターミナルの読み書きエラーを空入力として扱わず報告します：

```lua
local io = require("io")

local function main()
    local _, write_err = io.write("Enter your name: ")
    if write_err then
        io.eprint("Cannot write prompt:", write_err)
        return 1
    end

    local _, flush_err = io.flush()
    if flush_err then
        io.eprint("Cannot flush prompt:", flush_err)
        return 1
    end

    local name, read_err = io.readline()
    if read_err then
        io.eprint("Cannot read input:", read_err)
        return 1
    end

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

ANSIエスケープコードで色を付けるには、`src/cli.lua`を次のバージョンに置き換えます：

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
    local _, write_err = io.write(yellow("Enter a number: "))
    if write_err then
        io.eprint("Cannot write prompt:", write_err)
        return 1
    end

    local _, flush_err = io.flush()
    if flush_err then
        io.eprint("Cannot flush prompt:", flush_err)
        return 1
    end

    local input, read_err = io.readline()
    if read_err then
        io.eprint("Cannot read input:", read_err)
        return 1
    end
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

システム情報の読み取りは保護された操作です。次のポリシーを追加し、`app:cli`エントリを
置き換えて、コマンドにアクター、ポリシー、`system`モジュールを設定します：

```yaml
  - name: cli-system-read
    kind: security.policy
    policy:
      actions:
        - system.read
      resources: "*"
      effect: allow

  - name: cli
    kind: process.lua
    source: file://cli.lua
    method: main
    modules:
      - io
      - system
    security:
      actor:
        id: app:cli
      policies:
        - app:cli-system-read
```

続いて`src/cli.lua`を置き換えます：

```lua
local io = require("io")
local system = require("system")

local function main()
    local hostname, hostname_err = system.process.hostname()
    if hostname_err then
        io.eprint("Cannot read hostname:", hostname_err)
        return 1
    end

    local cpu_count, cpu_err = system.runtime.cpu_count()
    if cpu_err then
        io.eprint("Cannot read CPU count:", cpu_err)
        return 1
    end

    local goroutines, goroutine_err = system.runtime.goroutines()
    if goroutine_err then
        io.eprint("Cannot read goroutine count:", goroutine_err)
        return 1
    end

    local mem, memory_err = system.memory.stats()
    if memory_err then
        io.eprint("Cannot read memory stats:", memory_err)
        return 1
    end

    io.print("Host: " .. hostname)
    io.print("CPUs: " .. cpu_count)
    io.print("Goroutines: " .. goroutines)
    io.print("Memory: " .. string.format("%.1f MB", mem.heap_alloc / 1024 / 1024))

    return 0
end

return { main = main }
```

## 名前付きコマンド

`-x app:cli`を使わずに名前でプロセスを呼び出すには、コマンドメタデータを追加します。

`app:cli`エントリを次のバージョンに置き換えます。基本プロジェクトの`terminal.host`エントリは残してください。

```yaml
  - name: cli
    kind: process.lua
    meta:
      command:
        name: greet
        short: Greet the user
    source: file://cli.lua
    method: main
    modules:
      - io
```

名前付きコマンドを実行します：

```bash
wippy run greet
```

利用可能なすべてのコマンドを一覧表示:

```bash
wippy run list
```

```
Available commands:

  greet  Greet the user  (app:cli)

Run with: wippy run <command>
```

## 終了コード

`main()`から数値を返すとプロセスの終了コードを設定できます：

```lua
local function main()
    if error_occurred then
        return 1  -- Error
    end
    return 0      -- Success
end
```

## I/Oリファレンス

| 関数 | 戻り値 | 説明 |
|------|--------|------|
| `io.print(...)` | ターミナルコンテキストがない場合は`boolean`または`nil, error` | タブ区切りと末尾の改行を付けてstdoutに書き込み |
| `io.write(...)` | `boolean, error` | 区切り文字や改行を付けずにstdoutへ書き込み |
| `io.eprint(...)` | ターミナルコンテキストがない場合は`boolean`または`nil, error` | タブ区切りと末尾の改行を付けてstderrに書き込み |
| `io.readline()` | `string, error` | 末尾の改行を除いて1行読み取り。データのないEOFはエラー |
| `io.flush()` | `boolean, error` | ストリームが対応している場合にstdoutをフラッシュ |

## CLIフラグ

| フラグ | 説明 |
|--------|------|
| `wippy run -x app:cli` | CLIプロセスを実行（terminal.hostを自動検出） |
| `wippy run -x app:cli --host app:terminal` | 明示的なターミナルホスト |
| `wippy run -x app:cli -v` | 詳細ログ付き |

## トラブルシューティングとクリーンアップ

- `no terminal host found`はレジストリに`terminal.host`がないことを示します。ステップ2のエントリを使用してください。
  複数のホストがある場合は`--host app:terminal`を渡します。
- `no terminal context`はプロセスがターミナルホスト経由で起動されていないことを示します。
  バックグラウンドの`process.service`ではなく、`wippy run -x app:cli`を使用してください。
- 標準入力が閉じている場合、EOFでの入力エラーは想定どおりです。入力例は対話型ターミナルで実行してください。
- ANSIシーケンスが文字列として表示される場合は、カラーなしの例かANSI対応ターミナルを使用してください。
- `main()`が戻るとコマンドは終了します。使い捨ての演習であれば、ディレクトリを離れた後に`cli-app/`を削除してください。

## 次のステップ

- [I/Oモジュール](../lua/system/io.md) — I/O APIリファレンス
- [Systemモジュール](../lua/system/system.md) — ランタイムとシステム情報
- [Echoサービス](echo-service.md) — マルチプロセスアプリケーションを構築する
