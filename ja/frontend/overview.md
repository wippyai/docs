---
title: "フロントエンド契約: はじめに"
description: "ポータブルなWippyページ、Webコンポーネント、ビルド、ルーティング、テーマ統合のエントリポイント。"
---

# フロントエンド契約: はじめに

Wippyのフロントエンドモジュールはデフォルトでポータブルです。モジュールは、ファサードが別の準拠PrimeVueテーマを提供し、プロジェクト固有のCSSが存在しない別のWippyプロジェクトにインポートされても、引き続き動作しなければなりません。

## 正しい経路を選ぶ

1. `about:srcdoc` iframe内でレンダリングされるアプリケーションには`view.page`を使用します。
2. ホストドキュメント内でレンダリングされるカスタム要素には、通常はシャドウルートを伴う`view.component`を使用します。
3. UIがボタン、入力、フォームフィールド、メニュー、オーバーレイ、その他PrimeVue相当のコントロールをレンダリングする場合、必要なセマンティクスとアフォーダンスをPrimeVueが提供できない場合を除き、PrimeVueを使用します。
4. コントロールを持たないChart.js可視化のような、コンテンツのみのコンポーネントはPrimeVueとTailwindを省略できます。
5. カスタムコントロールが必要な場合は、[ポータブルUI契約](./portable-ui-contract.md)と[カスタムコンポジット](./micro-frontends/custom-composites.md)に従います。

PrimeVueは共有のコンポーネント語彙です。Wippy Tailwindプリセットはサポートされたビルド時の語彙です。コンパイル後もファサードのテーマ変更に応答し続けるのは、ランタイムに裏付けられていると文書化されたユーティリティのみです。

## 所有関係マップ

```text
module source
  -> build command
  -> emitted artifact
  -> registry owner
  -> served URL
  -> Web Host
  -> page srcdoc iframe or component shadow root
  -> AppConfig / router / theme delivery
```

ある段階から別の段階を推測しないでください。アセットの欠落をデバッグする前に、ソースパッケージ、ビルドターゲット、生成されたファイル、レジストリエントリ、ファイルシステムのマウント、配信URLを特定してください。

## 契約ページ

- [プラットフォームトポロジー](./platform-topology.md): ランタイム境界、ルーティング、CSSの配信、オーバーレイ、所有関係。
- [ポータブルUI契約](./portable-ui-contract.md): 規範的なコンポーネントとスタイリングのルール。
- [テーマの作成](./micro-frontends/theming.md): ファサードの`custom_css`、PrimeVueテーマCSS、モジュールのいずれに何が属するか。
- [Tailwind契約](./micro-frontends/tailwind-contract.md): ランタイムに裏付けられたユーティリティとコンパイル済み定数の違い。
- [トークンカタログ](./micro-frontends/token-catalogue.md): 生成されたトークンリファレンスとその出所。
- [デザインレイヤー](./design-layer.md): 自分の複数のモジュールが同じものを必要とし、テーマにそのコンポーネントが存在しない場合、それがどこに属するか。
- [ページのレシピ](./micro-frontends/micro-frontend-app.md)と[Webコンポーネントのレシピ](./micro-frontends/web-component.md)。
- [ビルドと依存関係の契約](./micro-frontends/build-system.md)。
- [設定と命名規則](./micro-frontends/configuration-casing.md)。
- [準拠ルール一覧](./micro-frontends/compliance-checklist.md)。

## 譲れないチェック項目

- PrimeVueのプロパティ、コンポーネントAPI、CSS変数、Tailwindのセマンティックユーティリティを決して発明しないでください。選択したパッケージのソースと生成されたカタログで確認します。
- `--p-*`トークン名を類推で組み立てないでください。
- ポータブルモジュールからファサードの任意のクラスを要求しないでください。
- ブラウザのlocationからホストのルートコンテキストを推測しないでください。ページはAppConfigを通じてホストのコンテキストを受け取り、`@wippy-fe/router`を使用します。
- ブラウザで検証する前に、所有元となるパッケージそのものを配信出力へ再ビルドしてください。
- ナビゲーションと実質的な操作の後に、ブラウザのコンソールを確認してください。

プロジェクト固有のモジュールはポータブル契約の対象外です。それらは[非対応のプロジェクト固有モジュール](./micro-frontends/unsupported-project-bound.md)のページでのみ扱われます。標準の準拠チェックは`UNSUPPORTED`を返し、標準のCIは失敗します。
