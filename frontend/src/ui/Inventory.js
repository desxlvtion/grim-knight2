import { GameState } from '../core/GameState.js';

export function renderInventoryPanel(container) {
  container.innerHTML = '';

  const list = document.createElement('div');
  list.className = 'inventory-list';

  list.addEventListener('dragover', (e) => {
    e.preventDefault();
  });

  list.addEventListener('drop', (e) => {
    e.preventDefault();
    const data = e.dataTransfer.getData('application/json');
    if (!data) return;
    let payload;
    try { payload = JSON.parse(data); } catch { return; }

    if (payload.source === 'equipment') {
      GameState.unequipToInventory(payload.slot);
    }
  });

  const filtered = GameState.getFilteredInventory();

  if (filtered.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'loading';
    empty.textContent = GameState.inventory.length === 0
      ? 'Инвентарь пуст'
      : 'Ничего не найдено по фильтру';
    list.appendChild(empty);
  } else {
    filtered.forEach(({ item, index }) => {
      list.appendChild(createSeparator(index));
      list.appendChild(createInventoryCard(item, index));
    });
    list.appendChild(createSeparator(GameState.inventory.length));
  }

  container.appendChild(list);
}

function createSeparator(index) {
  const sep = document.createElement('div');
  sep.className = 'inventory-separator';
  sep.dataset.insertIndex = index;

  sep.addEventListener('dragover', (e) => {
    e.preventDefault();
    sep.classList.add('active');
  });

  sep.addEventListener('dragleave', () => {
    sep.classList.remove('active');
  });

  sep.addEventListener('drop', (e) => {
    e.preventDefault();
    e.stopPropagation();
    sep.classList.remove('active');

    const data = e.dataTransfer.getData('application/json');
    if (!data) return;
    let payload;
    try { payload = JSON.parse(data); } catch { return; }

    if (payload.source === 'inventory') {
      const from = payload.index;
      const to = index;
      if (from === to || from + 1 === to) return;
      GameState.moveInventoryItem(from, to);
    }
  });

  return sep;
}

function createInventoryCard(item, index) {
  const card = document.createElement('div');
  card.className = 'inventory-card';
  card.classList.add(item.getRarityClass());
  card.setAttribute('draggable', 'true');
  card.dataset.index = index;

  // Иконка
  const iconWrap = document.createElement('div');
  iconWrap.className = 'inventory-icon';

  const icon = document.createElement('img');
  icon.src = item.getIconPath();
  icon.alt = item.name;
  icon.onerror = () => { icon.style.display = 'none'; };
  iconWrap.appendChild(icon);

  card.appendChild(iconWrap);

  // Текст
  const textWrap = document.createElement('div');
  textWrap.className = 'inventory-text';

  const name = document.createElement('div');
  name.className = 'inventory-name';
  name.textContent = item.name;
  textWrap.appendChild(name);

  const meta = document.createElement('div');
  meta.className = 'inventory-meta';

  const raritySpan = document.createElement('span');
  raritySpan.textContent = item.getRarityName();
  meta.appendChild(raritySpan);

  meta.appendChild(document.createTextNode(' · '));

  if (item.set) {
    const setIcon = document.createElement('img');
    setIcon.className = 'set-icon-small';
    setIcon.src = item.set.startsWith('mythic_')
  ? `/assets/items/mythic/${item.set}.png`
  : `/assets/sets/${item.set}.png`;
    setIcon.alt = item.set_name || item.set;
    setIcon.title = item.set_name || item.set;
    setIcon.onerror = () => setIcon.remove();
    meta.appendChild(setIcon);
    meta.appendChild(document.createTextNode(' ' + (item.set_name || item.set)));
  } else {
    meta.appendChild(document.createTextNode('Без сета'));
  }

  textWrap.appendChild(meta);

  const stars = document.createElement('div');
  stars.className = 'inventory-stars';
  stars.textContent = '★'.repeat(item.stars);
  textWrap.appendChild(stars);

  // Статы
  const stats = document.createElement('div');
  stats.className = 'inventory-stats';
  const itemStats = item.getStats();
  for (const [k, v] of Object.entries(itemStats)) {
    const badge = document.createElement('span');
    badge.className = 'inventory-stat';
    badge.textContent = `${translateStat(k)} +${v}`;
    stats.appendChild(badge);
  }
  for (const eff of item.getEffects()) {
    const badge = document.createElement('span');
    badge.className = 'inventory-stat effect';
    badge.textContent = `${translateEffect(eff.effect)} ×${eff.stacks}`;
    stats.appendChild(badge);
  }
  textWrap.appendChild(stats);

  card.appendChild(textWrap);

  card.addEventListener('dragstart', (e) => {
    e.dataTransfer.setData('application/json', JSON.stringify({
      source: 'inventory',
      index,
    }));
  });

  card.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.stopPropagation();
    card.classList.add('card-dragover');
  });

  card.addEventListener('dragleave', () => {
    card.classList.remove('card-dragover');
  });

  card.addEventListener('drop', (e) => {
    e.preventDefault();
    e.stopPropagation();
    card.classList.remove('card-dragover');

    const data = e.dataTransfer.getData('application/json');
    if (!data) return;
    let payload;
    try { payload = JSON.parse(data); } catch { return; }

    if (payload.source === 'inventory') {
      GameState.mergeInventoryItems(payload.index, index);
    }
  });

  card.addEventListener('dblclick', () => {
    GameState.equipFromInventorySmart(index);
  });

  return card;
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