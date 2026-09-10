---
title: "Web 组件范式"
description: "面向纯内容型和带控件型自定义元素的可移植 view.component 范式。"
---

# Web 组件范式

web 组件注册为 `view.component`，通常渲染在 shadow root 中。请选择最小的有效配置。

## 变体 A：纯内容型

图表、示意图、渲染器或可视化组件，在不渲染任何控件且不编写共享 Tailwind 实用类时，可以省略 PrimeVue 和 Tailwind。

它仍然必须：

- 发布有效的自定义元素标签。
- 为所渲染的内容保持无障碍能力。
- 使用受支持的 Wippy 配置和 CSS 交付方式。
- 避免使用项目私有的 facade 类。
- 通过 Wippy 模块仓库的标准 Make 目标构建。

如果日后添加了按钮、输入框、表单、菜单或其他类 PrimeVue 控件，该豁免即告结束。

## 变体 B：带控件型

带控件的组件必须通过 Wippy PrimeVue 插件安装 PrimeVue，并配置所需的 CSS 交付 key。下面的入口是当前包所支持的 Vue 路径：

```ts
import { defineComponent, h } from 'vue'
import Button from 'primevue/button'
import { PrimeVuePlugin } from '@wippy-fe/theme/primevue-plugin'
import {
  WippyVueElement,
  define,
  type WippyElementConfig,
} from '@wippy-fe/webcomponent-vue'
import pkg from '../package.json'

const Root = defineComponent({
  name: 'ExampleControlsRoot',
  setup() {
    return () => h(Button, { label: 'Save' })
  },
})

class ExampleControlsElement extends WippyVueElement {
  static get wippyConfig(): WippyElementConfig {
    return {
      propsSchema: pkg.wippy.props,
      hostCssKeys: ['themeConfigUrl', 'primeVueCssUrl', 'iframeCssUrl'],
    }
  }

  static get vueConfig() {
    return {
      rootComponent: Root,
      plugins: [PrimeVuePlugin],
    }
  }
}

export async function webComponent() {
  return ExampleControlsElement
}

define(import.meta.url, ExampleControlsElement)
```

包元数据必须标识同一个自定义元素：

```json
{
  "name": "@example/controls",
  "version": "0.1.0",
  "type": "module",
  "specification": "wippy-component-1.0",
  "wippy": {
    "type": "component",
    "tagName": "example-controls",
    "props": {
      "type": "object",
      "properties": {},
      "additionalProperties": false
    }
  }
}
```

组件构建使用严格模式的 Wippy 组件插件，以及完整固定的目标宿主 import map 快照：

```ts
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { wippyComponentPlugin } from '@wippy-fe/vite-plugin'
import hostImportMap from './wippy-import-map.json'

export default defineConfig({
  plugins: [vue(), wippyComponentPlugin({ required: true })],
  build: {
    lib: {
      entry: 'src/element.ts',
      formats: ['es'],
      fileName: 'index',
    },
    rollupOptions: {
      external: Object.keys(hostImportMap.imports),
    },
  },
})
```

当该组件编写 Tailwind 实用类时，请使用共享的 Wippy Tailwind preset。PrimeVue 本身并不要求模块臆造 Tailwind 实用类。

## shadow root 规则

- 公开的 CSS 变量可以继承进 shadow root。
- 选择器规则只有在宿主把它们送入该 root 时才生效。
- 共享的 PrimeVue 主题 CSS 是受支持的依赖。
- 任意 facade 类不是可移植的 API。
- 浮层定位必须在真实运行时中验证；不要套用通用的定位配方。

## 元数据与构建

按所选 schema 的要求，在包元数据和注册表条目中同时记录 props 和 events。调用模块仓库的 Make 目标；其配方使用：

```text
npm run build -- --outDir <target> --emptyOutDir
```

不要直接调用底层命令。在 Windows 上调用 `make.bat`；它委托给 `make.ps1`。

参见[主题编写](./theming.md)、[Tailwind 契约](./tailwind-contract.md)和[构建与依赖契约](./build-system.md)。
