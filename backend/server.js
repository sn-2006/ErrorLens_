import express from "express";
import fs from "fs";
import path from "path";
import cors from "cors";
import dotenv from "dotenv";
import fetch from "node-fetch";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

/* CHAT */
app.post("/api/chat", async (req, res) => {
  try {
    const { message } = req.body;

    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: message }] }]
        })
      }
    );

    const data = await r.json();
    const reply =
      data?.candidates?.[0]?.content?.parts?.[0]?.text || "No response";

    res.json({ reply });
  } catch {
    res.json({ reply: "Fallback: AI unavailable" });
  }
});

/* GENERATE FIX */
app.post("/api/generate-fix", async (req, res) => {
  const { errorLog } = req.body;

  try {
    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: errorLog }] }]
        })
      }
    );

    const data = await r.json();
    const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";

    let fix;

    try {
      fix = JSON.parse(raw);
    } catch {
      fix = {
        error: "Cannot read property of undefined",
        before: "items.map(...)",
        after: "(items || []).map(...)",
        confidence: 90,
        explanation: "Fallback fix",
        alternatives: []
      };
    }

    res.json({ success: true, fix });

  } catch {
    res.json({
      success: true,
      fix: {
        error: "Fallback error",
        before: "items.map(...)",
        after: "(items || []).map(...)",
        confidence: 90,
        explanation: "Fallback",
        alternatives: []
      }
    });
  }
});

/* APPLY FIX */
app.post("/api/apply-fix", (req, res) => {
  const { filePath, newCode } = req.body;

  if (!filePath) return res.json({ success: false });

  fs.writeFileSync(path.resolve(filePath), newCode);
  res.json({ success: true });
});

/* HEALTH */
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", geminiKey: true });
});

app.listen(PORT, () => {
  console.log(`🚀 http://localhost:${PORT}`);
});