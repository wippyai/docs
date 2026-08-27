---
title: "ネットワークオーバーレイ"
description: "SOCKS5、Tor、Tailscale、I2P のオーバーレイを通じて送信接続をルーティングし、リスナーをバインドします。"
---

# ネットワークオーバーレイ

ネットワークオーバーレイエントリは、SOCKS5、Tor、Tailscale、I2P を通じて送信接続をルーティングしたり、リスナーをバインドしたりします。選択されたオーバーレイは、関数、プロセス、HTTP の境界を越えて伝播します。

このページは設定リファレンスです。YAML のコードブロックはエントリまたはアプリケーション設定の断片であり、外部プロキシ、tailnet、I2P SAM サービスがすでに存在することを前提としています。

## エントリ種別

| 種別 | 説明 |
|------|------|
| `network.socks5` | 汎用 SOCKS5 プロキシ（Tor の SOCKS5 リスナーにも対応） |
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
|------------|-----|------|
| `host` | string | プロキシホスト |
| `port` | int | プロキシポート（1～65535） |
| `username` | string | 省略可能な SOCKS5 認証 |
| `password` | string | 省略可能な SOCKS5 認証 |
| `isolate_streams` | bool | 接続ごとにランダムな認証情報を使用（Tor のストリーム分離） |

`host` と `port` は必須です。`isolate_streams` のデフォルトは `false` です。分離を有効にすると、ランタイムは設定済みの認証情報を使用せず、ダイヤルごとに新しいユーザー名とパスワードを生成します。

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
|------------|-----|------|
| `hostname` | string | tsnet ノード名（ノードごとの状態ディレクトリで使用） |
| `auth_key` | string | Tailnet 認証キー。インラインまたは[環境変数レジストリ](./env.md)を通じて解決される `${env:NAME}` |
| `state_dir` | string | tsnet 状態ディレクトリの上書き |
| `control_url` | string | 代替調整サーバー |
| `ephemeral` | bool | 一時的な tailnet ノードとして登録 |

`auth_key` は必須です（直接指定するか `${env:NAME}` を使用）。従来の `auth_key_env` ディレクティブも同じ方法で解決されますが、非推奨です。`auth_key: ${env:NAME}` を使用してください。

tsnet のホスト名のデフォルトは `wippy` です。`state_dir` を省略すると、ランタイムは `<network_service.state_dir>/tailscale/<node>` を使用します。`<node>` は設定済みのホスト名であり、ホスト名も設定されていない場合はレジストリエントリ名です。

## I2P

```yaml
- name: i2p_bridge
  kind: network.i2p
  host: 127.0.0.1
  port: 7656
  session_name: "wippy"
```

| フィールド | 型 | 説明 |
|------------|-----|------|
| `host` | string | SAM v3 ブリッジホスト |
| `port` | int | SAM v3 ブリッジポート |
| `session_name` | string | 省略可能なセッション識別子 |

`host` と `port` は必須です。`session_name` のデフォルトは `wippy` で、ダイヤルおよびリスナーごとの SAM セッション ID のプレフィックスとして使用されます。

## オーバーレイの選択

### `http.service` での選択

サーバーリスナーをオーバーレイ（Tailscale、I2P）を通じてバインドします。

```yaml
- name: gateway
  kind: http.service
  addr: ":8080"
  network: app.net:tailnet
```

SOCKS5 は受信リスナーをサポートしません。送信ダイヤルにだけ使用してください。

### Lua からの選択

`with_options` を使用して、呼び出す関数または生成するプロセスをオーバーレイ経由でルーティングします。

```lua
local funcs = require("funcs")

local caller, err = funcs.new():with_options({ network = "app.net:proxy" })
if err then return nil, err end
local result, call_err = caller:call("app.api:fetch_data")
if call_err then return nil, call_err end
```

```lua
local process = require("process")

local pid, err = process.with_options({ network = "app.net:tailnet" })
    :spawn_monitored("app.workers:probe", "app:processes")
if err then return nil, err end
```

カスタムオプションでプロセススポーナーを構築するには、`process.context` 権限が `context` に対して必要です。拒否された場合、スポーナーが返される前に Lua エラーが発生します。その後、選択したネットワーク ID に対して `network.select` が個別に確認されます。

`http_client` モジュールは、呼び出しごとのオプションにある `overlay_network` キーで同じオーバーレイ選択を受け付けます。

## 継承

オーバーレイの選択は呼び出しスタックを通じて伝播します。`funcs.new():with_options({network=...})` で呼び出された関数は、新しい境界で別のオーバーレイが選択されない限り、内部のダイヤル、ネストされた呼び出し、生成されたプロセスでそのオーバーレイを使用します。空の `network` オプションは「上書きなし」を意味します。継承されたオーバーレイやアプリケーションのデフォルトをクリアすることはありません。

関数呼び出しでは、ネットワークの選択前に、ランタイムオプションが関数エントリの `meta.options` を上書きします。新しい関数またはプロセスの境界では、空でない `options.network` が最初に選択されます。存在しない場合、`network_service.default_network` が設定されていれば選択されます。どちらも存在しない場合は、継承されたフレームの選択が維持されます。選択する ID はすでに登録済みである必要があります。不明な ID を指定すると、ホストネットワークにフォールバックせず、呼び出しまたは生成が失敗します。

周囲から継承した選択は、子孫自身の `network.select` 拒否ルールをバイパスします。Lua の境界で明示的に選択した場合だけがゲートされます。

## アプリケーション設定

オーバーレイドライバーは、`network_service:` ブロックからアプリケーション全体の設定を読み取ります。このブロックは `.wippy.yaml` に配置します。

```yaml
network_service:
  state_dir: .wippy/net          # base dir for driver state (Tailscale keys, etc.)
  default_network: app.net:tailnet  # overlay applied when no call sets one
```

| フィールド | デフォルト | 説明 |
|------------|------------|------|
| `state_dir` | `.wippy/net` | ドライバーの状態ディレクトリ。相対パスはブート設定ディレクトリを基準に解決 |
| `default_network` | — | オプションで独自のネットワークを固定していないタスクまたはプロセスに適用するオーバーレイのレジストリ ID |

## オーバーレイの更新

オーバーレイエントリはレジストリ更新時に置き換えられます。ドライバーは置き換え先を構築してから切り替えます。作成に失敗した場合、既存のオーバーレイは稼働し続けます。置き換えに成功すると、新しい検索に対してアトミックに切り替わり、その後、以前のサービスが閉じられます。そのため、以前のサービスをすでに使用している処理は、その終了を認識する場合があります。

## 権限

| アクション | リソース | 説明 |
|-----------|----------|------|
| `network.select` | ネットワークのレジストリ ID | `funcs.call`、`process.spawn`、`http_client` での明示的なオーバーレイ選択 |
| `network.bind` | ネットワークのレジストリ ID | `http.service` リスナーをオーバーレイ経由でバインド（`network:` フィールド） |
| `process.context` | `context` | `process.with_options(...)` を使用したプロセススポーナーの構築 |

スコープで `network.select` を拒否すると、その中のコードがオーバーレイを明示的に選択できなくなります。継承されたオーバーレイには影響しません。呼び出し元ですでに承認されているためです。`network.bind` は、`network:` オーバーレイを持つサーバーがリスナーを起動するときに確認されます。

## 関連項目

- [セキュリティ](./security.md) - ポリシーとアクター
- [HTTP サービス](../http/server.md) - サーバーのバインド
- [HTTP クライアント](../lua/http/client.md) - 呼び出しごとのオーバーレイ選択
