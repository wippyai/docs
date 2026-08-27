---
title: "Entrys do registry"
description: "Como o YAML do registry, os metadados do pacote e wippy-meta.json declaram páginas frontend e web components ao Web Host."
---

# Entrys do registry

Um entry de registry declara um artefato frontend ao backend Wippy para que o Web Host possa descobri-lo e servi-lo. O artefato pode ser uma aplicação micro frontend ou um web component reutilizável. Sua declaração abrange o `_index.yaml` do módulo, o bloco `wippy` de `package.json` e o arquivo gerado `wippy-meta.json`.

Para a configuração do módulo `wippy/views` que processa esses entries em runtime, consulte [Views](../../framework/views.md).

## O que é um entry de registry

Todo artefato frontend é declarado como `registry.entry` no `_index.yaml` do módulo. O marcador `kind: registry.entry` informa ao registry Wippy que o entry contém metadados consumidos por outros módulos, em vez de definir diretamente um componente Lua.

> **Armadilha comum:** `view.page` e `view.component` **não** são valores de `kind`. Sempre escreva `kind: registry.entry` e coloque o tipo de artefato frontend em `meta.type`. `kind: view.page` e `kind: view.component` têm formato inválido.

Formato mínimo correto:

```yaml
- name: main
  kind: registry.entry
  meta:
    type: view.page
```

```yaml
version: "1.0"
namespace: app.views

entries:
  - name: main
    kind: registry.entry
    meta:
      type: view.page
      name: main
      title: Admin Panel
      icon: tabler:layout-dashboard
      order: 0
      announced: true
      secure: false
      url: /app
      base_path: app/main
      entry_point: app.html
      mountRoute: /home/:part(.*)*
```

O bloco `meta` é lido por `wippy/views`. O campo `meta.type` distingue os dois kinds de artefato compatíveis.

## Discriminador `meta.type`

| Valor | Significado |
|---|---|
| `view.page` | Aplicação micro frontend (SPA completa), renderizada pelo engine iframe ou Web Fragment selecionado para a página |
| `view.component` | Web Component (custom element) que pode ser incorporado em qualquer página |

Todos os outros campos de `meta` são interpretados no contexto desse tipo. Os campos exclusivos de um tipo são descritos nas referências específicas [view.page](./view-page.md) e [view.component](./view-component.md).

## Marcador `specification`

Pacotes frontend devem declarar `"specification": "wippy-component-1.0"` no nível superior de `package.json`. O marcador identifica os metadados do pacote e o formato da resposta da API. `@wippy-fe/vite-plugin` valida o valor quando ele está presente.

```json
{
  "name": "@wippy/example-widget",
  "version": "1.0.0",
  "specification": "wippy-component-1.0",
  "browser": "dist/index.js",
  "wippy": {
    "type": "component",
    "tagName": "example-widget"
  }
}
```

O marcador não altera o comportamento de renderização. `wippy/views` carrega o valor incluído nos descriptors de página e componente ou fornece `wippy-component-1.0` para bundles legados que o omitem; a validação do YAML do registry não depende desse campo.

## Contrato de `wippy-meta.json`

`@wippy-fe/vite-plugin` emite um arquivo `wippy-meta.json` junto do bundle. Ele é a fonte canônica dos metadados de runtime definidos pelo artefato: schema de props, schema de eventos, título, ícone e configurações de injeção proxy.

Responsabilidades dos metadados:

- **Emitido por:** `wippyPagePlugin()` para aplicações `view.page` e `wippyComponentPlugin()` para web components `view.component`.
- **Gerado de:** `package.json`; não escreva `wippy-meta.json` manualmente.
- **Consumido por:** `wippy/views`, que o lê na raiz do bundle servido ao construir descriptors de página/componente e respostas da API.
- **Substituído por:** `_index.yaml`, que continua autoritativo para a política de implantação e todos os campos que declara explicitamente.

Quando `wippy/views` carrega um `registry.entry`, ele lê `wippy-meta.json` da raiz do bundle servido (`url + base_path`) para páginas e componentes. O YAML sempre vence: `_index.yaml` tem precedência em todos os campos que declara. `wippy-meta.json` fornece os padrões que `wippy/views` lê quando não existe substituição YAML para um campo. Campos de política de implantação — `announced`, `secure`, `url`, `mountRoute` e `base_path` — devem ser definidos em `_index.yaml`, porque expressam decisões do operador, e não da autoria do componente; não há superfície de autoria para eles em `package.json`/`wippy-meta.json`. `base_path` vale para páginas e componentes; os entries atuais de componente do app-template apenas o omitem.

Por outro lado, `entry_point` é definido pelo frontend **e** substituível por YAML. Para páginas, vem de `wippy.path`, exigido por `@wippy-fe/vite-plugin`; omiti-lo faz o plugin lançar `wippy.path is required for a page package`. Para componentes, vem do campo superior `browser`; `wippy.tagName` declara separadamente o nome do custom element. `meta.entry_point` em `_index.yaml` é uma substituição opcional por implantação sobre o padrão definido pelo autor, não um campo exclusivo do YAML.

O autor de um componente escreve uma vez os metadados de apresentação no bloco `wippy` de `package.json`, e o plugin Vite os registra em `wippy-meta.json` como padrões do autor. O operador define roteamento e política de acesso em YAML e também pode substituir ali os campos de apresentação.

## Campos comuns

Estes campos aparecem no bloco `meta` de entries `view.page` e `view.component`.

| Campo | Tipo | Padrão | Descrição |
|---|---|---|---|
| `type` | string | — | `view.page` ou `view.component` (obrigatório) |
| `name` | string | nome do entry | Identificador usado nas respostas da API |
| `title` | string | — | Nome de apresentação legível |
| `icon` | string | — | Referência Iconify, por exemplo `tabler:layout-dashboard` |
| `announced` | boolean | — | Controla a visibilidade nas APIs de listagem; a semântica varia por tipo |
| `secure` | boolean | `false` | Exige autenticação para acesso |
| `url` | string | — | Prefixo de URL base para servir arquivos estáticos (origem CDN ou caminho de mount local) |
| `entry_point` | string | `index.html` / `index.js` | Nome do arquivo de entrada dentro do diretório estático |

### Semântica de `announced` por tipo

- **`view.page`**: controla se a página aparece na sidebar de navegação (`GET /api/public/pages/list`). `announced: false` oculta a página da navegação, mas ela ainda carrega por acesso direto. É um padrão legítimo para páginas incorporadas ou auxiliares.
- **`view.component`**: controla sua inclusão em `GET /api/public/components/list`. Com `announced: false`, o componente é excluído desse endpoint, o Web Host nunca injeta sua script tag e `customElements.get(tagName)` permanece undefined. Para componentes que precisam de autoload, `announced: true` é obrigatório; consulte [view.component](./view-component.md).

## Como os campos de serving se combinam

Para aplicações micro frontend, os três campos formam a URL HTML carregada pelo Web Host:

```
<url>/<base_path>/<entry_point>
```

Por exemplo, com `url: /app`, `base_path: app/main` e `entry_point: app.html`, o host busca `/app/app/main/app.html`.

A separação de `base_path` e `entry_point` é intencional. O Web Host injeta `<url>/<base_path>/` como tag HTML `<base>` na página carregada, controlando como o navegador resolve todas as URLs relativas. O arquivo de entrada pode estar em um subdiretório da base; o importante é a base apontar para a raiz comum de onde todos os recursos são alcançáveis relativamente.

Por exemplo, se um bundle tiver esta estrutura:

```
static/
  shared/
    vendor.js
  app/
    index.html    ← entry_point: app/index.html
    app.js
```

e `index.html` referenciar `../shared/vendor.js`, `base_path` deve apontar para `static/`, que contém `app/` e `shared/`, não para `app/`. Usar `base_path: app` faria `../shared/vendor.js` resolver fora do diretório servido e retornar 404.

No caso comum em que todos os assets ficam ao lado do arquivo de entrada, `base_path` e o diretório que contém `entry_point` estão no mesmo nível e a distinção não aparece. Ela só importa quando o bundle compartilha recursos entre diretórios irmãos.

Para web components, o host compõe a URL servida da mesma forma:

```
<url>/<base_path>/<entry_point>
```

Os entries atuais de componente do app-template omitem `base_path`, mas ele é compatível e se combina da mesma forma (`<url>/<base_path>/<entry_point>`); nesses entries, a URL se reduz a `<url>/<entry_point>`. A diferença em relação às páginas é que um componente é injetado como `<script type="module">`, em vez de receber sua própria tag HTML `<base>`.
