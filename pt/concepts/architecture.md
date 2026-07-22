---
title: "Arquitetura de Aplicações"
description: "Como dividir uma aplicação Wippy em namespaces, slices e camadas para que o grafo do registro permaneça componível, testável e inicializável à medida que cresce."
---

# Arquitetura de Aplicações

Uma aplicação Wippy não é uma árvore de arquivos-fonte — é um **grafo de entradas de registro**. O código vive em entradas `function.lua` e `process.lua`; tudo o que as liga — qual função responde a uma rota HTTP, qual processo um serviço supervisiona, qual biblioteca importa qual — é declarado em `_index.yaml`. Estruturar uma aplicação significa decidir como **dividir esse grafo em namespaces** para que ele permaneça componível, testável e inicializável à medida que cresce.

Esta página é o raciocínio por trás do layout. Para as regras mecânicas (formato de arquivo, nomenclatura, onde fica o `_index.yaml`) veja [YAML e Estrutura do Projeto](start/structure.md). Para os tipos de entrada em si veja o [Guia de Tipos de Entradas](guides/entry-kinds.md).

## A unidade é um slice

Organize por **feature**, não por tipo de arquivo. Um slice é dono de uma capacidade de ponta a ponta — seu acesso ao banco de dados, seus processos de longa duração, sua superfície HTTP e o vocabulário que eles compartilham — e vive sob um prefixo de namespace:

```
src/app/jobs/          namespace: app.jobs
src/app/auth/          namespace: app.auth
src/app/billing/       namespace: app.billing
```

A alternativa — uma divisão de nível superior em `handlers/`, `models/`, `services/` — espalha cada feature pela árvore e as acopla por proximidade. Slices mantêm o raio de impacto de uma feature dentro de uma pasta: você pode lê-la, testá-la ou excluí-la sem caçar referências pelo projeto.

## Camadas dentro de um slice

Dentro de um slice, divida ao longo do eixo do **que toca o mundo externo**. Isto é a arquitetura ports-and-adapters (hexagonal), expressa como **sub-namespaces**:

```
src/app/jobs/                  namespace: app.jobs          ← shared vocabulary
  consts.lua  config.lua  types.lua
  persist/                     namespace: app.jobs.persist  ← database adapters (sql)
  service/                     namespace: app.jobs.service  ← processes, workers
  api/                         namespace: app.jobs.api      ← http.endpoints
```

Os imports fluem **em um único sentido**, do mais externo ao mais interno:

```
api  →  service  →  persist  →  { consts, config, types }
```

A raiz do slice (o vocabulário compartilhado) não importa nada de seus próprios filhos. Os filhos importam a raiz. Nenhuma camada volta para cima, e **nenhum slice importa outro slice diretamente** — o compartilhamento entre slices passa por um namespace pai comum (p. ex. `app.core:types`), nunca lateralmente.

<note>
A fronteira de namespace não é cosmética. É a costura na qual o runtime injeta dependências e através da qual resolve a ordem de boot. A direção dos imports é o que garante que uma ordem de boot válida exista — veja <a href="#why-this-shape">Por que este formato</a>.
</note>

Um slice menor reduz a cerimônia — um único `_index.yaml` com as bibliotecas e um endpoint é suficiente. A regra que sobrevive em qualquer tamanho é a **direção dos imports**, não a quantidade de pastas.

## O vocabulário compartilhado

Três arquivos recorrem na raiz de um slice bem estruturado. Eles contêm o que toda camada lê mas que nenhuma delas *é*:

| Arquivo | Contém | Capacidades |
|------|-------|--------------|
| `consts.lua` | Máquinas de estado, enums, tiers de fila, IDs de registro de processos. Os valores que espelham as constraints `CHECK` do seu banco de dados. | nenhuma |
| `config.lua` | Ajustes configuráveis via env com fallbacks de default no código (`env.get(KEY) or DEFAULT`), de modo que nenhuma entrada `env.variable` é necessária para um valor ser opcional. | `env` |
| `types.lua` | Formatos de entidades (`type Job = { ... }`) — as linhas que a camada de persistência retorna. | nenhuma |

`consts` e `types` declaram **nenhuma capacidade de host** — são `library.lua` puros retornando uma tabela. Isso é deliberado: seu vocabulário de domínio não pode realizar I/O, logo não pode escorregar para lógica de negócio, e é testável unitariamente sem banco de dados e sem host de processos.

Mantenha esse vocabulário **privado ao slice**. Constantes e tipos compartilhados entre slices vivem no pai comum e são referenciados através de um import ali — nunca copiados para cada slice.

## Capacidades se ordenam por camada

Cada entrada declara em `modules:` as capacidades de host de que precisa. Em um slice em camadas elas se ordenam de forma limpa:

- `persist/*` declara `sql` — e nada mais tem acesso ao banco de dados.
- `service/*` declara `channel`, capacidades de host de processos — e nada mais faz spawn ou supervisiona.
- `api/*` declara o que um endpoint precisa para serializar uma requisição.
- O vocabulário raiz não declara nada.

O ganho é que o raio de impacto de qualquer capacidade é exatamente uma camada. Se você quer saber tudo o que pode escrever no banco de dados, você lê `persist/`. Inversão de dependência deixa de ser um princípio abstrato e vira uma propriedade que você pode encontrar com grep.

## Aplicações e componentes

O mesmo formato escala de uma aplicação única a uma biblioteca publicada mudando apenas **quem preenche os buracos**.

Uma **aplicação** é o grafo de nível superior, implantável. Ela é dona da infraestrutura concreta — o `http.service`, o `process.host`, a conexão de banco de dados — sob um namespace raiz (convencionalmente `app`), e faz ela mesma toda a fiação.

Um **componente** é um módulo publicável montado *dentro* de um host. Ele não pode nomear o banco de dados nem o roteador do host, porque não os conhece. Em vez disso, declara uma **interface de buracos** — entradas `ns.requirement` — que o host preenche ao depender do componente. Internamente, um componente é estruturado exatamente como um slice de aplicação: mesmas camadas, mesmo vocabulário, mesma direção de imports. A única adição é a interface de requirements na sua borda.

Isto é um espectro, não duas categorias:

- **Aplicação única, slices internos** — os slices vivem sob `src/app/`, compartilham a infraestrutura da aplicação diretamente referenciando `app:db`, `app:processes`. Nenhuma interface de requirements é necessária; nada externo os monta. (É assim que se constrói um serviço focado.)
- **Composição multi-componente** — cada componente é seu próprio módulo publicável com um `ns.definition` e uma interface `ns.requirement`, composto por um host através de `ns.dependency`. O host preenche cada requirement (banco de dados, host de processos, roteador) uma vez. (É assim que se constrói uma plataforma de partes reutilizáveis.)

Escolha conforme o slice se destina a ser **consumido por algo que você não controla**. Se sim, dê a ele uma interface de requirements e publique-o. Se não, deixe-o referenciar a infraestrutura da aplicação diretamente e pule a cerimônia. As camadas são o invariante em ambas as pontas; o empacotamento é o que escala com o reúso.

Veja [Construindo Componentes](guides/components.md) para o mecanismo de requirement/dependency, e [Gerenciamento de Dependências](guides/dependency-management.md) para o lado do arquivo de lock.

## Por que este formato {#why-this-shape}

A disciplina acima não é estilo. Cada regra sustenta como o runtime compõe e inicializa um grafo:

**A fronteira de namespace é a costura de injeção.** Como as camadas se ligam apenas por `imports:` explícitos e vivem em namespaces distintos, o mecanismo `ns.requirement` tem um alvo concreto onde injetar — o host aponta seu banco de dados para as entradas da camada `persist`, seu host de processos para as entradas da camada `service`. Se `persist` agarrasse `app:db` diretamente, o componente nunca poderia ser montado em um host diferente: não haveria buraco a preencher. As camadas são o que torna um componente **relocável**.

**Imports de sentido único garantem que uma ordem de boot exista.** O runtime resolve o grafo de entradas no boot e precisa encontrar uma ordem topológica. `api → service → persist → root`, nunca lateralmente e nunca para cima, significa que o grafo é acíclico por construção. Acoplamento entre slices roteado por um pai compartilhado mantém os slices montáveis independentemente, em vez de amarrá-los em um ciclo que o loader não consegue ordenar.

**Capacidades com escopo por camada limitam o raio de impacto.** Capacidades de host são concedidas por entrada. Quando apenas `persist` declara `sql`, o conjunto de código que pode alcançar o banco de dados é um diretório, auditável de relance — não uma propriedade emergente da aplicação inteira.

**As camadas produzem um gradiente de testabilidade.** O vocabulário puro é testado sem mundo algum. Os testes de `persist` tocam um banco de dados mas não um worker. Um **teste de montagem** do módulo inteiro então audita as costuras que os testes unitários deliberadamente não conseguem ver — que cada serviço supervisionado aponta para um processo real, que cada ID iniciado via spawn resolve, que cada requirement está preenchido. Esse gradiente só existe se as camadas forem de fato separáveis.

A versão curta: as camadas hexagonais aqui são o único formato em que injeção de requirements, escopo de capacidades por camada e resolução acíclica de boot valem ao mesmo tempo. O modelo de composição do runtime *requer* a divisão ports-and-adapters para funcionar — a disciplina é o que compra um grafo que inicializa e um componente que outra pessoa pode montar.

## Veja Também

- [YAML e Estrutura do Projeto](start/structure.md) — formato de arquivo, nomenclatura, namespaces
- [Construindo Componentes](guides/components.md) — `ns.definition`, `ns.requirement`, montagem
- [Gerenciamento de Dependências](guides/dependency-management.md) — arquivos de lock, consumo de módulos
- [Registro](concepts/registry.md) — como entradas são armazenadas e resolvidas
- [Guia de Tipos de Entradas](guides/entry-kinds.md) — todos os tipos de entrada
- [Modelo de Processos](concepts/process-model.md) — serviços, supervisão, hosts
