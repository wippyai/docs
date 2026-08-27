---
title: "Arquivos Estáticos"
description: "Sirva SPAs, assets e uploads de usuários a partir de entradas de sistema de arquivos com http.static."
---

# Arquivos Estáticos

Um handler `http.static` é montado diretamente em um servidor e serve SPAs, assets ou uploads de usuários a partir de uma entrada de sistema de arquivos.

**Classificação: referência de handler estático.** Os blocos YAML pressupõem que o servidor HTTP nomeado exista. Nesses exemplos escritos pelo host, caminhos relativos de `fs.directory` são resolvidos a partir do diretório de trabalho do projeto. Entradas pertencentes a módulos resolvem caminhos relativos a partir da raiz de origem do módulo, a menos que sejam configuradas com `base: project`. Os arquivos referenciados devem ser criados separadamente.

## Configuração

```yaml
- name: static
  kind: http.static
  meta:
    server: gateway
  path: /
  fs: app:public
  static_options:
    spa: true
    index: index.html
    cache: "public, max-age=3600"
```

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `meta.server` | ID do Registro | Servidor HTTP pai |
| `path` | string | Caminho de montagem URL (deve começar com `/`) |
| `fs` | ID do Registro | Entrada de sistema de arquivos para servir |
| `static_options.spa` | bool | Modo SPA - serve index para caminhos não correspondidos |
| `static_options.index` | string | Arquivo index, obrigatório quando `spa=true` |
| `static_options.cache` | string | Valor do header Cache-Control |
| `middleware` | []string | Cadeia de middleware |
| `options` | map | Opções de middleware (notação de ponto) |

<tip>
Handlers estáticos podem ser montados em qualquer caminho no servidor. Múltiplos handlers podem coexistir - monte assets em <code>/static</code> e uma SPA em <code>/</code>.
</tip>

## Integração com Sistema de Arquivos

Arquivos estáticos são servidos de entradas de sistema de arquivos. Qualquer tipo de sistema de arquivos funciona:

```yaml
entries:
  # Local directory
  - name: public
    kind: fs.directory
    directory: ./public

  # Static handler
  - name: static
    kind: http.static
    meta:
      server: gateway
    path: /static
    fs: public
```

Requisição `/static/css/style.css` serve `./public/css/style.css`.

Para servir um subdiretório, faça a referência `fs` apontar para uma entrada de sistema de arquivos cuja raiz seja esse diretório; por exemplo, um `fs.directory` com `directory:` definido para o subdiretório:

```yaml
entries:
  - name: content
    kind: fs.directory
    directory: ./app/documentation/html

  - name: docs
    kind: http.static
    meta:
      server: gateway
    path: /docs
    fs: content
```

## Modo SPA

Single Page Applications precisam que todas as rotas sirvam o mesmo arquivo index para roteamento client-side:

```yaml
- name: spa
  kind: http.static
  meta:
    server: gateway
  path: /
  fs: app:frontend
  static_options:
    spa: true
    index: index.html
```

| Requisição | Resposta |
|------------|----------|
| `/app.js` | Serve `app.js` (arquivo existe) |
| `/users/123` | Serve `index.html` (fallback SPA) |
| `/api/data` | Serve `index.html` (fallback SPA) |

<note>
Quando <code>spa: true</code>, o arquivo <code>index</code> é obrigatório. Arquivos existentes são servidos diretamente; todos os outros caminhos retornam o arquivo index.
</note>

## Controle de Cache

Defina cache apropriado para diferentes tipos de assets:

```yaml
entries:
  - name: app_fs
    kind: fs.directory
    directory: ./dist

  # Versioned assets - cache forever
  - name: assets
    kind: http.static
    meta:
      server: gateway
    path: /assets
    fs: app_fs
    static_options:
      cache: "public, max-age=31536000, immutable"

  # HTML - short cache, must revalidate
  - name: app
    kind: http.static
    meta:
      server: gateway
    path: /
    fs: app_fs
    static_options:
      spa: true
      index: index.html
      cache: "public, max-age=0, must-revalidate"
```

Padrões comuns de cache:
- **Assets versionados**: `public, max-age=31536000, immutable`
- **HTML/index**: `public, max-age=0, must-revalidate`
- **Uploads de usuário**: `private, max-age=3600`

## Middleware

Aplique middleware para compressão, CORS ou outro processamento:

```yaml
- name: static
  kind: http.static
  meta:
    server: gateway
  path: /
  fs: app:public
  middleware:
    - compress
    - cors
  options:
    compress.level: "best"
    cors.allow.origins: "*"
```

Middleware encapsula o handler estático em ordem - requisições passam por cada middleware antes de alcançar o servidor de arquivos.

<warning>
A correspondência de caminhos é baseada em prefixo. Um handler em <code>/</code> captura todas as requisições não correspondidas. Use roteadores para endpoints de API para evitar conflitos.
</warning>

## Veja Também

- [Servidor](./server.md) - Configuração do servidor HTTP
- [Roteamento](./router.md) - Roteadores e endpoints
- [Sistema de arquivos](../lua/storage/filesystem.md) - Módulo de sistema de arquivos
- [Middleware](./middleware.md) - Middleware disponível
