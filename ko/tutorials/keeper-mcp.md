---
title: "MCP를 통한 Keeper"
description: "Wippy Keeper는 실행 중인 Wippy 앱의 컨트롤 플레인입니다 — 레지스트리 작업대, 파일 시스템↔레지스트리 거버넌스, 에이전트/태스크 오케스트레이션, Hub…"
---

# MCP를 통한 Keeper

Wippy Keeper는 실행 중인 Wippy 앱의 컨트롤 플레인입니다. 레지스트리 작업대,
파일 시스템↔레지스트리 거버넌스, 에이전트/태스크 오케스트레이션, Hub 설치, 지식 베이스,
로그와 프로세스 검사, Git 리뷰/푸시 흐름을 모두 내장 UI 뒤에 제공합니다. 가장 두드러진
특징은 이러한 운영자 기능을 **MCP(Model Context Protocol)**를 통해 AI 클라이언트(Claude,
Codex 등)에 노출한다는 점입니다. 이 페이지에서는 앱에 Keeper를 추가하고 MCP 클라이언트를
연결합니다.

## 무엇을 구축할 것인가

1. `app-template`으로 스캐폴딩한 앱에 추가된 Keeper.
2. `/app/keeper`의 Keeper UI와 `/keeper-mcp/`의 MCP 엔드포인트.
3. 스코프가 지정된 MCP 토큰과, Keeper를 통해 앱을 조작하도록 구성된 MCP 클라이언트.

## 전제 조건

- [app-template](https://github.com/wippyai/app-template)으로 만든 앱. Keeper가 바인딩하는
  모든 것을 이미 제공합니다: `app:gateway`, `app:api`, `app:db`,
  `app:processes`, `app.security:admin`, `app.env:store`.
- 설치된 Keeper 모듈:

  ```bash
  wippy add keeper/keeper
  wippy install
  ```

## Keeper 추가

의존성을 선언하고 앱의 리소스에 바인딩합니다. `admin_scope`만 필수이며(기본값 없음),
나머지는 `app-template`이 이미 사용하는 이름을 기본값으로 갖습니다. 명확성을 위해 여기서는
명시적으로 적었습니다:

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
    - { name: public_gateway, value: app:gateway }   # /keeper-mcp/ 를 호스팅
    - { name: mcp_route,      value: /keeper-mcp/ }
    - { name: ui_server,      value: app:gateway }
    - { name: process_host,   value: app:processes }
```

앱을 시작합니다:

```bash
wippy run
```

Keeper는 세 개의 표면을 자동으로 마운트합니다:

- **UI** — `/app/keeper`
- **MCP 전송** — 공개 게이트웨이의 `/keeper-mcp/`
- **토큰 API** — `app:api`상 (`/keeper/mcp/tokens`, `/keeper/mcp/scopes`)

MCP 전송은 `MCP_ENABLED` 환경 변수로 통제됩니다(기본값 `true`).
엔드포인트를 닫으려면 `false`로 설정하십시오.

## MCP 토큰 발급

토큰은 관리자 사용자가 발급하며, 스코프가 지정되고, 단 한 번만 표시됩니다. 토큰 API로
하나 생성합니다(또는 Keeper UI의 MCP 페이지에서):

```bash
curl -X POST http://localhost:8080/api/v1/keeper/mcp/tokens \
  -H 'Authorization: Bearer <admin-session-token>' \
  -H 'Content-Type: application/json' \
  -d '{"label": "claude-dev", "preset": "developer"}'
# -> { "success": true, "token": { "token": "wkmcp_<64 hex>", ... } }
```

`preset`은 스코프 집합을 묶습니다. 사용 가능한 프리셋: `root`, `developer`,
`wippy_operator`, `observer`, `knowledge_manager`, `explorer_tools_only`. 더 세밀하게
제어하려면 대신 명시적인 `scopes` 배열을 전달하십시오(예: `registry.read`,
`state.write`, `git.pr`, `tasks.run`, `knowledge.read`). 원시 `wkmcp_...` 토큰은 한 번만
반환되고 해시로만 저장되므로, 즉시 복사하십시오.

## 클라이언트 연결

토큰을 bearer 헤더로 넣어 MCP 클라이언트가 엔드포인트를 가리키게 하십시오. Claude Code /
Codex의 경우 프로젝트 루트에 `.mcp.json`을 둡니다:

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

배포 환경에서는 `http://localhost:8080` 대신 앱의 공개 기본 URL을 사용하십시오.

## MCP 표면의 동작 방식

Keeper는 평평하고 고정된 도구 목록을 노출하지 않습니다. 몇 개의 **메타 도구**와, 필요할 때
구체적인 도구를 활성화하는 **트레이트(trait)**를 제시하므로, 기능을 선택하기 전까지 표면이
작게 유지됩니다:

- `session_info` — 항상 사용 가능하며, 세션의 스코프와 활성 트레이트를 보고합니다.
- `list_traits` / `describe_trait` — 사용 가능한 것을 탐색합니다.
- `use_trait` / `drop_trait`(및 `set_traits`) — 트레이트를 활성화하거나 제거합니다. 이는
  MCP `notifications/tools/list_changed`를 발생시키므로 보이는 도구가 실시간으로 바뀝니다.
- `list_tools` — 트레이트가 구체화한 도구를 스키마와 함께 나열합니다.
- `call_tool` — 모든 레지스트리 도구를 id로 호출합니다. `mcp.root`를 가진 토큰에만
  보입니다.

토큰이 활성화할 수 있는 범위는 그 **스코프**로 제한됩니다. 대략 `registry.*`,
`state.*`, `hub.*`, `knowledge.*`, `git.*`, `components.*`, `tasks.*`, `agents.*`,
`tests.run`, `logger.*`, `env.*`, `functions.call`, `app.ui`가 있습니다(전체 관리자 우회를
위한 `mcp.root`도 있습니다). 토큰의 `access_mode`(`any` / `traits` / `tools_only`)가 도구를
호출하는 방식을 추가로 제한합니다.

## 참고 사항

- **거버넌스 범위** — `GOV_MANAGED_NAMESPACES=app`을 설정해 Keeper의
  파일 시스템↔레지스트리 동기화가 여러분 앱의 네임스페이스만 관장하도록 하십시오. 해당
  모듈을 직접 개발하는 것이 아니라면 `keeper`, `wippy`, `userspace`를 추가하지 마십시오.
- **보안** — 토큰은 발급한 관리자 신원과 스코프 집합에 묶이고, SHA-256으로 저장되며,
  `POST /keeper/mcp/tokens/revoke`로 취소할 수 있습니다. `/keeper-mcp/` 라우트는 인증
  미들웨어를 실행하지 않으며, 핸들러가 직접 bearer 토큰을 강제합니다.
- **참조 앱** — `app-keeper`는 Keeper를 앱 셸에 연결한 실습 예제입니다. 검증된 설정을
  원한다면 그 `src/app/deps/_index.yaml` 블록을 복사하십시오.

## 다음 단계

- [Hello World](tutorials/hello-world.md) — 최소한의 프로젝트 레이아웃
- [인증](tutorials/auth.md) — 토큰을 발급하는 관리자 신원
- [에이전트](framework/agents.md) — Keeper 트레이트가 노출하는 에이전트와 도구
