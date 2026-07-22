---
title: "CLI リファレンス"
description: "Wippy ランタイムのコマンドラインインターフェース。"
---

# CLI リファレンス

Wippy ランタイムのコマンドラインインターフェース。

## グローバルフラグ

全てのコマンドで使用可能:

| フラグ | 短縮形 | 説明 |
|------|-------|-------------|
| `--config` | | 設定ファイル、繰り返し可能。後のファイルが前のファイルを上書き (デフォルト: .wippy.yaml) |
| `--verbose` | `-v` | デバッグログを有効化 |
| `--very-verbose` | | スタックトレース付きデバッグ |
| `--console` | `-c` | カラフルなコンソールログ |
| `--silent` | `-s` | コンソールログを無効化 |
| `--event-streams` | `-e` | イベントバスへログをストリーム |
| `--profiler` | `-p` | localhost:6060 で pprof を有効化 |
| `--memory-limit` | `-m` | メモリ制限 (例: 1G, 512M) |

メモリ制限の優先順位: `--memory-limit` フラグ > `GOMEMLIMIT` 環境変数 > デフォルト 1GB。

`--config` は複数回指定して設定ファイルを合成できます。ファイルは左から右にマージされます: 後のファイルは一致する値を上書きし、それ以外はすべて保持します。明示的に指定したファイルはすべて存在しなければなりません。`--config` なしの場合、デフォルトの `.wippy.yaml` は任意です。最初のファイルが、相対パスの解決に使われるディレクトリを決めます。設定は次の順序で適用されます: ファイル合成、次に `--profile` の選択、最後に `--set` の上書き。[設定](guides/configuration.md#config-composition)を参照してください。

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
wippy run migrate                           # 名前付きカスタムコマンドを実行
wippy run snapshot.wapp                     # パックファイルから実行
wippy run acme/http                         # ハブからモジュールを実行
wippy run acme/http@1.2.3                   # 特定バージョンを実行
wippy run --exec app:worker                 # ランタイムを起動し単一プロセスを実行
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

値は形に応じて変換されます: `true`/`false` はブール、整数と浮動小数点は数値、それ以外は文字列のまま（オプションが期待する場合、`5s` のような期間は解析されます）。

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
| `--profile` | | | マージされたランタイム設定からワークスペースプロファイルを適用 (繰り返し可能) |
| `--set` | | | マージされたランタイム設定値を上書き (`section.path=value`、繰り返し可能) |

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
| `--profile` | | | マージされたランタイム設定からワークスペースプロファイルを適用 (繰り返し可能) |
| `--set` | | | マージされたランタイム設定値を上書き (`section.path=value`、繰り返し可能) |

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

モジュールタイプは通常、`wippy.yaml` の `type:` として宣言します ([公開](guides/publishing.md#wippy-yaml)を参照)。`--module-type` は単一の公開に対してそれを上書きします。どちらも設定されていない場合、新規作成されるモジュールは非推奨警告とともにデフォルトで `application` になります。

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

任意のプロセスエントリ種類 (`process.lua`、`process.wasm`) が使用可能。コマンド名はロードされた全エントリ間で一意でなければならない。コマンド名の後の引数は文字列ペイロードとしてプロセスに渡される。

## 使用例

### 開発ワークフロー

```bash
# プロジェクトを初期化
wippy init
wippy add wippy/test wippy/llm
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

- [設定](guides/configuration.md) - 設定ファイルリファレンス
- [オブザーバビリティ](guides/observability.md) - 監視とログ
