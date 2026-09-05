---
title: "コマンド実行"
description: "I/Oストリームを完全に制御して外部コマンドとシェルスクリプトを実行します。"
---

# コマンド実行
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="io"/>
<secondary-label ref="permissions"/>

I/Oストリームを完全に制御して外部コマンドとシェルスクリプトを実行します。

エグゼキュータの設定については[エグゼキュータ](system/exec.md)を参照。

## ロード

```lua
local exec = require("exec")
```

## エグゼキュータの取得

IDでプロセスエグゼキュータリソースを取得します:

```lua
local executor, err = exec.get("app:exec")
if err then
    return nil, err
end

-- エグゼキュータを使用
local proc = executor:exec("ls -la")
-- ...

-- 完了時に解放
executor:release()
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `id` | string | リソースID |

**戻り値:** `Executor, error`

## プロセスの作成

指定されたコマンドで新しいプロセスを作成します:

```lua
-- シンプルなコマンド
local proc, err = executor:exec("echo 'Hello, World!'")

-- 作業ディレクトリ付き
local proc = executor:exec("npm install", {
    work_dir = "/app/project"
})

-- 環境変数付き
local proc = executor:exec("python script.py", {
    work_dir = "/scripts",
    env = {
        PYTHONPATH = "/app/lib",
        DEBUG = "true",
        API_KEY = api_key
    }
})

-- シェルスクリプトを実行
local proc = executor:exec("./deploy.sh production", {
    work_dir = "/app/scripts",
    env = {
        DEPLOY_ENV = "production"
    }
})
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `cmd` | string | 実行ファイルとリテラルの引数 |
| `options.work_dir` | string | 作業ディレクトリ |
| `options.env` | table | 環境変数 |
| `options.pty` | table | 子プロセス用の疑似ターミナルを割り当てる |

**戻り値:** `Process, error`

プロセスは作成されますが、開始はされません。

### コマンドの解析

`cmd`は、シェル風のクォート規則で実行ファイルとリテラルの引数に分割されます。シングルクォートとダブルクォートは単語をまとめ、バックスラッシュは後続の1文字をエスケープします。シェルは介在しないため、変数展開、グロブ、パイプ、リダイレクトは行われません。閉じられていないクォートは`errors.INVALID`を返します。

```lua
-- スペースを含む1つの引数がリテラルとして渡される
local proc = executor:exec("grep 'hello world' notes.txt")

-- $HOMEは展開されず、$HOMEという5文字として渡される
local proc = executor:exec("echo $HOME")
```

シェルの機能を使うには、シェルを明示的に呼び出します:

```lua
local proc = executor:exec("/bin/sh -c 'ls *.log | wc -l'")
```

### PTYオプション

PTYを割り当てると、子プロセスは実際のターミナルを得ます。行編集、ジョブ制御、フルスクリーンプログラムがシェル上と同じように動作します。

```lua
local proc = executor:exec("/bin/bash --noprofile --norc", {
    pty = {width = 100, height = 30, term = "xterm-256color"},
})
```

| フィールド | 型 | デフォルト | 説明 |
|-----------|-----|-----------|------|
| `width` | number | 80 | PTYの初期カラム数（1〜65535）|
| `height` | number | 24 | PTYの初期行数（1〜65535）|
| `term` | string | なし | 子プロセスの`TERM`値 |

幅×高さは262,144セルを超えられません。PTYを持つプロセスは子プロセスの出力を単一のターミナルストリームにまとめます。stdin/stdoutのパイプメソッドではなく、[resize](#resize)と[attach_terminal](#attach_terminal)で操作してください。

## start / wait

プロセスを開始して完了を待機します。

```lua
local proc = executor:exec("./build.sh")

local ok, err = proc:start()
if err then
    return nil, err
end

local exit_code, err = proc:wait()
if err then
    return nil, err
end

if exit_code ~= 0 then
    return nil, errors.new({ kind = errors.INTERNAL, message = "Build failed with exit code: " .. exit_code })
end
```

## stdout_stream / stderr_stream

プロセス出力を読み取るストリームを取得します。

```lua
local proc = executor:exec("./process-data.sh")

local stdout = proc:stdout_stream()
local stderr = proc:stderr_stream()

proc:start()

-- すべてのstdoutを読み取り
local output = {}
while true do
    local chunk = stdout:read(4096)
    if not chunk then break end
    table.insert(output, chunk)
end
local result = table.concat(output)

-- エラーをチェック
local err_output = {}
while true do
    local chunk = stderr:read(4096)
    if not chunk then break end
    table.insert(err_output, chunk)
end

local exit_code = proc:wait()

stdout:close()
stderr:close()

if exit_code ~= 0 then
    return nil, errors.new({ kind = errors.INTERNAL, message = table.concat(err_output) })
end

return result
```

## write_stdin

プロセスのstdinにデータを書き込みます。

```lua
local proc = executor:exec("head -n 3")
local stdout = proc:stdout_stream()

proc:start()

proc:write_stdin("banana\napple\ncherry\n")

local lines = stdout:read()

proc:wait()
stdout:close()
```

各呼び出しは指定されたバイト列を書き込んで戻ります。stdinを閉じるメソッドはありません。stdinはプロセスの生存期間中ずっと開いたままなので、`sort`のように入力の終端まで読み取るコマンドはEOFを受け取ることがなく、プロセスにシグナルが送られるかクローズされた時点でのみ終了します。`head -n 3`のように自ら読み取りを止めるコマンドを選ぶか、EOFを必要とするコマンドは入力を供給するシェルパイプラインの背後で実行してください。

## signal / close

シグナルを送信またはプロセスを解放します。

```lua
local proc = executor:exec("./long-running-server.sh")
proc:start()

-- ... 後でそれを停止する必要がある ...

-- SIGTERMを送信してハンドルを解放
proc:close()

-- SIGKILLを送信してハンドルを解放
proc:close(true)

-- または特定のシグナルを送信し、ハンドルは保持
local SIGINT = 2
proc:signal(SIGINT)
```

`close(force?)`は、開始済みの子プロセスに`SIGTERM`を（`force`がtrueの場合は`SIGKILL`を）送信し、その後バックグラウンドで回収するため、呼び出しはブロックしません。猶予期間を過ぎても実行中の子プロセスはkillされ、回収が必ず完了します。開始されていないハンドルは単に無効化され、二重にクローズしてもエラーにはなりません。

回収時に子プロセスのstdoutとstderrのパイプが閉じられるため、必要な出力は`close()`を呼び出す前に読み取ってください。クローズ後は`wait()`を含むプロセスのすべてのメソッドが`process closed`を報告します。終了コードが必要な場合は、代わりに`signal()`と`wait()`を使用してください。

## resize

PTYを持つプロセスのPTYをリサイズします。パイプベースのプロセスではエラーを返します。

```lua
local ok, err = proc:resize(120, 40)
```

| パラメータ | 型 | 説明 |
|-----------|-----|------|
| `width` | number | カラム数（1〜65535）|
| `height` | number | 行数（1〜65535）|

**戻り値:** `boolean, error`

プロセスをターミナルセッションに渡す前に、初期ジオメトリを設定するために使用します。セッションがプロセスを所有した後は、代わりに`resize`イベントをセッションへ送信してください。

## attach_terminal

開始されていないPTYベースのプロセスを呼び出し元プロセスのターミナルにアタッチし、`TerminalSession`を返します。

```lua
local exec = require("exec")
local tty = require("tty")

local executor = assert(exec.get("app:exec"))
local proc = assert(executor:exec("/bin/bash --noprofile --norc", {
    pty = {term = "xterm-256color"},
}))
local session = assert(proc:attach_terminal())
```

**戻り値:** `TerminalSession, error`

この呼び出しはプロセスを消費します。セッションが唯一のライフサイクル所有者となり、元のハンドルは使用できなくなります。セッションは現在のターミナルポート上にサーフェスを開き、PTYエミュレーション、入力エンコーディング、リサイズ、グレースフルおよび強制終了、回収を所有します。セッションにはターミナルポートが必要で（[ターミナルホスト](system/terminal.md)上のプロセス、または[ビューポートグラント](lua/system/tty.md#viewport)付きでスポーンされたプロセス）、ポートに入力コントローラがない場合や既にサーフェスが開かれている場合は失敗します。

### TerminalSession

| メソッド | 戻り値 | 説明 |
|---------|--------|------|
| `send(event)` | `boolean, error` | 正規化されたTTYイベントを1つ子プロセスへ転送する |
| `done()` | channel | 子プロセスの終了時に一度だけ発火するチャネル |
| `status()` | `string, error` | `"running"`または`"done"`。失敗した場合はその失敗エラーを伴う |
| `close()` | `boolean, error` | 実行中の子プロセスの終了を要求する |

`send`は[TTY](lua/system/tty.md#event-types)で説明されているキー、マウス、リサイズ、フォーカス、ペーストの各レコードを受け付けます。子プロセスの終了後に送信するとエラーを返します。

```lua
local channel = require("channel")

local events = assert(tty.events())
assert(tty.start())
local done = session:done()

while true do
    local selected = channel.select({
        events:case_receive(),
        done:case_receive(),
    })
    if not selected.ok or selected.channel == done then break end
    if selected.value.type == "close" then break end
    assert(session:send(selected.value))
end

assert(session:close())
```

## 権限

Exec操作はセキュリティポリシー評価の対象です。

| アクション | リソース | 説明 |
|--------|----------|-------------|
| `exec.get` | エグゼキュータID | エグゼキュータリソースを取得 |
| `exec.run` | コマンド | 特定のコマンドを実行 |

`exec.run`は生のコマンド文字列に対して評価され、要求されたオプションがメタデータとして渡されます:

| キー | 型 | 説明 |
|------|-----|------|
| `work_dir` | string | 要求された作業ディレクトリ。未設定の場合は空 |
| `env_names` | string[] | 渡された環境変数の名前（ソート済み）。値は公開されない |
| `pty.requested` | boolean | PTYが要求されたかどうか |
| `pty.width` | number | 解決されたPTYのカラム数。要求された場合に存在 |
| `pty.height` | number | 解決されたPTYの行数。要求された場合に存在 |
| `pty.term` | string | 要求された`TERM`値。要求された場合に存在 |

したがってポリシーは、通常のコマンドは許可しつつ、ターミナルや特定の作業ディレクトリを要求するコマンドだけを制限できます。

## エラー

| 条件 | 種別 | 再試行可能 |
|-----------|------|-----------|
| 無効なID | `errors.INVALID` | no |
| 権限拒否 | `errors.INVALID` | no |
| プロセスがクローズ済み | `errors.INVALID` | no |
| プロセスが開始されていない | `errors.INVALID` | no |
| 既に開始済み | `errors.INVALID` | no |
| コマンド内のクォートが閉じられていない | `errors.INVALID` | no |
| プロセスにPTYがない | `errors.INVALID` | no |
| ターミナルポートが利用できない | `errors.UNAVAILABLE` | no |

エラーの処理については[エラー処理](lua/core/errors.md)を参照。

## 関連項目

- [エグゼキュータ](system/exec.md) — エグゼキュータの設定
- [TTY](lua/system/tty.md) — ターミナルイベント、サーフェス、ビューポート
- [ターミナルUI](tutorials/tty.md) — ビューポートでPTY子プロセスをホストするシェル

