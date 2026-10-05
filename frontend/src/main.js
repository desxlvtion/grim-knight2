import './styles/base.css';
import './styles/battle.css';

import { GameState } from './core/GameState.js';
import { AudioManager } from './core/AudioManager.js';
import { SaveManager } from './core/SaveManager.js';
import { ScreenManager } from './ui/ScreenManager.js';
import { MainMenuScreen } from './ui/MainMenuScreen.js';
import { InventoryScreen } from './ui/InventoryScreen.js';
import { BattleScreen, preloadHeroFrames } from './ui/BattleScreen.js';
import { ChestScreen } from './ui/ChestScreen.js';
import { DefeatScreen } from './ui/DefeatScreen.js';
import { BossRewardScreen } from './ui/BossRewardScreen.js';
import { SanctuaryScreen } from './ui/SanctuaryScreen.js';
import { renderAudioControls } from './ui/AudioControls.js';

const API_BASE = '/api';

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function init() {
  try {
    const [itemsData, setsData, zonesData] = await Promise.all([
      fetchJson(`${API_BASE}/items`),
      fetchJson(`${API_BASE}/sets`),
      fetchJson(`${API_BASE}/zones`),
    ]);

    for (const item of itemsData.items) {
      GameState.itemsData[item.id] = item;
    }
    for (const s of setsData.sets) {
      GameState.setsData[s.id] = s;
    }
    for (const z of zonesData.zones) {
      GameState.zonesData[z.id] = z;
    }

    GameState.recalculateResources();
    GameState.hp = GameState.max_hp;
    GameState.armor = GameState.max_armor;

    window.GameState = GameState;
    window.SaveManager = SaveManager;

    AudioManager.init();

    // Прогрев кадров героя, чтобы первая атака была мгновенной
    preloadHeroFrames();

    const audioControls = renderAudioControls();
    document.body.appendChild(audioControls);

    const root = document.getElementById('screen-root');
    const sm = new ScreenManager(root);

    sm.register('main_menu', MainMenuScreen);
    sm.register('inventory', InventoryScreen);
    sm.register('battle', BattleScreen);
    sm.register('chest', ChestScreen);
    sm.register('defeat', DefeatScreen);
    sm.register('boss_reward', BossRewardScreen);
    sm.register('sanctuary', SanctuaryScreen);

    sm.show('main_menu');
  } catch (err) {
    console.error(err);
    document.getElementById('screen-root').innerHTML =
      `<div class="error">Ошибка загрузки: ${err.message}</div>`;
  }
}

init();