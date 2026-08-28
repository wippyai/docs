---
title: "Módulos ligados a un proyecto no admitidos"
description: "Advertencia avanzada para módulos que abandonan intencionadamente la portabilidad frontend de Wippy."
---

# Módulos ligados a un proyecto no admitidos

**Clasificación: referencia normativa de políticas.** Define el marcador y el
resultado exigido para un flujo de conformidad elegido por el proyecto; la
familia de paquetes públicos no proporciona ese flujo como CLI ejecutable.

El contrato frontend admitido por Wippy es portable. Un módulo que requiera intencionadamente CSS privado de la fachada, clases privadas u otra suposición frontend específica de un despliegue es `UNSUPPORTED`.

No se trata de una excepción normal. El flujo de conformidad del proyecto debe imponer estos resultados:

- La comprobación de conformidad estándar devuelve exactamente `UNSUPPORTED`.
- La CI estándar falla.
- No se garantizan la reutilización, la portabilidad de temas, las actualizaciones ni el soporte.
- El propietario del módulo es responsable de cada fachada consumidora y de cada migración.

No denomine este modo «desaconsejado», «parcialmente conforme» ni «no conforme pero aceptado». El estado canónico es `UNSUPPORTED`.

El modo ligado a un proyecto es solo para uso avanzado y no aparece en el inicio rápido ni en las recetas estándar. No permite omitir accesibilidad, validez HTML, seguridad ni requisitos del esquema backend.

Que un proyecto completo esté destinado a un solo despliegue no relaja el contrato de forma implícita. El estado no admitido debe declararse expresamente en la política del proyecto y en los metadatos del módulo, y el fallo de la CI estándar debe gestionarse deliberadamente fuera del flujo de conformidad admitido por Wippy.

Declare el estado en `wippy-fe.contract.json`, en la raíz del módulo, con el campo y el valor exactos siguientes:

```json
{
  "portability": "project-bound"
}
```

No se aceptan `mode` ni otros alias. El flujo de conformidad debe hacer que este marcador devuelva `UNSUPPORTED` y termine con error; no concede una exención. La familia de paquetes públicos `@wippy-fe/*` 0.0.56 no incluye una CLI de conformidad de aplicaciones, por lo que el proyecto debe implementar esta comprobación en el flujo de conformidad que haya elegido.
