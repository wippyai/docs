# Motor de Templates

Renderização de templates usando [CloudyKit Jet](https://github.com/CloudyKit/jet).

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

Toda configuração é opcional com padrões sensíveis:

| Campo | Tipo | Padrão | Descrição |
|-------|------|--------|-----------|
| `engine.development_mode` | bool | false | Desabilita cache de templates |
| `engine.delimiters.left` | string | `{{` | Delimitador de abertura de variável |
| `engine.delimiters.right` | string | `}}` | Delimitador de fechamento de variável |
| `engine.globals` | map | - | Variáveis disponíveis para todos os templates |

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
      <h1>Bem-vindo, {{ name }}</h1>
    {{ end }}
```

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| `set` | referência | Sim | Conjunto de templates pai |
| `source` | string | Sim | Conteúdo do template |

## Resolução de Templates

Templates referenciam uns aos outros usando nomes, não IDs de registro. A resolução funciona como um sistema de arquivos virtual dentro do conjunto:

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
    Olá {{ user }}!
```

Este template é registrado como `welcome` no conjunto, então outros templates usam `{{ include "welcome" }}` ou `{{ extends "welcome" }}`.

## Herança

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
    {{ block title() }}Minha Página{{ end }}
    {{ block body() }}<p>Conteúdo aqui</p>{{ end }}
```

## API Lua

Veja [Módulo Template](lua-template.md) para operações de renderização.
