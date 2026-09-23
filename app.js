/* ---------- INIT ---------- */
let myRole = localStorage.getItem('yam_role');
let myName = localStorage.getItem('yam_name');
let room = localStorage.getItem('yam_room');
let otherRole = myRole === 'a' ? 'b' : 'a';

let app, db, roomRef;
let selectedRole = null;
let currentMonthDate = new Date();
let selectedDateKey = null;
let calendarEvents = {};
let currentColor = '#D6295C';
let currentWidth = 2;
let currentAlpha = 1;
let drawing = false;
let lastX = 0, lastY = 0;
let chatLoaded = false, moodLoaded = false, notesLoaded = false, photosLoaded = false;
let notifOn = localStorage.getItem('yam_notif') === 'on';

function initFirebase() {
  app = firebase.initializeApp(firebaseConfig);
  db = firebase.database();
  roomRef = db.ref('rooms/' + room);
  setupPresence();
  listenPartnerProfile();
  listenMusic();
  listenAnniversary();
  listenCalendar();
  listenNotes();
  listenChat();
  listenPhotos();
  restoreMyProfileUI();
}

/* ---------- ONBOARDING ---------- */
function pickRole(r) {
  selectedRole = r;
  document.getElementById('role-a').classList.toggle('selected', r === 'a');
  document.getElementById('role-b').classList.toggle('selected', r === 'b');
}

function finishOnboarding() {
  const name = document.getElementById('ob-name').value.trim();
  const roomVal = document.getElementById('ob-room').value.trim().toLowerCase();
  if (!name || !selectedRole || !roomVal) {
    alert('Remplis ton prénom, ton rôle et le code secret du couple 🙂');
    return;
  }
  localStorage.setItem('yam_name', name);
  localStorage.setItem('yam_role', selectedRole);
  localStorage.setItem('yam_room', roomVal);
  myName = name; myRole = selectedRole; room = roomVal;
  otherRole = myRole === 'a' ? 'b' : 'a';
  document.getElementById('onboarding').classList.add('hidden');
  initFirebase();
}

if (myRole && myName && room) {
  document.getElementById('onboarding').classList.add('hidden');
} else {
  document.getElementById('onboarding').classList.remove('hidden');
}

/* ---------- NAV ---------- */
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  document.querySelector(`.nav-btn[onclick="showScreen('${id}')"]`).classList.add('active');
  if (id === 'calendar') renderCalendar();
  if (id === 'chat') scrollChatToBottom();
}

/* ---------- PRESENCE ---------- */
function setupPresence() {
  const myRef = roomRef.child('profiles/' + myRole);
  myRef.child('name').set(myName);
  myRef.child('online').set(true);
  myRef.child('lastSeen').set(firebase.database.ServerValue.TIMESTAMP);
  myRef.child('online').onDisconnect().set(false);
  myRef.child('lastSeen').onDisconnect().set(firebase.database.ServerValue.TIMESTAMP);
}

function listenPartnerProfile() {
  const otherRef = roomRef.child('profiles/' + otherRole);
  otherRef.on('value', snap => {
    const data = snap.val() || {};
    const avatar = document.getElementById('partner-avatar');
    const statusText = document.getElementById('partner-status');
    avatar.classList.toggle('on', !!data.online);
    avatar.classList.toggle('off', !data.online);
    statusText.textContent = data.online ? 'Elle est en ligne' : 'Hors ligne';
    document.getElementById('partner-name-label').textContent = data.name ? ('MOOD DE ' + data.name.toUpperCase()) : 'SON MOOD';
    document.getElementById('partner-mood').textContent = data.mood || '🤍';
    document.getElementById('partner-mood-time').textContent = data.moodTs ? relativeTime(data.moodTs) : '';
    document.getElementById('her-avatar-preview').innerHTML = data.photo ? `<img src="${data.photo}">` : '';
    if (moodLoaded && data.mood && data._lastFrom !== myRole) {
      notify('Nouveau mood', (data.name || 'Elle') + ' se sent ' + data.mood);
    }
    moodLoaded = true;
  });

  const myRef = roomRef.child('profiles/' + myRole);
  myRef.on('value', snap => {
    const data = snap.val() || {};
    document.querySelectorAll('.mood-bubble').forEach(b => b.classList.toggle('selected', b.dataset.mood === data.mood));
    document.querySelectorAll('.status-chip').forEach(c => c.classList.toggle('active', c.dataset.status === data.status));
    document.getElementById('my-avatar-preview').innerHTML = data.photo ? `<img src="${data.photo}">` : '';
  });
}

function restoreMyProfileUI() {
  document.querySelectorAll('.mood-bubble').forEach(b => {
    b.addEventListener('click', () => {
      roomRef.child('profiles/' + myRole).update({ mood: b.dataset.mood, moodTs: Date.now() });
    });
  });
  document.querySelectorAll('.status-chip').forEach(c => {
    c.addEventListener('click', () => {
      roomRef.child('profiles/' + myRole).update({ status: c.dataset.status });
    });
  });
}

function relativeTime(ts) {
  const diff = Math.floor((Date.now() - ts) / 60000);
  if (diff < 1) return "à l'instant";
  if (diff < 60) return 'il y a ' + diff + ' min';
  const h = Math.floor(diff / 60);
  if (h < 24) return 'il y a ' + h + 'h';
  return 'il y a ' + Math.floor(h / 24) + 'j';
}

/* ---------- NOTIFICATIONS ---------- */
function toggleNotifications() {
  const btn = document.getElementById('notif-toggle');
  if (!notifOn) {
    Notification.requestPermission().then(perm => {
      if (perm === 'granted') {
        notifOn = true;
        localStorage.setItem('yam_notif', 'on');
        btn.classList.remove('off');
      }
    });
  } else {
    notifOn = false;
    localStorage.setItem('yam_notif', 'off');
    btn.classList.add('off');
  }
}
if (notifOn) document.getElementById('notif-toggle')?.classList.remove('off');

function notify(title, body) {
  if (notifOn && document.hidden && Notification.permission === 'granted') {
    new Notification(title, { body, icon: 'icon-192.png' });
  }
}

/* ---------- MUSIC ---------- */
function shareMusic() {
  const input = document.getElementById('music-input');
  const url = input.value.trim();
  if (!url) return;
  roomRef.child('music').set({ url, from: myRole, ts: Date.now() });
  input.value = '';
}
function listenMusic() {
  roomRef.child('music').on('value', snap => {
    const data = snap.val();
    const vinyl = document.getElementById('vinyl');
    if (data && data.url) {
      document.getElementById('music-title').textContent = data.url;
      document.getElementById('music-subtitle').textContent = 'Partagé ' + relativeTime(data.ts);
      vinyl.classList.add('spin');
    } else {
      document.getElementById('music-title').textContent = "Rien de partagé pour l'instant";
      document.getElementById('music-subtitle').textContent = 'Envoie-lui un son ✨';
      vinyl.classList.remove('spin');
    }
  });
}

/* ---------- CALENDAR / ANNIVERSARY ---------- */
function listenAnniversary() {
  const input = document.getElementById('anniversary-date');
  roomRef.child('settings/anniversaryDate').on('value', snap => {
    const val = snap.val() || '2025-05-18';
    input.value = val;
    renderCountdown(val);
  });
  input.addEventListener('change', () => {
    roomRef.child('settings/anniversaryDate').set(input.value);
  });
}

function renderCountdown(dateStr) {
  const anniv = new Date(dateStr + 'T00:00:00');
  const today = new Date();
  today.setHours(0,0,0,0);
  let next = new Date(today.getFullYear(), anniv.getMonth(), anniv.getDate());
  if (next < today) next = new Date(today.getFullYear() + 1, anniv.getMonth(), anniv.getDate());
  const daysLeft = Math.round((next - today) / 86400000);
  const yearsAtNext = next.getFullYear() - anniv.getFullYear();
  const daysSince = Math.round((today - anniv) / 86400000);

  document.getElementById('countdown-days').textContent = daysLeft;
  document.getElementById('next-anniv-date').textContent = next.toLocaleDateString('fr-FR', { day:'numeric', month:'long', year:'numeric' });
  document.getElementById('next-anniv-sub').textContent = yearsAtNext + ' an' + (yearsAtNext>1?'s':'') + ' ensemble ce jour-là';
  document.getElementById('since-pill').textContent = 'Ensemble depuis ' + daysSince + ' jours';

  const circumference = 2 * Math.PI * 52;
  const progress = Math.max(0, Math.min(1, 1 - daysLeft / 365));
  const arc = document.getElementById('countdown-arc');
  arc.setAttribute('stroke-dasharray', circumference);
  arc.setAttribute('stroke-dashoffset', circumference * (1 - progress));
}

function listenCalendar() {
  roomRef.child('calendar').on('value', snap => {
    calendarEvents = snap.val() || {};
    renderCalendar();
  });
}

function changeMonth(delta) {
  currentMonthDate.setMonth(currentMonthDate.getMonth() + delta);
  renderCalendar();
}

function renderCalendar() {
  const grid = document.getElementById('cal-grid');
  const label = document.getElementById('cal-month-label');
  const year = currentMonthDate.getFullYear();
  const month = currentMonthDate.getMonth();
  label.textContent = currentMonthDate.toLocaleDateString('fr-FR', { month:'long', year:'numeric' });

  let html = ['L','M','M','J','V','S','D'].map(d => `<div class="dow">${d}</div>`).join('');
  const firstDay = new Date(year, month, 1);
  let startOffset = (firstDay.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const todayKey = formatKey(new Date());

  for (let i = 0; i < startOffset; i++) html += '<div></div>';
  for (let d = 1; d <= daysInMonth; d++) {
    const dateObj = new Date(year, month, d);
    const key = formatKey(dateObj);
    let cls = 'day';
    if (key === todayKey) cls += ' today';
    if (key === selectedDateKey) cls += ' selected';
    if (calendarEvents[key]) cls += ' has-event';
    html += `<div class="${cls}" onclick="selectDay('${key}')">${d}</div>`;
  }
  grid.innerHTML = html;
  if (!selectedDateKey) selectDay(todayKey);
}

function formatKey(d) {
  return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
}

function selectDay(key) {
  selectedDateKey = key;
  const d = new Date(key + 'T00:00:00');
  document.getElementById('day-detail-title').textContent = d.toLocaleDateString('fr-FR', { weekday:'long', day:'numeric', month:'long' });
  document.getElementById('annot-input').value = (calendarEvents[key] && calendarEvents[key].note) || '';
  renderCalendar();
}

function saveAnnotation() {
  const val = document.getElementById('annot-input').value.trim();
  if (!selectedDateKey) return;
  roomRef.child('calendar/' + selectedDateKey).set(val ? { note: val, by: myRole } : null);
}

/* ---------- NOTES (dessin) ---------- */
const canvas = document.getElementById('draw-canvas');
const ctx = canvas.getContext('2d');

function resizeCanvas() {
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width * 2;
  canvas.height = rect.height * 2;
  ctx.scale(2, 2);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, rect.width, rect.height);
}
window.addEventListener('resize', resizeCanvas);
setTimeout(resizeCanvas, 50);

function getPos(e) {
  const rect = canvas.getBoundingClientRect();
  const t = e.touches ? e.touches[0] : e;
  return { x: t.clientX - rect.left, y: t.clientY - rect.top };
}
canvas.addEventListener('pointerdown', e => { drawing = true; const p = getPos(e); lastX = p.x; lastY = p.y; });
canvas.addEventListener('pointermove', e => {
  if (!drawing) return;
  const p = getPos(e);
  ctx.globalAlpha = currentAlpha;
  ctx.strokeStyle = currentColor;
  ctx.lineWidth = currentWidth;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(lastX, lastY);
  ctx.lineTo(p.x, p.y);
  ctx.stroke();
  lastX = p.x; lastY = p.y;
});
window.addEventListener('pointerup', () => drawing = false);

document.getElementById('tool-row').addEventListener('click', e => {
  const btn = e.target.closest('.tool');
  if (!btn) return;
  document.querySelectorAll('.tool').forEach(t => t.classList.remove('active'));
  btn.classList.add('active');
  currentWidth = parseFloat(btn.dataset.width);
  currentAlpha = parseFloat(btn.dataset.alpha);
});
document.getElementById('color-row').addEventListener('click', e => {
  const btn = e.target.closest('.swatch');
  if (!btn) return;
  document.querySelectorAll('.swatch').forEach(s => s.classList.remove('selected'));
  btn.classList.add('selected');
  currentColor = btn.dataset.color;
});
function clearCanvas() {
  const rect = canvas.getBoundingClientRect();
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, rect.width, rect.height);
}

function sendNote() {
  const text = document.getElementById('note-word').value.trim();
  const img = canvas.toDataURL('image/jpeg', 0.6);
  roomRef.child('notes/' + myRole).set({ text, img, ts: Date.now() });
  document.getElementById('note-word').value = '';
}

function listenNotes() {
  roomRef.child('notes/' + otherRole).on('value', snap => {
    const data = snap.val();
    const icon = document.getElementById('her-note-preview-icon');
    const preview = document.getElementById('her-note-preview');
    if (data) {
      icon.innerHTML = data.img ? `<img src="${data.img}">` : '💌';
      preview.textContent = data.text || '';
      if (notesLoaded) notify('Nouvelle note', 'Elle a partagé une note');
    }
    notesLoaded = true;
  });
}

/* ---------- CHAT ---------- */
function sendMessage() {
  const input = document.getElementById('chat-input');
  const text = input.value.trim();
  if (!text) return;
  roomRef.child('chat').push({ from: myRole, text, ts: firebase.database.ServerValue.TIMESTAMP });
  input.value = '';
}

function listenChat() {
  roomRef.child('chat').limitToLast(100).on('value', snap => {
    const messages = [];
    snap.forEach(child => messages.push({ id: child.key, ...child.val() }));
    const container = document.getElementById('chat-scroll');
    container.innerHTML = messages.map(m => renderMessage(m)).join('');
    if (chatLoaded) {
      const last = messages[messages.length - 1];
      if (last && last.from !== myRole) notify('Nouveau message', last.text);
    }
    chatLoaded = true;
    scrollChatToBottom();
  });
}

function renderMessage(m) {
  const mine = m.from === myRole;
  const reactions = m.reactions || {};
  const reactionText = Object.values(reactions).join('');
  return `
    <div class="msg-row ${mine ? 'me' : ''}">
      <div class="bubble ${mine ? 'me' : 'her'}" onclick="toggleReactionPicker('${m.id}')">
        ${escapeHtml(m.text)}
        ${reactionText ? `<span class="reaction">${reactionText}</span>` : ''}
      </div>
    </div>
    <div class="reaction-picker" id="picker-${m.id}">
      ${['😍','😂','😢','🔥','👍','❤️'].map(e => `<span onclick="react('${m.id}','${e}')">${e}</span>`).join('')}
    </div>`;
}

function toggleReactionPicker(id) {
  document.querySelectorAll('.reaction-picker').forEach(p => { if (p.id !== 'picker-' + id) p.classList.remove('show'); });
  document.getElementById('picker-' + id).classList.toggle('show');
}
function react(id, emoji) {
  roomRef.child('chat/' + id + '/reactions/' + myRole).set(emoji);
  document.getElementById('picker-' + id).classList.remove('show');
}
function escapeHtml(str) {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}
function scrollChatToBottom() {
  const c = document.getElementById('chat-scroll');
  c.scrollTop = c.scrollHeight;
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
  if (!file) return;
  const dataURL = await fileToCompressedDataURL(file, 900, 0.6);
  roomRef.child('photos').push({ from: myRole, img: dataURL, ts: firebase.database.ServerValue.TIMESTAMP, likes: {}, comments: [] });
  event.target.value = '';
}

function listenPhotos() {
  roomRef.child('photos').limitToLast(30).on('value', snap => {
    const items = [];
    snap.forEach(child => items.push({ id: child.key, ...child.val() }));
    items.reverse();
    document.getElementById('photos-feed').innerHTML = items.map(renderPhoto).join('');
    if (photosLoaded) {
      const newest = items[0];
      if (newest && newest.from !== myRole && Date.now() - newest.ts < 5000) notify('Nouvelle photo', 'Elle a partagé une photo');
    }
    photosLoaded = true;
  });
}

function renderPhoto(p) {
  const liked = p.likes && p.likes[myRole];
  const comments = p.comments || [];
  return `
    <div class="feed-item">
      <div class="feed-photo"><img src="${p.img}"><div class="feed-meta"><span>${relativeTime(p.ts || Date.now())}</span></div></div>
      <div class="feed-actions">
        <button class="heart-icon" onclick="toggleLike('${p.id}', ${!!liked})">${liked ? '❤️' : '🤍'}</button>
        <span style="font-size:12px;font-weight:700;color:var(--ink-soft);">${comments.length} commentaire${comments.length>1?'s':''}</span>
      </div>
      <div class="comments">
        ${comments.map(c => `<div class="comment"><b>${c.from === myRole ? 'Toi' : 'Elle'}</b> ${escapeHtml(c.text)}</div>`).join('')}
      </div>
      <div class="comment-input-row">
        <input placeholder="Ajouter un commentaire" onkeydown="if(event.key==='Enter')addComment('${p.id}', this)">
      </div>
    </div>`;
}

function toggleLike(id, wasLiked) {
  roomRef.child('photos/' + id + '/likes/' + myRole).set(!wasLiked);
}
function addComment(id, input) {
  const text = input.value.trim();
  if (!text) return;
  roomRef.child('photos/' + id + '/comments').transaction(list => {
    list = list || [];
    list.push({ from: myRole, text, ts: Date.now() });
    return list;
  });
  input.value = '';
}

/* ---------- SETTINGS ---------- */
async function handleProfilePhoto(event) {
  const file = event.target.files[0];
  if (!file) return;
  const dataURL = await fileToCompressedDataURL(file, 240, 0.7);
  roomRef.child('profiles/' + myRole + '/photo').set(dataURL);
}

function handleWallpaper(event) {
  const file = event.target.files[0];
  if (!file) return;
  fileToCompressedDataURL(file, 1200, 0.7).then(dataURL => {
    localStorage.setItem('yam_wallpaper', dataURL);
    applyWallpaper();
  });
}
function resetWallpaper() {
  localStorage.removeItem('yam_wallpaper');
  applyWallpaper();
}
function applyWallpaper() {
  const wp = localStorage.getItem('yam_wallpaper');
  document.getElementById('app').style.backgroundImage = wp ? `url(${wp})` : 'none';
}
applyWallpaper();

/* ---------- START ---------- */
if (myRole && myName && room) {
  initFirebase();
}

/* register service worker */
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(()=>{}));
}
