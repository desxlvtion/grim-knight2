import { GameState } from './GameState.js';
import { runMythicHook } from './MythicRules.js';

const MAX_ENEMIES = 3;
const HIT_DELAY = 400;
const ENEMY_DELAY = 400;
const PLAYER_TO_ENEMY = 1000;

export class Battle {
  constructor() {
    this.enemies = [];
    this.onEnemyUpdate = null;
    this.onPlayerUpdate = null;
    this.onBattleEnd = null;
    this.onEvent = null;
    this.onLog = null;
    this._ended = false;
    this._busy = false;
    this.isBoss = false;
    this._mythicWindBonus = 0;
  }

  log(text) {
    if (this.onLog) this.onLog(text);
  }

  start(enemiesData) {
    const trimmed = enemiesData.slice(0, MAX_ENEMIES);
    this.enemies = trimmed.map(e => ({
      sprite: e.sprite,
      archetype: e.archetype,
      hp: e.hp,
      max_hp: e.max_hp,
      damage: e.damage,
      armor: e.armor,
      max_armor: e.max_armor,
      speed: e.speed,
      effects: [],
      _justDied: false,
      is_boss: e.is_boss === true,
    }));
    this.isBoss = trimmed.length === 1 && trimmed[0].is_boss === true;
    this._ended = false;
    this._busy = false;
    this._mythicWindBonus = 0;
  }

  emit(event) { if (this.onEvent) this.onEvent(event); }
  isBusy() { return this._busy || this._ended; }

  playerAttack(enemyIndex) {
    if (this._ended || this._busy) return;
    const enemy = this.enemies[enemyIndex];
    if (!enemy || enemy.hp <= 0) return;

    this._busy = true;

    const stats = GameState.getTotalStats();
    const effectiveSpeed = stats.speed + (this._mythicWindBonus || 0);
    const hits = this._calculateHits(effectiveSpeed);

    const MAX_HITS = 5;   // максимум ударов за одну атаку (для серии критов)

    let totalHits = hits.total;
    if (hits.chance > 0 && Math.random() < hits.chance) totalHits += 1;

    // Ограничиваем начальное число ударов
    totalHits = Math.min(totalHits, MAX_HITS);

    let hitNumber = 0;

    const nextHit = () => {
      if (this._ended) return;

      if (enemy.hp <= 0) {
        if (!enemy._justDied) {
          enemy._justDied = true;
          this.emit({ type: 'enemy_died', enemyIndex });

          // Mythic: Печать отчаяния — яд переходит живому
          runMythicHook('onEnemyKilled', {
            enemy,
            enemyIndex,
            enemies: this.enemies,
            addEffect: (target, effect, stacks) => this._addEffect(target, effect, stacks),
            emit: (ev) => this.emit(ev),
            battle: this,
          });
        }
        this.onEnemyUpdate?.(enemy, enemyIndex);

        // Mythic: Бастион веры — восстановление брони
        runMythicHook('onAfterPlayerAttack', { stats, battle: this });

        setTimeout(() => this.enemyTurnSequence(), PLAYER_TO_ENEMY);
        return;
      }

      if (hitNumber >= totalHits) {
        this.onEnemyUpdate?.(enemy, enemyIndex);

        // Mythic: Бастион веры — восстановление брони
        runMythicHook('onAfterPlayerAttack', { stats, battle: this });

        if (this._checkWin()) return;
        setTimeout(() => this.enemyTurnSequence(), PLAYER_TO_ENEMY);
        return;
      }

      const result = this._applyPlayerHit(enemy, stats);

      this.emit({
        type: 'player_hit',
        enemyIndex,
        damage: result.damage,
        isCrit: result.isCrit,
        hitNumber: hitNumber + 1,
      });

      if (enemy.hp <= 0 && !enemy._justDied) {
        enemy._justDied = true;
        this.emit({ type: 'enemy_died', enemyIndex });

        // Mythic: Печать отчаяния — яд переходит живому
        runMythicHook('onEnemyKilled', {
          enemy,
          enemyIndex,
          enemies: this.enemies,
          addEffect: (target, effect, stacks) => this._addEffect(target, effect, stacks),
          emit: (ev) => this.emit(ev),
          battle: this,
        });
      }

      this.onEnemyUpdate?.(enemy, enemyIndex);

      // Крит даёт +1 удар, но не больше MAX_HITS
      if (
        result.isCrit &&
        this._hasRule('crit_extra_hit') &&
        enemy.hp > 0 &&
        totalHits < MAX_HITS
      ) {
        totalHits += 1;
      }

      // Mythic: Клинок ветра — +5% скорости за удар
      runMythicHook('onAfterEachHit', {
        stats,
        hitNumber: hitNumber + 1,
        battle: this,
      });

      hitNumber++;
      setTimeout(nextHit, HIT_DELAY);
    };

    nextHit();
  }

  enemyTurnSequence() {
    if (this._ended) return;

    const aliveEnemies = this.enemies
      .map((e, i) => ({ enemy: e, index: i }))
      .filter(({ enemy }) => enemy.hp > 0);

    if (aliveEnemies.length === 0) {
      this._busy = false;
      this._checkWin();
      return;
    }

    let i = 0;

    const nextEnemy = () => {
      if (this._ended) return;
      if (GameState.hp <= 0) {
        this._busy = false;
        this._checkLose();
        return;
      }

      while (i < aliveEnemies.length && aliveEnemies[i].enemy.hp <= 0) i++;

      if (i >= aliveEnemies.length) {
        this.tickEffects();
        this.applyRegen();
        this.decayEffects();
        this._sendUpdates();

        if (this._checkLose()) return;
        if (this._checkWin()) return;

        this._busy = false;
        this._sendUpdates();
        return;
      }

      const { enemy, index } = aliveEnemies[i];
      const hits = this._calculateHits(enemy.speed);
      let totalDealt = 0;

      for (let h = 0; h < hits.total; h++) {
        totalDealt += this._applyEnemyHit(enemy);
        if (GameState.hp <= 0) break;
      }
      if (hits.chance > 0 && Math.random() < hits.chance && GameState.hp > 0) {
        totalDealt += this._applyEnemyHit(enemy);
      }

      this.emit({
        type: 'enemy_hit',
        enemyIndex: index,
        damage: totalDealt,
      });

      this.onPlayerUpdate?.();

      i++;
      setTimeout(nextEnemy, ENEMY_DELAY);
    };

    nextEnemy();
  }

  _calculateHits(speed) {
    const guaranteed = Math.max(1, Math.floor(speed / 100));
    const chance = (speed % 100) / 100;
    return { total: guaranteed, chance };
  }

  _applyPlayerHit(enemy, stats) {
    let rawDamage = stats.damage;

    // Mythic: Кровавый пакт и др. — модификаторы урона
    const modified = runMythicHook('modifyPlayerDamage', {
      damage: rawDamage,
      stats,
      battle: this,
    }, { chain: true });
    if (modified !== undefined) rawDamage = modified;

    if (this._hasRule('low_hp_damage_double')) {
      const threshold = this._getRuleValue('low_hp_damage_double', 30);
      if (GameState.hp / GameState.max_hp < threshold / 100) {
        rawDamage *= 2;
      }
    }

    let isCrit = false;
    if (stats.crit_chance > 0 && Math.random() * 100 < stats.crit_chance) {
      isCrit = true;
      rawDamage = Math.floor(rawDamage * (stats.crit_damage / 100));
    }

    let remaining = rawDamage;
    if (enemy.armor > 0) {
      const absorbed = Math.min(enemy.armor, remaining);
      enemy.armor -= absorbed;
      remaining -= absorbed;
    }
    enemy.hp = Math.max(0, enemy.hp - remaining);

    const enemyIndex = this.enemies.indexOf(enemy);

    if (stats.poison_stacks > 0) {
      this._addEffect(enemy, 'poison', stats.poison_stacks);
      this.emit({
        type: 'effect_applied',
        enemyIndex,
        effect: 'poison',
        stacks: stats.poison_stacks,
      });
    }

    if (stats.burn_stacks > 0) {
      this._addEffect(enemy, 'burn', stats.burn_stacks);
      this.emit({
        type: 'effect_applied',
        enemyIndex,
        effect: 'burn',
        stacks: stats.burn_stacks,
      });

      if (this._hasRule('burn_splash')) {
        const splashPercent = this._getRuleValue('burn_splash', 50);
        const splashStacks = Math.floor(stats.burn_stacks * splashPercent / 100);
        if (splashStacks > 0) {
          for (let j = 0; j < this.enemies.length; j++) {
            if (j === enemyIndex) continue;
            const other = this.enemies[j];
            if (other.hp <= 0) continue;
            this._addEffect(other, 'burn', splashStacks);
            this.emit({
              type: 'effect_applied',
              enemyIndex: j,
              effect: 'burn',
              stacks: splashStacks,
            });
          }
        }
      }

      const burnEff = enemy.effects.find(e => e.effect === 'burn');
      if (burnEff && burnEff.stacks >= 10) {
        const explosionDamage = rawDamage * 3;

        enemy.hp = Math.max(0, enemy.hp - explosionDamage);
        burnEff.stacks = 0;

        this.emit({
          type: 'burn_explosion',
          enemyIndex,
          damage: explosionDamage,
        });

        if (enemy.hp <= 0 && !enemy._justDied) {
          enemy._justDied = true;
          this.emit({ type: 'enemy_died', enemyIndex });
        }
      }
    }

    let vampirism = stats.vampirism;
    if (this._hasRule('vampirism_double')) {
      vampirism *= 2;
    }
    if (vampirism > 0) {
      const heal = Math.floor(rawDamage * vampirism / 100);
      if (heal > 0) {
        const before = GameState.hp;
        GameState.hp = Math.min(GameState.max_hp, GameState.hp + heal);
        const actualHeal = GameState.hp - before;
        if (actualHeal > 0) {
          this.emit({ type: 'vampirism_heal', amount: actualHeal });
          this.onPlayerUpdate?.();
        }
      }
    }

    return { damage: rawDamage, isCrit };
  }

  _applyEnemyHit(enemy) {
    const stats = GameState.getTotalStats();
    const enemyIndex = this.enemies.indexOf(enemy);

    // Уклонение — шанс полностью избежать удара (макс 50%)
    const evasionPercent = Math.min(50, stats.evasion || 0);
    if (evasionPercent > 0 && Math.random() * 100 < evasionPercent) {
      this.emit({ type: 'evade', enemyIndex });

      // Mythic: Сапоги танца — ответный удар
      runMythicHook('onPlayerEvade', {
        attacker: enemy,
        attackerIndex: enemyIndex,
        stats,
        dealRawDamage: (target, dmg) => this._dealRawDamage(target, dmg),
        emit: (ev) => this.emit(ev),
        battle: this,
      });

      return 0;
    }

    // Mythic: Броня очищения — атакующий получает 50% от своей атаки
    runMythicHook('onEnemyAttack', {
      attacker: enemy,
      attackerIndex: enemyIndex,
      rawDamage: enemy.damage,
      dealRawDamage: (target, dmg) => this._dealRawDamage(target, dmg),
      emit: (ev) => this.emit(ev),
      battle: this,
    });

    // Mythic: Корона проклятия — атакующий получает яд и горение
    runMythicHook('onEnemyHit', {
      attacker: enemy,
      attackerIndex: enemyIndex,
      stats,
      addEffect: (target, effect, stacks) => this._addEffect(target, effect, stacks),
      emit: (ev) => this.emit(ev),
      battle: this,
    });

    let remaining = enemy.damage;

    // Сопротивление — снижает входящий урон (макс 50%)
    const resistPercent = Math.min(50, stats.resist || 0);
    if (resistPercent > 0) {
      remaining = remaining * (1 - resistPercent / 100);
      remaining = Math.round(remaining);
    }

    let totalDamage = 0;

    // Броня
    if (GameState.armor > 0) {
      const absorbed = Math.min(GameState.armor, remaining);
      GameState.armor -= absorbed;
      remaining -= absorbed;
    }

    // HP
    if (remaining > 0) {
      GameState.hp = Math.max(0, GameState.hp - remaining);
      totalDamage = remaining;
    }

    // Отражение
    const reflectPercent = stats.reflect;
    if (reflectPercent > 0 && totalDamage > 0) {
      const reflected = Math.floor(totalDamage * reflectPercent / 100);
      if (reflected > 0) {
        enemy.hp = Math.max(0, enemy.hp - reflected);

        this.emit({
          type: 'reflect_damage',
          enemyIndex,
          damage: reflected,
        });

        if (this._hasRule('reflect_heals')) {
          const healPercent = this._getRuleValue('reflect_heals', 50);
          const heal = Math.floor(reflected * healPercent / 100);
          if (heal > 0) {
            const before = GameState.hp;
            GameState.hp = Math.min(GameState.max_hp, GameState.hp + heal);
            const actualHeal = GameState.hp - before;
            if (actualHeal > 0) {
              this.emit({ type: 'vampirism_heal', amount: actualHeal });
            }
          }
        }

        if (enemy.hp <= 0 && !enemy._justDied) {
          enemy._justDied = true;
          this.emit({ type: 'enemy_died', enemyIndex });

          // Mythic: Печать отчаяния — яд переходит живому
          runMythicHook('onEnemyKilled', {
            enemy,
            enemyIndex,
            enemies: this.enemies,
            addEffect: (target, effect, stacks) => this._addEffect(target, effect, stacks),
            emit: (ev) => this.emit(ev),
            battle: this,
          });
        }
      }
    }

    return totalDamage;
  }

  /**
   * Наносит «сырой» урон по врагу: только через броню и HP,
   * без критов, без эффектов, без модификаторов игрока.
   * Используется mythic-правилами (Сапоги танца, Броня очищения).
   */
  _dealRawDamage(enemy, damage) {
    if (!enemy || enemy.hp <= 0) return 0;
    if (damage <= 0) return 0;

    let remaining = damage;
    if (enemy.armor > 0) {
      const absorbed = Math.min(enemy.armor, remaining);
      enemy.armor -= absorbed;
      remaining -= absorbed;
    }
    enemy.hp = Math.max(0, enemy.hp - remaining);

    if (enemy.hp <= 0 && !enemy._justDied) {
      enemy._justDied = true;
      const idx = this.enemies.indexOf(enemy);
      this.emit({ type: 'enemy_died', enemyIndex: idx });

      // Mythic: Печать отчаяния — яд переходит живому
      runMythicHook('onEnemyKilled', {
        enemy,
        enemyIndex: idx,
        enemies: this.enemies,
        addEffect: (target, effect, stacks) => this._addEffect(target, effect, stacks),
        emit: (ev) => this.emit(ev),
        battle: this,
      });
    }

    return remaining;
  }

  tickEffects() {
    for (const eff of GameState.effects) {
      if (eff.stacks > 0) {
        GameState.hp = Math.max(0, GameState.hp - eff.stacks);
        this.emit({
          type: 'player_effect_tick',
          effect: eff.effect,
          damage: eff.stacks,
        });
      }
    }

    for (let i = 0; i < this.enemies.length; i++) {
      const enemy = this.enemies[i];
      if (enemy.hp <= 0) continue;

      for (const eff of enemy.effects) {
        if (eff.stacks <= 0) continue;
        if (eff.effect === 'burn') continue;

        enemy.hp = Math.max(0, enemy.hp - eff.stacks);
        this.emit({
          type: 'enemy_effect_tick',
          enemyIndex: i,
          effect: eff.effect,
          damage: eff.stacks,
        });
      }

      if (enemy.hp <= 0 && !enemy._justDied) {
        enemy._justDied = true;
        this.emit({ type: 'enemy_died', enemyIndex: i });

        // Mythic: Печать отчаяния — яд переходит живому
        runMythicHook('onEnemyKilled', {
          enemy,
          enemyIndex: i,
          enemies: this.enemies,
          addEffect: (target, effect, stacks) => this._addEffect(target, effect, stacks),
          emit: (ev) => this.emit(ev),
          battle: this,
        });
      }
    }
  }

  applyRegen() {
    const stats = GameState.getTotalStats();
    const regen = stats.regen;
    if (regen > 0 && GameState.hp > 0 && GameState.hp < GameState.max_hp) {
      const before = GameState.hp;
      GameState.hp = Math.min(GameState.max_hp, GameState.hp + regen);
      const actual = GameState.hp - before;
      if (actual > 0) {
        this.emit({ type: 'regen_tick', amount: actual });
        this.onPlayerUpdate?.();
      }
    }
  }

  decayEffects() {
    const poisonDecayMultiplier = this._hasRule('poison_decay_reduced') ? 0.75 : 0.5;

    for (const eff of GameState.effects) {
      if (eff.effect === 'poison') {
        eff.stacks = Math.floor(eff.stacks * poisonDecayMultiplier);
      } else {
        eff.stacks = Math.floor(eff.stacks * 0.5);
      }
    }
    GameState.effects = GameState.effects.filter(e => e.stacks > 0);

    for (const enemy of this.enemies) {
      for (const eff of enemy.effects) {
        if (eff.effect === 'burn') continue;
        if (eff.effect === 'poison') {
          eff.stacks = Math.floor(eff.stacks * poisonDecayMultiplier);
        } else {
          eff.stacks = Math.floor(eff.stacks * 0.5);
        }
      }
      enemy.effects = enemy.effects.filter(e => e.stacks > 0 || e.effect === 'burn');
    }
  }

  _hasRule(ruleName) {
    for (const bonus of GameState.getActiveSetBonuses()) {
      for (const e of bonus.effects) {
        if (e.type === 'rule' && e.rule === ruleName) return true;
      }
    }
    return false;
  }

  _getRuleValue(ruleName, defaultValue) {
    for (const bonus of GameState.getActiveSetBonuses()) {
      for (const e of bonus.effects) {
        if (e.type === 'rule' && e.rule === ruleName) return e.value;
      }
    }
    return defaultValue;
  }

  _addEffect(target, effectName, stacks) {
    let eff = target.effects.find(e => e.effect === effectName);
    if (!eff) {
      eff = { effect: effectName, stacks: 0 };
      target.effects.push(eff);
    }
    eff.stacks += stacks;
  }

  _checkWin() {
    const alive = this.enemies.some(e => e.hp > 0);
    if (!alive) {
      this._ended = true;
      this._busy = false;
      this._mythicWindBonus = 0;
      this.onBattleEnd?.('win');
      return true;
    }
    return false;
  }

  _checkLose() {
    if (GameState.hp <= 0) {
      this._ended = true;
      this._busy = false;
      this._mythicWindBonus = 0;
      this.onBattleEnd?.('lose');
      return true;
    }
    return false;
  }

  _sendUpdates() {
    this.onPlayerUpdate?.();
    for (let i = 0; i < this.enemies.length; i++) {
      this.onEnemyUpdate?.(this.enemies[i], i);
    }
  }

  drinkPotion() {
    if (GameState.potions <= 0) return false;
    const heal = Math.floor(GameState.max_hp * 0.3);
    GameState.potions -= 1;
    GameState.hp = Math.min(GameState.max_hp, GameState.hp + heal);
    this.emit({ type: 'potion_used', heal });
    this.onPlayerUpdate?.();
    return true;
  }
}