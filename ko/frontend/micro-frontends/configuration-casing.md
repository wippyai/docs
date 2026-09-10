---
title: "설정과 표기 규칙"
description: "백엔드 파사드, Registry, 프런트엔드 설정 경계에서의 표기 규칙입니다."
---

# 설정과 표기 규칙

표기 방식은 스키마 경계를 따릅니다. 설정 객체를 재귀적으로 변환하지 마십시오.

| 경계 | 규칙 | 예시 |
|---|---|---|
| 백엔드 파사드 requirement 이름 | 최상위는 `lower_case_with_underscore` | `custom_css`, `css_variables` |
| Registry 필드 | 각 필드는 문서화된 Registry 스키마를 따름 | `base_path`, `entry_point`, `tag_name` |
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

이 예시에서 snake case인 것은 백엔드 래퍼 키뿐입니다. 중첩된 프런트엔드 객체는 그대로 전달되며 정의된 표기를 유지합니다.

## 임시 mountRoute 예외

`meta.mountRoute`는 현재 백엔드 호환성 버그입니다. 의도된 백엔드 필드는 `meta.mount_route`이지만, 백엔드 수정이 배포되기 전까지 기존 배포 환경은 `mountRoute`를 요구합니다. 이를 명시적인 단일 예외로 취급하고, Registry나 백엔드 필드가 일반적으로 camelCase라는 근거로 삼지 마십시오.

컴플라이언스는 백엔드 스키마가 변경될 때 제거할 수 있도록 이 예외에 버전을 지정해야 합니다.
