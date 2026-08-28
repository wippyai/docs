---
title: "MCP 経由の Keeper"
description: "アプリケーションに Wippy Keeper を追加し、スコープ付きトークンを発行して、MCP クライアントをオペレーターツールへ接続します。"
---

# MCP 経由の Keeper

Wippy Keeper は、レジストリ操作、ファイルシステムからレジストリへのガバナンス、タスクとエージェントのオーケストレーション、Hub からのインストール、ナレッジベース管理、ランタイム調査、Git ワークフローの UI を提供します。また、Model Context Protocol（MCP）を通じて、互換クライアントにオペレーター機能を公開します。このページではアプリケーションに Keeper を追加し、MCP 接続を設定します。

**分類：実行可能な統合チュートリアル。** アプリケーションと Keeper のトランスポートはローカルで動作します。最後の手順を完了するには、リモート HTTP サーバーと bearer ヘッダーをサポートする MCP クライアントが必要です。

## 作成するもの

1. Wippy アプリケーションテンプレートから作成したアプリケーションに Keeper を追加します。
2. `/c/keeper:main` の Keeper UI と `/keeper-mcp/` の MCP エンドポイントを公開します。
3. スコープ付き MCP トークンを発行し、Keeper 経由でアプリを操作するよう MCP クライアントを設定します。

## 前提条件

- [Wippy アプリケーションテンプレート](https://github.com/wippyai/app)から作成したアプリ。Keeper のバインド先となる `app:gateway`、`app:api`、`app:db`、`app:processes`、`app.security:admin`、`app.env:store` がすでに用意されています。
- そのアプリケーションで有効な管理者アカウント。Keeper はトークン発行をサインイン中の管理者 ID に結び付けます。汎用 API キーでは MCP トークンを発行できません。

## Keeper の追加

依存関係を宣言し、アプリケーションのリソースにバインドします。`admin_scope` は必須で、デフォルト値はありません。他のパラメーターはアプリケーションテンプレートで使われるエントリ名をデフォルトとしますが、この例では明示的に指定します。

```yaml
# src/app/deps/_index.yaml
- name: keeper
  kind: ns.dependency
  component: keeper/keeper
  version: "*"
  parameters:
    - { name: app_db,         value: app:db }
    - { name: admin_scope,    value: app.security:admin }
    - { name: env_storage,    value: app.env:store }
    - { name: public_gateway, value: app:gateway }   # hosts /keeper-mcp/
    - { name: mcp_route,      value: /keeper-mcp/ }
    - { name: ui_server,      value: app:gateway }
    - { name: process_host,   value: app:processes }
```

ソース依存関係とその推移的依存グラフを解決してから、アプリを起動します。

```bash
wippy update
wippy run -c
```

`wippy update` はソースエントリを走査し、lock を更新し、推移的依存関係を解決してインストールします。`wippy add keeper/keeper` だけでは指定した lock モジュールしか更新されず、このソース宣言の依存グラフは解決されません。

Keeper は 3 つのサーフェスをマウントします。

- **UI** — `/c/keeper:main`
- **MCP トランスポート** — public gateway 上の `/keeper-mcp/`
- **トークン API** — `app:api` 上（`/keeper/mcp/tokens`、`/keeper/mcp/scopes`）

MCP トランスポートは `MCP_ENABLED` 環境変数で制御されます（デフォルトは `true`）。エンドポイントを閉じるには `false` に設定します。

## MCP トークンの発行

トークンは有効な管理者ユーザーが発行し、スコープが設定され、正確に 1 回だけ表示されます。

1. 管理者としてアプリケーションにサインインします。
2. `/c/keeper:main` を開き、**MCP** を選択して **Create Scoped Token** を選びます。
3. ラベルを入力してプリセットを選びます。最初の接続には `observer` が最も安全です。クライアントに書き込み操作が必要な場合に限り、`developer` または `wippy_operator` を使用してください。
4. トークンを作成し、表示された `wkmcp_...` の値をすぐにコピーします。UI で raw 値を再表示することはできません。

UI には、有効な MCP URL とコピー可能なクライアントスニペットも表示されます。現在サインインしている管理者セッションを再利用するため、この方法を推奨します。

自動化する場合は、同じアプリケーションの **管理者セッション bearer** で API を呼び出します。

```bash
curl -X POST http://localhost:8080/api/v1/keeper/mcp/tokens \
  -H 'Authorization: Bearer <admin-session-token>' \
  -H 'Content-Type: application/json' \
  -d '{"label": "local-observer", "preset": "observer"}'
# -> { "success": true, "token": { "token": "wkmcp_<64 hex>", ... } }
```

`<admin-session-token>` はアプリケーションの通常のログインフローで発行される bearer であり、新しい Keeper MCP トークンではありません。このエンドポイントは、未認証、無効、または管理者でないユーザーを拒否します。発行前に `GET /api/v1/keeper/mcp/scopes` を呼び出すと、現在のプリセットとスコープのカタログを取得できます。

`preset` は複数のスコープをまとめたものです。利用可能なプリセットは `root`、`developer`、`wippy_operator`、`observer`、`knowledge_manager`、`explorer_tools_only` です。より細かく制御するには、代わりに明示的な `scopes` 配列を渡します（例：`registry.read`、`state.write`、`git.pr`、`tasks.run`、`knowledge.read`）。raw の `wkmcp_...` トークンは 1 回だけ返され、ハッシュだけが保存されます。すぐにコピーしてください。

## クライアントの接続

トークンを bearer ヘッダーとして指定し、MCP クライアントをエンドポイントに向けます。最初にトークンを環境変数へエクスポートし、チェックインされる設定に含めないようにします。

```bash
export KEEPER_MCP_TOKEN='wkmcp_<token>'
```

Claude Code では、プロジェクトスコープの `.mcp.json` を使用します。

```json
{
  "mcpServers": {
    "keeper": {
      "type": "http",
      "url": "http://localhost:8080/keeper-mcp/",
      "headers": { "Authorization": "Bearer ${KEEPER_MCP_TOKEN}" }
    }
  }
}
```

Claude Code は、プロジェクト設定を読み込むときに環境から `${KEEPER_MCP_TOKEN}` を展開します。環境変数を変更した後は、MCP サーバーを再起動または再接続してください。

Codex では、ユーザーレベルの `~/.codex/config.toml`、または信頼済みプロジェクト内のプロジェクトスコープ `.codex/config.toml` を使用します。

```toml
[mcp_servers.keeper]
url = "http://localhost:8080/keeper-mcp/"
bearer_token_env_var = "KEEPER_MCP_TOKEN"
```

デプロイ環境では、`http://localhost:8080` の代わりにアプリの public base URL を使用します。

設定したクライアントで接続し、MCP ライフサイクルが完了することを確認します。

1. クライアントが `initialize` を送信し、サーバーの capability を受信します。
2. `notifications/initialized` を送信します。
3. `tools/list` を要求します。`observer` トークンでは、そのプリセットで許可されたディスカバリーおよびセッションツールが公開されます。
4. `session_info` を呼び出し、返されたスコープがトークンと一致することを確認します。

独自の Streamable HTTP クライアントは、これらのリクエストで `Accept: application/json, text/event-stream` を送信し、初期化時に返されたセッション ID があれば保持する必要があります。最初のリクエストとして `tools/list` を送ることは、有効な MCP ライフサイクルの確認になりません。bearer がない、または無効な場合、Keeper がスコープ付きツールカタログを公開する前に失敗します。

## MCP サーフェスの仕組み

Keeper は少数の **メタツール** を公開し、**trait** を使用して機能別のツールを必要に応じて有効化します。

- `session_info` — 常に利用可能。セッションのスコープと有効な trait を報告します。
- `list_traits` / `describe_trait` — 利用可能な項目を調べます。
- `use_trait` / `drop_trait`（および `set_traits`）— trait を有効化または削除します。MCP の `notifications/tools/list_changed` が送出され、表示されるツールが動的に変わります。
- `list_tools` / `call_tool` — trait が具体化したツールを一覧表示し、呼び出します。

トークンが有効化できるものは、その **スコープ** によって制限されます。おおむね `registry.*`、`state.*`、`hub.*`、`knowledge.*`、`git.*`、`components.*`、`tasks.*`、`agents.*`、`tests.run`、`logger.*`、`env.*`、`functions.call`、`app.ui`（完全な管理者バイパス用の `mcp.root` を含む）です。さらに、トークンの `access_mode`（`any` / `traits` / `tools_only`）がツールの呼び出し方を制限します。

## 運用とセキュリティに関する注意

- **ガバナンススコープ** — `GOV_MANAGED_NAMESPACES=app` を設定し、Keeper のファイルシステム↔レジストリ同期がアプリの名前空間だけを管理するようにします。該当モジュール自体を開発している場合を除き、`keeper`、`wippy`、`userspace` を追加しないでください。
- **セキュリティ** — トークンは発行した管理者 ID とスコープセットに結び付けられ、SHA-256 として保存され、Keeper MCP ページから失効できます。失効 API `POST /api/v1/keeper/mcp/tokens/revoke` が受け取るのは、トークン一覧 API が返すハッシュ化済みトークン識別子です。一度だけ表示される raw bearer は受け付けません。`/keeper-mcp/` ルートには認証ミドルウェアがなく、ハンドラーが bearer トークンを検証します。
- **リファレンスアプリ** — Wippy アプリケーションテンプレートは、Keeper をアプリシェルへ接続する実例です。`src/app/deps/_index.yaml` に動作確認済みのバインドがあります。

## 次のステップ

- [Hello World](./hello-world.md) — 最小プロジェクト構成
- [認証](./auth.md) — 管理者 ID とトークンの概念
- [エージェント](../framework/agents.md) — Keeper trait が公開するエージェントとツール
