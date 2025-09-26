const STORAGE_KEYS = {
  ledger: 'patrolmate-ledger',
  session: 'patrolmate-session',
  results: 'patrolmate-results'
};

const form = document.querySelector('#patrol-form');
const attributeSelect = document.querySelector('#patrol-attribute');
const loadButton = form.querySelector('button[type="submit"]');
const patrolSection = document.querySelector('#patrol-section');
const patrolMeta = document.querySelector('#patrol-meta');
const patrolList = document.querySelector('#patrol-list');
const resetButton = document.querySelector('#reset-session');
const syncButton = document.querySelector('#sync-button');
const syncStatus = document.querySelector('#sync-status');
const captureDialog = document.querySelector('#capture-dialog');
const captureInput = document.querySelector('#capture-input');
const itemTemplate = document.querySelector('#patrol-item-template');
const dateInput = document.querySelector('#patrol-date');

const OFFLINE_MESSAGE = '現在オフラインのため同期できません。';

let ledger = { attributes: [] };
let resultsStore = loadStoredResults();
let currentSessionId = null;
let currentSession = null;
let currentAttribute = null;
let activeCaptureItemId = null;

document.addEventListener('DOMContentLoaded', init);

async function init() {
  registerServiceWorker();
  setDefaultDate();
  await initialiseLedger();
  bindEvents();
  restoreSession();
  updateNetworkStatusHint();
}

function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('service-worker.js').catch((error) => {
      console.error('Service Worker registration failed', error);
    });
  }
}

function setDefaultDate() {
  dateInput.valueAsDate = new Date();
}

async function initialiseLedger() {
  ledger = await loadLedger();
  populateAttributes(ledger);
}

function bindEvents() {
  form.addEventListener('submit', handleSessionSubmit);
  resetButton.addEventListener('click', handleReset);
  syncButton.addEventListener('click', handleSync);
  captureDialog.addEventListener('close', handleCaptureClose);
  window.addEventListener('online', updateNetworkStatusHint);
  window.addEventListener('offline', updateNetworkStatusHint);
}

async function loadLedger() {
  const cached = readJson(STORAGE_KEYS.ledger);
  try {
    const response = await fetch('data/ledger.json', { cache: 'no-store' });
    if (!response.ok) {
      throw new Error(`Ledger request failed: ${response.status}`);
    }
    const data = await response.json();
    writeJson(STORAGE_KEYS.ledger, data);
    return data;
  } catch (error) {
    console.warn('巡回台帳の取得に失敗しました。キャッシュにフォールバックします。', error);
    if (cached) {
      return cached;
    }
    return { attributes: [] };
  }
}

function populateAttributes(ledgerData) {
  attributeSelect.innerHTML = '';
  const placeholder = document.createElement('option');
  placeholder.value = '';
  placeholder.textContent = '選択してください';
  attributeSelect.appendChild(placeholder);

  const attributes = Array.isArray(ledgerData?.attributes)
    ? ledgerData.attributes
    : [];

  attributes.forEach((attribute) => {
    const option = document.createElement('option');
    option.value = attribute.id;
    option.textContent = attribute.label;
    attributeSelect.appendChild(option);
  });

  const hasAttributes = attributes.length > 0;
  attributeSelect.disabled = !hasAttributes;
  loadButton.disabled = !hasAttributes;

  if (!hasAttributes) {
    placeholder.textContent = '台帳データが利用できません';
  }
}

function handleSessionSubmit(event) {
  event.preventDefault();
  const operator = form.operator.value.trim();
  const date = form['patrol-date'].value;
  const attributeId = form['patrol-attribute'].value;

  if (!operator || !date || !attributeId) {
    return;
  }

  const session = { operator, date, attributeId };
  localStorage.setItem(STORAGE_KEYS.session, JSON.stringify(session));
  renderPatrolList(session);
}

function handleReset() {
  currentSessionId = null;
  currentSession = null;
  currentAttribute = null;
  activeCaptureItemId = null;
  patrolSection.hidden = true;
  patrolList.innerHTML = '';
  patrolMeta.innerHTML = '';
  localStorage.removeItem(STORAGE_KEYS.session);
  form.reset();
  attributeSelect.value = '';
  setDefaultDate();
  if (syncStatus.textContent !== OFFLINE_MESSAGE) {
    syncStatus.textContent = '';
  }
}

function restoreSession() {
  const session = getStoredSession();
  if (!session) {
    return;
  }

  form.operator.value = session.operator;
  form['patrol-date'].value = session.date;
  form['patrol-attribute'].value = session.attributeId;
  renderPatrolList(session);
}

function renderPatrolList(session) {
  const attribute = ledger.attributes.find((item) => item.id === session.attributeId);
  if (!attribute) {
    patrolSection.hidden = true;
    return;
  }

  currentSession = { ...session };
  currentAttribute = attribute;
  currentSessionId = makeSessionId(session);

  const progress = persistSessionMetadata(session, attribute);

  patrolList.innerHTML = '';
  attribute.items.forEach((item) => {
    const clone = itemTemplate.content.cloneNode(true);
    const root = clone.querySelector('.patrol-item');
    root.dataset.itemId = item.id;

    clone.querySelector('.item-title').textContent = item.title;
    clone.querySelector('.item-description').textContent = item.description;
    clone.querySelector('.item-code').textContent = `コード: ${item.code}`;

    const checkbox = clone.querySelector('input[type="checkbox"]');
    const captureButton = clone.querySelector('.capture');
    const saved = progress.items[item.id] ?? {};
    checkbox.checked = Boolean(saved.completed);

    if (saved.capture) {
      setCaptureInfo(root, saved.capture);
    }

    checkbox.addEventListener('change', () => {
      updateItemResult(item.id, { completed: checkbox.checked });
    });

    captureButton.addEventListener('click', () => {
      openCaptureDialog(item.id, saved.capture ?? '');
    });

    patrolList.appendChild(clone);
  });

  renderSessionMeta(session, attribute, progress);
  patrolSection.hidden = false;
  if (syncStatus.textContent !== OFFLINE_MESSAGE) {
    syncStatus.textContent = '';
  }
  updateNetworkStatusHint();
}

function persistSessionMetadata(session, attribute) {
  const progress = getSessionProgress(currentSessionId);
  progress.meta = {
    operator: session.operator,
    date: session.date,
    attributeId: session.attributeId,
    attributeLabel: attribute.label
  };
  saveSessionProgress(currentSessionId, progress);
  return progress;
}

function updateItemResult(itemId, partial) {
  if (!currentSessionId) {
    return;
  }
  const progress = getSessionProgress(currentSessionId);
  const currentItem = progress.items[itemId] ?? {};
  const nextItem = { ...currentItem };

  if (Object.prototype.hasOwnProperty.call(partial, 'completed')) {
    if (partial.completed) {
      nextItem.completed = true;
    } else {
      delete nextItem.completed;
    }
  }

  if (Object.prototype.hasOwnProperty.call(partial, 'capture')) {
    if (partial.capture) {
      nextItem.capture = partial.capture;
    } else {
      delete nextItem.capture;
    }
  }

  if (Object.keys(nextItem).length === 0) {
    delete progress.items[itemId];
  } else {
    progress.items[itemId] = nextItem;
  }
  progress.synced = false;
  delete progress.syncedAt;
  progress.updatedAt = new Date().toISOString();
  saveSessionProgress(currentSessionId, progress);
  renderSessionMeta(currentSession, currentAttribute, progress);
}

function openCaptureDialog(itemId, initialValue) {
  activeCaptureItemId = itemId;
  if (captureDialog?.showModal) {
    captureInput.value = initialValue;
    captureDialog.showModal();
  } else {
    const value = window.prompt('現地で読み取ったコードを入力してください。', initialValue);
    if (value !== null) {
      applyCaptureValue(itemId, value.trim());
    }
    activeCaptureItemId = null;
  }
}

function handleCaptureClose() {
  if (!activeCaptureItemId || captureDialog.returnValue !== 'confirm') {
    activeCaptureItemId = null;
    return;
  }
  const value = captureInput.value.trim();
  applyCaptureValue(activeCaptureItemId, value);
  activeCaptureItemId = null;
  captureInput.value = '';
}

function applyCaptureValue(itemId, value) {
  updateItemResult(itemId, { capture: value });
  const item = patrolList.querySelector(`[data-item-id="${itemId}"]`);
  if (item) {
    setCaptureInfo(item, value);
  }
}

function setCaptureInfo(itemElement, value) {
  let info = itemElement.querySelector('.capture-info');
  if (!value) {
    if (info) {
      info.remove();
    }
    return;
  }

  if (!info) {
    info = document.createElement('p');
    info.className = 'capture-info';
    itemElement.querySelector('.item-main').appendChild(info);
  }
  info.textContent = `読み取り結果: ${value}`;
}

function renderSessionMeta(session, attribute, progress) {
  if (!session || !attribute || !progress) {
    patrolMeta.innerHTML = '';
    return;
  }

  patrolMeta.innerHTML = '';
  addMetaRow('担当者', session.operator);
  addMetaRow('巡回日', session.date);
  addMetaRow('巡回属性', attribute.label);

  if (progress.updatedAt) {
    addMetaRow('最終更新', formatTimestamp(progress.updatedAt));
  }

  const statusRow = document.createElement('p');
  const strong = document.createElement('strong');
  strong.textContent = '同期状態:';
  statusRow.appendChild(strong);

  const badge = document.createElement('span');
  badge.className = `badge ${progress.synced ? 'badge--synced' : 'badge--pending'}`;
  badge.textContent = progress.synced ? '同期済み' : '未同期';
  statusRow.appendChild(document.createTextNode(' '));
  statusRow.appendChild(badge);

  if (progress.synced && progress.syncedAt) {
    const note = document.createElement('span');
    note.className = 'meta-note';
    note.textContent = formatTimestamp(progress.syncedAt);
    statusRow.appendChild(document.createTextNode(' '));
    statusRow.appendChild(note);
  }

  patrolMeta.appendChild(statusRow);
}

function addMetaRow(label, value) {
  const row = document.createElement('p');
  const strong = document.createElement('strong');
  strong.textContent = `${label}:`;
  row.appendChild(strong);
  row.appendChild(document.createTextNode(` ${value}`));
  patrolMeta.appendChild(row);
}

function handleSync() {
  const pendingEntries = Object.entries(resultsStore).filter(([, record]) => {
    if (!record || record.synced) {
      return false;
    }
    const itemCount = Object.keys(record.items ?? {}).length;
    return itemCount > 0;
  });

  if (pendingEntries.length === 0) {
    syncStatus.textContent = '同期対象の巡回結果はありません。';
    return;
  }

  if (!navigator.onLine) {
    syncStatus.textContent = OFFLINE_MESSAGE;
    return;
  }

  const timestamp = new Date().toISOString();
  pendingEntries.forEach(([, record]) => {
    record.synced = true;
    record.syncedAt = timestamp;
  });
  writeJson(STORAGE_KEYS.results, resultsStore);
  syncStatus.textContent = `端末内の${pendingEntries.length}件を同期済みとして記録しました。`;

  if (currentSessionId) {
    const progress = getSessionProgress(currentSessionId);
    renderSessionMeta(currentSession, currentAttribute, progress);
  }
}

function updateNetworkStatusHint() {
  if (!navigator.onLine) {
    syncStatus.textContent = OFFLINE_MESSAGE;
  } else if (syncStatus.textContent === OFFLINE_MESSAGE) {
    syncStatus.textContent = '';
  }
}

function getSessionProgress(sessionId) {
  const current = resultsStore[sessionId];
  if (!current) {
    return { items: {}, synced: false };
  }
  return {
    ...current,
    items: { ...current.items }
  };
}

function saveSessionProgress(sessionId, progress) {
  resultsStore[sessionId] = {
    ...progress,
    items: { ...progress.items }
  };
  writeJson(STORAGE_KEYS.results, resultsStore);
}

function loadStoredResults() {
  const stored = readJson(STORAGE_KEYS.results);
  if (stored && typeof stored === 'object') {
    return stored;
  }
  return {};
}

function getStoredSession() {
  const raw = localStorage.getItem(STORAGE_KEYS.session);
  if (!raw) {
    return null;
  }
  try {
    return JSON.parse(raw);
  } catch (error) {
    console.error('巡回設定の読み込みに失敗しました', error);
    return null;
  }
}

function makeSessionId({ operator, date, attributeId }) {
  return `${operator}__${date}__${attributeId}`;
}

function readJson(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch (error) {
    console.error(`Failed to parse localStorage value for ${key}`, error);
    return null;
  }
}

function writeJson(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function formatTimestamp(isoString) {
  if (!isoString) {
    return '';
  }
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) {
    return isoString;
  }
  return date.toLocaleString();
}

const testExports = {
  populateAttributes,
  setCaptureInfo,
  formatTimestamp
};

if (typeof window !== 'undefined') {
  window.__patrolmate__ = {
    ...(window.__patrolmate__ || {}),
    ...testExports
  };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = testExports;
}
