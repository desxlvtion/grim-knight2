import { GameState } from '../core/GameState.js';
import { showTooltip, hideTooltip } from './Tooltip.js';

export function renderSetsPanel(container) {
  container.innerHTML = '';

  const counts = GameState.getSetCounts();
  const setIds = Object.keys(counts);

  if (setIds.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'sets-panel-empty';
    empty.textContent = 'Нет активных сетов';
    container.appendChild(empty);
    return;
  }

  const list = document.createElement('div');
  list.className = 'sets-panel-list';

  for (const setId of setIds) {
    const count = counts[setId];
    const setData = GameState.setsData[setId];
    if (!setData) continue;

    const row = document.createElement('div');
    row.className = 'sets-panel-row';

const icon = document.createElement('img');
icon.className = 'sets-panel-icon';
// Для mythic-сетов используем иконку самого предмета
icon.src = setId.startsWith('mythic_')
  ? `/assets/items/mythic/${setId}.png`
  : `/assets/sets/${setId}.png`;
icon.alt = setData.name;
icon.onerror = () => { icon.style.display = 'none'; };
row.appendChild(icon)

    const countEl = document.createElement('span');
    countEl.className = 'sets-panel-count';
    countEl.textContent = `×${count}`;
    row.appendChild(countEl);

    // Тултип при наведении
    row.addEventListener('mouseenter', () => {
      const content = buildSetTooltip(setId, setData, count);
      showTooltip(row, content);
    });

    row.addEventListener('mouseleave', () => {
      hideTooltip();
    });

    list.appendChild(row);
  }

  container.appendChild(list);
}

function buildSetTooltip(setId, setData, count) {
  const wrap = document.createElement('div');
  wrap.className = 'set-tooltip';

  const title = document.createElement('div');
  title.className = 'set-tooltip-title';
  title.textContent = setData.name;
  wrap.appendChild(title);

  const bonuses = setData.bonuses || {};
  const thresholds = Object.keys(bonuses)
    .map(t => parseInt(t, 10))
    .sort((a, b) => a - b);

  for (const threshold of thresholds) {
    const effects = bonuses[String(threshold)] || [];
    const isActive = count >= threshold;

    const row = document.createElement('div');
    row.className = 'set-tooltip-row' + (isActive ? ' active' : '');

    const th = document.createElement('span');
    th.className = 'set-tooltip-threshold';
    th.textContent = `${threshold}`;
    row.appendChild(th);

    const desc = document.createElement('span');
    desc.className = 'set-tooltip-desc';
    const parts = effects.map(e => e.description || '').filter(Boolean);
    desc.textContent = parts.join(', ');
    row.appendChild(desc);

    wrap.appendChild(row);
  }

  return wrap;
}