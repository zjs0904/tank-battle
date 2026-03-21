const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const overlay = document.getElementById("overlay");
const overlayTitle = document.getElementById("overlayTitle");
const overlayText = document.getElementById("overlayText");
const startButton = document.getElementById("startButton");

const statEls = {
  score: document.getElementById("score"),
  lives: document.getElementById("lives"),
  level: document.getElementById("level"),
  enemies: document.getElementById("enemies")
};

const WORLD = {
  width: canvas.width,
  height: canvas.height,
  tile: 30
};

const DIRECTIONS = {
  up: { x: 0, y: -1, angle: -Math.PI / 2 },
  down: { x: 0, y: 1, angle: Math.PI / 2 },
  left: { x: -1, y: 0, angle: Math.PI },
  right: { x: 1, y: 0, angle: 0 }
};

const keys = new Set();
let gameState = null;
let lastFrame = 0;

class Tank {
  constructor(config) {
    this.x = config.x;
    this.y = config.y;
    this.width = config.width || 34;
    this.height = config.height || 34;
    this.speed = config.speed;
    this.direction = config.direction || "up";
    this.color = config.color;
    this.type = config.type;
    this.cooldown = 0;
    this.hp = config.hp || 1;
    this.maxHp = this.hp;
    this.aiTimer = 0;
    this.fireTimer = randomBetween(0.8, 1.8);
    this.shield = 0;
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

function createInitialState() {
  const state = {
    score: 0,
    level: 1,
    lives: 3,
    status: "idle",
    message: "按下开始按钮",
    bullets: [],
    enemies: [],
    explosions: [],
    walls: createWalls(),
    base: { x: WORLD.width / 2, y: WORLD.height - 32, width: 70, height: 26, hp: 5, maxHp: 5 },
    player: createPlayer(),
    shieldCharges: 1,
    shieldCooldown: 0,
    invulnerableTime: 0
  };

  spawnEnemyWave(state);
  return state;
}

function createPlayer() {
  return new Tank({
    x: WORLD.width / 2,
    y: WORLD.height - 80,
    speed: 210,
    direction: "up",
    color: "#7ddf64",
    type: "player",
    hp: 3
  });
}

function createWalls() {
  const walls = [];
  const templates = [
    { x: 180, y: 160, w: 120, h: 30 },
    { x: 720, y: 160, w: 120, h: 30 },
    { x: 300, y: 290, w: 30, h: 120 },
    { x: 600, y: 290, w: 30, h: 120 },
    { x: 450, y: 180, w: 150, h: 30 },
    { x: 450, y: 420, w: 180, h: 30 },
    { x: 180, y: 420, w: 120, h: 30 },
    { x: 720, y: 420, w: 120, h: 30 }
  ];

  for (const item of templates) {
    walls.push({ ...item, hp: 4, maxHp: 4 });
  }
  return walls;
}

function spawnEnemyWave(state) {
  const count = Math.min(4 + state.level, 10);
  const spawnPoints = [90, 250, 450, 650, 810];

  state.enemies = Array.from({ length: count }, (_, index) => {
    const lane = spawnPoints[index % spawnPoints.length];
    return new Tank({
      x: lane,
      y: 70 + Math.floor(index / spawnPoints.length) * 60,
      speed: 85 + state.level * 12,
      direction: "down",
      color: "#ff6b57",
      type: "enemy",
      hp: 1 + Math.floor((state.level - 1) / 2)
    });
  });
}

function setOverlay(title, text, visible) {
  overlayTitle.textContent = title;
  overlayText.textContent = text;
  overlay.classList.toggle("hidden", !visible);
}

function resetGame() {
  gameState = createInitialState();
  gameState.status = "running";
  setOverlay("战斗开始", "摧毁所有敌军并保护基地。", false);
  syncStats();
}

function syncStats() {
  statEls.score.textContent = String(gameState.score);
  statEls.lives.textContent = String(gameState.lives);
  statEls.level.textContent = String(gameState.level);
  statEls.enemies.textContent = String(gameState.enemies.length);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function randomBetween(min, max) {
  return Math.random() * (max - min) + min;
}

function rectsOverlap(a, b) {
  return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
}

function moveTank(tank, dt, state, intentX, intentY) {
  if (intentX === 0 && intentY === 0) {
    return;
  }

  const length = Math.hypot(intentX, intentY) || 1;
  const velocityX = (intentX / length) * tank.speed * dt;
  const velocityY = (intentY / length) * tank.speed * dt;

  if (Math.abs(intentX) > Math.abs(intentY)) {
    tank.direction = intentX > 0 ? "right" : "left";
  } else {
    tank.direction = intentY > 0 ? "down" : "up";
  }

  const originalX = tank.x;
  const originalY = tank.y;

  tank.x = clamp(tank.x + velocityX, tank.width / 2, WORLD.width - tank.width / 2);
  if (hitsObstacle(tank, state)) {
    tank.x = originalX;
  }

  tank.y = clamp(tank.y + velocityY, tank.height / 2, WORLD.height - tank.height / 2);
  if (hitsObstacle(tank, state)) {
    tank.y = originalY;
  }
}

function hitsObstacle(tank, state) {
  const bounds = tank.bounds;
  const baseBounds = {
    left: state.base.x - state.base.width / 2,
    right: state.base.x + state.base.width / 2,
    top: state.base.y - state.base.height / 2,
    bottom: state.base.y + state.base.height / 2
  };

  if (rectsOverlap(bounds, baseBounds) && tank.type !== "player") {
    return true;
  }

  for (const wall of state.walls) {
    if (wall.hp <= 0) {
      continue;
    }
    const wallBounds = {
      left: wall.x - wall.w / 2,
      right: wall.x + wall.w / 2,
      top: wall.y - wall.h / 2,
      bottom: wall.y + wall.h / 2
    };
    if (rectsOverlap(bounds, wallBounds)) {
      return true;
    }
  }

  const tanks = [state.player, ...state.enemies];
  for (const other of tanks) {
    if (other === tank || other.hp <= 0) {
      continue;
    }
    if (rectsOverlap(bounds, other.bounds)) {
      return true;
    }
  }

  return false;
}

function shoot(tank, state) {
  if (tank.cooldown > 0) {
    return;
  }

  const dir = DIRECTIONS[tank.direction];
  const bulletSpeed = tank.type === "player" ? 360 : 250 + state.level * 8;
  state.bullets.push({
    x: tank.x + dir.x * 24,
    y: tank.y + dir.y * 24,
    vx: dir.x * bulletSpeed,
    vy: dir.y * bulletSpeed,
    radius: 5,
    owner: tank.type,
    damage: 1
  });
  tank.cooldown = tank.type === "player" ? 0.28 : randomBetween(0.9, 1.6);
}

function updatePlayer(dt, state) {
  const player = state.player;

  if (player.hp <= 0) {
    return;
  }

  let intentX = 0;
  let intentY = 0;

  if (keys.has("KeyA")) intentX -= 1;
  if (keys.has("KeyD")) intentX += 1;
  if (keys.has("KeyW")) intentY -= 1;
  if (keys.has("KeyS")) intentY += 1;

  moveTank(player, dt, state, intentX, intentY);

  if (keys.has("KeyJ")) {
    shoot(player, state);
  }
}

function updateEnemies(dt, state) {
  for (const enemy of state.enemies) {
    if (enemy.hp <= 0) {
      continue;
    }

    enemy.aiTimer -= dt;
    enemy.fireTimer -= dt;

    if (enemy.aiTimer <= 0) {
      const options = ["up", "down", "left", "right"];
      const playerDx = state.player.x - enemy.x;
      const playerDy = state.player.y - enemy.y;
      const preferVertical = Math.abs(playerDy) > Math.abs(playerDx);

      if (Math.random() > 0.35) {
        enemy.direction = preferVertical
          ? playerDy > 0 ? "down" : "up"
          : playerDx > 0 ? "right" : "left";
      } else {
        enemy.direction = options[Math.floor(Math.random() * options.length)];
      }

      enemy.aiTimer = randomBetween(0.6, 1.3);
    }

    const dir = DIRECTIONS[enemy.direction];
    moveTank(enemy, dt, state, dir.x, dir.y);

    if (enemy.fireTimer <= 0) {
      const alignedX = Math.abs(enemy.x - state.player.x) < 26;
      const alignedY = Math.abs(enemy.y - state.player.y) < 26;
      if (alignedX || alignedY || Math.random() > 0.45) {
        shoot(enemy, state);
      }
      enemy.fireTimer = randomBetween(1, 2);
    }
  }
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

    if (collideBulletWithWalls(bullet, state)) {
      return false;
    }

    if (collideBulletWithBase(bullet, state)) {
      return false;
    }

    if (collideBulletWithTanks(bullet, state)) {
      return false;
    }

    return true;
  });
}

function collideBulletWithWalls(bullet, state) {
  for (const wall of state.walls) {
    if (wall.hp <= 0) {
      continue;
    }
    if (
      bullet.x > wall.x - wall.w / 2 &&
      bullet.x < wall.x + wall.w / 2 &&
      bullet.y > wall.y - wall.h / 2 &&
      bullet.y < wall.y + wall.h / 2
    ) {
      wall.hp -= 1;
      state.explosions.push({ x: bullet.x, y: bullet.y, life: 0.24, size: 18 });
      return true;
    }
  }
  return false;
}

function collideBulletWithBase(bullet, state) {
  if (
    bullet.x > state.base.x - state.base.width / 2 &&
    bullet.x < state.base.x + state.base.width / 2 &&
    bullet.y > state.base.y - state.base.height / 2 &&
    bullet.y < state.base.y + state.base.height / 2
  ) {
    if (bullet.owner === "enemy") {
      state.base.hp -= 1;
      state.explosions.push({ x: state.base.x, y: state.base.y, life: 0.35, size: 28 });
      if (state.base.hp <= 0) {
        endGame("基地被摧毁", "这次防线失守了，点击按钮重新开战。");
      }
    }
    return true;
  }
  return false;
}

function collideBulletWithTanks(bullet, state) {
  const targets = bullet.owner === "player" ? state.enemies : [state.player];

  for (const tank of targets) {
    if (tank.hp <= 0) {
      continue;
    }

    const bounds = tank.bounds;
    const hit =
      bullet.x > bounds.left &&
      bullet.x < bounds.right &&
      bullet.y > bounds.top &&
      bullet.y < bounds.bottom;

    if (!hit) {
      continue;
    }

    if (tank.type === "player" && (tank.shield > 0 || state.invulnerableTime > 0)) {
      state.explosions.push({ x: bullet.x, y: bullet.y, life: 0.16, size: 16 });
      return true;
    }

    tank.hp -= bullet.damage;
    state.explosions.push({ x: bullet.x, y: bullet.y, life: 0.25, size: 24 });

    if (tank.hp <= 0) {
      if (tank.type === "enemy") {
        state.score += 100;
      } else {
        state.lives -= 1;
        if (state.lives <= 0) {
          endGame("全军覆没", "你的坦克已经被击毁，点击按钮重新开始。");
        } else {
          respawnPlayer(state);
        }
      }
    }

    return true;
  }

  return false;
}

function respawnPlayer(state) {
  state.player = createPlayer();
  state.invulnerableTime = 2;
}

function updateEffects(dt, state) {
  state.explosions = state.explosions.filter((effect) => {
    effect.life -= dt;
    effect.size += dt * 30;
    return effect.life > 0;
  });

  state.player.cooldown = Math.max(0, state.player.cooldown - dt);
  state.player.shield = Math.max(0, state.player.shield - dt);
  state.shieldCooldown = Math.max(0, state.shieldCooldown - dt);
  state.invulnerableTime = Math.max(0, state.invulnerableTime - dt);

  for (const enemy of state.enemies) {
    enemy.cooldown = Math.max(0, enemy.cooldown - dt);
  }
}

function useShield(state) {
  if (state.shieldCooldown > 0 || state.player.hp <= 0) {
    return;
  }
  state.player.shield = 3.2;
  state.shieldCooldown = 8;
}

function cleanupState(state) {
  state.walls = state.walls.filter((wall) => wall.hp > 0);
  state.enemies = state.enemies.filter((enemy) => enemy.hp > 0);

  if (state.status === "running" && state.enemies.length === 0) {
    state.level += 1;
    state.walls = createWalls();
    state.base.hp = Math.min(state.base.maxHp, state.base.hp + 1);
    spawnEnemyWave(state);
    setOverlay(`第 ${state.level} 关`, "敌军增援已抵达。", true);
    window.setTimeout(() => {
      if (gameState && gameState.status === "running") {
        setOverlay("", "", false);
      }
    }, 900);
  }
}

function endGame(title, text) {
  if (!gameState || gameState.status === "ended") {
    return;
  }
  gameState.status = "ended";
  setOverlay(title, text, true);
}

function togglePause() {
  if (!gameState || gameState.status === "idle" || gameState.status === "ended") {
    return;
  }

  if (gameState.status === "paused") {
    gameState.status = "running";
    setOverlay("", "", false);
  } else {
    gameState.status = "paused";
    setOverlay("已暂停", "按 P 继续战斗。", true);
  }
}

function update(dt) {
  if (!gameState || gameState.status !== "running") {
    return;
  }

  updatePlayer(dt, gameState);
  updateEnemies(dt, gameState);
  updateBullets(dt, gameState);
  updateEffects(dt, gameState);
  cleanupState(gameState);
  syncStats();
}

function drawTank(tank) {
  ctx.save();
  ctx.translate(tank.x, tank.y);
  ctx.rotate(DIRECTIONS[tank.direction].angle);

  ctx.fillStyle = tank.color;
  ctx.fillRect(-tank.width / 2, -tank.height / 2, tank.width, tank.height);
  ctx.fillRect(-tank.width / 2 - 6, -tank.height / 2, 6, tank.height);
  ctx.fillRect(tank.width / 2, -tank.height / 2, 6, tank.height);

  ctx.fillStyle = "#1f2a2f";
  ctx.fillRect(-9, -9, 18, 18);
  ctx.fillRect(0, -4, tank.width / 2 + 12, 8);

  if (tank.type === "player" && tank.shield > 0) {
    ctx.strokeStyle = "rgba(125, 223, 100, 0.85)";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(0, 0, tank.width, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.restore();
}

function drawWalls(state) {
  for (const wall of state.walls) {
    const ratio = wall.hp / wall.maxHp;
    ctx.fillStyle = ratio > 0.5 ? "#c28b4f" : "#8f5b34";
    ctx.fillRect(wall.x - wall.w / 2, wall.y - wall.h / 2, wall.w, wall.h);
    ctx.strokeStyle = "rgba(0, 0, 0, 0.18)";
    ctx.strokeRect(wall.x - wall.w / 2, wall.y - wall.h / 2, wall.w, wall.h);
  }
}

function drawBase(state) {
  ctx.fillStyle = state.base.hp > 2 ? "#4db6ff" : "#ff8a65";
  ctx.fillRect(
    state.base.x - state.base.width / 2,
    state.base.y - state.base.height / 2,
    state.base.width,
    state.base.height
  );

  ctx.fillStyle = "#0e1a1f";
  ctx.font = "bold 14px Segoe UI";
  ctx.textAlign = "center";
  ctx.fillText("BASE", state.base.x, state.base.y + 5);
}

function drawBullets(state) {
  for (const bullet of state.bullets) {
    ctx.beginPath();
    ctx.fillStyle = bullet.owner === "player" ? "#f9f871" : "#ffd166";
    ctx.arc(bullet.x, bullet.y, bullet.radius, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawExplosions(state) {
  for (const effect of state.explosions) {
    ctx.beginPath();
    ctx.fillStyle = `rgba(255, 196, 87, ${Math.max(effect.life * 2.4, 0)})`;
    ctx.arc(effect.x, effect.y, effect.size, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawHud(state) {
  ctx.fillStyle = "rgba(8, 16, 20, 0.55)";
  ctx.fillRect(18, 14, 210, 78);

  ctx.fillStyle = "#f5f1e8";
  ctx.font = "16px Segoe UI";
  ctx.textAlign = "left";
  ctx.fillText(`基地耐久: ${state.base.hp}/${state.base.maxHp}`, 30, 40);
  ctx.fillText(`护盾冷却: ${state.shieldCooldown > 0 ? state.shieldCooldown.toFixed(1) + "s" : "就绪"}`, 30, 66);
  ctx.fillText(`状态: ${state.status === "paused" ? "暂停" : "战斗中"}`, 30, 92);
}

function render() {
  ctx.clearRect(0, 0, WORLD.width, WORLD.height);

  if (!gameState) {
    return;
  }

  drawWalls(gameState);
  drawBase(gameState);
  drawTank(gameState.player);
  for (const enemy of gameState.enemies) {
    drawTank(enemy);
  }
  drawBullets(gameState);
  drawExplosions(gameState);
  drawHud(gameState);
}

function loop(timestamp) {
  if (!lastFrame) {
    lastFrame = timestamp;
  }

  const dt = Math.min((timestamp - lastFrame) / 1000, 0.033);
  lastFrame = timestamp;

  update(dt);
  render();
  window.requestAnimationFrame(loop);
}

document.addEventListener("keydown", (event) => {
  keys.add(event.code);

  if (event.code === "KeyP") {
    togglePause();
  }

  if (event.code === "KeyK" && gameState) {
    useShield(gameState);
  }
});

document.addEventListener("keyup", (event) => {
  keys.delete(event.code);
});

startButton.addEventListener("click", resetGame);

gameState = createInitialState();
setOverlay("按下开始按钮", "准备好后进入战场。", true);
syncStats();
window.requestAnimationFrame(loop);
