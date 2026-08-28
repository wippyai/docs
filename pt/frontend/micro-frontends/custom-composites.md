---
title: "Composições personalizadas"
description: "Exceções orientadas por contrato para controles cuja affordance necessária não pode ser fornecida pelo PrimeVue."
---

# Composições personalizadas

**Classificação: referência normativa de contrato de exceção.** O bloco JSON é um exemplo de schema com placeholders, não um contrato válido nem um conjunto de evidências.

Controles personalizados são exceções, não uma biblioteca alternativa de componentes.

## Teste de admissão

Um controle personalizado é aceito somente quando:

1. PrimeVue não consegue fornecer ou compor a semântica, interação e affordance pretendidas.
2. A exceção registra as composições PrimeVue rejeitadas.
3. Ela nomeia um contrato irmão PrimeVue gerado exato e seu hash.
4. Toda propriedade que o contrato irmão classifica como `shared-runtime` tem um mapeamento exato de origem.
5. Uma utility fixa só é aceita quando o contrato irmão classifica exatamente essa propriedade como `platform-invariant`.
6. Geometria e comportamento novos são isolados e documentados.
7. As evidências de acessibilidade e visuais passam.

Equivalência do formato dos dados não é equivalência de affordance. Um `SelectButton` de várias opções pode representar três valores, mas não se parece nem se comporta como um toggle deslizante de três posições. Do mesmo modo, não invente uma prop `positions` para `ToggleSwitch`. Crie um irmão personalizado revisado somente quando a necessidade de affordance for real.

## Contrato do módulo

Armazene uma exceção revisada em `wippy-fe.contract.json` na raiz do módulo:

```json
{
  "schemaVersion": "generated-by-selected-contract-tool",
  "exceptions": [
    {
      "id": "module.control.example",
      "source": "src/components/ExampleControl.vue",
      "sourceSha256": "generated-from-source",
      "semanticRole": "documented-role",
      "requiredAffordance": "documented-affordance",
      "rejectedPrimeVueCompositions": [
        {
          "components": ["SelectButton"],
          "reason": "The reviewed sliding affordance cannot be preserved."
        }
      ],
      "visualSibling": {
        "component": "ToggleSwitch",
        "contractId": "primevue.toggleswitch.portable-appearance",
        "contractHash": "generated-from-selected-theme-contract"
      },
      "sharedAppearanceMappings": [
        {
          "contractProperty": "root.width",
          "part": "root",
          "selector": ".example-control",
          "source": {
            "kind": "css-variable",
            "name": "--p-toggleswitch-width"
          }
        }
      ],
      "platformInvariantUtilities": [],
      "moduleLocalProperties": [],
      "accessibilityEvidence": {
        "manifest": ".local/evidence/accessibility-manifest.json",
        "scenarioId": "module.control.example.keyboard",
        "resultId": "module.control.example.keyboard.passed",
        "build": {
          "head": "generated-candidate-commit",
          "trackedFrontendDiffSha256": "generated-diff-hash"
        }
      },
      "visualEvidence": {
        "manifest": ".local/evidence/visual-manifest.json",
        "scenarioId": "module.control.example.light.default",
        "captureId": "module.control.example.light.default.component",
        "build": {
          "head": "generated-candidate-commit",
          "trackedFrontendDiffSha256": "generated-diff-hash"
        }
      }
    }
  ]
}
```

Os valores mostrados são placeholders do schema, não evidências válidas. O mapeamento completo é gerado a partir do contrato irmão selecionado; o trecho de uma linha não é uma exceção válida sozinho. O tooling gera os hashes do código-fonte e do contrato. Alterar o hash do código-fonte ou do contrato irmão invalida a revisão.

Esta página define os campos normativos; ela não é um JSON Schema, e o checker da documentação prova apenas que este exemplo conserva o formato necessário. Uma implementação de conformidade de módulo precisa validar um contrato real contra o manifest de tema selecionado, verificar os hashes e o conjunto completo de propriedades e confirmar que cada referência de evidência aponta para o resultado ou capture aprovado e nomeado do mesmo build candidato. A família pública de pacotes `@wippy-fe/*` 0.0.56 não fornece uma CLI de conformidade de módulo. Evidência de acessibilidade vincula o `sourceSha256` do componente, os arquivos com hash, zero erros inesperados de console e um resultado aprovado. Evidência visual vincula arquivos canônicos before/after/diff, hashes, métricas recalculadas e disposição, além do build candidato correspondente. Uma string, arquivo ausente, scenario/result/capture ausente, hash de build obsoleto, resultado `pending` ou não revisado não satisfaz a exigência de evidência.

`platformInvariantUtilities` e `moduleLocalProperties` podem estar vazios. Nunca invente `gap-2`, `w-10`, `rounded-md` ou outra utility fixa apenas para preencher um campo do contrato. Em particular, um irmão de ToggleSwitch não pode reclassificar largura, altura, raio, geometria de foco ou movimento como invariantes quando o contrato irmão selecionado classifica essas propriedades como `shared-runtime`.

O manifest irmão classifica propriedades como:

- `shared-runtime`: todo irmão personalizado mapeia e consome o token publicado ou a utility semântica apoiada pela runtime.
- `platform-invariant`: um valor fixo é permitido somente para essa propriedade exata.
- `implementation-private`: a mecânica interna do PrimeVue não se torna requisito de um irmão personalizado.

Se a semântica de runtime necessária não existir, corrija primeiro o contrato de tema compartilhado. Nunca copie as dimensões atuais do irmão nem invente um nome de token.

`sharedAppearanceMappings` é exaustivo, não ilustrativo: contém exatamente um mapeamento para cada propriedade `shared-runtime` do contrato irmão selecionado, nenhum id de propriedade adicional, a parte do contrato, um seletor estável do módulo e o nome e tipo exatos da origem publicada. A implementação de conformidade selecionada precisa usar seletor, parte, propriedade CSS e origem publicada para provar estruturalmente o mapeamento com PostCSS; um nome de token em comentário ou seletor alheio não conta. Um mapeamento baseado em Tailwind também registra `utilityClasses` únicas e exatas; após normalização, esse conjunto precisa ser igual ao conjunto de origem do contrato irmão selecionado. `platformInvariantUtilities` contém registros `{ "contractProperty": "...", "utility": "..." }` cuja utility corresponde à origem do contrato irmão selecionado. Quando não vazio, `moduleLocalProperties` contém ids estruturados de propriedade e motivos de revisão, não um conjunto livre de CSS.

Nenhum pacote compartilhado `@wippy-fe/ui` é criado para uma única exceção. Uma promoção só passa a ser elegível quando um segundo consumidor independente comprova os mesmos requisitos de comportamento e portabilidade.
