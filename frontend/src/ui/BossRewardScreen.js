import { GameState } from '../core/GameState.js';
import { AudioManager } from '../core/AudioManager.js';
import { SaveManager } from '../core/SaveManager.js';

export function BossRewardScreen(params, screenManager) {
  const wrap = document.createElement('div');
  wrap.className = 'boss-reward-screen';

  const title = document.createElement('h2');
  title.className = 'boss-reward-title';
  title.textContent = 'Сила предков';
  wrap.appendChild(title);

  const subtitle = document.createElement('div');
  subtitle.className = 'boss-reward-subtitle';
  subtitle.textContent = 'Выбери сет, чтобы усилить его';
  wrap.appendChild(subtitle);

  const allSetIds = Object.keys(GameState.setsData);
const availableSets = allSetIds.filter(id =>
  !id.startsWith('mythic_') && GameState.getSetPoints(id) < 6
);

  const chosen = [];
  const pool = [...availableSets];

  while (chosen.length < 3 && pool.length > 0) {
    const idx = Math.floor(Math.random() * pool.length);
    chosen.push(pool.splice(idx, 1)[0]);
  }

  const cardsWrap = document.createElement('div');
  cardsWrap.className = 'boss-reward-cards';
  wrap.appendChild(cardsWrap);

  const finish = (setId) => {
    AudioManager.playSfx('button_click');
    if (setId) {
      GameState.addSetPoint(setId);
    }
    SaveManager.save(GameState);
    fetchNextZoneAndGo(screenManager);
  };

  for (const setId of chosen) {
    const setData = GameState.setsData[setId];
    if (!setData) continue;

    const card = document.createElement('div');
    card.className = 'boss-reward-card';

    const header = document.createElement('div');
    header.className = 'boss-reward-card-header';

    const icon = document.createElement('img');
    icon.className = 'set-icon';
    icon.src = `/assets/sets/${setId}.png`;
    icon.alt = setData.name;
    icon.onerror = () => icon.remove();
    header.appendChild(icon);

    const name = document.createElement('div');
    name.className = 'boss-reward-card-name';
    name.textContent = setData.name;
    header.appendChild(name);

    card.appendChild(header);

    const currentPoints = GameState.getSetPoints(setId);
    const itemCount = Object.values(GameState.equipment).filter(i => i && i.set === setId).length;
    const totalBefore = itemCount + currentPoints;
    const totalAfter = totalBefore + 1;

    const counter = document.createElement('div');
    counter.className = 'boss-reward-card-counter';
    counter.textContent = `Сейчас: ${totalBefore} → станет ${totalAfter}`;
    card.appendChild(counter);

    const thresholds = Object.keys(setData.bonuses || {})
      .map(t => parseInt(t, 10))
      .sort((a, b) => a - b);

    const nextThreshold = thresholds.find(t => t > totalBefore && t <= totalAfter);
    if (nextThreshold) {
      const unlock = document.createElement('div');
      unlock.className = 'boss-reward-card-unlock';
      unlock.textContent = `Откроется порог ${nextThreshold}:`;

      const effects = setData.bonuses[String(nextThreshold)] || [];
      for (const e of effects) {
        const line = document.createElement('div');
        line.className = 'boss-reward-card-effect';
        line.textContent = '· ' + (e.description || '');
        unlock.appendChild(line);
      }
      card.appendChild(unlock);
    } else {
      const nothing = document.createElement('div');
      nothing.className = 'boss-reward-card-nothing';
      nothing.textContent = 'Новый порог не откроется';
      card.appendChild(nothing);
    }

    const takeBtn = document.createElement('button');
    takeBtn.className = 'btn btn-primary';
    takeBtn.textContent = 'Взять';
    takeBtn.addEventListener('click', () => finish(setId));
    card.appendChild(takeBtn);

    cardsWrap.appendChild(card);
  }

  const skipBtn = document.createElement('button');
  skipBtn.className = 'btn btn-secondary';
  skipBtn.textContent = 'Пропустить';
  skipBtn.addEventListener('click', () => finish(null));
  wrap.appendChild(skipBtn);

  return wrap;
}

async function fetchNextZoneAndGo(screenManager) {
  try {
    const res = await fetch(`/api/zones/next?current=${GameState.zone}`);
    const data = await res.json();
    GameState.nextZone(data.zone_id || GameState.zone);
  } catch (err) {
    console.error(err);
    GameState.nextZone(GameState.zone);
  }
  screenManager.show('inventory');
}