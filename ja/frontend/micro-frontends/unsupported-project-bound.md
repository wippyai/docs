---
title: "サポート対象外の project-bound module"
description: "Wippy frontend portability を意図的に放棄する module に対する高度な警告。"
---

# サポート対象外の project-bound module

**分類: normative policy reference。** project が選択する compliance workflow の marker と必須 result を定義します。public package family は、この workflow を runnable CLI として提供しません。

Wippy がサポートする frontend contract は portable です。project-private な facade CSS、private class、その他 deployment 固有の frontend assumption を意図的に必要とする module は `UNSUPPORTED` です。

これは通常の例外ではありません。project compliance workflow は次の結果を強制する必要があります。

- 標準 compliance が正確に `UNSUPPORTED` を返す。
- 標準 CI が失敗する。
- 再利用、theme portability、upgrade、support は保証されない。
- module owner がすべての consuming facade と migration に責任を持つ。

この mode を「discouraged」「partially compliant」「non-compliant but accepted」と呼ばないでください。canonical status は `UNSUPPORTED` です。

project-bound mode は advanced-only で、Quickstart や標準 recipe には掲載しません。accessibility、HTML validity、security、backend schema requirement を免除することもできません。

project 全体が 1 deployment 専用でも、contract は暗黙に緩和されません。unsupported status を project policy と module metadata に明記し、Wippy の supported compliance workflow 外で標準 CI failure を意図的に処理する必要があります。

module-root の `wippy-fe.contract.json` に、次の exact field/value で宣言します。

```json
{
  "portability": "project-bound"
}
```

`mode` などの alias は受け付けません。compliance workflow はこの marker に対して `UNSUPPORTED` を返し、失敗終了する必要があります。exemption を与えるものではありません。public `@wippy-fe/*` 0.0.56 package family は application-compliance CLI を提供しないため、project が選択した compliance workflow にこの gate を実装します。
