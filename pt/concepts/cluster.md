---
title: "Cluster"
description: "Como os nós do Wippy descobrem peers, roteiam mensagens de processos e se coordenam por gossip e Raft."
---

# Cluster

Um único nó Wippy é um runtime completo. Um **cluster** conecta vários nós para que processos possam usar nomes válidos em todo o cluster, rotear mensagens entre nós e se coordenar por meio de locks, grupos e um núcleo de consenso compartilhado.

O clustering é opcional (`cluster.enabled`). Esta página explica o modelo visto pelo código; para topologia, configuração e operações, consulte o [Guia de Cluster](guides/cluster.md).

## Modelo de cluster

Os nós descobrem uns aos outros por **gossip** (SWIM). Um nó entra por meio de um seed; depois disso, as informações de associação e falha convergem sem um coordenador central. Um núcleo **Raft** limitado fornece consenso linearizável por meio de um conjunto de eleitores reconciliado dinamicamente, enquanto os demais nós participam por gossip.

O modelo voltado à aplicação possui três partes: **nomes**, **roteamento** e **primitivos de coordenação**.

## Nomes

Normalmente, um processo é endereçado por seu PID. Em um cluster, ele também pode ser registrado com um **nome** e alcançado por esse nome a partir de outros nós. O **escopo** selecionado determina a garantia de consistência e o custo de coordenação:

| Escopo | Visibilidade | Garantia | Use para |
|-------|------------|-----------|------------|
| **Local** | este nó | imediata, sem coordenação | helpers locais do nó |
| **Eventual** | todo o cluster | converge após o gossip; conflitos são resolvidos e o perdedor é notificado | nomes de serviços, grupos e presença limitada |
| **Consistent** | todo o cluster | singleton linearizável via Raft | o serviço nomeado padrão para todo o cluster |
| **Strong** | todo o cluster | Consistent, mais a confirmação de todos os nós ativos antes de o nome ser ativado | singletons e locks do plano de controle |

Os escopos são ordenados como `Local < Eventual < Consistent < Strong` segundo a consistência e o custo de coordenação. Selecione o escopo de menor custo que satisfaça a garantia necessária. Os nomes são registrados por meio de [`process.registry`](lua/core/process.md). Nomes locais são removidos quando o processo encerra; nomes Consistent e Strong também são removidos quando o processo encerra ou o nó sai. Nomes Eventual são removidos explicitamente ou quando seu nó de origem sai, não automaticamente quando apenas o processo proprietário encerra.

## Roteamento

O roteamento conecta um nome registrado ao processo que o possui:

- **As leituras são locais.** Cada nó resolve um nome em sua própria réplica ou no cache disseminado por gossip, sem round-trip de rede para consultar o nome. Isso mantém a resolução rápida e operacional durante partições.
- **A resolução segue uma ordem fixa.** Um nome é resolvido dos planos mais autoritativos para os menos autoritativos — Consistent e Strong (Raft), depois Eventual (gossip) e, por fim, Local — de modo que um nome de todo o cluster oculta um nome local com a mesma string.
- **As escritas são roteadas à autoridade.** Um registro Consistent ou Strong passa pelo líder Raft; um nó que não seja o líder encaminha a escrita e aguarda o resultado. Após o commit, o binding ativo é disseminado por gossip para que todos os nós — inclusive os que não fazem parte do núcleo Raft — possam resolver o nome localmente.
- **As mensagens são roteadas por PID.** Quando você usa `process.send` com um nome, ele é resolvido para um PID e o relay entrega a mensagem ao nó proprietário. O código endereça um processo da mesma forma, esteja ele neste nó ou em outro; a localização é transparente.

As aplicações registram e resolvem nomes sem endereçar diretamente o nó que detém a autoridade. Após a resolução, as mensagens são roteadas ao nó que possui o PID de destino.

## Primitivos

O clustering expõe um pequeno conjunto de blocos de coordenação:

- **Associação e identidade** — o conjunto de nós ativos e a identidade e o papel deste nó. Use-os para descobrir peers ou particionar trabalho. Consulte [`system.cluster`](lua/system/system.md) e [`system.node`](lua/system/system.md).
- **Estado de consenso** — o líder Raft, o term e o papel deste nó, para diagnósticos e lógica que considera o líder. Consulte [`system.raft`](lua/system/system.md).
- **Nomes válidos em todo o cluster** — registre e resolva processos por nome e escopo, a base de todos os outros recursos. Consulte [`process.registry`](lua/core/process.md).
- **Locks distribuídos** — exclusão mútua em todo o cluster com no máximo um detentor, liberada automaticamente se o detentor morrer. Consulte [`system.lock`](lua/system/system.md).
- **Grupos de processos** — participe de grupos nomeados e faça broadcast para todos os membros em todos os nós, no estilo Erlang. Consulte [Grupos de Processos](lua/core/pg.md).

Esses primitivos compartilham a infraestrutura de associação e roteamento. Nomes Consistent e Strong e locks distribuídos usam o núcleo Raft. Grupos de processos usam a associação por gossip para descobrir peers, enviam mudanças pelo relay e trocam periodicamente o estado completo para convergir.

## Consulte também

- [Guia de Cluster](guides/cluster.md) — Topologia, configuração e operações
- [Gerenciamento de Processos](lua/core/process.md) — Spawn, mensagens e o registro de nomes
- [Grupos de Processos](lua/core/pg.md) — Grupos nomeados e broadcast
- [Sistema](lua/system/system.md) — `system.cluster`, `system.node`, `system.raft`, `system.lock`
- [Modelo de Processos](concepts/process-model.md) — Processos, PIDs e mensagens
