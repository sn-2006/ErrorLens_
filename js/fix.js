'use strict';

/* ═══════════════════════════════════════════════════════════════
   ErrorLens — Backend Ready fix.js (FINAL)
═══════════════════════════════════════════════════════════════ */

// ─── STATE ─────────────────────────────────────────────────────
function attachUserUI() {
  try {
    const user = JSON.parse(localStorage.getItem("github_user"));

    if (user) {
      const avatar = document.getElementById("userAvatar");

      if (avatar) avatar.src = user.avatar_url;

    } else {
      window.location.href = "login.html";
    }
  } catch (err) {
    console.error("User load failed:", err);
    window.location.href = "login.html";
  }
}

const firebaseConfig = {
  apiKey: "YOUR_KEY",
  authDomain: "YOUR_DOMAIN",
  projectId: "YOUR_PROJECT_ID",
};

let REPO_NAME = 'Loading...';

let activeFixTab = 0;
let activeFile = 0;
let prDone = false;

// ─── API LAYER ─────────────────────────────────────────────────

const BASE_URL = "https://errorlens-3d5o.onrender.com";

const API = {
  async getRepo() {
    const res = await fetch(`${BASE_URL}/api/repo`);
    return res.json();
  },

  async getErrors() {
    const res = await fetch(`${BASE_URL}/api/errors`);
    return res.json();
  },

  async getFixes() {
    const res = await fetch(`${BASE_URL}/api/fixes`);
    return res.json();
  },

  async createPR() {
    const res = await fetch(`${BASE_URL}/api/pr`, { method: 'POST' });
    return res.json();
  },

  async chat(message) {
    const res = await fetch(`https://errorlens-3d5o.onrender.com/api/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        message,
        repo: REPO_NAME,
        activeFile: FILES[activeFile]?.name,
        currentFix: FIXES[activeFixTab],
        errors: ERRORS.slice(0, 5)
      })
    });

    return res.json();
  }
};

// ─── DOM ──────────────────────────────────────────────────────

const $ = id => document.getElementById(id);

const DOM = {
  navRepo: $('navRepo'),
  headerErrCount: $('headerErrCount'),
  critCount: $('critCount'),
  warnCount: $('warnCount'),
  infoCount: $('infoCount'),
  critBar: $('critBar'),
  warnBar: $('warnBar'),
  infoBar: $('infoBar'),
  fileList: $('fileList'),
  errorCards: $('errorCards'),
  issuesBadge: $('issuesBadge'),
  codeTabs: $('codeTabs'),
  diffFileBefore: $('diffFileBefore'),
  diffFileAfter: $('diffFileAfter'),
  codeBefore: $('codeBefore'),
  codeAfter: $('codeAfter'),
  fixExpText: $('fixExpText'),
  fixConfidence: $('fixConfidence'),
  btnPrMain: $('btnPrMain'),
  btnPrNav: $('btnPrNav'),
  prOverlay: $('prOverlay'),
  prSpinnerState: $('prSpinnerState'),
  prSuccessState: $('prSuccessState'),
  chatMessages: $('chatMessages'),
  chatInput: $('chatInput'),
  chatSend: $('chatSend'),
  chatClear: $('chatClear'),
  toast: $('toast'),
};

// ─── INIT ─────────────────────────────────────────────────────

async function init() {
  attachUserUI();
  try {
    const [repo, errors, fixes] = await Promise.all([
      API.getRepo(),
      API.getErrors(),
      API.getFixes()
    ]);

    REPO_NAME = repo.name || 'ErrorLens';
    ERRORS = errors;
    FIXES = fixes;
    FILES = generateFilesFromErrors(errors);

    DOM.navRepo.textContent = REPO_NAME;

    renderSummary();
    renderFileList();
    renderErrorCards();
    renderDiff(0);

    bindPR();
    bindChat();

    setTimeout(() => {
      addAIMessage(`Analysis of ${REPO_NAME} is complete. Ask anything or create a PR.`);
    }, 600);

  } catch (err) {
    console.error(err);
    showToast('Failed to load data');
  }
}

// ─── FILE GENERATOR ───────────────────────────────────────────

function generateFilesFromErrors(errors) {
  const map = {};

  errors.forEach(e => {
    if (!map[e.file]) {
      map[e.file] = { name: e.file, issues: 0, color: '#ff5757' };
    }
    map[e.file].issues++;
  });

  return Object.values(map);
}

// ─── SUMMARY ──────────────────────────────────────────────────

function renderSummary() {
  const crit = ERRORS.filter(e => e.severity === 'critical').length;
  const warn = ERRORS.filter(e => e.severity === 'warning').length;
  const info = ERRORS.filter(e => e.severity === 'info').length;
  const total = ERRORS.length;

  DOM.critCount.textContent = crit;
  DOM.warnCount.textContent = warn;
  DOM.infoCount.textContent = info;
  DOM.headerErrCount.textContent = total;
  DOM.issuesBadge.textContent = `${total} issues`;

  requestAnimationFrame(() => {
    DOM.critBar.style.width = `${(crit / total * 100) || 0}%`;
    DOM.warnBar.style.width = `${(warn / total * 100) || 0}%`;
    DOM.infoBar.style.width = `${(info / total * 100) || 0}%`;
  });
}

// ─── FILE LIST ────────────────────────────────────────────────

function renderFileList() {
  DOM.fileList.innerHTML = '';

  FILES.forEach((f, i) => {
    const el = document.createElement('div');
    el.className = 'file-item' + (i === activeFile ? ' active' : '');

    el.innerHTML = `
      <span class="file-dot" style="background:${f.color}"></span>
      <span class="file-name mono">${esc(f.name)}</span>
      <span class="file-issue-count">${f.issues}</span>
    `;

    el.onclick = () => {
      activeFile = i;
      renderFileList();
    };

    DOM.fileList.appendChild(el);
  });
}

// ─── ERROR CARDS ─────────────────────────────────────────────

function renderErrorCards() {
  DOM.errorCards.innerHTML = '';

  ERRORS.forEach((err) => {
    const card = document.createElement('div');
    card.className = `error-card ${err.severity}`;

    card.innerHTML = `
      <span class="error-sev ${err.severity}">${err.severity}</span>
      <div class="error-body">
        <span class="error-title">${esc(err.title)}</span>
        <p>${esc(err.cause)}</p>
      </div>
    `;

    DOM.errorCards.appendChild(card);
  });
}

// ─── DIFF ─────────────────────────────────────────────────────

function renderDiff(idx) {
  const fix = FIXES[idx];
  if (!fix) return;

  DOM.diffFileBefore.textContent = fix.fileBefore;
  DOM.diffFileAfter.textContent = fix.fileAfter;
  DOM.fixExpText.textContent = fix.explanation;
  DOM.fixConfidence.textContent = fix.confidence;
}

// ─── PR FLOW ──────────────────────────────────────────────────

function bindPR() {
  DOM.btnPrMain.onclick = startPR;
  DOM.btnPrNav.onclick = startPR;
}

async function startPR() {
  if (prDone) return showToast('PR already created');

  DOM.prOverlay.classList.remove('hidden');

  try {
    const res = await API.createPR();

    DOM.prSpinnerState.classList.add('hidden');
    DOM.prSuccessState.classList.remove('hidden');

    prDone = true;

    addAIMessage(`PR created: ${res.url}`);

  } catch {
    showToast('PR failed');
  }
}

// ─── CHAT ─────────────────────────────────────────────────────

function bindChat() {
  DOM.chatSend.onclick = handleSend;

  DOM.chatInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') handleSend();
  });

  DOM.chatClear.onclick = () => {
    DOM.chatMessages.innerHTML = '';
  };
}

function handleSend() {
  const text = DOM.chatInput.value.trim();
  if (!text) return;

  DOM.chatInput.value = '';
  addUserMessage(text);
  triggerAIResponse(text);
}

async function triggerAIResponse(msg) {
  addAIMessage('🤖 Thinking...');

  try {
    const res = await API.chat(msg);

    if (DOM.chatMessages.lastChild) {
      DOM.chatMessages.removeChild(DOM.chatMessages.lastChild);
    }

    if (res.reply) {
      addAIMessage(res.reply);
    } else {
      addAIMessage('No response from AI');
    }

  } catch (err) {
    console.error(err);

    if (DOM.chatMessages.lastChild) {
      DOM.chatMessages.removeChild(DOM.chatMessages.lastChild);
    }

    addAIMessage('⚠️ Server error');
  }
}

// ─── CHAT UI ─────────────────────────────────────────────────

function addAIMessage(text) {
  const div = document.createElement('div');
  div.className = 'chat-msg ai';
  div.textContent = text;
  DOM.chatMessages.appendChild(div);
}

function addUserMessage(text) {
  const div = document.createElement('div');
  div.className = 'chat-msg user';
  div.textContent = text;
  DOM.chatMessages.appendChild(div);
}

//───AVATAR ─────────────────────────────────────────────────────
function attachUserUI() {
  onAuthStateChanged(auth, (user) => {
    console.log("AUTH USER:", user);

    if (user) {
      const avatar = document.getElementById("userAvatar");
      const username = document.getElementById("username");

      if (avatar) avatar.src = user.photoURL;
      if (username) username.textContent = user.displayName || "User";
    } else {
      window.location.href = "login.html";
    }
  });
}

// ─── UTIL ─────────────────────────────────────────────────────

function showToast(msg) {
  DOM.toast.textContent = msg;
  DOM.toast.className = 'toast show';
  setTimeout(() => DOM.toast.className = 'toast', 2000);
}

function esc(str) {
  return String(str || '')
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;');
}

// ─── START ───────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', init);