---
title: "MCP経由のKeeper"
description: "Wippy Keeperは稼働中のWippyアプリのコントロールプレーンです — レジストリのワークベンチ、ファイルシステム↔レジストリのガバナンス、エージェント/タスクのオーケストレーション、Hub…"
---

# MCP経由のKeeper

Wippy Keeperは稼働中のWippyアプリのコントロールプレーンです。レジストリのワークベンチ、
ファイルシステム↔レジストリのガバナンス、エージェント/タスクのオーケストレーション、Hubからのインストール、ナレッジベース、
ログとプロセスの検査、Gitのレビュー/プッシュフローを、すべて組み込みUIの背後で提供します。
その特徴は、それらのオペレーター向けケイパビリティをAIクライアント（Claude、
Codex、…）へ**MCP (Model Context Protocol)**経由で公開する点にあります。このページでは、アプリにKeeperを追加し、
MCPクライアントを接続します。

## 構築するもの

1. `app-template`から作成したアプリに追加されたKeeper。
2. `/app/keeper`のKeeper UIと`/keeper-mcp/`のMCPエンドポイント。
3. スコープ付きのMCPトークンと、Keeper経由でアプリを操作するよう設定されたMCPクライアント。

## 前提条件

- [app-template](https://github.com/wippyai/app-template)から作成したアプリ。Keeperがバインドする対象は
  すでにすべて用意されています: `app:gateway`、`app:api`、`app:db`、
  `app:processes`、`app.security:admin`、`app.env:store`。
- Keeperモジュールのインストール:

  ```bash
  wippy add keeper/keeper
  wippy install
  ```

## Keeperの追加

依存関係を宣言し、アプリのリソースにバインドします。必須なのは`admin_scope`のみで
（デフォルトなし）、残りは`app-template`が既に使っている名前がデフォルトになります。ここでは
明確さのために明示しています:

```yaml
# src/app/deps/_index.yaml
- name: keeper
  kind: ns.dependency
  component: keeper/keeper
  parameters:
    - { name: app_db,         value: app:db }
    - { name: admin_scope,    value: app.security:admin }
    - { name: env_storage,    value: app.env:store }
    - { name: public_gateway, value: app:gateway }   # /keeper-mcp/ をホストする
    - { name: mcp_route,      value: /keeper-mcp/ }
    - { name: ui_server,      value: app:gateway }
    - { name: process_host,   value: app:processes }
```

アプリを起動します:

```bash
wippy run
```

Keeperは3つのサーフェスを自動的にマウントします:

- **UI** — `/app/keeper`
- **MCPトランスポート** — パブリックゲートウェイ上の`/keeper-mcp/`
- **トークンAPI** — `app:api`上（`/keeper/mcp/tokens`、`/keeper/mcp/scopes`）

MCPトランスポートは`MCP_ENABLED`環境変数（デフォルト`true`）でゲートされます。
エンドポイントを閉じるには`false`に設定してください。

## MCPトークンの発行

トークンは管理者ユーザーが発行し、スコープが設定され、一度だけ表示されます。トークンAPI
（またはKeeper UIのMCPページ）から1つ作成します:

```bash
curl -X POST http://localhost:8085/api/v1/keeper/mcp/tokens \
  -H 'Authorization: Bearer <admin-session-token>' \
  -H 'Content-Type: application/json' \
  -d '{"label": "claude-dev", "preset": "developer"}'
# -> { "success": true, "token": { "token": "wkmcp_<64 hex>", ... } }
```

`preset`はスコープのセットをまとめたものです。利用可能なプリセット: `root`、`developer`、
`wippy_operator`、`observer`、`knowledge_manager`、`explorer_tools_only`。より
細かく制御するには、代わりに明示的な`scopes`配列を渡します（例: `registry.read`、
`state.write`、`git.pr`、`tasks.run`、`knowledge.read`）。生の`wkmcp_...`トークンは
一度だけ返され、ハッシュとしてのみ保存されます。すぐにコピーしてください。

## クライアントの接続

トークンをbearerヘッダーとして、MCPクライアントをエンドポイントに向けます。Claude Code /
Codexの場合は、プロジェクトルートに`.mcp.json`を置きます:

```json
{
  "mcpServers": {
    "keeper": {
      "type": "http",
      "url": "http://localhost:8085/keeper-mcp/",
      "headers": { "Authorization": "Bearer wkmcp_<token>" }
    }
  }
}
```

デプロイ環境では、`http://localhost:8085`の代わりにアプリのパブリックなベースURLを使用してください。

## MCPサーフェスの仕組み

Keeperはフラットで固定的なツール一覧を公開しません。いくつかの**メタツール**と、
要求に応じて具体的なツールを有効化する**トレイト**を提示するため、ケイパビリティをオプトインするまで
サーフェスは小さいままです:

- `session_info` — 常に利用可能。セッションのスコープと有効なトレイトを報告します。
- `list_traits` / `describe_trait` — 利用可能なものを探索します。
- `use_trait` / `drop_trait`（および`set_traits`） — トレイトを有効化または削除します。これはMCPの
  `notifications/tools/list_changed`を発行するため、表示されるツールがライブに変化します。
- `list_tools` / `call_tool` — トレイトが実体化したツールを列挙し、呼び出します。

トークンが有効化できる範囲は、その**スコープ**によって制限されます。おおむね`registry.*`、
`state.*`、`hub.*`、`knowledge.*`、`git.*`、`components.*`、`tasks.*`、`agents.*`、
`tests.run`、`logger.*`、`env.*`、`functions.call`、`app.ui`（加えて完全な管理者バイパスのための`mcp.root`）です。
トークンの`access_mode`（`any` / `traits` / `tools_only`）は、ツールの呼び出し方をさらに制約します。

## 注意点

- **ガバナンスの範囲** — `GOV_MANAGED_NAMESPACES=app`を設定し、Keeperの
  ファイルシステム↔レジストリ同期が自分のアプリの名前空間のみを統制するようにします。それらのモジュールを開発しているのでない限り、
  `keeper`、`wippy`、`userspace`を追加しないでください。
- **セキュリティ** — トークンは発行元の管理者アイデンティティとスコープセットに束縛され、
  SHA-256として保存され、`POST /keeper/mcp/tokens/revoke`で失効できます。`/keeper-mcp/`の
  ルートは認証ミドルウェアを実行しません。ハンドラ自身がbearerトークンを強制します。
- **リファレンスアプリ** — `app-keeper`は、Keeperをアプリシェルに組み込んだ実例です。
  動作確認済みのセットアップが必要なら、その`src/app/deps/_index.yaml`のブロックをコピーしてください。

## 次のステップ

- [Hello World](tutorials/hello-world.md) — 最小限のプロジェクト構成
- [認証](tutorials/auth.md) — トークンを発行する管理者アイデンティティ
- [エージェント](framework/agents.md) — Keeperのトレイトが公開するエージェントとツール
