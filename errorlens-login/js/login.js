// ===== IMPORTS =====
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, GithubAuthProvider, signInWithPopup } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

// ===== CONFIG =====
const firebaseConfig = {
  apiKey: "AIzaSyCnwuXN7C6dpZFH9jikIbryo57F1pNh14s",
  authDomain: "errorlens-7133f.firebaseapp.com",
  projectId: "errorlens-7133f",
  storageBucket: "errorlens-7133f.appspot.com",
  messagingSenderId: "49084338937",
  appId: "1:49084338937:web:4d030ab5f6dcc2572c4828"
};

// ===== INIT =====
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// ===== PROVIDER =====
const provider = new GithubAuthProvider();
provider.addScope("repo");
provider.addScope("workflow");

// ===== CLICK HANDLER =====
document.addEventListener("DOMContentLoaded", () => {
  const btn = document.getElementById("githubBtn");

  if (!btn) {
    alert("GitHub button not found ❌");
    return;
  }

  btn.addEventListener("click", async () => {
    try {
      const result = await signInWithPopup(auth, provider);

      const credential = GithubAuthProvider.credentialFromResult(result);
      const token = credential?.accessToken;

      localStorage.setItem("github_token", token || "");
      localStorage.setItem("user", result.user?.displayName || "User");

      window.location.href = "dashboard.html";
    } catch (e) {
      alert("Login error: " + e.message);
    }
  });
});

if (!btn) {
  alert("GitHub button not found ❌");
} else {
  btn.addEventListener("click", async () => {
    try {
      // This must run DIRECTLY on click (user gesture) for popup to open
      const result = await signInWithPopup(auth, provider);

      const credential = GithubAuthProvider.credentialFromResult(result);
      const token = credential?.accessToken;

      localStorage.setItem("github_token", token || "");
      localStorage.setItem("user", result.user?.displayName || "User");

      window.location.href = "dashboard.html";
    } catch (e) {
      alert("Login error: " + e.message);
    }
  });
}

console.log("Login started");