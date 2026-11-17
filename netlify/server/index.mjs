import express from 'express';
import {
  createHash,
  createHmac,
  randomBytes,
  randomUUID,
  scrypt as scryptCallback,
  timingSafeEqual,
} from 'node:crypto';
import { promisify } from 'node:util';
import { and, desc, eq, sql } from 'drizzle-orm';
import { db } from '../../db/index.ts';
import { sessions, userPreferences, users } from '../../db/schema.ts';

const app = express();
const scrypt = promisify(scryptCallback);
const AUTH_COOKIE = 'kivoz_auth';
const SESSION_DURATION = 30 * 24 * 60 * 60 * 1000;
const DEFAULT_SETTINGS = {
  channel: '',
  tiktokChannel: '',
  command: '!aa',
  voice: '',
  voiceRules: [],
  rate: 1,
  pitch: 1,
  volume: 0.8,
  readName: true,
  skipLinks: true,
  skipEmotes: true,
  cooldown: 3,
  maxLength: 200,
  blocked: '',
  audience: 'all',
};

app.disable('x-powered-by');
app.use(express.json({ limit: '16kb' }));
app.use('/api', (req, res, next) => {
  res.set('Cache-Control', 'no-store');
  if (req.method !== 'GET' && req.method !== 'HEAD' && req.method !== 'OPTIONS') {
    const origin = req.headers.origin;
    const protocol = req.headers['x-forwarded-proto'] || req.protocol;
    if (!origin || origin !== `${protocol}://${req.headers.host}`) {
      return res.status(403).json({ error: 'Origen no permitido.' });
    }
  }
  next();
});

const setupToken = () => process.env.KIVOZ_ADMIN_SETUP_TOKEN;
const setupTokenIsConfigured = () => typeof setupToken() === 'string' && setupToken().length >= 32;
const tokenHash = token => createHash('sha256').update(token).digest('hex');
const readAuthToken = req => {
  const cookie = (req.headers.cookie || '').split(';').map(part => part.trim());
  const value = cookie.find(part => part.startsWith(`${AUTH_COOKIE}=`))?.slice(AUTH_COOKIE.length + 1);
  return value && /^[A-Za-z0-9_-]{43}$/.test(value) ? value : null;
};
const passwordHash = async password => {
  const salt = randomBytes(16).toString('hex');
  const hash = await scrypt(password, salt, 64);
  return `scrypt$${salt}$${hash.toString('hex')}`;
};
const passwordMatches = async (password, storedHash) => {
  const [, salt, expectedHex] = storedHash.split('$');
  if (!salt || !/^[a-f0-9]{128}$/i.test(expectedHex || '')) return false;
  const expected = Buffer.from(expectedHex, 'hex');
  const actual = await scrypt(password, salt, expected.length);
  return timingSafeEqual(actual, expected);
};
const textMatches = (provided, expected) => {
  const providedBuffer = Buffer.from(provided || '');
  const expectedBuffer = Buffer.from(expected || '');
  return providedBuffer.length === expectedBuffer.length && timingSafeEqual(providedBuffer, expectedBuffer);
};
const setAuthCookie = (res, token) => res.cookie(AUTH_COOKIE, token, {
  httpOnly: true,
  secure: true,
  sameSite: 'strict',
  maxAge: SESSION_DURATION,
  path: '/',
});
const clearAuthCookie = res => res.clearCookie(AUTH_COOKIE, {
  httpOnly: true,
  secure: true,
  sameSite: 'strict',
  path: '/',
});
const issueSession = async (user, res) => {
  const token = randomBytes(32).toString('base64url');
  await db.insert(sessions).values({
    tokenHash: tokenHash(token),
    userId: user.id,
    expiresAt: new Date(Date.now() + SESSION_DURATION),
  });
  setAuthCookie(res, token);
};
const requireAuth = async (req, res, next) => {
  const token = readAuthToken(req);
  if (!token) return res.status(401).json({ error: 'Inicia sesión para continuar.' });
  try {
    const [row] = await db.select({
      id: users.id,
      username: users.username,
      role: users.role,
      expiresAt: sessions.expiresAt,
    }).from(sessions)
      .innerJoin(users, eq(sessions.userId, users.id))
      .where(eq(sessions.tokenHash, tokenHash(token)));
    if (!row || row.expiresAt <= new Date()) {
      if (row) await db.delete(sessions).where(eq(sessions.tokenHash, tokenHash(token)));
      clearAuthCookie(res);
      return res.status(401).json({ error: 'Tu sesión ha caducado. Inicia sesión de nuevo.' });
    }
    req.user = { id: row.id, username: row.username, role: row.role };
    next();
  } catch {
    res.status(503).json({ error: 'No se pudo validar la sesión. Inténtalo de nuevo.' });
  }
};
const requireAdmin = (req, res, next) => {
  if (req.user?.role !== 'admin') return res.status(403).json({ error: 'Esta acción requiere permisos de administrador.' });
  next();
};
const validUsername = value => typeof value === 'string' && /^[a-zA-Z0-9._-]{3,32}$/.test(value);
const validPassword = value => typeof value === 'string' && value.length >= 12 && value.length <= 128;
const publicUser = ({ id, username, role }) => ({ id, username, role });

app.get('/api/auth/status', async (req, res) => {
  try {
    const [user] = await db.select({ id: users.id }).from(users).limit(1);
    const token = readAuthToken(req);
    let currentUser = null;
    if (token) {
      const [row] = await db.select({
        id: users.id,
        username: users.username,
        role: users.role,
        expiresAt: sessions.expiresAt,
      }).from(sessions)
        .innerJoin(users, eq(sessions.userId, users.id))
        .where(eq(sessions.tokenHash, tokenHash(token)));
      if (row?.expiresAt > new Date()) currentUser = publicUser(row);
      else clearAuthCookie(res);
    }
    res.json({
      user: currentUser,
      setupRequired: !user,
      setupAvailable: !user && setupTokenIsConfigured(),
    });
  } catch {
    res.status(503).json({ error: 'No se pudo comprobar el estado de la cuenta.' });
  }
});

app.post('/api/auth/setup', async (req, res) => {
  const { username, password, setupToken: submittedToken } = req.body || {};
  if (!setupTokenIsConfigured()) return res.status(503).json({ error: 'El alta inicial no está habilitada. Configura KIVOZ_ADMIN_SETUP_TOKEN en el servidor.' });
  if (typeof submittedToken !== 'string' || !textMatches(submittedToken, setupToken())) return res.status(403).json({ error: 'El token de configuración no es válido.' });
  if (!validUsername(username) || !validPassword(password)) {
    return res.status(400).json({ error: 'Usa un nombre de 3 a 32 caracteres y una contraseña de 12 a 128 caracteres.' });
  }
  try {
    const user = await db.transaction(async tx => {
      await tx.execute(sql`LOCK TABLE ${users} IN SHARE ROW EXCLUSIVE MODE`);
      const [existing] = await tx.select({ id: users.id }).from(users).limit(1);
      if (existing) return null;
      const [created] = await tx.insert(users).values({
        id: randomUUID(),
        username: username.toLowerCase(),
        passwordHash: await passwordHash(password),
        role: 'admin',
      }).returning({ id: users.id, username: users.username, role: users.role });
      return created;
    });
    if (!user) return res.status(409).json({ error: 'La cuenta administradora ya está configurada. Inicia sesión.' });
    await issueSession(user, res);
    res.status(201).json({ user: publicUser(user) });
  } catch (error) {
    if (error?.code === '23505') return res.status(409).json({ error: 'Ese nombre de usuario ya está en uso.' });
    res.status(503).json({ error: 'No se pudo crear la cuenta administradora.' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body || {};
  if (typeof username !== 'string' || !validUsername(username.trim()) || typeof password !== 'string' || password.length > 128) {
    return res.status(400).json({ error: 'Escribe tu nombre de usuario y contraseña.' });
  }
  try {
    const [user] = await db.select().from(users).where(eq(users.username, username.trim().toLowerCase()));
    const matches = user
      ? await passwordMatches(password, user.passwordHash)
      : await scrypt(password, 'kivoz-auth-dummy-salt', 64).then(() => false);
    if (!user || !matches) return res.status(401).json({ error: 'El nombre de usuario o la contraseña no son válidos.' });
    await issueSession(user, res);
    res.json({ user: publicUser(user) });
  } catch {
    res.status(503).json({ error: 'No se pudo iniciar sesión. Inténtalo de nuevo.' });
  }
});

app.post('/api/auth/logout', async (req, res) => {
  const token = readAuthToken(req);
  try {
    if (token) await db.delete(sessions).where(eq(sessions.tokenHash, tokenHash(token)));
    clearAuthCookie(res);
    res.json({ ok: true });
  } catch {
    res.status(503).json({ error: 'No se pudo cerrar la sesión. Inténtalo de nuevo.' });
  }
});

app.put('/api/auth/password', requireAuth, async (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  if (typeof currentPassword !== 'string' || currentPassword.length > 128 || !validPassword(newPassword)) {
    return res.status(400).json({ error: 'La nueva contraseña debe tener entre 12 y 128 caracteres.' });
  }
  try {
    const [user] = await db.select({ passwordHash: users.passwordHash }).from(users).where(eq(users.id, req.user.id));
    if (!user || !await passwordMatches(currentPassword, user.passwordHash)) {
      return res.status(400).json({ error: 'La contraseña actual no es válida.' });
    }
    const newHash = await passwordHash(newPassword);
    const token = randomBytes(32).toString('base64url');
    await db.transaction(async tx => {
      await tx.update(users).set({ passwordHash: newHash }).where(eq(users.id, req.user.id));
      await tx.delete(sessions).where(eq(sessions.userId, req.user.id));
      await tx.insert(sessions).values({
        tokenHash: tokenHash(token),
        userId: req.user.id,
        expiresAt: new Date(Date.now() + SESSION_DURATION),
      });
    });
    setAuthCookie(res, token);
    res.json({ ok: true });
  } catch {
    res.status(503).json({ error: 'No se pudo actualizar la contraseña.' });
  }
});

app.get('/api/settings', requireAuth, async (req, res) => {
  try {
    const [row] = await db.select().from(userPreferences).where(eq(userPreferences.userId, req.user.id));
    res.json({ settings: row?.settings || DEFAULT_SETTINGS, theme: row?.theme || 'dark' });
  } catch {
    res.status(503).json({ error: 'No se han podido recuperar los ajustes. Puedes continuar y volver a guardarlos.' });
  }
});

app.put('/api/settings', requireAuth, async (req, res) => {
  const s = req.body;
  const validVoiceRule = rule => rule && typeof rule.id === 'string' && rule.id.length <= 36
    && ['username', 'role', 'subscriber', 'donor'].includes(rule.type)
    && ['all', 'kick', 'tiktok'].includes(rule.platform)
    && typeof rule.voice === 'string' && rule.voice.length > 0 && rule.voice.length <= 300
    && (rule.type === 'username'
      ? typeof rule.value === 'string' && /^[a-zA-Z0-9._-]{1,32}$/.test(rule.value)
      : rule.type === 'role'
        ? ['moderator', 'broadcaster'].includes(rule.value)
        : rule.value === '');
  if (!s || typeof s.channel !== 'string' || !/^[a-zA-Z0-9_-]{0,60}$/.test(s.channel) || typeof s.tiktokChannel !== 'string' || !/^[a-zA-Z0-9._]{0,24}$/.test(s.tiktokChannel) || typeof s.command !== 'string' || !/^\S{1,20}$/.test(s.command) || typeof s.voice !== 'string' || s.voice.length > 300 || !Array.isArray(s.voiceRules) || s.voiceRules.length > 30 || !s.voiceRules.every(validVoiceRule) || typeof s.blocked !== 'string' || s.blocked.length > 2000 || !['all', 'subscribers', 'moderators'].includes(s.audience) || !['rate', 'pitch', 'volume', 'cooldown', 'maxLength'].every(k => Number.isFinite(s[k])) || s.rate < 0.5 || s.rate > 2 || s.pitch < 0.5 || s.pitch > 2 || s.volume < 0 || s.volume > 1 || s.cooldown < 0 || s.cooldown > 60 || s.maxLength < 20 || s.maxLength > 500 || !['dark', 'light'].includes(s.theme)) {
    return res.status(400).json({ error: 'Revisa los ajustes e inténtalo de nuevo.' });
  }
  const settings = Object.fromEntries(Object.keys(DEFAULT_SETTINGS).map(key => [key, s[key]]));
  for (const key of ['readName', 'skipLinks', 'skipEmotes']) settings[key] = Boolean(s[key]);
  try {
    await db.insert(userPreferences).values({
      userId: req.user.id,
      settings,
      theme: s.theme,
    }).onConflictDoUpdate({
      target: userPreferences.userId,
      set: { settings, theme: s.theme, updatedAt: new Date() },
    });
    res.json({ ok: true });
  } catch {
    res.status(503).json({ error: 'No se han podido guardar los ajustes. Inténtalo de nuevo.' });
  }
});

app.post('/api/tiktok/connect-token', requireAuth, async (req, res) => {
  const secret = process.env.KIVOZ_TIKTOK_SERVICE_SECRET;
  if (typeof secret !== 'string' || secret.length < 32) {
    return res.status(503).json({ error: 'El servicio TikTok no está configurado. Revisa KIVOZ_TIKTOK_SERVICE_SECRET en el servidor.' });
  }
  const claims = {
    sub: req.user.id,
    exp: Date.now() + 60_000,
    nonce: randomBytes(18).toString('base64url'),
  };
  const encoded = Buffer.from(JSON.stringify(claims)).toString('base64url');
  const signature = createHmac('sha256', secret).update(encoded).digest('base64url');
  res.json({ token: `${encoded}.${signature}` });
});

app.get('/api/admin/users', requireAuth, requireAdmin, async (req, res) => {
  try {
    const rows = await db.select({
      id: users.id,
      username: users.username,
      role: users.role,
      createdAt: users.createdAt,
    }).from(users).orderBy(desc(users.createdAt));
    res.json({ users: rows });
  } catch {
    res.status(503).json({ error: 'No se pudo cargar la lista de usuarios.' });
  }
});

app.post('/api/admin/users', requireAuth, requireAdmin, async (req, res) => {
  const { username, password } = req.body || {};
  if (!validUsername(username) || !validPassword(password)) {
    return res.status(400).json({ error: 'Usa un nombre de 3 a 32 caracteres y una contraseña de 12 a 128 caracteres.' });
  }
  try {
    const [user] = await db.insert(users).values({
      id: randomUUID(),
      username: username.toLowerCase(),
      passwordHash: await passwordHash(password),
      role: 'user',
    }).returning({ id: users.id, username: users.username, role: users.role, createdAt: users.createdAt });
    res.status(201).json({ user });
  } catch (error) {
    if (error?.code === '23505') return res.status(409).json({ error: 'Ese nombre de usuario ya está en uso.' });
    res.status(503).json({ error: 'No se pudo crear el usuario.' });
  }
});

app.delete('/api/admin/users/:id', requireAuth, requireAdmin, async (req, res) => {
  if (!/^[a-f0-9-]{36}$/i.test(req.params.id)) return res.status(400).json({ error: 'El usuario indicado no es válido.' });
  if (req.params.id === req.user.id) return res.status(400).json({ error: 'No puedes eliminar tu propia cuenta administradora.' });
  try {
    const [deleted] = await db.delete(users).where(and(eq(users.id, req.params.id), eq(users.role, 'user'))).returning({ id: users.id });
    if (!deleted) return res.status(404).json({ error: 'No se encontró ese usuario.' });
    res.json({ ok: true });
  } catch {
    res.status(503).json({ error: 'No se pudo eliminar el usuario.' });
  }
});

app.get('/api/channel/:slug', async (req, res) => {
  const { slug } = req.params;
  if (!/^[a-zA-Z0-9_-]{1,60}$/.test(slug)) return res.status(400).json({ error: 'Introduce un nombre de canal de Kick válido.' });
  try {
    const response = await fetch(`https://kick.com/api/v2/channels/${encodeURIComponent(slug)}`, { headers: { Accept: 'application/json', 'User-Agent': 'Mozilla/5.0 (compatible; Kivoz/1.0)' }, signal: AbortSignal.timeout(6000) });
    if (!response.ok) return res.status(response.status === 404 ? 404 : 502).json({ error: response.status === 404 ? 'No encontramos ese canal en Kick. Comprueba el nombre.' : 'Kick no permite conectar en este momento. Vuelve a intentarlo más tarde.' });
    const data = await response.json();
    if (!Number.isSafeInteger(data.chatroom?.id)) return res.status(502).json({ error: 'Este canal no tiene un chat disponible.' });
    if (!Number.isSafeInteger(data.id) || data.id <= 0) return res.status(502).json({ error: 'Kick no devolvió un identificador de canal válido.' });
    const connection = await fetch(`https://web.kick.com/api/v1/realtime/channels/${data.id}/chat/connection`, {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'x-app-platform': 'web', Origin: 'https://kick.com', Referer: 'https://kick.com/', 'User-Agent': 'Mozilla/5.0 (compatible; Kivoz/1.0)' },
      body: JSON.stringify({ client: { id: randomUUID(), type: 'web' }, capabilities: { accepted_providers: [{ provider: 'pusher' }] } }),
      signal: AbortSignal.timeout(6000),
    });
    if (!connection.ok) return res.status(502).json({ error: 'El canal existe, pero Kick no permite obtener la conexión del chat público en este momento. Vuelve a intentarlo más tarde.' });
    const negotiated = await connection.json();
    const transport = negotiated.data?.mode === 'websocket' && negotiated.data.connections?.find(c => c.provider === 'pusher');
    const publicConfig = transport?.credentials;
    if (!publicConfig || typeof publicConfig.app_key !== 'string' || !/^[a-zA-Z0-9]{1,100}$/.test(publicConfig.app_key) || typeof publicConfig.cluster !== 'string' || !/^[a-z]{2}[0-9]?$/.test(publicConfig.cluster)) {
      return res.status(502).json({ error: 'Kick no ofrece una conexión pública compatible para este chat. Inténtalo de nuevo más tarde.' });
    }
    res.json({ slug: data.slug || slug, chatroomId: data.chatroom.id, transport: { appKey: publicConfig.app_key, cluster: publicConfig.cluster } });
  } catch {
    res.status(502).json({ error: 'No se pudo contactar con Kick. Revisa tu conexión e inténtalo de nuevo.' });
  }
});

app.use((err, req, res, next) => res.status(400).json({ error: 'La solicitud no es válida.' }));
export default app;
