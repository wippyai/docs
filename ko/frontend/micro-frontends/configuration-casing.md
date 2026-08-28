---
title: "설정과 대소문자 표기"
description: "백엔드 facade, 레지스트리, 프런트엔드 설정 경계의 대소문자 표기 규칙입니다."
---

# 설정과 대소문자 표기

**분류: 스키마 경계 레퍼런스.** YAML 블록은 형태를 보여 주는 발췌이며 완전한 레지스트리 항목이 아닙니다.

대소문자 표기는 스키마 경계를 따릅니다. 설정 객체 전체를 재귀적으로 변환하지 마세요.

| 경계 | 규칙 | 예시 |
|---|---|---|
| 백엔드 facade 요구 사항 이름 | 최상위 `lower_case_with_underscore` | `custom_css`, `css_variables` |
| 레지스트리 필드 | 각 필드가 문서화된 레지스트리 스키마를 따름 | `base_path`, `entry_point`, `tag_name` |
| 백엔드 YAML이 전달하는 중첩 프런트엔드 설정 | lower camelCase 유지 | `customCSS`, `themeConfig`, `iconifyIcons` |
| 프런트엔드 AppConfig와 패키지 메타데이터 | lower camelCase | `configOverrides`, `hostCssKeys` |

```yaml
config_overrides:
  customization:
    customCSS: ""
    cssVariables: {}
  routePrefix: /admin

proxy:
  injections:
    css:
      themeConfig: true
      customCss: true
      iframe: true
```

이 예제에서는 백엔드 래퍼 키만 snake case입니다. 중첩된 프런트엔드 객체는 그대로 전달되며 정의된 표기를 유지합니다.

## `mountRoute` 표기 예외

현재 view 레지스트리 스키마는 `meta.mountRoute`를 읽어 레지스트리 내부의 `mount_route` 필드에 저장하고, API 출력에서는 다시 `mountRoute`를 사용합니다. 이 lower-camel-case 작성 필드는 문서화된 하나의 예외로 취급하세요. 레지스트리나 백엔드 필드가 일반적으로 camelCase라는 근거로 삼으면 안 됩니다.
