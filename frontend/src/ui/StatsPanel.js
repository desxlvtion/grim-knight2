import { GameState } from '../core/GameState.js';

const STAT_LABELS = [
  ['damage',    'Урон'],
  ['speed',     'Скорость'],
  ['crit_chance','Крит. шанс', '%'],
  ['crit_damage','Крит. урон', '%'],
  ['armor',     'Броня'],
  ['resist',    'Сопротивление'],
  ['evasion',   'Уклонение', '%'],
  ['max_hp',    'Макс. HP'],
  ['regen',     'Регенерация'],
];

const SPECIAL_LABELS = [
  ['vampirism',   'Вампиризм', '%'],
  ['reflect',     'Отражение', '%'],
  ['poison_stacks','Яд (стаки)'],
  ['burn_stacks', 'Горение (стаки)'],
  ['bleed_stacks','Кровотечение (стаки)'],
];

export function renderStatsPanel(container) {
  const stats = GameState.getTotalStats();

  container.innerHTML = '';

  // Основные
  const mainBlock = el('div', 'stat-block');
  for (const [key, label, suffix] of STAT_LABELS) {
    mainBlock.appendChild(statRow(label, stats[key], suffix));
  }
  container.appendChild(mainBlock);

  // Специальные
  const specialActive = SPECIAL_LABELS.filter(([key]) => stats[key] > 0);
  if (specialActive.length > 0) {
    const specialBlock = el('div', 'stat-block');
    specialBlock.appendChild(el('div', 'stat-block-title', 'Специальные'));
    for (const [key, label, suffix] of specialActive) {
      const row = statRow(label, stats[key], suffix);
      row.classList.add('stat-special');
      specialBlock.appendChild(row);
    }
    container.appendChild(specialBlock);
  }
}

function statRow(label, value, suffix = '') {
  const row = el('div', 'stat-row');
  row.appendChild(el('span', 'stat-label', label));
  row.appendChild(el('span', 'stat-value', `${value}${suffix}`));
  return row;
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}