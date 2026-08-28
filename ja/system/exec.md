---
title: "エグゼキューター"
description: "ネイティブまたは Docker のコマンドエグゼキューター、作業ディレクトリ、環境、許可リスト、リソース制御を設定します。"
---

# エグゼキューター

エグゼキューターエントリは、外部コマンドをオペレーティングシステムのネイティブプロセスまたは Docker コンテナー内で実行します。

このページは設定および API のリファレンスです。エントリのコードブロックは既存のエントリリストに配置する断片です。Lua の例では、`app:shell` という名前のエグゼキューターと、許可された `git status` コマンドを前提としています。

## エントリ種別

| 種別 | 説明 |
|------|------|
| `exec.native` | ホスト OS 上でコマンドを直接実行 |
| `exec.docker` | Docker コンテナー内でコマンドを実行 |

## ネイティブエグゼキューター

ネイティブエグゼキューターは、ホストオペレーティングシステム上でコマンドを直接実行します。

```yaml
- name: shell
  kind: exec.native
  default_work_dir: /app
  default_env:
    PATH: /usr/local/bin:/usr/bin:/bin
    LANG: en_US.UTF-8
  command_whitelist:
    - git status
    - git diff
    - npm run build
```

| フィールド | 型 | デフォルト | 説明 |
|------------|-----|------------|------|
| `default_work_dir` | string | - | すべてのコマンドの作業ディレクトリ |
| `default_env` | map | - | 環境変数（コマンドごとの env とマージ） |
| `command_whitelist` | string[] | - | 設定した場合、これらと完全に一致するコマンドだけを許可 |

<note>
ネイティブエグゼキューターは、デフォルトでクリーンな環境を使用します。明示的に設定した環境変数だけが子プロセスに渡されます。
</note>

コマンドは実行可能ファイルと引数のリストに解析され、シェルを経由して実行されることはありません。パイプ、リダイレクト、変数展開、その他のシェル構文に特別な意味はありません。シェル式を実行するには、シェル、そのコマンドフラグ、式を引数として明示的に許可し、呼び出してください。

## Docker エグゼキューター

Docker エグゼキューターは、Docker コンテナー内でコマンドを実行します。

Docker コマンドも実行可能ファイルと引数に直接解析され、コンテナーコマンドとして割り当てられます。コマンドが明示的にシェルを呼び出さない限り、シェル展開は行われません。

```yaml
- name: sandbox
  kind: exec.docker
  image: python:3.11-slim
  default_work_dir: /workspace
  network_mode: none
  memory_limit: 536870912
  cpu_quota: 50000
  auto_remove: true
  read_only_rootfs: true
  no_new_privileges: true
  cap_drop:
    - ALL
  tmpfs:
    /tmp: rw,noexec,nosuid,size=64m
  volumes:
    - /app/data:/workspace/data:ro
```

| フィールド | 型 | デフォルト | 説明 |
|------------|-----|------------|------|
| `image` | string | **必須** | 使用する Docker イメージ |
| `host` | string | Docker クライアントのデフォルト | Docker デーモンの URL。省略した場合、クライアントは環境およびプラットフォームのデフォルトを使用 |
| `default_work_dir` | string | - | コンテナー内の作業ディレクトリ |
| `default_env` | map | - | 環境変数 |
| `command_whitelist` | string[] | - | 許可するコマンド（完全一致） |
| `network_mode` | string | Docker のデフォルト | `host`、`bridge`、`none` などの Docker ネットワークモード |
| `volumes` | string[] | - | ボリュームマウント: `host:container[:ro]` |
| `user` | string | - | コンテナー内で実行するユーザー |
| `memory_limit` | int | 0 | メモリ制限（バイト、0 = 無制限） |
| `cpu_quota` | int | 0 | CPU クォータ（100000 = 1 CPU、0 = 無制限） |
| `auto_remove` | bool | false | 終了後にコンテナーを削除 |
| `read_only_rootfs` | bool | false | ルートファイルシステムを読み取り専用に設定 |
| `no_new_privileges` | bool | false | 権限昇格を防止 |
| `cap_drop` | string[] | - | 削除する Linux ケーパビリティ |
| `cap_add` | string[] | - | 追加する Linux ケーパビリティ |
| `pids_limit` | int | 0 | 最大プロセス数（0 = 無制限） |
| `tmpfs` | map | - | 書き込み可能なパス用の tmpfs マウント |

## コマンド許可リスト

どちらのエグゼキューター種別もコマンド許可リストをサポートします。リストが空でない場合、元のコマンド文字列と完全に一致するコマンドだけが許可されます。

```yaml
command_whitelist:
  - ls -la
  - cat /etc/passwd
```

許可リストにないコマンドはエラーで拒否されます。

許可リストを省略するか空にすると、セキュリティポリシーを通過する任意のコマンドを実行できます。Lua API は別途、エグゼキューター ID に対して `exec.get`、コマンド文字列そのものに対して `exec.run` を確認します。

## Lua API

[Exec モジュール](lua/dynamic/exec.md)がコマンド実行を提供します。

```lua
local exec = require("exec")

local executor, err = exec.get("app:shell")
if err then return nil, err end

local proc, proc_err = executor:exec("git status", {
    work_dir = "/app/repo"
})
if proc_err then
    executor:release()
    return nil, proc_err
end

local stdout, stream_err = proc:stdout_stream()
if stream_err then
    proc:close()
    executor:release()
    return nil, stream_err
end

local ok, start_err = proc:start()
if start_err then
    stdout:close()
    proc:close()
    executor:release()
    return nil, start_err
end

local chunks = {}
while true do
    local chunk, read_err = stdout:read(4096)
    if read_err then
        stdout:close()
        proc:close(true)
        executor:release()
        return nil, read_err
    end
    if chunk == nil then break end
    chunks[#chunks + 1] = chunk
end

local exit_code, wait_err = proc:wait()
local _, stream_close_err = stdout:close()
local _, release_err = executor:release()

if wait_err then return nil, wait_err end
if stream_close_err then return nil, stream_close_err end
if release_err then return nil, release_err end
return table.concat(chunks), exit_code
```

## 関連項目

- [Exec モジュール](lua/dynamic/exec.md) - Lua API リファレンス
- [プロセスホスト](system/process-host.md) - Wippy プロセスを実行するホスト
- [ファイルシステム](system/filesystem.md) - 作業ディレクトリとして使用するファイルシステムエントリ
