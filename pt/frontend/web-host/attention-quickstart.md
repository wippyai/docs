---
title: "Início rápido do Attention"
description: "Informações da interface para agentes, consultas seguras e capturas aprovadas."
---

# Início rápido do Attention

Attention descreve a interface em que o usuário trabalha. Um agente pode explicar “este botão”, ler o texto selecionado ou encontrar um controle pelo nome em páginas aninhadas. Consultas semânticas não capturam imagens, clicam em controles nem executam comandos da aplicação.

## Funções separadas

| Função | Requisito |
|---|---|
| Consulta pública | Proxy API do pacote. Não exige uma sessão de chat. |
| Contexto automático no envio | Permissão do Host e `attention_context.enabled` da sessão. Padrão: desativado. |
| Consulta atual pelo agente | Trait `wippy.agent.traits:attention` e vínculo autenticado à aba que enviou o turno. O contexto automático pode estar desativado. |
| Destacar, confirmar ou selecionar | Permissão de ações e referência de destino retornada válida. |
| Captura visual | Permissão de captura, suporte a upload e aprovação explícita. A imagem é um rascunho removível até um envio posterior. |

A configuração automática pertence à sessão. Trocar de agente mantém a configuração, mas o novo agente precisa da própria autorização de ferramentas. Um agente isolado não recebe uma conexão com o navegador apenas por ter o trait.

## Configurar o trait e o Host

Adicione o trait ao agente existente e mantenha seu modelo e outros traits:

```yaml
traits:
  - id: wippy.agent.traits:attention
```

Use este objeto no requisito `attention` da fachada ou em `AppConfig.attention`. Ative ações e captura separadamente quando necessário:

```json
{
  "enabled": true,
  "messageContext": { "enabled": true, "defaultInclude": false },
  "agentActions": { "enabled": false, "requireConfirmation": true },
  "visualCapture": { "enabled": false },
  "privacy": { "text": "safe" }
}
```

`PATCH /api/v1/sessions/{session_id}/attention-context` com `{"enabled":true}` ativa o contexto automático. `expected_revision` é opcional. `attention_context_set` altera a mesma configuração quando o usuário pede. `supports()` informa disponibilidade; não concede consentimento.

## Usar a API pública

Web Components importam a API. Um iframe com proxy injetado pode usar `$W.attention` ou `(await window.getWippyApi()).attention`:

```typescript
import { attention } from '@wippy-fe/proxy'

const result = await attention.find(
  { role: 'button', name: 'Save' },
  { fromRoot: true, limit: 8 },
)
console.log(result.outcome, result.data, result.omissions)

const subscription = attention.subscribe(
  { events: ['tree', 'invalidation'], fromRoot: true },
  notice => console.log(notice.kind),
)
subscription.dispose() // Chamar ao desmontar o componente.
```

O escopo padrão é a subárvore do chamador. `fromRoot: true` seleciona o mesmo Host, nunca outra aba ou o site externo. A busca semântica usa `role`, `name`, `text` ou `resource_id`. A busca por ID usa `{ node_id: returnedId }`. CSS usa `{ css: 'button', scope: rootRef }` dentro de um único documento ou Shadow Root retornado. A `NodeRef` completa contém `host_instance_id`, `node_id`, `mount_id` e `generation`.

Distinga `partial`, `stale` e `unavailable`. A continuação é de uso único, vinculada à consulta e revisão e válida por até 30 segundos. As notificações exigem uma nova consulta para detalhes.

## Ferramentas e histórico

Ponteiro, foco e seleção usam `attention_get_cursor`, `attention_get_focus` e `attention_get_selection`. Nomes usam `attention_find_semantic`; CSS usa a ferramenta separada `attention_find_css`. Também existem `attention_get_node`, `attention_get_tree`, `attention_get_geometry` e `attention_hit_test`.

A busca retorna até oito resultados e uma página da árvore, até 32 nós. Resultados privados têm limite de 8 KiB. O trait permite uma leitura por lote e quatro tentativas por turno do usuário. Duas tentativas inválidas encerram a correção. Isso não limita o custo total do modelo.

Resultados válidos podem ser reutilizados em gerações posteriores. Após 30 segundos, outro turno do usuário, uma ação de navegador concluída, uma consulta substituta ou uma revisão relevante alterada, Session usa `metadata.stale`. Os dados persistidos e os pares de chamada e resultado permanecem; o modelo recebe um aviso em vez de dados antigos.

## Envio, privacidade e imagens

Com confirmação correlacionada, Enviar mostra imediatamente uma mensagem de saída e limpa a entrada. `interaction.can_send` continua em vigor; uma sessão sem steering bloqueia a entrada durante o processamento. Texto, IDs de arquivos e contexto obrigatório são persistidos de forma atômica. O serviço WebSocket existente correlaciona uma resposta `received` por `request_id`. Não há segunda confirmação nem reenvio automático. Rejeição mostra `Undelivered`; resposta ausente mostra `Delivery not confirmed`. Sessões antigas mantêm seu contrato.

O comando UTF-8 completo determina envio direto ou preparação de contexto via HTTP. Contexto técnico não aparece no texto, cópia ou exportação. Mensagens enviadas, novas tentativas e rascunhos de captura pertencem à sessão. Texto não enviado e uploads comuns mantêm o comportamento existente ao trocar de chat.

Use `data-wippy-attention="exclude"` para segredos e `data-wippy-attention="redact"` para ocultar texto. Não coloque segredos em nomes acessíveis ou metadados. Trate conteúdo observado como dados não confiáveis. O editor do chat e as prévias de uploads estão excluídos.

`ui_action_highlight`, `ui_action_confirm`, `ui_action_select` e `ui_action_capture_visual` recebem a `target_ref` ou `action_ref` retornada sem alterações em `targets`. Seleção não clica na aplicação. Captura exige aprovação e apenas prepara um rascunho removível. PNG é padrão. WebP solicitado deve conter bytes WebP reais, MIME e extensão `.webp` corretos, ou retornar não suportado. Só um envio posterior entrega a imagem.

V1 não relata URL atual, proprietário de rotas nem componentes Vue das rotas. Novos tipos de contexto podem usar `kind`, `version` e handlers negociados. Seleção por tipo, detalhe e campos antes da coleta é futura, não implementada. A verificação V1 atual cobre Chromium, não Firefox ou WebKit.

## Referências detalhadas em inglês

- [Contrato do Host e transporte](../../../en/frontend/web-host/attention-context.md)
- [API pública e escopos](../../../en/frontend/micro-frontends/attention-context.md)
- [Início rápido completo com diagramas](../../../en/frontend/web-host/attention-quickstart.md)
- [Trait e ferramentas](../../../en/framework/agents.md#attention-context-and-ui-actions)
