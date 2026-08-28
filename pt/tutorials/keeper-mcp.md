---
title: "Keeper via MCP"
description: "Adicione o Wippy Keeper a uma aplicação, emita um token com escopo e conecte um cliente MCP às ferramentas de operação."
---

# Keeper via MCP

O Wippy Keeper oferece uma interface para operações no registry, governança entre sistema de arquivos e registry, orquestração de tarefas e agentes, instalação pelo Hub, gerenciamento da base de conhecimento, inspeção da runtime e fluxos Git. Ele também expõe capacidades operacionais a clientes compatíveis por meio do Model Context Protocol (MCP). Esta página adiciona o Keeper a uma aplicação e configura uma conexão MCP.

**Classificação: tutorial de integração executável.** A aplicação e o transporte do Keeper são executados localmente. A etapa final exige um cliente MCP compatível com servidores HTTP remotos e headers bearer.

## O que você vai criar

1. O Keeper adicionado a uma aplicação criada com o template de aplicação Wippy.
2. A interface do Keeper em `/c/keeper:main` e o endpoint MCP em `/keeper-mcp/`.
3. Um token MCP com escopo e um cliente MCP configurado para operar a aplicação pelo Keeper.

## Pré-requisitos

- Uma aplicação criada com o [template de aplicação Wippy](https://github.com/wippyai/app). Ele já fornece tudo a que o Keeper se conecta: `app:gateway`, `app:api`, `app:db`, `app:processes`, `app.security:admin` e `app.env:store`.
- Uma conta de administrador ativa nessa aplicação. A emissão de tokens pelo Keeper é vinculada à identidade do administrador autenticado; uma API key genérica não pode emitir um token MCP.

## Adicionar o Keeper

Declare a dependência e conecte-a aos recursos da aplicação. `admin_scope` é obrigatório e não tem padrão. Os outros parâmetros usam por padrão os nomes de entries do template da aplicação, mas o exemplo os informa explicitamente:

```yaml
# src/app/deps/_index.yaml
- name: keeper
  kind: ns.dependency
  component: keeper/keeper
  version: "*"
  parameters:
    - { name: app_db,         value: app:db }
    - { name: admin_scope,    value: app.security:admin }
    - { name: env_storage,    value: app.env:store }
    - { name: public_gateway, value: app:gateway }   # hosts /keeper-mcp/
    - { name: mcp_route,      value: /keeper-mcp/ }
    - { name: ui_server,      value: app:gateway }
    - { name: process_host,   value: app:processes }
```

Resolva a dependência de origem e seu grafo transitivo e inicie a aplicação:

```bash
wippy update
wippy run -c
```

`wippy update` examina os entries de origem, atualiza o lock, resolve dependências transitivas e as instala. `wippy add keeper/keeper` sozinho atualiza apenas o módulo nomeado no lock; ele não resolve esse grafo de dependências declarado na origem.

O Keeper monta três superfícies:

- **Interface** — `/c/keeper:main`
- **Transporte MCP** — `/keeper-mcp/` no gateway público
- **API de tokens** — em `app:api` (`/keeper/mcp/tokens`, `/keeper/mcp/scopes`)

O transporte MCP é controlado pela variável de ambiente `MCP_ENABLED`, cujo padrão é `true`; defina-a como `false` para fechar o endpoint.

## Emitir um token MCP

Os tokens são emitidos por um administrador ativo, têm escopo e são exibidos apenas uma vez.

1. Entre na aplicação como administrador.
2. Abra `/c/keeper:main`, selecione **MCP** e escolha **Create Scoped Token**.
3. Informe um rótulo e escolha um preset. `observer` é a opção inicial mais segura; use `developer` ou `wippy_operator` somente se o cliente precisar executar escritas.
4. Crie o token e copie imediatamente o valor `wkmcp_...` exibido. A interface não poderá mostrar o valor bruto novamente.

A interface também mostra a URL MCP efetiva e trechos de configuração copiáveis. Esse é o fluxo recomendado, pois reutiliza a sessão atual do administrador autenticado.

Para automação, chame a API com o **bearer da sessão de administrador** da mesma aplicação:

```bash
curl -X POST http://localhost:8080/api/v1/keeper/mcp/tokens \
  -H 'Authorization: Bearer <admin-session-token>' \
  -H 'Content-Type: application/json' \
  -d '{"label": "local-observer", "preset": "observer"}'
# -> { "success": true, "token": { "token": "wkmcp_<64 hex>", ... } }
```

`<admin-session-token>` é o bearer emitido pelo fluxo normal de login da aplicação, não o novo token MCP do Keeper. O endpoint rejeita usuários não autenticados, inativos ou que não sejam administradores. `GET /api/v1/keeper/mcp/scopes` retorna o catálogo atual de presets e escopos antes da emissão.

`preset` agrupa um conjunto de escopos. Os presets disponíveis são `root`, `developer`, `wippy_operator`, `observer`, `knowledge_manager` e `explorer_tools_only`. Para controle mais fino, informe um array `scopes`, por exemplo `registry.read`, `state.write`, `git.pr`, `tasks.run` e `knowledge.read`. O token bruto `wkmcp_...` é retornado uma única vez e armazenado somente como hash; copie-o imediatamente.

## Conectar um cliente

Aponte um cliente MCP para o endpoint e envie o token como bearer. Para manter o token fora de configurações versionadas, exporte-o primeiro:

```bash
export KEEPER_MCP_TOKEN='wkmcp_<token>'
```

No Claude Code, use um `.mcp.json` no escopo do projeto:

```json
{
  "mcpServers": {
    "keeper": {
      "type": "http",
      "url": "http://localhost:8080/keeper-mcp/",
      "headers": { "Authorization": "Bearer ${KEEPER_MCP_TOKEN}" }
    }
  }
}
```

O Claude Code expande `${KEEPER_MCP_TOKEN}` a partir do ambiente ao carregar a configuração do projeto. Reinicie ou reconecte o servidor MCP depois de alterar a variável.

No Codex, use `~/.codex/config.toml` no nível do usuário ou `.codex/config.toml` no escopo de um projeto confiável:

```toml
[mcp_servers.keeper]
url = "http://localhost:8080/keeper-mcp/"
bearer_token_env_var = "KEEPER_MCP_TOKEN"
```

Em um ambiente implantado, substitua `http://localhost:8080` pela URL pública base da aplicação.

Conecte com o cliente configurado e confirme que ele conclui o ciclo de vida MCP:

1. O cliente envia `initialize` e recebe as capacidades do servidor.
2. Ele envia `notifications/initialized`.
3. Ele solicita `tools/list`; um token `observer` deve expor as ferramentas de descoberta e sessão permitidas pelo preset.
4. Chame `session_info` e confirme que os escopos retornados correspondem ao token.

Um cliente Streamable HTTP personalizado precisa enviar `Accept: application/json, text/event-stream` nessas requisições e preservar qualquer ID de sessão retornado durante a inicialização. Enviar `tools/list` como primeira requisição não é uma sondagem válida do ciclo de vida MCP. Um bearer ausente ou inválido falha antes que o Keeper exponha o catálogo de ferramentas permitido pelo escopo.

## Como a superfície MCP funciona

O Keeper expõe um pequeno conjunto de **meta-tools** e usa **traits** para ativar ferramentas específicas de cada capacidade sob demanda:

- `session_info` — sempre disponível; informa os escopos da sessão e traits ativos.
- `list_traits` / `describe_trait` — descobrem o que está disponível.
- `use_trait` / `drop_trait`, além de `set_traits` — ativam ou removem um trait; isso emite `notifications/tools/list_changed` do MCP, alterando a lista visível ao vivo.
- `list_tools` / `call_tool` — enumeram e chamam as ferramentas materializadas por um trait.

O que um token pode ativar é limitado por seus **escopos** — aproximadamente `registry.*`, `state.*`, `hub.*`, `knowledge.*`, `git.*`, `components.*`, `tasks.*`, `agents.*`, `tests.run`, `logger.*`, `env.*`, `functions.call` e `app.ui`, além de `mcp.root` para bypass administrativo completo. O `access_mode` do token (`any`, `traits` ou `tools_only`) restringe ainda mais como ele pode chamar ferramentas.

## Notas operacionais e de segurança

- **Escopo de governança** — defina `GOV_MANAGED_NAMESPACES=app` para que a sincronização sistema de arquivos↔registry do Keeper administre apenas o namespace da sua aplicação. Não adicione `keeper`, `wippy` ou `userspace`, a menos que esteja desenvolvendo esses módulos.
- **Segurança** — tokens são vinculados à identidade do administrador emissor e a um conjunto de escopos, armazenados como SHA-256 e revogáveis na página MCP do Keeper. A API de revogação aceita o identificador de token com hash retornado pela API de listagem em `POST /api/v1/keeper/mcp/tokens/revoke`; ela não aceita o bearer bruto exibido uma única vez. A rota `/keeper-mcp/` não executa middleware de autenticação; o handler valida o bearer.
- **Aplicação de referência** — o template de aplicação Wippy é o exemplo completo que conecta o Keeper ao shell da aplicação; seu `src/app/deps/_index.yaml` contém um binding conhecido e válido.

## Próximas etapas

- [Hello World](./hello-world.md) — Estrutura mínima do projeto
- [Autenticação](./auth.md) — Conceitos de identidade administrativa e tokens
- [Agentes](../framework/agents.md) — Agentes e ferramentas expostos por traits do Keeper
