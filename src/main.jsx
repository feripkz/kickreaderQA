import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import Pusher from 'pusher-js';
import { AudioLines, LayoutDashboard, Mic2, SlidersHorizontal, ListFilter, Radio, ArrowUpRight, ArrowRight, ChevronDown, ChevronRight, Check, CircleHelp, Play, Pause, SkipForward, Trash2, X, MessageSquare, Link2, ShieldCheck, Save, Settings2, Headphones, CheckCheck, LoaderCircle, Moon, Sun, LogOut, Users, UserPlus, Crown, Plus } from 'lucide-react';
import './styles.css';

const defaults = { channel: '', tiktokChannel: '', command: '!aa', voice: '', voiceRules: [], rate: 1, pitch: 1, volume: .8, readName: true, skipLinks: true, skipEmotes: true, cooldown: 3, maxLength: 200, blocked: '', audience: 'all' };
const nav = [{ name: 'Panel general', icon: LayoutDashboard }, { name: 'Voces', icon: Mic2 }, { name: 'Reglas de lectura', icon: ListFilter }, { name: 'Actividad', icon: AudioLines }];
const time = () => new Date().toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' });
const Range = ({ settings, patch, label, prop, min, max, step, unit = '×', display }) => <div className="range-field"><div><label htmlFor={prop}>{label}</label><span>{display || `${Number(settings[prop]).toFixed(1)}${unit}`}</span></div><input id={prop} type="range" min={min} max={max} step={step} value={settings[prop]} style={{ '--fill': `${(settings[prop] - min) / (max - min) * 100}%` }} onChange={e => patch(prop, +e.target.value)}/></div>;
const Toggle = ({ settings, patch, label, detail, prop }) => <label className="toggle-row"><span><strong>{label}</strong>{detail && <small>{detail}</small>}</span><input type="checkbox" checked={settings[prop]} onChange={e => patch(prop, e.target.checked)}/><i aria-hidden="true"/></label>;
const VoiceCard = ({ selectedVoice, patch, voice, index }) => <button className={`voice-choice ${selectedVoice?.voiceURI === voice.voiceURI ? 'selected' : ''}`} aria-pressed={selectedVoice?.voiceURI === voice.voiceURI} onClick={() => patch('voice', voice.voiceURI)}><div className={`voice-avatar avatar-${index % 3}`}><AudioLines size={23}/></div><strong>{voice.name.replace(/Microsoft |Google /g, '').split(' - ')[0]}</strong><small>{voice.lang} · {voice.localService ? 'Local' : 'Navegador'}</small><span className="voice-radio">{selectedVoice?.voiceURI === voice.voiceURI && <span/>}</span></button>;
const isValidTiktokUser = value => /^[a-zA-Z0-9._]{2,24}$/.test(value);
const tiktokServiceUrl = import.meta.env.VITE_TIKTOK_SERVICE_URL || '';
const resolveVoiceRule = (rules, user, platform, traits) => {
  const scoped = (rules || []).filter(rule => rule.platform === 'all' || rule.platform === platform);
  const match = type => [...scoped].reverse().find(rule => rule.type === type && (
    type === 'username' ? rule.value.toLocaleLowerCase() === user.toLocaleLowerCase() :
    type === 'role' ? traits.roles.includes(rule.value) :
    type === 'subscriber' ? traits.isSubscriber :
    type === 'donor' ? traits.isDonor : false
  ));
  return match('username') || match('donor') || match('subscriber') || match('role') || null;
};
function AuthScreen({ setupAvailable, setupRequired, onAuthenticated, initialError }) {
  const [isSetup, setIsSetup] = useState(setupAvailable);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [setupToken, setSetupToken] = useState('');
  const [error, setError] = useState(initialError || '');
  const [busy, setBusy] = useState(false);

  const submit = async event => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const response = await fetch(isSetup ? '/api/auth/setup' : '/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, ...(isSetup ? { setupToken } : {}) }),
      });
      const data = await response.json();
      if (!response.ok) throw Error(data.error);
      onAuthenticated(data.user);
    } catch (e) {
      setError(e.message || 'No se pudo validar la cuenta. Inténtalo de nuevo.');
    } finally {
      setBusy(false);
    }
  };

  return <div className="auth-page">
    <section className="auth-card" aria-labelledby="auth-title">
      <a className="brand auth-brand" href="/" aria-label="Kivoz"><span className="brand-mark">k<span/></span>kivoz<span className="brand-dot">.</span></a>
      <span className="auth-kicker"><ShieldCheck size={14}/> TU ESTUDIO, BAJO TU CONTROL</span>
      <h1 id="auth-title">{isSetup ? 'Crea la cuenta administradora' : 'Bienvenido de nuevo'}</h1>
      <p>{isSetup ? 'El primer acceso debe autorizarse con el token configurado en el servidor.' : setupRequired ? 'La aplicación aún no tiene una cuenta. El propietario debe habilitar el alta inicial en el servidor.' : 'Inicia sesión para acceder a tu espacio y a tus preferencias.'}</p>
      {setupRequired && !setupAvailable && <div className="info-box" role="status"><ShieldCheck size={18}/><p>Configura KIVOZ_ADMIN_SETUP_TOKEN con un secreto aleatorio de al menos 32 caracteres en el entorno de Netlify y vuelve a cargar esta página. No existe una contraseña predeterminada.</p></div>}
      {error && <div className="error" role="alert"><CircleHelp size={17}/><span>{error}</span></div>}
      {(!setupRequired || setupAvailable) && <form onSubmit={submit} className="auth-form">
        {isSetup && <div className="field"><label htmlFor="setup-token">Token de alta inicial</label><input id="setup-token" required autoComplete="off" type="password" value={setupToken} onChange={event => setSetupToken(event.target.value)}/></div>}
        <div className="field"><label htmlFor="auth-username">Nombre de usuario</label><input id="auth-username" required minLength={3} maxLength={32} autoComplete="username" value={username} onChange={event => setUsername(event.target.value)} placeholder="tu_usuario"/></div>
        <div className="field"><label htmlFor="auth-password">Contraseña</label><input id="auth-password" required minLength={isSetup ? 12 : 1} maxLength={128} autoComplete={isSetup ? 'new-password' : 'current-password'} type="password" value={password} onChange={event => setPassword(event.target.value)} placeholder={isSetup ? 'Al menos 12 caracteres' : 'Tu contraseña'}/></div>
        <button className="button primary auth-submit" disabled={busy}>{busy ? <LoaderCircle className="spin" size={17}/> : isSetup ? <UserPlus size={17}/> : <ShieldCheck size={17}/>} {busy ? 'Comprobando…' : isSetup ? 'Crear administrador' : 'Iniciar sesión'}</button>
      </form>}
      {setupAvailable && <button className="auth-switch" onClick={() => { setIsSetup(!isSetup); setError(''); }}>{isSetup ? '¿Ya tienes una cuenta? Inicia sesión' : 'Configurar la primera cuenta administradora'}</button>}
      <div className="auth-foot"><ShieldCheck size={14}/> Sesiones seguras. Las credenciales no se guardan en este dispositivo.</div>
    </section>
  </div>;
}

function App() {
  const [auth, setAuth] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState('');

  useEffect(() => {
    fetch('/api/auth/status')
      .then(async response => {
        const data = await response.json();
        if (!response.ok) throw Error(data.error);
        setAuth(data);
      })
      .catch(error => {
        setAuth({ user: null, setupAvailable: false });
        setAuthError(error.message || 'No se pudo comprobar la sesión.');
      })
      .finally(() => setAuthLoading(false));
  }, []);

  if (authLoading) return <div className="auth-page"><div className="auth-loading"><LoaderCircle className="spin" size={25}/> Preparando tu espacio…</div></div>;
  if (!auth?.user) return <AuthScreen setupAvailable={auth?.setupAvailable} setupRequired={auth?.setupRequired} initialError={authError} onAuthenticated={user => setAuth({ user, setupAvailable: false, setupRequired: false })}/>;
  return <Studio key={auth.user.id} user={auth.user} onLogout={() => setAuth({ user: null, setupAvailable: false })}/>;
}

function Studio({ user, onLogout }) {
  const [page, setPage] = useState('Panel general');
  const [activePlatform, setActivePlatform] = useState('kick');
  const [settings, setSettings] = useState(defaults);
  const currentSettings = useRef(settings); currentSettings.current = settings;
  const [theme, setTheme] = useState('dark');
  const currentTheme = useRef(theme); currentTheme.current = theme;
  const [voices, setVoices] = useState([]);
  const [connectionStates, setConnectionStates] = useState({ kick: 'offline', tiktok: 'offline' });
  const [connectedChannels, setConnectedChannels] = useState({ kick: '', tiktok: '' });
  const status = connectionStates[activePlatform];
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [voiceModal, setVoiceModal] = useState(false);
  const [help, setHelp] = useState(false);
  const [search, setSearch] = useState('');
  const [queue, setQueue] = useState([]);
  const queueRef = useRef([]);
  const [speaking, setSpeaking] = useState(null);
  const speakingRef = useRef(null);
  const [paused, setPaused] = useState(false);
  const pausedRef = useRef(false);
  const [history, setHistory] = useState([]);
  const [readCount, setReadCount] = useState(0);
  const [filtered, setFiltered] = useState(0);
  const [managedUsers, setManagedUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [creatingUser, setCreatingUser] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newOwnPassword, setNewOwnPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);
  const [testText, setTestText] = useState('¡Hola, chat! ¿Todo listo para el directo?');
  const [ruleType, setRuleType] = useState('username');
  const [ruleValue, setRuleValue] = useState('');
  const [ruleVoice, setRuleVoice] = useState('');
  const [rulePlatform, setRulePlatform] = useState('all');
  const socket = useRef(null);
  const tiktokSocket = useRef(null);
  const attempt = useRef(0);
  const tiktokAttempt = useRef(0);
  const connectionTimer = useRef(null);
  const tiktokTimer = useRef(null);
  const tiktokAuthTimer = useRef(null);
  const channelRequest = useRef(null);
  const lastMessage = useRef(new Map());
  const seen = useRef(new Set());
  const donors = useRef(new Set());
  const voiceRef = useRef([]); voiceRef.current = voices;
  const utteranceRef = useRef(null);
  const changed = useRef(false);
  const patch = (key, value) => { changed.current = true; setSettings(s => ({ ...s, [key]: value })); setDirty(true); };
  const changeTheme = value => { currentTheme.current = value; setTheme(value); setDirty(true); };
  const notice = text => setToast(text);
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(''), 4500); return () => clearTimeout(t); }, [toast]);
  useEffect(() => {
    if (!voiceModal && !help) return;
    const previous = document.activeElement;
    const onKey = event => {
      if (event.key === 'Escape') { setVoiceModal(false); setHelp(false); }
      if (event.key !== 'Tab') return;
      const elements = [...document.querySelectorAll('[role="dialog"] button, [role="dialog"] input')].filter(el => !el.disabled);
      const first = elements[0], last = elements[elements.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = overflow; previous?.focus(); };
  }, [voiceModal, help]);
  useEffect(() => {
    fetch('/api/settings').then(async r => { const data = await r.json(); if (!r.ok) throw Error(data.error); if (data.settings && !changed.current) setSettings({ ...defaults, ...data.settings }); if (data.theme === 'light' || data.theme === 'dark') setTheme(data.theme); }).catch(e => setError(e.message || 'No se pudieron cargar los ajustes.')).finally(() => setLoaded(true));
    let loadVoices;
    if ('speechSynthesis' in window) {
      loadVoices = () => setVoices(window.speechSynthesis.getVoices());
      loadVoices();
      window.speechSynthesis.addEventListener('voiceschanged', loadVoices);
    }
    return () => {
      if (loadVoices) window.speechSynthesis.removeEventListener('voiceschanged', loadVoices);
      window.speechSynthesis?.cancel();
      socket.current?.disconnect();
      tiktokSocket.current?.close();
      clearTimeout(connectionTimer.current);
      clearTimeout(tiktokTimer.current);
      clearInterval(tiktokAuthTimer.current);
      channelRequest.current?.abort();
      attempt.current++;
      tiktokAttempt.current++;
    };
  }, []);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#0c100e' : '#f2f5ef');
  }, [theme]);
  useEffect(() => {
    if (page !== 'Configuración' || user.role !== 'admin') return;
    let active = true;
    setUsersLoading(true);
    fetch('/api/admin/users')
      .then(async response => {
        const data = await response.json();
        if (!response.ok) throw Error(data.error);
        if (active) setManagedUsers(data.users);
      })
      .catch(error => { if (active) setError(error.message || 'No se pudo cargar la lista de usuarios.'); })
      .finally(() => { if (active) setUsersLoading(false); });
    return () => { active = false; };
  }, [page, user.role]);
  const updateQueue = () => setQueue([...queueRef.current]);
  const pump = () => {
    if (speakingRef.current || pausedRef.current || !queueRef.current.length) return;
    if (!('speechSynthesis' in window)) { setError('Este navegador no admite síntesis de voz. Prueba con Chrome o Edge.'); return; }
    const item = queueRef.current.shift(); updateQueue();
    speakingRef.current = item; setSpeaking(item);
    const s = currentSettings.current;
    const utterance = new SpeechSynthesisUtterance((s.readName && !item.test ? `${item.user} dice: ` : '') + item.text);
    utterance.voice = voiceRef.current.find(v => v.voiceURI === (item.voice || s.voice)) || voiceRef.current.find(v => v.lang.startsWith('es')) || null;
    utterance.lang = utterance.voice?.lang || 'es-ES';
    utterance.rate = s.rate; utterance.pitch = s.pitch; utterance.volume = s.volume;
    utteranceRef.current = utterance;
    const finish = success => {
      if (utteranceRef.current !== utterance) return;
      speakingRef.current = null; setSpeaking(null); utteranceRef.current = null;
      if (success && !item.test) setReadCount(n => n + 1);
      setHistory(h => h.map(m => m.id === item.id ? { ...m, state: success ? 'Leído' : 'Error de audio' } : m));
      if (!success) notice('No se pudo reproducir el audio. Comprueba la voz y los permisos de sonido.');
      pump();
    };
    utterance.onend = () => finish(true);
    utterance.onerror = () => finish(false);
    window.speechSynthesis.speak(utterance);
  };
  const enqueue = item => {
    if (queueRef.current.length >= 50) return false;
    queueRef.current.push(item); updateQueue(); pump(); return true;
  };
  const receive = (payload, platform = 'kick', metadata = {}) => {
    const s = currentSettings.current;
    if (typeof payload?.content !== 'string') return;
    const id = `${platform}:${String(payload.id || crypto.randomUUID())}`;
    if (seen.current.has(id)) return;
    seen.current.add(id); if (seen.current.size > 1000) seen.current.delete(seen.current.values().next().value);
    const content = payload.content;
    const user = metadata.username || payload.sender?.username || 'Espectador';
    const matched = Boolean(s.command) && content.startsWith(s.command) && (content.length === s.command.length || /\s/.test(content[s.command.length]));
    let text = matched ? content.slice(s.command.length).trim() : '';
    const badges = Array.isArray(payload.sender?.identity?.badges) ? payload.sender.identity.badges : [];
    const badgeTypes = badges.map(b => String(b.type || '').toLocaleLowerCase());
    const roles = [...new Set([...(metadata.roles || []), ...badgeTypes])];
    const moderator = metadata.isModerator || roles.some(role => ['moderator', 'broadcaster', 'admin'].includes(role));
    const isSubscriber = metadata.isSubscriber || roles.includes('subscriber');
    const isDonor = metadata.isDonor || donors.current.has(`${platform}:${metadata.channel || ''}:${user.toLocaleLowerCase()}`) || roles.some(role => ['donor', 'donator', 'gifter'].includes(role));
    const allowed = s.audience === 'all' || moderator || (s.audience === 'subscribers' && isSubscriber);
    const blocked = s.blocked.split(',').map(w => w.trim().toLocaleLowerCase()).filter(Boolean);
    let reason = !matched ? 'Sin comando' : !text ? 'Mensaje vacío' : !allowed ? 'Rol no permitido' : text.length > s.maxLength ? 'Demasiado largo' : s.skipLinks && /https?:\/\/|www\./i.test(text) ? 'Enlace filtrado' : blocked.some(w => text.toLocaleLowerCase().includes(w)) ? 'Palabra bloqueada' : '';
    if (s.skipEmotes) text = text.replace(/\[emote:[^\]]+\]/g, '').trim();
    if (!text && !reason) reason = 'Solo emotes';
    const cooldownKey = `${platform}:${user.toLocaleLowerCase()}`;
    if (!reason && Date.now() - (lastMessage.current.get(cooldownKey) || 0) < s.cooldown * 1000) reason = 'Tiempo de espera';
    const traits = { roles, isSubscriber, isDonor };
    const assignedVoice = resolveVoiceRule(s.voiceRules, user, platform, traits);
    const item = { id, user, text, content, platform, voice: assignedVoice?.voice || s.voice, time: time(), state: reason || 'En cola' };
    setHistory(h => [item, ...h].slice(0, 150));
    if (reason) { setFiltered(n => n + 1); return; }
    if (!enqueue(item)) { setFiltered(n => n + 1); setHistory(h => h.map(m => m.id === id ? { ...m, state: 'Cola llena' } : m)); return; }
    lastMessage.current.set(cooldownKey, Date.now());
    if (lastMessage.current.size > 2000) lastMessage.current.delete(lastMessage.current.keys().next().value);
  };
  const setPlatformStatus = (platform, value) => setConnectionStates(states => ({ ...states, [platform]: value }));
  const setConnectedChannel = (platform, value) => setConnectedChannels(channels => ({ ...channels, [platform]: value }));
  const resetDonors = platform => {
    for (const donor of donors.current) if (donor.startsWith(`${platform}:`)) donors.current.delete(donor);
  };
  const connectKick = async () => {
    if (connectionStates.kick !== 'offline') { attempt.current++; clearTimeout(connectionTimer.current); channelRequest.current?.abort(); socket.current?.disconnect(); socket.current = null; setConnectedChannel('kick', ''); setPlatformStatus('kick', 'offline'); return; }
    setError('');
    let slug = settings.channel.trim();
    if (/^(https?:\/\/)?(www\.)?kick\.com\//i.test(slug)) slug = slug.replace(/^(https?:\/\/)?(www\.)?kick\.com\//i, '').split(/[/?#]/)[0];
    if (!/^[a-zA-Z0-9_-]{1,60}$/.test(slug)) { setError('Escribe el nombre de tu canal o su enlace de Kick.'); return; }
    if (!('speechSynthesis' in window)) { setError('Usa un navegador compatible con síntesis de voz, como Chrome o Edge.'); return; }
    resetDonors('kick');
    patch('channel', slug); setPlatformStatus('kick', 'connecting');
    // Prime browser audio from the connect gesture; subsequent chat messages use the same session.
    const unlock = new SpeechSynthesisUtterance(''); window.speechSynthesis.speak(unlock);
    const request = ++attempt.current;
    try {
      channelRequest.current = new AbortController();
      const res = await fetch(`/api/channel/${encodeURIComponent(slug)}`, { signal: AbortSignal.any([channelRequest.current.signal, AbortSignal.timeout(18000)]) });
      const data = await res.json().catch(() => { throw Error('El servidor no pudo consultar el canal. Inténtalo de nuevo.'); });
      if (request !== attempt.current) return;
      if (!res.ok) throw Error(data.error);
      // Public Kick chat transport identifier; no account credentials are used.
      if (!data.transport?.appKey || !data.transport?.cluster) throw Error('La configuración del chat no está disponible. Recarga la página e inténtalo de nuevo.');
      const client = new Pusher(data.transport.appKey, { cluster: data.transport.cluster, forceTLS: true });
      const fail = message => {
        if (request !== attempt.current) return;
        attempt.current++;
        clearTimeout(connectionTimer.current);
        socket.current = null;
        client.disconnect();
        setConnectedChannel('kick', ''); setPlatformStatus('kick', 'offline'); setError(message);
      };
      const waitForSubscription = () => {
        clearTimeout(connectionTimer.current);
        connectionTimer.current = setTimeout(() => fail('El chat de Kick no confirmó la conexión. Comprueba tu red o los bloqueadores del navegador y vuelve a conectar.'), 20000);
      };
      waitForSubscription();
      client.connection.bind('error', event => {
        const code = event?.data?.code;
        if (code >= 4000 && code < 4100) fail('Kick rechazó la conexión del chat. Vuelve a conectar para actualizar sus parámetros.');
      });
      socket.current = client;
      const channel = client.subscribe(`chatrooms.${data.chatroomId}.v2`);
      channel.bind('App\\Events\\ChatMessageEvent', payload => { if (request === attempt.current) receive(payload, 'kick', { channel: data.slug }); });
      channel.bind('pusher:subscription_succeeded', () => { if (request === attempt.current) { clearTimeout(connectionTimer.current); connectionTimer.current = null; setError(''); setPlatformStatus('kick', 'online'); setConnectedChannel('kick', data.slug); notice(`Conectado al chat de Kick: ${data.slug}`); } });
      channel.bind('pusher:subscription_error', () => fail('No se pudo suscribir al chat de Kick. Inténtalo de nuevo.'));
      client.connection.bind('state_change', ({ current }) => {
        if (request !== attempt.current || current === 'connected') return;
        if (['connecting', 'unavailable', 'disconnected'].includes(current)) {
          setPlatformStatus('kick', 'connecting');
          if (!connectionTimer.current) waitForSubscription();
        }
        if (current === 'failed') fail('La conexión con el chat falló. Vuelve a conectar.');
      });
    } catch (e) { if (request === attempt.current) { setPlatformStatus('kick', 'offline'); setError(e.message || 'No se pudo conectar con Kick.'); } }
  };
  const connectTikTok = async () => {
    if (connectionStates.tiktok !== 'offline') {
      tiktokAttempt.current++;
      clearTimeout(tiktokTimer.current);
      clearInterval(tiktokAuthTimer.current);
      tiktokSocket.current?.close(1000, 'Desconexión solicitada');
      tiktokSocket.current = null;
      setConnectedChannel('tiktok', '');
      setPlatformStatus('tiktok', 'offline');
      return;
    }
    setError('');
    let channel = settings.tiktokChannel.trim();
    channel = channel.replace(/^(https?:\/\/)?(www\.)?tiktok\.com\/@?/i, '').replace(/^@/, '').split(/[/?#]/)[0].toLowerCase();
    if (!isValidTiktokUser(channel)) { setError('Escribe un usuario de TikTok válido o su enlace, sin espacios.'); return; }
    if (!tiktokServiceUrl) { setError('Falta configurar VITE_TIKTOK_SERVICE_URL y desplegar el servicio de conexión TikTok.'); return; }
    if (!('speechSynthesis' in window)) { setError('Usa un navegador compatible con síntesis de voz, como Chrome o Edge.'); return; }
    resetDonors('tiktok');
    patch('tiktokChannel', channel);
    setPlatformStatus('tiktok', 'connecting');
    const unlock = new SpeechSynthesisUtterance('');
    window.speechSynthesis.speak(unlock);
    const request = ++tiktokAttempt.current;
    const tokenResponse = await fetch('/api/tiktok/connect-token', { method: 'POST' });
    const tokenData = await tokenResponse.json();
    if (request !== tiktokAttempt.current) return;
    if (!tokenResponse.ok) throw Error(tokenData.error || 'No se pudo autorizar la conexión TikTok.');
    const socketAttempt = new WebSocket(tiktokServiceUrl.replace(/^http/i, 'ws').replace(/\/+$/, '') + `/live?channel=${encodeURIComponent(channel)}&token=${encodeURIComponent(tokenData.token)}`);
    tiktokSocket.current = socketAttempt;
    tiktokAuthTimer.current = setInterval(async () => {
      if (tiktokSocket.current !== socketAttempt || request !== tiktokAttempt.current || socketAttempt.readyState !== WebSocket.OPEN) return;
      try {
        const response = await fetch('/api/tiktok/connect-token', { method: 'POST' });
        const data = await response.json();
        if (!response.ok) throw Error(data.error || 'La sesión ya no autoriza TikTok.');
        if (tiktokSocket.current === socketAttempt && request === tiktokAttempt.current && socketAttempt.readyState === WebSocket.OPEN) {
          socketAttempt.send(JSON.stringify({ type: 'auth', token: data.token }));
        }
      } catch (error) {
        if (tiktokSocket.current !== socketAttempt || request !== tiktokAttempt.current) return;
        clearInterval(tiktokAuthTimer.current);
        setError(error.message || 'No se pudo renovar la autorización de TikTok.');
        socketAttempt.close(4001, 'Authorization renewal failed.');
      }
    }, 30_000);
    tiktokTimer.current = setTimeout(() => {
      if (tiktokSocket.current === socketAttempt && request === tiktokAttempt.current) {
        clearInterval(tiktokAuthTimer.current);
        socketAttempt.close();
        tiktokSocket.current = null;
        setPlatformStatus('tiktok', 'offline');
        setError('TikTok no confirmó la conexión. Comprueba el servicio y que el canal esté en directo.');
      }
    }, 25000);
    socketAttempt.onmessage = event => {
      let data;
      try { data = JSON.parse(event.data); } catch { return; }
      if (tiktokSocket.current !== socketAttempt || request !== tiktokAttempt.current) return;
      if (data.type === 'connected') {
        clearTimeout(tiktokTimer.current);
        setError('');
        setPlatformStatus('tiktok', 'online');
        setConnectedChannel('tiktok', data.channel || channel);
        notice(`Conectado al chat de TikTok: ${data.channel || channel}`);
      } else if (data.type === 'chat') {
        receive({ id: data.id, content: data.content }, 'tiktok', {
          username: data.username,
          channel: data.channel || channel,
          roles: data.roles || [],
          isModerator: data.isModerator,
          isSubscriber: data.isSubscriber,
        });
      } else if (data.type === 'gift' && data.username) {
        donors.current.add(`tiktok:${data.channel || channel}:${data.username.toLocaleLowerCase()}`);
        if (donors.current.size > 5000) donors.current.delete(donors.current.values().next().value);
      } else if (data.type === 'error') {
        tiktokAttempt.current++;
        clearTimeout(tiktokTimer.current);
        clearInterval(tiktokAuthTimer.current);
        setPlatformStatus('tiktok', 'offline');
        setConnectedChannel('tiktok', '');
        setError(data.message || 'El servicio TikTok no pudo conectar con el LIVE.');
        socketAttempt.close();
        tiktokSocket.current = null;
      }
    };
    socketAttempt.onerror = () => {
      if (tiktokSocket.current !== socketAttempt || request !== tiktokAttempt.current) return;
      clearTimeout(tiktokTimer.current);
      clearInterval(tiktokAuthTimer.current);
      setPlatformStatus('tiktok', 'offline');
      setConnectedChannel('tiktok', '');
      setError('No se pudo alcanzar el servicio TikTok. Revisa su URL, disponibilidad y configuración de origen.');
      tiktokSocket.current = null;
      socketAttempt.close();
    };
    socketAttempt.onclose = () => {
      if (tiktokSocket.current !== socketAttempt || request !== tiktokAttempt.current) return;
      clearTimeout(tiktokTimer.current);
      clearInterval(tiktokAuthTimer.current);
      tiktokSocket.current = null;
      setConnectedChannel('tiktok', '');
      setPlatformStatus('tiktok', 'offline');
      setError('La conexión de TikTok se cerró. Revisa que el LIVE siga activo y vuelve a conectar.');
    };
  };
  const connect = () => {
    if (activePlatform === 'kick') return connectKick();
    return connectTikTok().catch(error => {
      setPlatformStatus('tiktok', 'offline');
      setError(error.message || 'No se pudo iniciar la conexión TikTok.');
    });
  };
  const addVoiceRule = event => {
    event.preventDefault();
    const value = ruleType === 'username' ? ruleValue.trim() : ruleType === 'role' ? ruleValue : '';
    if (ruleType === 'username' && !/^[a-zA-Z0-9._-]{1,32}$/.test(value)) {
      setError('Escribe un nombre de usuario válido para asignar la voz.');
      return;
    }
    if (ruleType === 'role' && !['moderator', 'broadcaster'].includes(value)) return;
    if (!ruleVoice) { setError('Selecciona una voz para la regla.'); return; }
    const rule = { id: crypto.randomUUID(), type: ruleType, value, voice: ruleVoice, platform: rulePlatform };
    patch('voiceRules', [...(settings.voiceRules || []), rule].slice(-30));
    setRuleValue('');
    notice('La regla de voz se añadió. Guarda los cambios para conservarla.');
  };
  const removeVoiceRule = id => patch('voiceRules', (settings.voiceRules || []).filter(rule => rule.id !== id));
  const save = async () => {
    setSaving(true); setError('');
    try { const r = await fetch('/api/settings', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...settings, theme }) }); const data = await r.json(); if (!r.ok) throw Error(data.error); if (currentSettings.current === settings && currentTheme.current === theme) setDirty(false); notice('Tu configuración se ha guardado.'); } catch (e) { setError(e.message || 'No se pudieron guardar los ajustes.'); } finally { setSaving(false); }
  };
  const createUser = async event => {
    event.preventDefault();
    setCreatingUser(true);
    setError('');
    try {
      const response = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: newUsername, password: newPassword }),
      });
      const data = await response.json();
      if (!response.ok) throw Error(data.error);
      setManagedUsers(users => [data.user, ...users]);
      setNewUsername('');
      setNewPassword('');
      notice(`La cuenta de ${data.user.username} está lista.`);
    } catch (error) {
      setError(error.message || 'No se pudo crear el usuario.');
    } finally {
      setCreatingUser(false);
    }
  };
  const changeOwnPassword = async event => {
    event.preventDefault();
    setChangingPassword(true);
    setError('');
    try {
      const response = await fetch('/api/auth/password', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword: newOwnPassword }),
      });
      const data = await response.json();
      if (!response.ok) throw Error(data.error);
      setCurrentPassword('');
      setNewOwnPassword('');
      notice('Tu contraseña se actualizó y se cerraron las demás sesiones.');
    } catch (error) {
      setError(error.message || 'No se pudo actualizar la contraseña.');
    } finally {
      setChangingPassword(false);
    }
  };
  const removeUser = async account => {
    if (!window.confirm(`¿Eliminar la cuenta de ${account.username}? Se borrarán sus preferencias y sesiones.`)) return;
    setError('');
    try {
      const response = await fetch(`/api/admin/users/${encodeURIComponent(account.id)}`, { method: 'DELETE' });
      const data = await response.json();
      if (!response.ok) throw Error(data.error);
      setManagedUsers(accounts => accounts.filter(item => item.id !== account.id));
      notice(`Se eliminó la cuenta de ${account.username}.`);
    } catch (error) {
      setError(error.message || 'No se pudo eliminar el usuario.');
    }
  };
  const logout = async () => {
    setError('');
    try {
      const response = await fetch('/api/auth/logout', { method: 'POST' });
      const data = await response.json();
      if (!response.ok) throw Error(data.error);
      document.documentElement.dataset.theme = 'dark';
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content', '#0c100e');
      onLogout();
    } catch (error) {
      setError(error.message || 'No se pudo cerrar la sesión.');
    }
  };
  const skip = () => {
    const old = speakingRef.current;
    utteranceRef.current = null; window.speechSynthesis?.cancel(); speakingRef.current = null; setSpeaking(null);
    if (old) setHistory(h => h.map(m => m.id === old.id ? { ...m, state: 'Omitido' } : m));
    pump();
  };
  const togglePause = () => { pausedRef.current = !pausedRef.current; setPaused(pausedRef.current); if (pausedRef.current) window.speechSynthesis?.pause(); else { window.speechSynthesis?.resume(); pump(); } };
  const clear = () => { queueRef.current = []; updateQueue(); setHistory(h => h.map(m => m.state === 'En cola' && m.id !== speakingRef.current?.id ? { ...m, state: 'Eliminado' } : m)); notice('Cola de lectura vaciada.'); };
  const preview = () => { if (!('speechSynthesis' in window)) return setError('Este navegador no admite síntesis de voz. Prueba con Chrome o Edge.'); if (!testText.trim()) return notice('Escribe un mensaje para probar la voz.'); if (pausedRef.current) togglePause(); if (!enqueue({ id: crypto.randomUUID(), user: 'Prueba de voz', text: testText.trim(), test: true, time: time() })) notice('La cola está llena. Libera un espacio para probar la voz.'); };
  const selectedVoice = voices.find(v => v.voiceURI === settings.voice) || voices.find(v => v.lang.startsWith('es'));
  const voiceName = selectedVoice?.name.replace(/Microsoft |Google /g, '') || 'Voz del dispositivo';
  const channelField = activePlatform === 'kick' ? 'channel' : 'tiktokChannel';
  const channelPrefix = activePlatform === 'kick' ? 'kick.com/' : 'tiktok.com/@';
  const activeChannel = connectedChannels[activePlatform];
  const applyVoicePreset = preset => {
    const voice = chileanVoices[0] || selectedVoice;
    if (!voice) {
      notice('Instala una voz en español en tu dispositivo para usar este estilo.');
      return;
    }
    patch('voice', voice.voiceURI);
    patch('rate', preset.rate);
    patch('pitch', preset.pitch);
    notice(`${preset.name} aplicado. Guarda los cambios para conservarlo.`);
  };
  if (page === 'Configuración') return <div className="account-shell" data-theme={theme}>
    <header className="account-header">
      <a className="brand" href="/" aria-label="Kivoz, inicio"><span className="brand-mark">k<span/></span>kivoz<span className="brand-dot">.</span></a>
      <div className="account-header-actions"><span className="account-identity"><strong>{user.username}</strong><small>{user.role === 'admin' ? 'Administrador' : 'Usuario'}</small></span><button className="button secondary" onClick={() => changeTheme(theme === 'dark' ? 'light' : 'dark')} aria-label={theme === 'dark' ? 'Activar modo claro' : 'Activar modo oscuro'}>{theme === 'dark' ? <Sun size={16}/> : <Moon size={16}/>} {theme === 'dark' ? 'Modo claro' : 'Modo oscuro'}</button><button className="button secondary" onClick={logout}><LogOut size={16}/> Cerrar sesión</button></div>
    </header>
    <main className="account-main">
      <button className="back-link" onClick={() => setPage('Panel general')}><ArrowRight size={15}/> Volver al estudio</button>
      <div className="account-heading"><div><span className="eyebrow"><span/> TU CUENTA</span><h1>Tu espacio, <span>a tu manera.</span></h1><p>Las preferencias y el aspecto se guardan en tu cuenta para que te acompañen en cada sesión.</p></div><button className="button primary" disabled={saving || !loaded} onClick={save}>{saving ? <LoaderCircle className="spin" size={16}/> : <Save size={16}/>} {saving ? 'Guardando…' : 'Guardar cambios'}{dirty && <i className="unsaved-dot"/>}</button></div>
      {error && <div className="error" role="alert"><CircleHelp size={17}/><span>{error}</span><button aria-label="Cerrar aviso" onClick={() => setError('')}><X size={16}/></button></div>}
      <section className="card account-card"><div className="card-heading"><div className="section-title"><span className="section-icon"><Settings2 size={19}/></span><h2>Preferencias del estudio</h2></div></div><p className="muted">Personaliza el aspecto y los ajustes principales de tu lector.</p>
        <div className="rule-grid"><div className="field"><label htmlFor="settings-command">Comando de lectura</label><input id="settings-command" maxLength={20} value={settings.command} onChange={event => patch('command', event.target.value.replace(/\s/g, ''))}/></div><div className="field"><label htmlFor="settings-voice">Voz seleccionada</label><select id="settings-voice" value={settings.voice} onChange={event => patch('voice', event.target.value)}><option value="">Voz en español predeterminada</option>{voices.map(voice => <option key={voice.voiceURI} value={voice.voiceURI}>{voice.name} · {voice.lang}</option>)}</select></div></div>
        <Toggle settings={settings} patch={patch} label="Leer nombre de usuario" detail="Anuncia quién envía cada mensaje." prop="readName"/>
        <div className="theme-option"><div><strong>Aspecto</strong><small>Elige el tema que se guardará en esta cuenta.</small></div><div className="theme-switch"><button className={theme === 'light' ? 'selected' : ''} onClick={() => changeTheme('light')}><Sun size={15}/> Claro</button><button className={theme === 'dark' ? 'selected' : ''} onClick={() => changeTheme('dark')}><Moon size={15}/> Oscuro</button></div></div>
        <div className="info-box"><ShieldCheck size={20}/><p>Tu configuración y tu tema son privados de esta cuenta. La actividad, los contadores y la cola son temporales y se vacían al cerrar o recargar la página.</p></div>
        <button className="button secondary" onClick={() => { changed.current = true; setSettings(defaults); changeTheme('dark'); setDirty(true); notice('Preferencias restablecidas. Guarda los cambios para conservarlas.'); }}>Restablecer preferencias</button>
        <div className="password-section"><div className="card-heading"><div className="section-title"><span className="section-icon"><ShieldCheck size={19}/></span><h2>Cambiar contraseña</h2></div></div><p className="muted">Al actualizarla se cerrarán las demás sesiones de esta cuenta.</p>
          <form className="password-form" onSubmit={changeOwnPassword}><div className="field"><label htmlFor="current-password">Contraseña actual</label><input id="current-password" type="password" required autoComplete="current-password" value={currentPassword} onChange={event => setCurrentPassword(event.target.value)}/></div><div className="field"><label htmlFor="new-own-password">Nueva contraseña</label><input id="new-own-password" type="password" required minLength={12} maxLength={128} autoComplete="new-password" value={newOwnPassword} onChange={event => setNewOwnPassword(event.target.value)} placeholder="Al menos 12 caracteres"/></div><button className="button secondary" disabled={changingPassword}>{changingPassword ? <LoaderCircle className="spin" size={16}/> : <ShieldCheck size={16}/>} Actualizar contraseña</button></form>
        </div>
      </section>
      {user.role === 'admin' && <section className="card account-card admin-card"><div className="card-heading"><div className="section-title"><span className="section-icon"><Users size={19}/></span><h2>Administración de usuarios</h2></div><span className="tag">SOLO ADMINISTRACIÓN</span></div><p className="muted">Crea cuentas de usuario y elimina el acceso cuando sea necesario. Las cuentas nuevas no tienen permisos de administración.</p>
        <form className="create-user-form" onSubmit={createUser}><div className="field"><label htmlFor="new-username">Nombre de usuario</label><input id="new-username" required minLength={3} maxLength={32} pattern="[a-zA-Z0-9._-]{3,32}" autoComplete="off" value={newUsername} onChange={event => setNewUsername(event.target.value)} placeholder="3–32 letras, números, punto, guion"/></div><div className="field"><label htmlFor="new-password">Contraseña inicial</label><input id="new-password" type="password" required minLength={12} maxLength={128} autoComplete="new-password" value={newPassword} onChange={event => setNewPassword(event.target.value)} placeholder="Al menos 12 caracteres"/></div><button className="button primary" disabled={creatingUser}>{creatingUser ? <LoaderCircle className="spin" size={16}/> : <UserPlus size={16}/>} Crear usuario</button></form>
        <div className="user-list-heading"><strong>Cuentas registradas</strong><span>{managedUsers.length}</span></div>{usersLoading ? <div className="user-loading"><LoaderCircle className="spin" size={17}/> Cargando usuarios…</div> : <div className="managed-users">{managedUsers.map(account => <div className="managed-user" key={account.id}><span className="user-avatar">{account.username.slice(0, 2).toUpperCase()}</span><div><strong>{account.username}</strong><small>{account.role === 'admin' ? 'Administrador' : 'Usuario'} · Desde {new Date(account.createdAt).toLocaleDateString('es')}</small></div>{account.role !== 'admin' && <button className="icon-button danger-action" aria-label={`Eliminar a ${account.username}`} onClick={() => removeUser(account)}><Trash2 size={17}/></button>}</div>)}{!managedUsers.length && !usersLoading && <p className="muted">Todavía no hay usuarios registrados.</p>}</div>}
      </section>}
    </main>
    {toast && <div className="toast" role="status"><CheckCheck size={18}/>{toast}<button onClick={() => setToast('')} aria-label="Cerrar notificación"><X size={15}/></button></div>}
  </div>;
  const spanish = voices.filter(v => v.lang.startsWith('es'));
  const chileanVoices = voices.filter(v => v.lang.toLowerCase() === 'es-cl' || v.lang.toLowerCase().startsWith('es-cl-'));
  const featured = [selectedVoice, ...spanish, ...voices].filter((v, i, a) => v && a.findIndex(x => x?.voiceURI === v.voiceURI) === i).slice(0, 3);
  const Rules = () => <><div className="rule-grid"><div className="field"><label htmlFor="audience">Quién puede usar el comando</label><select id="audience" value={settings.audience} onChange={e => patch('audience', e.target.value)}><option value="all">Todos los espectadores</option><option value="subscribers">Suscriptores y moderadores</option><option value="moderators">Solo moderadores y broadcaster</option></select></div><div className="field"><label htmlFor="cooldown">Espera por usuario</label><div className="unit-input"><input id="cooldown" type="number" min="0" max="60" value={settings.cooldown} onChange={e => patch('cooldown', +e.target.value)}/><span>segundos</span></div></div><div className="field"><label htmlFor="maxLength">Longitud máxima</label><div className="unit-input"><input id="maxLength" type="number" min="20" max="500" value={settings.maxLength} onChange={e => patch('maxLength', +e.target.value)}/><span>caracteres</span></div></div><div className="field"><label htmlFor="blocked">Palabras bloqueadas</label><input id="blocked" placeholder="Separa las palabras con comas" value={settings.blocked} onChange={e => patch('blocked', e.target.value)}/></div></div><Toggle settings={settings} patch={patch} label="Omitir mensajes con enlaces" detail="Evita que se lean URLs durante el directo." prop="skipLinks"/><Toggle settings={settings} patch={patch} label="Omitir emotes y stickers" detail="Lee solo el texto del comentario cuando la plataforma los incluye como etiquetas." prop="skipEmotes"/></>;
  const Activity = () => <div className="activity-list">{history.length ? history.map(m => <div className="activity-row" key={m.id}><div className="user-avatar">{m.user.slice(0,2).toUpperCase()}</div><div><strong>{m.user} <span className={`activity-platform ${m.platform || 'kick'}`}>{m.platform === 'tiktok' ? 'TikTok' : 'Kick'}</span><time>{m.time}</time></strong><p>{m.content}</p></div><span className={`message-state ${m.state === 'Leído' ? 'success' : ''}`}>{m.state}</span></div>) : <div className="empty"><MessageSquare size={28}/><strong>La conversación empieza aquí</strong><p>Conecta tu canal para ver los mensajes recibidos<br/>y saber cuáles pasan tus reglas de lectura.</p></div>}</div>;

  return <div className="app-shell"><aside className="sidebar"><a className="brand" href="/" aria-label="Kivoz, inicio"><span className="brand-mark">k<span/></span>kivoz<span className="brand-dot">.</span></a><div className="workspace"><div className="workspace-icon"><Radio size={19}/></div><div><strong>Mi estudio</strong><span>Tu espacio de streaming</span></div><ChevronDown size={14}/></div><span className="nav-label">TU ESTUDIO</span><nav>{nav.map(({ name, icon: Icon }) => <button key={name} aria-label={name} title={name} aria-current={page === name ? 'page' : undefined} className={page === name ? 'active' : ''} onClick={() => setPage(name)}><Icon size={19}/>{name}{name === 'Panel general' && <span className="nav-dot"/>}</button>)}</nav><div className="sidebar-bottom"><div className="tip-card"><span className="tip-icon"><Headphones size={20}/></span><strong>Tu comunidad, en voz alta.</strong><p>Tú haces el directo.<br/>Nosotros ponemos la voz.</p><button onClick={() => setHelp(true)}>Cómo funciona <ArrowUpRight size={15}/></button></div><button aria-label="Configuración" title="Configuración" className={page === 'Configuración' ? 'side-action active' : 'side-action'} onClick={() => setPage('Configuración')}><Settings2 size={18}/>Configuración</button><button aria-label="Ayuda y primeros pasos" title="Ayuda y primeros pasos" className="side-action" onClick={() => setHelp(true)}><CircleHelp size={18}/>Ayuda y primeros pasos<ArrowUpRight size={14}/></button><div className="sidebar-footer"><span className="tiny-brand">K</span><span>Hecho para tu próximo directo</span></div></div></aside>
  <div className="main-wrap"><header className="topbar"><div><span className="breadcrumb-home">Mi estudio</span><ChevronRight size={13}/><span>{page}</span></div><div className="topbar-right"><span className="version">ESTUDIO v1.0</span><span className={`connection-badge ${status === 'online' ? 'online' : ''}`}><i/>{status === 'online' ? 'Canal conectado' : status === 'connecting' ? 'Conectando…' : 'Sin conexión'}</span><button className="profile" onClick={() => setPage('Configuración')} aria-label="Configuración del estudio">ME</button></div></header>
  <main><section className="page-heading"><div><div className="eyebrow"><span/> TU ASISTENTE DE DIRECTO</div><h1>{page === 'Panel general' ? <>Tu chat tiene <span>voz.</span></> : page === 'Voces' ? <>Una voz muy <span>tuya.</span></> : page === 'Reglas de lectura' ? <>Tú pones las <span>reglas.</span></> : page === 'Actividad' ? <>El pulso de tu <span>chat.</span></> : <>Todo a tu <span>manera.</span></>}</h1><p>{page === 'Panel general' ? 'Conecta tu canal, elige una voz y deja que tu comunidad se escuche.' : page === 'Voces' ? 'Encuentra el sonido de tu comunidad con las voces de tu dispositivo.' : page === 'Reglas de lectura' ? 'Decide qué se lee y mantén el control de tu directo.' : page === 'Actividad' ? 'Todos los mensajes y sus estados, durante esta sesión.' : 'Personaliza la conexión y guarda tus preferencias para el próximo directo.'}</p></div><button aria-label="Guardar cambios" title="Guardar cambios" className="button secondary save-button" disabled={saving || !loaded} onClick={save}>{saving ? <LoaderCircle className="spin" size={16}/> : <Save size={16}/>} {saving ? 'Guardando…' : 'Guardar cambios'}{dirty && <i className="unsaved-dot"/>}</button></section>
  {error && <div className="error" role="alert"><CircleHelp size={17}/><span>{error}</span><button aria-label="Cerrar aviso" onClick={() => setError('')}><X size={16}/></button></div>}
  {(page === 'Panel general' || page === 'Configuración') && <>
    <div className="platform-tabs" role="tablist" aria-label="Plataforma del chat">
      <button role="tab" aria-selected={activePlatform === 'kick'} className={activePlatform === 'kick' ? 'selected' : ''} onClick={() => setActivePlatform('kick')}><span className="platform-mark kick-mark">K</span><span>Kick</span><i className={connectionStates.kick}/></button>
      <button role="tab" aria-selected={activePlatform === 'tiktok'} className={activePlatform === 'tiktok' ? 'selected' : ''} onClick={() => setActivePlatform('tiktok')}><span className="platform-mark tiktok-mark">♪</span><span>TikTok LIVE</span><i className={connectionStates.tiktok}/></button>
    </div>
    <div className="connection-strip"><div className={`platform-logo ${activePlatform}`}>{activePlatform === 'kick' ? 'K' : '♪'}</div><div className="connection-copy"><strong>Tu canal de {activePlatform === 'kick' ? 'Kick' : 'TikTok LIVE'}</strong><span>{status === 'online' ? `Escuchando a la comunidad de ${activeChannel}` : 'Conecta el chat público de tu directo'}</span></div><div className="channel-input"><span>{channelPrefix}</span><input aria-label={`Nombre de canal de ${activePlatform === 'kick' ? 'Kick' : 'TikTok'}`} placeholder={activePlatform === 'kick' ? 'tu_canal' : 'tu_usuario'} value={settings[channelField]} disabled={status !== 'offline' || !loaded} onChange={e => patch(channelField, e.target.value.trim().replace(activePlatform === 'kick' ? /^(https?:\/\/)?(www\.)?kick\.com\//i : /^(https?:\/\/)?(www\.)?tiktok\.com\/@?/i, '').replace(/^@/, '').split(/[/?#]/)[0])} onKeyDown={e => e.key === 'Enter' && connect()}/></div><button onClick={connect} disabled={!loaded} className={`button ${status === 'online' ? 'secondary' : 'primary'}`}>{status === 'connecting' ? <LoaderCircle size={16} className="spin"/> : <Link2 size={16}/>} {status === 'online' ? 'Desconectar' : status === 'connecting' ? 'Cancelar' : 'Conectar canal'}{status === 'offline' && <ArrowUpRight size={16}/>}</button></div>
  </>}
  {page === 'Panel general' && <><div className="studio-grid"><section className="card voice-panel"><div className="card-heading"><div className="section-title"><span className="section-icon"><Mic2 size={18}/></span><h2>La voz de tu chat</h2></div><span className="tag">VOCES GRATIS</span></div><div className="subhead"><p>Elige quién le da vida a tus mensajes.</p><button className="text-button" onClick={() => setVoiceModal(true)}>Explorar voces <ArrowUpRight size={14}/></button></div><div className="voice-options">{featured.length ? featured.map((v,i) => <VoiceCard selectedVoice={selectedVoice} patch={patch} key={v.voiceURI} voice={v} index={i}/>) : <div className="voice-fallback"><AudioLines size={28}/><div><strong>Voz predeterminada en español</strong><p>El navegador carga las voces disponibles en tu dispositivo.</p></div><button className="icon-button" title="Actualizar voces" onClick={() => setVoices(window.speechSynthesis?.getVoices() || [])}><Radio size={17}/></button></div>}</div><div className="sliders"><Range settings={settings} patch={patch} label="Velocidad" prop="rate" min={.5} max={2} step={.1}/><Range settings={settings} patch={patch} label="Tono" prop="pitch" min={.5} max={2} step={.1}/><Range settings={settings} patch={patch} label="Volumen" prop="volume" min={0} max={1} step={.05} display={`${Math.round(settings.volume * 100)}%`}/></div><div className="voice-test"><input aria-label="Texto de prueba de voz" maxLength={300} value={testText} onChange={e => setTestText(e.target.value)} onKeyDown={e => e.key === 'Enter' && preview()}/><button onClick={preview}><Play size={14} fill="currentColor"/> Probar voz</button></div><div className="card-footnote"><Headphones size={13}/><span>La voz se reproduce en este navegador. Mantenlo abierto durante el directo.</span></div></section>
  <section className="card command-panel"><div className="card-heading"><div className="section-title"><span className="section-icon"><SlidersHorizontal size={18}/></span><h2>A tu manera</h2></div><span className="step-label">01 / AJUSTES</span></div><div className="field command-field"><label htmlFor="command">Comando de activación <span>PERSONALIZABLE</span></label><div className="command-input"><span>⌘</span><input id="command" value={settings.command} maxLength={20} onChange={e => patch('command', e.target.value.replace(/\s/g, ''))}/><span className="key-label">COMANDO</span></div><small>Solo se leen los mensajes que empiecen con este comando.</small></div><div className="chat-example"><span className="example-label">ASÍ LO USA TU CHAT</span><div><span className="example-user">tu_comunidad</span><p><b>{settings.command || '!aa'}</b> ¡Hola, streamer!</p></div></div><Toggle settings={settings} patch={patch} label="Leer nombre de usuario" detail="Antes de cada mensaje" prop="readName"/><button className="rules-link" onClick={() => setPage('Reglas de lectura')}><ShieldCheck size={16}/>Filtros y reglas de lectura<ArrowRight size={16}/></button></section></div>
  <div className="session-summary"><span><span className="session-dot"/> ESTA SESIÓN</span><div><MessageSquare size={15}/><strong>{readCount}</strong> mensajes leídos</div><div><ListFilter size={15}/><strong>{filtered}</strong> filtrados</div><div><AudioLines size={15}/><strong>{queue.length}</strong> en cola</div><span className="summary-note">Tu directo, bajo control.</span></div>
  <section className="card queue-panel"><div className="card-heading"><div className="section-title"><span className="section-icon"><AudioLines size={18}/></span><h2>Cola de lectura</h2><span className="count-badge">{queue.length}</span></div><div className="queue-actions"><button aria-label={paused ? 'Reanudar lectura' : 'Pausar lectura'} onClick={togglePause} className={paused ? 'is-paused' : ''}>{paused ? <Play size={14}/> : <Pause size={14}/>}<span>{paused ? 'Reanudar' : 'Pausar'}</span></button><button aria-label="Vaciar cola" onClick={clear} disabled={!queue.length}><Trash2 size={14}/><span>Vaciar cola</span></button></div></div><div className={`now-playing ${speaking && !paused ? 'playing' : ''}`}><div className="waveform">{Array.from({ length: 21 },(_,i) => <i key={i} style={{ '--h': `${8 + ((i * 13 + 11) % 30)}px`, '--delay': `${i * .06}s` }}/>)}</div><div className="playing-copy"><span>{speaking ? paused ? 'LECTURA EN PAUSA' : 'LEYENDO AHORA' : 'TODO LISTO PARA ESCUCHAR'}</span><strong>{speaking ? speaking.text : 'El próximo mensaje tiene la palabra.'}</strong><small>{speaking ? speaking.user : `Los mensajes con ${settings.command || '!aa'} aparecen aquí al conectar tu canal.`}</small></div><button className="skip-button" disabled={!speaking} aria-label="Saltar mensaje actual" onClick={skip}><SkipForward size={19}/></button></div>{queue.length > 0 && <div className="queued-messages">{queue.slice(0,5).map((m,i) => <div key={m.id}><span>{String(i + 1).padStart(2,'0')}</span><strong>{m.user}</strong><p>{m.text}</p><button aria-label={`Eliminar mensaje de ${m.user}`} onClick={() => { queueRef.current = queueRef.current.filter(x => x.id !== m.id); updateQueue(); setHistory(h => h.map(x => x.id === m.id ? { ...x, state: 'Eliminado' } : x)); }}><X size={15}/></button></div>)}{queue.length > 5 && <small>Y {queue.length - 5} mensajes más…</small>}</div>}<div className="queue-bottom"><span><ShieldCheck size={13}/> Filtrado antes de llegar a tus oídos</span><button onClick={() => setPage('Actividad')}>Ver actividad <ArrowRight size={13}/></button></div></section></>}
  {page === 'Voces' && <>
    <section className="card standalone"><div className="card-heading"><div className="section-title"><Mic2 size={19}/><h2>Biblioteca de voces</h2></div><span className="tag">{voices.length} DISPONIBLES</span></div><p className="muted">Las voces se reproducen localmente y están disponibles para Kick y TikTok. La lista depende de tu navegador y sistema operativo.</p><input className="search" placeholder="Buscar por nombre o idioma…" aria-label="Buscar voces" value={search} onChange={e => setSearch(e.target.value)}/><div className="voice-library">{voices.filter(v => `${v.name} ${v.lang}`.toLowerCase().includes(search.toLowerCase())).map((v,i) => <VoiceCard selectedVoice={selectedVoice} patch={patch} key={v.voiceURI} voice={v} index={i}/>)}</div>{!voices.length && <p className="muted">No se han detectado voces. Instala voces en los ajustes de idioma de tu dispositivo o prueba Chrome o Edge.</p>}<div className="sliders"><Range settings={settings} patch={patch} label="Velocidad" prop="rate" min={.5} max={2} step={.1}/><Range settings={settings} patch={patch} label="Tono" prop="pitch" min={.5} max={2} step={.1}/><Range settings={settings} patch={patch} label="Volumen" prop="volume" min={0} max={1} step={.05} display={`${Math.round(settings.volume * 100)}%`}/></div><div className="voice-test"><input aria-label="Texto para probar voz" value={testText} maxLength={300} onChange={e => setTestText(e.target.value)}/><button onClick={preview}><Play size={14}/>Probar voz</button></div></section>
    <section className="card standalone voice-plus-panel"><div className="card-heading"><div className="section-title"><span className="plus-mark"><Plus size={15}/></span><h2>Voces Plus+</h2></div><span className="tag">CHILE · es-CL</span></div><p className="muted">Voces en español chileno que ya están instaladas en este dispositivo. Los estilos aplican ritmo y tono a tu voz seleccionada; no son clones de voces reales.</p><div className="voice-presets">{[{ name: 'Locución chilena', rate: 1, pitch: 1 }, { name: 'Meme rápido', rate: 1.35, pitch: 1.15 }, { name: 'Narración dramática', rate: .82, pitch: .88 }].map(preset => <button key={preset.name} className="voice-preset" onClick={() => applyVoicePreset(preset)}><strong>{preset.name}</strong><small>{chileanVoices.length ? 'Usa una voz es-CL disponible' : 'Usa una voz en español disponible'}</small></button>)}</div>{chileanVoices.length ? <div className="voice-library">{chileanVoices.map((voice,index) => <VoiceCard selectedVoice={selectedVoice} patch={patch} key={voice.voiceURI} voice={voice} index={index}/>)}</div> : <div className="info-box"><AudioLines size={19}/><p>Este navegador no informa voces `es-CL` instaladas. Revisa las opciones de voz de tu sistema y vuelve a cargar la página; la disponibilidad depende del dispositivo.</p></div>}<p className="voice-licensing-note">No se incluyen clones ni imitaciones de famosos o personas reales.</p></section>
    <section className="card standalone voice-rules-panel"><div className="card-heading"><div className="section-title"><span className="section-icon"><Crown size={19}/></span><h2>Voces por usuario y rol</h2></div><span className="tag">KICK + TIKTOK</span></div><p className="muted">Asigna una voz a un usuario, moderadores, suscriptores o personas que hayan enviado regalos. La coincidencia por usuario tiene prioridad; los regalos de TikTok se reconocen durante esta sesión.</p>
      <form className="voice-rule-form" onSubmit={addVoiceRule}>
        <div className="field"><label htmlFor="voice-rule-platform">Plataforma</label><select id="voice-rule-platform" value={rulePlatform} onChange={e => setRulePlatform(e.target.value)}><option value="all">Kick y TikTok</option><option value="kick">Solo Kick</option><option value="tiktok">Solo TikTok</option></select></div>
        <div className="field"><label htmlFor="voice-rule-type">Aplicar a</label><select id="voice-rule-type" value={ruleType} onChange={e => { setRuleType(e.target.value); setRuleValue(''); }}><option value="username">Usuario específico</option><option value="role">Rol (moderador o streamer)</option><option value="subscriber">Suscriptor</option><option value="donor">Donador / regalador</option></select></div>
        {ruleType === 'username' && <div className="field"><label htmlFor="voice-rule-value">Nombre de usuario</label><input id="voice-rule-value" required minLength={1} maxLength={32} value={ruleValue} onChange={e => setRuleValue(e.target.value.replace(/^@/, ''))} placeholder="usuario"/></div>}
        {ruleType === 'role' && <div className="field"><label htmlFor="voice-rule-value">Rol</label><select id="voice-rule-value" required value={ruleValue} onChange={e => setRuleValue(e.target.value)}><option value="">Elige un rol</option><option value="moderator">Moderador</option><option value="broadcaster">Streamer</option></select></div>}
        <div className="field"><label htmlFor="voice-rule-voice">Voz asignada</label><select id="voice-rule-voice" required value={ruleVoice} onChange={e => setRuleVoice(e.target.value)}><option value="">Elige una voz</option>{voices.map(voice => <option key={voice.voiceURI} value={voice.voiceURI}>{voice.name} · {voice.lang}</option>)}</select></div>
        <button className="button primary"><Plus size={16}/>Añadir regla</button>
      </form>
      <div className="voice-rule-list">{(settings.voiceRules || []).map(rule => {
        const voice = voices.find(item => item.voiceURI === rule.voice);
        const target = rule.type === 'username' ? `@${rule.value}` : rule.type === 'role' ? (rule.value === 'moderator' ? 'Moderadores' : 'Streamer') : rule.type === 'subscriber' ? 'Suscriptores' : 'Donadores / regaladores';
        return <div className="voice-rule-row" key={rule.id}><span className="rule-target">{target}</span><span className="rule-platform">{rule.platform === 'all' ? 'Kick + TikTok' : rule.platform === 'kick' ? 'Kick' : 'TikTok'}</span><strong>{voice?.name || 'Voz no disponible'}</strong><button className="icon-button danger-action" aria-label={`Eliminar regla para ${target}`} onClick={() => removeVoiceRule(rule.id)}><Trash2 size={16}/></button></div>;
      })}{!(settings.voiceRules || []).length && <p className="muted">Todavía no hay asignaciones personalizadas.</p>}</div>
    </section>
  </>}
  {page === 'Reglas de lectura' && <section className="card standalone"><div className="card-heading"><div className="section-title"><ShieldCheck size={19}/><h2>Un chat que suena bien</h2></div><span className="tag">MODERACIÓN</span></div><p className="muted">Los cambios se aplican a los nuevos mensajes. La cola admite hasta 50 mensajes.</p>{Rules()}</section>}
  {page === 'Actividad' && <section className="card standalone"><div className="card-heading"><div className="section-title"><MessageSquare size={19}/><h2>Mensajes de la sesión</h2></div><span className="tag">{history.length} RECIENTES</span></div>{Activity()}</section>}
  {page === 'Configuración' && <section className="card standalone"><div className="card-heading"><div className="section-title"><Settings2 size={19}/><h2>Preferencias del estudio</h2></div></div><div className="rule-grid"><div className="field"><label htmlFor="settings-command">Comando de lectura</label><input id="settings-command" maxLength={20} value={settings.command} onChange={e => patch('command', e.target.value.replace(/\s/g,''))}/></div><div className="field"><label>Voz seleccionada</label><button className="button secondary" onClick={() => setVoiceModal(true)}>{voiceName}<ChevronDown size={15}/></button></div></div><Toggle settings={settings} patch={patch} label="Leer nombre de usuario" detail="Anuncia quién envía cada mensaje." prop="readName"/><div className="info-box"><ShieldCheck size={20}/><p>Los ajustes se guardan para este navegador mediante una cookie privada. La actividad y la cola son temporales y se vacían al cerrar o recargar la página.</p></div><button className="button secondary" onClick={() => { changed.current = true; setSettings(defaults); setDirty(true); notice('Preferencias restablecidas. Guarda los cambios para conservarlas.'); }}>Restablecer preferencias</button></section>}
  <footer className="main-footer"><span><i/> Menos distracciones. Más comunidad.</span><span>Creado para streamers de <b>KICK + TIKTOK</b><ArrowUpRight size={12}/></span></footer></main></div>
  {toast && <div className="toast" role="status"><CheckCheck size={18}/>{toast}<button onClick={() => setToast('')} aria-label="Cerrar notificación"><X size={15}/></button></div>}
  {voiceModal && <div className="modal-backdrop" onClick={() => setVoiceModal(false)}><section className="modal" role="dialog" aria-modal="true" aria-labelledby="voice-modal-title" onClick={e => e.stopPropagation()}><div className="card-heading"><div><h2 id="voice-modal-title">Encuentra tu voz</h2><p className="muted">Voces disponibles en tu dispositivo.</p></div><button autoFocus className="icon-button" aria-label="Cerrar voces" onClick={() => setVoiceModal(false)}><X size={20}/></button></div><input className="search" placeholder="Buscar por nombre o idioma…" aria-label="Buscar voz" value={search} onChange={e => setSearch(e.target.value)}/><div className="voice-library">{voices.filter(v => `${v.name} ${v.lang}`.toLowerCase().includes(search.toLowerCase())).map((v,i) => <VoiceCard selectedVoice={selectedVoice} patch={patch} key={v.voiceURI} voice={v} index={i}/>)}</div>{!voices.length && <p className="muted">Tu navegador aún no tiene voces disponibles. Prueba con Chrome o Edge e instala un idioma de voz en los ajustes del sistema.</p>}<button className="button primary modal-done" onClick={() => setVoiceModal(false)}><Check size={16}/>Usar esta voz</button></section></div>}
  {help && <div className="modal-backdrop" onClick={() => setHelp(false)}><section className="modal help-modal" role="dialog" aria-modal="true" aria-labelledby="help-title" onClick={e => e.stopPropagation()}><div className="card-heading"><h2 id="help-title">Tu primer directo con Kivoz</h2><button autoFocus className="icon-button" aria-label="Cerrar ayuda" onClick={() => setHelp(false)}><X size={20}/></button></div><ol><li><strong>Conecta tu comunidad</strong><p>Elige Kick o TikTok LIVE, introduce el usuario del canal y pulsa Conectar canal. No necesitas compartir credenciales.</p></li><li><strong>Dale tu toque</strong><p>Elige una voz, ajusta el tono y prueba el audio. El comando inicial es !aa y puedes cambiarlo cuando quieras.</p></li><li><strong>Deja que hable el chat</strong><p>Un mensaje como «!aa ¡Hola!» se añade a la cola. Mantén esta pestaña abierta y con sonido. Usa OBS para capturar el audio del navegador si lo quieres en tu directo.</p></li></ol><div className="info-box"><CircleHelp size={20}/><p>Kick y TikTok LIVE pueden cambiar o restringir sus conexiones públicas. TikTok necesita el puente Node configurado; no se simulan mensajes. La lectura requiere un navegador compatible con Web Speech.</p></div><button className="button primary" onClick={() => setHelp(false)}>Todo listo <ArrowRight size={16}/></button></section></div>}
  </div>;
}

createRoot(document.getElementById('root')).render(<App/>);
