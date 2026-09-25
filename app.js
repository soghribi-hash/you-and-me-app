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
let selectedRole = 'a';
let currentMonthDate = new Date();
let selectedDateKey = null;
let selectedKind = 'ev';
let calendarEvents = {};
let annivStr = '2025-05-18';
let currentColor = '#D62E63';
let currentWidth = 2;
let currentAlpha = 1;
let drawing = false;
let eraserOn = false;
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
  const setText = (id, value) => { const el = $(id); if (el) el.textContent = value; };
  setText('her-note-label', 'Note de ' + otherName);
  /* Mood is shown beside the avatar; no standalone mood widget. */
  setText('partner-status', otherName + ' \u00b7 hors ligne');
  setText('other-photo-label', 'Photo de ' + otherName);
  setText('me-profile-name', myName ? 'Tu es ' + myName : '');
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
  listenThrowback();
  listenSharedAppearance();
  listenCalendar();
  listenNotes();
  listenLittleNotes();
  listenBubbles();
  listenChat();
  listenPhotos();
  bindMyControls();
}

/* ---------- ONBOARDING ---------- */
function pickRole(r) {
  if (r !== 'a' && r !== 'b') return;
  selectedRole = r;
  const a = $('role-a'), b = $('role-b');
  if (a) {
    a.classList.toggle('selected', r === 'a');
    a.setAttribute('aria-pressed', r === 'a' ? 'true' : 'false');
  }
  if (b) {
    b.classList.toggle('selected', r === 'b');
    b.setAttribute('aria-pressed', r === 'b' ? 'true' : 'false');
  }
}
function finishOnboarding(e) {
  if (e && e.preventDefault) e.preventDefault();
  const roomInput = $('ob-room');
  const roomVal = roomInput ? roomInput.value.trim().toLowerCase() : '';
  // Soso est le profil initial affiché dans l'écran de connexion.
  // Cela évite qu'un tap iOS sur « C'est parti » soit bloqué simplement
  // parce que le bouton Soso n'a pas encore déclenché son handler.
  if (!selectedRole) selectedRole = 'a';
  if (!roomVal) {
    showBanner('Entre le code secret.');
    if (roomInput) roomInput.focus();
    return false;
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
  if (typeof closeLivePeek === 'function') closeLivePeek();
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

    $('partner-mood-display').textContent = data.mood || '\u{1F90D}';
    partnerMoodTs = data.moodTs || 0;
    $('partner-status-display').textContent = data.status || '';
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
    $('my-mood-display').textContent = data.mood || '\u{1F90D}';
    $('my-status-display').textContent = data.status || '';
    avatars[myRole] = data.photo || '';
    refreshAvatars();
  });
}

function toggleMoodPicker(e) {
  if (e) e.stopPropagation();
  const p = $('mood-popover');
  if (!p) return;
  p.hidden = !p.hidden;
}
document.addEventListener('click', e => {
  const p = $('mood-popover');
  if (!p || p.hidden) return;
  if (!e.target.closest('#mood-popover') && !e.target.closest('#my-mood-display') && !e.target.closest('#my-status-display')) p.hidden = true;
});
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
function playCupidShot(originEl) {
  const fx = $('cupid-fx');
  if (!fx) return;
  const svg = fx.querySelector('svg');
  const arrow = fx.querySelector('.cupid-arrow');
  if (!svg || !arrow) return;

  fx.classList.remove('go');
  arrow.classList.remove('go');
  void fx.offsetWidth;

  const r = originEl ? originEl.getBoundingClientRect() : {left: window.innerWidth/2, top: window.innerHeight-80, width:0, height:0};
  const startX = r.left + r.width / 2;
  const startY = r.top + r.height / 2;

  svg.style.left = (startX - 78) + 'px';
  svg.style.top = (startY - 228) + 'px';
  fx.classList.add('go');
  arrow.classList.add('go');

  setTimeout(() => {
    fx.classList.remove('go');
    arrow.classList.remove('go');
  }, 950);
}

function sendHeart() {
  const btn = $('heart-btn');
  btn.classList.remove('pulse'); void btn.offsetWidth; btn.classList.add('pulse');
  playCupidShot(btn);
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
        showBanner(nameOf(d.from) + ' t’a envoyé un cœur', 'home');
      }
      return;
    }
    if (!d || d.from === myRole || d.ts === lastHeartTs) return;
    lastHeartTs = d.ts;
    localStorage.setItem('yam_heart_ts', String(d.ts));
    burstHearts($('heart-btn'), 12);
    if (navigator.vibrate) navigator.vibrate([40, 60, 40]);
    notify(nameOf(d.from) + ' t’a envoyé un cœur', 'home');
  });
}

/* ---------- MUSIQUE / SPOTIFY ---------- */
let currentMusic = null, musicBase = false, lastMusicTs = 0;
let spotifyToken = null, spotifyTokenExpires = 0, spotifyResults = [], spotifySelected = null;
function normalizeUrl(s) { if (/^https?:\/\//i.test(s)) return s; if (/^[\w-]+(\.[\w-]+)+(\/\S*)?$/.test(s)) return 'https://' + s; return null; }
function musicLabel(url) { const u = normalizeUrl(url); if (!u) return url; try { const h = new URL(u).hostname.replace(/^www\./, ''); if (/spotify/.test(h)) return 'Spotify'; if (/youtu/.test(h)) return 'YouTube'; return h; } catch(e) { return url; } }
function spotifyChallenge(len=64){ const chars='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~'; let out=''; const a=new Uint8Array(len); crypto.getRandomValues(a); a.forEach(v=>out+=chars[v%chars.length]); return out; }
async function sha256Base64url(str){ const data=new TextEncoder().encode(str); const hash=await crypto.subtle.digest('SHA-256',data); let b=''; new Uint8Array(hash).forEach(x=>b+=String.fromCharCode(x)); return btoa(b).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,''); }
async function connectSpotify(){
  if (!window.SPOTIFY_CLIENT_ID) { toast('Ajoute ton Client ID Spotify dans spotify-config.js'); return false; }
  const verifier=spotifyChallenge(); const challenge=await sha256Base64url(verifier); sessionStorage.setItem('yam_spotify_verifier',verifier);
  const state=spotifyChallenge(24); sessionStorage.setItem('yam_spotify_state',state);
  const params=new URLSearchParams({client_id:SPOTIFY_CLIENT_ID,response_type:'code',redirect_uri:SPOTIFY_REDIRECT_URI,code_challenge_method:'S256',code_challenge:challenge,state});
  location.href='https://accounts.spotify.com/authorize?'+params.toString(); return true;
}
async function finishSpotifyAuth(){
  const p=new URLSearchParams(location.search), code=p.get('code'), state=p.get('state'); if(!code) return;
  if(state!==sessionStorage.getItem('yam_spotify_state')) return;
  const verifier=sessionStorage.getItem('yam_spotify_verifier');
  try { const r=await fetch('https://accounts.spotify.com/api/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:SPOTIFY_CLIENT_ID,grant_type:'authorization_code',code,redirect_uri:SPOTIFY_REDIRECT_URI,code_verifier:verifier})}); const d=await r.json(); if(d.access_token){ spotifyToken=d.access_token; spotifyTokenExpires=Date.now()+((d.expires_in||3600)-60)*1000; sessionStorage.setItem('yam_spotify_token',d.access_token); } } catch(e){}
  history.replaceState({},document.title,location.pathname); sessionStorage.removeItem('yam_spotify_verifier'); sessionStorage.removeItem('yam_spotify_state');
}
async function getSpotifyToken(){ if(spotifyToken && Date.now()<spotifyTokenExpires) return spotifyToken; const cached=sessionStorage.getItem('yam_spotify_token'); if(cached){spotifyToken=cached;spotifyTokenExpires=Date.now()+3300000;return cached;} await finishSpotifyAuth(); return spotifyToken; }
function renderMusicResults(items){ const box=$('music-results'); if(!box) return; if(!items.length){box.innerHTML='';box.classList.remove('show');return;} box.innerHTML=items.slice(0,7).map((t,i)=>'<button class="music-result" onclick="chooseMusic('+i+')"><img src="'+escapeHtml(t.album.images?.[2]?.url||t.album.images?.[0]?.url||'')+'"><span><b>'+escapeHtml(t.name)+'</b><small>'+escapeHtml(t.artists.map(a=>a.name).join(', '))+'</small></span></button>').join(''); box.classList.add('show'); }
async function searchSpotify(q){
  q=q.trim(); if(q.length<2){renderMusicResults([]);return;}
  const token=await getSpotifyToken();
  if(!token){ renderMusicResults([{name:'Ouvrir la recherche Spotify',artists:[{name:q}],album:{images:[]},external_urls:{spotify:'https://open.spotify.com/search/'+encodeURIComponent(q)}}]); spotifyResults=[renderFallbackTrack(q)]; return; }
  try{ const r=await fetch('https://api.spotify.com/v1/search?'+new URLSearchParams({q,type:'track',limit:'8'}),{headers:{Authorization:'Bearer '+token}}); if(!r.ok) throw new Error('spotify'); const d=await r.json(); spotifyResults=d.tracks.items||[]; renderMusicResults(spotifyResults); }catch(e){renderMusicResults([]);}
}
function renderFallbackTrack(q){ return {name:q,artists:[{name:'Spotify'}],album:{images:[]},external_urls:{spotify:'https://open.spotify.com/search/'+encodeURIComponent(q)}}; }
function chooseMusic(i){ spotifySelected=spotifyResults[i]||null; if(!spotifySelected)return; $('music-input').value=spotifySelected.name+' — '+spotifySelected.artists.map(a=>a.name).join(', '); renderMusicResults([]); }
function shareMusic(){ const input=$('music-input'); const val=input.value.trim(); if(!val||!roomRef)return; const t=spotifySelected; const payload=t?{url:t.external_urls?.spotify||('https://open.spotify.com/search/'+encodeURIComponent(val)),title:t.name,artist:t.artists.map(a=>a.name).join(', '),cover:t.album.images?.[1]?.url||t.album.images?.[0]?.url||'',from:myRole,ts:Date.now()}:{url:normalizeUrl(val)||('https://open.spotify.com/search/'+encodeURIComponent(val)),title:val,artist:'Spotify',cover:'',from:myRole,ts:Date.now()}; roomRef.child('music').set(payload); input.value=''; spotifySelected=null; toast('Musique envoyée à '+otherName); }
function openMusic(){ const u=currentMusic&&normalizeUrl(currentMusic.url); if(u) window.open(u,'_blank','noopener'); }
function renderMusic(){ const m=currentMusic; if(m&&m.url){ $('music-title').textContent=m.title||musicLabel(m.url); $('music-subtitle').textContent=(m.artist?m.artist+' · ':'')+'Partagé par '+(m.from===myRole?'toi':nameOf(m.from)); const img=$('music-cover'); if(img){img.src=m.cover||'';img.style.display=m.cover?'block':'none';} } else { $('music-title').textContent="Rien de partagé pour l'instant"; $('music-subtitle').textContent='Envoie-lui un son'; const img=$('music-cover'); if(img)img.style.display='none'; } }
function listenMusic(){ onValue(roomRef.child('music'),snap=>{const data=snap.val();currentMusic=data;renderMusic();if(musicBase&&data&&data.from!==myRole&&data.ts!==lastMusicTs)notify(nameOf(data.from)+' a partagé une musique','home');lastMusicTs=data?data.ts:0;musicBase=true;}); }
let musicSearchTimer=null; document.addEventListener('input',e=>{if(e.target.id==='music-input'){clearTimeout(musicSearchTimer);spotifySelected=null;musicSearchTimer=setTimeout(()=>searchSpotify(e.target.value),260);}});
setInterval(()=>{if(currentMusic)renderMusic();},30000);
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
  if ($('home-countdown-days')) $('home-countdown-days').textContent = daysLeft;
  if ($('home-anniv-date')) $('home-anniv-date').textContent = anniv.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
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

/* ---------- THROWBACK ---------- */
let throwbackData=null;
function listenThrowback(){ onValue(roomRef.child('throwback'),snap=>{throwbackData=snap.val()||null;renderThrowback();}); }
function renderThrowback(){const el=$('throwback-photo');if(!el)return;const thumb=$('home-memory-thumb');if(throwbackData?.img){el.style.backgroundImage='url('+throwbackData.img+')';el.classList.add('has');if(thumb){thumb.style.backgroundImage='url('+throwbackData.img+')';thumb.classList.add('has');}}else{el.style.backgroundImage='';el.classList.remove('has');if(thumb){thumb.style.backgroundImage='';thumb.classList.remove('has');}}}
function openThrowback(){if(throwbackData?.img){$('throwback-img').src=throwbackData.img;$('throwback-viewer').classList.remove('hidden');}else $('throwback-file').click();}
function closeThrowback(){$('throwback-viewer').classList.add('hidden');}
function saveThrowback(e){const file=e.target.files?.[0];if(!file||!roomRef)return;const img=new Image();const r=new FileReader();r.onload=()=>{img.onload=()=>{const max=1200,scale=Math.min(1,max/img.width,max/img.height),c=document.createElement('canvas');c.width=Math.round(img.width*scale);c.height=Math.round(img.height*scale);c.getContext('2d').drawImage(img,0,0,c.width,c.height);const data=c.toDataURL('image/jpeg',.72);roomRef.child('throwback').set({img:data,from:myRole,ts:Date.now()});e.target.value='';toast('Souvenir ajouté');};img.src=r.result;};r.readAsDataURL(file);}

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
const canvas = $('draw-canvas') || document.createElement('canvas');
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
  ctx.strokeStyle = eraserOn ? '#ffffff' : currentColor;
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

$('tool-row')?.addEventListener('click', e => {
  const btn = e.target.closest('.tool');
  if (!btn) return;
  document.querySelectorAll('.tool').forEach(t => t.classList.remove('active'));
  btn.classList.add('active');
  currentWidth = parseFloat(btn.dataset.width);
  currentAlpha = parseFloat(btn.dataset.alpha);
});
$('color-row')?.addEventListener('click', e => {
  const btn = e.target.closest('.swatch');
  if (!btn) return;
  document.querySelectorAll('.swatch').forEach(s => s.classList.remove('selected'));
  btn.classList.add('selected');
  currentColor = btn.dataset.color;
});
function toggleEraser(){eraserOn=!eraserOn;document.body.classList.toggle('eraser-on',eraserOn);$('eraser-btn')?.classList.toggle('active',eraserOn);}
function clearCanvas() {
  const r = canvas.getBoundingClientRect();
  ctx.setTransform(2, 0, 0, 2, 0, 0);
  paintWhite(r.width, r.height);
  canvasDirty = false;
}

let editingNoteId = null;
let selectedNoteColor = '#ffffff';
let noteDrawCanvas = null, noteDrawCtx = null;
let noteDrawing = false, noteLastX = 0, noteLastY = 0, noteCanvasDirty = false;
let noteDrawWidth = 2, noteDrawAlpha = 1, noteDrawColor = '#f0245b', noteDrawEraser = false;

function setupNoteDrawing(){
  noteDrawCanvas = $('note-draw-canvas');
  if(!noteDrawCanvas) return;
  noteDrawCtx = noteDrawCanvas.getContext('2d');
  const resize = () => {
    const r = noteDrawCanvas.getBoundingClientRect();
    if(!r.width || !r.height) return;
    const old = noteCanvasDirty && noteDrawCanvas.width ? noteDrawCanvas.toDataURL('image/png') : null;
    noteDrawCanvas.width = Math.round(r.width * 2);
    noteDrawCanvas.height = Math.round(r.height * 2);
    noteDrawCtx.setTransform(2,0,0,2,0,0);
    noteDrawCtx.clearRect(0,0,r.width,r.height);
    if(old){ const img=new Image(); img.onload=()=>noteDrawCtx.drawImage(img,0,0,r.width,r.height); img.src=old; }
  };
  const pos = e => { const r=noteDrawCanvas.getBoundingClientRect(); return {x:e.clientX-r.left,y:e.clientY-r.top}; };
  noteDrawCanvas.addEventListener('pointerdown', e=>{
    resize(); noteDrawing=true; try{noteDrawCanvas.setPointerCapture(e.pointerId);}catch(_){ }
    const q=pos(e); noteLastX=q.x; noteLastY=q.y;
    noteDrawCtx.globalCompositeOperation=noteDrawEraser?'destination-out':'source-over';
    noteDrawCtx.globalAlpha=noteDrawEraser?1:noteDrawAlpha; noteDrawCtx.strokeStyle=noteDrawColor; noteDrawCtx.lineWidth=noteDrawWidth; noteDrawCtx.lineCap='round';
    noteDrawCtx.beginPath(); noteDrawCtx.moveTo(q.x,q.y); noteDrawCtx.lineTo(q.x+.01,q.y); noteDrawCtx.stroke(); noteCanvasDirty=true;
  });
  noteDrawCanvas.addEventListener('pointermove', e=>{
    if(!noteDrawing) return; const q=pos(e);
    noteDrawCtx.globalCompositeOperation=noteDrawEraser?'destination-out':'source-over'; noteDrawCtx.globalAlpha=noteDrawEraser?1:noteDrawAlpha; noteDrawCtx.strokeStyle=noteDrawColor; noteDrawCtx.lineWidth=noteDrawWidth; noteDrawCtx.lineCap='round';
    noteDrawCtx.beginPath(); noteDrawCtx.moveTo(noteLastX,noteLastY); noteDrawCtx.lineTo(q.x,q.y); noteDrawCtx.stroke(); noteLastX=q.x; noteLastY=q.y; noteCanvasDirty=true;
  });
  window.addEventListener('pointerup',()=>noteDrawing=false); window.addEventListener('pointercancel',()=>noteDrawing=false);
  window.addEventListener('resize',resize);
  document.querySelectorAll('.note-tool').forEach(btn=>btn.addEventListener('click',()=>{
    document.querySelectorAll('.note-tool').forEach(x=>x.classList.remove('active')); btn.classList.add('active');
    noteDrawWidth=parseFloat(btn.dataset.width); noteDrawAlpha=parseFloat(btn.dataset.alpha); noteDrawEraser=false; $('note-draw-eraser')?.classList.remove('active');
  }));
  document.querySelectorAll('.note-draw-color').forEach(btn=>btn.addEventListener('click',()=>{
    document.querySelectorAll('.note-draw-color').forEach(x=>x.classList.remove('selected')); btn.classList.add('selected'); noteDrawColor=btn.dataset.color; noteDrawEraser=false; $('note-draw-eraser')?.classList.remove('active');
  }));
  document.querySelectorAll('.note-color').forEach(btn=>btn.addEventListener('click',()=>{
    document.querySelectorAll('.note-color').forEach(x=>x.classList.remove('selected')); btn.classList.add('selected'); selectedNoteColor=btn.dataset.noteColor; updateNoteEditorCardColor();
  }));
}
function updateNoteEditorCardColor(){
  const sheet=document.querySelector('.note-editor-sheet');
  if(sheet) sheet.style.setProperty('--editor-note-color',selectedNoteColor);
}
function toggleNoteDrawingPanel(force){
  // Compatibilité avec les anciennes notes : le dessin est maintenant
  // toujours édité dans le panneau indépendant, jamais en accordéon.
  if(typeof force==='boolean' && force === false){
    closeStandaloneDrawing();
    return;
  }
  openStandaloneDrawing();
}
function clearNoteDrawing(){
  if(!noteDrawCtx||!noteDrawCanvas)return;
  const r=noteDrawCanvas.getBoundingClientRect();
  noteDrawCtx.setTransform(2,0,0,2,0,0);
  noteDrawCtx.clearRect(0,0,r.width,r.height);
  noteCanvasDirty=false;
}
function toggleNoteEraser(){ noteDrawEraser=!noteDrawEraser; $('note-draw-eraser')?.classList.toggle('active',noteDrawEraser); }
function loadNoteDrawing(src){
  clearNoteDrawing();
  if(!src||!noteDrawCanvas)return;
  const img=new Image();
  img.onload=()=>{const r=noteDrawCanvas.getBoundingClientRect(); noteDrawCtx.drawImage(img,0,0,r.width,r.height); noteCanvasDirty=true;};
  img.src=src;
}
function resetNoteDrawing(){
  clearNoteDrawing();
  noteDrawEraser=false;
  $('note-draw-eraser')?.classList.remove('active');
  if($('standalone-drawing') && !$('standalone-drawing').classList.contains('hidden')) closeStandaloneDrawing();
}


/* ---------- PANNEAU DE DESSIN INDÉPENDANT ---------- */
let standaloneCanvas = null, standaloneCtx = null;
let standaloneDrawing = false, standaloneLastX = 0, standaloneLastY = 0;
let standaloneColor = '#ef3f70', standaloneWidth = 2, standaloneAlpha = 1, standaloneEraser = false;
let standaloneHistory = [], standaloneHistoryIndex = -1, standaloneResizeObserver = null;

function standaloneCanvasRect(){
  return standaloneCanvas ? standaloneCanvas.getBoundingClientRect() : {left:0,top:0,width:0,height:0};
}
function standalonePoint(e){
  const r=standaloneCanvasRect();
  return {x:e.clientX-r.left,y:e.clientY-r.top};
}
function updateStandaloneHistoryButtons(){
  $('standalone-undo')?.toggleAttribute('disabled', standaloneHistoryIndex<=0);
  $('standalone-redo')?.toggleAttribute('disabled', standaloneHistoryIndex<0 || standaloneHistoryIndex>=standaloneHistory.length-1);
}
function standaloneBlank(){
  if(!standaloneCanvas||!standaloneCtx)return;
  const r=standaloneCanvas.getBoundingClientRect();
  standaloneCtx.setTransform(2,0,0,2,0,0);
  standaloneCtx.clearRect(0,0,r.width,r.height);
}
function standaloneSnapshot(){
  if(!standaloneCanvas)return;
  const data=standaloneCanvas.toDataURL('image/png');
  standaloneHistory=standaloneHistory.slice(0,standaloneHistoryIndex+1);
  standaloneHistory.push(data);
  if(standaloneHistory.length>25) standaloneHistory.shift();
  standaloneHistoryIndex=standaloneHistory.length-1;
  updateStandaloneHistoryButtons();
}
function standaloneRestore(data){
  if(!standaloneCanvas||!standaloneCtx)return;
  const r=standaloneCanvas.getBoundingClientRect();
  standaloneCtx.setTransform(2,0,0,2,0,0);
  standaloneCtx.clearRect(0,0,r.width,r.height);
  if(!data){ updateStandaloneHistoryButtons(); return; }
  const img=new Image();
  img.onload=()=>{standaloneCtx.setTransform(2,0,0,2,0,0);standaloneCtx.drawImage(img,0,0,r.width,r.height);};
  img.src=data;
  updateStandaloneHistoryButtons();
}
function resizeStandaloneCanvas(preserve=true){
  if(!standaloneCanvas)return;
  const r=standaloneCanvas.getBoundingClientRect();
  if(!r.width||!r.height)return;
  const old=preserve && standaloneCanvas.width ? standaloneCanvas.toDataURL('image/png') : null;
  standaloneCanvas.width=Math.round(r.width*2);
  standaloneCanvas.height=Math.round(r.height*2);
  standaloneCtx=standaloneCanvas.getContext('2d');
  standaloneCtx.setTransform(2,0,0,2,0,0);
  standaloneCtx.clearRect(0,0,r.width,r.height);
  if(old){
    const img=new Image();
    img.onload=()=>{standaloneCtx.setTransform(2,0,0,2,0,0);standaloneCtx.drawImage(img,0,0,r.width,r.height);};
    img.src=old;
  }
}
function resetStandaloneDrawing(){
  resizeStandaloneCanvas(false);
  standaloneBlank();
  standaloneHistory=[];
  standaloneHistoryIndex=-1;
  standaloneSnapshot();
  standaloneEraser=false;
  document.body.classList.remove('standalone-drawing-active');
  $('standalone-eraser')?.classList.remove('active');
}
function loadStandaloneDrawing(src){
  if(!src||!standaloneCanvas)return;
  resizeStandaloneCanvas(false);
  standaloneBlank();
  const r=standaloneCanvas.getBoundingClientRect();
  const img=new Image();
  img.onload=()=>{
    standaloneCtx.setTransform(2,0,0,2,0,0);
    standaloneCtx.drawImage(img,0,0,r.width,r.height);
    standaloneHistory=[standaloneCanvas.toDataURL('image/png')];
    standaloneHistoryIndex=0;
    updateStandaloneHistoryButtons();
  };
  img.src=src;
}
function openStandaloneDrawing(src){
  const modal=$('standalone-drawing');
  if(!modal)return;
  modal.classList.remove('hidden');
  document.body.classList.add('standalone-drawing-active');
  standaloneCanvas=$('standalone-draw-canvas');
  standaloneCtx=standaloneCanvas?.getContext('2d');
  requestAnimationFrame(()=>{
    if(src) loadStandaloneDrawing(src);
    else resetStandaloneDrawing();
    updateStandaloneHistoryButtons();
  });
}
function closeStandaloneDrawing(){
  const modal=$('standalone-drawing');
  if(modal) modal.classList.add('hidden');
  document.body.classList.remove('standalone-drawing-active');
  standaloneDrawing=false;
  standaloneEraser=false;
  $('standalone-eraser')?.classList.remove('active');
}
function clearStandaloneDrawing(){
  if(!standaloneCanvas)return;
  standaloneBlank();
  standaloneSnapshot();
  standaloneDrawing=false;
}
function undoStandaloneDrawing(){
  if(standaloneHistoryIndex<=0)return;
  standaloneHistoryIndex--;
  standaloneRestore(standaloneHistory[standaloneHistoryIndex]);
}
function redoStandaloneDrawing(){
  if(standaloneHistoryIndex>=standaloneHistory.length-1)return;
  standaloneHistoryIndex++;
  standaloneRestore(standaloneHistory[standaloneHistoryIndex]);
}
function sendStandaloneDrawing(){
  if(!roomRef){toast('Connexion indisponible');return;}
  if(!standaloneCanvas || standaloneHistoryIndex<=0){
    toast('Dessine quelque chose avant d’envoyer');
    return;
  }
  const src=standaloneCanvas.toDataURL('image/png');
  const note={
    title:'Dessin',
    blocks:[{type:'drawing',src}],
    color:'#ffdfe9',
    from:myRole,
    ts:Date.now(),
    favorite:false
  };
  roomRef.child('notesInbox/'+otherRole).push().set(note).then(()=>{
    closeStandaloneDrawing();
    renderStructuredNotes();
    toast('Dessin ajouté à la pile');
  }).catch(()=>toast('Impossible d’envoyer le dessin'));
}
function initStandaloneDrawing(){
  standaloneCanvas=$('standalone-draw-canvas');
  if(!standaloneCanvas)return;
  standaloneCtx=standaloneCanvas.getContext('2d');
  standaloneCanvas.addEventListener('pointerdown',e=>{
    if(!standaloneCtx)return;
    resizeStandaloneCanvas(true);
    standaloneDrawing=true;
    try{standaloneCanvas.setPointerCapture(e.pointerId);}catch(_){}
    const p=standalonePoint(e);
    standaloneLastX=p.x; standaloneLastY=p.y;
    standaloneCtx.globalCompositeOperation=standaloneEraser?'destination-out':'source-over';
    standaloneCtx.globalAlpha=standaloneEraser?1:standaloneAlpha;
    standaloneCtx.strokeStyle=standaloneColor;
    standaloneCtx.lineWidth=standaloneWidth;
    standaloneCtx.lineCap='round';
    standaloneCtx.beginPath();
    standaloneCtx.moveTo(p.x,p.y);standaloneCtx.lineTo(p.x+.01,p.y);standaloneCtx.stroke();
  });
  standaloneCanvas.addEventListener('pointermove',e=>{
    if(!standaloneDrawing||!standaloneCtx)return;
    const p=standalonePoint(e);
    standaloneCtx.globalCompositeOperation=standaloneEraser?'destination-out':'source-over';
    standaloneCtx.globalAlpha=standaloneEraser?1:standaloneAlpha;
    standaloneCtx.strokeStyle=standaloneColor;
    standaloneCtx.lineWidth=standaloneWidth;
    standaloneCtx.lineCap='round';
    standaloneCtx.beginPath();
    standaloneCtx.moveTo(standaloneLastX,standaloneLastY);
    standaloneCtx.lineTo(p.x,p.y);
    standaloneCtx.stroke();
    standaloneLastX=p.x;standaloneLastY=p.y;
  });
  const finish=()=>{if(standaloneDrawing){standaloneDrawing=false;standaloneSnapshot();}};
  standaloneCanvas.addEventListener('pointerup',finish);
  standaloneCanvas.addEventListener('pointercancel',finish);
  $('standalone-tool-row')?.addEventListener('click',e=>{
    const btn=e.target.closest('.standalone-tool');if(!btn)return;
    document.querySelectorAll('.standalone-tool').forEach(x=>x.classList.remove('active'));
    btn.classList.add('active');
    if(btn.dataset.eraser){
      standaloneEraser=true;
    }else{
      standaloneEraser=false;
      standaloneWidth=parseFloat(btn.dataset.width)||2;
      standaloneAlpha=parseFloat(btn.dataset.alpha)||1;
    }
    $('standalone-eraser')?.classList.toggle('active',standaloneEraser);
  });
  $('standalone-color-row')?.addEventListener('click',e=>{
    const btn=e.target.closest('.standalone-color');if(!btn)return;
    document.querySelectorAll('.standalone-color').forEach(x=>x.classList.remove('selected'));
    btn.classList.add('selected');
    standaloneColor=btn.dataset.color||'#ef3f70';
    standaloneEraser=false;
    $('standalone-eraser')?.classList.remove('active');
    document.querySelectorAll('.standalone-tool').forEach(x=>x.classList.remove('active'));
    document.querySelector('.standalone-tool[data-width="2"]')?.classList.add('active');
    standaloneWidth=2;standaloneAlpha=1;
  });
  window.addEventListener('resize',()=>{
    if(!$('standalone-drawing')?.classList.contains('hidden')) resizeStandaloneCanvas(true);
  });
}

function resetNoteEditorBlocks(){
  const box=$('note-editor-blocks');
  if(!box)return;
  box.innerHTML=`<div class="note-write-card note-block" data-main-text="true">
    <textarea class="nb-text note-main-text" id="note-main-text" rows="4" placeholder="Écris ici…" aria-label="Contenu de la note"></textarea>
    <div class="note-inline-tools" aria-label="Ajouter à la note">
      <button type="button" class="note-inline-tool" onclick="addNoteBlock('image')" aria-label="Ajouter une photo"><span class="note-inline-icon">◫</span><span>Photo</span></button>
      <button type="button" class="note-inline-tool" onclick="addNoteBlock('text')" aria-label="Ajouter du texte"><span class="note-inline-icon">Aa</span><span>Texte</span></button>
      <button type="button" class="note-inline-tool" onclick="addNoteBlock('check')" aria-label="Ajouter une liste"><span class="note-inline-icon">☑</span><span>Liste</span></button>
    </div>
  </div>`;
}
function openNoteEditor(){
  editingNoteId=null; selectedNoteColor='#ffffff';
  $('note-editor').classList.remove('hidden');
  $('note-editor-title').value='';
  resetNoteEditorBlocks();
  document.querySelectorAll('.note-color').forEach((b,i)=>b.classList.toggle('selected',i===0));
  resetNoteDrawing(); updateNoteEditorCardColor();
  $('note-delete-btn')?.classList.add('hidden');
  const send=document.querySelector('#note-editor .primary'); send.textContent='Ajouter à la pile'; send.onclick=sendStructuredNote;
}
function closeNoteEditor(){ $('note-editor').classList.add('hidden'); editingNoteId=null; }
function addNoteBlock(type, autoOpenPhoto=true){
  const box=$('note-editor-blocks'); if(!box)return;
  const row=document.createElement('div'); row.className='note-block note-extra-block';
  if(type==='check'){
    row.innerHTML='<span class="nb-check-wrap"><input type="checkbox" aria-label="Cocher"></span><input class="nb-text" placeholder="À faire…"><button type="button" onclick="this.parentElement.remove()" aria-label="Supprimer">×</button>';
  } else if(type==='image'){
    row.innerHTML='<label class="nb-photo-btn"><span class="nb-photo-icon">◫</span><span class="nb-file">Ajouter une photo</span><input class="nb-photo-input" type="file" accept="image/*" multiple onchange="noteImagePreview(event)"></label><button type="button" onclick="this.parentElement.remove()" aria-label="Supprimer">×</button>';
  } else {
    row.innerHTML='<textarea class="nb-text" rows="2" placeholder="Écris ici…"></textarea><button type="button" onclick="this.parentElement.remove()" aria-label="Supprimer">×</button>';
  }
  box.appendChild(row);
  if(type==='image' && autoOpenPhoto){
    row.querySelector('.nb-photo-input')?.click();
  }
}
function noteImagePreview(e){
  const files=[...(e.target.files||[])].filter(f=>f.type.startsWith('image/'));
  if(!files.length)return;
  const box=$('note-editor-blocks');
  const first=e.target.closest('.note-block');
  files.forEach((f,idx)=>{
    const reader=new FileReader();
    reader.onload=()=>{
      const target = idx===0 ? first : document.createElement('div');
      if(idx>0){
        target.className='note-block';
        target.innerHTML='<label class="nb-photo-btn"><span class="nb-photo-icon">✓</span><span class="nb-file">Photo ajoutée</span><input class="nb-photo-input" type="file" accept="image/*"></label><button type="button" onclick="this.parentElement.remove()" aria-label="Supprimer">×</button>';
        box.appendChild(target);
      }
      const input=target.querySelector('input[type=file]');
      if(input) input.dataset.data=reader.result;
      const label=target.querySelector('.nb-file');
      if(label) label.textContent=files.length>1?`Photo ${idx+1} ajoutée ✓`:'Photo ajoutée ✓';
      target.classList.add('has-photo');
    };
    reader.readAsDataURL(f);
  });
}
function collectNoteBlocks(){
  const blocks=[];
  document.querySelectorAll('#note-editor-blocks .note-block').forEach(row=>{
    const cb=row.querySelector('input[type=checkbox]'), text=row.querySelector('.nb-text'), file=row.querySelector('input[type=file]');
    if(cb||text){ const val=(text?.value||'').trim(); if(val) blocks.push({type:cb?'check':'text',text:val,checked:!!cb?.checked}); }
    else if(file?.dataset.data) blocks.push({type:'image',src:file.dataset.data});
  });
  if(noteCanvasDirty && noteDrawCanvas) blocks.push({type:'drawing',src:noteDrawCanvas.toDataURL('image/png')});
  return blocks;
}
async function sendStructuredNote(){
  if(!roomRef)return;
  const title=$('note-editor-title').value.trim()||'Note'; const blocks=collectNoteBlocks();
  if(!blocks.length){toast('Écris, ajoute une photo ou dessine quelque chose');return;}
  const ref=roomRef.child('notesInbox/'+otherRole).push();
  await ref.set({title,blocks,color:selectedNoteColor,from:myRole,ts:Date.now(),favorite:false});
  closeNoteEditor();
  $('note-editor')?.classList.add('hidden');
  toast('Note envoyée à '+otherName);
}
let structuredNotes=[];
let noteCommentsOpen = {};
let noteSources = { a: {}, b: {} };
let noteBrowseId = null;
let noteShuffleTimer = null;

function formatNoteDate(ts){
  const d = new Date(Number(ts) || Date.now());
  return d.toLocaleDateString('fr-FR',{day:'numeric',month:'long',year:'numeric'}) +
    ' · ' + d.toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'});
}
function notePath(n){
  return n && n._inboxRole ? 'notesInbox/'+n._inboxRole+'/'+n.id : null;
}
function noteLikeState(n){
  return !!((n.likes && n.likes[myRole]) || (n.favorite && n.from === myRole));
}
function normalizeNoteComments(comments){
  if(!comments)return [];
  return Object.keys(comments).map(id=>Object.assign({id},comments[id]||{})).filter(c=>c && c.text).sort((a,b)=>(a.ts||0)-(b.ts||0));
}
function renderStructuredNotes(){
  const box=$('notes-stack'); if(!box)return;
  let notes=structuredNotes.slice().sort((a,b)=>(b.ts||0)-(a.ts||0));
  if(noteBrowseId){
    const idx=notes.findIndex(n=>n.id===noteBrowseId);
    if(idx>0) notes=notes.slice(idx).concat(notes.slice(0,idx));
    if(idx<0) noteBrowseId=null;
  }
  if(!notes.length){
    box.innerHTML='<button type="button" class="notes-empty" onclick="openNoteEditor()" aria-label="Créer une première note"><span class="notes-empty-kicker">VOTRE CARNET À DEUX</span><b>Une petite note<br>attend ici.</b><small>Écrivez, dessinez ou ajoutez une photo.</small></button>';
    return;
  }
  box.innerHTML=notes.map((n,i)=>{
    const bg=n.color||(['#ffffff','#ffdfe9','#e9e0fb','#dff3e8','#dcecfb'][i%5]);
    const blocks=n.blocks||[];
    const body=blocks.slice(0,8).map((b,bi)=>b.type==='check'
      ? '<label><input type="checkbox" '+(b.checked?'checked':'')+' onclick="event.stopPropagation();toggleNoteCheck(\''+n.id+'\','+!!b.checked+',this,'+bi+')"><span>'+escapeHtml(b.text)+'</span></label>'
      : (b.type==='image'||b.type==='drawing') ? '<img src="'+escapeHtml(b.src||'')+'" alt="" class="note-media" onclick="event.stopPropagation();openNoteMediaPreview(\''+escapeHtml(b.src||'').replace(/'/g,"\\'")+ '\',\''+escapeHtml(n.title||'Note').replace(/'/g,"\\'")+'\')">'
      : '<p>'+escapeHtml(b.text)+'</p>').join('');
    const comments=normalizeNoteComments(n.comments);
    const open=!!noteCommentsOpen[n.id];
    const commentsHtml=comments.length
      ? '<div class="note-comments-list">'+comments.map(c=>'<div class="note-comment"><b>'+escapeHtml(nameOf(c.from))+'</b><span>'+escapeHtml(c.text)+'</span></div>').join('')+'</div>'
      : '';
    const commentPanel=open
      ? '<div class="note-comment-panel" onclick="event.stopPropagation()">'+commentsHtml+
        `<div class="note-comment-input-row"><input id="note-comment-input-${n.id}" maxlength="180" placeholder="Écrire un commentaire…" onkeydown="if(event.key==='Enter'){event.preventDefault();addNoteComment('${n.id}',this.value)}"><button type="button" onclick="addNoteComment('${n.id}',document.getElementById('note-comment-input-${n.id}').value)">↑</button></div></div>`
      : '';
    const likeClass=noteLikeState(n)?'on':'';
    return '<article class="stack-note" data-note-index="'+i+'" style="--stack:'+i+';--note-rot:'+((i%3)-1)*1.2+'deg;--note-bg:'+bg+'" onclick="cycleNoteStack(\''+n.id+'\')">'+
      '<div class="stack-note-origin">'+escapeHtml(n.from===myRole?'Toi':nameOf(n.from))+'</div>'+
      '<button class="note-trash" type="button" onclick="event.stopPropagation();deletePublishedNote(\''+n.id+'\')" aria-label="Supprimer cette note"><svg viewBox="0 0 24 24" aria-hidden="true"><use href="#i-trash"></use></svg></button>'+
      '<button class="note-fav '+likeClass+'" onclick="event.stopPropagation();toggleNoteFavorite(\''+n.id+'\')" aria-label="J’aime cette note" aria-pressed="'+(likeClass?'true':'false')+'"><svg viewBox="0 0 24 24" aria-hidden="true"><use href="#i-heart"></use></svg></button>'+
      '<h3 onclick="event.stopPropagation();openStructuredNote(\''+n.id+'\')">'+escapeHtml(n.title||'Note')+'</h3><div class="stack-note-body">'+body+'</div>'+
      '<div class="note-footer" onclick="event.stopPropagation()"><small>'+formatNoteDate(n.ts)+'</small>'+
      '<button class="note-comment-toggle" type="button" onclick="toggleNoteComments(\''+n.id+'\')" aria-expanded="'+open+'">♡ '+comments.length+'</button></div>'+
      commentPanel+
      '</article>';
  }).join('');
}
function toggleNotesStack(force){
  const wrap=document.querySelector('.notes-stack-wrap'); if(!wrap)return;
  const next=typeof force==='boolean'?force:!wrap.classList.contains('is-fanned');
  wrap.classList.toggle('is-fanned',next);
}
function cycleNoteStack(id){
  if(!structuredNotes.length)return;
  const sorted=structuredNotes.slice().sort((a,b)=>(b.ts||0)-(a.ts||0));
  if(id && noteBrowseId===id){
    const idx=sorted.findIndex(n=>n.id===id);
    noteBrowseId=sorted[(idx+1)%sorted.length]?.id || id;
  }else{
    noteBrowseId=id || noteBrowseId || sorted[0]?.id;
  }
  const wrap=document.querySelector('.notes-stack-wrap');
  wrap?.classList.remove('note-shuffling');
  void wrap?.offsetWidth;
  wrap?.classList.add('note-shuffling');
  clearTimeout(noteShuffleTimer);
  noteShuffleTimer=setTimeout(()=>wrap?.classList.remove('note-shuffling'),420);
  renderStructuredNotes();
}
async function deletePublishedNote(id){
  const n=structuredNotes.find(x=>x.id===id);
  const path=notePath(n);
  if(!n||!path||!roomRef)return;
  await roomRef.child(path).remove();
  if(noteBrowseId===id) noteBrowseId=null;
  toast('Note supprimée');
}
function listenNotes(){
  ['a','b'].forEach(inboxRole=>{
    onValue(roomRef.child('notesInbox/'+inboxRole),snap=>{
      const v=snap.val()||{};
      noteSources[inboxRole]=Object.keys(v).map(id=>Object.assign({id,_inboxRole:inboxRole},v[id]||{})).filter(n=>n);
      const merged=[...Object.values(noteSources).flat()];
      const seen=new Map();
      merged.forEach(n=>seen.set(n.id,n));
      structuredNotes=Array.from(seen.values());
      renderStructuredNotes();
    });
  });
}
function showLittleNotePop(text, senderLabel){
  const pop=$('little-note-pop'), body=$('little-note-pop-text');
  if(!pop||!body)return;
  const label=$('little-note-pop-label'); if(label) label.textContent=senderLabel||'Un petit mot pour toi';
  body.textContent=text||'';
  pop.classList.remove('hidden');
  clearTimeout(window._littleNotePopTimer);
  window._littleNotePopTimer=setTimeout(closeLittleNotePop,5000);
}
function closeLittleNotePop(){ $('little-note-pop')?.classList.add('hidden'); }
async function sendLittleNote(){
  const input=$('little-note-input'); const text=(input?.value||'').trim();
  if(!text||!roomRef)return;
  const ref=roomRef.child('littleNotesInbox/'+otherRole).push();
  await ref.set({text,from:myRole,ts:firebase.database.ServerValue.TIMESTAMP,expiresAt:Date.now()+7000});
  input.value='';
  showLittleNotePop(text,'Envoyé à '+otherName+' ♡');
  toast('Petit mot envoyé');
  setTimeout(()=>ref.remove().catch(()=>{}),7500);
}
function listenLittleNotes(){
  const ref=roomRef.child('littleNotesInbox/'+myRole);
  ref.on('child_added', snap=>{
    const d=snap.val(); if(!d)return;
    if(d.expiresAt && d.expiresAt < Date.now()){ snap.ref.remove(); return; }
    if(d.from===myRole)return;
    showLittleNotePop(d.text,nameOf(d.from)+' t’a écrit un petit mot ♡');
    if(document.hidden) systemNotify(nameOf(d.from)+' t’a envoyé un petit mot');
    setTimeout(()=>snap.ref.remove().catch(()=>{}),1800);
  }, dbError);
}
function updateNote(id,patch){
  const idx=structuredNotes.findIndex(n=>n.id===id); if(idx<0||!roomRef)return;
  const n=structuredNotes[idx], path=notePath(n); if(!path)return;
  const next=Object.assign({},n,patch); structuredNotes[idx]=next;
  roomRef.child(path).update(patch).catch(()=>{});
  renderStructuredNotes();
}
function toggleNoteFavorite(id){
  const n=structuredNotes.find(x=>x.id===id); if(!n)return;
  const liked=noteLikeState(n);
  const patch={}; patch['likes/'+myRole]=liked?null:true;
  updateNote(id,patch);
}
function toggleNoteCheck(id,checked,el,blockIndex){
  const n=structuredNotes.find(x=>x.id===id); if(!n)return;
  const blocks=(n.blocks||[]).map((b,i)=>i===Number(blockIndex)?Object.assign({},b,{checked:!!checked}):Object.assign({},b));
  updateNote(id,{blocks});
}
function toggleNoteComments(id){
  noteCommentsOpen[id]=!noteCommentsOpen[id];
  renderStructuredNotes();
  if(noteCommentsOpen[id]) requestAnimationFrame(()=>{
    const input=document.getElementById('note-comment-input-'+id);
    input?.focus();
  });
}
async function addNoteComment(id,text){
  const value=String(text||'').trim().slice(0,180);
  const n=structuredNotes.find(x=>x.id===id); if(!n||!value||!roomRef)return;
  const path=notePath(n); if(!path)return;
  await roomRef.child(path+'/comments').push({from:myRole,text:value,ts:firebase.database.ServerValue.TIMESTAMP});
  noteCommentsOpen[id]=true;
}

function openNoteMediaPreview(src, title){
  const modal=$('note-media-preview');
  const img=$('note-media-preview-img');
  const label=$('note-media-preview-title');
  if(!modal||!img)return;
  img.src=src||'';
  if(label) label.textContent=title||'Notre note';
  modal.classList.remove('hidden');
}
function closeNoteMediaPreview(){
  const modal=$('note-media-preview');
  if(modal) modal.classList.add('hidden');
}
document.addEventListener('keydown',e=>{ if(e.key==='Escape') closeNoteMediaPreview(); });
function openStructuredNote(id){
  const n=structuredNotes.find(x=>x.id===id);
  if(!n)return;
  editingNoteId=id; selectedNoteColor=n.color||'#ffffff';
  $('note-editor').classList.remove('hidden');
  $('note-editor-title').value=n.title||'Note';
  resetNoteEditorBlocks();
  const box=$('note-editor-blocks');
  let drawingSrc=null;
  let mainTextUsed=false;
  (n.blocks||[]).forEach(b=>{
    if(b.type==='drawing'){drawingSrc=b.src;return;}
    if(b.type==='text' && !mainTextUsed){
      const main=$('note-main-text');
      if(main) main.value=b.text||'';
      mainTextUsed=true;
      return;
    }
    addNoteBlock(b.type,false);
    const row=box.lastElementChild;
    if(b.type==='check'){
      row.querySelector('input[type=checkbox]').checked=!!b.checked;
      row.querySelector('.nb-text').value=b.text||'';
    } else if(b.type==='text'){
      row.querySelector('.nb-text').value=b.text||'';
    } else if(b.type==='image'){
      const input=row.querySelector('input[type=file]');
      const label=row.querySelector('.nb-file');
      if(label) label.textContent='Photo ajoutée ✓';
      if(input&&b.src) input.dataset.data=b.src;
      row.classList.add('has-photo');
    }
  });
  document.querySelectorAll('.note-color').forEach(b=>b.classList.toggle('selected',b.dataset.noteColor===selectedNoteColor));
  updateNoteEditorCardColor();
  resetNoteDrawing();
  if(drawingSrc){
    openStandaloneDrawing(drawingSrc);
  }
  $('note-delete-btn')?.classList.remove('hidden');
  const send=document.querySelector('#note-editor .primary');
  send.textContent='Enregistrer';
  send.onclick=()=>saveEditedStructuredNote(id);
}

async function saveEditedStructuredNote(id){
  const n=structuredNotes.find(x=>x.id===id); if(!n||!roomRef)return;
  const title=$('note-editor-title').value.trim()||'Note'; const blocks=collectNoteBlocks();
  if(!blocks.length){toast('Écris, ajoute une photo ou dessine quelque chose');return;}
  const path=notePath(n); if(!path)return;
  await roomRef.child(path).update({title,blocks,color:selectedNoteColor});
  closeNoteEditor();
}
async function deleteEditingNote(){
  if(!editingNoteId||!roomRef)return;
  const n=structuredNotes.find(x=>x.id===editingNoteId); const path=notePath(n);
  if(path) await roomRef.child(path).remove();
  closeNoteEditor(); toast('Note supprimée');
}
function sendNote(){ sendStructuredNote(); }
function sendDrawingNote(){
  const text=$('note-word').value.trim();
  if(!text&&!canvasDirty){toast('Dessine ou écris quelque chose');return;}
  if(!roomRef)return;
  const note={title:'Dessin',blocks:(text?[{type:'text',text}]:[]).concat(canvasDirty?[{type:'drawing',src:canvas.toDataURL('image/png')}]:[]),color:'#ffffff',from:myRole,ts:Date.now(),favorite:false};
  roomRef.child('notesInbox/'+otherRole).push().set(note);$('note-word').value='';clearCanvas();toast('Dessin envoyé à '+otherName);
}

setupNoteDrawing();
initStandaloneDrawing();
document.querySelector('.notes-stack-wrap')?.addEventListener('click',e=>{
  if(e.target.closest('.notes-add,.note-fav,.note-trash,.note-comment-toggle,.note-comment-panel,h3,.note-media'))return;
  if(e.target.closest('.stack-note')) return;
  cycleNoteStack(noteBrowseId);
});

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
  roomRef.child('chat').push({
    from: myRole,
    text,
    ts: firebase.database.ServerValue.TIMESTAMP,
    color: chatMessageColor || 'cherry'
  });
  input.value = '';
}
let chatMessageColor = 'cherry';

const chatColorNames = {
  cherry: 'Rose',
  lilac: 'Lilas',
  mint: 'Menthe',
  sky: 'Bleu doux',
  peach: 'Pêche',
  butter: 'Vanille',
  white: 'Blanc'
};

function setMessageColor(id, color) {
  if (!roomRef || !chatColorNames[color]) return;
  const msg = chatMessages.find(m => m.id === id);
  if (!msg || msg.from !== myRole) return;
  roomRef.child('chat/' + id + '/color').set(color);
  const picker = $('picker-' + id);
  if (picker) picker.classList.remove('show');
}

function setChatComposeColor(color) {
  if (!chatColorNames[color]) return;
  chatMessageColor = color;
  document.querySelectorAll('.chat-compose-color').forEach(b => b.classList.toggle('selected', b.dataset.color === color));
}

function chatBubbleColorClass(mine, color) {
  if (!mine) return 'her';
  return 'me msg-color-' + (chatColorNames[color] ? color : 'cherry');
}

function safeChatImageSrc(src) {
  return (typeof src === 'string' && /^data:image\/(?:png|jpe?g|webp|gif);base64,/i.test(src)) ? src : '';
}

function prepareChatImage(file) {
  return new Promise((resolve, reject) => {
    if (!file || !file.type || !file.type.startsWith('image/')) return reject(new Error('image'));
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error || new Error('read'));
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const max = 1280;
        const scale = Math.min(1, max / Math.max(img.naturalWidth || img.width, img.naturalHeight || img.height));
        const w = Math.max(1, Math.round((img.naturalWidth || img.width) * scale));
        const h = Math.max(1, Math.round((img.naturalHeight || img.height) * scale));
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        const c = canvas.getContext('2d');
        c.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', .78));
      };
      img.onerror = () => reject(new Error('decode'));
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

async function sendChatPhoto(event) {
  const input = event.target;
  const file = input.files && input.files[0];
  input.value = '';
  if (!file || !roomRef) return;
  try {
    const image = await prepareChatImage(file);
    const captionInput = $('chat-input');
    const caption = captionInput ? captionInput.value.trim() : '';
    await roomRef.child('chat').push({
      from: myRole,
      text: caption,
      image,
      ts: firebase.database.ServerValue.TIMESTAMP,
      color: chatMessageColor || 'cherry'
    });
    if (captionInput) captionInput.value = '';
  } catch (e) {
    toast('Impossible d’ajouter cette photo');
  }
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
  const bubbleClass = chatBubbleColorClass(mine, m.color);
  const image = safeChatImageSrc(m.image);
  const imageHtml = image ? '<img class="chat-message-image" src="' + image + '" alt="Photo envoyée" loading="lazy">' : '';
  const textHtml = m.text ? '<div class="chat-message-text">' + escapeHtml(m.text) + '</div>' : '';
  const colorPalette = mine
    ? '<div class="picker-colors" aria-label="Couleur du message">' +
      Object.keys(chatColorNames).map(c => '<button type="button" class="picker-color msg-color-swatch-' + c + ((m.color || 'cherry') === c ? ' selected' : '') + '" title="' + chatColorNames[c] + '" aria-label="' + chatColorNames[c] + '" onclick="event.stopPropagation();setMessageColor(\'' + m.id + '\',\'' + c + '\')"></button>').join('') +
      '</div>'
    : '';
  return '<div class="msg-row ' + (mine ? 'me' : '') + '">' + (mine ? '' : avatarHTML(m.from, 'sm')) +
    '<div class="bubble ' + bubbleClass + '" onclick="toggleReactionPicker(\'' + m.id + '\')">' +
    imageHtml + textHtml + (reactionText ? '<span class="reaction">' + reactionText + '</span>' : '') + '</div></div>' +
    '<div class="reaction-picker" id="picker-' + m.id + '">' +
    ['\u{1F60D}', '\u{1F602}', '\u{1F622}', '\u{1F525}', '\u{1F44D}', '\u2764\uFE0F'].map(e => '<span onclick="react(\'' + m.id + '\',\'' + e + '\')">' + e + '</span>').join('') +
    colorPalette +
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
    renderHomeSnapshots(items);
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
function renderHomeSnapshots(items) {
  const box = $('home-snapshots');
  if (!box) return;

  const rail = $('live-rail');
  const stack = rail ? rail.querySelector('.live-peek-stack') : null;

  if (!items.length) {
    box.innerHTML =
      '<button class="snapshot-card placeholder" onclick="closeLivePeek();showScreen(\'photos\')">' +
      '<span><b>En direct</b><br>Vos prochains directs apparaîtront ici.</span></button>';
    if (stack) stack.innerHTML =
      '<span class="peek-card peek-card-1 placeholder-peek"></span>' +
      '<span class="peek-card peek-card-2 placeholder-peek"></span>' +
      '<span class="peek-card peek-card-3 placeholder-peek"></span>' +
      '<span class="peek-label">En direct <b>›</b></span>';
    return;
  }

  const visible = items.slice(0, 6);
  box.innerHTML = visible.map(p => {
    const who = p.from === myRole ? 'Toi' : nameOf(p.from);
    const live = p.src === 'live';
    return '<button class="snapshot-card" onclick="closeLivePeek();showScreen(\'photos\')" aria-label="Ouvrir ce direct">' +
      '<img src="' + p.img + '" alt="" draggable="false">' +
      '<span class="snapshot-meta"><b>' + (live ? 'En direct' : who) + '</b>' +
      relativeTime(p.ts || Date.now()) + '</span></button>';
  }).join('');

  if (stack) {
    const peek = visible.slice(0,3);
    stack.innerHTML = peek.map((p,i) =>
      '<span class="peek-card peek-card-' + (i+1) + '" style="background-image:url(' +
      p.img.replace(/"/g,'&quot;') + ')"></span>'
    ).join('') + '<span class="peek-label">En direct <b>›</b></span>';
  }
}
function toggleLivePeek() {
  const rail = $('live-rail');
  if (!rail) return;
  rail.classList.toggle('open');
  if (navigator.vibrate) { try { navigator.vibrate(8); } catch (e) {} }
}
function closeLivePeek() {
  const rail = $('live-rail');
  if (rail) rail.classList.remove('open');
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
function setLocalWallpaper(dataURL) {
  if (dataURL) {
    try { localStorage.setItem('yam_wallpaper', dataURL); } catch (e) {}
  } else {
    try { localStorage.removeItem('yam_wallpaper'); } catch (e) {}
  }
}
function handleWallpaper(event) {
  const file = event.target.files[0];
  if (!file) return;
  fileToCompressedDataURL(file, 1200, 0.7).then(dataURL => {
    try {
      localStorage.setItem('yam_wallpaper', dataURL);
    } catch (e) {
      showBanner('Image trop lourde pour le fond d\u2019écran, essaie une plus petite.');
      return;
    }
    applyWallpaper(dataURL);
    if (roomRef) {
      roomRef.child('settings').update({ wallpaper: dataURL, wallpaperBy: myRole });
    }
  });
}
function resetWallpaper() {
  setLocalWallpaper(null);
  applyWallpaper(null);
  if (roomRef) roomRef.child('settings').update({ wallpaper: null, wallpaperBy: myRole });
}
function applyWallpaper(dataURL) {
  const wp = dataURL !== undefined ? dataURL : localStorage.getItem('yam_wallpaper');
  $('app').style.backgroundImage = wp ? 'url(' + wp + ')' : 'none';
}
applyWallpaper();

/* ---------- APPARENCE PARTAGÉE : fond + widgets + ordre ---------- */
function readLocalWidgetConfigs() {
  let all = {};
  try { all = JSON.parse(localStorage.getItem('yam_widget_cfg') || '{}'); } catch (e) {}
  return all && typeof all === 'object' ? all : {};
}
function persistWidgetConfigsLocal() {
  try { localStorage.setItem('yam_widget_cfg', JSON.stringify(widgetConfigs)); } catch (e) {}
}
function applyAllWidgetConfigs() {
  document.querySelectorAll('.widget[data-wid]').forEach(el => {
    const cfg = widgetConfigs[el.dataset.wid];
    applyWidgetConfig(el, cfg, true);
  });
}
function orderGroupData(container) {
  if (!container) return [];
  return Array.from(container.children)
    .sort((a, b) => (parseInt(a.style.order || '0', 10) - parseInt(b.style.order || '0', 10)))
    .map(c => Number(c.dataset.origIdx));
}
function applyOrderGroup(container, seq) {
  if (!container || !Array.isArray(seq)) return;
  const children = Array.from(container.children);
  seq.forEach((origIdx, pos) => {
    const el = children.find(c => Number(c.dataset.origIdx) === Number(origIdx));
    if (el) el.style.order = pos;
  });
}
function collectLocalOrders() {
  const out = {};
  ['home', 'calendar', 'notes', 'photos'].forEach(id => {
    const el = $(id);
    if (el) out[groupKeyFor(el)] = orderGroupData(el);
  });
  const bento = document.querySelector('.bento');
  if (bento) out[groupKeyFor(bento)] = orderGroupData(bento);
  return out;
}
function applyAllOrders(orders) {
  if (!orders || typeof orders !== 'object') return;
  ['home', 'calendar', 'notes', 'photos'].forEach(id => {
    const el = $(id);
    const key = el && groupKeyFor(el);
    if (el && key && Array.isArray(orders[key])) applyOrderGroup(el, orders[key]);
  });
  const bento = document.querySelector('.bento');
  const key = bento && groupKeyFor(bento);
  if (bento && key && Array.isArray(orders[key])) applyOrderGroup(bento, orders[key]);
}
function seedLocalAppearanceIfNeeded() {
  if (!roomRef) return;
  const localWallpaper = localStorage.getItem('yam_wallpaper');
  if (localWallpaper) {
    roomRef.child('settings/wallpaper').once('value').then(snap => {
      if (!snap.exists()) roomRef.child('settings').update({ wallpaper: localWallpaper, wallpaperBy: myRole });
    }).catch(() => {});
  }
  const localConfigs = readLocalWidgetConfigs();
  roomRef.child('widgetConfigs').once('value').then(snap => {
    if (!snap.exists() && Object.keys(localConfigs).length) roomRef.child('widgetConfigs').set(localConfigs);
  }).catch(() => {});
  const localOrders = collectLocalOrders();
  roomRef.child('widgetOrders').once('value').then(snap => {
    if (!snap.exists() && Object.keys(localOrders).length) roomRef.child('widgetOrders').set(localOrders);
  }).catch(() => {});
}
let sharedWallpaperReady = false;
function listenSharedAppearance() {
  onValue(roomRef.child('settings/wallpaper'), snap => {
    const remote = snap.val();
    if (typeof remote === 'string' && remote) {
      setLocalWallpaper(remote);
      applyWallpaper(remote);
    } else if (!remote) {
      // Au tout premier chargement, on conserve un éventuel fond local le temps
      // que seedLocalAppearanceIfNeeded() puisse le publier dans la room.
      if (sharedWallpaperReady) {
        setLocalWallpaper(null);
        applyWallpaper(null);
      } else {
        applyWallpaper();
      }
    }
    sharedWallpaperReady = true;
  });
  onValue(roomRef.child('widgetConfigs'), snap => {
    const remote = snap.val();
    if (remote && typeof remote === 'object') {
      widgetConfigs = remote;
      persistWidgetConfigsLocal();
      applyAllWidgetConfigs();
    }
  });
  onValue(roomRef.child('widgetOrders'), snap => {
    const remote = snap.val();
    if (remote && typeof remote === 'object') {
      applyAllOrders(remote);
      Object.keys(remote).forEach(key => {
        try { localStorage.setItem('yam_order_' + key, JSON.stringify(remote[key])); } catch (e) {}
      });
    }
  });
  seedLocalAppearanceIfNeeded();
}

/* ---------- NOM DE L'APPLICATION (éditable) ---------- */
function applyAppName(name) {
  const val = (name || '').trim();
  const display = val || 'You & Me.';
  const el = $('app-logo');
  if (el) {
    el.textContent = '';
    [...display].forEach(ch => {
      const s = document.createElement('span');
      s.textContent = ch;
      if (ch === '&') s.className = 'logo-accent';
      if (ch === '.') s.className = 'logo-dot';
      el.appendChild(s);
    });
  }
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

/* ---------- WIDGETS PERSONNALISABLES (appui long + déplacement libre) ---------- */
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
let dragState = null;

function defaultWidgetPosition(wid) {
  if (wid === 'home-music') return { x: 0, y: 420 };
  if (wid === 'home-live') return { x: 0, y: 92 };
  return { x: 0, y: 0 };
}
function normalizedWidgetConfig(wid, cfg) {
  const pos = defaultWidgetPosition(wid);
  return Object.assign({ scale: 100, bg: '', font: '', x: pos.x, y: pos.y }, cfg || {});
}
function loadWidgetConfigs() {
  let all = {};
  try { all = JSON.parse(localStorage.getItem('yam_widget_cfg') || '{}'); } catch (e) {}
  document.querySelectorAll('.widget[data-wid]').forEach(el => applyWidgetConfig(el, all[el.dataset.wid], true));
  return all;
}
function applyWidgetConfig(el, cfg, allowDefaults = false) {
  const wid = el.dataset.wid;
  if (!cfg && !allowDefaults) {
    el.style.removeProperty('--wscale');
    el.style.removeProperty('--wx');
    el.style.removeProperty('--wy');
    el.style.removeProperty('--live-color');
    el.style.background = '';
    el.style.fontFamily = '';
    return;
  }
  const c = normalizedWidgetConfig(wid, cfg);
  el.style.setProperty('--wscale', String((Number(c.scale) || 100) / 100));
  el.style.setProperty('--wx', String(Number(c.x) || 0) + 'px');
  el.style.setProperty('--wy', String(Number(c.y) || 0) + 'px');
  el.style.fontFamily = c.font || '';
  if (wid === 'home-live') {
    el.style.removeProperty('background');
    el.style.setProperty('--live-color', c.bg || '#171318');
  } else {
    el.style.removeProperty('--live-color');
    if (c.bg) el.style.setProperty('background', c.bg, 'important');
    else el.style.removeProperty('background');
  }
}
function saveWidgetConfig(wid, patch) {
  widgetConfigs[wid] = normalizedWidgetConfig(wid, Object.assign({}, widgetConfigs[wid] || {}, patch));
  persistWidgetConfigsLocal();
  const el = document.querySelector('.widget[data-wid="' + wid + '"]');
  if (el) applyWidgetConfig(el, widgetConfigs[wid]);
  if (roomRef) roomRef.child('widgetConfigs/' + wid).set(widgetConfigs[wid]);
}
function clampWidgetPosition(wid, x, y) {
  const isLive = wid === 'home-live';
  return {
    x: Math.max(isLive ? -180 : -220, Math.min(isLive ? 40 : 220, Number(x) || 0)),
    y: Math.max(-520, Math.min(720, Number(y) || 0))
  };
}

function groupKeyFor(container) { return container && (container.id || (container.className || 'grp').split(' ')[0]); }
function initOrderGroup(container) {
  if (!container) return;
  const children = Array.from(container.children);
  children.forEach((c, i) => { if (c.dataset.origIdx === undefined) c.dataset.origIdx = String(i); });
  const key = 'yam_order_' + groupKeyFor(container);
  let seq;
  try { seq = JSON.parse(localStorage.getItem(key)); } catch (e) { seq = null; }
  if (!Array.isArray(seq) || seq.length !== children.length) seq = children.map((_, i) => i);
  seq.forEach((origIdx, pos) => { const el = children.find(c => Number(c.dataset.origIdx) === origIdx); if (el) el.style.order = pos; });
}
function saveOrderGroup(container) {
  const children = Array.from(container.children).sort((a, b) => (parseInt(a.style.order || '0', 10) - parseInt(b.style.order || '0', 10)));
  const key = 'yam_order_' + groupKeyFor(container);
  const seq = children.map(c => Number(c.dataset.origIdx));
  try { localStorage.setItem(key, JSON.stringify(seq)); } catch (e) {}
  if (roomRef && key) roomRef.child('widgetOrders/' + groupKeyFor(container)).set(seq);
}
function moveWidgetInGroup(el, dir) {
  const container = el.parentElement; if (!container) return false;
  const children = Array.from(container.children).sort((a, b) => (parseInt(a.style.order || '0', 10) - parseInt(b.style.order || '0', 10)));
  const idx = children.indexOf(el); let t = idx + dir;
  while (t >= 0 && t < children.length && children[t].dataset.pinned === 'true') t += dir;
  if (t < 0 || t >= children.length) return false;
  const other = children[t], tmp = el.style.order; el.style.order = other.style.order; other.style.order = tmp; saveOrderGroup(container); return true;
}

function openWidgetEditor(el) {
  if(!el || !el.dataset.wid) return;
  currentEditWid = el.dataset.wid;
  const cfg = normalizedWidgetConfig(currentEditWid, widgetConfigs[currentEditWid]);
  $('we-title').textContent = el.dataset.wname || 'Widget';
  $('we-scale').value = Math.max(60, Math.min(150, Number(cfg.scale) || 100));
  renderSwatches(cfg.bg || ''); renderFonts(cfg.font || '');
  $('widget-editor').classList.remove('hidden');
}
function closeWidgetEditor() { $('widget-editor').classList.add('hidden'); currentEditWid = null; }
function onWidgetScaleInput(e) { if (currentEditWid) saveWidgetConfig(currentEditWid, { scale: Number(e.target.value) }); }
function onWidgetPositionInput(e, axis) {
  if (!currentEditWid) return;
  const pos = clampWidgetPosition(currentEditWid, axis === 'x' ? Number(e.target.value) : (widgetConfigs[currentEditWid]?.x || 0), axis === 'y' ? Number(e.target.value) : (widgetConfigs[currentEditWid]?.y || 0));
  saveWidgetConfig(currentEditWid, pos);
}
function renderSwatches(current) {
  const box = $('we-swatches');
  let html = COLOR_OPTIONS.map(c => '<button type="button" class="we-swatch' + (current === c ? ' selected' : '') + '" style="background:' + c + (c === '#FFFFFF' ? ';box-shadow:0 0 0 1px var(--line)' : '') + '" data-c="' + c + '" aria-label="' + c + '"></button>').join('');
  html += '<button type="button" class="we-swatch transp' + (current === 'transparent' ? ' selected' : '') + '" data-c="transparent" aria-label="Transparent"></button>';
  html += '<label class="we-swatch custom" aria-label="Couleur personnalisée">🎨<input type="color" id="we-custom-color" value="' + (current && current.charAt(0) === '#' ? current : '#ffffff') + '"></label>';
  box.innerHTML = html;
}
function renderFonts(current) {
  const box = $('we-fonts');
  box.innerHTML = FONT_OPTIONS.map((f, i) => '<button type="button" class="we-font' + (current === f.css ? ' selected' : '') + '" data-idx="' + i + '" style="' + (f.css ? 'font-family:' + f.css : '') + '">' + f.label + '</button>').join('');
}
function pickWidgetColor(c) { if (currentEditWid) { saveWidgetConfig(currentEditWid, { bg: c }); renderSwatches(c); } }
function pickWidgetFont(css) { if (currentEditWid) { saveWidgetConfig(currentEditWid, { font: css }); renderFonts(css); } }
function moveCurrentWidget(dir) { if (!currentEditWid) return; const el = document.querySelector('.widget[data-wid="' + currentEditWid + '"]'); if (el) moveWidgetInGroup(el, dir); }
function resetCurrentWidget() {
  if (!currentEditWid) return;
  const wid = currentEditWid;
  delete widgetConfigs[wid];
  persistWidgetConfigsLocal();
  const el = document.querySelector('.widget[data-wid="' + wid + '"]');
  if (el) applyWidgetConfig(el, null, true);
  if (roomRef) roomRef.child('widgetConfigs/' + wid).remove();
  closeWidgetEditor();
}
function renderWidgetEditHandles(){
  document.querySelectorAll('.widget[data-wid]').forEach(w=>{
    let btn=w.querySelector(':scope > .widget-edit-handle');
    if(!editMode){
      btn?.remove();
      return;
    }
    if(!btn){
      btn=document.createElement('button');
      btn.type='button';
      btn.className='widget-edit-handle';
      btn.setAttribute('aria-label','Modifier '+(w.dataset.wname||'ce widget'));
      btn.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20h9"></path><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"></path></svg>';
      btn.addEventListener('pointerdown',e=>{e.stopPropagation();});
      btn.addEventListener('click',e=>{
        e.preventDefault();e.stopPropagation();
        openWidgetEditor(w);
      });
      w.appendChild(btn);
    }
  });
}
function enterEditMode() {
  editMode = true; document.body.classList.add('edit-mode');
  if (!$('edit-done-btn')) { const b = document.createElement('button'); b.id = 'edit-done-btn'; b.className = 'edit-done'; b.textContent = 'Terminé'; document.body.appendChild(b); }
  renderWidgetEditHandles();
}
function exitEditMode() {
  if (!editMode) return;
  editMode = false; dragState = null;
  document.body.classList.remove('edit-mode');
  closeWidgetEditor();
  renderWidgetEditHandles();
}

function startWidgetDrag(e, w) {
  // Les widgets sont désormais verrouillés contre tout déplacement par geste.
  // Leur position ne peut être modifiée que via les contrôles explicites du mode édition.
  return;
}
function moveWidgetDrag(e) {
  if (!dragState) return;
  const dx = e.clientX - dragState.startX, dy = e.clientY - dragState.startY;
  if (Math.abs(dx) + Math.abs(dy) > 4) dragState.moved = true;
  const pos = clampWidgetPosition(dragState.wid, dragState.x + dx, dragState.y + dy);
  saveWidgetConfig(dragState.wid, pos);
  if (currentEditWid === dragState.wid) { renderWidgetEditHandles(); }
}
function endWidgetDrag() { dragState = null; }

function initWidgetSystem() {
  ['home', 'calendar', 'notes', 'photos'].forEach(id => initOrderGroup($(id)));
  initOrderGroup(document.querySelector('.bento'));
  widgetConfigs = loadWidgetConfigs();

  $('we-swatches').addEventListener('click', e => { const b = e.target.closest('.we-swatch'); if (b && b.dataset.c) pickWidgetColor(b.dataset.c); });
  $('we-swatches').addEventListener('input', e => { if (e.target.id === 'we-custom-color') pickWidgetColor(e.target.value); });
  $('we-fonts').addEventListener('click', e => { const b = e.target.closest('.we-font'); if (b) pickWidgetFont(FONT_OPTIONS[Number(b.dataset.idx)].css); });

  let pressTimer = null, pressStart = null, suppressClickOn = null;
  const LONG_PRESS_MS = 480;
  const pinch = {wid:null, pts:new Map(), base:100, dist:0};
  document.addEventListener('pointerdown', e => {
    const w = e.target.closest('.widget');
    if (editMode) {
      // Aucun appui ou glissement ne déplace un widget.
      // L'édition passe uniquement par le bouton crayon / les contrôles dédiés.
      pinch.pts.delete(e.pointerId);
      return;
    }
    if (!w) { pressStart = null; return; }
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    pressStart = { x: e.clientX, y: e.clientY, w };
    clearTimeout(pressTimer);
    pressTimer = setTimeout(() => {
      if (!pressStart) return;
      enterEditMode();
      if (navigator.vibrate) { try { navigator.vibrate(12); } catch (e) {} }
      suppressClickOn = pressStart.w; pressStart = null;
    }, LONG_PRESS_MS);
  }, { passive: false });
  document.addEventListener('pointermove', e => {
    if (e.pointerType==='touch') return;
    if (dragState) { moveWidgetDrag(e); return; }
    if (pressStart && (Math.abs(e.clientX - pressStart.x) > 10 || Math.abs(e.clientY - pressStart.y) > 10)) { clearTimeout(pressTimer); pressStart = null; }
  }, { passive: false });
  document.addEventListener('pointerup', e => { pinch.pts.delete(e.pointerId); if(!pinch.pts.size){pinch.wid=null;pinch.dist=0;} clearTimeout(pressTimer); pressStart = null; endWidgetDrag(); }, { passive: true });
  document.addEventListener('pointercancel', e => { pinch.pts.delete(e.pointerId); if(!pinch.pts.size){pinch.wid=null;pinch.dist=0;} clearTimeout(pressTimer); pressStart = null; endWidgetDrag(); }, { passive: true });

  document.addEventListener('click', e => {
    if (e.target.closest('#widget-editor')) return;
    if (e.target.closest('.widget-edit-handle')) return;
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
const obRoomInput = $('ob-room');
if (obRoomInput && !obRoomInput.value) obRoomInput.value = '18052025';

// Le profil Soso est celui affiché par défaut sur l'écran de connexion.
// Les handlers sont attachés en JS en plus des onclick HTML pour être robustes
// sur Safari/iOS et éviter un clic « mort » après une restauration de page.
const obRoleA = $('role-a');
const obRoleB = $('role-b');
const obStart = document.querySelector('#onboarding button.primary');
if (obRoleA) obRoleA.addEventListener('click', () => pickRole('a'));
if (obRoleB) obRoleB.addEventListener('click', () => pickRole('b'));
if (obStart) obStart.addEventListener('click', finishOnboarding);
pickRole(selectedRole || 'a');

applyNames();
if (myRole && room) {
  $('onboarding').classList.add('hidden');
  initFirebase();
} else {
  $('onboarding').classList.remove('hidden');
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    try {
      const reg = await navigator.serviceWorker.register('./sw.js', { updateViaCache: 'none' });
      await reg.update();
    } catch (e) {}
  });
}
