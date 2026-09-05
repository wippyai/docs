---
title: "Keeper sobre MCP"
description: "O Wippy Keeper é o plano de controle de uma aplicação Wippy em execução — uma bancada de trabalho do registro, governança sistema de arquivos↔registro, orquestração de agentes/tarefas, instalação do Hub, base de conhecimento…"
---

# Keeper sobre MCP

O Wippy Keeper é o plano de controle de uma aplicação Wippy em execução — uma bancada de
trabalho do registro, governança sistema de arquivos↔registro, orquestração de agentes/tarefas,
instalação do Hub, base de conhecimento, logs e inspeção de processos, e um fluxo de revisão/push
com Git, tudo por trás de uma UI integrada. Sua característica definidora é expor essas
capacidades de operador a clientes de IA (Claude, Codex, …) sobre **MCP (Model Context
Protocol)**. Esta página adiciona o Keeper a uma aplicação e conecta um cliente MCP a ele.

## O Que Você Vai Construir

1. Keeper adicionado a uma aplicação criada a partir do `app-template`.
2. A UI do Keeper em `/app/keeper` e o endpoint MCP em `/keeper-mcp/`.
3. Um token MCP com escopo, e um cliente MCP configurado para conduzir a aplicação através do Keeper.

## Pré-requisitos

- Uma aplicação a partir do [app-template](https://github.com/wippyai/app-template). Ela já
  fornece tudo a que o Keeper se vincula: `app:gateway`, `app:api`, `app:db`,
  `app:processes`, `app.security:admin` e `app.env:store`.
- O módulo Keeper instalado:

  ```bash
  wippy add keeper/keeper
  wippy install
  ```

## Adicionar o Keeper

Declare a dependência e vincule-a aos recursos da aplicação. Apenas `admin_scope` é
obrigatório (sem padrão); os demais assumem por padrão os nomes que o `app-template` já usa, mostrados
aqui explicitamente para maior clareza:

```yaml
# src/app/deps/_index.yaml
- name: keeper
  kind: ns.dependency
  component: keeper/keeper
  version: '>=v0.5.18'
  parameters:
    - { name: app_db,         value: app:db }
    - { name: admin_scope,    value: app.security:admin }
    - { name: env_storage,    value: app.env:store }
    - { name: public_gateway, value: app:gateway }   # hospeda /keeper-mcp/
    - { name: mcp_route,      value: /keeper-mcp/ }
    - { name: ui_server,      value: app:gateway }
    - { name: process_host,   value: app:processes }
```

Inicie a aplicação:

```bash
wippy run
```

O Keeper monta automaticamente três superfícies:

- **UI** — `/app/keeper`
- **Transporte MCP** — `/keeper-mcp/` no gateway público
- **API de tokens** — em `app:api` (`/keeper/mcp/tokens`, `/keeper/mcp/scopes`)

O transporte MCP é controlado pela variável de ambiente `MCP_ENABLED` (padrão `true`);
defina-a como `false` para fechar o endpoint.

## Emitir um Token MCP

Tokens são emitidos por um usuário admin, têm escopo e são exibidos exatamente uma vez. Crie um via a
API de tokens (ou pela página MCP na UI do Keeper):

```bash
curl -X POST http://localhost:8080/api/v1/keeper/mcp/tokens \
  -H 'Authorization: Bearer <admin-session-token>' \
  -H 'Content-Type: application/json' \
  -d '{"label": "claude-dev", "preset": "developer"}'
# -> { "success": true, "token": { "token": "wkmcp_<64 hex>", ... } }
```

`preset` agrupa um conjunto de escopos. Presets disponíveis: `root`, `developer`,
`wippy_operator`, `observer`, `knowledge_manager`, `explorer_tools_only`. Para
controle mais fino, passe um array `scopes` explícito em vez disso (por exemplo, `registry.read`,
`state.write`, `git.pr`, `tasks.run`, `knowledge.read`). O token bruto `wkmcp_...` é
retornado uma única vez e armazenado apenas como hash — copie-o imediatamente.

## Conectar um Cliente

Aponte um cliente MCP para o endpoint com o token como header bearer. Para Claude Code /
Codex, um `.mcp.json` na raiz do projeto:

```json
{
  "mcpServers": {
    "keeper": {
      "type": "http",
      "url": "http://localhost:8080/keeper-mcp/",
      "headers": { "Authorization": "Bearer wkmcp_<token>" }
    }
  }
}
```

Use a URL base pública da aplicação no lugar de `http://localhost:8080` em um ambiente
implantado.

## Como Funciona a Superfície MCP

O Keeper não expõe uma lista de ferramentas plana e fixa. Ele apresenta algumas **meta-ferramentas** mais
**traits** que ativam ferramentas concretas sob demanda, de modo que a superfície permanece pequena até você
optar por uma capacidade:

- `session_info` — sempre disponível; informa os escopos da sessão e as traits ativas.
- `list_traits` / `describe_trait` — descubra o que está disponível.
- `use_trait` / `drop_trait` (e `set_traits`) — ative ou remova uma trait; isso emite
  uma `notifications/tools/list_changed` do MCP, de modo que as ferramentas visíveis mudam ao vivo.
- `list_tools` — enumere as ferramentas que uma trait materializou, com seus schemas.
- `call_tool` — invoque qualquer ferramenta do registry pelo id; visível apenas para um token
  que possua `mcp.root`.

O que um token pode ativar é limitado pelos seus **escopos** — grosso modo `registry.*`,
`state.*`, `hub.*`, `knowledge.*`, `git.*`, `components.*`, `tasks.*`, `agents.*`,
`tests.run`, `logger.*`, `env.*`, `functions.call`, `app.ui` (mais `mcp.root` para bypass
total de admin). O `access_mode` do token (`any` / `traits` / `tools_only`) restringe ainda mais
como ele pode chamar ferramentas.

## Notas

- **Escopo de governança** — defina `GOV_MANAGED_NAMESPACES=app` para que a sincronização
  sistema de arquivos↔registro do Keeper governe apenas o namespace da sua aplicação. Não adicione `keeper`,
  `wippy` ou `userspace` a menos que você esteja desenvolvendo esses módulos.
- **Segurança** — tokens são vinculados à identidade admin emissora e a um conjunto de escopos, armazenados
  como SHA-256 e revogáveis via `POST /keeper/mcp/tokens/revoke`. A rota `/keeper-mcp/`
  não executa middleware de autenticação; o próprio handler impõe o token bearer.
- **Aplicação de referência** — `app-keeper` é o exemplo prático que integra o Keeper a um
  shell de aplicação; copie o bloco `src/app/deps/_index.yaml` dele se quiser uma configuração comprovadamente boa.

## Próximos Passos

- [Hello World](tutorials/hello-world.md) — o layout mínimo de projeto
- [Autenticação](tutorials/auth.md) — a identidade admin que emite tokens
- [Agentes](framework/agents.md) — os agentes e ferramentas que as traits do Keeper expõem
