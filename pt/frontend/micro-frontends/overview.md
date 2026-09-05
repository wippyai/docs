---
title: "Micro Frontends do Wippy"
description: "Código de frontend do Wippy roda dentro do limite de isolamento do Web Host. Existem dois tipos de artefato que você pode construir: micro frontend apps e web…"
---

# Micro Frontends do Wippy

Código de frontend do Wippy roda dentro do limite de isolamento do Web Host. Existem dois tipos de artefato que você pode construir: **micro frontend apps** e **web components**. Ambos são projetos Vite independentes, ambos se comunicam com a plataforma através do `@wippy-fe/proxy`, e ambos são declarados ao backend por meio de uma entrada de registry `_index.yaml`. A diferença está em como são renderizados e para que servem.

## Micro Frontend App vs web component

| | Micro Frontend App (`view.page`) | Web component (`view.component`) |
|---|---|---|
| **Renderizado como** | Iframe completo, contexto de navegação isolado | Custom element em Shadow DOM, dentro de uma página |
| **Tem URL / entrada de navegação própria** | Sim — reivindica um `mountRoute` no backend | Não — embutido dentro de outra página ou de um artefato de chat |
| **Roteamento interno** | Sim — `vue-router` com histórico em memória | Não — componente único, sem router |
| **Controla o viewport** | Sim | Não — dimensionado pelo layout ao redor |
| **Reutilizável entre páginas** | Não — uma URL, um lugar | Sim — qualquer página pode embutir a tag |
| **Recebe props tipadas** | Não — lê o `AppConfig` | Sim — atributos HTML declarados por schema |
| **Emite eventos tipados** | Não — comunica-se via API do proxy | Sim — `CustomEvent`s declarados por schema |
| **Isolamento de CSS** | Limite do iframe | Shadow DOM (encapsulamento completo) |

**Regra rápida:** se precisa de `vue-router`, de uma URL dedicada, ou é dono do viewport inteiro — é um micro frontend app. Se é embutível, reutilizável e autocontido — é um web component.

Na dúvida, comece com um web component. É mais fácil promovê-lo depois a um micro frontend app do que o contrário.

## O que ler em seguida

Com pressa? O [Quickstart](./quickstart.md) tem exemplos ponta a ponta mínimos tanto para um micro frontend app em Vue quanto para um web component em Vue, com links para o repositório público [`app`](https://github.com/wippyai/app).

Construir um micro frontend app:
1. [Micro Frontend App](./micro-frontend-app.md) — scaffold, bloco wippy do `package.json`, configuração do Vite, sequência de bootstrap, sincronização do router
2. [Sistema de Build](./build-system.md) — `@wippy-fe/vite-plugin`, `wippy-meta.json`, externals
3. [API do Proxy](./proxy-api.md) — referência do `@wippy-fe/proxy` para comunicação com o host
4. [Temas](./theming.md) → [Temas: Micro Frontend Apps](./micro-frontend-app-theming.md) — catálogo de variáveis CSS e, depois, como recebê-lo via injeções do proxy

Construir um web component:
1. [Web Component](./web-component.md) — scaffold, `WippyVueElement`, props, eventos, CSS no shadow DOM
2. [Sistema de Build](./build-system.md) — mesma toolchain Vite, plugin e formato de saída diferentes
3. [API do Proxy](./proxy-api.md) — mesma API, importada diretamente de `@wippy-fe/proxy`
4. [Temas](./theming.md) → [Temas: Web Components](./web-component-theming.md) — catálogo de variáveis CSS e, depois, como recebê-lo através do limite do shadow DOM

Ambos:
- [Modo Host-less](./host-less-mode.md) — desenvolva e teste sem rodar o Web Host completo
- [Índice de Regras de Conformidade](./compliance-checklist.md) — donos canônicos das regras e gates determinísticos
- [Depuração](./debugging.md) — guia orientado por sintoma para os cenários de falha mais comuns

## Pré-requisitos

- Módulo de backend Wippy com `wippy/views` declarado como dependência (veja [Views](../../framework/views.md))
- `wippy/facade` para o ponto de entrada do Web Host (veja [Ponto de Entrada da Facade](../web-host/entry-point.md))
- Node.js 22 ou mais novo e Vite 7, conforme declarado pelo código-fonte do Web Host selecionado;
  verifique novamente o pacote dele quando a release-alvo mudar
