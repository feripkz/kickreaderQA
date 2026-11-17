import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { createServer } from 'node:http';
import { WebSocket, WebSocketServer } from 'ws';

const port = Number(process.env.PORT || 8080);
const secret = process.env.KIVOZ_TIKTOK_SERVICE_SECRET;
const eulerApiKey = process.env.EULER_API_KEY;
const allowedOrigins = new Set((process.env.KIVOZ_ALLOWED_ORIGINS || '').split(',').map(value => value.trim()).filter(Boolean));
if (typeof secret !== 'string' || secret.length < 32) throw new Error('KIVOZ_TIKTOK_SERVICE_SECRET must contain at least 32 characters.');
if (typeof eulerApiKey !== 'string' || !eulerApiKey.trim()) throw new Error('EULER_API_KEY must be configured on the TikTok bridge.');
if (!allowedOrigins.size) throw new Error('KIVOZ_ALLOWED_ORIGINS must contain at least one exact app origin.');

const consumedNonces = new Map();
const activeUsers = new Map();
const httpServer = createServer((request, response) => {
  if (request.method === 'GET' && request.url === '/health') {
    response.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    response.end(JSON.stringify({ ok: true }));
    return;
  }
  response.writeHead(404, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
  response.end(JSON.stringify({ error: 'Not found.' }));
});
const webSocketServer = new WebSocketServer({ noServer: true, maxPayload: 4096 });

const rejectUpgrade = (socket, status, message) => {
  socket.write(`HTTP/1.1 ${status} ${message}\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`);
  socket.destroy();
};

const verifyToken = token => {
  if (typeof token !== 'string') return null;
  const [encoded, suppliedSignature, extra] = token.split('.');
  if (!encoded || !suppliedSignature || extra) return null;
  const expectedSignature = createHmac('sha256', secret).update(encoded).digest();
  let actualSignature;
  try { actualSignature = Buffer.from(suppliedSignature, 'base64url'); } catch { return null; }
  if (actualSignature.length !== expectedSignature.length || !timingSafeEqual(actualSignature, expectedSignature)) return null;
  try {
    const claims = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
    if (typeof claims.sub !== 'string' || !claims.sub || !Number.isSafeInteger(claims.exp) || claims.exp <= Date.now() || typeof claims.nonce !== 'string' || !/^[A-Za-z0-9_-]{20,40}$/.test(claims.nonce)) return null;
    for (const [nonce, expiry] of consumedNonces) if (expiry <= Date.now()) consumedNonces.delete(nonce);
    if (consumedNonces.has(claims.nonce)) return null;
    consumedNonces.set(claims.nonce, claims.exp);
    return claims;
  } catch {
    return null;
  }
};

httpServer.on('upgrade', (request, socket, head) => {
  const origin = request.headers.origin;
  if (typeof origin !== 'string' || !allowedOrigins.has(origin)) return rejectUpgrade(socket, 403, 'Forbidden');
  let url;
  try { url = new URL(request.url, 'http://localhost'); } catch { return rejectUpgrade(socket, 400, 'Bad Request'); }
  if (url.pathname !== '/live') return rejectUpgrade(socket, 404, 'Not Found');
  const channel = (url.searchParams.get('channel') || '').replace(/^@/, '');
  if (!/^[a-zA-Z0-9._]{2,24}$/.test(channel)) return rejectUpgrade(socket, 400, 'Bad Request');
  const claims = verifyToken(url.searchParams.get('token'));
  if (!claims) return rejectUpgrade(socket, 401, 'Unauthorized');
  webSocketServer.handleUpgrade(request, socket, head, client => {
    client.claims = claims;
    client.channel = channel;
    webSocketServer.emit('connection', client, request);
  });
});

webSocketServer.on('connection', client => {
  const current = activeUsers.get(client.claims.sub);
  if (current && current !== client) current.close(4001, 'Replaced by a newer connection.');
  activeUsers.set(client.claims.sub, client);
  const upstreamUrl = new URL('wss://ws.eulerstream.com');
  upstreamUrl.searchParams.set('uniqueId', client.channel);
  upstreamUrl.searchParams.set('apiKey', eulerApiKey);
  upstreamUrl.searchParams.set('features.rawMessages', 'false');
  upstreamUrl.searchParams.set('features.bundleEvents', 'true');
  upstreamUrl.searchParams.set('features.webcastPlatform', 'web');
  upstreamUrl.searchParams.set('features.schemaVersion', 'v2');
  const upstream = new WebSocket(upstreamUrl);
  let closed = false;
  let alive = true;
  let confirmed = false;
  let authExpiryTimer;
  const send = payload => {
    if (client.readyState === WebSocket.OPEN) client.send(JSON.stringify(payload));
  };
  const expireAuthorizationAt = expiresAt => {
    client.claims.exp = expiresAt;
    clearTimeout(authExpiryTimer);
    authExpiryTimer = setTimeout(() => client.close(4001, 'Authorization expired.'), Math.max(0, expiresAt - Date.now()));
  };
  expireAuthorizationAt(client.claims.exp);
  const stop = () => {
    if (closed) return;
    closed = true;
    clearInterval(heartbeat);
    clearTimeout(authExpiryTimer);
    if (activeUsers.get(client.claims.sub) === client) activeUsers.delete(client.claims.sub);
    if (upstream.readyState === WebSocket.OPEN) upstream.close();
    else if (upstream.readyState === WebSocket.CONNECTING) upstream.terminate();
  };
  const fail = message => {
    if (closed) return;
    send({ type: 'error', message });
    client.close(1011, 'TikTok LIVE connection failed.');
  };

  const confirmConnection = () => {
    if (confirmed) return;
    confirmed = true;
    send({ type: 'connected', channel: client.channel });
  };
  const handleEvent = event => {
    if (event?.type === 'roomInfo' || (event?.type === 'room.status' && event.data?.state === 'connected')) {
      confirmConnection();
      return;
    }
    if (event?.type === 'WebcastChatMessage') {
      const message = event.data || {};
      const user = message.user || {};
      const username = user.displayId || user.uniqueId || user.nickname;
      if (typeof username !== 'string' || typeof message.content !== 'string') return;
      const badges = [...(user.userBadges || []), ...(user.badgeList || [])];
      const badgeNames = badges.map(badge => String(badge.badgeScene || badge.type || badge.displayType || '').toLocaleLowerCase());
      const isModerator = Boolean(user.isModerator || user.isAdmin || badgeNames.some(name => /moderator|admin/.test(name)));
      const isSubscriber = Boolean(user.isSubscriber || badgeNames.some(name => /subscriber|subscribe|sub_badge/.test(name)));
      send({
        type: 'chat',
        id: String(message.common?.msgId || randomUUID()),
        channel: client.channel,
        username,
        content: message.content,
        isModerator,
        isSubscriber,
        roles: [...(isModerator ? ['moderator'] : []), ...(isSubscriber ? ['subscriber'] : [])],
      });
    } else if (event?.type === 'WebcastGiftMessage') {
      const username = event.data?.user?.displayId || event.data?.user?.uniqueId || event.data?.user?.nickname;
      if (typeof username === 'string') send({ type: 'gift', channel: client.channel, username });
    } else if (event?.type === 'room.status' && ['error', 'offline', 'ended'].includes(event.data?.state)) {
      fail('El directo de TikTok no está disponible o terminó. Comprueba el canal y vuelve a conectar.');
    }
  };
  upstream.on('message', raw => {
    let packet;
    try { packet = JSON.parse(raw.toString()); } catch { return fail('El servicio de TikTok devolvió un mensaje no válido.'); }
    const messages = Array.isArray(packet?.messages) ? packet.messages : [packet];
    messages.forEach(handleEvent);
  });
  upstream.on('error', () => fail('No se pudo conectar con el servicio gestionado de TikTok. Revisa la API key y el estado del servicio.'));
  upstream.on('close', code => {
    if (closed) return;
    const message = code === 4404
      ? 'El canal de TikTok no está en directo.'
      : code === 4429
        ? 'Se alcanzó el límite de conexiones del servicio de TikTok. Inténtalo más tarde.'
        : 'La conexión gestionada de TikTok se cerró. Comprueba que el LIVE siga activo y vuelve a conectar.';
    send({ type: 'error', message });
    client.close(1011, 'TikTok LIVE connection closed.');
  });
  client.on('message', raw => {
    let message;
    try { message = JSON.parse(raw.toString()); } catch { return client.close(1008, 'Invalid message.'); }
    if (message?.type !== 'auth') return client.close(1008, 'Unsupported message.');
    const refreshedClaims = verifyToken(message.token);
    if (!refreshedClaims || refreshedClaims.sub !== client.claims.sub) return client.close(4001, 'Authorization renewal failed.');
    expireAuthorizationAt(refreshedClaims.exp);
  });
  client.on('pong', () => { alive = true; });
  client.on('close', stop);
  client.on('error', stop);
  const heartbeat = setInterval(() => {
    if (!alive) return client.terminate();
    alive = false;
    client.ping();
  }, 30_000);

});

httpServer.listen(port, '0.0.0.0', () => {
  console.info(`TikTok LIVE bridge listening on port ${port}.`);
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    for (const client of webSocketServer.clients) client.close(1001, 'Service shutting down.');
    httpServer.close(() => process.exit(0));
  });
}
