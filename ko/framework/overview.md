---
title: "프레임워크"
description: "Hub를 통해 게시된 공식 Wippy framework module을 설치, 선언 및 import합니다."
---

# 프레임워크

공식 framework module은 Wippy Hub의 `wippy` organization으로 게시됩니다.

이 페이지는 기존 Wippy 프로젝트를 위한 module-management 레퍼런스입니다. 명령은 프로젝트 root에서 실행할 수 있으며 YAML 및 import 블록은 완전한 애플리케이션이 아닌 독립적인 레퍼런스 snippet입니다.

## Adding Framework Modules

```bash
wippy add wippy/test
wippy install
```

This adds the module to your lock file and downloads it to `.wippy/vendor/`.

## Declaring Dependencies in Source

Framework modules can also be declared as dependencies in your `_index.yaml`:

```yaml
version: "1.0"
namespace: app

entries:
  - name: dependency.test
    kind: ns.dependency
    component: wippy/test
    version: "*"
```

Then resolve and install:

```bash
wippy update
```

## Importing Framework Libraries

Once installed, import framework libraries into your entries:

```yaml
entries:
  - name: my_test
    kind: function.lua
    meta:
      type: test
      suite: my-suite
    source: file://my_test.lua
    method: run
    imports:
      test: wippy.test:test
```

The import maps `wippy.test:test` (the `test` entry from the `wippy.test` namespace) to the local name `test`, which you then `require("test")` in Lua.

## Available Modules

| Module | Description |
|--------|-------------|
| `wippy/llm` | Unified LLM interface with generation, streaming, tool calling, structured output |
| `wippy/agent` | Agent framework with tools, delegates, traits, and memory |
| `wippy/embeddings` | Vector embeddings storage and similarity search |
| `wippy/test` | BDD-style testing framework with assertions and mocking |
| `wippy/dataflow` | Workflow orchestration with DAG-based node execution |
| `wippy/relay` | WebSocket relay with per-user hubs and plugin routing |
| `wippy/views` | Virtual page/component system with template rendering |
| `wippy/facade` | 프런트엔드 호스트 구성, 테마 및 config 엔드포인트 |
| `wippy/terminal` | Terminal UI components |
| `wippy/migration` | Database schema migrations |
| `wippy/security` | 액터 스코프, 정책 번들 및 보안 헬퍼 |
| `wippy/usage` | LLM 호출에 대한 토큰 및 비용 집계 |

현재 module catalog는 Hub에서 검색하십시오.

```bash
wippy search wippy
```

## See Also

- [의존성 관리](../guides/dependency-management.md) — lock file 및 version constraint
- [게시](../guides/publishing.md) — module 게시하기
- [CLI 레퍼런스](../guides/cli.md) — module-management 명령
