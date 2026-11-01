(function () {
  "use strict";
  const root = document.getElementById("omega-lab");
  if (!root) return;
  const O = globalThis.OmegaCipher;
  const M = globalThis.OmegaMotion;
  const $ = (id) => root.querySelector(`#${id}`);
  const canvas = $("omega-canvas");
  const ctx = canvas.getContext("2d");
  const DURATION = 26000;
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  const theme = matchMedia("(prefers-color-scheme: dark)");
  let lastEncryption = O.encrypt($("omega-message").value);
  let trace = lastEncryption;
  let scene = M.createScene(trace);
  let mode = "encrypt";
  let progress = 0;
  let playing = false;
  let dirty = false;
  let startTime = 0;
  let animation;
  let captionKey = "";
  let readoutKey = "";
  let palette = {};
  let width = 0;
  let height = 0;
  let lastUi = 0;
  const saved = { encrypt: { text: trace.text }, decrypt: {
    text: trace.output, keyPack: trace.material.keyPack, privateKey: trace.material.privateKey,
  } };

  function colours() {
    const probe = document.createElement("i");
    probe.style.cssText = "position:absolute;visibility:hidden;pointer-events:none";
    root.append(probe);
    for (const key of ["ink", "green", "gold", "soft", "line", "paper"]) {
      probe.style.color = `var(--film-${key})`;
      palette[key] = getComputedStyle(probe).color;
    }
    probe.remove();
  }

  function resize() {
    const rect = canvas.getBoundingClientRect();
    width = Math.max(1, rect.width);
    height = Math.max(1, rect.height);
    const dpr = Math.min(2, devicePixelRatio || 1);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    draw();
  }

  function remember() {
    try {
      window.openai?.setWidgetState?.({
        modelContent: { visualization: "OmegaCode motion", mode, finished: progress === 1 },
        privateContent: { mode, progress },
      })?.catch(() => {});
    } catch { /* Standalone mode needs no host. */ }
  }

  function animateCaption(title, detail, key) {
    if (key === captionKey) return;
    captionKey = key;
    $("omega-caption-title").textContent = title;
    $("omega-caption-detail").textContent = detail;
    if (!reduced.matches) {
      for (const [i, id] of ["omega-caption-title", "omega-caption-detail"].entries()) {
        $(id).getAnimations().forEach((a) => a.cancel());
        $(id).animate([
          { opacity: .15, transform: "translateY(6px)" },
          { opacity: 1, transform: "translateY(0)" },
        ], { duration: 650, delay: i * 60, easing: "cubic-bezier(.2,.7,.2,1)" });
      }
    }
  }

  function updateNarration(frame) {
    const t = progress;
    if (mode === "encrypt") {
      if (t < .055) animateCaption("一行文字，等待出发。", "每一个字符，都保留着自己的身份。", "enc-intro");
      else if (t < .335) animateCaption("分流，再交织。", "奇偶位置反复洗牌，随机种子在另一端展开成网。", "enc-weave");
      else if (t < .87) animateCaption("穿过矩阵，悄然变形。", "每一次相遇，都对应原算法里的一次真实查值。", "enc-matrix");
      else animateCaption("秘密，抵达另一端。", "文字的长度没有改变。沿原路返回，就能再次看见它。", "enc-end");
    } else {
      if (t < .17) animateCaption("找回这张网。", "Key pack 除以 Private key，恢复同一组索引和矩阵。", "dec-intro");
      else if (t < .655) animateCaption("先还原每一个字符。", "用同一矩阵逆向替换，保留字符原本的身份。", "dec-matrix");
      else if (t < .925) animateCaption("把交织的轨迹，慢慢解开。", "前后两段重新交错，位置一轮轮回到原处。", "dec-weave");
      else animateCaption("原来，是这一句话。", "字符与位置都已经归来。", "dec-end");
    }
    let readout = "";
    const shuffleActive = mode === "encrypt" ? t >= .055 && t < .335 : t >= .655 && t < .925;
    if (shuffleActive) {
      const fraction = M.segment(t, mode === "encrypt" ? .075 : .655, mode === "encrypt" ? .32 : .925);
      const rounds = fraction < 2 / 3 ? Math.floor(fraction * 3)
        : Math.round(2 + (trace.material.shuffleTimes - 2) * M.smooth((fraction - 2 / 3) * 3));
      readout = `${rounds.toLocaleString("en-US")} / ${trace.material.shuffleTimes.toLocaleString("en-US")} 轮 · 展开前 2 轮，再连续快进到最终排列`;
    } else if (frame.active) {
      const e = frame.active;
      readout = e.input > e.key
        ? `${e.input} > ${e.key}  ·  原样通过  ·  M[${e.row}, ${e.column}]`
        : `${e.key} − ${e.input} + 32 = ${e.output}  ·  M[${e.row}, ${e.column}]`;
    } else if (t < .17) {
      readout = mode === "encrypt" ? "64 个字符种子  ×  64 个旋转索引" : "KEY PACK ÷ PRIVATE KEY → INDEXES";
    } else if (t >= .925) {
      readout = scene.count < scene.n ? `动画抽样 ${scene.count} / ${scene.n} 条轨迹；完整文本均已运算。`
        : `${scene.n} 个字符位，${scene.n} 条完整轨迹。`;
    }
    if (readout !== readoutKey) {
      readoutKey = readout;
      $("omega-readout").textContent = readout;
    }
  }

  function updateUi(frame) {
    const seconds = Math.floor(progress * DURATION / 1000);
    $("omega-time").textContent = `00:${String(seconds).padStart(2, "0")} / 00:26`;
    $("omega-timeline").value = String(Math.round(progress * 1000));
    root.dataset.progress = progress.toFixed(4);
    root.dataset.playing = String(playing);
    const ready = progress >= .96 && !dirty;
    $("omega-result").dataset.ready = String(ready);
    $("omega-output").textContent = ready
      ? (trace.output ? (mode === "encrypt" && /[\ud800-\udfff]/.test(trace.output)
        ? JSON.stringify(trace.output).slice(1, -1) : trace.output) : "（空文本）")
      : "···";
    $("omega-transfer").disabled = $("omega-copy").disabled = !ready;
    $("omega-transfer").hidden = $("omega-copy").hidden = mode !== "encrypt";
    const known = mode === "decrypt" && trace.text === lastEncryption.output &&
      trace.material.privateKey === lastEncryption.material.privateKey &&
      trace.material.keyPack === lastEncryption.material.keyPack;
    $("omega-match").textContent = ready
      ? (known && trace.output === lastEncryption.text ? "与原文完全一致"
        : mode === "decrypt" ? "已完成反向运算 · 原版不含完整性校验" : `${scene.n} → ${scene.n} 个字符位`)
      : "等待轨迹抵达";
    updateNarration(frame);
  }

  function draw(now = performance.now()) {
    if (!width || !height) return;
    const frame = M.frameAt(scene, width, height, progress);
    M.draw(ctx, frame, palette);
    if (!playing || now - lastUi > 90 || progress === 1) {
      lastUi = now;
      updateUi(frame);
    }
  }

  function tick(now) {
    if (!playing) return;
    progress = Math.min(1, Math.max(0, (now - startTime) / DURATION));
    draw(now);
    if (progress >= 1) {
      playing = false;
      $("omega-play").textContent = "重播";
      $("omega-live").lastChild.textContent = "COMPLETE";
      updateUi(M.frameAt(scene, width, height, progress));
      remember();
      return;
    }
    animation = requestAnimationFrame(tick);
  }

  function pause(save = true) {
    if (playing) progress = Math.min(1, (performance.now() - startTime) / DURATION);
    playing = false;
    cancelAnimationFrame(animation);
    $("omega-play").textContent = progress >= 1 ? "重播" : "播放";
    $("omega-live").lastChild.textContent = progress >= 1 ? "COMPLETE" : "PAUSED";
    draw();
    if (save) remember();
  }

  function play() {
    if (dirty) return;
    if (progress >= 1) progress = 0;
    if (reduced.matches) {
      progress = 1;
      draw();
      $("omega-live").lastChild.textContent = "REDUCED MOTION";
      remember();
      return;
    }
    playing = true;
    startTime = performance.now() - progress * DURATION;
    $("omega-play").textContent = "暂停";
    $("omega-live").lastChild.textContent = "IN MOTION";
    cancelAnimationFrame(animation);
    animation = requestAnimationFrame(tick);
  }

  function syncForm() {
    const data = saved[mode];
    $("omega-message").value = data.text;
    $("omega-keypack").value = data.keyPack || "";
    $("omega-private").value = data.privateKey || "";
    $("omega-decode-fields").hidden = mode !== "decrypt";
    $("omega-input-label").textContent = mode === "encrypt" ? "YOUR WORDS" : "CIPHERTEXT";
    $("omega-message").setAttribute("aria-label", mode === "encrypt" ? "输入明文" : "输入密文或解密包");
    $("omega-encrypt").setAttribute("aria-pressed", String(mode === "encrypt"));
    $("omega-decrypt").setAttribute("aria-pressed", String(mode === "decrypt"));
    $("omega-direction").textContent = mode === "encrypt" ? "PLAINTEXT → CIPHERTEXT" : "PLAINTEXT ← CIPHERTEXT";
    $("omega-result-label").textContent = mode === "encrypt" ? "THE OTHER SIDE · 密文" : "BACK TO THE BEGINNING · 明文";
  }

  function validate(text) {
    if (text.length > 256) throw new Error("演示最多支持 256 个 UTF-16 字符位。");
    if (/[\u0000-\u001f\u007f]/.test(text)) throw new Error("原版不能可靠还原换行和 Tab，请使用单行文字。");
  }

  function saveForm() {
    saved[mode] = { text: $("omega-message").value,
      keyPack: $("omega-keypack").value, privateKey: $("omega-private").value };
  }

  function start({ reuse = false, autoplay = true, persist = true } = {}) {
    pause(false);
    saveForm();
    try {
      let next;
      if (mode === "encrypt") {
        validate(saved.encrypt.text);
        next = O.encrypt(saved.encrypt.text, reuse && lastEncryption.text === saved.encrypt.text
          ? lastEncryption.material : O.generateMaterial());
        lastEncryption = next;
      } else {
        let text = saved.decrypt.text;
        let material;
        if (text.trimStart().startsWith("{") && text.includes('"format"')) {
          const bundle = O.unpackBundle(text);
          text = bundle.text;
          material = bundle.material;
          saved.decrypt = { text, keyPack: material.keyPack, privateKey: material.privateKey };
          syncForm();
        } else material = O.parseKeys(saved.decrypt.keyPack, saved.decrypt.privateKey);
        validate(text);
        next = O.decrypt(text, material);
      }
      trace = next;
      scene = M.createScene(trace);
      progress = 0;
      dirty = false;
      captionKey = readoutKey = "";
      $("omega-error").hidden = true;
      $("omega-decode-fields").open = false;
      $("omega-copy-fallback-label").hidden = true;
      $("omega-copy").textContent = "复制解密包";
      $("omega-play").disabled = $("omega-replay").disabled = $("omega-timeline").disabled = false;
      $("omega-result-pack").textContent = trace.material.keyPack;
      $("omega-result-private").textContent = trace.material.privateKey;
      $("omega-count").textContent = `${scene.n} CHARACTERS`;
      $("omega-input-hint").textContent = scene.n > scene.count
        ? `完整计算 ${scene.n} 个字符位；画面抽样 ${scene.count} 条轨迹。`
        : (trace.input.some((v) => v > 126) ? "非 ASCII 字符只换位；◇ 表示 emoji 的一个 UTF-16 单元。"
          : "写下一行文字，看它流向另一种形态。");
      canvas.setAttribute("aria-label", `${mode === "encrypt" ? "加密" : "解密"} ${scene.n} 个字符位的连续轨迹动画；可以通过下方时间轴查看任意时刻。`);
      draw();
      if (autoplay) play();
      if (persist) remember();
    } catch (error) {
      dirty = true;
      $("omega-error").hidden = false;
      $("omega-error").textContent = error.message;
      $("omega-play").disabled = $("omega-replay").disabled = $("omega-timeline").disabled = true;
      $("omega-transfer").disabled = $("omega-copy").disabled = true;
      if (mode === "decrypt") $("omega-decode-fields").open = true;
    }
  }

  function switchMode(next, transfer = false) {
    pause(false);
    saveForm();
    if (transfer) saved.decrypt = { text: lastEncryption.output,
      keyPack: lastEncryption.material.keyPack, privateKey: lastEncryption.material.privateKey };
    mode = next;
    syncForm();
    start({ reuse: true });
  }

  $("omega-form").addEventListener("submit", (event) => { event.preventDefault(); start(); });
  $("omega-form").addEventListener("input", () => {
    pause(false);
    dirty = true;
    $("omega-input-hint").textContent = "输入已更新。点击「开始演绎」让新的文字出发。";
    $("omega-error").hidden = true;
    $("omega-play").disabled = $("omega-replay").disabled = $("omega-timeline").disabled = true;
    draw();
  });
  $("omega-encrypt").addEventListener("click", () => { if (mode !== "encrypt") switchMode("encrypt"); });
  $("omega-decrypt").addEventListener("click", () => { if (mode !== "decrypt") switchMode("decrypt", true); });
  $("omega-transfer").addEventListener("click", () => switchMode("decrypt", true));
  $("omega-play").addEventListener("click", () => { if (playing) pause(); else play(); });
  $("omega-replay").addEventListener("click", () => { pause(false); progress = 0; play(); });
  $("omega-timeline").addEventListener("input", () => {
    const nextProgress = Number($("omega-timeline").value) / 1000;
    pause(false);
    progress = nextProgress;
    draw();
    remember();
  });
  $("omega-copy").addEventListener("click", async () => {
    const bundle = O.packBundle(lastEncryption);
    try {
      await navigator.clipboard.writeText(bundle);
      $("omega-copy").textContent = "已复制解密包";
      $("omega-announcement").textContent = "已复制密文和两份秘密密钥。";
    } catch {
      $("omega-copy-fallback-label").hidden = false;
      $("omega-copy-fallback").value = bundle;
      $("omega-copy-fallback").focus();
      $("omega-copy-fallback").select();
    }
  });
  function restore(state) {
    const data = state?.privateContent;
    if (!data || !["encrypt", "decrypt"].includes(data.mode)) return false;
    mode = data.mode;
    syncForm();
    start({ reuse: true, autoplay: false, persist: false });
    progress = typeof data.progress === "number" && Number.isFinite(data.progress)
      ? Math.max(0, Math.min(1, data.progress)) : 0;
    draw();
    return true;
  }
  window.addEventListener("openai:set_globals", (event) => restore(event.detail?.globals?.widgetState));
  document.addEventListener("visibilitychange", () => { if (document.hidden) pause(false); });
  window.addEventListener("pagehide", () => pause(false));
  reduced.addEventListener("change", () => { if (reduced.matches) pause(false); });
  theme.addEventListener("change", () => { colours(); draw(); });
  const themeObserver = new MutationObserver(() => { colours(); draw(); });
  themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["class", "style"] });
  const observer = new ResizeObserver(resize);
  observer.observe(canvas);
  colours();
  syncForm();
  resize();
  if (!restore(window.openai?.widgetState)) start({ reuse: true, autoplay: !reduced.matches, persist: false });
})();
