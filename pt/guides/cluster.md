# Cluster

O Wippy executa como um único nó por padrão. Habilitar o cluster transforma um conjunto de nós em um sistema coordenado que compartilha associação, nomes de processo em todo o cluster, locks distribuídos e mensagens de grupos de processos sobre um núcleo de consenso Raft limitado.

O clustering está desativado até que você defina `cluster.enabled: true`. Tudo abaixo é inativo em um único nó.

## O que o clustering oferece

- **Associação** — cada nó conhece o conjunto ativo de peers via gossip, com detecção rápida de falhas.
- **Nomes de processo em todo o cluster** — registre um processo sob um nome que pode ser resolvido de qualquer nó, com opção de garantias de consistência (veja [Nomeação](#nomeação-e-escopos-de-nome)).
- **Locks distribuídos** — `system.lock` fornece exclusão mútua em todo o cluster com liberação automática quando o detentor morre (veja [Locks distribuídos](#locks-distribuídos)).
- **Grupos de processos** — publique para todos os membros de um grupo nomeado em todos os nós (veja [Grupos de processos](#grupos-de-processos)).
- **Um núcleo de consenso** — um cluster Raft pequeno e limitado fornece a espinha dorsal linearizável sobre a qual os primitivos de nomeação e lock são construídos.

## Arquitetura: Raft limitado

Tornar cada nó um peer Raft escala mal: o leader replica cada entrada de log para cada peer, então o custo do leader ocioso cresce com o tamanho do cluster. O Wippy limita o Raft a um núcleo de tamanho fixo e deixa o restante do cluster usar gossip. Cada nó ocupa um de três papéis na configuração Raft:

| Papel | Contagem (padrão) | Na config Raft | Recebe replicação de log | Vota |
|-------|------------------|----------------|--------------------------|------|
| **Voter** | até 5 (`max_voters`, ímpar) | sim | sim | sim |
| **Standby** | até 4 (`max_standbys`) | sim | sim | não |
| **Client** | ilimitado | não | não | não |

- **Voters** formam o quórum. Escritas são confirmadas quando a maioria dos voters as reconhece. O número de voters é sempre ímpar para que a maioria seja bem definida.
- **Standbys** são membros não-votantes mantidos totalmente replicados e prontos. Quando um voter parte, o leader promove o standby de maior rank para o slot de voter vago, de modo que o quórum se recupera sem esperar que um nó novo se atualize.
- **Clients** são todos os nós além de `voters + standbys`. Eles não estão na configuração Raft, portanto o leader nunca lhes envia entradas de log. Participam do gossip e roteiam escritas para um membro Raft. Isso mantém o CPU do leader ocioso constante (O(1)) independentemente do tamanho do cluster.

Como standbys e clients podem absorver o restante da frota, um cluster de centenas de nós ainda tem um núcleo de consenso de 5 voters. Os limites de `max_voters`/`max_standbys` são o que torna o design "limitado".

### Seleção de voters

O leader executa um reconciliador que, a cada mudança de associação (com debounce por `raft.reconcile_debounce`, padrão 2s), recomputa quais nós devem ser voters e aplica o conjunto mínimo de operações de promoção/remoção. A seleção é determinística — cada nó deriva a mesma ordenação a partir da mesma visão gossip — e é guiada por três dicas anunciadas via gossip:

- `raft.eligible` — um nó com `eligible: false` nunca é escolhido como voter (use para nós que você quer manter como clients ou standbys).
- `raft.priority` — valor menor é preferido ao preencher slots de voter; empates são desfeitos pelo ID do nó.
- `failure_domain` — voters são distribuídos por domínios distintos (zonas/racks) primeiro, para que perder um domínio não elimine a maioria de voters.

As operações são aplicadas em ordem que preserva o quórum: adições e promoções primeiro, depois remoções e rebaixamentos.

## Associação e gossip

A associação usa gossip SWIM (HashiCorp memberlist). Cada nó vincula uma porta gossip (padrão **7946**) e troca continuamente pequenas mensagens com peers para detectar falhas e disseminar metadados.

Um nó junta-se apontando para um ou mais nós existentes:

```yaml
cluster:
  enabled: true
  name: node-2
  membership:
    join_addrs: "node-1:7946"
```

O primeiro nó não precisa de `join_addrs` — ele inicia como seed. Joins são tentados com backoff, e um nó que se encontra isolado periodicamente tenta rejoinar, de modo que um nó reiniciado com um novo IP (comum no Kubernetes) converge rapidamente.

O gossip pode ser criptografado com uma chave compartilhada, fornecida inline ou a partir de um arquivo:

```yaml
cluster:
  membership:
    secret_file: /etc/wippy/cluster.key
```

Mudanças de associação (`NodeJoined`, `NodeLeft`, `NodeUpdated`) são os eventos que impulsionam o bootstrap do Raft, reconciliação de voters, sincronização de grupos de processos e limpeza automática de nomes pertencentes a um nó que partiu.

## Bootstrap

O cluster inicial se forma por gossip, não por uma lista estática de peers. Isso segue o padrão `bootstrap_expect` do Consul/Nomad: você diz a cada nó inicial quantos nós esperar, e eles aguardam até que todos possam se ver antes de formar o quórum juntos.

| `bootstrap_expect` | Comportamento |
|--------------------|---------------|
| `0` | Nunca faz auto-bootstrap; apenas se junta a um cluster já existente |
| `1` | Nó único; bootstrap imediato com self como único voter |
| `N` | Aguarda até que `N` peers elegíveis sejam visivelmente estáveis no gossip, depois todos derivam a mesma lista de voters e formam quórum |

Para um bootstrap de `N` nós, defina o mesmo `bootstrap_expect: N` em cada nó inicial. Cada um anuncia um status "pré-bootstrap" via gossip; quando exatamente `N` peers estão visíveis por uma curta janela de estabilidade, cada nó calcula independentemente o conjunto idêntico de voters ordenados e forma o cluster. A janela de estabilidade impede que uma visão parcial e breve acione o bootstrap prematuramente.

Nós que iniciam depois veem um cluster já formado e pulam o bootstrap — o reconciliador do leader os adiciona como voters ou standbys.

## Núcleo de consenso Raft

O núcleo de consenso é **sem disco**: logs e snapshots Raft vivem apenas em memória, portanto não há diretório de dados para provisionar. Ao reiniciar, um nó rejunta o gossip e reproduz o estado a partir de seus peers. Isso elimina deliberadamente os modos de falha de persistência versus quórum que o Raft em disco introduz, e corresponde ao modelo de sistemas de coordenação em memória (Erlang global, Akka distributed data). A contrapartida: a durabilidade do cluster vem de ter um quórum ativo, não de disco — veja [Recuperação](#recuperação-e-modos-de-falha).

O Raft não abre sua própria porta de escuta. Ele usa a **malha internós** — as mesmas conexões TCP usadas para tráfego de relay entre nós — multiplexada com yamux. A porta internós é selecionada automaticamente no boot (faixa 7950-7959, depois efêmera), fixada e anunciada via gossip para que os peers possam alcançá-la. A única porta que você normalmente expõe é a porta gossip.

A máquina de estados Raft mantém o registro global de nomes: vínculos ativos `nome -> PID` mais reservas strong em andamento. É isso que os primitivos de nomeação abaixo leem e escrevem.

## Nomeação e escopos de nome

Um processo pode ser registrado sob um nome e alcançado por esse nome em vez de seu PID bruto. A decisão chave é o **escopo**, que seleciona a garantia de consistência. Quatro escopos estão disponíveis, do mais barato/fraco ao mais forte:

| Escopo | Suportado por | Visibilidade | Garantia |
|--------|---------------|--------------|----------|
| **Local** | mapa por nó | apenas este nó | Instantâneo, local ao nó; sem coordenação |
| **Eventual** | CRDT gossip | todo o cluster | Eventualmente consistente; converge após rodadas gossip |
| **Consistent** | Raft | todo o cluster | Escritas linearizáveis; singleton único em todo o cluster |
| **Strong** | Raft + ack de todos os nós | todo o cluster | Consistente, mais todos os nós ativos reconhecem antes do nome ficar ativo |

Como escolher:

- **Local** — nomes significativos apenas em um nó (um helper por nó). Liberado no momento em que o processo sai. Custo zero.
- **Eventual** — nomes de serviço, grupo e presença em todo o cluster onde uma janela breve de stale é aceitável. O conjunto de vínculos é totalmente replicado em cada nó, então serve a um espaço de nomes limitado — não a um nome por entidade de alta cardinalidade como um processo por sessão (endereça esses diretamente por PID). Quando duas origens registram o mesmo nome, a resolução de conflitos escolhe um vencedor e o processo perdedor recebe um evento de cancelamento (`process.event.CANCEL`) com o motivo `name revoked: <name>`; ele continua executando e pode se re-registrar. Nomes são liberados quando o nó proprietário parte.
- **Consistent** — a escolha padrão para singletons nomeados em todo o cluster. First-write-wins: um segundo registro do mesmo nome para um PID diferente falha com "already exists" e retorna o proprietário atual. Escritas precisam de quórum, então ficam paradas em uma partição minoritária. Leituras vêm da réplica Raft local e podem atrasar uma escrita por alguns milissegundos.
- **Strong** — o pequeno conjunto de singletons de plano de controle onde até uma leitura stale momentânea é perigosa. Além da garantia Consistent, o registro abre uma reserva que todos os nós ativos devem reconhecer antes que o nome se torne autoritativo; qualquer nó que já detenha um vínculo conflitante o rejeita imediatamente. Se o prazo passar antes de todos os nós confirmarem, o registro expira e reporta quais nós estavam faltando. Esta é a base para [locks distribuídos](#locks-distribuídos).

Nomes são liberados automaticamente: Local na saída do processo; Consistent e Strong na saída do processo (via monitoramento de topologia) e na partida do nó; Eventual na partida do nó. A resolução para mensagens (`process.send`, `process.terminate` e similares) consulta os planos em ordem — Consistent, depois Eventual, depois Local — de modo que um nome Consistent ofusca um Eventual com a mesma string.

A superfície Lua para nomeação vive em `process.registry` (register/lookup/unregister com escopo) — veja a referência de [Process](lua/core/process.md).

## Grupos de processos

Grupos de processos são uma facilidade de publish/subscribe e associação ciente do cluster, modelada no `pg` do Erlang. Um processo junta-se a um grupo nomeado; um broadcast para esse grupo alcança todos os membros em todos os nós. Grupos são suportados por gossip e eventualmente consistentes — independentes do Raft — então continuam funcionando mesmo enquanto o núcleo de consenso está convergindo.

Operações típicas: entrar/sair de um grupo, fazer broadcast para todos os membros (ou apenas membros locais), listar membros e monitorar um grupo para eventos de entrada/saída. Quando um novo nó entra, os grupos reconciliam sua associação através de um handshake de sincronização direta, e um loop de anti-entropia de fundo repara qualquer divergência ao longo do tempo.

Veja [Grupos de Processos](lua/core/pg.md) para a API Lua e o [tipo de entrada `pg.scope`](system/process-groups.md) para configuração.

## Locks distribuídos

`system.lock` é exclusão mútua em todo o cluster construída diretamente sobre o escopo Strong de nomes. Adquirir um lock registra seu nome sob escopo Strong, de propriedade do processo chamador; liberar cancela o registro. Como Strong requer que todos os nós ativos reconheçam, no máximo um detentor pode existir em todo o cluster.

```lua
local ok, err = system.lock.acquire("orders.migration")
if ok then
  -- seção crítica: apenas um detentor em todo o cluster
  system.lock.release("orders.migration")
end
```

A aquisição é fail-fast (não bloqueante): se o lock está mantido, retorna imediatamente, então os chamadores adicionam seu próprio retry/backoff. O lock é liberado automaticamente se o processo detentor sair ou seu nó partir, portanto a limpeza é automática. Veja a referência do [System](lua/system/system.md) para as assinaturas exatas.

## Configuração

A referência completa chave a chave está em [Configuração](guides/configuration.md#cluster). As formas mínimas:

Nó único (desenvolvimento):

```yaml
cluster:
  enabled: true
  name: dev
  raft:
    bootstrap_expect: 1
```

Cluster de três voters:

```yaml
cluster:
  enabled: true
  name: node-1
  failure_domain: us-east-1a
  membership:
    join_addrs: "node-2:7946,node-3:7946"
    secret_file: /etc/wippy/cluster.key
  raft:
    bootstrap_expect: 3
```

Cliente apenas gossip (junta-se para nomeação/mensagens, nunca executa Raft):

```yaml
cluster:
  enabled: true
  name: edge-7
  membership:
    join_addrs: "node-1:7946,node-2:7946"
  raft:
    role: client
```

## Portas

| Finalidade | Porta | Protocolo | Chave de configuração |
|------------|-------|-----------|----------------------|
| Gossip (associação) | 7946 | TCP + UDP | `cluster.membership.bind_port` |
| Malha internós (relay + Raft) | auto | TCP | `cluster.internode.bind_port` |

Não há porta Raft separada — o Raft é multiplexado sobre a malha internós. A porta internós é atribuída automaticamente e anunciada via gossip, portanto apenas a porta gossip precisa de exposição previsível.

## Observabilidade

A saúde do cluster é exposta através do [endpoint Prometheus](guides/observability.md) padrão e de verificações de liveness.

Métricas principais a observar:

| Métrica | Significado |
|---------|-------------|
| `raft_state` | 0 = follower, 1 = candidate, 2 = leader |
| `raft_term` | Termo Raft atual; aumentos rápidos indicam agitação de eleições |
| `raft_voters` / `raft_non_voters` | Voters e standbys ativos na configuração |
| `raft_leader_changes_total` | Transições de leader; deve ser quase constante em um cluster saudável |
| `raft_voter_churn_burst_total` | Surtos de operações de adição/remoção de voters; churn sustentado é sinal de alerta |
| `gossip_members{state}` | Contagens por estado (alive/suspect/dead/left) |
| `gossip_convergence_seconds` | Tempo entre eventos gossip |

Verificações de liveness integradas (conectadas ao endpoint de liveness):

- **gossip** — saudável enquanto o score de saúde gossip do nó permanece baixo, com uma janela de tolerância de boot para que um nó que está rejuntando não seja morto prematuramente.
- **raft last-contact** — um follower voter falha se não ouviu de um leader recentemente; um standby tolera um gap muito maior; leaders sempre passam.
- **process-group broadcast** — falha se um grupo não vê tráfego de broadcast por um período prolongado, detectando um loop de eventos travado ou uma partição persistente.

## Recuperação e modos de falha

Como o núcleo de consenso é sem disco, a durabilidade vem de um quórum ativo e não do disco. As regras práticas:

- Mantenha a maioria de voters ativa. Com 5 voters você tolera 2 falhas simultâneas de voters; standbys são promovidos para preencher slots vazios. Cair abaixo da maioria e as escritas (novos registros Consistent/Strong e aquisições de lock) ficam paradas até que o quórum retorne. Nomes existentes e lookups continuam servindo a partir de réplicas locais.
- O leader expulsa proativamente um voter que está tanto silencioso em heartbeat quanto morto no gossip, para que um voter morto não bloqueie permanentemente o quórum enquanto um standby é promovido.
- Para recuperar um cluster que perdeu quórum, reinicie os nós falhados. Eles rejuntam o gossip e os membros sobreviventes os reintegram. Distribuir voters por `failure_domain`s é o que impede que uma falha de zona única cause perda de quórum.

## Veja também

- [Configuração](guides/configuration.md#cluster) — todas as chaves de configuração do cluster
- [Process](lua/core/process.md) — registrando e resolvendo processos por nome
- [System](lua/system/system.md) — `system.cluster`, `system.raft`, `system.node`, `system.lock`
- [Observabilidade](guides/observability.md) — métricas e endpoints de saúde
- [Modelo de Processos](concepts/process-model.md) — atores, PIDs e mensagens
