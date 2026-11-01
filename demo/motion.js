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

  function createScene(trace, limit = 40) {
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
        key: trace.material.lookup[slot % 64],
        row: trace.material.indexes[slot % 64],
        column: slot % 64,
      };
    });
    return { trace, n, count, ranks, entities, inverse };
  }

  function geometry(width, height, count, inverse) {
    const vertical = width < 620;
    const matrixSize = vertical ? Math.min(176, width * .56) : Math.min(224, width * .27);
    const centre = { x: width / 2, y: height * .49 };
    const left = vertical ? { x: width / 2, y: 112 } : { x: width * .13, y: height * .49 };
    const right = vertical ? { x: width / 2, y: height - 100 } : { x: width * .87, y: height * .49 };
    const zoneWidth = vertical ? width * .82 : width * .24;
    const columns = Math.max(1, Math.min(Math.max(1, count), Math.floor(zoneWidth / 25)));
    const spacingX = Math.min(27, zoneWidth / columns);
    const spacingY = count > 24 ? 26 : 31;
    const rows = Math.max(1, Math.ceil(count / columns));
    const point = (rank, origin) => {
      const row = Math.floor(rank / columns);
      const inRow = Math.min(columns, count - row * columns);
      return {
        x: origin.x + ((rank % columns) - (inRow - 1) / 2) * spacingX,
        y: origin.y + (row - (rows - 1) / 2) * spacingY,
      };
    };
    return { width, height, vertical, matrixSize, centre, point, rows,
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
    const travelSpread = scene.inverse ? .17 : .21;
    const travelDuration = .29;
    const entities = scene.entities.map((entity) => {
      const rank = scene.inverse ? entity.originalRank : entity.finalRank;
      const offset = scene.count <= 1 ? 0 : rank / (scene.count - 1);
      const local = segment(t, travelStart + offset * travelSpread,
        travelStart + offset * travelSpread + travelDuration);
      const cell = layout.matrixSize / 64;
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
      if (entity.local > .27 && entity.local < .73 &&
          (!active || Math.abs(entity.local - .5) < Math.abs(active.local - .5))) active = entity;
    }
    return { scene, layout, progress: t, build, entities, active };
  }

  function draw(ctx, frame, palette) {
    const { layout: g, scene, progress: t, build, entities, active } = frame;
    const { ink, green, gold, soft, line, paper } = palette;
    ctx.clearRect(0, 0, g.width, g.height);
    const mono = 'ui-monospace, "SFMono-Regular", Menlo, monospace';
    const text = (value, x, y, colour, alpha = 1, size = 11, align = "center", font = mono) => {
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
    const cell = g.matrixSize / 64;
    const outro = smooth(segment(t, .88, 1));

    // Quiet, continuous routes. Their brighter tails are drawn from the same curves.
    for (const entity of entities) {
      if (entity.local <= 0 || entity.local >= 1) continue;
      ctx.globalAlpha = .13 * Math.sin(Math.PI * entity.local);
      ctx.strokeStyle = entity.id % 2 ? gold : green;
      ctx.lineWidth = .75;
      ctx.beginPath();
      for (let j = 0; j <= 32; j++) {
        const point = passage(entity.from, entity.gate, entity.to, j / 32, g, entity.id);
        if (j === 0) ctx.moveTo(point.x, point.y); else ctx.lineTo(point.x, point.y);
      }
      ctx.stroke();
    }

    // Sixty-four seeds settle into the matrix as its columns open.
    if (build > 0 && build < 1) {
      for (let i = 0; i < 64; i++) {
        const theta = i / 64 * Math.PI * 2 - build * .4;
        const start = { x: g.centre.x + Math.cos(theta) * g.matrixSize * .66,
          y: g.centre.y + Math.sin(theta) * g.matrixSize * .66 };
        const end = { x: gridX + (i + .5) * cell, y: gridY + cell };
        const point = interpolate(start, end, smooth(build));
        dot(point.x, point.y, 1.3, i % 2 ? gold : green, Math.sin(Math.PI * build) * .5);
      }
    }
    if (build > 0) {
      for (let row = 0; row < 64; row++) {
        for (let col = 0; col < 64; col++) {
          const reveal = smooth(clamp(build * 1.25 - col / 64 * .25));
          if (reveal <= 0) continue;
          const brightness = (scene.trace.material.matrix[row][col] - 32) / 94;
          const lift = (1 - reveal) * (row % 2 ? -1 : 1) * 13;
          ctx.globalAlpha = (.08 + brightness * .23) * reveal * (1 - outro * .45);
          ctx.fillStyle = green;
          ctx.fillRect(gridX + col * cell, gridY + row * cell + lift,
            Math.max(.6, cell - .9), Math.max(.6, cell - .9));
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
    text("OMEGA MATRIX", g.centre.x, gridY - 23, soft, .72 * build, 11);
    text(active ? `[${active.row}, ${active.column}]  ·  ${active.key}` : "64 × 64",
      g.centre.x, gridY + g.matrixSize + 23, soft, .72 * build, 11);
    if (active) {
      const pulse = Math.max(0, 1 - Math.abs(active.local - .5) * 5);
      ctx.globalAlpha = .18 * pulse;
      ctx.fillStyle = green;
      ctx.fillRect(active.gate.x - cell / 2, gridY, cell, g.matrixSize);
      ctx.fillRect(gridX, active.gate.y - cell / 2, g.matrixSize, cell);
      dot(active.gate.x, active.gate.y, 9 * pulse + 3, green, .12 * pulse);
      dot(active.gate.x, active.gate.y, 2.6, green, .8 * pulse);
    }

    const labelOffset = (g.rows - 1) * (scene.count > 24 ? 13 : 15.5) + 36;
    text(scene.inverse ? "CIPHERTEXT" : "PLAINTEXT",
      g.source.x, g.source.y - labelOffset, soft, .75 * (1 - outro * .5), 11);
    text(scene.inverse ? "PLAINTEXT" : "CIPHERTEXT",
      g.destination.x, g.destination.y - labelOffset, soft, .35 + outro * .4, 11);

    if (!scene.n) text("∅", g.source.x, g.source.y, ink, .65, 28, "center", "Georgia, serif");
    for (const entity of entities) {
      const colour = entity.id % 2 ? gold : green;
      if (entity.tail.length) {
        for (let j = 1; j < entity.tail.length; j++) {
          ctx.globalAlpha = (j / entity.tail.length) ** 2 * .55;
          ctx.strokeStyle = colour;
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.moveTo(entity.tail[j-1].x, entity.tail[j-1].y);
          ctx.lineTo(entity.tail[j].x, entity.tail[j].y);
          ctx.stroke();
        }
      }
      const pulse = Math.max(0, 1 - Math.abs(entity.local - .5) * 7);
      const radius = 13 + pulse * 5;
      dot(entity.position.x, entity.position.y, radius, paper, .9);
      dot(entity.position.x, entity.position.y, radius, colour, .035 + pulse * .11);
      const fontSize = (g.width < 380 ? 16 : 19) + pulse * 2;
      if (entity.changed < 1) {
        text(O.unitLabel(entity.input), entity.position.x, entity.position.y,
          entity.local > 0 ? colour : ink, 1 - entity.changed, fontSize);
      }
      if (entity.changed > 0) {
        text(O.unitLabel(entity.output), entity.position.x, entity.position.y,
          entity.local >= 1 ? ink : colour, entity.changed, fontSize);
      }
      if (active?.id === entity.id) {
        text(`${entity.input} → ${entity.output}`, entity.position.x,
          entity.position.y - 27, soft, pulse * .85, 11);
      }
    }
    ctx.globalAlpha = 1;
  }

  return Object.freeze({ createScene, frameAt, draw, smooth, segment });
});
