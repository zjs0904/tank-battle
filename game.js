const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const overlay = document.getElementById("overlay");
const overlayTitle = document.getElementById("overlayTitle");
const overlayText = document.getElementById("overlayText");
const startButton = document.getElementById("startButton");
const singleModeButton = document.getElementById("singleModeButton");
const versusModeButton = document.getElementById("versusModeButton");
const modeBadge = document.getElementById("modeBadge");

const statEls = {
  score: document.getElementById("score"),
  level: document.getElementById("level"),
  enemies: document.getElementById("enemies"),
  baseHp: document.getElementById("baseHp"),
  p1Lives: document.getElementById("p1Lives"),
  p2Lives: document.getElementById("p2Lives"),
  p1Item: document.getElementById("p1Item"),
  p1Timer: document.getElementById("p1Timer"),
  p2Item: document.getElementById("p2Item"),
  p2Timer: document.getElementById("p2Timer")
};

const WORLD = { width: canvas.width, height: canvas.height };
const keys = new Set();
let selectedMode = "single";
let gameState = null;
let lastFrame = 0;

const DIRECTIONS = {
  up: { x: 0, y: -1, angle: -Math.PI / 2 },
  down: { x: 0, y: 1, angle: Math.PI / 2 },
  left: { x: -1, y: 0, angle: Math.PI },
  right: { x: 1, y: 0, angle: 0 }
};

const PLAYER_CONFIGS = [
  {
    id: "player1",
    label: "1P",
    color: "#7ef28d",
    accent: "116,242,141",
    spawnSingle: { x: WORLD.width / 2, y: WORLD.height - 92 },
    spawnVersus: { x: 180, y: WORLD.height / 2 },
    controls: { up: "KeyW", down: "KeyS", left: "KeyA", right: "KeyD", fire: "KeyJ" }
  },
  {
    id: "player2",
    label: "2P",
    color: "#62c7ff",
    accent: "98,199,255",
    spawnVersus: { x: WORLD.width - 180, y: WORLD.height / 2 },
    controls: { up: "ArrowUp", down: "ArrowDown", left: "ArrowLeft", right: "ArrowRight", fire: "Enter" }
  }
];

const ITEM_TYPES = {
  laser: { label: "激光炮", color: "#ff6666", duration: 9 },
  rapid: { label: "连发", color: "#ffd84f", duration: 9 },
  boost: { label: "加速", color: "#59f0c2", duration: 9 }
};

class Tank {
  constructor(config) {
    this.id = config.id;
    this.label = config.label || "";
    this.type = config.type;
    this.color = config.color;
    this.accent = config.accent;
    this.x = config.x;
    this.y = config.y;
    this.width = 34;
    this.height = 34;
    this.direction = config.direction || "up";
    this.speed = config.speed;
    this.hp = config.hp;
    this.cooldown = 0;
    this.aiTimer = 0;
    this.fireTimer = randomBetween(0.3, 0.7);
    this.alive = true;
    this.power = null;
    this.powerTime = 0;
  }

  get bounds() {
    return {
      left: this.x - this.width / 2,
      right: this.x + this.width / 2,
      top: this.y - this.height / 2,
      bottom: this.y + this.height / 2
    };
  }
}

function randomBetween(min, max) {
  return Math.random() * (max - min) + min;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function rectsOverlap(a, b) {
  return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
}

function createPlayer(config, mode) {
  const spawn = mode === "versus" ? config.spawnVersus : config.spawnSingle;
  return new Tank({
    id: config.id,
    label: config.label,
    type: "player",
    color: config.color,
    accent: config.accent,
    x: spawn.x,
    y: spawn.y,
    speed: 320,
    hp: 1
  });
}

function createWalls(mode) {
  if (mode === "versus") {
    return [
      { x: WORLD.width / 2, y: 120, w: 160, h: 30, hp: 4, maxHp: 4 },
      { x: WORLD.width / 2, y: WORLD.height - 120, w: 160, h: 30, hp: 4, maxHp: 4 },
      { x: WORLD.width / 2, y: WORLD.height / 2, w: 30, h: 160, hp: 4, maxHp: 4 },
      { x: 280, y: WORLD.height / 2, w: 30, h: 120, hp: 4, maxHp: 4 },
      { x: WORLD.width - 280, y: WORLD.height / 2, w: 30, h: 120, hp: 4, maxHp: 4 }
    ];
  }

  return [
    { x: 170, y: 150, w: 132, h: 30, hp: 5, maxHp: 5 },
    { x: 790, y: 150, w: 132, h: 30, hp: 5, maxHp: 5 },
    { x: 300, y: 270, w: 30, h: 136, hp: 5, maxHp: 5 },
    { x: 660, y: 270, w: 30, h: 136, hp: 5, maxHp: 5 },
    { x: 480, y: 180, w: 180, h: 30, hp: 5, maxHp: 5 },
    { x: 480, y: 390, w: 220, h: 30, hp: 5, maxHp: 5 },
    { x: 190, y: 420, w: 140, h: 30, hp: 5, maxHp: 5 },
    { x: 770, y: 420, w: 140, h: 30, hp: 5, maxHp: 5 }
  ];
}

function createInitialState(mode) {
  const players = mode === "versus"
    ? PLAYER_CONFIGS.map((config) => createPlayer(config, mode))
    : [createPlayer(PLAYER_CONFIGS[0], mode)];

  const state = {
    mode,
    status: "idle",
    score: 0,
    round: 1,
    bullets: [],
    enemies: [],
    explosions: [],
    items: [],
    walls: createWalls(mode),
    base: mode === "single" ? { x: WORLD.width / 2, y: WORLD.height - 32, width: 76, height: 28, hp: 5, maxHp: 5 } : null,
    players,
    lives: { player1: 3, player2: mode === "versus" ? 3 : 0 },
    wins: { player1: 0, player2: 0 },
    itemTimer: 4.5
  };

  if (mode === "single") {
    spawnEnemyWave(state);
  }
  return state;
}

function spawnEnemyWave(state) {
  const count = Math.min(4 + state.round * 2, 14);
  const spawnPoints = [80, 220, 360, 480, 600, 740, 880];
  state.enemies = Array.from({ length: count }, (_, index) => {
    const lane = spawnPoints[index % spawnPoints.length];
    const row = Math.floor(index / spawnPoints.length);
    return new Tank({
      id: `enemy-${state.round}-${index}`,
      type: "enemy",
      color: "#ff785f",
      accent: "255,120,95",
      x: lane,
      y: 80 + row * 56,
      speed: 140 + state.round * 16,
      direction: "down",
      hp: 1
    });
  });
}

function setMode(mode) {
  selectedMode = mode;
  singleModeButton.classList.toggle("active", mode === "single");
  versusModeButton.classList.toggle("active", mode === "versus");
  modeBadge.textContent = mode === "versus" ? "双人对战" : "单人闯关";
  setOverlay(
    mode === "versus" ? "双人对战已就绪" : "单人闯关已就绪",
    mode === "versus" ? "1P 和 2P 互相对轰，抢到强道具就能起节奏。" : "躲弹、抢道具、清敌军、守基地。",
    true
  );
}

function setOverlay(title, text, visible) {
  overlayTitle.textContent = title;
  overlayText.textContent = text;
  overlay.classList.toggle("hidden", !visible);
}

function resetGame() {
  gameState = createInitialState(selectedMode);
  gameState.status = "running";
  modeBadge.textContent = selectedMode === "versus" ? "双人对战" : "单人闯关";
  setOverlay("战斗开始", "道具加成已经拉高了，左侧可以直接看持续时间。", false);
  syncStats();
}

function syncPlayerBuff(player, itemEl, timerEl) {
  if (!player || !player.alive || !player.power || player.powerTime <= 0) {
    itemEl.textContent = "无";
    timerEl.textContent = "0s";
    return;
  }
  itemEl.textContent = ITEM_TYPES[player.power].label;
  timerEl.textContent = `${player.powerTime.toFixed(1)}s`;
}

function syncStats() {
  if (gameState.mode === "versus") {
    statEls.score.textContent = `${gameState.wins.player1}:${gameState.wins.player2}`;
    statEls.level.textContent = String(gameState.round);
    statEls.enemies.textContent = "对战中";
    statEls.baseHp.textContent = "-";
  } else {
    statEls.score.textContent = String(gameState.score);
    statEls.level.textContent = String(gameState.round);
    statEls.enemies.textContent = String(gameState.enemies.length);
    statEls.baseHp.textContent = String(gameState.base.hp);
  }

  statEls.p1Lives.textContent = String(gameState.lives.player1);
  statEls.p2Lives.textContent = String(gameState.lives.player2);

  const p1 = gameState.players.find((player) => player.id === "player1");
  const p2 = gameState.players.find((player) => player.id === "player2");
  syncPlayerBuff(p1, statEls.p1Item, statEls.p1Timer);
  syncPlayerBuff(p2, statEls.p2Item, statEls.p2Timer);
}

function getBaseBounds(state) {
  if (!state.base) return null;
  return {
    left: state.base.x - state.base.width / 2,
    right: state.base.x + state.base.width / 2,
    top: state.base.y - state.base.height / 2,
    bottom: state.base.y + state.base.height / 2
  };
}

function getLivingPlayers(state) {
  return state.players.filter((player) => player.alive && player.hp > 0);
}

function hitsObstacle(tank, state) {
  const bounds = tank.bounds;

  for (const wall of state.walls) {
    if (wall.hp <= 0) continue;
    const wallBounds = {
      left: wall.x - wall.w / 2,
      right: wall.x + wall.w / 2,
      top: wall.y - wall.h / 2,
      bottom: wall.y + wall.h / 2
    };
    if (rectsOverlap(bounds, wallBounds)) return true;
  }

  const baseBounds = getBaseBounds(state);
  if (tank.type === "enemy" && baseBounds && rectsOverlap(bounds, baseBounds)) {
    return true;
  }

  const allTanks = [...state.players, ...state.enemies];
  for (const other of allTanks) {
    if (other === tank || !other.alive || other.hp <= 0) continue;
    if (rectsOverlap(bounds, other.bounds)) return true;
  }

  return false;
}

function moveTank(tank, dt, state, intentX, intentY) {
  if (intentX === 0 && intentY === 0) return;

  const speedBoost = tank.power === "boost" ? 1.9 : 1;
  const length = Math.hypot(intentX, intentY) || 1;
  const velocityX = (intentX / length) * tank.speed * speedBoost * dt;
  const velocityY = (intentY / length) * tank.speed * speedBoost * dt;

  if (Math.abs(intentX) > Math.abs(intentY)) {
    tank.direction = intentX > 0 ? "right" : "left";
  } else {
    tank.direction = intentY > 0 ? "down" : "up";
  }

  const originalX = tank.x;
  const originalY = tank.y;

  tank.x = clamp(tank.x + velocityX, tank.width / 2, WORLD.width - tank.width / 2);
  if (hitsObstacle(tank, state)) tank.x = originalX;

  tank.y = clamp(tank.y + velocityY, tank.height / 2, WORLD.height - tank.height / 2);
  if (hitsObstacle(tank, state)) tank.y = originalY;
}

function fireLaser(tank, state) {
  const dir = DIRECTIONS[tank.direction];
  const targets = tank.type === "enemy"
    ? state.players
    : tank.type === "player" && state.mode === "versus"
      ? state.players.filter((player) => player.id !== tank.id)
      : state.enemies;

  for (const target of targets) {
    if (!target.alive || target.hp <= 0) continue;
    const sameRow = dir.x !== 0 && Math.abs(target.y - tank.y) < 26 && Math.sign(target.x - tank.x) === dir.x;
    const sameCol = dir.y !== 0 && Math.abs(target.x - tank.x) < 26 && Math.sign(target.y - tank.y) === dir.y;
    if (sameRow || sameCol) {
      target.hp -= 3;
      state.explosions.push({ x: target.x, y: target.y, life: 0.24, size: 32, color: "255,105,105" });
      if (target.hp <= 0) handleTankDestroyed(target, state, tank.id);
    }
  }

  for (const wall of state.walls) {
    if (wall.hp <= 0) continue;
    const sameRow = dir.x !== 0 && Math.abs(wall.y - tank.y) < wall.h / 2 + 10 && Math.sign(wall.x - tank.x) === dir.x;
    const sameCol = dir.y !== 0 && Math.abs(wall.x - tank.x) < wall.w / 2 + 10 && Math.sign(wall.y - tank.y) === dir.y;
    if (sameRow || sameCol) {
      wall.hp -= 3;
    }
  }

  state.explosions.push({ x: tank.x + dir.x * 130, y: tank.y + dir.y * 130, life: 0.16, size: 110, color: "255,105,105" });
}

function shoot(tank, state) {
  if (!tank.alive || tank.cooldown > 0) return;

  if (tank.power === "laser") {
    fireLaser(tank, state);
    tank.cooldown = 0.16;
    return;
  }

  const dir = DIRECTIONS[tank.direction];
  const isEnemy = tank.type === "enemy";
  const rapidFactor = tank.power === "rapid" ? 0.25 : 1;
  const bulletSpeed = isEnemy ? 460 + state.round * 18 : 920;

  state.bullets.push({
    x: tank.x + dir.x * 28,
    y: tank.y + dir.y * 28,
    vx: dir.x * bulletSpeed,
    vy: dir.y * bulletSpeed,
    radius: isEnemy ? 5 : 5.5,
    owner: tank.id,
    ownerType: tank.type,
    color: isEnemy ? "#ffd166" : "#f8ff71"
  });

  tank.cooldown = (isEnemy ? randomBetween(0.35, 0.7) : 0.09) * rapidFactor;
}

function updatePlayers(dt, state) {
  for (const config of PLAYER_CONFIGS) {
    const player = state.players.find((item) => item.id === config.id);
    if (!player || !player.alive || player.hp <= 0) continue;

    let intentX = 0;
    let intentY = 0;
    if (keys.has(config.controls.left)) intentX -= 1;
    if (keys.has(config.controls.right)) intentX += 1;
    if (keys.has(config.controls.up)) intentY -= 1;
    if (keys.has(config.controls.down)) intentY += 1;

    moveTank(player, dt, state, intentX, intentY);
    if (keys.has(config.controls.fire)) shoot(player, state);
  }
}

function getNearestPlayer(enemy, state) {
  const players = getLivingPlayers(state);
  if (players.length === 0) return null;
  let nearest = players[0];
  let best = Infinity;
  for (const player of players) {
    const distance = Math.hypot(player.x - enemy.x, player.y - enemy.y);
    if (distance < best) {
      best = distance;
      nearest = player;
    }
  }
  return nearest;
}

function updateEnemies(dt, state) {
  if (state.mode !== "single") return;

  for (const enemy of state.enemies) {
    if (!enemy.alive || enemy.hp <= 0) continue;

    enemy.aiTimer -= dt;
    enemy.fireTimer -= dt;
    const target = getNearestPlayer(enemy, state);

    if (enemy.aiTimer <= 0) {
      const dx = target ? target.x - enemy.x : 0;
      const dy = target ? target.y - enemy.y : 1;
      enemy.direction = Math.abs(dx) > Math.abs(dy)
        ? dx > 0 ? "right" : "left"
        : dy > 0 ? "down" : "up";
      enemy.aiTimer = randomBetween(0.15, 0.45);
    }

    const dir = DIRECTIONS[enemy.direction];
    moveTank(enemy, dt, state, dir.x, dir.y);

    if (enemy.fireTimer <= 0) {
      shoot(enemy, state);
      enemy.fireTimer = randomBetween(0.38, 0.82);
    }
  }
}

function collideBulletWithWalls(bullet, state) {
  for (const wall of state.walls) {
    if (wall.hp <= 0) continue;
    if (
      bullet.x > wall.x - wall.w / 2 &&
      bullet.x < wall.x + wall.w / 2 &&
      bullet.y > wall.y - wall.h / 2 &&
      bullet.y < wall.y + wall.h / 2
    ) {
      wall.hp -= 1;
      state.explosions.push({ x: bullet.x, y: bullet.y, life: 0.16, size: 18, color: "255,201,94" });
      return true;
    }
  }
  return false;
}

function collideBulletWithBase(bullet, state) {
  const baseBounds = getBaseBounds(state);
  if (!baseBounds) return false;
  if (
    bullet.x > baseBounds.left &&
    bullet.x < baseBounds.right &&
    bullet.y > baseBounds.top &&
    bullet.y < baseBounds.bottom
  ) {
    if (bullet.ownerType === "enemy") {
      state.base.hp -= 1;
      state.explosions.push({ x: state.base.x, y: state.base.y, life: 0.24, size: 34, color: "255,141,99" });
      if (state.base.hp <= 0) endGame("基地失守", "这局没守住，重新开始再来。");
    }
    return true;
  }
  return false;
}

function collideBulletWithTanks(bullet, state) {
  const targets = bullet.ownerType === "enemy"
    ? state.players
    : state.mode === "versus"
      ? state.players.filter((player) => player.id !== bullet.owner)
      : state.enemies;

  for (const tank of targets) {
    if (!tank.alive || tank.hp <= 0) continue;
    const bounds = tank.bounds;
    const hit = bullet.x > bounds.left && bullet.x < bounds.right && bullet.y > bounds.top && bullet.y < bounds.bottom;
    if (!hit) continue;

    tank.hp -= 1;
    state.explosions.push({ x: bullet.x, y: bullet.y, life: 0.2, size: 24, color: tank.type === "enemy" ? "255,141,99" : tank.accent });
    if (tank.hp <= 0) handleTankDestroyed(tank, state, bullet.owner);
    return true;
  }
  return false;
}

function updateBullets(dt, state) {
  for (const bullet of state.bullets) {
    bullet.x += bullet.vx * dt;
    bullet.y += bullet.vy * dt;
  }

  state.bullets = state.bullets.filter((bullet) => {
    if (
      bullet.x < -bullet.radius ||
      bullet.x > WORLD.width + bullet.radius ||
      bullet.y < -bullet.radius ||
      bullet.y > WORLD.height + bullet.radius
    ) {
      return false;
    }
    if (collideBulletWithWalls(bullet, state)) return false;
    if (collideBulletWithBase(bullet, state)) return false;
    if (collideBulletWithTanks(bullet, state)) return false;
    return true;
  });
}

function spawnItem(state) {
  const types = Object.keys(ITEM_TYPES);
  const type = types[Math.floor(Math.random() * types.length)];
  state.items.push({
    type,
    x: randomBetween(120, WORLD.width - 120),
    y: randomBetween(120, WORLD.height - 120),
    radius: 16,
    life: 9
  });
}

function updateItems(dt, state) {
  state.itemTimer -= dt;
  if (state.itemTimer <= 0) {
    spawnItem(state);
    state.itemTimer = randomBetween(6, 8.5);
  }

  for (const item of state.items) {
    item.life -= dt;
  }
  state.items = state.items.filter((item) => item.life > 0);

  for (const player of state.players) {
    if (!player.alive || player.hp <= 0) continue;
    for (const item of state.items) {
      const distance = Math.hypot(player.x - item.x, player.y - item.y);
      if (distance < 24) {
        player.power = item.type;
        player.powerTime = ITEM_TYPES[item.type].duration;
        item.life = 0;
      }
    }
  }
  state.items = state.items.filter((item) => item.life > 0);
}

function handleTankDestroyed(tank, state) {
  tank.alive = false;
  state.explosions.push({ x: tank.x, y: tank.y, life: 0.32, size: 38, color: tank.type === "enemy" ? "255,141,99" : tank.accent });

  if (tank.type === "enemy") {
    state.score += 100;
    return;
  }

  state.lives[tank.id] = Math.max(0, state.lives[tank.id] - 1);

  if (state.mode === "versus") {
    const winnerId = tank.id === "player1" ? "player2" : "player1";
    state.wins[winnerId] += 1;
    state.status = "ended";
    setOverlay(`${winnerId === "player1" ? "1P" : "2P"} 获胜`, "点击开始战斗继续下一回合。", true);
    return;
  }

  if (state.lives[tank.id] > 0) {
    state.players[0] = createPlayer(PLAYER_CONFIGS[0], "single");
  } else {
    endGame("全军覆没", "你的坦克被打爆了，重新开始再来。");
  }
}

function updateEffects(dt, state) {
  state.explosions = state.explosions.filter((effect) => {
    effect.life -= dt;
    effect.size += dt * 46;
    return effect.life > 0;
  });

  for (const tank of [...state.players, ...state.enemies]) {
    if (!tank.alive) continue;
    tank.cooldown = Math.max(0, tank.cooldown - dt);
    if (tank.powerTime > 0) {
      tank.powerTime -= dt;
      if (tank.powerTime <= 0) {
        tank.power = null;
        tank.powerTime = 0;
      }
    }
  }
}

function cleanupState(state) {
  state.walls = state.walls.filter((wall) => wall.hp > 0);
  state.enemies = state.enemies.filter((enemy) => enemy.alive && enemy.hp > 0);

  if (state.mode === "single" && state.status === "running" && state.enemies.length === 0) {
    state.round += 1;
    state.walls = createWalls("single");
    state.base.hp = Math.min(state.base.maxHp, state.base.hp + 1);
    spawnEnemyWave(state);
    setOverlay(`第 ${state.round} 关`, "敌军更猛了，道具也会继续掉。", true);
    window.setTimeout(() => {
      if (gameState && gameState.status === "running") setOverlay("", "", false);
    }, 900);
  }
}

function endGame(title, text) {
  if (!gameState || gameState.status === "ended") return;
  gameState.status = "ended";
  setOverlay(title, text, true);
}

function togglePause() {
  if (!gameState || gameState.status === "ended" || gameState.status === "idle") return;
  if (gameState.status === "paused") {
    gameState.status = "running";
    setOverlay("", "", false);
  } else {
    gameState.status = "paused";
    setOverlay("已暂停", "按 P 继续。", true);
  }
}

function update(dt) {
  if (!gameState || gameState.status !== "running") return;
  updatePlayers(dt, gameState);
  updateEnemies(dt, gameState);
  updateBullets(dt, gameState);
  updateItems(dt, gameState);
  updateEffects(dt, gameState);
  cleanupState(gameState);
  syncStats();
}

function drawTank(tank) {
  if (!tank.alive || tank.hp <= 0) return;

  ctx.save();
  ctx.translate(tank.x, tank.y);
  ctx.rotate(DIRECTIONS[tank.direction].angle);
  ctx.fillStyle = tank.color;
  ctx.fillRect(-tank.width / 2, -tank.height / 2, tank.width, tank.height);
  ctx.fillRect(-tank.width / 2 - 6, -tank.height / 2, 6, tank.height);
  ctx.fillRect(tank.width / 2, -tank.height / 2, 6, tank.height);
  ctx.fillStyle = "#18242b";
  ctx.fillRect(-9, -9, 18, 18);
  ctx.fillRect(0, -4, tank.width / 2 + 12, 8);

  if (tank.type === "player") {
    ctx.fillStyle = "rgba(6, 15, 22, 0.58)";
    ctx.fillRect(-12, 16, 24, 12);
    ctx.fillStyle = "#f4f1e7";
    ctx.font = "bold 11px Segoe UI";
    ctx.textAlign = "center";
    ctx.fillText(tank.label, 0, 25);
  }
  ctx.restore();
}

function drawWalls(state) {
  for (const wall of state.walls) {
    const ratio = wall.hp / wall.maxHp;
    ctx.fillStyle = ratio > 0.6 ? "#c69152" : ratio > 0.25 ? "#9b673d" : "#6b472f";
    ctx.fillRect(wall.x - wall.w / 2, wall.y - wall.h / 2, wall.w, wall.h);
  }
}

function drawBase(state) {
  if (!state.base) return;
  ctx.fillStyle = state.base.hp > 2 ? "#56c4ff" : "#ff8d63";
  ctx.fillRect(state.base.x - state.base.width / 2, state.base.y - state.base.height / 2, state.base.width, state.base.height);
  ctx.fillStyle = "#0d171b";
  ctx.font = "bold 14px Segoe UI";
  ctx.textAlign = "center";
  ctx.fillText("BASE", state.base.x, state.base.y + 5);
}

function drawBullets(state) {
  for (const bullet of state.bullets) {
    ctx.beginPath();
    ctx.fillStyle = bullet.color;
    ctx.arc(bullet.x, bullet.y, bullet.radius, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawItems(state) {
  for (const item of state.items) {
    ctx.beginPath();
    ctx.fillStyle = ITEM_TYPES[item.type].color;
    ctx.arc(item.x, item.y, item.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#091117";
    ctx.font = "bold 11px Segoe UI";
    ctx.textAlign = "center";
    ctx.fillText(ITEM_TYPES[item.type].label[0], item.x, item.y + 4);
  }
}

function drawExplosions(state) {
  for (const effect of state.explosions) {
    ctx.beginPath();
    ctx.fillStyle = `rgba(${effect.color}, ${Math.max(effect.life * 2.2, 0)})`;
    ctx.arc(effect.x, effect.y, effect.size, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawHud(state) {
  const players = state.players.map((player, index) => ({ player, x: 18 + index * 220, y: 18 }));
  for (const card of players) {
    const player = card.player;
    ctx.fillStyle = "rgba(6, 15, 23, 0.62)";
    ctx.fillRect(card.x, card.y, 200, 76);
    ctx.fillStyle = player.color;
    ctx.font = "bold 16px Segoe UI";
    ctx.textAlign = "left";
    ctx.fillText(`${player.label} 战况`, card.x + 12, card.y + 22);
    ctx.fillStyle = "#edf4ef";
    ctx.font = "14px Segoe UI";
    ctx.fillText(`生命: ${state.lives[player.id]}`, card.x + 12, card.y + 46);
    const weapon = player.power ? ITEM_TYPES[player.power].label : "普通炮";
    ctx.fillText(`武器: ${weapon}`, card.x + 12, card.y + 66);
  }

  ctx.fillStyle = "rgba(6, 15, 23, 0.62)";
  ctx.fillRect(WORLD.width - 220, 18, 202, 92);
  ctx.fillStyle = "#edf4ef";
  ctx.font = "14px Segoe UI";
  ctx.fillText(
    state.mode === "versus" ? `比分: ${state.wins.player1}:${state.wins.player2}` : `基地耐久: ${state.base.hp}/${state.base.maxHp}`,
    WORLD.width - 206,
    44
  );
  ctx.fillText(
    state.mode === "versus" ? `回合: ${state.round}` : `敌军剩余: ${state.enemies.length}`,
    WORLD.width - 206,
    68
  );
  ctx.fillText(`状态: ${state.status === "paused" ? "暂停" : "战斗中"}`, WORLD.width - 206, 92);
}

function render() {
  ctx.clearRect(0, 0, WORLD.width, WORLD.height);
  if (!gameState) return;
  drawWalls(gameState);
  drawBase(gameState);
  drawItems(gameState);
  for (const player of gameState.players) drawTank(player);
  for (const enemy of gameState.enemies) drawTank(enemy);
  drawBullets(gameState);
  drawExplosions(gameState);
  drawHud(gameState);
}

function loop(timestamp) {
  if (!lastFrame) lastFrame = timestamp;
  const dt = Math.min((timestamp - lastFrame) / 1000, 0.033);
  lastFrame = timestamp;
  update(dt);
  render();
  window.requestAnimationFrame(loop);
}

document.addEventListener("keydown", (event) => {
  keys.add(event.code);
  if (event.code === "KeyP") {
    event.preventDefault();
    togglePause();
  }
  if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Enter", "Space"].includes(event.code)) {
    event.preventDefault();
  }
});

document.addEventListener("keyup", (event) => {
  keys.delete(event.code);
});

singleModeButton.addEventListener("click", () => setMode("single"));
versusModeButton.addEventListener("click", () => setMode("versus"));
startButton.addEventListener("click", resetGame);

gameState = createInitialState(selectedMode);
setMode("single");
syncStats();
window.requestAnimationFrame(loop);
