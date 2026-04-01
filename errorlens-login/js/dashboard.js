/* ═══════════════════════════════════════════════
   ErrorLens — Dashboard Script (Backend Ready)
═══════════════════════════════════════════════ */

const BASE_URL = "https://focusable-crowdedly-audra.ngrok-free.dev";

'use strict';

// ─── STATE ────────────────────────────────────
let repos = [];
let selectedRepo = null;

// ─── DOM REFS ─────────────────────────────────
const pageRepos = document.getElementById('pageRepos');
const pageAnalyze = document.getElementById('pageAnalyze');
const repoGrid = document.getElementById('repoGrid');
const searchInput = document.getElementById('searchInput');
const searchCount = document.getElementById('searchCount');
const emptyState = document.getElementById('emptyState');
const backBtn = document.getElementById('backBtn');
const navBreadcrumb = document.getElementById('navBreadcrumb');

const selectedRepoName = document.getElementById('selectedRepoName');
const selectedRepoLang = document.getElementById('selectedRepoLang');
const termRepoName = document.getElementById('termRepoName');
const analyzeBtn = document.getElementById('analyzeBtn');
const resultArea = document.getElementById('resultArea');
const spinnerWrap = document.getElementById('spinnerWrap');
const resultText = document.getElementById('resultText');
const terminalBody = document.getElementById('terminalBody');

// ─── FETCH REPOS ──────────────────────────────
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

// ─── RENDER REPOS ─────────────────────────────
function createRepoCard(repo) {
  const card = document.createElement('div');
  card.className = 'repo-card';

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

  card.onclick = () => handleRepoSelect(repo);

  card.querySelector('.btn-select').onclick = (e) => {
    e.stopPropagation();
    handleRepoSelect(repo);
  };

  return card;
}

function renderRepos(list) {
  repoGrid.innerHTML = '';

  if (!list.length) {
    emptyState.classList.remove('hidden');
    searchCount.textContent = '0 repos';
    return;
  }

  emptyState.classList.add('hidden');
  searchCount.textContent = `${list.length} repos`;

  list.forEach(repo => {
    repoGrid.appendChild(createRepoCard(repo));
  });
}

// ─── SEARCH ───────────────────────────────────
searchInput.addEventListener('input', () => {
  const q = searchInput.value.toLowerCase();

  const filtered = repos.filter(r =>
    r.name.toLowerCase().includes(q) ||
    r.description.toLowerCase().includes(q) ||
    r.language.toLowerCase().includes(q)
  );

  renderRepos(filtered);
});

// ─── NAVIGATION ───────────────────────────────
function showPage(page) {
  pageRepos.classList.add('hidden');
  pageAnalyze.classList.add('hidden');
  page.classList.remove('hidden');
}

function setBreadcrumb(arr) {
  navBreadcrumb.innerHTML = arr.join(' / ');
}

// ─── SELECT REPO ──────────────────────────────
function handleRepoSelect(repo) {
  selectedRepo = repo;

  localStorage.setItem("selected_repo", repo.full_name);

  console.log("Selected repo:", repo.full_name);

  selectedRepoName.textContent = repo.name;
  selectedRepoLang.textContent = repo.language;
  termRepoName.textContent = repo.name;

  terminalBody.innerHTML = `<span>$ analyzing ${repo.name}...</span>`;

  resultArea.classList.add('hidden');
  spinnerWrap.classList.remove('hidden');

  setBreadcrumb(['Dashboard', 'Repositories', repo.name]);
  showPage(pageAnalyze);
}

// ─── BACK ─────────────────────────────────────
backBtn.onclick = () => {
  setBreadcrumb(['Dashboard', 'Repositories']);
  showPage(pageRepos);
};

// ─── ANALYZE ──────────────────────────────────
analyzeBtn.onclick = runAnalysis;

async function runAnalysis() {
  if (!resultText) {
    console.error("❌ resultText element missing in HTML");
    return;
  }

  spinnerWrap.classList.remove('hidden');
  resultArea.classList.remove('hidden');

  resultText.innerText = "🔄 Fetching AI Analysis from backend...";

  try {
    const repoFullName = localStorage.getItem("selected_repo");

    if (!repoFullName) {
      throw new Error("No repo selected");
    }

    const [owner, repoName] = repoFullName.split("/");

    console.log("Fetching:", owner, repoName);

    const response = await fetch(
      `${BASE_URL}/webhook/get-analysis/${owner}/${repoName}`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "ngrok-skip-browser-warning": "69420"
        },
        cache: "no-store"
      }
    );

    if (!response.ok) {
      throw new Error(`Server error: ${response.status}`);
    }

    const data = await response.json();

    console.log("✅ Backend response:", data);

    spinnerWrap.classList.add('hidden');
    document.getElementById("resultMsg").classList.remove("hidden");

    // ─── SHOW ANALYSIS ───────────────────────
    resultText.innerHTML = `
      <div style="padding:15px;">
        <h3>🤖 AI Diagnosis</h3>
        <pre style="white-space: pre-wrap;">
${data.aiAnalysis || "No analysis found"}
        </pre>
      </div>
    `;
    
    // ─── FIX BUTTON ──────────────────────────
    const fixBtn = document.createElement("button");
    fixBtn.className = "btn-primary";
    fixBtn.style.marginTop = "16px";
    fixBtn.innerHTML = `<span class="btn-icon">⎇</span><span>Go to Fix Page</span>`;

    fixBtn.onclick = () => {
        window.location.href = `fix.html?repo=${encodeURIComponent(repoFullName)}`;
    };

resultText.appendChild(fixBtn);

  } catch (error) {
    spinnerWrap.classList.add('hidden');
    console.error("Analysis failed:", error);

    resultText.innerHTML = `
      <p style="color:red;">❌ ${error.message}</p>
    `;
  }
}

// ─── HELPERS ──────────────────────────────────
function escapeHTML(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// ─── INIT ─────────────────────────────────────
(async function init() {
  setBreadcrumb(['Dashboard', 'Repositories']);
  repos = await fetchGitHubRepos();
  renderRepos(repos);

  try {
    const user = JSON.parse(localStorage.getItem("github_user"));
    if (user) {
      document.getElementById("username").textContent = user.login;
      document.getElementById("userAvatar").src = user.avatar_url;
    }
  } catch {}
})();