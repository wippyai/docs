# CLI 레퍼런스

Wippy 런타임의 커맨드라인 인터페이스입니다.

## 전역 플래그

모든 명령어에서 사용할 수 있습니다:

| 플래그 | 약어 | 설명 |
|------|-------|-------------|
| `--config` | | 설정 파일 (기본값: .wippy.yaml) |
| `--verbose` | `-v` | 디버그 로깅 활성화 |
| `--very-verbose` | | 스택 트레이스를 포함한 디버그 |
| `--console` | `-c` | 컬러 콘솔 로깅 |
| `--silent` | `-s` | 콘솔 로깅 비활성화 |
| `--event-streams` | `-e` | 이벤트 버스로 로그 스트리밍 |
| `--profiler` | `-p` | localhost:6060에서 pprof 활성화 |
| `--memory-limit` | `-m` | 메모리 제한 (예: 1G, 512M) |

메모리 제한 우선순위: `--memory-limit` 플래그 > `GOMEMLIMIT` 환경 변수 > 1GB 기본값.

## wippy init

새 lock 파일을 생성합니다.

```bash
wippy init
wippy init --src-dir ./src --modules-dir .wippy
```

| 플래그 | 약어 | 기본값 | 설명 |
|------|-------|---------|-------------|
| `--src-dir` | `-d` | ./src | 소스 디렉토리 |
| `--modules-dir` | | .wippy | 모듈 디렉토리 |
| `--lock-file` | `-l` | wippy.lock | Lock 파일 경로 |

## wippy run

런타임을 시작하거나 명령어를 실행합니다.

```bash
wippy run                                   # 런타임 시작
wippy run list                              # 사용 가능한 명령어 목록
wippy run test                              # 테스트 실행
wippy run snapshot.wapp                     # 팩 파일에서 실행
wippy run acme/http                         # 허브에서 모듈 실행
wippy run acme/http@1.2.3                   # 특정 버전 실행
wippy run --exec app:worker                 # 런타임을 시작하고 단일 프로세스 실행
```

| 플래그 | 약어 | 설명 |
|------|-------|-------------|
| `--override` | `-o` | 엔트리 값 오버라이드 (`namespace:entry:field=value`) |
| `--exec` | `-x` | 프로세스를 실행하고 종료 (`namespace:entry`) |
| `--host` | | `--exec`용 터미널 호스트 ID (`terminal.host`가 하나만 존재하면 자동 감지) |
| `--registry` | | 허브 모듈을 위한 레지스트리 URL |

## wippy lint

Lua 코드의 타입 오류 및 경고를 검사합니다.

```bash
wippy lint
wippy lint --level warning
wippy lint --json
wippy lint --rules
```

모든 Lua 엔트리를 검증합니다: `function.lua`, `library.lua`, `process.lua`, `workflow.lua` (해당 `.bc` 변형 포함).

| 플래그 | 약어 | 기본값 | 설명 |
|------|-------|---------|-------------|
| `--lock-file` | `-l` | `wippy.lock` | Lock 파일 경로 |
| `--level` | | `warning` | 최소 심각도: `error`, `warning`, `hint` |
| `--ns` | | | 네임스페이스 패턴으로 필터 (예: `app`, `lib.*`) |
| `--code` | | | 오류 코드로 필터 (예: `E0001,E0004`) |
| `--rules` | | `false` | 스타일/품질 lint 규칙 활성화 |
| `--summary` | | `false` | 오류 코드별로 출력 그룹화 |
| `--limit` | | `0` | 표시할 최대 진단 수 (0 = 무제한) |
| `--json` | | `false` | JSON 출력 |
| `--no-color` | | `false` | 컬러 출력 비활성화 |
| `--cache-reset` | | `false` | lint 전에 Lua 캐시 초기화 |

## wippy add

모듈 의존성을 추가합니다.

```bash
wippy add acme/http
wippy add acme/http@1.2.3
wippy add acme/http@latest
```

| 플래그 | 약어 | 기본값 | 설명 |
|------|-------|---------|-------------|
| `--lock-file` | `-l` | wippy.lock | Lock 파일 경로 |
| `--registry` | | | 레지스트리 URL |

## wippy install

Lock 파일에서 의존성을 설치합니다.

```bash
wippy install                            # 모두 설치
wippy install acme/http                  # 특정 모듈 설치
wippy install --refresh acme/http        # 특정 모듈 재로드
```

| 플래그 | 약어 | 기본값 | 설명 |
|------|-------|---------|-------------|
| `--lock-file` | `-l` | wippy.lock | Lock 파일 경로 |
| `--refresh` | | false | 모든 모듈을 캐시 무시하고 다시 가져오기 |
| `--force` | | false | `--refresh`의 별칭 |
| `--repair` | | false | `--refresh`의 별칭 |
| `--registry` | | | 레지스트리 URL |

## wippy update

의존성을 업데이트하고 lock 파일을 재생성합니다.

```bash
wippy update                      # 전체 업데이트
wippy update acme/http            # 특정 모듈 업데이트
wippy update acme/http demo/sql   # 여러 모듈 업데이트
```

| 플래그 | 약어 | 기본값 | 설명 |
|------|-------|---------|-------------|
| `--lock-file` | `-l` | wippy.lock | Lock 파일 경로 |
| `--src-dir` | `-d` | ./src | 소스 디렉토리 |
| `--modules-dir` | | .wippy | 모듈 디렉토리 |
| `--registry` | | | 레지스트리 URL |

## wippy pack

스냅샷 팩(.wapp 파일)을 생성합니다.

```bash
wippy pack snapshot.wapp
wippy pack release.wapp --description "Release 1.0"
wippy pack app.wapp --embed app:assets --bytecode **
```

| 플래그 | 약어 | 설명 |
|------|-------|-------------|
| `--lock-file` | `-l` | Lock 파일 경로 |
| `--description` | `-d` | 팩 설명 |
| `--tags` | `-t` | 팩 태그 (쉼표로 구분) |
| `--meta` | | 커스텀 메타데이터 (key=value) |
| `--embed` | | fs.directory 엔트리 임베드 (패턴) |
| `--list` | | fs.directory 엔트리 목록 (dry-run) |
| `--exclude-ns` | | 네임스페이스 제외 (패턴) |
| `--exclude` | | 엔트리 제외 (패턴) |
| `--bytecode` | | Lua를 바이트코드로 컴파일 (** 으로 전체 대상) |

## wippy publish

모듈을 허브에 퍼블리시합니다.

```bash
wippy publish
wippy publish --version 1.0.0
wippy publish --dry-run
```

현재 디렉토리의 `wippy.yaml`을 읽습니다.

| 플래그 | 설명 |
|------|-------------|
| `--version` | 퍼블리시할 버전 |
| `--dry-run` | 퍼블리시 없이 검증만 수행 |
| `--label` | 버전 대신 변경 가능한 레이블로 퍼블리시 |
| `--release-notes` | 릴리스 노트 |
| `--protected` | 버전을 보호됨으로 표시 |
| `--embed` | id 또는 name으로 fs.directory 엔트리 임베드 |
| `--config` | wippy.yaml이 있는 디렉토리 경로 (기본값: .) |
| `--registry` | 레지스트리 URL |
| `--create` | 레지스트리에 모듈이 존재하지 않으면 새로 생성 |
| `--module-visibility` | 새로 생성되는 모듈의 공개 범위 (`--create` 전용): `public` 또는 `private` (기본값: private) |
| `--module-type` | 새로 생성되는 모듈의 타입 (`--create` 전용): `library`, `application`, `agent`, 또는 `plugin` (기본값: application) |
| `--module-display-name` | 새로 생성되는 모듈의 표시 이름 (`--create` 전용) |

## wippy search

허브에서 모듈을 검색합니다.

```bash
wippy search http
wippy search "sql driver" --limit 20
wippy search auth --json
```

| 플래그 | 기본값 | 설명 |
|------|---------|-------------|
| `--json` | false | JSON으로 출력 |
| `--limit` | 20 | 최대 결과 수 |
| `--registry` | | 레지스트리 URL |

## wippy auth

레지스트리 인증을 관리합니다.

### wippy auth login

```bash
wippy auth login
wippy auth login --token YOUR_TOKEN
```

| 플래그 | 설명 |
|------|-------------|
| `--token` | API 토큰 |
| `--registry` | 레지스트리 URL |
| `--local` | 자격 증명을 로컬에 저장 |

### wippy auth logout

```bash
wippy auth logout
```

| 플래그 | 설명 |
|------|-------------|
| `--registry` | 레지스트리 URL |
| `--local` | 로컬 자격 증명 제거 |

### wippy auth status

```bash
wippy auth status
wippy auth status --json
```

| 플래그 | 설명 |
|------|-------------|
| `--json` | JSON으로 출력 |

## wippy readme

허브에서 모듈의 README를 가져옵니다.

```bash
wippy readme wippy/terminal
wippy readme wippy/terminal@1.2.3
wippy readme --json wippy/terminal@latest
```

| 플래그 | 설명 |
|------|-------------|
| `--json` | JSON으로 출력 |
| `--registry` | 레지스트리 URL (기본값: 자격 증명에서) |

## wippy registry

레지스트리 엔트리를 조회하고 검사합니다.

### wippy registry list

```bash
wippy registry list
wippy registry list --kind "function.lua.*"
wippy registry list --ns "app.*" --json
wippy registry list --meta "type=api" --meta "enabled=true"
```

| 플래그 | 약어 | 설명 |
|------|-------|-------------|
| `--kind` | `-k` | 종류별 필터 (glob 패턴) |
| `--ns` | `-n` | 네임스페이스별 필터 (glob 패턴) |
| `--name` | | 이름별 필터 (glob 패턴) |
| `--meta` | | 메타데이터별 필터 (반복 가능) |
| `--json` | | JSON으로 출력 |
| `--yaml` | | YAML로 출력 |
| `--lock-file` | `-l` | Lock 파일 경로 |

`--meta`의 메타데이터 연산자:

| 연산자 | 의미 |
|--------|------|
| `field=value` | 정확히 일치 |
| `field~regex` | 정규식 일치 |
| `field*substr` | 부분 문자열 포함 |
| `field^prefix` | 접두사로 시작 |
| `field$suffix` | 접미사로 끝남 |

### wippy registry show

```bash
wippy registry show app:http:handler
wippy registry show app:config --yaml
```

| 플래그 | 약어 | 설명 |
|------|-------|-------------|
| `--field` | `-f` | 특정 필드 표시 |
| `--json` | | JSON으로 출력 |
| `--yaml` | | YAML로 출력 |
| `--raw` | | 원시 출력 |
| `--lock-file` | `-l` | Lock 파일 경로 |

## wippy version

버전 정보를 출력합니다.

```bash
wippy version
wippy version --short
```

## 커스텀 명령어

모든 `process.lua` 또는 `process.wasm` 엔트리는 `command` 메타데이터를 추가하여 이름이 있는 명령어로 등록할 수 있습니다:

```yaml
entries:
  - name: test_runner
    kind: process.lua
    meta:
      command:
        name: test
        short: Run application tests
    source: file://runner.lua
    method: main
    modules:
      - io
      - registry
      - funcs
```

다음과 같이 실행합니다:

```bash
wippy run test
```

사용 가능한 모든 명령어를 나열합니다:

```bash
wippy run list
```

### 명령어 메타데이터 필드

| 필드 | 필수 | 설명 |
|-------|----------|-------------|
| `name` | 예 | `wippy run <name>`으로 사용하는 명령어 이름 |
| `short` | 아니오 | `wippy run list`에 표시되는 간단한 설명 |
| `main` | 아니오 | 이 엔트리를 기본 명령어로 표시 (단일 명령어를 제공하는 팩과 허브 모듈에서 자동으로 선택됨) |

모든 프로세스 엔트리 종류(`process.lua`, `process.wasm`)를 사용할 수 있습니다. 명령어 이름은 로드된 모든 엔트리에서 고유해야 합니다. 명령어 이름 뒤의 인수는 문자열 페이로드로 프로세스에 전달됩니다.

## 예제

### 개발 워크플로우

```bash
# 프로젝트 초기화
wippy init
wippy add wippy/http wippy/sql
wippy install

# 오류 검사
wippy lint

# 디버그 출력과 함께 실행
wippy run -c -v

# 로컬 개발을 위한 설정 오버라이드
wippy run -o app:db:host=localhost -o app:db:port=5432
```

### 프로덕션 배포

```bash
# 바이트코드로 릴리스 팩 생성
wippy pack release.wapp --bytecode ** --exclude-ns test.**

# 메모리 제한과 함께 팩에서 실행
wippy run release.wapp -m 2G
```

### 디버깅

```bash
# 단일 프로세스 실행
wippy run --exec app:worker

# 프로파일러 활성화와 함께
wippy run -p -v
# 이후: go tool pprof http://localhost:6060/debug/pprof/heap
```

### 의존성 관리

```bash
# 새 의존성 추가
wippy add acme/http@latest

# 강제 재다운로드
wippy install --force

# 특정 모듈 업데이트
wippy update acme/http
```

### 퍼블리싱

```bash
# 허브에 로그인
wippy auth login

# 모듈 검증
wippy publish --dry-run

# 퍼블리시
wippy publish --version 1.0.0 --release-notes "Initial release"
```

## 설정 파일

영구적인 설정을 위해 `.wippy.yaml`을 생성합니다:

```yaml
logger:
  encoding: console

logmanager:
  min_level: -1  # debug

profiler:
  enabled: true
  address: localhost:6060

override:
  app:gateway:addr: ":9090"
  app:db:host: "localhost"
```

## 참고

- [설정](guides/configuration.md) - 설정 파일 레퍼런스
- [관측성](guides/observability.md) - 모니터링 및 로깅
