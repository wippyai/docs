---
title: "Visão Geral do Web Host"
description: "O Wippy Web Host é uma single-page application em Vue 3 construída com a metodologia Feature-Sliced Design e entregue por um CDN em…"
---

# Visão Geral do Web Host

O Wippy Web Host é uma single-page application em Vue 3 construída com a metodologia Feature-Sliced Design e entregue por um CDN em `https://web-host.wippy.ai`. Ele hospeda todas as páginas e componentes de UI voltados ao usuário de uma aplicação Wippy. Você não o compila nem o publica — você o configura através do módulo de backend `wippy/facade` e ele carrega automaticamente.

![Arquitetura FE do Wippy](../diagrams/fe-arch-overview.svg)

## Modelo de Três Camadas

Uma aplicação Wippy em execução é composta por três camadas aninhadas:

**Camada 1 — Página servida pelo `wippy/facade`.** Esta é a sua página HTML renderizada pelo backend. O módulo `wippy/facade` registra um servidor de arquivos estáticos e um endpoint `/facade/config` no seu gateway Wippy. Quando um usuário navega até sua aplicação, o `wippy/facade` serve uma página HTML enxuta que carrega a entrada de módulo JS do Web Host a partir do CDN (`module.js` para compat, `managed-layout.js` para managed) e a inicializa com a configuração de `/facade/config`. A página em si não carrega Vue nem React — ela é intencionalmente enxuta.

**Camada 2 — Web Host.** O bundle do Web Host carrega como um módulo JS que assume a página inteira e seu histórico de navegador. Ele é dono do chrome do Wippy: a sidebar de navegação, o painel de chat, o gerenciamento de sessões e a surface de renderização de páginas. Ele recebe sua configuração completa da chamada de init da página e nunca contém URLs ou tokens específicos de deploy dentro do próprio bundle. É isso que torna o bundle hospedado em CDN portável entre deploys. (Para embutições manuais sem facade, o mesmo host pode em vez disso rodar dentro de um iframe via a entrada `iframe.html` — veja a tabela de pontos de entrada abaixo.)

**Camada 3 — Micro-frontends filhos.** O Web Host, por sua vez, embute views definidas pelo usuário como iframes aninhados (módulos `view.page`) ou como web components (módulos `view.component`). Cada filho roda isolado. O Web Host injeta um script de proxy que dá aos filhos acesso à API do Wippy, ao contexto de autenticação, ao CSS do tema e aos canais de comunicação — tudo sem que o filho precise saber onde está publicado.

```
Página (HTML do wippy/facade — carrega module.js / managed-layout.js)
  └─ Web Host (assume a página + o histórico do navegador)
       ├─ UI de chat, navegação, sidebar
       └─ Micro-frontends filhos
            ├─ view.page  → iframe srcdoc + proxy.js
            └─ view.component → custom element + ESM @wippy-fe/proxy
```

## Pontos de Entrada

O CDN do Web Host serve vários pontos de entrada a partir do mesmo diretório versionado. O correto depende de como você está integrando:

Cada entrada é servida pelo CDN em `<release-tag>/<entry>` (por exemplo, `/<release-tag>/module.js`).

| Entrada | Caso de uso |
|-------|----------|
| `module.js` | App completo no modo **compat** — o shell padrão com sidebar de navegação + área de página + painel direito de chat. Montado diretamente na página via `window.initWippyApp()`; assume a página inteira e seu histórico de navegador. É a entrada que o `wippy/facade` atual serve por padrão. |
| `managed-layout.js` | App completo no modo **managed** — o layout multi-painel declarativo. Servido pela facade quando `fe_mode = managed`. Acesso antecipado (veja [Layout Multi-Painel](./multi-panel-layout.md)). |
| `iframe.html` | App completo rodando **dentro de um iframe**, para isolamento ou embutição parcial em página. Use-o para embutições manuais sem facade, em que você fornece a configuração via um handshake de PostMessage `SetConfig`. A própria facade carrega as entradas de módulo JS acima, não esta. |
| `chat-iframe.html` | Interface de chat mínima, sem sidebar nem páginas. Útil para embutir um widget de chat focado. |
| `chat.js` | Módulo ESM headless expondo as stores de chat e o cliente WebSocket. Use para construir UIs completamente customizadas. |
| `ws.js` | Serviço WebSocket autônomo, sem dependência de Vue ou Pinia. Use para integrações de tempo real de baixo nível. |

Para deploys padrão baseados em `wippy/facade`, você nunca referencia esses caminhos diretamente. A facade lê `fe_facade_url` de sua configuração, seleciona a entrada de módulo JS que corresponde a `fe_mode` (`module.js` para compat, `managed-layout.js` para managed) e constrói a URL correta automaticamente.

## Versionamento no CDN

O Web Host é versionado por tag do git. O padrão canônico de URL de produção é:

```
https://web-host.wippy.ai/<release-tag>/
```

Onde `<release-tag>` é a tag de release do git do Web Host — seja uma release estável ou um deploy de preview de branch de feature. O CDN de staging fica em `https://web-host.staging.wippy.ai/<release-tag>/`.

Normalmente você não define a versão. O módulo `wippy/facade` vem com um `fe_facade_url` padrão apontando para um build do Web Host correspondente, então **a versão do Web Host acompanha o módulo da facade** — atualizar o `wippy/facade` é como você migra para um Web Host mais novo. Apps filhos que compartilham bibliotecas de vendor via o import map recebem exatamente as versões que aquele build fornece.

Para fixar uma versão específica do Web Host — para permanecer em um build comprovadamente bom, ou para optar por uma tag de branch de feature / acesso antecipado — sobrescreva o parâmetro `fe_facade_url`:

```yaml
- name: fe_facade_url
  value: https://web-host.wippy.ai/<release-tag>
```

Isso fixa o deploy inteiro nesse build. Veja [Overrides de CLI](../../guides/cli.md) para a sintaxe `-o` / `--override` que permite defini-lo em tempo de execução.

## Stack Técnica

O Web Host é construído com Vue 3 (Composition API), PrimeVue + Tailwind CSS 3 para componentes de UI, Pinia para gerenciamento de estado, Vue Router para navegação e Axios para HTTP. Durante o desenvolvimento, busque `<fe_facade_url>/import-map.json` e coloque todas as chaves do objeto `imports` dele nos externals do Rollup, mesmo que o artefato atual não importe aquela chave. Empacote uma dependência importada apenas quando o especificador exato dela estiver ausente. Busque novamente quando a tag do Web Host mudar ou uma nova dependência for adicionada.

## Veja Também

- [Ponto de Entrada da Facade](./entry-point.md) — como a facade entrega o Web Host aos usuários e como é o fluxo de configuração
- [Sequência de Bootstrap](./bootstrap.md) — o que acontece dentro do Web Host depois que ele recebe a configuração
- [Layout Multi-Painel](./multi-panel-layout.md) — o modo de layout gerenciado para shells multi-painel customizados
- [Pacotes](./packages.md) — os pacotes npm `@wippy-fe/*` disponíveis para desenvolvedores de apps filhos
- [Módulo Facade](../../framework/facade.md) — configuração de backend para o `wippy/facade`
- [Motores de Renderização](./render-engines.md) — os dois motores de renderização de página (iframe srcdoc vs Web Fragment)
