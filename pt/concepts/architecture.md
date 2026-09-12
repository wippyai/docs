---
title: "Arquitetura de Aplicações"
description: "Como dividir uma aplicação Wippy em namespaces, slices e camadas para que o grafo do registro permaneça componível, testável e inicializável à medida que cresce."
---

# Arquitetura de Aplicações

Uma aplicação Wippy é um **grafo de entradas do registro** representado por arquivos-fonte. O código reside em entradas como `function.lua` e `process.lua`; os arquivos `_index.yaml` declaram como funções, rotas, serviços e bibliotecas se conectam. A estrutura da aplicação determina como esse grafo é dividido em namespaces para que permaneça componível, testável e inicializável à medida que cresce.

Esta página explica uma forma de organizar esse grafo. Para o formato dos arquivos, a nomenclatura e a posição dos `_index.yaml`, consulte [YAML e Estrutura do Projeto](start/structure.md). Para as definições das entradas, consulte o [Guia de Tipos de Entrada](guides/entry-kinds.md).

## Slices por feature

Um bom padrão é organizar por **feature**, e não por tipo de arquivo. Um slice concentra uma capacidade de ponta a ponta — seu acesso ao banco de dados, seus processos de longa duração, sua superfície HTTP e seu vocabulário compartilhado — e reside sob um prefixo de namespace:

```
src/app/jobs/          namespace: app.jobs
src/app/auth/          namespace: app.auth
src/app/billing/       namespace: app.billing
```

Slices por feature mantêm comportamentos relacionados na mesma pasta, facilitando ler, testar, alterar ou remover uma capacidade sem precisar rastreá-la por diretórios de nível superior como `handlers/`, `models/` e `services/`.

## Camadas dentro de um slice

Em slices maiores, separe o código de acordo com **o que toca o mundo externo**. Isso aplica a arquitetura ports-and-adapters (hexagonal) por meio de **sub-namespaces**:

```
src/app/jobs/                  namespace: app.jobs          ← shared vocabulary
  consts.lua  config.lua  types.lua
  persist/                     namespace: app.jobs.persist  ← database adapters (sql)
  service/                     namespace: app.jobs.service  ← processes, workers
  api/                         namespace: app.jobs.api      ← http.endpoints
```

Mantenha os imports fluindo das camadas externas para as internas:

```
api  →  service  →  persist  →  { consts, config, types }
```

A raiz do slice contém o vocabulário compartilhado e não importa seus próprios filhos. Os filhos podem importar a raiz. Evite imports diretos entre slices; coloque definições compartilhadas em um namespace pai comum, como `app.core:types`.

<note>
Namespaces organizam IDs de entrada, mas não criam dependências nem pontos de injeção por si mesmos. <code>imports</code> explícitos, referências específicas de cada kind e destinos de <code>ns.requirement</code> criam essas relações. Uma direção consistente mantém explícito o grafo resultante. Consulte <a href="#why-this-shape">Por que usar este formato</a>.
</note>

Um slice pequeno pode usar um único `_index.yaml` para suas bibliotecas e seu endpoint. A propriedade importante é a **direção dos imports**, não a quantidade de pastas.

## Vocabulário compartilhado

Três arquivos costumam aparecer na raiz de um slice. Eles contêm definições compartilhadas pelas camadas do slice:

| Arquivo | Contém | Capacidades |
|------|-------|--------------|
| `consts.lua` | Máquinas de estado, enums, níveis de fila e IDs de registro de processos. Os valores que espelham as restrições `CHECK` do banco de dados. | nenhuma |
| `config.lua` | Opções ajustáveis por ambiente com um helper que aplica um valor padrão no código somente quando `env.get(KEY)` retorna `errors.NOT_FOUND` e propaga erros de permissão ou do backend. Nenhuma entrada `env.variable` é necessária para um valor opcional. | `env` |
| `types.lua` | Formatos de entidades (`type Job = { ... }`) — as linhas retornadas pela camada de persistência. | nenhuma |

`consts` e `types` não declaram **nenhuma capacidade do host**; são entradas `library.lua` puras que retornam uma tabela. Manter o vocabulário do domínio livre de I/O também permite testá-lo sem banco de dados nem host de processos.

Mantenha esse vocabulário **privado ao slice**. Coloque constantes e tipos compartilhados entre slices em um namespace pai comum e importe-os, em vez de copiá-los.

## Capacidades por camada

Entradas Lua declaram módulos não ambientes em `modules:` e dependências apoiadas pelo registro em `imports:`. Um slice em camadas pode manter essas dependências alinhadas à responsabilidade:

- `persist/*` declara `sql`, mantendo o acesso ao banco de dados na camada de persistência.
- `service/*` mantém a orquestração de processos e as dependências de serviço na camada de serviço. Os globais `process` e `channel` são ambientes e não precisam ser declarados em `modules:`.
- `api/*` declara módulos como `http` e importa as funções ou bibliotecas que chama.
- O vocabulário da raiz não precisa de módulos não ambientes nem de imports de infraestrutura.

Isso limita a visibilidade de módulos a uma camada conhecida. Não se trata de uma concessão de autorização: políticas ABAC decidem, de forma independente, se operações protegidas como `db.get` são permitidas em tempo de execução. Para revisar o código que pode solicitar um handle de banco de dados, inspecione `persist/`, seus módulos declarados e as políticas associadas ao contexto de execução.

## Aplicações e componentes

O mesmo formato pode sustentar uma aplicação única ou uma biblioteca publicada; a diferença é **quem fornece suas dependências**.

Uma **aplicação** é o grafo implantável de nível superior. Ela possui a infraestrutura concreta — o `http.service`, o `process.host`, a conexão com o banco de dados — sob um namespace raiz (por convenção, `app`) e conecta tudo por conta própria.

Um **componente** é um módulo publicável montado em um host. Como ele não conhece os IDs do banco de dados ou do roteador do host, declara uma interface de entradas `ns.requirement` que o host fornece. Internamente, o componente pode usar as mesmas camadas, o mesmo vocabulário e a mesma direção de imports de um slice de aplicação.

São dois pontos de um espectro:

- **Aplicação única, slices internos** — os slices residem em `src/app/` e compartilham diretamente a infraestrutura da aplicação, referenciando `app:db` e `app:processes`. Nenhuma interface de requirements é necessária porque nada externo os monta.
- **Composição com vários componentes** — cada componente é seu próprio módulo publicável, com uma `ns.definition` e uma interface de `ns.requirement`, composto por um host por meio de `ns.dependency`. O host preenche cada requirement (banco de dados, host de processos, roteador) uma vez.

Escolha conforme o slice será **consumido por um host que você não controla**. Componentes reutilizáveis precisam de uma interface de requirements; slices internos podem referenciar diretamente a infraestrutura da aplicação. O empacotamento muda com o reúso, enquanto as camadas internas podem permanecer iguais.

Consulte [Construindo Componentes](guides/components.md) para o mecanismo de requirement/dependency e [Gerenciamento de Dependências](guides/dependency-management.md) para o arquivo de lock.

## Por que usar este formato :id=why-this-shape

Esta estrutura favorece a composição, a revisão de capacidades e a análise da ordem de boot:

**Os destinos de requirements são o ponto de injeção.** Namespaces distintos tornam os IDs de destino legíveis, mas é `ns.requirement.targets` que realiza a injeção. Um host pode fornecer um ID de banco de dados às entradas de persistência e um ID de host de processos às entradas de serviço. Referenciar diretamente `app:db`, por outro lado, acopla o componente a essa convenção do host.

**Referências unidirecionais mantêm as transições do registro resolvíveis.** O registro extrai os caminhos de dependência declarados e ordena topologicamente as mudanças, criando as dependências antes de seus dependentes e removendo-as depois deles. A direção `api → service → persist → root` ajuda a manter o grafo acíclico. Um namespace pai é apenas uma convenção organizacional; as entradas compartilhadas ainda precisam de referências explícitas.

**Módulos com escopo por camada têm um limite claro.** Cada chunk Lua pode resolver seus imports declarados e módulos não ambientes; módulos de registro não declarados falham de forma fechada durante a resolução. As verificações de política em tempo de execução continuam sendo um limite separado. Quando somente as entradas de persistência declaram `sql`, fica mais fácil identificar e auditar o código que pode solicitar um handle de banco de dados.

**As camadas favorecem diferentes escopos de teste.** O vocabulário pode ser testado sem infraestrutura. Testes de persistência podem usar um banco de dados sem iniciar workers. Um **teste de montagem** do módulo inteiro verifica então os pontos de integração: se cada serviço supervisionado aponta para um processo, se cada ID iniciado por spawn é resolvido e se cada requirement foi preenchido.

## Consulte também

- [YAML e Estrutura do Projeto](start/structure.md) — formato de arquivo, nomenclatura e namespaces
- [Construindo Componentes](guides/components.md) — `ns.definition`, `ns.requirement` e montagem
- [Gerenciamento de Dependências](guides/dependency-management.md) — arquivos de lock e consumo de módulos
- [Registro](concepts/registry.md) — como as entradas são armazenadas e resolvidas
- [Guia de Tipos de Entrada](guides/entry-kinds.md) — todos os tipos de entrada
- [Modelo de Processos](concepts/process-model.md) — serviços, supervisão e hosts
