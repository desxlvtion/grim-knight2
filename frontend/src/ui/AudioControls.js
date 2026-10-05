import { AudioSettings } from '../core/AudioSettings.js';

export function renderAudioControls() {
  const wrap = document.createElement('div');
  wrap.className = 'audio-controls';

  const musicBtn = document.createElement('button');
  musicBtn.className = 'audio-btn';
  musicBtn.title = 'Музыка';
  musicBtn.addEventListener('click', () => {
    AudioSettings.toggleMusicMute();
    updateStates();
  });

  const sfxBtn = document.createElement('button');
  sfxBtn.className = 'audio-btn';
  sfxBtn.title = 'Звуки';
  sfxBtn.addEventListener('click', () => {
    AudioSettings.toggleSfxMute();
    updateStates();
  });

  const updateStates = () => {
    musicBtn.textContent = AudioSettings.musicMuted ? '♪ OFF' : '♪ ON';
    sfxBtn.textContent   = AudioSettings.sfxMuted   ? '♫ OFF' : '♫ ON';
    musicBtn.classList.toggle('muted', AudioSettings.musicMuted);
    sfxBtn.classList.toggle('muted', AudioSettings.sfxMuted);
  };

  updateStates();

  wrap.appendChild(musicBtn);
  wrap.appendChild(sfxBtn);

  return wrap;
}