import { GameState } from '../core/GameState.js';

export class ScreenManager {
  constructor(rootElement) {
    this.root = rootElement;
    this.screens = {};
    this.current = null;
  }

  register(name, factory) {
    this.screens[name] = factory;
  }

  show(name, params = {}) {
    if (!this.screens[name]) {
      console.error(`Экран "${name}" не зарегистрирован`);
      return;
    }

    // Очищаем все подписки перед сменой экрана
    GameState._listeners = [];

    this.root.innerHTML = '';
    this.current = name;
    const element = this.screens[name](params, this);
    if (element) this.root.appendChild(element);
  }
}