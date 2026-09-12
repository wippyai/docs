---
title: "엔트리 리스너와 옵저버"
description: "listener와 observer가 matching entry-kind pattern의 registry mutation을 처리하는 방식을 설명합니다."
---

# 엔트리 리스너와 옵저버

entry listener와 observer는 matching entry-kind pattern의 registry mutation을 처리합니다.

이 페이지는 Go extension reference입니다. registration 및 configuration snippet은 기존 boot component, manager, transcoder, application config type을 가정합니다.

## 작동 방식

boot는 kind pattern과 함께 listener와 observer를 수집합니다. entry가 변경되면:

1. 레지스트리가 이벤트 발생 (`entry.create`, `entry.update`, `entry.delete`)
2. 핸들러 레지스트리가 등록된 패턴에 대해 엔트리 종류 매칭
3. 매칭하는 핸들러가 엔트리를 받음
4. 핸들러가 엔트리를 처리하거나 거부

## 종류 패턴

핸들러는 패턴을 사용하여 구독합니다:

| 패턴 | 매칭 |
|---------|---------|
| `http.service` | 정확한 매칭만 |
| `http.*` | `http.service`, `http.router`, `http.endpoint` |
| `function.**` | `function.lua`, `function.lua.bc` |

## 엔트리 리스너 인터페이스

핸들러는 `registry.EntryListener`를 구현합니다:

```go
type EntryListener interface {
    Add(ctx context.Context, entry Entry) error
    Update(ctx context.Context, entry Entry) error
    Delete(ctx context.Context, entry Entry) error
}
```

`Add`, `Update`, `Delete`에서 error를 반환하면 해당 operation이 거부됩니다.

## 리스너 vs 옵저버

| 타입 | 목적 | 거부 가능 |
|------|---------|------------|
| 리스너 | 기본 핸들러 | 예 |
| 옵저버 | 보조 핸들러 (로깅, 메트릭) | 아니오 |

```go
handlers.RegisterListener("http.*", httpManager)
handlers.RegisterObserver("function.*", metricsCollector)
```

observer의 `Add`, `Update`, `Delete` error는 무시되며 accept 또는 reject event를 emit하지 않습니다. `TransactionListener`도 구현하는 listener 또는 observer는 transaction barrier에 참여하며 `Begin`, `Commit`, `Discard`의 error가 해당 transaction phase를 reject합니다.

## 핸들러 등록

부트 중에 핸들러를 등록합니다:

```go
func MyService() boot.Component {
    return boot.New(boot.P{
        Name:      "myservice",
        DependsOn: []boot.Name{core.RegistryName},
        Load: func(ctx context.Context) (context.Context, error) {
            handlers := bootpkg.GetHandlerRegistry(ctx)
            handlers.RegisterListener("myservice.*", manager)
            return ctx, nil
        },
    })
}
```

## 엔트리 데이터 디코딩

엔트리 데이터를 언마샬하려면 `system/entry`의 `entry.DecodeEntryConfig`를 사용합니다. `DecodeEntryConfigFromContext`는 트랜스코더를 인수 대신 컨텍스트에서 가져오고, `DecodeEntryConfigRaw`는 플레이스홀더 해석을 건너뜁니다:

```go
func (m *Manager) Add(ctx context.Context, ent registry.Entry) error {
    cfg, err := entry.DecodeEntryConfig[ComponentConfig](ctx, m.dtt, ent)
    if err != nil {
        return err
    }
    // Process cfg...
    return nil
}
```

디코더는:
1. `${env:...}` 플레이스홀더와 `*_env` 동반 필드를 환경 레지스트리에 대해 해석
2. `entry.Data`를 설정 구조체로 언마샬
3. 구조체가 비워둔 경우 엔트리에서 `ID`와 `Meta` 채움
4. 구현되어 있으면 `InitDefaults()` 호출
5. 구현되어 있으면 `Validate()` 호출

## 설정 구조

엔트리 설정은 일반적으로 다음을 포함합니다:

```go
type ComponentConfig struct {
    ID      registry.ID `json:"id"`
    Meta    attrs.Bag   `json:"meta"`
    Name    string      `json:"name"`
    Timeout int         `json:"timeout,omitempty"`
}

func (c *ComponentConfig) InitDefaults() {
    if c.Timeout == 0 {
        c.Timeout = 30
    }
}

func (c *ComponentConfig) Validate() error {
    if c.Name == "" {
        return fmt.Errorf("name is required")
    }
    return nil
}
```

## 트랜잭션 지원

여러 엔트리에 걸친 원자적 작업의 경우 `TransactionListener`를 구현합니다:

```go
type TransactionListener interface {
    Begin(ctx context.Context) error
    Commit(ctx context.Context) error
    Discard(ctx context.Context) error
}
```

레지스트리는 배치 처리 전에 `Begin`을 호출하고, 성공 시 `Commit`, 실패 시 `Discard`를 호출합니다.

## 참고

- [레지스트리](internals/registry.md) - entry storage
- [아키텍처](internals/architecture.md) - boot sequence
