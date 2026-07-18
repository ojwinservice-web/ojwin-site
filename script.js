/* ==========================================================================
   ۱) تنظیمات — همه‌چیزهایی که معمولاً لازمه ویرایش کنی، اینجاست
   ========================================================================== */

// آدرس واسطه (Cloudflare Worker) برای ارسال امن سفارش به تلگرام.
// توکن ربات اینجا نیست و اصلاً داخل کد سایت قرار نمی‌گیرد.
// راهنمای کامل ساخت این واسطه رایگان، داخل فایل README.md است.
const NOTIFY_CONFIG = {
  workerUrl: "https://YOUR-WORKER-NAME.YOUR-SUBDOMAIN.workers.dev/"
};

// شماره تماس اصلی سایت (برای دکمه‌های تماس و پیام نهایی)
const CONTACT_PHONE_DISPLAY = "۰۹۹۶-۷۹۳۱۱۵۹";
const CONTACT_PHONE_TEL = "+989967931159";

// قیمت‌های پایه به تومان — این‌ها فقط نمونه هستند، حتماً با قیمت واقعی خودت جایگزین کن.
const PRICING_CONFIG = {
  basePerM2: {
    window: 3200000,
    door: 4800000
  },
  colorMultiplier: {
    "سفید": 1.0, "مشکی": 1.08, "طرح چوب": 1.15, "قهوه‌ای سوخته": 1.15, "متال": 1.15
  },
  brandMultiplier: {
    "مناسب‌ترین قیمت": 1.0, "وین‌تک": 1.25, "هافمن": 1.2, "ویستابست": 1.18
  },
  openingMultiplier: { "ثابت": 0.85, "لولایی": 1.0, "کشویی": 1.15 },
  panelMultiplier: { "تک‌لنگه": 1.0, "دولنگه": 1.15, "سه‌لنگه": 1.3, "چهارلنگه": 1.45 },
  glassMultiplier: { "دوجداره ساده": 1.0, "دوجداره رفلکس": 1.1, "سه‌جداره ساده": 1.25, "سه‌جداره رفلکس": 1.35, "سکوریت ساده": 1.2 },
  katibehMultiplier: { "ندارد": 1.0, "کتیبه گرد": 1.12, "کتیبه بالا": 1.08, "کتیبه پایین": 1.08 },
  doorGlassMultiplier: { "تمام شیشه": 1.1, "نصف شیشه": 1.05, "بدون شیشه": 1.0 },
  decorativeFlowerFee: 450000,
  installationFee: { "فریم آماده نصب است": 0, "تعویض پنجره قدیمی": 800000, "فریم در حال آماده‌شدن است": 300000 }
};

/* ==========================================================================
   ۲) تعریف مراحل ماشین‌حساب (فقط UPVC)
   ========================================================================== */
const state = {
  length: "", width: "",
  product: "", color: "", brand: "",
  opening: "", panels: "", glass: "", finish: "", flower: "", install: "",
  name: "", phone: ""
};

const STEPS = [
  { key: "dims", title: "ابعاد سفارشت رو وارد کن", hint: "طول و عرض رو به سانتی‌متر بنویس.",
    render: dimsRender, valid: () => Number(state.length) > 0 && Number(state.width) > 0 },

  { key: "product", title: "می‌خوای پنجره بسازی یا درب؟", hint: "",
    options: () => ["پنجره","درب"], field: "product" },

  { key: "color", title: "رنگ پروفیل رو انتخاب کن", hint: "",
    options: () => ["سفید","مشکی","طرح چوب","قهوه‌ای سوخته","متال"],
    field: "color", swatch: true },

  { key: "brand", title: "برند پروفیل رو انتخاب کن", hint: "",
    options: () => ["مناسب‌ترین قیمت","وین‌تک","هافمن","ویستابست"], field: "brand" },

  { key: "opening", title: "نوع بازشو رو انتخاب کن", hint: "",
    options: () => state.product === "درب" ? ["لولایی","کشویی"] : ["لولایی","کشویی","ثابت"],
    field: "opening" },

  { key: "panels", title: "تعداد لنگه‌ها چند تاست؟", hint: "",
    options: () => ["تک‌لنگه","دولنگه","سه‌لنگه","چهارلنگه"], field: "panels",
    skip: () => state.opening === "ثابت" },

  { key: "glass", title: "نوع شیشه رو انتخاب کن", hint: "",
    options: () => ["دوجداره ساده","دوجداره رفلکس","سه‌جداره ساده","سه‌جداره رفلکس","سکوریت ساده"],
    field: "glass" },

  { key: "finish", title: () => state.product === "درب" ? "درب شما شیشه دارد؟" : "پنجره‌ات کتیبه داره؟",
    hint: "",
    options: () => state.product === "درب" ? ["تمام شیشه","نصف شیشه","بدون شیشه"] : ["ندارد","کتیبه گرد","کتیبه بالا","کتیبه پایین"],
    field: "finish" },

  { key: "flower", title: "به گل دکوراتیو نیاز داری؟", hint: "",
    options: () => ["خیر","بله"], field: "flower" },

  { key: "install", title: "وضعیت محل نصب چطوره؟", hint: "",
    options: () => ["فریم آماده نصب است","تعویض پنجره قدیمی","فریم در حال آماده‌شدن است"], field: "install" },

  { key: "contact", title: "برای دیدن قیمت، اطلاعاتت رو وارد کن", hint: "قیمت دقیق سفارشت رو فقط بعد از این مرحله می‌بینی.",
    render: contactRender, valid: () => state.name.trim().length > 1 && state.phone.trim().length >= 10 }
];

let activeSteps = [];
let currentIndex = 0;
let submitted = false;

function computeActiveSteps(){
  activeSteps = STEPS.filter(s => !(s.skip && s.skip()));
}

/* ==========================================================================
   ۳) رندر کردن مراحل
   ========================================================================== */
let calcBody, btnPrev, btnNext, stepCounterText;
let peaklineFg, peaklineBg, peaklineFlag, peaklineStepNum, peaklineTotal;

function dimsRender(){
  return `
    <div class="step-title">${resolveTitle(STEPS[0])}</div>
    <div class="step-hint">${STEPS[0].hint}</div>
    <div class="dim-inputs">
      <div class="dim-field">
        <label for="input-length">طول (سانتی‌متر)</label>
        <input type="number" min="1" id="input-length" value="${state.length}" placeholder="مثلاً ۱۲۰" inputmode="numeric" />
      </div>
      <div class="dim-field">
        <label for="input-width">عرض (سانتی‌متر)</label>
        <input type="number" min="1" id="input-width" value="${state.width}" placeholder="مثلاً ۱۰۰" inputmode="numeric" />
      </div>
    </div>
  `;
}

function contactRender(){
  const step = STEPS[STEPS.length - 1];
  return `
    <div class="step-title">${resolveTitle(step)}</div>
    <div class="step-hint">${step.hint}</div>
    <form class="contact-form" id="contact-form">
      <input type="text" id="input-name" placeholder="نام و نام خانوادگی" value="${state.name}" required />
      <input type="tel" id="input-phone" placeholder="شماره موبایل (مثال: 0912xxxxxxx)" value="${state.phone}" required />
    </form>
    <p class="contact-note">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>
      اطلاعات شما فقط برای تماس و ارسال پیش‌فاکتور استفاده می‌شود.
    </p>
  `;
}

function optionStepRender(step){
  const opts = step.options();
  const isColorStep = !!step.swatch;
  return `
    <div class="step-title">${resolveTitle(step)}</div>
    ${step.hint ? `<div class="step-hint">${step.hint}</div>` : `<div style="height:12px"></div>`}
    <div class="opt-grid">
      ${opts.map(o => `
        <button type="button" class="opt-card ${state[step.field] === o ? 'selected' : ''}" data-field="${step.field}" data-value="${o}">
          ${isColorStep ? `<span class="opt-swatch" style="background:${colorSwatch(o)}"></span>` : ""}
          ${o}
        </button>
      `).join("")}
    </div>
  `;
}

function colorSwatch(name){
  const map = { "سفید":"#fff", "مشکی":"#222", "طرح چوب":"#8a5a35", "قهوه‌ای سوخته":"#5a3a22", "متال":"#9aa3ab" };
  return map[name] || "#ccc";
}

function resolveTitle(step){
  return typeof step.title === "function" ? step.title() : step.title;
}

function renderStep(){
  computeActiveSteps();
  if(currentIndex >= activeSteps.length) currentIndex = activeSteps.length - 1;
  const step = activeSteps[currentIndex];

  if(submitted){
    calcBody.innerHTML = renderResult();
    bindResultEvents();
  } else if(step.render){
    calcBody.innerHTML = step.render();
    if(step.key === "dims") bindDimsEvents();
    if(step.key === "contact") bindContactEvents();
  } else {
    calcBody.innerHTML = optionStepRender(step);
    bindOptionEvents(step);
  }

  updateNav();
  updatePeakline();
}

function bindDimsEvents(){
  document.getElementById("input-length").addEventListener("input", e => { state.length = e.target.value; updateNav(); });
  document.getElementById("input-width").addEventListener("input", e => { state.width = e.target.value; updateNav(); });
}

function bindContactEvents(){
  document.getElementById("input-name").addEventListener("input", e => { state.name = e.target.value; updateNav(); });
  document.getElementById("input-phone").addEventListener("input", e => { state.phone = e.target.value; updateNav(); });
}

function bindOptionEvents(step){
  calcBody.querySelectorAll(".opt-card").forEach(btn => {
    btn.addEventListener("click", () => {
      state[step.field] = btn.dataset.value;
      renderStep();
      setTimeout(() => goNext(), 180);
    });
  });
}

/* ==========================================================================
   ۴) ناوبری بین مراحل
   ========================================================================== */
function currentStepValid(){
  const step = activeSteps[currentIndex];
  if(step.valid) return step.valid();
  if(step.field) return !!state[step.field];
  return true;
}

function updateNav(){
  const step = activeSteps[currentIndex];
  btnPrev.style.visibility = currentIndex === 0 ? "hidden" : "visible";
  const isLast = currentIndex === activeSteps.length - 1;
  btnNext.textContent = submitted ? "شروع دوباره" : (isLast ? "دریافت قیمت" : "مرحله بعد");
  btnNext.disabled = submitted ? false : !currentStepValid();
  stepCounterText.textContent = submitted ? "" : `مرحله ${toFa(currentIndex+1)} از ${toFa(activeSteps.length)}`;
  btnNext.style.display = (!submitted && step.render === undefined) ? "none" : "inline-flex";
}

function goNext(){
  if(!currentStepValid()) return;
  computeActiveSteps();
  if(currentIndex < activeSteps.length - 1){
    currentIndex++;
    renderStep();
  } else {
    handleSubmit();
  }
}

function resetAll(){
  Object.keys(state).forEach(k => state[k] = "");
  currentIndex = 0; submitted = false;
  renderStep();
}

/* ==========================================================================
   ۵) خط اوج (Peak Line) — نشانگر پیشرفت
   ========================================================================== */
function buildPeakPath(n){
  const w = 600, h = 70, padY = 10;
  let d = `M 0 ${h - padY}`;
  for(let i = 1; i <= n; i++){
    const x = (w / n) * i;
    const progress = i / n;
    const jitter = (i % 2 === 0) ? 10 : -6;
    const y = (h - padY) - progress * (h - padY - 6) + jitter * (1 - progress * 0.6);
    d += ` L ${x.toFixed(1)} ${Math.max(4, y).toFixed(1)}`;
  }
  return d;
}

function updatePeakline(){
  const n = activeSteps.length;
  const path = buildPeakPath(n);
  peaklineBg.setAttribute("d", path);
  peaklineFg.setAttribute("d", path);

  const total = peaklineFg.getTotalLength();
  const doneFraction = submitted ? 1 : currentIndex / Math.max(1, n - 1);
  peaklineFg.style.strokeDasharray = total;
  peaklineFg.style.strokeDashoffset = total * (1 - doneFraction);

  const point = peaklineFg.getPointAtLength(total);
  peaklineFlag.setAttribute("transform", `translate(${point.x}, ${point.y})`);
  peaklineFlag.classList.toggle("show", doneFraction >= 0.999);

  peaklineStepNum.textContent = submitted ? toFa(n) : toFa(currentIndex + 1);
  peaklineTotal.textContent = toFa(n);
}

function toFa(num){ return Number(num).toLocaleString("fa-IR"); }

/* ==========================================================================
   ۶) محاسبه قیمت
   ========================================================================== */
function calculatePrice(){
  const P = PRICING_CONFIG;
  const areaM2 = (Number(state.length) / 100) * (Number(state.width) / 100);
  const base = state.product === "درب" ? P.basePerM2.door : P.basePerM2.window;

  let price = base * Math.max(areaM2, 0.5);

  price *= P.colorMultiplier[state.color] || 1;
  price *= P.brandMultiplier[state.brand] || 1;
  price *= P.openingMultiplier[state.opening] || 1;
  if(state.panels){ price *= P.panelMultiplier[state.panels] || 1; }
  price *= P.glassMultiplier[state.glass] || 1;

  if(state.product === "درب"){
    price *= P.doorGlassMultiplier[state.finish] || 1;
  } else {
    price *= P.katibehMultiplier[state.finish] || 1;
  }

  if(state.flower === "بله"){ price += P.decorativeFlowerFee; }
  price += P.installationFee[state.install] || 0;

  return Math.round(price / 10000) * 10000;
}

/* ==========================================================================
   ۷) ارسال نتیجه به تلگرام (از طریق واسطه امن)
   ========================================================================== */
async function sendOrderNotification(price){
  if(NOTIFY_CONFIG.workerUrl.includes("YOUR-WORKER-NAME")){
    return { ok:false, reason:"not_configured" };
  }
  const payload = {
    name: state.name,
    phone: state.phone,
    product: state.product,
    dims: `${state.length} × ${state.width} سانتی‌متر`,
    colorBrand: `${state.color} / ${state.brand}`,
    opening: `${state.opening}${state.panels ? " — " + state.panels : ""}`,
    glass: state.glass,
    finishDetail: `${state.finish}${state.flower === "بله" ? " + گل دکوراتیو" : ""}`,
    install: state.install,
    price: toFa(price)
  };
  try{
    const res = await fetch(NOTIFY_CONFIG.workerUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    return { ok: !!data.ok };
  } catch(err){
    return { ok:false, reason:"network" };
  }
}

/* ==========================================================================
   ۸) نتیجه نهایی
   ========================================================================== */
let lastPrice = 0;

function handleSubmit(){
  lastPrice = calculatePrice();
  submitted = true;
  renderStep();
  sendOrderNotification(lastPrice).then(result => {
    const el = document.getElementById("send-status");
    if(!el) return;
    if(result.ok){
      el.textContent = "✓ سفارش شما ثبت شد؛ به‌زودی با شما تماس می‌گیریم.";
      el.className = "send-status ok";
    } else if(result.reason === "not_configured"){
      el.textContent = "توجه به مدیر سایت: آدرس واسطه تلگرام هنوز تنظیم نشده (به README مراجعه کن).";
      el.className = "send-status err";
    } else {
      el.textContent = "سفارش ثبت شد، اما ارسال نوتیفیکیشن با خطا مواجه شد.";
      el.className = "send-status err";
    }
  });
}

function renderResult(){
  return `
    <div class="result-panel">
      <div class="step-hint" style="margin-bottom:0;">قیمت برآوردی سفارش شما</div>
      <div class="result-price">${toFa(lastPrice)} <small>تومان</small></div>
      <div class="result-summary">
        <div>محصول: <b>${state.product}</b></div>
        <div>ابعاد: <b>${toFa(state.length)} × ${toFa(state.width)} سانتی‌متر</b></div>
        <div>رنگ / برند: <b>${state.color} / ${state.brand}</b></div>
        <div>بازشو: <b>${state.opening}${state.panels ? " — " + state.panels : ""}</b></div>
        <div>شیشه: <b>${state.glass}</b></div>
        <div>وضعیت نصب: <b>${state.install}</b></div>
      </div>
      <div class="result-actions">
        <a class="btn btn-primary" href="tel:${CONTACT_PHONE_TEL}">تماس برای نهایی‌کردن سفارش</a>
        <button class="btn btn-ghost" id="btn-restart" type="button">محاسبه یک سفارش دیگر</button>
      </div>
      <div class="send-status" id="send-status">در حال ارسال سفارش…</div>
    </div>
  `;
}

function bindResultEvents(){
  const btn = document.getElementById("btn-restart");
  if(btn) btn.addEventListener("click", resetAll);
}

/* ==========================================================================
   ۹) شروع — با محافظ خطا، تا هیچ‌وقت صفحه کاملاً خالی نمونه
   ========================================================================== */
function initCalculator(){
  calcBody = document.getElementById("calc-body");
  btnPrev = document.getElementById("btn-prev");
  btnNext = document.getElementById("btn-next");
  stepCounterText = document.getElementById("step-counter-text");
  peaklineFg = document.getElementById("peakline-fg");
  peaklineBg = document.getElementById("peakline-bg");
  peaklineFlag = document.getElementById("peakline-flag");
  peaklineStepNum = document.getElementById("peakline-step-num");
  peaklineTotal = document.getElementById("peakline-total");

  if(!calcBody || !btnPrev || !btnNext){
    console.error("عناصر اصلی ماشین‌حساب پیدا نشدند؛ ساختار HTML را بررسی کنید.");
    return;
  }

  btnPrev.addEventListener("click", () => {
    if(submitted){ resetAll(); return; }
    if(currentIndex > 0){ currentIndex--; renderStep(); }
  });

  btnNext.addEventListener("click", () => {
    if(submitted){ resetAll(); return; }
    if(currentIndex === activeSteps.length - 1){
      handleSubmit();
    } else {
      goNext();
    }
  });

  // شماره تماس رو توی همه لینک‌های "تماس نهایی" ست کن (اگر جایی جا افتاده باشه)
  document.querySelectorAll('a[data-role="phone-link"]').forEach(a => {
    a.setAttribute("href", `tel:${CONTACT_PHONE_TEL}`);
  });

  computeActiveSteps();
  renderStep();
}

// اگر به هر دلیلی (مثلاً کپی ناقص کد) چیزی خطا بدهد، به‌جای یک صفحه خالی
// یک پیام واضح نشان می‌دهیم تا مشکل قابل تشخیص باشد.
try{
  document.addEventListener("DOMContentLoaded", () => {
    try{
      initCalculator();
    } catch(err){
      const body = document.getElementById("calc-body");
      if(body){
        body.innerHTML = `<div class="calc-error">مشکلی در بارگذاری ماشین‌حساب پیش آمد. لطفاً مطمئن شوید فایل script.js به‌طور کامل و بدون تغییر آپلود شده است.<br><small>${(err && err.message) || ""}</small></div>`;
      }
      console.error(err);
    }
  });
} catch(err){
  console.error(err);
  }
