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
  let lastEncryption = O.encrypt($("omega-message").value, O.generateMaterial(Math.random, O.DEMO_WIDTH));
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
  let matrixLayer = null;
  let mappingRecords = [];
  let selectedCode = null;
  let showAllMappings = false;
  let activeCard = null;
  const saved = { encrypt: { text: trace.text }, decrypt: {
    text: trace.output, keyPack: trace.material.keyPack, privateKey: trace.material.privateKey,
  } };

  function colours() {
    const probe = document.createElement("i");
    probe.style.cssText = "position:absolute;visibility:hidden;pointer-events:none";
    root.append(probe);
    for (const key of ["ink", "cyan", "orange", "soft", "line", "paper"]) {
      probe.style.color = `var(--film-${key})`;
      palette[key] = getComputedStyle(probe).color;
    }
    probe.remove();
    rebuildMatrix();
  }

  function rebuildMatrix() {
    if (!width || !height || !palette.cyan) return;
    const size = M.frameAt(scene, width, height, 0).layout.matrixSize;
    const dpr = Math.min(2, devicePixelRatio || 1);
    matrixLayer = document.createElement("canvas");
    matrixLayer.width = matrixLayer.height = Math.ceil(size * dpr);
    const layerContext = matrixLayer.getContext("2d");
    layerContext.setTransform(dpr, 0, 0, dpr, 0, 0);
    M.paintMatrix(layerContext, trace.material, size, palette);
  }

  function resize() {
    const rect = canvas.getBoundingClientRect();
    width = Math.max(1, rect.width);
    height = Math.max(1, rect.height);
    const dpr = Math.min(2, devicePixelRatio || 1);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    rebuildMatrix();
    draw();
  }

  function remember() {
    try {
      window.openai?.setWidgetState?.({
        modelContent: { visualization: "OmegaCode 128", mode, finished: progress === 1 },
        privateContent: { version: 2, mode, progress },
      })?.catch(() => {});
    } catch { /* Standalone mode needs no host. */ }
  }

  function element(tag, className, text) {
    const result = document.createElement(tag);
    if (className) result.className = className;
    if (text !== undefined) result.textContent = text;
    return result;
  }

  function prepareMappings() {
    mappingRecords = O.mappings(trace);
    const counts = new Map();
    for (const record of mappingRecords) counts.set(record.input, (counts.get(record.input) || 0) + 1);
    const choices = [...counts].sort((a, b) => b[1] - a[1]);
    selectedCode = choices[0]?.[0] ?? null;
    const select = $("omega-track");
    select.replaceChildren();
    const all = element("option", "", "All characters");
    all.value = "";
    select.append(all);
    for (const [code, count] of choices) {
      const label = code === 32 ? "Space" : O.unitLabel(code);
      const option = element("option", "", `${label} — ${count} ${count === 1 ? "occurrence" : "occurrences"}`);
      option.value = String(code);
      select.append(option);
    }
    select.value = selectedCode === null ? "" : String(selectedCode);
    scene.focusCode = selectedCode;
    showAllMappings = false;
    renderMappings();
  }

  function renderMappings() {
    const group = selectedCode === null ? mappingRecords : mappingRecords.filter((r) => r.input === selectedCode);
    const distinct = new Set(group.map((r) => r.output)).size;
    const label = selectedCode === 32 ? "space" : O.unitLabel(selectedCode);
    $("omega-mapping-title").textContent = selectedCode === null ? "Position mappings" : `Mappings for ${JSON.stringify(label)}`;
    $("omega-mapping-summary").textContent = `${group.length} ${group.length === 1 ? "occurrence" : "occurrences"} · ${distinct} distinct output ${distinct === 1 ? "value" : "values"}`;
    $("omega-mapping-explanation").textContent = !group.length
      ? "Enter repeated characters to compare their matrix lookups."
      : group.length === 1
        ? "Repeat this character in your input to compare how different positions map."
        : distinct > 1
          ? "The same input character uses different matrix lookups at different positions. Output values can still repeat."
          : "These occurrences currently share an output value. Different positions can map differently, but distinct outputs are not guaranteed.";
    const grid = $("omega-mapping-grid");
    grid.hidden = false;
    grid.replaceChildren();
    activeCard = null;
    const visible = showAllMappings ? group : group.slice(0, 8);
    for (const record of visible) {
      const card = element("article", "mapping-card");
      card.dataset.inputPosition = String(record.inputPosition);
      card.append(element("div", "mapping-meta", `Input #${record.inputPosition} → output #${record.outputPosition}`));
      const equation = element("div", "mapping-equation");
      equation.append(element("span", "mapping-in", O.unitLabel(record.input)),
        element("span", "", "→"), element("span", "mapping-out", O.unitLabel(record.output)));
      card.append(equation,
        element("div", "mapping-meta", `M[${record.row}, ${record.column}] = ${record.key}`),
        element("div", "mapping-arithmetic", record.unchanged
          ? `${record.input} > ${record.key} · unchanged`
          : `${record.key} − ${record.input} + 32 = ${record.output}`));
      grid.append(card);
    }
    $("omega-show-mappings").hidden = group.length <= 8;
    $("omega-show-mappings").textContent = showAllMappings ? "Show first 8" : `Show all ${group.length} mappings`;
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
      if (t < .055) animateCaption("Input characters", "Each occurrence keeps its original input ID.", "enc-intro");
      else if (t < .335) animateCaption("Shuffling positions", "The same letters move to different positions before substitution.", "enc-weave");
      else if (t < .87) animateCaption("Mapping by position", "Each position selects its own matrix value. Cyan is input; orange is output.", "enc-matrix");
      else animateCaption("Encryption complete", "Compare repeated characters below, or decrypt this result.", "enc-end");
    } else {
      if (t < .17) animateCaption("Rebuilding the matrix", "Divide the key pack by the private key to recover the indexes.", "dec-intro");
      else if (t < .655) animateCaption("Reversing substitution", "Use the same lookup for each ciphertext position.", "dec-matrix");
      else if (t < .925) animateCaption("Reversing the shuffle", "Restore the characters to their original positions.", "dec-weave");
      else animateCaption("Decryption complete", "The character values and positions have been restored.", "dec-end");
    }
    let readout = "";
    const shuffleActive = mode === "encrypt" ? t >= .055 && t < .335 : t >= .655 && t < .925;
    if (shuffleActive) {
      const fraction = M.segment(t, mode === "encrypt" ? .075 : .655, mode === "encrypt" ? .32 : .925);
      const rounds = fraction < 2 / 3 ? Math.floor(fraction * 3)
        : Math.round(2 + (trace.material.shuffleTimes - 2) * M.smooth((fraction - 2 / 3) * 3));
      readout = `Round ${rounds.toLocaleString("en-US")} / ${trace.material.shuffleTimes.toLocaleString("en-US")} · first 2 rounds, then exact fast-forward`;
    } else if (frame.active) {
      const e = frame.active;
      readout = e.input > e.key
        ? `${e.input} > ${e.key}  ·  unchanged  ·  M[${e.row}, ${e.column}]`
        : `${e.key} − ${e.input} + 32 = ${e.output}  ·  M[${e.row}, ${e.column}]`;
    } else if (t < .17) {
      readout = mode === "encrypt"
        ? `${trace.material.width} seeds · ${trace.material.width} indexes · ${(trace.material.width ** 2).toLocaleString("en-US")} matrix values`
        : "Key pack ÷ private key → indexes";
    } else if (t >= .925) {
      readout = scene.count < scene.n ? `${scene.count} of ${scene.n} paths shown. The full text is computed.`
        : `${scene.n} character positions · ${scene.n} complete paths`;
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
        ? JSON.stringify(trace.output).slice(1, -1) : trace.output) : "(empty text)")
      : "···";
    $("omega-transfer").disabled = $("omega-copy").disabled = !ready;
    $("omega-transfer").hidden = $("omega-copy").hidden = mode !== "encrypt";
    const known = mode === "decrypt" && trace.text === lastEncryption.output &&
      trace.material.privateKey === lastEncryption.material.privateKey &&
      trace.material.keyPack === lastEncryption.material.keyPack;
    $("omega-match").textContent = ready
      ? (known && trace.output === lastEncryption.text ? "Matches the original text"
        : mode === "decrypt" ? "Computed; this cipher has no integrity check" : `${scene.n} → ${scene.n} character positions`)
      : "Animation in progress";
    root.dataset.matrixSize = String(trace.material.width);
    const nextCard = frame.active
      ? $("omega-mapping-grid").querySelector(`[data-input-position="${frame.active.id}"]`) : null;
    if (nextCard !== activeCard) {
      if (activeCard) activeCard.dataset.active = "false";
      if (nextCard) nextCard.dataset.active = "true";
      activeCard = nextCard;
    }
    updateNarration(frame);
  }

  function draw(now = performance.now()) {
    if (!width || !height) return;
    const frame = M.frameAt(scene, width, height, progress);
    M.draw(ctx, frame, palette, matrixLayer);
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
      $("omega-play").textContent = "Replay";
      $("omega-live").lastChild.textContent = "Complete";
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
    $("omega-play").textContent = progress >= 1 ? "Replay" : "Play";
    $("omega-live").lastChild.textContent = progress >= 1 ? "Complete" : "Paused";
    draw();
    if (save) remember();
  }

  function play() {
    if (dirty) return;
    if (progress >= 1) progress = 0;
    if (reduced.matches) {
      progress = 1;
      draw();
      $("omega-live").lastChild.textContent = "Reduced motion";
      remember();
      return;
    }
    playing = true;
    startTime = performance.now() - progress * DURATION;
    $("omega-play").textContent = "Pause";
    $("omega-live").lastChild.textContent = "Playing";
    cancelAnimationFrame(animation);
    animation = requestAnimationFrame(tick);
  }

  function syncForm() {
    const data = saved[mode];
    $("omega-message").value = data.text;
    $("omega-keypack").value = data.keyPack || "";
    $("omega-private").value = data.privateKey || "";
    $("omega-decode-fields").hidden = mode !== "decrypt";
    $("omega-input-label").textContent = mode === "encrypt" ? "Your text" : "Ciphertext or decryption bundle";
    $("omega-message").setAttribute("aria-label", mode === "encrypt" ? "Your text" : "Ciphertext or decryption bundle");
    $("omega-start").textContent = mode === "encrypt" ? "Encrypt text" : "Decrypt text";
    $("omega-encrypt").setAttribute("aria-pressed", String(mode === "encrypt"));
    $("omega-decrypt").setAttribute("aria-pressed", String(mode === "decrypt"));
    $("omega-direction").textContent = mode === "encrypt" ? "Plaintext → Ciphertext" : "Plaintext ← Ciphertext";
    $("omega-result-label").textContent = mode === "encrypt" ? "Ciphertext" : "Plaintext";
  }

  function validate(text) {
    if (text.length > 256) throw new Error("Use at most 256 UTF-16 character positions.");
    if (/[\u0000-\u001f\u007f]/.test(text)) throw new Error("Use a single line without tabs or control characters; this cipher cannot reliably restore them.");
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
          ? lastEncryption.material : O.generateMaterial(Math.random, O.DEMO_WIDTH));
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
      prepareMappings();
      progress = 0;
      dirty = false;
      captionKey = readoutKey = "";
      $("omega-error").hidden = true;
      $("omega-decode-fields").open = false;
      $("omega-copy-fallback-label").hidden = true;
      $("omega-copy").textContent = "Copy decryption bundle";
      $("omega-play").disabled = $("omega-replay").disabled = $("omega-timeline").disabled = false;
      $("omega-track").disabled = $("omega-show-mappings").disabled = false;
      $("omega-result-pack").textContent = trace.material.keyPack;
      $("omega-result-private").textContent = trace.material.privateKey;
      $("omega-count").textContent = `${scene.n} character positions`;
      const matrixWidth = trace.material.width;
      $("omega-matrix-size").textContent = `${matrixWidth} × ${matrixWidth} matrix${matrixWidth === 64 ? " · legacy" : ""}`;
      $("omega-version-note").textContent = matrixWidth === 64
        ? "Original 64 × 64 format imported. New encryption uses 128 × 128."
        : "128 × 128 extension. Original Java code preserved.";
      $("omega-input-hint").textContent = scene.n > scene.count
        ? `All ${scene.n} positions are computed; ${scene.count} paths are shown.`
        : (trace.input.some((v) => v > 126) ? "Non-ASCII values only change position. ◇ marks one UTF-16 surrogate unit."
          : "Repeat a character to compare its mappings. Each encryption uses new keys.");
      canvas.setAttribute("aria-label", `${matrixWidth} by ${matrixWidth} ${mode === "encrypt" ? "encryption" : "decryption"} animation of ${scene.n} character positions. IDs identify each input occurrence.`);
      rebuildMatrix();
      draw();
      if (autoplay) play();
      if (persist) remember();
    } catch (error) {
      dirty = true;
      $("omega-error").hidden = false;
      $("omega-error").textContent = error.message;
      $("omega-play").disabled = $("omega-replay").disabled = $("omega-timeline").disabled = true;
      $("omega-track").disabled = $("omega-show-mappings").disabled = true;
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
    $("omega-input-hint").textContent = `Input changed. Press ${mode === "encrypt" ? "Encrypt text" : "Decrypt text"} to update the animation.`;
    $("omega-mapping-grid").hidden = true;
    $("omega-mapping-explanation").textContent = "Apply your updated input to see its mappings.";
    $("omega-error").hidden = true;
    $("omega-play").disabled = $("omega-replay").disabled = $("omega-timeline").disabled = true;
    $("omega-track").disabled = $("omega-show-mappings").disabled = true;
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
      $("omega-copy").textContent = "Bundle copied";
      $("omega-announcement").textContent = "Copied the ciphertext and both secret keys.";
    } catch {
      $("omega-copy-fallback-label").hidden = false;
      $("omega-copy-fallback").value = bundle;
      $("omega-copy-fallback").focus();
      $("omega-copy-fallback").select();
    }
  });
  function restore(state) {
    const data = state?.privateContent;
    if (!data || data.version !== 2 || !["encrypt", "decrypt"].includes(data.mode)) return false;
    mode = data.mode;
    syncForm();
    start({ reuse: true, autoplay: false, persist: false });
    progress = typeof data.progress === "number" && Number.isFinite(data.progress)
      ? Math.max(0, Math.min(1, data.progress)) : 0;
    draw();
    return true;
  }
  $("omega-track").addEventListener("change", () => {
    selectedCode = $("omega-track").value === "" ? null : Number($("omega-track").value);
    scene.focusCode = selectedCode;
    showAllMappings = false;
    renderMappings();
    draw();
  });
  $("omega-show-mappings").addEventListener("click", () => {
    showAllMappings = !showAllMappings;
    renderMappings();
  });
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
