---
title: "Roteamento Dinâmico"
description: "O router do Web Host não é configurado estaticamente. Na inicialização ele busca no backend o conjunto atual de rotas de mount de páginas e as adiciona ao…"
---

# Roteamento Dinâmico

O router do Web Host não é configurado estaticamente. Na inicialização ele busca no backend o conjunto atual de rotas de mount de páginas e as adiciona à instância do Vue Router. Isso significa que uma nova entrada `view.page` com uma reivindicação de `mountRoute` entra em vigor sem nenhuma mudança no próprio bundle do Web Host.

![Sincronização de mount route](../diagrams/mountroute-sync.svg)

## Sincronização de Mount Routes na Inicialização

Quando a aplicação do Web Host é inicializada, antes de renderizar qualquer navegação, ela chama:

```
GET /api/public/pages/routes
```

A resposta é um envelope `{ success, count, routes }`, onde `routes` é um mapa de padrão de mount route → id da página (inclui páginas ocultas/não anunciadas que ainda assim reivindicam uma URL). Para cada entrada, o host registra uma rota do Vue Router que mapeia o caminho declarado para o componente carregador de página, adicionando-a como filha da rota pai `'app'`.

```typescript
// Simplificado a partir do bootstrap do Web Host
const { routes } = await api.get('/api/public/pages/routes')
for (const [mountRoute, pageId] of Object.entries(routes)) {
  router.addRoute('app', {
    path: mountRoute,
    component: MountRoutePage,
    props: () => ({ pageId }),
  })
}
```

A partir desse ponto, navegar para `/home/anything` faz o router renderizar o iframe da página `main`, e navegar para `/demo/anything` faz o router renderizar o iframe da página `iframe-demo` — sem nenhum conhecimento hard-coded desses caminhos no bundle do host.

## Reivindicando um Caminho com `mountRoute`

Uma entrada `view.page` reivindica um caminho do router do host definindo `mountRoute` no bloco `meta` do seu `_index.yaml`:

```yaml
- name: main
  kind: registry.entry
  meta:
    type: view.page
    mountRoute: /home/:part(.*)*
    ...
```

`mountRoute` é a grafia atual de compatibilidade para um bug de casing no
backend. A chave pretendida no backend é `mount_route`; continue escrevendo
`mountRoute` até que a correção do backend seja publicada.

`mountRoute` aceita apenas as formas catch-all `/:part(.*)*` (raiz) ou `/<prefixo-literal>/:part(.*)*`, onde o prefixo é um ou mais segmentos literais em minúsculas alfanuméricas mais hífen, terminando no wildcard obrigatório `:part(.*)*`. Padrões arbitrários do Vue Router — params nomeados, regex customizada ou nomes de param diferentes (por exemplo `/home/:id`, `/users/:userId(\d+)`) — são rejeitados: o host levanta um conflito de mount route do tipo `syntax`, o `validate_mount_route_syntax` do backend falha, e `GET /api/public/pages/routes` retorna HTTP 500 (renderizado como um erro fatal em tela cheia). O segmento wildcard `:part(.*)*` permite que a aplicação filha gerencie suas próprias sub-rotas (por exemplo `/home/settings`, `/home/profile/edit`) enquanto o host é dono do prefixo `/home`.

Duas entradas não podem reivindicar a mesma rota. Se duas entradas `view.page` reivindicam o **mesmo** `mountRoute`, o validador do backend (`validate_mount_routes` em `page_registry.lua`) registra um conflito de rota duplicada na mesma lista de issues dos erros de sintaxe, então `GET /api/public/pages/routes` retorna HTTP 500 e o Web Host renderiza um `<wippy-error>` fatal em tela cheia — exatamente como em um `mountRoute` malformado. Isso **não** é ignorado silenciosamente.

O único comportamento de "primeiro vence" é a prioridade em tempo de execução do Vue Router entre um catch-all de raiz (`/:part(.*)*`) e uma rota de sistema mais específica (`chat`, `c`, `web`, `page`, `keeper`, `login`, `logout`) ou um mount com prefixo literal mais longo — a rota mais específica casa primeiro. Isso é precedência de resolução de rota, não tratamento de rota duplicada.

## O Loop de Sincronização de URL

Uma vez que a página é carregada em seu iframe, a aplicação filha navega internamente usando seu próprio router. Essas navegações internas precisam ser refletidas na barra de URL do host para que o botão voltar do navegador, os favoritos e o copiar-URL funcionem corretamente. Isso é feito através de um par de PostMessage.

![Frontend Registry](../diagrams/frontend-registry.svg)

### Filho → Host: `CmdRouteChanged`

Quando o router da aplicação filha confirma uma navegação (por exemplo, o usuário vai de `/home/settings` para `/home/profile`), o filho posta uma mensagem para sua janela pai:

```typescript
// Na aplicação filha, na mudança de rota interna.
// O código da aplicação nunca deve postar essas mensagens diretamente — use a API do proxy:
import { host } from '@wippy-fe/proxy'

host.onRouteChanged('/profile', navId)   // apenas rota interna; o host prefixa o mount. navId é um número opcional
```

O proxy serializa isso em um envelope de wire interno. Esse protocolo não é uma API de aplicação: não o copie nem chame `window.parent.postMessage` diretamente.

O handler de mensagens do host intercepta isso, chama `router.push(path)` para atualizar a barra de URL via uma mudança de rota SPA (adicionando uma entrada no histórico do navegador) sem disparar um recarregamento completo da página, e então responde:

### Host → Filho: `UrlWasUpdatedInParent`

Depois que o host atualiza sua barra de URL, o proxy emite `@history` para o filho. O `@wippy-fe/router` consome esse evento e reconcilia o router em memória.

O host envia de volta a rota **interna** do filho (o sub-caminho após o prefixo de mount), não o caminho completo do host — de modo que o round-trip é simétrico: o filho posta `internalRoute: '/profile'`, o host define sua barra de URL como `/home/profile` e ecoa `path: '/profile'` de volta, que o router em memória do filho empurra literalmente. O filho escuta pelo canal de eventos `@history` e trata isso como confirmação de que a URL do host agora está consistente com seu estado interno.

O round-trip mantém a barra de URL do host, o router do filho e a entrada de histórico do navegador em sincronia sem que o host precise saber nada sobre a estrutura de roteamento interna do filho.

## `classifyLink`

Quando uma página tem `preventLinkClicks: true` em suas injeções de proxy (veja [view.page](./view-page.md)), o host intercepta cliques em `<a>` dentro do iframe antes que o navegador os trate. Cada link interceptado é passado para `classifyLink`, que decide como tratá-lo:

| `LinkKind` | Condição | Ação |
|---|---|---|
| `host-nav` | O segmento de caminho de topo casa com um literal de `mountRoute` conhecido, uma rota de sistema embutida (`chat`, `c`, `web`, `page`, `keeper`, `login`, `logout`), ou um catch-all montado na raiz | `preventDefault` + `host.navigate(normalizedPath)` |
| `child-nav` | O próprio router do iframe resolve o caminho para uma rota real (não catch-all), ou nada mais o reivindicou | O `RouterLink` do subapp decide dentro da aplicação; o host NÃO faz `preventDefault` e NÃO recarrega o iframe |
| `external` | Origem diferente, ou um esquema não-`http` (`javascript`/`mailto`/`tel`/`sms`/`ftp`/`file`/`data`/`blob`) | Comportamento padrão do navegador (por exemplo, abre em uma nova aba) |
| `ignore` | `href` vazio ou um hash puro (`#…`) | `preventDefault` |

O classificador verifica primeiro o router local do próprio iframe, então um link que o filho consegue resolver sozinho permanece dentro da aplicação.

`classifyLink` consulta a mesma lista de rotas buscada na inicialização. Um link para `/demo/step-2` é classificado como `host-nav` porque `/demo/:part(.*)*` é uma mount route registrada — o host navega para a página `iframe-demo` em vez de fazer um recarregamento completo da página.

Isso significa que uma aplicação filha não precisa saber sobre outras páginas do sistema. Ela pode renderizar links `<a href="/demo/step-2">` comuns e o classificador de links do host trata a navegação corretamente.
