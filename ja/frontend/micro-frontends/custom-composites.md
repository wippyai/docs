---
title: "カスタムコンポジット"
description: "必要とされるアフォーダンスを PrimeVue が提供できないコントロールのための、契約優先の例外。"
---

# カスタムコンポジット

カスタムコントロールは例外であり、代替のコンポーネントライブラリではありません。

## 受け入れテスト

カスタムコントロールが受け入れられるのは、次を満たす場合に限られます。

1. 意図するセマンティクス、インタラクション、アフォーダンスを PrimeVue が提供も合成もできない。
2. 例外に、却下した PrimeVue の合成案が記録されている。
3. 正確に生成された PrimeVue の兄弟契約と契約ハッシュが指定されている。
4. その兄弟契約が `shared-runtime` に分類するすべてのプロパティに、正確なソースマッピングがある。
5. 固定ユーティリティは、その兄弟契約がそのプロパティを正確に `platform-invariant` と分類している場合にのみ受け入れられる。
6. 新規のジオメトリと挙動が分離され、文書化されている。
7. アクセシビリティとビジュアルの証跡が合格する。

データ形状の等価性はアフォーダンスの等価性ではありません。複数選択肢の `SelectButton` は3つの値を表現できますが、スライドする3位置トグルのような見た目でも挙動でもありません。逆に、`ToggleSwitch` に `positions` prop を発明してはいけません。アフォーダンスの要件が実在するときにのみ、レビュー済みのカスタム兄弟を作ってください。

## モジュール契約

レビュー済みの例外は、モジュールルートの `wippy-fe.contract.json` に保存します。

```json
{
  "schemaVersion": "generated-by-selected-contract-tool",
  "exceptions": [
    {
      "id": "module.control.example",
      "source": "src/components/ExampleControl.vue",
      "sourceSha256": "generated-from-source",
      "semanticRole": "documented-role",
      "requiredAffordance": "documented-affordance",
      "rejectedPrimeVueCompositions": [
        {
          "components": ["SelectButton"],
          "reason": "The reviewed sliding affordance cannot be preserved."
        }
      ],
      "visualSibling": {
        "component": "ToggleSwitch",
        "contractId": "primevue.toggleswitch.portable-appearance",
        "contractHash": "generated-from-selected-theme-contract"
      },
      "sharedAppearanceMappings": [
        {
          "contractProperty": "root.width",
          "part": "root",
          "selector": ".example-control",
          "source": {
            "kind": "css-variable",
            "name": "--p-toggleswitch-width"
          }
        }
      ],
      "platformInvariantUtilities": [],
      "moduleLocalProperties": [],
      "accessibilityEvidence": {
        "manifest": ".local/evidence/accessibility-manifest.json",
        "scenarioId": "module.control.example.keyboard",
        "resultId": "module.control.example.keyboard.passed",
        "build": {
          "head": "generated-candidate-commit",
          "trackedFrontendDiffSha256": "generated-diff-hash"
        }
      },
      "visualEvidence": {
        "manifest": ".local/evidence/visual-manifest.json",
        "scenarioId": "module.control.example.light.default",
        "captureId": "module.control.example.light.default.component",
        "build": {
          "head": "generated-candidate-commit",
          "trackedFrontendDiffSha256": "generated-diff-hash"
        }
      }
    }
  ]
}
```

示されている値はスキーマのプレースホルダーであり、妥当な証跡ではありません。完全なマッピングは、選択された兄弟契約から生成されます。1行の抜粋はそれ自体では妥当な例外になりません。ソースと契約のハッシュはツールが生成します。ソースハッシュまたは兄弟契約ハッシュが変わると、レビューは無効になります。

このページは規範的なフィールドを定義するものであって、JSON Schema ではありません。ドキュメントチェッカーは、この例が必要な形を保っていることだけを証明します。`wippy-fe-compliance` は、実際のモジュール契約を選択されたテーマのマニフェストに対して検証し、ハッシュと完全なプロパティ集合を確認し、すべての証跡参照が同じ候補ビルドの、名前で指定された合格結果またはキャプチャへ解決されることを確認します。アクセシビリティの証跡は、コンポーネントの `sourceSha256`、ハッシュ化されたファイル、想定外のコンソールエラーがゼロであること、合格結果を束ねます。ビジュアルの証跡は、正典の before/after/diff ファイル、ハッシュ、再計算されたメトリクスと判定、一致する候補ビルドを束ねます。文字列、欠落したファイル、欠落したシナリオ／結果／キャプチャ、古いビルドハッシュ、`pending`、未レビューの結果は、証跡の要件を満たしません。

`platformInvariantUtilities` と `moduleLocalProperties` は空でもかまいません。契約のフィールドを空でなくするためだけに `gap-2`、`w-10`、`rounded-md` その他の固定ユーティリティを発明しないでください。特に、ToggleSwitch の兄弟は、選択された兄弟契約がそれらのプロパティを `shared-runtime` に分類しているとき、幅、高さ、角丸、フォーカスのジオメトリ、モーションを invariant として付け替えることはできません。

兄弟マニフェストはプロパティを次のように分類します。

- `shared-runtime`: すべてのカスタム兄弟が、公開されたトークンまたはランタイムに裏付けられたセマンティックユーティリティをマッピングし利用する。
- `platform-invariant`: このプロパティに限り、固定値が許可される。
- `implementation-private`: PrimeVue の内部機構は、カスタム兄弟の要件にはならない。

必要なランタイムのセマンティクスが存在しない場合は、まず共有テーマの契約を修正してください。現在の兄弟の寸法をコピーしたり、トークン名を発明したりしてはいけません。

`sharedAppearanceMappings` は例示ではなく網羅的です。選択された兄弟契約のすべての `shared-runtime` プロパティに対してちょうど1つのマッピングを含み、それ以外のプロパティ ID を含まず、契約のパート、安定したモジュールセレクター、公開されたソースの種別と名前を正確に記載します。コンプライアンスツールは、セレクター、パート、CSS プロパティ、公開されたソースを用いて PostCSS で構造的にマッピングを証明します。コメントや無関係なセレクター内のトークン名はカウントされません。Tailwind に裏付けられたマッピングは、一意で正確な `utilityClasses` も記録します。正規化後、その集合は選択された兄弟契約のソース集合と等しくなければなりません。`platformInvariantUtilities` は、ユーティリティが選択された兄弟契約のソースと等しい `{ "contractProperty": "...", "utility": "..." }` レコードを含みます。`moduleLocalProperties` は、空でない場合、自由形式の CSS の寄せ集めではなく、構造化されたプロパティ ID とレビュー理由を含みます。

単一の例外のために共有の `@wippy-fe/ui` パッケージを作ることはありません。昇格が検討可能になるのは、2つ目の独立したコンシューマーが同じ挙動と可搬性の要件を実証してからです。
