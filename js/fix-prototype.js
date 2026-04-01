const storedError = localStorage.getItem("selected_error");

let error = null;

if (storedError) {
  error = JSON.parse(storedError);
} else {
  console.error("No error data found");
}

'use strict';
/* ═══════════════════════════════════════════════════════════════
   ErrorLens  —  fix.js
   Data, rendering, chat, PR flow, diff tabs
═══════════════════════════════════════════════════════════════ */

// ─── MOCK DATA ────────────────────────────────────────────────────────────────

const REPO_NAME = (() => {
  try {
    const saved = localStorage.getItem('errLens_selectedRepo');
    if (saved) return JSON.parse(saved).name;
  } catch (_) {}
  return 'ErrorLens';
})();

const ERRORS = [
  {
    id: 'ERR001', severity: 'critical', code: 'ECONNREFUSED',
    title: 'Database Connection Refused',
    cause: 'PostgreSQL attempted to connect on 127.0.0.1:5432 but found no running service. The CI job-level env block is missing DB_HOST and DB_PORT, causing a silent ECONNREFUSED on every run.',
    file: 'ci.yml', fixable: true, fixIndex: 0
  },
  {
    id: 'ERR002', severity: 'critical', code: 'MODULE_NOT_FOUND',
    title: 'Missing Module Import',
    cause: './config/db.js was deleted in commit a3f92c1 but 3 files still import from it. The bundler cannot resolve the path at startup.',
    file: 'server.js', fixable: true, fixIndex: 1
  },
  {
    id: 'ERR003', severity: 'warning', code: 'EXIT CODE 137',
    title: 'Out-of-Memory Termination',
    cause: 'The test suite spawned 12 parallel Jest workers. The GitHub-hosted runner provides only 7 GB RAM — heap exceeded limit during the test collection phase.',
    file: 'package.json', fixable: true, fixIndex: 2
  },
  {
    id: 'ERR004', severity: 'warning', code: 'TIMEOUT',
    title: 'Deployment Health Check Timeout',
    cause: 'Service took 95s to start but the health check probe timeout is set to 60s. Cold-start time increased after adding a heavy ORM migration step.',
    file: 'k8s/deployment.yaml', fixable: false, fixIndex: null
  },
  {
    id: 'ERR005', severity: 'info', code: 'DEPRECATED_API',
    title: 'Deprecated API Usage Detected',
    cause: 'Three calls to the legacy queryDB() function detected. This API is scheduled for removal in v3.0. Migrate to db.query() as documented in MIGRATION.md.',
    file: 'app.js', fixable: false, fixIndex: null
  }
];

const FILES = [
  { name: 'ci.yml',                issues: 1, color: '#ff5757' },
  { name: 'server.js',             issues: 1, color: '#ff5757' },
  { name: 'package.json',          issues: 1, color: '#ffd166' },
  { name: 'k8s/deployment.yaml',   issues: 1, color: '#ffd166' },
  { name: 'app.js',                issues: 1, color: '#60a5fa' },
];

const FIXES = [
  {
    label: 'Fix #1',
    fileBefore: 'ci.yml (broken)',
    fileAfter:  'ci.yml (fixed)',
    explanation: 'The CI pipeline ran npm test without defining DB_HOST or DB_PORT in the environment block. PostgreSQL attempted to connect on 127.0.0.1:5432 but found no service — causing a silent ECONNREFUSED that terminated the build.',
    confidence: '98.4%',
    before: [
      { ln:1,  type:'',        marker:'',  text:'jobs:' },
      { ln:2,  type:'',        marker:'',  text:'  build:' },
      { ln:3,  type:'',        marker:'',  text:'    runs-on: ubuntu-latest' },
      { ln:4,  type:'removed', marker:'-', text:'    # no env block defined' },
      { ln:5,  type:'',        marker:'',  text:'    steps:' },
      { ln:6,  type:'',        marker:'',  text:'      - uses: actions/checkout@v3' },
      { ln:7,  type:'',        marker:'',  text:'      - name: Run tests' },
      { ln:8,  type:'',        marker:'',  text:'        run: npm test' },
      { ln:9,  type:'removed', marker:'-', text:'    # ✗ ECONNREFUSED 127.0.0.1:5432' },
      { ln:10, type:'removed', marker:'-', text:'    # ✗ Build fails silently' },
    ],
    after: [
      { ln:1, type:'',      marker:'',  text:'jobs:' },
      { ln:2, type:'',      marker:'',  text:'  build:' },
      { ln:3, type:'',      marker:'',  text:'    runs-on: ubuntu-latest' },
      { ln:4, type:'added', marker:'+', text:'    env:' },
      { ln:5, type:'added', marker:'+', text:'      DB_HOST: localhost' },
      { ln:6, type:'added', marker:'+', text:'      DB_PORT: "5432"' },
      { ln:7, type:'',      marker:'',  text:'    steps:' },
      { ln:8, type:'',      marker:'',  text:'      - uses: actions/checkout@v3' },
      { ln:9, type:'',      marker:'',  text:'      - name: Run tests' },
      { ln:10,type:'added', marker:'+', text:'        run: npm test   # ✓ passes' },
    ]
  },
  {
    label: 'Fix #2',
    fileBefore: 'server.js (broken)',
    fileAfter:  'server.js (fixed)',
    explanation: './config/db.js was deleted in commit a3f92c1 but three files still import from it. ErrorLens updated all import paths to point to the new ./config/database.js module.',
    confidence: '96.1%',
    before: [
      { ln:1,  type:'',        marker:'',  text:"const express = require('express');" },
      { ln:2,  type:'removed', marker:'-', text:"const db = require('./config/db');" },
      { ln:3,  type:'',        marker:'',  text:"const routes = require('./routes');" },
      { ln:4,  type:'',        marker:'',  text:'' },
      { ln:5,  type:'',        marker:'',  text:'const app = express();' },
      { ln:6,  type:'removed', marker:'-', text:'// ✗ MODULE_NOT_FOUND: ./config/db' },
      { ln:7,  type:'',        marker:'',  text:'app.use(express.json());' },
      { ln:8,  type:'',        marker:'',  text:'app.use(routes);' },
      { ln:9,  type:'',        marker:'',  text:'app.listen(3000);' },
    ],
    after: [
      { ln:1, type:'',      marker:'',  text:"const express = require('express');" },
      { ln:2, type:'added', marker:'+', text:"const db = require('./config/database');" },
      { ln:3, type:'',      marker:'',  text:"const routes = require('./routes');" },
      { ln:4, type:'',      marker:'',  text:'' },
      { ln:5, type:'',      marker:'',  text:'const app = express();' },
      { ln:6, type:'added', marker:'+', text:'// ✓ module resolved correctly' },
      { ln:7, type:'',      marker:'',  text:'app.use(express.json());' },
      { ln:8, type:'',      marker:'',  text:'app.use(routes);' },
      { ln:9, type:'',      marker:'',  text:'app.listen(3000);' },
    ]
  },
  {
    label: 'Fix #3',
    fileBefore: 'package.json (broken)',
    fileAfter:  'package.json (fixed)',
    explanation: 'The Jest test suite was spawning 12 parallel workers, exhausting the 7 GB runner RAM. ErrorLens capped workers to 4 and raised the Node.js heap ceiling to prevent OOM termination.',
    confidence: '91.3%',
    before: [
      { ln:1, type:'',        marker:'',  text:'  "scripts": {' },
      { ln:2, type:'removed', marker:'-', text:'    "test": "jest",' },
      { ln:3, type:'',        marker:'',  text:'    "build": "tsc",' },
      { ln:4, type:'',        marker:'',  text:'    "start": "node dist/index.js"' },
      { ln:5, type:'',        marker:'',  text:'  },' },
      { ln:6, type:'removed', marker:'-', text:'  // ✗ No worker or heap limits' },
    ],
    after: [
      { ln:1, type:'',      marker:'',  text:'  "scripts": {' },
      { ln:2, type:'added', marker:'+', text:'    "test": "jest --maxWorkers=4",' },
      { ln:3, type:'',      marker:'',  text:'    "build": "tsc",' },
      { ln:4, type:'added', marker:'+', text:'    "start": "NODE_OPTIONS=--max-old-space-size=4096 node dist/index.js"' },
      { ln:5, type:'',      marker:'',  text:'  },' },
      { ln:6, type:'added', marker:'+', text:'  // ✓ memory limits applied' },
    ]
  }
];

const PR_STEPS = [
  { msg: 'Applying fixes…',           sub: 'Patching ci.yml' },
  { msg: 'Committing changes…',       sub: 'git commit -m "fix: DB_HOST env + imports"' },
  { msg: 'Pushing to feature branch…',sub: 'origin/fix/errLens-auto-20260401' },
  { msg: 'Opening pull request…',     sub: 'Targeting main · 3 files changed' },
];

// ─── AI CHAT RESPONSES ────────────────────────────────────────────────────────

const AI_RESPONSES = {
  default: [
    "I've analyzed the pipeline logs thoroughly. The root cause is a missing `DB_HOST` environment variable in the CI job — PostgreSQL can't bind on `127.0.0.1:5432` because the service was never started in the runner context. The fix is a one-line env block addition.",
    "The `MODULE_NOT_FOUND` error for `./config/db.js` is a stale import. The file was removed in commit `a3f92c1` but three source files still reference it. I've traced all import paths and prepared updated require statements pointing to `./config/database.js`.",
    "Confidence score for this fix is 96.1%. I've seen this pattern in 847 similar repositories — it's almost always a module rename during refactoring that doesn't get caught until CI runs.",
    "The OOM crash (exit code 137) is caused by Jest spawning too many parallel workers. With `--maxWorkers=4` and a 4096 MB heap limit, the test suite completes cleanly on a standard GitHub-hosted runner.",
    "In total I found 5 issues: 2 critical, 2 warnings, and 1 informational. Three of those are fully auto-fixable. The two manual items (K8s probe timeout and deprecated API calls) require human review before patching.",
    "The auto-fix PR will contain 3 commits: one for each patched file. Each commit is signed off with confidence metadata so your team can audit exactly what ErrorLens changed and why."
  ],
  keywords: {
    'db': "The database issue is a missing environment block in your CI config. PostgreSQL needs `DB_HOST: localhost` and `DB_PORT: \"5432\"` at the job level so the runner knows where to connect. Without these, every test run will fail with `ECONNREFUSED 127.0.0.1:5432`.",
    'database': "The database issue is a missing environment block in your CI config. PostgreSQL needs `DB_HOST: localhost` and `DB_PORT: \"5432\"` at the job level so the runner knows where to connect. Without these, every test run will fail with `ECONNREFUSED 127.0.0.1:5432`.",
    'connection': "The `ECONNREFUSED` error means the process tried to open a TCP socket to 127.0.0.1:5432, but nothing was listening. In your CI context this means the Postgres service was either not started or not included in the runner's service containers block.",
    'fix': "Three issues are auto-fixable with high confidence: the missing DB env vars (98.4%), the stale module import (96.1%), and the Jest worker overflow (91.3%). The K8s probe timeout and deprecated API calls need manual review.",
    'auto': "Yes — ErrorLens can auto-fix all 3 critical and warning issues that have a fixable flag. Click 'Auto Fix & Create PR' and I'll apply the patches, push a feature branch, and open a pull request to your main branch in under 10 seconds.",
    'pr': "The pull request will be opened against your `main` branch. It will include 3 commits, a detailed description of each fix, confidence scores, and a link back to this analysis. Your team can review and merge — or revert — with a single click.",
    'module': "The `MODULE_NOT_FOUND` error for `./config/db.js` means the file was deleted but never cleaned up from the import statements. I found 3 files still importing it: `server.js`, `auth.js`, and `models/user.js`. The fix updates all three paths to `./config/database.js`.",
    'import': "The stale import references `./config/db.js` which was removed in commit `a3f92c1`. I've located all 3 affected files and queued updated require statements pointing to the new module path.",
    'memory': "The OOM termination (exit code 137) happens because Jest tries to spawn 12 workers by default, consuming more RAM than the 7 GB available on GitHub-hosted runners. Capping to `--maxWorkers=4` and setting `NODE_OPTIONS=--max-old-space-size=4096` resolves this completely.",
    'jest': "Jest's default worker count is `os.cpus().length / 2`. On a GitHub-hosted runner that can be 12+ workers, which exhausts available RAM during large test suites. Use `--maxWorkers=4` or set a percentage like `--maxWorkers=50%`.",
    'timeout': "The K8s health check is set to `initialDelaySeconds: 60` but your service now takes ~95 seconds to start after the ORM migration was added. Increase the delay to `120` or move the migration to a pre-deployment init container.",
    'confidence': "Confidence scores are calculated based on pattern matching across similar pipeline failures in my training corpus, combined with static analysis of your specific config. A score above 90% means the fix is very unlikely to introduce regressions.",
    'time': "Based on average debugging time for these error types (measured across 50,000+ pipeline runs), ErrorLens estimates you would have spent 4.2 hours manually diagnosing and fixing these issues. The auto-fix completes in under 10 seconds.",
    'how': "ErrorLens works by ingesting your raw CI/CD log output, tokenizing it into error clusters, then applying LLM inference to identify root causes and generate fix suggestions. Each suggestion is ranked by confidence and cross-referenced against known fix patterns.",
    'deprecated': "The deprecated `queryDB()` API calls in `app.js` aren't breaking anything yet, but they will in v3.0. I flagged them as informational so you can migrate at your own pace. The new API is `db.query()` — signature is identical.",
  }
};

// ─── STATE ────────────────────────────────────────────────────────────────────

let activeFixTab  = 0;
let activeFile    = 0;
let chatHistory   = [];
let isTyping      = false;
let prDone        = false;
let msgCounter    = 0;

// ─── DOM REFS ─────────────────────────────────────────────────────────────────

const $ = id => document.getElementById(id);

const DOM = {
  navRepo:       $('navRepo'),
  headerErrCount:$('headerErrCount'),
  critCount:     $('critCount'),
  warnCount:     $('warnCount'),
  infoCount:     $('infoCount'),
  critBar:       $('critBar'),
  warnBar:       $('warnBar'),
  infoBar:       $('infoBar'),
  fileList:      $('fileList'),
  errorCards:    $('errorCards'),
  issuesBadge:   $('issuesBadge'),
  codeTabs:      $('codeTabs'),
  diffFileBefore:$('diffFileBefore'),
  diffFileAfter: $('diffFileAfter'),
  codeBefore:    $('codeBefore'),
  codeAfter:     $('codeAfter'),
  fixExpTitle:   $('fixExpTitle'),
  fixExpText:    $('fixExpText'),
  fixConfidence: $('fixConfidence'),
  copyBefore:    $('copyBefore'),
  copyAfter:     $('copyAfter'),
  btnPrMain:     $('btnPrMain'),
  btnPrNav:      $('btnPrNav'),
  prOverlay:     $('prOverlay'),
  prSpinnerState:$('prSpinnerState'),
  prSuccessState:$('prSuccessState'),
  prSpinMsg:     $('prSpinMsg'),
  prSpinSub:     $('prSpinSub'),
  chatMessages:  $('chatMessages'),
  chatInput:     $('chatInput'),
  chatSend:      $('chatSend'),
  chatClear:     $('chatClear'),
  chatSuggestions:$('chatSuggestions'),
  toast:         $('toast'),
};

// ─── INIT ─────────────────────────────────────────────────────────────────────

function init() {
  DOM.navRepo.textContent = REPO_NAME;
  renderSummary();
  renderFileList();
  renderErrorCards();
  renderCodeTabs();
  renderDiff(activeFixTab);
  bindPR();
  bindChat();
  bindCopy();

  // seed chat with welcome message
  setTimeout(() => {
    addAIMessage(`Analysis of **${REPO_NAME}** is complete. I found **5 issues** across 5 files — 3 are auto-fixable. Ask me anything about the errors, or click **Auto Fix & Create PR** to patch them now.`);
  }, 600);
}

// ─── SUMMARY ─────────────────────────────────────────────────────────────────

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

  // animate bars after paint
  requestAnimationFrame(() => {
    DOM.critBar.style.width = `${(crit / total * 100).toFixed(0)}%`;
    DOM.warnBar.style.width = `${(warn / total * 100).toFixed(0)}%`;
    DOM.infoBar.style.width = `${(info / total * 100).toFixed(0)}%`;
  });
}

// ─── FILE LIST ────────────────────────────────────────────────────────────────

function renderFileList() {
  DOM.fileList.innerHTML = '';
  FILES.forEach((f, i) => {
    const el = document.createElement('div');
    el.className = 'file-item' + (i === activeFile ? ' active' : '');
    el.innerHTML = `
      <span class="file-dot" style="background:${f.color};box-shadow:0 0 6px ${f.color}55"></span>
      <span class="file-name mono">${esc(f.name)}</span>
      <span class="file-issue-count">${f.issues}</span>
    `;
    el.addEventListener('click', () => {
      activeFile = i;
      document.querySelectorAll('.file-item').forEach((el, j) =>
        el.classList.toggle('active', j === i)
      );
      // find first error in this file
      const idx = ERRORS.findIndex(e => e.file === f.name);
      if (idx >= 0) {
        const card = document.querySelectorAll('.error-card')[idx];
        if (card) card.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    });
    DOM.fileList.appendChild(el);
  });
}

// ─── ERROR CARDS ─────────────────────────────────────────────────────────────

function renderErrorCards() {
  DOM.errorCards.innerHTML = '';
  ERRORS.forEach((err, i) => {
    const card = document.createElement('div');
    card.className = `error-card ${err.severity}`;
    card.style.animationDelay = `${i * 0.06}s`;
    card.innerHTML = `
      <span class="error-sev ${err.severity}">${err.severity}</span>
      <div class="error-body">
        <span class="error-code mono">${esc(err.code)}</span>
        <span class="error-title">${esc(err.title)}</span>
        <p class="error-cause">${esc(err.cause)}</p>
        <span class="error-file-tag mono">${esc(err.file)}</span>
      </div>
      <div class="error-actions">
        ${err.fixable
          ? `<button class="btn-view-fix" data-fix="${err.fixIndex}">View Fix →</button>`
          : `<button class="btn-view-fix" style="opacity:0.4;cursor:not-allowed" disabled>Manual Review</button>`
        }
      </div>
    `;
    if (err.fixable) {
      card.querySelector('.btn-view-fix').addEventListener('click', () => {
        activeFixTab = err.fixIndex;
        renderDiff(activeFixTab);
        updateCodeTabs();
        document.getElementById('sectionCode').scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    }
    DOM.errorCards.appendChild(card);
  });
}

// ─── CODE TABS ────────────────────────────────────────────────────────────────

function renderCodeTabs() {
  DOM.codeTabs.innerHTML = '';
  FIXES.forEach((fix, i) => {
    const btn = document.createElement('button');
    btn.className = 'code-tab' + (i === activeFixTab ? ' active' : '');
    btn.dataset.tab = i;
    btn.textContent = fix.label;
    btn.addEventListener('click', () => {
      activeFixTab = i;
      renderDiff(i);
      updateCodeTabs();
    });
    DOM.codeTabs.appendChild(btn);
  });
}

function updateCodeTabs() {
  document.querySelectorAll('.code-tab').forEach((btn, i) =>
    btn.classList.toggle('active', i === activeFixTab)
  );
}

// ─── DIFF RENDER ──────────────────────────────────────────────────────────────

function renderDiff(idx) {
  const fix = FIXES[idx];
  DOM.diffFileBefore.textContent = fix.fileBefore;
  DOM.diffFileAfter.textContent  = fix.fileAfter;
  DOM.fixExpText.textContent     = fix.explanation;
  DOM.fixExpTitle.textContent    = 'What was wrong';
  DOM.fixConfidence.textContent  = fix.confidence;

  DOM.codeBefore.innerHTML = renderLines(fix.before, 'before');
  DOM.codeAfter.innerHTML  = renderLines(fix.after, 'after');
}

function renderLines(lines, side) {
  return lines.map(l => {
    const typeClass = l.type ? ` ${l.type}` : '';
    const markerClass = l.marker === '-' ? ' minus' : l.marker === '+' ? ' plus' : '';
    const codeHtml = colorize(l.text);
    return `<div class="code-line${typeClass}">
      <span class="line-num">${l.ln}</span>
      <span class="line-marker${markerClass}">${l.marker || ' '}</span>
      <span class="line-code">${codeHtml}</span>
    </div>`;
  }).join('');
}

// Very lightweight syntax highlighter
function colorize(text) {
  const t = esc(text);
  return t
    // YAML keys
    .replace(/^(\s*)([\w-]+)(:)/gm, '$1<span class="tok-key">$2</span>$3')
    // JS keywords
    .replace(/\b(const|let|var|require|function|return|new|if|else|true|false|null|undefined)\b/g,
      '<span class="tok-kw">$1</span>')
    // strings
    .replace(/(&#039;[^&#]*&#039;|&quot;[^&]*&quot;)/g,
      '<span class="tok-str">$1</span>')
    // comments
    .replace(/(\/\/.*)/, '<span class="tok-cmt">$1</span>')
    .replace(/(#.*$)/, '<span class="tok-cmt">$1</span>')
    // ✗ error markers
    .replace(/(✗[^<]*)/g, '<span class="tok-err">$1</span>')
    // ✓ ok markers
    .replace(/(✓[^<]*)/g, '<span class="tok-val">$1</span>');
}

// ─── COPY BUTTONS ─────────────────────────────────────────────────────────────

function bindCopy() {
  DOM.copyBefore.addEventListener('click', () => {
    copyCode('before');
  });
  DOM.copyAfter.addEventListener('click', () => {
    copyCode('after');
  });
}

function copyCode(side) {
  const fix = FIXES[activeFixTab];
  const lines = side === 'before' ? fix.before : fix.after;
  const text  = lines.map(l => l.text).join('\n');
  navigator.clipboard.writeText(text).then(() => {
    const btn = side === 'before' ? DOM.copyBefore : DOM.copyAfter;
    btn.classList.add('copied');
    btn.innerHTML = `<svg width="13" height="13" viewBox="0 0 16 16" fill="none"><path d="M3 8l4 4 6-7" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg> Copied`;
    setTimeout(() => {
      btn.classList.remove('copied');
      btn.innerHTML = `<svg width="13" height="13" viewBox="0 0 16 16" fill="none"><rect x="5" y="5" width="9" height="9" rx="1.5" stroke="currentColor" stroke-width="1.5"/><path d="M3 11H2a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v1" stroke="currentColor" stroke-width="1.5"/></svg> Copy`;
    }, 2000);
    showToast('Copied to clipboard ✓', 'green');
  }).catch(() => showToast('Copy failed — try manually'));
}

// ─── PR FLOW ──────────────────────────────────────────────────────────────────

function bindPR() {
  DOM.btnPrMain.addEventListener('click', startPR);
  DOM.btnPrNav.addEventListener('click', startPR);
}

function startPR() {
  if (prDone) {
    showToast('PR already created! ✓', 'green');
    return;
  }

  DOM.prOverlay.classList.remove('hidden');
  DOM.prSpinnerState.classList.remove('hidden');
  DOM.prSuccessState.classList.add('hidden');

  let step = 0;
  const total = PR_STEPS.length;

  const cycle = setInterval(() => {
    if (step < total) {
      DOM.prSpinMsg.textContent = PR_STEPS[step].msg;
      DOM.prSpinSub.textContent = PR_STEPS[step].sub;
      step++;
    }
  }, 700);

  setTimeout(() => {
    clearInterval(cycle);
    DOM.prSpinnerState.classList.add('hidden');
    DOM.prSuccessState.classList.remove('hidden');
    prDone = true;
    showToast('Pull Request created successfully ✓', 'green');

    // chat notification
    setTimeout(() => {
      addAIMessage('PR #42 has been opened on GitHub: **fix: resolve DB connection & missing module**. 3 files changed, 7 insertions, 3 deletions. Ready to review and merge. 🎉');
    }, 400);

    // allow dismiss by clicking overlay
    DOM.prOverlay.addEventListener('click', (e) => {
      if (e.target === DOM.prOverlay) DOM.prOverlay.classList.add('hidden');
    }, { once: false });

  }, total * 700 + 400);
}

// ─── CHAT SYSTEM ──────────────────────────────────────────────────────────────

function bindChat() {
  DOM.chatSend.addEventListener('click', handleSend);
  DOM.chatInput.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  });
  DOM.chatClear.addEventListener('click', () => {
    DOM.chatMessages.innerHTML = '';
    chatHistory = [];
    setTimeout(() => {
      addAIMessage('Chat cleared. How can I help you with the pipeline errors?');
    }, 200);
  });

  // suggestion chips
  DOM.chatSuggestions.addEventListener('click', e => {
    const chip = e.target.closest('.suggestion-chip');
    if (!chip) return;
    DOM.chatInput.value = chip.dataset.msg;
    handleSend();
  });
}

function handleSend() {
  const raw = DOM.chatInput.value.trim();
  if (!raw || isTyping) return;
  DOM.chatInput.value = '';
  addUserMessage(raw);
  triggerAIResponse(raw);
}

function addUserMessage(text) {
  msgCounter++;
  const msg = document.createElement('div');
  msg.className = 'chat-msg user';
  msg.innerHTML = `
    <div class="chat-bubble">${esc(text)}</div>
    <span class="chat-time">${nowTime()}</span>
  `;
  DOM.chatMessages.appendChild(msg);
  scrollChat();
}

function addAIMessage(text) {
  msgCounter++;
  const msg = document.createElement('div');
  msg.className = 'chat-msg ai';
  // bold **text** rendering
  const html = esc(text).replace(/\*\*([^*]+)\*\*/g, '<strong style="color:var(--text-1)">$1</strong>');
  msg.innerHTML = `
    <div class="chat-bubble">${html}</div>
    <span class="chat-time">${nowTime()}</span>
  `;
  DOM.chatMessages.appendChild(msg);
  scrollChat();
}

function triggerAIResponse(userMsg) {
  isTyping = true;
  DOM.chatSend.disabled = true;

  // show typing indicator
  const typing = document.createElement('div');
  typing.className = 'chat-msg ai';
  typing.id = 'typingIndicator';
  typing.innerHTML = `
    <div class="typing-bubble">
      <div class="typing-dot"></div>
      <div class="typing-dot"></div>
      <div class="typing-dot"></div>
    </div>
  `;
  DOM.chatMessages.appendChild(typing);
  scrollChat();

  // pick response
  const delay = 1200 + Math.random() * 800;
  setTimeout(() => {
    // remove typing indicator
    const ti = document.getElementById('typingIndicator');
    if (ti) ti.remove();

    const response = pickResponse(userMsg);
    isTyping = false;
    DOM.chatSend.disabled = false;
    addAIMessage(response);
  }, delay);
}

function pickResponse(msg) {
  const lower = msg.toLowerCase();
  for (const [kw, resp] of Object.entries(AI_RESPONSES.keywords)) {
    if (lower.includes(kw)) return resp;
  }
  // rotate through defaults
  const defaults = AI_RESPONSES.default;
  return defaults[msgCounter % defaults.length];
}

function scrollChat() {
  requestAnimationFrame(() => {
    DOM.chatMessages.scrollTop = DOM.chatMessages.scrollHeight;
  });
}

function nowTime() {
  return new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
}

// ─── TOAST ───────────────────────────────────────────────────────────────────

function showToast(msg, type = '') {
  DOM.toast.textContent = msg;
  DOM.toast.className = 'toast show' + (type ? ` ${type}` : '');
  clearTimeout(DOM.toast._timer);
  DOM.toast._timer = setTimeout(() => {
    DOM.toast.className = 'toast';
  }, 2800);
}

// ─── HELPERS ─────────────────────────────────────────────────────────────────

function esc(str) {
  return String(str ?? '')
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#039;');
}

// ─── BOOTSTRAP ───────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', init);

if (error) {
  document.getElementById("error").innerText = error.error;
  document.getElementById("file").innerText = `${error.file}:${error.line}`;
  document.getElementById("fix").innerText = error.fix;

  function formatCode(code, type) {
  const lines = code.split("\n");

  return lines.map(line => {
    if (type === "before") {
      return `<div style="color:#ff6b6b;">- ${line}</div>`;
    } else {
      return `<div style="color:#51cf66;">+ ${line}</div>`;
    }
  }).join("");
}

document.getElementById("codeBefore").innerHTML = formatCode(error.before, "before");
document.getElementById("codeAfter").innerHTML = formatCode(error.after, "after");
}

function autoFix() {
  alert("✅ Pull Request Created Successfully!");
}

document.addEventListener("DOMContentLoaded", () => {

  const btn = document.getElementById("btnPrMain");

  if (btn) {
    btn.addEventListener("click", () => {
      const overlay = document.getElementById("prOverlay");
      const spinner = document.getElementById("prSpinnerState");
      const success = document.getElementById("prSuccessState");

      overlay.classList.remove("hidden");

      setTimeout(() => {
        spinner.classList.add("hidden");
        success.classList.remove("hidden");
      }, 2000);
    });
  }

});