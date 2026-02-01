# 설치

## 빠른 설치

```bash
curl -fsSL https://hub.wippy.ai/install.sh | bash
```

또는 [hub.wippy.ai/releases](https://hub.wippy.ai/releases)에서 직접 다운로드하세요.

## 확인

```bash
wippy version
```

## 빠른 시작

```bash
# 새 프로젝트 생성
mkdir myapp && cd myapp
wippy init

# 의존성 추가
wippy add wippy/http
wippy install

# 실행
wippy run
```

## 명령어 개요

| 명령어 | 설명 |
|---------|-------------|
| `wippy init` | 새 프로젝트 초기화 |
| `wippy run` | 런타임 시작 |
| `wippy lint` | 코드 오류 검사 |
| `wippy add` | 의존성 추가 |
| `wippy install` | 의존성 설치 |
| `wippy update` | 의존성 업데이트 |
| `wippy pack` | 스냅샷 생성 |
| `wippy publish` | 허브에 퍼블리시 |
| `wippy search` | 모듈 검색 |
| `wippy auth` | 인증 관리 |
| `wippy version` | 버전 정보 출력 |

전체 문서는 [CLI 레퍼런스](guides/cli.md)를 참조하세요.

## 다음 단계

- [Hello World](tutorials/hello-world.md) - 첫 번째 프로젝트 생성
- [프로젝트 구조](start/structure.md) - 레이아웃 이해
- [CLI 레퍼런스](guides/cli.md) - 모든 명령어와 옵션
