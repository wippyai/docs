---
title: "Web Components (view.component)"
description: "Uma entrada view.component descreve um custom element reutilizável (web component) que o Web Host pode descobrir, injetar e registrar automaticamente. Diferente de uma…"
---

# Web Components (view.component)

Uma entrada `view.component` descreve um custom element reutilizável (web component) que o Web Host pode descobrir, injetar e registrar automaticamente. Diferente de uma página, um componente não tem iframe próprio — ele é uma tag HTML customizada que pode aparecer em qualquer lugar onde o template de uma página ou do host o coloque.

Para orientações sobre como escrever a implementação do componente, veja [Web Component](../micro-frontends/web-component.md).

## Campos de Frontend (bloco wippy do package.json)

Esses campos são escritos pelo desenvolvedor de FE no bloco `wippy` do `package.json`. O plugin do vite os embute em `wippy-meta.json` em tempo de build, e o `wippy/views` os lê de lá como padrões.

> **Todos os campos desta seção podem ser sobrescritos pelo operador no `_index.yaml`. O YAML sempre tem precedência.**

| Campo | Tipo | Padrão | Descrição |
|---|---|---|---|
| `type` | string | — | Deve ser `"component"` ou `"widget"`; `"widget"` é a convenção do template |
| `tagName` | string | — | Nome do custom element; deve conter um hífen conforme a especificação HTML |
| `props` | object | — | JSON Schema descrevendo os atributos aceitos pelo componente |
| `events` | object | — | JSON Schema descrevendo os eventos DOM customizados que o componente emite |

### `wippy.type` no `package.json`

Pacotes de web component definem `"type": "widget"` ou `"type": "component"` (não `"page"`) dentro do seu bloco `wippy`. O app-template usa atualmente `"widget"`, e o plugin do vite aceita ambos os nomes de componente para este contrato de runtime.

```json
{
  "specification": "wippy-component-1.0",
  "wippy": {
    "tagName": "example-reaction-bar",
    "type": "widget",
    "props": { ... },
    "events": { ... }
  }
}
```

Em tempo de deploy, o `meta.tag_name` do YAML do operador é autoritativo e sobrescreve o valor empacotado; `wippy.tagName` (embutido em `wippy-meta.json` a partir do `package.json`) é apenas o fallback que o `wippy/views` usa quando a entrada YAML omite `tag_name` (ordem de resolução: `meta.tag_name` do YAML → `wippy.tagName` empacotado). Mantenha os dois em sincronia para evitar surpresas, mas o YAML vence se divergirem.

### Schema de Props

A chave `wippy.props` no `package.json` é um objeto JSON Schema descrevendo os atributos aceitos pelo componente. O plugin do vite o inclui em `wippy-meta.json`, e o Web Host o usa ao expor metadados do componente para consumidores como o renderizador de artefatos do chat e o sanitizador de tags (que precisa saber quais atributos são legítimos para não removê-los).

```json
{
  "wippy": {
    "props": {
      "type": "object",
      "properties": {
        "reactions": {
          "type": "array",
          "items": { "type": "string" },
          "default": ["👍", "👎", "❤️", "🎉", "🤔"],
          "description": "Array of emoji reactions to display"
        },
        "allow-multiple": {
          "type": "boolean",
          "default": false,
          "description": "Whether multiple reactions can be active simultaneously"
        }
      }
    }
  }
}
```

Nomes de atributos em `properties` seguem a convenção de atributos HTML (kebab-case). Os valores `default` do schema também são aplicados em tempo de execução pelo parser de props do web component quando um atributo está ausente.

### Schema de Eventos

A chave `wippy.events` espelha o formato de props, mas descreve os eventos DOM customizados que o componente emite via `useEvents()`. Cada chave é um nome de evento; o valor é um JSON Schema para o payload de detail do evento.

```json
{
  "wippy": {
    "events": {
      "type": "object",
      "properties": {
        "reaction": {
          "type": "object",
          "properties": {
            "emoji": { "type": "string" },
            "count": { "type": "number" },
            "active": { "type": "boolean" }
          },
          "description": "Fired when a reaction is toggled"
        }
      }
    }
  }
}
```

O sanitizador de mensagens de chat do Web Host coloca em allowlist os atributos de componente vindos de `props.properties` no `wippy-meta.json`. Schemas de eventos documentam os eventos customizados emitidos para ferramentas e consumidores; eles não são usados para permitir atributos de listener de evento DOM através do conteúdo de chat sanitizado.

## Configuração do Operador (_index.yaml)

Esses campos são definidos pelo operador no bloco `meta` da entrada de registry `_index.yaml`. A maioria representa política pura de deploy — roteamento, controle de acesso e servir arquivos — que só faz sentido em tempo de deploy e não tem superfície de autoria no `package.json` (`announced`, `secure`, `url`, `auto_register`). Dois campos, `tag_name` e `entry_point`, são diferentes: eles são **escritos pelo FE** no `package.json` (embutidos em `wippy-meta.json`) e as chaves YAML são apenas **sobrescritas opcionais por deploy** desses valores empacotados.

> **`announced`, `secure`, `url` e `auto_register` são política pura de deploy e não podem ser definidos no package.json — eles são definidos pelo operador para cada ambiente. `tag_name` e `entry_point` são padrões escritos pelo FE que o operador pode sobrescrever no YAML.**

| Campo | Tipo | Padrão | Descrição |
|---|---|---|---|
| `tag_name` | string | `wippy.tagName` | Escrito pelo FE como `wippy.tagName` no `package.json` (obrigatório pelo plugin do vite); a chave YAML sobrescreve o valor empacotado. Nome do custom element; deve conter um hífen conforme a especificação HTML |
| `announced` | boolean | `false` | Deve ser `true` para o componente aparecer em `/api/public/components/list`. Recorre a `meta.public` se este estiver definido. |
| `auto_register` | boolean | `false` | `true` → o Web Host carrega e registra o componente automaticamente na inicialização |
| `secure` | boolean | `false` | Exige autenticação |
| `url` | string | — | Caminho de mount estático para o bundle compilado do componente |
| `base_path` | string | `""` | Subcaminho opcional anexado a `url` para formar a raiz do projeto; a URL resolvida do bundle é composta como `<url>/<base_path>/<entry_point>`. Respeitado de forma idêntica às páginas, embora as entradas de componente atuais do app-template o omitam |
| `entry_point` | string | `wippy.browser` → `index.js` | Escrito pelo FE como o campo `browser` de nível superior no `package.json` (embutido em `wippy-meta.json`); a chave YAML sobrescreve o valor empacotado, recorrendo a `index.js`. Arquivo do módulo de entrada; o host o injeta como um `<script type="module">` |

Uma entrada mínima se parece com isto:

```yaml
- name: reaction-bar
  kind: registry.entry
  meta:
    type: view.component
    name: reaction-bar
    tag_name: example-reaction-bar
    announced: true
    secure: false
    auto_register: true
    url: /app/wc/reaction-bar
    entry_point: index.js
```

## Os Três Portões para o Autoload

Para que o Web Host carregue automaticamente um componente, as três condições precisam valer simultaneamente:

1. **`announced: true`** — o `wippy/views` filtra por essa flag no lado do servidor em `list_components.lua`. Não existe parâmetro de query para contorná-la. Um componente com `announced: false` nunca aparece em `/api/public/components/list`, independentemente de qualquer outra configuração.

2. **`auto_register: true`** — a função `loadGlobalAutoloadWidgets` do host consulta o endpoint de listagem com `?auto_register=true`. Componentes sem essa flag são excluídos dessa resposta filtrada.

3. **A tag ainda não está registrada** — antes de injetar o script, o host verifica `customElements.get(tagName)`. Se a tag já estiver definida (por exemplo, de uma navegação anterior), o host pula a injeção para evitar definição dupla.

Se qualquer portão faltar, o componente fica silenciosamente ausente. Para verificar: `curl /api/public/components/list?auto_register=true` — sua tag precisa aparecer na resposta.

## A Sequência de Autoload

Quando uma página dentro do Web Host termina de montar, o host executa a seguinte sequência:

1. `GET /api/public/components/list?auto_register=true` — busca todos os componentes anunciados que se auto-registram.

2. Para cada componente cujo `customElements.get(tagName)` é `undefined`, o host adiciona a `document.head`:

   ```html
   <script type="module" src="/app/wc/reaction-bar/index.js?declare-tag=example-reaction-bar"></script>
   ```

   O parâmetro de query `?declare-tag=` é o canal que diz ao chunk de entrada sob qual nome de custom element se registrar.

3. O chunk de entrada chama `define(import.meta.url, ElementClass)`. Autores de componentes importam `define` de `@wippy-fe/webcomponent-vue` (ou `@wippy-fe/webcomponent-core`), que reexportam o `define` do proxy; em tempo de execução o import map o resolve para a única instância de `@wippy-fe/proxy`. O helper `define` lê `new URL(import.meta.url).searchParams.get('declare-tag')` e chama `customElements.define(tagName, ElementClass)`.

4. O Vue (ou qualquer framework) renderiza um elemento `<example-reaction-bar>`. O navegador faz o upgrade do elemento, `connectedCallback` dispara, e `WippyVueElement` monta seu app Vue dentro de um shadow root.

## Por Que `auto_register: false` É Útil

Definir `auto_register: false` exclui o componente da varredura global de autoload. Isso é apropriado quando:

- O componente é grande e deve carregar apenas nas páginas que explicitamente precisam dele.
- O componente é registrado programaticamente via `loadByTagName('example-heavy-chart')` (importado de `@wippy-fe/proxy`) no ponto de chamada.
- O componente é um bloco de construção interno usado apenas dentro de outro bundle, não como um custom element autônomo.

```ts
import { loadByTagName } from '@wippy-fe/proxy'

await loadByTagName('example-heavy-chart')
```

O registro tardio mantém o carregamento inicial da página leve. O componente ainda precisa de `announced: true` para que `loadByTagName()` o resolva através da API — o endpoint `GET /components/by-tag/{tag}` retorna `404 "Component is not announced"` quando a flag é `false`.
