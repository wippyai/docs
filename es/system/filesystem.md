# Sistema de Archivos

Acceso a directorio y sistema de archivos embebido.

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

El modo restringe todas las operaciones de archivo. Los bits de ejecución se agregan automáticamente cuando los bits de lectura están presentes.

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
| ReadDir | Sí | Sí |
| OpenFile (escribir) | Sí | No |
| Remove | Sí | No |
| Mkdir | Sí | No |

Las operaciones de escritura en sistemas de archivos embebidos retornan un error.

## API Lua

Ver [Módulo Filesystem](lua-fs.md) para operaciones de archivo.
