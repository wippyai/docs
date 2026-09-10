---
title: "Índice de Regras de Conformidade de Frontend"
description: "Índice conciso das regras canônicas de frontend e da propriedade dos verificadores determinísticos."
---

# Índice de Regras de Conformidade de Frontend

Esta página é um índice, não uma segunda cópia do contrato. O
[Contrato de UI Portável](../portable-ui-contract.md) é dono dos enunciados
normativos das regras; os links abaixo fornecem orientação detalhada de
implementação.

| Regra | Orientação detalhada | Resultado determinístico |
|---|---|---|
| FE-PORT-001 | [Contrato de UI Portável](../portable-ui-contract.md) | Rejeitar suposições privadas de portabilidade |
| FE-UI-001 | [Contrato de UI Portável](../portable-ui-contract.md) | Rejeitar controles padrão crus ou feitos à mão |
| FE-UI-002 | [Contrato de UI Portável](../portable-ui-contract.md) | Exigir análise de affordance |
| FE-UI-003 | [Contrato de UI Portável](../portable-ui-contract.md) | Exigir contrato de irmãos e evidência de tema alternativo |
| FE-UI-004 | [Contrato de UI Portável](../portable-ui-contract.md) | Exigir configuração do PrimeVue quando houver controles |
| FE-UI-005 | [Contrato de UI Portável](../portable-ui-contract.md) | Rejeitar props e APIs inventadas |
| FE-TW-001 | [Contrato Tailwind](./tailwind-contract.md) | Resolver o preset Wippy selecionado |
| FE-TW-002 | [Contrato Tailwind](./tailwind-contract.md) | Rejeitar valores de tempo de compilação documentados como runtime |
| FE-TW-003 | [Contrato Tailwind](./tailwind-contract.md) | Rejeitar valores fixos de irmãos sem classificação de invariante |
| FE-TW-004 | [Contrato Tailwind](./tailwind-contract.md) | Rejeitar sobrescritas de mapeamento protegido |
| FE-TOKEN-001 | [Catálogo de Tokens](./token-catalogue.md) | Rejeitar referências `--p-*` não declaradas |
| FE-TOKEN-002 | [Catálogo de Tokens](./token-catalogue.md) | Rejeitar nomes de token deduzidos ou inventados |
| FE-STYLE-001 | [Autoria de Temas](./theming.md) | Rejeitar classes privadas da facade e temas `.p-*` locais ao módulo |
| FE-A11Y-001 | [Contrato de UI Portável](../portable-ui-contract.md) | Rejeitar controles customizados inválidos ou inacessíveis |

## Grupos de verificadores obrigatórios

- CSS de tokens parseado com PostCSS; snapshot de tokens gerado comparado byte a byte.
- Configuração real do Tailwind resolvida e utilitários representativos compilados.
- Declarações emitidas classificadas como variável de runtime, constante compilada, literal arbitrário ou interno/transitório.
- Controles crus, configuração ausente do PrimeVue, sobrescritas de mapeamento protegido, tokens não declarados, dependências privadas de facade e drift de hash de contrato são rejeitados.
- Externals do import map comparados com o snapshot completo e pinado.
- Saída do build verificada contra o registry configurado e o asset servido.
- A troca de tema usa `host.setThemeMode()` e verifica o estado propagado do AppConfig;
  manipulação direta de classes de tema e wires internos do proxy são rejeitados.
- Catálogos gerados verificados quanto a proveniência, tupla de versão e hashes de origem.
- Exemplos copiáveis parseados, compilados quando aplicável, e verificados quanto a conteúdo interativo aninhado.
- O modo vinculado a projeto retorna exatamente `UNSUPPORTED`, e o CI padrão falha.

O Promptmap pode gerar pistas. Ele não é evidência de existência de token, resolução de utilitário, alcançabilidade ou remoção.

## Gates de publicação para conteúdo gerado

As seções geradas de tokens e Tailwind não podem conter um marcador pendente na publicação. Todo novo token de runtime precisa de um consumidor CSS real do Wippy, um teste de mutação de estilo computado e um propósito documentado de consumidor portável.

A publicação mantém a evidência de runtime fora do repositório. Defina:

- `WIPPY_THEME_ROOT` como o pacote `@wippy-fe/theme` selecionado.
- `WIPPY_FE_EVIDENCE_ROOT` como o diretório de evidências da release contendo
  `runtime-acceptance-evidence.json`, `visual-evidence-index.json`, seus
  manifestos relativos de cenário e as capturas de tela.
- `WIPPY_FE_RUNTIME_EVIDENCE_SHA256` como o SHA-256 em minúsculas dos bytes
  exatos de `runtime-acceptance-evidence.json`.

`FRONTEND_DOCS_PUBLICATION=1 node scripts/check-frontend-docs.mjs` invoca o
verificador canônico de aceitação do tema selecionado com esse caminho de
evidência e hash, e então valida e recalcula a evidência visual. Verificações
normais de atualidade da documentação não exigem evidência local de release.

## Verificação visual determinística

Todo componente afetado por uma mudança de aparência tem um manifesto de cenário
e evidência imutável de antes/depois/diff. A baseline e a candidata usam o mesmo
build de navegador, device-pixel ratio, fontes, dados de fixture, tema, viewport,
configuração de movimento reduzido e regra de estabilização. Capture todos os
estados aplicáveis, incluindo temas claro e escuro, estados de interação,
overlays, estados desabilitado/erro e os layouts de desktop que o produto
suporta. Não invente um requisito estreito/mobile para um produto exclusivo de
desktop.

Cada cenário captura o recorte do componente e o contexto da aplicação ao redor.
Ele também captura a página inteira quando um overlay, um overflow ou o layout da
página pode ser afetado. Um índice de componente declara a matriz aplicável
completa e aponta para um manifesto imutável por cenário:

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

O verificador expande o produto cartesiano de aplicabilidade e falha se qualquer
tema, viewport ou estado declarado não tiver um cenário único. Quando `overlay` é
true, todo cenário também exige o escopo de captura `full-page`. O commit e o
hash do build final precisam corresponder à candidata de cada cenário, e
`recapturedAfterBuild` precisa ser true.

Cada manifesto de cenário registra hashes em vez de confiar em nomes de arquivo:

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

Os valores acima mostram o formato exigido, não uma evidência válida. A
publicação falha quando um componente alterado ou um estado obrigatório não tem
cenário, um escopo de captura obrigatório está ausente, uma imagem ou hash
referenciado está faltando, builds estão desatualizados, restam erros
inesperados de console, resta código temporário de fixture, ou o diff excede a
tolerância sem um waiver de design revisado. Um waiver registra os pixels
exatamente alterados, a razão de design, o revisor e o cenário afetado; ele não
pode dispensar capturas ausentes, erros de console ou limpeza de fixture.
