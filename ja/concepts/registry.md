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

registry ID は、多くの authorization check でも resource として使われます。registry は definition を保存し、security scope が保護対象 operation から access できるかを決定します。[セキュリティモデル](./security-model.md)を参照してください。

## Kind handler :id=kind-handlers

dispatch された entry が submit されると、その `kind` に登録された handler が選択されます。handler は対応する runtime resource を検証して reconcile します。`http.service` entry は HTTP server、`function.lua` entry は function pool、`db.sql.postgres` entry は connection pool を管理します。利用可能な kind は[エントリ種別ガイド](../guides/entry-kinds.md)、handler の実装は[カスタムエントリ種別](../internals/kinds.md)を参照してください。

## ライブ更新

system の実行中に entry を追加、更新、削除できます。dispatch 対象 kind では、registry transaction が commit 前に参加 handler へ各 operation の accept または reject を求めます。reject されると transaction を破棄し、逆向きの transition を適用します。関連する topology change からは、1 つの新しい registry version が生成されます。

history が有効な場合、version history により backward transition と forward transition ができます。既定の memory history は process lifetime の間だけ存続します。SQLite backend と PostgreSQL backend では restart 後も history が永続化されます。

YAML および JSON definition file は、boot loader が entry に変換する source manifest です。serialized registry snapshot ではありません。programmatic access については[Registry module](../lua/core/registry.md)を参照してください。

## 関連項目 :id=see-also

- [YAML とプロジェクト構造](../start/structure.md) — definition file
- [カスタムエントリ種別](../internals/kinds.md) — kind handler の実装
- [プロセスモデル](./process-model.md) — process execution の理解
