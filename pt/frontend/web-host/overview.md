---
title: "Visão geral do Web Host"
description: "Como o Web Host hospedado em CDN, a página da facade e os micro frontends filhos se integram em uma aplicação Wippy."
---

# Visão geral do Web Host

Esta página é uma referência de arquitetura. Ela explica os limites de implantação e os pontos de entrada; a configuração está nos guias vinculados de facade e micro frontend.

O Wippy Web Host é uma aplicação de página única Vue 3 criada com a metodologia Feature-Sliced Design e entregue por `https://web-host.wippy.ai`. Ele hospeda as páginas e os componentes de interface de uma aplicação Wippy. Configure-o pelo módulo backend `wippy/facade`; você não o compila nem o implanta junto com a aplicação.

![Arquitetura frontend do Wippy](../diagrams/fe-arch-overview.svg)

## Modelo de três camadas

Uma aplicação Wippy em execução é composta por três camadas aninhadas:

**Camada 1 — Página servida por `wippy/facade`.** É sua página HTML renderizada pelo backend. O módulo `wippy/facade` registra um servidor de arquivos estáticos e um endpoint `/facade/config` no gateway Wippy. Quando o usuário navega até a aplicação, `wippy/facade` serve uma página HTML mínima que carrega da CDN o entry de módulo JS do Web Host (`module.js` para compat, `managed-layout.js` para managed) e o inicializa com a configuração de `/facade/config`. A página em si não contém Vue nem React; ela é intencionalmente mínima.

**Camada 2 — Web Host.** O bundle do Web Host é carregado como módulo JS, assume a página inteira e seu histórico do navegador. Ele controla o chrome do Wippy: navegação, chat, gerenciamento de sessão e superfície de renderização de páginas. Recebe toda a configuração da chamada de inicialização da página e não contém URLs ou tokens específicos da implantação. Assim, o mesmo bundle da CDN atende a implantações diferentes. Para embeds manuais sem facade, o host pode executar dentro de um iframe pelo entry `iframe.html` descrito abaixo.

**Camada 3 — Micro frontends filhos.** O Web Host renderiza módulos `view.page` pelo engine de página configurado: iframe srcdoc legado ou Web Fragment. Módulos `view.component` são montados como custom elements. O engine iframe oferece um browsing context separado. Um Web Fragment usa um realm reframed refletido no documento do host e não é um limite de isolamento; o shadow root de um componente isola seletores, não autoridade. Cada superfície recebe o adaptador proxy apropriado para acesso à API Wippy, contexto de autenticação, entrega de tema e comunicação sem precisar de URLs específicas da implantação.

```
Page (wippy/facade HTML — loads module.js / managed-layout.js)
  └─ Web Host (takes over the page + browser history)
       ├─ Chat UI, navigation, sidebar
       └─ Child micro-frontends
            ├─ view.page → srcdoc iframe or Web Fragment + proxy adapter
            └─ view.component → custom element + @wippy-fe/proxy ESM
```

## Pontos de entrada

A CDN do Web Host serve vários pontos de entrada no mesmo diretório versionado. Escolha de acordo com a integração. Cada entry está disponível em `<release-tag>/<entry>`, por exemplo `/<release-tag>/module.js`.

| Entry | Caso de uso |
|-------|----------|
| `module.js` | Aplicação completa no modo **compat**: shell padrão com sidebar de navegação, área de página e painel direito de chat. Montado diretamente na página por `window.initWippyApp()`; assume a página inteira e seu histórico. É o entry servido por padrão pelo `wippy/facade` atual. |
| `managed-layout.js` | Aplicação completa no modo **managed**: layout declarativo de vários painéis. Servido pela facade quando `fe_mode = managed`. Acesso antecipado; consulte [Layout de vários painéis](./multi-panel-layout.md). |
| `iframe.html` | Aplicação completa executada **dentro de um iframe** para isolamento ou embed parcial. Use em embeds manuais sem facade, fornecendo configuração por um handshake PostMessage `SetConfig`. A própria facade carrega os entries de módulo JS acima, não este. |
| `chat-iframe.html` | Interface mínima de chat sem sidebar nem páginas. Útil para incorporar um widget de chat focado. |
| `chat.js` | Módulo ESM headless que expõe stores de chat e cliente WebSocket. Use para criar interfaces totalmente personalizadas. |
| `ws.js` | Serviço WebSocket independente, sem dependência de Vue ou Pinia. Use em integrações de tempo real de baixo nível. |

Em implantações padrão baseadas em `wippy/facade`, você nunca referencia esses caminhos diretamente. A facade lê `fe_facade_url` de sua configuração, seleciona o entry de módulo JS correspondente a `fe_mode` (`module.js` para compat, `managed-layout.js` para managed) e constrói a URL correta automaticamente.

## Versionamento da CDN

O Web Host é versionado por tag Git. O padrão canônico da URL de produção é:

```
https://web-host.wippy.ai/<release-tag>/
```

`<release-tag>` é a tag de release Git do Web Host: uma release estável ou um deploy de preview de feature branch. A CDN de staging fica em `https://web-host.staging.wippy.ai/<release-tag>/`.

Normalmente, o módulo `wippy/facade` escolhe a versão pelo valor padrão de `fe_facade_url`, que aponta para um build correspondente do Web Host. Atualizar `wippy/facade` move a implantação para a versão correspondente do Web Host. Aplicações filhas que compartilham bibliotecas de vendor pelo import map recebem as versões fornecidas por esse build.

Para fixar uma versão específica do Web Host — permanecer em um build conhecido ou adotar uma tag de feature branch/acesso antecipado — substitua o parâmetro `fe_facade_url`:

```yaml
- name: fe_facade_url
  value: https://web-host.wippy.ai/<release-tag>
```

Isso fixa toda a implantação nesse build. Consulte [Substituições da CLI](../../guides/cli.md) para a sintaxe `-o`/`--override` que define o valor em runtime.

## Stack tecnológica

O Web Host usa Vue 3 (Composition API), PrimeVue + Tailwind CSS 3 para componentes de interface, Pinia para estado, Vue Router para navegação e Axios para HTTP.

### Externalização de dependências dos children

Durante o desenvolvimento, busque `<fe_facade_url>/import-map.json` e coloque todas as chaves de seu objeto `imports` nos externals do Rollup, mesmo que o artefato atual não importe alguma delas. Inclua no bundle uma dependência importada somente quando seu specifier exato estiver ausente. Busque novamente quando a tag do Web Host mudar ou uma nova dependência for adicionada.

## Consulte também

- [Entry point da facade](./entry-point.md) — como a facade entrega o Web Host aos usuários e como funciona o fluxo de configuração
- [Sequência de bootstrap](./bootstrap.md) — o que acontece dentro do Web Host após receber a configuração
- [Layout de vários painéis](./multi-panel-layout.md) — modo de layout gerenciado para shells personalizados
- [Pacotes](./packages.md) — pacotes npm `@wippy-fe/*` disponíveis aos desenvolvedores de aplicações filhas
- [Módulo facade](../../framework/facade.md) — configuração backend de `wippy/facade`
- [Engines de renderização](./render-engines.md) — os dois engines de página (iframe srcdoc e Web Fragment)
