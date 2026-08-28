---
title: "Módulos vinculados ao projeto não compatíveis"
description: "Aviso avançado para módulos que abandonam intencionalmente a portabilidade frontend do Wippy."
---

# Módulos vinculados ao projeto não compatíveis

**Classificação: referência normativa de política.** Ela define o marcador e o resultado exigido para um fluxo de conformidade escolhido pelo projeto; a família pública de pacotes não oferece esse fluxo como CLI executável.

O contrato frontend compatível do Wippy é portável. Um módulo que exige intencionalmente CSS privado da facade do projeto, classes privadas ou outro pressuposto frontend específico da implantação é `UNSUPPORTED`.

Esta não é uma exceção normal. O fluxo de conformidade do projeto deve impor estes resultados:

- A conformidade padrão retorna exatamente `UNSUPPORTED`.
- O CI padrão falha.
- Reutilização, portabilidade de tema, upgrades e suporte não são garantidos.
- O proprietário do módulo é responsável por cada facade consumidora e por cada migração.

Não chame esse modo de “desaconselhado”, “parcialmente compatível” ou “não compatível, mas aceito”. O status canônico é `UNSUPPORTED`.

O modo vinculado ao projeto é apenas para uso avançado e não aparece no Quickstart nem nas receitas padrão. Ele não pode dispensar acessibilidade, validade do HTML, segurança ou requisitos de schema backend.

O fato de um projeto inteiro se destinar a uma única implantação não relaxa silenciosamente o contrato. O status não compatível deve ser explícito na política do projeto e nos metadados do módulo, com a falha do CI padrão tratada deliberadamente fora do fluxo de conformidade compatível do Wippy.

Declare o status no arquivo `wippy-fe.contract.json` da raiz do módulo usando exatamente o campo e o valor abaixo:

```json
{
  "portability": "project-bound"
}
```

`mode` e outros aliases não são aceitos. O fluxo de conformidade deve fazer esse marcador retornar `UNSUPPORTED` e encerrar sem sucesso; ele não concede uma isenção. A família pública de pacotes `@wippy-fe/*` 0.0.56 não inclui uma CLI de conformidade de aplicação, portanto o projeto deve implementar esse gate no fluxo de conformidade escolhido.
