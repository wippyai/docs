---
title: "フロントエンド契約：はじめに"
description: "移植可能な Wippy ページ、Web Component、ビルド、ルーティング、テーマ統合の入口。"
---

# フロントエンド契約：はじめに

このページは、概要ガイド兼ナビゲーションリファレンスです。フロントエンドモジュールが従うべき契約を示します。ビルドチュートリアルや完全なアプリケーション例ではありません。

Wippy フロントエンドモジュールは、デフォルトで移植可能です。別の準拠 Wippy プロジェクトへインポートされ、その facade が別の準拠 PrimeVue テーマを提供し、プロジェクト固有 CSS が存在しない場合でも動作し続ける必要があります。

## 正しい経路の選択

1. 設定されたページエンジン（従来の `about:srcdoc` iframe または Web Fragment）でレンダリングするアプリケーションには `view.page` を使用します。
2. ホストドキュメント内で、通常は shadow root を使ってレンダリングする custom element には `view.component` を使用します。
3. UI がボタン、入力、フォームフィールド、メニュー、overlay、その他 PrimeVue に類するコントロールを描画する場合、PrimeVue で必要な semantics と affordance を提供できない場合を除いて PrimeVue を使用します。
4. コントロールを含まない Chart.js の可視化など、コンテンツ専用コンポーネントでは PrimeVue と Tailwind を省略できます。
5. カスタムコントロールが必要な場合は、[ポータブル UI 契約](./portable-ui-contract.md)と[カスタムコンポジット](./micro-frontends/custom-composites.md)に従います。

PrimeVue は共有コンポーネントの語彙です。Wippy Tailwind プリセットはサポート対象のビルド時語彙です。コンパイル後もファサードのテーマ変更へ応答するのは、実行時に裏付けられると明記されたユーティリティだけです。

## 所有関係マップ

```text
module source
  -> build command
  -> emitted artifact
  -> registry owner
  -> served URL
  -> Web Host
  -> page surface (srcdoc iframe or Web Fragment) or component shadow root
  -> AppConfig / router / theme delivery
```

ある段階から次の段階を推測しないでください。欠けた asset をデバッグする前に、source package、build target、emitted file、registry entry、filesystem mount、served URL を特定します。

## 契約ページ

- [プラットフォームトポロジー](./platform-topology.md)：ランタイム境界、ルーティング、CSS 配信、overlay、所有関係。
- [Portable UI 契約](./portable-ui-contract.md)：コンポーネントと styling の規範的な規則。
- [テーマの作成](./micro-frontends/theming.md)：facade の `custom_css`、PrimeVue theme CSS、モジュールのどこに何を置くか。
- [Tailwind 契約](./micro-frontends/tailwind-contract.md)：ランタイムに支えられたユーティリティとコンパイル済み定数の違い。
- [トークンカタログ](./micro-frontends/token-catalogue.md)：生成されたトークン参照と来歴。
- [デザインレイヤー](./design-layer.md)：複数の自作モジュールで必要とし、テーマに対応コンポーネントがないものの配置先。
- [ページレシピ](./micro-frontends/micro-frontend-app.md)と [Web Component レシピ](./micro-frontends/web-component.md)。
- [ビルドと依存関係の契約](./micro-frontends/build-system.md)。
- [設定と casing](./micro-frontends/configuration-casing.md)。
- [準拠規則インデックス](./micro-frontends/compliance-checklist.md)。

## 必須チェック

- PrimeVue の prop、component API、CSS variable、Tailwind semantic utility を推測で作らない。選択した package source と生成済み catalogue で確認する。
- 類推で `--p-*` token 名を組み立てない。
- 移植可能なモジュールから任意の facade class を要求しない。
- browser location から host route context を推測しない。ページは AppConfig 経由で host context を受け取り、`@wippy-fe/router` を使用する。
- ブラウザー検証の前に、正確な所有 package を served output へ再ビルドする。
- navigation と重要な interaction の後に browser console を確認する。

プロジェクト固有モジュールは portable contract の対象外です。[サポート対象外のプロジェクト固有モジュール](./micro-frontends/unsupported-project-bound.md)ページでのみ説明され、標準の準拠判定は `UNSUPPORTED` を返し、標準 CI は失敗します。
