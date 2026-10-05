// ============================================
// Item — предмет с учётом звёзд, редкости и сета
// ============================================

const STAR_MULTIPLIERS = {
  1: 1.0,
  2: 1.5,
  3: 2.25,
  4: 3.375,
};

const RARITY_COLORS = {
  common:    '#4a4a52',
  uncommon:  '#3a8a3a',
  rare:      '#3a6ac8',
  epic:      '#8a3ac8',
  legendary: '#c87a2a',
  mythic:    '#c81a1a',
};

const RARITY_NAMES = {
  common:    'Обычный',
  uncommon:  'Необычный',
  rare:      'Редкий',
  epic:      'Эпический',
  legendary: 'Легендарный',
  mythic:    'Мифический',
};

export class Item {
  constructor(data, stars = 1) {
    this.id = data.id;
    this.name = data.name;
    this.slot = data.slot;
    this.hand_type = data.hand_type;
    this.set = data.set;
    this.set_name = data.set_name || null;
    this.rarity = data.rarity || 'common';
    this.description = data.description;
    this.sprite_path = data.sprite_path;

    this.stars = stars;

    this._base_stats = { ...(data.base_stats || {}) };
    this._base_effects = (data.base_effects || []).map(e => ({ ...e }));
  }

  getStats() {
    const mult = STAR_MULTIPLIERS[this.stars] ?? 1.0;
    const result = {};
    for (const [key, value] of Object.entries(this._base_stats)) {
      result[key] = Math.floor(value * mult);
    }
    return result;
  }

  getEffects() {
    const mult = STAR_MULTIPLIERS[this.stars] ?? 1.0;
    return this._base_effects.map(e => ({
      ...e,
      stacks: Math.floor((e.stacks ?? 1) * mult),
    }));
  }

  canMergeWith(other) {
    if (!other) return false;
    if (this.id !== other.id) return false;
    if (this.stars !== other.stars) return false;
    if (this.stars >= 4) return false;
    return true;
  }

  fitsSlot(slotName) {
    if (slotName === 'hand_left' || slotName === 'hand_right') {
      return this.slot === 'hand' && (this.hand_type === 'weapon' || this.hand_type === 'shield');
    }
    return this.slot === slotName;
  }

  withStars(newStars) {
    const raw = {
      id: this.id,
      name: this.name,
      slot: this.slot,
      hand_type: this.hand_type,
      set: this.set,
      set_name: this.set_name,
      rarity: this.rarity,
      description: this.description,
      sprite_path: this.sprite_path,
      base_stats: { ...this._base_stats },
      base_effects: this._base_effects.map(e => ({ ...e })),
    };
    return new Item(raw, newStars);
  }

  getRarityColor() {
    return RARITY_COLORS[this.rarity] || RARITY_COLORS.common;
  }

  getRarityName() {
    return RARITY_NAMES[this.rarity] || RARITY_NAMES.common;
  }

  getRarityClass() {
    return `rarity-${this.rarity}`;
  }

  getIconPath() {
    if (this.rarity === 'mythic') {
      return `/assets/items/mythic/${this.id}.png`;
    }

    let num;
    if (this.slot === 'hand') {
      num = this.hand_type === 'shield' ? 2 : 1;
    } else {
      const map = { helmet: 3, armor: 4, legs: 5, ring: 6, amulet: 7 };
      num = map[this.slot] || 1;
    }
    return `/assets/items/${this.set}/${num}.png`;
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      slot: this.slot,
      hand_type: this.hand_type,
      set: this.set,
      set_name: this.set_name,
      rarity: this.rarity,
      description: this.description,
      sprite_path: this.sprite_path,
      stars: this.stars,
      base_stats: { ...this._base_stats },
      base_effects: this._base_effects.map(e => ({ ...e })),
    };
  }

  static fromJSON(data) {
    if (!data) return null;
    return new Item({
      id: data.id,
      name: data.name,
      slot: data.slot,
      hand_type: data.hand_type,
      set: data.set,
      set_name: data.set_name,
      rarity: data.rarity,
      description: data.description,
      sprite_path: data.sprite_path,
      base_stats: { ...(data.base_stats || {}) },
      base_effects: (data.base_effects || []).map(e => ({ ...e })),
    }, data.stars || 1);
  }
}