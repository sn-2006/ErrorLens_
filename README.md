# ⚡ AutoFix Pipeline

> GitHub CI logs → Gemini AI → Fix suggestion → UI preview → Apply → Git commit

---

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Set your Gemini API key
export GEMINI_API_KEY="your-key-here"

# 3. (Optional) Set repo root for git commits
export REPO_ROOT="/path/to/your/repo"

# 4. Start the server
npm start          # production
npm run dev        # watch mode (Node 18+)
```

Open `http://localhost:3001` — the fix.html UI is served from `/public`.

---

## API Endpoints

| Method | Route | Description |
|--------|-------|-------------|
| `POST` | `/api/generate-fix` | Send error log → get fix JSON from Gemini |
| `POST` | `/api/preview-fix`  | Check if snippet exists in file (dry run) |
| `POST` | `/api/apply-fix`    | Apply fix to file (with auto-backup) |
| `POST` | `/api/restore-backup` | Roll back to pre-fix state |
| `POST` | `/api/commit-fix`   | Git commit + optional PR via `gh` CLI |
| `GET`  | `/api/health`       | Health check |

### `POST /api/generate-fix`
```json
{
  "errorLog": "TypeError: Cannot read properties...",
  "filePath": "src/App.js",
  "fileContent": "optional file contents for better context"
}
```
Returns:
```json
{
  "success": true,
  "fix": {
    "error": "One-line explanation",
    "before": "faulty code snippet",
    "after": "fixed code snippet",
    "confidence": 91,
    "lineHint": 42,
    "explanation": "Why this fix works",
    "alternatives": [
      { "label": "Option A: ...", "code": "..." },
      { "label": "Option B: ...", "code": "..." }
    ]
  }
}
```

### `POST /api/apply-fix`
```json
{
  "filePath": "src/App.js",
  "oldCode": "const x = ;",
  "newCode": "const x = 10;",
  "lineNumber": 42
}
```
- Always backs up the file first (`file.backup_<timestamp>`)
- Tries snippet match first; falls back to line-based replacement
- Returns `{ success, backupPath, strategy }`

---

## GitHub Actions Integration

Add to your repo:
```
.github/workflows/autofix.yml   ← already included
```

Set these secrets in your GitHub repo:
- `AUTOFIX_URL` — URL of your running server (e.g. Render, Railway, EC2)
- `AUTOFIX_KEY` — Optional bearer token for auth

The workflow:
1. Triggers when your CI workflow **fails**
2. Downloads the CI run logs
3. Sends them to `/api/generate-fix`
4. Auto-applies the fix if confidence ≥ 85%
5. Saves the fix result as a downloadable artifact

---

## Safety Rules

| Rule | Implementation |
|------|---------------|
| Never overwrite blindly | Snippet match → line match → abort |
| Always backup | `file.backup_<ts>` created before any write |
| Preview before apply | `/api/preview-fix` for dry run |
| Confidence threshold | CI only auto-applies at ≥ 85% |
| Restore in one click | `/api/restore-backup` |

---

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `GEMINI_API_KEY` | ✅ | — | Google Gemini API key |
| `PORT` | ❌ | `3001` | Server port |
| `REPO_ROOT` | ❌ | `process.cwd()` | Root for git commands |
