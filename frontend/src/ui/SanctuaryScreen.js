import { GameState } from '../core/GameState.js';
import { AudioManager } from '../core/AudioManager.js';
import { SaveManager } from '../core/SaveManager.js';

export function SanctuaryScreen(params, screenManager) {
  const wrap = document.createElement('div');
  wrap.className = 'sanctuary-screen';

  const zoneData = GameState.zonesData?.[GameState.zone];
  const bgFile = zoneData?.background || 'dungeon.png';
  wrap.style.background = `linear-gradient(rgba(10, 10, 12, 0.6), rgba(10, 10, 12, 0.85)), url('/assets/backgrounds/${bgFile}') center/cover no-repeat`;

  const card = document.createElement('div');
  card.className = 'sanctuary-card';

  const title = document.createElement('h2');
  title.className = 'sanctuary-title';
  title.textContent = 'Вы нашли святилище';
  card.appendChild(title);

  const subtitle = document.createElement('div');
  subtitle.className = 'sanctuary-subtitle';
  subtitle.textContent = 'Выберите одно благословение';
  card.appendChild(subtitle);

  const cardsWrap = document.createElement('div');
  cardsWrap.className = 'sanctuary-cards';
  card.appendChild(cardsWrap);

  const finish = (bonus) => {
    AudioManager.playSfx('button_click');
    if (bonus) {
      GameState.addSanctuaryBonus(bonus);
    }
    SaveManager.save(GameState);
    screenManager.show('inventory');
  };

  fetch('/api/sanctuaries/roll?count=3')
    .then(r => r.json())
    .then(data => {
      for (const bonus of data.sanctuaries) {
        const cardEl = document.createElement('div');
        cardEl.className = 'sanctuary-bonus-card';

        const name = document.createElement('div');
        name.className = 'sanctuary-bonus-name';
        name.textContent = bonus.name;
        cardEl.appendChild(name);

        const desc = document.createElement('div');
        desc.className = 'sanctuary-bonus-desc';
        desc.textContent = bonus.description;
        cardEl.appendChild(desc);

        const takeBtn = document.createElement('button');
        takeBtn.className = 'btn btn-primary';
        takeBtn.textContent = 'Взять';
        takeBtn.addEventListener('click', () => finish(bonus));
        cardEl.appendChild(takeBtn);

        cardsWrap.appendChild(cardEl);
      }

      const skipBtn = document.createElement('button');
      skipBtn.className = 'btn btn-secondary sanctuary-skip';
      skipBtn.textContent = 'Пропустить';
      skipBtn.addEventListener('click', () => finish(null));
      card.appendChild(skipBtn);
    })
    .catch(err => {
      console.error(err);
      const errorEl = document.createElement('div');
      errorEl.className = 'error';
      errorEl.textContent = 'Не удалось загрузить святилище';
      card.appendChild(errorEl);
    });

  wrap.appendChild(card);

  return wrap;
}