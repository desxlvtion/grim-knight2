import { GameState, SLOT_NAMES } from '../core/GameState.js';

const SLOT_ORDER = ['amulet', 'helmet', 'ring', 'hand_left', 'armor', 'hand_right', 'legs'];

const SLOT_PLACEHOLDER = {
  helmet:     '/assets/items/slots/helmet.png',
  armor:      '/assets/items/slots/armor.png',
  legs:       '/assets/items/slots/legs.png',
  ring:       '/assets/items/slots/ring.png',
  amulet:     '/assets/items/slots/amulet.png',
  hand_left:  '/assets/items/slots/hand_left.png',
  hand_right: '/assets/items/slots/hand_right.png',
};

export function renderEquipmentPanel(container) {
  container.innerHTML = '';

  const grid = document.createElement('div');
  grid.className = 'equipment-grid';

  for (const slotName of SLOT_ORDER) {
    grid.appendChild(createSlot(slotName));
  }

  container.appendChild(grid);
}

function createSlot(slotName) {
  const slot = document.createElement('div');
  slot.className = 'equipment-slot';
  slot.dataset.slot = slotName;

  const label = document.createElement('div');
  label.className = 'slot-label';
  label.textContent = SLOT_NAMES[slotName];
  slot.appendChild(label);

  const body = document.createElement('div');
  body.className = 'slot-body';

  // Заглушка (полупрозрачный силуэт слота)
  const placeholder = document.createElement('img');
  placeholder.className = 'slot-placeholder';
  placeholder.src = SLOT_PLACEHOLDER[slotName];
  placeholder.alt = '';
  placeholder.onerror = () => { placeholder.style.display = 'none'; };
  body.appendChild(placeholder);

  // Предмет (если есть)
  const item = GameState.equipment[slotName];
  if (item) {
    body.appendChild(renderItemInSlot(item));
    slot.classList.add('slot-filled');
    slot.classList.add(item.getRarityClass());
  } else {
    body.classList.add('slot-empty');
  }

  slot.appendChild(body);

  slot.addEventListener('dragover', (e) => {
    e.preventDefault();
    slot.classList.add('slot-dragover');
  });

  slot.addEventListener('dragleave', () => {
    slot.classList.remove('slot-dragover');
  });

  slot.addEventListener('drop', (e) => {
    e.preventDefault();
    slot.classList.remove('slot-dragover');

    const data = e.dataTransfer.getData('application/json');
    if (!data) return;
    let payload;
    try { payload = JSON.parse(data); } catch { return; }

    if (payload.source === 'inventory') {
      const invItem = GameState.inventory[payload.index];
      const eqItem = GameState.equipment[slotName];

      if (eqItem && invItem && invItem.canMergeWith(eqItem)) {
        GameState.mergeInventoryWithEquipped(payload.index, slotName);
        return;
      }

      GameState.equipFromInventory(payload.index, slotName);
      return;
    }

    if (payload.source === 'equipment') {
      if (payload.slot === slotName) return;

      const fromItem = GameState.equipment[payload.slot];
      const toItem = GameState.equipment[slotName];

      if (!fromItem) return;
      if (!fromItem.fitsSlot(slotName)) return;

      if (!toItem) {
        GameState.equipment[slotName] = fromItem;
        GameState.equipment[payload.slot] = null;
        GameState.recalculateResources();
        GameState.notify();
        return;
      }

      if (toItem.fitsSlot(payload.slot)) {
        GameState.equipment[slotName] = fromItem;
        GameState.equipment[payload.slot] = toItem;
        GameState.recalculateResources();
        GameState.notify();
      }
    }
  });

  if (item) {
    slot.setAttribute('draggable', 'true');
    slot.addEventListener('dragstart', (e) => {
      e.dataTransfer.setData('application/json', JSON.stringify({
        source: 'equipment',
        slot: slotName,
      }));
    });

    slot.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      GameState.unequipToInventory(slotName);
    });

    slot.addEventListener('dblclick', () => {
      GameState.unequipToInventory(slotName);
    });
  }

  return slot;
}

function renderItemInSlot(item) {
  const wrap = document.createElement('div');
  wrap.className = 'slot-item';

  const icon = document.createElement('img');
  icon.className = 'slot-item-icon';
  icon.src = item.getIconPath();
  icon.alt = item.name;
  icon.onerror = () => { icon.style.display = 'none'; };
  wrap.appendChild(icon);

  const nameRow = document.createElement('div');
  nameRow.className = 'slot-item-name-row';

  if (item.set) {
    const setIcon = document.createElement('img');
    setIcon.className = 'set-icon-small';
    setIcon.src = item.set.startsWith('mythic_')
  ? `/assets/items/mythic/${item.set}.png`
  : `/assets/sets/${item.set}.png`;
    setIcon.alt = item.set_name || item.set;
    setIcon.title = item.set_name || item.set;
    setIcon.onerror = () => setIcon.remove();
    nameRow.appendChild(setIcon);
  }

  const name = document.createElement('span');
  name.className = 'slot-item-name';
  name.textContent = item.name;
  nameRow.appendChild(name);

  wrap.appendChild(nameRow);

  const stars = document.createElement('div');
  stars.className = 'slot-item-stars';
  stars.textContent = '★'.repeat(item.stars);
  wrap.appendChild(stars);

  const stats = document.createElement('div');
  stats.className = 'slot-item-stats';
  const itemStats = item.getStats();
  for (const [k, v] of Object.entries(itemStats)) {
    const badge = document.createElement('span');
    badge.className = 'slot-stat';
    badge.textContent = `${translateStat(k)} +${v}`;
    stats.appendChild(badge);
  }
  for (const eff of item.getEffects()) {
    const badge = document.createElement('span');
    badge.className = 'slot-stat effect';
    badge.textContent = `${translateEffect(eff.effect)} ×${eff.stacks}`;
    stats.appendChild(badge);
  }
  wrap.appendChild(stats);

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