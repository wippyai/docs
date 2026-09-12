---
title: "レジストリ"
description: "Wippy が型付き entry を保存し、runtime resource を初期化し、configuration change を伝播する仕組み。"
---

# レジストリ

registry は、entry point、service、resource、その他の runtime definition を保持する Wippy の versioned store です。多くの runtime entry kind は event-bus transaction を介して reconcile されます。`registry.entry` や namespace metadata などの internal kind は、既定では event dispatch を迂回します。

## エントリ

registry は、一意の ID を持つ型付き definition である **entry** を保持します。

```
app.api:get_user          → HTTP handler
app.workers:email_sender  → Background process
app:database              → Database connection
app:templates             → Template set
```

各 entry には `ID`（namespace:name 形式）、handler を決定する `kind`、任意の `meta` field、kind 固有の `data` があります。

こうした作成者が記述するコンテンツとは別に、レジストリは各エントリについて独自の来歴情報を保持します。エントリの出自であるデプロイメントソースを示す`owner`と、デプロイメントが選択した依存関係宣言を示す`root`です。この状態はレジストリが割り当てるものであり、エントリの作成者が記述するものではありません。両者が混同されることのないよう、`meta`とは分離して保持されます。この情報は通常のエントリAPIではなく、スナップショット状態APIを通じて読み取ります — [レジストリモジュール](lua/core/registry.md#snapshot-state)を参照してください。

## 種別ハンドラ

エントリが送信されると、その`kind`がどのハンドラが処理するかを決定します。ハンドラは設定を検証し、ランタイムリソースを作成します。`http.service`エントリはHTTPサーバーを起動し、`function.lua`エントリは関数プールを作成し、`db.sql.postgres`エントリは接続プールを確立します。利用可能な種別については[エントリ種別ガイド](guides/entry-kinds.md)を、ハンドラの実装については[カスタムエントリ種別](internals/kinds.md)を参照してください。

## ライブ更新

system の実行中に entry を追加、更新、削除できます。dispatch 対象 kind では、registry transaction が commit 前に参加 handler へ各 operation の accept または reject を求めます。reject されると transaction を破棄し、逆向きの transition を適用します。関連する topology change からは、1 つの新しい registry version が生成されます。

history が有効な場合、version history により backward transition と forward transition ができます。既定の memory history は process lifetime の間だけ存続します。SQLite backend と PostgreSQL backend では restart 後も history が永続化されます。

YAML および JSON definition file は、boot loader が entry に変換する source manifest です。serialized registry snapshot ではありません。programmatic access については[Registry module](lua/core/registry.md)を参照してください。

## 関連項目 :id=see-also

- [YAML とプロジェクト構造](start/structure.md) — definition file
- [カスタムエントリ種別](internals/kinds.md) — kind handler の実装
- [プロセスモデル](concepts/process-model.md) — process execution の理解
