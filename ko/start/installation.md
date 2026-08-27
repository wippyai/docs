---
title: "설치"
description: "Wippy 런타임을 설치하고 명령을 사용할 수 있는지 확인합니다."
---

# 설치

## 설치

```bash
curl -fsSL https://hub.wippy.ai/install.sh | bash
```

설치 스크립트에는 POSIX shell이 필요합니다. Windows에서는 [hub.wippy.ai/releases](https://hub.wippy.ai/releases)에서 런타임을 다운로드하고 `wippy.exe`를 `PATH`에 추가하십시오.

## 확인

```bash
wippy version
```

## 의존성 메타데이터 초기화

```bash
# Create a project directory
mkdir myapp
cd myapp

# Create or update wippy.lock
wippy init
```

`wippy init`은 의존성 lock과 source 및 module directory 설정을 작성합니다. 애플리케이션 source file이나 registry entry를 scaffold하지는 않습니다. 실행 가능한 애플리케이션을 만들려면 [Hello World](../tutorials/hello-world.md)를 따르고 `wippy run`으로 시작하십시오.

런타임에는 HTTP, SQL, storage 및 process-hosting 기능이 포함됩니다. 애플리케이션에 필요한 framework module을 Hub에서 추가하십시오.

```bash
wippy add wippy/test
wippy install
```

## 명령어 개요

| 명령어 | 설명 |
|---------|-------------|
| `wippy init` | 새 프로젝트 초기화 |
| `wippy run` | 런타임 시작 |
| `wippy test` | 테스트 엔트리포인트 실행 |
| `wippy lint` | 코드 오류 검사 |
| `wippy add` | 의존성 추가 |
| `wippy install` | 의존성 설치 |
| `wippy update` | 의존성 업데이트 |
| `wippy pack` | 스냅샷 생성 |
| `wippy publish` | 허브에 퍼블리시 |
| `wippy search` | 모듈 검색 |
| `wippy readme` | Hub에서 모듈 README 가져오기 |
| `wippy registry` | 로드된 레지스트리 엔트리 검사 |
| `wippy auth` | 인증 관리 |
| `wippy version` | 버전 정보 출력 |

전체 문서는 [CLI 레퍼런스](../guides/cli.md)를 참조하십시오.

## 문제 해결

설치 후 shell에서 `wippy`를 찾지 못하면 shell을 다시 열고 설치 directory가 `PATH`에 있는지 확인하십시오.

## 다음 단계

- [Hello World](../tutorials/hello-world.md) — 첫 번째 애플리케이션 만들기
- [프로젝트 구조](./structure.md) — 프로젝트 레이아웃 이해하기
- [CLI 레퍼런스](../guides/cli.md) — 모든 명령과 옵션 검토하기
