/* ============================================================
   You & Me.  —  Soso (a) & Nono (b)
   ============================================================ */


const avatars = { a: '', b: '' };
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
let appName = localStorage.getItem('yam_appname') || '';

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
function initialOf(role) { return nameOf(role).charAt(0).toUpperCase(); }
function avatarHTML(role, size) {
  const src = avatars[role];
  return '<span class="av ' + (size || 'sm') + ' av-' + role + '"' + (src ? ' style="background-image:url(' + src + ')"' : '') + '>' + (src ? '' : initialOf(role)) + '</span>';
}
function paintAvatar(el, role) {
  if (!el) return;
  const src = avatars[role];
  el.style.backgroundImage = src ? 'url(' + src + ')' : '';
  el.textContent = src ? '' : initialOf(role);
  el.classList.toggle('av-a', role === 'a');
  el.classList.toggle('av-b', role === 'b');
}


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
const HEART_SVG = '<svg viewBox="0 0 24 24" width="26" height="26"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" fill="#F0245B"/></svg>';
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
  $('partner-name-label').textContent = 'Mood de ' + otherName;
  $('partner-status').textContent = otherName + ' \u00b7 hors ligne';
  $('other-photo-label').textContent = 'Photo de ' + otherName;
  $('me-profile-name').textContent = myName ? 'Tu es ' + myName : '';
  refreshAvatars();
  renderBubbles();
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
  listenBubbles();
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
  if (typeof exitEditMode === 'function') exitEditMode();
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  $(id).classList.add('active');
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  const nb = document.querySelector('.nav-btn[data-screen="' + id + '"]');
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
    avatars[otherRole] = data.photo || '';
    $('partner-status').textContent = data.online ? otherName + ' est en ligne' : otherName + ' \u00b7 hors ligne';

    $('partner-mood').textContent = data.mood || '\u{1F90D}';
    partnerMoodTs = data.moodTs || 0;
    $('partner-mood-time').textContent = partnerMoodTs ? relativeTime(partnerMoodTs) : '';
    $('partner-status-chip').textContent = data.status || '';
    refreshAvatars();

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
    avatars[myRole] = data.photo || '';
    refreshAvatars();
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


// Repeint toutes les pastilles de photo de profil (et re-rend chat/photos si la photo a changé)
let avatarSig = '';
function refreshAvatars() {
  paintAvatar($('partner-avatar'), otherRole);
  paintAvatar($('my-note-avatar').firstElementChild || (() => { const d = document.createElement('div'); d.className = 'av'; $('my-note-avatar').appendChild(d); return d; })(), myRole);
  paintAvatar($('her-note-avatar').firstElementChild || (() => { const d = document.createElement('div'); d.className = 'av'; $('her-note-avatar').appendChild(d); return d; })(), otherRole);
  paintAvatar($('my-avatar-preview'), myRole);
  paintAvatar($('her-avatar-preview'), otherRole);
  const sig = ['a', 'b'].map(r => (avatars[r] || '').length + ':' + (avatars[r] || '').slice(-16)).join('|');
  if (sig !== avatarSig) {
    avatarSig = sig;
    if (typeof chatMessages !== 'undefined' && chatMessages.length) renderChat();
    if (typeof photoItems !== 'undefined' && photoItems.length) renderPhotos(photoItems);
  }
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
  if (currentMusic && currentMusic.url) {
    $('music-title').textContent = musicLabel(currentMusic.url);
    const canOpen = !!normalizeUrl(currentMusic.url);
    $('music-subtitle').textContent = 'Partagé par ' + (currentMusic.from === myRole ? 'toi' : nameOf(currentMusic.from)) + ' \u00b7 ' + relativeTime(currentMusic.ts) + (canOpen ? ' \u00b7 touche pour écouter' : '');
  } else {
    $('music-title').textContent = "Rien de partagé pour l'instant";
    $('music-subtitle').textContent = 'Envoie-lui un son';
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
    if (typeof s.appName === 'string' && s.appName !== appName) {
      appName = s.appName;
      try { localStorage.setItem('yam_appname', appName); } catch (e) {}
      applyAppName(appName);
    }
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

  const progress = Math.max(0, Math.min(1, 1 - daysLeft / 365));
  const arc = $('countdown-arc');
  const total = arc.getTotalLength();
  arc.setAttribute('stroke-dasharray', total);
  arc.setAttribute('stroke-dashoffset', total * (1 - progress));
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
  $('cal-month-label').innerHTML = monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1) + ' <span class="cal-month-heart">\u2665</span>';

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
function renderRecvNote() {
  const d = noteData[otherRole];
  const box = $('recv-note');
  if (!d) { box.style.display = 'none'; return; }
  box.style.display = 'flex';
  $('recv-thumb').style.backgroundImage = d.img ? 'url(' + d.img + ')' : '';
  $('recv-title').textContent = 'Note de ' + otherName;
  $('recv-sub').textContent = (d.text ? cut(d.text, 38) + ' \u00b7 ' : '') + relativeTime(d.ts);
}
function listenNotes() {
  ['a', 'b'].forEach(role => {
    onValue(roomRef.child('notes/' + role), snap => {
      const data = snap.val();
      noteData[role] = data;
      renderRecvNote();
      if (role === otherRole && noteBase[role] && data && data.ts !== lastNoteTs[role]) {
        notify(otherName + ' t\u2019a envoy\u00e9 une note dessin\u00e9e', 'notes');
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


/* ---------- NOTES DE L'ACCUEIL (bulles façon Instagram, valables 24 h) ---------- */
const NOTE_TTL = 24 * 3600 * 1000;
const bubbleData = { a: null, b: null };
const bubbleBase = { a: false, b: false };
const lastBubbleTs = { a: 0, b: 0 };
function liveBubble(role) {
  const d = bubbleData[role];
  return d && d.text && d.ts && Date.now() - d.ts < NOTE_TTL ? d : null;
}
function autosizeNote() {
  const ta = $('my-note-input');
  ta.style.height = 'auto';
  ta.style.height = ta.scrollHeight + 'px';
}
function updateBubbleState() {
  const ta = $('my-note-input');
  const mine = liveBubble(myRole);
  const bubble = $('my-note-bubble');
  const val = ta.value.trim();
  bubble.classList.toggle('has-note', !!mine);
  bubble.classList.toggle('can-share', !!val && val !== (mine ? mine.text : ''));
}
function renderBubbles() {
  const mine = liveBubble(myRole);
  const her = liveBubble(otherRole);
  const ta = $('my-note-input');
  if (document.activeElement !== ta) {
    ta.value = mine ? mine.text : '';
    autosizeNote();
  }
  updateBubbleState();
  $('her-note-text').textContent = her ? her.text : '\u2026';
  $('her-note-bubble').classList.toggle('empty', !her);
  $('my-note-avatar').classList.toggle('idle', !mine);
  $('her-note-avatar').classList.toggle('idle', !her);
}
function saveBubble() {
  const ta = $('my-note-input');
  const text = ta.value.trim().slice(0, 60);
  if (!roomRef) { showBanner('Pas encore connect\u00e9 \u00e0 la base \u2014 v\u00e9rifie ta connexion.'); return; }
  if (!text) { clearBubble(); return; }
  roomRef.child('bubbles/' + myRole).set({ text, ts: Date.now() });
  bubbleData[myRole] = { text, ts: Date.now() };
  ta.blur();
  renderBubbles();
  toast('Note partag\u00e9e avec ' + otherName);
}
function clearBubble() {
  if (!roomRef) return;
  roomRef.child('bubbles/' + myRole).remove();
  bubbleData[myRole] = null;
  $('my-note-input').value = '';
  autosizeNote();
  renderBubbles();
}
function listenBubbles() {
  const ta = $('my-note-input');
  if (!ta.dataset.bound) {
    ta.dataset.bound = '1';
    ta.addEventListener('input', () => { autosizeNote(); updateBubbleState(); });
    ta.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); saveBubble(); } });
    ta.addEventListener('blur', () => setTimeout(renderBubbles, 120));
  }
  ['a', 'b'].forEach(role => {
    onValue(roomRef.child('bubbles/' + role), snap => {
      const data = snap.val();
      bubbleData[role] = data;
      renderBubbles();
      if (role === otherRole && bubbleBase[role] && data && data.ts !== lastBubbleTs[role]) {
        notify(otherName + ' a partag\u00e9 une note : ' + cut(data.text, 40), 'home');
      }
      lastBubbleTs[role] = data ? data.ts : 0;
      bubbleBase[role] = true;
    });
  });
}
// Une note expire au bout de 24 h : on rafra\u00eechit l'affichage r\u00e9guli\u00e8rement
setInterval(() => { if (roomRef) renderBubbles(); }, 60000);
/* ---------- CHAT ---------- */
let chatBase = false, lastChatId = null;
let chatMessages = [];
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
    chatMessages = messages;
    renderChat();
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
function renderChat() {
  const openPicker = document.querySelector('.reaction-picker.show');
  const openId = openPicker ? openPicker.id : null;
  $('chat-scroll').innerHTML = chatMessages.map(renderMessage).join('');
  if (openId && $(openId)) $(openId).classList.add('show');
}
function renderMessage(m) {
  const mine = m.from === myRole;
  const reactionText = Object.keys(m.reactions || {}).map(r => m.reactions[r]).join('');
  return '<div class="msg-row ' + (mine ? 'me' : '') + '">' + (mine ? '' : avatarHTML(m.from, 'sm')) +
    '<div class="bubble ' + (mine ? 'me' : 'her') + '" onclick="toggleReactionPicker(\'' + m.id + '\')">' +
    escapeHtml(m.text) + (reactionText ? '<span class="reaction">' + reactionText + '</span>' : '') + '</div></div>' +
    '<div class="reaction-picker" id="picker-' + m.id + '">' +
    ['\u{1F60D}', '\u{1F602}', '\u{1F622}', '\u{1F525}', '\u{1F44D}', '\u2764\uFE0F'].map(e => '<span onclick="react(\'' + m.id + '\',\'' + e + '\')">' + e + '</span>').join('') +
    (mine ? '<span class="picker-del" onclick="deleteMessage(\'' + m.id + '\')" aria-label="Supprimer le message"><svg><use href="#i-trash"/></svg></span>' : '') + '</div>';
}
function toggleReactionPicker(id) {
  document.querySelectorAll('.reaction-picker').forEach(p => { if (p.id !== 'picker-' + id) p.classList.remove('show'); });
  $('picker-' + id).classList.toggle('show');
}
function react(id, emoji) {
  roomRef.child('chat/' + id + '/reactions/' + myRole).set(emoji);
  $('picker-' + id).classList.remove('show');
}
function deleteMessage(id) {
  if (!roomRef) return;
  if (!confirm('Supprimer ce message ?')) return;
  roomRef.child('chat/' + id).remove();
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

/* — Caméra « En direct » — */
let camStream = null, camFacing = 'environment';
function openLive() {
  if (!roomRef) { showBanner('Pas encore connect\u00e9 \u00e0 la base \u2014 v\u00e9rifie ta connexion.'); return; }
  if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) startCamera();
  else $('file-cam').click();
}
async function startCamera() {
  $('cam').classList.remove('hidden');
  stopCamera();
  try {
    camStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: camFacing }, width: { ideal: 1280 }, height: { ideal: 1600 } }, audio: false });
    const v = $('cam-video');
    v.srcObject = camStream;
    v.classList.toggle('mirror', camFacing === 'user');
    await v.play().catch(() => {});
  } catch (e) {
    // Pas d'acc\u00e8s \u00e0 la cam\u00e9ra dans l'app : on ouvre l'appareil photo du t\u00e9l\u00e9phone
    closeCamera();
    $('file-cam').click();
  }
}
function stopCamera() {
  if (camStream) { camStream.getTracks().forEach(t => t.stop()); camStream = null; }
}
function closeCamera() {
  stopCamera();
  $('cam').classList.add('hidden');
}
function flipCamera() {
  camFacing = camFacing === 'user' ? 'environment' : 'user';
  startCamera();
}
function snap() {
  const v = $('cam-video');
  if (!v.videoWidth) return;
  const max = 900;
  const k = Math.min(1, max / Math.max(v.videoWidth, v.videoHeight));
  const w = Math.round(v.videoWidth * k), h = Math.round(v.videoHeight * k);
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const x = c.getContext('2d');
  if (camFacing === 'user') { x.translate(w, 0); x.scale(-1, 1); }
  x.drawImage(v, 0, 0, w, h);
  const data = c.toDataURL('image/jpeg', 0.62);
  const f = $('cam-flash');
  f.classList.remove('go'); void f.offsetWidth; f.classList.add('go');
  if (navigator.vibrate) navigator.vibrate(15);
  setTimeout(() => { closeCamera(); openComposer(data, 'live'); }, 160);
}

/* — Publication (cam\u00e9ra ou galerie) — */
let pendingImg = null, pendingSrc = 'live';
function openComposer(dataURL, src) {
  pendingImg = dataURL; pendingSrc = src;
  $('comp-img').src = dataURL;
  $('comp-caption').value = '';
  $('composer').classList.remove('hidden');
}
function closeComposer() {
  $('composer').classList.add('hidden');
  pendingImg = null;
}
function publishPhoto() {
  if (!pendingImg || !roomRef) return;
  const caption = $('comp-caption').value.trim();
  const p = { from: myRole, img: pendingImg, src: pendingSrc, ts: firebase.database.ServerValue.TIMESTAMP };
  if (caption) p.caption = caption;
  roomRef.child('photos').push(p);
  closeComposer();
  showScreen('photos');
  toast('Photo envoy\u00e9e \u00e0 ' + otherName);
}
async function handleGallery(event) {
  const file = event.target.files[0];
  event.target.value = '';
  if (!file) return;
  openComposer(await fileToCompressedDataURL(file, 900, 0.6), 'gallery');
}
async function handleNativeCamera(event) {
  const file = event.target.files[0];
  event.target.value = '';
  if (!file) return;
  openComposer(await fileToCompressedDataURL(file, 900, 0.6), 'live');
}

/* — Fil de photos — */
function normalizeComments(c) {
  if (!c) return [];
  return (Array.isArray(c) ? c : Object.keys(c).map(k => c[k])).filter(Boolean);
}
let photosBase = false;
let photoItems = [];
const photoState = {};
function listenPhotos() {
  onValue(roomRef.child('photos').limitToLast(30), snap => {
    const items = [];
    snap.forEach(child => { items.push(Object.assign({ id: child.key }, child.val())); });
    items.reverse();
    photoItems = items;
    renderPhotos(items);
    if (photosBase) {
      items.forEach(p => {
        const prev = photoState[p.id];
        const comments = normalizeComments(p.comments);
        if (!prev) {
          if (p.from !== myRole) notify(nameOf(p.from) + (p.src === 'live' ? ' a post\u00e9 en direct' : ' a partag\u00e9 une photo'), 'photos');
        } else {
          const likeNow = !!(p.likes && p.likes[otherRole]);
          if (likeNow && !prev.likeOther) notify(otherName + ' a aim\u00e9 ' + (p.from === myRole ? 'ta photo' : 'une photo'), 'photos');
          if (comments.length > prev.comments) {
            const lastC = comments[comments.length - 1];
            if (lastC && lastC.from !== myRole) notify(otherName + ' a comment\u00e9 : ' + cut(lastC.text, 50), 'photos');
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
  feed.innerHTML = items.length ? items.map(renderPhoto).join('') : '<div class="empty-feed">Pas encore de photo. Lance un \u00ab En direct \u00bb.</div>';
  feed.querySelectorAll('input[data-pid]').forEach(i => {
    if (drafts[i.dataset.pid]) i.value = drafts[i.dataset.pid];
    if (focusId && i.dataset.pid === focusId) i.focus();
  });
}
const HEART_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><use href="#i-heart"/></svg>';
function renderPhoto(p) {
  const liked = !!(p.likes && p.likes[myRole]);
  const comments = normalizeComments(p.comments);
  const who = p.from === myRole ? 'Toi' : nameOf(p.from);
  const live = p.src === 'live';
  return '<article class="post" data-id="' + p.id + '">' +
    '<div class="post-head">' + avatarHTML(p.from, 'md') +
      '<div class="post-who"><b>' + who + '</b><small>' + (live ? '<span class="rec"></span>En direct \u00b7 ' : '') + relativeTime(p.ts || Date.now()) + '</small></div></div>' +
    '<div class="post-photo" data-id="' + p.id + '"><img src="' + p.img + '" alt="" draggable="false">' +
      '<svg class="pop-heart" viewBox="0 0 24 24" aria-hidden="true"><use href="#i-heart"/></svg></div>' +
    (p.caption ? '<div class="post-caption">' + escapeHtml(p.caption) + '</div>' : '') +
    '<div class="post-actions"><button class="fav' + (liked ? ' on' : '') + '" aria-label="Aimer" aria-pressed="' + liked + '" onclick="toggleLike(\'' + p.id + '\',' + liked + ',this)">' + HEART_ICON + '</button>' +
    '<button class="post-del" aria-label="Supprimer la photo" onclick="deletePhotoItem(\'' + p.id + '\')"><svg><use href="#i-trash"/></svg></button></div>' +
    (comments.length ? '<div class="post-comments">' + comments.map(c => '<div class="comment"><b>' + (c.from === myRole ? 'Toi' : nameOf(c.from)) + '</b>' + escapeHtml(c.text) + '</div>').join('') + '</div>' : '') +
    '<div class="comment-input-row">' + avatarHTML(myRole, 'sm') +
      '<input data-pid="' + p.id + '" placeholder="Ajouter un commentaire" enterkeyhint="send" onkeydown="if(event.key===\'Enter\')addComment(\'' + p.id + '\', this)">' +
      '<button class="send-btn" aria-label="Publier" onclick="addComment(\'' + p.id + '\', this.previousElementSibling)"><svg><use href="#i-send"/></svg></button></div>' +
    '</article>';
}
function toggleLike(id, wasLiked, btn) {
  if (!roomRef) return;
  roomRef.child('photos/' + id + '/likes/' + myRole).set(wasLiked ? null : true);
  if (!wasLiked && btn) burstHearts(btn, 5);
}
// Double tap sur une photo = j'aime (comme sur Insta)
let lastTap = { id: null, t: 0 };
$('photos-feed').addEventListener('click', e => {
  const ph = e.target.closest('.post-photo');
  if (!ph) return;
  const now = Date.now();
  if (lastTap.id === ph.dataset.id && now - lastTap.t < 330) {
    lastTap = { id: null, t: 0 };
    const ph2 = photoItems.find(x => x.id === ph.dataset.id);
    const pop = ph.querySelector('.pop-heart');
    pop.classList.remove('go'); void pop.getBoundingClientRect(); pop.classList.add('go');
    if (ph2 && !(ph2.likes && ph2.likes[myRole])) toggleLike(ph.dataset.id, false, null);
  } else lastTap = { id: ph.dataset.id, t: now };
});
function deletePhotoItem(id) {
  if (!roomRef) return;
  if (!confirm('Supprimer cette photo ? C\u2019est définitif.')) return;
  roomRef.child('photos/' + id).remove();
  toast('Photo supprimée');
}
function addComment(id, input) {
  const text = input.value.trim();
  if (!text || !roomRef) return;
  roomRef.child('photos/' + id + '/comments').transaction(list => {
    list = normalizeComments(list);
    list.push({ from: myRole, text, ts: Date.now() });
    return list;
  });
  input.value = '';
}
/* ---------- RÉGLAGES ---------- */
function handleProfilePhoto(event) {
  const file = event.target.files[0];
  event.target.value = '';
  if (!file || !roomRef) return;
  openAvatarCropper(file);
}

/* — Recadrage / zoom de la photo de profil avant envoi — */
const CROP_SIZE = 220;   // taille (px CSS) du cadre affiché à l'écran
const CROP_OUTPUT = 320; // taille (px) de l'image carrée finalement enregistrée
let cropState = null;
function openAvatarCropper(file) {
  const reader = new FileReader();
  reader.onload = e => {
    const img = new Image();
    img.onload = () => {
      const minScale = Math.max(CROP_SIZE / img.width, CROP_SIZE / img.height);
      cropState = { naturalW: img.width, naturalH: img.height, scale: minScale, minScale, x: 0, y: 0 };
      $('crop-img').src = e.target.result;
      $('crop-zoom').value = 100;
      applyCropTransform();
      $('avatar-cropper').classList.remove('hidden');
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}
function clampCropOffset() {
  if (!cropState) return;
  const w = cropState.naturalW * cropState.scale, h = cropState.naturalH * cropState.scale;
  const maxX = Math.max(0, (w - CROP_SIZE) / 2), maxY = Math.max(0, (h - CROP_SIZE) / 2);
  cropState.x = Math.min(maxX, Math.max(-maxX, cropState.x));
  cropState.y = Math.min(maxY, Math.max(-maxY, cropState.y));
}
function applyCropTransform() {
  if (!cropState) return;
  const w = cropState.naturalW * cropState.scale, h = cropState.naturalH * cropState.scale;
  const el = $('crop-img');
  el.style.width = w + 'px';
  el.style.height = h + 'px';
  el.style.transform = 'translate(' + (CROP_SIZE / 2 - w / 2 + cropState.x) + 'px,' + (CROP_SIZE / 2 - h / 2 + cropState.y) + 'px)';
}
function onCropZoomInput(e) {
  if (!cropState) return;
  cropState.scale = cropState.minScale * (Number(e.target.value) / 100);
  clampCropOffset();
  applyCropTransform();
}
(function bindCropDrag() {
  const frame = $('crop-frame');
  let dragging = false, startX = 0, startY = 0, baseX = 0, baseY = 0;
  frame.addEventListener('pointerdown', e => {
    if (!cropState) return;
    dragging = true; startX = e.clientX; startY = e.clientY; baseX = cropState.x; baseY = cropState.y;
    frame.setPointerCapture(e.pointerId);
  });
  frame.addEventListener('pointermove', e => {
    if (!dragging || !cropState) return;
    cropState.x = baseX + (e.clientX - startX);
    cropState.y = baseY + (e.clientY - startY);
    clampCropOffset();
    applyCropTransform();
  });
  frame.addEventListener('pointerup', () => { dragging = false; });
  frame.addEventListener('pointercancel', () => { dragging = false; });
})();
function closeAvatarCropper() {
  $('avatar-cropper').classList.add('hidden');
  cropState = null;
}
function saveAvatarCrop() {
  if (!cropState || !roomRef) { closeAvatarCropper(); return; }
  const ratio = CROP_OUTPUT / CROP_SIZE;
  const dw = cropState.naturalW * cropState.scale * ratio, dh = cropState.naturalH * cropState.scale * ratio;
  const dx = (CROP_SIZE / 2 - (cropState.naturalW * cropState.scale) / 2 + cropState.x) * ratio;
  const dy = (CROP_SIZE / 2 - (cropState.naturalH * cropState.scale) / 2 + cropState.y) * ratio;
  const c = document.createElement('canvas');
  c.width = CROP_OUTPUT; c.height = CROP_OUTPUT;
  c.getContext('2d').drawImage($('crop-img'), dx, dy, dw, dh);
  roomRef.child('profiles/' + myRole + '/photo').set(c.toDataURL('image/jpeg', 0.85));
  toast('Photo de profil mise à jour');
  closeAvatarCropper();
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

/* ---------- NOM DE L'APPLICATION (éditable) ---------- */
function applyAppName(name) {
  const val = (name || '').trim();
  const display = val || 'You & Me.';
  const el = $('app-logo');
  if (el) el.textContent = display;
  document.title = display;
  const input = $('appname-input');
  if (input && document.activeElement !== input) input.value = val;
}
function saveAppName() {
  const input = $('appname-input');
  const val = input.value.trim();
  try { localStorage.setItem('yam_appname', val); } catch (e) {}
  appName = val;
  applyAppName(val);
  if (roomRef) roomRef.child('settings').update({ appName: val, appNameBy: myRole });
  toast('Nom mis à jour');
}
applyAppName(appName);

/* ---------- WIDGETS PERSONNALISABLES (appui long, façon iPhone) ---------- */
const FONT_OPTIONS = [
  { css: '', label: 'Par défaut' },
  { css: "'Figtree',sans-serif", label: 'Figtree' },
  { css: "'Caveat','Segoe Script',cursive", label: 'Manuscrite' },
  { css: "'Playfair Display',Georgia,serif", label: 'Élégante' },
  { css: 'system-ui,-apple-system,sans-serif', label: 'Système' }
];
const COLOR_OPTIONS = ['#FFFFFF', '#000000', '#F0245B', '#FF9DB4', '#E6DDFF', '#FFE3EA', '#FF9A55', '#F5CB4F', '#3FA774', '#3FB8C4', '#5B8CE0', '#8A6FE0'];

let widgetConfigs = {};
let editMode = false;
let currentEditWid = null;

function loadWidgetConfigs() {
  let all = {};
  try { all = JSON.parse(localStorage.getItem('yam_widget_cfg') || '{}'); } catch (e) {}
  document.querySelectorAll('.widget[data-wid]').forEach(el => applyWidgetConfig(el, all[el.dataset.wid]));
  return all;
}
function applyWidgetConfig(el, cfg) {
  if (!cfg) { el.style.removeProperty('--wscale'); el.style.background = ''; el.style.fontFamily = ''; return; }
  el.style.setProperty('--wscale', String((cfg.scale || 100) / 100));
  el.style.background = cfg.bg || '';
  el.style.fontFamily = cfg.font || '';
}
function saveWidgetConfig(wid, patch) {
  widgetConfigs[wid] = Object.assign({ scale: 100, bg: '', font: '' }, widgetConfigs[wid] || {}, patch);
  try { localStorage.setItem('yam_widget_cfg', JSON.stringify(widgetConfigs)); } catch (e) {}
  const el = document.querySelector('.widget[data-wid="' + wid + '"]');
  if (el) applyWidgetConfig(el, widgetConfigs[wid]);
}

function groupKeyFor(container) {
  return container.id || (container.className || 'grp').split(' ')[0];
}
function initOrderGroup(container) {
  if (!container) return;
  const children = Array.from(container.children);
  children.forEach((c, i) => { if (c.dataset.origIdx === undefined) c.dataset.origIdx = String(i); });
  const key = 'yam_order_' + groupKeyFor(container);
  let seq;
  try { seq = JSON.parse(localStorage.getItem(key)); } catch (e) { seq = null; }
  if (!Array.isArray(seq) || seq.length !== children.length) seq = children.map((_, i) => i);
  seq.forEach((origIdx, pos) => {
    const el = children.find(c => Number(c.dataset.origIdx) === origIdx);
    if (el) el.style.order = pos;
  });
}
function saveOrderGroup(container) {
  const children = Array.from(container.children).sort((a, b) => (parseInt(a.style.order || '0', 10) - parseInt(b.style.order || '0', 10)));
  const key = 'yam_order_' + groupKeyFor(container);
  try { localStorage.setItem(key, JSON.stringify(children.map(c => Number(c.dataset.origIdx)))); } catch (e) {}
}
function moveWidgetInGroup(el, dir) {
  const container = el.parentElement;
  if (!container) return false;
  const children = Array.from(container.children).sort((a, b) => (parseInt(a.style.order || '0', 10) - parseInt(b.style.order || '0', 10)));
  const idx = children.indexOf(el);
  let t = idx + dir;
  while (t >= 0 && t < children.length && children[t].dataset.pinned === 'true') t += dir;
  if (t < 0 || t >= children.length) return false;
  const other = children[t];
  const tmp = el.style.order; el.style.order = other.style.order; other.style.order = tmp;
  saveOrderGroup(container);
  return true;
}

function openWidgetEditor(el) {
  currentEditWid = el.dataset.wid;
  const cfg = widgetConfigs[currentEditWid] || { scale: 100, bg: '', font: '' };
  $('we-title').textContent = el.dataset.wname || 'Widget';
  $('we-scale').value = cfg.scale || 100;
  renderSwatches(cfg.bg || '');
  renderFonts(cfg.font || '');
  $('widget-editor').classList.remove('hidden');
}
function closeWidgetEditor() { $('widget-editor').classList.add('hidden'); }
function onWidgetScaleInput(e) {
  if (!currentEditWid) return;
  saveWidgetConfig(currentEditWid, { scale: Number(e.target.value) });
}
function renderSwatches(current) {
  const box = $('we-swatches');
  let html = COLOR_OPTIONS.map(c =>
    '<button type="button" class="we-swatch' + (current === c ? ' selected' : '') + '" style="background:' + c + (c === '#FFFFFF' ? ';box-shadow:0 0 0 1px var(--line)' : '') + '" data-c="' + c + '" aria-label="' + c + '"></button>').join('');
  html += '<button type="button" class="we-swatch transp' + (current === 'transparent' ? ' selected' : '') + '" data-c="transparent" aria-label="Transparent"></button>';
  html += '<label class="we-swatch custom" aria-label="Couleur personnalisée">\uD83C\uDFA8<input type="color" id="we-custom-color" value="' + (current && current.charAt(0) === '#' ? current : '#ffffff') + '"></label>';
  box.innerHTML = html;
}
function renderFonts(current) {
  const box = $('we-fonts');
  box.innerHTML = FONT_OPTIONS.map((f, i) =>
    '<button type="button" class="we-font' + (current === f.css ? ' selected' : '') + '" data-idx="' + i + '" style="' + (f.css ? 'font-family:' + f.css : '') + '">' + f.label + '</button>').join('');
}
function pickWidgetColor(c) {
  if (!currentEditWid) return;
  saveWidgetConfig(currentEditWid, { bg: c });
  renderSwatches(c);
}
function pickWidgetFont(css) {
  if (!currentEditWid) return;
  saveWidgetConfig(currentEditWid, { font: css });
  renderFonts(css);
}
function moveCurrentWidget(dir) {
  if (!currentEditWid) return;
  const el = document.querySelector('.widget[data-wid="' + currentEditWid + '"]');
  if (el) moveWidgetInGroup(el, dir);
}
function resetCurrentWidget() {
  if (!currentEditWid) return;
  delete widgetConfigs[currentEditWid];
  try { localStorage.setItem('yam_widget_cfg', JSON.stringify(widgetConfigs)); } catch (e) {}
  const el = document.querySelector('.widget[data-wid="' + currentEditWid + '"]');
  if (el) applyWidgetConfig(el, null);
  closeWidgetEditor();
}
function enterEditMode() {
  editMode = true;
  document.body.classList.add('edit-mode');
  if (!$('edit-done-btn')) {
    const b = document.createElement('button');
    b.id = 'edit-done-btn';
    b.className = 'edit-done';
    b.textContent = 'Terminé';
    document.body.appendChild(b);
  }
}
function exitEditMode() {
  if (!editMode) return;
  editMode = false;
  document.body.classList.remove('edit-mode');
  closeWidgetEditor();
}

function initWidgetSystem() {
  ['home', 'calendar', 'notes', 'photos'].forEach(id => initOrderGroup($(id)));
  initOrderGroup(document.querySelector('.bento'));
  widgetConfigs = loadWidgetConfigs();

  $('we-swatches').addEventListener('click', e => {
    const b = e.target.closest('.we-swatch'); if (!b || !b.dataset.c) return;
    pickWidgetColor(b.dataset.c);
  });
  $('we-swatches').addEventListener('input', e => {
    if (e.target.id === 'we-custom-color') pickWidgetColor(e.target.value);
  });
  $('we-fonts').addEventListener('click', e => {
    const b = e.target.closest('.we-font'); if (!b) return;
    pickWidgetFont(FONT_OPTIONS[Number(b.dataset.idx)].css);
  });

  let pressTimer = null, pressStart = null, suppressClickOn = null;
  const LONG_PRESS_MS = 480;
  document.addEventListener('pointerdown', e => {
    const w = e.target.closest('.widget');
    if (!w || editMode) { pressStart = null; return; }
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    pressStart = { x: e.clientX, y: e.clientY };
    clearTimeout(pressTimer);
    pressTimer = setTimeout(() => {
      if (!pressStart) return;
      enterEditMode();
      if (navigator.vibrate) { try { navigator.vibrate(12); } catch (e) {} }
      suppressClickOn = w;
      pressStart = null;
    }, LONG_PRESS_MS);
  }, { passive: true });
  document.addEventListener('pointermove', e => {
    if (pressStart && (Math.abs(e.clientX - pressStart.x) > 10 || Math.abs(e.clientY - pressStart.y) > 10)) {
      clearTimeout(pressTimer); pressStart = null;
    }
  }, { passive: true });
  document.addEventListener('pointerup', () => { clearTimeout(pressTimer); pressStart = null; }, { passive: true });
  document.addEventListener('pointercancel', () => { clearTimeout(pressTimer); pressStart = null; }, { passive: true });

  document.addEventListener('click', e => {
    if (e.target.closest('#widget-editor')) return;
    if (suppressClickOn) { e.preventDefault(); e.stopPropagation(); suppressClickOn = null; return; }
    if (e.target.closest('.edit-done')) { e.preventDefault(); exitEditMode(); return; }
    if (!editMode) return;
    const w = e.target.closest('.widget');
    if (w) { e.preventDefault(); e.stopPropagation(); openWidgetEditor(w); return; }
    if (e.target.closest('#app') && !e.target.closest('.bottomnav')) { e.preventDefault(); e.stopPropagation(); }
  }, true);
}
initWidgetSystem();

/* ---------- DÉMARRAGE ---------- */
/* ---------- DATE DU JOUR (accueil) ---------- */
function renderToday() {
  const t = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
  const txt = t.charAt(0).toUpperCase() + t.slice(1);
  const el = $('home-date');
  if (el && el.textContent !== txt) el.textContent = txt;
}
renderToday();
setInterval(renderToday, 60000);
document.addEventListener('visibilitychange', () => { if (!document.hidden) { renderToday(); if (calendarBase) renderCalendar(); } });

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
