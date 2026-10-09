---
title: "Proveedores de Iconify"
description: "Configure fuentes en línea de Iconify o una colección local para Web Host."
---

# Proveedores de Iconify

Web Host usa fuentes en línea de Iconify de forma predeterminada. Configure `AppConfig.iconify.providers` solo cuando el despliegue necesite otra fuente. La colección local de Tabler de esta página es una opción explícita para despliegues sin conexión. No cambia la fuente predeterminada.

## Configurar un proveedor

`providers` se organiza por ID de proveedor de Iconify. Use la clave vacía (`""`) para el proveedor integrado o un ID en minúsculas con guiones para un proveedor con nombre. Cada valor contiene una lista ordenada y no vacía `resources` de orígenes HTTP(S). El Host prueba esos orígenes en orden y no añade una fuente pública a la lista configurada.

```ts
interface IconifyConfig {
  providers?: Record<string, {
    resources: string[]
    path?: string
    timeout?: number
  } | null> | null
}
```

`path` usa `/` de forma predeterminada y se normaliza con barras inicial y final. `timeout` usa 5000 milisegundos de forma predeterminada y acepta enteros positivos hasta 60000. Los valores de recursos son orígenes. No incluya credenciales, consulta, fragmento ni ruta base.

## Cómo usar Wippy sin conexión

El despliegue debe servir su propia copia de la colección en un servidor accesible para el navegador. El CDN público de Web Host funciona en línea y no ofrece la aplicación ni otros servicios sin conexión. La versión de Host incluye `iconify/tabler.json`.

```ts
const config = {
  iconify: {
    providers: {
      "": {
        resources: ["http://localhost:5173"],
        path: "/iconify/",
      },
    },
  },
}
```

Para pruebas locales, sirva la salida de Host para que `dist/iconify/tabler.json` esté disponible en `/iconify/tabler.json`. En despliegue, use un origen propio y una ruta versionada:

```ts
const deploymentConfig = { iconify: { providers: { "": { resources: ["https://wippy-host.internal"], path: "/webcomponents-<host-release>/iconify/" } } } }
```

Sustituya `<host-release>` por la versión fijada. El servidor debe devolver JSON con `application/json` y permitir solicitudes del origen de la aplicación. Iconify envía `?icons=...`; el espejo ignora esa consulta y devuelve la colección completa. La búsqueda no está disponible.

La colección se basa en Tabler 3.41.1, licencia MIT, autoría de Paweł Kuna. Los metadatos declaran 6092 iconos; la fuente contiene 6140 definiciones y 184 alias. SHA-256: `cf18f905479c5ca5d0be13217e17d240deea3c457b70b2ae84bcaa0d5a98a51c`.

### Servir correctamente el espejo

El servidor estático forma parte de la configuración sin conexión. Debe devolver el archivo como `application/json`, permitir mediante CORS las solicitudes del origen de la aplicación, comprimir JSON cuando el navegador lo admita y devolver un 404 real si falta la colección. No almacene en caché un archivo ausente como si la respuesta fuera correcta. Las rutas versionadas pueden usar caché inmutable. Para una ruta sin versión, exija revalidación con `ETag` o `Last-Modified`.

Este ejemplo de Nginx presupone que los archivos están en `/srv/wippy/host/webcomponents-<host-release>/iconify/tabler.json`, que la aplicación tiene exactamente el origen indicado y que los certificados TLS se configuran fuera de este bloque. Sustituya el origen y la raíz por los valores del despliegue. El fragmento no instala módulos de Nginx ni configura TLS:

```nginx
server {
    location ~ ^/webcomponents-[^/]+/iconify/ {
        root /srv/wippy/host;
        default_type application/json;
        add_header Access-Control-Allow-Origin "https://app.example.com" always;
        add_header Vary Origin always;
        add_header Cache-Control "public, max-age=31536000, immutable";
        gzip on;
        gzip_types application/json;
        gzip_vary on;
        try_files $uri =404;
    }
}
```

Para una ruta sin versión, sustituya la política inmutable por una política de revalidación, como `Cache-Control: no-cache`, y habilite `ETag` o `Last-Modified`. Antes de usar el espejo, compruebe que el servidor comprime JSON y devuelve las políticas de caché, CORS y MIME esperadas, además de un 404 real cuando falta el archivo.

## Proveedores con nombre e iconos

Use `@proveedor:prefijo:nombre`, por ejemplo `@tenant:tabler:home`. Vue y el elemento personalizado usan el mismo nombre.

```ts
const namedConfig = { iconify: { providers: { tenant: { resources: ["https://icons.example.internal"], path: "/tenant/" } } } }
```

```vue
<script setup lang="ts">
import { Icon } from '@iconify/vue'
</script>

<Icon icon="@tenant:tabler:home" />
<iconify-icon icon="@tenant:tabler:settings"></iconify-icon>
```

La fuente cubre solo solicitudes de colecciones de iconos. Las API, las fuentes tipográficas y otros recursos de Kickside necesitan su propio soporte sin conexión.

## Restablecer y actualizar

Si `iconify` se omite en la configuración inicial, se usan los valores en línea. Si se omite en una actualización posterior, la configuración Iconify actual no cambia. `iconify: null` o `providers: null` restablecen toda la sección y eliminan proveedores con nombre. El proveedor vacío con valor `null` restablece solo el proveedor integrado. Un proveedor con nombre y valor `null` desactiva ese espacio de nombres. Las claves omitidas conservan sus rutas. Un objeto `providers` vacío no restablece la configuración.

Solo se admiten `providers` y los campos `resources`, `path` y `timeout`. Una sección inicial no válida se ignora; una actualización no válida conserva la última válida. `timeout` establece un único plazo para la solicitud lógica y todos los orígenes configurados. Cada intento de reserva usa el tiempo restante de ese mismo plazo. Solo se reconoce como colección completa una coincidencia byte a byte con la colección Tabler fijada, y solo cuando está disponible Web Crypto SHA-256. Esa respuesta se almacena con la URL del endpoint sin la consulta. Las demás respuestas se almacenan con su URL completa, incluida la consulta. Sin `crypto.subtle`, como puede ocurrir con HTTP no seguro, el adaptador usa caché por consulta y el almacén de Iconify aún puede usar su caché nativa por icono. Las cachés del adaptador tienen un límite combinado de 32 URL. Reemplazar una colección en la misma URL no borra las respuestas, los iconos resueltos ni los resultados negativos del almacén nativo de Iconify. Si fallan todos los orígenes configurados, el adaptador informa de un error temporal, pero un cargador nativo puede guardar los nombres sin resolver como ausentes. Cambiar de proveedor no vuelve a solicitar ese nombre. Recargue el documento para repetir la solicitud de red. Las API públicas `addIcon` y `addCollection` de Iconify pueden añadir datos de iconos, pero no restablecen las cachés generales. Los errores de transporte o las respuestas no válidas prueban el siguiente origen; una respuesta válida sin icono se informa como no encontrado. `iconifyIcons` controla la carga y el registro del elemento `<iconify-icon>`, no la fuente. AppConfig envía valores explícitos a las aplicaciones secundarias. Los esquemas 2.0 y 2.1 se migran a 2.2. Consulte [Secuencia de bootstrap](./bootstrap.md), [Inyección de CSS](./css-injection.md), [API de proxy](../micro-frontends/proxy-api.md) y [Facade](../../framework/facade.md).

## Provider trust and updates

Usa solo orígenes de proveedores de confianza. La página representa el contenido de los iconos como marcado SVG. Usa `wippy-context-2.2` en las nuevas cargas `SetConfig`. Se aceptan y migran las cargas versionadas `wippy-context-2.0` y `wippy-context-2.1`; las cargas 1.0 sin esquema no pueden incluir los nuevos campos `iconify` e `importMap`. Cambiar de proveedor afecta a los iconos que aún no se han cargado; no borra las respuestas en caché ni los iconos ya renderizados. Abre un documento nuevo para comprobar el cambio.

## Versiones del esquema

Use `wippy-context-2.2` en las configuraciones nuevas. Las entradas con versión `wippy-context-2.0` y `wippy-context-2.1` se migran. Las entradas sin `$schema` usan el convertidor heredado obsoleto. Este convierte los campos heredados conocidos, pero no conserva los campos nuevos `iconify` e `importMap`. El esquema generado comprueba la forma JSON y los límites de los campos. El runtime también comprueba que los orígenes usen HTTP(S) y que las rutas cumplan las reglas del Host. Un valor puede superar la validación del esquema y aun así rechazarse en runtime.

## Overlay de desarrollo

Ejecute la aplicación consumidora con Vite y `@wippy-fe/vite-plugin` habilitado; el plugin entrega al overlay de desarrollo los ajustes Wippy de `package.json`. Haga clic en el botón flotante **Wippy Dev**, abra **Configuration**, añada `iconify.providers` en **App Config (JSON)** y pulse **Accept**. En el primer inicio, **Accept** permite que la aplicación termine de cargar. El navegador guarda los ajustes aceptados. Después de cambiar los ajustes de una aplicación que ya está en marcha, recárguela antes de comprobar el cambio: **Accept** guarda los ajustes, pero no actualiza la configuración que ya usa la aplicación. Con Auto-accept activado, la consola también muestra `Config updated (reload to apply)`.
