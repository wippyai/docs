# CLI リファレンス

Wippy ランタイムのコマンドラインインターフェース。

## グローバルフラグ

全てのコマンドで使用可能:

| フラグ | 短縮形 | 説明 |
|------|-------|-------------|
| `--config` | | 設定ファイル (デフォルト: .wippy.yaml) |
| `--verbose` | `-v` | デバッグログを有効化 |
| `--very-verbose` | | スタックトレース付きデバッグ |
| `--console` | `-c` | カラフルなコンソールログ |
| `--silent` | `-s` | コンソールログを無効化 |
| `--event-streams` | `-e` | イベントバスへログをストリーム |
| `--profiler` | `-p` | localhost:6060 で pprof を有効化 |
| `--memory-limit` | `-m` | メモリ制限 (例: 1G, 512M) |

メモリ制限の優先順位: `--memory-limit` フラグ > `GOMEMLIMIT` 環境変数 > デフォルト 1GB。

## wippy init

新しいロックファイルを作成する。

```bash
wippy init
wippy init --src-dir ./src --modules-dir .wippy
```

| フラグ | 短縮形 | デフォルト | 説明 |
|------|-------|---------|-------------|
| `--src-dir` | `-d` | ./src | ソースディレクトリ |
| `--modules-dir` | | .wippy | モジュールディレクトリ |
| `--lock-file` | `-l` | wippy.lock | ロックファイルのパス |

## wippy run

ランタイムを起動するか、コマンドを実行する。

```bash
wippy run                                   # ランタイムを起動
wippy run list                              # 利用可能なコマンドを一覧表示
wippy run test                              # テストを実行
wippy run snapshot.wapp                     # パックファイルから実行
wippy run acme/http                         # ハブからモジュールを実行
wippy run acme/http@1.2.3                   # 特定バージョンを実行
wippy run --exec app:worker                 # ランタイムを起動し単一プロセスを実行
```

| フラグ | 短縮形 | 説明 |
|------|-------|-------------|
| `--override` | `-o` | エントリの値を上書き (`namespace:entry:field=value`) |
| `--exec` | `-x` | プロセスを実行して終了 (`namespace:entry`) |
| `--host` | | `--exec` 用のターミナルホスト ID (`terminal.host` が 1 つしか存在しない場合は自動検出) |
| `--registry` | | ハブモジュール用のレジストリ URL |

## wippy lint

Lua コードの型エラーや警告をチェックする。

```bash
wippy lint
wippy lint --level warning
wippy lint --json
wippy lint --rules
```

全ての Lua エントリを検証: `function.lua`、`library.lua`、`process.lua`、`workflow.lua` (それらの `.bc` バリアントを含む)。

| フラグ | 短縮形 | デフォルト | 説明 |
|------|-------|---------|-------------|
| `--lock-file` | `-l` | `wippy.lock` | ロックファイルのパス |
| `--level` | | `warning` | 最小重大度: `error`、`warning`、`hint` |
| `--ns` | | | 名前空間パターンでフィルタ (例: `app`、`lib.*`) |
| `--code` | | | エラーコードでフィルタ (例: `E0001,E0004`) |
| `--rules` | | `false` | スタイル/品質 lint ルールを有効化 |
| `--summary` | | `false` | エラーコードで出力をグループ化 |
| `--limit` | | `0` | 表示する最大診断数 (0 = 無制限) |
| `--json` | | `false` | JSON 出力 |
| `--no-color` | | `false` | カラー出力を無効化 |
| `--cache-reset` | | `false` | lint 前に Lua キャッシュをクリア |

## wippy add

モジュール依存関係を追加する。

```bash
wippy add acme/http
wippy add acme/http@1.2.3
wippy add acme/http@latest
```

| フラグ | 短縮形 | デフォルト | 説明 |
|------|-------|---------|-------------|
| `--lock-file` | `-l` | wippy.lock | ロックファイルのパス |
| `--registry` | | | レジストリ URL |

## wippy install

ロックファイルから依存関係をインストールする。

```bash
wippy install                            # すべてをインストール
wippy install acme/http                  # 特定のモジュールをインストール
wippy install --refresh acme/http        # 特定のモジュールを再取得
```

| フラグ | 短縮形 | デフォルト | 説明 |
|------|-------|---------|-------------|
| `--lock-file` | `-l` | wippy.lock | ロックファイルのパス |
| `--refresh` | | false | 全モジュールを再取得し、キャッシュをバイパス |
| `--force` | | false | `--refresh` のエイリアス |
| `--repair` | | false | `--refresh` のエイリアス |
| `--registry` | | | レジストリ URL |

## wippy update

依存関係を更新し、ロックファイルを再生成する。

```bash
wippy update                      # 全て更新
wippy update acme/http            # 特定のモジュールを更新
wippy update acme/http demo/sql   # 複数を更新
```

| フラグ | 短縮形 | デフォルト | 説明 |
|------|-------|---------|-------------|
| `--lock-file` | `-l` | wippy.lock | ロックファイルのパス |
| `--src-dir` | `-d` | ./src | ソースディレクトリ |
| `--modules-dir` | | .wippy | モジュールディレクトリ |
| `--registry` | | | レジストリ URL |

## wippy pack

スナップショットパック (.wapp ファイル) を作成する。

```bash
wippy pack snapshot.wapp
wippy pack release.wapp --description "Release 1.0"
wippy pack app.wapp --embed app:assets --bytecode **
```

| フラグ | 短縮形 | 説明 |
|------|-------|-------------|
| `--lock-file` | `-l` | ロックファイルのパス |
| `--description` | `-d` | パックの説明 |
| `--tags` | `-t` | パックのタグ (カンマ区切り) |
| `--meta` | | カスタムメタデータ (key=value) |
| `--embed` | | fs.directory エントリを埋め込む (パターン) |
| `--list` | | fs.directory エントリを一覧表示 (ドライラン) |
| `--exclude-ns` | | 名前空間を除外 (パターン) |
| `--exclude` | | エントリを除外 (パターン) |
| `--bytecode` | | Lua をバイトコードにコンパイル (** で全て) |

## wippy publish

モジュールをハブに公開する。

```bash
wippy publish
wippy publish --version 1.0.0
wippy publish --dry-run
```

カレントディレクトリの `wippy.yaml` を読み込む。

| フラグ | 説明 |
|------|-------------|
| `--version` | 公開するバージョン |
| `--dry-run` | 公開せずに検証のみ実行 |
| `--label` | バージョンの代わりに可変ラベルとして公開 |
| `--release-notes` | リリースノート |
| `--protected` | バージョンを保護済みとしてマーク |
| `--embed` | fs.directory エントリを ID または名前で埋め込む |
| `--config` | wippy.yaml を含むディレクトリのパス (デフォルト: .) |
| `--registry` | レジストリ URL |
| `--create` | モジュールがレジストリに存在しない場合に作成 |
| `--module-visibility` | 新規作成モジュールの公開設定 (`--create` のみ): `public` または `private` (デフォルト: private) |
| `--module-type` | 新規作成モジュールのタイプ (`--create` のみ): `library`、`application`、`agent`、または `plugin` (デフォルト: application) |
| `--module-display-name` | 新規作成モジュールの表示名 (`--create` のみ) |

## wippy search

ハブでモジュールを検索する。

```bash
wippy search http
wippy search "sql driver" --limit 20
wippy search auth --json
```

| フラグ | デフォルト | 説明 |
|------|---------|-------------|
| `--json` | false | JSON として出力 |
| `--limit` | 20 | 最大結果数 |
| `--registry` | | レジストリ URL |

## wippy auth

レジストリ認証を管理する。

### wippy auth login

```bash
wippy auth login
wippy auth login --token YOUR_TOKEN
```

| フラグ | 説明 |
|------|-------------|
| `--token` | API トークン |
| `--registry` | レジストリ URL |
| `--local` | 資格情報をローカルに保存 |

### wippy auth logout

```bash
wippy auth logout
```

| フラグ | 説明 |
|------|-------------|
| `--registry` | レジストリ URL |
| `--local` | ローカルの資格情報を削除 |

### wippy auth status

```bash
wippy auth status
wippy auth status --json
```

| フラグ | 説明 |
|------|-------------|
| `--json` | JSON として出力 |

## wippy readme

ハブからモジュールの README を取得する。

```bash
wippy readme wippy/terminal
wippy readme wippy/terminal@1.2.3
wippy readme --json wippy/terminal@latest
```

| フラグ | 説明 |
|------|-------------|
| `--json` | JSON として出力 |
| `--registry` | レジストリ URL（デフォルト: 資格情報から） |

## wippy registry

レジストリエントリを照会・検査する。

### wippy registry list

```bash
wippy registry list
wippy registry list --kind "function.lua.*"
wippy registry list --ns "app.*" --json
wippy registry list --meta "type=api" --meta "enabled=true"
```

| フラグ | 短縮形 | 説明 |
|------|-------|-------------|
| `--kind` | `-k` | 種類でフィルタ (glob パターン) |
| `--ns` | `-n` | 名前空間でフィルタ (glob パターン) |
| `--name` | | 名前でフィルタ (glob パターン) |
| `--meta` | | メタデータでフィルタ (繰り返し可) |
| `--json` | | JSON として出力 |
| `--yaml` | | YAML として出力 |
| `--lock-file` | `-l` | ロックファイルのパス |

`--meta` のメタデータ演算子:

| 演算子 | 意味 |
|----------|---------|
| `field=value` | 完全一致 |
| `field~regex` | 正規表現マッチ |
| `field*substr` | 部分文字列を含む |
| `field^prefix` | プレフィックスで始まる |
| `field$suffix` | サフィックスで終わる |

### wippy registry show

```bash
wippy registry show app:http:handler
wippy registry show app:config --yaml
```

| フラグ | 短縮形 | 説明 |
|------|-------|-------------|
| `--field` | `-f` | 特定のフィールドを表示 |
| `--json` | | JSON として出力 |
| `--yaml` | | YAML として出力 |
| `--raw` | | 生出力 |
| `--lock-file` | `-l` | ロックファイルのパス |

## wippy version

バージョン情報を表示する。

```bash
wippy version
wippy version --short
```

## カスタムコマンド

`process.lua` または `process.wasm` エントリは、`command` メタデータを追加することで名前付きコマンドとして登録できる:

```yaml
entries:
  - name: test_runner
    kind: process.lua
    meta:
      command:
        name: test
        short: Run application tests
    source: file://runner.lua
    method: main
    modules:
      - io
      - registry
      - funcs
```

以下のコマンドで実行する:

```bash
wippy run test
```

利用可能な全コマンドを一覧表示する:

```bash
wippy run list
```

### コマンドメタデータフィールド

| フィールド | 必須 | 説明 |
|-------|----------|-------------|
| `name` | はい | `wippy run <name>` で使用するコマンド名 |
| `short` | いいえ | `wippy run list` に表示される短い説明 |
| `main` | いいえ | このエントリをデフォルトコマンドとしてマーク (単一コマンドを提供するパックやハブモジュールで自動選択される) |

任意のプロセスエントリ種類 (`process.lua`、`process.wasm`) が使用可能。コマンド名はロードされた全エントリ間で一意でなければならない。コマンド名の後の引数は文字列ペイロードとしてプロセスに渡される。

## 使用例

### 開発ワークフロー

```bash
# プロジェクトを初期化
wippy init
wippy add wippy/http wippy/sql
wippy install

# エラーをチェック
wippy lint

# デバッグ出力付きで実行
wippy run -c -v

# ローカル開発用に設定を上書き
wippy run -o app:db:host=localhost -o app:db:port=5432
```

### 本番デプロイ

```bash
# バイトコード付きリリースパックを作成
wippy pack release.wapp --bytecode ** --exclude-ns test.**

# メモリ制限付きでパックから実行
wippy run release.wapp -m 2G
```

### デバッグ

```bash
# 単一プロセスを実行
wippy run --exec app:worker

# プロファイラを有効にして実行
wippy run -p -v
# 確認: go tool pprof http://localhost:6060/debug/pprof/heap
```

### 依存関係管理

```bash
# 新しい依存関係を追加
wippy add acme/http@latest

# 強制的に再ダウンロード
wippy install --force

# 特定のモジュールを更新
wippy update acme/http
```

### 公開

```bash
# ハブにログイン
wippy auth login

# モジュールを検証
wippy publish --dry-run

# 公開
wippy publish --version 1.0.0 --release-notes "Initial release"
```

## 設定ファイル

永続的な設定のために `.wippy.yaml` を作成する:

```yaml
logger:
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
- [オブザーバビリティ](guides/observability.md) - 監視とログ
