import { AudioSettings } from './AudioSettings.js';
import { GameState } from './GameState.js';

// ============================================
// Менеджер звука: музыка по плейлисту + SFX
// ============================================

const FADE_DURATION = 1000;   // 1 секунда
const FADE_STEPS = 30;        // частота обновления громкости при fade

class AudioManagerClass {
  constructor() {
    this._musicAudio = null;          // текущий <audio> для музыки
    this._playlist = [];              // массив путей
    this._playlistIndex = 0;          // индекс текущего трека
    this._fading = null;              // интервал fade
    this._zone = null;                // текущая зона плейлиста
    this._isDefeat = false;           // играет ли defeat.mp3

    this._sfxPool = [];               // пул <audio> для SFX (для наложения)

    this._initialized = false;
  }

  init() {
    if (this._initialized) return;
    this._initialized = true;

    // Подписка на изменение настроек
    AudioSettings.subscribe(() => this._applySettingsToCurrent());

    // Подписка на смену зоны
    GameState.subscribe(() => this._checkZoneChanged());

    // Подписка на первое взаимодействие с пользователем (браузеры блокируют autoplay)
    const unlock = () => {
      document.removeEventListener('click', unlock);
      document.removeEventListener('keydown', unlock);
      // При первом клике — запустить музыку для текущей зоны
      if (!this._musicAudio) {
        this.playMusicForZone(GameState.zone);
      }
    };
    document.addEventListener('click', unlock);
    document.addEventListener('keydown', unlock);
  }

  // ============================================
  // Музыка
  // ============================================

  playMusicForZone(zoneId) {
    const tracks = [
      `/assets/audio/music/${zoneId}_1.mp3`,
      `/assets/audio/music/${zoneId}_2.mp3`,
    ];

    // Если зона не менялась и музыка уже играет — не трогаем
    if (this._zone === zoneId && this._musicAudio && !this._isDefeat) return;

    this._zone = zoneId;
    this._isDefeat = false;
    this._playlist = tracks;
    this._playlistIndex = 0;
    this._startTrack(0);
  }

  playDefeatMusic() {
    this._zone = null;
    this._isDefeat = true;
    this._playlist = ['/assets/audio/music/defeat.mp3'];
    this._playlistIndex = 0;
    this._startTrack(0, false);   // без цикла — играет один раз
  }

  _startTrack(index, loop = true) {
    this._stopCurrentMusic(true);   // fade out старого

    const path = this._playlist[index];
    if (!path) return;

    const audio = new Audio(path);
    audio.loop = false;             // мы управляем переключением сами
    audio.volume = 0;

    this._musicAudio = audio;

    // При окончании трека — играем следующий (или тот же, если плейлист из 1 трека)
    audio.addEventListener('ended', () => {
      if (this._playlist.length === 0) return;
      const nextIndex = (this._playlistIndex + 1) % this._playlist.length;
      this._playlistIndex = nextIndex;
      this._startTrack(nextIndex);
    });

    audio.addEventListener('error', () => {
      console.warn(`Не удалось загрузить трек: ${path}`);
    });

    audio.play().then(() => {
      // Fade in
      this._fade(audio, 0, this._getMusicVolume(), FADE_DURATION);
    }).catch(err => {
      // Браузер заблокировал autoplay — ждём первого клика
      console.warn('Autoplay заблокирован, ждём взаимодействия:', err.message);
    });
  }

  _stopCurrentMusic(fade = false) {
    const audio = this._musicAudio;
    if (!audio) return;

    if (fade) {
      const startVol = audio.volume;
      this._fade(audio, startVol, 0, FADE_DURATION, () => {
        audio.pause();
        audio.src = '';
      });
    } else {
      audio.pause();
      audio.src = '';
    }

    this._musicAudio = null;
  }

  _fade(audio, from, to, duration, onComplete = null) {
    if (this._fading) {
      clearInterval(this._fading);
      this._fading = null;
    }

    const stepTime = duration / FADE_STEPS;
    const stepDelta = (to - from) / FADE_STEPS;
    let step = 0;
    audio.volume = from;

    this._fading = setInterval(() => {
      step++;
      audio.volume = Math.max(0, Math.min(1, from + stepDelta * step));
      if (step >= FADE_STEPS) {
        clearInterval(this._fading);
        this._fading = null;
        audio.volume = to;
        if (onComplete) onComplete();
      }
    }, stepTime);
  }

  _getMusicVolume() {
    if (AudioSettings.musicMuted) return 0;
    return AudioSettings.musicVolume;
  }

  _applySettingsToCurrent() {
    if (this._musicAudio && !this._fading) {
      this._musicAudio.volume = this._getMusicVolume();
    }
  }

  _checkZoneChanged() {
    if (this._isDefeat) return;
    if (GameState.zone !== this._zone) {
      this.playMusicForZone(GameState.zone);
    }
  }

  // ============================================
  // SFX
  // ============================================

  playSfx(name) {
    if (AudioSettings.sfxMuted) return;
    const volume = AudioSettings.sfxVolume;
    if (volume <= 0) return;

    const path = `/assets/audio/sfx/${name}.mp3`;
    const audio = new Audio(path);
    audio.volume = volume;

    audio.addEventListener('error', () => {
      // Тихо игнорируем — если файла нет, игра не падает
    });

    audio.play().catch(() => {});

    // Чистим ссылку, чтобы не копить
    this._sfxPool.push(audio);
    if (this._sfxPool.length > 20) {
      this._sfxPool.shift();
    }
  }
}

export const AudioManager = new AudioManagerClass();