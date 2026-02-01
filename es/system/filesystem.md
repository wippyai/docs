# Sistema de Archivos

Acceso a directorio y sistema de archivos embebido.

## Tipos de Entrada

| Tipo | Descripcion |
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

| Campo | Tipo | Por Defecto | Descripcion |
|-------|------|---------|-------------|
| `directory` | string | requerido | Ruta raiz |
| `auto_init` | bool | false | Crear directorio si no existe |
| `mode` | string | 0755 | Modo de permisos Unix (octal) |

El modo restringe todas las operaciones de archivo. Los bits de ejecucion se agregan automaticamente cuando los bits de lectura estan presentes.

<note>
Las rutas se normalizan y validan. No es posible acceder a archivos fuera del directorio raiz configurado.
</note>

## Sistema de Archivos Embebido

```yaml
- name: static
  kind: fs.embed
```

Los sistemas de archivos embebidos cargan desde recursos del pack usando el ID de entrada. Son de solo lectura.

<warning>
Los sistemas de archivos embebidos son un mecanismo interno. La configuracion manual tipicamente no es requerida.
</warning>

## Operaciones

Ambos tipos de sistema de archivos implementan:

| Operacion | Directorio | Embebido |
|-----------|-----------|-------|
| Open/Read | Si | Si |
| Stat | Si | Si |
| ReadDir | Si | Si |
| OpenFile (escribir) | Si | No |
| Remove | Si | No |
| Mkdir | Si | No |

Las operaciones de escritura en sistemas de archivos embebidos retornan un error.

## API Lua

Ver [Modulo Filesystem](lua-fs.md) para operaciones de archivo.
