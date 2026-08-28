---
title: "Micro frontends do Wippy"
description: "Escolha entre uma aplicação micro frontend e um web component e siga os guias correspondentes de build, roteamento, proxy e tema."
---

# Micro frontends do Wippy

**Classificação: guia conceitual de decisão.** Esta página compara os dois tipos de artefato e encaminha o leitor às referências de build e API; ela não é um tutorial independente de projeto.

O código frontend do Wippy é executado dentro do limite de isolamento do Web Host. É possível criar dois tipos de artefato: **aplicações micro frontend** e **web components**. Ambos são projetos Vite independentes, comunicam-se com a plataforma por `@wippy-fe/proxy` e são declarados ao backend em um entry de registry `_index.yaml`. Eles diferem na renderização e no local de uso.

## Aplicação micro frontend ou web component

| | Aplicação micro frontend (`view.page`) | Web component (`view.component`) |
|---|---|---|
| **Renderizado como** | Superfície de página: iframe srcdoc ou Web Fragment | Custom element em Shadow DOM, dentro de uma página |
| **Tem URL própria/entry de navegação** | Sim — reivindica um `mountRoute` do backend | Não — incorporado em outra página ou artefato de chat |
| **Roteamento interno** | Sim — `vue-router` com memory history | Não — componente único, sem router |
| **Controla a superfície alocada** | Sim — a superfície pode ser um painel, não o viewport do navegador | Não — dimensionado pelo layout ao redor |
| **Reutilizável entre páginas** | Não — uma URL, um local | Sim — qualquer página pode incorporar a tag |
| **Recebe props tipadas** | Não — lê o `AppConfig` | Sim — atributos HTML declarados por schema |
| **Emite eventos tipados** | Não — comunica-se pela API proxy | Sim — `CustomEvent`s declarados por schema |
| **Isolamento CSS** | Depende do engine: limite de iframe; um Web Fragment compartilha o documento do host | Limite de seletor do Shadow DOM |

**Regra rápida:** use uma aplicação micro frontend quando ela precisar de `vue-router`, URL dedicada ou controle de uma superfície de página roteada. Use um web component quando ele precisar ser incorporável, reutilizável e autocontido.

## Próximas leituras

O [Quickstart](./quickstart.md) fornece exemplos completos mínimos para uma aplicação micro frontend Vue e um web component Vue, com links para o repositório público [`app`](https://github.com/wippyai/app).

Para criar uma aplicação micro frontend:

1. [Aplicação micro frontend](./micro-frontend-app.md) — scaffold, bloco `wippy` de `package.json`, configuração Vite, sequência de bootstrap e sincronização do router
2. [Sistema de build](./build-system.md) — `@wippy-fe/vite-plugin`, `wippy-meta.json` e externals
3. [API proxy](./proxy-api.md) — referência de `@wippy-fe/proxy` para comunicação com o host
4. [Criação de temas](./theming.md) → [Temas: aplicações micro frontend](./micro-frontend-app-theming.md) — catálogo de variáveis CSS e sua recepção por injeções proxy

Para criar um web component:

1. [Web component](./web-component.md) — scaffold, `WippyVueElement`, props, eventos e CSS de shadow DOM
2. [Sistema de build](./build-system.md) — o mesmo conjunto de ferramentas Vite, com outro plugin e formato de saída
3. [API proxy](./proxy-api.md) — a mesma API, importada diretamente de `@wippy-fe/proxy`
4. [Criação de temas](./theming.md) → [Temas: web components](./web-component-theming.md) — catálogo de variáveis CSS e sua recepção através do limite do shadow DOM

Ambos:

- [Modo sem host](./host-less-mode.md) — desenvolvimento e testes sem executar o Web Host completo
- [Índice de regras de conformidade](./compliance-checklist.md) — proprietários canônicos de regras e gates determinísticos
- [Depuração](./debugging.md) — guia orientado por sintomas para os cenários de falha mais comuns

## Pré-requisitos

- Módulo backend Wippy com `wippy/views` declarado como dependência; consulte [Views](../../framework/views.md).
- `wippy/facade` para o entry point do Web Host; consulte [Entry point da facade](../web-host/entry-point.md).
- Node.js 22.12 ou mais recente e Vite 7 para a baseline desta documentação. O pacote-fonte do Host declara Node 22+ e usa Vite 7; o próprio Vite 7 exige Node 20.19+ ou 22.12+. `@wippy-fe/vite-plugin` 0.0.56 também aceita Vite 5 e 6, mas os consumidores que escolherem essas versões precisam seguir os requisitos de Node da respectiva versão do Vite.
