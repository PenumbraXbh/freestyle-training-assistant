const STORAGE_KEY = "freestyle-mvp-v1.2";
const DANCES = ["Hip-hop", "Popping", "House", "Locking", "Waacking", "Breaking"];
const TAGS = ["musicality", "groove", "停顿", "重心", "身体连接", "texture", "速度变化", "空间", "呼吸", "基础律动"];
const OPTIONAL_FIELDS = [
  ["feeling", "今天练完感觉怎样？", "例如：身体比之前松一点，速度快时还是会急……"],
  ["worked", "哪些地方做得不错？", "例如：能更稳定地听到持续音……"],
  ["improve", "哪里还想再练练？", "例如：重心移动和肩胸连接……"],
  ["next", "练着练着冒出了什么新想法？", "例如：下次试试在半拍后再移动……"],
];
const INSPIRATIONS = [
  "选一段持续音，只用躯干和重心变化回应它；先忽略最明显的鼓点。",
  "用同一个基础律动做三轮：第一轮放大停顿，第二轮只改变方向，第三轮把两者叠在一起。",
  "挑一个熟悉的动作，把速度降到一半；每次连接断掉时先停住，再从呼吸重新开始。",
  "先让脚保持最简单的节奏，只让上半身回应音乐里的空白，观察重心什么时候想跟上。",
  "在一首歌里只追踪一种声音。每八拍改变一次回应它的身体部位，不追求动作数量。",
];

function createId() {
  try {
    if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
    if (globalThis.crypto?.getRandomValues) {
      const bytes = new Uint8Array(16);
      globalThis.crypto.getRandomValues(bytes);
      bytes[6] = (bytes[6] & 0x0f) | 0x40;
      bytes[8] = (bytes[8] & 0x3f) | 0x80;
      return [...bytes].map((value, index) => `${[4, 6, 8, 10].includes(index) ? "-" : ""}${value.toString(16).padStart(2, "0")}`).join("");
    }
  } catch {}
  return `local-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 11)}`;
}

let state = loadState();
let ui = {
  view: state.session ? "today" : "landing",
  modal: null,
  selectedRecordId: null,
  draft: null,
  inspirationResult: null,
  inspirationSource: "random",
  history: { query: "", before: "", dance: "", tag: "", calendarOpen: false, calendarMonth: todayISO().slice(0, 7) },
};

const app = document.querySelector("#app");

function initialState() {
  const visitorId = createId();
  const bucketIndex = hash(visitorId) % 3;
  return {
    version: "1.2",
    visitorId,
    session: null,
    records: [],
    pendingInspiration: null,
    feedback: [],
    events: [],
    experimentBucket: ["inspiration", "footprint", "control"][bucketIndex],
    footprintChoice: null,
  };
}

function loadState() {
  try {
    const parsed = JSON.parse(globalThis.localStorage?.getItem(STORAGE_KEY) || "null");
    return parsed?.version ? { ...initialState(), ...parsed } : initialState();
  } catch {
    return initialState();
  }
}

function persist() {
  try {
    globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // 隐私模式或禁用本地存储时，仍允许当前页面会话继续运行。
  }
}

function track(name, properties = {}) {
  state.events.push({ name, properties, at: new Date().toISOString() });
  state.events = state.events.slice(-250);
  persist();
}

function hash(text) {
  return [...text].reduce((sum, char) => ((sum << 5) - sum + char.charCodeAt(0)) | 0, 0) >>> 0;
}

function escapeHtml(value = "") {
  return String(value).replace(/[&<>'"]/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;",
  })[char]);
}

function todayISO() {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60000;
  return new Date(now - offset).toISOString().slice(0, 10);
}

function formatDate(date) {
  if (date === todayISO()) return "今天";
  const [year, month, day] = date.split("-");
  return `${Number(month)} 月 ${Number(day)} 日${year !== todayISO().slice(0, 4) ? ` · ${year}` : ""}`;
}

function render(options = {}) {
  const preservePosition = Boolean(options.preserveScroll) || (ui.view === "record" && Boolean(ui.draft?.dirty) && !ui.modal);
  const previousScrollY = preservePosition ? window.scrollY : 0;
  if (!state.session || ui.view === "landing") {
    app.innerHTML = renderLanding();
    return;
  }
  app.innerHTML = renderShell();
  if (ui.modal) app.insertAdjacentHTML("beforeend", renderModal());
  if (preservePosition) {
    const restorePosition = () => window.scrollTo(0, previousScrollY);
    if (typeof window.requestAnimationFrame === "function") window.requestAnimationFrame(restorePosition);
    else setTimeout(restorePosition, 0);
  } else {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
}

function renderLanding() {
  return `
    <main class="landing">
      <section class="landing-hero">
        <div class="brand"><span class="brand-mark">F</span><span>Freestyle 训练助手</span></div>
        <div class="landing-copy">
          <p class="eyebrow">Personal training journal</p>
          <h1>让训练，<span class="scribble">留下线索。</span></h1>
          <p class="lead">一点灵感，一句记录。以后，重新发现自己的训练路径。</p>
        </div>
        <div class="landing-note"><span><i></i>真实训练发生在产品外</span><span><i></i>不评分，不催促连续打卡</span></div>
      </section>
      <aside class="auth-panel">
        <div class="auth-card">
          <p class="eyebrow">公开演示版 · v1.2</p>
          <h2>开始记录</h2>
          <p class="muted">先以访客模式体验；登录同步将在生产版接入。</p>
          <div class="auth-option featured">
            <h3>先以访客身份使用</h3>
            <p>数据只保存在当前浏览器。</p>
            <button class="btn btn-acid btn-block" data-action="start-demo">体验完整演示</button>
            <p class="small muted">将自动载入脱敏示例记录，便于直接体验历史与训练足迹。</p>
          </div>
          <div class="auth-option">
            <h3>登录后同步</h3>
            <p>演示未来的跨设备同步流程。</p>
            <button class="btn btn-ghost btn-block" data-action="demo-login">使用演示账户登录</button>
          </div>
        </div>
      </aside>
    </main>`;
}

function renderShell() {
  const page = {
    today: renderToday,
    inspiration: renderInspiration,
    record: renderRecordForm,
    history: renderHistory,
    detail: renderDetail,
    footprint: renderFootprint,
  }[ui.view]?.() || renderToday();
  return `
    <div class="app-shell">
      <aside class="sidebar">
        <div class="brand"><span class="brand-mark">F</span><span>Freestyle 训练助手</span></div>
        ${renderNav("desktop")}
        <div class="sidebar-bottom">
          <button class="account-chip" data-action="open-account">
            <span class="avatar">${state.session.type === "guest" ? "访" : "D"}</span>
            <span><strong>${state.session.type === "guest" ? "网页访客" : "演示账户"}</strong><small>${state.session.type === "guest" ? "仅保存于当前浏览器" : "模拟跨端同步"}</small></span>
          </button>
        </div>
      </aside>
      <main class="main">
        <div class="mobile-topbar">
          <div class="brand"><span class="brand-mark">F</span><span>Freestyle 训练助手</span></div>
          <button class="icon-btn" data-action="open-account" aria-label="账户与数据">${state.session.type === "guest" ? "访" : "D"}</button>
        </div>
        <header class="topbar">
          <p class="eyebrow" style="margin:0">${topLabel()}</p>
          <div class="topbar-right"><button class="btn btn-ghost btn-small" data-action="open-feedback">反馈与建议</button></div>
        </header>
        ${page}
      </main>
      ${renderNav("mobile")}
    </div>`;
}

function topLabel() {
  const labels = { today: "Today", inspiration: "Training inspiration", record: "Training journal", history: "History", detail: "Record detail", footprint: "Research trail" };
  return labels[ui.view] || "Freestyle training";
}

function renderNav(mode) {
  const items = [
    ["today", "◉", "今天"], ["history", "≡", "历史"], ["footprint", "⌁", "足迹"],
  ];
  if (mode === "mobile") {
    return `<nav class="bottom-nav" aria-label="主导航">
      ${items.map(([view, icon, label]) => `<button class="${ui.view === view ? "active" : ""}" data-view="${view}"><span>${icon}</span>${label}</button>`).join("")}
      <button class="record" data-action="new-record"><span>＋</span>记录</button>
    </nav>`;
  }
  return `<nav class="nav-list" aria-label="主导航">
    ${items.map(([view, icon, label]) => `<button class="nav-item ${ui.view === view ? "active" : ""}" data-view="${view}"><span class="nav-icon">${icon}</span>${label}</button>`).join("")}
    <button class="nav-item record" data-action="new-record"><span class="nav-icon">＋</span>记录这次训练</button>
  </nav>`;
}

function renderToday() {
  const recent = [...state.records].sort((a, b) => b.date.localeCompare(a.date))[0];
  return `<section class="page">
    <div class="page-head">
      <div><p class="eyebrow">今天 · ${formatDate(todayISO())}</p><h1>训练不必标准，记录也不必。</h1><p>一句话、一个标签，或者一条刚采用的灵感，都可以成为以后重新发现自己的线索。</p></div>
      <button class="btn btn-ghost" data-action="open-feedback">反馈与建议</button>
    </div>
    <div class="hero-grid">
      <article class="hero-card hero-before">
        <div><p class="eyebrow" style="color:#bcb8ae">Before training</p><h2>还没想好练什么？</h2><p>从一个随机方向、模糊想法或已有足迹开始；不需要提前承诺训练计划。</p></div>
        <div class="hero-actions"><button class="btn btn-acid" data-action="open-inspiration">给我一个训练思路</button><span class="small muted">先开始，再决定怎么练</span></div>
      </article>
      <div class="stack">
        <article class="card after-card">
          <span class="mini-label">After training</span>
          <h3>这次训练，留下点什么。</h3>
          <p>一句文字、一个舞种或补充标签，就能留下线索。</p>
          <button class="btn btn-primary btn-block" data-action="new-record">＋ 记录这次训练</button>
        </article>
        ${state.pendingInspiration ? `<article class="card card-orange"><span class="mini-label">已暂存灵感</span><p>${escapeHtml(state.pendingInspiration.content)}</p><button class="btn btn-ghost btn-small" data-action="new-record">带入一条新记录 →</button></article>` : ""}
      </div>
    </div>
    <div style="margin-top:22px">
      ${recent ? `<article class="card recent-card" data-action="open-record" data-id="${recent.id}"><div class="card-header"><div><span class="mini-label">最近一次记录</span><h3>${escapeHtml(recordTitle(recent))}</h3></div><span>→</span></div><p>${escapeHtml(recent.basicText || recent.optional.feeling || "只留下了标签，仍然是一条有效线索。")}</p><div class="record-meta"><span>${formatDate(recent.date)}</span><span>·</span><span>${escapeHtml(allTags(recent).join(" / "))}</span></div></article>` : `<div class="empty-state"><h3>这里还没有训练记录</h3><p>你可以直接记录刚结束的训练，也可以先载入一组演示数据，快速体验历史检索和训练足迹。</p><div class="hero-actions" style="justify-content:center"><button class="btn btn-primary" data-action="new-record">创建第一条记录</button><button class="btn btn-ghost" data-action="load-demo">载入演示数据</button></div></div>`}
    </div>
  </section>`;
}

function renderInspiration() {
  const stats = footprintStats();
  const eligible = stats.recordCount >= 5 && stats.signalCount >= 20;
  if (state.pendingInspiration && !ui.inspirationResult) {
    return `<section class="page panel"><div class="back-row"><button class="back-link" data-view="today">← 返回今天</button></div><p class="eyebrow">已用作本次练习</p><h1>灵感已暂存。</h1><p class="muted">下一次新建记录时会自动带入。你可以在记录页编辑或删除导入内容；新的采用操作会替换它。</p><article class="result-card"><span class="mini-label" style="color:#bcb8ae">待关联灵感</span><p class="result-text">${escapeHtml(state.pendingInspiration.content)}</p><div class="result-actions"><button class="btn btn-acid" data-action="new-record">去训练，之后记录</button><button class="btn btn-ghost" data-action="generate" data-source="random">换一个新思路</button></div></article></section>`;
  }
  return `<section class="page panel inspiration-page">
    <div class="back-row"><button class="back-link" data-view="today">← 返回今天</button></div>
    <div class="inspiration-intro"><p class="eyebrow">按需工具 · 可以完全跳过</p><h1>给今天一点方向。</h1><p class="muted">选择一种方式，结果会立即显示；这里不会制定训练计划或监控执行。</p></div>
    <div class="source-grid">
      <article class="source-card"><h3>随机思路</h3><p>暂时没有方向，也可以从一个小限制开始。</p><button class="btn btn-primary btn-small" data-action="generate" data-source="random">随机给我一个思路</button></article>
      <article class="source-card"><h3>一个模糊想法</h3><p>写下你想研究但还没展开的方向。</p><input id="direction-input" class="input" placeholder="例如：想练停顿" /><button class="btn btn-ghost btn-small" style="margin-top:10px" data-action="generate" data-source="direction">根据方向生成</button></article>
      <article class="source-card ${eligible ? "card-acid" : "disabled"}"><h3>根据我的足迹</h3><p>${eligible ? `带入近期常见的 ${escapeHtml(stats.topSignals.slice(0, 3).join("、"))}。` : `达到 5 条记录与 20 条信号后开放。当前 ${stats.recordCount} / 5、${stats.signalCount} / 20。`}</p><button class="btn ${eligible ? "btn-primary" : "btn-ghost"} btn-small" data-action="generate" data-source="footprint" ${eligible ? "" : "disabled"}>根据足迹生成</button></article>
    </div>
    <p class="inspiration-hint">生成后以弹窗显示，不会把你带到页面其他位置。</p>
  </section>`;
}

function renderInspirationResult(result) {
  if (Array.isArray(result)) {
    return `<section><p class="eyebrow">早期偏好实验</p><h2>这两个方向，你更想试哪一个？</h2><p class="muted small">仅选中的方案会进入“用作本次练习”流程；选择不会被解释为训练评价。</p><div class="pair-grid">${result.map((text, index) => `<article class="pair-option"><span class="mini-label">方案 ${index ? "B" : "A"}</span><p>${escapeHtml(text)}</p><button class="btn btn-primary btn-small" data-action="select-pair" data-index="${index}">更想试这个</button></article>`).join("")}</div><div class="result-actions" style="margin-top:12px"><button class="btn btn-ghost btn-small" data-action="dismiss-pair">都不合适</button><button class="btn btn-ghost btn-small" data-action="dismiss-pair">暂不判断</button></div></section>`;
  }
  return `<article class="result-card"><span class="mini-label" style="color:#bcb8ae">这一次的灵感 · ${sourceLabel(ui.inspirationSource)}</span><p id="result-text" class="result-text" contenteditable="false">${escapeHtml(result)}</p><div class="result-actions"><button class="btn btn-acid" data-action="adopt-inspiration">用作本次练习</button><button class="btn btn-ghost" data-action="generate" data-source="${ui.inspirationSource}">换一个</button><button class="btn btn-ghost" data-action="edit-inspiration">我想微调</button></div><p class="small" style="margin:18px 0 0;color:#bcb8ae">采用后会自动带入下一条训练记录，仍可编辑。</p></article>`;
}

function sourceLabel(source) {
  return ({ random: "随机", direction: "模糊方向", footprint: "训练足迹" })[source] || "随机";
}

function renderRecordForm() {
  if (!ui.draft) ui.draft = makeDraft();
  const d = ui.draft;
  const valid = isDraftValid(d);
  return `<section class="page form-shell">
    <div class="back-row"><button class="back-link" data-action="close-record">← 退出编辑</button></div>
    <div class="page-head"><div><p class="eyebrow">${d.id ? "编辑记录" : "新建训练记录"}</p><h1>${d.id ? "把这条线索整理清楚。" : "刚才练了什么？"}</h1><p>基本练习内容只需满足一项；其他问题都可以跳过。</p></div></div>
    <div class="form-section required">
      <div class="field"><label for="record-date">日期</label><input id="record-date" class="input" type="date" data-field="date" value="${d.date}" /></div>
      ${d.importedInspiration ? `<div class="field imported"><div class="imported-head"><strong>已自动带入本次练习灵感</strong><button class="btn btn-ghost btn-small" data-action="remove-import">删除</button></div><p>${escapeHtml(d.importedInspiration.content)}</p><span class="small muted">它会按文字计入基本练习内容，也可直接在下方修改。</span></div>` : ""}
      <div class="field"><div class="field-head"><label for="basic-text">基本练习内容 <span class="muted small">（文字或标签至少一项）</span></label><button class="btn btn-ghost btn-small" data-action="voice" data-field="basicText">语音转写</button></div><textarea id="basic-text" class="textarea" data-field="basicText" placeholder="写下练了什么，或用语音转写……">${escapeHtml(d.basicText)}</textarea></div>
      <div class="field"><label>本次主要舞种 <span class="muted small">可选 · 单选</span></label><div class="tag-group">${DANCES.map(tag => `<button class="tag dance ${d.mainDance === tag ? "selected" : ""}" data-action="choose-dance" data-value="${tag}">${tag}</button>`).join("")}<button class="tag dance ${d.mainDance && !DANCES.includes(d.mainDance) ? "selected" : ""}" data-action="custom-dance">＋ 自定义</button></div></div>
      <div class="field"><label>补充标签 <span class="muted small">可选 · 多选</span></label><div class="tag-group">${TAGS.map(tag => `<button class="tag ${d.tags.includes(tag) ? "selected" : ""}" data-action="toggle-tag" data-value="${tag}">${tag}</button>`).join("")}<button class="tag" data-action="custom-tag">＋ 添加标签</button>${d.tags.filter(tag => !TAGS.includes(tag)).map(tag => `<button class="tag selected" data-action="toggle-tag" data-value="${escapeHtml(tag)}">${escapeHtml(tag)}</button>`).join("")}</div><p class="field-note">今天练了不止一种舞？可以分别保存成几条记录，之后回看会更清楚。</p></div>
      <div id="record-validation" class="validation ${valid ? "hidden" : ""}">至少添加一段确认后的文字、一个舞种或补充标签，或保留已导入灵感。</div>
    </div>
    <div class="form-section"><p class="eyebrow">可选记录 · 更高语义权重</p><h3>如果还有一点心力，可以再写几句。</h3><p class="muted small">这些内容不改变足迹的记录准入计数，但会在摘要和后续灵感中得到更高权重。</p>${OPTIONAL_FIELDS.map(([key, label, placeholder]) => `<div class="field"><div class="field-head"><label for="${key}">${label}</label><button class="btn btn-ghost btn-small" data-action="voice" data-field="optional.${key}">语音转写</button></div><textarea id="${key}" class="textarea" data-field="optional.${key}" placeholder="${placeholder}">${escapeHtml(d.optional[key])}</textarea></div>`).join("")}</div>
    <div class="form-footer"><span class="small muted">原始录音不会保存；只有确认后的文字会进入记录。</span><button id="save-record" class="btn btn-acid" data-action="save-record" ${valid ? "" : "disabled"}>${d.id ? "保存修改" : "保存训练记录"}</button></div>
  </section>`;
}

function makeDraft(record = null) {
  if (record) return JSON.parse(JSON.stringify({ ...record, dirty: false }));
  const pending = state.pendingInspiration ? JSON.parse(JSON.stringify(state.pendingInspiration)) : null;
  return { id: null, date: todayISO(), basicText: pending?.content || "", mainDance: "", tags: [], optional: { feeling: "", worked: "", improve: "", next: "" }, importedInspiration: pending, dirty: false, createdAt: null };
}

function isDraftValid(d) {
  return Boolean(d.basicText.trim() || d.mainDance || d.tags.length || d.importedInspiration);
}

function renderHistory() {
  const records = filteredRecords();
  const dances = [...new Set(state.records.map(r => r.mainDance).filter(Boolean))];
  const tags = [...new Set(state.records.flatMap(r => r.tags))];
  return `<section class="page">
    <div class="page-head"><div><p class="eyebrow">训练历史</p><h1>重新发现旧经验。</h1><p>按关键词、主要舞种、补充标签或“截至日期”寻找记录。</p></div><button class="btn btn-primary" data-action="new-record">＋ 添加练习记录</button></div>
    <div class="toolbar"><div class="search-box"><input id="history-query" class="input" value="${escapeHtml(ui.history.query)}" placeholder="搜索文字、关键词或标签" /><button class="btn btn-primary" data-action="history-search">搜索</button></div></div>
    <div class="history-layout">
      <div class="record-list">${records.length ? records.map(renderRecordCard).join("") : `<div class="empty-state"><h3>没有找到相符记录</h3><p>试着清除筛选，或换一个更宽泛的关键词。</p><button class="btn btn-ghost" data-action="clear-filters">清除全部筛选</button></div>`}</div>
      <aside class="card filter-panel"><div class="card-header"><h3>筛选</h3><button class="back-link" data-action="clear-filters">清除</button></div>${ui.history.before ? `<div class="active-filter">截至 ${ui.history.before}（包含当日及更早记录）</div>` : ""}<div class="field"><label>截至日期</label><button class="btn btn-ghost btn-block" data-action="toggle-calendar">${ui.history.before || "选择日期"} <span>▾</span></button>${ui.history.calendarOpen ? renderCalendar() : ""}</div><div class="field"><label for="history-dance">主要舞种</label><select id="history-dance" class="select"><option value="">全部舞种</option>${dances.map(value => `<option ${ui.history.dance === value ? "selected" : ""}>${escapeHtml(value)}</option>`).join("")}</select></div><div class="field"><label for="history-tag">补充标签</label><select id="history-tag" class="select"><option value="">全部标签</option>${tags.map(value => `<option ${ui.history.tag === value ? "selected" : ""}>${escapeHtml(value)}</option>`).join("")}</select></div><button class="btn btn-primary btn-block" style="margin-top:18px" data-action="apply-filters">应用筛选</button></aside>
    </div>
  </section>`;
}

function renderCalendar() {
  const [year, month] = ui.history.calendarMonth.split("-").map(Number);
  const firstDay = new Date(year, month - 1, 1).getDay();
  const days = new Date(year, month, 0).getDate();
  const recorded = new Set(state.records.map(record => record.date));
  const cells = Array.from({ length: firstDay }, () => "<span></span>");
  for (let day = 1; day <= days; day += 1) {
    const date = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    cells.push(`<button class="calendar-day ${recorded.has(date) ? "has-record" : ""} ${ui.history.before === date ? "chosen" : ""}" data-action="select-date" data-date="${date}">${day}</button>`);
  }
  return `<div class="calendar-pop"><div class="calendar-head"><button class="back-link" data-action="calendar-prev">‹</button><strong>${year} 年 ${month} 月</strong><button class="back-link" data-action="calendar-next">›</button></div><div class="calendar-week"><span>日</span><span>一</span><span>二</span><span>三</span><span>四</span><span>五</span><span>六</span>${cells.join("")}</div><p class="field-note">有圆点的日期表示当天存在记录。</p></div>`;
}

function filteredRecords() {
  const q = ui.history.query.trim().toLowerCase();
  return [...state.records].filter(record => {
    const haystack = [record.basicText, record.mainDance, ...record.tags, ...Object.values(record.optional)].join(" ").toLowerCase();
    return (!q || haystack.includes(q)) && (!ui.history.before || record.date <= ui.history.before) && (!ui.history.dance || record.mainDance === ui.history.dance) && (!ui.history.tag || record.tags.includes(ui.history.tag));
  }).sort((a, b) => b.date.localeCompare(a.date) || b.updatedAt.localeCompare(a.updatedAt));
}

function renderRecordCard(record) {
  return `<article class="record-card" data-action="open-record" data-id="${record.id}"><div class="record-date">${formatDate(record.date)}</div><div><h3>${escapeHtml(recordTitle(record))}</h3><p>${escapeHtml(record.basicText || record.optional.feeling || "只留下了标签，仍然是一条有效线索。")}</p><div class="record-meta">${allTags(record).map(tag => `<span class="tag" style="min-height:28px">${escapeHtml(tag)}</span>`).join("")}</div></div><span>→</span></article>`;
}

function recordTitle(record) {
  return record.mainDance ? `${record.mainDance} · ${record.tags.slice(0, 2).join(" / ") || "训练记录"}` : record.tags.slice(0, 3).join(" / ") || "训练记录";
}

function allTags(record) {
  return [record.mainDance, ...record.tags].filter(Boolean);
}

function renderDetail() {
  const record = state.records.find(item => item.id === ui.selectedRecordId);
  if (!record) { ui.view = "history"; return renderHistory(); }
  const optional = OPTIONAL_FIELDS.filter(([key]) => record.optional[key]);
  return `<section class="page panel" style="max-width:960px"><div class="back-row"><button class="back-link" data-view="history">← 返回历史</button></div><div class="page-head"><div><p class="eyebrow">${formatDate(record.date)}</p><h1>${escapeHtml(recordTitle(record))}</h1><div class="record-meta">${allTags(record).map(tag => `<span class="tag selected" style="min-height:30px">${escapeHtml(tag)}</span>`).join("")}</div></div></div><div class="detail-grid"><div class="detail-content"><article class="card"><span class="mini-label">基本练习内容</span><div class="prose-block">${escapeHtml(record.basicText || "本次使用标签完成记录。")}</div></article>${record.importedInspiration ? `<article class="card card-acid"><span class="mini-label">关联的训练灵感</span><p>${escapeHtml(record.importedInspiration.content)}</p></article>` : ""}${optional.map(([key, label]) => `<article class="card"><span class="mini-label">${label}</span><div class="prose-block">${escapeHtml(record.optional[key])}</div></article>`).join("")}</div><aside class="card detail-side"><h3>管理记录</h3><p class="muted small">修改或删除后，检索、信号数量与训练足迹会立即重算。</p><button class="btn btn-primary btn-block" data-action="edit-record">编辑记录</button><button class="btn btn-danger btn-block" data-action="delete-record">删除记录</button></aside></div></section>`;
}

function footprintStats() {
  const frequencies = new Map();
  let signalCount = 0;
  for (const record of state.records) {
    const tagSignals = allTags(record);
    const words = keywordsFor(record);
    signalCount += tagSignals.length + words.length;
    [...tagSignals, ...words].forEach(value => frequencies.set(value, (frequencies.get(value) || 0) + 1));
  }
  const topSignals = [...frequencies.entries()].sort((a, b) => b[1] - a[1]).map(([value]) => value);
  return { recordCount: state.records.length, signalCount, topSignals, frequencies };
}

function keywordsFor(record) {
  const text = [record.basicText, ...Object.values(record.optional)].join(" ").toLowerCase();
  const known = ["持续音", "鼓点", "重心", "连接", "停顿", "速度", "呼吸", "节奏", "空间", "放松", "肩", "胸", "脚", "方向", "质感", "musicality", "groove", "timing", "texture"];
  return known.filter(word => text.includes(word) && !allTags(record).map(v => v.toLowerCase()).includes(word)).slice(0, 3);
}

function renderFootprint() {
  const stats = footprintStats();
  const eligible = stats.recordCount >= 5 && stats.signalCount >= 20;
  if (!eligible) {
    return `<section class="page panel"><div class="page-head"><div><p class="eyebrow">训练足迹 · 尚在形成</p><h1>先积累，不急着下结论。</h1><p>足迹只整理你主动留下的主题、标签和确认文字，不评价训练质量。</p></div></div><div class="metric-grid"><article class="metric-card"><span class="metric-value">${stats.recordCount} / 5</span><span>有效记录</span><div class="progress"><span style="width:${Math.min(100, stats.recordCount / 5 * 100)}%"></span></div></article><article class="metric-card"><span class="metric-value">${stats.signalCount} / 20</span><span>有效信号</span><div class="progress"><span style="width:${Math.min(100, stats.signalCount / 20 * 100)}%"></span></div></article></div><article class="card card-acid"><h3>你的训练足迹正在形成</h3><p>再留下 ${Math.max(0, 5 - stats.recordCount)} 条记录，并累积更多标签或确认文字中的关键词，即可生成第一份研究路径。</p><p class="small" style="margin:0">每次标签选择记 1 条；每条记录最多从确认文字中提取 3 个去重关键词。</p></article>${!state.records.length ? `<div class="empty-state" style="margin-top:18px"><h3>想先看看足迹长什么样？</h3><p>载入演示数据即可体验已生成状态，之后可以在账户与数据中清空。</p><button class="btn btn-primary" data-action="load-demo">载入演示数据</button></div>` : ""}</section>`;
  }
  const groups = groupByDance();
  const pairExperiment = state.experimentBucket === "footprint" && !state.footprintChoice;
  return `<section class="page"><div class="page-head"><div><p class="eyebrow">训练足迹 · 已生成</p><h1>你最近在反复研究这些。</h1><p>这是一份积累路径，不是成绩单。编辑或删除记录后会自动重算。</p></div><button class="btn btn-primary" data-action="footprint-inspiration">基于足迹生成下一次练习</button></div><div class="metric-grid"><article class="metric-card"><span class="metric-value">${stats.recordCount}</span><span>有效记录</span></article><article class="metric-card"><span class="metric-value">${stats.signalCount}</span><span>有效信号</span></article></div>${pairExperiment ? renderFootprintExperiment(stats) : `<div class="trail-grid"><article class="trail-card wide card-acid"><span class="mini-label">最近的研究线索</span><h2>${escapeHtml(stats.topSignals.slice(0, 2).join(" × ") || "你的主题")}</h2><p>这些标签或关键词最近反复出现，也逐渐与 ${escapeHtml(stats.topSignals.slice(2, 5).join("、") || "新的身体感受")} 发生联系。</p></article>${Object.entries(groups).map(([dance, values]) => `<article class="trail-card"><span class="mini-label">${escapeHtml(dance)}</span><h3>这个分组里的关注</h3><div class="signal-cloud">${values.slice(0, 7).map(value => `<span>${escapeHtml(value)}</span>`).join("")}</div></article>`).join("")}</div>`}</section>`;
}

function groupByDance() {
  const groups = {};
  state.records.forEach(record => {
    const key = record.mainDance || "跨舞种的关注";
    groups[key] ||= [];
    [...record.tags, ...keywordsFor(record)].forEach(value => { if (!groups[key].includes(value)) groups[key].push(value); });
  });
  return groups;
}

function renderFootprintExperiment(stats) {
  const first = stats.topSignals.slice(0, 4);
  const second = [...stats.topSignals].reverse().slice(0, 4);
  return `<section class="card"><p class="eyebrow">早期生成效果实验</p><h2>哪一份更贴近你近期的训练？</h2><p class="muted">选择只用于比较生成版本，不会被记作对训练的负面评价。</p><div class="pair-grid"><article class="pair-option"><span class="mini-label">方案 A · 主题集中</span><p>你最近持续围绕 <b>${escapeHtml(first.slice(0,2).join("、"))}</b> 展开，并把它们与 ${escapeHtml(first.slice(2).join("、"))} 联系起来。</p><button class="btn btn-primary" data-action="choose-footprint" data-choice="A">更贴近</button></article><article class="pair-option"><span class="mini-label">方案 B · 线索扩展</span><p>近期记录从 <b>${escapeHtml(second[0] || "基础")}</b> 延伸到 ${escapeHtml(second.slice(1).join("、"))}，呈现出跨主题的探索。</p><button class="btn btn-primary" data-action="choose-footprint" data-choice="B">更贴近</button></article></div><div class="result-actions" style="margin-top:12px"><button class="btn btn-ghost btn-small" data-action="choose-footprint" data-choice="都不合适">都不合适</button><button class="btn btn-ghost btn-small" data-action="choose-footprint" data-choice="暂不判断">暂不判断</button></div></section>`;
}

function renderModal() {
  const m = ui.modal;
  if (m.kind === "inspiration-result") return renderInspirationModal();
  if (m.kind === "discard") return modal("放弃本次编辑？", "你填写的文字、标签或已导入灵感尚未保存。放弃后，本次内容不会保留。", `<button class="btn btn-ghost" data-action="modal-close">继续编辑</button><button class="btn btn-danger" data-action="confirm-discard">放弃并退出</button>`);
  if (m.kind === "delete") return modal("删除这条记录？", "删除后不可恢复。相关训练足迹、关键词和信号数量会同步更新。", `<button class="btn btn-ghost" data-action="modal-close">取消</button><button class="btn btn-danger" data-action="confirm-delete">确认永久删除</button>`);
  if (m.kind === "prompt") return modal(escapeHtml(m.title), escapeHtml(m.description || ""), `<input id="prompt-value" class="input" value="${escapeHtml(m.value || "")}" placeholder="${escapeHtml(m.placeholder || "")}" /><div class="modal-actions"><button class="btn btn-ghost" data-action="modal-close">取消</button><button class="btn btn-primary" data-action="prompt-confirm">确认</button></div>`, true);
  if (m.kind === "voice") return modal("确认转写", `正在填写：${escapeHtml(fieldLabel(m.field))}`, `<div class="card card-acid"><h3>语音转写演示</h3><p class="small">本地 MVP 不会调用麦克风或上传音频。下方文字用于验证“确认后回填”的产品流程。</p></div><div class="field"><label for="voice-result">转写结果</label><textarea id="voice-result" class="textarea">${escapeHtml(m.text)}</textarea></div><p class="small muted">确认后仅保存编辑后的文字；生产版原始音频也不会留存。</p><div class="modal-actions"><button class="btn btn-ghost" data-action="modal-close">取消</button><button class="btn btn-primary" data-action="voice-confirm">确认并导入此输入框</button></div>`, true);
  if (m.kind === "feedback") return modal("反馈与建议", "这不会打断训练记录流程。网页访客也可以提交；当前 MVP 会先保存在本浏览器中，接入运营接口后可直接替换。", `<div class="field"><label for="feedback-type">反馈类型</label><select id="feedback-type" class="select"><option>问题</option><option>建议</option><option>其他</option></select></div><div class="field"><label for="feedback-text">想告诉我们什么？</label><textarea id="feedback-text" class="textarea" placeholder="请尽量描述发生了什么，或你希望怎样使用……"></textarea></div><div class="field"><label for="feedback-contact">联系方式 <span class="muted small">可选</span></label><input id="feedback-contact" class="input" placeholder="微信、邮箱或手机号" /></div><div class="modal-actions"><button class="btn btn-ghost" data-action="modal-close">取消</button><button class="btn btn-primary" data-action="submit-feedback">提交反馈</button></div>`, true);
  if (m.kind === "account") return modal("账户与数据", state.session.type === "guest" ? "访客数据仅存于当前浏览器。建议在试用后导出备份。" : "当前为演示账户；真实跨端同步需要后端账户服务。", `<div class="card"><div class="record-meta"><span class="avatar">${state.session.type === "guest" ? "访" : "D"}</span><div><strong>${state.session.type === "guest" ? "网页访客" : "演示账户"}</strong><br><span>${state.records.length} 条记录 · ${state.events.length} 个本地事件</span></div></div></div><div class="data-actions"><button class="btn btn-ghost btn-block" data-action="export-data">导出本地数据 JSON</button><button class="btn btn-ghost btn-block" data-action="load-demo">载入演示数据</button><button class="btn btn-danger btn-block" data-action="clear-data">清空训练数据</button><button class="btn btn-ghost btn-block" data-action="logout">退出到开始页</button></div>`, true);
  if (m.kind === "clear") return modal("清空全部训练数据？", "训练记录、待关联灵感、反馈与本地事件都会删除，且无法恢复。", `<button class="btn btn-ghost" data-action="modal-close">取消</button><button class="btn btn-danger" data-action="confirm-clear">确认清空</button>`);
  return "";
}

function renderInspirationModal() {
  const isPair = Array.isArray(ui.inspirationResult);
  const title = isPair ? "这两个方向，你更想试哪一个？" : "这一次的训练灵感";
  const description = isPair ? "仅选中的方案会进入“用作本次练习”流程；选择不会被解释为训练评价。" : `来自${sourceLabel(ui.inspirationSource)}。你可以直接采用、换一个，或先微调文字。`;
  const body = `${renderInspirationResult(ui.inspirationResult)}<div class="modal-actions"><button class="btn btn-ghost" data-action="close-inspiration-result">先不用了</button></div>`;
  return modal(title, description, `<div class="inspiration-modal-content">${body}</div>`, true);
}

function modal(title, description, body, bodyIncludesActions = false) {
  return `<div class="modal-layer" role="dialog" aria-modal="true" aria-labelledby="modal-title"><div class="modal"><h2 id="modal-title">${title}</h2>${description ? `<p class="muted">${description}</p>` : ""}${bodyIncludesActions ? body : `<div class="modal-actions">${body}</div>`}</div></div>`;
}

function fieldLabel(field) {
  if (field === "basicText") return "基本练习内容";
  const key = field.split(".")[1];
  return OPTIONAL_FIELDS.find(([id]) => id === key)?.[1] || "记录内容";
}

function showToast(message) {
  const region = document.querySelector("#toast-region");
  const item = document.createElement("div");
  item.className = "toast";
  item.textContent = message;
  region.append(item);
  setTimeout(() => item.remove(), 3200);
}

function generateInspiration(source) {
  ui.inspirationSource = source;
  const direction = document.querySelector("#direction-input")?.value.trim();
  const stats = footprintStats();
  const seed = state.events.filter(event => event.name === "inspiration_generated").length;
  let result;
  if (source === "direction") {
    if (!direction) { showToast("先写下一个模糊方向。"); return; }
    result = `围绕“${direction}”做三轮尝试：第一轮只观察，第二轮加一个身体限制，第三轮保留最有感觉的变化。`;
  } else if (source === "footprint") {
    const [a = "停顿", b = "重心", c = "连接"] = stats.topSignals;
    result = `从“${a}”开始，但先不重复熟悉的做法；把注意力移到“${b}”，再观察它如何改变“${c}”。`;
  } else {
    result = INSPIRATIONS[seed % INSPIRATIONS.length];
  }
  const shouldPair = state.experimentBucket === "inspiration" && !state.events.some(event => event.name === "pairwise_experiment_selected");
  ui.inspirationResult = shouldPair ? [result, INSPIRATIONS[(seed + 2) % INSPIRATIONS.length]] : result;
  ui.modal = { kind: "inspiration-result" };
  track("inspiration_generated", { source, pairwise: shouldPair });
  render({ preserveScroll: true });
}

function saveDraft() {
  const d = ui.draft;
  if (!isDraftValid(d)) return;
  const now = new Date().toISOString();
  const record = { ...d, id: d.id || createId(), dirty: undefined, createdAt: d.createdAt || now, updatedAt: now };
  if (d.id) state.records = state.records.map(item => item.id === d.id ? record : item);
  else state.records.push(record);
  if (d.importedInspiration && state.pendingInspiration?.id === d.importedInspiration.id) state.pendingInspiration = null;
  track("record_saved", { edited: Boolean(d.id), hasInspiration: Boolean(d.importedInspiration), hasBasicText: Boolean(d.basicText.trim()), tagCount: allTags(d).length, optionalCount: Object.values(d.optional).filter(Boolean).length });
  ui.draft = null;
  ui.selectedRecordId = record.id;
  ui.view = "detail";
  persist();
  render();
  showToast(d.id ? "修改已保存，足迹与检索已重算。" : "训练记录已保存。");
}

function setDraftField(path, value) {
  if (path.startsWith("optional.")) ui.draft.optional[path.split(".")[1]] = value;
  else {
    ui.draft[path] = value;
    if (path === "basicText" && ui.draft.importedInspiration) ui.draft.importedInspiration.content = value;
  }
  ui.draft.dirty = true;
}

function updateValidation() {
  const valid = isDraftValid(ui.draft);
  const button = document.querySelector("#save-record");
  const notice = document.querySelector("#record-validation");
  if (button) button.disabled = !valid;
  notice?.classList.toggle("hidden", valid);
}

function demoRecords() {
  const base = [
    ["2026-08-05", "Hip-hop", ["musicality", "持续音"], "只跟持续音走，先不理最明显的鼓点。", "身体更松，但重心移动还是容易抢拍。"],
    ["2026-08-09", "Hip-hop", ["groove", "停顿", "重心"], "用停顿切开 groove，再从脚底把重心送出去。", "慢一点时连接更清楚。"],
    ["2026-08-13", "Popping", ["身体连接", "速度变化"], "肩到胸的连接在速度加快时会断。", "先保持呼吸，再改变速度。"],
    ["2026-08-17", "Hip-hop", ["基础律动", "空间", "重心"], "同一个律动只改变方向和空间，不增加动作。", "开始注意到转向之前的重心准备。"],
    ["2026-08-19", "Popping", ["texture", "身体连接", "停顿"], "在停顿后再启动，观察 texture 会不会更清楚。", "肩胸连接比上一次自然。"],
    ["2026-08-21", "House", ["groove", "呼吸", "速度变化"], "脚保持稳定节奏，上半身只回应音乐里的空白。", "快的时候也想保留呼吸。"],
  ];
  return base.map(([date, mainDance, tags, basicText, feeling]) => ({ id: createId(), date, mainDance, tags, basicText, optional: { feeling, worked: "", improve: "", next: "" }, importedInspiration: null, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }));
}

app.addEventListener("click", (event) => {
  const target = event.target.closest("[data-action], [data-view]");
  if (!target) return;
  const action = target.dataset.action;
  const view = target.dataset.view;
  if (view) { ui.view = view; ui.modal = null; if (view !== "record") ui.draft = null; render(); return; }
  if (action === "start-demo" || action === "start-guest" || action === "demo-login") {
    state.session = { type: action === "demo-login" ? "demo" : "guest", startedAt: new Date().toISOString() };
    if (action === "start-demo" && !state.records.length) state.records = demoRecords();
    ui.view = "today"; track("auth_completed", { mode: state.session.type }); render();
  } else if (action === "open-feedback") { ui.modal = { kind: "feedback" }; render();
  } else if (action === "open-account") { ui.modal = { kind: "account" }; render();
  } else if (action === "open-inspiration") { ui.view = "inspiration"; ui.inspirationResult = null; render();
  } else if (action === "generate") { generateInspiration(target.dataset.source); }
  else if (action === "select-pair") { ui.inspirationResult = ui.inspirationResult[Number(target.dataset.index)]; track("pairwise_experiment_selected", { type: "inspiration", choice: Number(target.dataset.index) ? "B" : "A" }); render({ preserveScroll: true }); }
  else if (action === "dismiss-pair") { track("pairwise_experiment_selected", { type: "inspiration", choice: target.textContent.trim() }); ui.inspirationResult = null; ui.modal = null; render({ preserveScroll: true }); }
  else if (action === "edit-inspiration") { const text = document.querySelector("#result-text"); text.contentEditable = "true"; text.focus(); target.textContent = "正在微调"; showToast("可以直接编辑这段灵感，采用时会保存修改后的版本。"); }
  else if (action === "adopt-inspiration") {
    const content = document.querySelector("#result-text")?.textContent.trim() || ui.inspirationResult;
    state.pendingInspiration = { id: createId(), content, source: ui.inspirationSource, adoptedAt: new Date().toISOString(), status: "pending" };
    track("inspiration_adopted", { source: ui.inspirationSource }); ui.inspirationResult = null; ui.modal = null; persist(); render(); showToast("已暂存，会自动带入下一条训练记录。");
  } else if (action === "new-record") { ui.draft = makeDraft(); ui.view = "record"; ui.modal = null; track("record_create_opened", { source: topLabel(), hasPendingInspiration: Boolean(state.pendingInspiration) }); render();
  } else if (action === "choose-dance") { ui.draft.mainDance = ui.draft.mainDance === target.dataset.value ? "" : target.dataset.value; ui.draft.dirty = true; render();
  } else if (action === "toggle-tag") { const tag = target.dataset.value; ui.draft.tags = ui.draft.tags.includes(tag) ? ui.draft.tags.filter(item => item !== tag) : [...ui.draft.tags, tag]; ui.draft.dirty = true; render();
  } else if (action === "custom-dance") { ui.modal = { kind: "prompt", title: "自定义主要舞种", description: "主要舞种是记录级单选分组；它不会被系统解释为客观识别。", placeholder: "输入舞种名称", callback: "dance" }; render();
  } else if (action === "custom-tag") { ui.modal = { kind: "prompt", title: "添加补充标签", description: "用于记录当次关注的舞步、身体连接、音乐处理或其他线索。", placeholder: "输入标签", callback: "tag" }; render();
  } else if (action === "prompt-confirm") { const value = document.querySelector("#prompt-value").value.trim(); if (!value) return; if (ui.modal.callback === "dance") ui.draft.mainDance = value; else if (!ui.draft.tags.includes(value)) ui.draft.tags.push(value); ui.draft.dirty = true; ui.modal = null; render();
  } else if (action === "remove-import") { const importedId = ui.draft.importedInspiration?.id; ui.draft.importedInspiration = null; if (ui.draft.basicText === state.pendingInspiration?.content) ui.draft.basicText = ""; if (state.pendingInspiration?.id === importedId) state.pendingInspiration = null; ui.draft.dirty = true; persist(); render();
  } else if (action === "voice") { ui.modal = { kind: "voice", field: target.dataset.field, text: "今天一直在试肩和胸的连接。速度一快就断了，但慢一点时感觉更清楚。" }; render();
  } else if (action === "voice-confirm") { setDraftField(ui.modal.field, document.querySelector("#voice-result").value.trim()); ui.modal = null; render();
  } else if (action === "save-record") { saveDraft(); }
  else if (action === "close-record") { if (ui.draft?.dirty || Object.values(ui.draft?.optional || {}).some(Boolean) || isDraftValid(ui.draft)) { ui.modal = { kind: "discard" }; render(); } else { ui.draft = null; ui.view = "today"; render(); } }
  else if (action === "confirm-discard") { track("record_discarded", { hasBasicText: Boolean(ui.draft.basicText), tagCount: allTags(ui.draft).length, hasInspiration: Boolean(ui.draft.importedInspiration) }); ui.draft = null; ui.modal = null; ui.view = "today"; render(); }
  else if (action === "open-record") { ui.selectedRecordId = target.dataset.id; ui.view = "detail"; track("record_opened", { id: target.dataset.id }); render(); }
  else if (action === "edit-record") { const record = state.records.find(item => item.id === ui.selectedRecordId); ui.draft = makeDraft(record); ui.view = "record"; render(); }
  else if (action === "delete-record") { ui.modal = { kind: "delete" }; render(); }
  else if (action === "confirm-delete") { state.records = state.records.filter(item => item.id !== ui.selectedRecordId); track("record_deleted", { id: ui.selectedRecordId }); ui.selectedRecordId = null; ui.modal = null; ui.view = "history"; persist(); render(); showToast("记录已永久删除，相关足迹与信号已重算。"); }
  else if (action === "history-search") { ui.history.query = document.querySelector("#history-query").value; track("history_search", { query: ui.history.query }); render(); }
  else if (action === "toggle-calendar") { ui.history.calendarOpen = !ui.history.calendarOpen; render(); }
  else if (action === "calendar-prev" || action === "calendar-next") { const [year, month] = ui.history.calendarMonth.split("-").map(Number); const next = new Date(year, month - 1 + (action === "calendar-next" ? 1 : -1), 1); ui.history.calendarMonth = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}`; render(); }
  else if (action === "select-date") { ui.history.before = target.dataset.date; ui.history.calendarOpen = false; track("history_search", { type: "before_date", before: ui.history.before }); render(); }
  else if (action === "apply-filters") { ui.history.dance = document.querySelector("#history-dance").value; ui.history.tag = document.querySelector("#history-tag").value; track("history_search", { ...ui.history }); render(); }
  else if (action === "clear-filters") { ui.history = { query: "", before: "", dance: "", tag: "", calendarOpen: false, calendarMonth: todayISO().slice(0, 7) }; render(); }
  else if (action === "footprint-inspiration") { ui.view = "inspiration"; ui.inspirationResult = null; generateInspiration("footprint"); track("footprint_inspiration_clicked"); }
  else if (action === "choose-footprint") { state.footprintChoice = target.dataset.choice; track("pairwise_experiment_selected", { type: "footprint", choice: target.dataset.choice }); render(); }
  else if (action === "submit-feedback") { const text = document.querySelector("#feedback-text").value.trim(); if (!text) { showToast("请先写下反馈内容。"); return; } const entry = { id: createId(), type: document.querySelector("#feedback-type").value, text, contact: document.querySelector("#feedback-contact").value.trim(), at: new Date().toISOString() }; state.feedback.push(entry); track("feedback_submitted", { type: entry.type, hasContact: Boolean(entry.contact), mode: state.session.type }); ui.modal = null; render(); showToast("反馈已保存到本地 MVP。接入运营接口后可直接提交。"); }
  else if (action === "export-data") { const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" }); const url = URL.createObjectURL(blob); const link = Object.assign(document.createElement("a"), { href: url, download: `freestyle-training-${todayISO()}.json` }); link.click(); URL.revokeObjectURL(url); showToast("本地数据已导出。"); }
  else if (action === "load-demo") { const existing = new Set(state.records.map(r => `${r.date}|${r.basicText}`)); state.records.push(...demoRecords().filter(r => !existing.has(`${r.date}|${r.basicText}`))); track("demo_data_loaded", { count: state.records.length }); ui.modal = null; persist(); render(); showToast("已载入演示记录，可体验历史与足迹。"); }
  else if (action === "clear-data") { ui.modal = { kind: "clear" }; render(); }
  else if (action === "confirm-clear") { const session = state.session; const visitorId = state.visitorId; const experimentBucket = state.experimentBucket; state = { ...initialState(), session, visitorId, experimentBucket }; persist(); ui.modal = null; ui.view = "today"; render(); showToast("训练数据已清空。"); }
  else if (action === "logout") { state.session = null; persist(); ui.modal = null; ui.view = "landing"; render(); }
  else if (action === "close-inspiration-result") { ui.inspirationResult = null; ui.modal = null; render({ preserveScroll: true }); }
  else if (action === "modal-close") { ui.modal = null; render({ preserveScroll: ui.view === "inspiration" }); }
});

app.addEventListener("input", (event) => {
  const field = event.target.dataset.field;
  if (!field || !ui.draft) return;
  setDraftField(field, event.target.value);
  updateValidation();
});

window.addEventListener("beforeunload", (event) => {
  if (ui.view === "record" && ui.draft?.dirty) { event.preventDefault(); event.returnValue = ""; }
});

try {
  render();
  const startupError = document.querySelector("#startup-error");
  if (startupError) startupError.hidden = true;
} catch (error) {
  console.error(error);
  globalThis.__showFreestyleStartupError?.(error?.stack || error?.message || String(error));
}

