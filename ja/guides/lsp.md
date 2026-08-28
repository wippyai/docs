---
title: "言語サーバー"
description: "TCP または HTTP 経由で Lua エディタ機能を提供する、Wippy 組み込みの Language Server Protocol サーバーを設定します。"
---

# 言語サーバー

Wippy には、Lua エディタ機能を提供する Language Server Protocol（LSP）サーバーが含まれています。このサーバーは Wippy ランタイムの一部として動作し、TCP または HTTP 経由のエディタ接続を受け付けます。

## 機能

- 型認識による補完候補を含むコード補完
- 型とシグネチャを表示するホバー情報
- 定義へ移動
- 参照の検索
- ドキュメントおよびワークスペースシンボル
- コール階層 (呼び出し元と呼び出し先)
- パースに成功した後、現在のエディタオーバーレイにある型エラーを取得する pull diagnostics
- 関数パラメータのシグネチャヘルプ

## 設定

`.wippy.yaml` でLSPサーバーを有効にします:

```yaml
lsp:
  enabled: true
  address: ":7777"
```

### 設定フィールド

| フィールド | デフォルト | 説明 |
|------------|------------|------|
| `enabled` | false | LSP サービスと TCP サーバーを有効化 |
| `address` | :7777 | TCPリッスンアドレス |
| `http_enabled` | false | HTTPトランスポートを有効化 |
| `http_address` | :7778 | HTTPリッスンアドレス |
| `http_path` | /lsp | HTTPエンドポイントパス |
| `http_allow_origin` | * | CORS許可オリジン |
| `max_message_bytes` | 8388608 | 受信メッセージの最大サイズ (バイト) |

### TCPトランスポート

TCPサーバーは、標準的なLSPメッセージフレーミング (Content-Lengthヘッダー) を持つJSON-RPC 2.0を使用します。これはエディタ統合の主要なトランスポートです。

### HTTPトランスポート

HTTP トランスポートは、JSON-RPC ペイロードを含む POST リクエストを受け付けます。ブラウザベースのエディタや Web ツールをサポートし、CORS プリフライトの `OPTIONS` リクエストに応答するとともに、クロスオリジンアクセス用の CORS ヘッダーを付与します。

```yaml
lsp:
  enabled: true
  http_enabled: true
  http_address: ":7778"
  http_path: "/lsp"
  http_allow_origin: "*"
```

## ドキュメントURIスキーム

LSPサーバーはレジストリエントリを識別するために `wippy://` URIスキームを使用します:

```
wippy://namespace:entry_name
```

エディタはこれらのURIをレジストリ内のエントリIDにマッピングします。`wippy://` スキームと生の `namespace:entry_name` 形式の両方が受け付けられます。

## インデクシング

LSP サーバーはコードエントリのインデックスを維持します。複数のワーカーがバックグラウンドでインデックスを更新します。

主な動作:

- エントリは依存関係の順序でインデックスされます (依存先が先)
- 変更により影響を受けるエントリの再インデックスがトリガーされます
- 未保存のエディタの変更はオーバーレイに保存されます
- インデックスはインクリメンタルです - 変更されたエントリのみが再処理されます

## サポートされるLSPメソッド

| メソッド | 説明 |
|----------|------|
| `initialize` | 機能ネゴシエーション |
| `initialized` | 初期化完了通知 |
| `shutdown` | プロトコルセッションを終了 |
| `exit` | 終了通知 |
| `textDocument/didOpen` | 開いたドキュメントの追跡 |
| `textDocument/didChange` | ドキュメント全体の同期 |
| `textDocument/didClose` | ドキュメントの解放 |
| `textDocument/hover` | カーソル位置の型情報 |
| `textDocument/definition` | 定義へジャンプ |
| `textDocument/references` | すべての参照を検索 |
| `textDocument/completion` | コード補完 |
| `textDocument/signatureHelp` | 関数シグネチャ |
| `textDocument/diagnostic` | ファイル診断 |
| `textDocument/documentSymbol` | ファイルシンボル |
| `workspace/symbol` | グローバルシンボル検索 |
| `textDocument/prepareCallHierarchy` | コール階層 |
| `callHierarchy/incomingCalls` | 呼び出し元の検索 |
| `callHierarchy/outgoingCalls` | 呼び出し先の検索 |

## 補完

補完エンジンはコードグラフを通じて型を解決します。以下を提供します:

- `.` および `:` の後のメンバー補完 (フィールド、メソッド)
- ローカル変数の補完
- モジュールレベルのシンボル補完
- トリガー文字: `.`、`:`

## 診断

ドキュメントのパースに成功すると、インデックス処理によって型の不一致や未定義シンボルなどの型チェック診断が保存されます。診断には、標準の error、warning、information、hint の重大度が使用されます。

ドキュメント全体の変更通知によって、診断に使用するオーバーレイが更新されます。クライアントは `textDocument/diagnostic` で現在保存されている結果を取得します。このサーバーは `textDocument/publishDiagnostics` 通知をプッシュしません。パースに失敗すると、新しい診断が保存される前に再インデックス処理が中止されるため、pull 結果にはその構文エラーが含まれず、直前に成功した結果が残る場合があります。

## 関連項目

- [リンター](guides/linter.md) — CLI ベースのコードチェック
- [型](lua/types.md) — 型システムのドキュメント
- [設定](guides/configuration.md) — ランタイム設定
