---
title: "ネットワークオーバーレイ"
description: "オーバーレイネットワーク（SOCKS5 プロキシ、Tor、Tailscale メッシュ、I2P）を介して送信トラフィックをルーティングし、リスナーをバインドします。オーバーレイの選択は呼び出しごとのオプトインで、関数、プロセス、HTTP の境界を越えて継承されます。"
---

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
  auth_key: ${env:TS_AUTHKEY}
  ephemeral: false
  control_url: ""
```

| フィールド | 型 | 説明 |
|-------|------|-------------|
| `hostname` | string | tsnet ノード名（ノードごとの状態ディレクトリで使用） |
| `auth_key` | string | Tailnet 認証キー — インライン、または [env レジストリ](system/env.md)で解決される `${env:NAME}` |
| `state_dir` | string | tsnet 状態ディレクトリのオーバーライド |
| `control_url` | string | 代替調整サーバー |
| `ephemeral` | bool | エフェメラル tailnet ノードとして登録 |

`auth_key` は必須です（直接指定するか `${env:NAME}` 経由で指定します）。レガシーの `auth_key_env` ディレクティブも同じ方法で解決されますが非推奨です。`auth_key: ${env:NAME}` を推奨します。

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

## 生のダイヤル

オーバーレイの選択は Lua のエッジに限られません。ランタイムのネットワークサービス経由のダイヤル — WASM の [`socket` ホスト](wasm/hosts.md#socket)と `wasi:sockets` ディスパッチャ — はフレームからオーバーレイを読み取り、それを経由してルーティングします。`with_options`、エントリの `meta.options.network`、`network_service.default_network` のいずれで設定されたものであっても同様です。

このパスではプライベート IP のゲートの挙動が異なります。直接のダイヤルは対象を解決し、得られたすべてのアドレスを `socket.private_ip` に対してチェックします。オーバーレイが選択されている場合、チェックされるのは対象に含まれるリテラルの IP アドレスのみです。ホスト名は解決のためにオーバーレイへ渡されるため、ローカルのリゾルバは参照されず、それが返したはずの結果に対するチェックも行われません。

オーバーレイが選択されているのにコンテキストがネットワークレジストリを持たない場合、ダイヤルは `network "<id>" selected without a network registry` で失敗します。

## オーバーレイの更新

オーバーレイエントリはレジストリ更新時にホットスワップされます。オーバーレイの設定が変更されると、ドライバはまず置き換え用のサービスを構築し、それが正常に作成された場合にのみ切り替えます。新しい設定が失敗した場合は、既存のオーバーレイがそのまま稼働を続けます。同時に呼び出した側は、古いサービスか新しいサービスのいずれかを見ることになり、間隙が生じることはありません。

## 権限

| アクション | リソース | 説明 |
|--------|----------|-------------|
| `network.select` | ネットワーク Registry ID | `funcs.call`、`process.spawn`、`http_client` での明示的なオーバーレイ選択 |
| `network.bind` | ネットワーク Registry ID | `http.service` リスナーをオーバーレイ経由でバインド（`network:` フィールド） |
| `socket.connect` | `host:port` | ネットワークサービス経由のあらゆるアウトバウンドダイヤル |
| `socket.listen` | `host:port` | ネットワークサービス経由での TCP リスナーまたは UDP ソケットのバインド |
| `socket.resolve` | ホスト名 | ネットワークサービス経由の DNS 解決 |
| `socket.private_ip` | IP アドレス | ループバック、プライベート、リンクローカル、未指定のアドレスへの到達 |

スコープで `network.select` を拒否して、その中のコードが明示的にオーバーレイを選択するのを停止します。継承されたオーバーレイは影響を受けません — 呼び出し元で承認済みです。`network.bind` は、`network:` オーバーレイを持つサーバーがリスナーを開始するときにチェックされます。

`socket.*` 権限はネットワークサービス自身がチェックします。`socket.connect`、`socket.listen`、`socket.resolve` はオーバーレイによるルーティングの前にチェックされるため、クリアネットのトラフィックにもオーバーレイのトラフィックにも等しく適用されます。`socket.private_ip` は、[生のダイヤル](system/network.md#raw-dials)で述べたとおり、オーバーレイが選択されるとリテラルのアドレスのみに絞られます。

## 関連項目

- [セキュリティ](system/security.md) - ポリシーとアクター
- [HTTP サービス](http/server.md) - サーバーバインディング
- [HTTP クライアント](lua/http/client.md) - 呼び出しごとのオーバーレイ選択
- [ホスト関数](wasm/hosts.md) - WASM ソケットインポート
