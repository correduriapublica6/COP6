# Control de Avalúos — versión conectada a red local

Esta carpeta conserva la aplicación de escritorio de **Correduría Pública 6** y ahora puede leer y guardar los avalúos en el servidor local central.

## Dirección del servidor

La aplicación está configurada para comunicarse con:

```text
http://192.168.100.16:3000/api
```

La PC de recepción debe tener encendido el servidor antes de abrir `index.html`. Si la dirección IPv4 de esa PC cambia, abre `app.js`, localiza la constante `API_BASE_URL` y reemplaza únicamente la dirección IP.

## Uso diario

En la PC de recepción, abre la carpeta `local-server` y ejecuta:

```text
npm start
```

La ventana negra debe permanecer abierta mientras los usuarios trabajen. Después, cada usuario abre `index.html` desde la carpeta compartida. Los registros de **Recepción**, sus pagos, usuarios, roles y folios de recibo se guardan en la base central del servidor.

## Avalúos técnicos

La sección **Avalúos** contiene ahora dos subtemas. **Recepción** conserva el control de pagos y los registros operativos actuales. **Crear avalúo** crea expedientes técnicos independientes, que no aparecen en los filtros, saldos ni reportes de Recepción.

La primera ficha habilitada es **Automotriz**. Puede contener varios vehículos por expediente, hasta cuatro fotografías comprimidas por vehículo y sus factores de obsolescencia. Los expedientes y las fotografías se guardan dentro de la misma base central, por lo que los usuarios autorizados de la red pueden consultarlos desde la aplicación actualizada.

## Actualización de red

Antes de actualizar, detén el servidor con `Ctrl+C` y conserva una copia de la carpeta `local-server\data`. Sustituye el archivo `local-server\server.mjs` por la versión incluida en esta actualización y vuelve a ejecutar `npm start`. La tabla de expedientes técnicos se crea automáticamente al iniciar el servidor; los registros existentes de Recepción no se modifican.

Entrega la carpeta `desktop` actualizada a cada equipo, sustituyendo los archivos existentes. Todos los equipos deben usar esta misma versión para crear y consultar los expedientes técnicos.

## Migración inicial

Antes de conectar esta versión, conserva un respaldo JSON generado desde la versión anterior. Entra como administrador, abre **Configuración**, selecciona el respaldo JSON y utiliza la importación. Elige **Reemplazar** únicamente si la base central está vacía y deseas cargar allí los registros existentes. Si ya hay información central, usa la opción de agregar o combinar disponible en la pantalla.

## Importante

No borres la carpeta original ni el respaldo histórico. La base central se crea en `local-server\\data\\control-avaluos.sqlite`. Esa carpeta debe incluirse en las copias de seguridad periódicas, con el servidor detenido para asegurar una copia consistente.
