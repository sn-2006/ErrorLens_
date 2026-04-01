/* ═══════════════════════════════════════════════
   ErrorLens — Dashboard Script
   Flow: repos → analyze → (real GitHub now)
═══════════════════════════════════════════════ */
const BASE_URL = "https://focusable-crowdedly-audra.ngrok-free.dev"; 
const storedError = localStorage.getItem("selected_error");

let error = null;

if (storedError) {
  error = JSON.parse(storedError);
} else {
  console.error("No error data found");
}

'use strict';

// ─── STATE ───────────────────────────────────────────────────────────────────

let repos = []; // 🔥 now dynamic
let selectedRepo = null;

// ─── DOM REFS ─────────────────────────────────────────────────────────────────

const pageRepos    = document.getElementById('pageRepos');
const pageAnalyze  = document.getElementById('pageAnalyze');
const repoGrid     = document.getElementById('repoGrid');
const searchInput  = document.getElementById('searchInput');
const searchCount  = document.getElementById('searchCount');
const emptyState   = document.getElementById('emptyState');
const backBtn      = document.getElementById('backBtn');
const navBreadcrumb = document.getElementById('navBreadcrumb');

const selectedRepoName  = document.getElementById('selectedRepoName');
const selectedRepoLang  = document.getElementById('selectedRepoLang');
const termRepoName      = document.getElementById('termRepoName');
const analyzeBtn        = document.getElementById('analyzeBtn');
const resultArea        = document.getElementById('resultArea');
const spinnerWrap       = document.getElementById('spinnerWrap');
const spinnerMsg        = document.getElementById('spinnerMsg');
const spinnerSub        = document.getElementById('spinnerSub');
const resultMsg         = document.getElementById('resultMsg');
const resultText        = document.getElementById('resultText');
const terminalBody      = document.getElementById('terminalBody');

// ─── FETCH REAL GITHUB REPOS ─────────────────────────────────────────────────

async function fetchGitHubRepos() {
  const token = localStorage.getItem("github_token");

  if (!token) {
    alert("Please login first");
    window.location.href = "login.html";
    return [];
  }

  try {
    const res = await fetch("https://api.github.com/user/repos", {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    const data = await res.json();

    return data.map(repo => ({
      name: repo.name,
      description: repo.description || "No description",
      language: repo.language || "Unknown",
      icon: "⬡",
      full_name: repo.full_name
    }));

  } catch (err) {
    console.error("GitHub fetch error:", err);
    return [];
  }
}

// ─── REPO CARD FACTORY ───────────────────────────────────────────────────────

function createRepoCard(repo, index) {
  const card = document.createElement('div');
  card.className = 'repo-card';
  card.style.animationDelay = `${0.05 + index * 0.06}s`;

  card.innerHTML = `
    <div class="card-top">
      <div class="card-repo-icon">${repo.icon}</div>
      <span class="card-title">${escapeHTML(repo.name)}</span>
    </div>
    <p class="card-desc">${escapeHTML(repo.description)}</p>
    <div class="card-footer">
      <span class="lang-pill">${escapeHTML(repo.language)}</span>
      <button class="btn-select">Select →</button>
    </div>
  `;

  card.querySelector('.btn-select').addEventListener('click', (e) => {
    e.stopPropagation();
    handleRepoSelect(repo);
  });

  card.addEventListener('click', () => handleRepoSelect(repo));

  return card;
}

function renderRepos(list) {
  repoGrid.innerHTML = '';

  if (list.length === 0) {
    emptyState.classList.remove('hidden');
    searchCount.textContent = '0 repos';
    return;
  }

  emptyState.classList.add('hidden');
  searchCount.textContent = `${list.length} repo${list.length !== 1 ? 's' : ''}`;
  list.forEach((repo, i) => repoGrid.appendChild(createRepoCard(repo, i)));
}

// ─── SEARCH ──────────────────────────────────────────────────────────────────

function filterRepos(query) {
  const q = query.toLowerCase().trim();
  if (!q) return repos;
  return repos.filter(r =>
    r.name.toLowerCase().includes(q) ||
    r.description.toLowerCase().includes(q) ||
    r.language.toLowerCase().includes(q)
  );
}

searchInput.addEventListener('input', () => {
  renderRepos(filterRepos(searchInput.value));
});

// ─── NAVIGATION ──────────────────────────────────────────────────────────────

function showPage(page) {
  pageRepos.classList.add('hidden');
  pageAnalyze.classList.add('hidden');
  page.classList.remove('hidden');
}

function setBreadcrumb(segments) {
  navBreadcrumb.innerHTML = segments.join(' / ');
}

// ─── REPO SELECT ──────────────────────────────────────────────────────────────

function handleRepoSelect(repo) {
  selectedRepo = repo;

  // 🔥 STORE FULL NAME FOR BACKEND
  localStorage.setItem("selected_repo", repo.full_name);

  selectedRepoName.textContent = repo.name;
  selectedRepoLang.textContent = repo.language;
  termRepoName.textContent = repo.name;

  resetTerminal(repo);

  resultArea.classList.add('hidden');
  spinnerWrap.classList.remove('hidden');

  setBreadcrumb(['Dashboard', 'Repositories', repo.name]);
  showPage(pageAnalyze);
}

function resetTerminal(repo) {
  terminalBody.innerHTML = `
    <span>$ analyzing ${repo.name}...</span>
  `;
}

// ─── BACK ─────────────────────────────────────────────────────────────────────

backBtn.addEventListener('click', () => {
  setBreadcrumb(['Dashboard', 'Repositories']);
  showPage(pageRepos);
});

// ─── ANALYZE (CONNECTED TO BACKEND) ──────────────────────────────────────────

analyzeBtn.addEventListener('click', runAnalysis);

async function runAnalysis() {
  const resultText = document.getElementById('resultText'); // Ensure ref is correct
  const spinnerWrap = document.getElementById('spinnerWrap');
  const resultArea = document.getElementById('resultArea');

  resultArea.classList.remove('hidden');
  spinnerWrap.classList.remove('hidden');

  try {
    // 1. Get the full name (e.g., "sn-2006/test_repo")
    const repoFullName = localStorage.getItem("selected_repo"); 
    if (!repoFullName) return console.error("No repo selected");

    // 2. Fetch from YOUR ngrok backend
    // Route: /webhook/get-analysis/owner/repo
    const [owner, repoName] = repoFullName.split("/");
    const res = await fetch(`${BASE_URL}/webhook/get-analysis/${owner}/${repoName}`);
    
    if (!res.ok) throw new Error("No analysis found for this repo.");

    const data = await res.json();

    // 3. UI Updates
    spinnerWrap.classList.add('hidden');
    
    // 4. Display the AI Suggestion!
    // We put the Gemini text into her result area
    resultText.innerHTML = `
      <div style="background: #1a1a1a; padding: 15px; border-radius: 8px; border-left: 4px solid #00ff00; color: #eee; font-family: 'Courier New', monospace; white-space: pre-wrap;">
        <h3 style="color: #00ff00; margin-top: 0;">🤖 AI Diagnosis</h3>
        ${data.aiAnalysis}
      </div>
    `;

  } catch (err) {
    spinnerWrap.classList.add('hidden');
    resultText.innerHTML = `<p style="color: #ff4444;">❌ Error: ${err.message}</p>`;
    console.error("Analysis failed:", err);
  }
}

// ─── HELPERS ─────────────────────────────────────────────────────────────────

function escapeHTML(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// ─── INIT ─────────────────────────────────────────────────────────────────────

(async function init() {
  setBreadcrumb(['Dashboard', 'Repositories']);

  // 🔥 FETCH REAL REPOS
  repos = await fetchGitHubRepos();
  renderRepos(repos);

  // user info
  try {
    const user = JSON.parse(localStorage.getItem("github_user"));
    if (user) {
      document.getElementById("username").textContent = user.login;
      document.getElementById("userAvatar").src = user.avatar_url;
    }
  } catch (e) {}
})();

// ===== MOCK ERROR DISPLAY =====

function showErrors(errors) {
  const container = document.getElementById("errorList");

  container.innerHTML = "";

  if (!errors || errors.length === 0) {
    container.innerHTML = "<p>No errors found</p>";
    return;
  }

  errors.forEach(err => {
    const div = document.createElement("div");

    div.style.border = "1px solid #333";
    div.style.padding = "10px";
    div.style.marginTop = "10px";

    div.innerHTML = `
      <h4>${err.title}</h4>
      <p>${err.file}:${err.line}</p>
      <button class="view-fix-btn" onclick="goToFix('${err.id}')">
        View Fix →
      </button>
    `;

    container.appendChild(div);
  });
}

// redirect
function goToFix(error) {
  localStorage.setItem("selected_error", JSON.stringify(error));
  window.location.href = "fix.html";
}

function goToFixDemo() {
  window.location.href = "fix.html";
}

function showPopup() {
  const popup = document.getElementById("popup");

  popup.classList.remove("hidden");

  setTimeout(() => {
    popup.classList.add("show");
  }, 50);

  setTimeout(() => {
    popup.classList.remove("show");
    setTimeout(() => popup.classList.add("hidden"), 300);
  }, 5000);
}

let polling = setInterval(async () => {
  if (document.hidden) return;

  try {
    const res = await fetch("http://localhost:5000/errors");
    const data = await res.json();

    if (data && data.length > 0) {
      showPopup();
    }
  } catch (e) {
    console.error("Polling error:", e);
  }
}, 5000);