# 言語サーバー

Wippyには、LuaコードのIDE機能を提供するビルトインLSP (Language Server Protocol) サーバーが含まれています。サーバーはWippyランタイムの一部として動作し、TCPまたはHTTP経由でエディタに接続します。

## 機能

- 型認識による補完候補を含むコード補完
- 型とシグネチャを表示するホバー情報
- 定義へ移動
- 参照の検索
- ドキュメントおよびワークスペースシンボル
- コール階層 (呼び出し元と呼び出し先)
- リアルタイム診断 (パースエラー、型エラー)
- 関数パラメータのシグネチャヘルプ

## 設定

`.wippy.yaml` でLSPサーバーを有効にします:

```yaml
version: "1.0"

lua:
  type_system:
    enabled: true

lsp:
  enabled: true
  address: ":7777"
```

### 設定フィールド

| フィールド | デフォルト | 説明 |
|------------|------------|------|
| `enabled` | false | TCPサーバーを有効化 |
| `address` | :7777 | TCPリッスンアドレス |
| `http_enabled` | false | HTTPトランスポートを有効化 |
| `http_address` | :7778 | HTTPリッスンアドレス |
| `http_path` | /lsp | HTTPエンドポイントパス |
| `http_allow_origin` | * | CORS許可オリジン |
| `max_message_bytes` | 8388608 | 受信メッセージの最大サイズ (バイト) |

### TCPトランスポート

TCPサーバーは、標準的なLSPメッセージフレーミング (Content-Lengthヘッダー) を持つJSON-RPC 2.0を使用します。これはエディタ統合の主要なトランスポートです。

### HTTPトランスポート

HTTPトランスポートはJSON-RPCペイロードを持つPOSTリクエストを受け付けます。ブラウザベースのエディタやWebツールに便利です。クロスオリジンアクセスのためにCORSヘッダーが含まれます。

```yaml
lsp:
  enabled: true
  http_enabled: true
  http_address: ":7778"
  http_path: "/lsp"
  http_allow_origin: "*"
```

## VS Codeのセットアップ

### Wippy Lua拡張機能の使用

1. VS Codeマーケットプレイスから `wippy-lua` 拡張機能をインストールします (またはソースからビルド)
2. LSPを有効にしてWippyランタイムを起動します:

```bash
wippy run
```

3. 拡張機能はデフォルトで `127.0.0.1:7777` に接続します。

### 拡張機能の設定

| 設定 | デフォルト | 説明 |
|------|------------|------|
| `wippyLua.lsp.enabled` | true | LSPクライアントを有効化 |
| `wippyLua.lsp.host` | 127.0.0.1 | LSPサーバーホスト |
| `wippyLua.lsp.port` | 7777 | TCPポート |
| `wippyLua.lsp.httpPort` | 7778 | HTTPトランスポートポート |
| `wippyLua.lsp.mode` | tcp | 接続モード (tcp, http) |

## ドキュメントURIスキーム

LSPサーバーはレジストリエントリを識別するために `wippy://` URIスキームを使用します:

```
wippy://namespace:entry_name
```

エディタはこれらのURIをレジストリ内のエントリIDにマッピングします。`wippy://` スキームと生の `namespace:entry_name` 形式の両方が受け付けられます。

## インデクシング

LSPサーバーは高速な検索のためにすべてのコードエントリのインデックスを維持します。インデクシングは複数のワーカーを使用してバックグラウンドで行われます。

主な動作:

- エントリは依存関係の順序でインデックスされます (依存先が先)
- 変更により影響を受けるエントリの再インデックスがトリガーされます
- 未保存のエディタの変更はオーバーレイに保存されます
- インデックスはインクリメンタルです - 変更されたエントリのみが再処理されます

## サポートされるLSPメソッド

| メソッド | 説明 |
|----------|------|
| `initialize` | 機能ネゴシエーション |
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

診断はインデクシング中に計算され、以下を含みます:

- パースエラー (構文の問題)
- 型チェックエラー (不一致、未定義のシンボル)
- 重大度レベル: error、warning、information、hint

診断はドキュメントオーバーレイシステムを通じて入力中にリアルタイムで更新されます。

## 関連項目

- [リンター](guides/linter.md) - CLIベースのコードチェック
- [型](lua/types.md) - 型システムのドキュメント
- [設定](guides/configuration.md) - ランタイム設定
