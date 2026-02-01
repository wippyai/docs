# CLI 레퍼런스

Wippy 런타임 커맨드라인 인터페이스.

## 전역 플래그

모든 명령어에서 사용 가능:

| 플래그 | 단축 | 설명 |
|------|-------|-------------|
| `--config` | | 설정 파일 (기본값: .wippy.yaml) |
| `--verbose` | `-v` | 디버그 로깅 활성화 |
| `--very-verbose` | | 스택 트레이스 포함 디버그 |
| `--console` | `-c` | 컬러 콘솔 로깅 |
| `--silent` | `-s` | 콘솔 로깅 비활성화 |
| `--event-streams` | `-e` | 이벤트 버스로 로그 스트리밍 |
| `--profiler` | `-p` | localhost:6060에서 pprof 활성화 |
| `--memory-limit` | `-m` | 메모리 제한 (예: 1G, 512M) |

메모리 제한 우선순위: `--memory-limit` 플래그 > `GOMEMLIMIT` 환경변수 > 1GB 기본값.

## wippy init

새 lock 파일 생성.

```bash
wippy init
wippy init --src-dir ./src --modules-dir .wippy
```

| 플래그 | 단축 | 기본값 | 설명 |
|------|-------|---------|-------------|
| `--src-dir` | `-d` | ./src | 소스 디렉토리 |
| `--modules-dir` | | .wippy | 모듈 디렉토리 |
| `--lock-file` | `-l` | wippy.lock | lock 파일 경로 |

## wippy run

런타임 시작 또는 명령 실행.

```bash
wippy run                                    # 런타임 시작
wippy run list                               # 사용 가능한 명령 목록
wippy run test                               # 테스트 실행
wippy run snapshot.wapp                      # pack 파일에서 실행
wippy run acme/http                          # 모듈 실행
wippy run --exec app:processes/app:worker   # 단일 프로세스 실행
```

| 플래그 | 단축 | 설명 |
|------|-------|-------------|
| `--override` | `-o` | 엔트리 값 오버라이드 (namespace:entry:field=value) |
| `--exec` | `-x` | 프로세스 실행 후 종료 (host/namespace:entry) |
| `--host` | | 실행용 호스트 |
| `--registry` | | 레지스트리 URL |

## wippy lint

Lua 코드의 타입 오류와 경고 검사.

```bash
wippy lint
wippy lint --level warning
```

모든 Lua 엔트리 검증: `function.lua.*`, `library.lua.*`, `process.lua.*`, `workflow.lua.*`.

| 플래그 | 설명 |
|------|-------------|
| `--level` | 보고할 최소 심각도 레벨 |

## wippy add

모듈 의존성 추가.

```bash
wippy add acme/http
wippy add acme/http@1.2.3
wippy add acme/http@latest
```

| 플래그 | 단축 | 기본값 | 설명 |
|------|-------|---------|-------------|
| `--lock-file` | `-l` | wippy.lock | lock 파일 경로 |
| `--registry` | | | 레지스트리 URL |

## wippy install

lock 파일에서 의존성 설치.

```bash
wippy install
wippy install --force
wippy install --repair
```

| 플래그 | 단축 | 설명 |
|------|-------|-------------|
| `--lock-file` | `-l` | lock 파일 경로 |
| `--force` | | 캐시 우회, 항상 다운로드 |
| `--repair` | | 해시 검증, 불일치 시 재다운로드 |
| `--registry` | | 레지스트리 URL |

## wippy update

의존성 업데이트 및 lock 파일 재생성.

```bash
wippy update                      # 전체 업데이트
wippy update acme/http            # 특정 모듈 업데이트
wippy update acme/http demo/sql   # 여러 모듈 업데이트
```

| 플래그 | 단축 | 기본값 | 설명 |
|------|-------|---------|-------------|
| `--lock-file` | `-l` | wippy.lock | lock 파일 경로 |
| `--src-dir` | `-d` | . | 소스 디렉토리 |
| `--modules-dir` | | .wippy | 모듈 디렉토리 |
| `--registry` | | | 레지스트리 URL |

## wippy pack

스냅샷 pack (.wapp 파일) 생성.

```bash
wippy pack snapshot.wapp
wippy pack release.wapp --description "Release 1.0"
wippy pack app.wapp --embed app:assets --bytecode **
```

| 플래그 | 단축 | 설명 |
|------|-------|-------------|
| `--lock-file` | `-l` | lock 파일 경로 |
| `--description` | `-d` | pack 설명 |
| `--tags` | `-t` | pack 태그 (쉼표 구분) |
| `--meta` | | 커스텀 메타데이터 (key=value) |
| `--embed` | | fs.directory 엔트리 임베드 (패턴) |
| `--list` | | fs.directory 엔트리 목록 (dry-run) |
| `--exclude-ns` | | 네임스페이스 제외 (패턴) |
| `--exclude` | | 엔트리 제외 (패턴) |
| `--bytecode` | | Lua를 바이트코드로 컴파일 (** 전체) |

## wippy publish

모듈을 허브에 퍼블리시.

```bash
wippy publish
wippy publish --version 1.0.0
wippy publish --dry-run
```

현재 디렉토리의 `wippy.yaml`에서 읽습니다.

| 플래그 | 설명 |
|------|-------------|
| `--version` | 퍼블리시할 버전 |
| `--dry-run` | 퍼블리시 없이 검증 |
| `--label` | 버전 라벨 |
| `--release-notes` | 릴리스 노트 |
| `--registry` | 레지스트리 URL |

## wippy search

허브에서 모듈 검색.

```bash
wippy search http
wippy search "sql driver" --limit 20
wippy search auth --json
```

| 플래그 | 설명 |
|------|-------------|
| `--json` | JSON으로 출력 |
| `--limit` | 최대 결과 수 |
| `--registry` | 레지스트리 URL |

## wippy auth

레지스트리 인증 관리.

### wippy auth login

```bash
wippy auth login
wippy auth login --token YOUR_TOKEN
```

| 플래그 | 설명 |
|------|-------------|
| `--token` | API 토큰 |
| `--registry` | 레지스트리 URL |
| `--local` | 로컬에 자격 증명 저장 |

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

## wippy registry

레지스트리 엔트리 쿼리 및 검사.

### wippy registry list

```bash
wippy registry list
wippy registry list --kind function.lua
wippy registry list --ns app --json
```

| 플래그 | 단축 | 설명 |
|------|-------|-------------|
| `--kind` | `-k` | kind로 필터 |
| `--ns` | `-n` | 네임스페이스로 필터 |
| `--name` | | 이름으로 필터 |
| `--meta` | | 메타데이터로 필터 |
| `--json` | | JSON으로 출력 |
| `--yaml` | | YAML로 출력 |
| `--lock-file` | `-l` | lock 파일 경로 |

### wippy registry show

```bash
wippy registry show app:http:handler
wippy registry show app:config --yaml
```

| 플래그 | 단축 | 설명 |
|------|-------|-------------|
| `--field` | `-f` | 특정 필드 표시 |
| `--json` | | JSON으로 출력 |
| `--yaml` | | YAML로 출력 |
| `--raw` | | raw 출력 |
| `--lock-file` | `-l` | lock 파일 경로 |

## wippy version

버전 정보 출력.

```bash
wippy version
wippy version --short
```

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

# 로컬 개발용 설정 오버라이드
wippy run -o app:db:host=localhost -o app:db:port=5432
```

### 프로덕션 배포

```bash
# 바이트코드로 릴리스 pack 생성
wippy pack release.wapp --bytecode ** --exclude-ns test.**

# 메모리 제한과 함께 pack에서 실행
wippy run release.wapp -m 2G
```

### 디버깅

```bash
# 단일 프로세스 실행
wippy run --exec app:processes/app:worker

# 프로파일러 활성화와 함께
wippy run -p -v
# 그 다음: go tool pprof http://localhost:6060/debug/pprof/heap
```

### 의존성 관리

```bash
# 새 의존성 추가
wippy add acme/http@latest

# 손상된 모듈 복구
wippy install --repair

# 강제 재다운로드
wippy install --force

# 특정 모듈 업데이트
wippy update acme/http
```

### 퍼블리싱

```bash
# 허브 로그인
wippy auth login

# 모듈 검증
wippy publish --dry-run

# 퍼블리시
wippy publish --version 1.0.0 --release-notes "Initial release"
```

## 설정 파일

영구 설정을 위해 `.wippy.yaml` 생성:

```yaml
logger:
  mode: development
  level: debug
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

- [설정](guide-configuration.md) - 설정 파일 레퍼런스
- [관측성](guide-observability.md) - 모니터링 및 로깅
