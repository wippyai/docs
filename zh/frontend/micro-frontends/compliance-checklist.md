---
title: "前端合规规则索引"
description: "标准前端规则及确定性检查器归属的简明索引。"
---

# 前端合规规则索引

本页是索引，而不是契约的第二份副本。[可移植 UI 契约](../portable-ui-contract.md)拥有规范性的规则陈述；下面的链接提供详细的实现指引。

| 规则 | 详细指引 | 确定性结果 |
|---|---|---|
| FE-PORT-001 | [可移植 UI 契约](../portable-ui-contract.md) | 拒绝私有可移植性假设 |
| FE-UI-001 | [可移植 UI 契约](../portable-ui-contract.md) | 拒绝原生或手写的标准控件 |
| FE-UI-002 | [可移植 UI 契约](../portable-ui-contract.md) | 要求可供性分析 |
| FE-UI-003 | [可移植 UI 契约](../portable-ui-contract.md) | 要求同级契约与备选主题证据 |
| FE-UI-004 | [可移植 UI 契约](../portable-ui-contract.md) | 存在控件时要求 PrimeVue 配置 |
| FE-UI-005 | [可移植 UI 契约](../portable-ui-contract.md) | 拒绝臆造的 props 和 API |
| FE-TW-001 | [Tailwind 契约](./tailwind-contract.md) | 解析所选的 Wippy preset |
| FE-TW-002 | [Tailwind 契约](./tailwind-contract.md) | 拒绝被记为运行时值的编译期值 |
| FE-TW-003 | [Tailwind 契约](./tailwind-contract.md) | 拒绝未做不变量归类的固定同级值 |
| FE-TW-004 | [Tailwind 契约](./tailwind-contract.md) | 拒绝对受保护映射的覆盖 |
| FE-TOKEN-001 | [Token 目录](./token-catalogue.md) | 拒绝未声明的 `--p-*` 引用 |
| FE-TOKEN-002 | [Token 目录](./token-catalogue.md) | 拒绝推断或臆造的 token 名称 |
| FE-STYLE-001 | [主题编写](./theming.md) | 拒绝私有 facade 类和模块本地的 `.p-*` 主题化 |
| FE-A11Y-001 | [可移植 UI 契约](../portable-ui-contract.md) | 拒绝无效或不可访问的自定义控件 |

## 必需的检查器组

- 用 PostCSS 解析 token CSS；逐字节比对生成的 token 快照。
- 解析实际的 Tailwind 配置并编译具代表性的实用类。
- 把发出的声明归类为运行时变量、编译期常量、任意字面量，或内部／临时值。
- 拒绝原生控件、缺失的 PrimeVue 配置、对受保护映射的覆盖、未声明的 token、私有 facade 依赖，以及契约哈希漂移。
- 把 import map 的 externals 与完整的固定快照比对。
- 对照所配置的注册表条目和实际提供的资源检查构建产物。
- 主题切换使用 `host.setThemeMode()` 并验证传播后的 AppConfig 状态；直接操作主题类和内部 proxy 线路会被拒绝。
- 检查生成目录的来源、版本元组和源哈希。
- 解析可复制示例，在适用时构建它们，并检查是否存在嵌套的交互内容。
- 项目绑定模式返回的正是 `UNSUPPORTED`，且标准 CI 失败。

Promptmap 可以提供线索。它不能作为 token 存在性、实用类解析、可达性或删除的证据。

## 生成内容的发布关卡

发布时，生成的 token 与 Tailwind 章节中不得包含 pending 标记。每个新的运行时 token 都需要一个真实的 Wippy CSS 消费方、一项计算样式变更测试，以及一个有文档记载的可移植消费方用途。

发布把运行时证据保存在仓库之外。请设置：

- `WIPPY_THEME_ROOT` 指向所选的 `@wippy-fe/theme` 包。
- `WIPPY_FE_EVIDENCE_ROOT` 指向发布证据目录，其中包含
  `runtime-acceptance-evidence.json`、`visual-evidence-index.json`、它们的相对场景清单以及截图。
- `WIPPY_FE_RUNTIME_EVIDENCE_SHA256` 设为
  `runtime-acceptance-evidence.json` 确切字节的小写 SHA-256。

`FRONTEND_DOCS_PUBLICATION=1 node scripts/check-frontend-docs.mjs` 会以该证据路径和哈希调用所选主题的标准验收检查器，然后校验并重新计算视觉证据。常规的文档新鲜度检查不需要本地发布证据。

## 确定性视觉验证

每个受外观变更影响的组件都有一份场景清单，以及不可变的变更前／变更后／差异证据。基线与候选使用相同的浏览器构建、设备像素比、字体、fixture 数据、主题、视口、reduced motion 设置和稳定判定规则。捕获所有适用状态，包括浅色与深色主题、交互状态、浮层、禁用／错误状态，以及产品所支持的桌面布局。不要为仅面向桌面的产品臆造窄屏／移动端要求。

每个场景捕获组件裁剪图及其周围的应用上下文。当浮层、溢出或页面布局可能受影响时，它还会捕获整页。组件索引声明完整的适用矩阵，并为每个场景指向一份不可变清单：

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

检查器会展开适用性的笛卡尔积，若任何已声明的主题、视口或状态没有唯一场景则失败。当 `overlay` 为 true 时，每个场景还需要 `full-page` 捕获范围。最终构建的 commit 和哈希必须与每个场景的候选一致，且 `recapturedAfterBuild` 必须为 true。

每份场景清单记录哈希，而不是信任文件名：

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

上面的值展示的是必需的结构，而不是有效证据。出现以下情况时发布失败：变更的组件或必需状态没有场景、缺少某个必需的捕获范围、引用的图像或哈希缺失、构建过期、仍有意外的控制台错误、仍残留临时 fixture 代码，或差异超出容差且没有经过评审的设计豁免。豁免需记录确切的变更像素数、设计理由、评审人和受影响的场景；它不能豁免缺失的捕获、控制台错误或 fixture 清理。
