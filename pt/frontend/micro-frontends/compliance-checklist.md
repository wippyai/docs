---
title: "Gates de conformidade e publicação do frontend"
description: "Regras normativas de conformidade, responsabilidade dos checkers, gates de publicação e requisitos de evidência visual determinística."
---

# Gates de conformidade e publicação do frontend

**Classificação: referência normativa de conformidade e evidência.** Os blocos
JSON definem formatos com placeholders para entradas dos checkers; não são
evidência válida nem fixture independente de aplicação.

Esta página define os requisitos determinísticos de checker e publicação. O
[Contrato de UI portável](../portable-ui-contract.md) define as regras de
portabilidade e interface; os guias vinculados detalham a implementação. O
índice associa cada regra à sua fonte e ao resultado obrigatório do checker.

A família pública de pacotes `@wippy-fe/*` 0.0.56 não inclui uma CLI de
conformidade de módulos. O checker de documentação valida os exemplos e a
atualidade dos catálogos gerados; o workflow de conformidade escolhido para o
módulo deve implementar as verificações abaixo.

| Regra | Orientação detalhada | Resultado determinístico |
|---|---|---|
| FE-PORT-001 | [Contrato de UI portável](../portable-ui-contract.md) | Rejeitar pressupostos privados de portabilidade |
| FE-UI-001 | [Contrato de UI portável](../portable-ui-contract.md) | Rejeitar controles padrão nativos ou recriados manualmente |
| FE-UI-002 | [Contrato de UI portável](../portable-ui-contract.md) | Exigir análise de affordance |
| FE-UI-003 | [Contrato de UI portável](../portable-ui-contract.md) | Exigir contrato do controle equivalente e evidência com tema alternativo |
| FE-UI-004 | [Contrato de UI portável](../portable-ui-contract.md) | Exigir configuração PrimeVue quando houver controles |
| FE-UI-005 | [Contrato de UI portável](../portable-ui-contract.md) | Rejeitar props e APIs inventadas |
| FE-TW-001 | [Contrato Tailwind](./tailwind-contract.md) | Resolver o preset Wippy selecionado |
| FE-TW-002 | [Contrato Tailwind](./tailwind-contract.md) | Rejeitar valores de compilação documentados como runtime |
| FE-TW-003 | [Contrato Tailwind](./tailwind-contract.md) | Rejeitar valores fixos sem classificação de invariante |
| FE-TW-004 | [Contrato Tailwind](./tailwind-contract.md) | Rejeitar overrides de mapeamentos protegidos |
| FE-TOKEN-001 | [Catálogo de tokens](./token-catalogue.md) | Rejeitar referências `--p-*` não declaradas |
| FE-TOKEN-002 | [Catálogo de tokens](./token-catalogue.md) | Rejeitar nomes de tokens inferidos ou inventados |
| FE-STYLE-001 | [Criação de temas](./theming.md) | Rejeitar classes privadas da facade e tematização `.p-*` local |
| FE-A11Y-001 | [Contrato de UI portável](../portable-ui-contract.md) | Rejeitar controles personalizados inválidos ou inacessíveis |

## Grupos obrigatórios do checker

- analisar o CSS de tokens com PostCSS e comparar o snapshot gerado byte a byte;
- resolver a configuração Tailwind real e compilar utilities representativas;
- classificar declarações emitidas como variável de runtime, constante
  compilada, literal arbitrário ou interna/transitória;
- rejeitar controles nativos, setup PrimeVue ausente, overrides protegidos,
  tokens não declarados, dependências privadas da facade e drift de hashes;
- comparar externals do import map com o snapshot completo fixado;
- conferir a saída do build contra o registry e o asset servido;
- usar `host.setThemeMode()` e verificar o estado AppConfig propagado;
- conferir procedência, tupla de versões e hashes dos catálogos;
- analisar e compilar exemplos copiáveis quando aplicável;
- retornar exatamente `UNSUPPORTED` no modo vinculado a projeto e falhar a CI.

Promptmap pode gerar pistas, mas não é evidência de existência de tokens,
resolução de utilities, alcance ou exclusão.

## Gates de publicação gerados

As seções geradas de tokens e Tailwind não podem conter marcadores pendentes na
publicação. Todo novo token de runtime precisa de consumidor CSS Wippy real,
teste de mutação de computed style e finalidade portável documentada.

A evidência de runtime permanece fora do repositório. Defina:

- `WIPPY_THEME_ROOT` para o pacote `@wippy-fe/theme` selecionado;
- `WIPPY_FE_EVIDENCE_ROOT` para o diretório de evidências da release contendo
  `runtime-acceptance-evidence.json`, `visual-evidence-index.json`, seus
  manifestos de cenário relativos e as capturas de tela.
- `WIPPY_FE_RUNTIME_EVIDENCE_SHA256` para o SHA-256 em minúsculas dos bytes
  exatos de `runtime-acceptance-evidence.json`.

Na raiz do Wippy Docs, execute a verificação de publicação com Node.js 22 ou
mais recente depois de definir as quatro variáveis. Em PowerShell:

```powershell
$env:FRONTEND_DOCS_PUBLICATION = '1'
node scripts/check-frontend-docs.mjs
Remove-Item Env:FRONTEND_DOCS_PUBLICATION
```

Em um shell POSIX:

```sh
FRONTEND_DOCS_PUBLICATION=1 node scripts/check-frontend-docs.mjs
```

O comando invoca o checker canônico do tema com caminho e hash da evidência,
depois valida e recalcula a evidência visual. A verificação normal de atualidade
da documentação não exige evidência local de release.

## Verificação visual determinística

Cada componente afetado por mudança visual deve ter manifesto de cenário e
evidência imutável de antes, depois e diff. Baseline e candidato usam o mesmo
browser, device-pixel ratio, fontes, dados, tema, viewport, reduced motion e
regra de estabilização. Capture temas claro e escuro, estados de interação,
overlays, estados desabilitados ou de erro e layouts desktop compatíveis. Não
invente requisito mobile para um produto exclusivo de desktop.

Cada cenário captura o recorte do componente e o contexto ao redor. Capture a
página inteira quando overlay, overflow ou layout puderem mudar. Um índice
declara a matriz aplicável completa e aponta para um manifesto imutável por
cenário:

```json
{
  "schemaVersion": "1.0.0",
  "componentId": "module.component",
  "applicability": {
    "themes": ["light", "dark"],
    "viewports": [{ "id": "desktop", "width": 1440, "height": 900 }],
    "states": ["default"],
    "overlay": false
  },
  "finalBuild": {
    "candidateCommit": "generated-candidate-commit",
    "candidateBuildHash": "sha256:generated-candidate-build-hash",
    "recapturedAfterBuild": true
  },
  "scenarios": [
    {
      "scenarioId": "module.component.light.default",
      "theme": "light",
      "viewport": "desktop",
      "state": "default",
      "manifest": "scenarios/module.component.light.default.json"
    },
    {
      "scenarioId": "module.component.dark.default",
      "theme": "dark",
      "viewport": "desktop",
      "state": "default",
      "manifest": "scenarios/module.component.dark.default.json"
    }
  ]
}
```

O checker expande o produto cartesiano de aplicabilidade e falha se algum tema,
viewport ou estado não tiver cenário único. Com `overlay: true`, o escopo
`full-page` também é obrigatório. Commit e hash do build final precisam
corresponder ao candidato de cada cenário, com `recapturedAfterBuild: true`.

Cada manifesto registra hashes em vez de confiar em nomes de arquivos:

```json
{
  "schemaVersion": "1.0.0",
  "scenarioId": "module.component.light.default",
  "componentId": "module.component",
  "state": {
    "theme": "light",
    "viewport": { "width": 1440, "height": 900 },
    "interaction": "default"
  },
  "runtime": {
    "browserVersion": "pinned-browser-version",
    "devicePixelRatio": 1,
    "fontsHash": "sha256:generated-font-set-hash",
    "fixtureHash": "sha256:generated-fixture-hash"
  },
  "baseline": {
    "commit": "generated-baseline-commit",
    "buildHash": "sha256:generated-baseline-build-hash"
  },
  "candidate": {
    "commit": "generated-candidate-commit",
    "buildHash": "sha256:generated-candidate-build-hash",
    "recapturedAfterBuild": true
  },
  "requiredScopes": ["component", "context"],
  "captures": [
    {
      "scope": "component",
      "before": {
        "artifactId": "component-before",
        "path": "screenshots/component-before.png",
        "sha256": "sha256:generated-before-hash"
      },
      "after": {
        "artifactId": "component-after",
        "path": "screenshots/component-after.png",
        "sha256": "sha256:generated-after-hash"
      },
      "diff": {
        "artifactId": "component-diff",
        "path": "screenshots/component-diff.png",
        "sha256": "sha256:generated-diff-hash"
      }
    },
    {
      "scope": "context",
      "before": {
        "artifactId": "context-before",
        "path": "screenshots/context-before.png",
        "sha256": "sha256:generated-before-hash"
      },
      "after": {
        "artifactId": "context-after",
        "path": "screenshots/context-after.png",
        "sha256": "sha256:generated-after-hash"
      },
      "diff": {
        "artifactId": "context-diff",
        "path": "screenshots/context-diff.png",
        "sha256": "sha256:generated-diff-hash"
      }
    }
  ],
  "diff": {
    "changedPixels": 0,
    "totalPixels": 1296000,
    "changedRatio": 0,
    "pixelDeltaThreshold": 8,
    "changedRatioThreshold": 0.001,
    "disposition": "within-threshold",
    "result": "passed",
    "waiver": null
  },
  "console": { "unexpectedErrors": [] },
  "fixtureCleanup": { "temporaryArtifactsRemaining": [], "verified": true }
}
```

Os valores acima mostram o formato exigido, não evidência válida. A publicação
falha se faltar cenário, escopo, imagem ou hash; se o build estiver desatualizado;
se restarem erros inesperados no Console ou fixtures temporárias; ou se o diff
exceder a tolerância sem waiver revisado. O waiver registra pixels alterados,
motivo, revisor e cenário; nunca dispensa capturas, erros do Console nem limpeza.
