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

// Jam session text state
let jamTypedText = "";      // snapshot of text before current mic session
let jamSpeechFinal = "";    // final speech from CURRENT mic session
let jamSpeechInterim = "";  // current interim from mic
let jamStarted = false;
let jamSecondsLeft = 600; // 10 minutes
let jamTimerInterval = null;
let jamRecognition = null;
let jamMicActive = false;

// Grammar Lab speech state (same behavior as Jam)
let grammarTypedText = "";
let grammarSpeechFinal = "";
let grammarSpeechInterim = "";
let grammarRecognition = null;
let grammarMicActive = false;

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
const overlayClearChat = document.getElementById("overlay-clear-chat");


// Jam Session overlay DOM
const openJamBtn = document.getElementById("open-jam-btn");
const jamOverlay = document.getElementById("jam-overlay");
const jamBackArrow = document.getElementById("jam-back-arrow");
const jamTopicSelect = document.getElementById("jam-topic-select");
const jamCustomTopicInput = document.getElementById("jam-custom-topic");
const jamTimerDisplay = document.getElementById("jam-timer");
const jamTextInput = document.getElementById("jam-text-input");
const jamMicBtn = document.getElementById("jam-mic-btn");
const jamSubmitBtn = document.getElementById("jam-submit-btn");
const jamStatus = document.getElementById("jam-status");
const jamResults = document.getElementById("jam-results");
const jamRefreshBtn = document.getElementById("jam-refresh-btn");


if (jamRefreshBtn) {
  jamRefreshBtn.addEventListener("click", () => {
    resetJamUI();
    jamTopicSelect.value = "";
    jamCustomTopicInput.value = "";
    jamStatus.textContent = "Start by selecting a topic.";
  });
}

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

// ---------- JAM HELPERS ----------
function isJamTopicSelected() {
  if (!jamTopicSelect || !jamCustomTopicInput) return false;
  const baseTopic = jamTopicSelect.value;
  const customTopic = jamCustomTopicInput.value.trim();
  return baseTopic !== "" || customTopic.length > 0;
}

function formatJamTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

// Enable/disable jam textarea + mic based on topic selection
function updateJamControls() {
  if (!jamTextInput || !jamMicBtn) return;
  const enabled = isJamTopicSelected();

  jamTextInput.disabled = !enabled;
  jamMicBtn.disabled = !enabled;

  if (!enabled) {
    // Reset jam content when no topic
    jamTypedText = "";
    jamSpeechFinal = "";
    jamSpeechInterim = "";
    jamTextInput.value = "";
    jamSecondsLeft = 600;
    jamStarted = false;
    if (jamTimerInterval) {
      clearInterval(jamTimerInterval);
      jamTimerInterval = null;
    }
    jamTimerDisplay.textContent = "10:00";
    jamStatus.textContent = "Please select or type a topic to start your jam.";
    stopJamRecognition();
  } else {
    jamStatus.textContent = "";
  }
}

function resetJamUI() {
  jamStarted = false;
  jamSecondsLeft = 600;
  jamTypedText = "";
  jamSpeechFinal = "";
  jamSpeechInterim = "";

  if (jamTimerInterval) {
    clearInterval(jamTimerInterval);
    jamTimerInterval = null;
  }
  jamMicActive = false;
  if (jamMicBtn) jamMicBtn.classList.remove("listening");
  if (jamTextInput) jamTextInput.value = "";
  if (jamResults) jamResults.innerHTML = "";
  if (jamStatus) jamStatus.textContent = "";
  if (jamTimerDisplay) jamTimerDisplay.textContent = "10:00";

  stopJamRecognition();
  updateJamControls();
}

function startJamTimer() {
  if (jamStarted) return;
  jamStarted = true;
  jamTimerDisplay.textContent = formatJamTime(jamSecondsLeft);

  jamTimerInterval = setInterval(() => {
    jamSecondsLeft--;
    if (jamSecondsLeft < 0) jamSecondsLeft = 0;
    jamTimerDisplay.textContent = formatJamTime(jamSecondsLeft);

    if (jamSecondsLeft <= 0) {
      clearInterval(jamTimerInterval);
      jamTimerInterval = null;
      jamStatus.textContent =
        "Time's up! You can still submit your jam for feedback.";
      stopJamRecognition();
    }
  }, 1000);
}

// ---------- JAM SPEECH RECOGNITION ----------

function initJamSpeech() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) {
    alert("Speech recognition not supported in this browser.");
    return null;
  }

  const recog = new SR();
  recog.lang = "en-US";
  recog.interimResults = true;
  recog.continuous = true;

  recog.lastProcessed = -1;

  recog.onstart = () => {
    recog.lastProcessed = -1;
    jamStatus.textContent = "Listening...";
    jamMicBtn.classList.add("listening");
  };

  recog.onerror = (e) => {
    jamStatus.textContent = "Mic error: " + e.error;
    jamMicBtn.classList.remove("listening");
    jamMicActive = false;
  };

  recog.onend = () => {
    jamMicBtn.classList.remove("listening");
    jamMicActive = false;
  };

  recog.onresult = (event) => {
    let interim = "";

    for (let i = recog.lastProcessed + 1; i < event.results.length; i++) {
      const result = event.results[i];
      const text = result[0].transcript;

      if (result.isFinal) {
        jamSpeechFinal += text + " ";
        recog.lastProcessed = i;
      } else {
        interim = text;
      }
    }

    jamSpeechInterim = interim;

    jamTextInput.value = (
      jamTypedText +
      " " +
      jamSpeechFinal +
      " " +
      jamSpeechInterim
    ).trim();
  };

  return recog;
}

function stopJamRecognition() {
  if (jamRecognition) {
    try {
      jamRecognition.onresult = null;
      jamRecognition.onerror = null;
      jamRecognition.onend = null;
      jamRecognition.stop();
    } catch (e) {
      console.warn("Error stopping jam mic:", e);
    }
  }

  jamRecognition = null;
  jamMicActive = false;
  jamSpeechInterim = "";

  if (jamMicBtn) jamMicBtn.classList.remove("listening");
  if (jamStatus) jamStatus.textContent = "";   // <-- FIX: clears “Listening…”
}


// ---------- GRAMMAR LAB SPEECH (same behavior) ----------

function initGrammarSpeech() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) {
    alert("Speech recognition not supported in this browser.");
    return null;
  }

  const recog = new SR();
  recog.lang = "en-US";
  recog.interimResults = true;
  recog.continuous = true;

  recog.lastProcessed = -1;

  recog.onstart = () => {
    recog.lastProcessed = -1;
    grammarStatus.textContent = "Listening...";
    micBtn.classList.add("listening");
  };

  recog.onerror = (e) => {
    grammarStatus.textContent = "Mic error: " + e.error;
    micBtn.classList.remove("listening");
    grammarMicActive = false;
  };

  recog.onend = () => {
    micBtn.classList.remove("listening");
    grammarMicActive = false;
     jamMicBtn.classList.remove("listening");
   jamMicActive = false;
  jamStatus.textContent = "";
  };

  recog.onresult = (event) => {
    let interim = "";

    for (let i = recog.lastProcessed + 1; i < event.results.length; i++) {
      const result = event.results[i];
      const text = result[0].transcript;

      if (result.isFinal) {
        grammarSpeechFinal += text + " ";
        recog.lastProcessed = i;
      } else {
        interim = text;
      }
    }

    grammarSpeechInterim = interim;

    grammarInput.value = (
      grammarTypedText +
      " " +
      grammarSpeechFinal +
      " " +
      grammarSpeechInterim
    ).trim();
  };

  return recog;
}

function stopGrammarRecognition() {
  if (grammarRecognition) {
    try {
      grammarRecognition.onresult = null;
      grammarRecognition.onerror = null;
      grammarRecognition.onend = null;
      grammarRecognition.stop();
    } catch (e) {
      console.warn("Error stopping grammar mic:", e);
    }
  }
  grammarRecognition = null;
  grammarMicActive = false;
  grammarSpeechInterim = "";
  if (micBtn) micBtn.classList.remove("listening");
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

// ---------- JAM SESSION OVERLAY OPEN/CLOSE ----------
if (openJamBtn) {
  openJamBtn.addEventListener("click", () => {
    jamOverlay.classList.remove("hidden");
    resetJamUI();
    jamTopicSelect.value = "";          // RESET SELECT
    jamCustomTopicInput.value = "";     // RESET CUSTOM TOPIC
    updateJamControls();
  });
}

if (jamBackArrow) {
  jamBackArrow.addEventListener("click", () => {
    jamOverlay.classList.add("hidden");
    jamStatus.textContent = "";
    if (jamTimerInterval) {
      clearInterval(jamTimerInterval);
      jamTimerInterval = null;
    }
    stopJamRecognition();
  });
}

// Watch topic & custom topic changes to enable/disable controls
if (jamTopicSelect && jamCustomTopicInput) {
  jamTopicSelect.addEventListener("change", () => {
    if (jamTopicSelect.value !== "") {
      jamCustomTopicInput.value = "";  // clear custom topic
    }
    updateJamControls();
  });

  jamCustomTopicInput.addEventListener("input", () => {
    if (jamCustomTopicInput.value.trim().length > 0) {
      jamTopicSelect.value = "";   // force dropdown back to “Select topic”
    }
    updateJamControls();
  });

  updateJamControls(); // initial
}

// Start timer when user starts typing (only if topic selected)
if (jamTextInput) {
  jamTextInput.addEventListener("input", () => {
    if (!isJamTopicSelected()) {
      updateJamControls();
      return;
    }

    // NOTE: we do NOT set jamTypedText here; we only snapshot it when mic starts
    if (!jamStarted && jamTextInput.value.trim().length > 0) {
      startJamTimer();
    }
  });
}

// Mic toggle for JAM (guarded by topic)
if (jamMicBtn) {
  jamMicBtn.addEventListener("click", () => {
    if (!isJamTopicSelected()) {
      jamStatus.textContent = "Please select a topic first.";
      return;
    }

    // Snap current text as baseline for THIS mic session
    jamTypedText = jamTextInput.value.trim();
    jamSpeechFinal = "";
    jamSpeechInterim = "";

    if (!jamStarted) startJamTimer();

    if (!jamMicActive) {
      stopJamRecognition();      // clean old one if any
      jamRecognition = initJamSpeech();
      if (!jamRecognition) return;
      jamMicActive = true;
      jamRecognition.start();
    } else {
      stopJamRecognition();
    }
  });
}

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
  grammarTypedText = "";
  grammarSpeechFinal = "";
  grammarSpeechInterim = "";
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

async function runJamAnalysis(text, topic) {
  let grammarSection = "";

  try {
    const res = await fetch("/api/grammar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });

    const data = await res.json();

    if (res.ok) {
      const filteredIssues = filterIgnoredGrammarIssues(data.issues || []);
      const issuesHtml =
        filteredIssues && filteredIssues.length
          ? `<ul>${filteredIssues
              .map((i) => `<li>${escapeHtml(i)}</li>`)
              .join("")}</ul>`
          : `<div>No major issues detected.</div>`;

      grammarSection = `
        <div><strong>Grammar score:</strong> ${data.correctPercent}% (needs fixes: ${data.wrongPercent}%)</div>
        <div style="margin-top:4px;"><strong>Corrected version:</strong><br>${escapeHtml(
          data.corrected
        )}</div>
        <div style="margin-top:4px;"><strong>Key issues:</strong>${issuesHtml}</div>
      `;
    } else {
      grammarSection = `<div>Could not run detailed grammar check.</div>`;
    }
  } catch (err) {
    console.error(err);
    grammarSection = `<div>There was an error running the grammar check.</div>`;
  }

  const words = text.trim().split(/\s+/).filter(Boolean);
  const wordCount = words.length;
  const uniqueWords = new Set(words.map((w) => w.toLowerCase())).size;

  const sentences = text
    .split(/[.!?]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  const avgSentenceLength =
    sentences.length > 0 ? Math.round(wordCount / sentences.length) : 0;

  const depthScore = Math.min(100, Math.round(wordCount / 20) * 10);
  const vocabScore =
    wordCount > 0
      ? Math.min(100, Math.round((uniqueWords / wordCount) * 120))
      : 0;

  return `
    <div class="jam-report">
      <h3>Jam report on: ${escapeHtml(topic)}</h3>

      <section class="jam-section">
        <h4>Grammar & sentence formation</h4>
        ${grammarSection}
      </section>

      <section class="jam-section">
        <h4>Depth & information</h4>
        <p><strong>Approx. word count:</strong> ${wordCount}</p>
        <p><strong>Average sentence length:</strong> ${avgSentenceLength} words</p>
        <p><strong>Depth score (0–100):</strong> ${depthScore}</p>
        <p><strong>Information richness (vocabulary variety):</strong> ${vocabScore}/100</p>
      </section>
    </div>
  `;
}

// Jam submit handler
if (jamSubmitBtn) {
  jamSubmitBtn.addEventListener("click", async () => {
    const baseTopic = jamTopicSelect.value;
    const customTopic = jamCustomTopicInput.value.trim();
    const topic = customTopic || baseTopic;
    const text = jamTextInput.value.trim();

    if (!topic) {
      jamStatus.textContent = "Please select or type a topic.";
      return;
    }
    if (!text) {
      jamStatus.textContent =
        "Please speak or write something about the topic.";
      return;
    }

    // Stop timer & mic
    if (jamTimerInterval) {
      clearInterval(jamTimerInterval);
      jamTimerInterval = null;
    }
    stopJamRecognition();

    jamStatus.textContent = "Analyzing your jam...";
    jamResults.innerHTML = "";

    const html = await runJamAnalysis(text, topic);
    jamResults.innerHTML = html;
    jamStatus.textContent = "Jam analysis ready.";
  });
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
  activeOverlayFriend = friend.id;    // NOT friend object
  overlayChatPanel.classList.remove("hidden");
  overlayChatWithName.textContent = friend.user_code;

  await loadOverlayMessages(activeOverlayFriend);

  if (messagesPoll) clearInterval(messagesPoll);
  messagesPoll = setInterval(() => loadOverlayMessages(activeOverlayFriend), 3000);
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

  // 1️⃣ Send user's actual chat message
  await client.from("messages").insert({
    sender_id: currentUserUid,
    receiver_id: activeOverlayFriend,  // FIXED
    content: text,
  });

  // 2️⃣ Run grammar check
  const grammarResult = await checkGrammarInChat(text);

  if (grammarResult) {
    await client.from("messages").insert({
      sender_id: currentUserUid,  // bot still counts as you
      receiver_id: activeOverlayFriend, // FIXED
      content: grammarResult,
    });
  }

  loadOverlayMessages(activeOverlayFriend);
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

    const issues = filterIgnoredGrammarIssues(data.issues);

    return `Corrected: ${data.corrected} | Score: ${data.correctPercent}% | Issues: ${
      issues.length ? issues.join(", ") : "No major issues"
    }`;

  } catch (err) {
    console.error(err);
    return null;
  }
}

overlayClearChat.addEventListener("click", async () => {
  if (!activeOverlayFriend || !currentUserUid) return;

  const confirmClear = confirm("Clear entire chat?");
  if (!confirmClear) return;

  const me = currentUserUid;
  const friend = activeOverlayFriend;   // 👈 FIX

  const { error } = await client
  .from("messages")
  .delete()
  .or(
    `and(sender_id.eq.${me},receiver_id.eq.${friend}),and(sender_id.eq.${friend},receiver_id.eq.${me})`
  );


  if (error) {
    console.log(error);
    alert("Failed to clear chat.");
    return;
  }

  overlayChatMessages.innerHTML = "<div class='empty-msg'>No messages yet</div>";
});

