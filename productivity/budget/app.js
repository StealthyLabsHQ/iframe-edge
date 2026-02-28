(() => {
  "use strict";

  // ── Constants ────────────────────────────────────────────────────────────────
  const THEME_KEY = "pa_theme";
  const LANG_KEY  = "pa_lang";
  const TXNS_KEY  = "pa_budgetTxns";
  const SUBS_KEY  = "pa_budgetSubs";
  const $ = id => document.getElementById(id);

  // ── State ────────────────────────────────────────────────────────────────────
  let theme        = localStorage.getItem(THEME_KEY) || "dark";
  let lang         = localStorage.getItem(LANG_KEY)  || "fr";
  let txns         = [];
  let subs         = [];   // Subscription[]
  let viewMonth    = "";
  let selectedType = "expense";

  // ── i18n ─────────────────────────────────────────────────────────────────────
  const i18n = {
    fr: {
      title: "Budget",
      income: "Revenu", expense: "Dépense",
      balance: "Solde", revenues: "Revenus", expenses: "Dépenses",
      descPlaceholder: "Description…",
      amountPlaceholder: "Montant",
      catFood: "Alimentation", catTransport: "Transport", catHousing: "Logement",
      catEntertainment: "Loisirs", catHealth: "Santé", catShopping: "Shopping",
      catOther: "Autre", catSalary: "Salaire", catFreelance: "Freelance",
      catOtherIncome: "Autre revenu",
      noTxn: "Aucune transaction ce mois",
      toastAdded: "✓ Transaction ajoutée",
      toastDeleted: "✓ Supprimée",
      toastError: "⚠️ Montant invalide",
      recurring: "🔄 Abonnement mensuel",
      debitDayPh: "Jour (1-31)",
      nextDebits: "Prochains prélèvements",
      perMonth: "/mois",
      toastSubAdded: "✓ Abonnement enregistré",
      toastSubDeleted: "✓ Abonnement supprimé",
      months: [
        "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
        "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre",
      ],
    },
    en: {
      title: "Budget",
      income: "Income", expense: "Expense",
      balance: "Balance", revenues: "Income", expenses: "Expenses",
      descPlaceholder: "Description…",
      amountPlaceholder: "Amount",
      catFood: "Food", catTransport: "Transport", catHousing: "Housing",
      catEntertainment: "Entertainment", catHealth: "Health", catShopping: "Shopping",
      catOther: "Other", catSalary: "Salary", catFreelance: "Freelance",
      catOtherIncome: "Other income",
      noTxn: "No transactions this month",
      toastAdded: "✓ Transaction added",
      toastDeleted: "✓ Deleted",
      toastError: "⚠️ Invalid amount",
      recurring: "🔄 Monthly subscription",
      debitDayPh: "Day (1-31)",
      nextDebits: "Upcoming debits",
      perMonth: "/mo",
      toastSubAdded: "✓ Subscription saved",
      toastSubDeleted: "✓ Subscription removed",
      months: [
        "January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December",
      ],
    },
  };

  function t(key) { return (i18n[lang] || i18n.en)[key] ?? key; }

  // ── Category data ─────────────────────────────────────────────────────────────
  const CAT_EMOJI = {
    food: "🍔", transport: "🚗", housing: "🏠", entertainment: "🎬",
    health: "💊", shopping: "🛍️", other: "📦",
    salary: "💼", freelance: "💻", otherIncome: "💰",
  };

  const CAT_KEY = {
    food: "catFood", transport: "catTransport", housing: "catHousing",
    entertainment: "catEntertainment", health: "catHealth", shopping: "catShopping",
    other: "catOther", salary: "catSalary", freelance: "catFreelance",
    otherIncome: "catOtherIncome",
  };

  const EXPENSE_CATS = ["food", "transport", "housing", "entertainment", "health", "shopping", "other"];
  const INCOME_CATS  = ["salary", "freelance", "otherIncome"];

  // ── Helpers ───────────────────────────────────────────────────────────────────
  function showToast(msg, dur = 2800) {
    const el = $("toast");
    el.textContent = msg;
    el.classList.add("visible");
    clearTimeout(el._t);
    el._t = setTimeout(() => el.classList.remove("visible"), dur);
  }

  function today()     { return new Date().toISOString().split("T")[0]; }
  function thisMonth() { return today().slice(0, 7); }

  function fmtAmount(n, type) {
    return (type === "expense" ? "-" : "+") + "€" + n.toFixed(2);
  }

  function genId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  }

  function getPrevMonth(ym) {
    const [y, m] = ym.split("-").map(Number);
    return m === 1
      ? (y - 1) + "-12"
      : y + "-" + String(m - 1).padStart(2, "0");
  }

  function getNextMonth(ym) {
    const [y, m] = ym.split("-").map(Number);
    return m === 12
      ? (y + 1) + "-01"
      : y + "-" + String(m + 1).padStart(2, "0");
  }

  // Returns { display: "DD/MM", iso: "YYYY-MM-DD" } for the next occurrence of debitDay
  function nextDebitDate(day) {
    const now      = new Date();
    const todayNum = now.getDate();
    const y        = now.getFullYear();
    const m        = now.getMonth(); // 0-indexed

    function clampDay(yr, mo, d) {
      return Math.min(d, new Date(yr, mo + 1, 0).getDate());
    }

    let date;
    const clampedThis = clampDay(y, m, day);
    if (clampedThis >= todayNum) {
      date = new Date(y, m, clampedThis);
    } else {
      const nm = (m + 1) % 12;
      const ny = m === 11 ? y + 1 : y;
      date = new Date(ny, nm, clampDay(ny, nm, day));
    }

    const dd   = String(date.getDate()).padStart(2, "0");
    const mm   = String(date.getMonth() + 1).padStart(2, "0");
    const yyyy = date.getFullYear();
    return { display: dd + "/" + mm, iso: yyyy + "-" + mm + "-" + dd };
  }

  // ── Persistence ───────────────────────────────────────────────────────────────
  function loadTxns() {
    try { txns = JSON.parse(localStorage.getItem(TXNS_KEY)) || []; }
    catch { txns = []; }
  }

  function saveTxns() { localStorage.setItem(TXNS_KEY, JSON.stringify(txns)); }

  function loadSubs() {
    try { subs = JSON.parse(localStorage.getItem(SUBS_KEY)) || []; }
    catch { subs = []; }
  }

  function saveSubs() { localStorage.setItem(SUBS_KEY, JSON.stringify(subs)); }

  // ── Render: summary ───────────────────────────────────────────────────────────
  function renderSummary() {
    const monthTxns    = txns.filter(tx => tx.month === viewMonth);
    const totalIncome  = monthTxns.filter(tx => tx.type === "income") .reduce((s, tx) => s + tx.amount, 0);
    const totalExpense = monthTxns.filter(tx => tx.type === "expense").reduce((s, tx) => s + tx.amount, 0);
    const balance = totalIncome - totalExpense;

    const balEl = $("val-balance");
    balEl.textContent = (balance >= 0 ? "+" : "") + "€" + balance.toFixed(2);
    balEl.style.color = balance >= 0 ? "#00b894" : "#d63031";

    $("val-income").textContent  = "+€" + totalIncome.toFixed(2);
    $("val-expense").textContent = "-€" + totalExpense.toFixed(2);
  }

  // ── Render: month nav ─────────────────────────────────────────────────────────
  function renderMonthNav() {
    const [y, m] = viewMonth.split("-").map(Number);
    $("monthLabel").textContent = t("months")[m - 1] + " " + y;

    $("btnNext").disabled = viewMonth >= thisMonth();
    $("btnPrev").disabled = !txns.some(tx => tx.month < viewMonth);
  }

  // ── Render: subscriptions section ────────────────────────────────────────────
  function renderSubsSection() {
    const section = $("subsSection");
    if (subs.length === 0) {
      section.style.display = "none";
      return;
    }
    section.style.display = "flex";

    $("t-next-debits").textContent = t("nextDebits");
    const total = subs.reduce((s, sub) => s + sub.amount, 0);
    $("subsTotal").textContent = "-€" + total.toFixed(2) + t("perMonth");

    const chips = $("subsChips");
    chips.replaceChildren();

    // Sort chips by next debit date ascending
    subs
      .map(sub => ({ sub, nd: nextDebitDate(sub.debitDay) }))
      .sort((a, b) => a.nd.iso.localeCompare(b.nd.iso))
      .forEach(({ sub, nd }) => {
        const chip = document.createElement("div");
        chip.className = "sub-chip";

        const emoji = document.createElement("span");
        emoji.className = "sub-chip-emoji";
        emoji.textContent = CAT_EMOJI[sub.category] || "📦";

        const info = document.createElement("div");
        info.className = "sub-chip-info";

        const descEl = document.createElement("span");
        descEl.className = "sub-chip-desc";
        descEl.textContent = sub.description || t(CAT_KEY[sub.category] || "catOther");
        descEl.title = descEl.textContent;

        const dateEl = document.createElement("span");
        dateEl.className = "sub-chip-date";
        dateEl.textContent = nd.display;

        info.appendChild(descEl);
        info.appendChild(dateEl);

        const amountEl = document.createElement("span");
        amountEl.className = "sub-chip-amount";
        amountEl.textContent = "-€" + sub.amount.toFixed(2);

        const delBtn = document.createElement("button");
        delBtn.className = "sub-chip-del";
        delBtn.setAttribute("data-del-sub", sub.id);
        delBtn.setAttribute("aria-label", "Remove subscription");
        delBtn.textContent = "×";

        chip.appendChild(emoji);
        chip.appendChild(info);
        chip.appendChild(amountEl);
        chip.appendChild(delBtn);
        chips.appendChild(chip);
      });
  }

  // ── Render: transaction list ──────────────────────────────────────────────────
  function renderTxnList() {
    const list = $("txnList");
    const monthTxns = txns
      .filter(tx => tx.month === viewMonth)
      .sort((a, b) => b.date.localeCompare(a.date));

    list.replaceChildren();

    if (monthTxns.length === 0) {
      const empty = document.createElement("div");
      empty.className = "txn-empty";
      empty.textContent = t("noTxn");
      list.appendChild(empty);
      return;
    }

    monthTxns.forEach(tx => {
      const item = document.createElement("div");
      item.className = "txn-item";

      const emoji = document.createElement("span");
      emoji.className = "txn-emoji";
      emoji.textContent = CAT_EMOJI[tx.category] || "📦";

      const info = document.createElement("div");
      info.className = "txn-info";

      const desc = document.createElement("span");
      desc.className = "txn-desc";
      desc.textContent = tx.description || t(CAT_KEY[tx.category] || "catOther");

      const cat = document.createElement("span");
      cat.className = "txn-cat";
      cat.textContent = (tx.recurring ? "🔄 " : "") + t(CAT_KEY[tx.category] || "catOther");

      info.appendChild(desc);
      info.appendChild(cat);

      const right = document.createElement("div");
      right.className = "txn-right";

      const amount = document.createElement("span");
      amount.className = "txn-amount";
      amount.textContent = fmtAmount(tx.amount, tx.type);
      amount.style.color = tx.type === "income" ? "var(--accent)" : "#e17055";

      const dateEl = document.createElement("span");
      dateEl.className = "txn-date";
      const parts = tx.date.split("-");
      dateEl.textContent = parts[2] + "/" + parts[1];

      right.appendChild(amount);
      right.appendChild(dateEl);

      const delBtn = document.createElement("button");
      delBtn.className = "txn-del";
      delBtn.setAttribute("data-delete", tx.id);
      delBtn.setAttribute("aria-label", "Delete transaction");
      delBtn.textContent = "×";

      item.appendChild(emoji);
      item.appendChild(info);
      item.appendChild(right);
      item.appendChild(delBtn);
      list.appendChild(item);
    });
  }

  // ── Render: lang UI ───────────────────────────────────────────────────────────
  function updateLangUI() {
    $("langToggle").textContent    = lang.toUpperCase();
    $("t-title").textContent       = t("title");
    $("t-balance").textContent     = t("balance");
    $("t-revenues").textContent    = t("revenues");
    $("t-expenses").textContent    = t("expenses");
    $("inputDesc").placeholder     = t("descPlaceholder");
    $("inputAmount").placeholder   = t("amountPlaceholder");
    $("t-expense-btn").textContent = t("expense");
    $("t-income-btn").textContent  = t("income");
    $("t-recurring").textContent   = t("recurring");
    $("inputDebitDay").placeholder = t("debitDayPh");
    populateCats();
  }

  function render() {
    renderSummary();
    renderMonthNav();
    renderSubsSection();
    renderTxnList();
    updateLangUI();
  }

  // ── Category select ───────────────────────────────────────────────────────────
  function populateCats() {
    const select  = $("selectCat");
    const prevVal = select.value;
    const cats    = selectedType === "expense" ? EXPENSE_CATS : INCOME_CATS;

    select.replaceChildren();
    cats.forEach(cat => {
      const opt = document.createElement("option");
      opt.value = cat;
      opt.textContent = CAT_EMOJI[cat] + " " + t(CAT_KEY[cat]);
      select.appendChild(opt);
    });

    if (cats.includes(prevVal)) select.value = prevVal;
  }

  // ── Add transaction ───────────────────────────────────────────────────────────
  function addTransaction() {
    const amount      = parseFloat($("inputAmount").value);
    const description = $("inputDesc").value.trim();
    const category    = $("selectCat").value;
    const isRecurring = $("chkRecurring").checked;
    const debitDay    = isRecurring ? parseInt($("inputDebitDay").value, 10) : null;

    if (!amount || amount <= 0) { showToast(t("toastError")); return; }

    const today_ = today();
    const txn = {
      id: genId(),
      type: selectedType,
      amount,
      description,
      category,
      date: today_,
      month: today_.slice(0, 7),
    };

    if (isRecurring) txn.recurring = true;
    txns.push(txn);
    saveTxns();

    // Save subscription template if recurring and valid day
    if (isRecurring && debitDay >= 1 && debitDay <= 31) {
      subs.push({
        id: genId(),
        description,
        category,
        amount,
        debitDay,
      });
      saveSubs();
      showToast(t("toastSubAdded"));
    } else {
      showToast(t("toastAdded"));
    }

    $("inputAmount").value   = "";
    $("inputDesc").value     = "";
    $("chkRecurring").checked = false;
    $("inputDebitDay").value  = "";
    $("inputDebitDay").style.display = "none";
    $("recurLabel").classList.remove("active");

    viewMonth = thisMonth();
    render();
  }

  // ── Delete transaction ────────────────────────────────────────────────────────
  function deleteTxn(id) {
    txns = txns.filter(tx => tx.id !== id);
    saveTxns();
    render();
    showToast(t("toastDeleted"));
  }

  // ── Delete subscription ───────────────────────────────────────────────────────
  function deleteSub(id) {
    subs = subs.filter(s => s.id !== id);
    saveSubs();
    renderSubsSection();
    showToast(t("toastSubDeleted"));
  }

  // ── Month navigation ──────────────────────────────────────────────────────────
  function prevMonth() {
    viewMonth = getPrevMonth(viewMonth);
    render();
  }

  function nextMonth() {
    if (viewMonth >= thisMonth()) return;
    viewMonth = getNextMonth(viewMonth);
    render();
  }

  // ── Type toggle ───────────────────────────────────────────────────────────────
  function setType(type) {
    selectedType = type;
    $("btnExpense").classList.toggle("active", type === "expense");
    $("btnIncome").classList.toggle("active", type === "income");

    if (type === "income") {
      $("recurRow").style.display = "none";
      $("chkRecurring").checked   = false;
      $("inputDebitDay").style.display = "none";
      $("inputDebitDay").value    = "";
      $("recurLabel").classList.remove("active");
    } else {
      $("recurRow").style.display = "flex";
    }

    populateCats();
  }

  // ── Theme ─────────────────────────────────────────────────────────────────────
  function applyTheme(th) {
    theme = th || "dark";
    document.documentElement.setAttribute("data-theme", theme);
    $("themeToggle").textContent = theme === "dark" ? "🌙" : "☀️";
  }

  // ── Cross-tab storage sync ────────────────────────────────────────────────────
  window.addEventListener("storage", e => {
    if (e.key === THEME_KEY) { applyTheme(e.newValue); }
    if (e.key === LANG_KEY)  { lang = e.newValue || "fr"; render(); }
    if (e.key === TXNS_KEY)  { loadTxns(); render(); }
    if (e.key === SUBS_KEY)  { loadSubs(); renderSubsSection(); }
  });

  // ── Event listeners ───────────────────────────────────────────────────────────
  $("themeToggle").addEventListener("click", () => {
    theme = theme === "dark" ? "light" : "dark";
    localStorage.setItem(THEME_KEY, theme);
    applyTheme(theme);
  });

  $("langToggle").addEventListener("click", () => {
    lang = lang === "fr" ? "en" : "fr";
    localStorage.setItem(LANG_KEY, lang);
    render();
  });

  $("btnAdd").addEventListener("click", addTransaction);
  $("inputAmount").addEventListener("keydown", e => { if (e.key === "Enter") addTransaction(); });
  $("inputDesc").addEventListener("keydown",   e => { if (e.key === "Enter") addTransaction(); });

  $("btnPrev").addEventListener("click", () => { if (!$("btnPrev").disabled) prevMonth(); });
  $("btnNext").addEventListener("click", () => { if (!$("btnNext").disabled) nextMonth(); });

  $("btnExpense").addEventListener("click", () => setType("expense"));
  $("btnIncome").addEventListener("click",  () => setType("income"));

  // Recurring checkbox: show/hide debit day input
  $("chkRecurring").addEventListener("change", () => {
    const checked = $("chkRecurring").checked;
    $("inputDebitDay").style.display = checked ? "block" : "none";
    $("recurLabel").classList.toggle("active", checked);
    if (!checked) $("inputDebitDay").value = "";
  });

  // Event delegation: delete transaction
  $("txnList").addEventListener("click", e => {
    const btn = e.target.closest("[data-delete]");
    if (btn) deleteTxn(btn.getAttribute("data-delete"));
  });

  // Event delegation: delete subscription
  $("subsChips").addEventListener("click", e => {
    const btn = e.target.closest("[data-del-sub]");
    if (btn) deleteSub(btn.getAttribute("data-del-sub"));
  });

  // ── Init ──────────────────────────────────────────────────────────────────────
  viewMonth = thisMonth();
  loadTxns();
  loadSubs();
  applyTheme(theme);
  setType("expense");
  render();
})();
