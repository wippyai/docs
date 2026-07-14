---
title: O que é o Wippy - Conceitos e visão geral do runtime
description: Entenda como o Wippy funciona antes de instalar. Cobre o modelo de atores, o registro, workflows duráveis e por que o sistema foi projetado para mudar enquanto está em execução.
---

# Sobre o Wippy

Wippy é um runtime de modelo de atores de código aberto para software que precisa mudar enquanto está em execução: sistemas de automação, agentes de IA, arquiteturas de plugins e aplicações similares onde o núcleo é projetado uma vez e depois adaptado repetidamente sem reconstruir ou reimplantar.

Para uma visão completa do produto, incluindo o que o Wippy substitui, o que ele não é e quem o constrói, consulte a [página About](https://wippy.ai/about).

A base é o modelo de atores. O código executa em processos isolados que se comunicam através de mensagens, cada um gerenciando seu próprio estado. Quando algo falha, falha de forma isolada. Árvores de supervisão tratam a recuperação automaticamente, reiniciando processos quando eles travam.

```lua
local worker = process.spawn("app.workers:handler", "app:processes")
process.send(worker, "task", {id = 1, data = payload})
process.monitor(worker)
```

A configuração reside em um registro central que propaga mudanças como eventos. Atualize um arquivo de configuração, e os processos em execução recebem as alterações. Eles se adaptam sem reiniciar. Novas conexões, comportamento atualizado, o que você precisar, enquanto o sistema continua rodando.

```lua
local db = registry.get("app.db:postgres")
local cache = registry.get("app.cache:redis")
```

Para operações que devem sobreviver a falhas de infraestrutura, o runtime persiste o estado automaticamente: fluxos de pagamento, workflows de múltiplas etapas e tarefas de agentes de longa duração. O servidor morre no meio da operação? O workflow retoma em outra máquina, exatamente de onde parou.

O sistema inteiro roda a partir de um único arquivo. Sem containers para orquestrar, sem serviços para coordenar. Um binário, uma configuração, e o runtime cuida do resto.

Para a história completa de por que o Wippy foi construído, consulte [Why We Built Wippy](https://wippy.ai/about#why-we-built-wippy).
