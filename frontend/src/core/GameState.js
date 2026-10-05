import { Item } from './Item.js';

const BASE_STATS = {
  damage: 5,
  speed: 0,
  crit_chance: 5,
  crit_damage: 150,
  armor: 10,
  resist: 0,
  evasion: 0,
  max_hp: 100,
  regen: 0,

  vampirism: 0,
  reflect: 0,
  poison_stacks: 0,
  burn_stacks: 0,
  bleed_stacks: 0,
};

export const SLOT_NAMES = {
  helmet: 'Шлем',
  armor: 'Броня',
  legs: 'Ноги',
  ring: 'Кольцо',
  amulet: 'Амулет',
  hand_right: 'Правая рука',
  hand_left: 'Левая рука',
};

class GameStateClass {
  constructor() {
    this.equipment = {
      helmet: null, armor: null, legs: null, ring: null,
      amulet: null, hand_right: null, hand_left: null,
    };

    this.inventory = [];
    this.itemsData = {};
    this.setsData = {};
    this.zonesData = {};

    this.hp = 100;
    this.max_hp = 100;
    this.armor = 10;
    this.max_armor = 10;

    this.potions = 3;
    this.max_potions = 3;

    this.effects = [];

    this.stage = 1;
    this.totalStages = 1;

    this.zone = 'dungeon';
    this.currentEnemies = [];

    this.setPoints = {};
    this.sanctuaryBonuses = [];

    this.filterRarity = 'all';
    this.filterSlot = 'all';
    this.filterSet = 'all';

    this._listeners = [];
  }

  subscribe(fn) { this._listeners.push(fn); }
  notify() { for (const fn of this._listeners) fn(); }

  // ============================================
  // Инвентарь
  // ============================================

  addToInventory(itemId, stars = 1) {
    const raw = this.itemsData[itemId];
    if (!raw) return null;
    const item = new Item(raw, stars);
    this.inventory.push(item);
    this.notify();
    return item;
  }

  equipFromInventory(invIndex, slotName) {
    const item = this.inventory[invIndex];
    if (!item) return false;
    if (!item.fitsSlot(slotName)) return false;

    const previous = this.equipment[slotName];
    this.inventory.splice(invIndex, 1);
    if (previous) this.inventory.push(previous);

    this.equipment[slotName] = item;
    this.recalculateResources();
    this.notify();
    return true;
  }

  equipFromInventorySmart(invIndex) {
    const item = this.inventory[invIndex];
    if (!item) return false;

    let targetSlot = null;

    if (item.slot === 'hand' && (item.hand_type === 'weapon' || item.hand_type === 'shield')) {
      const rightEmpty = !this.equipment.hand_right;
      const leftEmpty = !this.equipment.hand_left;
      if (rightEmpty) targetSlot = 'hand_right';
      else if (leftEmpty) targetSlot = 'hand_left';
      else targetSlot = 'hand_right';
    } else {
      targetSlot = item.slot;
    }

    if (!targetSlot) return false;
    return this.equipFromInventory(invIndex, targetSlot);
  }

  unequipToInventory(slotName) {
    const item = this.equipment[slotName];
    if (!item) return false;
    this.equipment[slotName] = null;
    this.inventory.push(item);
    this.recalculateResources();
    this.notify();
    return true;
  }

  removeFromInventory(index) {
    if (index < 0 || index >= this.inventory.length) return false;
    this.inventory.splice(index, 1);
    this.notify();
    return true;
  }

  removeFromEquipment(slotName) {
    if (!this.equipment[slotName]) return false;
    this.equipment[slotName] = null;
    this.recalculateResources();
    this.notify();
    return true;
  }

  moveInventoryItem(fromIndex, toIndex) {
    if (fromIndex === toIndex) return false;
    if (fromIndex < 0 || fromIndex >= this.inventory.length) return false;
    if (toIndex < 0 || toIndex > this.inventory.length) return false;

    const [item] = this.inventory.splice(fromIndex, 1);
    const adjusted = toIndex > fromIndex ? toIndex - 1 : toIndex;
    this.inventory.splice(adjusted, 0, item);
    this.notify();
    return true;
  }

  mergeInventoryItems(indexA, indexB) {
    if (indexA === indexB) return false;
    const a = this.inventory[indexA];
    const b = this.inventory[indexB];
    if (!a || !b) return false;
    if (!a.canMergeWith(b)) return false;

    const merged = a.withStars(a.stars + 1);
    const [lo, hi] = indexA < indexB ? [indexA, indexB] : [indexB, indexA];
    this.inventory.splice(hi, 1);
    this.inventory.splice(lo, 1);
    this.inventory.push(merged);
    this.recalculateResources();
    this.notify();
    return true;
  }

  mergeInventoryWithEquipped(invIndex, slotName) {
    const invItem = this.inventory[invIndex];
    const eqItem = this.equipment[slotName];
    if (!invItem || !eqItem) return false;
    if (!invItem.canMergeWith(eqItem)) return false;

    const merged = eqItem.withStars(eqItem.stars + 1);
    this.inventory.splice(invIndex, 1);
    this.equipment[slotName] = merged;
    this.recalculateResources();
    this.notify();
    return true;
  }

  sortInventory() {
    const rarityOrder = { rare: 0, uncommon: 1, common: 2 };
    const slotOrder = {
      hand: 0, helmet: 1, armor: 2, legs: 3, ring: 4, amulet: 5,
    };

    this.inventory.sort((a, b) => {
      const rDiff = (rarityOrder[a.rarity] ?? 9) - (rarityOrder[b.rarity] ?? 9);
      if (rDiff !== 0) return rDiff;

      if (a.stars !== b.stars) return b.stars - a.stars;

      const aSet = a.set_name || '';
      const bSet = b.set_name || '';
      if (aSet !== bSet) return aSet.localeCompare(bSet);

      const sDiff = (slotOrder[a.slot] ?? 9) - (slotOrder[b.slot] ?? 9);
      if (sDiff !== 0) return sDiff;

      return (a.name || '').localeCompare(b.name || '');
    });

    this.notify();
  }

  getFilteredInventory() {
    return this.inventory
      .map((item, index) => ({ item, index }))
      .filter(({ item }) => {
        if (this.filterRarity !== 'all' && item.rarity !== this.filterRarity) return false;
        if (this.filterSlot !== 'all' && item.slot !== this.filterSlot) return false;
        if (this.filterSet !== 'all' && item.set !== this.filterSet) return false;
        return true;
      });
  }

  // ============================================
  // Очки сетов
  // ============================================

  addSetPoint(setId) {
    if (!setId) return false;
    const current = this.setPoints[setId] || 0;
    if (current >= 6) return false;
    this.setPoints[setId] = current + 1;
    this.recalculateResources();
    this.notify();
    return true;
  }

  getSetPoints(setId) {
    return this.setPoints[setId] || 0;
  }

  // ============================================
  // Святилища
  // ============================================

  addSanctuaryBonus(bonus) {
    if (!bonus || !bonus.stat) return false;
    this.sanctuaryBonuses.push({
      id: bonus.id,
      name: bonus.name,
      stat: bonus.stat,
      value: bonus.value,
    });
    this.recalculateResources();
    this.notify();
    return true;
  }

  // ============================================
  // Сеты
  // ============================================

  getSetCounts() {
    const counts = {};
    for (const item of Object.values(this.equipment)) {
      if (!item || !item.set) continue;
      counts[item.set] = (counts[item.set] || 0) + 1;
    }
    for (const [setId, points] of Object.entries(this.setPoints)) {
      if (points > 0) {
        counts[setId] = (counts[setId] || 0) + points;
      }
    }
    return counts;
  }

  getActiveSetBonuses() {
    const counts = this.getSetCounts();
    const active = [];
    for (const [setId, count] of Object.entries(counts)) {
      const setData = this.setsData[setId];
      if (!setData) continue;

      const thresholds = Object.keys(setData.bonuses || {})
        .map(t => parseInt(t, 10))
        .sort((a, b) => a - b);

      let maxReached = 0;
      for (const t of thresholds) {
        if (count >= t) maxReached = t;
      }

      if (maxReached > 0) {
        active.push({
          set: setId,
          threshold: maxReached,
          effects: setData.bonuses[String(maxReached)] || [],
        });
      }
    }
    return active;
  }

  getActiveSetBonusesWithDescriptions() {
    const bonuses = this.getActiveSetBonuses();
    const result = [];
    for (const b of bonuses) {
      const setData = this.setsData[b.set];
      for (const e of b.effects) {
        result.push({
          set: b.set,
          setName: setData?.name || b.set,
          threshold: b.threshold,
          description: e.description || this._defaultRuleDescription(e),
          effect: e,
        });
      }
    }
    return result;
  }

  _defaultRuleDescription(e) {
    const map = {
      poison_decay_reduced: 'Яд теряет меньше стаков',
      reflect_heals: 'Отражение лечит',
      low_hp_damage_double: 'При низком HP урон ×2',
      crit_extra_hit: 'Крит даёт +1 удар',
      burn_splash: 'Горение наносит 50% урона соседним целям',
      vampirism_double: 'Вампиризм ×2',
      warrior_balance: 'Урон и броня +25%',
    };
    if (e.type === 'rule') return map[e.rule] || e.rule;
    return '';
  }

  _hasActiveRule(ruleName) {
    for (const bonus of this.getActiveSetBonuses()) {
      for (const e of bonus.effects) {
        if (e.type === 'rule' && e.rule === ruleName) return true;
      }
    }
    return false;
  }

  _getActiveRuleValue(ruleName, defaultValue) {
    for (const bonus of this.getActiveSetBonuses()) {
      for (const e of bonus.effects) {
        if (e.type === 'rule' && e.rule === ruleName) return e.value;
      }
    }
    return defaultValue;
  }

  // ============================================
  // Статы
  // ============================================

  getTotalStats() {
    const total = { ...BASE_STATS };

    for (const item of Object.values(this.equipment)) {
      if (!item) continue;
      const stats = item.getStats();
      for (const [key, value] of Object.entries(stats)) {
        if (key in total) total[key] += value;
      }
      const effects = item.getEffects();
      for (const e of effects) {
        if (e.effect === 'poison') total.poison_stacks += e.stacks;
        if (e.effect === 'burn')   total.burn_stacks   += e.stacks;
        if (e.effect === 'bleed')  total.bleed_stacks  += e.stacks;
      }
    }

    for (const bonus of this.getActiveSetBonuses()) {
      for (const effect of bonus.effects) {
        if (effect.type === 'stat' && effect.stat in total) {
          total[effect.stat] += effect.value;
        }
        if (effect.type === 'effect') {
          if (effect.effect === 'poison_on_hit') total.poison_stacks += effect.stacks;
          if (effect.effect === 'burn_on_hit')   total.burn_stacks   += effect.stacks;
        }
      }
    }

    if (this._hasActiveRule('warrior_balance')) {
      const value = this._getActiveRuleValue('warrior_balance', 25);
      const mult = 1 + value / 100;
      total.damage = Math.floor(total.damage * mult);
      total.armor = Math.floor(total.armor * mult);
    }

    for (const bonus of this.sanctuaryBonuses) {
      if (bonus.stat in total) {
        total[bonus.stat] += bonus.value;
      }
    }

    return total;
  }

  recalculateResources() {
    const stats = this.getTotalStats();
    const prevMaxHp = this.max_hp;
    const prevMaxArmor = this.max_armor;

    this.max_hp = stats.max_hp;
    this.max_armor = stats.armor;

    if (this.max_hp > prevMaxHp) this.hp += this.max_hp - prevMaxHp;
    if (this.hp > this.max_hp) this.hp = this.max_hp;

    if (this.max_armor > prevMaxArmor) this.armor += this.max_armor - prevMaxArmor;
    if (this.armor > this.max_armor) this.armor = this.max_armor;
  }

  // ============================================
  // Сброс и переходы
  // ============================================

  resetRun() {
    this.equipment = {
      helmet: null, armor: null, legs: null, ring: null,
      amulet: null, hand_right: null, hand_left: null,
    };
    this.inventory = [];

    this.hp = 100;
    this.max_hp = 100;
    this.armor = 10;
    this.max_armor = 10;

    this.potions = 3;
    this.effects = [];
    this.stage = 1;
    this.totalStages = 1;
    this.zone = 'dungeon';
    this.currentEnemies = [];

    this.setPoints = {};
    this.sanctuaryBonuses = [];

    this.filterRarity = 'all';
    this.filterSlot = 'all';
    this.filterSet = 'all';

    this.recalculateResources();
    this.notify();
  }

  nextStage() {
    this.stage += 1;
    this.totalStages += 1;
    this.armor = this.max_armor;
    this.effects = [];
    this.notify();
  }

  nextZone(newZoneId) {
    this.zone = newZoneId || this.zone;
    this.stage = 1;
    // totalStages НЕ сбрасывается
    this.hp = this.max_hp;
    this.armor = this.max_armor;
    this.effects = [];
    this.notify();
  }
    serialize() {
    return {
      zone: this.zone,
      stage: this.stage,
      totalStages: this.totalStages,

      hp: this.hp,
      max_hp: this.max_hp,
      armor: this.armor,
      max_armor: this.max_armor,

      potions: this.potions,

      effects: this.effects.map(e => ({ ...e })),

      equipment: {
        helmet:     this.equipment.helmet     ? this.equipment.helmet.toJSON()     : null,
        armor:      this.equipment.armor      ? this.equipment.armor.toJSON()      : null,
        legs:       this.equipment.legs       ? this.equipment.legs.toJSON()       : null,
        ring:       this.equipment.ring       ? this.equipment.ring.toJSON()       : null,
        amulet:     this.equipment.amulet     ? this.equipment.amulet.toJSON()     : null,
        hand_right: this.equipment.hand_right ? this.equipment.hand_right.toJSON() : null,
        hand_left:  this.equipment.hand_left  ? this.equipment.hand_left.toJSON()  : null,
      },

      inventory: this.inventory.map(i => i.toJSON()),

      setPoints: { ...this.setPoints },
      sanctuaryBonuses: this.sanctuaryBonuses.map(b => ({ ...b })),
    };
  }

  deserialize(data) {
    if (!data) return false;

    this.zone = data.zone || 'dungeon';
    this.stage = data.stage || 1;
    this.totalStages = data.totalStages || 1;

    this.hp = data.hp ?? 100;
    this.max_hp = data.max_hp ?? 100;
    this.armor = data.armor ?? 10;
    this.max_armor = data.max_armor ?? 10;

    this.potions = data.potions ?? 3;

    this.effects = (data.effects || []).map(e => ({ ...e }));

    this.equipment = {
      helmet:     Item.fromJSON(data.equipment?.helmet),
      armor:      Item.fromJSON(data.equipment?.armor),
      legs:       Item.fromJSON(data.equipment?.legs),
      ring:       Item.fromJSON(data.equipment?.ring),
      amulet:     Item.fromJSON(data.equipment?.amulet),
      hand_right: Item.fromJSON(data.equipment?.hand_right),
      hand_left:  Item.fromJSON(data.equipment?.hand_left),
    };

    this.inventory = (data.inventory || []).map(d => Item.fromJSON(d)).filter(Boolean);

    this.setPoints = { ...(data.setPoints || {}) };
    this.sanctuaryBonuses = (data.sanctuaryBonuses || []).map(b => ({ ...b }));

    this.currentEnemies = [];

    this.notify();
    return true;
  }
}

export const GameState = new GameStateClass();