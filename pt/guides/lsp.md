---
title: "Servidor de Linguagem"
description: "Configure o servidor Language Server Protocol integrado do Wippy para recursos de edição Lua por TCP ou HTTP."
---

# Servidor de Linguagem

O Wippy inclui um servidor LSP (Language Server Protocol) integrado que fornece recursos de IDE para codigo Lua. O servidor e executado como parte do runtime do Wippy e se conecta a editores via TCP ou HTTP.

## Recursos

- Autocompletar com sugestoes baseadas em tipos
- Informacoes ao passar o mouse mostrando tipos e assinaturas
- Ir para definicao
- Encontrar referencias
- Simbolos de documento e workspace
- Hierarquia de chamadas (chamadas de entrada e saida)
- Diagnosticos em tempo real (erros de parse, erros de tipo)
- Ajuda de assinatura para parametros de funcao

## Configuracao

Habilite o servidor LSP em `.wippy.yaml`:

```yaml
lsp:
  enabled: true
  address: ":7777"
```

### Campos de Configuracao

| Campo | Padrao | Descricao |
|-------|--------|-----------|
| `enabled` | false | Habilitar o servidor TCP |
| `address` | :7777 | Endereco de escuta TCP |
| `http_enabled` | false | Habilitar o transporte HTTP |
| `http_address` | :7778 | Endereco de escuta HTTP |
| `http_path` | /lsp | Caminho do endpoint HTTP |
| `http_allow_origin` | * | Origem permitida para CORS |
| `max_message_bytes` | 8388608 | Tamanho maximo de mensagem recebida (bytes) |

### Transporte TCP

O servidor TCP utiliza JSON-RPC 2.0 com enquadramento de mensagens LSP padrao (cabeçalhos Content-Length). Este e o transporte principal para integracoes com editores.

### Transporte HTTP

O transporte HTTP aceita requisições POST com payloads JSON-RPC. Ele oferece suporte a editores no navegador e ferramentas web, responde a requisições preflight CORS `OPTIONS` e inclui cabeçalhos CORS para acesso entre origens.

```yaml
lsp:
  enabled: true
  http_enabled: true
  http_address: ":7778"
  http_path: "/lsp"
  http_allow_origin: "*"
```

## Esquema de URI de Documento

O servidor LSP utiliza o esquema de URI `wippy://` para identificar entradas do registro:

```
wippy://namespace:entry_name
```

Os editores mapeiam essas URIs para IDs de entrada no registro. Tanto o formato com esquema `wippy://` quanto o formato simples `namespace:entry_name` sao aceitos.

## Indexacao

O servidor LSP mantem um indice de todas as entradas de codigo para buscas rapidas. A indexacao acontece em segundo plano usando multiplos workers.

Comportamentos principais:

- Entradas sao indexadas em ordem de dependencia (dependencias primeiro)
- Alteracoes disparam reindexacao das entradas afetadas
- Alteracoes nao salvas no editor sao armazenadas em um overlay
- O indice e incremental - apenas entradas alteradas sao reprocessadas

## Metodos LSP Suportados

| Metodo | Descricao |
|--------|-----------|
| `initialize` | Negociacao de capacidades |
| `initialized` | Notificação de conclusão da inicialização |
| `shutdown` | Encerrar a sessão do protocolo |
| `exit` | Notificação de saída |
| `textDocument/didOpen` | Rastrear documentos abertos |
| `textDocument/didChange` | Sincronizacao completa do documento |
| `textDocument/didClose` | Liberar documentos |
| `textDocument/hover` | Informacao de tipo na posicao do cursor |
| `textDocument/definition` | Ir para definicao |
| `textDocument/references` | Encontrar todas as referencias |
| `textDocument/completion` | Autocompletar codigo |
| `textDocument/signatureHelp` | Assinaturas de funcao |
| `textDocument/diagnostic` | Diagnosticos do arquivo |
| `textDocument/documentSymbol` | Simbolos do arquivo |
| `workspace/symbol` | Busca global de simbolos |
| `textDocument/prepareCallHierarchy` | Hierarquia de chamadas |
| `callHierarchy/incomingCalls` | Encontrar chamadores |
| `callHierarchy/outgoingCalls` | Encontrar chamados |

## Autocompletar

O mecanismo de autocompletar resolve tipos atraves do grafo de codigo. Ele fornece:

- Autocompletar membros apos `.` e `:` (campos, metodos)
- Autocompletar variaveis locais
- Autocompletar simbolos a nivel de modulo
- Caracteres de disparo: `.`, `:`

## Diagnosticos

Os diagnosticos sao calculados durante a indexacao e incluem:

- Erros de parse (problemas de sintaxe)
- Erros de verificacao de tipos (incompatibilidades, simbolos indefinidos)
- Niveis de severidade: error, warning, information, hint

Notificações de alteração do documento completo atualizam o overlay usado para diagnósticos. Os clientes obtêm o resultado armazenado atual com `textDocument/diagnostic`; este servidor não envia notificações `textDocument/publishDiagnostics`. Uma falha de parsing interrompe a reindexação antes que novos diagnósticos sejam armazenados, de modo que o resultado obtido não relata esse erro de sintaxe e pode manter o último resultado bem-sucedido.

## Veja Tambem

- [Linter](guides/linter.md) - Verificacao de codigo via CLI
- [Tipos](lua/types.md) - Documentacao do sistema de tipos
- [Configuracao](guides/configuration.md) - Configuracao do runtime
