# 프레임워크

Wippy는 허브를 통해 공식 프레임워크 모듈을 제공합니다. 이 모듈은 `wippy` 조직에서 관리되며 모든 프로젝트에 추가할 수 있습니다.

## 프레임워크 모듈 추가하기

```bash
wippy add wippy/test
wippy install
```

이렇게 하면 모듈이 잠금 파일에 추가되고 `.wippy/vendor/`에 다운로드됩니다.

## 소스에서 의존성 선언하기

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

그런 다음 확인하고 설치합니다:

```bash
wippy update
```

## 프레임워크 라이브러리 임포트하기

설치 후 프레임워크 라이브러리를 엔트리에 임포트합니다:

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

임포트는 `wippy.test:test` (`wippy.test` 네임스페이스의 `test` 엔트리)를 로컬 이름 `test`에 매핑하며, Lua에서 `require("test")`로 사용합니다.

## 사용 가능한 모듈

| Module | Description |
|--------|-------------|
| `wippy/test` | 어서션과 모킹을 갖춘 BDD 스타일 테스트 프레임워크 |
| `wippy/terminal` | 터미널 UI 컴포넌트 |

더 많은 모듈이 제공되고 있으며 정기적으로 게시됩니다. 허브에서 검색하십시오:

```bash
wippy search wippy
```

## 참고

- [의존성 관리](guides/dependency-management.md) - 잠금 파일 및 버전 제약 조건
- [퍼블리싱](guides/publishing.md) - 자체 모듈 게시하기
- [CLI 레퍼런스](guides/cli.md) - CLI 명령
