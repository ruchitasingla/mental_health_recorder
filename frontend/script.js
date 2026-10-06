(() => {
  "use strict";
  // Docker/nginx: "/api" is proxied to the backend. For local dev without Docker,
  // set window.API_BASE = "http://localhost:8000" before this script loads.
  const API_BASE = window.API_BASE ?? "/api";
  const $ = (id) => document.getElementById(id);
  const form = $("form");

  // ---- theme ----
  const root = document.documentElement;
  const setTheme = (t) => { root.dataset.theme = t; $("theme").textContent = t === "dark" ? "☀️" : "🌙"; try { localStorage.setItem("theme", t); } catch {} };
  let saved; try { saved = localStorage.getItem("theme"); } catch {}
  setTheme(saved || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"));
  $("theme").onclick = () => setTheme(root.dataset.theme === "dark" ? "light" : "dark");

  // ---- sliders + 24h bar ----
  const ranges = [...form.querySelectorAll("input[type=range]")];
  function updateDay() {
    const v = (id) => parseFloat($(id).value);
    const parts = { sleep: v("sleep_hours_per_night"), study: v("study_hours"), move: v("physical_activity_hours"), screen: v("avg_daily_usage_hours") };
    const total = Object.values(parts).reduce((a, b) => a + b, 0);
    const scale = total > 24 ? 24 / total : 1; // keep the bar inside 100%
    for (const k in parts) $("seg-" + k).style.width = (parts[k] * scale / 24 * 100) + "%";
    const note = $("day-note");
    note.className = total > 24 ? "warn" : "";
    note.textContent = total > 24 ? "Adds up to " + total.toFixed(1) + " h, some of these overlap" : (24 - total).toFixed(1) + " h left for everything else";
  }
  function updateRange(r) {
    const p = ((r.value - r.min) / (r.max - r.min)) * 100;
    r.style.setProperty("--p", p + "%");
    r.parentElement.querySelector("output").textContent = r.value + (r.dataset.unit || "");
  }
  ranges.forEach((r) => { updateRange(r); r.addEventListener("input", () => { updateRange(r); updateDay(); }); });
  updateDay();

  // ---- choice groups ----
  document.querySelectorAll(".choice").forEach((g) => g.addEventListener("click", (e) => {
    const b = e.target.closest("button"); if (!b) return;
    g.querySelectorAll("button").forEach((x) => x.classList.toggle("on", x === b));
    $(g.dataset.name).value = b.dataset.value;
    clearErr($(g.dataset.name)); progress();
  }));

  // ---- progress ----
  const required = ["age", "country", "gender", "academic_level", "most_used_platform", "purpose_of_use", "stress_level"];
  function progress() { $("bar").style.width = (required.filter((id) => String($(id).value).trim()).length / required.length * 100) + "%"; }
  ["age", "country"].forEach((id) => $(id).addEventListener("input", () => { clearErr($(id)); progress(); }));

  // ---- errors ----
  const field = (el) => el.closest(".field");
  function setErr(el, msg) { const f = field(el); if (!f) return; f.classList.add("bad"); f.querySelector(".err").textContent = msg; }
  function clearErr(el) { const f = field(el); if (f) f.classList.remove("bad"); }

  // ---- states ----
  const states = ["idle", "load", "res", "err"];
  const show = (n) => states.forEach((s) => ($("s-" + s).hidden = s !== n));

  function payload() {
    const n = (id) => parseFloat($(id).value);
    return {
      age: parseInt($("age").value, 10), gender: $("gender").value, country: $("country").value.trim(),
      academic_level: $("academic_level").value, most_used_platform: $("most_used_platform").value,
      purpose_of_use: $("purpose_of_use").value, avg_daily_usage_hours: n("avg_daily_usage_hours"),
      daily_unlocks: parseInt($("daily_unlocks").value, 10), study_hours: n("study_hours"),
      physical_activity_hours: n("physical_activity_hours"), sleep_hours_per_night: n("sleep_hours_per_night"),
      stress_level: $("stress_level").value,
    };
  }
  function validate(p) {
    const bad = [];
    if (!(p.age >= 10 && p.age <= 100)) bad.push([$("age"), "Enter an age between 10 and 100."]);
    if (!p.country) bad.push([$("country"), "Enter your country."]);
    [["gender", "Pick one."], ["academic_level", "Pick your level."], ["most_used_platform", "Pick your most-used app."], ["purpose_of_use", "Pick a purpose."], ["stress_level", "Pick how stressed you feel."]]
      .forEach(([id, m]) => { if (!p[id]) bad.push([$(id), m]); });
    return bad;
  }

  // ---- result ----
  const ARC = 283;
  function bandFor(s) {
    if (s < 4) return ["Running low", "Your habits point to strain right now. Small changes to sleep or screen time can help."];
    if (s < 7) return ["Holding steady", "Your routine looks fairly balanced, with room to recover."];
    return ["Doing well", "Your habits point to a strong, resilient baseline. Keep it up."];
  }
  function tipsFor(p) {
    const t = [];
    if (p.sleep_hours_per_night < 7) t.push("😴 You sleep " + p.sleep_hours_per_night + " h. Aim for 7 to 9 h.");
    if (p.avg_daily_usage_hours > 6) t.push("📱 " + p.avg_daily_usage_hours + " h on screens is a lot. Try one screen-free hour.");
    if (p.physical_activity_hours < 0.5) t.push("🚶 A 20-minute walk can lift your mood.");
    if (p.daily_unlocks > 150) t.push("🔓 " + p.daily_unlocks + " unlocks a day. Muting a few notifications can cut that.");
    if (["High", "Very High"].includes(p.stress_level)) t.push("💬 High stress is worth sharing with someone you trust.");
    if (!t.length) t.push("✅ Your routine looks balanced. Keep your current habits.");
    return t.slice(0, 3);
  }
  function render(score, p) {
    const s = Math.max(0, Math.min(10, score)), [band, ctx] = bandFor(s);
    $("band").textContent = band; $("ctx").textContent = ctx;
    $("tips").innerHTML = ""; tipsFor(p).forEach((x, i) => { const li = document.createElement("li"); li.textContent = x; li.style.animationDelay = i * 120 + "ms"; $("tips").appendChild(li); });
    const fill = $("fill"); fill.style.transition = "none"; fill.style.strokeDashoffset = ARC;
    show("res");
    requestAnimationFrame(() => requestAnimationFrame(() => {
      fill.style.transition = ""; fill.style.strokeDashoffset = ARC * (1 - s / 10);
      const t0 = performance.now();
      (function tick(now) { const k = Math.min(1, (now - t0) / 1100); $("num").textContent = (s * (1 - Math.pow(1 - k, 3))).toFixed(1); if (k < 1) requestAnimationFrame(tick); else $("num").textContent = score.toFixed(2); })(t0);
    }));
  }
  function fail(title, copy) { $("err-title").textContent = title; $("err-copy").textContent = copy; show("err"); }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const p = payload(), bad = validate(p);
    form.querySelectorAll(".bad").forEach((f) => f.classList.remove("bad"));
    if (bad.length) { bad.forEach(([el, m]) => setErr(el, m)); field(bad[0][0]).scrollIntoView({ behavior: "smooth", block: "center" }); return; }
    $("go").disabled = true; $("go").classList.add("busy"); show("load");
    if (innerWidth <= 900) $("s-load").scrollIntoView({ behavior: "smooth", block: "center" });
    try {
      const res = await fetch(API_BASE + "/predict", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(p) });
      if (res.status === 422) {
        const body = await res.json().catch(() => null);
        (body?.detail || []).forEach((d) => { const el = $(d.loc?.[d.loc.length - 1]); if (el) setErr(el, d.msg); });
        return fail("Check your answers", "The server rejected some fields. They're marked on the form.");
      }
      if (!res.ok) return fail("Something went wrong", "The server returned status " + res.status + ". Try again in a moment.");
      const data = await res.json();
      if (typeof data.predicted_mental_health_score !== "number") return fail("Unexpected reply", "The server answered without a score.");
      render(data.predicted_mental_health_score, p);
    } catch {
      fail("Can't reach the server", "Check your connection. If you're running locally, make sure the backend is up.");
    } finally { $("go").disabled = false; $("go").classList.remove("busy"); }
  });
  $("again").onclick = $("retry").onclick = () => { show("idle"); form.scrollIntoView({ behavior: "smooth" }); };
})();
