---
title: "設定とケーシング"
description: "バックエンドファサード、レジストリ、フロントエンド設定の各境界におけるケーシング規則。"
---

# 設定とケーシング

ケーシングはスキーマ境界に従います。設定オブジェクトを再帰的に変換してはいけません。

| 境界 | 規則 | 例 |
|---|---|---|
| バックエンドファサードの requirement 名 | トップレベルは `lower_case_with_underscore` | `custom_css`, `css_variables` |
| レジストリフィールド | 各フィールドはドキュメント化されたレジストリスキーマに従う | `base_path`, `entry_point`, `tag_name` |
| バックエンドYAMLが運ぶネストされたフロントエンド設定 | 小文字始まりのcamelCaseを保持 | `customCSS`, `themeConfig`, `iconifyIcons` |
| フロントエンドの AppConfig とパッケージメタデータ | 小文字始まりのcamelCase | `configOverrides`, `hostCssKeys` |

```yaml
config_overrides:
  customization:
    customCSS: ""
    cssVariables: {}
  routePrefix: /admin

proxy:
  injections:
    css:
      themeConfig: true
      customCss: true
      iframe: true
```

この例でスネークケースなのはバックエンドのラッパーキーだけです。ネストされたフロントエンドオブジェクトはそのまま渡され、定義されたケーシングを保持します。

## 一時的な mountRoute の例外

`meta.mountRoute` は現在のバックエンド互換性上のバグです。意図されているバックエンドのフィールドは `meta.mount_route` ですが、バックエンドの修正が出荷されるまで既存のデプロイでは `mountRoute` が必要です。これは1つの明示的な例外として扱い、レジストリやバックエンドのフィールドが一般にcamelCaseである証拠とは見なさないでください。

コンプライアンス上、この例外はバージョン管理し、バックエンドスキーマが変更された時点で削除できるようにする必要があります。

## UI policy in 1.0.62

Web Host 1.0.62 は次のチャット設定を子アプリケーションと共有します。`hostConfig` は Web Host ラッパー専用であり、子へのデータには含まれません。管理レイアウトには標準のチャットがありません。子として動作するアプリは、トップレベルの設定またはパッケージの上書きを使用します。

[UI policy, precedence, and compatibility](../web-host/bootstrap.md#ui-policy-in-1062)
