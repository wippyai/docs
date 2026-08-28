---
title: "Keeper mediante MCP"
description: "Añada Wippy Keeper a una aplicación, emita un token con ámbito y conecte un cliente MCP a sus herramientas de operación."
---

# Keeper mediante MCP

Wippy Keeper proporciona una interfaz para operaciones del registro, gobierno del sistema de archivos al registro, orquestación de tareas y agentes, instalación desde Hub, gestión de bases de conocimiento, inspección del runtime y flujos de Git. También expone capacidades de operación a clientes compatibles mediante Model Context Protocol (MCP). Esta página añade Keeper a una aplicación y configura una conexión MCP.

**Clasificación: tutorial de integración ejecutable.** La aplicación y el transporte de Keeper se ejecutan localmente. El último paso requiere un cliente MCP que admita servidores HTTP remotos y cabeceras bearer.

## Qué construirá

1. Keeper añadido a una aplicación creada desde la plantilla de aplicaciones Wippy.
2. La interfaz de Keeper en `/c/keeper:main` y el endpoint MCP en `/keeper-mcp/`.
3. Un token MCP con ámbito y un cliente MCP configurado para operar la aplicación mediante Keeper.

## Requisitos previos

- Una aplicación de la [plantilla de aplicaciones Wippy](https://github.com/wippyai/app). Ya proporciona todo aquello a lo que se enlaza Keeper: `app:gateway`, `app:api`, `app:db`, `app:processes`, `app.security:admin` y `app.env:store`.
- Una cuenta de administrador activa en esa aplicación. Keeper asocia la emisión del token con la identidad del administrador que ha iniciado sesión; una clave de API genérica no puede emitir un token MCP.

## Añadir Keeper

Declare la dependencia y enlácela a los recursos de la aplicación. `admin_scope` es obligatorio y no tiene valor predeterminado. Los demás parámetros usan de forma predeterminada los nombres de entrada de la plantilla de aplicación, pero el ejemplo los indica explícitamente:

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

Resuelva la dependencia fuente y su grafo transitivo, y arranque la aplicación:

```bash
wippy update
wippy run -c
```

`wippy update` examina las entradas fuente, actualiza el lock, resuelve las dependencias transitivas y las instala. `wippy add keeper/keeper` por sí solo actualiza únicamente el módulo indicado en el lock; no resuelve este grafo de dependencias declarado en la fuente.

Keeper monta tres superficies:

- **Interfaz** — `/c/keeper:main`
- **Transporte MCP** — `/keeper-mcp/` en el gateway público
- **API de tokens** — en `app:api` (`/keeper/mcp/tokens`, `/keeper/mcp/scopes`)

El transporte MCP está controlado por la variable de entorno `MCP_ENABLED` (valor predeterminado `true`); asígnela a `false` para cerrar el endpoint.

## Emitir un token MCP

Los tokens los emite un usuario administrador activo, tienen un ámbito y se muestran una sola vez.

1. Inicie sesión en la aplicación como administrador.
2. Abra `/c/keeper:main`, seleccione **MCP** y elija **Create Scoped Token**.
3. Escriba una etiqueta y seleccione un preset. `observer` es el más seguro para la primera conexión; use `developer` o `wippy_operator` solo cuando el cliente necesite operaciones de escritura.
4. Cree el token y copie de inmediato el valor `wkmcp_...` mostrado. La interfaz no puede volver a mostrar el valor sin procesar.

La interfaz también muestra la URL MCP efectiva y fragmentos de configuración para clientes. Es el flujo recomendado porque reutiliza la sesión actual del administrador.

Para automatizarlo, llame a la API con el **bearer de la sesión de administrador** de esa misma aplicación:

```bash
curl -X POST http://localhost:8080/api/v1/keeper/mcp/tokens \
  -H 'Authorization: Bearer <admin-session-token>' \
  -H 'Content-Type: application/json' \
  -d '{"label": "local-observer", "preset": "observer"}'
# -> { "success": true, "token": { "token": "wkmcp_<64 hex>", ... } }
```

`<admin-session-token>` es el bearer emitido por el flujo normal de inicio de sesión de la aplicación, no el nuevo token MCP de Keeper. El endpoint rechaza usuarios no autenticados, inactivos o que no sean administradores. `GET /api/v1/keeper/mcp/scopes` devuelve el catálogo actual de presets y ámbitos antes de emitir el token.

`preset` agrupa un conjunto de ámbitos. Los presets disponibles son `root`, `developer`, `wippy_operator`, `observer`, `knowledge_manager` y `explorer_tools_only`. Para un control más preciso, pase un array `scopes` explícito (por ejemplo, `registry.read`, `state.write`, `git.pr`, `tasks.run`, `knowledge.read`). El token `wkmcp_...` sin procesar se devuelve una vez y solo se almacena su hash: cópielo inmediatamente.

## Conectar un cliente

Dirija un cliente MCP al endpoint con el token en una cabecera bearer. Exporte primero el token para mantenerlo fuera de la configuración versionada:

```bash
export KEEPER_MCP_TOKEN='wkmcp_<token>'
```

Para Claude Code, use un archivo `.mcp.json` limitado al proyecto:

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

Claude Code expande `${KEEPER_MCP_TOKEN}` desde el entorno al cargar la configuración del proyecto. Reinicie o vuelva a conectar el servidor MCP después de cambiar la variable de entorno.

Para Codex, use `~/.codex/config.toml` a nivel de usuario o `.codex/config.toml` limitado a un proyecto de confianza:

```toml
[mcp_servers.keeper]
url = "http://localhost:8080/keeper-mcp/"
bearer_token_env_var = "KEEPER_MCP_TOKEN"
```

En un entorno desplegado, sustituya `http://localhost:8080` por la URL base pública de la aplicación.

Conecte el cliente configurado y compruebe que completa el ciclo de vida MCP:

1. El cliente envía `initialize` y recibe las capacidades del servidor.
2. Envía `notifications/initialized`.
3. Solicita `tools/list`; un token `observer` debe exponer las herramientas de descubrimiento y sesión permitidas por ese preset.
4. Llame a `session_info` y confirme que los ámbitos devueltos coinciden con el token.

Un cliente Streamable HTTP personalizado debe enviar `Accept: application/json, text/event-stream` en estas solicitudes y conservar cualquier ID de sesión devuelto durante la inicialización. Enviar `tools/list` como primera solicitud no es una comprobación válida del ciclo de vida MCP. Un bearer ausente o no válido falla antes de que Keeper exponga el catálogo de herramientas con ámbito.

## Funcionamiento de la superficie MCP

Keeper expone un pequeño conjunto de **meta-herramientas** y usa **traits** para activar bajo demanda herramientas específicas de una capacidad:

- `session_info` — siempre disponible; informa de los ámbitos de la sesión y los traits activos.
- `list_traits` / `describe_trait` — descubren lo que está disponible.
- `use_trait` / `drop_trait` (y `set_traits`) — activan o eliminan un trait; esto emite una `notifications/tools/list_changed` de MCP, por lo que las herramientas visibles cambian en directo.
- `list_tools` / `call_tool` — enumeran e invocan las herramientas materializadas por un trait.

Lo que puede activar un token está limitado por sus **ámbitos**: en términos generales, `registry.*`, `state.*`, `hub.*`, `knowledge.*`, `git.*`, `components.*`, `tasks.*`, `agents.*`, `tests.run`, `logger.*`, `env.*`, `functions.call` y `app.ui` (además de `mcp.root` para omitir por completo las restricciones administrativas). El `access_mode` del token (`any` / `traits` / `tools_only`) limita además cómo puede llamar a las herramientas.

## Notas operativas y de seguridad

- **Ámbito de gobierno** — establezca `GOV_MANAGED_NAMESPACES=app` para que la sincronización sistema de archivos↔registro de Keeper solo gobierne el espacio de nombres de la aplicación. No añada `keeper`, `wippy` ni `userspace` salvo que esté desarrollando esos módulos.
- **Seguridad** — los tokens están asociados a la identidad del administrador emisor y a un conjunto de ámbitos, se almacenan como SHA-256 y pueden revocarse desde la página MCP de Keeper. La API de revocación acepta el identificador con hash devuelto por la API de listado de tokens en `POST /api/v1/keeper/mcp/tokens/revoke`; no acepta el bearer sin procesar de un solo uso. La ruta `/keeper-mcp/` no ejecuta middleware de autenticación; el handler valida el token bearer.
- **Aplicación de referencia** — la plantilla de aplicaciones Wippy es el ejemplo completo que conecta Keeper con el shell de una aplicación; su `src/app/deps/_index.yaml` contiene enlaces que se sabe que funcionan.

## Pasos siguientes

- [Hola, mundo](./hello-world.md) — Estructura mínima de un proyecto
- [Autenticación](./auth.md) — Conceptos de identidad de administrador y tokens
- [Agentes](../framework/agents.md) — Agentes y herramientas expuestos por traits de Keeper
