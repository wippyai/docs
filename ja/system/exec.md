# エグゼキュータ

コマンドエグゼキュータは制御された環境で外部プロセスを実行します。2つのエグゼキュータタイプが利用可能：ネイティブOSプロセスとDockerコンテナ。

## エントリ種別

| 種別 | 説明 |
|------|------|
| `exec.native` | ホストOS上で直接コマンドを実行 |
| `exec.docker` | Dockerコンテナ内でコマンドを実行 |

## ネイティブエグゼキュータ

ホストオペレーティングシステム上で直接コマンドを実行します。

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
| `default_env` | map | - | 環境変数（コマンドごとのenvとマージ） |
| `command_whitelist` | string[] | - | 設定された場合、これらの正確なコマンドのみ許可 |

<note>
ネイティブエグゼキュータはデフォルトでクリーンな環境を使用します。明示的に設定された環境変数のみが子プロセスに渡されます。
</note>

## Dockerエグゼキュータ

分離されたDockerコンテナ内でコマンドを実行します。

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
| `image` | string | **必須** | 使用するDockerイメージ |
| `host` | string | unixソケット | DockerデーモンURL |
| `default_work_dir` | string | - | コンテナ内の作業ディレクトリ |
| `default_env` | map | - | 環境変数 |
| `command_whitelist` | string[] | - | 許可されるコマンド（完全一致） |
| `network_mode` | string | bridge | ネットワークモード：`host`、`bridge`、`none` |
| `volumes` | string[] | - | ボリュームマウント：`host:container[:ro]` |
| `user` | string | - | コンテナ内で実行するユーザー |
| `memory_limit` | int | 0 | メモリ制限（バイト、0 = 無制限） |
| `cpu_quota` | int | 0 | CPUクォータ（100000 = 1 CPU、0 = 無制限） |
| `auto_remove` | bool | false | 終了後にコンテナを削除 |
| `read_only_rootfs` | bool | false | ルートファイルシステムを読み取り専用に |
| `no_new_privileges` | bool | false | 権限昇格を防止 |
| `cap_drop` | string[] | - | 削除するLinuxケーパビリティ |
| `cap_add` | string[] | - | 追加するLinuxケーパビリティ |
| `pids_limit` | int | 0 | 最大プロセス数（0 = 無制限） |
| `tmpfs` | map | - | 書き込み可能パス用のtmpfsマウント |

## コマンドホワイトリスト

両方のエグゼキュータタイプがコマンドホワイトリストをサポート。設定された場合、完全一致のコマンドのみ許可されます：

```yaml
command_whitelist:
  - ls -la
  - cat /etc/passwd
```

ホワイトリストにないコマンドはエラーで拒否されます。

## Lua API

[Execモジュール](lua/dynamic/exec.md)がコマンド実行を提供します：

```lua
local exec = require("exec")

local executor, err = exec.get("app:shell")
if err then return nil, err end

local proc = executor:exec("git status", {
    work_dir = "/app/repo"
})

local stdout = proc:stdout_stream()
proc:start()
local output = stdout:read()
proc:wait()

stdout:close()
executor:release()
```
