---
title: "Frontend compliance と publication gate"
description: "normative frontend compliance rule、checker ownership、publication gate、deterministic visual evidence requirement。"
---

# Frontend compliance と publication gate

**分類: normative compliance/evidence reference。** JSON block は checker input の placeholder shape であり、passing evidence や standalone application fixture ではありません。

このページが deterministic checker と publication requirement を所有します。[Portable UI Contract](../portable-ui-contract.md)が underlying rule statement、linked guide が実装詳細を所有します。public `@wippy-fe/*` 0.0.56 は module-compliance CLI を提供しません。repository documentation checker は documentation example と generated catalogue freshness を検証し、module が選択した compliance workflow が次の application-facing check を実装します。

| ルール | 詳細 guide | 決定論的な結果 |
|---|---|---|
| FE-PORT-001 | [Portable UI Contract](../portable-ui-contract.md) | private portability assumption を拒否 |
| FE-UI-001 | 同上 | raw/hand-rolled standard control を拒否 |
| FE-UI-002 | 同上 | affordance analysis 必須 |
| FE-UI-003 | 同上 | sibling contract と alternate-theme evidence 必須 |
| FE-UI-004 | 同上 | control があれば PrimeVue setup 必須 |
| FE-UI-005 | 同上 | invented prop/API を拒否 |
| FE-TW-001 | [Tailwind Contract](./tailwind-contract.md) | selected Wippy preset を解決 |
| FE-TW-002 | 同上 | runtime と記述した compile-time value を拒否 |
| FE-TW-003 | 同上 | invariant classification なしの fixed sibling value を拒否 |
| FE-TW-004 | 同上 | protected mapping override を拒否 |
| FE-TOKEN-001 | [Token Catalogue](./token-catalogue.md) | undeclared `--p-*` reference を拒否 |
| FE-TOKEN-002 | 同上 | inferred/invented token 名を拒否 |
| FE-STYLE-001 | [Theme Authoring](./theming.md) | private facade class と module-local `.p-*` theming を拒否 |
| FE-A11Y-001 | [Portable UI Contract](../portable-ui-contract.md) | invalid/inaccessible custom control を拒否 |

## 必須チェッカーグループ

- PostCSS で token CSS を parse し、generated snapshot を byte-for-byte compare。
- actual Tailwind configuration を resolve し representative utility を compile。
- emitted declaration を runtime variable、compiled constant、arbitrary literal、internal/transient に分類。
- raw control、missing PrimeVue setup、protected override、undeclared token、private facade dependency、contract hash drift を拒否。
- import-map external を complete pinned snapshot と比較。
- build output を registry/served asset と照合。
- `host.setThemeMode()` を使って propagated AppConfig state を検証し、direct theme-class manipulation/internal wire を拒否。
- generated catalogue の provenance、version tuple、source hash を検証。
- copyable example を parse/build し nested interactive content を検査。
- project-bound mode は exactly `UNSUPPORTED`、標準 CI は失敗。

Promptmap は lead を生成できますが、token existence、utility resolution、reachability、deletion の evidence ではありません。

## 生成された公開ゲート

generated token/Tailwind section に pending marker を残せません。新 runtime token には real Wippy CSS consumer、computed-style mutation test、documented portable-consumer purpose が必要です。

runtime evidence は repository 外に置き、次を設定します。

- `WIPPY_THEME_ROOT`: selected `@wippy-fe/theme` package。
- `WIPPY_FE_EVIDENCE_ROOT`: `runtime-acceptance-evidence.json`、`visual-evidence-index.json`、relative scenario manifest、screenshot を含む release evidence directory。
- `WIPPY_FE_RUNTIME_EVIDENCE_SHA256`: exact `runtime-acceptance-evidence.json` byte の lowercase SHA-256。

Wippy Docs root から Node.js 22+ で publication check を実行します。PowerShell:

```powershell
$env:FRONTEND_DOCS_PUBLICATION = '1'
node scripts/check-frontend-docs.mjs
Remove-Item Env:FRONTEND_DOCS_PUBLICATION
```

POSIX shell:

```sh
FRONTEND_DOCS_PUBLICATION=1 node scripts/check-frontend-docs.mjs
```

checker は selected theme の canonical acceptance checker を evidence path/hash 付きで呼び、visual evidence を validate/recompute します。通常の freshness check は local release evidence を必要としません。

## 決定論的なビジュアル検証

appearance change の影響を受ける全 component は scenario manifest と immutable before/after/diff evidence を持ちます。baseline/candidate は同じ browser build、DPR、font、fixture data、theme、viewport、reduced motion、settling rule を使います。light/dark、interaction、overlay、disabled/error、product が support する desktop layout を capture し、desktop-only product に narrow/mobile requirement を発明しません。

各 scenario は component crop と surrounding context、overlay/overflow/page layout 影響時は full page も capture します。component index は complete applicable matrix と scenario manifest を宣言します。

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

checker は applicability cross-product を展開し、theme/viewport/state に unique scenario がなければ失敗します。`overlay: true` では各 scenario に `full-page` scope も必要です。final build commit/hash は全 scenario candidate と一致し `recapturedAfterBuild` は true でなければなりません。

各 scenario manifest は filename を信用せず hash を記録します。

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

値は required shape で有効な evidence ではありません。changed component/state に scenario がない、required scope/image/hash がない、build が stale、unexpected console error/temporary fixture code が残る、reviewed design waiver なしで tolerance 超過、のいずれかで publication は失敗します。waiver は exact changed pixel、design reason、reviewer、scenario を記録し、missing capture、console error、fixture cleanup は免除できません。
