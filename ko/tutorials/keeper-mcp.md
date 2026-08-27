---
title: "MCP를 통한 Keeper"
description: "애플리케이션에 Wippy Keeper를 추가하고 범위가 지정된 token을 발급하여 MCP client를 operator tool에 연결합니다."
---

# MCP를 통한 Keeper

Wippy Keeper는 레지스트리 작업, 파일 시스템과 레지스트리 간 governance, task 및 agent orchestration, Hub 설치, knowledge base 관리, 런타임 검사, Git workflow를 위한 UI를 제공합니다. 또한 Model Context Protocol(MCP)을 통해 호환 client에 operator 기능을 노출합니다. 이 페이지에서는 애플리케이션에 Keeper를 추가하고 MCP 연결을 설정합니다.

**분류: 실행 가능한 통합 튜토리얼.** 애플리케이션과 Keeper transport는 로컬에서 실행됩니다. 마지막 단계를 완료하려면 remote HTTP server와 bearer header를 지원하는 MCP client가 필요합니다.

## 만들 항목

1. Wippy application template으로 scaffold한 애플리케이션에 Keeper 추가
2. `/c/keeper:main`의 Keeper UI와 `/keeper-mcp/`의 MCP endpoint
3. 범위가 지정된 MCP token과 Keeper를 통해 앱을 제어하도록 설정한 MCP client

## 사전 요구사항

- [Wippy application template](https://github.com/wippyai/app)으로 만든 앱. 이 template은 Keeper가 bind하는 `app:gateway`, `app:api`, `app:db`, `app:processes`, `app.security:admin`, `app.env:store`를 이미 제공합니다.
- 애플리케이션의 활성 admin account. Keeper는 token 발급을 로그인된 admin identity에 bind하므로 일반 API key로는 MCP token을 발급할 수 없습니다.

## Keeper 추가

dependency를 선언하고 애플리케이션 resource에 bind합니다. `admin_scope`는 필수이며 기본값이 없습니다. 다른 parameter는 application template에서 사용하는 엔트리 이름이 기본값이지만 예제에서는 모두 명시합니다.

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

source dependency와 transitive graph를 resolve한 다음 앱을 시작합니다.

```bash
wippy update
wippy run -c
```

`wippy update`는 source 엔트리를 scan하고 lock을 갱신하며 transitive dependency를 resolve하여 설치합니다. `wippy add keeper/keeper`만 실행하면 지정된 lock module만 갱신하며 source에 선언된 dependency graph는 resolve하지 않습니다.

Keeper는 세 가지 surface를 mount합니다.

- **UI** — `/c/keeper:main`
- **MCP transport** — public gateway의 `/keeper-mcp/`
- **Token API** — `app:api`의 `/keeper/mcp/tokens`, `/keeper/mcp/scopes`

MCP transport는 `MCP_ENABLED` 환경 변수로 제어되며 기본값은 `true`입니다. endpoint를 닫으려면 `false`로 설정하십시오.

## MCP token 발급

token은 활성 admin 사용자가 발급하고 scope를 가지며 한 번만 표시됩니다.

1. 애플리케이션에 admin으로 로그인합니다.
2. `/c/keeper:main`을 열고 **MCP**를 선택한 뒤 **Create Scoped Token**을 선택합니다.
3. label을 입력하고 preset을 선택합니다. 첫 연결에는 `observer`가 가장 안전합니다. client에 쓰기 작업이 필요할 때만 `developer` 또는 `wippy_operator`를 사용하십시오.
4. token을 만들고 표시된 `wkmcp_...` 값을 즉시 복사합니다. UI는 raw 값을 다시 표시할 수 없습니다.

UI에는 유효한 MCP URL과 복사 가능한 client snippet도 표시됩니다. 현재 로그인된 admin session을 재사용하므로 이 흐름을 권장합니다.

자동화에서는 같은 애플리케이션의 **admin session bearer**로 API를 호출합니다.

```bash
curl -X POST http://localhost:8080/api/v1/keeper/mcp/tokens \
  -H 'Authorization: Bearer <admin-session-token>' \
  -H 'Content-Type: application/json' \
  -d '{"label": "local-observer", "preset": "observer"}'
# -> { "success": true, "token": { "token": "wkmcp_<64 hex>", ... } }
```

`<admin-session-token>`은 새 Keeper MCP token이 아니라 애플리케이션의 일반 로그인 흐름이 발급한 bearer입니다. endpoint는 인증되지 않았거나 비활성 상태이거나 admin이 아닌 사용자를 거부합니다. 발급 전에 `GET /api/v1/keeper/mcp/scopes`로 현재 preset과 scope catalog를 확인할 수 있습니다.

`preset`은 scope 집합을 묶습니다. 사용할 수 있는 preset은 `root`, `developer`, `wippy_operator`, `observer`, `knowledge_manager`, `explorer_tools_only`입니다. 더 세밀하게 제어하려면 `registry.read`, `state.write`, `git.pr`, `tasks.run`, `knowledge.read` 같은 명시적 `scopes` array를 전달하십시오. raw `wkmcp_...` token은 한 번 반환되고 hash만 저장되므로 즉시 복사해야 합니다.

## Client 연결

token을 bearer header로 사용하여 MCP client를 endpoint에 연결합니다. checked-in 설정에 token을 넣지 말고 먼저 export하십시오.

```bash
export KEEPER_MCP_TOKEN='wkmcp_<token>'
```

Claude Code에서는 project-scoped `.mcp.json`을 사용합니다.

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

Claude Code는 project 설정을 load할 때 환경의 `${KEEPER_MCP_TOKEN}`을 확장합니다. 환경 변수를 바꾼 뒤 MCP server를 restart하거나 reconnect하십시오.

Codex에서는 user-level `~/.codex/config.toml` 또는 신뢰할 수 있는 project의 project-scoped `.codex/config.toml`을 사용합니다.

```toml
[mcp_servers.keeper]
url = "http://localhost:8080/keeper-mcp/"
bearer_token_env_var = "KEEPER_MCP_TOKEN"
```

배포 환경에서는 `http://localhost:8080` 대신 앱의 public base URL을 사용하십시오.

설정한 client로 연결하고 MCP lifecycle 완료를 확인합니다.

1. client가 `initialize`를 보내고 server capability를 받습니다.
2. `notifications/initialized`를 보냅니다.
3. `tools/list`를 요청합니다. `observer` token에는 해당 preset이 허용한 discovery 및 session tool이 표시되어야 합니다.
4. `session_info`를 호출하고 반환된 scope가 token과 일치하는지 확인합니다.

사용자 정의 Streamable HTTP client는 이 요청에 `Accept: application/json, text/event-stream`을 보내고 초기화 중 반환된 session ID를 유지해야 합니다. 첫 요청으로 `tools/list`를 보내는 것은 올바른 MCP lifecycle probe가 아닙니다. bearer가 없거나 유효하지 않으면 Keeper가 범위가 지정된 tool catalog를 노출하기 전에 실패합니다.

## MCP surface 동작 방식

Keeper는 작은 **meta-tool** 집합을 노출하고 **trait**를 사용하여 기능별 tool을 필요할 때 활성화합니다.

- `session_info` — 항상 사용 가능하며 session의 scope와 활성 trait를 보고합니다.
- `list_traits` / `describe_trait` — 사용 가능한 항목을 검색합니다.
- `use_trait` / `drop_trait` 및 `set_traits` — trait를 활성화하거나 제거합니다. 이 작업은 MCP `notifications/tools/list_changed`를 내보내므로 표시되는 tool이 실시간으로 바뀝니다.
- `list_tools` / `call_tool` — trait가 materialize한 tool을 나열하고 호출합니다.

token이 활성화할 수 있는 기능은 scope로 제한됩니다. 대략 `registry.*`, `state.*`, `hub.*`, `knowledge.*`, `git.*`, `components.*`, `tasks.*`, `agents.*`, `tests.run`, `logger.*`, `env.*`, `functions.call`, `app.ui`이며 전체 admin bypass에는 `mcp.root`가 추가됩니다. token의 `access_mode`(`any` / `traits` / `tools_only`)도 tool 호출 방식을 추가로 제한합니다.

## 운영 및 보안 참고사항

- **Governance scope** — `GOV_MANAGED_NAMESPACES=app`으로 설정하여 Keeper의 파일 시스템↔레지스트리 sync가 앱 namespace만 관리하게 하십시오. 해당 module을 개발하는 경우가 아니면 `keeper`, `wippy`, `userspace`를 추가하지 마십시오.
- **보안** — token은 발급한 admin identity와 scope 집합에 bind되고 SHA-256으로 저장되며 Keeper MCP 페이지에서 revoke할 수 있습니다. revoke API `POST /api/v1/keeper/mcp/tokens/revoke`는 token-list API가 반환한 hashed token identifier를 받으며, 한 번 표시되는 raw bearer는 받지 않습니다. `/keeper-mcp/` route에는 auth middleware가 없고 handler가 bearer token을 검사합니다.
- **참조 앱** — Wippy application template은 Keeper를 app shell에 연결하는 예제이며 `src/app/deps/_index.yaml`에 검증된 binding이 있습니다.

## 다음 단계

- [Hello World](./hello-world.md) — 최소 project layout
- [인증](./auth.md) — Admin identity와 token 개념
- [Agent](../framework/agents.md) — Keeper trait가 노출하는 agent와 tool
