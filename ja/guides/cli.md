---
title: "CLI リファレンス"
description: "Wippy CLI のコマンド、フラグ、設定の上書き、および一般的なワークフロー。"
---

# CLI リファレンス

Wippy CLI を使用して、プロジェクトの初期化、ランタイムの実行、依存関係の管理、レジストリエントリの確認、モジュールの公開を行います。

これはコマンドリファレンスです。ソース、ロックファイル、レジストリエントリ、または公開メタデータを扱うコマンドの例は、既存のプロジェクトまたはモジュールを前提としています。単一のエンドツーエンドプロジェクトを示すものではありません。

## グローバルフラグ

全てのコマンドで使用可能:

| フラグ | 短縮形 | 説明 |
|------|-------|-------------|
| `--config` | | 設定ファイル。繰り返し可能で、後のファイルが前のファイルを上書きします (デフォルト: .wippy.yaml)。`wippy publish` では別のコマンドローカルオプションが定義されます。 |
| `--verbose` | `-v` | デバッグログを有効化 |
| `--very-verbose` | | スタックトレース付きデバッグ |
| `--console` | `-c` | カラフルなコンソールログ |
| `--silent` | `-s` | コンソールログを無効化 |
| `--event-streams` | `-e` | イベントバスへログをストリーム |
| `--profiler` | `-p` | localhost:6060 で pprof を有効化 |
| `--memory-limit` | `-m` | メモリ制限 (例: 1G, 512M) |

メモリ制限の優先順位: `--memory-limit` フラグ > `GOMEMLIMIT` 環境変数 > デフォルト 1GB。

グローバルの `--config` は複数回指定して設定ファイルを合成できます。ファイルは左から右にマージされ、後のファイルが一致する値を上書きし、それ以外はすべて保持します。明示的に指定したファイルはすべて存在しなければなりません。`--config` なしの場合、デフォルトの `.wippy.yaml` は任意です。最初のファイルが、相対パスの解決に使われるディレクトリを決めます。設定は、ファイルの合成、`--profile` の選択、`--set` の上書きの順に適用されます。[設定](guides/configuration.md#config-composition)を参照してください。

`wippy publish` はグローバルオプションを、コマンドローカルの `--config <dir>` オプションで置き換えます。このコマンドでは、値は繰り返し可能なランタイム設定ファイルではなく、`wippy.yaml` を含むディレクトリです。

## wippy init

`wippy.lock` を作成します。すでに存在する場合は、そのソースディレクトリとモジュールディレクトリの設定を更新します。このコマンドは、アプリケーションのソースファイルやレジストリエントリを生成しません。

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
wippy run                                   # Start runtime
wippy run list                              # List available commands
wippy run migrate                           # Run a named custom command
wippy run snapshot.wapp                     # Run from pack file
wippy run acme/http                         # Run module from hub
wippy run acme/http@1.2.3                   # Run specific version
wippy run --exec app:worker                 # Start runtime and execute a single process
```

| フラグ | 短縮形 | 説明 |
|------|-------|-------------|
| `--override` | `-o` | エントリの値を上書き (`namespace:entry:field=value`)；`field` に `kind` を指定するとエントリの種類を変更 |
| `--set` | | 設定値を上書き (`section.path=value`、繰り返し可能、設定ファイルより優先) |
| `--exec` | `-x` | プロセスを実行して終了 (`namespace:entry`) |
| `--host` | | `--exec` 用のターミナルホスト ID (`terminal.host` が 1 つしか存在しない場合は自動検出) |
| `--registry` | | ハブモジュール用のレジストリ URL |
| `--profile` | | `.wippy.yaml` またはパックされたランタイムメタデータからランタイムプロファイルを適用 (繰り返し可能、順に適用) |

ハブモジュールの実行 (`wippy run org/module`) は一度だけ解決を行い、`wippy.lock` に記録し、検証済みパックをローカルにベンダリングします。同じ参照のその後の実行はロックから開始されます — ネットワークは不要です。ロックと一致しなくなったバージョンセレクタは、`wippy update` の実行を促すヒントとともに拒否されます。

`--set` はコマンドラインから任意のランタイム設定値を書き込み、`.wippy.yaml` にリーフ単位でマージされます:

```bash
wippy run --set cluster.enabled=true \
          --set cluster.membership.join_addrs=node-2:7946,node-3:7946 \
          --set cluster.raft.bootstrap_expect=3
```

値は形に応じて変換されます。`true` と `false` はブール値、整数と浮動小数点数は数値となり、それ以外は文字列のままです。期間を期待するフィールドでは、`5s` のような値が解析されます。

## wippy test

テストエントリポイント、すなわち `test` ユースケースを宣言するプロセスエントリを実行する。ランタイムが起動し、そのエントリを実行して終了する。`wippy run` はテストエントリポイントを自動実行しない。テストは常に `wippy test` を通して行う。

```bash
wippy test                     # Run tests from the local project
wippy test snapshot.wapp       # Run tests from a pack file
wippy test acme/module@1.2.3   # Run tests from a hub module
```

| フラグ | 短縮形 | 説明 |
|------|-------|-------------|
| `--override` | `-o` | エントリの値を上書き (`namespace:entry:field=value`) |
| `--host` | | ターミナルホスト ID (`terminal.host` が 1 つしか存在しない場合は自動検出) |
| `--registry` | | ハブモジュール用のレジストリ URL |
| `--set` | | 設定値を上書き (`section.path=value`、繰り返し可能) |
| `--profile` | | ランタイムプロファイルを適用 (繰り返し可能、順に適用) |

## wippy lint

Lua コードの型エラーや警告をチェックする。

```bash
wippy lint
wippy lint --level warning
wippy lint --json
wippy lint --rules
```

ソースを含む `function.lua`、`library.lua`、`process.lua`、`workflow.lua` エントリを検証します。プリコンパイル済みの `.bc` エントリには解析可能なソースが含まれないため、スキップされます。

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
| `--profile` | | | マージされたランタイム設定からワークスペースプロファイルを適用 (繰り返し可能) |
| `--set` | | | マージされたランタイム設定値を上書き (`section.path=value`、繰り返し可能) |

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
wippy install                            # Install all
wippy install acme/http                  # Install specific module
wippy install --refresh acme/http        # Re-fetch a specific module
```

| フラグ | 短縮形 | デフォルト | 説明 |
|------|-------|---------|-------------|
| `--lock-file` | `-l` | wippy.lock | ロックファイルのパス |
| `--refresh` | | false | 名前を指定した場合はそのモジュールを、名前を指定しない場合はロック済みの全モジュールをキャッシュを使わず再取得 |
| `--force` | | false | `--refresh` のエイリアス |
| `--repair` | | false | `--refresh` のエイリアス |
| `--registry` | | | レジストリ URL |
| `--profile` | | | マージされたランタイム設定からワークスペースプロファイルを適用 (繰り返し可能) |
| `--set` | | | マージされたランタイム設定値を上書き (`section.path=value`、繰り返し可能) |

## wippy update

依存関係を更新し、ロックファイルを再生成する。

```bash
wippy update                      # Update all
wippy update acme/http            # Update specific module
wippy update acme/http demo/sql   # Update multiple
```

| フラグ | 短縮形 | デフォルト | 説明 |
|------|-------|---------|-------------|
| `--lock-file` | `-l` | wippy.lock | ロックファイルのパス |
| `--src-dir` | `-d` | ./src | ソースディレクトリ |
| `--modules-dir` | | .wippy | モジュールディレクトリ |
| `--registry` | | | レジストリ URL |
| `--profile` | | | マージされたランタイム設定からワークスペースプロファイルを適用 (繰り返し可能) |
| `--set` | | | マージされたランタイム設定値を上書き (`section.path=value`、繰り返し可能) |

## wippy pack

スナップショットパック (.wapp ファイル) を作成する。

```bash
wippy pack snapshot.wapp
wippy pack release.wapp --description "Release 1.0"
wippy pack app.wapp --embed app:assets --bytecode "**"
```

| フラグ | 短縮形 | 説明 |
|------|-------|-------------|
| `--lock-file` | `-l` | ロックファイルのパス |
| `--description` | `-d` | パックの説明 |
| `--tags` | `-t` | パックのタグ (カンマ区切り) |
| `--meta` | | カスタムメタデータ (key=value) |
| `--embed` | | fs.directory エントリを埋め込む (パターン) |
| `--embed-all` | | 全ての fs.directory エントリを埋め込む (`--embed` とは併用不可) |
| `--list` | | fs.directory エントリを一覧表示 (ドライラン) |
| `--exclude-ns` | | 名前空間を除外 (パターン) |
| `--exclude` | | エントリを除外 (パターン) |
| `--bytecode` | | Lua をバイトコードにコンパイル (** で全て) |
| `--profile` | | パックの前に `.wippy.yaml` からランタイムプロファイルを適用 (繰り返し可能、順に適用) |

`--embed` も `--embed-all` も指定しない場合、埋め込みパターンはモジュールマニフェスト `wippy.yaml` の `embed:` セクションにフォールバックします。アプリケーションをパックすると依存パックの埋め込みリソースも引き継がれ、生成されたパックが公開するのはメインモジュールのコマンドのみです。

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
| `--module-type` | モジュールタイプ: `library`、`application`、`agent`、または `plugin` (wippy.yaml の `type:` を上書き) |
| `--module-display-name` | 新規作成モジュールの表示名 (`--create` のみ) |

モジュールタイプは通常、`wippy.yaml` の `type:` として宣言します ([公開](./publishing.md#wippyyaml)を参照)。`--module-type` は単一の公開に対してそれを上書きします。どちらも設定されていない場合、新規作成されるモジュールは非推奨警告とともにデフォルトで `application` になります。

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

レジストリエントリを照会・検査する。どちらのサブコマンドも、エントリをロードする際のマージ済みランタイム設定を調整するための `--profile` と `--set` を受け付ける。

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
  - name: migrate_runner
    kind: process.lua
    meta:
      command:
        name: migrate
        short: Run database migrations
        security:
          actor:
            id: app:migrations
          policies:
            - app.security:migrations
          groups:
            - app.security:operators
    source: file://runner.lua
    method: main
    modules:
      - io
      - registry
      - funcs
```

以下のコマンドで実行する:

```bash
wippy run migrate
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
| `use_case` | いいえ | エントリポイントのカテゴリ、デフォルト `run`。`use_case: test` を宣言したエントリが `wippy test` の実行対象 |
| `security` | いいえ | `actor`、`policies`、`groups` を含む CLI 専用のセキュリティコンテキスト |

`security` ブロックは `meta.command` 内に置きます。上記の ID は例であり、ロード済みのレジストリで解決できなければなりません。このブロックが適用されるのは、ターミナルホストがそのエントリを CLI コマンドとして起動する場合だけです。通常のプロセス生成には継承されません。セキュリティメタデータが不正または解決不能な場合、コマンドは起動しません。

任意のプロセスエントリ種類 (`process.lua`、`process.wasm`) が使用可能。コマンド名はロードされた全エントリ間で一意でなければならない。コマンド名の後の引数は文字列ペイロードとしてプロセスに渡される。

## 使用例

### 開発ワークフロー

```bash
# Initialize dependency lock metadata
wippy init
wippy add wippy/test
wippy add wippy/llm
wippy install

# Check for errors
wippy lint

# Run with debug output
wippy run -c -v

# Override config for local dev
wippy run -o app:db:host=localhost -o app:db:port=5432
```

### 本番デプロイ

```bash
# Create release pack with bytecode
wippy pack release.wapp --bytecode "**" --exclude-ns "test.**"

# Run from pack with memory limit
wippy run release.wapp -m 2G
```

### デバッグ

```bash
# Execute single process
wippy run --exec app:worker

# With profiler enabled
wippy run -p -v
# Then: go tool pprof http://localhost:6060/debug/pprof/heap
```

### 依存関係管理

```bash
# Add new dependency
wippy add acme/http@latest

# Force re-download
wippy install --force

# Update specific module
wippy update acme/http
```

### 公開

```bash
# Login to hub
wippy auth login

# Validate module
wippy publish --dry-run

# Publish
wippy publish --version 1.0.0 --release-notes "Initial release"
```

## 環境変数

| 変数 | 効果 |
|----------|--------|
| `WIPPY_TOKEN` | レジストリ認証トークン。保存された資格情報を上書き (`hub.auth.authenticate` でプッシュされたトークンはさらに優先される) |
| `WIPPY_REGISTRY` | デフォルトのレジストリ URL (`--registry` で上書きされる) |
| `WIPPY_CACHE_DIR` | `wippy run org/module` で実行されるハブモジュールのキャッシュディレクトリ (デフォルト: `~/.wippy/cache`) |
| `GOMEMLIMIT` | `--memory-limit` が未設定の場合のメモリ制限フォールバック |

`.wippy.yaml` 内の値は `${env:NAME}` で OS 環境変数を参照でき、ファイルのロード時に解決されます。変数が存在しない場合、設定のロードは失敗します。裸の `${name}` 参照は、代わりに設定の `vars:` セクションから解決されます。

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

- [設定](guides/configuration.md) — 設定ファイルリファレンス
- [オブザーバビリティ](guides/observability.md) — 監視とログ
