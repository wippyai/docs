# インストール

## クイックインストール

```bash
curl -fsSL https://hub.wippy.ai/install.sh | bash
```

または[hub.wippy.ai/releases](https://hub.wippy.ai/releases)から直接ダウンロードできます。

## 確認

```bash
wippy version
```

## クイックスタート

```bash
# 新しいプロジェクトを作成
mkdir myapp && cd myapp
wippy init

# 依存関係を追加
wippy add wippy/http
wippy install

# 実行
wippy run
```

## コマンド一覧

| コマンド | 説明 |
|---------|------|
| `wippy init` | 新しいプロジェクトを初期化 |
| `wippy run` | ランタイムを起動 |
| `wippy lint` | コードのエラーをチェック |
| `wippy add` | 依存関係を追加 |
| `wippy install` | 依存関係をインストール |
| `wippy update` | 依存関係を更新 |
| `wippy pack` | スナップショットを作成 |
| `wippy publish` | ハブに公開 |
| `wippy search` | モジュールを検索 |
| `wippy auth` | 認証を管理 |
| `wippy version` | バージョン情報を表示 |

完全なドキュメントは[CLIリファレンス](guides/cli.md)を参照してください。

## 次のステップ

- [Hello World](tutorials/hello-world.md) - 最初のプロジェクトを作成
- [プロジェクト構造](start/structure.md) - レイアウトを理解する
- [CLIリファレンス](guides/cli.md) - すべてのコマンドとオプション
