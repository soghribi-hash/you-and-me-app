/* ============================================================
   You & Me.  —  Soso (a) & Nono (b)
   ============================================================ */

/* ---------- IDENTITÉS ---------- */
const NAMES = { a: 'Soso', b: 'Nono' };
const nameOf = r => NAMES[r] || 'Quelqu\u2019un';

/* ---------- ÉTAT ---------- */
let myRole = localStorage.getItem('yam_role');
if (myRole !== 'a' && myRole !== 'b') myRole = null;
let room = localStorage.getItem('yam_room');
let otherRole = myRole === 'b' ? 'a' : 'b';
let myName = myRole ? NAMES[myRole] : '';
let otherName = NAMES[otherRole];

let app, db, roomRef;
let selectedRole = null;
let currentMonthDate = new Date();
let selectedDateKey = null;
let selectedKind = 'ev';
let calendarEvents = {};
let annivStr = '2025-05-18';
let currentColor = '#D62E63';
let currentWidth = 2;
let currentAlpha = 1;
let drawing = false;
let canvasDirty = false;
let lastX = 0, lastY = 0;
let notifOn = localStorage.getItem('yam_notif') === 'on';

/* ---------- UTILITAIRES ---------- */
function escapeHtml(str) {
  const d = document.createElement('div');
  d.textContent = str == null ? '' : String(str);
  return d.innerHTML;
}
function cut(s, n) { s = String(s || ''); return s.length > n ? s.slice(0, n - 1) + '\u2026' : s; }
function relativeTime(ts) {
  const diff = Math.floor((Date.now() - ts) / 60000);
  if (diff < 1) return "à l'instant";
  if (diff < 60) return 'il y a ' + diff + ' min';
  const h = Math.floor(diff / 60);
  if (h < 24) return 'il y a ' + h + 'h';
  return 'il y a ' + Math.floor(h / 24) + 'j';
}
function shortDate(key) {
  return new Date(key + 'T00:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}
function formatKey(d) {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
const $ = id => document.getElementById(id);

/* ---------- NOTIFICATIONS : bannière dans l'app + notif système ---------- */
let dbErrShown = false;
function dbError(err) {
  if (dbErrShown) return;
  dbErrShown = true;
  showBanner('La base ne répond pas (' + ((err && (err.code || err.message)) || 'erreur') + '). Vérifie ta connexion et les règles Firebase.');
}
const onValue = (ref, cb) => ref.on('value', cb, dbError);

function showBanner(text, screen) {
  const box = $('banners');
  if (!box) return;
  while (box.children.length >= 3) box.removeChild(box.firstChild);
  const el = document.createElement('div');
  el.className = 'banner';
  el.innerHTML =
    '<div class="b-icon">You<br>&amp; Me.</div>' +
    '<div class="b-text"><div class="b-top"><span>YOU &amp; ME.</span><span>maintenant</span></div>' +
    '<div class="b-msg">' + escapeHtml(text) + '</div></div>';
  const close = () => { el.classList.add('out'); setTimeout(() => el.remove(), 320); };
  el.addEventListener('click', () => { if (screen) showScreen(screen); close(); });
  box.appendChild(el);
  setTimeout(close, 4200);
}

async function systemNotify(text) {
  if (!notifOn || !('Notification' in window) || Notification.permission !== 'granted') return;
  try {
    const reg = navigator.serviceWorker && (await navigator.serviceWorker.getRegistration());
    if (reg && reg.showNotification) {
      await reg.showNotification('You & Me.', { body: text, icon: 'icon-192.png', badge: 'icon-192.png' });
      return;
    }
  } catch (e) { /* on retombe sur new Notification */ }
  try { new Notification('You & Me.', { body: text, icon: 'icon-192.png' }); } catch (e) {}
}

// Une interaction de l'autre personne : bannière si l'app est ouverte, notif système si elle est en arrière-plan.
function notify(text, screen) {
  if (document.hidden) systemNotify(text);
  else showBanner(text, screen);
}

let toastTimer;
function toast(text) {
  const t = $('toast');
  t.textContent = text;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 1800);
}

function toggleNotifications() {
  const btn = $('notif-toggle');
  if (!notifOn) {
    if (!('Notification' in window)) {
      showBanner("Les notifications système ne sont pas dispo ici. Ajoute l'app à l'écran d'accueil (Partager > Sur l'écran d'accueil) puis rouvre-la.");
      return;
    }
    Notification.requestPermission().then(perm => {
      if (perm === 'granted') {
        notifOn = true;
        localStorage.setItem('yam_notif', 'on');
        btn.classList.remove('off');
        toast('Notifications activées');
      } else {
        showBanner("Autorisation refusée : active les notifications pour l'app dans les réglages du téléphone.");
      }
    });
  } else {
    notifOn = false;
    localStorage.setItem('yam_notif', 'off');
    btn.classList.add('off');
  }
}
if (notifOn) $('notif-toggle').classList.remove('off');

/* ---------- EFFET CŒURS ---------- */
const HEART_SVG = '<svg viewBox="0 0 24 24" width="26" height="26"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" fill="#D62E63"/></svg>';
function burstHearts(originEl, n) {
  const fx = $('fx');
  let x = window.innerWidth / 2, y = window.innerHeight / 2;
  if (originEl && originEl.offsetParent !== null) {
    const r = originEl.getBoundingClientRect();
    x = r.left + r.width / 2; y = r.top + r.height / 2;
  }
  for (let i = 0; i < n; i++) {
    const h = document.createElement('div');
    h.className = 'fx-heart';
    h.innerHTML = HEART_SVG;
    h.style.left = (x - 13) + 'px';
    h.style.top = (y - 13) + 'px';
    fx.appendChild(h);
    const dx = (Math.random() - 0.5) * 170;
    const s = 0.8 + Math.random() * 1.1;
    const a = h.animate([
      { transform: 'translate(0,0) scale(.4)', opacity: 0 },
      { transform: 'translate(' + (dx / 2) + 'px,-80px) scale(' + s + ')', opacity: 1, offset: 0.25 },
      { transform: 'translate(' + dx + 'px,-230px) scale(' + (s * 1.1) + ')', opacity: 0 }
    ], { duration: 1400 + Math.random() * 600, delay: i * 70, easing: 'ease-out', fill: 'forwards' });
    a.onfinish = () => h.remove();
  }
}

/* ---------- INIT ---------- */
function applyNames() {
  otherRole = myRole === 'b' ? 'a' : 'b';
  myName = myRole ? NAMES[myRole] : '';
  otherName = NAMES[otherRole];
  $('her-note-label').textContent = 'Note de ' + otherName;
  $('partner-name-label').textContent = 'MOOD DE ' + otherName.toUpperCase();
  $('partner-status').textContent = otherName + ' \u00b7 hors ligne';
  $('other-photo-label').textContent = 'Photo de ' + otherName;
  $('me-profile-name').textContent = myName ? 'Tu es ' + myName : '';
}

function initFirebase() {
  if (typeof firebase === 'undefined') {
    showBanner("Impossible de charger Firebase (pas de connexion ?). Relance l'app une fois en ligne.");
    return;
  }
  if (/COLLE_TA_CLE/.test(firebaseConfig.apiKey)) {
    showBanner('firebase-config.js contient encore la config d\u2019exemple.');
    return;
  }
  app = firebase.initializeApp(firebaseConfig);
  db = firebase.database();
  roomRef = db.ref('rooms/' + room);
  setupPresence();
  listenPartnerProfile();
  listenHeart();
  listenMusic();
  listenAnniversary();
  listenCalendar();
  listenNotes();
  listenChat();
  listenPhotos();
  bindMyControls();
}

/* ---------- ONBOARDING ---------- */
function pickRole(r) {
  selectedRole = r;
  $('role-a').classList.toggle('selected', r === 'a');
  $('role-b').classList.toggle('selected', r === 'b');
}
function finishOnboarding() {
  const roomVal = $('ob-room').value.trim().toLowerCase();
  if (!selectedRole || !roomVal) {
    showBanner('Choisis qui tu es (Soso ou Nono) et entre le code secret.');
    return;
  }
  localStorage.setItem('yam_role', selectedRole);
  localStorage.setItem('yam_room', roomVal);
  localStorage.removeItem('yam_name');
  myRole = selectedRole; room = roomVal;
  applyNames();
  $('onboarding').classList.add('hidden');
  initFirebase();
}
function resetIdentity() {
  if (!confirm('Changer de profil ? Tu devras re-choisir Soso / Nono et re-saisir le code secret.')) return;
  ['yam_role', 'yam_room', 'yam_name'].forEach(k => localStorage.removeItem(k));
  location.reload();
}

/* ---------- NAV ---------- */
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  $(id).classList.add('active');
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  const nb = document.querySelector('.nav-btn[onclick="showScreen(\'' + id + '\')"]');
  if (nb) nb.classList.add('active');
  if (id === 'calendar') renderCalendar();
  if (id === 'chat') scrollChatToBottom();
  if (id === 'notes') ensureCanvas();
}

/* ---------- PRÉSENCE ---------- */
function setupPresence() {
  const myRef = roomRef.child('profiles/' + myRole);
  myRef.child('name').set(myName);
  db.ref('.info/connected').on('value', snap => {
    if (snap.val() === true) {
      myRef.child('online').onDisconnect().set(false);
      myRef.child('lastSeen').onDisconnect().set(firebase.database.ServerValue.TIMESTAMP);
      myRef.child('online').set(true);
      myRef.child('lastSeen').set(firebase.database.ServerValue.TIMESTAMP);
    }
  });
}

/* ---------- PROFILS : présence, mood, statut, photo ---------- */
let partnerBase = false, lastPartnerMoodTs = 0, lastPartnerStatusTs = 0, lastPartnerPhotoSig = '';
let partnerMoodTs = 0;

function listenPartnerProfile() {
  onValue(roomRef.child('profiles/' + otherRole), snap => {
    const data = snap.val() || {};
    const avatar = $('partner-avatar');
    avatar.classList.toggle('on', !!data.online);
    avatar.classList.toggle('off', !data.online);
    avatar.style.backgroundImage = data.photo ? 'url(' + data.photo + ')' : '';
    avatar.style.backgroundSize = 'cover';
    $('partner-status').textContent = data.online ? otherName + ' est en ligne' : otherName + ' \u00b7 hors ligne';

    $('partner-mood').textContent = data.mood || '\u{1F90D}';
    partnerMoodTs = data.moodTs || 0;
    $('partner-mood-time').textContent = partnerMoodTs ? relativeTime(partnerMoodTs) : '';
    $('partner-status-chip').textContent = data.status || '';
    $('her-avatar-preview').innerHTML = data.photo ? '<img src="' + data.photo + '">' : '';

    const photoSig = data.photo ? data.photo.length + ':' + data.photo.slice(-24) : '';
    if (partnerBase) {
      if (data.mood && data.moodTs && data.moodTs !== lastPartnerMoodTs) notify(otherName + ' a mis son mood : ' + data.mood, 'home');
      if (data.status && data.statusTs && data.statusTs !== lastPartnerStatusTs) notify(otherName + ' a mis son statut : ' + data.status, 'home');
      if (photoSig && photoSig !== lastPartnerPhotoSig) notify(otherName + ' a changé sa photo de profil', 'settings');
    }
    lastPartnerMoodTs = data.moodTs || 0;
    lastPartnerStatusTs = data.statusTs || 0;
    lastPartnerPhotoSig = photoSig;
    partnerBase = true;
  });

  onValue(roomRef.child('profiles/' + myRole), snap => {
    const data = snap.val() || {};
    document.querySelectorAll('.mood-bubble').forEach(b => b.classList.toggle('selected', b.dataset.mood === data.mood));
    document.querySelectorAll('.status-chip').forEach(c => c.classList.toggle('active', c.dataset.status === data.status));
    $('my-avatar-preview').innerHTML = data.photo ? '<img src="' + data.photo + '">' : '';
  });
}

let controlsBound = false;
function bindMyControls() {
  if (controlsBound) return;
  controlsBound = true;
  document.querySelectorAll('.mood-bubble').forEach(b => {
    b.addEventListener('click', () => {
      roomRef.child('profiles/' + myRole).update({ mood: b.dataset.mood, moodTs: Date.now() });
      toast('Mood envoyé à ' + otherName + ' ' + b.dataset.mood);
    });
  });
  document.querySelectorAll('.status-chip').forEach(c => {
    c.addEventListener('click', () => {
      roomRef.child('profiles/' + myRole).update({ status: c.dataset.status, statusTs: Date.now() });
      toast('Statut envoyé à ' + otherName);
    });
  });
  const enter = (id, fn) => $(id).addEventListener('keydown', e => { if (e.key === 'Enter') fn(); });
  enter('music-input', shareMusic);
  enter('note-word', sendNote);
  enter('chat-input', sendMessage);
  enter('annot-input', saveAnnotation);
}

/* ---------- CŒUR ---------- */
let lastHeartSent = 0, heartBase = false, lastHeartTs = 0;
function sendHeart() {
  const btn = $('heart-btn');
  btn.classList.remove('pulse'); void btn.offsetWidth; btn.classList.add('pulse');
  burstHearts(btn, 9);
  if (navigator.vibrate) navigator.vibrate(25);
  if (!roomRef) { showBanner("Pas encore connecté à la base — vérifie ta connexion."); return; }
  const now = Date.now();
  if (now - lastHeartSent < 400) return;   // l'animation reste immédiate, mais on n'écrit pas 10 fois par seconde
  lastHeartSent = now;
  roomRef.child('heart').set({ from: myRole, ts: firebase.database.ServerValue.TIMESTAMP });
  toast('Cœur envoyé à ' + otherName);
}
function listenHeart() {
  onValue(roomRef.child('heart'), snap => {
    const d = snap.val();
    if (!heartBase) {
      heartBase = true;
      lastHeartTs = d ? d.ts : 0;
      // Cœur reçu pendant que l'app était fermée : on l'affiche une seule fois à l'ouverture (si < 24 h)
      const seen = parseInt(localStorage.getItem('yam_heart_ts') || '0', 10);
      if (d && d.from !== myRole && d.ts > seen && Date.now() - d.ts < 86400000) {
        localStorage.setItem('yam_heart_ts', String(d.ts));
        burstHearts($('heart-btn'), 12);
        showBanner(nameOf(d.from) + ' vous a envoyé un cœur', 'home');
      }
      return;
    }
    if (!d || d.from === myRole || d.ts === lastHeartTs) return;
    lastHeartTs = d.ts;
    localStorage.setItem('yam_heart_ts', String(d.ts));
    burstHearts($('heart-btn'), 12);
    if (navigator.vibrate) navigator.vibrate([40, 60, 40]);
    notify(nameOf(d.from) + ' vous a envoyé un cœur', 'home');
  });
}

/* ---------- MUSIQUE ---------- */
let currentMusic = null, musicBase = false, lastMusicTs = 0;
function normalizeUrl(s) {
  if (/^https?:\/\//i.test(s)) return s;
  if (/^[\w-]+(\.[\w-]+)+(\/\S*)?$/.test(s)) return 'https://' + s;
  return null;
}
function musicLabel(url) {
  const u = normalizeUrl(url);
  if (!u) return url;
  try {
    const h = new URL(u).hostname.replace(/^www\./, '');
    if (/spotify/.test(h)) return 'Lien Spotify';
    if (/youtu/.test(h)) return 'Lien YouTube';
    if (/deezer/.test(h)) return 'Lien Deezer';
    if (/apple/.test(h)) return 'Lien Apple Music';
    return h;
  } catch (e) { return url; }
}
function shareMusic() {
  const input = $('music-input');
  const val = input.value.trim();
  if (!val || !roomRef) return;
  roomRef.child('music').set({ url: val, from: myRole, ts: Date.now() });
  input.value = '';
  toast('Musique envoyée à ' + otherName);
}
function openMusic() {
  const u = currentMusic && normalizeUrl(currentMusic.url);
  if (u) window.open(u, '_blank', 'noopener');
}
function renderMusic() {
  const vinyl = $('vinyl');
  if (currentMusic && currentMusic.url) {
    $('music-title').textContent = musicLabel(currentMusic.url);
    const canOpen = !!normalizeUrl(currentMusic.url);
    $('music-subtitle').textContent = 'Partagé par ' + (currentMusic.from === myRole ? 'toi' : nameOf(currentMusic.from)) + ' \u00b7 ' + relativeTime(currentMusic.ts) + (canOpen ? ' \u00b7 touche pour écouter' : '');
    vinyl.classList.add('spin');
  } else {
    $('music-title').textContent = "Rien de partagé pour l'instant";
    $('music-subtitle').textContent = 'Envoie-lui un son \u2728';
    vinyl.classList.remove('spin');
  }
}
function listenMusic() {
  onValue(roomRef.child('music'), snap => {
    const data = snap.val();
    currentMusic = data;
    renderMusic();
    if (musicBase && data && data.from !== myRole && data.ts !== lastMusicTs) notify(nameOf(data.from) + ' a partagé une musique', 'home');
    lastMusicTs = data ? data.ts : 0;
    musicBase = true;
  });
}
setInterval(() => {
  if (partnerMoodTs) $('partner-mood-time').textContent = relativeTime(partnerMoodTs);
  if (currentMusic) renderMusic();
}, 30000);

/* ---------- ANNIVERSAIRE ---------- */
let annivBase = false, lastAnnivSig = null;
function listenAnniversary() {
  const input = $('anniversary-date');
  onValue(roomRef.child('settings'), snap => {
    const s = snap.val() || {};
    const val = s.anniversaryDate || '2025-05-18';
    annivStr = val;
    input.value = val;
    renderCountdown(val);
    renderCalendar();
    const sig = val + '|' + (s.anniversaryBy || '');
    if (annivBase && s.anniversaryBy && s.anniversaryBy !== myRole && sig !== lastAnnivSig) {
      notify(nameOf(s.anniversaryBy) + ' a modifié la date de votre anniversaire', 'calendar');
    }
    lastAnnivSig = sig;
    annivBase = true;
  });
  input.addEventListener('change', () => {
    if (!input.value) return;
    roomRef.child('settings').update({ anniversaryDate: input.value, anniversaryBy: myRole });
  });
}
function renderCountdown(dateStr) {
  const anniv = new Date(dateStr + 'T00:00:00');
  if (isNaN(anniv)) return;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  let next = new Date(today.getFullYear(), anniv.getMonth(), anniv.getDate());
  if (next < today) next = new Date(today.getFullYear() + 1, anniv.getMonth(), anniv.getDate());
  const daysLeft = Math.round((next - today) / 86400000);
  const yearsAtNext = next.getFullYear() - anniv.getFullYear();
  const daysSince = Math.round((today - anniv) / 86400000);

  $('countdown-days').textContent = daysLeft;
  $('next-anniv-date').textContent = next.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
  $('next-anniv-sub').textContent = yearsAtNext > 0 ? yearsAtNext + ' an' + (yearsAtNext > 1 ? 's' : '') + ' ensemble ce jour-là' : '';
  $('since-pill').textContent = daysSince > 0 ? 'Ensemble depuis ' + daysSince + ' jours' : '';
  $('since-pill').style.display = daysSince > 0 ? 'inline-block' : 'none';

  const circumference = 2 * Math.PI * 52;
  const progress = Math.max(0, Math.min(1, 1 - daysLeft / 365));
  const arc = $('countdown-arc');
  arc.setAttribute('stroke-dasharray', circumference);
  arc.setAttribute('stroke-dashoffset', circumference * (1 - progress));
}

/* ---------- CALENDRIER (plusieurs annotations par jour, par l'un ou l'autre) ---------- */
let calendarBase = false;
const knownEvents = new Set();

// Compat : anciennes données { note, by } directement sous la date
function eventsFor(key) {
  const v = calendarEvents[key];
  if (!v) return [];
  if (typeof v.note === 'string') return [{ id: '_legacy', text: v.note, kind: 'ev', by: v.by, ts: 0 }];
  return Object.keys(v).map(id => Object.assign({ id }, v[id])).sort((a, b) => (a.ts || 0) - (b.ts || 0));
}

function listenCalendar() {
  onValue(roomRef.child('calendar'), snap => {
    calendarEvents = snap.val() || {};
    const all = [];
    Object.keys(calendarEvents).forEach(key => eventsFor(key).forEach(e => all.push(Object.assign({ key }, e))));
    if (calendarBase) {
      all.forEach(e => {
        const uid = e.key + '/' + e.id;
        if (!knownEvents.has(uid) && e.by && e.by !== myRole && e.ts !== 0) {
          notify(nameOf(e.by) + ' a ajouté ' + (e.kind === 'ac' ? 'une activité' : 'un événement') + ' le ' + shortDate(e.key) + ' : ' + cut(e.text, 40), 'calendar');
        }
      });
    }
    all.forEach(e => knownEvents.add(e.key + '/' + e.id));
    calendarBase = true;
    renderCalendar();
  });
}

function changeMonth(delta) {
  currentMonthDate = new Date(currentMonthDate.getFullYear(), currentMonthDate.getMonth() + delta, 1);
  renderCalendar();
}

function renderCalendar() {
  const grid = $('cal-grid');
  const year = currentMonthDate.getFullYear();
  const month = currentMonthDate.getMonth();
  const monthLabel = currentMonthDate.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  $('cal-month-label').textContent = monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1);

  const anniv = new Date(annivStr + 'T00:00:00');
  let html = ['L', 'M', 'M', 'J', 'V', 'S', 'D'].map(d => '<div class="dow">' + d + '</div>').join('');
  const startOffset = (new Date(year, month, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const todayKey = formatKey(new Date());
  if (!selectedDateKey) selectedDateKey = todayKey;

  for (let i = 0; i < startOffset; i++) html += '<div></div>';
  for (let d = 1; d <= daysInMonth; d++) {
    const key = formatKey(new Date(year, month, d));
    let cls = 'day';
    if (key === todayKey) cls += ' today';
    if (key === selectedDateKey) cls += ' selected';
    if (!isNaN(anniv) && anniv.getMonth() === month && anniv.getDate() === d && year >= anniv.getFullYear()) cls += ' anniv';
    const evs = eventsFor(key);
    const dots = evs.length ? '<span class="dots">' + evs.slice(0, 3).map(e => '<i class="' + (e.kind === 'ac' ? 'ac' : '') + '"></i>').join('') + '</span>' : '';
    html += '<div class="' + cls + '" onclick="selectDay(\'' + key + '\')">' + d + dots + '</div>';
  }
  grid.innerHTML = html;
  renderDayDetail();
}

function renderDayDetail() {
  if (!selectedDateKey) return;
  const d = new Date(selectedDateKey + 'T00:00:00');
  const t = d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
  $('day-detail-title').textContent = t.charAt(0).toUpperCase() + t.slice(1);
  const evs = eventsFor(selectedDateKey);
  $('day-events').innerHTML = evs.length
    ? evs.map(e =>
        '<div class="ev-row"><span class="ev-dot ' + (e.kind === 'ac' ? 'ac' : '') + '"></span>' +
        '<div class="ev-text">' + escapeHtml(e.text) + '<div class="ev-by">' + (e.by === myRole ? 'Toi' : nameOf(e.by)) + ' \u00b7 ' + (e.kind === 'ac' ? 'Activité' : 'Événement') + '</div></div>' +
        '<button class="ev-del" aria-label="Supprimer" onclick="deleteEvent(\'' + selectedDateKey + '\',\'' + e.id + '\')">\u2715</button></div>').join('')
    : '<div class="ev-empty">Rien de prévu ce jour-là</div>';
}

function selectDay(key) {
  selectedDateKey = key;
  renderCalendar();
}

function setKind(k) {
  selectedKind = k;
  document.querySelectorAll('.kind').forEach(b => b.classList.toggle('on', b.dataset.kind === k));
}

async function saveAnnotation() {
  const input = $('annot-input');
  const text = input.value.trim();
  if (!text || !selectedDateKey || !roomRef) return;
  const key = selectedDateKey;
  const ref = roomRef.child('calendar/' + key);
  const cur = calendarEvents[key];
  if (cur && typeof cur.note === 'string') {
    await ref.set({ m0: { text: cur.note, kind: 'ev', by: cur.by || myRole, ts: 0 } });
  }
  await ref.push({ text, kind: selectedKind, by: myRole, ts: firebase.database.ServerValue.TIMESTAMP });
  input.value = '';
  toast('Ajouté, ' + otherName + ' le voit');
}

function deleteEvent(key, id) {
  if (!roomRef) return;
  if (id === '_legacy') roomRef.child('calendar/' + key).remove();
  else roomRef.child('calendar/' + key + '/' + id).remove();
}

/* ---------- NOTES (dessin) ---------- */
const canvas = $('draw-canvas');
const ctx = canvas.getContext('2d');

function paintWhite(w, h) {
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, w, h);
}
// Le canvas est caché (display:none) tant qu'on n'est pas sur l'onglet Notes : on le dimensionne à l'affichage.
function ensureCanvas() {
  const r = canvas.getBoundingClientRect();
  if (!r.width || !r.height) return;
  const w = Math.round(r.width * 2), h = Math.round(r.height * 2);
  if (canvas.width === w && canvas.height === h) return;
  let snap = null;
  if (canvasDirty && canvas.width > 0) { snap = new Image(); snap.src = canvas.toDataURL(); }
  canvas.width = w; canvas.height = h;
  ctx.setTransform(2, 0, 0, 2, 0, 0);
  paintWhite(r.width, r.height);
  if (snap) snap.onload = () => ctx.drawImage(snap, 0, 0, r.width, r.height);
}
window.addEventListener('resize', ensureCanvas);

function getPos(e) {
  const rect = canvas.getBoundingClientRect();
  return { x: e.clientX - rect.left, y: e.clientY - rect.top };
}
function strokeTo(p) {
  ctx.globalAlpha = currentAlpha;
  ctx.strokeStyle = currentColor;
  ctx.lineWidth = currentWidth;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(lastX, lastY);
  ctx.lineTo(p.x, p.y);
  ctx.stroke();
  lastX = p.x; lastY = p.y;
  canvasDirty = true;
}
canvas.addEventListener('pointerdown', e => {
  ensureCanvas();
  drawing = true;
  try { canvas.setPointerCapture(e.pointerId); } catch (err) {}
  const p = getPos(e);
  lastX = p.x; lastY = p.y;
  strokeTo({ x: p.x + 0.01, y: p.y });
});
canvas.addEventListener('pointermove', e => { if (drawing) strokeTo(getPos(e)); });
window.addEventListener('pointerup', () => { drawing = false; });
window.addEventListener('pointercancel', () => { drawing = false; });

$('tool-row').addEventListener('click', e => {
  const btn = e.target.closest('.tool');
  if (!btn) return;
  document.querySelectorAll('.tool').forEach(t => t.classList.remove('active'));
  btn.classList.add('active');
  currentWidth = parseFloat(btn.dataset.width);
  currentAlpha = parseFloat(btn.dataset.alpha);
});
$('color-row').addEventListener('click', e => {
  const btn = e.target.closest('.swatch');
  if (!btn) return;
  document.querySelectorAll('.swatch').forEach(s => s.classList.remove('selected'));
  btn.classList.add('selected');
  currentColor = btn.dataset.color;
});
function clearCanvas() {
  const r = canvas.getBoundingClientRect();
  ctx.setTransform(2, 0, 0, 2, 0, 0);
  paintWhite(r.width, r.height);
  canvasDirty = false;
}

function sendNote() {
  const text = $('note-word').value.trim();
  if (!text && !canvasDirty) { toast('Dessine ou écris quelque chose'); return; }
  if (!roomRef) return;
  const note = { text, ts: Date.now() };
  if (canvasDirty) note.img = canvas.toDataURL('image/jpeg', 0.6);
  roomRef.child('notes/' + myRole).set(note);
  $('note-word').value = '';
  toast('Note envoyée à ' + otherName);
}

const noteData = { a: null, b: null };
const noteBase = { a: false, b: false };
const lastNoteTs = { a: 0, b: 0 };
function renderStory(role) {
  const mine = role === myRole;
  const data = noteData[role];
  const icon = $(mine ? 'my-note-preview-icon' : 'her-note-preview-icon');
  const preview = $(mine ? 'my-note-preview' : 'her-note-preview');
  if (data) {
    icon.innerHTML = data.img ? '<img src="' + data.img + '">' : '\u{1F4AC}';
    preview.textContent = data.text || '';
  } else {
    icon.textContent = mine ? '\u270F\uFE0F' : '\u{1F48C}';
    preview.textContent = '';
  }
}
function listenNotes() {
  ['a', 'b'].forEach(role => {
    onValue(roomRef.child('notes/' + role), snap => {
      const data = snap.val();
      noteData[role] = data;
      renderStory(role);
      if (role === otherRole && noteBase[role] && data && data.ts !== lastNoteTs[role]) {
        notify(otherName + ' a partagé une note', 'home');
      }
      lastNoteTs[role] = data ? data.ts : 0;
      noteBase[role] = true;
    });
  });
}
function openNote(role) {
  const data = noteData[role];
  if (!data) { toast(role === myRole ? 'Tu n\u2019as pas encore de note' : otherName + ' n\u2019a pas encore de note'); return; }
  $('nv-head').textContent = (role === myRole ? 'Ta note' : 'Note de ' + nameOf(role)) + ' \u00b7 ' + relativeTime(data.ts);
  const img = $('nv-img');
  if (data.img) { img.src = data.img; img.style.display = 'block'; } else { img.style.display = 'none'; }
  $('nv-text').textContent = data.text || '';
  $('note-viewer').classList.remove('hidden');
}
function closeNote() { $('note-viewer').classList.add('hidden'); }

/* ---------- CHAT ---------- */
let chatBase = false, lastChatId = null;
const knownReactions = {};

function sendMessage() {
  const input = $('chat-input');
  const text = input.value.trim();
  if (!text || !roomRef) return;
  roomRef.child('chat').push({ from: myRole, text, ts: firebase.database.ServerValue.TIMESTAMP });
  input.value = '';
}
function chatVisible() { return $('chat').classList.contains('active') && !document.hidden; }

function listenChat() {
  onValue(roomRef.child('chat').limitToLast(100), snap => {
    const messages = [];
    snap.forEach(child => { messages.push(Object.assign({ id: child.key }, child.val())); });
    $('chat-scroll').innerHTML = messages.map(renderMessage).join('');
    const last = messages[messages.length - 1];
    if (chatBase) {
      if (last && last.id !== lastChatId && last.from !== myRole && !chatVisible()) {
        notify(otherName + ' : ' + cut(last.text, 70), 'chat');
      }
      messages.forEach(m => {
        const r = m.reactions && m.reactions[otherRole];
        if (r && knownReactions[m.id] !== r && m.from === myRole) notify(otherName + ' a réagi ' + r + ' à ton message', 'chat');
      });
    }
    messages.forEach(m => { knownReactions[m.id] = (m.reactions && m.reactions[otherRole]) || ''; });
    lastChatId = last ? last.id : null;
    chatBase = true;
    scrollChatToBottom();
  });
}
function renderMessage(m) {
  const mine = m.from === myRole;
  const reactionText = Object.keys(m.reactions || {}).map(r => m.reactions[r]).join('');
  return '<div class="msg-row ' + (mine ? 'me' : '') + '">' +
    '<div class="bubble ' + (mine ? 'me' : 'her') + '" onclick="toggleReactionPicker(\'' + m.id + '\')">' +
    escapeHtml(m.text) + (reactionText ? '<span class="reaction">' + reactionText + '</span>' : '') + '</div></div>' +
    '<div class="reaction-picker" id="picker-' + m.id + '">' +
    ['\u{1F60D}', '\u{1F602}', '\u{1F622}', '\u{1F525}', '\u{1F44D}', '\u2764\uFE0F'].map(e => '<span onclick="react(\'' + m.id + '\',\'' + e + '\')">' + e + '</span>').join('') + '</div>';
}
function toggleReactionPicker(id) {
  document.querySelectorAll('.reaction-picker').forEach(p => { if (p.id !== 'picker-' + id) p.classList.remove('show'); });
  $('picker-' + id).classList.toggle('show');
}
function react(id, emoji) {
  roomRef.child('chat/' + id + '/reactions/' + myRole).set(emoji);
  $('picker-' + id).classList.remove('show');
}
function scrollChatToBottom() {
  if (!$('chat').classList.contains('active')) return;   // ne pas faire défiler l'accueil quand un message arrive
  const s = document.querySelector('.screens');
  if (s) s.scrollTop = s.scrollHeight;
}

/* ---------- PHOTOS ---------- */
function fileToCompressedDataURL(file, maxDim, quality) {
  return new Promise(resolve => {
    const reader = new FileReader();
    reader.onload = e => {
      const img = new Image();
      img.onload = () => {
        let w = img.width, h = img.height;
        if (w > h && w > maxDim) { h = h * maxDim / w; w = maxDim; }
        else if (h > maxDim) { w = w * maxDim / h; h = maxDim; }
        const c = document.createElement('canvas');
        c.width = w; c.height = h;
        c.getContext('2d').drawImage(img, 0, 0, w, h);
        resolve(c.toDataURL('image/jpeg', quality));
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}
async function handlePhoto(event) {
  const file = event.target.files[0];
  if (!file || !roomRef) return;
  const dataURL = await fileToCompressedDataURL(file, 900, 0.6);
  roomRef.child('photos').push({ from: myRole, img: dataURL, ts: firebase.database.ServerValue.TIMESTAMP });
  event.target.value = '';
  toast('Photo envoyée à ' + otherName);
}

function normalizeComments(c) {
  if (!c) return [];
  return (Array.isArray(c) ? c : Object.keys(c).map(k => c[k])).filter(Boolean);
}
let photosBase = false;
const photoState = {};
function listenPhotos() {
  onValue(roomRef.child('photos').limitToLast(30), snap => {
    const items = [];
    snap.forEach(child => { items.push(Object.assign({ id: child.key }, child.val())); });
    items.reverse();
    renderPhotos(items);
    if (photosBase) {
      items.forEach(p => {
        const prev = photoState[p.id];
        const comments = normalizeComments(p.comments);
        if (!prev) {
          if (p.from !== myRole) notify(nameOf(p.from) + ' a partagé une photo', 'photos');
        } else {
          const likeNow = !!(p.likes && p.likes[otherRole]);
          if (likeNow && !prev.likeOther) notify(otherName + ' a aimé ' + (p.from === myRole ? 'ta photo' : 'une photo'), 'photos');
          if (comments.length > prev.comments) {
            const lastC = comments[comments.length - 1];
            if (lastC && lastC.from !== myRole) notify(otherName + ' a commenté : ' + cut(lastC.text, 50), 'photos');
          }
        }
      });
    }
    items.forEach(p => { photoState[p.id] = { likeOther: !!(p.likes && p.likes[otherRole]), comments: normalizeComments(p.comments).length }; });
    photosBase = true;
  });
}
function renderPhotos(items) {
  const feed = $('photos-feed');
  const drafts = {};
  feed.querySelectorAll('input[data-pid]').forEach(i => { drafts[i.dataset.pid] = i.value; });
  const focusId = document.activeElement && document.activeElement.dataset ? document.activeElement.dataset.pid : null;
  feed.innerHTML = items.map(renderPhoto).join('');
  feed.querySelectorAll('input[data-pid]').forEach(i => {
    if (drafts[i.dataset.pid]) i.value = drafts[i.dataset.pid];
    if (focusId && i.dataset.pid === focusId) i.focus();
  });
}
function renderPhoto(p) {
  const likes = p.likes || {};
  const liked = !!likes[myRole];
  const likedBy = ['a', 'b'].filter(r => likes[r]).map(r => r === myRole ? 'toi' : nameOf(r));
  const comments = normalizeComments(p.comments);
  return '<div class="feed-item">' +
    '<div class="feed-photo"><img src="' + p.img + '"><div class="feed-meta"><span>' + (p.from === myRole ? 'Toi' : nameOf(p.from)) + ' \u00b7 ' + relativeTime(p.ts || Date.now()) + '</span></div></div>' +
    '<div class="feed-actions">' +
    '<button class="heart-icon" onclick="toggleLike(\'' + p.id + '\',' + liked + ',this)">' + (liked ? '\u2764\uFE0F' : '\u{1F90D}') + '</button>' +
    '<span class="likes-line">' + (likedBy.length ? 'Aimé par ' + likedBy.join(' et ') : '') + '</span>' +
    '<span class="likes-line" style="margin-left:auto">' + comments.length + ' commentaire' + (comments.length > 1 ? 's' : '') + '</span>' +
    '</div>' +
    '<div class="comments">' + comments.map(c => '<div class="comment"><b>' + (c.from === myRole ? 'Toi' : nameOf(c.from)) + '</b> ' + escapeHtml(c.text) + '</div>').join('') + '</div>' +
    '<div class="comment-input-row"><input data-pid="' + p.id + '" placeholder="Ajouter un commentaire" onkeydown="if(event.key===\'Enter\')addComment(\'' + p.id + '\', this)">' +
    '<button class="send-btn" aria-label="Publier" onclick="addComment(\'' + p.id + '\', this.previousElementSibling)">\u27A4</button></div>' +
    '</div>';
}
function toggleLike(id, wasLiked, btn) {
  roomRef.child('photos/' + id + '/likes/' + myRole).set(wasLiked ? null : true);
  if (!wasLiked && btn) burstHearts(btn, 5);
}
function addComment(id, input) {
  const text = input.value.trim();
  if (!text) return;
  roomRef.child('photos/' + id + '/comments').transaction(list => {
    list = normalizeComments(list);
    list.push({ from: myRole, text, ts: Date.now() });
    return list;
  });
  input.value = '';
}

/* ---------- RÉGLAGES ---------- */
async function handleProfilePhoto(event) {
  const file = event.target.files[0];
  if (!file || !roomRef) return;
  const dataURL = await fileToCompressedDataURL(file, 240, 0.7);
  roomRef.child('profiles/' + myRole + '/photo').set(dataURL);
  toast('Photo de profil mise à jour');
}
function handleWallpaper(event) {
  const file = event.target.files[0];
  if (!file) return;
  fileToCompressedDataURL(file, 1200, 0.7).then(dataURL => {
    try { localStorage.setItem('yam_wallpaper', dataURL); } catch (e) { showBanner('Image trop lourde pour le fond d\u2019écran, essaie une plus petite.'); return; }
    applyWallpaper();
  });
}
function resetWallpaper() {
  localStorage.removeItem('yam_wallpaper');
  applyWallpaper();
}
function applyWallpaper() {
  const wp = localStorage.getItem('yam_wallpaper');
  $('app').style.backgroundImage = wp ? 'url(' + wp + ')' : 'none';
}
applyWallpaper();

/* ---------- DÉMARRAGE ---------- */
applyNames();
if (myRole && room) {
  $('onboarding').classList.add('hidden');
  initFirebase();
} else {
  $('onboarding').classList.remove('hidden');
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}
