# Servidor HTTP

O servidor HTTP (`http.service`) escuta em uma porta e hospeda roteadores, endpoints e handlers de arquivos estaticos.

## Configuracao

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

| Campo | Tipo | Padrao | Descricao |
|-------|------|--------|-----------|
| `addr` | string | obrigatorio | Endereco de escuta (`:8080`, `0.0.0.0:443`) |
| `timeouts.read` | duration | - | Timeout de leitura de requisicao |
| `timeouts.write` | duration | - | Timeout de escrita de resposta |
| `timeouts.idle` | duration | - | Timeout de conexao keep-alive |
| `host.buffer_size` | int | 1024 | Tamanho do buffer de relay de mensagens |
| `host.worker_count` | int | NumCPU | Workers de relay de mensagens |

## Timeouts

Configure timeouts para prevenir exaustao de recursos:

```yaml
timeouts:
  read: "10s"    # Tempo maximo para ler headers da requisicao
  write: "60s"   # Tempo maximo para escrever resposta
  idle: "120s"   # Timeout de keep-alive
```

- `read` - Curto (5-10s) para APIs, mais longo para uploads
- `write` - Corresponda ao tempo esperado de geracao de resposta
- `idle` - Balance reutilizacao de conexao vs uso de recursos

<note>
Formato de duracao: <code>30s</code>, <code>1m</code>, <code>2h15m</code>. Use <code>0</code> para desabilitar.
</note>

## Configuracao do Host

A secao `host` configura o relay de mensagens interno do servidor usado por componentes como WebSocket relay:

```yaml
host:
  buffer_size: 2048
  worker_count: 8
```

| Campo | Padrao | Descricao |
|-------|--------|-----------|
| `buffer_size` | 1024 | Capacidade da fila de mensagens por worker |
| `worker_count` | NumCPU | Goroutines de processamento paralelo de mensagens |

<tip>
Aumente esses valores para aplicacoes WebSocket de alto throughput. O relay de mensagens trata entrega assincrona entre componentes HTTP e processos.
</tip>

## Seguranca

Servidores HTTP podem ter um contexto de seguranca padrao aplicado atraves da configuracao de ciclo de vida:

```yaml
lifecycle:
  auto_start: true
  security:
    actor:
      id: "gateway-service"
    policies:
      - app:http_access_policy
```

Isso define um ator e politicas base para todas as requisicoes. Para requisicoes autenticadas, o [middleware token_auth](http-middleware.md) sobrescreve o ator baseado no token validado, permitindo politicas de seguranca por usuario.

## Ciclo de Vida

Servidores sao gerenciados pelo supervisor:

```yaml
lifecycle:
  auto_start: true
  start_timeout: 30s
  stop_timeout: 60s
  depends_on:
    - app:database
```

| Campo | Descricao |
|-------|-----------|
| `auto_start` | Inicia quando a aplicacao inicia |
| `start_timeout` | Tempo maximo de espera para servidor iniciar |
| `stop_timeout` | Tempo maximo para encerramento gracioso |
| `depends_on` | Inicia apos essas entradas estarem prontas |

## Conectando Componentes

Roteadores e handlers estaticos referenciam o servidor via metadados:

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

## Multiplos Servidores

Execute servidores separados para propositos diferentes:

```yaml
entries:
  # API publica
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

<warning>
Terminacao TLS e tipicamente tratada por um proxy reverso (Nginx, Caddy, load balancer). Configure seu proxy para encaminhar ao servidor HTTP do Wippy.
</warning>

## Veja Tambem

- [Roteamento](http-router.md) - Roteadores e endpoints
- [Arquivos Estaticos](http-static.md) - Servindo arquivos estaticos
- [Middleware](http-middleware.md) - Middleware disponivel
- [Seguranca](system-security.md) - Politicas de seguranca
- [Relay WebSocket](http-websocket-relay.md) - Mensagens WebSocket
