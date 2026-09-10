---
title: "Keeper sobre MCP"
description: "Wippy Keeper es el plano de control de una aplicación Wippy en ejecución — un banco de trabajo del registry, gobernanza sistema de archivos↔registry, orquestación de agentes/tareas, Hub…"
---

# Keeper sobre MCP

Wippy Keeper es el plano de control de una aplicación Wippy en ejecución — un banco de trabajo del registry,
gobernanza sistema de archivos↔registry, orquestación de agentes/tareas, instalación desde el Hub, base de conocimiento,
inspección de logs y procesos, y un flujo de revisión/push en Git, todo tras una UI integrada. Su
característica definitoria es que expone esas capacidades de operador a clientes de IA (Claude,
Codex, …) sobre **MCP (Model Context Protocol)**. Esta página añade Keeper a una aplicación y
conecta un cliente MCP a ella.

## Qué Construirá

1. Keeper añadido a una aplicación generada a partir de `app-template`.
2. La UI de Keeper en `/app/keeper` y el endpoint MCP en `/keeper-mcp/`.
3. Un token MCP delimitado, y un cliente MCP configurado para dirigir la aplicación a través de Keeper.

## Requisitos Previos

- Una aplicación creada con [app-template](https://github.com/wippyai/app-template). Ya
  proporciona todo aquello a lo que Keeper se enlaza: `app:gateway`, `app:api`, `app:db`,
  `app:processes`, `app.security:admin` y `app.env:store`.
- El módulo Keeper instalado:

  ```bash
  wippy add keeper/keeper
  wippy install
  ```

## Añadir Keeper

Declare la dependencia y enlácela a los recursos de la aplicación. Solo `admin_scope` es
obligatorio (no tiene valor por defecto); el resto toma por defecto los nombres que `app-template` ya usa, mostrados
aquí explícitamente por claridad:

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
    - { name: public_gateway, value: app:gateway }   # aloja /keeper-mcp/
    - { name: mcp_route,      value: /keeper-mcp/ }
    - { name: ui_server,      value: app:gateway }
    - { name: process_host,   value: app:processes }
```

Arranque la aplicación:

```bash
wippy run
```

Keeper monta automáticamente tres superficies:

- **UI** — `/app/keeper`
- **Transporte MCP** — `/keeper-mcp/` en el gateway público
- **API de tokens** — en `app:api` (`/keeper/mcp/tokens`, `/keeper/mcp/scopes`)

El transporte MCP está controlado por la variable de entorno `MCP_ENABLED` (por defecto `true`);
establézcala a `false` para cerrar el endpoint.

## Emitir un Token MCP

Los tokens los emite un usuario administrador, están delimitados y se muestran exactamente una vez. Cree uno mediante la
API de tokens (o la página MCP en la UI de Keeper):

```bash
curl -X POST http://localhost:8080/api/v1/keeper/mcp/tokens \
  -H 'Authorization: Bearer <admin-session-token>' \
  -H 'Content-Type: application/json' \
  -d '{"label": "claude-dev", "preset": "developer"}'
# -> { "success": true, "token": { "token": "wkmcp_<64 hex>", ... } }
```

`preset` agrupa un conjunto de scopes. Presets disponibles: `root`, `developer`,
`wippy_operator`, `observer`, `knowledge_manager`, `explorer_tools_only`. Para un
control más fino, pase en su lugar un array `scopes` explícito (por ejemplo, `registry.read`,
`state.write`, `git.pr`, `tasks.run`, `knowledge.read`). El token `wkmcp_...` en bruto se
retorna una sola vez y se almacena únicamente como hash — cópielo inmediatamente.

## Conectar un Cliente

Apunte un cliente MCP al endpoint con el token como cabecera bearer. Para Claude Code /
Codex, un `.mcp.json` en la raíz del proyecto:

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

Use la URL base pública de la aplicación en lugar de `http://localhost:8080` en un entorno
desplegado.

## Cómo Funciona la Superficie MCP

Keeper no expone una lista de herramientas plana y fija. Presenta unas pocas **meta-herramientas** más
**traits** que activan herramientas concretas bajo demanda, de modo que la superficie permanece pequeña hasta que usted
opta por una capacidad:

- `session_info` — siempre disponible; reporta los scopes de la sesión y los traits activos.
- `list_traits` / `describe_trait` — descubra qué hay disponible.
- `use_trait` / `drop_trait` (y `set_traits`) — active o elimine un trait; esto emite
  una `notifications/tools/list_changed` de MCP, de modo que las herramientas visibles cambian en vivo.
- `list_tools` — enumere las herramientas que un trait materializó, con sus esquemas.
- `call_tool` — invoque cualquier herramienta del registro por id; visible solo para un token que
  posea `mcp.root`.

Lo que un token puede activar está acotado por sus **scopes** — a grandes rasgos `registry.*`,
`state.*`, `hub.*`, `knowledge.*`, `git.*`, `components.*`, `tasks.*`, `agents.*`,
`tests.run`, `logger.*`, `env.*`, `functions.call`, `app.ui` (más `mcp.root` para el bypass
completo de administrador). El `access_mode` del token (`any` / `traits` / `tools_only`) restringe además
cómo puede llamar a las herramientas.

## Notas

- **Alcance de gobernanza** — establezca `GOV_MANAGED_NAMESPACES=app` para que la sincronización
  sistema de archivos↔registry de Keeper gobierne solo el namespace de su aplicación. No añada `keeper`,
  `wippy` ni `userspace` a menos que esté desarrollando esos módulos.
- **Seguridad** — los tokens están vinculados a la identidad administradora que los emite y a un conjunto de scopes, se almacenan
  como SHA-256 y son revocables mediante `POST /keeper/mcp/tokens/revoke`. La ruta `/keeper-mcp/`
  no ejecuta middleware de autenticación; el manejador impone el token bearer por sí mismo.
- **Aplicación de referencia** — `app-keeper` es el ejemplo trabajado que integra Keeper en el
  esqueleto de una aplicación; copie su bloque `src/app/deps/_index.yaml` si desea una configuración conocida y funcional.

## Siguientes Pasos

- [Hola Mundo](tutorials/hello-world.md) — la disposición mínima de un proyecto
- [Autenticación](tutorials/auth.md) — la identidad administradora que emite los tokens
- [Agentes](framework/agents.md) — los agentes y herramientas que exponen los traits de Keeper
