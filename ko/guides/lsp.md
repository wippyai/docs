# 언어 서버

Wippy에는 Lua 코드를 위한 IDE 기능을 제공하는 내장 LSP(Language Server Protocol) 서버가 포함되어 있습니다. 서버는 Wippy 런타임의 일부로 실행되며 TCP 또는 HTTP를 통해 에디터에 연결됩니다.

## 기능

- 타입 인식 제안을 통한 코드 완성
- 타입 및 시그니처를 표시하는 호버 정보
- 정의로 이동
- 참조 찾기
- 문서 및 워크스페이스 심볼
- 호출 계층 (수신 및 발신 호출)
- 실시간 진단 (파싱 오류, 타입 오류)
- 함수 매개변수에 대한 시그니처 도움말

## 구성

`.wippy.yaml`에서 LSP 서버를 활성화합니다:

```yaml
version: "1.0"

lua:
  type_system:
    enabled: true

lsp:
  enabled: true
  address: ":7777"
```

### 구성 필드

| 필드 | 기본값 | 설명 |
|------|--------|------|
| `enabled` | false | TCP 서버 활성화 |
| `address` | :7777 | TCP 수신 주소 |
| `http_enabled` | false | HTTP 전송 활성화 |
| `http_address` | :7778 | HTTP 수신 주소 |
| `http_path` | /lsp | HTTP 엔드포인트 경로 |
| `http_allow_origin` | * | CORS 허용 출처 |
| `max_message_bytes` | 8388608 | 최대 수신 메시지 크기 (바이트) |

### TCP 전송

TCP 서버는 표준 LSP 메시지 프레이밍(Content-Length 헤더)과 함께 JSON-RPC 2.0을 사용합니다. 에디터 통합을 위한 기본 전송 방식입니다.

### HTTP 전송

HTTP 전송은 JSON-RPC 페이로드가 포함된 POST 요청을 수락합니다. 브라우저 기반 에디터 및 웹 도구에 유용합니다. 크로스 오리진 접근을 위한 CORS 헤더가 포함됩니다.

```yaml
lsp:
  enabled: true
  http_enabled: true
  http_address: ":7778"
  http_path: "/lsp"
  http_allow_origin: "*"
```

## VS Code 설정

### Wippy Lua 확장 사용

1. VS Code 마켓플레이스에서 `wippy-lua` 확장을 설치합니다 (또는 소스에서 빌드).
2. LSP가 활성화된 상태로 Wippy 런타임을 시작합니다:

```bash
wippy run
```

3. 확장은 기본적으로 `127.0.0.1:7777`에 연결됩니다.

### 확장 설정

| 설정 | 기본값 | 설명 |
|------|--------|------|
| `wippyLua.lsp.enabled` | true | LSP 클라이언트 활성화 |
| `wippyLua.lsp.host` | 127.0.0.1 | LSP 서버 호스트 |
| `wippyLua.lsp.port` | 7777 | TCP 포트 |
| `wippyLua.lsp.httpPort` | 7778 | HTTP 전송 포트 |
| `wippyLua.lsp.mode` | tcp | 연결 모드 (tcp, http) |

## 문서 URI 스킴

LSP 서버는 레지스트리 엔트리를 식별하기 위해 `wippy://` URI 스킴을 사용합니다:

```
wippy://namespace:entry_name
```

에디터는 이러한 URI를 레지스트리의 엔트리 ID에 매핑합니다. `wippy://` 스킴과 원시 `namespace:entry_name` 형식 모두 허용됩니다.

## 인덱싱

LSP 서버는 빠른 조회를 위해 모든 코드 엔트리의 인덱스를 유지합니다. 인덱싱은 여러 워커를 사용하여 백그라운드에서 수행됩니다.

주요 동작:

- 엔트리는 의존성 순서로 인덱싱됩니다 (의존성 우선)
- 변경 시 영향을 받는 엔트리의 재인덱싱이 트리거됩니다
- 저장되지 않은 에디터 변경사항은 오버레이에 저장됩니다
- 인덱스는 증분 방식입니다 - 변경된 엔트리만 재처리됩니다

## 지원되는 LSP 메서드

| 메서드 | 설명 |
|--------|------|
| `initialize` | 기능 협상 |
| `textDocument/didOpen` | 열린 문서 추적 |
| `textDocument/didChange` | 전체 문서 동기화 |
| `textDocument/didClose` | 문서 해제 |
| `textDocument/hover` | 커서 위치의 타입 정보 |
| `textDocument/definition` | 정의로 이동 |
| `textDocument/references` | 모든 참조 찾기 |
| `textDocument/completion` | 코드 완성 |
| `textDocument/signatureHelp` | 함수 시그니처 |
| `textDocument/diagnostic` | 파일 진단 |
| `textDocument/documentSymbol` | 파일 심볼 |
| `workspace/symbol` | 전역 심볼 검색 |
| `textDocument/prepareCallHierarchy` | 호출 계층 |
| `callHierarchy/incomingCalls` | 호출자 찾기 |
| `callHierarchy/outgoingCalls` | 피호출자 찾기 |

## 완성

완성 엔진은 코드 그래프를 통해 타입을 해석합니다. 다음을 제공합니다:

- `.` 및 `:` 뒤의 멤버 완성 (필드, 메서드)
- 지역 변수 완성
- 모듈 수준 심볼 완성
- 트리거 문자: `.`, `:`

## 진단

진단은 인덱싱 중에 계산되며 다음을 포함합니다:

- 파싱 오류 (구문 문제)
- 타입 검사 오류 (불일치, 정의되지 않은 심볼)
- 심각도 수준: error, warning, information, hint

진단은 문서 오버레이 시스템을 통해 입력하는 동안 업데이트됩니다.

## 같이 보기

- [린터](guides/linter.md) - CLI 기반 코드 검사
- [타입](lua/types.md) - 타입 시스템 문서
- [구성](guides/configuration.md) - 런타임 구성
