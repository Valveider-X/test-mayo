const appRoot = document.querySelector("#app");

const subjectFiles = ["Acceso a Datos.json", "PSP.json", "Arquitectura Nube.json", "Programación Móviles.json","Desarrollo de Interfaces.json", "SGE.json", "psp-kahoot.json", "Digitalizacion.json", "IPE.json", "Sostenibilidad.json" ];
const countOptions = [10, 20, 50, "all", "custom"];

const initialState = {
  view: "home",
  selectedFile: null,
  selectedCount: null,
  customCount: "",
  session: null,
  reviewIndex: 0,
};

let appState = { ...initialState };

render();

function render() {
  if (appState.view === "home") {
    renderHome();
    return;
  }

  if (appState.view === "config") {
    renderConfig();
    return;
  }

  if (appState.view === "quiz") {
    renderQuiz();
    return;
  }

  renderResults();
}

function renderHome() {
  const subjectButtons = subjectFiles
    .map((fileName) => {
      const label = formatSubjectLabel(fileName);
      return `<button data-action="select-subject" data-file="${escapeHtml(fileName)}">${escapeHtml(label)}</button>`;
    })
    .join("");

  appRoot.innerHTML = `
    <section class="card">
      <h1>Tests de estudio</h1>
      <p>Elige asignatura para comenzar.</p>
      <div class="subject-grid">${subjectButtons}</div>
    </section>
  `;

  appRoot.querySelectorAll('[data-action="select-subject"]').forEach((button) => {
    button.addEventListener("click", () => {
      setState({
        ...initialState,
        view: "config",
        selectedFile: button.dataset.file,
      });
    });
  });
}

function renderConfig() {
  if (!appState.selectedFile) {
    goHome();
    return;
  }

  const subjectLabel = formatSubjectLabel(appState.selectedFile);
  const countButtons = countOptions
    .map((countValue) => {
      const selectedClass = appState.selectedCount === countValue ? "primary" : "";
      const label = getCountLabel(countValue);
      return `<button class="${selectedClass}" data-action="select-count" data-count="${countValue}">${label}</button>`;
    })
    .join("");

  const showCustomInput = appState.selectedCount === "custom";

  appRoot.innerHTML = `
    <section class="card">
      <h2>${escapeHtml(subjectLabel)}</h2>
      <p>Selecciona la cantidad de preguntas.</p>
      <div class="actions">${countButtons}</div>
      ${
        showCustomInput
          ? `
        <div style="margin-top: 0.75rem;">
          <input id="custom-count" type="number" min="1" step="1" placeholder="Escribe una cantidad" value="${escapeHtml(
            appState.customCount
          )}" />
        </div>
      `
          : ""
      }
      <div class="actions" style="margin-top: 0.75rem;">
        <button class="ghost" data-action="back-home">Inicio</button>
        <button class="primary" data-action="start-quiz">Comenzar</button>
      </div>
    </section>
  `;

  appRoot.querySelectorAll('[data-action="select-count"]').forEach((button) => {
    button.addEventListener("click", () => {
      const rawCount = button.dataset.count;
      const countValue = rawCount && Number.isNaN(Number(rawCount)) ? rawCount : Number(rawCount);

      setState({
        ...appState,
        selectedCount: countValue,
      });
    });
  });

  const customCountInput = appRoot.querySelector("#custom-count");
  if (customCountInput) {
    customCountInput.addEventListener("input", (event) => {
      setState({
        ...appState,
        customCount: event.target.value,
      });
    });
  }

  appRoot.querySelector('[data-action="back-home"]').addEventListener("click", goHome);
  appRoot.querySelector('[data-action="start-quiz"]').addEventListener("click", startQuiz);
}

async function startQuiz() {
  if (!appState.selectedFile) {
    return;
  }

  const questions = await loadQuestions(appState.selectedFile);
  if (!questions.length) {
    window.alert("No hay preguntas disponibles para esta asignatura.");
    return;
  }

  const questionCount = resolveQuestionCount(questions.length);
  if (!questionCount) {
    window.alert("Selecciona una cantidad valida de preguntas.");
    return;
  }

  const shuffledQuestions = fisherYatesShuffle([...questions]).slice(0, questionCount);
  const preparedQuestions = shuffledQuestions.map((questionItem) => ({
    ...questionItem,
    options: fisherYatesShuffle([...questionItem.options]),
  }));

  setState({
    ...appState,
    view: "quiz",
    session: {
      index: 0,
      score: 0,
      questions: preparedQuestions,
      answers: {},
    },
  });
}

async function loadQuestions(fileName) {
  try {
    const response = await fetch(`./data/${fileName}`);
    if (!response.ok) {
      return [];
    }

    const payload = await response.json();
    if (!Array.isArray(payload)) {
      return [];
    }

    return payload.filter(isValidQuestion);
  } catch {
    return [];
  }
}

function isValidQuestion(questionItem) {
  if (!questionItem || typeof questionItem !== "object") return false;
  if (typeof questionItem.id !== "number") return false;
  if (typeof questionItem.question !== "string") return false;
  if (!Array.isArray(questionItem.options) || questionItem.options.length < 2) return false;

  return questionItem.options.every((optionItem) => {
    return optionItem && typeof optionItem.text === "string" && typeof optionItem.isCorrect === "boolean";
  });
}

function renderQuiz() {
  const session = appState.session;
  if (!session || !session.questions.length) {
    goHome();
    return;
  }

  const currentQuestion = session.questions[session.index];
  const selectedOptionIndex = session.answers[currentQuestion.id];
  const isAnswered = selectedOptionIndex !== undefined;
  const progressPercent = Math.round((session.index / session.questions.length) * 100);
  const nextButtonLabel = session.index === session.questions.length - 1 ? "Ver resultado" : "Siguiente";

  const optionsMarkup = currentQuestion.options
    .map((optionItem, optionIndex) => {
      const selected = selectedOptionIndex === optionIndex;
      const isCorrect = isAnswered && optionItem.isCorrect;
      const isWrong = isAnswered && selected && !optionItem.isCorrect;
      const isDimmed = isAnswered && !selected && !optionItem.isCorrect;

      const classes = ["option"];
      if (isCorrect) classes.push("correct");
      if (isWrong) classes.push("wrong");
      if (isDimmed) classes.push("dimmed");

      return `<button class="${classes.join(" ")}" data-action="select-option" data-index="${optionIndex}" ${
        isAnswered ? "disabled" : ""
      }>${escapeHtml(optionItem.text)}</button>`;
    })
    .join("");

  appRoot.innerHTML = `
    <section class="progress">
      <div class="progress-meta">
        <span>Pregunta ${session.index + 1} de ${session.questions.length}</span>
        <span>${progressPercent}%</span>
      </div>
      <div class="progress-track" aria-hidden="true">
        <div class="progress-fill" style="width: ${progressPercent}%;"></div>
      </div>
    </section>

    <section class="card">
      <h3>${escapeHtml(currentQuestion.question)}</h3>
      <div class="options-list">${optionsMarkup}</div>
      <p class="helper">${isAnswered ? "Respuesta guardada." : "Selecciona una respuesta para continuar."}</p>
    </section>

    <div class="next-bar">
      <div class="next-bar-inner">
        <button class="primary" data-action="next-step" ${isAnswered ? "" : "disabled"}>${nextButtonLabel}</button>
      </div>
    </div>
  `;

  appRoot.querySelectorAll('[data-action="select-option"]').forEach((button) => {
    button.addEventListener("click", () => {
      const optionIndex = Number(button.dataset.index);
      answerQuestion(optionIndex);
    });
  });

  appRoot.querySelector('[data-action="next-step"]').addEventListener("click", goToNextStep);
}

function answerQuestion(optionIndex) {
  const session = appState.session;
  if (!session) return;

  const currentQuestion = session.questions[session.index];
  const selectedOption = currentQuestion.options[optionIndex];
  if (!selectedOption) return;

  if (session.answers[currentQuestion.id] !== undefined) {
    return;
  }

  const nextScore = selectedOption.isCorrect ? session.score + 1 : session.score;

  setState({
    ...appState,
    session: {
      ...session,
      score: nextScore,
      answers: {
        ...session.answers,
        [currentQuestion.id]: optionIndex,
      },
    },
  });
}

function goToNextStep() {
  const session = appState.session;
  if (!session) return;

  const isLastQuestion = session.index >= session.questions.length - 1;
  if (isLastQuestion) {
    setState({
      ...appState,
      view: "results",
    });
    return;
  }

  setState({
    ...appState,
    session: {
      ...session,
      index: session.index + 1,
    },
  });
}

function renderResults() {
  const session = appState.session;
  if (!session) {
    goHome();
    return;
  }

  const totalQuestions = session.questions.length;
  const resultPercent = Math.round((session.score / totalQuestions) * 100);

  const mistakes = session.questions.filter(q => {
    const userChoiceIdx = session.answers[q.id];
    return !q.options[userChoiceIdx].isCorrect;
  });

  appRoot.innerHTML = `
    <section class="card">
      <h2>Resultado final</h2>
      <p>Has acertado ${session.score} de ${totalQuestions} preguntas.</p>
      <h3>${resultPercent}% de aciertos</h3>
      <div class="actions single-column" style="margin-top: 0.75rem;">
        <button class="primary" data-action="retry">Reintentar</button>
        <button class="ghost" data-action="go-home">Volver al inicio</button>
      </div>
    </section>
    
    <div id="review-section">
      ${mistakes.length > 0 ? renderReview(mistakes) : ""}
    </div>
  `;

  appRoot.querySelector('[data-action="retry"]').addEventListener("click", retryQuiz);
  appRoot.querySelector('[data-action="go-home"]').addEventListener("click", goHome);

  const prevBtn = appRoot.querySelector('[data-action="prev-mistake"]');
  const nextBtn = appRoot.querySelector('[data-action="next-mistake"]');
  
  if (prevBtn) prevBtn.addEventListener("click", () => changeReviewIndex(-1));
  if (nextBtn) nextBtn.addEventListener("click", () => changeReviewIndex(1));
}

function retryQuiz() {
  setState({
    ...appState,
    view: "config",
    session: null,
    reviewIndex: 0,
  });
}

function goHome() {
  setState({ ...initialState });
}

function setState(nextState) {
  appState = nextState;
  render();
}

function resolveQuestionCount(totalQuestions) {
  if (appState.selectedCount === "all") {
    return totalQuestions;
  }

  if (appState.selectedCount === "custom") {
    const customValue = Number(appState.customCount);
    if (!Number.isInteger(customValue) || customValue < 1) {
      return null;
    }

    return Math.min(customValue, totalQuestions);
  }

  if (Number.isInteger(appState.selectedCount) && appState.selectedCount > 0) {
    return Math.min(appState.selectedCount, totalQuestions);
  }

  return null;
}

function getCountLabel(countValue) {
  if (countValue === "all") return "Todas";
  if (countValue === "custom") return "Personalizado";
  return String(countValue);
}

function formatSubjectLabel(fileName) {
  const cleanName = fileName.replace(/\.json$/i, "").replaceAll("_", " ");
  if (!cleanName) return "";
  return cleanName.charAt(0).toUpperCase() + cleanName.slice(1);
}

function fisherYatesShuffle(values) {
  for (let index = values.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [values[index], values[randomIndex]] = [values[randomIndex], values[index]];
  }

  return values;
}

function escapeHtml(rawValue) {
  return String(rawValue)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function renderReview(mistakes) {
 const currentMistake = mistakes[appState.reviewIndex];
  const userChoice = currentMistake.options[appState.session.answers[currentMistake.id]];
  const correctChoice = currentMistake.options.find(o => o.isCorrect);

  const colorWrong = "var(--danger)";
  const colorCorrect = "var(--primary)";

  return `
    <section class="card" style="margin-top: 1.5rem; border-color: ${colorWrong}">
      <h3 style="font-size: 1.1rem; color: var(--text-muted)">
        Error ${appState.reviewIndex + 1} de ${mistakes.length}
      </h3>
      <p><strong>${escapeHtml(currentMistake.question)}</strong></p>
      
      <div style="margin: 1rem 0; display: grid; gap: 0.5rem;">
        <div style="color: ${colorWrong}; padding: 0.5rem; border-left: 3px solid ${colorWrong}">
          ✕ Elección: ${escapeHtml(userChoice.text)}
        </div>
        <div style="color: ${colorCorrect}; padding: 0.5rem; border-left: 3px solid ${colorCorrect}">
          ✓ Correcta: ${escapeHtml(correctChoice.text)}
        </div>
      </div>

      <div class="actions">
        <button class="ghost" data-action="prev-mistake" ${appState.reviewIndex === 0 ? "disabled" : ""}>Anterior</button>
        <button class="ghost" data-action="next-mistake" ${appState.reviewIndex === mistakes.length - 1 ? "disabled" : ""}>Siguiente</button>
      </div>
    </section>
  `;
}

function changeReviewIndex(step) {
  setState({
    ...appState,
    reviewIndex: appState.reviewIndex + step
  });
}
