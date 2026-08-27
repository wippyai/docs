---
title: "Custom composite"
description: "必要な affordance を PrimeVue で提供できない control に対する contract-first exception。"
---

# Custom composite

**分類: normative exception-contract reference。** JSON block は placeholder を含む schema example で、有効な contract/evidence bundle ではありません。

custom control は例外であり、別の component library ではありません。

## Admission test

custom control が認められるのは次をすべて満たす場合だけです。

1. PrimeVue の提供・composition では意図する semantics、interaction、affordance を実現できない。
2. rejected PrimeVue composition を記録する。
3. exact generated PrimeVue sibling contract と contract hash を指定する。
4. sibling contract が `shared-runtime` に分類する全 property に exact source mapping がある。
5. fixed utility は sibling contract がその exact property を `platform-invariant` と分類した場合だけ許可する。
6. novel geometry/behavior を分離し文書化する。
7. accessibility と visual evidence が pass する。

data-shape equivalence は affordance equivalence ではありません。3 値の `SelectButton` が sliding three-position toggle と同じ見た目・動作とは限りません。逆に `ToggleSwitch` に `positions` prop を発明してはいけません。本当に affordance requirement がある場合だけ reviewed custom sibling を作ります。

## Module contract

reviewed exception を module-root `wippy-fe.contract.json` に保存します。

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

値は schema placeholder であり有効な evidence ではありません。complete mapping は selected sibling contract から生成し、1 row の抜粋だけでは有効な exception になりません。tooling が source/contract hash を生成し、いずれかが変われば review は無効です。

このページは normative field を定義しますが JSON Schema ではありません。documentation checker が証明するのは example が required shape を保つことだけです。module compliance implementation は real contract を selected theme manifest に対して検証し、hash と complete property set を確認し、全 evidence reference が同じ candidate build の named passing result/capture に解決することを確認します。public `@wippy-fe/*` 0.0.56 は module-compliance CLI を提供しません。

accessibility evidence は component `sourceSha256`、hashed file、unexpected console error 0 件、passed result を bind します。visual evidence は canonical before/after/diff file、hash、再計算 metric/disposition、matching candidate build を bind します。string、missing file/scenario/result/capture、stale build hash、`pending`、unreviewed result は evidence requirement を満たしません。

`platformInvariantUtilities` と `moduleLocalProperties` は空でも構いません。field を埋めるために `gap-2`、`w-10`、`rounded-md` 等を発明しないでください。特に ToggleSwitch sibling の width、height、radius、focus geometry、motion が `shared-runtime` なら invariant に再分類できません。

sibling manifest の分類:

- `shared-runtime`: 全 custom sibling が published token または runtime-backed semantic utility を map/consume する。
- `platform-invariant`: fixed value はこの exact property にだけ許可。
- `implementation-private`: internal PrimeVue mechanic は custom sibling requirement にならない。

必要な runtime semantic がなければ shared theme contract を先に修正します。現在の sibling dimension を copy したり token 名を発明したりしません。

`sharedAppearanceMappings` は illustrative ではなく exhaustive です。selected sibling contract の全 `shared-runtime` property に exactly one mapping を持ち、追加 property ID はなく、contract part、stable module selector、exact published source kind/name を記録します。selected compliance implementation は selector、part、CSS property、published source を使い PostCSS で structural proof を行います。comment や無関係 selector の token 名は数えません。

Tailwind-backed mapping は unique/exact `utilityClasses` も記録し、normalize 後の set が sibling contract source set と一致する必要があります。`platformInvariantUtilities` は sibling source と同じ utility の `{ "contractProperty": "...", "utility": "..." }` record、nonempty `moduleLocalProperties` は free-form CSS bag ではなく structured property ID と review reason を持ちます。

single exception のために shared `@wippy-fe/ui` package は作りません。2 番目の independent consumer が同じ behavior/portability requirement を証明した後にだけ promotion 対象になります。
