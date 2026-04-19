# ネットワークオーバーレイ

オーバーレイネットワーク（SOCKS5 プロキシ、Tor、Tailscale メッシュ、I2P）を介して送信トラフィックをルーティングし、リスナーをバインドします。オーバーレイの選択は呼び出しごとのオプトインで、関数、プロセス、HTTP の境界を越えて継承されます。

## エントリ種別

| Kind | 説明 |
|------|-------------|
| `network.socks5` | 汎用 SOCKS5 プロキシ（Tor の SOCKS5 リスナーもカバー） |
| `network.tailscale` | Tailscale tsnet オーバーレイノード |
| `network.i2p` | I2P SAM v3 ブリッジ |

## SOCKS5

```yaml
- name: proxy
  kind: network.socks5
  host: 127.0.0.1
  port: 1080
  username: "optional"
  password: "optional"
  isolate_streams: false
```

| フィールド | 型 | 説明 |
|-------|------|-------------|
| `host` | string | プロキシホスト |
| `port` | int | プロキシポート (1-65535) |
| `username` | string | オプションの SOCKS5 認証 |
| `password` | string | オプションの SOCKS5 認証 |
| `isolate_streams` | bool | 接続ごとのランダム認証情報（Tor ストリーム分離） |

## Tailscale

```yaml
- name: tailnet
  kind: network.tailscale
  hostname: "wippy-node"
  auth_key_env: "TS_AUTHKEY"
  ephemeral: false
  control_url: ""
```

| フィールド | 型 | 説明 |
|-------|------|-------------|
| `hostname` | string | tsnet ノード名（ノードごとの状態ディレクトリで使用） |
| `auth_key` | string | インライン tailnet 認証キー |
| `auth_key_env` | string | 認証キーを保持する環境変数名（env レジストリで解決） |
| `state_dir` | string | tsnet 状態ディレクトリのオーバーライド |
| `control_url` | string | 代替調整サーバー |
| `ephemeral` | bool | エフェメラル tailnet ノードとして登録 |

`auth_key` または `auth_key_env` のいずれかが必要です。

## I2P

```yaml
- name: i2p_bridge
  kind: network.i2p
  host: 127.0.0.1
  port: 7656
  session_name: "wippy"
```

| フィールド | 型 | 説明 |
|-------|------|-------------|
| `host` | string | SAM v3 ブリッジホスト |
| `port` | int | SAM v3 ブリッジポート |
| `session_name` | string | オプションのセッション識別子 |

## オーバーレイの選択

### http.service 上

サーバーリスナーをオーバーレイ（Tailscale、I2P）経由でバインドします：

```yaml
- name: gateway
  kind: http.service
  addr: ":8080"
  network: app.net:tailnet
```

SOCKS5 はインバウンドリスニングをサポートしません — 送信ダイヤルにのみ使用してください。

### Lua から

`with_options` を使用して、呼び出された関数または生成されたプロセスをオーバーレイ経由でルーティングします：

```lua
local funcs = require("funcs")

local result, err = funcs.new()
    :with_options({ network = "app.net:proxy" })
    :call("app.api:fetch_data")
```

```lua
local pid, err = process.with_options({ network = "app.net:tailnet" })
    :spawn_monitored("app.workers:probe", "app:processes")
```

`http_client` モジュールは、呼び出しごとのオプションの `overlay_network` キーで同じオーバーレイ選択を受け入れます。

## 継承

オーバーレイの選択は呼び出しスタックを流れます。`funcs.new():with_options({network=...})` 経由で呼び出された関数は、すべての内部ダイヤル、すべてのネストされた `funcs.call`、および実行するすべての `process.spawn` でオーバーレイを見ます — 子孫が明示的に別のオーバーレイを選択するかクリアするまで。

アンビエント継承は子孫自身の `network.select` 拒否ルールをバイパスします。Lua のエッジでの明示的な選択のみがゲートされます。

## アプリ設定

オーバーレイドライバは、`.wippy.yaml` の `network_service:` ブロックからアプリ全体の設定を読み込みます:

```yaml
network_service:
  state_dir: .wippy/net          # ドライバ状態のベースディレクトリ（Tailscale キーなど）
  default_network: app.net:tailnet  # 呼び出し側が設定しない場合に使用されるオーバーレイ
```

| フィールド | デフォルト | 説明 |
|------|----------|--------------|
| `state_dir` | `.wippy/net` | ドライバ状態用のディレクトリ。相対パスはブート設定ディレクトリを基準に解決されます。 |
| `default_network` | — | オプションで独自のネットワークを設定しないすべてのタスクまたはプロセスに適用されるオーバーレイのレジストリ ID。 |

## 権限

| アクション | リソース | 説明 |
|--------|----------|-------------|
| `network.select` | ネットワーク Registry ID | `funcs.call`、`process.spawn`、`http_client` での明示的なオーバーレイ選択 |

スコープで `network.select` を拒否して、その中のコードが明示的にオーバーレイを選択するのを停止します。継承されたオーバーレイは影響を受けません — 呼び出し元で承認済みです。

## 関連項目

- [セキュリティ](system/security.md) - ポリシーとアクター
- [HTTP サービス](http/server.md) - サーバーバインディング
- [HTTP クライアント](lua/http/client.md) - 呼び出しごとのオーバーレイ選択
