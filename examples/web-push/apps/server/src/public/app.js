const arrayBufferToBase64Url = (buffer) => {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

let feedCount = 0;
const cards = new Map();

const showFeed = () => {
  document.getElementById('feed').style.display = 'block';
};

const addCard = (notification) => {
  const list = document.getElementById('feed-list');
  const empty = document.getElementById('feed-empty');
  if (empty) empty.remove();

  feedCount += 1;
  document.getElementById('feed-count').textContent = feedCount;

  const id = 'card-' + Date.now();
  const card = document.createElement('div');
  card.className = 'feed-card';
  card.id = id;
  card.innerHTML =
    '<div class="feed-card-title">' +
    escapeHtml(notification.title || 'Push') +
    '</div>' +
    '<div class="feed-card-body">' +
    escapeHtml(notification.body || '') +
    '</div>' +
    '<div class="feed-card-time">' +
    new Date().toLocaleTimeString() +
    '</div>' +
    '<div class="feed-card-clicked-label">Opened from notification</div>';

  list.prepend(card);
  cards.set(notification.title + '|' + notification.body, id);
};

const markClicked = (notification) => {
  const key =
    ((notification && notification.title) || '') +
    '|' +
    ((notification && notification.body) || '');
  const id = cards.get(key);
  if (!id) return;
  const card = document.getElementById(id);
  if (card) card.classList.add('clicked');
};

const escapeHtml = (str) =>
  str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const connectSSE = () => {
  const source = new EventSource('/api/events');
  source.addEventListener('notification', (event) => {
    addCard(JSON.parse(event.data));
  });
};

const pushChannel = new BroadcastChannel('betternotify-push');
pushChannel.addEventListener('message', (event) => {
  if (event.data.type === 'notification-clicked') {
    markClicked(event.data.notification);
  }
});

const onSubscribed = () => {
  document.getElementById('subscribe-btn').disabled = true;
  document.getElementById('status').textContent = 'Subscribed.';
  document.getElementById('send-section').style.display = 'block';
  showFeed();
  connectSSE();
};

const init = async () => {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;

  const reg = await navigator.serviceWorker.register('/sw.js');
  await navigator.serviceWorker.ready;
  const res = await fetch('/api/vapid-public-key');
  const { publicKey } = await res.json();

  const existing = await reg.pushManager.getSubscription();
  if (!existing) return;

  const existingKey = existing.options && existing.options.applicationServerKey;
  const keyChanged = !existingKey || arrayBufferToBase64Url(existingKey) !== publicKey;

  if (keyChanged) {
    await existing.unsubscribe();
    const subscription = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: publicKey,
    });
    await fetch('/api/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(subscription),
    });
  } else {
    await fetch('/api/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(existing),
    });
  }

  onSubscribed();
};

window.subscribe = async () => {
  const btn = document.getElementById('subscribe-btn');
  const status = document.getElementById('status');

  btn.disabled = true;
  status.textContent = 'Registering service worker…';

  const reg = await navigator.serviceWorker.register('/sw.js');
  await navigator.serviceWorker.ready;
  const res = await fetch('/api/vapid-public-key');
  const { publicKey } = await res.json();

  status.textContent = 'Requesting permission…';

  const subscription = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: publicKey,
  });

  await fetch('/api/subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(subscription),
  });

  onSubscribed();
};

window.sendPush = async () => {
  const title = document.getElementById('title').value;
  const body = document.getElementById('body').value;
  const result = document.getElementById('result');

  result.textContent = 'Sending…';

  const res = await fetch('/api/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, body }),
  });

  const data = await res.json();
  result.textContent = data.ok
    ? 'Sent! (messageId: ' + data.messageId + ')'
    : 'Error: ' + data.error;
};

init();
