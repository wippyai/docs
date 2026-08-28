---
title: "Roteamento dinâmico"
description: "Como o Web Host registra mount routes do backend, sincroniza a navegação dos children e classifica links em runtime."
---

# Roteamento dinâmico

O Web Host combina rotas de sistema definidas estaticamente com mount routes de página buscadas no backend durante a inicialização. Assim, um novo entry `view.page` com um claim `mountRoute` passa a valer sem alterar o bundle do Web Host.

![Sincronização de mount route](../diagrams/mountroute-sync.svg)

## Sincronização de mount routes na inicialização

Quando a aplicação Web Host é inicializada, antes de renderizar qualquer navegação, ela chama:

```
GET /api/public/pages/routes
```

A resposta é um envelope `{ success, count, routes }`, em que `routes` é um mapa de padrão de mount route → id da página. Ele inclui páginas ocultas/não anunciadas que ainda reivindicam uma URL. Para cada entry, o host registra uma rota Vue Router que mapeia o caminho declarado ao componente carregador de página, adicionando-a como child da rota pai `'app'`.

```typescript
// Simplified from the Web Host bootstrap
const { data } = await api.get('/api/public/pages/routes')
for (const [mountRoute, pageId] of Object.entries(data.routes)) {
  router.addRoute('app', {
    path: mountRoute,
    component: MountRoutePage,
    props: () => ({ pageId }),
  })
}
```

Depois disso, navegar para `/home/anything` faz o router renderizar a página `main` pelo engine selecionado, e navegar para `/demo/anything` faz o mesmo para `iframe-demo`, sem conhecimento hard-coded desses caminhos no bundle do host.

## Reivindicar um caminho com `mountRoute`

Um entry `view.page` reivindica um caminho do router do host definindo `mountRoute` no bloco `meta` de seu `_index.yaml`:

```yaml
- name: main
  kind: registry.entry
  meta:
    type: view.page
    mountRoute: /home/:part(.*)*
```

O schema atual do registry lê o campo criado como `mountRoute`, armazena-o no campo interno `mount_route` e emite `mountRoute` na saída da API. Use a grafia lower camel case acima.

`mountRoute` aceita somente as formas catch-all `/:part(.*)*` (raiz) ou `/<literal-prefix>/:part(.*)*`, em que o prefixo tem um ou mais segmentos literais em letras minúsculas, números e hífens e termina no wildcard obrigatório `:part(.*)*`. Padrões arbitrários do Vue Router — parâmetros nomeados, regex personalizada ou outros nomes de parâmetro, como `/home/:id` e `/users/:userId(\d+)` — são rejeitados. Para entries backend `view.page`, `validate_mount_route_syntax` faz `GET /api/public/pages/routes` retornar HTTP 500, interrompendo a inicialização do Host antes que esses entries cheguem ao router. Após uma resposta e merge de configuração bem-sucedidos, o Host valida separadamente o conjunto resultante de rotas, inclusive sintaxe e conflitos com rotas de sistema. O segmento wildcard `:part(.*)*` permite que a aplicação filha gerencie suas próprias sub-rotas, como `/settings` e `/profile/edit`, enquanto o host controla o prefixo `/home`.

Dois entries não podem reivindicar a mesma rota. Se dois entries `view.page` reivindicarem o **mesmo** `mountRoute`, o validador backend (`validate_mount_routes` em `page_registry.lua`) registra um conflito de rota duplicada na mesma lista de issues dos erros de sintaxe. `GET /api/public/pages/routes` retorna HTTP 500, a inicialização do Host para e o erro é encaminhado pelo error handler do Host. A duplicata **não** é ignorada silenciosamente.

A precedência de resolução do Vue Router ainda se aplica entre um catch-all de raiz (`/:part(.*)*`) e uma rota de sistema mais específica (`chat`, `c`, `web`, `page`, `keeper`, `login`, `logout`) ou um mount com prefixo literal mais longo: a rota mais específica vence. Essa prioridade não é tratamento de rota duplicada.

## Loop de sincronização da URL

Depois que uma página é carregada em seu contexto de runtime, a aplicação filha navega internamente com seu próprio router. O host reflete essas navegações na barra de URL para que o botão voltar, os bookmarks e as URLs copiadas funcionem. A ponte proxy sincroniza os dois routers nos dois engines de página.

![Registry frontend](../diagrams/frontend-registry.svg)

### Child → Host: `CmdRouteChanged`

Quando o router da aplicação filha confirma uma navegação — por exemplo, de `/settings` para `/profile` sob o mount `/home` — ele informa a rota interna pela ponte proxy. O adaptador iframe publica em `window.parent`; o adaptador Fragment encaminha o mesmo protocolo para a janela capturada do host:

```typescript
// In the child application, on internal route change.
// App code must never post these messages directly — use the proxy API:
import { host } from '@wippy-fe/proxy'

host.onRouteChanged('/profile', navId)   // internal route only; the host prepends the mount prefix. navId is an optional number
```

O proxy serializa isso em um envelope wire interno. Esse protocolo não é uma API de aplicação: não o copie nem chame `window.parent.postMessage` diretamente.

O handler de mensagens do host intercepta o evento, chama `router.push(path)` para atualizar a barra de URL por uma mudança de rota SPA, adicionando um entry no histórico do navegador sem recarregar a página inteira, e depois responde:

### Host → Child: `UrlWasUpdatedInParent`

Depois que o host atualiza sua barra de URL, o proxy emite `@history` ao child. `@wippy-fe/router` consome o evento e reconcilia o memory router.

O host devolve a rota **interna** do child — o subcaminho após o prefixo do mount — e não o caminho completo do host. Assim, o percurso é simétrico: o child publica `internalRoute: '/profile'`, o host define sua barra como `/home/profile` e devolve `path: '/profile'`, que o memory router do child aplica literalmente. O child escuta o canal `@history` e trata isso como confirmação de que a URL do host está coerente com seu estado interno.

Esse percurso mantém sincronizados a barra de URL do host, o router do child e o entry do histórico do navegador sem que o host precise conhecer a estrutura interna de roteamento do child.

## `classifyLink`

No engine iframe, `preventLinkClicks: true` instala um hook no documento que intercepta cliques brutos em `<a>` antes do navegador; consulte [view.page](./view-page.md). O adaptador Web Fragment do Web Host 1.0.56 não instala esse hook. Para navegação Vue portável, use `AutoRouterLink` de `@wippy-fe/router`; ele chama a mesma API `classifyLink` em qualquer engine.

O classificador retorna um de quatro resultados:

| `LinkKind` | Condição | Ação |
|---|---|---|
| `host-nav` | Segmento superior do caminho corresponde a um literal `mountRoute` conhecido, uma rota de sistema embutida (`chat`, `c`, `web`, `page`, `keeper`, `login`, `logout`) ou um catch-all de mount na raiz | `preventDefault` + `host.navigate(normalizedPath)` |
| `child-nav` | O router do child resolve o caminho para uma rota real, que não seja catch-all, ou nada mais o reivindicou | O router da subaplicação decide internamente; o host **não** executa `preventDefault` nem recarrega o contexto da página |
| `external` | Origem diferente ou scheme não `http` (`javascript`/`mailto`/`tel`/`sms`/`ftp`/`file`/`data`/`blob`) | Comportamento padrão do navegador, como abrir nova aba |
| `ignore` | `href` vazio ou hash puro (`#…`) | `preventDefault` |

O classificador consulta primeiro o router local da página; assim, um link que o child consegue resolver permanece na aplicação.

`classifyLink` consulta a mesma lista de rotas buscada na inicialização. Se o router do child não reivindicar `/demo/step-2`, o link será classificado como `host-nav` porque `/demo/:part(.*)*` é um mount route registrado; o host navega para a página `iframe-demo` em vez de recarregar tudo.

Portanto, uma aplicação filha não precisa conhecer outras páginas do sistema. Em um iframe com `preventLinkClicks: true`, um `<a href="/demo/step-2">` comum é interceptado e classificado. Use `AutoRouterLink` quando a mesma navegação precisar funcionar nos dois engines.
