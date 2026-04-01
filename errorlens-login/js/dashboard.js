const token = localStorage.getItem("github_token");

// Redirect if not logged in
if (!token) {
  window.location.href = "login.html";
}

// ===== STEP 1: GET REPOS =====
fetch("https://api.github.com/user/repos", {
  headers: {
    Authorization: `token ${token}`
  }
})
.then(res => res.json())
.then(repos => {
  console.log("Repos:", repos);

  if (repos.length === 0) return;

  const repo = repos[0]; // take first repo for now
  loadActions(repo.owner.login, repo.name);
});

// ===== STEP 2: GET ACTIONS =====
function loadActions(owner, repo) {
  fetch(`https://api.github.com/repos/${owner}/${repo}/actions/runs`, {
    headers: {
      Authorization: `token ${token}`
    }
  })
  .then(res => res.json())
  .then(data => {
    console.log("Runs:", data);

    const runs = data.workflow_runs;

    if (!runs || runs.length === 0) return;

    const failed = runs.filter(r => r.conclusion === "failure");

    updateUI(runs.length, failed.length);

    if (failed.length > 0) {
      loadLogs(owner, repo, failed[0].id);
    }
  });
}

// ===== STEP 3: GET LOGS =====
function loadLogs(owner, repo, runId) {
  fetch(`https://api.github.com/repos/${owner}/${repo}/actions/runs/${runId}/logs`, {
    headers: {
      Authorization: `token ${token}`
    }
  })
  .then(res => res.blob())
  .then(blob => {
    console.log("Logs ZIP:", blob);
  });
}

// ===== UPDATE UI =====
function updateUI(totalRuns, failedRuns) {
  document.querySelectorAll(".stat-value")[0].innerText = failedRuns;
  document.querySelectorAll(".stat-value")[1].innerText = totalRuns;
}