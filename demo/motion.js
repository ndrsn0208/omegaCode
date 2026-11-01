/* A deterministic film: every glyph keeps its identity from input to output. */
(function (root, factory) {
  const api = factory(typeof module === "object" && module.exports
    ? require("./omega.js") : root.OmegaCipher);
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.OmegaMotion = api;
})(globalThis, function (O) {
  "use strict";
  const clamp = (x) => Math.max(0, Math.min(1, x));
  const smooth = (x) => { const t = clamp(x); return t * t * t * (t * (t * 6 - 15) + 10); };
  const mix = (a, b, t) => a + (b - a) * t;
  const segment = (t, a, b) => clamp((t - a) / (b - a));
  const interpolate = (a, b, t) => ({ x: mix(a.x, b.x, t), y: mix(a.y, b.y, t) });

  function createScene(trace, limit = 32) {
    const n = trace.input.length;
    const count = Math.min(limit, n);
    const ids = Array.from({ length: count }, (_, i) => Math.floor(i * n / count));
    const inverse = trace.mode === "decrypt";
    const ranks = [0, 1, 2, trace.material.shuffleTimes].map((round) => {
      const order = O.orderAt(n, round, inverse);
      const allPositions = new Array(n);
      order.forEach((id, position) => { allPositions[id] = position; });
      const rank = new Map([...ids].sort((a, b) => allPositions[a] - allPositions[b])
        .map((id, i) => [id, i]));
      return { rank, allPositions };
    });
    const entities = ids.map((id, originalRank) => {
      const slot = inverse ? id : ranks[3].allPositions[id];
      return {
        id, originalRank, slot, finalRank: ranks[3].rank.get(id),
        input: trace.input[id], output: trace.substituted[slot],
        key: trace.material.lookup[slot % trace.material.width],
        row: trace.material.indexes[slot % trace.material.width],
        column: slot % trace.material.width,
      };
    });
    return { trace, n, count, ranks, entities, inverse, focusCode: null };
  }

  function geometry(width, height, count, inverse) {
    const vertical = width < 700;
    const matrixSize = vertical ? Math.min(280, width * .74, height * .32)
      : Math.min(440, width * .44, height - 120);
    const centre = { x: width / 2, y: height * .5 };
    const sourceY = Math.min(142, height * .175);
    const left = vertical ? { x: width / 2, y: sourceY } : { x: width * .12, y: height * .5 };
    const right = vertical ? { x: width / 2, y: height - sourceY } : { x: width * .88, y: height * .5 };
    const zoneWidth = vertical ? width * .86 : width * .21;
    const columns = Math.max(1, Math.min(Math.max(1, count), Math.floor(zoneWidth / 34)));
    const spacingX = Math.min(40, zoneWidth / columns);
    const rows = Math.max(1, Math.ceil(count / columns));
    const spacingY = Math.min(count > 24 ? 36 : 48,
      (vertical ? height * .23 : height - 160) / Math.max(1, rows - 1));
    const point = (rank, origin) => {
      const row = Math.floor(rank / columns);
      const inRow = Math.min(columns, count - row * columns);
      return {
        x: origin.x + ((rank % columns) - (inRow - 1) / 2) * spacingX,
        y: origin.y + (row - (rows - 1) / 2) * spacingY,
      };
    };
    return { width, height, vertical, matrixSize, centre, point, rows, spacingY,
      source: inverse ? right : left, destination: inverse ? left : right,
      direction: inverse ? -1 : 1 };
  }

  function bezier(a, c1, c2, b, t) {
    const q = 1 - t;
    return { x: q*q*q*a.x + 3*q*q*t*c1.x + 3*q*t*t*c2.x + t*t*t*b.x,
      y: q*q*q*a.y + 3*q*q*t*c1.y + 3*q*t*t*c2.y + t*t*t*b.y };
  }

  function passage(a, gate, b, amount, layout, id) {
    const t = smooth(amount);
    const first = t <= .5;
    const from = first ? a : gate;
    const to = first ? gate : b;
    const u = first ? t * 2 : (t - .5) * 2;
    const tangent = Math.min(48, layout.matrixSize * .3) * layout.direction;
    const bend = Math.sin(id * 2.39) * (layout.vertical ? 24 : 35);
    const c1 = layout.vertical
      ? { x: from.x + (first ? bend : 0), y: from.y + tangent }
      : { x: from.x + tangent, y: from.y + (first ? bend : 0) };
    const c2 = layout.vertical
      ? { x: to.x + (first ? 0 : -bend), y: to.y - tangent }
      : { x: to.x - tangent, y: to.y + (first ? 0 : -bend) };
    return bezier(from, c1, c2, to, u);
  }

  function weave(scene, entity, progress, layout, origin) {
    const full = clamp(progress) * 3;
    const step = Math.min(2, Math.floor(full));
    const t = smooth(full - step);
    const a = layout.point(scene.ranks[step].rank.get(entity.id), origin);
    const b = layout.point(scene.ranks[step + 1].rank.get(entity.id), origin);
    const point = interpolate(a, b, t);
    const sign = scene.ranks[step].allPositions[entity.id] % 2 ? 1 : -1;
    const arc = Math.sin(Math.PI * t) * sign * (layout.vertical ? 20 : 35);
    if (layout.vertical) point.y += arc;
    else point.y += arc;
    return point;
  }

  function frameAt(scene, width, height, progress) {
    const t = clamp(progress);
    const layout = geometry(width, height, scene.count, scene.inverse);
    const build = smooth(segment(t, scene.inverse ? .025 : .055, scene.inverse ? .20 : .32));
    const travelStart = scene.inverse ? .17 : .345;
    const travelSpread = scene.inverse ? .27 : .34;
    const travelDuration = scene.inverse ? .20 : .18;
    const entities = scene.entities.map((entity) => {
      const rank = scene.inverse ? entity.originalRank : entity.finalRank;
      const offset = scene.count <= 1 ? 0 : rank / (scene.count - 1);
      const local = segment(t, travelStart + offset * travelSpread,
        travelStart + offset * travelSpread + travelDuration);
      const cell = layout.matrixSize / scene.trace.material.width;
      const gate = {
        x: layout.centre.x - layout.matrixSize / 2 + (entity.column + .5) * cell,
        y: layout.centre.y - layout.matrixSize / 2 + (entity.row + .5) * cell,
      };
      const from = layout.point(scene.inverse ? entity.originalRank : entity.finalRank, layout.source);
      const to = layout.point(scene.inverse ? entity.originalRank : entity.finalRank, layout.destination);
      let position;
      if (!scene.inverse && t < travelStart) {
        position = weave(scene, entity, segment(t, .075, .32), layout, layout.source);
      } else if (scene.inverse && t >= .655) {
        position = weave(scene, entity, segment(t, .655, .925), layout, layout.destination);
      } else {
        position = passage(from, gate, to, local, layout, entity.id);
      }
      const changed = smooth(segment(local, .45, .56));
      const tail = [];
      if (local > 0 && local < 1) {
        for (let j = 0; j < 12; j++) {
          tail.push(passage(from, gate, to, Math.max(0, local - .16 + j * .16 / 11), layout, entity.id));
        }
      }
      return { ...entity, position, from, to, gate, local, changed, tail };
    });
    let active = null;
    for (const entity of entities) {
      if ((scene.focusCode === null || entity.input === scene.focusCode) &&
          entity.local > .27 && entity.local < .73 &&
          (!active || Math.abs(entity.local - .5) < Math.abs(active.local - .5))) active = entity;
    }
    return { scene, layout, progress: t, build, entities, active };
  }

  function paintMatrix(ctx, material, size, palette) {
    const cell = size / material.width;
    ctx.clearRect(0, 0, size, size);
    ctx.fillStyle = palette.cyan;
    for (let row = 0; row < material.width; row++) {
      for (let col = 0; col < material.width; col++) {
        ctx.globalAlpha = .12 + (material.matrix[row][col] - 32) / 94 * .36;
        ctx.fillRect(col * cell, row * cell, Math.max(.5, cell - .6), Math.max(.5, cell - .6));
      }
    }
    ctx.globalAlpha = 1;
  }

  function draw(ctx, frame, palette, matrixLayer) {
    const { layout: g, scene, progress: t, build, entities, active } = frame;
    const { ink, cyan, orange, soft, line, paper } = palette;
    ctx.clearRect(0, 0, g.width, g.height);
    const mono = 'ui-monospace, "SFMono-Regular", Menlo, monospace';
    const text = (value, x, y, colour, alpha = 1, size = 16, align = "center", font = mono) => {
      ctx.globalAlpha = alpha;
      ctx.fillStyle = colour;
      ctx.font = `400 ${size}px ${font}`;
      ctx.textAlign = align;
      ctx.textBaseline = "middle";
      ctx.fillText(value, x, y);
    };
    const dot = (x, y, radius, colour, alpha) => {
      ctx.globalAlpha = alpha;
      ctx.fillStyle = colour;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
    };
    const gridX = g.centre.x - g.matrixSize / 2;
    const gridY = g.centre.y - g.matrixSize / 2;
    const matrixWidth = scene.trace.material.width;
    const cell = g.matrixSize / matrixWidth;
    const outro = smooth(segment(t, .88, 1));

    // Quiet, continuous routes. Their brighter tails are drawn from the same curves.
    for (const entity of entities) {
      if (entity.local <= 0 || entity.local >= 1) continue;
      const focused = scene.focusCode === null || entity.input === scene.focusCode;
      ctx.globalAlpha = (focused ? .22 : .045) * Math.sin(Math.PI * entity.local);
      ctx.strokeStyle = entity.changed < .5 ? cyan : orange;
      ctx.lineWidth = focused ? 1.4 : .8;
      ctx.beginPath();
      for (let j = 0; j <= 32; j++) {
        const point = passage(entity.from, entity.gate, entity.to, j / 32, g, entity.id);
        if (j === 0) ctx.moveTo(point.x, point.y); else ctx.lineTo(point.x, point.y);
      }
      ctx.stroke();
    }

    // The actual seed count follows the ciphertext's matrix version.
    if (build > 0 && build < 1) {
      for (let i = 0; i < matrixWidth; i++) {
        const theta = i / matrixWidth * Math.PI * 2 - build * .4;
        const start = { x: g.centre.x + Math.cos(theta) * g.matrixSize * .66,
          y: g.centre.y + Math.sin(theta) * g.matrixSize * .66 };
        const end = { x: gridX + (i + .5) * cell, y: gridY + cell };
        const point = interpolate(start, end, smooth(build));
        dot(point.x, point.y, 1.6, i % 2 ? orange : cyan, Math.sin(Math.PI * build) * .65);
      }
    }
    if (build > 0) {
      if (matrixLayer) {
        ctx.save();
        ctx.beginPath();
        ctx.rect(gridX, gridY, g.matrixSize * build, g.matrixSize);
        ctx.clip();
        ctx.globalAlpha = (.3 + build * .7) * (1 - outro * .25);
        ctx.drawImage(matrixLayer, gridX, gridY, g.matrixSize, g.matrixSize);
        ctx.restore();
      } else {
        for (let row = 0; row < matrixWidth; row++) {
          for (let col = 0; col < matrixWidth; col++) {
            const reveal = smooth(clamp(build * 1.25 - col / matrixWidth * .25));
            const brightness = (scene.trace.material.matrix[row][col] - 32) / 94;
            ctx.globalAlpha = (.12 + brightness * .36) * reveal * (1 - outro * .25);
            ctx.fillStyle = cyan;
            ctx.fillRect(gridX + col * cell, gridY + row * cell,
              Math.max(.5, cell - .6), Math.max(.5, cell - .6));
          }
        }
      }
    }
    // Fine corner marks keep the matrix legible without a panel or a box.
    ctx.globalAlpha = .55 * build * (1 - outro * .5);
    ctx.strokeStyle = line;
    ctx.lineWidth = 1;
    const corner = Math.min(14, g.matrixSize * .08);
    for (const [x, y, dx, dy] of [[gridX, gridY, 1, 1], [gridX + g.matrixSize, gridY, -1, 1],
      [gridX, gridY + g.matrixSize, 1, -1], [gridX + g.matrixSize, gridY + g.matrixSize, -1, -1]]) {
      ctx.beginPath(); ctx.moveTo(x, y + dy * corner); ctx.lineTo(x, y); ctx.lineTo(x + dx * corner, y); ctx.stroke();
    }
    text(`${matrixWidth} × ${matrixWidth} matrix`, g.centre.x, gridY - 40, ink, build, 18);
    for (const tick of [0, matrixWidth / 2, matrixWidth - 1]) {
      text(String(tick), gridX + (tick + .5) * cell, gridY - 16, soft, build, 16);
    }
    text(active ? `M[${active.row}, ${active.column}] = ${active.key}` : `${matrixWidth ** 2} values`,
      g.centre.x, gridY + g.matrixSize + 28, soft, build, 16);
    if (active) {
      const pulse = Math.max(0, 1 - Math.abs(active.local - .5) * 5);
      ctx.globalAlpha = .42 * pulse;
      ctx.fillStyle = orange;
      ctx.fillRect(active.gate.x - cell / 2, gridY, Math.max(2, cell), g.matrixSize);
      ctx.fillRect(gridX, active.gate.y - cell / 2, g.matrixSize, Math.max(2, cell));
      dot(active.gate.x, active.gate.y, 12 * pulse + 4, orange, .2 * pulse);
      dot(active.gate.x, active.gate.y, 3.5, orange, pulse);
    }

    const labelOffset = (g.rows - 1) * g.spacingY / 2 + 44;
    text(scene.inverse ? "Ciphertext" : "Plaintext",
      g.source.x, g.source.y - labelOffset, cyan, 1 - outro * .3, 16);
    text(scene.inverse ? "Plaintext" : "Ciphertext",
      g.destination.x, g.destination.y - labelOffset, orange, .65 + outro * .35, 16);

    if (!scene.n) text("∅", g.source.x, g.source.y, ink, .65, 28);
    for (const entity of entities) {
      const focused = scene.focusCode === null || scene.focusCode === entity.input;
      const opacity = focused ? 1 : .22;
      const colour = entity.changed < .5 ? cyan : orange;
      if (entity.tail.length) {
        for (let j = 1; j < entity.tail.length; j++) {
          ctx.globalAlpha = (j / entity.tail.length) ** 2 * .75 * opacity;
          ctx.strokeStyle = colour;
          ctx.lineWidth = focused ? 2 : 1;
          ctx.beginPath();
          ctx.moveTo(entity.tail[j-1].x, entity.tail[j-1].y);
          ctx.lineTo(entity.tail[j].x, entity.tail[j].y);
          ctx.stroke();
        }
      }
      const pulse = Math.max(0, 1 - Math.abs(entity.local - .5) * 7);
      const radius = 17 + pulse * 5;
      dot(entity.position.x, entity.position.y, radius, paper, .94 * opacity);
      dot(entity.position.x, entity.position.y, radius, colour, (.055 + pulse * .13) * opacity);
      const fontSize = 22 + pulse * 2;
      if (entity.changed < 1) {
        text(O.unitLabel(entity.input), entity.position.x, entity.position.y,
          cyan, (1 - entity.changed) * opacity, fontSize);
      }
      if (entity.changed > 0) {
        text(O.unitLabel(entity.output), entity.position.x, entity.position.y,
          orange, entity.changed * opacity, fontSize);
      }
      if (focused && scene.focusCode !== null) {
        text(`#${entity.id}`, entity.position.x, entity.position.y + 23, soft, .9, 16);
      }
    }
    ctx.globalAlpha = 1;
  }

  return Object.freeze({ createScene, frameAt, paintMatrix, draw, smooth, segment });
});
