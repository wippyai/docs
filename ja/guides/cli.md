# CLIリファレンス

Wippyランタイムのコマンドラインインターフェース。

## グローバルフラグ

すべてのコマンドで使用可能：

| フラグ | 短縮形 | 説明 |
|--------|--------|------|
| `--config` | | 設定ファイル（デフォルト: .wippy.yaml） |
| `--verbose` | `-v` | デバッグログを有効化 |
| `--very-verbose` | | スタックトレース付きデバッグ |
| `--console` | `-c` | カラフルなコンソールログ |
| `--silent` | `-s` | コンソールログを無効化 |
| `--event-streams` | `-e` | ログをイベントバスにストリーム |
| `--profiler` | `-p` | localhost:6060でpprofを有効化 |
| `--memory-limit` | `-m` | メモリ制限（例: 1G, 512M） |

メモリ制限の優先順位: `--memory-limit`フラグ > `GOMEMLIMIT`環境変数 > 1GBデフォルト。

## wippy init

新しいロックファイルを作成。

```bash
wippy init
wippy init --src-dir ./src --modules-dir .wippy
```

| フラグ | 短縮形 | デフォルト | 説明 |
|--------|--------|------------|------|
| `--src-dir` | `-d` | ./src | ソースディレクトリ |
| `--modules-dir` | | .wippy | モジュールディレクトリ |
| `--lock-file` | `-l` | wippy.lock | ロックファイルパス |

## wippy run

ランタイムを起動またはコマンドを実行。

```bash
wippy run                                    # ランタイムを起動
wippy run list                               # 利用可能なコマンドを一覧表示
wippy run test                               # テストを実行
wippy run snapshot.wapp                      # パックファイルから実行
wippy run acme/http                          # モジュールを実行
wippy run --exec app:processes/app:worker   # 単一プロセスを実行
```

| フラグ | 短縮形 | 説明 |
|--------|--------|------|
| `--override` | `-o` | エントリ値をオーバーライド（namespace:entry:field=value） |
| `--exec` | `-x` | プロセスを実行して終了（host/namespace:entry） |
| `--host` | | 実行用ホスト |
| `--registry` | | レジストリURL |

## wippy lint

Luaコードの型エラーと警告をチェック。

```bash
wippy lint
wippy lint --level warning
```

すべてのLuaエントリを検証: `function.lua.*`, `library.lua.*`, `process.lua.*`, `workflow.lua.*`。

| フラグ | 説明 |
|--------|------|
| `--level` | レポートする最小重大度レベル |

## wippy add

モジュール依存関係を追加。

```bash
wippy add acme/http
wippy add acme/http@1.2.3
wippy add acme/http@latest
```

| フラグ | 短縮形 | デフォルト | 説明 |
|--------|--------|------------|------|
| `--lock-file` | `-l` | wippy.lock | ロックファイルパス |
| `--registry` | | | レジストリURL |

## wippy install

ロックファイルから依存関係をインストール。

```bash
wippy install
wippy install --force
wippy install --repair
```

| フラグ | 短縮形 | 説明 |
|--------|--------|------|
| `--lock-file` | `-l` | ロックファイルパス |
| `--force` | | キャッシュをバイパスし、常にダウンロード |
| `--repair` | | ハッシュを検証し、不一致の場合は再ダウンロード |
| `--registry` | | レジストリURL |

## wippy update

依存関係を更新しロックファイルを再生成。

```bash
wippy update                      # すべて更新
wippy update acme/http            # 特定のモジュールを更新
wippy update acme/http demo/sql   # 複数を更新
```

| フラグ | 短縮形 | デフォルト | 説明 |
|--------|--------|------------|------|
| `--lock-file` | `-l` | wippy.lock | ロックファイルパス |
| `--src-dir` | `-d` | . | ソースディレクトリ |
| `--modules-dir` | | .wippy | モジュールディレクトリ |
| `--registry` | | | レジストリURL |

## wippy pack

スナップショットパック（.wappファイル）を作成。

```bash
wippy pack snapshot.wapp
wippy pack release.wapp --description "Release 1.0"
wippy pack app.wapp --embed app:assets --bytecode **
```

| フラグ | 短縮形 | 説明 |
|--------|--------|------|
| `--lock-file` | `-l` | ロックファイルパス |
| `--description` | `-d` | パックの説明 |
| `--tags` | `-t` | パックタグ（カンマ区切り） |
| `--meta` | | カスタムメタデータ（key=value） |
| `--embed` | | fs.directoryエントリを埋め込み（パターン） |
| `--list` | | fs.directoryエントリを一覧表示（dry-run） |
| `--exclude-ns` | | 名前空間を除外（パターン） |
| `--exclude` | | エントリを除外（パターン） |
| `--bytecode` | | Luaをバイトコードにコンパイル（**ですべて） |

## wippy publish

ハブにモジュールを公開。

```bash
wippy publish
wippy publish --version 1.0.0
wippy publish --dry-run
```

カレントディレクトリの`wippy.yaml`から読み込み。

| フラグ | 説明 |
|--------|------|
| `--version` | 公開するバージョン |
| `--dry-run` | 公開せずに検証 |
| `--label` | バージョンラベル |
| `--release-notes` | リリースノート |
| `--registry` | レジストリURL |

## wippy search

ハブでモジュールを検索。

```bash
wippy search http
wippy search "sql driver" --limit 20
wippy search auth --json
```

| フラグ | 説明 |
|--------|------|
| `--json` | JSONとして出力 |
| `--limit` | 最大結果数 |
| `--registry` | レジストリURL |

## wippy auth

レジストリ認証を管理。

### wippy auth login

```bash
wippy auth login
wippy auth login --token YOUR_TOKEN
```

| フラグ | 説明 |
|--------|------|
| `--token` | APIトークン |
| `--registry` | レジストリURL |
| `--local` | 認証情報をローカルに保存 |

### wippy auth logout

```bash
wippy auth logout
```

| フラグ | 説明 |
|--------|------|
| `--registry` | レジストリURL |
| `--local` | ローカル認証情報を削除 |

### wippy auth status

```bash
wippy auth status
wippy auth status --json
```

## wippy registry

レジストリエントリをクエリおよび検査。

### wippy registry list

```bash
wippy registry list
wippy registry list --kind function.lua
wippy registry list --ns app --json
```

| フラグ | 短縮形 | 説明 |
|--------|--------|------|
| `--kind` | `-k` | 種別でフィルタ |
| `--ns` | `-n` | 名前空間でフィルタ |
| `--name` | | 名前でフィルタ |
| `--meta` | | メタデータでフィルタ |
| `--json` | | JSONとして出力 |
| `--yaml` | | YAMLとして出力 |
| `--lock-file` | `-l` | ロックファイルパス |

### wippy registry show

```bash
wippy registry show app:http:handler
wippy registry show app:config --yaml
```

| フラグ | 短縮形 | 説明 |
|--------|--------|------|
| `--field` | `-f` | 特定のフィールドを表示 |
| `--json` | | JSONとして出力 |
| `--yaml` | | YAMLとして出力 |
| `--raw` | | 生の出力 |
| `--lock-file` | `-l` | ロックファイルパス |

## wippy version

バージョン情報を表示。

```bash
wippy version
wippy version --short
```

## 例

### 開発ワークフロー

```bash
# プロジェクトを初期化
wippy init
wippy add wippy/http wippy/sql
wippy install

# エラーをチェック
wippy lint

# デバッグ出力で実行
wippy run -c -v

# ローカル開発用に設定をオーバーライド
wippy run -o app:db:host=localhost -o app:db:port=5432
```

### 本番デプロイメント

```bash
# バイトコード付きリリースパックを作成
wippy pack release.wapp --bytecode ** --exclude-ns test.**

# メモリ制限付きでパックから実行
wippy run release.wapp -m 2G
```

### デバッグ

```bash
# 単一プロセスを実行
wippy run --exec app:processes/app:worker

# プロファイラを有効にして実行
wippy run -p -v
# その後: go tool pprof http://localhost:6060/debug/pprof/heap
```

### 依存関係管理

```bash
# 新しい依存関係を追加
wippy add acme/http@latest

# 破損したモジュールを修復
wippy install --repair

# 強制再ダウンロード
wippy install --force

# 特定のモジュールを更新
wippy update acme/http
```

### パブリッシング

```bash
# ハブにログイン
wippy auth login

# モジュールを検証
wippy publish --dry-run

# 公開
wippy publish --version 1.0.0 --release-notes "Initial release"
```

## 設定ファイル

永続的な設定のために`.wippy.yaml`を作成：

```yaml
logger:
  mode: development
  level: debug
  encoding: console

logmanager:
  min_level: -1  # debug

profiler:
  enabled: true
  address: localhost:6060

override:
  app:gateway:addr: ":9090"
  app:db:host: "localhost"
```

## 関連項目

- [設定](guides/configuration.md) - 設定ファイルリファレンス
- [可観測性](guides/observability.md) - モニタリングとロギング
