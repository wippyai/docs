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

No modo `auto` o servidor não deve especificar `cert`/`key`/`cert_env`/`key_env` — o driver de rede os fornece.

### Certificado manual

Forneça cert e key inline/carregados de arquivo ou via variáveis de ambiente (nunca ambos):

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
    cert_env: TLS_SERVER_CERT
    key_env:  TLS_SERVER_KEY
```

| Campo | Descrição |
|-------|-----------|
| `mode` | `""` (off), `auto` ou `manual` |
| `cert` / `key` | Conteúdo PEM (tipicamente carregado via `file://`) |
| `cert_env` / `key_env` | Nomes de variáveis de ambiente resolvidas via o [registro env](system/env.md) |

### Mutual TLS (mTLS)

Sob `mode: manual` o servidor pode adicionalmente verificar certificados de cliente:

```yaml
tls:
  mode: manual
  cert_env: TLS_SERVER_CERT
  key_env:  TLS_SERVER_KEY
  client_ca: file://./certs/clients-ca.pem
  client_auth: require_and_verify
```

| Campo | Descrição |
|-------|-----------|
| `client_auth` | `request`, `require_any`, `verify_if_given`, `require_and_verify` |
| `client_ca` | Bundle PEM de CAs de cliente confiáveis |
| `client_ca_env` | Variável de ambiente contendo o bundle da CA (mutuamente exclusiva com `client_ca`) |

`verify_if_given` e `require_and_verify` exigem uma CA. `request` e `require_any` aceitam qualquer certificado de cliente sem verificação de CA.

## Veja Também

- [Roteamento](http/router.md) - Roteadores e endpoints
- [Arquivos Estáticos](http/static.md) - Servindo arquivos estáticos
- [Middleware](http/middleware.md) - Middleware disponível
- [Segurança](system/security.md) - Políticas de segurança
- [WebSocket Relay](http/websocket-relay.md) - Mensageria WebSocket
