import { GameState } from '../core/GameState.js';
import { AudioManager } from '../core/AudioManager.js';
import { SaveManager } from '../core/SaveManager.js';
import { renderEquipmentPanel } from './Equipment.js';
import { renderInventoryPanel } from './Inventory.js';
import { renderStatsPanel } from './StatsPanel.js';
import { renderSetsPanel } from './SetsPanel.js';

export function InventoryScreen(params, screenManager) {
  const wrap = document.createElement('div');
  wrap.className = 'inventory-screen';

  const topBar = document.createElement('div');
  topBar.className = 'top-bar';

  const stageInfo = document.createElement('div');
  stageInfo.className = 'stage-info';
  topBar.appendChild(stageInfo);

  const hpInfo = document.createElement('div');
  hpInfo.className = 'hp-info';
  topBar.appendChild(hpInfo);

  const toMenu = document.createElement('button');
  toMenu.className = 'btn btn-secondary';
  toMenu.textContent = 'В меню';
  toMenu.addEventListener('click', () => {
    AudioManager.playSfx('button_click');
    SaveManager.save(GameState);
    screenManager.show('main_menu');
  });
  topBar.appendChild(toMenu);

  const toBattle = document.createElement('button');
  toBattle.className = 'btn btn-primary';
  toBattle.textContent = 'В бой';
  toBattle.addEventListener('click', () => {
    AudioManager.playSfx('button_click');
    screenManager.show('battle');
  });
  topBar.appendChild(toBattle);

  wrap.appendChild(topBar);

  const grid = document.createElement('div');
  grid.className = 'app-main';

  const statsCol = document.createElement('aside');
  statsCol.className = 'col-stats';

  const statsPanel = document.createElement('section');
  statsPanel.className = 'panel';
  statsPanel.innerHTML = '<h2 class="panel-title">Характеристики</h2>';
  const statsContent = document.createElement('div');
  statsPanel.appendChild(statsContent);
  statsCol.appendChild(statsPanel);

  const setsPanel = document.createElement('section');
  setsPanel.className = 'panel';
  setsPanel.style.marginTop = '20px';
  setsPanel.innerHTML = '<h2 class="panel-title">Сеты</h2>';
  const setsContent = document.createElement('div');
  setsPanel.appendChild(setsContent);
  statsCol.appendChild(setsPanel);

  const eqCol = document.createElement('section');
  eqCol.className = 'col-equipment';

  const eqPanel = document.createElement('section');
  eqPanel.className = 'panel';
  eqPanel.innerHTML = '<h2 class="panel-title">Экипировка</h2>';

  const eqContent = document.createElement('div');
  eqPanel.appendChild(eqContent);

  const trash = document.createElement('div');
  trash.className = 'trash-zone';
  const trashImg = document.createElement('img');
  trashImg.src = '/assets/ui/trash.png';
  trashImg.alt = 'Выбросить';
  trash.appendChild(trashImg);

  trash.addEventListener('dragover', (e) => {
    e.preventDefault();
    trash.classList.add('trash-dragover');
  });

  trash.addEventListener('dragleave', () => {
    trash.classList.remove('trash-dragover');
  });

  trash.addEventListener('drop', (e) => {
    e.preventDefault();
    trash.classList.remove('trash-dragover');

    const data = e.dataTransfer.getData('application/json');
    if (!data) return;
    let payload;
    try { payload = JSON.parse(data); } catch { return; }

    if (payload.source === 'inventory') {
      GameState.removeFromInventory(payload.index);
    }
    if (payload.source === 'equipment') {
      GameState.removeFromEquipment(payload.slot);
    }
  });

  eqPanel.appendChild(trash);
  eqCol.appendChild(eqPanel);

  const invCol = document.createElement('aside');
  invCol.className = 'col-inventory';
  const invPanel = document.createElement('section');
  invPanel.className = 'panel';
  invPanel.innerHTML = '<h2 class="panel-title">Инвентарь</h2>';

  const filtersBar = document.createElement('div');
  filtersBar.className = 'inventory-filters';
  invPanel.appendChild(filtersBar);

  const sortBtn = document.createElement('button');
  sortBtn.className = 'btn btn-secondary sort-btn';
  sortBtn.textContent = 'Сортировать';
  sortBtn.addEventListener('click', () => {
    AudioManager.playSfx('button_click');
    GameState.sortInventory();
  });
  invPanel.appendChild(sortBtn);

  const invContent = document.createElement('div');
  invPanel.appendChild(invContent);
  invCol.appendChild(invPanel);

  grid.appendChild(statsCol);
  grid.appendChild(eqCol);
  grid.appendChild(invCol);
  wrap.appendChild(grid);

  const renderFilters = () => {
    filtersBar.innerHTML = '';

    const rarityRow = document.createElement('div');
    rarityRow.className = 'filter-row';
    rarityRow.appendChild(filterLabel('Редкость'));
    const rarityOptions = [
      { value: 'all', label: 'Все' },
      { value: 'common', label: 'Обычный' },
      { value: 'uncommon', label: 'Необычный' },
      { value: 'rare', label: 'Редкий' },
      { value: 'epic', label: 'Эпический' },
      { value: 'legendary', label: 'Легендарный' },
    ];
    for (const opt of rarityOptions) {
      rarityRow.appendChild(filterChip(opt.label, GameState.filterRarity === opt.value, () => {
        GameState.filterRarity = opt.value;
        GameState.notify();
      }));
    }
    filtersBar.appendChild(rarityRow);

    const slotRow = document.createElement('div');
    slotRow.className = 'filter-row';
    slotRow.appendChild(filterLabel('Слот'));
    const slotOptions = [
      { value: 'all', label: 'Все' },
      { value: 'hand', label: 'Оружие' },
      { value: 'helmet', label: 'Шлем' },
      { value: 'armor', label: 'Броня' },
      { value: 'legs', label: 'Ноги' },
      { value: 'ring', label: 'Кольцо' },
      { value: 'amulet', label: 'Амулет' },
    ];
    for (const opt of slotOptions) {
      slotRow.appendChild(filterChip(opt.label, GameState.filterSlot === opt.value, () => {
        GameState.filterSlot = opt.value;
        GameState.notify();
      }));
    }
    filtersBar.appendChild(slotRow);

    const setRow = document.createElement('div');
    setRow.className = 'filter-row';
    setRow.appendChild(filterLabel('Сет'));
    const select = document.createElement('select');
    select.className = 'filter-select';
    const allOpt = document.createElement('option');
    allOpt.value = 'all';
    allOpt.textContent = 'Все';
    select.appendChild(allOpt);
    for (const [setId, setData] of Object.entries(GameState.setsData)) {
      const opt = document.createElement('option');
      opt.value = setId;
      opt.textContent = setData.name;
      select.appendChild(opt);
    }
    select.value = GameState.filterSet;
    select.addEventListener('change', () => {
      GameState.filterSet = select.value;
      GameState.notify();
    });
    setRow.appendChild(select);
    filtersBar.appendChild(setRow);
  };

  const render = () => {
    renderStatsPanel(statsContent);
    renderSetsPanel(setsContent);
    renderEquipmentPanel(eqContent);
    renderInventoryPanel(invContent);
    renderFilters();

    const zoneData = GameState.zonesData?.[GameState.zone];
    const zoneName = zoneData?.name || GameState.zone;
    stageInfo.textContent = `Этап ${GameState.stage} · ${zoneName}`;
    hpInfo.textContent = `HP ${GameState.hp}/${GameState.max_hp} · Броня ${GameState.armor}/${GameState.max_armor} · Зелья ${GameState.potions}`;
  };

  const handler = () => render();
  GameState.subscribe(handler);

  render();

  const observer = new MutationObserver(() => {
    if (!document.body.contains(wrap)) {
      const idx = GameState._listeners.indexOf(handler);
      if (idx >= 0) GameState._listeners.splice(idx, 1);
      observer.disconnect();
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });

  return wrap;
}

function filterLabel(text) {
  const el = document.createElement('div');
  el.className = 'filter-label';
  el.textContent = text;
  return el;
}

function filterChip(label, active, onClick) {
  const el = document.createElement('button');
  el.className = 'filter-chip' + (active ? ' active' : '');
  el.textContent = label;
  el.addEventListener('click', onClick);
  return el;
}