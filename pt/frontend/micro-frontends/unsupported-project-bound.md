---
title: "Módulos Vinculados a Projeto Não Suportados"
description: "Aviso avançado para módulos que abandonam intencionalmente a portabilidade de frontend do Wippy."
---

# Módulos Vinculados a Projeto Não Suportados

O contrato de frontend suportado do Wippy é portável. Um módulo que intencionalmente exige CSS privado de facade do projeto, classes privadas ou outra suposição de frontend específica do deploy é `UNSUPPORTED`.

Esta não é uma exceção normal:

- A conformidade padrão retorna exatamente `UNSUPPORTED`.
- O CI padrão falha.
- Reuso, portabilidade de tema, upgrades e suporte não são garantidos.
- O dono do módulo é responsável por cada facade consumidora e por cada migração.

Não rotule este modo como "desencorajado", "parcialmente conforme" ou "não conforme mas aceito". O status canônico é `UNSUPPORTED`.

O modo vinculado a projeto é apenas para uso avançado e não é apresentado no Quickstart nem nas receitas padrão. Ele não pode dispensar requisitos de acessibilidade, validade de HTML, segurança ou schema do backend.

O fato de um projeto inteiro ser destinado a um único deploy não relaxa o contrato silenciosamente. O status não suportado precisa ser explícito na política do projeto e nos metadados do módulo, com a falha padrão de CI tratada deliberadamente fora do fluxo de conformidade suportado do Wippy.

Declare o status no `wippy-fe.contract.json` na raiz do módulo com exatamente o
campo e o valor abaixo:

```json
{
  "portability": "project-bound"
}
```

`mode` e outros aliases não são aceitos. Esse marcador faz o comando padrão de
conformidade retornar `UNSUPPORTED` e sair com falha; ele não concede uma
isenção.
