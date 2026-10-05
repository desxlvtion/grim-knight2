import { GameState } from '../core/GameState.js';
import { Battle } from '../core/Battle.js';
import { AudioManager } from '../core/AudioManager.js';
import { SaveManager } from '../core/SaveManager.js';
import { renderStatsPanel } from './StatsPanel.js';
import { renderSetsPanel } from './SetsPanel.js';

// ============================================
// Предзагрузка кадров героя
// ============================================

const HERO_IDLE_FRAME = '/assets/hero/idle.png';
const HERO_ATTACK_FRAMES = [
  '/assets/hero/attack_1.png',
  '/assets/hero/attack_2.png',
  '/assets/hero/attack_3.png',
  '/assets/hero/attack_4.png',
];
const HERO_FRAME_TIME = 100; // мс на кадр

// Кеш: url → Image. После decode() картинка в памяти, показ — мгновенный.
const HERO_IMAGES = {};

/**
 * Прогревает все кадры героя: браузер загружает и декодирует их
 * заранее. Вызывается из main.js и при входе в BattleScreen.
 */
export function preloadHeroFrames() {
  const all = [HERO_IDLE_FRAME, ...HERO_ATTACK_FRAMES];
  for (const url of all) {
    if (HERO_IMAGES[url]) continue;
    const img = new Image();
    img.src = url;
    if (img.decode) {
      img.decode().catch(() => {});
    }
    HERO_IMAGES[url] = img;
  }
}

export function BattleScreen(params, screenManager) {
  // Прогрев кадров на всякий случай (если main.js ещё не прогрел)
  preloadHeroFrames();

  const root = document.createElement('div');
  root.className = 'battle-root';

  // ============================================
  // Трёхколоночная сетка: статы | поле боя | сеты
  // ============================================
  const grid = document.createElement('div');
  grid.className = 'battle-grid';
  root.appendChild(grid);

  // Левая колонка — статы
  const statsCol = document.createElement('aside');
  statsCol.className = 'battle-col battle-col-stats';
  grid.appendChild(statsCol);

  const statsWrap = document.createElement('div');
  statsWrap.className = 'battle-stats-panel';
  statsCol.appendChild(statsWrap);

  // Центр — поле боя
  const fieldCol = document.createElement('section');
  fieldCol.className = 'battle-col battle-col-field';
  grid.appendChild(fieldCol);

  const wrap = document.createElement('div');
  wrap.className = 'battle-screen';
  fieldCol.appendChild(wrap);

  // Правая колонка — сеты
  const setsCol = document.createElement('aside');
  setsCol.className = 'battle-col battle-col-sets';
  grid.appendChild(setsCol);

  const setsWrap = document.createElement('div');
  setsWrap.className = 'battle-sets-panel';
  setsCol.appendChild(setsWrap);

  // ============================================
  // Фон поля боя
  // ============================================
  const zoneData = GameState.zonesData?.[GameState.zone];
  if (zoneData?.background) {
    wrap.style.background = `
      linear-gradient(rgba(10, 10, 12, 0.25), rgba(10, 10, 12, 0.6)),
      url('/assets/backgrounds/${zoneData.background}') center/cover no-repeat
    `;
  }

  const battle = new Battle();
  const cardMap = new Map();

  const heroWrap = document.createElement('div');
  heroWrap.className = 'hero-wrap';
  const heroSprite = document.createElement('img');
  heroSprite.className = 'hero-sprite';
  heroSprite.src = HERO_IDLE_FRAME;
  heroSprite.alt = '';
  heroWrap.appendChild(heroSprite);
  wrap.appendChild(heroWrap);

  const playerBar = document.createElement('div');
  playerBar.className = 'battle-player-bar';
  wrap.appendChild(playerBar);

  const enemiesArea = document.createElement('div');
  enemiesArea.className = 'battle-enemies';
  wrap.appendChild(enemiesArea);

  const backBtn = document.createElement('button');
  backBtn.className = 'btn btn-secondary';
  backBtn.textContent = 'Назад';
  backBtn.addEventListener('click', () => {
    AudioManager.playSfx('button_click');
    screenManager.show('inventory');
  });
  wrap.appendChild(backBtn);

  // ============================================
  // Лог боя — внизу
  // ============================================
  const logWrap = document.createElement('div');
  logWrap.className = 'battle-log';
  root.appendChild(logWrap);

  const logLines = [];
  const appendLog = (text, type = 'default') => {
    logLines.push({ text, type });
    if (logLines.length > 60) logLines.shift();
    logWrap.innerHTML = '';
    for (const line of logLines) {
      const div = document.createElement('div');
      div.className = `log-line log-line-${line.type}`;
      div.textContent = line.text;
      logWrap.appendChild(div);
    }
    logWrap.scrollTop = logWrap.scrollHeight;
  };

  // ============================================
  // Рендер статов и сетов
  // ============================================
  const renderStats = () => {
    renderStatsPanel(statsWrap);
  };

  const renderSets = () => {
    renderSetsPanel(setsWrap);
  };

  const renderPlayer = () => {
    playerBar.innerHTML = '';

    const hp = document.createElement('div');
    hp.className = 'player-hp';
    hp.textContent = `HP ${GameState.hp} / ${GameState.max_hp}`;
    playerBar.appendChild(hp);

    const armor = document.createElement('div');
    armor.className = 'player-armor';
    armor.textContent = `Броня ${GameState.armor} / ${GameState.max_armor}`;
    playerBar.appendChild(armor);

    for (const eff of GameState.effects) {
      const badge = document.createElement('span');
      badge.className = `effect-badge effect-${eff.effect}`;
      badge.textContent = `${eff.effect} ${eff.stacks}`;
      playerBar.appendChild(badge);
    }

    const potionBtn = document.createElement('button');
    potionBtn.className = 'btn btn-potion';
    potionBtn.textContent = `Зелье (${GameState.potions})`;
    potionBtn.disabled = GameState.potions <= 0;
    potionBtn.addEventListener('click', () => {
      AudioManager.playSfx('button_click');
      battle.drinkPotion();
      renderPlayer();
    });
    playerBar.appendChild(potionBtn);

    renderStats();
    renderSets();
  };

  const createEnemies = () => {
    enemiesArea.innerHTML = '';
    cardMap.clear();

    battle.enemies.forEach((enemy, index) => {
      const card = createEnemyCard(enemy, index, () => {
        if (battle.isBusy()) return;
        battle.playerAttack(index);
      });
      cardMap.set(index, card);
      enemiesArea.appendChild(card);
    });

    repositionEnemies();
    updateEnemyStats();
  };

  const repositionEnemies = () => {
    const alive = battle.enemies
      .map((e, i) => ({ e, i }))
      .filter(({ e }) => e.hp > 0);

    const total = alive.length;
    alive.forEach(({ i }, displayIndex) => {
      const card = cardMap.get(i);
      if (!card) return;
      const isBoss = battle.enemies[i].is_boss === true;
      const pos = getEnemyPosition(displayIndex, total, isBoss);
      card.style.bottom = `${pos.bottom}px`;
      card.style.right = `${pos.right}px`;
    });
  };

  const updateEnemyStats = () => {
    battle.enemies.forEach((enemy, index) => {
      const card = cardMap.get(index);
      if (!card) return;

      const hpFill = card.querySelector('.enemy-hp-fill');
      const hpText = card.querySelector('.enemy-hp-text');
      const armorText = card.querySelector('.enemy-armor');

      if (hpFill) hpFill.style.width = `${(enemy.hp / enemy.max_hp) * 100}%`;
      if (hpText) hpText.textContent = `${enemy.hp} / ${enemy.max_hp}`;
      if (armorText) armorText.textContent = `Броня ${enemy.armor}`;

      card.querySelectorAll('.effect-badge').forEach(el => el.remove());
      for (const eff of enemy.effects) {
        const badge = document.createElement('span');
        badge.className = `effect-badge effect-${eff.effect}`;
        badge.textContent = `${eff.effect} ${eff.stacks}`;
        card.appendChild(badge);
      }

      card.classList.toggle('has-poison', enemy.effects.some(e => e.effect === 'poison'));
      card.classList.toggle('has-burn', enemy.effects.some(e => e.effect === 'burn'));

      if (enemy.hp <= 0 && !card.classList.contains('dying')) {
        card.classList.add('dying');
      }
    });

    if (battle.isBusy()) {
      enemiesArea.classList.add('busy');
    } else {
      enemiesArea.classList.remove('busy');
    }
  };

  const renderEnemies = () => {
    updateEnemyStats();
    repositionEnemies();
  };

  battle.onPlayerUpdate = renderPlayer;
  battle.onEnemyUpdate = renderEnemies;

  battle.onBattleEnd = (result) => {
    appendLog(result === 'win' ? 'Победа!' : 'Поражение...', result === 'win' ? 'heal' : 'enemy-hit');
    setTimeout(() => {
      if (result === 'win') {
        if (battle.isBoss) {
          GameState.totalStages += 1;
          SaveManager.save(GameState);
          screenManager.show('chest', { bossMode: true });
        } else {
          GameState.nextStage();
          SaveManager.save(GameState);
          screenManager.show('chest');
        }
      } else {
        SaveManager.clear();
        screenManager.show('defeat');
      }
    }, 700);
  };

  battle.onEvent = (event) => {
    const card = cardMap.get(event.enemyIndex);
    const enemyNum = (event.enemyIndex ?? 0) + 1;

    if (event.type === 'player_hit' && card) {
      AudioManager.playSfx(event.isCrit ? 'crit' : 'hit');
      animateHit(card, event.damage, event.isCrit);
      animateHeroAttack();
      if (event.isCrit) {
        appendLog(`Крит! Враг ${enemyNum} получает ${event.damage}`, 'crit');
      } else {
        appendLog(`Удар по врагу ${enemyNum}: ${event.damage}`, 'hit');
      }
    }

    if (event.type === 'enemy_died' && card) {
      AudioManager.playSfx('enemy_die');
      animateDeath(card);
      appendLog(`Враг ${enemyNum} погиб`, 'enemy-die');
    }

    if (event.type === 'effect_applied' && card) {
      animateEffectApplied(card, event.effect);
      appendLog(`Враг ${enemyNum}: ${effectName(event.effect)} ×${event.stacks}`, effectName(event.effect));
    }

    if (event.type === 'enemy_effect_tick' && card) {
      if (event.effect === 'poison') AudioManager.playSfx('poison_tick');
      animateEffectTick(card, event.damage, event.effect || 'poison');
      appendLog(`Враг ${enemyNum}: ${effectName(event.effect)} -${event.damage}`, effectName(event.effect));
    }

    if (event.type === 'enemy_hit') {
      AudioManager.playSfx('enemy_hit');
      animatePlayerHit(event.damage, event.enemyIndex);
      appendLog(`Враг ${enemyNum} бьёт героя на ${event.damage}`, 'enemy-hit');
    }

    if (event.type === 'player_effect_tick') {
      if (event.effect === 'poison') AudioManager.playSfx('poison_tick');
      animatePlayerEffectTick(event.effect, event.damage);
      appendLog(`Герой: ${effectName(event.effect)} -${event.damage}`, effectName(event.effect));
    }

    if (event.type === 'potion_used') {
      AudioManager.playSfx('potion');
      animatePotion(event.heal);
      appendLog(`Зелье: +${event.heal} HP`, 'heal');
    }

    if (event.type === 'vampirism_heal') {
      AudioManager.playSfx('vampirism');
      animateVampirismHeal(event.amount);
      appendLog(`Вампиризм: +${event.amount} HP`, 'heal');
    }

    if (event.type === 'regen_tick') {
      AudioManager.playSfx('regen');
      animateRegen(event.amount);
      appendLog(`Регенерация: +${event.amount} HP`, 'heal');
    }

    if (event.type === 'burn_explosion' && card) {
      AudioManager.playSfx('burn_explosion');
      animateBurnExplosion(card, event.damage);
      appendLog(`Взрыв горения: ${event.damage}!`, 'explosion');
    }

    if (event.type === 'reflect_damage' && card) {
      AudioManager.playSfx('reflect');
      animateReflect(card, event.damage);
      appendLog(`Отражение: ${event.damage} по врагу ${enemyNum}`, 'reflect');
    }

    if (event.type === 'evade') {
      AudioManager.playSfx('evade');
      animateEvade(event.enemyIndex);
      appendLog(`Уклонение!`, 'evade');
    }
  };

  fetch(`/api/zones/${GameState.zone}/enemies?stage=${GameState.totalStages}`)
    .then(r => r.json())
    .then(data => {
      battle.start(data.enemies);
      battle.isBoss = data.is_boss === true;

      if (data.is_boss) {
        appendLog(`БОСС: впереди сильный враг`, 'system');
      } else {
        appendLog(`Бой начался (врагов: ${data.enemies.length})`, 'system');
      }

      renderPlayer();
      createEnemies();
    })
    .catch(err => console.error(err));

  return root;
}

function effectName(effect) {
  const map = {
    poison: 'яд',
    burn: 'горение',
    bleed: 'кровотечение',
  };
  return map[effect] || effect;
}

function getEnemyPosition(index, total, isBoss = false) {
  if (isBoss) {
    return { bottom: 260, right: 200 };
  }

  const layouts = {
    1: [{ bottom: 190, right: 300 }],
    2: [
      { bottom: 220, right: 400 },
      { bottom: 190, right: 200 },
    ],
    3: [
      { bottom: 220, right: 460 },
      { bottom: 190, right: 280 },
      { bottom: 205, right: 120 },
    ],
  };
  const layout = layouts[total] || layouts[3];
  return layout[index] || layout[layout.length - 1];
}

function createEnemyCard(enemy, index, onClick) {
  const card = document.createElement('div');
  card.className = 'enemy-card';
  if (enemy.is_boss) {
    card.classList.add('enemy-boss');
  }
  card.dataset.enemyIndex = index;

  const sprite = document.createElement('img');
  sprite.className = 'enemy-sprite';
  sprite.src = `/assets/enemies/${enemy.sprite}`;
  sprite.alt = '';
  card.appendChild(sprite);

  const hpBar = document.createElement('div');
  hpBar.className = 'enemy-hp-bar';
  const hpFill = document.createElement('div');
  hpFill.className = 'enemy-hp-fill';
  hpFill.style.width = '100%';
  hpBar.appendChild(hpFill);
  card.appendChild(hpBar);

  const hpText = document.createElement('div');
  hpText.className = 'enemy-hp-text';
  hpText.textContent = `${enemy.hp} / ${enemy.max_hp}`;
  card.appendChild(hpText);

  if (enemy.armor > 0) {
    const armorText = document.createElement('div');
    armorText.className = 'enemy-armor';
    armorText.textContent = `Броня ${enemy.armor}`;
    card.appendChild(armorText);
  }

  const dmgText = document.createElement('div');
  dmgText.className = 'enemy-damage';
  dmgText.textContent = `Урон ${enemy.damage}`;
  card.appendChild(dmgText);

  card.addEventListener('click', onClick);
  return card;
}

function animateHit(card, damage, isCrit) {
  card.classList.add('hit');
  setTimeout(() => card.classList.remove('hit'), 350);

  const popup = document.createElement('div');
  popup.className = 'damage-popup' + (isCrit ? ' damage-popup-crit' : '');
  popup.textContent = `-${damage}` + (isCrit ? ' КРИТ' : '');
  card.appendChild(popup);
  setTimeout(() => popup.remove(), 800);
}

function animateDeath(card) {
  card.classList.add('dying');
}

function animateEffectApplied(card, effect) {
  const burst = document.createElement('div');
  burst.className = `effect-burst effect-burst-${effect}`;
  card.appendChild(burst);
  setTimeout(() => burst.remove(), 700);
}

function animateEffectTick(card, damage, effect = 'poison') {
  const popup = document.createElement('div');
  popup.className = `damage-popup damage-popup-${effect}`;
  popup.textContent = `-${damage}`;
  card.appendChild(popup);
  setTimeout(() => popup.remove(), 800);

  card.classList.add(`effect-tick-${effect}`);
  setTimeout(() => card.classList.remove(`effect-tick-${effect}`), 400);
}

function animatePlayerHit(damage, enemyIndex) {
  const screen = document.querySelector('.battle-screen');
  if (!screen) return;

  screen.classList.add('player-hurt');
  setTimeout(() => screen.classList.remove('player-hurt'), 250);

  const playerBar = screen.querySelector('.battle-player-bar');
  if (playerBar) {
    const popup = document.createElement('div');
    popup.className = 'damage-popup damage-popup-player';
    popup.textContent = `-${damage}`;
    playerBar.appendChild(popup);
    setTimeout(() => popup.remove(), 800);
  }

  const card = screen.querySelector(`.enemy-card[data-enemy-index="${enemyIndex}"]`);
  if (card) {
    card.classList.remove('attacking');
    void card.offsetWidth;
    card.classList.add('attacking');
    setTimeout(() => card.classList.remove('attacking'), 500);

    const slash = document.createElement('div');
    slash.className = 'slash';
    slash.textContent = '(';
    card.appendChild(slash);
    setTimeout(() => slash.remove(), 450);
  }
}

function animatePlayerEffectTick(effect, damage) {
  const playerBar = document.querySelector('.battle-player-bar');
  if (!playerBar) return;

  const popup = document.createElement('div');
  popup.className = `damage-popup damage-popup-${effect}`;
  popup.textContent = `-${damage}`;
  playerBar.appendChild(popup);
  setTimeout(() => popup.remove(), 800);
}

function animatePotion(heal) {
  const playerBar = document.querySelector('.battle-player-bar');
  if (!playerBar) return;

  playerBar.classList.add('potion-used');
  setTimeout(() => playerBar.classList.remove('potion-used'), 500);

  const popup = document.createElement('div');
  popup.className = 'damage-popup damage-popup-heal';
  popup.textContent = `+${heal}`;
  playerBar.appendChild(popup);
  setTimeout(() => popup.remove(), 800);
}

function animateVampirismHeal(amount) {
  const playerBar = document.querySelector('.battle-player-bar');
  if (!playerBar) return;

  const popup = document.createElement('div');
  popup.className = 'damage-popup damage-popup-vampirism';
  popup.textContent = `+${amount}`;
  playerBar.appendChild(popup);
  setTimeout(() => popup.remove(), 800);
}

function animateRegen(amount) {
  const playerBar = document.querySelector('.battle-player-bar');
  if (!playerBar) return;

  const popup = document.createElement('div');
  popup.className = 'damage-popup damage-popup-regen';
  popup.textContent = `+${amount}`;
  playerBar.appendChild(popup);
  setTimeout(() => popup.remove(), 800);
}

function animateBurnExplosion(card, damage) {
  card.classList.add('burn-explosion');
  setTimeout(() => card.classList.remove('burn-explosion'), 700);

  const popup = document.createElement('div');
  popup.className = 'damage-popup damage-popup-burn-explosion';
  popup.textContent = `-${damage} ВЗРЫВ`;
  card.appendChild(popup);
  setTimeout(() => popup.remove(), 1000);
}

function animateReflect(card, damage) {
  const popup = document.createElement('div');
  popup.className = 'damage-popup damage-popup-reflect';
  popup.textContent = `⟲${damage}`;
  card.appendChild(popup);
  setTimeout(() => popup.remove(), 800);

  card.classList.add('reflect-flash');
  setTimeout(() => card.classList.remove('reflect-flash'), 400);
}

function animateEvade(enemyIndex) {
  const screen = document.querySelector('.battle-screen');
  if (!screen) return;

  const playerBar = screen.querySelector('.battle-player-bar');
  if (!playerBar) return;

  const popup = document.createElement('div');
  popup.className = 'damage-popup damage-popup-evade';
  popup.textContent = 'УКЛОН';
  playerBar.appendChild(popup);
  setTimeout(() => popup.remove(), 800);
}

// ============================================
// Анимация атаки героя (покадровая, из кеша)
// ============================================

function animateHeroAttack() {
  const hero = document.querySelector('.hero-sprite');
  if (!hero) return;

  // Прерываем предыдущую анимацию
  if (hero._attackTimer) {
    clearTimeout(hero._attackTimer);
    hero._attackTimer = null;
  }

  // Гарантируем, что все кадры прогреты
  preloadHeroFrames();

  let frame = 0;

  const nextFrame = () => {
    if (frame >= HERO_ATTACK_FRAMES.length) {
      hero.src = HERO_IDLE_FRAME;
      hero.classList.remove('attacking');
      hero._attackTimer = null;
      return;
    }
    hero.src = HERO_ATTACK_FRAMES[frame];
    frame++;
    hero._attackTimer = setTimeout(nextFrame, HERO_FRAME_TIME);
  };

  hero.classList.add('attacking');
  nextFrame();
}