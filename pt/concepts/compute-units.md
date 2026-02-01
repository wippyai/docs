# Unidades de Computacao

O Wippy fornece tres formas de executar codigo: funcoes, processos e workflows. Eles compartilham a mesma maquinaria subjacente, mas diferem em quanto tempo vivem, onde seu estado vai, e o que acontece quando as coisas falham.

## Funcoes

Funcoes sao o modelo mais simples. Voce as chama, elas executam, elas retornam um resultado. Nenhum estado persiste entre chamadas.

```lua
local result = funcs.call("app.math:add", 2, 3)
```

Funcoes executam no contexto do chamador. Se o chamador cancela ou termina, quaisquer funcoes em execucao sao canceladas tambem. Isso mantem as coisas simples - voce nao precisa pensar em limpeza.

<tip>
Use funcoes para handlers HTTP, transformacoes de dados, e qualquer coisa que deva completar rapidamente e retornar um resultado.
</tip>

## Processos

Processos sao atores. Eles mantem estado atraves de multiplas mensagens, executam independentemente de quem os iniciou, e se comunicam atraves de passagem de mensagens.

```lua
local pid = process.spawn("app.workers:handler", "app:processes")
process.send(pid, "job", {task = "process_data"})
```

Quando voce cria um processo, ele continua executando mesmo apos seu codigo terminar. Processos podem monitorar uns aos outros, vincular-se juntos, e formar arvores de supervisao que automaticamente reiniciam filhos que falharam.

O agendador multiplexa milhares de processos atraves de um pool de workers. Cada processo cede quando aguarda I/O, permitindo que outros executem.

<tip>
Use processos para jobs em segundo plano, daemons de servico, e qualquer coisa que precise sobreviver ao seu criador ou manter estado atraves de mensagens.
</tip>

## Workflows

Workflows sao para operacoes que absolutamente nao podem falhar. Eles persistem seu estado em um provedor de workflow (Temporal ou outros) e podem retomar exatamente de onde pararam apos crashes, reinicializacoes ou mudancas de infraestrutura.

```lua
-- Isso pode executar por dias, sobreviver a reinicializacoes, e nunca perder progresso
workflow.execute("app.orders:process", order_id)
```

O trade-off e latencia. Cada passo e registrado, entao workflows sao mais lentos que funcoes ou processos. Mas para processos de negocio de multiplas etapas ou orquestracoes de longa duracao, essa durabilidade vale a pena.

<note>
O Wippy trata o determinismo automaticamente para workflows. Voce nao precisa aprender nenhuma tecnica especial - escreva codigo normal e o runtime garante que ele se comporte corretamente durante o replay.
</note>

## Como Eles se Comparam

| | Funcoes | Processos | Workflows |
|---|---|---|---|
| **Estado** | Nenhum | Em memoria | Persistido |
| **Tempo de vida** | Chamada unica | Ate sair ou falhar | Sobrevive a tudo |
| **Comunicacao** | Valor de retorno + mensagens | Passagem de mensagens | Chamadas de atividade + mensagens |
| **Tratamento de falhas** | Chamador trata | Arvores de supervisao | Retry automatico |
| **Latencia** | Mais baixa | Baixa | Mais alta |

## Mesmo Codigo, Comportamento Diferente

Muitos modulos se adaptam ao seu contexto automaticamente. Por exemplo, `time.sleep()` em uma funcao bloqueia o worker, em um processo ele cede para deixar outros executarem, e em um workflow ele registra um timer que e reproduzido corretamente na recuperacao.
