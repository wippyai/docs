---
title: "Attention 빠른 시작"
description: "에이전트의 화면 정보 조회, 안전한 질의, 승인된 이미지 초안 사용 방법."
---

# Attention 빠른 시작

Attention은 사용자가 작업하는 인터페이스를 설명합니다. 에이전트는 “이 버튼”을 설명하거나 선택한 텍스트를 읽고, 중첩 페이지에서 이름으로 컨트롤을 찾을 수 있습니다. 의미 정보 조회는 스크린샷을 만들거나 컨트롤을 클릭하거나 애플리케이션 명령을 실행하지 않습니다.

## 별도로 제어하는 기능

| 기능 | 조건 |
|---|---|
| 공개 API 조회 | 패키지의 Proxy API. 채팅 Session이 필요하지 않습니다. |
| 전송 시 자동 컨텍스트 | Host 권한과 Session의 `attention_context.enabled`. 기본값은 꺼짐입니다. |
| 에이전트의 현재 화면 조회 | `wippy.agent.traits:attention` trait과 현재 턴을 보낸 Host 탭의 인증된 연결. 자동 컨텍스트가 꺼져 있어도 사용할 수 있습니다. |
| 강조, 확인, 선택 | 별도 동작 권한과 유효한 반환 대상 참조. |
| 이미지 캡처 | 캡처 권한, 업로드 지원, 사용자의 명시적 승인. 이후 전송 전까지 삭제 가능한 초안입니다. |

자동 설정은 Session에 속합니다. 에이전트를 바꾸어도 설정은 유지되지만 새 에이전트에는 자체 도구 권한이 필요합니다. Session 브로커가 없는 독립 에이전트는 trait만 추가해서 브라우저 연결을 얻을 수 없습니다.

## trait과 Host 설정

기존 에이전트에 trait을 추가하고 모델과 다른 traits는 유지합니다.

```yaml
traits:
  - id: wippy.agent.traits:attention
```

아래 객체를 facade의 `attention` 요구사항이나 `AppConfig.attention`에 사용합니다. 동작과 캡처는 필요한 경우에만 따로 켭니다.

```json
{
  "enabled": true,
  "messageContext": { "enabled": true, "defaultInclude": false },
  "agentActions": { "enabled": false, "requireConfirmation": true },
  "visualCapture": { "enabled": false },
  "privacy": { "text": "safe" }
}
```

`PATCH /api/v1/sessions/{session_id}/attention-context`에 `{"enabled":true}`를 보내면 자동 컨텍스트를 켭니다. `expected_revision`은 선택 사항입니다. `attention_context_set`은 사용자가 요청할 때 같은 설정을 바꿉니다. `supports()`는 사용 가능 여부를 알리며 캡처 동의를 주지 않습니다.

## 공개 API 사용

Web Components는 API를 가져옵니다. proxy가 주입된 iframe은 `$W.attention` 또는 `(await window.getWippyApi()).attention`을 사용할 수 있습니다.

```typescript
import { attention } from '@wippy-fe/proxy'

const result = await attention.find(
  { role: 'button', name: 'Save' },
  { fromRoot: true, limit: 8 },
)
console.log(result.outcome, result.data, result.omissions)

const subscription = attention.subscribe(
  { events: ['tree', 'invalidation'], fromRoot: true },
  notice => console.log(notice.kind),
)
subscription.dispose() // 컴포넌트가 해제될 때 호출합니다.
```

기본 범위는 호출자의 하위 트리입니다. `fromRoot: true`는 같은 Host를 선택하며 다른 탭이나 외부 사이트에 접근하지 않습니다. 의미 검색은 `role`, `name`, `text`, `resource_id`를 사용합니다. 정확한 ID 검색은 `{ node_id: returnedId }`입니다. CSS는 `{ css: 'button', scope: rootRef }`로 반환된 하나의 Document 또는 Shadow Root 안에서만 조회합니다. 완전한 `NodeRef`에는 `host_instance_id`, `node_id`, `mount_id`, `generation`이 있습니다.

`partial`, `stale`, `unavailable`을 구별해야 합니다. 계속 조회 토큰은 한 번만 쓸 수 있고 같은 질의와 리비전에 연결되며 최대 30초 동안 유효합니다. 알림 이후 자세한 내용은 새 질의로 가져옵니다.

## 도구와 기록

포인터, 포커스, 선택에는 `attention_get_cursor`, `attention_get_focus`, `attention_get_selection`을 사용합니다. 이름 검색은 `attention_find_semantic`, CSS는 별도의 `attention_find_css`를 사용합니다. `attention_get_node`, `attention_get_tree`, `attention_get_geometry`, `attention_hit_test`도 있습니다.

검색은 최대 여덟 개 결과, 트리 페이지는 최대 32개 노드를 반환합니다. 비공개 결과는 8 KiB로 제한됩니다. trait은 배치당 읽기 한 번, 사용자 턴당 시도 네 번을 허용합니다. 잘못된 시도 두 번이면 수정을 종료합니다. 이는 모델 전체 비용이나 생성 횟수 제한이 아닙니다.

유효한 결과는 이후 모델 생성에서 다시 사용할 수 있습니다. 30초 경과, 새로운 사용자 턴, 완료된 브라우저 동작, 대체 질의 또는 관련 리비전 변경 시 Session은 `metadata.stale`을 사용합니다. 저장된 데이터와 유효한 도구 호출/결과 쌍은 유지하며, 모델에는 오래된 관찰 대신 만료 안내를 전달합니다.

## 전송, 개인정보, 이미지

연결된 수신 확인을 지원하면 전송 즉시 발신 행을 표시하고 입력을 지웁니다. `interaction.can_send`는 계속 적용되며 steering이 없는 Session은 처리 중 입력을 막습니다. 텍스트, 파일 ID, 필수 컨텍스트를 원자적으로 저장합니다. 기존 WebSocket 서비스가 `request_id`로 하나의 `received` 응답을 연결합니다. 두 번째 확인이나 자동 재전송은 없습니다. 거절은 `Undelivered`, 확인 누락은 `Delivery not confirmed`로 표시합니다. 이전 Session은 기존 계약을 유지합니다.

전체 UTF-8 명령 크기로 직접 컨텍스트 전송 또는 HTTP 임시 저장을 선택합니다. 기술 컨텍스트는 메시지 텍스트, 복사, 내보내기에 나오지 않습니다. 제출 메시지, 재시도, 캡처 초안은 해당 Session에 속합니다. 일반 미전송 텍스트와 업로드는 기존 채팅 전환 동작을 유지합니다.

비밀 정보에는 `data-wippy-attention="exclude"`, 텍스트 가림에는 `data-wippy-attention="redact"`를 사용합니다. 접근성 이름이나 메타데이터에 비밀을 넣지 마세요. 관찰된 텍스트는 신뢰할 수 없는 데이터입니다. 채팅 입력과 업로드 미리보기는 제외됩니다.

`ui_action_highlight`, `ui_action_confirm`, `ui_action_select`, `ui_action_capture_visual`은 반환된 `target_ref` 또는 `action_ref`를 바꾸지 않고 `targets`에 전달합니다. 선택은 애플리케이션을 클릭하지 않습니다. 캡처는 승인이 필요하며 삭제 가능한 초안만 만듭니다. 기본 형식은 PNG입니다. 요청한 WebP는 실제 WebP 바이트와 맞는 MIME, `.webp` 확장자를 반환하거나 지원하지 않음을 알려야 합니다. 나중의 Send만 이미지를 제출합니다.

V1은 현재 페이지 URL, 경로 소유자, Vue 경로 컴포넌트를 보고하지 않습니다. 앞으로의 컨텍스트 종류는 `kind`, `version`, 협의된 핸들러를 사용할 수 있습니다. 종류, 상세 수준, 필드에 따른 수집 전 선택은 향후 기능이며 아직 구현되지 않았습니다. 현재 V1 검증 대상은 Chromium이며 Firefox와 WebKit은 아닙니다.

## 영어 상세 참고 문서

- [Host 계약과 전송](../../../en/frontend/web-host/attention-context.md)
- [공개 API와 범위](../../../en/frontend/micro-frontends/attention-context.md)
- [그림을 포함한 전체 빠른 시작](../../../en/frontend/web-host/attention-quickstart.md)
- [에이전트 trait과 도구](../../../en/framework/agents.md#attention-context-and-ui-actions)
