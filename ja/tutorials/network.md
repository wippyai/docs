---
title: "ネットワークオーバーレイ"
description: "アウトバウンドHTTPコールとスポーンされたプロセスをSOCKS5、Tailscale、またはI2Pオーバーレイ経由でルーティングします。"
---

# ネットワークオーバーレイ

アウトバウンドHTTPコールとスポーンされたプロセスをSOCKS5、Tailscale、またはI2Pオーバーレイ経由でルーティングします。

## 概要

Wippyは、関数、プロセス、HTTPクライアントからのトラフィックを透過的に運ぶオーバーレイネットワークをサポートします。各オーバーレイはレジストリエントリです。コードは呼び出しごとにオプトインし、子孫が明示的にオーバーライドするまでその選択が内部呼び出しに継承されます。

サポートされるオーバーレイ：

- `network.socks5` — 汎用SOCKS5プロキシ（TorのSOCKS5リスナーにも使用可）
- `network.tailscale` — tsnetオーバーレイノード
- `network.i2p` — I2P SAM v3ブリッジ

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
  - name: processes
    kind: process.host
    lifecycle:
      auto_start: true

  - name: terminal
    kind: terminal.host
    lifecycle:
      auto_start: true

  # SOCKS5プロキシエントリ（Torはデフォルトで127.0.0.1:9050でリッスン）
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
direct IP: 203.0.113.42
tor IP:    185.220.101.61
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

インバウンドトラフィックをサポートするオーバーレイ（Tailscale、I2P）はHTTPリスナーも受け付けられます。クライアントの代わりに`http.service`にオーバーレイを付与します：

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

## 次のステップ

- [ネットワークシステム](system/network.md) - エントリ種別リファレンス
- [HTTPクライアント](lua/http/client.md) - 呼び出しごとのオーバーレイオプション
- [セキュリティモデル](system/security.md) - ポリシーとスコープ
- [認証](tutorials/auth.md) - トークンベースのセキュリティ
