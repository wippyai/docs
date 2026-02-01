# Motor de Templates

Renderizacao de templates usando [CloudyKit Jet](https://github.com/CloudyKit/jet).

## Tipos de Entradas

| Tipo | Descricao |
|------|-----------|
| `template.set` | Conjunto de templates com configuracao compartilhada |
| `template.jet` | Template individual |

## Conjuntos de Templates

Um conjunto e um namespace contendo templates relacionados. Templates dentro de um conjunto compartilham configuracao e podem referenciar uns aos outros pelo nome.

```yaml
- name: views
  kind: template.set
```

Toda configuracao e opcional com padroes sensiveis:

| Campo | Tipo | Padrao | Descricao |
|-------|------|--------|-----------|
| `engine.development_mode` | bool | false | Desabilita cache de templates |
| `engine.delimiters.left` | string | `{{` | Delimitador de abertura de variavel |
| `engine.delimiters.right` | string | `}}` | Delimitador de fechamento de variavel |
| `engine.globals` | map | - | Variaveis disponiveis para todos os templates |

## Templates

Templates pertencem a um conjunto e sao identificados pelo nome para resolucao interna.

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
      <h1>Bem-vindo, {{ name }}</h1>
    {{ end }}
```

| Campo | Tipo | Obrigatorio | Descricao |
|-------|------|-------------|-----------|
| `set` | referencia | Sim | Conjunto de templates pai |
| `source` | string | Sim | Conteudo do template |

## Resolucao de Templates

Templates referenciam uns aos outros usando nomes, nao IDs de registro. A resolucao funciona como um sistema de arquivos virtual dentro do conjunto:

1. Por padrao, o nome da entrada do registro (`entry.ID.Name`) se torna o nome do template
2. Sobrescreva com `meta.name` para nomenclatura personalizada:

```yaml
- name: email-welcome-v2
  kind: template.jet
  set: app.emails:templates
  meta:
    name: welcome
  source: |
    {{ include "header" }}
    Ola {{ user }}!
```

Este template e registrado como `welcome` no conjunto, entao outros templates usam `{{ include "welcome" }}` ou `{{ extends "welcome" }}`.

## Heranca

Templates podem estender templates pai e sobrescrever blocos:

```yaml
# Pai define pontos de yield
- name: base
  kind: template.jet
  set: app.views:views
  source: |
    <html>
    <head><title>{{ yield title() }}</title></head>
    <body>{{ yield body() }}</body>
    </html>

# Filho estende e preenche blocos
- name: page
  kind: template.jet
  set: app.views:views
  source: |
    {{ extends "base" }}
    {{ block title() }}Minha Pagina{{ end }}
    {{ block body() }}<p>Conteudo aqui</p>{{ end }}
```

## API Lua

Veja [Modulo Template](lua-template.md) para operacoes de renderizacao.
