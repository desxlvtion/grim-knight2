// ============================================
// Сохранение / загрузка прогресса в localStorage
// ============================================

const STORAGE_KEY = 'grim-knight-save';
const SAVE_VERSION = 1;

class SaveManagerClass {
  hasSave() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return false;
      const data = JSON.parse(raw);
      return data && data.version === SAVE_VERSION;
    } catch {
      return false;
    }
  }

  save(gameState) {
    try {
      const data = {
        version: SAVE_VERSION,
        savedAt: Date.now(),
        state: gameState.serialize(),
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      return true;
    } catch (e) {
      console.warn('Не удалось сохранить игру:', e);
      return false;
    }
  }

  load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const data = JSON.parse(raw);
      if (!data || data.version !== SAVE_VERSION) return null;
      return data.state;
    } catch (e) {
      console.warn('Не удалось загрузить игру:', e);
      return null;
    }
  }

  getSummary() {
    const state = this.load();
    if (!state) return null;
    return {
      zone: state.zone,
      stage: state.stage,
      totalStages: state.totalStages,
      hp: state.hp,
      max_hp: state.max_hp,
      savedAt: null,
    };
  }

  clear() {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (e) {
      console.warn('Не удалось удалить сохранение:', e);
    }
  }
}

export const SaveManager = new SaveManagerClass();