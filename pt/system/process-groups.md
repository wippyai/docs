---
title: "Grupos de Processos"
description: "Configure grupos de processos nomeados e cientes do cluster, com associação descentralizada, broadcasts, monitoramento e reconciliação."
---

# Grupos de Processos

Um `pg.scope` permite que processos entrem em grupos nomeados e recebam broadcasts destinados a um grupo. O modelo segue o `pg` do Erlang/OTP: grupos são criados no primeiro join, um processo pode pertencer a vários grupos e entrar no mesmo grupo mais de uma vez, e cada nó do cluster mantém seu próprio estado de associação e o reconcilia com os peers pela malha internode. Esta página é uma referência de configuração e comportamento; os blocos YAML são fragmentos de entradas.

A API Lua está documentada em [Grupos de Processos](../lua/core/pg.md); esta página cobre o tipo de entrada do escopo e sua configuração. Consulte o [Guia de cluster](../guides/cluster.md) para o modelo de associação circundante.

## Tipo de Entrada

| Tipo | Descrição |
|------|-----------|
| `pg.scope` | Um namespace de grupo de processos independente com seu próprio estado de associação e malha de cluster |

Cada escopo é isolado: grupos e membros em um escopo são invisíveis para outro. Um processo abre um escopo pelo seu ID de entrada (`pg.open("app:pg")`) e opera dentro dele.

```yaml
- name: pg
  kind: pg.scope
  lifecycle:
    auto_start: true
```

## Configuração

Todos os campos são opcionais. A tabela mostra seus valores padrão.

| Campo | Tipo | Padrão | Descrição |
|-------|------|--------|-----------|
| `protocol_timeout` | duration | 5s | Timeout para operações de sync/discover entre nós |
| `broadcast_timeout` | duration | 5s | Timeout para entregar um broadcast a um único membro |
| `anti_entropy_interval` | duration | 30s | Cadência do loop de reconciliação; um peer é sincronizado por tick |
| `circuit_breaker_failures` | int | 3 | Falhas de envio consecutivas para um nó antes de seu circuito abrir |
| `circuit_breaker_reset_time` | duration | 10s | Espera antes de um circuito aberto mover para half-open para um envio de teste |
| `max_retries` | int | 3 | Tentativas de retry para um broadcast que falhou |
| `retry_base_delay` | duration | 100ms | Atraso inicial de backoff entre retries |
| `retry_max_delay` | duration | 1s | Atraso máximo de backoff |
| `action_queue_size` | int | 256 | Profundidade em que um aviso de "aproximando capacidade" é registrado |
| `action_queue_max_size` | int | 1024 | Capacidade máxima da fila de loop de eventos interna; operações são descartadas quando cheia |
| `monitor_buffer` | int | 64 | Capacidade de channel de evento por inscrição; eventos são descartados para um assinante cujo buffer enche |
| `max_groups` | int | 0 | Máximo de grupos distintos (0 = ilimitado) |
| `max_members_per_group` | int | 0 | Máximo de membros por grupo, contando multi-joins (0 = ilimitado) |

```yaml
- name: pg
  kind: pg.scope
  anti_entropy_interval: 30s
  circuit_breaker_failures: 3
  max_members_per_group: 10000
  lifecycle:
    auto_start: true
```

## Como Funciona

**Estado de escritor único.** Cada escopo executa um loop de eventos de goroutine única (o padrão gen_server). Todas as mutações são serializadas por ele; leituras de membros e grupos são servidas a partir de snapshots publicados atomicamente, portanto nunca bloqueiam o loop.

**Propagação de join/leave.** Um join ou leave local é aplicado ao loop e depois distribuído para a união dos peers de associação ativos e quaisquer nós remotos previamente descobertos. Enviar para essa união garante que um nó recém-unido ou ainda não convergido ainda receba a mudança.

**Broadcast.** `broadcast` faz snapshot da lista completa de membros cross-cluster dentro do loop, depois entrega a cada membro fora do loop para que um destinatário lento não trave o escopo. `broadcast_local` faz o mesmo mas apenas para membros no nó local.

**Monitor e events.** Inscrever e fazer snapshot dos membros atuais ocorrem em um tick do loop de eventos, de modo que um assinante nunca perde ou conta duas vezes uma mudança que corre com a inscrição. Assinantes recebem eventos `member.joined` / `member.left`; um leave de um processo que entrou N vezes reporta o PID N vezes, preservando a multiplicidade.

**Anti-entropia e descoberta.** No início, um escopo envia mensagens de descoberta para um pequeno subconjunto aleatório de peers (limitado para evitar uma tempestade N² quando muitos nós reiniciam ao mesmo tempo). Quando um nó entra, recebe uma sincronização de estado completa. O loop de anti-entropia então periodicamente envia uma sincronização completa para um peer por vez, para que qualquer broadcast que um peer perdeu eventualmente convirja. O receptor aplica uma sincronização diferencial — apenas membros realmente adicionados ou removidos emitem eventos.

**Circuit breakers.** Um circuit breaker por nó rastreia falhas de envio consecutivas. Após `circuit_breaker_failures` falhas ele abre e envios para aquele nó são ignorados até que `circuit_breaker_reset_time` decorra, quando um envio de teste é permitido. Broadcasts de join/leave que atingem um breaker aberto são tentados novamente com backoff exponencial até `max_retries`.

## Observabilidade

Uma verificação de liveness (`pg.broadcast_recent.<scope>`) reporta estado não saudável se um escopo não observar tráfego de broadcast por um período prolongado, revelando um loop de eventos travado ou uma partição persistente. Consulte o [Guia de observabilidade](../guides/observability.md).

## Consulte também

- [Grupos de Processos](../lua/core/pg.md) — A API Lua
- [Cluster](../guides/cluster.md) — Associação e o modelo de clustering
- [Modelo de Processos](../concepts/process-model.md) — Processos, PIDs e mensagens
