// ============================================
// Настройки звука. Сохраняются в localStorage.
// ============================================

const STORAGE_KEY = 'grim-knight-audio-settings';

const DEFAULTS = {
  musicVolume: 0.4,
  sfxVolume: 0.5,
  musicMuted: false,
  sfxMuted: false,
};

class AudioSettingsClass {
  constructor() {
    this.musicVolume = DEFAULTS.musicVolume;
    this.sfxVolume = DEFAULTS.sfxVolume;
    this.musicMuted = DEFAULTS.musicMuted;
    this.sfxMuted = DEFAULTS.sfxMuted;

    this._listeners = [];
    this.load();
  }

  load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const data = JSON.parse(raw);
      if (typeof data.musicVolume === 'number') this.musicVolume = data.musicVolume;
      if (typeof data.sfxVolume === 'number') this.sfxVolume = data.sfxVolume;
      if (typeof data.musicMuted === 'boolean') this.musicMuted = data.musicMuted;
      if (typeof data.sfxMuted === 'boolean') this.sfxMuted = data.sfxMuted;
    } catch (e) {
      console.warn('Не удалось загрузить настройки звука:', e);
    }
  }

  save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        musicVolume: this.musicVolume,
        sfxVolume: this.sfxVolume,
        musicMuted: this.musicMuted,
        sfxMuted: this.sfxMuted,
      }));
    } catch (e) {
      console.warn('Не удалось сохранить настройки звука:', e);
    }
  }

  subscribe(fn) { this._listeners.push(fn); }
  notify() { for (const fn of this._listeners) fn(); }

  setMusicVolume(v) {
    this.musicVolume = Math.max(0, Math.min(1, v));
    this.save();
    this.notify();
  }

  setSfxVolume(v) {
    this.sfxVolume = Math.max(0, Math.min(1, v));
    this.save();
    this.notify();
  }

  toggleMusicMute() {
    this.musicMuted = !this.musicMuted;
    this.save();
    this.notify();
  }

  toggleSfxMute() {
    this.sfxMuted = !this.sfxMuted;
    this.save();
    this.notify();
  }
}

export const AudioSettings = new AudioSettingsClass();