// ---------- Supabase init ----------
const client = supabase.createClient(
  "https://kuaktnqhsylhvmkjlcpr.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt1YWt0bnFoc3lsaHZta2psY3ByIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM1MjgxNDQsImV4cCI6MjA3OTEwNDE0NH0.sEvEJ8Sps7-IKEmim61S4yVilZmQ0ph4FD1l3aq6nu0"
);

// ---------- STATE ----------
let currentUserId = null;
let currentUserUid = null;
let recognition = null;
let currentTool = "grammar";

// Separate chat histories
let grammarHistory = [];
let wordHistory = [];

// Friends overlay state
let activeOverlayFriend = null;
let messagesPoll = null;

// ---------- DOM ELEMENTS ----------

// Page sections
const pages = {
  login: document.getElementById("login"),
  signup: document.getElementById("signup"),
  dashboard: document.getElementById("dashboard"),
};

// Navigation links
const goSignup = document.getElementById("go-signup");
const goLogin = document.getElementById("go-login");

// Auth buttons
const loginBtn = document.getElementById("login-btn");
const signupBtn = document.getElementById("signup-btn");
const logoutBtn = document.getElementById("logout-btn");

// Messages
const loginMsg = document.getElementById("login-msg");
const signupMsg = document.getElementById("signup-msg");
const welcomeMsg = document.getElementById("welcome-msg");

// Profile
const avatar = document.getElementById("user-avatar");

// Grammar overlay trigger
const openGrammarBtn = document.getElementById("open-grammar-btn");

// Overlay + panel
const grammarOverlay = document.getElementById("grammar-overlay");
const backArrow = document.getElementById("back-arrow");

// Chat elements (grammar)
const grammarChat = document.getElementById("grammar-chat");
const grammarInput = document.getElementById("grammar-input");
const grammarSendBtn = document.getElementById("grammar-send-btn");
const grammarStatus = document.getElementById("grammar-status");
const micBtn = document.getElementById("mic-btn");

// Tool buttons
const toolGrammarBtn = document.getElementById("tool-grammar");
const toolWordsBtn = document.getElementById("tool-words");

// Clear chat
const clearChatBtn = document.getElementById("clear-chat-btn");

// Friends overlay DOM
const openFriendsBtn = document.getElementById("open-friends-btn");
const friendsOverlay = document.getElementById("friends-overlay");
const friendsBackArrow = document.getElementById("friends-back-arrow");

const overlayFriendsList = document.getElementById("overlay-friends-list");
const overlayChatPanel = document.getElementById("overlay-chat-panel");
const overlayChatWithName = document.getElementById("overlay-chat-with-name");
const overlayChatMessages = document.getElementById("overlay-chat-messages");
const overlayChatInput = document.getElementById("overlay-chat-input");
const overlayChatSendBtn = document.getElementById("overlay-chat-send-btn");
const overlayCloseChat = document.getElementById("overlay-close-chat");

// ---------- HELPERS ----------
function showPage(name) {
  Object.values(pages).forEach((p) => p.classList.remove("active"));
  pages[name].classList.add("active");
}

function setAvatar() {
  if (!currentUserId) return;
  avatar.textContent = currentUserId.charAt(0).toUpperCase();
  welcomeMsg.textContent = `Welcome, ${currentUserId}!`;
}

// ---------- CHAT MGMT (Grammar) ----------
function renderChat() {
  const history = currentTool === "grammar" ? grammarHistory : wordHistory;

  grammarChat.innerHTML = "";
  history.forEach((msg) => {
    const div = document.createElement("div");
    div.className = `chat-bubble ${msg.role}`;
    div.innerHTML = msg.html;
    grammarChat.appendChild(div);
  });

  grammarChat.scrollTop = grammarChat.scrollHeight;
}

function addBubble(role, html) {
  const msg = { role, html };

  if (currentTool === "grammar") {
    grammarHistory.push(msg);
  } else {
    wordHistory.push(msg);
  }

  renderChat();
}

function resetGrammarUI() {
  grammarHistory = [];
  wordHistory = [];
  grammarInput.value = "";
  grammarStatus.textContent = "";
  grammarChat.innerHTML = "";
}

// ---------- TOOL SWITCH ----------
function setTool(tool) {
  currentTool = tool;

  if (tool === "grammar") {
    toolGrammarBtn.classList.add("active");
    toolWordsBtn.classList.remove("active");
    grammarSendBtn.textContent = "Check";
    grammarInput.placeholder =
      "Type your sentence here. Enter = check, Shift+Enter = new line.";
  } else {
    toolWordsBtn.classList.add("active");
    toolGrammarBtn.classList.remove("active");
    grammarSendBtn.textContent = "Find words";
    grammarInput.placeholder =
      'Type your question. Example: "What do we call a word that shows future?"';
  }

  renderChat();
}

// ---------- AUTH ----------
goSignup.addEventListener("click", () => showPage("signup"));
goLogin.addEventListener("click", () => showPage("login"));

signupBtn.addEventListener("click", async () => {
  const userId = document.getElementById("signup-id").value.trim();
  const email = document.getElementById("signup-email").value.trim();
  const password = document.getElementById("signup-password").value;

  signupMsg.textContent = "";

  if (!userId || !email || !password) {
    signupMsg.textContent = "Fill all fields";
    return;
  }

  const { data, error } = await client.auth.signUp({ email, password });

  if (error) {
    signupMsg.textContent = error.message;
    return;
  }

  const user = data.user;

  await client.from("user_ids").insert({
    id: user.id,
    user_code: userId,
    email,
  });

  signupMsg.textContent = "Account created!";
  setTimeout(() => {
    showPage("login");
  }, 600);
});

loginBtn.addEventListener("click", async () => {
  const userId = document.getElementById("login-id").value.trim();
  const password = document.getElementById("login-password").value;

  loginMsg.textContent = "";

  if (!userId || !password) {
    loginMsg.textContent = "Fill all fields";
    return;
  }

  const { data: row, error } = await client
    .from("user_ids")
    .select("email")
    .eq("user_code", userId)
    .single();

  if (error || !row) {
    loginMsg.textContent = "User ID not found";
    return;
  }

  const { data: loginData, error: loginError } =
    await client.auth.signInWithPassword({
      email: row.email,
      password,
    });

  if (loginError) {
    loginMsg.textContent = "Invalid password";
    return;
  }

  currentUserId = userId; // your short user code
  currentUserUid = loginData.user.id; // real Supabase uid
  setAvatar();

  loginMsg.textContent = "Login successful!";
  setTimeout(() => {
    showPage("dashboard");
    // friends list is loaded only inside overlay now
  }, 400);
});

logoutBtn.addEventListener("click", async () => {
  await client.auth.signOut();
  currentUserId = null;
  currentUserUid = null;
  showPage("login");
});

// ---------- GRAMMAR OVERLAY OPEN/CLOSE ----------
openGrammarBtn.addEventListener("click", () => {
  grammarOverlay.classList.remove("hidden");
  resetGrammarUI();
  setTool("grammar");
  grammarInput.focus();
});

backArrow.addEventListener("click", () => {
  grammarOverlay.classList.add("hidden");
});

// ---------- GRAMMAR TEXT SUBMIT ----------
grammarSendBtn.addEventListener("click", submitText);

grammarInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    submitText();
  }
});

function submitText() {
  const text = grammarInput.value.trim();
  let cleanedText = removePunctuation(text);
  if (!text) {
    grammarStatus.textContent = "Please type something.";
    return;
  }

  grammarInput.value = "";
  grammarStatus.textContent = "";

  addBubble(
    "user",
    `<span class="label">You</span><div>${escapeHtml(text)}</div>`
  );

  if (currentTool === "grammar") {
    runGrammarCheck(cleanedText);
  } else {
    runWordFinder(cleanedText);
  }
}

function filterIgnoredGrammarIssues(issues) {
  if (!issues || !Array.isArray(issues)) return issues;

  return issues.filter((issue) => {
    const lower = issue.toLowerCase();

    if (lower.includes("punctuation")) return false;
    if (lower.includes("comma")) return false;
    if (lower.includes("period")) return false;
    if (lower.includes("full stop")) return false;
    if (lower.includes("question mark")) return false;
    if (lower.includes("exclamation")) return false;

    if (lower.includes("capitalization")) return false;

    if (lower.includes("spacing")) return false;
    if (lower.includes("formatting")) return false;

    return true;
  });
}

// ---------- MIC / SPEECH RECOGNITION ----------
function initSpeech() {
  const SpeechRecognition =
    window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    alert("Speech recognition not supported in this browser.");
    return null;
  }

  const recog = new SpeechRecognition();
  recog.lang = "en-US";
  recog.interimResults = false;

  recog.onstart = () => {
    grammarStatus.textContent = "Listening...";
    micBtn.classList.add("listening");
  };

  recog.onerror = (e) => {
    grammarStatus.textContent = "Mic error: " + e.error;
    micBtn.classList.remove("listening");
  };

  recog.onend = () => {
    micBtn.classList.remove("listening");
  };

  recog.onresult = (event) => {
    const text = event.results[0][0].transcript;
    grammarInput.value = text;
    grammarInput.focus();
    grammarStatus.textContent = "Press Enter or click the button to send.";
  };

  return recog;
}

micBtn.addEventListener("click", () => {
  if (!recognition) {
    recognition = initSpeech();
  }
  if (recognition) {
    recognition.start();
  }
});

function removePunctuation(text) {
  return text.replace(/[.,\/#!?$%\^&\*;:{}=\-_`~()]/g, "");
}

// ---------- API CALLS ----------
async function runGrammarCheck(text) {
  grammarStatus.textContent = "Checking grammar...";

  try {
    const res = await fetch("/api/grammar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });

    const data = await res.json();

    if (!res.ok) {
      grammarStatus.textContent = "Error checking grammar.";
      return;
    }

    const filteredIssues = filterIgnoredGrammarIssues(data.issues);

    const issuesHtml =
      filteredIssues && filteredIssues.length
        ? `<div style="margin-top:6px;">
             <strong>Issues found:</strong>
             <ul>${filteredIssues
               .map((i) => `<li>${escapeHtml(i)}</li>`)
               .join("")}</ul>
           </div>`
        : `<div style="margin-top:6px;">All good! No major issues found.</div>`;

    const html = `
      <span class="label">Grammar coach</span>
      <div><strong>Grammar score:</strong> ${data.correctPercent}% 
      (needs fixes: ${data.wrongPercent}%)</div>
      <div style="margin-top:6px;">
        <strong>Corrected sentence:</strong><br>${escapeHtml(data.corrected)}
      </div>
      ${issuesHtml}
    `;

    addBubble("bot", html);
    grammarStatus.textContent = "";
  } catch (err) {
    console.error(err);
    grammarStatus.textContent = "Server error.";
  }
}

async function runWordFinder(text) {
  grammarStatus.textContent = "Finding words...";

  try {
    const res = await fetch("/api/words", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });

    const data = await res.json();

    if (!res.ok) {
      grammarStatus.textContent = "Error finding words.";
      return;
    }

    const html = `
      <span class="label">Word coach</span>
      <div><strong>Informal:</strong></div>
      <ul>${data.informal
        .map((w) => `<li>${escapeHtml(w)}</li>`)
        .join("")}</ul>
      <div><strong>Formal:</strong></div>
      <ul>${data.formal
        .map((w) => `<li>${escapeHtml(w)}</li>`)
        .join("")}</ul>
      ${
        data.notes
          ? `<div style="margin-top:8px; font-style:italic;">${escapeHtml(
              data.notes
            )}</div>`
          : ""
      }
    `;

    addBubble("bot", html);
    grammarStatus.textContent = "";
  } catch (err) {
    console.error(err);
    grammarStatus.textContent = "Server error.";
  }
}

// ---------- TOOL BUTTON HANDLERS ----------
toolGrammarBtn.addEventListener("click", () => setTool("grammar"));
toolWordsBtn.addEventListener("click", () => setTool("words"));

// ---------- CLEAR CHAT ----------
clearChatBtn.addEventListener("click", () => {
  if (currentTool === "grammar") {
    grammarHistory = [];
  } else {
    wordHistory = [];
  }
  renderChat();
});

// ---------- UTIL ----------
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ---------- FRIENDS OVERLAY LOGIC ----------
openFriendsBtn.addEventListener("click", () => {
  if (!currentUserUid) {
    alert("Please log in first.");
    return;
  }
  friendsOverlay.classList.remove("hidden");
  loadOverlayFriends();
});

friendsBackArrow.addEventListener("click", () => {
  friendsOverlay.classList.add("hidden");
  overlayChatPanel.classList.add("hidden");
  overlayChatMessages.innerHTML = "";
  activeOverlayFriend = null;
  if (messagesPoll) {
    clearInterval(messagesPoll);
    messagesPoll = null;
  }
});

async function loadOverlayFriends() {
  const { data, error } = await client
    .from("user_ids")
    .select("id, user_code")
    .neq("user_code", currentUserId);

  overlayFriendsList.innerHTML = "";

  if (error) {
    console.error("loadOverlayFriends error:", error);
    overlayFriendsList.innerHTML = "<li>Error loading users</li>";
    return;
  }

  if (!data || !data.length) {
    overlayFriendsList.innerHTML = "<li>No other users</li>";
    return;
  }

  data.forEach((u) => {
    const li = document.createElement("li");
    li.textContent = u.user_code;
    li.className = "friend-item";
    li.addEventListener("click", () => openOverlayChat(u));
    overlayFriendsList.appendChild(li);
  });
}

async function openOverlayChat(friend) {
  activeOverlayFriend = friend;
  overlayChatPanel.classList.remove("hidden");
  overlayChatWithName.textContent = friend.user_code;

  await loadOverlayMessages(friend.id);

  if (messagesPoll) clearInterval(messagesPoll);
  messagesPoll = setInterval(() => loadOverlayMessages(friend.id), 3000);
}

overlayCloseChat.addEventListener("click", () => {
  overlayChatPanel.classList.add("hidden");
  overlayChatMessages.innerHTML = "";
  activeOverlayFriend = null;
  if (messagesPoll) {
    clearInterval(messagesPoll);
    messagesPoll = null;
  }
});

async function loadOverlayMessages(friendId) {
  if (!currentUserUid || !friendId) return;

  const { data, error } = await client
    .from("messages")
    .select("id, sender_id, receiver_id, content, created_at")
    .or(
      `and(sender_id.eq.${currentUserUid},receiver_id.eq.${friendId}),` +
        `and(sender_id.eq.${friendId},receiver_id.eq.${currentUserUid})`
    )
    .order("created_at", { ascending: true });

  overlayChatMessages.innerHTML = "";

  if (error) {
    console.error("loadOverlayMessages error:", error);
    return;
  }

  data.forEach((msg) => {
    const mine = msg.sender_id === currentUserUid;
    const div = document.createElement("div");
    div.className = mine ? "chat-msg me" : "chat-msg them";
    div.textContent = msg.content;
    overlayChatMessages.appendChild(div);
  });

  overlayChatMessages.scrollTop = overlayChatMessages.scrollHeight;
}

overlayChatSendBtn.addEventListener("click", sendOverlayMessage);

overlayChatInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    sendOverlayMessage();
  }
});

async function sendOverlayMessage() {
  const text = overlayChatInput.value.trim();
  if (!text || !activeOverlayFriend || !currentUserUid) return;

  overlayChatInput.value = "";

  // 1️⃣ Send the actual chat message
  await client.from("messages").insert({
    sender_id: currentUserUid,
    receiver_id: activeOverlayFriend.id,
    content: text,
  });

  // 2️⃣ AUTOMATIC GRAMMAR CHECK
  const grammarResult = await checkGrammarInChat(text);

  if (grammarResult) {
    await client.from("messages").insert({
      sender_id: currentUserUid,  // message from you (AI-like)
      receiver_id: activeOverlayFriend.id,
      content: grammarResult,
    });
  }

  loadOverlayMessages(activeOverlayFriend.id);
}

async function checkGrammarInChat(text) {
  try {
    const res = await fetch("/api/grammar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });

    const data = await res.json();
    if (!res.ok) return null;

    const filtered = filterIgnoredGrammarIssues(data.issues);

    return `
      🔎 *Grammar Check Result*
      Corrected: ${data.corrected}
      Score: ${data.correctPercent}% 
      Issues:
      ${filtered.length ? filtered.map(i => `• ${i}`).join("\n") : "No major issues!"}
    `;
  } catch (err) {
    console.error(err);
    return null;
  }
}
