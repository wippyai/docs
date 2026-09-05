---
title: "Módulos Ligados al Proyecto No Soportados"
description: "Advertencia avanzada para módulos que abandonan intencionadamente la portabilidad del frontend de Wippy."
---

# Módulos Ligados al Proyecto No Soportados

El contrato de frontend soportado de Wippy es portable. Un módulo que intencionadamente requiere CSS privado del facade del proyecto, clases privadas u otra suposición de frontend específica del despliegue es `UNSUPPORTED`.

Esta no es una excepción normal:

- La conformidad estándar devuelve exactamente `UNSUPPORTED`.
- El CI estándar falla.
- No se garantizan la reutilización, la portabilidad de temas, las actualizaciones ni el soporte.
- El propietario del módulo es responsable de cada facade consumidor y de cada migración.

No etiquete este modo como "desaconsejado", "parcialmente conforme" ni "no conforme pero aceptado". El estado canónico es `UNSUPPORTED`.

El modo ligado al proyecto es solo para uso avanzado y no se presenta en el Quickstart ni en las recetas estándar. No puede eximir de los requisitos de accesibilidad, validez HTML, seguridad ni esquema del backend.

Que un proyecto entero esté destinado a un solo despliegue no relaja el contrato en silencio. El estado no soportado debe ser explícito en la política del proyecto y en los metadatos del módulo, con el fallo de CI estándar gestionado deliberadamente fuera del flujo de conformidad soportado de Wippy.

Declare el estado en el `wippy-fe.contract.json` de la raíz del módulo con el
campo y el valor exactos de abajo:

```json
{
  "portability": "project-bound"
}
```

`mode` y otros alias no se aceptan. Este marcador hace que el comando de
conformidad estándar devuelva `UNSUPPORTED` y termine sin éxito; no concede una
exención.
