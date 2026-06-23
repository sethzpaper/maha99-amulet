import { DiscordSDK } from "@discord/embedded-app-sdk";
import {
  Bot,
  Check,
  ChevronDown,
  CircleAlert,
  Clock3,
  Film,
  GripVertical,
  LoaderCircle,
  ReceiptText,
  Plus,
  RefreshCw,
  Sparkles,
  X,
  createElement,
} from "lucide";
import "./style.css";

const stageMeta = {
  idea: { label: "Ideas", tone: "gray" },
  image_gen: { label: "Image Gen", tone: "green" },
  storyboard: { label: "Storyboard", tone: "purple" },
  render: { label: "Render", tone: "blue" },
  pending_review: { label: "Pending Review", tone: "yellow" },
  review: { label: "Review", tone: "orange" },
  edits: { label: "Edits", tone: "pink" },
  approved: { label: "Approved", tone: "mint" },
};

const state = {
  config: null,
  token: "",
  projects: [],
  jobs: [],
  user: "Workflow team",
  dragging: null,
  socket: null,
};

const icon = (Icon, size = 16) => {
  return createElement(Icon, {
    width: size,
    height: size,
    "stroke-width": 1.8,
  }).outerHTML;
};

async function api(path, options = {}) {
  const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
  if (state.token) headers.Authorization = `Bearer ${state.token}`;
  const response = await fetch(path, { ...options, headers });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.detail || `Request failed (${response.status})`);
  }
  return response.json();
}

async function authorize() {
  state.config = await api("/api/config");
  if (state.config.development) {
    state.token = "development";
    state.user = "Local preview";
    return;
  }
  const discord = new DiscordSDK(state.config.discord_client_id);
  await discord.ready();
  const { code } = await discord.commands.authorize({
    client_id: state.config.discord_client_id,
    response_type: "code",
    state: "",
    prompt: "none",
    scope: ["identify"],
  });
  const token = await api("/api/auth/token", {
    method: "POST",
    body: JSON.stringify({ code }),
  });
  state.token = token.access_token;
  const auth = await discord.commands.authenticate({ access_token: state.token });
  state.user = auth.user.global_name || auth.user.username;
}

async function loadBoard() {
  const [projectData, jobData] = await Promise.all([
    api("/api/projects"),
    api("/api/jobs"),
  ]);
  state.projects = projectData.projects;
  state.jobs = jobData.jobs;
  render();
}

function connectLiveBoard() {
  if (state.socket) state.socket.close();
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  state.socket = new WebSocket(`${protocol}//${window.location.host}/ws/board`);
  state.socket.addEventListener("open", () => {
    state.socket.send(JSON.stringify({ token: state.token }));
  });
  state.socket.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    if (message.type === "projects_changed") loadBoard();
  });
  state.socket.addEventListener("close", () => {
    window.setTimeout(connectLiveBoard, 3000);
  });
}

function projectCard(project) {
  const activeJob = state.jobs.find(
    (job) => job.payload?.project_key === project.project_key && job.status === "running",
  );
  const hasCredits = Number(project.credits || 0) > 0;
  const hasCost = Number(project.cost_total || 0) > 0;
  const costLabel = hasCost
    ? `${formatNumber(project.cost_total)} ${project.cost_unit || "cost"}`
    : "No cost";
  const creditLabel = hasCredits ? `${formatNumber(project.credits)} credits` : "0 credits";
  return `
    <article class="project-card" draggable="true" data-project="${project.project_key}">
      <div class="card-head">
        <span class="drag-handle" title="Move project">${icon(GripVertical, 15)}</span>
        <span class="project-key">${project.project_key}</span>
        <button class="icon-button job-menu" data-job="${project.project_key}" title="Queue AI job">
          ${activeJob ? icon(LoaderCircle, 16) : icon(Sparkles, 16)}
        </button>
      </div>
      <h3>${escapeHtml(project.title)}</h3>
      <p>${escapeHtml(project.brief)}</p>
      <div class="card-metrics">
        <span class="metric credits">${icon(Sparkles, 13)} ${escapeHtml(creditLabel)}</span>
        <span class="metric cost">${icon(ReceiptText, 13)} ${escapeHtml(costLabel)}</span>
      </div>
      <div class="card-foot">
        <span>${escapeHtml(project.owner_name)}</span>
        <time>${formatDate(project.updated_at)}</time>
      </div>
    </article>
  `;
}

function render() {
  const columns = Object.entries(stageMeta).map(([stage, meta]) => {
    const projects = state.projects.filter((project) => project.stage === stage);
    return `
      <section class="stage-column" data-stage="${stage}">
        <header class="stage-header">
          <span class="stage-dot ${meta.tone}"></span>
          <h2>${meta.label}</h2>
          <span class="count">${projects.length}</span>
        </header>
        <div class="card-list">
          ${projects.map(projectCard).join("") || '<div class="empty-stage">Drop project here</div>'}
        </div>
      </section>
    `;
  }).join("");

  const running = state.jobs.filter((job) => job.status === "running").length;
  document.querySelector("#app").innerHTML = `
    <div class="shell">
      <header class="topbar">
        <div class="brand">
          <div class="brand-mark">${icon(Film, 20)}</div>
          <div>
            <h1>Mahaniyom Workflow</h1>
            <p>AI video production board</p>
          </div>
        </div>
        <div class="top-actions">
          <span class="worker-state">${icon(Bot, 15)} ${running} jobs running</span>
          <button id="refresh" class="icon-button" title="Refresh board">${icon(RefreshCw, 17)}</button>
          <div class="user-chip">${escapeHtml(state.user.slice(0, 2).toUpperCase())}</div>
        </div>
      </header>
      <div class="board-toolbar">
        <div class="view-title">
          <h2>Production board</h2>
          <span>${state.projects.length} projects</span>
        </div>
        <div class="toolbar-actions">
          <button class="filter-button">${icon(Clock3, 15)} Updated recently ${icon(ChevronDown, 14)}</button>
          <button id="new-project" class="primary-button large">${icon(Plus, 17)} New project</button>
        </div>
      </div>
      <main class="board">${columns}</main>
      <dialog id="project-dialog">
        <form id="project-form">
          <div class="dialog-head">
            <div>
              <h2>New video project</h2>
              <p>Start in the Ideas stage</p>
            </div>
            <button type="button" id="close-dialog" class="icon-button" title="Close">${icon(X, 17)}</button>
          </div>
          <label>Project title<input name="title" maxlength="160" required autofocus></label>
          <label>Brief<textarea name="brief" maxlength="1200" rows="5" required></textarea></label>
          <div class="dialog-actions">
            <button type="button" id="cancel-project" class="secondary-button">Cancel</button>
            <button type="submit" class="primary-button">Create project</button>
          </div>
        </form>
      </dialog>
      <div id="toast" class="toast" aria-live="polite"></div>
    </div>
  `;
  bindEvents();
}

function bindEvents() {
  document.querySelector("#refresh").addEventListener("click", loadBoard);
  const dialog = document.querySelector("#project-dialog");
  document.querySelector("#new-project").addEventListener("click", () => dialog.showModal());
  document.querySelector("#close-dialog").addEventListener("click", () => dialog.close());
  document.querySelector("#cancel-project").addEventListener("click", () => dialog.close());
  document.querySelector("#project-form").addEventListener("submit", createProject);
  document.querySelectorAll(".project-card").forEach((card) => {
    card.addEventListener("dragstart", () => {
      state.dragging = card.dataset.project;
      card.classList.add("dragging");
    });
    card.addEventListener("dragend", () => {
      state.dragging = null;
      card.classList.remove("dragging");
    });
  });
  document.querySelectorAll(".stage-column").forEach((column) => {
    column.addEventListener("dragover", (event) => {
      event.preventDefault();
      column.classList.add("drag-over");
    });
    column.addEventListener("dragleave", () => column.classList.remove("drag-over"));
    column.addEventListener("drop", async () => {
      column.classList.remove("drag-over");
      if (!state.dragging) return;
      await moveProject(state.dragging, column.dataset.stage);
    });
  });
  document.querySelectorAll(".job-menu").forEach((button) => {
    button.addEventListener("click", () => queueJob(button.dataset.job));
  });
}

async function createProject(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const title = form.elements.title.value.trim();
  const brief = form.elements.brief.value.trim();
  try {
    await api("/api/projects", {
      method: "POST",
      body: JSON.stringify({ title, brief }),
    });
    document.querySelector("#project-dialog").close();
    form.reset();
    await loadBoard();
    showToast(Check, "Project created");
  } catch (error) {
    showToast(CircleAlert, error.message, true);
  }
}

async function moveProject(projectKey, stage) {
  const project = state.projects.find((item) => item.project_key === projectKey);
  if (!project || project.stage === stage) return;
  const previous = project.stage;
  project.stage = stage;
  render();
  try {
    await api(`/api/projects/${encodeURIComponent(projectKey)}/stage`, {
      method: "PATCH",
      body: JSON.stringify({ stage }),
    });
    showToast(Check, `Moved to ${stageMeta[stage].label}`);
  } catch (error) {
    project.stage = previous;
    render();
    showToast(CircleAlert, error.message, true);
  }
}

async function queueJob(projectKey) {
  const project = state.projects.find((item) => item.project_key === projectKey);
  const jobType = project.stage === "render" ? "video_render" : `${project.stage}_generation`;
  try {
    const result = await api(`/api/projects/${encodeURIComponent(projectKey)}/jobs`, {
      method: "POST",
      body: JSON.stringify({ job_type: jobType, payload: {} }),
    });
    showToast(Sparkles, `Queued ${jobType} #${result.message_id}`);
  } catch (error) {
    showToast(CircleAlert, error.message, true);
  }
}

function showToast(Icon, message, error = false) {
  const toast = document.querySelector("#toast");
  toast.className = `toast visible ${error ? "error" : ""}`;
  toast.innerHTML = `${icon(Icon, 16)} ${escapeHtml(message)}`;
  window.setTimeout(() => toast.classList.remove("visible"), 2800);
}

function formatDate(value) {
  const date = new Date(value);
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(date);
}

function formatNumber(value) {
  return new Intl.NumberFormat("en", { maximumFractionDigits: 2 }).format(Number(value || 0));
}

function escapeHtml(value) {
  const node = document.createElement("div");
  node.textContent = value || "";
  return node.innerHTML;
}

async function start() {
  document.querySelector("#app").innerHTML = `
    <div class="loading">${icon(LoaderCircle, 24)}<span>Opening workflow</span></div>
  `;
  try {
    await authorize();
    await loadBoard();
    connectLiveBoard();
  } catch (error) {
    document.querySelector("#app").innerHTML = `
      <div class="fatal">${icon(CircleAlert, 30)}<h1>Could not open workflow</h1><p>${escapeHtml(error.message)}</p></div>
    `;
  }
}

start();
