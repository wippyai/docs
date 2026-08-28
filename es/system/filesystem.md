---
title: "Sistema de Archivos"
description: "Configure sistemas de archivos respaldados por directorios y sistemas de archivos embebidos de solo lectura."
---

# Sistema de Archivos

Las entradas de sistema de archivos exponen almacenamiento respaldado por directorios o almacenamiento embebido de solo lectura a los módulos en tiempo de ejecución. Esta página es una referencia de configuración; sus bloques YAML son fragmentos de entradas individuales, no proyectos completos.

## Tipos de Entrada

| Tipo | Descripción |
|------|-------------|
| `fs.directory` | Sistema de archivos basado en directorio |
| `fs.embed` | Sistema de archivos embebido de solo lectura |

## Sistema de Archivos de Directorio

```yaml
- name: uploads
  kind: fs.directory
  directory: "/var/data/uploads"
  auto_init: true
  mode: "0755"
```

| Campo | Tipo | Por Defecto | Descripción |
|-------|------|---------|-------------|
| `directory` | string | requerido | Ruta raíz |
| `auto_init` | bool | false | Crear directorio si no existe |
| `mode` | string | 0755 | Modo de permisos Unix (octal) |
| `base` | string | inferido | Base de las rutas relativas: `project` (directorio de trabajo del proceso) o `module` (raíz de recursos del módulo propietario) |

En una entrada propiedad de un módulo, si se omite `base`, los directorios relativos se resuelven desde la raíz de recursos del módulo propietario. Las entradas creadas por el host siguen siendo relativas al directorio de trabajo del proceso. Configure `base: project` para forzar la resolución desde el directorio de trabajo en una entrada de módulo, o `base: module` para solicitar explícitamente la resolución desde la raíz del módulo. Si no están disponibles la propiedad del módulo o su raíz de recursos, el runtime deja la ruta relativa sin cambios.

El modo configurado limita las operaciones según sus bits de propietario, y los permisos solicitados para archivos y directorios nuevos se enmascaran con ese modo. Cuando están presentes todos los bits de lectura pero no hay bits de ejecución, el runtime añade bits de ejecución (por ejemplo, `0444` se convierte en `0555`). Los permisos del sistema operativo siguen aplicándose al directorio subyacente.

<note>
Las rutas se normalizan y validan. No es posible acceder a archivos fuera del directorio raíz configurado.
</note>

## Sistema de Archivos Embebido

```yaml
- name: static
  kind: fs.embed
```

Los sistemas de archivos embebidos cargan desde recursos del pack usando el ID de entrada. Son de solo lectura.

<warning>
Los sistemas de archivos embebidos son un mecanismo interno. La configuración manual típicamente no es requerida.
</warning>

## Operaciones

Ambos tipos de sistema de archivos implementan:

| Operación | Directorio | Embebido |
|-----------|-----------|-------|
| Open/Read | Sí | Sí |
| Stat | Sí | Sí |
| Lstat | Sí | Sí |
| ReadDir | Sí | Sí |
| OpenFile (escribir) | Sí | No |
| Remove | Sí | No |
| Mkdir | Sí | No |
| Rename | Sí | No |
| Truncate | Sí | No |
| Chtimes | Sí | No |

Las operaciones de escritura en sistemas de archivos embebidos retornan un error.

## API Lua

Consulte el [módulo Filesystem](lua/storage/filesystem.md) para las operaciones de archivos.

## Ver También

- [Módulo Filesystem](lua/storage/filesystem.md) - Referencia de la API Lua
- [Cloud Storage](system/cloudstorage.md) - Almacenamiento de objetos compatible con S3
- [Template](system/template.md) - Plantillas cargadas desde sistemas de archivos
