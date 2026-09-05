---
title: "レジストリ内部"
description: "レジストリはバージョン付きでイベント駆動の状態ストアです。完全なバージョン履歴を維持し、トランザクションをサポートし、イベントバスを通じて変更を伝播します。"
---

# レジストリ内部

レジストリはバージョン付きでイベント駆動の状態ストアです。完全なバージョン履歴を維持し、トランザクションをサポートし、イベントバスを通じて変更を伝播します。

## エントリストレージ

エントリはO(1)ルックアップ用のハッシュマップインデックス付き順序付きスライスとして格納：

```go
type Entry struct {
    ID       ID              // namespace:name
    Kind     Kind            // エントリタイプ
    Meta     attrs.Bag       // 作者のメタデータ
    Data     payload.Payload // コンテンツ
    Registry EntryMetadata   // レジストリ所有の来歴
}

type EntryMetadata struct {
    Owner string // エントリを供給したデプロイメントソース
    Root  bool   // デプロイメントが選択した依存関係の宣言
}
```

エントリIDはGoの`unique`パッケージを使用してインターニング—同一のIDはメモリを共有。

`Registry`はエントリの作者ではなくレジストリが所有。`Owner`はデプロイメントソースから割り当てられ、`Root`は`ns.dependency`エントリの書き込み側フィールド`dependency_root`から設定される。通常のエントリAPIが返すのは`ID`、`Kind`、`Meta`、`Data`のみ。来歴はスナップショットの状態APIを通じて読み取る。

## スナップショット

`Registry.Snapshot()`は1つのアトミックなビューを返す：バージョン、そのバージョンにおけるエントリ、そして同じバージョンに対するレジストリ所有の状態メタデータ。

```go
type Snapshot struct {
    Registry StateMetadata
    Version  Version
    Entries  State
}

type StateMetadata struct {
    Resolution *DependencyResolution
}
```

バージョン、エントリ、解決結果を1つの値として読み取ることで、呼び出し側が別バージョンの解決結果とエントリを組み合わせることを防ぐ。選択されたモジュールグラフは、すべてのエントリに繰り返し持たせるのではなく、スナップショットごとに一度だけ格納される。

## オーバーレイ

`OverlayWriter`はプロセスローカルなエントリのためのオプションのレジストリ機能：

```go
type OverlayWriter interface {
    ApplyOverlay(context.Context, string, uint64, ChangeSet) (uint64, error)
    GetOverlay(string) (State, uint64, error)
}
```

オーバーレイエントリは論理的なオーナー文字列の下にグループ化される。実効状態に参加し、永続エントリと同じトポロジーソートとハンドラ遷移を通過するため、サービスは通常どおり起動・停止するが、履歴バージョンを生成することはない。コールドブート後は空であり、所有する制御サービスによって整合される必要がある。

書き込みは楽観的並行制御：`GetOverlay`はオーナーの現在の世代を返し、`ApplyOverlay`はその世代がまだ最新である場合にのみコミットし、そうでなければリトライ可能な`Conflict`を返す。適用が成功するたびにプロセス内で一意な新しい世代が発行され、変更を行ったオーナーにはトゥームストーンが保持されるため、ABAのような一連の操作が未変更のオーバーレイと誤認されることはない。

適用のたびに検証される合成規則：

- エントリを作成できるのは、そのIDを持つ永続エントリもオーバーレイエントリも存在しない場合のみ。
- 自身のオーバーレイエントリを更新・削除できるのは所有するアイデンティティのみ。
- オーバーレイエントリはレジストリ所有のメタデータを持てず、レジストリディレクティブが要求する種別を使用できない。
- 削除は、生存する他のエントリが依存しているエントリを取り除けない。
- 依存関係のエッジはオーナーの境界を越えられず、永続エントリはオーバーレイエントリに依存できない。

## バージョンチェーン

各バージョンは親を指す。パス計算はグラフアルゴリズムを使用して任意の2つのバージョン間の最短ルートを見つける：

```mermaid
flowchart LR
    v0[v0] --> v1[v1] --> v2[v2] --> v3[v3] --> vN[vN]
```

## ChangeSet

チェンジセットは1つの状態から別の状態に変換する操作の順序付きリスト：

| 操作 | OriginalEntry | 目的 |
|------|---------------|------|
| Create | nil | 新しいエントリを追加 |
| Update | 古い値 | 既存を変更 |
| Delete | 削除された値 | エントリを削除 |

`OriginalEntry`は反転を可能にする—更新は以前の値を、削除は削除されたものを格納。

### デルタの構築

`BuildDelta(oldState, newState)`は最小限の操作を生成：

1. 状態を比較し、変更を特定
2. 削除を依存関係の逆順でソート（依存するものが先）
3. 作成/更新を依存関係の順でソート（依存されるものが先）

### スカッシュ

複数のチェンジセットはエントリごとの最終状態を追跡してマージ：

```
Create + Update = Create（更新された値で）
Create + Delete = ∅（相殺）
Update + Delete = Delete
Delete + Create = Update
```

## トランザクション

```mermaid
sequenceDiagram
    participant R as レジストリ
    participant B as イベントバス
    participant H as ハンドラ

    R->>B: registry.begin
    loop 各操作
        R->>B: entry.create/update/delete
        B->>H: リスナーにディスパッチ
        H-->>B: 受理または拒否
        B-->>R: 確認
    end
    alt すべて受理
        R->>B: registry.commit
    else いずれか拒否
        R->>B: registry.discard
        R->>R: ロールバック
    end
```

ハンドラには各操作を受理または拒否するのに30秒。拒否時、レジストリは逆デルタを計算・適用してロールバック。

### 非伝播エントリ

一部のkindはイベントバスを完全にスキップ：
- `registry.entry` - アプリケーション設定
- `ns.requirement` - 名前空間要件
- `ns.dependency` - モジュール依存関係
- `ns.definition` - モジュールメタデータ（readme、wiki、ライセンス、著者）

## 依存関係解決

エントリは他のエントリへの依存関係を宣言可能。リゾルバは登録されたパターンを通じて依存関係を抽出：

```go
resolver.RegisterPattern(registry.DependencyPattern{
    Path:          "meta.server",
    AllowWildcard: true,
})
```

依存関係はエントリのMetaとDataフィールドから抽出され、状態遷移時のトポロジカルソートに使用。

### 依存関係アクセスポリシー

外部の依存関係へのアクセスはグローバルなフラグではなく、リクエストスコープのコンテキスト値：

| ポリシー | 効果 |
|--------|--------|
| `DependencyAccessUnspecified` | 呼び出し側が選択。呼び出し側自身のデフォルトが適用される |
| `DependencyAccessOnline` | 外部での解決とアーティファクトのダウンロードが許可される |
| `DependencyAccessVerifiedOffline` | 外部アクセスは禁止。解決はロックされたマニフェストとローカルに存在するアーティファクトを使用する |

`LoadState()`はコンテキストが何も指定しない場合、verified-offlineをデフォルトとする。そのためブートはネットワークに接続せず、保存済みのグラフをリプレイする。デプロイメントのベースラインを復元する場合は、そのベースラインが指すモジュールを取得しなければならないため、コンテキストをonlineに切り替える。verified-offlineでは、ロックされたモジュールのみを提供するマニフェストプロバイダがハブのプロバイダに取って代わり、欠けているアーティファクトはダウンロードを引き起こすのではなく、証跡の欠落として失敗する。

## バージョン履歴

履歴バックエンド：

| 実装 | ユースケース |
|-----|-----------|
| SQLite | 本番永続化 |
| PostgreSQL | 本番永続化、ノード間で共有 |
| Memory | `history_type`未設定時のデフォルト。テスト |
| Nil | 履歴なし |

SQLiteはWALモードを使用し、バージョン、チェンジセット（MessagePackエンコード）、メタデータ用のテーブルを持つ。PostgreSQLは`registry.history_type: postgres`に`history_dsn`/`history_schema`を加えて選択する（[設定](guides/configuration.md#registry)を参照）。

履歴は各バージョンの正確な依存関係解決も永続化する。`ns.dependency`の変更が適用されると、解決されたモジュールグラフはチェンジセットと並んでコンテンツアドレスで保存される。ブートとロールバックは再解決する代わりに保存済みのグラフをリプレイするため、あるバージョンは常にそれが解決された時点のバージョン群と整合する。履歴スキーマはアップグレード後の初回ブートで自動的にマイグレーションされる。既存のバージョンは初回アクセス時に一度だけ解決され、チェックポイントされる。

### ナビゲーション

パス計算はバージョン間の最短ルートを見つける：

```go
Path(v0, v3) = [v1, v2, v3]  // チェンジセットを順方向に適用
Path(v3, v1) = [v2, v1]      // 逆チェンジセットを適用
```

`LoadState()`は新しいバージョンを作成せずにベースラインから履歴をリプレイ—ブート時に使用。

## Finder

エントリ検索用のLRUキャッシュ付きクエリエンジン：

| 演算子 | プレフィックス | 例 |
|-------|------------|-----|
| Glob | (なし) | `.kind=function.*` |
| Regex | `~` | `~meta.path=/api/.*` |
| Contains | `*` | `*meta.tags=backend` |
| Prefix | `^` | `^meta.name=user` |
| Suffix | `$` | `$meta.path=Handler` |

キャッシュはバージョン変更時に無効化。

## 関連項目

- [レジストリ](concepts/registry.md) - 高レベルコンセプト
- [イベント](internals/events.md) - イベントバスの詳細

