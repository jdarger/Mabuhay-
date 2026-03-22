// ============================================================
//  Mabuhay! — App Logic
//  Modes: Flashcards | Quiz | Browse
//  Progress persisted to localStorage
// ============================================================

// ── STATE ────────────────────────────────────────────────────
const state = {
  mode: "flashcards",
  category: "all",

  // flashcard
  deck: [],
  cardIndex: 0,
  isFlipped: false,
  showUnlearnedOnly: false,

  // quiz
  quizDeck: [],
  quizIndex: 0,
  quizCorrect: 0,
  quizWrong: 0,
  quizDir: "fil-to-eng",
  quizLen: 10,
  quizActive: false,
  quizMissed: [],

  // progress (persisted)
  progress: {},  // key => { learned: bool, seenCount: int, correctCount: int }
  totalCorrect: 0,
  totalAnswered: 0,
  streak: 0,
  lastStudyDate: null,
};

// ── PERSISTENCE ──────────────────────────────────────────────
function loadProgress() {
  try {
    const saved = JSON.parse(localStorage.getItem("mabuhay_progress") || "{}");
    state.progress      = saved.progress      || {};
    state.totalCorrect  = saved.totalCorrect  || 0;
    state.totalAnswered = saved.totalAnswered  || 0;
    state.streak        = saved.streak        || 0;
    state.lastStudyDate = saved.lastStudyDate || null;
    checkStreak();
  } catch { /* ignore */ }
}

function saveProgress() {
  localStorage.setItem("mabuhay_progress", JSON.stringify({
    progress:      state.progress,
    totalCorrect:  state.totalCorrect,
    totalAnswered: state.totalAnswered,
    streak:        state.streak,
    lastStudyDate: state.lastStudyDate,
  }));
}

function checkStreak() {
  const today     = new Date().toDateString();
  const yesterday = new Date(Date.now() - 864e5).toDateString();
  if (state.lastStudyDate === today)      return;                  // already counted
  if (state.lastStudyDate === yesterday)  state.streak += 1;      // keep streak going
  else if (state.lastStudyDate !== null)  state.streak = 1;       // broke streak
  else                                    state.streak = 1;        // first time
}

function markStudyDay() {
  const today = new Date().toDateString();
  if (state.lastStudyDate !== today) {
    checkStreak();
    state.lastStudyDate = today;
    saveProgress();
  }
}

// ── HELPERS ──────────────────────────────────────────────────
function vocabKey(item) { return item.fil.replace(/\s+/g, "_"); }

function getVocab(category) {
  return category === "all" ? [...VOCAB] : VOCAB.filter(v => v.category === category);
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function learnedCount() {
  return Object.values(state.progress).filter(p => p.learned).length;
}

function accuracy() {
  if (state.totalAnswered === 0) return null;
  return Math.round((state.totalCorrect / state.totalAnswered) * 100);
}

// ── HEADER STATS ─────────────────────────────────────────────
function updateHeaderStats() {
  document.getElementById("streak-count").textContent  = state.streak;
  document.getElementById("learned-count").textContent = learnedCount();
  const acc = accuracy();
  document.getElementById("accuracy-count").textContent = acc !== null ? acc + "%" : "—";
}

// ── MODE SWITCHING ────────────────────────────────────────────
document.querySelectorAll(".mode-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    state.mode = btn.dataset.mode;
    document.querySelectorAll(".mode-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    document.querySelectorAll(".mode-section").forEach(s => s.classList.remove("active"));
    document.getElementById("mode-" + state.mode).classList.add("active");

    if (state.mode === "flashcards") renderFlashcardDeck();
    if (state.mode === "browse")     renderBrowse();
    if (state.mode === "quiz")       showQuizStart();
  });
});

// ── CATEGORY SWITCHING ────────────────────────────────────────
document.querySelectorAll(".cat-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    state.category = btn.dataset.cat;
    document.querySelectorAll(".cat-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");

    if (state.mode === "flashcards") renderFlashcardDeck();
    if (state.mode === "browse")     renderBrowse();
  });
});

// ════════════════════════════════════════════════════════════
//  FLASHCARD MODE
// ════════════════════════════════════════════════════════════
function buildDeck() {
  let vocab = getVocab(state.category);
  if (state.showUnlearnedOnly) {
    const unlearned = vocab.filter(v => !state.progress[vocabKey(v)]?.learned);
    vocab = unlearned.length ? unlearned : vocab;  // fallback if all learned
  }
  return vocab;
}

function renderFlashcardDeck() {
  state.deck = buildDeck();
  state.cardIndex = 0;
  setFlipped(false);
  renderCard();
}

function renderCard() {
  const card = state.deck[state.cardIndex];
  if (!card) return;

  document.getElementById("card-position").textContent =
    `${state.cardIndex + 1} / ${state.deck.length}`;
  document.getElementById("card-category-label").textContent =
    (CATEGORIES[card.category]?.emoji || "") + " " + (CATEGORIES[card.category]?.label || card.category);

  document.getElementById("card-front-word").textContent  = card.fil;
  document.getElementById("card-front-hint").textContent  = card.romanization || "";
  document.getElementById("card-back-word").textContent   = card.eng;
  document.getElementById("card-example").textContent     = card.example || "";

  const pct = ((state.cardIndex + 1) / state.deck.length) * 100;
  document.getElementById("fc-progress-bar").style.width = pct + "%";

  document.getElementById("rating-buttons").style.display = "none";
  hideBtn("fc-prev", state.cardIndex === 0);
}

function setFlipped(flip) {
  state.isFlipped = flip;
  const fc = document.getElementById("flashcard");
  fc.classList.toggle("flipped", flip);
  if (flip) {
    document.getElementById("rating-buttons").style.display = "flex";
  }
}

function hideBtn(id, hidden) {
  document.getElementById(id).style.visibility = hidden ? "hidden" : "visible";
}

document.getElementById("flashcard").addEventListener("click", () => {
  if (!state.isFlipped) {
    setFlipped(true);
    markStudyDay();
    // track seen
    const card = state.deck[state.cardIndex];
    const key  = vocabKey(card);
    if (!state.progress[key]) state.progress[key] = { learned: false, seenCount: 0, correctCount: 0 };
    state.progress[key].seenCount++;
    saveProgress();
  }
});

document.getElementById("flashcard").addEventListener("keydown", e => {
  if (e.key === " " || e.key === "Enter") { e.preventDefault(); document.getElementById("flashcard").click(); }
  if (e.key === "ArrowRight") document.getElementById("fc-next").click();
  if (e.key === "ArrowLeft")  document.getElementById("fc-prev").click();
});

document.getElementById("fc-next").addEventListener("click", () => {
  if (state.cardIndex < state.deck.length - 1) {
    state.cardIndex++;
    setFlipped(false);
    renderCard();
  } else {
    // Loop back
    state.cardIndex = 0;
    setFlipped(false);
    renderCard();
  }
});

document.getElementById("fc-prev").addEventListener("click", () => {
  if (state.cardIndex > 0) {
    state.cardIndex--;
    setFlipped(false);
    renderCard();
  }
});

function rateCard(difficulty) {
  const card = state.deck[state.cardIndex];
  const key  = vocabKey(card);
  if (!state.progress[key]) state.progress[key] = { learned: false, seenCount: 0, correctCount: 0 };

  if (difficulty === "easy") {
    state.progress[key].correctCount++;
    state.progress[key].learned = true;
    state.totalCorrect++;
  } else if (difficulty === "ok") {
    state.progress[key].correctCount++;
    state.totalCorrect++;
  } else {
    // hard — mark not learned
    state.progress[key].learned = false;
  }
  state.totalAnswered++;
  saveProgress();
  updateHeaderStats();

  // Advance
  document.getElementById("fc-next").click();
}

document.getElementById("rate-easy").addEventListener("click", () => rateCard("easy"));
document.getElementById("rate-ok"  ).addEventListener("click", () => rateCard("ok"));
document.getElementById("rate-hard").addEventListener("click", () => rateCard("hard"));

document.getElementById("fc-shuffle").addEventListener("click", () => {
  state.deck = shuffle(state.deck);
  state.cardIndex = 0;
  setFlipped(false);
  renderCard();
});

document.getElementById("fc-reset").addEventListener("click", () => {
  renderFlashcardDeck();
});

document.getElementById("fc-known-only").addEventListener("click", function() {
  state.showUnlearnedOnly = !state.showUnlearnedOnly;
  this.textContent = state.showUnlearnedOnly ? "⭐ Show all cards" : "⭐ Show unlearned only";
  renderFlashcardDeck();
});

// ════════════════════════════════════════════════════════════
//  QUIZ MODE
// ════════════════════════════════════════════════════════════
function showQuizStart() {
  document.getElementById("quiz-start-screen").style.display    = "";
  document.getElementById("quiz-question-screen").style.display = "none";
  document.getElementById("quiz-result-screen").style.display   = "none";
}

document.getElementById("quiz-start-btn").addEventListener("click", startQuiz);

function startQuiz() {
  state.quizDir = document.querySelector('input[name="quiz-dir"]:checked').value;
  state.quizLen = parseInt(document.querySelector('input[name="quiz-len"]:checked').value, 10);

  let vocab = getVocab(state.category);
  if (vocab.length < 4) {
    alert("Not enough words in this category for a quiz. Try 'All' or a bigger category.");
    return;
  }

  state.quizDeck    = shuffle(vocab).slice(0, Math.min(state.quizLen, vocab.length));
  state.quizIndex   = 0;
  state.quizCorrect = 0;
  state.quizWrong   = 0;
  state.quizMissed  = [];
  state.quizActive  = true;

  document.getElementById("quiz-start-screen").style.display    = "none";
  document.getElementById("quiz-result-screen").style.display   = "none";
  document.getElementById("quiz-question-screen").style.display = "";

  renderQuizQuestion();
}

function getQuizChoices(correct, allVocab, isFilToEng) {
  const wrongPool = shuffle(allVocab.filter(v => v.fil !== correct.fil));
  const wrongs    = wrongPool.slice(0, 3);
  const choices   = shuffle([correct, ...wrongs]);
  return choices.map(v => ({ vocab: v, text: isFilToEng ? v.eng : v.fil }));
}

function renderQuizQuestion() {
  const q          = state.quizDeck[state.quizIndex];
  const total      = state.quizDeck.length;
  const isFilToEng = state.quizDir === "fil-to-eng" ||
                     (state.quizDir === "mixed" && state.quizIndex % 2 === 0);

  document.getElementById("quiz-progress-label").textContent =
    `Question ${state.quizIndex + 1} of ${total}`;
  document.getElementById("quiz-progress-fill").style.width =
    ((state.quizIndex / total) * 100) + "%";
  document.getElementById("quiz-score-live").innerHTML =
    `✓ ${state.quizCorrect} &nbsp; ✗ ${state.quizWrong}`;

  document.getElementById("quiz-prompt-label").textContent =
    isFilToEng ? "What does this mean in English?" : "How do you say this in Filipino?";
  document.getElementById("quiz-question-word").textContent =
    isFilToEng ? q.fil : q.eng;

  const allVocab  = getVocab(state.category);
  const choices   = getQuizChoices(q, allVocab, isFilToEng);
  const choicesEl = document.getElementById("quiz-choices");
  choicesEl.innerHTML = "";

  choices.forEach(({ vocab, text }) => {
    const btn = document.createElement("button");
    btn.className   = "choice-btn";
    btn.textContent = text;
    btn.addEventListener("click", () => handleQuizAnswer(btn, vocab, q, choices, isFilToEng));
    choicesEl.appendChild(btn);
  });
}

function handleQuizAnswer(clickedBtn, chosen, correct, choices, isFilToEng) {
  const allBtns = document.querySelectorAll(".choice-btn");
  allBtns.forEach(b => b.classList.add("disabled"));

  const isCorrect = chosen.fil === correct.fil;

  // Highlight correct answer
  allBtns.forEach(b => {
    const choiceVocab = choices.find(c => c.text === b.textContent)?.vocab;
    if (choiceVocab?.fil === correct.fil) b.classList.add("correct");
  });

  if (!isCorrect) {
    clickedBtn.classList.add("wrong");
    state.quizWrong++;
    state.quizMissed.push(correct);
  } else {
    state.quizCorrect++;
    // update progress
    const key = vocabKey(correct);
    if (!state.progress[key]) state.progress[key] = { learned: false, seenCount: 0, correctCount: 0 };
    state.progress[key].correctCount++;
    if (state.progress[key].correctCount >= 3) state.progress[key].learned = true;
    state.totalCorrect++;
  }

  state.totalAnswered++;
  saveProgress();
  updateHeaderStats();
  markStudyDay();

  // Advance after short delay
  setTimeout(() => {
    state.quizIndex++;
    if (state.quizIndex >= state.quizDeck.length) {
      showQuizResults();
    } else {
      renderQuizQuestion();
    }
  }, 900);
}

function showQuizResults() {
  document.getElementById("quiz-question-screen").style.display = "none";
  document.getElementById("quiz-result-screen").style.display   = "";

  const total   = state.quizDeck.length;
  const correct = state.quizCorrect;
  const pct     = Math.round((correct / total) * 100);

  let icon, grade, gradeColor;
  if      (pct >= 90) { icon = "🎉"; grade = "Excellent! Napakahusay!";   gradeColor = "#28a745"; }
  else if (pct >= 70) { icon = "👍"; grade = "Good job! Magaling!";       gradeColor = "#17a2b8"; }
  else if (pct >= 50) { icon = "📚"; grade = "Keep practicing! Kaya mo!"; gradeColor = "#fd7e14"; }
  else                { icon = "💪"; grade = "Don't give up! Huwag sumuko!", gradeColor = "#ce1126"; }

  document.getElementById("result-icon").textContent     = icon;
  document.getElementById("result-title").textContent    = "Quiz Complete!";
  document.getElementById("result-score").textContent    = `${correct} / ${total}`;
  document.getElementById("result-grade").textContent    = grade;
  document.getElementById("result-grade").style.color    = gradeColor;

  let breakdown = `${pct}% correct`;
  if (state.quizMissed.length) {
    breakdown += `\n\nWords to review:\n` +
      state.quizMissed.map(v => `• ${v.fil} = ${v.eng}`).join("\n");
  }
  document.getElementById("result-breakdown").style.whiteSpace = "pre-line";
  document.getElementById("result-breakdown").textContent = breakdown;
}

document.getElementById("quiz-retry-btn").addEventListener("click", startQuiz);
document.getElementById("quiz-new-btn").addEventListener("click", showQuizStart);

// ════════════════════════════════════════════════════════════
//  BROWSE MODE
// ════════════════════════════════════════════════════════════
let browseDebounce;

function renderBrowse() {
  const query = document.getElementById("browse-search").value.toLowerCase().trim();
  let vocab   = getVocab(state.category);

  if (query) {
    vocab = vocab.filter(v =>
      v.fil.toLowerCase().includes(query) ||
      v.eng.toLowerCase().includes(query) ||
      (v.example || "").toLowerCase().includes(query)
    );
  }

  document.getElementById("browse-count").textContent =
    `${vocab.length} word${vocab.length !== 1 ? "s" : ""}`;

  const grid = document.getElementById("word-grid");
  grid.innerHTML = "";

  vocab.forEach(item => {
    const key      = vocabKey(item);
    const isLearned = !!state.progress[key]?.learned;
    const card     = document.createElement("div");
    card.className = "word-card" + (isLearned ? " is-learned" : "");
    card.innerHTML = `
      <div class="word-card-fil">${item.fil}</div>
      <div class="word-card-eng">${item.eng}</div>
      ${item.example ? `<div class="word-card-eng" style="font-style:italic;margin-top:4px;font-size:.78rem">${item.example}</div>` : ""}
      <div class="word-card-meta">
        <span class="word-card-cat">${CATEGORIES[item.category]?.emoji || ""} ${CATEGORIES[item.category]?.label || item.category}</span>
        ${isLearned ? '<span class="word-card-learned-badge">✓ Learned</span>' : ""}
      </div>`;
    grid.appendChild(card);
  });
}

document.getElementById("browse-search").addEventListener("input", () => {
  clearTimeout(browseDebounce);
  browseDebounce = setTimeout(renderBrowse, 180);
});

// ── INIT ──────────────────────────────────────────────────────
loadProgress();
updateHeaderStats();
renderFlashcardDeck();
