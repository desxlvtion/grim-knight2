import { GameState } from '../core/GameState.js';
import { SaveManager } from '../core/SaveManager.js';
import { AudioManager } from '../core/AudioManager.js';

export function DefeatScreen(params, screenManager) {
  // Удалить сохранение
  SaveManager.clear();

  // Музыка поражения
  AudioManager.playDefeatMusic();

  const wrap = document.createElement('div');
  wrap.className = 'defeat-screen';

  const title = document.createElement('h2');
  title.className = 'defeat-title';
  title.textContent = 'Ты пал';
  wrap.appendChild(title);

  const subtitle = document.createElement('div');
  subtitle.className = 'defeat-subtitle';
  subtitle.textContent = `Этап ${GameState.totalStages}`;
  wrap.appendChild(subtitle);

  const btn = document.createElement('button');
  btn.className = 'btn btn-primary';
  btn.textContent = 'В главное меню';
  btn.addEventListener('click', () => {
    AudioManager.playSfx('button_click');
    GameState.resetRun();
    screenManager.show('main_menu');
  });
  wrap.appendChild(btn);

  return wrap;
}