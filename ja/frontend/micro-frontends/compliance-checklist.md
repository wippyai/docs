---
title: "フロントエンドコンプライアンスルール索引"
description: "正典のフロントエンドルールと決定的なチェッカーの所有関係を簡潔にまとめた索引。"
---

# フロントエンドコンプライアンスルール索引

このページは索引であり、契約のもう1つの写しではありません。規範的なルールの記述は [可搬 UI 契約](../portable-ui-contract.md) が所有します。以下のリンクは詳細な実装ガイダンスを提供します。

| ルール | 詳細なガイダンス | 決定的な結果 |
|---|---|---|
| FE-PORT-001 | [可搬 UI 契約](../portable-ui-contract.md) | 私有の可搬性前提を拒否する |
| FE-UI-001 | [可搬 UI 契約](../portable-ui-contract.md) | 生の、または手書きの標準コントロールを拒否する |
| FE-UI-002 | [可搬 UI 契約](../portable-ui-contract.md) | アフォーダンス分析を要求する |
| FE-UI-003 | [可搬 UI 契約](../portable-ui-contract.md) | 兄弟契約と代替テーマの証跡を要求する |
| FE-UI-004 | [可搬 UI 契約](../portable-ui-contract.md) | コントロールが存在する場合に PrimeVue のセットアップを要求する |
| FE-UI-005 | [可搬 UI 契約](../portable-ui-contract.md) | 発明された props と API を拒否する |
| FE-TW-001 | [Tailwind 契約](./tailwind-contract.md) | 選択された Wippy プリセットを解決する |
| FE-TW-002 | [Tailwind 契約](./tailwind-contract.md) | ランタイムとして文書化されたコンパイル時の値を拒否する |
| FE-TW-003 | [Tailwind 契約](./tailwind-contract.md) | 不変性の分類がない固定の兄弟値を拒否する |
| FE-TW-004 | [Tailwind 契約](./tailwind-contract.md) | 保護されたマッピングのオーバーライドを拒否する |
| FE-TOKEN-001 | [トークンカタログ](./token-catalogue.md) | 未宣言の `--p-*` 参照を拒否する |
| FE-TOKEN-002 | [トークンカタログ](./token-catalogue.md) | 推測または発明されたトークン名を拒否する |
| FE-STYLE-001 | [テーマの記述](./theming.md) | 私有のファサードクラスとモジュールローカルな `.p-*` のテーミングを拒否する |
| FE-A11Y-001 | [可搬 UI 契約](../portable-ui-contract.md) | 妥当でない、またはアクセシブルでないカスタムコントロールを拒否する |

## 必要なチェッカーのグループ

- トークン CSS を PostCSS でパースし、生成されたトークンのスナップショットをバイト単位で比較する。
- 実際の Tailwind 設定を解決し、代表的なユーティリティをコンパイルする。
- 出力された宣言を、ランタイム変数、コンパイル済み定数、任意リテラル、内部／一時のいずれかに分類する。
- 生のコントロール、PrimeVue セットアップの欠落、保護されたマッピングのオーバーライド、未宣言のトークン、私有ファサードへの依存、契約ハッシュのずれを拒否する。
- インポートマップの externals を、ピン留めされた完全なスナップショットと比較する。
- ビルド出力を、設定されたレジストリおよび配信されるアセットと照合する。
- テーマ切り替えは `host.setThemeMode()` を使用し、伝播された AppConfig の状態を検証する。テーマクラスの直接操作と内部のプロキシ配線は拒否する。
- 生成されたカタログについて、出所、バージョンのタプル、ソースのハッシュを確認する。
- コピー可能なサンプルをパースし、該当する場合はビルドし、ネストしたインタラクティブコンテンツがないか確認する。
- プロジェクト固定モードは正確に `UNSUPPORTED` を返し、標準の CI は失敗する。

Promptmap は手がかりを生成することがあります。トークンの存在、ユーティリティの解決、到達可能性、削除の証拠にはなりません。

## 生成物の公開ゲート

生成されたトークンおよび Tailwind のセクションは、公開時に pending マーカーを含んでいてはなりません。新しいランタイムトークンにはいずれも、実在する Wippy の CSS コンシューマー、計算済みスタイルの変異テスト、そして文書化された可搬コンシューマー向けの目的が必要です。

公開ではランタイムの証跡をリポジトリの外に置きます。次を設定してください。

- `WIPPY_THEME_ROOT` — 選択した `@wippy-fe/theme` パッケージ。
- `WIPPY_FE_EVIDENCE_ROOT` — `runtime-acceptance-evidence.json`、`visual-evidence-index.json`、それらの相対シナリオマニフェスト、スクリーンショットを含むリリース証跡ディレクトリ。
- `WIPPY_FE_RUNTIME_EVIDENCE_SHA256` — `runtime-acceptance-evidence.json` の正確なバイト列に対する小文字の SHA-256。

`FRONTEND_DOCS_PUBLICATION=1 node scripts/check-frontend-docs.mjs` は、選択したテーマの正典の受け入れチェッカーをその証跡パスとハッシュ付きで呼び出し、続いてビジュアル証跡を検証・再計算します。通常のドキュメント鮮度チェックでは、ローカルのリリース証跡は不要です。

## 決定的なビジュアル検証

外観の変更に影響を受けるすべてのコンポーネントには、シナリオマニフェストと、変更不可の before/after/diff の証跡があります。ベースラインと候補は、同じブラウザービルド、デバイスピクセル比、フォント、フィクスチャデータ、テーマ、ビューポート、モーション低減設定、安定化ルールを使用します。ライトとダークのテーマ、インタラクション状態、オーバーレイ、無効／エラー状態、そしてプロダクトがサポートするデスクトップレイアウトを含め、該当するすべての状態をキャプチャしてください。デスクトップ専用のプロダクトに対して、狭幅／モバイルの要件を勝手に作らないでください。

各シナリオは、コンポーネントの切り抜きと、その周囲のアプリケーションコンテキストをキャプチャします。オーバーレイ、オーバーフロー、ページレイアウトが影響を受けうる場合はページ全体もキャプチャします。コンポーネントの索引は、該当するマトリクス全体を宣言し、シナリオごとに1つの変更不可なマニフェストを指します。

```json
{
  "schemaVersion": "1.0.0",
  "componentId": "module.component",
  "applicability": {
    "themes": ["light", "dark"],
    "viewports": [{ "id": "desktop", "width": 1440, "height": 900 }],
    "states": ["default"],
    "overlay": false
  },
  "finalBuild": {
    "candidateCommit": "generated-candidate-commit",
    "candidateBuildHash": "sha256:generated-candidate-build-hash",
    "recapturedAfterBuild": true
  },
  "scenarios": [
    {
      "scenarioId": "module.component.light.default",
      "theme": "light",
      "viewport": "desktop",
      "state": "default",
      "manifest": "scenarios/module.component.light.default.json"
    },
    {
      "scenarioId": "module.component.dark.default",
      "theme": "dark",
      "viewport": "desktop",
      "state": "default",
      "manifest": "scenarios/module.component.dark.default.json"
    }
  ]
}
```

チェッカーは applicability の直積を展開し、宣言されたテーマ、ビューポート、状態のいずれかに固有のシナリオがなければ失敗します。`overlay` が true の場合、すべてのシナリオに `full-page` のキャプチャスコープも必要です。最終ビルドのコミットとハッシュは、すべてのシナリオの候補と一致していなければならず、`recapturedAfterBuild` は true でなければなりません。

各シナリオのマニフェストは、ファイル名を信頼するのではなくハッシュを記録します。

```json
{
  "schemaVersion": "1.0.0",
  "scenarioId": "module.component.light.default",
  "componentId": "module.component",
  "state": {
    "theme": "light",
    "viewport": { "width": 1440, "height": 900 },
    "interaction": "default"
  },
  "runtime": {
    "browserVersion": "pinned-browser-version",
    "devicePixelRatio": 1,
    "fontsHash": "sha256:generated-font-set-hash",
    "fixtureHash": "sha256:generated-fixture-hash"
  },
  "baseline": {
    "commit": "generated-baseline-commit",
    "buildHash": "sha256:generated-baseline-build-hash"
  },
  "candidate": {
    "commit": "generated-candidate-commit",
    "buildHash": "sha256:generated-candidate-build-hash",
    "recapturedAfterBuild": true
  },
  "requiredScopes": ["component", "context"],
  "captures": [
    {
      "scope": "component",
      "before": {
        "artifactId": "component-before",
        "path": "screenshots/component-before.png",
        "sha256": "sha256:generated-before-hash"
      },
      "after": {
        "artifactId": "component-after",
        "path": "screenshots/component-after.png",
        "sha256": "sha256:generated-after-hash"
      },
      "diff": {
        "artifactId": "component-diff",
        "path": "screenshots/component-diff.png",
        "sha256": "sha256:generated-diff-hash"
      }
    },
    {
      "scope": "context",
      "before": {
        "artifactId": "context-before",
        "path": "screenshots/context-before.png",
        "sha256": "sha256:generated-before-hash"
      },
      "after": {
        "artifactId": "context-after",
        "path": "screenshots/context-after.png",
        "sha256": "sha256:generated-after-hash"
      },
      "diff": {
        "artifactId": "context-diff",
        "path": "screenshots/context-diff.png",
        "sha256": "sha256:generated-diff-hash"
      }
    }
  ],
  "diff": {
    "changedPixels": 0,
    "totalPixels": 1296000,
    "changedRatio": 0,
    "pixelDeltaThreshold": 8,
    "changedRatioThreshold": 0.001,
    "disposition": "within-threshold",
    "result": "passed",
    "waiver": null
  },
  "console": { "unexpectedErrors": [] },
  "fixtureCleanup": { "temporaryArtifactsRemaining": [], "verified": true }
}
```

上記の値は必要な形を示すものであり、妥当な証跡ではありません。変更されたコンポーネントや必須の状態にシナリオがない、必要なキャプチャスコープが欠けている、参照された画像やハッシュが存在しない、ビルドが古い、想定外のコンソールエラーが残っている、一時的なフィクスチャコードが残っている、あるいはレビュー済みのデザイン免除なしに diff が許容量を超えている場合、公開は失敗します。免除は、変更されたピクセル数、デザイン上の理由、レビュアー、影響を受けるシナリオを正確に記録します。キャプチャの欠落、コンソールエラー、フィクスチャの後片付けを免除することはできません。
