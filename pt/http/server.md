---
title: "Servidor HTTP"
description: "O servidor HTTP (http.service) escuta em uma porta e hospeda roteadores, endpoints e handlers de arquivos estáticos."
---

# Servidor HTTP

O servidor HTTP (`http.service`) escuta em uma porta e hospeda roteadores, endpoints e handlers de arquivos estáticos.

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
| `network` | ID do Registro | - | Vincula o listener através de uma [rede overlay](system/network.md) (ex. Tailscale, I2P) |
| `tls` | object | - | Terminação TLS (ver [TLS](#tls)) |

## Timeouts

Configure timeouts para evitar esgotamento de recursos:

```yaml
timeouts:
  read: "10s"    # Tempo máximo para ler headers de requisição
  write: "60s"   # Tempo máximo para escrever resposta
  idle: "120s"   # Timeout keep-alive
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

Isso define um ator e políticas base para todas as requisições. Para requisições autenticadas, o [middleware token_auth](http/middleware.md) sobrescreve o ator baseado no token validado, permitindo políticas de segurança por usuário.

## Lifecycle

Servidores são gerenciados pelo supervisor:

```yaml
lifecycle:
  auto_start: true
  start_timeout: 30s
  stop_timeout: 60s
  depends_on:
    - app:database
```

| Campo | Descrição |
|-------|-----------|
| `auto_start` | Iniciar quando a aplicação iniciar |
| `start_timeout` | Tempo máximo de espera pelo início do servidor |
| `stop_timeout` | Tempo máximo para shutdown graceful |
| `depends_on` | Iniciar após essas entradas estarem prontas |

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
  # API pública
  - name: public
    kind: http.service
    addr: ":8080"
    lifecycle:
      auto_start: true

  # Admin (apenas localhost)
  - name: admin
    kind: http.service
    addr: "127.0.0.1:9090"
    lifecycle:
      auto_start: true
```

## TLS

O servidor pode terminar TLS diretamente. Defina `tls.mode` como `manual` (forneça seu próprio certificado) ou `auto` (certificado fornecido por um driver de rede overlay, ex. `network.tailscale`). Listeners clearnet simples não suportam `auto`. Omita `tls` ou deixe o mode vazio para executar HTTP simples.

No modo `auto` o servidor não deve especificar `cert`/`key` — o driver de rede os fornece.

### Certificado manual

Sob `mode: manual`, `cert` e `key` carregam conteúdo PEM. Forneça esse conteúdo de uma de três formas (escolha uma por campo, nunca misture):

1. **PEM inline** — a string PEM literal.
2. **Referência `file://`** — caminho relativo ao manifesto, resolvido e embutido no momento do carregamento (seguro contra traversal).
3. **Referência ao registro de ambiente** — obtém o PEM de uma [variável de ambiente](system/env.md) registrada no momento da decodificação, usando um placeholder `${env:NAME}`.

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

O placeholder `${env:NAME}` resolve `NAME` através do [registro de ambiente](system/env.md) — o nome público de uma variável registrada ou o ID da sua entrada (ex. `app.env:tls_cert`). Não é uma variável de ambiente bruta do SO; um valor do SO só é alcançável quando uma variável com backend `env.storage.os` está registrada sob aquele nome. Um padrão pode ser fornecido com `${env:NAME|default}`.

<note>
Os campos companheiros legados <code>cert_env</code> / <code>key_env</code> ainda resolvem através do registro de ambiente da mesma forma, mas estão <b>deprecados</b> — prefira o placeholder <code>${env:NAME}</code> mostrado acima.
</note>

| Campo | Descrição |
|-------|-----------|
| `mode` | `""` (off), `auto` ou `manual` |
| `cert` / `key` | Conteúdo PEM — inline, referência `file://` ou placeholder `${env:NAME}` |

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

`client_ca` aceita as mesmas três formas de `cert`/`key` (PEM inline, `file://` ou `${env:NAME}`). O campo companheiro legado `client_ca_env` está igualmente deprecado em favor de `client_ca: ${env:NAME}`.

| Campo | Descrição |
|-------|-----------|
| `client_auth` | `request`, `require_any`, `verify_if_given`, `require_and_verify` |
| `client_ca` | Bundle PEM de CAs de cliente confiáveis (inline, `file://` ou `${env:NAME}`) |

`verify_if_given` e `require_and_verify` exigem uma CA. `request` e `require_any` aceitam qualquer certificado de cliente sem verificação de CA.

## Veja Também

- [Roteamento](http/router.md) - Roteadores e endpoints
- [Arquivos Estáticos](http/static.md) - Servindo arquivos estáticos
- [Middleware](http/middleware.md) - Middleware disponível
- [Segurança](system/security.md) - Políticas de segurança
- [WebSocket Relay](http/websocket-relay.md) - Mensageria WebSocket
