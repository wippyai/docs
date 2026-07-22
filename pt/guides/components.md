---
title: "Construindo Componentes"
description: "Criando módulos reutilizáveis: declarando interfaces de requirements com ns.requirement e como os hosts fornecem valores através de parâmetros de dependência."
---

# Construindo Componentes

Um **componente** é um módulo Wippy reutilizável — um slice de funcionalidade publicado no hub e montado em uma aplicação host. O desafio que um componente enfrenta é que ele não pode nomear as coisas de que depende: ele precisa de *um* banco de dados, *um* host de processos, *um* roteador, mas não sabe quais o host lhe dará. O Wippy resolve isso com uma **interface de requirements** — o componente declara buracos, o host os preenche.

Este guia cobre o lado do autor: declarar essa interface e entender como os valores fluem para as suas entradas. Para o lado do consumidor (arquivos de lock, restrições de versão, `wippy add`/`update`) veja [Gerenciamento de Dependências](guides/dependency-management.md). Para como um componente é estruturado internamente veja [Arquitetura de Aplicações](concepts/architecture.md).

## Os três tipos

| Tipo | Lado | Papel |
|------|------|------|
| `ns.definition` | componente | Metadados do módulo; obrigatório para publicar. |
| `ns.requirement` | componente | Um buraco que o host deve preencher, e onde injetar o valor. |
| `ns.dependency` | host | Monta um componente e fornece valores para seus requirements. |

## ns.definition

Um por módulo, obrigatório para publicação. Carrega o nome de exibição do módulo e o caminho do README — nada mais.

```yaml
- name: definition
  kind: ns.definition
  module: jobs                # optional; defaults to the entry name
  readme: file://README.md    # path to the module's documentation
  meta:
    title: Durable Jobs
    description: Leased job queue with retry and dead-lettering.
```

Apenas `module` e `readme` são dados do componente; `meta` é metadado comum de entrada para UIs de gestão. Notas de release são fornecidas no momento da publicação, não aqui.

## ns.requirement

Um requirement é um **buraco nomeado com uma lista de alvos de injeção**. O host fornece um valor; o runtime escreve esse valor em cada entrada alvo no caminho dado.

```yaml
- name: target_db
  kind: ns.requirement
  meta:
    description: SQL database backing every table in this module.
  default: app:db
  targets:
    - entry: app.jobs.migrations:schema
      path: .meta.target_db
    - entry: app.jobs.persist:lifecycle
      path: .db
```

### default — obrigatório vs opcional

O campo `default` decide se o host *deve* fornecer um valor:

- **`default` presente** (qualquer valor, inclusive string vazia) → o requirement é **opcional**. Se o host não fornecer nada, o default é usado.
- **`default` ausente** → o requirement é **obrigatório**. Sem nada fornecido, o linking falha sob modo estrito (e emite aviso caso contrário).

<note>
Um default explicitamente vazio (<code>default: ""</code>) é distinto de nenhum default. String vazia significa "opcional, recai em nada"; ausente significa "o host deve fornecer isto." Use um default para infraestrutura que tem uma convenção interna sensata (<code>app:db</code>, <code>app:processes</code>); omita-o para valores que só o host pode conhecer.
</note>

### targets — onde o valor aterrissa

Cada alvo é um par `{entry, path}`:

- **`entry`** — a entrada na qual o valor é injetado. Um nome simples (`schema`) resolve dentro do namespace do próprio requirement; um id totalmente qualificado (`app.jobs.migrations:schema`) mira exatamente aquela entrada, entre namespaces.
- **`path`** — um caminho com pontos dentro da entrada alvo, p. ex. `.meta.target_db`, `.host`, `.database.url`. O ponto inicial é convencional.

Um requirement sem alvos é um erro — um buraco que não injeta em lugar nenhum não tem sentido.

Anexe em vez de definir com o sufixo `+=` no caminho — útil quando vários requirements contribuem para uma mesma lista (p. ex. middleware):

```yaml
targets:
  - entry: app.api:router
    path: .middleware+=     # appends the value to the list at .middleware
```

### Um requirement, muitos alvos

Agrupe tudo o que precisa do mesmo valor sob um único requirement. Este é o padrão idiomático: um requirement `target_db` injetando no `.meta.target_db` de cada migração e no `.db` de cada biblioteca de persistência, um `process_host` injetando no `.host` de cada `service` supervisionado, um `api_router` injetando no `.meta.router` de cada endpoint:

```yaml
- name: process_host
  kind: ns.requirement
  default: app:processes
  targets:
    - { entry: app.jobs.service:worker.service, path: .host }
    - { entry: app.jobs.service:sweeper.service, path: .host }
```

O host preenche um buraco; o runtime distribui o valor para cada alvo. Nada é espelhado em uma entrada de configuração paralela — a entrada de requirement *é* a fiação.

## Consumindo um componente

O host monta um componente com `ns.dependency` e preenche seus requirements através de `parameters`:

```yaml
version: "1.0"
namespace: app
entries:
  - name: dep.jobs
    kind: ns.dependency
    component: acme/jobs
    version: "^1.0.0"
    parameters:
      - name: target_db
        value: app:db
      - name: process_host
        value: app:processes
      - name: api_router
        value: app:api
```

Cada `parameter.name` corresponde a um requirement; seu `value` é o que é injetado nos alvos daquele requirement. Requirements com default podem ser omitidos; os obrigatórios devem ser fornecidos.

### Correspondência de nomes de parâmetros

Como um nome de parâmetro se vincula a um requirement:

- **Nome simples** (`target_db`) corresponde a um requirement com esse nome pertencente ao componente sendo montado. Não cruza para os requirements de um módulo diferente.
- **Nome qualificado** (`acme.jobs:target_db`) corresponde exatamente a esse id de requirement. Use-o para desambiguar ao ligar dependências transitivas.

Se duas dependências fornecem valores **diferentes** para o mesmo requirement, isso é um conflito e é reportado (valores idênticos são aceitáveis).

## Quando os valores resolvem

A injeção acontece no **estágio Link** do pipeline de build — na publicação, durante a expansão de dependências e no boot — não em tempo de execução. O estágio:

1. Coleta cada `ns.requirement` e cada `ns.dependency` com seus parâmetros.
2. Para cada requirement, resolve um valor: um parâmetro correspondente vence; caso contrário o default; caso contrário (sem default) fica não resolvido.
3. Escreve o valor resolvido em cada entrada alvo no seu caminho (definição, ou anexação para `+=`).

Sob **requirements estritos** um requirement obrigatório não resolvido falha o build; caso contrário registra um aviso e prossegue. Quando as entradas chegam ao runtime, cada requirement preenchido já foi gravado nos seus alvos.

## Verifique as costuras: um teste de montagem

Testes unitários exercitam um slice em isolamento; eles não conseguem ver se o módulo *montado* é coerente. Adicione um teste de empacotamento/montagem que audite o módulo como um todo contra o registro vivo, com requirements injetados:

- cada `service` supervisionado aponta para uma entrada de processo que existe,
- cada id iniciado via spawn ou agendado resolve para uma entrada real,
- o armazenamento de cada `env.variable` está registrado.

Estas são as costuras de integração que as suítes unitárias isoladas mascaram — as brechas que deixam um supervisor referenciar um worker que nunca foi registrado, ou um fixture de teste vazar um id de armazenamento exclusivo do harness para um boot montado. Veja [Supervisão](guides/supervision.md) e o framework de [Testes](framework/testing.md).

## Veja Também

- [Arquitetura de Aplicações](concepts/architecture.md) — como um componente é estruturado internamente
- [Gerenciamento de Dependências](guides/dependency-management.md) — arquivos de lock, versões, o fluxo do consumidor
- [Publicando Módulos](guides/publishing.md) — colocando um componente no hub
- [Guia de Tipos de Entradas](guides/entry-kinds.md) — referência de `ns.definition`, `ns.requirement`, `ns.dependency`
