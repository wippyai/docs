---
title: "インストール"
description: "Wippy runtime をインストールし、command が利用できることを確認します。"
---

# インストール

## インストール :id=install

```bash
curl -fsSL https://hub.wippy.ai/install.sh | bash
```

install script には POSIX shell が必要です。Windows では [hub.wippy.ai/releases](https://hub.wippy.ai/releases) から runtime を download し、`wippy.exe` を `PATH` に配置してください。

## 確認

```bash
wippy version
```

## Dependency metadata の初期化 :id=initialize-dependency-metadata

```bash
# Create a project directory
mkdir myapp
cd myapp

# Create or update wippy.lock
wippy init
```

`wippy init` は dependency lock と、その source および module directory の設定を書き込みます。application source file や registry entry を scaffold するものではありません。[Hello World](tutorials/hello-world.md)に従って実行可能な application を作成し、`wippy run` で起動してください。

runtime には HTTP、SQL、storage、process-hosting capability が含まれます。application で必要になったときに Hub から framework module を追加します。

```bash
wippy add wippy/test
wippy install
```

## コマンド一覧

| コマンド | 説明 |
|---------|------|
| `wippy init` | 新しいプロジェクトを初期化 |
| `wippy run` | ランタイムを起動 |
| `wippy test` | テストエントリポイントを実行 |
| `wippy lint` | コードのエラーをチェック |
| `wippy add` | 依存関係を追加 |
| `wippy install` | 依存関係をインストール |
| `wippy update` | 依存関係を更新 |
| `wippy pack` | スナップショットを作成 |
| `wippy publish` | ハブに公開 |
| `wippy search` | モジュールを検索 |
| `wippy readme` | Hub から module README を取得 |
| `wippy registry` | 読込済み registry entry を調査 |
| `wippy auth` | 認証を管理 |
| `wippy version` | バージョン情報を表示 |

完全な説明は [CLI リファレンス](guides/cli.md)を参照してください。

## トラブルシューティング :id=troubleshooting

install 後に shell が `wippy` を見つけられない場合は shell を開き直し、install directory が `PATH` に含まれていることを確認してください。

## 次のステップ

- [Hello World](../tutorials/hello-world.md) — 最初の application を作成
- [プロジェクト構造](start/structure.md) — project layout を理解
- [CLI リファレンス](guides/cli.md) — すべての command と option を確認
