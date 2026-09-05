---
title: "Framework"
description: "Wippy는 허브를 통해 공식 프레임워크 모듈을 제공합니다. 이 모듈들은 wippy 조직에서 관리되며 어떤 프로젝트에도 추가할 수 있습니다."
---

# Framework

Wippy는 허브를 통해 공식 프레임워크 모듈을 제공합니다. 이 모듈들은 `wippy` 조직에서 관리되며 어떤 프로젝트에도 추가할 수 있습니다.

## 프레임워크 모듈 추가

```bash
wippy add wippy/test
wippy install
```

이렇게 하면 모듈이 잠금 파일에 추가되고 `.wippy/vendor/`로 다운로드됩니다.

## 소스에서 의존성 선언

프레임워크 모듈은 `_index.yaml`에서 의존성으로 선언할 수도 있습니다:

```yaml
version: "1.0"
namespace: app

entries:
  - name: dependency.test
    kind: ns.dependency
    component: wippy/test
    version: "^0.3.0"
```

그다음 해석하고 설치합니다:

```bash
wippy update
```

## 프레임워크 라이브러리 임포트

설치가 끝나면 엔트리에서 프레임워크 라이브러리를 임포트합니다:

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

이 임포트는 `wippy.test:test`(`wippy.test` 네임스페이스의 `test` 엔트리)를 로컬 이름 `test`에 매핑하며, Lua에서 `require("test")`로 사용합니다.

## 사용 가능한 모듈

| Module | 설명 |
|--------|-------------|
| `wippy/llm` | 생성, 스트리밍, 툴 호출, 구조화 출력을 갖춘 통합 LLM 인터페이스 |
| `wippy/agent` | 툴, 델리게이트, trait, 메모리를 갖춘 에이전트 프레임워크 |
| `wippy/embeddings` | 벡터 임베딩 저장 및 유사도 검색 |
| `wippy/test` | 어서션과 모킹을 갖춘 BDD 스타일 테스트 프레임워크 |
| `wippy/dataflow` | DAG 기반 노드 실행을 사용하는 워크플로 오케스트레이션 |
| `wippy/relay` | 사용자별 허브와 플러그인 라우팅을 갖춘 WebSocket 릴레이 |
| `wippy/views` | 템플릿 렌더링을 갖춘 가상 페이지/컴포넌트 시스템 |
| `wippy/facade` | 프런트엔드 호스트 구성, 테마 및 config 엔드포인트 |
| `wippy/terminal` | 터미널 UI 컴포넌트 |
| `wippy/migration` | 데이터베이스 스키마 마이그레이션 |
| `wippy/security` | 액터 스코프, 정책 번들 및 보안 헬퍼 |
| `wippy/usage` | LLM 호출에 대한 토큰 및 비용 집계 |

더 많은 모듈이 제공되며 정기적으로 게시되고 있습니다. 허브를 검색하세요:

```bash
wippy search wippy
```

## 참고

- [의존성 관리](guides/dependency-management.md) - 잠금 파일과 버전 제약
- [게시](guides/publishing.md) - 직접 만든 모듈 게시하기
- [CLI 레퍼런스](guides/cli.md) - CLI 명령
