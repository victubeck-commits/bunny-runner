/*
 * Bunny Runner — endless runner inspirado no Chrome Dino.
 * Coelho e pássaro: imagens fornecidas (recorte transparente preservado).
 * Cactos: pixel art desenhada em canvas, como no jogo original.
 */
(function () {
  'use strict';

  /* ============================ Configuração ============================ */

  const H = 150;                 // altura lógica do canvas
  const GROUND_Y = 127;          // linha do chão
  const STEP = 1000 / 60;        // passo fixo de física (60 Hz)
  const NIGHT_EVERY = 700;       // alterna dia/noite a cada 700 pontos

  const STAND_W = 33;            // largura do coelho em pé
  const STAND_H = 58;            // altura do coelho em pé
  const DUCK_H = 36;             // altura do coelho agachado

  const BIRD_W = 46;             // tamanho do pássaro na tela
  const BIRD_H = 43;

  const JUMP_V = -8.7;           // velocidade inicial do salto (px/tick)
  const GRAVITY = 0.6;           // gravidade (px/tick²)

  const HI_KEY = 'bunnyRunner.hi';

  // Recorte exato do conteúdo não-transparente das imagens fornecidas.
  const CROP_BUNNY = { x: 282, y: 0, w: 689, h: 1239 };
  const CROP_BIRD  = { x: 92, y: 86, w: 1185, h: 1107 };

  const COLORS = {
    day:   { bg: '#ffffff', fg: '#535353', cloud: '#d6d6d6' },
    night: { bg: '#0b0b0b', fg: '#f0f0f0', cloud: '#383838' }
  };

  /* ============================== Estado =============================== */

  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const stage = document.querySelector('.stage');
  const duckBtn = document.getElementById('duckBtn');

  let W = 600;                   // largura lógica (adaptada no resize)
  let dpr = 1;
  let speedScale = 1;            // mantém a dificuldade igual em telas menores
  let narrow = false;

  let state = 'READY';           // READY | PLAYING | OVER
  let score = 0;
  let scoreF = 0;
  let hi = loadHi();
  let speed = 6;
  let isNight = false;

  let tickCount = 0;
  let groundOffset = 0;
  let spawnCountdown = 90;
  let flash = 0;
  let crashFlash = 0;
  let shake = 0;
  let startAnim = 0;

  let obstacles = [];
  let clouds = [];

  const input = { keyDuck: false, btnDuck: false, duckUntil: 0 };
  const player = {
    x: 70,
    y: GROUND_Y - STAND_H,
    vy: 0,
    grounded: true,
    ducking: false,
    runFrame: 0
  };

  const bunnyImg = new Image();
  const birdImg = new Image();

  /* ============================ Utilidades ============================= */

  function loadHi() {
    try { return parseInt(localStorage.getItem(HI_KEY) || '0', 10) || 0; }
    catch (e) { return 0; }
  }

  function saveHi() {
    try { localStorage.setItem(HI_KEY, String(hi)); } catch (e) { /* file:// */ }
  }

  function pad(n) {
    return String(Math.max(0, Math.min(99999, Math.floor(n)))).padStart(5, '0');
  }

  function rand(min, max) { return min + Math.random() * (max - min); }

  /* ============================== Setup ================================ */

  function initClouds() {
    clouds = [];
    for (let i = 0; i < 4; i++) {
      clouds.push({
        x: rand(0, W),
        y: rand(16, 62),
        w: 34,
        h: 18,
        v: rand(0.25, 0.5)
      });
    }
  }

  function resize() {
    const cssW = stage.clientWidth || 600;
    narrow = cssW < 470;
    W = narrow ? 360 : 600;
    speedScale = W / 600;

    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    player.x = narrow ? 42 : 70;

    if (clouds.length === 0) initClouds();
    else for (const c of clouds) if (c.x > W) c.x = rand(0, W);
  }

  function resetPlayer() {
    player.y = GROUND_Y - STAND_H;
    player.vy = 0;
    player.grounded = true;
    player.ducking = false;
    player.runFrame = 0;
  }

  function startGame() {
    state = 'PLAYING';
    score = 0;
    scoreF = 0;
    speed = 6 * speedScale;
    isNight = false;
    tickCount = 0;
    groundOffset = 0;
    spawnCountdown = 90;
    obstacles = [];
    flash = 0;
    crashFlash = 0;
    shake = 0;
    startAnim = 1;
    input.duckUntil = 0;
    resetPlayer();
    initClouds();
  }

  function crash() {
    if (state !== 'PLAYING') return;
    state = 'OVER';
    crashFlash = 1;
    shake = 8;
    saveHi(); // hi já contém o maior valor da sessão
  }

  function jump() {
    if (state !== 'PLAYING') return;
    if (player.grounded && !player.ducking) {
      player.vy = JUMP_V;
      player.grounded = false;
    }
  }

  /* =========================== Obstáculos ============================== */

  // Retângulos relativos ao chão (y negativo = acima do chão).
  function cactusRects(kind) {
    const small = [
      { x: 6,  y: -32, w: 8, h: 32 },
      { x: 0,  y: -22, w: 7, h: 5  },
      { x: 0,  y: -22, w: 4, h: 14 },
      { x: 13, y: -27, w: 6, h: 5  },
      { x: 15, y: -27, w: 4, h: 11 }
    ];
    const large = [
      { x: 9,  y: -50, w: 9, h: 50 },
      { x: 1,  y: -34, w: 9, h: 5  },
      { x: 1,  y: -34, w: 5, h: 18 },
      { x: 18, y: -42, w: 7, h: 5  },
      { x: 20, y: -42, w: 5, h: 14 }
    ];
    if (kind === 'small') return { rects: small, w: 20, h: 32 };
    if (kind === 'large') return { rects: large, w: 26, h: 50 };
    const group = small.concat(small.map(function (r) {
      return { x: r.x + 22, y: r.y, w: r.w, h: r.h };
    }));
    return { rects: group, w: 43, h: 32 };
  }

  function spawnObstacle() {
    const r = Math.random();
    const birdChance = score < 25 ? 0 : score < 80 ? 0.25 : score < 180 ? 0.38 : 0.45;

    if (r < birdChance) {
      // Três alturas: baixa (pule), média (agache), alta (não pule).
      let height;
      if (score < 80) height = 'low';
      else if (score < 180) height = Math.random() < 0.6 ? 'low' : 'mid';
      else {
        const q = Math.random();
        height = q < 0.4 ? 'low' : q < 0.75 ? 'mid' : 'high';
      }
      const baseY = height === 'low' ? 84 : height === 'mid' ? 44 : 8;
      obstacles.push({
        type: 'bird',
        height: height,
        x: W + 30,
        y: baseY,
        baseY: baseY,
        w: BIRD_W,
        h: BIRD_H,
        phase: rand(0, Math.PI * 2),
        rects: [{ x: 7, y: 6, w: BIRD_W - 14, h: BIRD_H - 12 }]
      });
    } else {
      let kind = 'small';
      if (score >= 60) {
        const q = Math.random();
        kind = q < 0.55 ? 'small' : q < 0.85 ? 'large' : 'group';
      }
      const c = cactusRects(kind);
      obstacles.push({
        type: 'cactus',
        kind: kind,
        x: W + 20,
        y: 0,
        w: c.w,
        h: c.h,
        rects: c.rects
      });
    }
  }

  function collides() {
    const h = player.ducking ? DUCK_H : STAND_H;
    const pr = {
      x: player.x + 5,
      y: player.y + 7,
      w: STAND_W - 10,
      h: h - 10
    };
    for (const o of obstacles) {
      const oy = o.type === 'bird' ? o.y : GROUND_Y;
      for (const r of o.rects) {
        const rx = o.x + r.x;
        const ry = oy + r.y;
        if (pr.x < rx + r.w && pr.x + pr.w > rx &&
            pr.y < ry + r.h && pr.y + pr.h > ry) return true;
      }
    }
    return false;
  }

  /* ============================== Loop ================================= */

  function updatePlayer() {
    const wantDuck = input.keyDuck || input.btnDuck || performance.now() < input.duckUntil;

    if (player.grounded) {
      player.ducking = wantDuck;
      player.y = GROUND_Y - (player.ducking ? DUCK_H : STAND_H);
    } else {
      player.ducking = false;
    }

    player.vy += GRAVITY;
    player.y += player.vy;

    const floor = GROUND_Y - (player.ducking ? DUCK_H : STAND_H);
    if (player.y >= floor) {
      player.y = floor;
      player.vy = 0;
      player.grounded = true;
    }
    player.runFrame++;
  }

  function tick() {
    tickCount++;

    if (state === 'PLAYING') {
      speed = (6 + Math.min(score * 0.0035, 7)) * speedScale;
      scoreF += speed * 0.02;
      score = Math.floor(scoreF);
      if (score > hi) hi = score;

      const night = Math.floor(score / NIGHT_EVERY) % 2 === 1;
      if (night !== isNight) { isNight = night; flash = 1; }

      updatePlayer();

      groundOffset = (groundOffset + speed) % 14;
      for (const c of clouds) {
        c.x -= c.v * speed;
        if (c.x + c.w < -10) { c.x = W + rand(0, 80); c.y = rand(16, 62); }
      }

      spawnCountdown--;
      if (spawnCountdown <= 0) {
        spawnObstacle();
        // Intervalo medido em ticks: a dificuldade cresce, mas o salto
        // (~29 ticks) sempre cabe entre dois obstáculos.
        spawnCountdown = Math.max(44, Math.round(rand(58, 105) - score * 0.006));
      }

      for (const o of obstacles) {
        o.x -= speed;
        if (o.type === 'bird') o.y = o.baseY + Math.sin(tickCount * 0.12 + o.phase) * 2;
      }
      obstacles = obstacles.filter(function (o) { return o.x + o.w > -30; });

      if (collides()) crash();
      if (startAnim > 0) startAnim = Math.max(0, startAnim - 1 / 18);
    }

    if (flash > 0) flash = Math.max(0, flash - 0.06);
    if (crashFlash > 0) crashFlash = Math.max(0, crashFlash - 0.12);
    if (shake > 0) shake = Math.max(0, shake - 0.5);
  }

  let lastTime = 0;
  let acc = 0;

  function frame(now) {
    if (!lastTime) lastTime = now;
    let dt = now - lastTime;
    lastTime = now;
    if (dt > 100) dt = 100;      // evita "spiral of death" ao voltar de aba
    acc += dt;
    while (acc >= STEP) {
      tick();
      acc -= STEP;
    }
    render();
    requestAnimationFrame(frame);
  }

  /* ============================ Desenho ================================ */

  function drawCloud(c, color) {
    ctx.fillStyle = color;
    ctx.fillRect(c.x + 6, c.y, 18, 6);
    ctx.fillRect(c.x + 10, c.y - 5, 12, 5);
    ctx.fillRect(c.x, c.y + 6, 34, 7);
  }

  function drawGround(color) {
    ctx.fillStyle = color;
    ctx.fillRect(0, GROUND_Y, W, 2);
    for (let x = -groundOffset; x < W; x += 14) {
      ctx.fillRect(x, GROUND_Y + 6, 3, 3);
      ctx.fillRect(x + 7, GROUND_Y + 13, 2, 2);
    }
  }

  // Sombra no chão: encolhe e desaparece conforme o coelho sobe.
  function drawShadow() {
    if (player.grounded) return;
    const rise = Math.max(0, Math.min(1, (GROUND_Y - STAND_H - player.y) / 60));
    ctx.fillStyle = isNight
      ? 'rgba(255,255,255,' + (0.30 * (1 - rise)) + ')'
      : 'rgba(0,0,0,' + (0.30 * (1 - rise)) + ')';
    ctx.beginPath();
    ctx.ellipse(
      player.x + STAND_W / 2, GROUND_Y + 2,
      (STAND_W / 2) * (1 - 0.4 * rise), 2.5 * (1 - 0.4 * rise),
      0, 0, Math.PI * 2
    );
    ctx.fill();
  }

  function drawBird(o) {
    ctx.save();
    ctx.translate(o.x + BIRD_W / 2, o.y + BIRD_H / 2);
    ctx.rotate(Math.sin(tickCount * 0.09 + o.phase) * 0.035);
    const flap = 1 + Math.sin(tickCount * 0.22 + o.phase) * 0.045;
    ctx.scale(1, flap);
    ctx.drawImage(
      birdImg,
      CROP_BIRD.x, CROP_BIRD.y, CROP_BIRD.w, CROP_BIRD.h,
      -BIRD_W / 2, -BIRD_H / 2, BIRD_W, BIRD_H
    );
    ctx.restore();
  }

  function drawObstacle(o, color) {
    if (o.type === 'bird') { drawBird(o); return; }
    ctx.fillStyle = color;
    for (const r of o.rects) ctx.fillRect(o.x + r.x, GROUND_Y + r.y, r.w, r.h);
  }

  function drawPlayer() {
    const duck = player.ducking;
    const h = duck ? DUCK_H : STAND_H;
    let sy = h / STAND_H;
    let sx = duck ? 1.06 : 1;

    ctx.save();
    // Os pés acompanham player.y: no ar o coelho realmente sobe na tela.
    ctx.translate(player.x + STAND_W / 2, player.y + h);

    let angle;
    if (state === 'OVER') {
      angle = -0.30;
    } else if (state === 'PLAYING') {
      if (!player.grounded) {
        // Salto bem legível: inclinação forte + leve esticamento/achatamento.
        const rising = player.vy < 0;
        angle = rising ? -0.24 : 0.26;
        sy *= rising ? 1.06 : 0.94;
        sx *= rising ? 0.96 : 1.05;
      } else {
        angle = (player.runFrame % 8 < 4 ? 0.025 : -0.025) +
                Math.sin(player.runFrame * 0.35) * 0.012;
      }
      angle -= 0.16 * startAnim;
    } else {
      angle = Math.sin(tickCount * 0.05) * 0.01;
    }

    ctx.rotate(angle);
    ctx.scale(sx, sy);
    ctx.drawImage(
      bunnyImg,
      CROP_BUNNY.x, CROP_BUNNY.y, CROP_BUNNY.w, CROP_BUNNY.h,
      -STAND_W / 2, -STAND_H, STAND_W, STAND_H
    );
    ctx.restore();
  }

  function drawScore(color) {
    ctx.fillStyle = color;
    ctx.font = 'bold 20px "Courier New", Courier, monospace';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText('HI ' + pad(hi), W - 12, 22);
    ctx.fillText(pad(score), W - 12, 46);
  }

  function drawReady(color) {
    ctx.fillStyle = color;
    ctx.textAlign = 'center';
    ctx.font = 'bold 11px "Courier New", Courier, monospace';
    ctx.fillText(
      narrow ? 'TOQUE PARA COMEÇAR' : 'PRESSIONE ESPAÇO OU CLIQUE PARA COMEÇAR',
      W / 2, 96
    );
    ctx.font = '11px "Courier New", Courier, monospace';
    ctx.fillText(
      narrow ? 'toque: pular  ·  ↓: agachar' : '↑ / ESPAÇO: pular   ·   ↓: agachar',
      W / 2, 112
    );
  }

  function drawRestartIcon(color) {
    const pulse = 1 + Math.sin(tickCount * 0.1) * 0.06;
    ctx.save();
    ctx.translate(W / 2, GROUND_Y + 12);
    ctx.scale(pulse, pulse);
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, 6, 0.7, Math.PI * 1.85);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(7, -5);
    ctx.lineTo(2, -7);
    ctx.lineTo(4, -1);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function drawGameOver(color) {
    ctx.fillStyle = color;
    ctx.textAlign = 'center';
    ctx.font = 'bold ' + (narrow ? 19 : 22) + 'px "Courier New", Courier, monospace';
    ctx.fillText('GAME OVER', W / 2, 38);
    drawRestartIcon(color);
  }

  function render() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const pal = isNight ? COLORS.night : COLORS.day;
    ctx.fillStyle = pal.bg;
    ctx.fillRect(0, 0, W, H);

    ctx.save();
    if (shake > 0) {
      ctx.translate(rand(-shake, shake) * 0.5, rand(-shake, shake) * 0.5);
    }
    for (const c of clouds) drawCloud(c, pal.cloud);
    drawGround(pal.fg);
    drawShadow();
    for (const o of obstacles) drawObstacle(o, pal.fg);
    drawPlayer();
    ctx.restore();

    drawScore(pal.fg);
    if (state === 'READY') drawReady(pal.fg);
    if (state === 'OVER') drawGameOver(pal.fg);

    if (flash > 0) {
      ctx.fillStyle = isNight
        ? 'rgba(255,255,255,' + (flash * 0.5) + ')'
        : 'rgba(0,0,0,' + (flash * 0.5) + ')';
      ctx.fillRect(0, 0, W, H);
    }
    if (crashFlash > 0) {
      ctx.fillStyle = 'rgba(255,60,60,' + (crashFlash * 0.35) + ')';
      ctx.fillRect(0, 0, W, H);
    }
  }

  /* ============================ Controles ============================== */

  // Aceita e.code (navegadores modernos) e e.key/keyCode (fallback).
  function keyName(e) {
    if (e.code) return e.code;
    if (e.key === ' ' || e.key === 'Spacebar') return 'Space';
    return e.key || '';
  }

  window.addEventListener('keydown', function (e) {
    const c = keyName(e);
    const isDown = c === 'ArrowDown' || c === 'Down' || e.keyCode === 40;
    const isSpace = c === 'Space' || e.keyCode === 32;
    const isUp = c === 'ArrowUp' || c === 'Up' || e.keyCode === 38;
    const isEnter = c === 'Enter' || e.keyCode === 13;

    if (isDown || isSpace || isUp || isEnter) e.preventDefault();

    if (isDown) { input.keyDuck = true; return; }

    if (isSpace || isUp) {
      if (e.repeat) return;
      pressAction();
    } else if (isEnter) {
      if (e.repeat) return;
      if (state !== 'PLAYING') startGame();
    }
  });

  window.addEventListener('keyup', function (e) {
    const c = keyName(e);
    if (c === 'ArrowDown' || c === 'Down' || e.keyCode === 40) input.keyDuck = false;
  });

  window.addEventListener('blur', function () {
    input.keyDuck = false;
    input.btnDuck = false;
    duckBtn.classList.remove('active');
  });

  let touchStartY = null;

  function isDuckButton(target) {
    return target === duckBtn || (duckBtn.contains && duckBtn.contains(target));
  }

  function pressAction() {
    if (state !== 'PLAYING') { startGame(); jump(); }
    else jump();
  }

  // Clique/toque em qualquer lugar da página inicia ou pula (como no Dino original).
  if (window.PointerEvent) {
    window.addEventListener('pointerdown', function (e) {
      if (isDuckButton(e.target)) return;
      e.preventDefault();
      if (state !== 'PLAYING') { pressAction(); return; }
      if (e.pointerType === 'touch') touchStartY = e.clientY;
      else pressAction();
    });

    window.addEventListener('pointerup', function (e) {
      if (isDuckButton(e.target)) return;
      if (e.pointerType === 'touch' && touchStartY !== null && state === 'PLAYING') {
        const dy = e.clientY - touchStartY;
        if (dy > 28) input.duckUntil = performance.now() + 650; // gesto: arrastar para baixo
        else pressAction();
      }
      touchStartY = null;
    });

    window.addEventListener('pointercancel', function () { touchStartY = null; });
    window.addEventListener('contextmenu', function (e) {
      if (!isDuckButton(e.target)) e.preventDefault();
    });
  } else {
    // Fallback para navegadores sem Pointer Events.
    window.addEventListener('click', function (e) {
      if (isDuckButton(e.target)) return;
      e.preventDefault();
      pressAction();
    });
    window.addEventListener('touchstart', function (e) {
      if (isDuckButton(e.target)) return;
      e.preventDefault();
      if (state !== 'PLAYING') pressAction();
      else touchStartY = e.touches[0].clientY;
    }, { passive: false });
    window.addEventListener('touchend', function (e) {
      if (isDuckButton(e.target)) return;
      e.preventDefault();
      if (state === 'PLAYING') {
        const dy = e.changedTouches[0].clientY - touchStartY;
        if (dy > 28) input.duckUntil = performance.now() + 650;
        else pressAction();
      }
      touchStartY = null;
    }, { passive: false });
  }

  duckBtn.addEventListener('pointerdown', function (e) {
    e.preventDefault();
    try { duckBtn.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    input.btnDuck = true;
    duckBtn.classList.add('active');
  });

  ['pointerup', 'pointercancel', 'pointerleave', 'pointerout'].forEach(function (type) {
    duckBtn.addEventListener(type, function () {
      input.btnDuck = false;
      duckBtn.classList.remove('active');
    });
  });
  duckBtn.addEventListener('contextmenu', function (e) { e.preventDefault(); });

  window.addEventListener('resize', resize);

  // Pequeno gancho de inspeção (não altera a jogabilidade).
  window.__runner = {
    get state() { return state; },
    get score() { return score; },
    get hi() { return hi; },
    get speed() { return speed; },
    get isNight() { return isNight; },
    get tickCount() { return tickCount; },
    get W() { return W; },
    get narrow() { return narrow; },
    get player() {
      return {
        x: player.x, y: player.y, vy: player.vy,
        grounded: player.grounded, ducking: player.ducking
      };
    },
    get obstacles() { return obstacles; },
    setScore: function (n) { score = Math.floor(n); scoreF = n; },
    spawnObstacle: spawnObstacle,
    start: startGame,
    crash: crash
  };

  /* ============================== Init ================================= */

  let loaded = 0;
  function ready() {
    loaded++;
    if (loaded === 2) {
      resize();
      try { canvas.focus({ preventScroll: true }); } catch (err) { canvas.focus(); }
      requestAnimationFrame(frame);
    }
  }
  bunnyImg.onload = ready;
  birdImg.onload = ready;
  bunnyImg.onerror = ready;
  birdImg.onerror = ready;
  bunnyImg.src = 'assets/bunny.png';
  birdImg.src = 'assets/bird.png';
})();
