---
title: "クラスター"
description: "Wippy node が peer を発見し、process message を routing し、gossip と Raft で協調する仕組み。"
---

# クラスター

単一の Wippy node だけでも完全な runtime です。**クラスター**は複数の node を接続し、process が cluster-wide name を使い、node 間で message を routing し、lock、group、shared consensus core を介して協調できるようにします。

clustering は opt-in（`cluster.enabled`）です。このページではコードから見える model を説明します。topology、configuration、operation については[クラスターガイド](../guides/cluster.md)を参照してください。

## クラスターモデル :id=cluster-model

node は **gossip**（SWIM）を介して互いを発見します。node は seed を通じて参加し、その後は中央 coordinator なしに membership と failure 情報が収束します。境界が定められた **Raft** core は動的に調整される voter set を通じて linearizable consensus を提供し、他の node は gossip を介して参加します。

application から見える model は、**名前**、**routing**、**協調 primitive** の 3 つで構成されます。

## 命名

process は通常 PID で address 指定します。クラスター内では **name** を付けて登録し、他の node からその name で到達することもできます。選択する **scope** によって consistency guarantee と coordination cost が決まります。

| Scope | 可視範囲 | 保証 | 用途 |
|----------|----------|------|------|
| **Local** | この node | 即時、coordination なし | node-local helper |
| **Eventual** | クラスター全体 | gossip 後に収束。競合を解決し、敗者へ通知 | service、group、限定的な presence name |
| **Consistent** | クラスター全体 | Raft による linearizable singleton | 標準的な cluster-wide named service |
| **Strong** | クラスター全体 | Consistent に加え、name が active になる前にすべての live node が acknowledge | control-plane singleton と lock |

scope は consistency と coordination cost の順に `Local < Eventual < Consistent < Strong` と並びます。必要な保証を満たすうち、cost が最も低い scope を選んでください。name は [`process.registry`](../lua/core/process.md) で登録します。Local name は process の終了時に削除されます。Consistent name と Strong name も process の終了または node の離脱時に回収されます。Eventual name は明示的に削除するか、その origin node が離脱したときに削除され、所有する process だけが終了しても自動削除されません。

## ルーティング

routing は、登録済み name とそれを所有する process を接続します。

- **read は local です。** 各 node は自身の replica または gossip で配布された cache から name を resolve します。name lookup に network round-trip は不要です。そのため高速で、partition 中も動作します。
- **resolve には固定の順序があります。** 最も authoritative な plane から、Consistent と Strong（Raft）、Eventual（gossip）、Local の順に resolve します。同じ文字列の cluster-wide name は local name より優先されます。
- **write は authority に routing されます。** Consistent または Strong の登録は Raft leader を経由します。leader でない node は write を転送して結果を待ちます。commit されると active binding が gossip で配布され、Raft core に属さない node も含め、すべての node がその後 local で name を resolve できます。
- **message は PID で routing されます。** name に `process.send` すると PID に resolve され、relay が所有 node に message を配信します。process が同じ node にあっても別の node にあっても、コードからの address 指定は同じで、location は透過的です。

application は authority node を直接 address 指定せずに name を登録・resolve できます。resolve 後、message は対象 PID を所有する node に routing されます。

## プリミティブ

clustering は少数の coordination building block を公開します。

- **membership と identity** — live node の集合と、この node の identity および role。peer の発見や work の shard に使います。[`system.cluster`](../lua/system/system.md)と[`system.node`](../lua/system/system.md)を参照してください。
- **consensus state** — Raft leader、term、この node の role。diagnostics や leader-aware logic に使います。[`system.raft`](../lua/system/system.md)を参照してください。
- **cluster-wide name** — name と scope で process を登録・resolve します。他のすべての基盤です。[`process.registry`](../lua/core/process.md)を参照してください。
- **distributed lock** — クラスター全体の mutual exclusion で、holder は最大 1 つです。holder が終了すると自動解放されます。[`system.lock`](../lua/system/system.md)を参照してください。
- **process group** — named group に参加し、すべての node の全 member に Erlang style で broadcast します。[プロセスグループ](../lua/core/pg.md)を参照してください。

これらの primitive は membership と routing infrastructure を共有します。Consistent name、Strong name、distributed lock は Raft core を使います。process group は gossip membership で peer を発見し、relay 経由で変更を送信し、完全な state を定期交換して収束します。

## 関連情報 :id=see-also

- [クラスターガイド](../guides/cluster.md) — topology、configuration、operation
- [プロセス管理](../lua/core/process.md) — spawn、messaging、name registry
- [プロセスグループ](../lua/core/pg.md) — named group と broadcast
- [システム](../lua/system/system.md) — `system.cluster`、`system.node`、`system.raft`、`system.lock`
- [プロセスモデル](./process-model.md) — process、PID、messaging
