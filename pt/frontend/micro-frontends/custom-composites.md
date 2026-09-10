---
title: "Composites Customizados"
description: "Exceções orientadas por contrato para controles cuja affordance necessária não pode ser fornecida pelo PrimeVue."
---

# Composites Customizados

Controles customizados são exceções, não uma biblioteca de componentes alternativa.

## Teste de admissão

Um controle customizado só é aceito quando:

1. O PrimeVue não consegue fornecer nem compor a semântica, a interação e a affordance pretendidas.
2. A exceção registra as composições PrimeVue rejeitadas.
3. Ela nomeia um contrato de irmão PrimeVue gerado exato e o hash desse contrato.
4. Toda propriedade que esse contrato de irmão classifica como `shared-runtime` tem um mapeamento de origem exato.
5. Um utilitário fixo só é aceito quando o contrato de irmão classifica exatamente aquela propriedade como `platform-invariant`.
6. Geometria e comportamento inéditos são isolados e documentados.
7. Evidências de acessibilidade e visuais passam.

Equivalência de formato de dados não é equivalência de affordance. Um `SelectButton` de múltiplas opções pode representar três valores, mas não se parece nem se comporta como um toggle deslizante de três posições. Inversamente, não invente uma prop `positions` para o `ToggleSwitch`. Construa um irmão customizado revisado apenas quando o requisito de affordance for real.

## Contrato do módulo

Guarde uma exceção revisada no `wippy-fe.contract.json` na raiz do módulo:

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

Os valores mostrados são placeholders de schema, não evidência válida. O
mapeamento completo é gerado a partir do contrato de irmão selecionado; o
recorte de uma linha não é, por si só, uma exceção válida. A tooling gera os
hashes de origem e de contrato. Um hash de origem alterado ou um hash de
contrato de irmão alterado invalida a revisão.

Esta página define os campos normativos; ela não é um JSON Schema, e o
verificador de documentação apenas prova que este exemplo mantém o formato
exigido. O `wippy-fe-compliance` valida um contrato de módulo real contra o
manifesto do tema selecionado, verifica os hashes e o conjunto completo de
propriedades, e confere que toda referência de evidência resolve para o
resultado ou captura nomeado que passou, vindo do mesmo build candidato. A
evidência de acessibilidade vincula o `sourceSha256` do componente, os arquivos
com hash, zero erros inesperados de console e um resultado aprovado. A evidência
visual vincula os arquivos canônicos de antes/depois/diff, os hashes, as
métricas e a disposição recalculadas, e o build candidato correspondente. Uma
string, um arquivo ausente, um cenário/resultado/captura ausente, um hash de
build desatualizado, `pending` ou um resultado não revisado não satisfazem o
requisito de evidência.

`platformInvariantUtilities` e `moduleLocalProperties` podem estar vazios. Nunca
invente `gap-2`, `w-10`, `rounded-md` ou outro utilitário fixo apenas para deixar
um campo do contrato não vazio. Em particular, um irmão ToggleSwitch não pode
reclassificar largura, altura, raio, geometria de foco ou movimento como
invariantes quando o contrato de irmão selecionado classifica essas propriedades
como `shared-runtime`.

O manifesto de irmão classifica propriedades como:

- `shared-runtime`: todo irmão customizado mapeia e consome o token publicado ou
  o utilitário semântico respaldado por runtime.
- `platform-invariant`: um valor fixo é permitido apenas para exatamente esta
  propriedade.
- `implementation-private`: a mecânica interna do PrimeVue não se torna requisito
  para um irmão customizado.

Se a semântica de runtime necessária não existir, corrija primeiro o contrato de tema compartilhado. Nunca copie as dimensões atuais do irmão nem invente um nome de token.

`sharedAppearanceMappings` é exaustivo, não ilustrativo: ele contém exatamente
um mapeamento para cada propriedade `shared-runtime` do contrato de irmão
selecionado, nenhum ID de propriedade adicional, a parte do contrato, um seletor
estável do módulo e o tipo e nome exatos da origem publicada. A tooling de
conformidade usa o seletor, a parte, a propriedade CSS e a origem publicada para
provar o mapeamento estruturalmente com PostCSS; um nome de token em um
comentário ou em um seletor não relacionado não conta. Um mapeamento respaldado
por Tailwind também registra `utilityClasses` únicas e exatas; após a
normalização, esse conjunto precisa ser igual ao conjunto de origem do contrato
de irmão selecionado. `platformInvariantUtilities` contém registros
`{ "contractProperty": "...", "utility": "..." }` cujo utilitário é igual à
origem do contrato de irmão selecionado. `moduleLocalProperties`, quando não
vazio, contém IDs de propriedade estruturados e razões de revisão, e não um saco
de CSS em formato livre.

Nenhum pacote `@wippy-fe/ui` compartilhado é criado para uma única exceção. A promoção só se torna elegível depois que um segundo consumidor independente prove os mesmos requisitos de comportamento e portabilidade.
