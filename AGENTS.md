# Arquitectura de Kivoz

Aplicación React estática con Vite y un Netlify Server independiente. No usar una plantilla de framework SSR ni una redirección global que intercepte `/api/*`. Los archivos de `dist` tienen prioridad y el servidor solo recibe `/api/*`.

- `src/main.jsx`: aplicación en español, navegación por estado, preferencias, voces del dispositivo, conexión pública a Kick, filtros, cola y actividad temporal.
- `src/styles.css`: diseño oscuro oliva con acentos lima, sidebar adaptable, controles de estudio y ajustes para movimiento reducido.
- `netlify/server/index.mjs`: única entrada del servidor Express; valida peticiones, resuelve canales de Kick y persiste preferencias. Requiere Node 24 para importar los módulos TypeScript de datos.
- `db/schema.ts` y `db/index.ts`: esquema y adaptador Drizzle de Netlify Database.
- `netlify/database/migrations/`: migraciones que la plataforma aplica al desplegar.
- `index.html` y `public/`: metadatos, tipografías y favicon.

Utilizar Netlify Database para persistencia. Las versiones beta de Drizzle incluyen el adaptador `drizzle-orm/netlify-db`; mantener ambas dependencias Drizzle compatibles. Generar una migración descriptiva después de cada cambio del esquema, sin aplicarla manualmente.

Las preferencias están aisladas por cookie HttpOnly, Secure y SameSite. No añadir IDs predecibles o un registro global compartido de configuración. No imprimir datos sensibles. El historial y la cola son efímeros intencionadamente: solo se guardan las preferencias.

El SDK de Pusher gestiona las reconexiones del chat público. Su identificador en el cliente es público y no concede acceso de escritura. Kick puede bloquear su endpoint público o cambiar el protocolo; mantener visibles los errores y nunca simular conexión, mensajes ni conteos. La suscripción se considera activa solo al recibir confirmación. No existe OAuth ni envío de mensajes. Los filtros leen los badges proporcionados por Kick; no son autorización del backend.

La voz se reproduce en el navegador con `speechSynthesis`, no en el servidor. Mantener los refs sincronizados para que los callbacks del chat y de voz usen la configuración actual. Cancelar callbacks de utterances antes de saltar para evitar que callbacks antiguos avancen la cola. Cambios en filtros afectan mensajes nuevos; cambios de voz se aplican a la siguiente lectura. Mantener componentes de campos fuera de App para conservar foco y arrastre de sliders.

Los textos visibles deben estar en español. Mantener estados vacíos honestos, etiquetas accesibles, foco de teclado y diseño móvil. No ejecutar builds, servidores ni pruebas locales en las sesiones del agente: la plataforma valida el despliegue. Revisar los archivos editados.
