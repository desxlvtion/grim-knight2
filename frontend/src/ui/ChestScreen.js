import { GameState } from '../core/GameState.js';
import { Item } from '../core/Item.js';
import { AudioManager } from '../core/AudioManager.js';
import { SaveManager } from '../core/SaveManager.js';

const RARITY_NAMES = {
  common:    'Обычный',
  uncommon:  'Необычный',
  rare:      'Редкий',
  epic:      'Эпический',
  legendary: 'Легендарный',
  mythic:    'Мифический',
};

const MYTHIC_DROP_CHANCE = 0.005;       // 0.5% в обычном сундуке
const MYTHIC_BOSS_DROP_CHANCE = 0.05;   // 5% в босс-сундуке
const MYTHIC_MIN_STAGE = 40;

const POTION_CHANCE = 0.3;
const MAX_POTIONS = 3;

function getIconNum(item) {
  if (item.slot === 'hand') {
    return item.hand_type === 'shield' ? 2 : 1;
  }
  const map = { helmet: 3, armor: 4, legs: 5, ring: 6, amulet: 7 };
  return map[item.slot] || 1;
}

function getRarityWeights(stage, bossMode = false) {
  // ============================================
  // БОСС-СУНДУК — ступенчато
  // ============================================
  if (bossMode) {
    if (stage <= 20) return { common: 0, uncommon: 0, rare: 0.7,  epic: 0.25, legendary: 0.05 };
    if (stage <= 40) return { common: 0, uncommon: 0, rare: 0.5,  epic: 0.4,  legendary: 0.10 };
    if (stage <= 60) return { common: 0, uncommon: 0, rare: 0.35, epic: 0.45, legendary: 0.20 };
    if (stage <= 80) return { common: 0, uncommon: 0, rare: 0.25, epic: 0.45, legendary: 0.30 };
    return              { common: 0, uncommon: 0, rare: 0.15, epic: 0.4,  legendary: 0.45 };
  }

  // ============================================
  // ОБЫЧНЫЙ СУНДУК — плавная интерполяция
  //
  // t = 0  → этап 15
  // t = 1  → этап 80
  // ============================================
if (stage <= 15) return { common: 0.9, uncommon: 0.1, rare: 0, epic: 0, legendary: 0 };
if (stage <= 30) return { common: 0.75, uncommon: 0.22, rare: 0.03, epic: 0, legendary: 0 };

const t = Math.min(1, Math.max(0, (stage - 30) / 50));

const base   = { common: 0.6, uncommon: 0.3, rare: 0.08, epic: 0.02, legendary: 0.0 };
const target = { common: 0.0, uncommon: 0.05, rare: 0.30, epic: 0.30, legendary: 0.35 };

  const common    = base.common    + (target.common    - base.common)    * t;
  const uncommon  = base.uncommon  + (target.uncommon  - base.uncommon)  * t;
  const rare      = base.rare      + (target.rare      - base.rare)      * t;
  const epic      = base.epic      + (target.epic      - base.epic)      * t;
  const legendary = base.legendary + (target.legendary - base.legendary) * t;

  const total = common + uncommon + rare + epic + legendary;
  return {
    common:    common    / total,
    uncommon:  uncommon  / total,
    rare:      rare      / total,
    epic:      epic      / total,
    legendary: legendary / total,
  };
}

function pickRarity(stage, bossMode) {
  const weights = getRarityWeights(stage, bossMode);
  const total = weights.common + weights.uncommon + weights.rare + weights.epic + weights.legendary;
  const r = Math.random() * total;
  let acc = 0;
  if (r < (acc += weights.common)) return 'common';
  if (r < (acc += weights.uncommon)) return 'uncommon';
  if (r < (acc += weights.rare)) return 'rare';
  if (r < (acc += weights.epic)) return 'epic';
  return 'legendary';
}

function pickRandomItem(stage, excludedIds, bossMode) {
  const rarity = pickRarity(stage, bossMode);
  let pool = Object.values(GameState.itemsData).filter(
    i => i.rarity === rarity && !excludedIds.includes(i.id)
  );

  if (pool.length === 0) {
    pool = Object.values(GameState.itemsData).filter(
      i => !excludedIds.includes(i.id) && i.rarity !== 'mythic'
    );
  }

  if (pool.length === 0) return null;
  return pool[Math.floor(Math.random() * pool.length)];
}

function pickRandomMythic(excludedIds = []) {
  const pool = Object.values(GameState.itemsData).filter(
    i => i.rarity === 'mythic' && !excludedIds.includes(i.id)
  );
  if (pool.length === 0) return null;
  return pool[Math.floor(Math.random() * pool.length)];
}

function buildCards(stage, bossMode) {
  const cards = [];

  const canTakePotion = GameState.potions < MAX_POTIONS;
  const wantPotion = !bossMode && Math.random() < POTION_CHANCE;
  const hasPotion = wantPotion && canTakePotion;

  const potionIndex = hasPotion ? Math.floor(Math.random() * 3) : -1;

  // Определяем, будет ли выпадать mythic в этом сундуке
  let mythicIndex = -1;
  if (stage >= MYTHIC_MIN_STAGE) {
    const chance = bossMode ? MYTHIC_BOSS_DROP_CHANCE : MYTHIC_DROP_CHANCE;
    if (Math.random() < chance) {
      mythicIndex = Math.floor(Math.random() * 3);
      if (mythicIndex === potionIndex) {
        mythicIndex = (mythicIndex + 1) % 3;
      }
    }
  }

  const usedIds = [];
  for (let i = 0; i < 3; i++) {
    if (i === potionIndex) {
      cards.push({ type: 'potion' });
      continue;
    }

    if (i === mythicIndex) {
      const mythic = pickRandomMythic(usedIds);
      if (mythic) {
        usedIds.push(mythic.id);
        cards.push({ type: 'item', item: mythic });
        continue;
      }
    }

    const item = pickRandomItem(stage, usedIds, bossMode);
    if (item) {
      usedIds.push(item.id);
      cards.push({ type: 'item', item });
    } else {
      if (GameState.potions < MAX_POTIONS && !cards.some(c => c.type === 'potion')) {
        cards.push({ type: 'potion' });
      } else {
        cards.push({ type: 'empty' });
      }
    }
  }

  return cards;
}

export function ChestScreen(params, screenManager) {
  const bossMode = params?.bossMode === true;

  const wrap = document.createElement('div');
  wrap.className = 'chest-screen';

  const title = document.createElement('h2');
  title.className = 'chest-title';
  title.textContent = bossMode ? 'Сокровищница босса' : 'Сундук';
  wrap.appendChild(title);

  const subtitle = document.createElement('div');
  subtitle.className = 'chest-subtitle';
  subtitle.textContent = bossMode ? 'Выбери редкий предмет' : 'Выбери награду';
  wrap.appendChild(subtitle);

  AudioManager.playSfx('chest_open');

  const cards = buildCards(GameState.totalStages, bossMode);

  const cardsWrap = document.createElement('div');
  cardsWrap.className = 'chest-cards';
  wrap.appendChild(cardsWrap);

  const finish = (card) => {
    if (card.type === 'potion' || card.type === 'item') {
      AudioManager.playSfx('item_take');
    }

    if (card.type === 'potion') {
      GameState.potions = Math.min(MAX_POTIONS, GameState.potions + 1);
    } else if (card.type === 'item') {
      GameState.inventory.push(new Item(card.item, 1));
    }

    SaveManager.save(GameState);

    if (bossMode) {
      screenManager.show('boss_reward');
      return;
    }

    if (GameState.stage % 5 === 0 && GameState.stage % 20 !== 0) {
      screenManager.show('sanctuary');
      return;
    }

    screenManager.show('inventory');
  };

  for (const card of cards) {
    const cardEl = document.createElement('div');
    cardEl.className = 'chest-card';

    if (card.type === 'potion') {
      cardEl.classList.add('chest-potion');
      const name = document.createElement('div');
      name.className = 'chest-card-name';
      name.textContent = 'Зелье лечения';
      cardEl.appendChild(name);
      const desc = document.createElement('div');
      desc.className = 'chest-card-desc';
      desc.textContent = '+1 заряд зелья. Восстанавливает 30% HP в бою.';
      cardEl.appendChild(desc);
    } else if (card.type === 'empty') {
      cardEl.classList.add('chest-empty');
      const name = document.createElement('div');
      name.className = 'chest-card-name';
      name.textContent = 'Пусто';
      cardEl.appendChild(name);
      const desc = document.createElement('div');
      desc.className = 'chest-card-desc';
      desc.textContent = 'Ничего не найдено.';
      cardEl.appendChild(desc);
    } else {
      cardEl.classList.add(`rarity-${card.item.rarity || 'common'}`);

      // Иконка
      const icon = document.createElement('img');
      icon.className = 'chest-card-icon';
      icon.src = card.item.rarity === 'mythic'
        ? `/assets/items/mythic/${card.item.id}.png`
        : `/assets/items/${card.item.set}/${getIconNum(card.item)}.png`;
      icon.alt = card.item.name;
      icon.onerror = () => { icon.style.display = 'none'; };
      cardEl.appendChild(icon);

      const name = document.createElement('div');
      name.className = 'chest-card-name';
      name.textContent = card.item.name;
      cardEl.appendChild(name);

      const meta = document.createElement('div');
      meta.className = 'chest-card-meta';

      const raritySpan = document.createElement('span');
      raritySpan.textContent = RARITY_NAMES[card.item.rarity] || 'Обычный';
      meta.appendChild(raritySpan);

      meta.appendChild(document.createTextNode(' · '));

      if (card.item.set) {
        const setIcon = document.createElement('img');
        setIcon.className = 'set-icon-small';
        setIcon.src = card.item.set.startsWith('mythic_')
          ? `/assets/items/mythic/${card.item.set}.png`
          : `/assets/sets/${card.item.set}.png`;
        setIcon.alt = card.item.set_name || card.item.set;
        setIcon.title = card.item.set_name || card.item.set;
        setIcon.onerror = () => setIcon.remove();
        meta.appendChild(setIcon);
        meta.appendChild(document.createTextNode(' ' + (card.item.set_name || card.item.set)));
      } else {
        meta.appendChild(document.createTextNode('Без сета'));
      }

      cardEl.appendChild(meta);

      if (card.item.description) {
        const desc = document.createElement('div');
        desc.className = 'chest-card-desc';
        desc.textContent = card.item.description;
        cardEl.appendChild(desc);
      }

      const stats = document.createElement('div');
      stats.className = 'chest-card-stats';
      for (const [k, v] of Object.entries(card.item.base_stats || {})) {
        const badge = document.createElement('span');
        badge.className = 'stat-badge';
        badge.textContent = `${translateStat(k)} +${v}`;
        stats.appendChild(badge);
      }
      for (const eff of card.item.base_effects || []) {
        const badge = document.createElement('span');
        badge.className = 'stat-badge';
        badge.textContent = `${translateEffect(eff.effect)} ×${eff.stacks}`;
        stats.appendChild(badge);
      }
      cardEl.appendChild(stats);
    }

    if (card.type !== 'empty') {
      const takeBtn = document.createElement('button');
      takeBtn.className = 'btn btn-primary';
      takeBtn.textContent = 'Взять';
      takeBtn.addEventListener('click', () => finish(card));
      cardEl.appendChild(takeBtn);
    }

    cardsWrap.appendChild(cardEl);
  }

  const skipBtn = document.createElement('button');
  skipBtn.className = 'btn btn-secondary';
  skipBtn.textContent = 'Пропустить';
  skipBtn.addEventListener('click', () => finish({ type: 'empty' }));
  wrap.appendChild(skipBtn);

  return wrap;
}

function translateStat(stat) {
  const map = {
    damage: 'Урон', speed: 'Скорость', armor: 'Броня',
    max_hp: 'HP', resist: 'Сопр.', crit_chance: 'Крит',
    crit_damage: 'Крит. урон',
    vampirism: 'Вампиризм', reflect: 'Отражение',
    regen: 'Регенерация', evasion: 'Уклонение',
  };
  return map[stat] || stat;
}

function translateEffect(effect) {
  const map = {
    poison: 'Яд', burn: 'Горение', bleed: 'Кровотечение',
  };
  return map[effect] || effect;
}