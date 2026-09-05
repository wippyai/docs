---
title: "Web コンポーネントのレシピ"
description: "コンテンツのみのカスタム要素と、コントロールを含むカスタム要素のための可搬な view.component レシピ。"
---

# Web コンポーネントのレシピ

Web コンポーネントは `view.component` として登録され、通常は shadow root 内でレンダリングされます。妥当な範囲で最小の構成を選んでください。

## バリアント A: コンテンツのみ

チャート、ダイアグラム、レンダラー、ビジュアライゼーションは、コントロールを一切レンダリングせず、共有 Tailwind ユーティリティを記述しない場合、PrimeVue と Tailwind を省略できます。

それでも次は必須です。

- 妥当なカスタム要素タグを公開すること。
- レンダリングされるコンテンツのアクセシビリティを保つこと。
- サポートされる Wippy の設定と CSS 配信を使うこと。
- プロジェクト私有のファサードクラスを避けること。
- Wippy モジュールリポジトリの正典の Make ターゲットでビルドすること。

後からボタン、入力、フォーム、メニュー、その他 PrimeVue 相当のコントロールを追加した時点で、この免除は終了します。

## バリアント B: コントロールを含む

コントロールを持つコンポーネントは、Wippy の PrimeVue プラグインを通じて PrimeVue をインストールし、必要な CSS 配信キーを設定しなければなりません。次のエントリは、現在パッケージがサポートする Vue の書き方です。

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

パッケージのメタデータは、同じカスタム要素を示していなければなりません。

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

コンポーネントのビルドでは、厳格な Wippy コンポーネントプラグインと、ピン留めされた対象ホストの完全なインポートマップスナップショットを使用します。

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

このコンポーネントが Tailwind ユーティリティを記述する場合は、共有の Wippy Tailwind プリセットを使用してください。PrimeVue 自体は、モジュールが Tailwind ユーティリティを発明することを要求しません。

## shadow root のルール

- 公開された CSS 変数は shadow root へ継承されます。
- セレクターのルールは、ホストがそれらをルートへ配信した場合にのみ効きます。
- 共有の PrimeVue テーマ CSS はサポートされる依存関係です。
- 任意のファサードクラスは可搬な API ではありません。
- オーバーレイの配置は実際のランタイムで検証しなければなりません。汎用的な配置レシピを押し付けないでください。

## メタデータとビルド

選択したスキーマが要求するとおり、props と events をパッケージのメタデータとレジストリエントリの両方に記載してください。モジュールリポジトリの Make ターゲットを呼び出します。そのレシピは次を使用します。

```text
npm run build -- --outDir <target> --emptyOutDir
```

この裏側のコマンドを直接実行しないでください。Windows では `make.bat` を呼び出します。`make.bat` は `make.ps1` へ委譲します。

[テーマの記述](./theming.md)、[Tailwind 契約](./tailwind-contract.md)、[ビルドと依存関係の契約](./build-system.md) を参照してください。
