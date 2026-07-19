/**
 * واسطه امن بین سایت اوج وین و تلگرام.
 *
 * این کد روی Cloudflare Workers (رایگان) اجرا می‌شود، نه داخل مرورگر کاربر —
 * برای همین توکن ربات تلگرام هیچ‌وقت در کد سایت یا سمت کاربر دیده نمی‌شود.
 *
 * راه‌اندازی کامل: فایل README.md، بخش «وصل‌کردن نوتیفیکیشن تلگرام».
 *
 * این Worker به دو مقدار محرمانه نیاز دارد که باید در پنل Cloudflare
 * (Settings → Variables and Secrets) تعریف شوند، نه اینکه داخل همین فایل نوشته شوند:
 *   BOT_TOKEN  → توکنی که BotFather داد
 *   CHAT_ID    → آیدی چتی که پیام‌ها باید بهش برسه
 */

// بعد از اینکه سایتت روی گیت‌هاب پیجز بالا اومد، این مقدار رو با آدرس واقعی
// سایتت جایگزین کن تا فقط خود سایتت بتونه از این واسطه استفاده کنه.
// مثال: "https://username.github.io"
const ALLOWED_ORIGIN = "*";

export default {
  async fetch(request, env) {
    const cors = corsHeaders();

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: cors });
    }

    if (request.method !== "POST") {
      return json({ ok: false, error: "method_not_allowed" }, 405, cors);
    }

    if (!env.BOT_TOKEN || !env.CHAT_ID) {
      return json({ ok: false, error: "worker_not_configured" }, 500, cors);
    }

    let order;
    try {
      order = await request.json();
    } catch (e) {
      return json({ ok: false, error: "invalid_json" }, 400, cors);
    }

    const f = (key, max = 120) => escapeHtml(String(order?.[key] ?? "").slice(0, max));

    if (!order?.name || !order?.phone) {
      return json({ ok: false, error: "missing_contact_fields" }, 400, cors);
    }

    const text = [
      "🪟 <b>سفارش جدید از سایت اوج وین</b>",
      `نام: ${f("name", 60)}`,
      `شماره تماس: ${f("phone", 20)}`,
      `محصول: ${f("product")}`,
      `ابعاد: ${f("dims")}`,
      `رنگ / برند: ${f("colorBrand")}`,
      `بازشو: ${f("opening")}`,
      `شیشه: ${f("glass")}`,
      `جزئیات: ${f("finishDetail")}`,
      `وضعیت نصب: ${f("install")}`,
      `💰 قیمت برآوردی: ${f("price", 20)} تومان`
    ].join("\n");

    try {
      const tgRes = await fetch(`https://api.telegram.org/bot${env.BOT_TOKEN}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: env.CHAT_ID, text, parse_mode: "HTML" })
      });
      const tgData = await tgRes.json();
      return json({ ok: !!tgData.ok }, 200, cors);
    } catch (err) {
      return json({ ok: false, error: "telegram_unreachable" }, 502, cors);
    }
  }
};

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json; charset=utf-8"
  };
}

function json(obj, status, cors) {
  return new Response(JSON.stringify(obj), { status, headers: cors });
}

function escapeHtml(s) {
  return s.replace(/[&<>]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
}
