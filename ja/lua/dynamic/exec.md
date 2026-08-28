---
title: "コマンド実行"
description: "外部プロセスを開始し、ストリームデータを交換し、完了を待機してシグナルを送信します。"
---

# コマンド実行
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="io"/>
<secondary-label ref="permissions"/>

`exec` モジュールは外部実行ファイルを開始し、その入力、出力、ライフサイクル、シグナルへアクセスできるようにします。このページは部分的なレシピを含む API リファレンスです。executor ID、コマンド、パス、環境値、セキュリティポリシーは周囲のアプリケーションから与えられます。

executor はコマンド文字列を実行ファイルと引数へ解析し、シェルを起動しません。パイプ、リダイレクト、変数展開、コマンド置換などのシェル演算子は解釈されません。実行可能スクリプトを直接起動できるのは、選択したバックエンドと OS が対応している場合だけです。

例を使用する前に、[エグゼキュータ](../../system/exec.md)の説明に従って executor リソースとコマンド allowlist を構成し、使用する正確なリソースに `exec.get` と `exec.run` を許可してください。例では Unix コマンドとパスを使うため、executor host で利用可能なものに置き換えてください。

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
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `id` | string | リソースID |

**戻り値:** `Executor, error`

## プロセスの作成

指定されたコマンドで新しいプロセスを作成します:

```lua
local proc, err = executor:exec("python script.py", {
    work_dir = "/scripts",
    env = {
        PYTHONPATH = "/app/lib",
        DEBUG = "true",
        API_KEY = api_key
    }
})
if err then
    executor:release() -- release is specified to return true, nil
    return nil, err
end
```

引用符付き引数は native executor の parser によってグループ化され、シェル評価なしで実行ファイルへ直接渡されます。native executor では、`command_whitelist` のエントリと `exec.run` ポリシーリソースは、実行ファイル名だけでなく完全なコマンド文字列に一致します。

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `cmd` | string | 実行するコマンド |
| `options.work_dir` | string | 作業ディレクトリ |
| `options.env` | table | 環境変数 |

**戻り値:** `Process, error`

## start / wait

プロセスを開始して完了を待機します。

```lua
local executor, get_err = exec.get("app:exec")
if get_err then
    return nil, get_err
end

local proc, create_err = executor:exec("./build.sh")
if create_err then
    executor:release()
    return nil, create_err
end

local ok, start_err = proc:start()
if start_err then
    proc:close(true)
    executor:release()
    return nil, start_err
end

local exit_code, wait_err = proc:wait()
local _, release_err = executor:release()
if wait_err then
    return nil, wait_err
end
if release_err then
    return nil, release_err
end

if exit_code ~= 0 then
    return nil, errors.new({
        message = "Build failed with exit code: " .. exit_code,
        kind = errors.INTERNAL
    })
end
```

`wait()` は child の終了まで yield し、終了コードを返して reap した後、プロセスハンドルを閉じます。`wait()` 後の他のプロセスメソッドは、プロセスが閉じているため `errors.INVALID` を返します。

## stdout_stream / stderr_stream

プロセス出力を読み取るストリームを取得します。

```lua
local function fail(err)
    proc:close(true)   -- close is specified to return true, nil
    executor:release()
    return nil, err
end

local function drain(stream, done)
    coroutine.spawn(function()
        local chunks = {}
        while true do
            local chunk, read_err = stream:read(4096)
            if read_err then
                done:send({err = read_err})
                return
            end
            if not chunk then
                done:send({data = table.concat(chunks)})
                return
            end
            table.insert(chunks, chunk)
        end
    end)
end

local _, start_err = proc:start()
if start_err then return fail(start_err) end

local stdout, stdout_err = proc:stdout_stream()
if stdout_err then return fail(stdout_err) end
local stderr, stderr_err = proc:stderr_stream()
if stderr_err then return fail(stderr_err) end

local stdout_done = channel.new(1)
local stderr_done = channel.new(1)
drain(stdout, stdout_done)
drain(stderr, stderr_done)

local stdout_result
local stderr_result
while not stdout_result or not stderr_result do
    local cases = {}
    if not stdout_result then table.insert(cases, stdout_done:case_receive()) end
    if not stderr_result then table.insert(cases, stderr_done:case_receive()) end

    local selected = channel.select(cases)
    if not selected.ok then
        return fail(errors.new("output drain channel closed"))
    end
    if selected.value.err then return fail(selected.value.err) end

    if selected.channel == stdout_done then
        stdout_result = selected.value
    else
        stderr_result = selected.value
    end
end

local _, stdout_close_err = stdout:close()
if stdout_close_err then return fail(stdout_close_err) end
local _, stderr_close_err = stderr:close()
if stderr_close_err then return fail(stderr_close_err) end

local exit_code, wait_err = proc:wait()
if wait_err then return fail(wait_err) end

local _, release_err = executor:release()
if release_err then return nil, release_err end

return {
    exit_code = exit_code,
    stdout = stdout_result.data,
    stderr = stderr_result.data
}
```

## write_stdin

プロセスのstdinにデータを書き込みます。

```lua
-- This command exits after reading three lines; it does not require an EOF signal
local proc, create_err = executor:exec("head -n 3")
if create_err then
    executor:release()
    return nil, create_err
end

local function fail(err)
    proc:close(true)
    executor:release()
    return nil, err
end

local _, start_err = proc:start()
if start_err then
    return fail(start_err)
end

local stdout, stream_err = proc:stdout_stream()
if stream_err then
    return fail(stream_err)
end

for _, line in ipairs({"banana\n", "apple\n", "cherry\n"}) do
    local _, write_err = proc:write_stdin(line)
    if write_err then
        return fail(write_err)
    end
end

-- Read until the bounded command exits and closes stdout
local chunks = {}
while true do
    local chunk, read_err = stdout:read(4096)
    if read_err then
        return fail(read_err)
    end
    if not chunk then break end
    table.insert(chunks, chunk)
end
print(table.concat(chunks))  -- "banana\napple\ncherry\n"

local _, close_err = stdout:close()
if close_err then
    return fail(close_err)
end

local exit_code, wait_err = proc:wait()
if wait_err then return fail(wait_err) end
local _, release_err = executor:release()
if release_err then return nil, release_err end
if exit_code ~= 0 then
    return nil, errors.new("head exited with code " .. exit_code)
end
```

この部分的なレシピは、ブロック開始時点で `executor` が有効であることを前提とします。

## signal / close

シグナルを送信またはプロセスを閉じます。

```lua
-- Stop and discard the handle. close() sends SIGTERM, reaps in the
-- background, and returns true even if signaling fails.
local _, close_err = proc:close()
if close_err then return nil, close_err end

-- For immediate forced shutdown, use this instead:
-- local _, close_err = proc:close(true) -- SIGKILL

-- When the exit code matters, signal and then wait instead of closing:
-- local _, signal_err = proc:signal(2) -- SIGINT on Unix
-- if signal_err then return nil, signal_err end
-- local exit_code, wait_err = proc:wait()
```

`close()` は冪等です。`close()` または `wait()` がハンドルを閉じた後は、`signal()`、`start()`、`wait()`、ストリームアクセスが `errors.INVALID` を返します。シグナル番号と動作は executor バックエンドおよび OS に依存します。

## 権限

Exec操作はセキュリティポリシー評価の対象です。

| アクション | リソース | 説明 |
|--------|----------|-------------|
| `exec.get` | エグゼキュータID | エグゼキュータリソースを取得 |
| `exec.run` | コマンド | 特定のコマンドを実行 |

## エラー

| 条件 | 種別 | 再試行可能 |
|-----------|------|-----------|
| 無効なID | `errors.INVALID` | いいえ |
| 権限拒否 | `errors.INVALID` | いいえ |
| プロセスがクローズ済み | `errors.INVALID` | いいえ |
| プロセスが開始されていない | `errors.INVALID` | いいえ |
| 既に開始済み | `errors.INVALID` | いいえ |
| executor の取得またはプロセス作成に失敗 | `errors.INTERNAL` | いいえ |
| start、wait、signal、stdin、ストリーム操作に失敗 | `errors.INTERNAL` | いいえ |

ランタイム `v0.3.32a` では、`exec.get` と `exec.run` のポリシー拒否は `errors.PERMISSION_DENIED` ではなく `errors.INVALID` を使用します。

エラーの処理については[エラー処理](../core/errors.md)を参照。
