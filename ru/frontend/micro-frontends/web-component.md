---
title: "Рецепт веб-компонента"
description: "Переносимые рецепты view.component для пользовательских элементов только с содержимым и для элементов с элементами управления."
---

# Рецепт веб-компонента

Веб-компонент регистрируется как `view.component` и обычно отрисовывается в shadow root. Выбирайте наименьшую валидную конфигурацию.

## Вариант A: только содержимое

График, диаграмма, рендерер или визуализация могут обходиться без PrimeVue и Tailwind, когда они не отрисовывают ни одного элемента управления и не создают общих утилит Tailwind.

При этом всё равно необходимо:

- Публиковать валидный тег пользовательского элемента.
- Сохранять доступность отрисовываемого содержимого.
- Использовать поддерживаемую конфигурацию Wippy и доставку CSS.
- Избегать приватных для проекта классов фасада.
- Собирать через каноническую Make-цель репозитория модуля Wippy.

Если позже добавляется кнопка, поле ввода, форма, меню или другой элемент управления в духе PrimeVue, это освобождение прекращается.

## Вариант B: с элементами управления

Компонент с элементами управления должен подключать PrimeVue через плагин PrimeVue от Wippy
и настраивать требуемые ключи доставки CSS. Приведённая ниже точка входа —
текущий поддерживаемый пакетами путь для Vue:

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

Метаданные пакета должны указывать на тот же пользовательский элемент:

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

Сборка компонента использует строгий плагин компонентов Wippy и полный
закреплённый снимок import map целевого хоста:

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

Используйте общий пресет Tailwind от Wippy, когда этот компонент создаёт утилиты
Tailwind. Сам PrimeVue не требует от модуля выдумывать утилиты
Tailwind.

## Правила shadow root

- Публичные CSS-переменные могут наследоваться в shadow root.
- Правила с селекторами действуют только если хост доставляет их в этот корень.
- Общий CSS темы PrimeVue — поддерживаемая зависимость.
- Произвольные классы фасада не являются переносимыми API.
- Размещение оверлеев должно проверяться в реальной среде выполнения; не навязывайте универсальный рецепт размещения.

## Метаданные и сборка

Документируйте props и события и в метаданных пакета, и в записи реестра, как того требует выбранная схема. Вызывайте Make-цель репозитория модуля; её рецепт использует:

```text
npm run build -- --outDir <target> --emptyOutDir
```

Не вызывайте эту нижележащую команду напрямую. В Windows вызывайте
`make.bat`; он делегирует `make.ps1`.

См. [Создание темы](./theming.md), [Контракт Tailwind](./tailwind-contract.md) и [Контракт сборки и зависимостей](./build-system.md).
