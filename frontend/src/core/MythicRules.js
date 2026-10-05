// ============================================
// MythicRules — уникальные способности
// мифических предметов.
//
// Каждое правило — объект с хуками. Battle.js
// вызывает нужный хук у всех активных правил.
//
// Активные правила = те, чьи set_id присутствуют
// в экипировке (через getActiveSetBonuses()).
// ============================================

// ============================================
// Хуки (что может быть у правила):
//
//   modifyPlayerDamage({ damage, stats })          → number
//   modifyEnemyDamage({ damage, stats, attacker }) → number
//   onPlayerHit({ enemy, enemyIndex, stats, addEffect, emit, battle })
//   onEnemyHit({ attacker, attackerIndex, stats, battle })
//   onEnemyKilled({ enemy, enemyIndex, enemies, addEffect, emit })
//   onPlayerEvade({ attacker, attackerIndex, stats, dealRawDamage, emit })
//   onAfterPlayerAttack({ stats, battle })
//   onAfterEachHit({ stats, hitNumber, battle })
//
// Хуки вызываются из Battle.js. Если правило
// не определяет хук — ничего не происходит.
// ============================================

// ============================================
// 1. Корона проклятия
// При получении урона героем атакующий
// получает 10 стаков яда и 5 горения.
// ============================================
const CurseCrownRule = {
  onEnemyHit({ attacker, addEffect, emit, battle }) {
    addEffect(attacker, 'poison', 10);
    addEffect(attacker, 'burn', 5);

    const idx = battle.enemies.indexOf(attacker);
    if (idx >= 0) {
      emit({ type: 'effect_applied', enemyIndex: idx, effect: 'poison', stacks: 10 });
      emit({ type: 'effect_applied', enemyIndex: idx, effect: 'burn', stacks: 5 });
    }
  },
};

// ============================================
// 2. Кровавый пакт
// Урон героя × (1 + вампиризм/100)
// ============================================
const BloodPactRule = {
  modifyPlayerDamage({ damage, stats }) {
    const vamp = stats.vampirism || 0;
    if (vamp <= 0) return damage;
    return Math.floor(damage * (1 + vamp / 100));
  },
};

// ============================================
// 3. Печать отчаяния
// При смерти врага его яд переходит
// случайному живому врагу.
// ============================================
const DespairSealRule = {
  onEnemyKilled({ enemy, enemyIndex, enemies, addEffect, emit }) {
    const poisonEff = enemy.effects?.find(e => e.effect === 'poison');
    if (!poisonEff || poisonEff.stacks <= 0) return;

    const alive = enemies
      .map((e, i) => ({ e, i }))
      .filter(({ e, i }) => i !== enemyIndex && e.hp > 0);

    if (alive.length === 0) return;

    const target = alive[Math.floor(Math.random() * alive.length)];
    addEffect(target.e, 'poison', poisonEff.stacks);
    emit({
      type: 'effect_applied',
      enemyIndex: target.i,
      effect: 'poison',
      stacks: poisonEff.stacks,
    });
  },
};

// ============================================
// 4. Клинок ветра
// После каждого удара в серии:
// speed_bonus += base_speed * 0.05
// Сбрасывается после боя.
// ============================================
const WindBladeRule = {
  onAfterEachHit({ stats, battle }) {
    if (!battle._mythicWindBonus) battle._mythicWindBonus = 0;

    // базовый speed героя = stats.speed минус уже накопленный бонус
    const baseSpeed = stats.speed - battle._mythicWindBonus;
    battle._mythicWindBonus += baseSpeed * 0.05;
  },

  modifyPlayerDamage({ damage, battle }) {
    // сам бонус скорости не влияет на урон, только на число ударов
    return damage;
  },
};

// ============================================
// 5. Бастион веры
// После полной атаки героя: если броня не полная,
// восстановить 10% макс. брони.
// ============================================
const FaithBastionRule = {
  onAfterPlayerAttack({ battle }) {
    const max = window.GameState ? window.GameState.max_armor : 0;
    const cur = window.GameState ? window.GameState.armor : 0;
    if (max <= 0) return;
    if (cur >= max) return;

    const heal = Math.floor(max * 0.1);
    if (heal <= 0) return;

    window.GameState.armor = Math.min(max, cur + heal);
    battle.emit({ type: 'armor_regen', amount: window.GameState.armor - cur });
  },
};

// ============================================
// 6. Сапоги танца
// При уклонении героя — ответный удар
// базовым stats.damage по атакующему.
// ============================================
const DanceBootsRule = {
  onPlayerEvade({ attacker, attackerIndex, stats, dealRawDamage, emit }) {
    const dmg = stats.damage || 0;
    if (dmg <= 0) return;

    dealRawDamage(attacker, dmg);
    emit({
      type: 'player_hit',
      enemyIndex: attackerIndex,
      damage: dmg,
      isCrit: false,
      hitNumber: 1,
      isCounter: true,
    });
  },
};

// ============================================
// 7. Броня очищения
// При атаке врага по герою атакующий
// получает 50% от своей атаки (до resist/armor героя).
// ============================================
const PurityArmorRule = {
  onEnemyAttack({ attacker, attackerIndex, rawDamage, dealRawDamage, emit }) {
    const reflect = Math.floor(rawDamage * 0.5);
    if (reflect <= 0) return;

    dealRawDamage(attacker, reflect);
    emit({
      type: 'purity_reflect',
      enemyIndex: attackerIndex,
      damage: reflect,
    });
  },
};

// ============================================
// Реестр
// ============================================
export const MYTHIC_RULES = {
  mythic_curse_crown:   CurseCrownRule,
  mythic_blood_pact:    BloodPactRule,
  mythic_despair_seal:  DespairSealRule,
  mythic_wind_blade:    WindBladeRule,
  mythic_faith_bastion: FaithBastionRule,
  mythic_dance_boots:   DanceBootsRule,
  mythic_purity_armor:  PurityArmorRule,
};

// ============================================
// Утилиты
// ============================================

/**
 * Возвращает массив активных mythic-правил
 * по текущей экипировке.
 */
export function getActiveMythicRules() {
  const GS = window.GameState;
  if (!GS) return [];

  const active = [];
  const seen = new Set();

  for (const bonus of GS.getActiveSetBonuses()) {
    for (const e of bonus.effects) {
      if (e.type !== 'rule') continue;
      if (!MYTHIC_RULES[e.rule]) continue;
      if (seen.has(e.rule)) continue;
      seen.add(e.rule);
      active.push({ id: e.rule, rule: MYTHIC_RULES[e.rule] });
    }
  }

  return active;
}

/**
 * Вызывает хук у всех активных правил.
 * Возвращает первое не-undefined значение
 * (для modify* хуков).
 */
export function runMythicHook(hookName, ctx, { chain = false } = {}) {
  const rules = getActiveMythicRules();
  let result;

  for (const { rule } of rules) {
    const fn = rule[hookName];
    if (typeof fn !== 'function') continue;

    if (chain) {
      // для modify* — каждый следующий получает результат предыдущего
      ctx = { ...ctx, damage: result !== undefined ? result : ctx.damage };
      result = fn(ctx);
    } else {
      fn(ctx);
    }
  }

  return result;
}