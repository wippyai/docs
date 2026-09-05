---
title: "Tailwind契約"
description: "ユーティリティ名、コンパイル済みの値、ランタイムに裏付けられたユーティリティ、ポータブルな公開契約の違い。"
---

# Tailwind契約

「Tailwindトークン」という言い方は曖昧です。代わりに次の4つの用語を使用してください。

| レイヤー | 例 | テーマの挙動 |
|---|---|---|
| ユーティリティ名 | `px-3`、`rounded-md`、`bg-primary` | ソース上の語彙のみ |
| コンパイル時のTailwindの値 | `px-3`は固定のスペーシング値を出力する | モジュールバンドルに埋め込まれる |
| ランタイムに裏付けられたユーティリティ | `bg-primary`は公開の`--p-*`変数への参照を出力する | ファサードのランタイムでのテーマ変更に応答する |
| 公開のポータブル契約 | 意図的に文書化されたWippyのトークンまたはセマンティックユーティリティ | サポート対象のポータブルな利用側に対して安定 |

Tailwind 3はランタイムを持たないコンパイラです。ユーティリティ名からランタイムの挙動を推測せず、生成された宣言を確認してください。

## ランタイムのセマンティックユーティリティ

正確なマッピングの典拠は、生成されたユーティリティカタログです。カタログは現行のprimary、surface、severity、text、content、highlight、radiusの各ユーティリティを、生成されるCSSと公開変数への依存によって分類します。

想定されるカテゴリの例には、セマンティックカラー、コンテンツの境界線、抑制されたテキスト、そして生成されたソースがマッピングを裏付ける場合の`rounded-border`が含まれます。エントリがここに現れるのは、選択されたプリセットとパッケージバージョンから生成された場合のみです。

## コンパイル時のベースライン

生成されたカタログは、定数にコンパイルされるスペーシング、サイズ、デフォルトの角丸、フォントサイズ、影、トランジションの継続時間、タイミング関数を別途記録します。

> ビルド時のベースライン。この値はモジュールバンドルに埋め込まれ、ファサードのテーマ変更には反応しません。

コンパイル時の値は、`platform-invariant`に分類されるプロパティには有効です。別のファサードテーマの下でPrimeVueの兄弟コンポーネントに追従する必要があるプロパティには不十分です。

`rounded-md`と`rounded-border`は、現時点で同じ数値に解決されるとしても等価な契約ではありません。一方はコンパイルされたデフォルトであり、もう一方はランタイムに裏付けられています。現在の値が等しいことは、セマンティックな役割が等しいことの証明にもなりません。

## 保護されたマッピング

モジュールは共有プリセットを拡張できます。ただし、次の項目についてWippyの保護された意味を再定義してはなりません。

- primaryとsurfaceのファミリー。
- severityのファミリー。
- text、content、highlightのセマンティクス。
- 公開されたポータブルコントロールのセマンティクス。

準拠チェックはモジュールの実際のTailwind設定を解決し、保護されたマッピングの非互換な置き換えを拒否します。

## カスタムの兄弟コンポーネント

ポータブルなカスタムの兄弟コンポーネントは、次を使用できます。

- 生成されたカタログに掲載された、ランタイムに裏付けられたセマンティックユーティリティ。
- 選択したトークンマニフェストに掲載された公開変数の直接参照。
- 明示的に`platform-invariant`と分類されたプロパティに対するコンパイル時のユーティリティ。
- 真に新規な構造に対するモジュールローカルのユーティリティ。

PrimeVueの兄弟コンポーネントに追従することが期待されるプロパティについて、固定の寸法、角丸、継続時間をコピーすることはできません。公開されたランタイムのセマンティクスが存在しない場合は、テーマ契約のギャップとして記録してください。ユーティリティやトークンを発明してはなりません。

## 生成されたユーティリティカタログ

チェックインされたスナップショットは、次から生成されます。

- `@wippy-fe/theme`が選択した正確なTailwindのバージョン。
- 正確な`tailwindcss-primeui`のバージョン。
- Wippyの共有`tailwind.config.ts`。
- Wippyの拡張。

生成される各行には、ユーティリティ、生成されるプロパティ、解決後の値、ランタイム依存、想定される用途、許可される利用側、安定性、パッケージ互換性のタプル、ソースハッシュが含まれます。

<!-- GENERATED:TAILWIND-CONTRACT:BEGIN -->
@wippy-fe/theme 0.0.46から生成。以下のすべての代表的なマッピングは、tailwindcss-primeui 0.6.1を用いてTailwind 3.4.19がコンパイルしたCSSに対して検証されています。

ソースハッシュ: テーマ契約 `853a01257988861e208b6f7523de25cd329717763d064e4f2c5920cff7f7778a`; テーマ設定 `129f1591fd657416b75e913f554329924bade319c38e62f5b72dcc5f72bd8295`; Tailwind設定 `f1e862105254f082a78823ea685e3c6dc3ff5822516b7434a1e1141c976adc1d`; 参照テーマのソース `aura/index.mjs=d1a1a574cf1a15aad8aee4cb3fa169aa97bf4029e9f858b84245e7f0b933d5ca; aura/base/index.mjs=9fec80a7ffbd5fb0229da666c1472c27c9a0a6a7ef3bb0a84bd7b070601e4198; aura/inputtext/index.mjs=5c5a4af9bacf0d585120b119bb7bfb02c7deedd9714b131d7009ff6e95f818e8; aura/toggleswitch/index.mjs=1e068fd0ede48eeeca4d10571940d65dadb3450b2ee51a39d09b33dda9da6e66; aura/button/index.mjs=44d8fd7f7ae163ce2653de8c6eb8af097fc453b4c60f702fcf76845be6ec9393`。

### ランタイムに裏付けられたセマンティックユーティリティ

| ユーティリティ | CSSプロパティ | 解決後の値 | ランタイム依存 | 分類 | 許可される利用側 | 安定性 | 想定される用途 |
|---|---|---|---|---|---|---|---|
| `bg-danger-500` | --tw-bg-opacity / background-color | `1 / color-mix(in srgb, var(--p-danger-500) calc(100% * var(--tw-bg-opacity, 1)), transparent)` | --p-danger-500 | runtime-variable | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `bg-emphasis` | background / color | `var(--p-content-hover-background) / var(--p-content-hover-color)` | --p-content-hover-background, --p-content-hover-color | runtime-variable | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | public | ホバーまたは強調されたコンテンツ |
| `bg-help-500` | --tw-bg-opacity / background-color | `1 / color-mix(in srgb, var(--p-help-500) calc(100% * var(--tw-bg-opacity, 1)), transparent)` | --p-help-500 | runtime-variable | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `bg-highlight` | background / color | `var(--p-highlight-background) / var(--p-highlight-color)` | --p-highlight-background, --p-highlight-color | runtime-variable | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | public | 選択またはハイライトされたコンテンツ |
| `bg-highlight-emphasis` | background / color | `var(--p-highlight-focus-background) / var(--p-highlight-focus-color)` | --p-highlight-focus-background, --p-highlight-focus-color | runtime-variable | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | public | フォーカスされたハイライト表示のコンテンツ |
| `bg-info-500` | --tw-bg-opacity / background-color | `1 / color-mix(in srgb, var(--p-info-500) calc(100% * var(--tw-bg-opacity, 1)), transparent)` | --p-info-500 | runtime-variable | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `bg-primary` | --tw-bg-opacity / background-color | `1 / color-mix(in srgb, var(--p-primary-color) calc(100% * var(--tw-bg-opacity, 1)), transparent)` | --p-primary-color | runtime-variable | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | public | デフォルトの主要アクションと強調の色 |
| `bg-primary-emphasis` | --tw-bg-opacity / background-color | `1 / color-mix(in srgb, var(--p-primary-hover-color) calc(100% * var(--tw-bg-opacity, 1)), transparent)` | --p-primary-hover-color | runtime-variable | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | public | primaryのホバーまたは強調の状態 |
| `bg-success-500` | --tw-bg-opacity / background-color | `1 / color-mix(in srgb, var(--p-success-500) calc(100% * var(--tw-bg-opacity, 1)), transparent)` | --p-success-500 | runtime-variable | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `bg-surface-0` | --tw-bg-opacity / background-color | `1 / color-mix(in srgb, var(--p-surface-0) calc(100% * var(--tw-bg-opacity, 1)), transparent)` | --p-surface-0 | runtime-variable | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `bg-surface-100` | --tw-bg-opacity / background-color | `1 / color-mix(in srgb, var(--p-surface-100) calc(100% * var(--tw-bg-opacity, 1)), transparent)` | --p-surface-100 | runtime-variable | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `bg-surface-200` | --tw-bg-opacity / background-color | `1 / color-mix(in srgb, var(--p-surface-200) calc(100% * var(--tw-bg-opacity, 1)), transparent)` | --p-surface-200 | runtime-variable | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `bg-surface-300` | --tw-bg-opacity / background-color | `1 / color-mix(in srgb, var(--p-surface-300) calc(100% * var(--tw-bg-opacity, 1)), transparent)` | --p-surface-300 | runtime-variable | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `bg-surface-400` | --tw-bg-opacity / background-color | `1 / color-mix(in srgb, var(--p-surface-400) calc(100% * var(--tw-bg-opacity, 1)), transparent)` | --p-surface-400 | runtime-variable | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `bg-surface-50` | --tw-bg-opacity / background-color | `1 / color-mix(in srgb, var(--p-surface-50) calc(100% * var(--tw-bg-opacity, 1)), transparent)` | --p-surface-50 | runtime-variable | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `bg-surface-700` | --tw-bg-opacity / background-color | `1 / color-mix(in srgb, var(--p-surface-700) calc(100% * var(--tw-bg-opacity, 1)), transparent)` | --p-surface-700 | runtime-variable | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `bg-surface-950` | --tw-bg-opacity / background-color | `1 / color-mix(in srgb, var(--p-surface-950) calc(100% * var(--tw-bg-opacity, 1)), transparent)` | --p-surface-950 | runtime-variable | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `bg-warn-500` | --tw-bg-opacity / background-color | `1 / color-mix(in srgb, var(--p-warn-500) calc(100% * var(--tw-bg-opacity, 1)), transparent)` | --p-warn-500 | runtime-variable | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `border-danger-200` | --tw-border-opacity / border-color | `1 / color-mix(in srgb, var(--p-danger-200) calc(100% * var(--tw-border-opacity, 1)), transparent)` | --p-danger-200 | runtime-variable | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `border-danger-400` | --tw-border-opacity / border-color | `1 / color-mix(in srgb, var(--p-danger-400) calc(100% * var(--tw-border-opacity, 1)), transparent)` | --p-danger-400 | runtime-variable | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `border-danger-500` | --tw-border-opacity / border-color | `1 / color-mix(in srgb, var(--p-danger-500) calc(100% * var(--tw-border-opacity, 1)), transparent)` | --p-danger-500 | runtime-variable | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `border-help-200` | --tw-border-opacity / border-color | `1 / color-mix(in srgb, var(--p-help-200) calc(100% * var(--tw-border-opacity, 1)), transparent)` | --p-help-200 | runtime-variable | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `border-help-500` | --tw-border-opacity / border-color | `1 / color-mix(in srgb, var(--p-help-500) calc(100% * var(--tw-border-opacity, 1)), transparent)` | --p-help-500 | runtime-variable | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `border-info-200` | --tw-border-opacity / border-color | `1 / color-mix(in srgb, var(--p-info-200) calc(100% * var(--tw-border-opacity, 1)), transparent)` | --p-info-200 | runtime-variable | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `border-info-500` | --tw-border-opacity / border-color | `1 / color-mix(in srgb, var(--p-info-500) calc(100% * var(--tw-border-opacity, 1)), transparent)` | --p-info-500 | runtime-variable | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `border-primary` | --tw-border-opacity / border-color | `1 / color-mix(in srgb, var(--p-primary-color) calc(100% * var(--tw-border-opacity, 1)), transparent)` | --p-primary-color | runtime-variable | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `border-primary-200` | --tw-border-opacity / border-color | `1 / color-mix(in srgb, var(--p-primary-200) calc(100% * var(--tw-border-opacity, 1)), transparent)` | --p-primary-200 | runtime-variable | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `border-success-200` | --tw-border-opacity / border-color | `1 / color-mix(in srgb, var(--p-success-200) calc(100% * var(--tw-border-opacity, 1)), transparent)` | --p-success-200 | runtime-variable | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `border-success-500` | --tw-border-opacity / border-color | `1 / color-mix(in srgb, var(--p-success-500) calc(100% * var(--tw-border-opacity, 1)), transparent)` | --p-success-500 | runtime-variable | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `border-surface` | border-color | `var(--p-content-border-color)` | --p-content-border-color | runtime-variable | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | public | コンテンツとコントロールで共有される境界線 |
| `border-surface-100` | --tw-border-opacity / border-color | `1 / color-mix(in srgb, var(--p-surface-100) calc(100% * var(--tw-border-opacity, 1)), transparent)` | --p-surface-100 | runtime-variable | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `border-surface-200` | --tw-border-opacity / border-color | `1 / color-mix(in srgb, var(--p-surface-200) calc(100% * var(--tw-border-opacity, 1)), transparent)` | --p-surface-200 | runtime-variable | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `border-surface-300` | --tw-border-opacity / border-color | `1 / color-mix(in srgb, var(--p-surface-300) calc(100% * var(--tw-border-opacity, 1)), transparent)` | --p-surface-300 | runtime-variable | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `border-surface-700` | --tw-border-opacity / border-color | `1 / color-mix(in srgb, var(--p-surface-700) calc(100% * var(--tw-border-opacity, 1)), transparent)` | --p-surface-700 | runtime-variable | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `border-surface-950` | --tw-border-opacity / border-color | `1 / color-mix(in srgb, var(--p-surface-950) calc(100% * var(--tw-border-opacity, 1)), transparent)` | --p-surface-950 | runtime-variable | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `border-warn-200` | --tw-border-opacity / border-color | `1 / color-mix(in srgb, var(--p-warn-200) calc(100% * var(--tw-border-opacity, 1)), transparent)` | --p-warn-200 | runtime-variable | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `border-warn-500` | --tw-border-opacity / border-color | `1 / color-mix(in srgb, var(--p-warn-500) calc(100% * var(--tw-border-opacity, 1)), transparent)` | --p-warn-500 | runtime-variable | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `dark:bg-danger-400` | --tw-bg-opacity / background-color | `1 / color-mix(in srgb, var(--p-danger-400) calc(100% * var(--tw-bg-opacity, 1)), transparent)` | --p-danger-400 | runtime-variable | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `dark:bg-help-400` | --tw-bg-opacity / background-color | `1 / color-mix(in srgb, var(--p-help-400) calc(100% * var(--tw-bg-opacity, 1)), transparent)` | --p-help-400 | runtime-variable | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `dark:bg-info-400` | --tw-bg-opacity / background-color | `1 / color-mix(in srgb, var(--p-info-400) calc(100% * var(--tw-bg-opacity, 1)), transparent)` | --p-info-400 | runtime-variable | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `dark:bg-success-400` | --tw-bg-opacity / background-color | `1 / color-mix(in srgb, var(--p-success-400) calc(100% * var(--tw-bg-opacity, 1)), transparent)` | --p-success-400 | runtime-variable | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `dark:bg-surface-0` | --tw-bg-opacity / background-color | `1 / color-mix(in srgb, var(--p-surface-0) calc(100% * var(--tw-bg-opacity, 1)), transparent)` | --p-surface-0 | runtime-variable | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `dark:bg-surface-300` | --tw-bg-opacity / background-color | `1 / color-mix(in srgb, var(--p-surface-300) calc(100% * var(--tw-bg-opacity, 1)), transparent)` | --p-surface-300 | runtime-variable | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `dark:bg-surface-400` | --tw-bg-opacity / background-color | `1 / color-mix(in srgb, var(--p-surface-400) calc(100% * var(--tw-bg-opacity, 1)), transparent)` | --p-surface-400 | runtime-variable | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `dark:bg-surface-600` | --tw-bg-opacity / background-color | `1 / color-mix(in srgb, var(--p-surface-600) calc(100% * var(--tw-bg-opacity, 1)), transparent)` | --p-surface-600 | runtime-variable | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `dark:bg-surface-700` | --tw-bg-opacity / background-color | `1 / color-mix(in srgb, var(--p-surface-700) calc(100% * var(--tw-bg-opacity, 1)), transparent)` | --p-surface-700 | runtime-variable | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `dark:bg-surface-800` | --tw-bg-opacity / background-color | `1 / color-mix(in srgb, var(--p-surface-800) calc(100% * var(--tw-bg-opacity, 1)), transparent)` | --p-surface-800 | runtime-variable | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `dark:bg-surface-900` | --tw-bg-opacity / background-color | `1 / color-mix(in srgb, var(--p-surface-900) calc(100% * var(--tw-bg-opacity, 1)), transparent)` | --p-surface-900 | runtime-variable | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `dark:bg-warn-400` | --tw-bg-opacity / background-color | `1 / color-mix(in srgb, var(--p-warn-400) calc(100% * var(--tw-bg-opacity, 1)), transparent)` | --p-warn-400 | runtime-variable | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `dark:border-danger-300` | --tw-border-opacity / border-color | `1 / color-mix(in srgb, var(--p-danger-300) calc(100% * var(--tw-border-opacity, 1)), transparent)` | --p-danger-300 | runtime-variable | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `dark:border-danger-400` | --tw-border-opacity / border-color | `1 / color-mix(in srgb, var(--p-danger-400) calc(100% * var(--tw-border-opacity, 1)), transparent)` | --p-danger-400 | runtime-variable | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `dark:border-danger-700` | --tw-border-opacity / border-color | `1 / color-mix(in srgb, var(--p-danger-700) calc(100% * var(--tw-border-opacity, 1)), transparent)` | --p-danger-700 | runtime-variable | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `dark:border-help-400` | --tw-border-opacity / border-color | `1 / color-mix(in srgb, var(--p-help-400) calc(100% * var(--tw-border-opacity, 1)), transparent)` | --p-help-400 | runtime-variable | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `dark:border-help-700` | --tw-border-opacity / border-color | `1 / color-mix(in srgb, var(--p-help-700) calc(100% * var(--tw-border-opacity, 1)), transparent)` | --p-help-700 | runtime-variable | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `dark:border-info-400` | --tw-border-opacity / border-color | `1 / color-mix(in srgb, var(--p-info-400) calc(100% * var(--tw-border-opacity, 1)), transparent)` | --p-info-400 | runtime-variable | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `dark:border-info-700` | --tw-border-opacity / border-color | `1 / color-mix(in srgb, var(--p-info-700) calc(100% * var(--tw-border-opacity, 1)), transparent)` | --p-info-700 | runtime-variable | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `dark:border-primary-700` | --tw-border-opacity / border-color | `1 / color-mix(in srgb, var(--p-primary-700) calc(100% * var(--tw-border-opacity, 1)), transparent)` | --p-primary-700 | runtime-variable | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `dark:border-success-400` | --tw-border-opacity / border-color | `1 / color-mix(in srgb, var(--p-success-400) calc(100% * var(--tw-border-opacity, 1)), transparent)` | --p-success-400 | runtime-variable | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `dark:border-success-700` | --tw-border-opacity / border-color | `1 / color-mix(in srgb, var(--p-success-700) calc(100% * var(--tw-border-opacity, 1)), transparent)` | --p-success-700 | runtime-variable | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `dark:border-surface-100` | --tw-border-opacity / border-color | `1 / color-mix(in srgb, var(--p-surface-100) calc(100% * var(--tw-border-opacity, 1)), transparent)` | --p-surface-100 | runtime-variable | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `dark:border-surface-500` | --tw-border-opacity / border-color | `1 / color-mix(in srgb, var(--p-surface-500) calc(100% * var(--tw-border-opacity, 1)), transparent)` | --p-surface-500 | runtime-variable | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `dark:border-surface-600` | --tw-border-opacity / border-color | `1 / color-mix(in srgb, var(--p-surface-600) calc(100% * var(--tw-border-opacity, 1)), transparent)` | --p-surface-600 | runtime-variable | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `dark:border-surface-700` | --tw-border-opacity / border-color | `1 / color-mix(in srgb, var(--p-surface-700) calc(100% * var(--tw-border-opacity, 1)), transparent)` | --p-surface-700 | runtime-variable | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `dark:border-surface-800` | --tw-border-opacity / border-color | `1 / color-mix(in srgb, var(--p-surface-800) calc(100% * var(--tw-border-opacity, 1)), transparent)` | --p-surface-800 | runtime-variable | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `dark:border-warn-400` | --tw-border-opacity / border-color | `1 / color-mix(in srgb, var(--p-warn-400) calc(100% * var(--tw-border-opacity, 1)), transparent)` | --p-warn-400 | runtime-variable | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `dark:border-warn-700` | --tw-border-opacity / border-color | `1 / color-mix(in srgb, var(--p-warn-700) calc(100% * var(--tw-border-opacity, 1)), transparent)` | --p-warn-700 | runtime-variable | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `dark:disabled:bg-surface-700` | --tw-bg-opacity / background-color | `1 / color-mix(in srgb, var(--p-surface-700) calc(100% * var(--tw-bg-opacity, 1)), transparent)` | --p-surface-700 | runtime-variable | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `dark:disabled:text-surface-400` | --tw-text-opacity / color | `1 / color-mix(in srgb, var(--p-surface-400) calc(100% * var(--tw-text-opacity, 1)), transparent)` | --p-surface-400 | runtime-variable | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `dark:enabled:active:bg-danger-200` | --tw-bg-opacity / background-color | `1 / color-mix(in srgb, var(--p-danger-200) calc(100% * var(--tw-bg-opacity, 1)), transparent)` | --p-danger-200 | runtime-variable | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `dark:enabled:active:bg-danger-400/15` | background-color | `color-mix(in srgb, var(--p-danger-400) calc(100% * 0.15), transparent)` | --p-danger-400 | runtime-variable | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `dark:enabled:active:bg-help-200` | --tw-bg-opacity / background-color | `1 / color-mix(in srgb, var(--p-help-200) calc(100% * var(--tw-bg-opacity, 1)), transparent)` | --p-help-200 | runtime-variable | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `dark:enabled:active:bg-help-400/15` | background-color | `color-mix(in srgb, var(--p-help-400) calc(100% * 0.15), transparent)` | --p-help-400 | runtime-variable | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `dark:enabled:active:bg-info-200` | --tw-bg-opacity / background-color | `1 / color-mix(in srgb, var(--p-info-200) calc(100% * var(--tw-bg-opacity, 1)), transparent)` | --p-info-200 | runtime-variable | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `dark:enabled:active:bg-info-400/15` | background-color | `color-mix(in srgb, var(--p-info-400) calc(100% * 0.15), transparent)` | --p-info-400 | runtime-variable | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `dark:enabled:active:bg-primary/15` | background-color | `color-mix(in srgb, var(--p-primary-color) calc(100% * 0.15), transparent)` | --p-primary-color | runtime-variable | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `dark:enabled:active:bg-success-200` | --tw-bg-opacity / background-color | `1 / color-mix(in srgb, var(--p-success-200) calc(100% * var(--tw-bg-opacity, 1)), transparent)` | --p-success-200 | runtime-variable | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `dark:enabled:active:bg-success-400/15` | background-color | `color-mix(in srgb, var(--p-success-400) calc(100% * 0.15), transparent)` | --p-success-400 | runtime-variable | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `dark:enabled:active:bg-surface-200` | --tw-bg-opacity / background-color | `1 / color-mix(in srgb, var(--p-surface-200) calc(100% * var(--tw-bg-opacity, 1)), transparent)` | --p-surface-200 | runtime-variable | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `dark:enabled:active:bg-surface-600` | --tw-bg-opacity / background-color | `1 / color-mix(in srgb, var(--p-surface-600) calc(100% * var(--tw-bg-opacity, 1)), transparent)` | --p-surface-600 | runtime-variable | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `dark:enabled:active:bg-surface-700` | --tw-bg-opacity / background-color | `1 / color-mix(in srgb, var(--p-surface-700) calc(100% * var(--tw-bg-opacity, 1)), transparent)` | --p-surface-700 | runtime-variable | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `dark:enabled:active:bg-warn-200` | --tw-bg-opacity / background-color | `1 / color-mix(in srgb, var(--p-warn-200) calc(100% * var(--tw-bg-opacity, 1)), transparent)` | --p-warn-200 | runtime-variable | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `dark:enabled:active:bg-warn-400/15` | background-color | `color-mix(in srgb, var(--p-warn-400) calc(100% * 0.15), transparent)` | --p-warn-400 | runtime-variable | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `dark:enabled:active:border-danger-200` | --tw-border-opacity / border-color | `1 / color-mix(in srgb, var(--p-danger-200) calc(100% * var(--tw-border-opacity, 1)), transparent)` | --p-danger-200 | runtime-variable | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `dark:enabled:active:border-danger-700` | --tw-border-opacity / border-color | `1 / color-mix(in srgb, var(--p-danger-700) calc(100% * var(--tw-border-opacity, 1)), transparent)` | --p-danger-700 | runtime-variable | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `dark:enabled:active:border-help-200` | --tw-border-opacity / border-color | `1 / color-mix(in srgb, var(--p-help-200) calc(100% * var(--tw-border-opacity, 1)), transparent)` | --p-help-200 | runtime-variable | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `dark:enabled:active:border-help-700` | --tw-border-opacity / border-color | `1 / color-mix(in srgb, var(--p-help-700) calc(100% * var(--tw-border-opacity, 1)), transparent)` | --p-help-700 | runtime-variable | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `dark:enabled:active:border-info-200` | --tw-border-opacity / border-color | `1 / color-mix(in srgb, var(--p-info-200) calc(100% * var(--tw-border-opacity, 1)), transparent)` | --p-info-200 | runtime-variable | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `dark:enabled:active:border-info-700` | --tw-border-opacity / border-color | `1 / color-mix(in srgb, var(--p-info-700) calc(100% * var(--tw-border-opacity, 1)), transparent)` | --p-info-700 | runtime-variable | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `dark:enabled:active:border-primary-700` | --tw-border-opacity / border-color | `1 / color-mix(in srgb, var(--p-primary-700) calc(100% * var(--tw-border-opacity, 1)), transparent)` | --p-primary-700 | runtime-variable | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `dark:enabled:active:border-success-200` | --tw-border-opacity / border-color | `1 / color-mix(in srgb, var(--p-success-200) calc(100% * var(--tw-border-opacity, 1)), transparent)` | --p-success-200 | runtime-variable | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `dark:enabled:active:border-success-700` | --tw-border-opacity / border-color | `1 / color-mix(in srgb, var(--p-success-700) calc(100% * var(--tw-border-opacity, 1)), transparent)` | --p-success-700 | runtime-variable | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `dark:enabled:active:border-surface-300` | --tw-border-opacity / border-color | `1 / color-mix(in srgb, var(--p-surface-300) calc(100% * var(--tw-border-opacity, 1)), transparent)` | --p-surface-300 | runtime-variable | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `dark:enabled:active:border-surface-500` | --tw-border-opacity / border-color | `1 / color-mix(in srgb, var(--p-surface-500) calc(100% * var(--tw-border-opacity, 1)), transparent)` | --p-surface-500 | runtime-variable | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `dark:enabled:active:border-surface-600` | --tw-border-opacity / border-color | `1 / color-mix(in srgb, var(--p-surface-600) calc(100% * var(--tw-border-opacity, 1)), transparent)` | --p-surface-600 | runtime-variable | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `dark:enabled:active:border-surface-700` | --tw-border-opacity / border-color | `1 / color-mix(in srgb, var(--p-surface-700) calc(100% * var(--tw-border-opacity, 1)), transparent)` | --p-surface-700 | runtime-variable | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `dark:enabled:active:border-warn-200` | --tw-border-opacity / border-color | `1 / color-mix(in srgb, var(--p-warn-200) calc(100% * var(--tw-border-opacity, 1)), transparent)` | --p-warn-200 | runtime-variable | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `dark:enabled:active:border-warn-700` | --tw-border-opacity / border-color | `1 / color-mix(in srgb, var(--p-warn-700) calc(100% * var(--tw-border-opacity, 1)), transparent)` | --p-warn-700 | runtime-variable | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `dark:enabled:active:text-danger-400` | --tw-text-opacity / color | `1 / color-mix(in srgb, var(--p-danger-400) calc(100% * var(--tw-text-opacity, 1)), transparent)` | --p-danger-400 | runtime-variable | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `dark:enabled:active:text-danger-950` | --tw-text-opacity / color | `1 / color-mix(in srgb, var(--p-danger-950) calc(100% * var(--tw-text-opacity, 1)), transparent)` | --p-danger-950 | runtime-variable | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `dark:enabled:active:text-help-400` | --tw-text-opacity / color | `1 / color-mix(in srgb, var(--p-help-400) calc(100% * var(--tw-text-opacity, 1)), transparent)` | --p-help-400 | runtime-variable | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `dark:enabled:active:text-help-950` | --tw-text-opacity / color | `1 / color-mix(in srgb, var(--p-help-950) calc(100% * var(--tw-text-opacity, 1)), transparent)` | --p-help-950 | runtime-variable | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `dark:enabled:active:text-info-400` | --tw-text-opacity / color | `1 / color-mix(in srgb, var(--p-info-400) calc(100% * var(--tw-text-opacity, 1)), transparent)` | --p-info-400 | runtime-variable | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `dark:enabled:active:text-info-950` | --tw-text-opacity / color | `1 / color-mix(in srgb, var(--p-info-950) calc(100% * var(--tw-text-opacity, 1)), transparent)` | --p-info-950 | runtime-variable | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `dark:enabled:active:text-primary` | --tw-text-opacity / color | `1 / color-mix(in srgb, var(--p-primary-color) calc(100% * var(--tw-text-opacity, 1)), transparent)` | --p-primary-color | runtime-variable | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `dark:enabled:active:text-success-400` | --tw-text-opacity / color | `1 / color-mix(in srgb, var(--p-success-400) calc(100% * var(--tw-text-opacity, 1)), transparent)` | --p-success-400 | runtime-variable | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `dark:enabled:active:text-success-950` | --tw-text-opacity / color | `1 / color-mix(in srgb, var(--p-success-950) calc(100% * var(--tw-text-opacity, 1)), transparent)` | --p-success-950 | runtime-variable | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `dark:enabled:active:text-surface-0` | --tw-text-opacity / color | `1 / color-mix(in srgb, var(--p-surface-0) calc(100% * var(--tw-text-opacity, 1)), transparent)` | --p-surface-0 | runtime-variable | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `dark:enabled:active:text-surface-100` | --tw-text-opacity / color | `1 / color-mix(in srgb, var(--p-surface-100) calc(100% * var(--tw-text-opacity, 1)), transparent)` | --p-surface-100 | runtime-variable | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `dark:enabled:active:text-surface-400` | --tw-text-opacity / color | `1 / color-mix(in srgb, var(--p-surface-400) calc(100% * var(--tw-text-opacity, 1)), transparent)` | --p-surface-400 | runtime-variable | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `dark:enabled:active:text-surface-950` | --tw-text-opacity / color | `1 / color-mix(in srgb, var(--p-surface-950) calc(100% * var(--tw-text-opacity, 1)), transparent)` | --p-surface-950 | runtime-variable | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `dark:enabled:active:text-warn-400` | --tw-text-opacity / color | `1 / color-mix(in srgb, var(--p-warn-400) calc(100% * var(--tw-text-opacity, 1)), transparent)` | --p-warn-400 | runtime-variable | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `dark:enabled:active:text-warn-950` | --tw-text-opacity / color | `1 / color-mix(in srgb, var(--p-warn-950) calc(100% * var(--tw-text-opacity, 1)), transparent)` | --p-warn-950 | runtime-variable | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `dark:enabled:focus:border-primary` | --tw-border-opacity / border-color | `1 / color-mix(in srgb, var(--p-primary-color) calc(100% * var(--tw-border-opacity, 1)), transparent)` | --p-primary-color | runtime-variable | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `dark:enabled:hover:bg-danger-300` | --tw-bg-opacity / background-color | `1 / color-mix(in srgb, var(--p-danger-300) calc(100% * var(--tw-bg-opacity, 1)), transparent)` | --p-danger-300 | runtime-variable | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `dark:enabled:hover:bg-danger-400/5` | background-color | `color-mix(in srgb, var(--p-danger-400) calc(100% * 0.05), transparent)` | --p-danger-400 | runtime-variable | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `dark:enabled:hover:bg-help-300` | --tw-bg-opacity / background-color | `1 / color-mix(in srgb, var(--p-help-300) calc(100% * var(--tw-bg-opacity, 1)), transparent)` | --p-help-300 | runtime-variable | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `dark:enabled:hover:bg-help-400/5` | background-color | `color-mix(in srgb, var(--p-help-400) calc(100% * 0.05), transparent)` | --p-help-400 | runtime-variable | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `dark:enabled:hover:bg-info-300` | --tw-bg-opacity / background-color | `1 / color-mix(in srgb, var(--p-info-300) calc(100% * var(--tw-bg-opacity, 1)), transparent)` | --p-info-300 | runtime-variable | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `dark:enabled:hover:bg-info-400/5` | background-color | `color-mix(in srgb, var(--p-info-400) calc(100% * 0.05), transparent)` | --p-info-400 | runtime-variable | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `dark:enabled:hover:bg-primary/5` | background-color | `color-mix(in srgb, var(--p-primary-color) calc(100% * 0.05), transparent)` | --p-primary-color | runtime-variable | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `dark:enabled:hover:bg-success-300` | --tw-bg-opacity / background-color | `1 / color-mix(in srgb, var(--p-success-300) calc(100% * var(--tw-bg-opacity, 1)), transparent)` | --p-success-300 | runtime-variable | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `dark:enabled:hover:bg-success-400/5` | background-color | `color-mix(in srgb, var(--p-success-400) calc(100% * 0.05), transparent)` | --p-success-400 | runtime-variable | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `dark:enabled:hover:bg-surface-100` | --tw-bg-opacity / background-color | `1 / color-mix(in srgb, var(--p-surface-100) calc(100% * var(--tw-bg-opacity, 1)), transparent)` | --p-surface-100 | runtime-variable | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `dark:enabled:hover:bg-surface-700` | --tw-bg-opacity / background-color | `1 / color-mix(in srgb, var(--p-surface-700) calc(100% * var(--tw-bg-opacity, 1)), transparent)` | --p-surface-700 | runtime-variable | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `dark:enabled:hover:bg-surface-800` | --tw-bg-opacity / background-color | `1 / color-mix(in srgb, var(--p-surface-800) calc(100% * var(--tw-bg-opacity, 1)), transparent)` | --p-surface-800 | runtime-variable | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `dark:enabled:hover:bg-warn-300` | --tw-bg-opacity / background-color | `1 / color-mix(in srgb, var(--p-warn-300) calc(100% * var(--tw-bg-opacity, 1)), transparent)` | --p-warn-300 | runtime-variable | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `dark:enabled:hover:bg-warn-400/5` | background-color | `color-mix(in srgb, var(--p-warn-400) calc(100% * 0.05), transparent)` | --p-warn-400 | runtime-variable | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `dark:enabled:hover:border-danger-300` | --tw-border-opacity / border-color | `1 / color-mix(in srgb, var(--p-danger-300) calc(100% * var(--tw-border-opacity, 1)), transparent)` | --p-danger-300 | runtime-variable | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `dark:enabled:hover:border-danger-700` | --tw-border-opacity / border-color | `1 / color-mix(in srgb, var(--p-danger-700) calc(100% * var(--tw-border-opacity, 1)), transparent)` | --p-danger-700 | runtime-variable | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `dark:enabled:hover:border-help-300` | --tw-border-opacity / border-color | `1 / color-mix(in srgb, var(--p-help-300) calc(100% * var(--tw-border-opacity, 1)), transparent)` | --p-help-300 | runtime-variable | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `dark:enabled:hover:border-help-700` | --tw-border-opacity / border-color | `1 / color-mix(in srgb, var(--p-help-700) calc(100% * var(--tw-border-opacity, 1)), transparent)` | --p-help-700 | runtime-variable | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `dark:enabled:hover:border-info-300` | --tw-border-opacity / border-color | `1 / color-mix(in srgb, var(--p-info-300) calc(100% * var(--tw-border-opacity, 1)), transparent)` | --p-info-300 | runtime-variable | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `dark:enabled:hover:border-info-700` | --tw-border-opacity / border-color | `1 / color-mix(in srgb, var(--p-info-700) calc(100% * var(--tw-border-opacity, 1)), transparent)` | --p-info-700 | runtime-variable | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `dark:enabled:hover:border-primary-700` | --tw-border-opacity / border-color | `1 / color-mix(in srgb, var(--p-primary-700) calc(100% * var(--tw-border-opacity, 1)), transparent)` | --p-primary-700 | runtime-variable | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `dark:enabled:hover:border-success-300` | --tw-border-opacity / border-color | `1 / color-mix(in srgb, var(--p-success-300) calc(100% * var(--tw-border-opacity, 1)), transparent)` | --p-success-300 | runtime-variable | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `dark:enabled:hover:border-success-700` | --tw-border-opacity / border-color | `1 / color-mix(in srgb, var(--p-success-700) calc(100% * var(--tw-border-opacity, 1)), transparent)` | --p-success-700 | runtime-variable | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `dark:enabled:hover:border-surface-200` | --tw-border-opacity / border-color | `1 / color-mix(in srgb, var(--p-surface-200) calc(100% * var(--tw-border-opacity, 1)), transparent)` | --p-surface-200 | runtime-variable | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `dark:enabled:hover:border-surface-500` | --tw-border-opacity / border-color | `1 / color-mix(in srgb, var(--p-surface-500) calc(100% * var(--tw-border-opacity, 1)), transparent)` | --p-surface-500 | runtime-variable | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `dark:enabled:hover:border-surface-600` | --tw-border-opacity / border-color | `1 / color-mix(in srgb, var(--p-surface-600) calc(100% * var(--tw-border-opacity, 1)), transparent)` | --p-surface-600 | runtime-variable | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `dark:enabled:hover:border-surface-700` | --tw-border-opacity / border-color | `1 / color-mix(in srgb, var(--p-surface-700) calc(100% * var(--tw-border-opacity, 1)), transparent)` | --p-surface-700 | runtime-variable | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `dark:enabled:hover:border-warn-300` | --tw-border-opacity / border-color | `1 / color-mix(in srgb, var(--p-warn-300) calc(100% * var(--tw-border-opacity, 1)), transparent)` | --p-warn-300 | runtime-variable | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `dark:enabled:hover:border-warn-700` | --tw-border-opacity / border-color | `1 / color-mix(in srgb, var(--p-warn-700) calc(100% * var(--tw-border-opacity, 1)), transparent)` | --p-warn-700 | runtime-variable | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `dark:enabled:hover:text-danger-400` | --tw-text-opacity / color | `1 / color-mix(in srgb, var(--p-danger-400) calc(100% * var(--tw-text-opacity, 1)), transparent)` | --p-danger-400 | runtime-variable | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `dark:enabled:hover:text-danger-950` | --tw-text-opacity / color | `1 / color-mix(in srgb, var(--p-danger-950) calc(100% * var(--tw-text-opacity, 1)), transparent)` | --p-danger-950 | runtime-variable | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `dark:enabled:hover:text-help-400` | --tw-text-opacity / color | `1 / color-mix(in srgb, var(--p-help-400) calc(100% * var(--tw-text-opacity, 1)), transparent)` | --p-help-400 | runtime-variable | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `dark:enabled:hover:text-help-950` | --tw-text-opacity / color | `1 / color-mix(in srgb, var(--p-help-950) calc(100% * var(--tw-text-opacity, 1)), transparent)` | --p-help-950 | runtime-variable | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `dark:enabled:hover:text-info-400` | --tw-text-opacity / color | `1 / color-mix(in srgb, var(--p-info-400) calc(100% * var(--tw-text-opacity, 1)), transparent)` | --p-info-400 | runtime-variable | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `dark:enabled:hover:text-info-950` | --tw-text-opacity / color | `1 / color-mix(in srgb, var(--p-info-950) calc(100% * var(--tw-text-opacity, 1)), transparent)` | --p-info-950 | runtime-variable | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `dark:enabled:hover:text-primary` | --tw-text-opacity / color | `1 / color-mix(in srgb, var(--p-primary-color) calc(100% * var(--tw-text-opacity, 1)), transparent)` | --p-primary-color | runtime-variable | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `dark:enabled:hover:text-success-400` | --tw-text-opacity / color | `1 / color-mix(in srgb, var(--p-success-400) calc(100% * var(--tw-text-opacity, 1)), transparent)` | --p-success-400 | runtime-variable | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `dark:enabled:hover:text-success-950` | --tw-text-opacity / color | `1 / color-mix(in srgb, var(--p-success-950) calc(100% * var(--tw-text-opacity, 1)), transparent)` | --p-success-950 | runtime-variable | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `dark:enabled:hover:text-surface-0` | --tw-text-opacity / color | `1 / color-mix(in srgb, var(--p-surface-0) calc(100% * var(--tw-text-opacity, 1)), transparent)` | --p-surface-0 | runtime-variable | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `dark:enabled:hover:text-surface-200` | --tw-text-opacity / color | `1 / color-mix(in srgb, var(--p-surface-200) calc(100% * var(--tw-text-opacity, 1)), transparent)` | --p-surface-200 | runtime-variable | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `dark:enabled:hover:text-surface-400` | --tw-text-opacity / color | `1 / color-mix(in srgb, var(--p-surface-400) calc(100% * var(--tw-text-opacity, 1)), transparent)` | --p-surface-400 | runtime-variable | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `dark:enabled:hover:text-surface-950` | --tw-text-opacity / color | `1 / color-mix(in srgb, var(--p-surface-950) calc(100% * var(--tw-text-opacity, 1)), transparent)` | --p-surface-950 | runtime-variable | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `dark:enabled:hover:text-warn-400` | --tw-text-opacity / color | `1 / color-mix(in srgb, var(--p-warn-400) calc(100% * var(--tw-text-opacity, 1)), transparent)` | --p-warn-400 | runtime-variable | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `dark:enabled:hover:text-warn-950` | --tw-text-opacity / color | `1 / color-mix(in srgb, var(--p-warn-950) calc(100% * var(--tw-text-opacity, 1)), transparent)` | --p-warn-950 | runtime-variable | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `dark:focus-visible:outline-danger-400` | outline-color | `color-mix(in srgb, var(--p-danger-400) calc(100% * 1), transparent)` | --p-danger-400 | runtime-variable | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `dark:focus-visible:outline-help-400` | outline-color | `color-mix(in srgb, var(--p-help-400) calc(100% * 1), transparent)` | --p-help-400 | runtime-variable | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `dark:focus-visible:outline-info-400` | outline-color | `color-mix(in srgb, var(--p-info-400) calc(100% * 1), transparent)` | --p-info-400 | runtime-variable | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `dark:focus-visible:outline-success-400` | outline-color | `color-mix(in srgb, var(--p-success-400) calc(100% * 1), transparent)` | --p-success-400 | runtime-variable | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `dark:focus-visible:outline-surface-0` | outline-color | `color-mix(in srgb, var(--p-surface-0) calc(100% * 1), transparent)` | --p-surface-0 | runtime-variable | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `dark:focus-visible:outline-surface-300` | outline-color | `color-mix(in srgb, var(--p-surface-300) calc(100% * 1), transparent)` | --p-surface-300 | runtime-variable | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `dark:focus-visible:outline-warn-400` | outline-color | `color-mix(in srgb, var(--p-warn-400) calc(100% * 1), transparent)` | --p-warn-400 | runtime-variable | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `dark:placeholder:text-surface-400` | --tw-text-opacity / color | `1 / color-mix(in srgb, var(--p-surface-400) calc(100% * var(--tw-text-opacity, 1)), transparent)` | --p-surface-400 | runtime-variable | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `dark:text-danger-400` | --tw-text-opacity / color | `1 / color-mix(in srgb, var(--p-danger-400) calc(100% * var(--tw-text-opacity, 1)), transparent)` | --p-danger-400 | runtime-variable | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `dark:text-danger-950` | --tw-text-opacity / color | `1 / color-mix(in srgb, var(--p-danger-950) calc(100% * var(--tw-text-opacity, 1)), transparent)` | --p-danger-950 | runtime-variable | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `dark:text-help-400` | --tw-text-opacity / color | `1 / color-mix(in srgb, var(--p-help-400) calc(100% * var(--tw-text-opacity, 1)), transparent)` | --p-help-400 | runtime-variable | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `dark:text-help-950` | --tw-text-opacity / color | `1 / color-mix(in srgb, var(--p-help-950) calc(100% * var(--tw-text-opacity, 1)), transparent)` | --p-help-950 | runtime-variable | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `dark:text-info-400` | --tw-text-opacity / color | `1 / color-mix(in srgb, var(--p-info-400) calc(100% * var(--tw-text-opacity, 1)), transparent)` | --p-info-400 | runtime-variable | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `dark:text-info-950` | --tw-text-opacity / color | `1 / color-mix(in srgb, var(--p-info-950) calc(100% * var(--tw-text-opacity, 1)), transparent)` | --p-info-950 | runtime-variable | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `dark:text-primary` | --tw-text-opacity / color | `1 / color-mix(in srgb, var(--p-primary-color) calc(100% * var(--tw-text-opacity, 1)), transparent)` | --p-primary-color | runtime-variable | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `dark:text-success-400` | --tw-text-opacity / color | `1 / color-mix(in srgb, var(--p-success-400) calc(100% * var(--tw-text-opacity, 1)), transparent)` | --p-success-400 | runtime-variable | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `dark:text-success-950` | --tw-text-opacity / color | `1 / color-mix(in srgb, var(--p-success-950) calc(100% * var(--tw-text-opacity, 1)), transparent)` | --p-success-950 | runtime-variable | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `dark:text-surface-0` | --tw-text-opacity / color | `1 / color-mix(in srgb, var(--p-surface-0) calc(100% * var(--tw-text-opacity, 1)), transparent)` | --p-surface-0 | runtime-variable | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `dark:text-surface-300` | --tw-text-opacity / color | `1 / color-mix(in srgb, var(--p-surface-300) calc(100% * var(--tw-text-opacity, 1)), transparent)` | --p-surface-300 | runtime-variable | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `dark:text-surface-400` | --tw-text-opacity / color | `1 / color-mix(in srgb, var(--p-surface-400) calc(100% * var(--tw-text-opacity, 1)), transparent)` | --p-surface-400 | runtime-variable | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `dark:text-surface-800` | --tw-text-opacity / color | `1 / color-mix(in srgb, var(--p-surface-800) calc(100% * var(--tw-text-opacity, 1)), transparent)` | --p-surface-800 | runtime-variable | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `dark:text-surface-900` | --tw-text-opacity / color | `1 / color-mix(in srgb, var(--p-surface-900) calc(100% * var(--tw-text-opacity, 1)), transparent)` | --p-surface-900 | runtime-variable | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `dark:text-surface-950` | --tw-text-opacity / color | `1 / color-mix(in srgb, var(--p-surface-950) calc(100% * var(--tw-text-opacity, 1)), transparent)` | --p-surface-950 | runtime-variable | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `dark:text-warn-400` | --tw-text-opacity / color | `1 / color-mix(in srgb, var(--p-warn-400) calc(100% * var(--tw-text-opacity, 1)), transparent)` | --p-warn-400 | runtime-variable | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `dark:text-warn-950` | --tw-text-opacity / color | `1 / color-mix(in srgb, var(--p-warn-950) calc(100% * var(--tw-text-opacity, 1)), transparent)` | --p-warn-950 | runtime-variable | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `disabled:bg-surface-200` | --tw-bg-opacity / background-color | `1 / color-mix(in srgb, var(--p-surface-200) calc(100% * var(--tw-bg-opacity, 1)), transparent)` | --p-surface-200 | runtime-variable | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `disabled:text-surface-500` | --tw-text-opacity / color | `1 / color-mix(in srgb, var(--p-surface-500) calc(100% * var(--tw-text-opacity, 1)), transparent)` | --p-surface-500 | runtime-variable | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `enabled:active:bg-danger-100` | --tw-bg-opacity / background-color | `1 / color-mix(in srgb, var(--p-danger-100) calc(100% * var(--tw-bg-opacity, 1)), transparent)` | --p-danger-100 | runtime-variable | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `enabled:active:bg-danger-700` | --tw-bg-opacity / background-color | `1 / color-mix(in srgb, var(--p-danger-700) calc(100% * var(--tw-bg-opacity, 1)), transparent)` | --p-danger-700 | runtime-variable | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `enabled:active:bg-help-100` | --tw-bg-opacity / background-color | `1 / color-mix(in srgb, var(--p-help-100) calc(100% * var(--tw-bg-opacity, 1)), transparent)` | --p-help-100 | runtime-variable | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `enabled:active:bg-help-700` | --tw-bg-opacity / background-color | `1 / color-mix(in srgb, var(--p-help-700) calc(100% * var(--tw-bg-opacity, 1)), transparent)` | --p-help-700 | runtime-variable | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `enabled:active:bg-info-100` | --tw-bg-opacity / background-color | `1 / color-mix(in srgb, var(--p-info-100) calc(100% * var(--tw-bg-opacity, 1)), transparent)` | --p-info-100 | runtime-variable | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `enabled:active:bg-info-700` | --tw-bg-opacity / background-color | `1 / color-mix(in srgb, var(--p-info-700) calc(100% * var(--tw-bg-opacity, 1)), transparent)` | --p-info-700 | runtime-variable | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `enabled:active:bg-primary-100` | --tw-bg-opacity / background-color | `1 / color-mix(in srgb, var(--p-primary-100) calc(100% * var(--tw-bg-opacity, 1)), transparent)` | --p-primary-100 | runtime-variable | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `enabled:active:bg-primary-emphasis-alt` | --tw-bg-opacity / background-color | `1 / color-mix(in srgb, var(--p-primary-active-color) calc(100% * var(--tw-bg-opacity, 1)), transparent)` | --p-primary-active-color | runtime-variable | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `enabled:active:bg-success-100` | --tw-bg-opacity / background-color | `1 / color-mix(in srgb, var(--p-success-100) calc(100% * var(--tw-bg-opacity, 1)), transparent)` | --p-success-100 | runtime-variable | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `enabled:active:bg-success-700` | --tw-bg-opacity / background-color | `1 / color-mix(in srgb, var(--p-success-700) calc(100% * var(--tw-bg-opacity, 1)), transparent)` | --p-success-700 | runtime-variable | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `enabled:active:bg-surface-100` | --tw-bg-opacity / background-color | `1 / color-mix(in srgb, var(--p-surface-100) calc(100% * var(--tw-bg-opacity, 1)), transparent)` | --p-surface-100 | runtime-variable | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `enabled:active:bg-surface-300` | --tw-bg-opacity / background-color | `1 / color-mix(in srgb, var(--p-surface-300) calc(100% * var(--tw-bg-opacity, 1)), transparent)` | --p-surface-300 | runtime-variable | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `enabled:active:bg-surface-800` | --tw-bg-opacity / background-color | `1 / color-mix(in srgb, var(--p-surface-800) calc(100% * var(--tw-bg-opacity, 1)), transparent)` | --p-surface-800 | runtime-variable | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `enabled:active:bg-warn-100` | --tw-bg-opacity / background-color | `1 / color-mix(in srgb, var(--p-warn-100) calc(100% * var(--tw-bg-opacity, 1)), transparent)` | --p-warn-100 | runtime-variable | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `enabled:active:bg-warn-700` | --tw-bg-opacity / background-color | `1 / color-mix(in srgb, var(--p-warn-700) calc(100% * var(--tw-bg-opacity, 1)), transparent)` | --p-warn-700 | runtime-variable | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `enabled:active:border-danger-200` | --tw-border-opacity / border-color | `1 / color-mix(in srgb, var(--p-danger-200) calc(100% * var(--tw-border-opacity, 1)), transparent)` | --p-danger-200 | runtime-variable | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `enabled:active:border-danger-700` | --tw-border-opacity / border-color | `1 / color-mix(in srgb, var(--p-danger-700) calc(100% * var(--tw-border-opacity, 1)), transparent)` | --p-danger-700 | runtime-variable | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `enabled:active:border-help-200` | --tw-border-opacity / border-color | `1 / color-mix(in srgb, var(--p-help-200) calc(100% * var(--tw-border-opacity, 1)), transparent)` | --p-help-200 | runtime-variable | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `enabled:active:border-help-700` | --tw-border-opacity / border-color | `1 / color-mix(in srgb, var(--p-help-700) calc(100% * var(--tw-border-opacity, 1)), transparent)` | --p-help-700 | runtime-variable | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `enabled:active:border-info-200` | --tw-border-opacity / border-color | `1 / color-mix(in srgb, var(--p-info-200) calc(100% * var(--tw-border-opacity, 1)), transparent)` | --p-info-200 | runtime-variable | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `enabled:active:border-info-700` | --tw-border-opacity / border-color | `1 / color-mix(in srgb, var(--p-info-700) calc(100% * var(--tw-border-opacity, 1)), transparent)` | --p-info-700 | runtime-variable | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `enabled:active:border-primary-200` | --tw-border-opacity / border-color | `1 / color-mix(in srgb, var(--p-primary-200) calc(100% * var(--tw-border-opacity, 1)), transparent)` | --p-primary-200 | runtime-variable | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `enabled:active:border-primary-emphasis-alt` | --tw-border-opacity / border-color | `1 / color-mix(in srgb, var(--p-primary-active-color) calc(100% * var(--tw-border-opacity, 1)), transparent)` | --p-primary-active-color | runtime-variable | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `enabled:active:border-success-200` | --tw-border-opacity / border-color | `1 / color-mix(in srgb, var(--p-success-200) calc(100% * var(--tw-border-opacity, 1)), transparent)` | --p-success-200 | runtime-variable | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `enabled:active:border-success-700` | --tw-border-opacity / border-color | `1 / color-mix(in srgb, var(--p-success-700) calc(100% * var(--tw-border-opacity, 1)), transparent)` | --p-success-700 | runtime-variable | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `enabled:active:border-surface-200` | --tw-border-opacity / border-color | `1 / color-mix(in srgb, var(--p-surface-200) calc(100% * var(--tw-border-opacity, 1)), transparent)` | --p-surface-200 | runtime-variable | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `enabled:active:border-surface-300` | --tw-border-opacity / border-color | `1 / color-mix(in srgb, var(--p-surface-300) calc(100% * var(--tw-border-opacity, 1)), transparent)` | --p-surface-300 | runtime-variable | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `enabled:active:border-surface-700` | --tw-border-opacity / border-color | `1 / color-mix(in srgb, var(--p-surface-700) calc(100% * var(--tw-border-opacity, 1)), transparent)` | --p-surface-700 | runtime-variable | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `enabled:active:border-surface-800` | --tw-border-opacity / border-color | `1 / color-mix(in srgb, var(--p-surface-800) calc(100% * var(--tw-border-opacity, 1)), transparent)` | --p-surface-800 | runtime-variable | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `enabled:active:border-warn-200` | --tw-border-opacity / border-color | `1 / color-mix(in srgb, var(--p-warn-200) calc(100% * var(--tw-border-opacity, 1)), transparent)` | --p-warn-200 | runtime-variable | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `enabled:active:border-warn-700` | --tw-border-opacity / border-color | `1 / color-mix(in srgb, var(--p-warn-700) calc(100% * var(--tw-border-opacity, 1)), transparent)` | --p-warn-700 | runtime-variable | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `enabled:active:text-danger-500` | --tw-text-opacity / color | `1 / color-mix(in srgb, var(--p-danger-500) calc(100% * var(--tw-text-opacity, 1)), transparent)` | --p-danger-500 | runtime-variable | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `enabled:active:text-help-500` | --tw-text-opacity / color | `1 / color-mix(in srgb, var(--p-help-500) calc(100% * var(--tw-text-opacity, 1)), transparent)` | --p-help-500 | runtime-variable | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `enabled:active:text-info-500` | --tw-text-opacity / color | `1 / color-mix(in srgb, var(--p-info-500) calc(100% * var(--tw-text-opacity, 1)), transparent)` | --p-info-500 | runtime-variable | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `enabled:active:text-primary` | --tw-text-opacity / color | `1 / color-mix(in srgb, var(--p-primary-color) calc(100% * var(--tw-text-opacity, 1)), transparent)` | --p-primary-color | runtime-variable | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `enabled:active:text-success-500` | --tw-text-opacity / color | `1 / color-mix(in srgb, var(--p-success-500) calc(100% * var(--tw-text-opacity, 1)), transparent)` | --p-success-500 | runtime-variable | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `enabled:active:text-surface-500` | --tw-text-opacity / color | `1 / color-mix(in srgb, var(--p-surface-500) calc(100% * var(--tw-text-opacity, 1)), transparent)` | --p-surface-500 | runtime-variable | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `enabled:active:text-surface-700` | --tw-text-opacity / color | `1 / color-mix(in srgb, var(--p-surface-700) calc(100% * var(--tw-text-opacity, 1)), transparent)` | --p-surface-700 | runtime-variable | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `enabled:active:text-surface-800` | --tw-text-opacity / color | `1 / color-mix(in srgb, var(--p-surface-800) calc(100% * var(--tw-text-opacity, 1)), transparent)` | --p-surface-800 | runtime-variable | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `enabled:active:text-surface-950` | --tw-text-opacity / color | `1 / color-mix(in srgb, var(--p-surface-950) calc(100% * var(--tw-text-opacity, 1)), transparent)` | --p-surface-950 | runtime-variable | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `enabled:active:text-warn-500` | --tw-text-opacity / color | `1 / color-mix(in srgb, var(--p-warn-500) calc(100% * var(--tw-text-opacity, 1)), transparent)` | --p-warn-500 | runtime-variable | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `enabled:focus:border-primary` | --tw-border-opacity / border-color | `1 / color-mix(in srgb, var(--p-primary-color) calc(100% * var(--tw-border-opacity, 1)), transparent)` | --p-primary-color | runtime-variable | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `enabled:hover:bg-danger-50` | --tw-bg-opacity / background-color | `1 / color-mix(in srgb, var(--p-danger-50) calc(100% * var(--tw-bg-opacity, 1)), transparent)` | --p-danger-50 | runtime-variable | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `enabled:hover:bg-danger-600` | --tw-bg-opacity / background-color | `1 / color-mix(in srgb, var(--p-danger-600) calc(100% * var(--tw-bg-opacity, 1)), transparent)` | --p-danger-600 | runtime-variable | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `enabled:hover:bg-help-50` | --tw-bg-opacity / background-color | `1 / color-mix(in srgb, var(--p-help-50) calc(100% * var(--tw-bg-opacity, 1)), transparent)` | --p-help-50 | runtime-variable | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `enabled:hover:bg-help-600` | --tw-bg-opacity / background-color | `1 / color-mix(in srgb, var(--p-help-600) calc(100% * var(--tw-bg-opacity, 1)), transparent)` | --p-help-600 | runtime-variable | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `enabled:hover:bg-info-50` | --tw-bg-opacity / background-color | `1 / color-mix(in srgb, var(--p-info-50) calc(100% * var(--tw-bg-opacity, 1)), transparent)` | --p-info-50 | runtime-variable | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `enabled:hover:bg-info-600` | --tw-bg-opacity / background-color | `1 / color-mix(in srgb, var(--p-info-600) calc(100% * var(--tw-bg-opacity, 1)), transparent)` | --p-info-600 | runtime-variable | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `enabled:hover:bg-primary-50` | --tw-bg-opacity / background-color | `1 / color-mix(in srgb, var(--p-primary-50) calc(100% * var(--tw-bg-opacity, 1)), transparent)` | --p-primary-50 | runtime-variable | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `enabled:hover:bg-primary-emphasis` | --tw-bg-opacity / background-color | `1 / color-mix(in srgb, var(--p-primary-hover-color) calc(100% * var(--tw-bg-opacity, 1)), transparent)` | --p-primary-hover-color | runtime-variable | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `enabled:hover:bg-success-50` | --tw-bg-opacity / background-color | `1 / color-mix(in srgb, var(--p-success-50) calc(100% * var(--tw-bg-opacity, 1)), transparent)` | --p-success-50 | runtime-variable | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `enabled:hover:bg-success-600` | --tw-bg-opacity / background-color | `1 / color-mix(in srgb, var(--p-success-600) calc(100% * var(--tw-bg-opacity, 1)), transparent)` | --p-success-600 | runtime-variable | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `enabled:hover:bg-surface-200` | --tw-bg-opacity / background-color | `1 / color-mix(in srgb, var(--p-surface-200) calc(100% * var(--tw-bg-opacity, 1)), transparent)` | --p-surface-200 | runtime-variable | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `enabled:hover:bg-surface-50` | --tw-bg-opacity / background-color | `1 / color-mix(in srgb, var(--p-surface-50) calc(100% * var(--tw-bg-opacity, 1)), transparent)` | --p-surface-50 | runtime-variable | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `enabled:hover:bg-surface-900` | --tw-bg-opacity / background-color | `1 / color-mix(in srgb, var(--p-surface-900) calc(100% * var(--tw-bg-opacity, 1)), transparent)` | --p-surface-900 | runtime-variable | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `enabled:hover:bg-warn-50` | --tw-bg-opacity / background-color | `1 / color-mix(in srgb, var(--p-warn-50) calc(100% * var(--tw-bg-opacity, 1)), transparent)` | --p-warn-50 | runtime-variable | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `enabled:hover:bg-warn-600` | --tw-bg-opacity / background-color | `1 / color-mix(in srgb, var(--p-warn-600) calc(100% * var(--tw-bg-opacity, 1)), transparent)` | --p-warn-600 | runtime-variable | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `enabled:hover:border-danger-200` | --tw-border-opacity / border-color | `1 / color-mix(in srgb, var(--p-danger-200) calc(100% * var(--tw-border-opacity, 1)), transparent)` | --p-danger-200 | runtime-variable | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `enabled:hover:border-danger-600` | --tw-border-opacity / border-color | `1 / color-mix(in srgb, var(--p-danger-600) calc(100% * var(--tw-border-opacity, 1)), transparent)` | --p-danger-600 | runtime-variable | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `enabled:hover:border-help-200` | --tw-border-opacity / border-color | `1 / color-mix(in srgb, var(--p-help-200) calc(100% * var(--tw-border-opacity, 1)), transparent)` | --p-help-200 | runtime-variable | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `enabled:hover:border-help-600` | --tw-border-opacity / border-color | `1 / color-mix(in srgb, var(--p-help-600) calc(100% * var(--tw-border-opacity, 1)), transparent)` | --p-help-600 | runtime-variable | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `enabled:hover:border-info-200` | --tw-border-opacity / border-color | `1 / color-mix(in srgb, var(--p-info-200) calc(100% * var(--tw-border-opacity, 1)), transparent)` | --p-info-200 | runtime-variable | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `enabled:hover:border-info-600` | --tw-border-opacity / border-color | `1 / color-mix(in srgb, var(--p-info-600) calc(100% * var(--tw-border-opacity, 1)), transparent)` | --p-info-600 | runtime-variable | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `enabled:hover:border-primary-200` | --tw-border-opacity / border-color | `1 / color-mix(in srgb, var(--p-primary-200) calc(100% * var(--tw-border-opacity, 1)), transparent)` | --p-primary-200 | runtime-variable | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `enabled:hover:border-primary-emphasis` | --tw-border-opacity / border-color | `1 / color-mix(in srgb, var(--p-primary-hover-color) calc(100% * var(--tw-border-opacity, 1)), transparent)` | --p-primary-hover-color | runtime-variable | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `enabled:hover:border-success-200` | --tw-border-opacity / border-color | `1 / color-mix(in srgb, var(--p-success-200) calc(100% * var(--tw-border-opacity, 1)), transparent)` | --p-success-200 | runtime-variable | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `enabled:hover:border-success-600` | --tw-border-opacity / border-color | `1 / color-mix(in srgb, var(--p-success-600) calc(100% * var(--tw-border-opacity, 1)), transparent)` | --p-success-600 | runtime-variable | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `enabled:hover:border-surface-200` | --tw-border-opacity / border-color | `1 / color-mix(in srgb, var(--p-surface-200) calc(100% * var(--tw-border-opacity, 1)), transparent)` | --p-surface-200 | runtime-variable | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `enabled:hover:border-surface-400` | --tw-border-opacity / border-color | `1 / color-mix(in srgb, var(--p-surface-400) calc(100% * var(--tw-border-opacity, 1)), transparent)` | --p-surface-400 | runtime-variable | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `enabled:hover:border-surface-700` | --tw-border-opacity / border-color | `1 / color-mix(in srgb, var(--p-surface-700) calc(100% * var(--tw-border-opacity, 1)), transparent)` | --p-surface-700 | runtime-variable | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `enabled:hover:border-surface-900` | --tw-border-opacity / border-color | `1 / color-mix(in srgb, var(--p-surface-900) calc(100% * var(--tw-border-opacity, 1)), transparent)` | --p-surface-900 | runtime-variable | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `enabled:hover:border-warn-200` | --tw-border-opacity / border-color | `1 / color-mix(in srgb, var(--p-warn-200) calc(100% * var(--tw-border-opacity, 1)), transparent)` | --p-warn-200 | runtime-variable | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `enabled:hover:border-warn-600` | --tw-border-opacity / border-color | `1 / color-mix(in srgb, var(--p-warn-600) calc(100% * var(--tw-border-opacity, 1)), transparent)` | --p-warn-600 | runtime-variable | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `enabled:hover:text-danger-500` | --tw-text-opacity / color | `1 / color-mix(in srgb, var(--p-danger-500) calc(100% * var(--tw-text-opacity, 1)), transparent)` | --p-danger-500 | runtime-variable | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `enabled:hover:text-help-500` | --tw-text-opacity / color | `1 / color-mix(in srgb, var(--p-help-500) calc(100% * var(--tw-text-opacity, 1)), transparent)` | --p-help-500 | runtime-variable | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `enabled:hover:text-info-500` | --tw-text-opacity / color | `1 / color-mix(in srgb, var(--p-info-500) calc(100% * var(--tw-text-opacity, 1)), transparent)` | --p-info-500 | runtime-variable | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `enabled:hover:text-primary` | --tw-text-opacity / color | `1 / color-mix(in srgb, var(--p-primary-color) calc(100% * var(--tw-text-opacity, 1)), transparent)` | --p-primary-color | runtime-variable | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `enabled:hover:text-success-500` | --tw-text-opacity / color | `1 / color-mix(in srgb, var(--p-success-500) calc(100% * var(--tw-text-opacity, 1)), transparent)` | --p-success-500 | runtime-variable | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `enabled:hover:text-surface-500` | --tw-text-opacity / color | `1 / color-mix(in srgb, var(--p-surface-500) calc(100% * var(--tw-text-opacity, 1)), transparent)` | --p-surface-500 | runtime-variable | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `enabled:hover:text-surface-700` | --tw-text-opacity / color | `1 / color-mix(in srgb, var(--p-surface-700) calc(100% * var(--tw-text-opacity, 1)), transparent)` | --p-surface-700 | runtime-variable | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `enabled:hover:text-surface-950` | --tw-text-opacity / color | `1 / color-mix(in srgb, var(--p-surface-950) calc(100% * var(--tw-text-opacity, 1)), transparent)` | --p-surface-950 | runtime-variable | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `enabled:hover:text-warn-500` | --tw-text-opacity / color | `1 / color-mix(in srgb, var(--p-warn-500) calc(100% * var(--tw-text-opacity, 1)), transparent)` | --p-warn-500 | runtime-variable | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `focus-visible:outline-danger-500` | outline-color | `color-mix(in srgb, var(--p-danger-500) calc(100% * 1), transparent)` | --p-danger-500 | runtime-variable | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `focus-visible:outline-help-500` | outline-color | `color-mix(in srgb, var(--p-help-500) calc(100% * 1), transparent)` | --p-help-500 | runtime-variable | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `focus-visible:outline-info-500` | outline-color | `color-mix(in srgb, var(--p-info-500) calc(100% * 1), transparent)` | --p-info-500 | runtime-variable | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `focus-visible:outline-primary` | outline-color | `color-mix(in srgb, var(--p-primary-color) calc(100% * 1), transparent)` | --p-primary-color | runtime-variable | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `focus-visible:outline-success-500` | outline-color | `color-mix(in srgb, var(--p-success-500) calc(100% * 1), transparent)` | --p-success-500 | runtime-variable | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `focus-visible:outline-surface-600` | outline-color | `color-mix(in srgb, var(--p-surface-600) calc(100% * 1), transparent)` | --p-surface-600 | runtime-variable | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `focus-visible:outline-surface-950` | outline-color | `color-mix(in srgb, var(--p-surface-950) calc(100% * 1), transparent)` | --p-surface-950 | runtime-variable | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `focus-visible:outline-warn-500` | outline-color | `color-mix(in srgb, var(--p-warn-500) calc(100% * 1), transparent)` | --p-warn-500 | runtime-variable | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `placeholder:text-surface-500` | --tw-text-opacity / color | `1 / color-mix(in srgb, var(--p-surface-500) calc(100% * var(--tw-text-opacity, 1)), transparent)` | --p-surface-500 | runtime-variable | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `rounded-border` | border-radius | `var(--p-content-border-radius)` | --p-content-border-radius | runtime-variable | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | public | 汎用コンテンツの角丸。フォームコントロールの角丸を自動的に表すものではない |
| `text-color` | color | `var(--p-text-color)` | --p-text-color | runtime-variable | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | public | 主要なコンテンツテキスト |
| `text-color-emphasis` | color | `var(--p-text-hover-color)` | --p-text-hover-color | runtime-variable | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | public | 強調されたコンテンツテキスト |
| `text-danger-500` | --tw-text-opacity / color | `1 / color-mix(in srgb, var(--p-danger-500) calc(100% * var(--tw-text-opacity, 1)), transparent)` | --p-danger-500 | runtime-variable | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `text-help-500` | --tw-text-opacity / color | `1 / color-mix(in srgb, var(--p-help-500) calc(100% * var(--tw-text-opacity, 1)), transparent)` | --p-help-500 | runtime-variable | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `text-info-500` | --tw-text-opacity / color | `1 / color-mix(in srgb, var(--p-info-500) calc(100% * var(--tw-text-opacity, 1)), transparent)` | --p-info-500 | runtime-variable | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `text-muted-color` | color | `var(--p-text-muted-color)` | --p-text-muted-color | runtime-variable | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | public | 副次的なコンテンツテキスト |
| `text-muted-color-emphasis` | color | `var(--p-text-hover-muted-color)` | --p-text-hover-muted-color | runtime-variable | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | public | 強調された副次テキスト |
| `text-primary` | --tw-text-opacity / color | `1 / color-mix(in srgb, var(--p-primary-color) calc(100% * var(--tw-text-opacity, 1)), transparent)` | --p-primary-color | runtime-variable | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | public | デフォルトの主要アクションと強調の色 |
| `text-primary-contrast` | --tw-text-opacity / color | `1 / color-mix(in srgb, var(--p-primary-contrast-color) calc(100% * var(--tw-text-opacity, 1)), transparent)` | --p-primary-contrast-color | runtime-variable | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | public | primaryの背景と対になる前景色 |
| `text-primary-emphasis` | --tw-text-opacity / color | `1 / color-mix(in srgb, var(--p-primary-hover-color) calc(100% * var(--tw-text-opacity, 1)), transparent)` | --p-primary-hover-color | runtime-variable | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `text-success-500` | --tw-text-opacity / color | `1 / color-mix(in srgb, var(--p-success-500) calc(100% * var(--tw-text-opacity, 1)), transparent)` | --p-success-500 | runtime-variable | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `text-surface-500` | --tw-text-opacity / color | `1 / color-mix(in srgb, var(--p-surface-500) calc(100% * var(--tw-text-opacity, 1)), transparent)` | --p-surface-500 | runtime-variable | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `text-surface-600` | --tw-text-opacity / color | `1 / color-mix(in srgb, var(--p-surface-600) calc(100% * var(--tw-text-opacity, 1)), transparent)` | --p-surface-600 | runtime-variable | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `text-surface-700` | --tw-text-opacity / color | `1 / color-mix(in srgb, var(--p-surface-700) calc(100% * var(--tw-text-opacity, 1)), transparent)` | --p-surface-700 | runtime-variable | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `text-surface-950` | --tw-text-opacity / color | `1 / color-mix(in srgb, var(--p-surface-950) calc(100% * var(--tw-text-opacity, 1)), transparent)` | --p-surface-950 | runtime-variable | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `text-warn-500` | --tw-text-opacity / color | `1 / color-mix(in srgb, var(--p-warn-500) calc(100% * var(--tw-text-opacity, 1)), transparent)` | --p-warn-500 | runtime-variable | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |

### コンパイル時のベースライン

> ビルド時のベースライン。この値はモジュールバンドルに埋め込まれ、ファサードのテーマ変更には反応しません。

| ユーティリティ | CSSプロパティ | 解決後の値 | ランタイム依存 | 分類 | 許可される利用側 | 安定性 | 想定される用途 |
|---|---|---|---|---|---|---|---|
| `absolute` | position | `absolute` | none | compile-time-constant | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `appearance-none` | appearance | `none` | none | compile-time-constant | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `bg-transparent` | background-color | `transparent` | none | compile-time-constant | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `border` | border-width | `1px` | none | compile-time-constant | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `border-transparent` | border-color | `transparent` | none | compile-time-constant | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `cursor-pointer` | cursor | `pointer` | none | compile-time-constant | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `dark:bg-transparent` | background-color | `transparent` | none | compile-time-constant | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `dark:border-transparent` | border-color | `transparent` | none | compile-time-constant | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `dark:enabled:active:bg-white/15` | background-color | `rgb(255 255 255 / 0.15)` | none | compile-time-constant | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `dark:enabled:active:border-transparent` | border-color | `transparent` | none | compile-time-constant | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `dark:enabled:hover:bg-white/5` | background-color | `rgb(255 255 255 / 0.05)` | none | compile-time-constant | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `dark:enabled:hover:border-transparent` | border-color | `transparent` | none | compile-time-constant | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `disabled:cursor-default` | cursor | `default` | none | compile-time-constant | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `disabled:opacity-100` | opacity | `1` | none | compile-time-constant | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `duration-200` | transition-duration | `200ms` | none | compile-time-constant | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | platform-invariant-only | Tailwindの静的なモーションのベースライン |
| `ease-in-out` | transition-timing-function | `cubic-bezier(0.4, 0, 0.2, 1)` | none | compile-time-constant | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | platform-invariant-only | Tailwindの静的なタイミングのベースライン |
| `enabled:active:bg-transparent` | background-color | `transparent` | none | compile-time-constant | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `enabled:active:border-transparent` | border-color | `transparent` | none | compile-time-constant | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `enabled:active:text-white` | --tw-text-opacity / color | `1 / rgb(255 255 255 / var(--tw-text-opacity, 1))` | none | compile-time-constant | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `enabled:hover:bg-transparent` | background-color | `transparent` | none | compile-time-constant | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `enabled:hover:border-transparent` | border-color | `transparent` | none | compile-time-constant | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `enabled:hover:text-white` | --tw-text-opacity / color | `1 / rgb(255 255 255 / var(--tw-text-opacity, 1))` | none | compile-time-constant | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `flex` | display | `flex` | none | compile-time-constant | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `flex-col` | flex-direction | `column` | none | compile-time-constant | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `focus-visible:outline` | outline-style | `solid` | none | compile-time-constant | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `focus-visible:outline-1` | outline-width | `1px` | none | compile-time-constant | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `focus-visible:outline-offset-2` | outline-offset | `2px` | none | compile-time-constant | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `font-medium` | font-weight | `500` | none | compile-time-constant | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `gap-0` | gap | `0px` | none | compile-time-constant | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `gap-2` | gap | `0.5rem` | none | compile-time-constant | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | platform-invariant-only | Tailwindの静的なスペーシングのベースライン |
| `h-10` | height | `2.5rem` | none | compile-time-constant | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `h-4` | height | `1rem` | none | compile-time-constant | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `h-6` | height | `1.5rem` | none | compile-time-constant | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | platform-invariant-only | Tailwindの静的なサイズのベースライン |
| `h-full` | height | `100%` | none | compile-time-constant | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `inline-block` | display | `inline-block` | none | compile-time-constant | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `inline-flex` | display | `inline-flex` | none | compile-time-constant | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `invisible` | visibility | `hidden` | none | compile-time-constant | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `items-center` | align-items | `center` | none | compile-time-constant | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `justify-center` | justify-content | `center` | none | compile-time-constant | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `leading-4` | line-height | `1rem` | none | compile-time-constant | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `m-0` | margin | `0px` | none | compile-time-constant | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `min-w-4` | min-width | `1rem` | none | compile-time-constant | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `opacity-0` | opacity | `0` | none | compile-time-constant | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `opacity-100` | opacity | `1` | none | compile-time-constant | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `order-1` | order | `1` | none | compile-time-constant | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `order-2` | order | `2` | none | compile-time-constant | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `order-[-1]` | order | `-1` | none | compile-time-constant | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `outline-1` | outline-width | `1px` | none | compile-time-constant | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | platform-invariant-only | Tailwindの静的なフォーカスジオメトリのベースライン |
| `outline-none` | outline / outline-offset | `2px solid transparent / 2px` | none | compile-time-constant | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `outline-offset-2` | outline-offset | `2px` | none | compile-time-constant | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | platform-invariant-only | Tailwindの静的なフォーカスジオメトリのベースライン |
| `overflow-hidden` | overflow | `hidden` | none | compile-time-constant | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `p-0` | padding | `0px` | none | compile-time-constant | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `px-0` | padding-left / padding-right | `0px / 0px` | none | compile-time-constant | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `px-2` | padding-left / padding-right | `0.5rem / 0.5rem` | none | compile-time-constant | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `px-3` | padding-left / padding-right | `0.75rem / 0.75rem` | none | compile-time-constant | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | platform-invariant-only | Tailwindの静的なスペーシングのベースライン |
| `px-[0.625rem]` | padding-left / padding-right | `0.625rem / 0.625rem` | none | compile-time-constant | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `px-[0.875rem]` | padding-left / padding-right | `0.875rem / 0.875rem` | none | compile-time-constant | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `py-1` | padding-top / padding-bottom | `0.25rem / 0.25rem` | none | compile-time-constant | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `py-2` | padding-top / padding-bottom | `0.5rem / 0.5rem` | none | compile-time-constant | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | platform-invariant-only | Tailwindの静的なスペーシングのベースライン |
| `py-[0.375rem]` | padding-top / padding-bottom | `0.375rem / 0.375rem` | none | compile-time-constant | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `py-[0.625rem]` | padding-top / padding-bottom | `0.625rem / 0.625rem` | none | compile-time-constant | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `relative` | position | `relative` | none | compile-time-constant | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `rounded-[2rem]` | border-radius | `2rem` | none | compile-time-constant | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `rounded-full` | border-radius | `9999px` | none | compile-time-constant | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `rounded-md` | border-radius | `0.375rem` | none | compile-time-constant | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | platform-invariant-only | Tailwindの静的な角丸のベースライン |
| `select-none` | user-select | `none` | none | compile-time-constant | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `shadow-[0_3px_1px_-2px_rgba(0,0,0,0.2),0_2px_2px_0_rgba(0,0,0,0.14),0_1px_5px_0_rgba(0,0,0,0.12)]` | --tw-shadow / --tw-shadow-colored / box-shadow | `0 3px 1px -2px rgba(0,0,0,0.2),0 2px 2px 0 rgba(0,0,0,0.14),0 1px 5px 0 rgba(0,0,0,0.12) / 0 3px 1px -2px var(--tw-shadow-color), 0 2px 2px 0 var(--tw-shadow-color), 0 1px 5px 0 var(--tw-shadow-color) / var(--tw-ring-offset-shadow, 0 0 #0000), var(--tw-ring-shadow, 0 0 #0000), var(--tw-shadow)` | none | compile-time-constant | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `start-0` | inset-inline-start | `0px` | none | compile-time-constant | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `text-[1.125rem]` | font-size | `1.125rem` | none | compile-time-constant | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `text-lg` | font-size / line-height | `1.125rem / 1.75rem` | none | compile-time-constant | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `text-sm` | font-size / line-height | `0.875rem / 1.25rem` | none | compile-time-constant | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | platform-invariant-only | Tailwindの静的なタイポグラフィのベースライン |
| `text-white` | --tw-text-opacity / color | `1 / rgb(255 255 255 / var(--tw-text-opacity, 1))` | none | compile-time-constant | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `text-xs` | font-size / line-height | `0.75rem / 1rem` | none | compile-time-constant | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `top-0` | top | `0px` | none | compile-time-constant | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `top-1/2` | top | `50%` | none | compile-time-constant | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `transition-[background,color,left]` | transition-property / transition-timing-function / transition-duration | `background,color,left / cubic-bezier(0.4, 0, 0.2, 1) / 150ms` | none | compile-time-constant | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `transition-colors` | transition-property / transition-timing-function / transition-duration | `color, background-color, border-color, text-decoration-color, fill, stroke / cubic-bezier(0.4, 0, 0.2, 1) / 150ms` | none | compile-time-constant | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `underline` | text-decoration-line | `underline` | none | compile-time-constant | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `w-0` | width | `0px` | none | compile-time-constant | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `w-10` | width | `2.5rem` | none | compile-time-constant | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | platform-invariant-only | Tailwindの静的なサイズのベースライン |
| `w-full` | width | `100%` | none | compile-time-constant | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |
| `z-10` | z-index | `10` | none | compile-time-constant | セマンティックな用途が一致する場合はポータブルモジュール。固定値は不変性のレビュー後のみ | generated-representative | 代表的なユーティリティ。セマンティックな用途は利用側で確認すること |

### 内部用または一時的なユーティリティ

| ユーティリティ | CSSプロパティ | 解決後の値 | ランタイム依存 | 分類 | 許可される利用側 | 安定性 | 想定される用途 |
|---|---|---|---|---|---|---|---|

### コンパイル済みの代表的なプローブ

| ユーティリティ | 生成された宣言 |
|---|---|
| `absolute` | `position: absolute` |
| `appearance-none` | `appearance: none` |
| `bg-danger-500` | `--tw-bg-opacity: 1; background-color: color-mix(in srgb, var(--p-danger-500) calc(100% * var(--tw-bg-opacity, 1)), transparent)` |
| `bg-emphasis` | `background: var(--p-content-hover-background); color: var(--p-content-hover-color)` |
| `bg-help-500` | `--tw-bg-opacity: 1; background-color: color-mix(in srgb, var(--p-help-500) calc(100% * var(--tw-bg-opacity, 1)), transparent)` |
| `bg-highlight` | `background: var(--p-highlight-background); color: var(--p-highlight-color)` |
| `bg-highlight-emphasis` | `background: var(--p-highlight-focus-background); color: var(--p-highlight-focus-color)` |
| `bg-info-500` | `--tw-bg-opacity: 1; background-color: color-mix(in srgb, var(--p-info-500) calc(100% * var(--tw-bg-opacity, 1)), transparent)` |
| `bg-primary` | `--tw-bg-opacity: 1; background-color: color-mix(in srgb, var(--p-primary-color) calc(100% * var(--tw-bg-opacity, 1)), transparent)` |
| `bg-primary-emphasis` | `--tw-bg-opacity: 1; background-color: color-mix(in srgb, var(--p-primary-hover-color) calc(100% * var(--tw-bg-opacity, 1)), transparent)` |
| `bg-success-500` | `--tw-bg-opacity: 1; background-color: color-mix(in srgb, var(--p-success-500) calc(100% * var(--tw-bg-opacity, 1)), transparent)` |
| `bg-surface-0` | `--tw-bg-opacity: 1; background-color: color-mix(in srgb, var(--p-surface-0) calc(100% * var(--tw-bg-opacity, 1)), transparent)` |
| `bg-surface-100` | `--tw-bg-opacity: 1; background-color: color-mix(in srgb, var(--p-surface-100) calc(100% * var(--tw-bg-opacity, 1)), transparent)` |
| `bg-surface-200` | `--tw-bg-opacity: 1; background-color: color-mix(in srgb, var(--p-surface-200) calc(100% * var(--tw-bg-opacity, 1)), transparent)` |
| `bg-surface-300` | `--tw-bg-opacity: 1; background-color: color-mix(in srgb, var(--p-surface-300) calc(100% * var(--tw-bg-opacity, 1)), transparent)` |
| `bg-surface-400` | `--tw-bg-opacity: 1; background-color: color-mix(in srgb, var(--p-surface-400) calc(100% * var(--tw-bg-opacity, 1)), transparent)` |
| `bg-surface-50` | `--tw-bg-opacity: 1; background-color: color-mix(in srgb, var(--p-surface-50) calc(100% * var(--tw-bg-opacity, 1)), transparent)` |
| `bg-surface-700` | `--tw-bg-opacity: 1; background-color: color-mix(in srgb, var(--p-surface-700) calc(100% * var(--tw-bg-opacity, 1)), transparent)` |
| `bg-surface-950` | `--tw-bg-opacity: 1; background-color: color-mix(in srgb, var(--p-surface-950) calc(100% * var(--tw-bg-opacity, 1)), transparent)` |
| `bg-transparent` | `background-color: transparent` |
| `bg-warn-500` | `--tw-bg-opacity: 1; background-color: color-mix(in srgb, var(--p-warn-500) calc(100% * var(--tw-bg-opacity, 1)), transparent)` |
| `border` | `border-width: 1px` |
| `border-danger-200` | `--tw-border-opacity: 1; border-color: color-mix(in srgb, var(--p-danger-200) calc(100% * var(--tw-border-opacity, 1)), transparent)` |
| `border-danger-400` | `--tw-border-opacity: 1; border-color: color-mix(in srgb, var(--p-danger-400) calc(100% * var(--tw-border-opacity, 1)), transparent)` |
| `border-danger-500` | `--tw-border-opacity: 1; border-color: color-mix(in srgb, var(--p-danger-500) calc(100% * var(--tw-border-opacity, 1)), transparent)` |
| `border-help-200` | `--tw-border-opacity: 1; border-color: color-mix(in srgb, var(--p-help-200) calc(100% * var(--tw-border-opacity, 1)), transparent)` |
| `border-help-500` | `--tw-border-opacity: 1; border-color: color-mix(in srgb, var(--p-help-500) calc(100% * var(--tw-border-opacity, 1)), transparent)` |
| `border-info-200` | `--tw-border-opacity: 1; border-color: color-mix(in srgb, var(--p-info-200) calc(100% * var(--tw-border-opacity, 1)), transparent)` |
| `border-info-500` | `--tw-border-opacity: 1; border-color: color-mix(in srgb, var(--p-info-500) calc(100% * var(--tw-border-opacity, 1)), transparent)` |
| `border-primary` | `--tw-border-opacity: 1; border-color: color-mix(in srgb, var(--p-primary-color) calc(100% * var(--tw-border-opacity, 1)), transparent)` |
| `border-primary-200` | `--tw-border-opacity: 1; border-color: color-mix(in srgb, var(--p-primary-200) calc(100% * var(--tw-border-opacity, 1)), transparent)` |
| `border-success-200` | `--tw-border-opacity: 1; border-color: color-mix(in srgb, var(--p-success-200) calc(100% * var(--tw-border-opacity, 1)), transparent)` |
| `border-success-500` | `--tw-border-opacity: 1; border-color: color-mix(in srgb, var(--p-success-500) calc(100% * var(--tw-border-opacity, 1)), transparent)` |
| `border-surface` | `border-color: var(--p-content-border-color)` |
| `border-surface-100` | `--tw-border-opacity: 1; border-color: color-mix(in srgb, var(--p-surface-100) calc(100% * var(--tw-border-opacity, 1)), transparent)` |
| `border-surface-200` | `--tw-border-opacity: 1; border-color: color-mix(in srgb, var(--p-surface-200) calc(100% * var(--tw-border-opacity, 1)), transparent)` |
| `border-surface-300` | `--tw-border-opacity: 1; border-color: color-mix(in srgb, var(--p-surface-300) calc(100% * var(--tw-border-opacity, 1)), transparent)` |
| `border-surface-700` | `--tw-border-opacity: 1; border-color: color-mix(in srgb, var(--p-surface-700) calc(100% * var(--tw-border-opacity, 1)), transparent)` |
| `border-surface-950` | `--tw-border-opacity: 1; border-color: color-mix(in srgb, var(--p-surface-950) calc(100% * var(--tw-border-opacity, 1)), transparent)` |
| `border-transparent` | `border-color: transparent` |
| `border-warn-200` | `--tw-border-opacity: 1; border-color: color-mix(in srgb, var(--p-warn-200) calc(100% * var(--tw-border-opacity, 1)), transparent)` |
| `border-warn-500` | `--tw-border-opacity: 1; border-color: color-mix(in srgb, var(--p-warn-500) calc(100% * var(--tw-border-opacity, 1)), transparent)` |
| `cursor-pointer` | `cursor: pointer` |
| `dark:bg-danger-400` | `--tw-bg-opacity: 1; background-color: color-mix(in srgb, var(--p-danger-400) calc(100% * var(--tw-bg-opacity, 1)), transparent)` |
| `dark:bg-help-400` | `--tw-bg-opacity: 1; background-color: color-mix(in srgb, var(--p-help-400) calc(100% * var(--tw-bg-opacity, 1)), transparent)` |
| `dark:bg-info-400` | `--tw-bg-opacity: 1; background-color: color-mix(in srgb, var(--p-info-400) calc(100% * var(--tw-bg-opacity, 1)), transparent)` |
| `dark:bg-success-400` | `--tw-bg-opacity: 1; background-color: color-mix(in srgb, var(--p-success-400) calc(100% * var(--tw-bg-opacity, 1)), transparent)` |
| `dark:bg-surface-0` | `--tw-bg-opacity: 1; background-color: color-mix(in srgb, var(--p-surface-0) calc(100% * var(--tw-bg-opacity, 1)), transparent)` |
| `dark:bg-surface-300` | `--tw-bg-opacity: 1; background-color: color-mix(in srgb, var(--p-surface-300) calc(100% * var(--tw-bg-opacity, 1)), transparent)` |
| `dark:bg-surface-400` | `--tw-bg-opacity: 1; background-color: color-mix(in srgb, var(--p-surface-400) calc(100% * var(--tw-bg-opacity, 1)), transparent)` |
| `dark:bg-surface-600` | `--tw-bg-opacity: 1; background-color: color-mix(in srgb, var(--p-surface-600) calc(100% * var(--tw-bg-opacity, 1)), transparent)` |
| `dark:bg-surface-700` | `--tw-bg-opacity: 1; background-color: color-mix(in srgb, var(--p-surface-700) calc(100% * var(--tw-bg-opacity, 1)), transparent)` |
| `dark:bg-surface-800` | `--tw-bg-opacity: 1; background-color: color-mix(in srgb, var(--p-surface-800) calc(100% * var(--tw-bg-opacity, 1)), transparent)` |
| `dark:bg-surface-900` | `--tw-bg-opacity: 1; background-color: color-mix(in srgb, var(--p-surface-900) calc(100% * var(--tw-bg-opacity, 1)), transparent)` |
| `dark:bg-transparent` | `background-color: transparent` |
| `dark:bg-warn-400` | `--tw-bg-opacity: 1; background-color: color-mix(in srgb, var(--p-warn-400) calc(100% * var(--tw-bg-opacity, 1)), transparent)` |
| `dark:border-danger-300` | `--tw-border-opacity: 1; border-color: color-mix(in srgb, var(--p-danger-300) calc(100% * var(--tw-border-opacity, 1)), transparent)` |
| `dark:border-danger-400` | `--tw-border-opacity: 1; border-color: color-mix(in srgb, var(--p-danger-400) calc(100% * var(--tw-border-opacity, 1)), transparent)` |
| `dark:border-danger-700` | `--tw-border-opacity: 1; border-color: color-mix(in srgb, var(--p-danger-700) calc(100% * var(--tw-border-opacity, 1)), transparent)` |
| `dark:border-help-400` | `--tw-border-opacity: 1; border-color: color-mix(in srgb, var(--p-help-400) calc(100% * var(--tw-border-opacity, 1)), transparent)` |
| `dark:border-help-700` | `--tw-border-opacity: 1; border-color: color-mix(in srgb, var(--p-help-700) calc(100% * var(--tw-border-opacity, 1)), transparent)` |
| `dark:border-info-400` | `--tw-border-opacity: 1; border-color: color-mix(in srgb, var(--p-info-400) calc(100% * var(--tw-border-opacity, 1)), transparent)` |
| `dark:border-info-700` | `--tw-border-opacity: 1; border-color: color-mix(in srgb, var(--p-info-700) calc(100% * var(--tw-border-opacity, 1)), transparent)` |
| `dark:border-primary-700` | `--tw-border-opacity: 1; border-color: color-mix(in srgb, var(--p-primary-700) calc(100% * var(--tw-border-opacity, 1)), transparent)` |
| `dark:border-success-400` | `--tw-border-opacity: 1; border-color: color-mix(in srgb, var(--p-success-400) calc(100% * var(--tw-border-opacity, 1)), transparent)` |
| `dark:border-success-700` | `--tw-border-opacity: 1; border-color: color-mix(in srgb, var(--p-success-700) calc(100% * var(--tw-border-opacity, 1)), transparent)` |
| `dark:border-surface-100` | `--tw-border-opacity: 1; border-color: color-mix(in srgb, var(--p-surface-100) calc(100% * var(--tw-border-opacity, 1)), transparent)` |
| `dark:border-surface-500` | `--tw-border-opacity: 1; border-color: color-mix(in srgb, var(--p-surface-500) calc(100% * var(--tw-border-opacity, 1)), transparent)` |
| `dark:border-surface-600` | `--tw-border-opacity: 1; border-color: color-mix(in srgb, var(--p-surface-600) calc(100% * var(--tw-border-opacity, 1)), transparent)` |
| `dark:border-surface-700` | `--tw-border-opacity: 1; border-color: color-mix(in srgb, var(--p-surface-700) calc(100% * var(--tw-border-opacity, 1)), transparent)` |
| `dark:border-surface-800` | `--tw-border-opacity: 1; border-color: color-mix(in srgb, var(--p-surface-800) calc(100% * var(--tw-border-opacity, 1)), transparent)` |
| `dark:border-transparent` | `border-color: transparent` |
| `dark:border-warn-400` | `--tw-border-opacity: 1; border-color: color-mix(in srgb, var(--p-warn-400) calc(100% * var(--tw-border-opacity, 1)), transparent)` |
| `dark:border-warn-700` | `--tw-border-opacity: 1; border-color: color-mix(in srgb, var(--p-warn-700) calc(100% * var(--tw-border-opacity, 1)), transparent)` |
| `dark:disabled:bg-surface-700` | `--tw-bg-opacity: 1; background-color: color-mix(in srgb, var(--p-surface-700) calc(100% * var(--tw-bg-opacity, 1)), transparent)` |
| `dark:disabled:text-surface-400` | `--tw-text-opacity: 1; color: color-mix(in srgb, var(--p-surface-400) calc(100% * var(--tw-text-opacity, 1)), transparent)` |
| `dark:enabled:active:bg-danger-200` | `--tw-bg-opacity: 1; background-color: color-mix(in srgb, var(--p-danger-200) calc(100% * var(--tw-bg-opacity, 1)), transparent)` |
| `dark:enabled:active:bg-danger-400/15` | `background-color: color-mix(in srgb, var(--p-danger-400) calc(100% * 0.15), transparent)` |
| `dark:enabled:active:bg-help-200` | `--tw-bg-opacity: 1; background-color: color-mix(in srgb, var(--p-help-200) calc(100% * var(--tw-bg-opacity, 1)), transparent)` |
| `dark:enabled:active:bg-help-400/15` | `background-color: color-mix(in srgb, var(--p-help-400) calc(100% * 0.15), transparent)` |
| `dark:enabled:active:bg-info-200` | `--tw-bg-opacity: 1; background-color: color-mix(in srgb, var(--p-info-200) calc(100% * var(--tw-bg-opacity, 1)), transparent)` |
| `dark:enabled:active:bg-info-400/15` | `background-color: color-mix(in srgb, var(--p-info-400) calc(100% * 0.15), transparent)` |
| `dark:enabled:active:bg-primary/15` | `background-color: color-mix(in srgb, var(--p-primary-color) calc(100% * 0.15), transparent)` |
| `dark:enabled:active:bg-success-200` | `--tw-bg-opacity: 1; background-color: color-mix(in srgb, var(--p-success-200) calc(100% * var(--tw-bg-opacity, 1)), transparent)` |
| `dark:enabled:active:bg-success-400/15` | `background-color: color-mix(in srgb, var(--p-success-400) calc(100% * 0.15), transparent)` |
| `dark:enabled:active:bg-surface-200` | `--tw-bg-opacity: 1; background-color: color-mix(in srgb, var(--p-surface-200) calc(100% * var(--tw-bg-opacity, 1)), transparent)` |
| `dark:enabled:active:bg-surface-600` | `--tw-bg-opacity: 1; background-color: color-mix(in srgb, var(--p-surface-600) calc(100% * var(--tw-bg-opacity, 1)), transparent)` |
| `dark:enabled:active:bg-surface-700` | `--tw-bg-opacity: 1; background-color: color-mix(in srgb, var(--p-surface-700) calc(100% * var(--tw-bg-opacity, 1)), transparent)` |
| `dark:enabled:active:bg-warn-200` | `--tw-bg-opacity: 1; background-color: color-mix(in srgb, var(--p-warn-200) calc(100% * var(--tw-bg-opacity, 1)), transparent)` |
| `dark:enabled:active:bg-warn-400/15` | `background-color: color-mix(in srgb, var(--p-warn-400) calc(100% * 0.15), transparent)` |
| `dark:enabled:active:bg-white/15` | `background-color: rgb(255 255 255 / 0.15)` |
| `dark:enabled:active:border-danger-200` | `--tw-border-opacity: 1; border-color: color-mix(in srgb, var(--p-danger-200) calc(100% * var(--tw-border-opacity, 1)), transparent)` |
| `dark:enabled:active:border-danger-700` | `--tw-border-opacity: 1; border-color: color-mix(in srgb, var(--p-danger-700) calc(100% * var(--tw-border-opacity, 1)), transparent)` |
| `dark:enabled:active:border-help-200` | `--tw-border-opacity: 1; border-color: color-mix(in srgb, var(--p-help-200) calc(100% * var(--tw-border-opacity, 1)), transparent)` |
| `dark:enabled:active:border-help-700` | `--tw-border-opacity: 1; border-color: color-mix(in srgb, var(--p-help-700) calc(100% * var(--tw-border-opacity, 1)), transparent)` |
| `dark:enabled:active:border-info-200` | `--tw-border-opacity: 1; border-color: color-mix(in srgb, var(--p-info-200) calc(100% * var(--tw-border-opacity, 1)), transparent)` |
| `dark:enabled:active:border-info-700` | `--tw-border-opacity: 1; border-color: color-mix(in srgb, var(--p-info-700) calc(100% * var(--tw-border-opacity, 1)), transparent)` |
| `dark:enabled:active:border-primary-700` | `--tw-border-opacity: 1; border-color: color-mix(in srgb, var(--p-primary-700) calc(100% * var(--tw-border-opacity, 1)), transparent)` |
| `dark:enabled:active:border-success-200` | `--tw-border-opacity: 1; border-color: color-mix(in srgb, var(--p-success-200) calc(100% * var(--tw-border-opacity, 1)), transparent)` |
| `dark:enabled:active:border-success-700` | `--tw-border-opacity: 1; border-color: color-mix(in srgb, var(--p-success-700) calc(100% * var(--tw-border-opacity, 1)), transparent)` |
| `dark:enabled:active:border-surface-300` | `--tw-border-opacity: 1; border-color: color-mix(in srgb, var(--p-surface-300) calc(100% * var(--tw-border-opacity, 1)), transparent)` |
| `dark:enabled:active:border-surface-500` | `--tw-border-opacity: 1; border-color: color-mix(in srgb, var(--p-surface-500) calc(100% * var(--tw-border-opacity, 1)), transparent)` |
| `dark:enabled:active:border-surface-600` | `--tw-border-opacity: 1; border-color: color-mix(in srgb, var(--p-surface-600) calc(100% * var(--tw-border-opacity, 1)), transparent)` |
| `dark:enabled:active:border-surface-700` | `--tw-border-opacity: 1; border-color: color-mix(in srgb, var(--p-surface-700) calc(100% * var(--tw-border-opacity, 1)), transparent)` |
| `dark:enabled:active:border-transparent` | `border-color: transparent` |
| `dark:enabled:active:border-warn-200` | `--tw-border-opacity: 1; border-color: color-mix(in srgb, var(--p-warn-200) calc(100% * var(--tw-border-opacity, 1)), transparent)` |
| `dark:enabled:active:border-warn-700` | `--tw-border-opacity: 1; border-color: color-mix(in srgb, var(--p-warn-700) calc(100% * var(--tw-border-opacity, 1)), transparent)` |
| `dark:enabled:active:text-danger-400` | `--tw-text-opacity: 1; color: color-mix(in srgb, var(--p-danger-400) calc(100% * var(--tw-text-opacity, 1)), transparent)` |
| `dark:enabled:active:text-danger-950` | `--tw-text-opacity: 1; color: color-mix(in srgb, var(--p-danger-950) calc(100% * var(--tw-text-opacity, 1)), transparent)` |
| `dark:enabled:active:text-help-400` | `--tw-text-opacity: 1; color: color-mix(in srgb, var(--p-help-400) calc(100% * var(--tw-text-opacity, 1)), transparent)` |
| `dark:enabled:active:text-help-950` | `--tw-text-opacity: 1; color: color-mix(in srgb, var(--p-help-950) calc(100% * var(--tw-text-opacity, 1)), transparent)` |
| `dark:enabled:active:text-info-400` | `--tw-text-opacity: 1; color: color-mix(in srgb, var(--p-info-400) calc(100% * var(--tw-text-opacity, 1)), transparent)` |
| `dark:enabled:active:text-info-950` | `--tw-text-opacity: 1; color: color-mix(in srgb, var(--p-info-950) calc(100% * var(--tw-text-opacity, 1)), transparent)` |
| `dark:enabled:active:text-primary` | `--tw-text-opacity: 1; color: color-mix(in srgb, var(--p-primary-color) calc(100% * var(--tw-text-opacity, 1)), transparent)` |
| `dark:enabled:active:text-success-400` | `--tw-text-opacity: 1; color: color-mix(in srgb, var(--p-success-400) calc(100% * var(--tw-text-opacity, 1)), transparent)` |
| `dark:enabled:active:text-success-950` | `--tw-text-opacity: 1; color: color-mix(in srgb, var(--p-success-950) calc(100% * var(--tw-text-opacity, 1)), transparent)` |
| `dark:enabled:active:text-surface-0` | `--tw-text-opacity: 1; color: color-mix(in srgb, var(--p-surface-0) calc(100% * var(--tw-text-opacity, 1)), transparent)` |
| `dark:enabled:active:text-surface-100` | `--tw-text-opacity: 1; color: color-mix(in srgb, var(--p-surface-100) calc(100% * var(--tw-text-opacity, 1)), transparent)` |
| `dark:enabled:active:text-surface-400` | `--tw-text-opacity: 1; color: color-mix(in srgb, var(--p-surface-400) calc(100% * var(--tw-text-opacity, 1)), transparent)` |
| `dark:enabled:active:text-surface-950` | `--tw-text-opacity: 1; color: color-mix(in srgb, var(--p-surface-950) calc(100% * var(--tw-text-opacity, 1)), transparent)` |
| `dark:enabled:active:text-warn-400` | `--tw-text-opacity: 1; color: color-mix(in srgb, var(--p-warn-400) calc(100% * var(--tw-text-opacity, 1)), transparent)` |
| `dark:enabled:active:text-warn-950` | `--tw-text-opacity: 1; color: color-mix(in srgb, var(--p-warn-950) calc(100% * var(--tw-text-opacity, 1)), transparent)` |
| `dark:enabled:focus:border-primary` | `--tw-border-opacity: 1; border-color: color-mix(in srgb, var(--p-primary-color) calc(100% * var(--tw-border-opacity, 1)), transparent)` |
| `dark:enabled:hover:bg-danger-300` | `--tw-bg-opacity: 1; background-color: color-mix(in srgb, var(--p-danger-300) calc(100% * var(--tw-bg-opacity, 1)), transparent)` |
| `dark:enabled:hover:bg-danger-400/5` | `background-color: color-mix(in srgb, var(--p-danger-400) calc(100% * 0.05), transparent)` |
| `dark:enabled:hover:bg-help-300` | `--tw-bg-opacity: 1; background-color: color-mix(in srgb, var(--p-help-300) calc(100% * var(--tw-bg-opacity, 1)), transparent)` |
| `dark:enabled:hover:bg-help-400/5` | `background-color: color-mix(in srgb, var(--p-help-400) calc(100% * 0.05), transparent)` |
| `dark:enabled:hover:bg-info-300` | `--tw-bg-opacity: 1; background-color: color-mix(in srgb, var(--p-info-300) calc(100% * var(--tw-bg-opacity, 1)), transparent)` |
| `dark:enabled:hover:bg-info-400/5` | `background-color: color-mix(in srgb, var(--p-info-400) calc(100% * 0.05), transparent)` |
| `dark:enabled:hover:bg-primary/5` | `background-color: color-mix(in srgb, var(--p-primary-color) calc(100% * 0.05), transparent)` |
| `dark:enabled:hover:bg-success-300` | `--tw-bg-opacity: 1; background-color: color-mix(in srgb, var(--p-success-300) calc(100% * var(--tw-bg-opacity, 1)), transparent)` |
| `dark:enabled:hover:bg-success-400/5` | `background-color: color-mix(in srgb, var(--p-success-400) calc(100% * 0.05), transparent)` |
| `dark:enabled:hover:bg-surface-100` | `--tw-bg-opacity: 1; background-color: color-mix(in srgb, var(--p-surface-100) calc(100% * var(--tw-bg-opacity, 1)), transparent)` |
| `dark:enabled:hover:bg-surface-700` | `--tw-bg-opacity: 1; background-color: color-mix(in srgb, var(--p-surface-700) calc(100% * var(--tw-bg-opacity, 1)), transparent)` |
| `dark:enabled:hover:bg-surface-800` | `--tw-bg-opacity: 1; background-color: color-mix(in srgb, var(--p-surface-800) calc(100% * var(--tw-bg-opacity, 1)), transparent)` |
| `dark:enabled:hover:bg-warn-300` | `--tw-bg-opacity: 1; background-color: color-mix(in srgb, var(--p-warn-300) calc(100% * var(--tw-bg-opacity, 1)), transparent)` |
| `dark:enabled:hover:bg-warn-400/5` | `background-color: color-mix(in srgb, var(--p-warn-400) calc(100% * 0.05), transparent)` |
| `dark:enabled:hover:bg-white/5` | `background-color: rgb(255 255 255 / 0.05)` |
| `dark:enabled:hover:border-danger-300` | `--tw-border-opacity: 1; border-color: color-mix(in srgb, var(--p-danger-300) calc(100% * var(--tw-border-opacity, 1)), transparent)` |
| `dark:enabled:hover:border-danger-700` | `--tw-border-opacity: 1; border-color: color-mix(in srgb, var(--p-danger-700) calc(100% * var(--tw-border-opacity, 1)), transparent)` |
| `dark:enabled:hover:border-help-300` | `--tw-border-opacity: 1; border-color: color-mix(in srgb, var(--p-help-300) calc(100% * var(--tw-border-opacity, 1)), transparent)` |
| `dark:enabled:hover:border-help-700` | `--tw-border-opacity: 1; border-color: color-mix(in srgb, var(--p-help-700) calc(100% * var(--tw-border-opacity, 1)), transparent)` |
| `dark:enabled:hover:border-info-300` | `--tw-border-opacity: 1; border-color: color-mix(in srgb, var(--p-info-300) calc(100% * var(--tw-border-opacity, 1)), transparent)` |
| `dark:enabled:hover:border-info-700` | `--tw-border-opacity: 1; border-color: color-mix(in srgb, var(--p-info-700) calc(100% * var(--tw-border-opacity, 1)), transparent)` |
| `dark:enabled:hover:border-primary-700` | `--tw-border-opacity: 1; border-color: color-mix(in srgb, var(--p-primary-700) calc(100% * var(--tw-border-opacity, 1)), transparent)` |
| `dark:enabled:hover:border-success-300` | `--tw-border-opacity: 1; border-color: color-mix(in srgb, var(--p-success-300) calc(100% * var(--tw-border-opacity, 1)), transparent)` |
| `dark:enabled:hover:border-success-700` | `--tw-border-opacity: 1; border-color: color-mix(in srgb, var(--p-success-700) calc(100% * var(--tw-border-opacity, 1)), transparent)` |
| `dark:enabled:hover:border-surface-200` | `--tw-border-opacity: 1; border-color: color-mix(in srgb, var(--p-surface-200) calc(100% * var(--tw-border-opacity, 1)), transparent)` |
| `dark:enabled:hover:border-surface-500` | `--tw-border-opacity: 1; border-color: color-mix(in srgb, var(--p-surface-500) calc(100% * var(--tw-border-opacity, 1)), transparent)` |
| `dark:enabled:hover:border-surface-600` | `--tw-border-opacity: 1; border-color: color-mix(in srgb, var(--p-surface-600) calc(100% * var(--tw-border-opacity, 1)), transparent)` |
| `dark:enabled:hover:border-surface-700` | `--tw-border-opacity: 1; border-color: color-mix(in srgb, var(--p-surface-700) calc(100% * var(--tw-border-opacity, 1)), transparent)` |
| `dark:enabled:hover:border-transparent` | `border-color: transparent` |
| `dark:enabled:hover:border-warn-300` | `--tw-border-opacity: 1; border-color: color-mix(in srgb, var(--p-warn-300) calc(100% * var(--tw-border-opacity, 1)), transparent)` |
| `dark:enabled:hover:border-warn-700` | `--tw-border-opacity: 1; border-color: color-mix(in srgb, var(--p-warn-700) calc(100% * var(--tw-border-opacity, 1)), transparent)` |
| `dark:enabled:hover:text-danger-400` | `--tw-text-opacity: 1; color: color-mix(in srgb, var(--p-danger-400) calc(100% * var(--tw-text-opacity, 1)), transparent)` |
| `dark:enabled:hover:text-danger-950` | `--tw-text-opacity: 1; color: color-mix(in srgb, var(--p-danger-950) calc(100% * var(--tw-text-opacity, 1)), transparent)` |
| `dark:enabled:hover:text-help-400` | `--tw-text-opacity: 1; color: color-mix(in srgb, var(--p-help-400) calc(100% * var(--tw-text-opacity, 1)), transparent)` |
| `dark:enabled:hover:text-help-950` | `--tw-text-opacity: 1; color: color-mix(in srgb, var(--p-help-950) calc(100% * var(--tw-text-opacity, 1)), transparent)` |
| `dark:enabled:hover:text-info-400` | `--tw-text-opacity: 1; color: color-mix(in srgb, var(--p-info-400) calc(100% * var(--tw-text-opacity, 1)), transparent)` |
| `dark:enabled:hover:text-info-950` | `--tw-text-opacity: 1; color: color-mix(in srgb, var(--p-info-950) calc(100% * var(--tw-text-opacity, 1)), transparent)` |
| `dark:enabled:hover:text-primary` | `--tw-text-opacity: 1; color: color-mix(in srgb, var(--p-primary-color) calc(100% * var(--tw-text-opacity, 1)), transparent)` |
| `dark:enabled:hover:text-success-400` | `--tw-text-opacity: 1; color: color-mix(in srgb, var(--p-success-400) calc(100% * var(--tw-text-opacity, 1)), transparent)` |
| `dark:enabled:hover:text-success-950` | `--tw-text-opacity: 1; color: color-mix(in srgb, var(--p-success-950) calc(100% * var(--tw-text-opacity, 1)), transparent)` |
| `dark:enabled:hover:text-surface-0` | `--tw-text-opacity: 1; color: color-mix(in srgb, var(--p-surface-0) calc(100% * var(--tw-text-opacity, 1)), transparent)` |
| `dark:enabled:hover:text-surface-200` | `--tw-text-opacity: 1; color: color-mix(in srgb, var(--p-surface-200) calc(100% * var(--tw-text-opacity, 1)), transparent)` |
| `dark:enabled:hover:text-surface-400` | `--tw-text-opacity: 1; color: color-mix(in srgb, var(--p-surface-400) calc(100% * var(--tw-text-opacity, 1)), transparent)` |
| `dark:enabled:hover:text-surface-950` | `--tw-text-opacity: 1; color: color-mix(in srgb, var(--p-surface-950) calc(100% * var(--tw-text-opacity, 1)), transparent)` |
| `dark:enabled:hover:text-warn-400` | `--tw-text-opacity: 1; color: color-mix(in srgb, var(--p-warn-400) calc(100% * var(--tw-text-opacity, 1)), transparent)` |
| `dark:enabled:hover:text-warn-950` | `--tw-text-opacity: 1; color: color-mix(in srgb, var(--p-warn-950) calc(100% * var(--tw-text-opacity, 1)), transparent)` |
| `dark:focus-visible:outline-danger-400` | `outline-color: color-mix(in srgb, var(--p-danger-400) calc(100% * 1), transparent)` |
| `dark:focus-visible:outline-help-400` | `outline-color: color-mix(in srgb, var(--p-help-400) calc(100% * 1), transparent)` |
| `dark:focus-visible:outline-info-400` | `outline-color: color-mix(in srgb, var(--p-info-400) calc(100% * 1), transparent)` |
| `dark:focus-visible:outline-success-400` | `outline-color: color-mix(in srgb, var(--p-success-400) calc(100% * 1), transparent)` |
| `dark:focus-visible:outline-surface-0` | `outline-color: color-mix(in srgb, var(--p-surface-0) calc(100% * 1), transparent)` |
| `dark:focus-visible:outline-surface-300` | `outline-color: color-mix(in srgb, var(--p-surface-300) calc(100% * 1), transparent)` |
| `dark:focus-visible:outline-warn-400` | `outline-color: color-mix(in srgb, var(--p-warn-400) calc(100% * 1), transparent)` |
| `dark:placeholder:text-surface-400` | `--tw-text-opacity: 1; color: color-mix(in srgb, var(--p-surface-400) calc(100% * var(--tw-text-opacity, 1)), transparent)` |
| `dark:text-danger-400` | `--tw-text-opacity: 1; color: color-mix(in srgb, var(--p-danger-400) calc(100% * var(--tw-text-opacity, 1)), transparent)` |
| `dark:text-danger-950` | `--tw-text-opacity: 1; color: color-mix(in srgb, var(--p-danger-950) calc(100% * var(--tw-text-opacity, 1)), transparent)` |
| `dark:text-help-400` | `--tw-text-opacity: 1; color: color-mix(in srgb, var(--p-help-400) calc(100% * var(--tw-text-opacity, 1)), transparent)` |
| `dark:text-help-950` | `--tw-text-opacity: 1; color: color-mix(in srgb, var(--p-help-950) calc(100% * var(--tw-text-opacity, 1)), transparent)` |
| `dark:text-info-400` | `--tw-text-opacity: 1; color: color-mix(in srgb, var(--p-info-400) calc(100% * var(--tw-text-opacity, 1)), transparent)` |
| `dark:text-info-950` | `--tw-text-opacity: 1; color: color-mix(in srgb, var(--p-info-950) calc(100% * var(--tw-text-opacity, 1)), transparent)` |
| `dark:text-primary` | `--tw-text-opacity: 1; color: color-mix(in srgb, var(--p-primary-color) calc(100% * var(--tw-text-opacity, 1)), transparent)` |
| `dark:text-success-400` | `--tw-text-opacity: 1; color: color-mix(in srgb, var(--p-success-400) calc(100% * var(--tw-text-opacity, 1)), transparent)` |
| `dark:text-success-950` | `--tw-text-opacity: 1; color: color-mix(in srgb, var(--p-success-950) calc(100% * var(--tw-text-opacity, 1)), transparent)` |
| `dark:text-surface-0` | `--tw-text-opacity: 1; color: color-mix(in srgb, var(--p-surface-0) calc(100% * var(--tw-text-opacity, 1)), transparent)` |
| `dark:text-surface-300` | `--tw-text-opacity: 1; color: color-mix(in srgb, var(--p-surface-300) calc(100% * var(--tw-text-opacity, 1)), transparent)` |
| `dark:text-surface-400` | `--tw-text-opacity: 1; color: color-mix(in srgb, var(--p-surface-400) calc(100% * var(--tw-text-opacity, 1)), transparent)` |
| `dark:text-surface-800` | `--tw-text-opacity: 1; color: color-mix(in srgb, var(--p-surface-800) calc(100% * var(--tw-text-opacity, 1)), transparent)` |
| `dark:text-surface-900` | `--tw-text-opacity: 1; color: color-mix(in srgb, var(--p-surface-900) calc(100% * var(--tw-text-opacity, 1)), transparent)` |
| `dark:text-surface-950` | `--tw-text-opacity: 1; color: color-mix(in srgb, var(--p-surface-950) calc(100% * var(--tw-text-opacity, 1)), transparent)` |
| `dark:text-warn-400` | `--tw-text-opacity: 1; color: color-mix(in srgb, var(--p-warn-400) calc(100% * var(--tw-text-opacity, 1)), transparent)` |
| `dark:text-warn-950` | `--tw-text-opacity: 1; color: color-mix(in srgb, var(--p-warn-950) calc(100% * var(--tw-text-opacity, 1)), transparent)` |
| `disabled:bg-surface-200` | `--tw-bg-opacity: 1; background-color: color-mix(in srgb, var(--p-surface-200) calc(100% * var(--tw-bg-opacity, 1)), transparent)` |
| `disabled:cursor-default` | `cursor: default` |
| `disabled:opacity-100` | `opacity: 1` |
| `disabled:text-surface-500` | `--tw-text-opacity: 1; color: color-mix(in srgb, var(--p-surface-500) calc(100% * var(--tw-text-opacity, 1)), transparent)` |
| `duration-200` | `transition-duration: 200ms` |
| `ease-in-out` | `transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1)` |
| `enabled:active:bg-danger-100` | `--tw-bg-opacity: 1; background-color: color-mix(in srgb, var(--p-danger-100) calc(100% * var(--tw-bg-opacity, 1)), transparent)` |
| `enabled:active:bg-danger-700` | `--tw-bg-opacity: 1; background-color: color-mix(in srgb, var(--p-danger-700) calc(100% * var(--tw-bg-opacity, 1)), transparent)` |
| `enabled:active:bg-help-100` | `--tw-bg-opacity: 1; background-color: color-mix(in srgb, var(--p-help-100) calc(100% * var(--tw-bg-opacity, 1)), transparent)` |
| `enabled:active:bg-help-700` | `--tw-bg-opacity: 1; background-color: color-mix(in srgb, var(--p-help-700) calc(100% * var(--tw-bg-opacity, 1)), transparent)` |
| `enabled:active:bg-info-100` | `--tw-bg-opacity: 1; background-color: color-mix(in srgb, var(--p-info-100) calc(100% * var(--tw-bg-opacity, 1)), transparent)` |
| `enabled:active:bg-info-700` | `--tw-bg-opacity: 1; background-color: color-mix(in srgb, var(--p-info-700) calc(100% * var(--tw-bg-opacity, 1)), transparent)` |
| `enabled:active:bg-primary-100` | `--tw-bg-opacity: 1; background-color: color-mix(in srgb, var(--p-primary-100) calc(100% * var(--tw-bg-opacity, 1)), transparent)` |
| `enabled:active:bg-primary-emphasis-alt` | `--tw-bg-opacity: 1; background-color: color-mix(in srgb, var(--p-primary-active-color) calc(100% * var(--tw-bg-opacity, 1)), transparent)` |
| `enabled:active:bg-success-100` | `--tw-bg-opacity: 1; background-color: color-mix(in srgb, var(--p-success-100) calc(100% * var(--tw-bg-opacity, 1)), transparent)` |
| `enabled:active:bg-success-700` | `--tw-bg-opacity: 1; background-color: color-mix(in srgb, var(--p-success-700) calc(100% * var(--tw-bg-opacity, 1)), transparent)` |
| `enabled:active:bg-surface-100` | `--tw-bg-opacity: 1; background-color: color-mix(in srgb, var(--p-surface-100) calc(100% * var(--tw-bg-opacity, 1)), transparent)` |
| `enabled:active:bg-surface-300` | `--tw-bg-opacity: 1; background-color: color-mix(in srgb, var(--p-surface-300) calc(100% * var(--tw-bg-opacity, 1)), transparent)` |
| `enabled:active:bg-surface-800` | `--tw-bg-opacity: 1; background-color: color-mix(in srgb, var(--p-surface-800) calc(100% * var(--tw-bg-opacity, 1)), transparent)` |
| `enabled:active:bg-transparent` | `background-color: transparent` |
| `enabled:active:bg-warn-100` | `--tw-bg-opacity: 1; background-color: color-mix(in srgb, var(--p-warn-100) calc(100% * var(--tw-bg-opacity, 1)), transparent)` |
| `enabled:active:bg-warn-700` | `--tw-bg-opacity: 1; background-color: color-mix(in srgb, var(--p-warn-700) calc(100% * var(--tw-bg-opacity, 1)), transparent)` |
| `enabled:active:border-danger-200` | `--tw-border-opacity: 1; border-color: color-mix(in srgb, var(--p-danger-200) calc(100% * var(--tw-border-opacity, 1)), transparent)` |
| `enabled:active:border-danger-700` | `--tw-border-opacity: 1; border-color: color-mix(in srgb, var(--p-danger-700) calc(100% * var(--tw-border-opacity, 1)), transparent)` |
| `enabled:active:border-help-200` | `--tw-border-opacity: 1; border-color: color-mix(in srgb, var(--p-help-200) calc(100% * var(--tw-border-opacity, 1)), transparent)` |
| `enabled:active:border-help-700` | `--tw-border-opacity: 1; border-color: color-mix(in srgb, var(--p-help-700) calc(100% * var(--tw-border-opacity, 1)), transparent)` |
| `enabled:active:border-info-200` | `--tw-border-opacity: 1; border-color: color-mix(in srgb, var(--p-info-200) calc(100% * var(--tw-border-opacity, 1)), transparent)` |
| `enabled:active:border-info-700` | `--tw-border-opacity: 1; border-color: color-mix(in srgb, var(--p-info-700) calc(100% * var(--tw-border-opacity, 1)), transparent)` |
| `enabled:active:border-primary-200` | `--tw-border-opacity: 1; border-color: color-mix(in srgb, var(--p-primary-200) calc(100% * var(--tw-border-opacity, 1)), transparent)` |
| `enabled:active:border-primary-emphasis-alt` | `--tw-border-opacity: 1; border-color: color-mix(in srgb, var(--p-primary-active-color) calc(100% * var(--tw-border-opacity, 1)), transparent)` |
| `enabled:active:border-success-200` | `--tw-border-opacity: 1; border-color: color-mix(in srgb, var(--p-success-200) calc(100% * var(--tw-border-opacity, 1)), transparent)` |
| `enabled:active:border-success-700` | `--tw-border-opacity: 1; border-color: color-mix(in srgb, var(--p-success-700) calc(100% * var(--tw-border-opacity, 1)), transparent)` |
| `enabled:active:border-surface-200` | `--tw-border-opacity: 1; border-color: color-mix(in srgb, var(--p-surface-200) calc(100% * var(--tw-border-opacity, 1)), transparent)` |
| `enabled:active:border-surface-300` | `--tw-border-opacity: 1; border-color: color-mix(in srgb, var(--p-surface-300) calc(100% * var(--tw-border-opacity, 1)), transparent)` |
| `enabled:active:border-surface-700` | `--tw-border-opacity: 1; border-color: color-mix(in srgb, var(--p-surface-700) calc(100% * var(--tw-border-opacity, 1)), transparent)` |
| `enabled:active:border-surface-800` | `--tw-border-opacity: 1; border-color: color-mix(in srgb, var(--p-surface-800) calc(100% * var(--tw-border-opacity, 1)), transparent)` |
| `enabled:active:border-transparent` | `border-color: transparent` |
| `enabled:active:border-warn-200` | `--tw-border-opacity: 1; border-color: color-mix(in srgb, var(--p-warn-200) calc(100% * var(--tw-border-opacity, 1)), transparent)` |
| `enabled:active:border-warn-700` | `--tw-border-opacity: 1; border-color: color-mix(in srgb, var(--p-warn-700) calc(100% * var(--tw-border-opacity, 1)), transparent)` |
| `enabled:active:text-danger-500` | `--tw-text-opacity: 1; color: color-mix(in srgb, var(--p-danger-500) calc(100% * var(--tw-text-opacity, 1)), transparent)` |
| `enabled:active:text-help-500` | `--tw-text-opacity: 1; color: color-mix(in srgb, var(--p-help-500) calc(100% * var(--tw-text-opacity, 1)), transparent)` |
| `enabled:active:text-info-500` | `--tw-text-opacity: 1; color: color-mix(in srgb, var(--p-info-500) calc(100% * var(--tw-text-opacity, 1)), transparent)` |
| `enabled:active:text-primary` | `--tw-text-opacity: 1; color: color-mix(in srgb, var(--p-primary-color) calc(100% * var(--tw-text-opacity, 1)), transparent)` |
| `enabled:active:text-success-500` | `--tw-text-opacity: 1; color: color-mix(in srgb, var(--p-success-500) calc(100% * var(--tw-text-opacity, 1)), transparent)` |
| `enabled:active:text-surface-500` | `--tw-text-opacity: 1; color: color-mix(in srgb, var(--p-surface-500) calc(100% * var(--tw-text-opacity, 1)), transparent)` |
| `enabled:active:text-surface-700` | `--tw-text-opacity: 1; color: color-mix(in srgb, var(--p-surface-700) calc(100% * var(--tw-text-opacity, 1)), transparent)` |
| `enabled:active:text-surface-800` | `--tw-text-opacity: 1; color: color-mix(in srgb, var(--p-surface-800) calc(100% * var(--tw-text-opacity, 1)), transparent)` |
| `enabled:active:text-surface-950` | `--tw-text-opacity: 1; color: color-mix(in srgb, var(--p-surface-950) calc(100% * var(--tw-text-opacity, 1)), transparent)` |
| `enabled:active:text-warn-500` | `--tw-text-opacity: 1; color: color-mix(in srgb, var(--p-warn-500) calc(100% * var(--tw-text-opacity, 1)), transparent)` |
| `enabled:active:text-white` | `--tw-text-opacity: 1; color: rgb(255 255 255 / var(--tw-text-opacity, 1))` |
| `enabled:focus:border-primary` | `--tw-border-opacity: 1; border-color: color-mix(in srgb, var(--p-primary-color) calc(100% * var(--tw-border-opacity, 1)), transparent)` |
| `enabled:hover:bg-danger-50` | `--tw-bg-opacity: 1; background-color: color-mix(in srgb, var(--p-danger-50) calc(100% * var(--tw-bg-opacity, 1)), transparent)` |
| `enabled:hover:bg-danger-600` | `--tw-bg-opacity: 1; background-color: color-mix(in srgb, var(--p-danger-600) calc(100% * var(--tw-bg-opacity, 1)), transparent)` |
| `enabled:hover:bg-help-50` | `--tw-bg-opacity: 1; background-color: color-mix(in srgb, var(--p-help-50) calc(100% * var(--tw-bg-opacity, 1)), transparent)` |
| `enabled:hover:bg-help-600` | `--tw-bg-opacity: 1; background-color: color-mix(in srgb, var(--p-help-600) calc(100% * var(--tw-bg-opacity, 1)), transparent)` |
| `enabled:hover:bg-info-50` | `--tw-bg-opacity: 1; background-color: color-mix(in srgb, var(--p-info-50) calc(100% * var(--tw-bg-opacity, 1)), transparent)` |
| `enabled:hover:bg-info-600` | `--tw-bg-opacity: 1; background-color: color-mix(in srgb, var(--p-info-600) calc(100% * var(--tw-bg-opacity, 1)), transparent)` |
| `enabled:hover:bg-primary-50` | `--tw-bg-opacity: 1; background-color: color-mix(in srgb, var(--p-primary-50) calc(100% * var(--tw-bg-opacity, 1)), transparent)` |
| `enabled:hover:bg-primary-emphasis` | `--tw-bg-opacity: 1; background-color: color-mix(in srgb, var(--p-primary-hover-color) calc(100% * var(--tw-bg-opacity, 1)), transparent)` |
| `enabled:hover:bg-success-50` | `--tw-bg-opacity: 1; background-color: color-mix(in srgb, var(--p-success-50) calc(100% * var(--tw-bg-opacity, 1)), transparent)` |
| `enabled:hover:bg-success-600` | `--tw-bg-opacity: 1; background-color: color-mix(in srgb, var(--p-success-600) calc(100% * var(--tw-bg-opacity, 1)), transparent)` |
| `enabled:hover:bg-surface-200` | `--tw-bg-opacity: 1; background-color: color-mix(in srgb, var(--p-surface-200) calc(100% * var(--tw-bg-opacity, 1)), transparent)` |
| `enabled:hover:bg-surface-50` | `--tw-bg-opacity: 1; background-color: color-mix(in srgb, var(--p-surface-50) calc(100% * var(--tw-bg-opacity, 1)), transparent)` |
| `enabled:hover:bg-surface-900` | `--tw-bg-opacity: 1; background-color: color-mix(in srgb, var(--p-surface-900) calc(100% * var(--tw-bg-opacity, 1)), transparent)` |
| `enabled:hover:bg-transparent` | `background-color: transparent` |
| `enabled:hover:bg-warn-50` | `--tw-bg-opacity: 1; background-color: color-mix(in srgb, var(--p-warn-50) calc(100% * var(--tw-bg-opacity, 1)), transparent)` |
| `enabled:hover:bg-warn-600` | `--tw-bg-opacity: 1; background-color: color-mix(in srgb, var(--p-warn-600) calc(100% * var(--tw-bg-opacity, 1)), transparent)` |
| `enabled:hover:border-danger-200` | `--tw-border-opacity: 1; border-color: color-mix(in srgb, var(--p-danger-200) calc(100% * var(--tw-border-opacity, 1)), transparent)` |
| `enabled:hover:border-danger-600` | `--tw-border-opacity: 1; border-color: color-mix(in srgb, var(--p-danger-600) calc(100% * var(--tw-border-opacity, 1)), transparent)` |
| `enabled:hover:border-help-200` | `--tw-border-opacity: 1; border-color: color-mix(in srgb, var(--p-help-200) calc(100% * var(--tw-border-opacity, 1)), transparent)` |
| `enabled:hover:border-help-600` | `--tw-border-opacity: 1; border-color: color-mix(in srgb, var(--p-help-600) calc(100% * var(--tw-border-opacity, 1)), transparent)` |
| `enabled:hover:border-info-200` | `--tw-border-opacity: 1; border-color: color-mix(in srgb, var(--p-info-200) calc(100% * var(--tw-border-opacity, 1)), transparent)` |
| `enabled:hover:border-info-600` | `--tw-border-opacity: 1; border-color: color-mix(in srgb, var(--p-info-600) calc(100% * var(--tw-border-opacity, 1)), transparent)` |
| `enabled:hover:border-primary-200` | `--tw-border-opacity: 1; border-color: color-mix(in srgb, var(--p-primary-200) calc(100% * var(--tw-border-opacity, 1)), transparent)` |
| `enabled:hover:border-primary-emphasis` | `--tw-border-opacity: 1; border-color: color-mix(in srgb, var(--p-primary-hover-color) calc(100% * var(--tw-border-opacity, 1)), transparent)` |
| `enabled:hover:border-success-200` | `--tw-border-opacity: 1; border-color: color-mix(in srgb, var(--p-success-200) calc(100% * var(--tw-border-opacity, 1)), transparent)` |
| `enabled:hover:border-success-600` | `--tw-border-opacity: 1; border-color: color-mix(in srgb, var(--p-success-600) calc(100% * var(--tw-border-opacity, 1)), transparent)` |
| `enabled:hover:border-surface-200` | `--tw-border-opacity: 1; border-color: color-mix(in srgb, var(--p-surface-200) calc(100% * var(--tw-border-opacity, 1)), transparent)` |
| `enabled:hover:border-surface-400` | `--tw-border-opacity: 1; border-color: color-mix(in srgb, var(--p-surface-400) calc(100% * var(--tw-border-opacity, 1)), transparent)` |
| `enabled:hover:border-surface-700` | `--tw-border-opacity: 1; border-color: color-mix(in srgb, var(--p-surface-700) calc(100% * var(--tw-border-opacity, 1)), transparent)` |
| `enabled:hover:border-surface-900` | `--tw-border-opacity: 1; border-color: color-mix(in srgb, var(--p-surface-900) calc(100% * var(--tw-border-opacity, 1)), transparent)` |
| `enabled:hover:border-transparent` | `border-color: transparent` |
| `enabled:hover:border-warn-200` | `--tw-border-opacity: 1; border-color: color-mix(in srgb, var(--p-warn-200) calc(100% * var(--tw-border-opacity, 1)), transparent)` |
| `enabled:hover:border-warn-600` | `--tw-border-opacity: 1; border-color: color-mix(in srgb, var(--p-warn-600) calc(100% * var(--tw-border-opacity, 1)), transparent)` |
| `enabled:hover:text-danger-500` | `--tw-text-opacity: 1; color: color-mix(in srgb, var(--p-danger-500) calc(100% * var(--tw-text-opacity, 1)), transparent)` |
| `enabled:hover:text-help-500` | `--tw-text-opacity: 1; color: color-mix(in srgb, var(--p-help-500) calc(100% * var(--tw-text-opacity, 1)), transparent)` |
| `enabled:hover:text-info-500` | `--tw-text-opacity: 1; color: color-mix(in srgb, var(--p-info-500) calc(100% * var(--tw-text-opacity, 1)), transparent)` |
| `enabled:hover:text-primary` | `--tw-text-opacity: 1; color: color-mix(in srgb, var(--p-primary-color) calc(100% * var(--tw-text-opacity, 1)), transparent)` |
| `enabled:hover:text-success-500` | `--tw-text-opacity: 1; color: color-mix(in srgb, var(--p-success-500) calc(100% * var(--tw-text-opacity, 1)), transparent)` |
| `enabled:hover:text-surface-500` | `--tw-text-opacity: 1; color: color-mix(in srgb, var(--p-surface-500) calc(100% * var(--tw-text-opacity, 1)), transparent)` |
| `enabled:hover:text-surface-700` | `--tw-text-opacity: 1; color: color-mix(in srgb, var(--p-surface-700) calc(100% * var(--tw-text-opacity, 1)), transparent)` |
| `enabled:hover:text-surface-950` | `--tw-text-opacity: 1; color: color-mix(in srgb, var(--p-surface-950) calc(100% * var(--tw-text-opacity, 1)), transparent)` |
| `enabled:hover:text-warn-500` | `--tw-text-opacity: 1; color: color-mix(in srgb, var(--p-warn-500) calc(100% * var(--tw-text-opacity, 1)), transparent)` |
| `enabled:hover:text-white` | `--tw-text-opacity: 1; color: rgb(255 255 255 / var(--tw-text-opacity, 1))` |
| `flex` | `display: flex` |
| `flex-col` | `flex-direction: column` |
| `focus-visible:outline` | `outline-style: solid` |
| `focus-visible:outline-1` | `outline-width: 1px` |
| `focus-visible:outline-danger-500` | `outline-color: color-mix(in srgb, var(--p-danger-500) calc(100% * 1), transparent)` |
| `focus-visible:outline-help-500` | `outline-color: color-mix(in srgb, var(--p-help-500) calc(100% * 1), transparent)` |
| `focus-visible:outline-info-500` | `outline-color: color-mix(in srgb, var(--p-info-500) calc(100% * 1), transparent)` |
| `focus-visible:outline-offset-2` | `outline-offset: 2px` |
| `focus-visible:outline-primary` | `outline-color: color-mix(in srgb, var(--p-primary-color) calc(100% * 1), transparent)` |
| `focus-visible:outline-success-500` | `outline-color: color-mix(in srgb, var(--p-success-500) calc(100% * 1), transparent)` |
| `focus-visible:outline-surface-600` | `outline-color: color-mix(in srgb, var(--p-surface-600) calc(100% * 1), transparent)` |
| `focus-visible:outline-surface-950` | `outline-color: color-mix(in srgb, var(--p-surface-950) calc(100% * 1), transparent)` |
| `focus-visible:outline-warn-500` | `outline-color: color-mix(in srgb, var(--p-warn-500) calc(100% * 1), transparent)` |
| `font-medium` | `font-weight: 500` |
| `gap-0` | `gap: 0px` |
| `gap-2` | `gap: 0.5rem` |
| `h-10` | `height: 2.5rem` |
| `h-4` | `height: 1rem` |
| `h-6` | `height: 1.5rem` |
| `h-full` | `height: 100%` |
| `inline-block` | `display: inline-block` |
| `inline-flex` | `display: inline-flex` |
| `invisible` | `visibility: hidden` |
| `items-center` | `align-items: center` |
| `justify-center` | `justify-content: center` |
| `leading-4` | `line-height: 1rem` |
| `m-0` | `margin: 0px` |
| `min-w-4` | `min-width: 1rem` |
| `opacity-0` | `opacity: 0` |
| `opacity-100` | `opacity: 1` |
| `order-1` | `order: 1` |
| `order-2` | `order: 2` |
| `order-[-1]` | `order: -1` |
| `outline-1` | `outline-width: 1px` |
| `outline-none` | `outline: 2px solid transparent; outline-offset: 2px` |
| `outline-offset-2` | `outline-offset: 2px` |
| `overflow-hidden` | `overflow: hidden` |
| `p-0` | `padding: 0px` |
| `placeholder:text-surface-500` | `--tw-text-opacity: 1; color: color-mix(in srgb, var(--p-surface-500) calc(100% * var(--tw-text-opacity, 1)), transparent)` |
| `px-0` | `padding-left: 0px; padding-right: 0px` |
| `px-2` | `padding-left: 0.5rem; padding-right: 0.5rem` |
| `px-3` | `padding-left: 0.75rem; padding-right: 0.75rem` |
| `px-[0.625rem]` | `padding-left: 0.625rem; padding-right: 0.625rem` |
| `px-[0.875rem]` | `padding-left: 0.875rem; padding-right: 0.875rem` |
| `py-1` | `padding-top: 0.25rem; padding-bottom: 0.25rem` |
| `py-2` | `padding-top: 0.5rem; padding-bottom: 0.5rem` |
| `py-[0.375rem]` | `padding-top: 0.375rem; padding-bottom: 0.375rem` |
| `py-[0.625rem]` | `padding-top: 0.625rem; padding-bottom: 0.625rem` |
| `relative` | `position: relative` |
| `rounded-[2rem]` | `border-radius: 2rem` |
| `rounded-border` | `border-radius: var(--p-content-border-radius)` |
| `rounded-full` | `border-radius: 9999px` |
| `rounded-md` | `border-radius: 0.375rem` |
| `select-none` | `user-select: none` |
| `shadow-[0_3px_1px_-2px_rgba(0,0,0,0.2),0_2px_2px_0_rgba(0,0,0,0.14),0_1px_5px_0_rgba(0,0,0,0.12)]` | `--tw-shadow: 0 3px 1px -2px rgba(0,0,0,0.2),0 2px 2px 0 rgba(0,0,0,0.14),0 1px 5px 0 rgba(0,0,0,0.12); --tw-shadow-colored: 0 3px 1px -2px var(--tw-shadow-color), 0 2px 2px 0 var(--tw-shadow-color), 0 1px 5px 0 var(--tw-shadow-color); box-shadow: var(--tw-ring-offset-shadow, 0 0 #0000), var(--tw-ring-shadow, 0 0 #0000), var(--tw-shadow)` |
| `start-0` | `inset-inline-start: 0px` |
| `text-[1.125rem]` | `font-size: 1.125rem` |
| `text-color` | `color: var(--p-text-color)` |
| `text-color-emphasis` | `color: var(--p-text-hover-color)` |
| `text-danger-500` | `--tw-text-opacity: 1; color: color-mix(in srgb, var(--p-danger-500) calc(100% * var(--tw-text-opacity, 1)), transparent)` |
| `text-help-500` | `--tw-text-opacity: 1; color: color-mix(in srgb, var(--p-help-500) calc(100% * var(--tw-text-opacity, 1)), transparent)` |
| `text-info-500` | `--tw-text-opacity: 1; color: color-mix(in srgb, var(--p-info-500) calc(100% * var(--tw-text-opacity, 1)), transparent)` |
| `text-lg` | `font-size: 1.125rem; line-height: 1.75rem` |
| `text-muted-color` | `color: var(--p-text-muted-color)` |
| `text-muted-color-emphasis` | `color: var(--p-text-hover-muted-color)` |
| `text-primary` | `--tw-text-opacity: 1; color: color-mix(in srgb, var(--p-primary-color) calc(100% * var(--tw-text-opacity, 1)), transparent)` |
| `text-primary-contrast` | `--tw-text-opacity: 1; color: color-mix(in srgb, var(--p-primary-contrast-color) calc(100% * var(--tw-text-opacity, 1)), transparent)` |
| `text-primary-emphasis` | `--tw-text-opacity: 1; color: color-mix(in srgb, var(--p-primary-hover-color) calc(100% * var(--tw-text-opacity, 1)), transparent)` |
| `text-sm` | `font-size: 0.875rem; line-height: 1.25rem` |
| `text-success-500` | `--tw-text-opacity: 1; color: color-mix(in srgb, var(--p-success-500) calc(100% * var(--tw-text-opacity, 1)), transparent)` |
| `text-surface-500` | `--tw-text-opacity: 1; color: color-mix(in srgb, var(--p-surface-500) calc(100% * var(--tw-text-opacity, 1)), transparent)` |
| `text-surface-600` | `--tw-text-opacity: 1; color: color-mix(in srgb, var(--p-surface-600) calc(100% * var(--tw-text-opacity, 1)), transparent)` |
| `text-surface-700` | `--tw-text-opacity: 1; color: color-mix(in srgb, var(--p-surface-700) calc(100% * var(--tw-text-opacity, 1)), transparent)` |
| `text-surface-950` | `--tw-text-opacity: 1; color: color-mix(in srgb, var(--p-surface-950) calc(100% * var(--tw-text-opacity, 1)), transparent)` |
| `text-warn-500` | `--tw-text-opacity: 1; color: color-mix(in srgb, var(--p-warn-500) calc(100% * var(--tw-text-opacity, 1)), transparent)` |
| `text-white` | `--tw-text-opacity: 1; color: rgb(255 255 255 / var(--tw-text-opacity, 1))` |
| `text-xs` | `font-size: 0.75rem; line-height: 1rem` |
| `top-0` | `top: 0px` |
| `top-1/2` | `top: 50%` |
| `transition-[background,color,left]` | `transition-property: background,color,left; transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1); transition-duration: 150ms` |
| `transition-colors` | `transition-property: color, background-color, border-color, text-decoration-color, fill, stroke; transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1); transition-duration: 150ms` |
| `underline` | `text-decoration-line: underline` |
| `w-0` | `width: 0px` |
| `w-10` | `width: 2.5rem` |
| `w-full` | `width: 100%` |
| `z-10` | `z-index: 10` |
<!-- GENERATED:TAILWIND-CONTRACT:END -->
