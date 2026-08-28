---
title: "Wippy Micro Frontend"
description: "micro frontend app と web component を選択し、対応する build、routing、proxy、theming guide へ進む。"
---

# Wippy Micro Frontend

**分類: conceptual decision guide。** 2 つの artifact type を比較し、build/API reference へ案内します。standalone project tutorial ではありません。

Wippy frontend code は Web Host の isolation boundary 内で動きます。構築できる artifact は **micro frontend app** と **web component** の 2 種類です。どちらも独立した Vite project で、`@wippy-fe/proxy` を通して platform と通信し、backend の `_index.yaml` registry entry で宣言します。render 方法と用途が異なります。

## Micro frontend app と web component

| | マイクロフロントエンドアプリ（`view.page`） | Web コンポーネント（`view.component`） |
|---|---|---|
| **render 形式** | page surface: srcdoc iframe または Web Fragment | page 内の Shadow DOM custom element |
| **固有 URL / nav entry** | あり — backend `mountRoute` を受け持つ | なし — 別 page または chat artifact 内に embed |
| **内部 routing** | あり — memory history の `vue-router` | なし — 単一 component |
| **割り当て surface の制御** | あり — browser viewport ではなく 1 panel の場合もある | なし — surrounding layout が size を決める |
| **page 間の再利用** | なし — 1 URL、1 place | あり — どの page でも tag を embed 可能 |
| **typed props** | なし — `AppConfig` を読む | あり — schema-declared HTML attribute |
| **typed event** | なし — proxy API で通信 | あり — schema-declared `CustomEvent` |
| **CSS isolation** | engine-dependent: iframe boundary。Web Fragment は host document を共有 | Shadow DOM selector boundary |

**簡単な判断:** `vue-router`、専用 URL、routed page surface の ownership が必要なら micro frontend app、embed・reuse できる self-contained unit が必要なら web component を使います。

## 次に読むもの

[Quickstart](./quickstart.md) は Vue micro frontend app と Vue web component の最小 end-to-end example を示し、public [`app`](https://github.com/wippyai/app) repository へ案内します。

micro frontend app を構築する場合:

1. [Micro Frontend App](./micro-frontend-app.md) — scaffold、`package.json` wippy block、Vite config、bootstrap、router sync
2. [Build System](./build-system.md) — `@wippy-fe/vite-plugin`、`wippy-meta.json`、external
3. [Proxy API](./proxy-api.md) — host と通信する `@wippy-fe/proxy` reference
4. [Theming](./theming.md) → [Theming: Micro Frontend Apps](./micro-frontend-app-theming.md) — CSS variable catalog と proxy injection

web component を構築する場合:

1. [Web Component](./web-component.md) — scaffold、`WippyVueElement`、props、events、Shadow DOM CSS
2. [Build System](./build-system.md) — 同じ Vite toolchain と異なる plugin/output format
3. [Proxy API](./proxy-api.md) — 同じ API を `@wippy-fe/proxy` から直接 import
4. [Theming](./theming.md) → [Theming: Web Components](./web-component-theming.md) — CSS variable catalog と Shadow DOM boundary への delivery

共通:

- [Host-less Mode](./host-less-mode.md) — full Web Host なしでの開発・test
- [Compliance Rule Index](./compliance-checklist.md) — canonical rule owner と deterministic gate
- [Debugging](./debugging.md) — よくある failure を symptom から調べる guide

## 前提条件

- `wippy/views` dependency を宣言した Wippy backend module（[Views](../../framework/views.md)参照）
- Web Host entry point 用の `wippy/facade`（[Facade Entry Point](../web-host/entry-point.md)参照）
- この documentation baseline では Node.js 22.12 以上と Vite 7。Host source package は Node 22+ と Vite 7 を使用し、Vite 7 は Node 20.19+ または 22.12+ を要求する。`@wippy-fe/vite-plugin` 0.0.56 は Vite 5/6 も受け付けるが、選択した Vite release の Node requirement に従うこと
