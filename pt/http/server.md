---
title: "Servidor HTTP"
description: "O servidor HTTP (http.service) escuta em uma porta e hospeda roteadores, endpoints e handlers de arquivos estáticos."
---

# Servidor HTTP

Um `http.service` possui um listener e hospeda roteadores, endpoints e handlers de arquivos estáticos.

**Classificação: referência de configuração do servidor.** Os blocos são fragmentos parciais do registro, a menos que definam todas as entradas de rede, ambiente, sistema de arquivos, roteador, certificado, ator e política referenciadas.

## Configuração

```yaml
- name: gateway
  kind: http.service
  addr: ":8080"
  timeouts:
    read: "5s"
    write: "30s"
    idle: "60s"
  host:
    buffer_size: 1024
    worker_count: 4
  lifecycle:
    auto_start: true
    security:
      actor:
        id: "http-gateway"
      policies:
        - app:http_policy
```

| Campo | Tipo | Padrão | Descrição |
|-------|------|--------|-----------|
| `addr` | string | obrigatório | Endereço de escuta (`:8080`, `0.0.0.0:443`) |
| `timeouts.read` | duration | - | Timeout de leitura de requisição |
| `timeouts.write` | duration | - | Timeout de escrita de resposta |
| `timeouts.idle` | duration | - | Timeout de conexão keep-alive |
| `host.buffer_size` | int | 1024 | Tamanho do buffer do relay de mensagens |
| `host.worker_count` | int | NumCPU | Workers do relay de mensagens |
| `network` | ID do Registro | - | Vincula o listener por uma [rede overlay](../system/network.md), como Tailscale ou I2P |
| `tls` | object | - | Terminação TLS (ver [TLS](#tls)) |

## Timeouts

Configure timeouts para evitar esgotamento de recursos:

```yaml
timeouts:
  read: "10s"    # Max time to read the entire request (headers + body)
  write: "60s"   # Max time to write response
  idle: "120s"   # Keep-alive timeout
```

- `read` - Curto (5-10s) para APIs, maior para uploads
- `write` - Deve corresponder ao tempo esperado de geração de resposta
- `idle` - Balanço entre reutilização de conexão e uso de recursos

<note>
Formato de duração: <code>30s</code>, <code>1m</code>, <code>2h15m</code>. Use <code>0</code> para desabilitar.
</note>

## Configuração de Host

A seção `host` configura o relay interno de mensagens do servidor, usado por componentes como WebSocket relay:

```yaml
host:
  buffer_size: 2048
  worker_count: 8
```

| Campo | Padrão | Descrição |
|-------|--------|-----------|
| `buffer_size` | 1024 | Capacidade da fila de mensagens por worker |
| `worker_count` | NumCPU | Goroutines paralelas de processamento de mensagens |

<tip>
Aumente esses valores para aplicações WebSocket de alto throughput. O relay de mensagens trata a entrega assíncrona entre componentes HTTP e processos.
</tip>

## Segurança

Servidores HTTP podem ter um contexto de segurança padrão aplicado através da configuração de lifecycle:

```yaml
lifecycle:
  auto_start: true
  security:
    actor:
      id: "gateway-service"
    policies:
      - app:http_access_policy
```

Isso define um ator e políticas de base para todas as requisições. Para requisições autenticadas, o [middleware token_auth](./middleware.md) substitui o ator com base no token validado, permitindo políticas de segurança por usuário.

## Lifecycle

Servidores são gerenciados pelo supervisor:

```yaml
lifecycle:
  auto_start: true
  start_timeout: 30s
  stop_timeout: 60s
  requires:
    - app:database
```

| Campo | Descrição |
|-------|-----------|
| `auto_start` | Iniciar quando a aplicação iniciar |
| `start_timeout` | Tempo máximo de espera pelo início do servidor |
| `stop_timeout` | Tempo máximo para shutdown graceful |
| `requires` | Iniciar depois que essas entradas estiverem prontas (`depends_on` é a grafia legada) |

## Conectando Componentes

Roteadores e handlers estáticos referenciam o servidor via metadados:

```yaml
entries:
  - name: gateway
    kind: http.service
    addr: ":8080"

  - name: api
    kind: http.router
    meta:
      server: gateway
    prefix: /api

  - name: static
    kind: http.static
    meta:
      server: gateway
    path: /
    fs: app:public
```

## Múltiplos Servidores

Execute servidores separados para propósitos diferentes:

```yaml
entries:
  # Public API
  - name: public
    kind: http.service
    addr: ":8080"
    lifecycle:
      auto_start: true

  # Admin (localhost only)
  - name: admin
    kind: http.service
    addr: "127.0.0.1:9090"
    lifecycle:
      auto_start: true
```

## TLS

O servidor pode terminar TLS diretamente. Defina `tls.mode` como `manual` (forneça seu próprio certificado) ou `auto` (certificado fornecido por um driver de rede overlay, ex. `network.tailscale`). Listeners clearnet simples não suportam `auto`. Omita `tls` ou deixe o mode vazio para executar HTTP simples.

No modo `auto`, o servidor não deve especificar `cert` nem `key`: o driver de rede os fornece.

### Certificado manual

Sob `mode: manual`, `cert` e `key` contêm o conteúdo PEM. Forneça esse conteúdo de uma destas três formas para cada campo, sem misturá-las:

1. **PEM inline** — a string PEM literal.
2. **Referência `file://`** — caminho relativo ao manifesto, resolvido e incorporado no carregamento com proteção contra travessia de diretório.
3. **Referência ao registro de ambiente** — obtém o PEM de uma [variável de ambiente](../system/env.md) registrada durante a decodificação, com um placeholder `${env:NAME}`.

```yaml
- name: api
  kind: http.service
  addr: ":443"
  tls:
    mode: manual
    cert: file://./certs/server.pem
    key:  file://./certs/server.key
```

```yaml
- name: api
  kind: http.service
  addr: ":443"
  tls:
    mode: manual
    cert: ${env:app.env:tls_cert}
    key:  ${env:app.env:tls_key}
```

O placeholder `${env:NAME}` resolve `NAME` pelo [registro de ambiente](../system/env.md): o nome público de uma variável registrada ou seu ID de entrada, como `app.env:tls_cert`. Não é uma variável bruta do sistema operacional; um valor do SO só fica acessível quando uma variável apoiada por `env.storage.os` é registrada com esse nome. Um padrão pode ser fornecido como `${env:NAME|default}`.

<note>
Os campos legados <code>cert_env</code> e <code>key_env</code> ainda resolvem valores pelo registro de ambiente da mesma forma, mas estão <b>obsoletos</b>. Prefira o placeholder <code>${env:NAME}</code> mostrado acima.
</note>

| Campo | Descrição |
|-------|-----------|
| `mode` | `""` (desativado), `auto` ou `manual` |
| `cert` / `key` | Conteúdo PEM inline, referência `file://` ou placeholder `${env:NAME}` |

### Mutual TLS (mTLS)

Sob `mode: manual` o servidor pode adicionalmente verificar certificados de cliente:

```yaml
tls:
  mode: manual
  cert: ${env:app.env:tls_cert}
  key:  ${env:app.env:tls_key}
  client_ca: file://./certs/clients-ca.pem
  client_auth: require_and_verify
```

`client_ca` aceita as mesmas três formas de `cert` e `key`: PEM inline, `file://` ou `${env:NAME}`. O campo legado `client_ca_env` também está obsoleto; prefira `client_ca: ${env:NAME}`.

| Campo | Descrição |
|-------|-----------|
| `client_auth` | `request`, `require_any`, `verify_if_given`, `require_and_verify` |
| `client_ca` | Bundle PEM de CAs de cliente confiáveis, inline, por `file://` ou por `${env:NAME}` |

`verify_if_given` e `require_and_verify` exigem uma CA. `request` e `require_any` aceitam qualquer certificado de cliente sem verificação de CA.

## Veja Também

- [Roteamento](./router.md) - Roteadores e endpoints
- [Arquivos Estáticos](./static.md) - Serviço de arquivos estáticos
- [Middleware](./middleware.md) - Middleware disponível
- [Segurança](../system/security.md) - Políticas de segurança
- [WebSocket Relay](./websocket-relay.md) - Mensageria WebSocket
