---
title: "プラットフォームトポロジー"
description: "Wippy のフロントエンドソースが routed page または Web Component となり、ランタイムコンテキストと CSS を受け取る仕組み。"
---

# プラットフォームトポロジー

このページはアーキテクチャおよび診断リファレンスです。配信チェーンと図はシステム境界を説明するもので、実行可能なプロジェクトは提供しません。

## 配信チェーン

| 段階 | 所有者 | 検証 |
|------|--------|------|
| ソースと package build | フロントエンドモジュール | package build が期待する entry file を出力する。 |
| アーティファクトの場所 | デプロイ用 build target | build command が `--outDir` を受け取る。Vite にハードコードしない。 |
| レジストリエントリ | バックエンドモジュール | `view.page` または `view.component` が出力済み entry を指す。 |
| Served URL | ファイルシステムおよび HTTP のレジストリエントリ | asset への直接リクエストがビルド済み JavaScript または HTML を返す。 |
| ランタイムコンテナ | Web Host | ページは設定済みページエンジン（従来の `about:srcdoc` iframe または Web Fragment）を使用する。コンポーネントは通常 shadow DOM を持つ custom element を使用する。 |
| コンテキスト | AppConfig と Wippy package | routing、API access、theme data がサポート対象 package を通じて届く。 |

ソースが存在すること、ビルドが成功すること、レジストリエントリが有効であることだけでは、次の段階を証明できません。境界を 1 つずつ検証してください。

## ページ

`view.page` は、従来の `about:srcdoc` iframe または Web Fragment という 2 つのエンジンのいずれかで動作します。global の `hostConfig.renderEngine` 設定が baseline を選択し、ページの `wippy.renderEngine` はそれに従うか、`iframe` へ opt out するか、デプロイが対応していれば `fragment` を要求できます。アプリケーションコードはエンジンに依存しません。どちらのエンジンでも browser location はサポート対象の child-route 契約ではありません。AppConfig と `@wippy-fe/router` を使用してください。この package が Wippy route 統合を処理します。

`iframe` CSS injection は現在、テーマ対応 scrollbar のデフォルト styling を提供します。この名前は歴史的なもので、現在の目的より広い意味を持ちます。scrollbar の一貫性のため有効に保ち、layout reset と説明しないでください。

## Web Component

`view.component` はホストドキュメント内で動作し、通常は shadow root を所有します。CSS selector は shadow boundary を越えて cascade しません。Web Host は component configuration に従って、承認済み stylesheet と facade CSS をその root へ配信できます。

CSS variable の継承と stylesheet injection は別の仕組みです。

- public な継承 variable は host-to-shadow boundary を越えられます。
- selector rule が shadow root に作用するのは、その root へ配信された場合だけです。
- 配信しても、任意の selector が portable API になるわけではありません。

## テーマと overlay

facade が PrimeVue theme を提供します。facade の `custom_css` にある共有 `.p-*` rule は有効な theme implementation であり、意図していれば host と child に対して global にできます。`.wippy-host-app` は host 固有 chrome にだけ使用してください。

theme mode は AppConfig state であり、CSS class API ではありません。application、component、fixture、browser test は、`@wippy-fe/proxy` の `host.setThemeMode('auto' | 'light' | 'dark')` で mode を切り替え、`@theme` を待って `host.getThemeMode()` を検証します。AppConfig が host-to-child transport を通じて変更を伝えます。host は自身の document を更新し、稼働中の iframe および Web Fragment page realm へ AppConfig を再配信し、web-component root に mode を反映します。
`w-theme-dark` または `w-theme-light` class を直接強制しないでください。

PrimeVue overlay は teleport される場合があります。top document、iframe document、再帰的に検出した shadow root で実際の overlay root を確認してください。一般的な PrimeVue の配置を想定しないでください。

## ランタイムのデバッグ順序

1. バックエンドが listen していることを確認する。
2. 予期しない 5xx response がないかバックエンドログを確認する。
3. registry owner と served asset URL を確認する。
4. 正確な package build がその asset を出力したことを確認する。
5. direct deep link がサポートされていない場合、SPA navigation より先に host root を読み込む。
6. navigation と interaction の後で console および network error を確認する。
7. theme scenario では public proxy theme method を呼び出し、`@theme` を観測し、screenshot を受け入れる前に `host.getThemeMode()` を検証する。
