---
title: "自定义复合控件"
description: "针对 PrimeVue 无法提供所需可供性的控件的契约优先例外机制。"
---

# 自定义复合控件

自定义控件是例外，而不是一套替代的组件库。

## 准入判据

只有满足以下全部条件，自定义控件才会被接受：

1. PrimeVue 无法提供或组合出预期的语义、交互和可供性。
2. 该例外记录了被否决的 PrimeVue 组合方案。
3. 它指明了确切的、生成的 PrimeVue 同级契约及契约哈希。
4. 该同级契约归类为 `shared-runtime` 的每个属性都有确切的来源映射。
5. 只有当同级契约把该确切属性归类为 `platform-invariant` 时，固定实用类才被接受。
6. 新颖的几何形状和行为被隔离并有文档记载。
7. 无障碍与视觉证据通过。

数据形状等价并不等于可供性等价。多选项的 `SelectButton` 可以表示三个值，但它的外观和行为都不像一个可滑动的三档开关。反过来，也不要为 `ToggleSwitch` 臆造一个 `positions` prop。只有当可供性需求真实存在时，才构建一个经过评审的自定义同级控件。

## 模块契约

把经过评审的例外保存在模块根目录的 `wippy-fe.contract.json` 中：

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

上面展示的值是 schema 占位符，而不是有效证据。完整的映射由所选同级契约生成；单行摘录本身不构成有效的例外。工具会生成源哈希和契约哈希。源哈希或同级契约哈希发生变化会使评审失效。

本页定义规范字段；它不是 JSON Schema，文档检查器只验证该示例保持了必需的结构。`wippy-fe-compliance` 会用所选主题清单校验真实的模块契约，验证哈希和完整的属性集合，并检查每个证据引用都能解析到来自同一候选构建的、指定名称的通过结果或捕获。无障碍证据绑定组件的 `sourceSha256`、经哈希的文件、零意外控制台错误，以及一个通过的结果。视觉证据绑定标准的变更前／变更后／差异文件、哈希、重新计算的指标和判定，以及匹配的候选构建。字符串、缺失文件、缺失的场景／结果／捕获、过期的构建哈希、`pending` 或未经评审的结果，都不满足证据要求。

`platformInvariantUtilities` 和 `moduleLocalProperties` 可以为空。绝不要仅仅为了让契约字段非空而臆造 `gap-2`、`w-10`、`rounded-md` 或其他固定实用类。特别是，当 ToggleSwitch 同级控件所选的同级契约把宽度、高度、圆角、焦点几何或动效归类为 `shared-runtime` 时，它不能把这些属性重新标注为不变量。

同级清单把属性归为以下几类：

- `shared-runtime`：每个自定义同级控件都要映射并消费已发布的 token 或由运行时支撑的语义实用类。
- `platform-invariant`：仅对这一确切属性允许使用固定值。
- `implementation-private`：PrimeVue 内部机制不会成为自定义同级控件的要求。

如果所需的运行时语义不存在，请先修正共享主题契约。绝不要照抄当前同级控件的尺寸，也不要臆造 token 名称。

`sharedAppearanceMappings` 是穷尽的，而非示意性的：它为所选同级契约中的每个 `shared-runtime` 属性恰好包含一条映射，不含额外的属性 ID，并包含契约部件、稳定的模块选择器，以及确切的已发布来源种类和名称。合规工具使用选择器、部件、CSS 属性和已发布来源，通过 PostCSS 从结构上证明该映射；注释或无关选择器中的 token 名称不算数。基于 Tailwind 的映射还要记录唯一且确切的 `utilityClasses`；归一化之后，该集合必须与所选同级契约的来源集合相等。`platformInvariantUtilities` 包含 `{ "contractProperty": "...", "utility": "..." }` 形式的记录，其 utility 等于所选同级契约的来源。`moduleLocalProperties` 非空时，包含结构化的属性 ID 和评审理由，而不是自由形式的 CSS 集合。

不会为单个例外创建共享的 `@wippy-fe/ui` 包。只有当第二个独立消费方证明了同样的行为和可移植性需求之后，才具备提升条件。
