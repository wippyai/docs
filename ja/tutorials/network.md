---
title: "ネットワークオーバーレイ"
description: "アウトバウンドHTTPコールと生成したプロセスをSOCKS5経由でルーティングし、部分的なTailscale統合も確認します。"
---

# ネットワークオーバーレイ

アウトバウンドHTTPコール用のSOCKS5オーバーレイを構成し、継承、インバウンドリスナー、アプリケーション既定値、権限を確認します。

**分類:** 実行可能なSOCKS5チュートリアルと、部分的なTailscaleレシピです。
外部Torリスナーを利用できれば、direct/Torプローブは完全に実行できます。Tailscaleセクションは
Wippy側の配線を説明しますが、アカウントのプロビジョニングはTailscale側に委ねます。
I2Pの設定は、後述のネットワークシステムリファレンスを参照してください。

## 概要

Wippyはオーバーレイネットワークをレジストリエントリとして表現します。コードは呼び出し用のオーバーレイを選択でき、
子孫が上書きするまでその選択がネストした呼び出しへ伝播します。

Wippyは3種類のオーバーレイエントリをサポートします：

- `network.socks5` — 汎用SOCKS5プロキシ（TorのSOCKS5リスナーにも使用可）
- `network.tailscale` — tsnetオーバーレイノード
- `network.i2p` — I2P SAM v3ブリッジ

## 前提条件

- Wippyランタイム`v0.3.32a`。
- `curl`と`api.ipify.org`へのアウトバウンドHTTPSアクセス。
- `127.0.0.1:9050`でSOCKS5を公開するTorデーモン。[Tor Projectのダウンロードページ](https://www.torproject.org/download/tor/)から
  対応パッケージをインストールして起動し、Wippyを実行する前にリスナーを確認します：

  ```bash
  curl --socks5-hostname 127.0.0.1:9050 https://api.ipify.org?format=json
  ```

  成功するとIPアドレスを含むJSONが返ります。Tor Browserは一般にポート9150を使用します。
  意図してそのリスナーを使う場合は、レジストリエントリと検証コマンドを同時に変更してください。
- 空の作業ディレクトリ：

  ```bash
  mkdir netdemo
  cd netdemo
  mkdir src
  ```

## プロジェクト構造

```
netdemo/
├── wippy.lock
└── src/
    ├── _index.yaml
    └── probe.lua
```

## ステップ1: オーバーレイを定義する

`src/_index.yaml`を作成：

```yaml
version: "1.0"
namespace: app

entries:
  - name: probe_policy
    kind: security.policy
    policy:
      actions:
        - http_client.request
        - network.select
      resources: "*"
      effect: allow

  - name: processes
    kind: process.host
    lifecycle:
      auto_start: true

  - name: terminal
    kind: terminal.host
    lifecycle:
      auto_start: true

  # SOCKS5 proxy entry (Tor exposes one at 127.0.0.1:9050 by default)
  - name: tor
    kind: network.socks5
    host: 127.0.0.1
    port: 9050
    isolate_streams: true

  - name: probe
    kind: process.lua
    meta:
      command:
        name: probe
        short: Check outbound IP through overlays
        security:
          actor:
            id: app:probe
          policies:
            - app:probe_policy
    source: file://probe.lua
    method: main
    modules:
      - io
      - http_client
      - json
```

`isolate_streams: true`を指定すると、SOCKS5ドライバーが接続ごとにランダムなクレデンシャルを生成し、Torが各ダイアルで新しいサーキットを開きます。

## ステップ2: アウトバウンドコールをルーティングする

`src/probe.lua`を作成：

```lua
local io = require("io")
local http_client = require("http_client")
local json = require("json")

local function fetch_ip(overlay)
    local options = { timeout = "15s" }
    if overlay then
        options.overlay_network = overlay
    end

    local resp, err = http_client.get("https://api.ipify.org?format=json", options)
    if err then
        return nil, tostring(err)
    end
    if resp.status_code ~= 200 then
        return nil, "HTTP " .. resp.status_code
    end

    local body = json.decode(resp.body or "")
    return body and body.ip, nil
end

local function main()
    local direct, d_err = fetch_ip(nil)
    if d_err then
        io.print("direct failed: " .. d_err)
    else
        io.print("direct IP: " .. direct)
    end

    local routed, r_err = fetch_ip("app:tor")
    if r_err then
        io.print("tor failed: " .. r_err)
    else
        io.print("tor IP:    " .. routed)
    end

    return 0
end

return { main = main }
```

`http_client`の`overlay_network`オプションは、その呼び出しのみにオーバーレイを適用します。指定しない場合、ダイアルはプロセスデフォルト（`.wippy.yaml`の`network_service.default_network`またはダイレクト）を使用します。

## ステップ3: 実行する

```bash
wippy init
wippy run probe
```

Torがローカルで動作している場合：

```
direct IP: <your public IP>
tor IP:    <Tor exit IP>
```

Torが動作していない場合、`tor IP`行にダイアルエラーが報告されます — SOCKS5オーバーレイはダイレクト接続に静かにフォールバックしません。

## 継承

オーバーレイの選択はネストされた呼び出しを通じて伝播します。`funcs.call`または`process.spawn`の境界で一度オーバーレイを指定すれば、その下のすべての内部HTTPコール、ネストされた`funcs.call`、および`process.spawn`は明示的なオーバーライドがあるまでそれを使用します：

```lua
local funcs = require("funcs")

local result, err = funcs.new()
    :with_options({ network = "app:tor" })
    :call("app:scrape_site", url)
```

```lua
local pid, err = process.with_options({ network = "app:tor" })
    :spawn_monitored("app.workers:probe", "app:processes")
```

ネストされた関数またはスポーンされたプロセスは、明示的に渡さなくても、すべてのアウトバウンドダイアルでオーバーレイを使用します。

## リスナーのバインド

TailscaleはHTTPリスナーも受け付けられます。クライアントではなく`http.service`にオーバーレイを付与します：

```yaml
  - name: tailnet
    kind: network.tailscale
    hostname: wippy-node
    auth_key_env: TS_AUTHKEY
    ephemeral: true

  - name: gateway
    kind: http.service
    addr: ":8080"
    network: app:tailnet
    lifecycle:
      auto_start: true
```

サーバーはtailnetインターフェースにバインドし、クライアントはTailscaleアドレス経由でアクセスします。SOCKS5はアウトバウンド専用です — `http.service`に割り当てると拒否されます。

## アプリ全体のデフォルト

`.wippy.yaml`にデフォルトオーバーレイを設定すると、オーバーライドされない限りすべての呼び出しで使用されます：

```yaml
network_service:
  state_dir: .wippy/net
  default_network: app:tor
```

`network = nil`による明示的な選択で、その呼び出しのデフォルトをクリアできます。

## パーミッション

`network.select`アクションが明示的なオーバーレイ選択を制御します。スコープで拒否するとコードがオーバーレイを選択できなくなります：

```yaml
  - name: deny_network
    kind: security.policy
    policy:
      actions: "network.select"
      resources: "*"
      effect: deny
    groups:
      - untrusted
```

継承されたオーバーレイはこのチェックをバイパスします — 呼び出し元の境界で認可済みです。Lua境界での明示的な再選択のみが制御されます。

## トラブルシューティングとクリーンアップ

- `127.0.0.1:9050`で`connection refused`になる場合は、設定したポートでTorがリッスンしていません。
  Wippyを調べる前に、前提条件の`curl`コマンドでTorを確認してください。
- 直接リクエストが失敗しルーティングしたリクエストが成功する場合、通常はローカルDNS、プロキシ、
  ファイアウォールの規則が直接経路に影響しています。2つの呼び出しは独立しています。
- ルーティングした呼び出しの`access denied`は、コマンドのセキュリティコンテキストに`app:tor`への
  `network.select`がないことを示します。`meta.command.security`配下に`app:probe_policy`を付けたままにしてください。
- SOCKS5ドライバーは直接接続へフォールバックしません。デモを続行させるためだけにエラーを削除しないでください。
- Wippyコマンドが終了したら停止し、このチュートリアル専用にTorを起動した場合だけTorも停止してください。
  SOCKS5の例は永続的なネットワーク状態を作りません。Tailscaleエントリは`.wippy/net/tailscale/`にノード状態を
  保存する場合があります。Wippyを停止し、ローカルのtailnet IDを破棄する意図がある場合だけ`.wippy/net`を削除してください。

## 次のステップ

- [ネットワークシステム](../system/network.md) — エントリ種別リファレンス
- [HTTPクライアント](../lua/http/client.md) — 呼び出しごとのオーバーレイオプション
- [セキュリティモデル](../system/security.md) — ポリシーとスコープ
- [認証](auth.md) — トークンベースのセキュリティ
