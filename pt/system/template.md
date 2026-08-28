---
title: "Motor de Templates"
description: "Configure conjuntos, fontes, nomes, herança e opções compartilhadas do motor Jet."
---

# Motor de Templates
<secondary-label ref="external"/>

As entradas de template configuram conjuntos e fontes de templates do [CloudyKit Jet](https://github.com/CloudyKit/jet).

Esta página é uma referência de configuração. Os blocos YAML são fragmentos para uma lista de entradas existente; combine cada template com o `template.set` referenciado no mesmo projeto ou grafo de módulos instalados.

## Tipos de Entradas

| Tipo | Descrição |
|------|-----------|
| `template.set` | Conjunto de templates com configuração compartilhada |
| `template.jet` | Template individual |

## Conjuntos de Templates

Um conjunto é um namespace contendo templates relacionados. Templates dentro de um conjunto compartilham configuração e podem referenciar uns aos outros pelo nome.

```yaml
- name: views
  kind: template.set
```

Toda a configuração de um conjunto de templates é opcional:

| Campo | Tipo | Padrão | Descrição |
|-------|------|--------|-----------|
| `engine.development_mode` | bool | false | Desabilita cache de templates |
| `engine.delimiters.left` | string | `{{` | Delimitador de abertura de variável |
| `engine.delimiters.right` | string | `}}` | Delimitador de fechamento de variável |
| `engine.delimiters.comment_left` | string | `{*` | Delimitador de abertura de comentário validado; não é aplicado pelo loader atual |
| `engine.delimiters.comment_right` | string | `*}` | Delimitador de fechamento de comentário validado; não é aplicado pelo loader atual |
| `engine.extensions` | string[] | `[.jet, .html.jet, .jet.html]` | Lista de extensões validada; não é usada para descoberta pelo loader atual |
| `engine.globals` | map | - | Variáveis disponíveis para todos os templates |

Em runtime, `development_mode`, os delimitadores esquerdo e direito de expressões e `globals` configuram o conjunto Jet. Os campos de delimitadores de comentários e extensões são aceitos e validados nesta versão, mas não são aplicados pelo loader Jet em memória. Alterá-los não muda o parsing nem faz o loader descobrir templates.

## Templates

Templates pertencem a um conjunto e são identificados pelo nome para resolução interna.

```yaml
- name: layout
  kind: template.jet
  set: app.views:views
  source: |
    <html>
    <body>{{ yield content() }}</body>
    </html>

- name: home
  kind: template.jet
  set: app.views:views
  source: |
    {{ extends "layout" }}
    {{ block content() }}
      <h1>Welcome, {{ name }}</h1>
    {{ end }}
```

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| `set` | referência | Sim | Conjunto de templates pai |
| `source` | string | Sim | Conteúdo inline do template ou uma referência `file://` relativa ao manifest |

Uma referência `file://` relativa é carregada a partir do manifest que contém a entrada e não pode escapar do sistema de arquivos desse manifest. Placeholders de ambiente dentro da fonte resultante são preservados como texto do template, em vez de serem resolvidos pelo sistema de ambiente.

## Resolução de Templates

Templates referenciam uns aos outros pelo nome, e não pelo ID do registro. Os nomes são resolvidos dentro do conjunto:

1. Por padrão, o nome da entrada do registro (`entry.ID.Name`) se torna o nome do template
2. Sobrescreva com `meta.name` para nomenclatura personalizada:

```yaml
- name: email-welcome-v2
  kind: template.jet
  set: app.emails:templates
  meta:
    name: welcome
  source: |
    {{ include "header" }}
    Hello {{ user }}!
```

Este template é registrado como `welcome` no conjunto, então outros templates usam `{{ include "welcome" }}` ou `{{ extends "welcome" }}`.

## Herança

Templates podem estender templates pai e sobrescrever blocos:

```yaml
# Parent defines yield points
- name: base
  kind: template.jet
  set: app.views:views
  source: |
    <html>
    <head><title>{{ yield title() }}</title></head>
    <body>{{ yield body() }}</body>
    </html>

# Child extends and fills blocks
- name: page
  kind: template.jet
  set: app.views:views
  source: |
    {{ extends "base" }}
    {{ block title() }}My Page{{ end }}
    {{ block body() }}<p>Content here</p>{{ end }}
```

## API Lua

Consulte o [módulo Template](lua/text/template.md) para as operações de renderização.

## Consulte também

- [Módulo Template](lua/text/template.md) — Referência da API Lua
- [Filesystem](system/filesystem.md) — Carregamento de templates do disco
- [Endpoint HTTP](http/endpoint.md) — Renderização de templates a partir de handlers de requisição
