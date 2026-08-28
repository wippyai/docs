---
title: "프레임워크"
description: "Hub에 게시된 공식 Wippy 프레임워크 모듈을 설치하고, 선언하고, 가져오는 방법을 설명합니다."
---

# 프레임워크

공식 프레임워크 모듈은 Wippy Hub의 `wippy` 조직에 게시됩니다.

이 페이지는 기존 Wippy 프로젝트를 위한 모듈 관리 참조입니다. 명령은 프로젝트 루트에서 실행할 수 있으며, YAML과 가져오기 블록은 완전한 애플리케이션이 아니라 독립적인 참조 조각입니다.

## 프레임워크 모듈 추가

```bash
wippy add wippy/test
wippy install
```

이 명령은 모듈을 잠금 파일에 추가하고 `.wippy/vendor/`에 다운로드합니다.

## 소스에서 의존성 선언

프레임워크 모듈은 `_index.yaml`에서 의존성으로 선언할 수도 있습니다:

```yaml
version: "1.0"
namespace: app

entries:
  - name: dependency.test
    kind: ns.dependency
    component: wippy/test
    version: "*"
```

그런 다음 의존성을 해석하고 설치합니다:

```bash
wippy update
```

## 프레임워크 라이브러리 가져오기

설치가 끝나면 프레임워크 라이브러리를 엔트리로 가져옵니다:

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

이 가져오기는 `wippy.test` 네임스페이스의 `test` 엔트리인 `wippy.test:test`를 로컬 이름 `test`에 매핑합니다. 이후 Lua에서 `require("test")`로 사용할 수 있습니다.

## 사용 가능한 모듈

| 모듈 | 설명 |
|--------|-------------|
| `wippy/llm` | 생성, 스트리밍, 도구 호출, 구조화된 출력을 지원하는 통합 LLM 인터페이스 |
| `wippy/agent` | 도구, 델리게이트, 트레이트, 메모리를 제공하는 에이전트 프레임워크 |
| `wippy/embeddings` | 벡터 임베딩 저장 및 유사도 검색 |
| `wippy/test` | 어설션과 모킹을 지원하는 BDD 스타일 테스트 프레임워크 |
| `wippy/dataflow` | DAG 기반 노드 실행을 사용하는 워크플로 오케스트레이션 |
| `wippy/relay` | 사용자별 허브와 플러그인 라우팅을 제공하는 WebSocket 릴레이 |
| `wippy/views` | 템플릿 렌더링을 지원하는 가상 페이지 및 컴포넌트 시스템 |
| `wippy/facade` | 프런트엔드 호스트 구성, 테마 및 구성 엔드포인트 |
| `wippy/terminal` | 터미널 UI 컴포넌트 |
| `wippy/migration` | 데이터베이스 스키마 마이그레이션 |
| `wippy/security` | 액터 스코프, 정책 번들 및 보안 헬퍼 |
| `wippy/usage` | LLM 호출에 대한 토큰 및 비용 집계 |

현재 모듈 카탈로그는 Hub에서 검색하세요.

```bash
wippy search wippy
```

## 참고

- [의존성 관리](guides/dependency-management.md) — 잠금 파일 및 버전 제약 조건
- [게시](guides/publishing.md) — 모듈 게시
- [CLI 레퍼런스](guides/cli.md) — 모듈 관리 명령
