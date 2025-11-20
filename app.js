// ---------- Supabase init ----------
const client = supabase.createClient(
  "https://kuaktnqhsylhvmkjlcpr.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt1YWt0bnFoc3lsaHZta2psY3ByIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM1MjgxNDQsImV4cCI6MjA3OTEwNDE0NH0.sEvEJ8Sps7-IKEmim61S4yVilZmQ0ph4FD1l3aq6nu0"
);

// ---------- STATE ----------
let currentUserId = null;
let currentUserUid = null;
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

// Friends chat speech state (similar to Jam)
let friendsTypedText = "";
let friendsSpeechFinal = "";
let friendsSpeechInterim = "";
let friendsRecognition = null;
let friendsMicActive = false;
let grammarCheckEnabled = true;

// ---------- PRESENCE ----------
let presenceChannel = null;
let onlineUsersState = {};


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
const searchInput = document.getElementById("friends-search");

if (searchInput) {
   searchInput.addEventListener("input", () => {
    const value = searchInput.value.toLowerCase();
    const friendItems = document.querySelectorAll("#friends-overlay .friend-item");

    let visibleCount = 0;

    friendItems.forEach(item => {
        const name = item.querySelector(".friend-name")?.innerText.toLowerCase() || "";

        if (name.includes(value)) {
            item.style.display = "flex";
            visibleCount++;
        } else {
            item.style.display = "none";
        }
    });

    // 👇 ADD THIS BLOCK
    let noMsg = document.getElementById("no-users-msg");

    if (visibleCount === 0) {
        if (!noMsg) {
            noMsg = document.createElement("div");
            noMsg.id = "no-users-msg";
            noMsg.textContent = "No users found";
            noMsg.style.textAlign = "center";
            noMsg.style.color = "#777";
            noMsg.style.marginTop = "20px";
            document.getElementById("overlay-friends-list").appendChild(noMsg);
        }
    } else {
        if (noMsg) noMsg.remove();
    }
});

}

const overlayChatPanel = document.getElementById("overlay-chat-panel");
const overlayChatWithName = document.getElementById("overlay-chat-with-name");
const overlayChatAvatar = document.getElementById("overlay-chat-avatar");
const overlayChatStatus = document.getElementById("overlay-chat-status");
const overlayChatMessages = document.getElementById("overlay-chat-messages");
const overlayChatInput = document.getElementById("overlay-chat-input");
const overlayChatSendBtn = document.getElementById("overlay-chat-send-btn");
const overlayCloseChat = document.getElementById("overlay-close-chat");
const overlayClearChat = document.getElementById("overlay-clear-chat");
const friendsMicBtn = document.getElementById("friends-mic-btn");
const grammarToggleBtn = document.getElementById("grammar-toggle-btn");

if (grammarToggleBtn) {
 grammarToggleBtn.addEventListener("click", () => {
    grammarCheckEnabled = !grammarCheckEnabled;

    if (grammarCheckEnabled) {
        grammarToggleBtn.classList.remove("inactive");
        grammarToggleBtn.textContent = "Grammar ✓";
        overlayChatStatus.textContent = "Grammar check enabled";
    } else {
        grammarToggleBtn.classList.add("inactive");
        grammarToggleBtn.textContent = "Grammar ✗";
        overlayChatStatus.textContent = "Grammar check disabled";
    }

    // Reset status message
    setTimeout(() => {
        overlayChatStatus.textContent = "Online";
    }, 1500);
});

}

// Mic toggle for FRIENDS chat
if (friendsMicBtn) {
  friendsMicBtn.addEventListener("click", () => {
    // snapshot current typed text as baseline
    friendsTypedText = overlayChatInput.value.trim();
    friendsSpeechFinal = "";
    friendsSpeechInterim = "";

    if (!friendsMicActive) {
      stopFriendsRecognition(); // clean old one if any
      friendsRecognition = initFriendsSpeech();
      if (!friendsRecognition) return;
      friendsMicActive = true;
      friendsRecognition.start();
    } else {
      stopFriendsRecognition();
    }
  });
}
const friendsInput = document.getElementById("overlay-chat-input");

if (friendsInput) {
  friendsInput.addEventListener("input", () => {
    friendsInput.style.height = "auto";  
    friendsInput.style.height = (friendsInput.scrollHeight) + "px";
  });
}

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
  grammarTypedText = "";
grammarSpeechFinal = "";
grammarSpeechInterim = "";

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
  if (jamStatus) jamStatus.textContent = ""; // clear “Listening…”
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
    // no touching jam mic or jam status here
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

  // 🔥 FIX: remove “Listening...”
  if (grammarStatus) grammarStatus.textContent = "";
}


// ---------- FRIENDS CHAT SPEECH (similar behavior to Jam) ----------

function initFriendsSpeech() {
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
    if (overlayChatStatus) {
      overlayChatStatus.textContent = "Listening...";
    }
    if (friendsMicBtn) {
      friendsMicBtn.classList.add("listening");
    }
  };

  recog.onerror = (e) => {
    if (overlayChatStatus) {
      overlayChatStatus.textContent = "Mic error: " + e.error;
    }
    if (friendsMicBtn) friendsMicBtn.classList.remove("listening");
    friendsMicActive = false;
  };

  recog.onend = () => {
    if (friendsMicBtn) friendsMicBtn.classList.remove("listening");
    friendsMicActive = false;
    // restore default header status
    if (overlayChatStatus) {
      overlayChatStatus.textContent = "Tap here for contact info";
    }
  };

  recog.onresult = (event) => {
    let interim = "";

    for (let i = recog.lastProcessed + 1; i < event.results.length; i++) {
      const result = event.results[i];
      const text = result[0].transcript;

      if (result.isFinal) {
        friendsSpeechFinal += text + " ";
        recog.lastProcessed = i;
      } else {
        interim = text;
      }
    }

    friendsSpeechInterim = interim;

    overlayChatInput.value = (
      friendsTypedText +
      " " +
      friendsSpeechFinal +
      " " +
      friendsSpeechInterim
    ).trim();

    overlayChatInput.focus();
  };

  return recog;
}

function stopFriendsRecognition() {
  if (friendsRecognition) {
    try {
      friendsRecognition.onresult = null;
      friendsRecognition.onerror = null;
      friendsRecognition.onend = null;
      friendsRecognition.stop();
    } catch (e) {
      console.warn("Error stopping friends mic:", e);
    }
  }
  friendsRecognition = null;
  friendsMicActive = false;
  friendsSpeechInterim = "";
  if (friendsMicBtn) friendsMicBtn.classList.remove("listening");
}

// ---------- TOOL SWITCH ----------
function setTool(tool) {
  currentTool = tool;
  grammarTypedText = "";
  grammarSpeechFinal = "";
  grammarSpeechInterim = "";
  grammarInput.value = "";
  grammarStatus.textContent = "";
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
  // -------------------------------------------------------------
// STEP 2: START PRESENCE TRACKING AFTER LOGIN
// -------------------------------------------------------------
presenceChannel = client.channel("presence-users", {
  config: { presence: { key: currentUserUid } }
});

presenceChannel.subscribe(async (status) => {
  if (status === "SUBSCRIBED") {
    presenceChannel.track({ online: true, at: Date.now() });

    // Mark user online in DB
    await client.from("user_status").upsert({
      user_id: currentUserUid,
      is_online: true,
      last_seen: new Date().toISOString(),
    });
  }
});

// -------------------------------------------------------------
// STEP 3: HEARTBEAT (PING) EVERY 25 SECONDS
// -------------------------------------------------------------
setInterval(async () => {
  if (!currentUserUid) return;
  await client.from("user_status")
    .update({
      is_online: true,
      last_seen: new Date().toISOString(),
    })
    .eq("user_id", currentUserUid);
}, 25000);

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
// Mic toggle for GRAMMAR LAB (same behavior as Jam)
if (micBtn) {
  micBtn.addEventListener("click", () => {
    // snapshot current typed text as baseline
    grammarTypedText = grammarInput.value.trim();
    grammarSpeechFinal = "";
    grammarSpeechInterim = "";

    if (!grammarMicActive) {
      stopGrammarRecognition();      // clean old one if any
      grammarRecognition = initGrammarSpeech();
      if (!grammarRecognition) return;
      grammarMicActive = true;
      grammarRecognition.start();
    } else {
      stopGrammarRecognition();
    }
  });
}

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
async function getUserStatus(uid) {
  const { data, error } = await client
    .from("user_status")
    .select("is_online, last_seen")
    .eq("user_id", uid)
    .single();

  if (error || !data) {
    return { is_online: false, last_seen: null };
  }

  return data;
}


// Time & preview helpers for WhatsApp-like UI
function formatTimeHHMM(dateString) {
  if (!dateString) return "";
  const d = new Date(dateString);
  if (Number.isNaN(d.getTime())) return "";
  const hh = d.getHours().toString().padStart(2, "0");
  const mm = d.getMinutes().toString().padStart(2, "0");
  return `${hh}:${mm}`;
}

function buildPreviewText(msg, isMine) {
  if (!msg || !msg.content) return "";
  const prefix = isMine ? "You: " : "";
  let txt = prefix + msg.content;
  if (txt.length > 40) txt = txt.slice(0, 37) + "...";
  return txt;
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

  // stop mic if running
  stopFriendsRecognition();

  if (messagesPoll) {
    clearInterval(messagesPoll);
    messagesPoll = null;
  }
});

async function loadOverlayFriends() {
  overlayFriendsList.innerHTML = "<li class='friend-item loading'>Loading...</li>";

  const { data, error } = await client
    .from("user_ids")
    .select("id, user_code")
    .neq("user_code", currentUserId);

  if (error) {
    console.error("loadOverlayFriends error:", error);
    overlayFriendsList.innerHTML = "<li class='friend-item'>Error loading users</li>";
    return;
  }

  if (!data || !data.length) {
    overlayFriendsList.innerHTML = "<li class='friend-item'>No other users</li>";
    return;
  }

  // For each friend, fetch the last message between us
  const friendsWithLast = await Promise.all(
    data.map(async (u) => {
      let lastMessage = null;
      const { data: msgs, error: msgError } = await client
        .from("messages")
        .select("sender_id, receiver_id, content, created_at")
        .or(
          `and(sender_id.eq.${currentUserUid},receiver_id.eq.${u.id}),` +
          `and(sender_id.eq.${u.id},receiver_id.eq.${currentUserUid})`
        )
        .order("created_at", { ascending: false })
        .limit(1);

      if (!msgError && msgs && msgs.length) {
        lastMessage = msgs[0];
      }

      return { ...u, lastMessage };
    })
  );

  overlayFriendsList.innerHTML = "";

  friendsWithLast.forEach((u) => {
    const li = document.createElement("li");
    li.className = "friend-item";
  
    const isMine = u.lastMessage && u.lastMessage.sender_id === currentUserUid;
  
    const preview = u.lastMessage
      ? buildPreviewText(u.lastMessage, isMine)
      : "No messages yet";
  
    const time = u.lastMessage ? formatTimeHHMM(u.lastMessage.created_at) : "";
  
    li.innerHTML = `
        <div class="friend-avatar-circle">
          ${escapeHtml(u.user_code.charAt(0).toUpperCase())}
        </div>
  
        <div class="friend-main">
          <div class="friend-top-row">
            <span class="friend-name">${escapeHtml(u.user_code)}</span>
            <span class="friend-time">${escapeHtml(time)}</span>
          </div>
  
          <div class="friend-bottom-row">
            <span class="friend-preview">${escapeHtml(preview)}</span>
          </div>
        </div>
      `;
  
    li.addEventListener("click", () => openOverlayChat(u));
    overlayFriendsList.appendChild(li);
  });
}
// Highlight active user on click
document.querySelectorAll(".friend-item").forEach(item => {
    item.addEventListener("click", () => {
        // remove active from all
        document.querySelectorAll(".friend-item").forEach(i =>
            i.classList.remove("active")
        );

        // set active on clicked user
        item.classList.add("active");
    });
});

async function openOverlayChat(friend) {
  activeOverlayFriend = friend.id; // store only id
  overlayChatPanel.classList.remove("hidden");

  overlayChatWithName.textContent = friend.user_code;

  if (overlayChatAvatar) {
    overlayChatAvatar.textContent = friend.user_code.charAt(0).toUpperCase();
  }

  // ---------------------------------------------------
  // ✅ NEW: Real Online / Last Seen System
  // ---------------------------------------------------
  updateChatStatus(friend.id); // load instantly

  // Live refresh every 5 seconds (like WhatsApp)
  if (window.statusInterval) clearInterval(window.statusInterval);
  window.statusInterval = setInterval(() => {
    updateChatStatus(friend.id);
  }, 5000);

  // ---------------------------------------------------

  await loadOverlayMessages(activeOverlayFriend);

  if (messagesPoll) clearInterval(messagesPoll);
  messagesPoll = setInterval(
    () => loadOverlayMessages(activeOverlayFriend),
    3000
  );
}
async function updateChatStatus(friendId) {
  const { data, error } = await client
    .from("user_status")
    .select("is_online, last_seen")
    .eq("user_id", friendId)
    .single();

  if (error || !data) {
    overlayChatStatus.textContent = "Offline";
    return;
  }

  if (data.is_online) {
    overlayChatStatus.textContent = "Online";
  } else {
    const time = new Date(data.last_seen).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
    overlayChatStatus.textContent = "Last seen at " + time;
  }
}


overlayCloseChat.addEventListener("click", () => {
  overlayChatPanel.classList.add("hidden");
  overlayChatMessages.innerHTML = "";
  activeOverlayFriend = null;

  // stop mic if running
  stopFriendsRecognition();

  if (messagesPoll) {
    clearInterval(messagesPoll);
    messagesPoll = null;
  }
});

async function loadOverlayMessages(friendId) {
  if (!currentUserUid || !friendId) return;

  // ✅ CHECK IF USER IS NEAR THE BOTTOM BEFORE UPDATING
  const isNearBottom =
    overlayChatMessages.scrollHeight -
      (overlayChatMessages.scrollTop + overlayChatMessages.clientHeight) <
    80;

  const { data, error } = await client
    .from("messages")
    .select("id, sender_id, receiver_id, content, created_at")
    .or(
      `and(sender_id.eq.${currentUserUid},receiver_id.eq.${friendId}),` +
        `and(sender_id.eq.${friendId},receiver_id.eq.${currentUserUid})`
    )
    .order("created_at", { ascending: true });

  overlayChatMessages.innerHTML =
    "<div class='empty-msg'>No messages yet</div>";

  if (error) {
    console.error("loadOverlayMessages error:", error);
    return;
  }

  if (!data || !data.length) {
    overlayChatMessages.scrollTop = 0;
    return;
  }

  overlayChatMessages.innerHTML = "";

  data.forEach((msg) => {
    const mine = msg.sender_id === currentUserUid;
    const div = document.createElement("div");
    div.className = mine ? "chat-msg me" : "chat-msg them";

    const time = formatTimeHHMM(msg.created_at);

    div.innerHTML = `
      <div class="msg-text">${escapeHtml(msg.content)}</div>
      <div class="msg-meta">
        <span class="msg-time">${escapeHtml(time)}</span>
        ${mine ? `<span class="msg-ticks" title="Delivered">✓✓</span>` : ""}
      </div>
    `;

    overlayChatMessages.appendChild(div);
  });

  // ✅ ONLY AUTO SCROLL IF USER WAS NEAR THE BOTTOM
  if (isNearBottom) {
    overlayChatMessages.scrollTop = overlayChatMessages.scrollHeight;
  }
}


overlayChatSendBtn.addEventListener("click", sendOverlayMessage);
overlayChatInput.style.height = "42px";

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

  // 🔥 RESET HEIGHT AFTER SENDING
  overlayChatInput.style.height = "42px";

  // 1️⃣ Send user's actual chat message
  await client.from("messages").insert({
    sender_id: currentUserUid,
    receiver_id: activeOverlayFriend,
    content: text,
  });

  // 2️⃣ Run grammar check bot
 if (grammarCheckEnabled) {
    const grammarResult = await checkGrammarInChat(text);
    if (grammarResult) {
        await client.from("messages").insert({
            sender_id: currentUserUid,
            receiver_id: activeOverlayFriend,
            content: grammarResult,
        });
    }
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

    return `GRAMMAR CORRECTION: \n Corrected: ${data.corrected} \n Score: ${data.correctPercent}% \n Issues: ${
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
  const friend = activeOverlayFriend;

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
// -------------------------------------------------------------
// STEP 4: MARK USER OFFLINE ON TAB CLOSE
// -------------------------------------------------------------
window.addEventListener("beforeunload", async () => {
  if (!currentUserUid) return;

  await client.from("user_status")
    .update({
      is_online: false,
      last_seen: new Date().toISOString()
    })
    .eq("user_id", currentUserUid);
});




