import { GameState } from '../core/GameState.js';
import { SaveManager } from '../core/SaveManager.js';
import { AudioManager } from '../core/AudioManager.js';

export function MainMenuScreen(params, screenManager) {
  const wrap = document.createElement('div');
  wrap.className = 'main-menu-screen';

  // Фон — подземелье по умолчанию
  wrap.style.background = `
    linear-gradient(rgba(10, 10, 12, 0.7), rgba(10, 10, 12, 0.9)),
    url('/assets/backgrounds/dungeon.png') center/cover no-repeat
  `;

  const card = document.createElement('div');
  card.className = 'main-menu-card';

  const title = document.createElement('h1');
  title.className = 'main-menu-title';
  title.textContent = 'Grim Knight';
  card.appendChild(title);

  const subtitle = document.createElement('div');
  subtitle.className = 'main-menu-subtitle';
  subtitle.textContent = 'Тьма ждёт своего рыцаря';
  card.appendChild(subtitle);

  const saveExists = SaveManager.hasSave();

  // Кнопка «Продолжить»
  if (saveExists) {
    const summary = SaveManager.getSummary();
    const info = document.createElement('div');
    info.className = 'main-menu-save-info';
    const zoneData = GameState.zonesData?.[summary.zone];
    const zoneName = zoneData?.name || summary.zone;
    info.textContent = `${zoneName} · Этап ${summary.stage} · HP ${summary.hp}/${summary.max_hp}`;
    card.appendChild(info);

    const continueBtn = document.createElement('button');
    continueBtn.className = 'btn btn-primary main-menu-btn';
    continueBtn.textContent = 'Продолжить';
    continueBtn.addEventListener('click', () => {
      AudioManager.playSfx('button_click');
      const state = SaveManager.load();
      if (state) {
        GameState.deserialize(state);
        screenManager.show('inventory');
      } else {
        alert('Не удалось загрузить сохранение');
      }
    });
    card.appendChild(continueBtn);
  }

  // Кнопка «Новая игра»
  const newGameBtn = document.createElement('button');
  newGameBtn.className = 'btn main-menu-btn' + (saveExists ? ' btn-secondary' : ' btn-primary');
  newGameBtn.textContent = 'Новая игра';
  newGameBtn.addEventListener('click', () => {
    AudioManager.playSfx('button_click');

    if (saveExists) {
      const confirm = window.confirm('Начать новую игру? Текущий прогресс будет удалён.');
      if (!confirm) return;
    }

    SaveManager.clear();
    GameState.resetRun();
    GameState.recalculateResources();
    GameState.hp = GameState.max_hp;
    GameState.armor = GameState.max_armor;
    GameState.notify();

    screenManager.show('inventory');
  });
  card.appendChild(newGameBtn);

  wrap.appendChild(card);

  return wrap;
}