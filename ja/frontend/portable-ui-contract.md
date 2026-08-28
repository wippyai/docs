---
title: "Portable UI 契約"
description: "PrimeVue、Tailwind、token、custom control、accessibility、portability に関する規範的な規則。"
---

# Portable UI 契約

このページは規範的な契約リファレンスです。各 rule ID は実装チュートリアルではなく、review と acceptance の要件を定義します。

以下の ID が各規則の正規の所有者です。

## 移植性

### FE-PORT-001：portable がデフォルト

準拠モジュールは、モジュールを編集せず、プロジェクト固有の facade class を使わずに、別の準拠 facade theme でも動作します。

### FE-STYLE-001：private facade への依存を禁止

portable module は、1 つの facade だけで定義された任意の class または selector を要求できません。共有 PrimeVue `.p-*` theme rule は private class ではありません。1 つのモジュールだけが必要とする PrimeVue 以外の styling はそのモジュールに置きますが、共有 component と semantics に従って最小限にする必要があります。

自作モジュールの *複数* で同じ PrimeVue 以外の styling が必要な場合、それは facade にも各モジュールにも属しません。[デザインレイヤー](./design-layer.md)を参照してください。

## コンポーネントと affordance

### FE-UI-001：要件を満たす場合は PrimeVue を使用

PrimeVue が必要な semantics、interaction、意図した affordance を提供する場合、モジュールはそれを使用する必要があります。

### FE-UI-002：データ形状は affordance ではない

同じ値を表現できるだけでは、2 つのコントロールが等価とは限りません。意図する affordance が見た目と動作の両方で toggle である場合、`SelectButton` が 3 position sliding toggle の自動的な代替になるわけではありません。

### FE-UI-003：意味と操作性が同じなら外観も同じ

等価なコントロールは、size、spacing、color、typography、border、shadow、focus、hover、disabled、invalid、motion の挙動を共有する必要があります。custom composite は PrimeVue の visual sibling を指定し、適用可能な共有 runtime property をすべて継承します。

### FE-UI-004：PrimeVue の省略は限定的

物理的にも意味的にも PrimeVue に類するものを何も描画しない場合に限り、PrimeVue を省略できます。chart だけの component は該当しますが、button や form field を持つ chart は該当しません。

### FE-UI-005：component API を作り出さない

未文書化の prop や behavior は近道ではありません。存在しない positions prop を追加しても PrimeVue `ToggleSwitch` は 3 position control になりません。必要な affordance を提供する PrimeVue component または composition がない場合、review 済み custom-sibling process を使用します。

## Tailwind と token

### FE-TW-001：Wippy Tailwind はサポート対象

共有 Wippy preset はサポート対象のビルド時契約です。モジュールは文書化された utility を使用し、domain layout、application-specific breakpoint、decoration、新しい visualization のために拡張できます。

### FE-TW-002：コンパイル済み値は runtime token ではない

`px-3`、`rounded-md`、`duration-200` などの utility は通常、定数へコンパイルされます。一貫した baseline を提供しますが、facade が runtime theme variable を切り替えても変化しません。

### FE-TW-003：共有 sibling appearance は runtime semantics に追従

appearance property が theme 間で PrimeVue sibling に追従する必要がある場合、文書化された runtime-backed semantic utility または public token を直接使用します。固定 utility が許可されるのは、その property が明示的に `platform-invariant` と分類されている場合だけです。

### FE-TW-004：保護された mapping の意味を維持

モジュールは preset を拡張できますが、保護された primary、surface、severity、text、content、highlight、portable-control semantics を非互換に再定義できません。

### FE-TOKEN-001：すべての token が実在すること

すべての `--p-*` 参照は、選択した生成済み manifest に存在する必要があります。

### FE-TOKEN-002：token 名は推測可能な API ではない

類推で token を組み立てないでください。[トークンカタログ](./micro-frontends/token-catalogue.md)または選択した package manifest を検索します。

## アクセシビリティ

### FE-A11Y-001：custom は accessibility 免除ではない

custom-control の例外でも、有効な HTML、keyboard interaction、focus、accessible name、state、disabled behavior を維持する必要があります。interactive element を入れ子にしてはいけません。
