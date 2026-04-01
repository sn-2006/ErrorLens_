import fetch from "node-fetch";

import express from "express";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 10000; // Render-friendly

// ✅ SINGLE clean route
app.post("/api/chat", async (req, res) => {
  try {
    const { message } = req.body;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text: message }]
            }
          ]
        })
      }
    );

    const data = await response.json();

    // 🔥 DEBUG
    console.log("GEMINI RESPONSE:", JSON.stringify(data, null, 2));

    const reply =
      data?.candidates?.[0]?.content?.parts?.[0]?.text ||
      "No response";

    res.json({ reply });

  } catch (err) {
    console.error("SERVER ERROR:", err);
    res.status(500).json({ reply: "Server error" });
  }
});

// Other routes (unchanged)
app.get('/api/repo', (req, res) => {
  res.json({ name: "ErrorLens Demo Repo" });
});

app.get('/api/errors', (req, res) => {
  res.json([
    {
      severity: "critical",
      title: "Null pointer exception",
      cause: "Variable is undefined",
      file: "app.js",
      fixable: true,
      fixIndex: 0
    }
  ]);
});

app.get('/api/fixes', (req, res) => {
  res.json([
    {
      fileBefore: "app.js",
      fileAfter: "app.js",
      explanation: "Added null check",
      confidence: "95%",
      before: [],
      after: []
    }
  ]);
});

app.listen(PORT, () => {
  console.log(`Server running on ${PORT}`);
});