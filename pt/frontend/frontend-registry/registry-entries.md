---
title: "Entradas do Registry"
description: "Uma entrada de registry é como o backend do Wippy declara um artefato de frontend — seja um app micro frontend ou um web component reutilizável — para que o Web Host possa…"
---

# Entradas do Registry

Uma entrada de registry é como o backend do Wippy declara um artefato de frontend — seja um app micro frontend ou um web component reutilizável — para que o Web Host possa descobri-lo e servi-lo. Este documento explica o contrato entre o `_index.yaml` de um módulo, o bloco `wippy` do seu `package.json` e o arquivo `wippy-meta.json` que os conecta.

Para a configuração do módulo `wippy/views` que processa essas entradas em tempo de execução, veja [Views](../../framework/views.md).

## O Que É uma Entrada de Registry

Todo artefato de frontend é declarado como um `registry.entry` no `_index.yaml` do módulo. O marcador `kind: registry.entry` informa ao registry do Wippy que essa entrada carrega metadados consumidos por outros módulos, em vez de definir um componente Lua diretamente.

> **Armadilha comum:** `view.page` e `view.component` **não** são valores de `kind`. Escreva sempre `kind: registry.entry` e coloque o tipo do artefato de frontend em `meta.type`. `kind: view.page` e `kind: view.component` são formatos inválidos.

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

O bloco `meta` é o que o `wippy/views` lê. O campo `meta.type` discrimina entre os dois tipos de artefato suportados.

## O Discriminador `meta.type`

| Valor | Significado |
|---|---|
| `view.page` | Um app micro frontend (SPA completo), renderizado em um iframe dentro do Web Host |
| `view.component` | Um Web Component (elemento customizado) que pode ser incorporado em qualquer lugar de uma página |

Todos os demais campos em `meta` são interpretados no contexto desse tipo. Campos que se aplicam a um tipo e não ao outro estão descritos nas páginas de referência por tipo ([view.page](./view-page.md), [view.component](./view-component.md)).

## O Marcador `specification`

Todo pacote de frontend que participa do registry declara `"specification": "wippy-component-1.0"` no nível superior do seu `package.json`. Essa string é o handshake que informa ao Wippy (e às ferramentas) que este pacote segue o contrato wippy-component — ele tem um bloco `wippy` com um formato conhecido e foi compilado com `@wippy-fe/vite-plugin`.

```json
{
  "name": "@wippy/app-main",
  "version": "1.0.0",
  "specification": "wippy-component-1.0",
  "wippy": { ... }
}
```

A presença de `specification` não altera o comportamento em tempo de execução, mas o `wippy/views` a utiliza ao validar entradas carregadas do registry.

## O Contrato `wippy-meta.json`

O `@wippy-fe/vite-plugin` emite um arquivo `wippy-meta.json` junto ao bundle compilado. Esse arquivo é a fonte canônica de verdade para os metadados de runtime do artefato: seu schema de props, schema de eventos, título, ícone e configurações de injeção de proxy.

Resposta curta para agentes e ferramentas:

- **Quem o emite:** `wippyPagePlugin()` para apps `view.page` e `wippyComponentPlugin()` para web components `view.component`.
- **Quem o escreve:** ninguém escreve `wippy-meta.json` à mão; o plugin do vite o gera a partir do `package.json`.
- **Quem o consome:** o `wippy/views` o lê da raiz do bundle servido ao construir descritores de página/componente e respostas de API.
- **O que o YAML faz:** o `_index.yaml` continua autoritativo para a política de deployment e para qualquer campo que sobrescreva explicitamente.

Quando o `wippy/views` carrega um `registry.entry`, ele lê o `wippy-meta.json` a partir da raiz do bundle servido do artefato. Para páginas, essa raiz é o `url + base_path` da página; para web components, as entradas atuais servem o componente diretamente a partir de `url`. O YAML sempre vence: o `_index.yaml` tem precedência para cada campo que declara. O `wippy-meta.json` fornece os padrões que o `wippy/views` lê quando não há sobrescrita em YAML para um determinado campo. Campos de política de deployment — `announced`, `secure`, `url`, `mountRoute` e `base_path` — devem ser definidos no `_index.yaml`, porque expressam decisões do operador em vez da autoria do componente; não existe superfície de autoria em `package.json`/`wippy-meta.json` para eles. (`base_path` é respeitado tanto para páginas quanto para componentes; as entradas de componente do app-template atuais simplesmente o omitem.)

Em contrapartida, `entry_point` é autorado pelo FE *e* sobrescrevível por YAML. Ele é gravado no `wippy-meta.json` a partir do bloco `wippy` do pacote — `wippy.path` para páginas (que o `@wippy-fe/vite-plugin` **exige**; omiti-lo faz o plugin lançar `wippy.path is required for a page package`) ou `wippy.tagName`/`browser` para componentes. O campo `meta.entry_point` no `_index.yaml` é uma sobrescrita opcional por deployment sobre esse padrão autorado; não é um campo exclusivo de YAML.

Essa divisão significa que o autor de um componente escreve os metadados de exibição uma única vez no bloco `wippy` do `package.json`, e o plugin do vite os grava no `wippy-meta.json` em tempo de build como padrões do autor. O operador que faz o deploy do componente define roteamento e política de acesso em YAML, e também pode sobrescrever ali qualquer campo de nível de exibição.

## Campos Comuns

Estes campos aparecem no bloco `meta` tanto para entradas `view.page` quanto `view.component`.

| Campo | Tipo | Padrão | Descrição |
|---|---|---|---|
| `type` | string | — | `view.page` ou `view.component` (obrigatório) |
| `name` | string | nome da entrada | Identificador usado nas respostas da API |
| `title` | string | — | Nome de exibição legível por humanos |
| `icon` | string | — | Referência Iconify, por exemplo `tabler:layout-dashboard` |
| `announced` | boolean | — | Controla a visibilidade nas APIs de listagem; a semântica difere por tipo (veja abaixo) |
| `secure` | boolean | `false` | Exige autenticação para acesso |
| `url` | string | — | Prefixo de URL base para servir arquivos estáticos (origem de CDN ou caminho de mount local) |
| `entry_point` | string | `index.html` / `index.js` | Nome do arquivo de entrada dentro do diretório estático |

### Semântica de `announced` por Tipo

A flag `announced` tem consequências diferentes dependendo de `meta.type`:

- **`view.page`**: controla se a página aparece na barra lateral de navegação (`GET /api/public/pages/list`). Definir `announced: false` oculta a página da navegação, mas ela ainda carrega se acessada diretamente. Esse é um padrão legítimo para páginas incorporadas ou auxiliares.

- **`view.component`**: controla a inclusão em `GET /api/public/components/list`. Se `announced: false`, o componente é totalmente excluído desse endpoint, o que significa que o Web Host nunca injeta sua tag de script e `customElements.get(tagName)` permanece indefinido. Para componentes que precisam de autoload, `announced: true` é obrigatório — veja [view.component](./view-component.md) para detalhes.

## Como os Campos de Serving se Combinam

Para apps micro frontend, os três campos se compõem para produzir a URL do HTML que o Web Host carrega:

```
<url>/<base_path>/<entry_point>
```

Por exemplo, com `url: /app`, `base_path: app/main`, `entry_point: app.html`, o host busca `/app/app/main/app.html`.

A separação entre `base_path` e `entry_point` é intencional. O Web Host injeta `<url>/<base_path>/` como uma tag HTML `<base>` na página carregada, o que rege como o navegador resolve todas as URLs relativas dentro dessa página. O arquivo de entrada pode estar em um subdiretório da base — o que importa é que a base aponte para a raiz comum a partir da qual todos os recursos podem ser alcançados de forma relativa.

Por exemplo, se um bundle tem este layout:

```
static/
  shared/
    vendor.js
  app/
    index.html    ← entry_point: app/index.html
    app.js
```

e `index.html` referencia `../shared/vendor.js`, então `base_path` deve apontar para `static/` (o diretório que contém tanto `app/` quanto `shared/`), e não para `app/`. Definir `base_path: app` faria `../shared/vendor.js` resolver para fora do diretório servido e retornar 404.

No caso comum em que todos os assets ficam ao lado do arquivo de entrada, `base_path` e o diretório que contém `entry_point` estão no mesmo nível, de modo que a distinção é invisível. Ela só importa quando um bundle compartilha recursos entre diretórios irmãos.

Para web components, o host compõe a URL servida da mesma forma:

```
<url>/<base_path>/<entry_point>
```

As entradas de componente do app-template atuais omitem `base_path`, mas ele é suportado e se compõe da mesma maneira (`<url>/<base_path>/<entry_point>`) — de modo que, nessas entradas, a URL se reduz a `<url>/<entry_point>`. A diferença em relação às páginas é que um componente é injetado como um `<script type="module">` em vez de receber sua própria tag HTML `<base>` injetada.
