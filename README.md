# Kivoz

Kivoz es un estudio web en español que lee comentarios públicos de Kick y TikTok LIVE. Incluye cuentas con acceso por contraseña, preferencias separadas por usuario, modo claro/oscuro y un panel privado para administrar usuarios. Usa voces del navegador y permite configurar el comando de activación (inicialmente `!aa`), velocidad, tono, volumen, lectura del usuario y reglas de moderación.

## Uso

Inicia sesión con tu cuenta, elige la pestaña **Kick** o **TikTok LIVE**, introduce el canal y pulsa **Conectar canal**. Cada plataforma conserva su propio usuario/canal; ambas pueden permanecer conectadas y comparten la misma cola, filtros y salida de voz local. Usa **Probar voz** para comprobar el audio. Los comentarios con el comando seguido de un espacio y texto entran en la cola. **Guardar cambios** conserva las preferencias y asignaciones de voz en tu cuenta.

Mantén la pestaña abierta y con sonido durante el directo. Para transmitir las voces, captura el audio del navegador en OBS. La lectura y la asignación de voces ocurren en el dispositivo y no bloquean la conexión de chat. Las voces dependen del sistema operativo y del navegador; se recomienda Chrome o Edge con voces en español instaladas. **Voces Plus+** muestra las voces `es-CL` que ya existan en ese dispositivo; Kivoz no descarga voces ni envía textos a un servicio de síntesis. No se incluyen imitaciones de personas reales.

En **Voces** puedes asignar una voz por usuario, rol, suscriptor o donador/regalador, para Kick, TikTok o ambas. El usuario específico tiene prioridad sobre los criterios generales. En TikTok se reconoce como donador a quien envía un regalo durante la sesión. En Kick solo se puede usar esa condición si el mensaje público incluye un distintivo de donador; la conexión pública actual no recibe eventos de donaciones de Kick.

El administrador puede crear cuentas de usuario desde **Configuración**. Las nuevas cuentas tienen acceso al estudio, pero no al panel administrativo. La misma pantalla permite revocar su acceso. La primera cuenta administradora se crea una sola vez con un token secreto configurado en el servidor; no hay credenciales predeterminadas ni registro público. Las preferencias anónimas guardadas antes de habilitar cuentas no se asignan automáticamente: vuelve a guardarlas después de iniciar sesión para asociarlas a tu cuenta.

Kick usa sus endpoints públicos y Pusher; no solicita credenciales ni publica mensajes. TikTok usa el WebSocket gestionado de Euler Stream a través de un servicio Node persistente independiente en `services/tiktok-live/`, porque Netlify Functions no mantiene WebSockets de larga duración. La API key de Euler solo se configura en ese servicio y nunca se envía al navegador. Los comentarios públicos de TikTok se transmiten por la infraestructura de Euler; revisa sus condiciones, privacidad y límites vigentes antes de habilitarlo. No se introducen mensajes o métricas simulados. La actividad muestra los últimos 150 mensajes de la sesión; la cola admite 50 mensajes pendientes y no recupera mensajes perdidos durante una desconexión.

## Tecnologías

React, Vite, Lucide, CSS adaptable, Web Speech API y Pusher JS en el navegador. Express en Netlify Server resuelve los canales, autentica cuentas y guarda usuarios, sesiones y preferencias por usuario en Netlify Database (Postgres), mediante Drizzle ORM. El servicio Node persistente de TikTok valida tokens firmados de vida corta emitidos por Netlify y conecta con Euler Stream; ninguno de esos secretos se expone al navegador. El cliente renueva la autorización periódicamente y el puente cierra la conexión si deja de recibirla. Las contraseñas se derivan con scrypt; el servidor guarda solo el hash de cada token de sesión, y la cookie de sesión es HttpOnly, Secure y SameSite=Strict. Las sesiones caducan a los 30 días. La cola, los contadores y la actividad son temporales y se eliminan al recargar.

## Conexión de TikTok LIVE

Despliega `services/tiktok-live/` como un **servicio Node 24 con WebSockets persistentes**, en un host independiente de Netlify. No lo despliegues en Netlify Functions ni uses un host que corte conexiones WebSocket. Para mantener conexiones estables durante un directo, usa una instancia que no suspenda el proceso; las instancias gratuitas pueden dormir y provocar demoras al iniciar. Despliega el directorio con `npm install` y `npm start`, y configura:

- `KIVOZ_TIKTOK_SERVICE_SECRET`: el mismo secreto aleatorio de al menos 32 caracteres en el servicio y en Netlify. No lo pongas en variables `VITE_`, el repositorio ni el navegador.
- `EULER_API_KEY`: una API key de [Euler Stream](https://www.eulerstream.com), solo en las variables privadas del servicio Node. No la configures en Netlify como variable `VITE_` ni la compartas con el navegador.
- `KIVOZ_ALLOWED_ORIGINS`: origen exacto de la web de producción, por ejemplo `https://tu-sitio.netlify.app` (sin `/` final). Puedes enumerar varios orígenes separados por comas.
- `VITE_TIKTOK_SERVICE_URL`: URL HTTPS pública del servicio, por ejemplo `https://tu-servicio.example.com`, en las variables de build de Netlify. El cliente la convierte a `wss://` al conectar.

En Netlify conserva `KIVOZ_TIKTOK_SERVICE_SECRET` y configura allí también `VITE_TIKTOK_SERVICE_URL`. Después de configurar las variables, vuelve a desplegar tanto el servicio como la web. El botón de TikTok solo se considera conectado al recibir la confirmación de sala del WebSocket gestionado. El puente no guarda mensajes ni credenciales de TikTok; la transmisión se enruta por Euler Stream. La disponibilidad, la cuota y las condiciones del proveedor pueden cambiar y deben revisarse en su cuenta antes de usarlo en directo.

## Primer acceso y administración

1. Genera un token aleatorio de al menos 32 caracteres, por ejemplo con `node -p "require('node:crypto').randomBytes(32).toString('hex')"`.
2. Configura el resultado como variable de entorno `KIVOZ_ADMIN_SETUP_TOKEN` en el entorno de despliegue de Netlify. No lo incluyas en el repositorio ni lo compartas con los usuarios.
3. Después de desplegar, abre Kivoz y crea el primer administrador con ese token y una contraseña de al menos 12 caracteres. El alta inicial se cierra automáticamente cuando ya existe una cuenta.
4. Entra en **Configuración** para crear cuentas normales, eliminar usuarios, cambiar tu contraseña y el tema, y guardar preferencias. Las cuentas administradoras no se pueden eliminar desde el panel.

Si la base de datos no contiene una cuenta y falta el token de despliegue, la aplicación bloquea el acceso y muestra cómo habilitar el alta inicial. No hay un bypass de desarrollo ni una contraseña de respaldo.

## Desarrollo local

Requiere Node.js 24 o posterior y un proyecto Netlify vinculado.

```sh
npm install
netlify dev --port 8889
```

Netlify Dev ejecuta el frontend y emula el backend. Define `KIVOZ_ADMIN_SETUP_TOKEN` en el entorno local antes de crear la primera cuenta. La plataforma provisiona la base de datos y aplica las migraciones durante el despliegue. Para probar TikTok localmente, inicia también el puente con `KIVOZ_TIKTOK_SERVICE_SECRET`, `EULER_API_KEY`, `KIVOZ_ALLOWED_ORIGINS=http://localhost:8889` y `VITE_TIKTOK_SERVICE_URL` apuntando a su URL accesible.

El código fuente está en `src/`, el servidor en `netlify/server/` y el esquema en `db/schema.ts`. Los cambios de esquema deben acompañarse de una migración generada con `npx drizzle-kit generate --name nombre_descriptivo`. No apliques las migraciones manualmente.
