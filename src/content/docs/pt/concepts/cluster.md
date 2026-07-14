---
title: "Cluster"
---

# Cluster

Um único nó Wippy é um runtime completo. Um **cluster** une vários nós em um sistema coordenado: processos podem ser nomeados e alcançados de qualquer nó, coordenar-se através de locks e grupos, e depender de um núcleo de consenso compartilhado — sem que seu código mude a forma como spawna, envia ou supervisiona.

Clustering é opcional (`cluster.enabled`). Esta página explica o modelo que seu código enxerga; para topologia, configuração e operações, consulte o [Guia de Cluster](guides/cluster.md).

## O modelo

Os nós se descobrem mutuamente através de **gossip** (SWIM) — um nó se junta apontando para um seed, e a associação e a detecção de falhas convergem sem um coordenador. Sobre o gossip assenta um pequeno e delimitado núcleo **Raft**: um conjunto fixo de eleitores fornece consenso linearizável, enquanto o restante da frota utiliza gossip. A maioria dos nós nunca carrega carga de consenso, então o cluster escala horizontalmente mantendo uma única fonte de verdade para o que a necessita.

O que o cluster oferece ao seu código se resume a três ideias: **nomes**, **roteamento** e **primitivos de coordenação**.

## Nomeação

Um processo é normalmente endereçado pelo seu PID. Em um cluster, ele também pode ser registrado sob um **nome** e alcançado por esse nome de qualquer lugar. A única decisão que importa é o **escopo** — a garantia de consistência desejada, negociada contra o custo:

| Escopo | Visibilidade | Garantia | Use para |
|--------|--------------|----------|----------|
| **Local** | este nó | imediato, sem coordenação | auxiliares locais do nó |
| **Eventual** | todo o cluster | converge após gossip; conflitos se resolvem e notificam o perdedor | nomes de serviço, grupo e presença limitada |
| **Consistent** | todo o cluster | singleton linearizável via Raft | o serviço nomeado padrão para todo o cluster |
| **Strong** | todo o cluster | Consistent, mais o reconhecimento de todos os nós ativos antes de o nome estar ativo | singletons e locks do plano de controle |

Os escopos formam uma ordenação estrita — `Local < Eventual < Consistent < Strong` — no eixo consistência-versus-custo. Você escolhe o escopo mais fraco que ainda satisfaz a garantia necessária. Nomes são registrados através de [`process.registry`](lua/core/process.md) e liberados automaticamente quando o processo proprietário encerra (ou seu nó sai do cluster).

## Roteamento

A nomeação só é útil se um nome alcança de forma confiável o processo correto. O roteamento é o que conecta os dois, e segue algumas regras consistentes:

- **Leituras são locais.** Cada nó resolve um nome a partir de sua própria réplica ou cache disseminado por gossip — sem round-trip de rede para consultar um nome. Isso mantém a resolução rápida e funcional durante partições.
- **A resolução segue uma ordem fixa.** Um nome é resolvido nos planos em ordem — Consistent (Raft), depois Eventual (gossip), depois Local — portanto um nome de todo o cluster sobrepõe um local de mesma string.
- **Escritas roteiam para a autoridade.** Um registro Consistent ou Strong passa pelo líder Raft; um nó que não é o líder encaminha a escrita e aguarda o resultado. Uma vez confirmado, o binding ativo é disseminado via gossip para que todos os nós — incluindo os que não fazem parte do núcleo Raft — possam resolver o nome localmente em seguida.
- **Mensagens roteiam por PID.** Quando você usa `process.send` para um nome, ele é resolvido para um PID e o relay entrega a mensagem ao nó proprietário. Seu código endereça um processo da mesma forma independentemente de ele estar neste nó ou em outro — a localização é transparente.

O efeito: você registra e consulta nomes sem pensar em qual nó detém a autoridade, e as mensagens encontram seu destino em todo o cluster da mesma forma que fazem localmente.

## Primitivos

O cluster expõe um pequeno conjunto de blocos de construção. Cada um é documentado por completo em sua própria página; o conceito é o que eles permitem construir:

- **Associação e identidade** — o conjunto ativo de nós e a identidade e papel deste nó. Use para descobrir peers ou distribuir trabalho. Veja [`system.cluster`](lua/system/system.md) e [`system.node`](lua/system/system.md).
- **Estado de consenso** — o líder Raft, o term e o papel deste nó, para diagnósticos e lógica ciente do líder. Veja [`system.raft`](lua/system/system.md).
- **Nomes em todo o cluster** — registre e resolva processos por nome e escopo, a fundação sobre a qual todo o resto é construído. Veja [`process.registry`](lua/core/process.md).
- **Locks distribuídos** — exclusão mútua em todo o cluster com no máximo um detentor, liberado automaticamente se o detentor falhar. Veja [`system.lock`](lua/system/system.md).
- **Grupos de processos** — entre em grupos nomeados e faça broadcast para todos os membros em todos os nós, no estilo Erlang. Veja [Grupos de Processos](lua/core/pg.md).

Estes são deliberadamente primitivos: locks e singletons nomeados são construídos sobre o escopo de nomeação Strong, grupos de processos sobre gossip, e todos eles sobre a mesma associação e roteamento descritos acima — portanto se compõem de forma previsível em vez de cada um inventar sua própria distribuição.

## Veja Também

- [Guia de Cluster](guides/cluster.md) - Topologia, configuração e operações
- [Gerenciamento de Processos](lua/core/process.md) - Spawn, mensagens e o registro de nomes
- [Grupos de Processos](lua/core/pg.md) - Grupos nomeados e broadcast
- [Sistema](lua/system/system.md) - `system.cluster`, `system.node`, `system.raft`, `system.lock`
- [Modelo de Processos](concepts/process-model.md) - Processos, PIDs e mensagens
