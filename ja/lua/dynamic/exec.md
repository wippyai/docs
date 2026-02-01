# コマンド実行
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="io"/>
<secondary-label ref="permissions"/>

I/Oストリームを完全に制御して外部コマンドとシェルスクリプトを実行します。

エグゼキュータの設定については[エグゼキュータ](system-exec.md)を参照。

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
| `cmd` | string | 実行するコマンド |
| `options.work_dir` | string | 作業ディレクトリ |
| `options.env` | table | 環境変数 |

**戻り値:** `Process, error`

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
    return nil, errors.new("INTERNAL", "Build failed with exit code: " .. exit_code)
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
    return nil, errors.new("INTERNAL", table.concat(err_output))
end

return result
```

## write_stdin

プロセスのstdinにデータを書き込みます。

```lua
-- コマンドにデータをパイプ
local proc = executor:exec("sort")
local stdout = proc:stdout_stream()

proc:start()

-- 入力を書き込み
proc:write_stdin("banana\napple\ncherry\n")
proc:write_stdin("")  -- EOFを通知

-- ソートされた出力を読み取り
local sorted = stdout:read()
print(sorted)  -- "apple\nbanana\ncherry\n"

proc:wait()
stdout:close()
```

## signal / close

シグナルを送信またはプロセスを閉じます。

```lua
local proc = executor:exec("./long-running-server.sh")
proc:start()

-- ... 後でそれを停止する必要がある ...

-- グレースフルシャットダウン（SIGTERM）
proc:close()

-- または強制終了（SIGKILL）
proc:close(true)

-- または特定のシグナルを送信
local SIGINT = 2
proc:signal(SIGINT)
```

## 権限

Exec操作はセキュリティポリシー評価の対象です。

| アクション | リソース | 説明 |
|--------|----------|-------------|
| `exec.get` | エグゼキュータID | エグゼキュータリソースを取得 |
| `exec.run` | コマンド | 特定のコマンドを実行 |

## エラー

| 条件 | 種別 | 再試行可能 |
|-----------|------|-----------|
| 無効なID | `errors.INVALID` | no |
| 権限拒否 | `errors.PERMISSION_DENIED` | no |
| プロセスがクローズ済み | `errors.INVALID` | no |
| プロセスが開始されていない | `errors.INVALID` | no |
| 既に開始済み | `errors.INVALID` | no |

エラーの処理については[エラー処理](lua-errors.md)を参照。

