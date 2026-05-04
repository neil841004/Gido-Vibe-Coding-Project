// =====================================================================
// config.js — 全域數值與遊戲狀態 (移除 2P/duo 配置，僅保留 Ultra 4P)
// 對應 Unity: ScriptableObject + Singleton GameState
// =====================================================================

const CONFIG = {
    // 角色基礎數值
    stats: {
        playerHP: 200,
        structureHPBase: 0.5,
        hpDecayRate: 2,
        hpDecayRateBeam: 6
    },

    enemy: {
        maxEnemies: 10,
        spawnRate: 2.6,                  // Quad 原值
        melee: {
            hp: 24, damage: 4, speed: 3, attackRange: 2.0, attackRate: 1.0,
            color: 0xff4444, spawnWeight: 52
        },
        ranged: {
            hp: 6, damage: 6, speed: 2, attackRange: 15.0, attackRate: 2.0,
            projectileSpeed: 15, color: 0xaa44ff, spawnWeight: 26
        },
        ninja: {
            hp: 9, damage: 8, speed: 4.0, attackRange: 2.5, attackRate: 2.0,
            teleportDist: 8, warningTime: 1.0,
            color: 0x222222, spawnWeight: 18
        },
        boss: {
            hp: 600, damage: 25, speed: 2.0, attackRange: 4.0,
            spawnDelay: 50, projectileSpeed: 18, projectileKnockback: 42,
            color: 0x8800ff
        }
    },

    movement: {
        maxSpeed: 7,
        acceleration: 7,
        friction: 10,
        traction: 100,
        rotationSpeed: 2.5
    },

    combat: {
        meleeDamage: 25,
        attackRange: 2.5,
        windupTime: 0.2,
        recoveryTime: 0.4,
        cooldown: 0.6,
        recoilForce: 10,
        knockbackBase: 0.2
    },

    bullet: {
        single: {
            damage: 6, size: 0.4,
            speedMin: 18, speedMax: 22,
            lifeMin: 0.9, lifeMax: 1.3,
            spread: 0.4, gravity: 25,
            penetration: 0, recoil: 0, knockback: 6
        }
    },

    // 合體技 (光束) — Phase 1: CD 改為 15 秒
    combo: {
        cooldown: 15.0,                   // [Phase 1 變更] 合體技冷卻
        preCastDelay: 2.3,
        vineSpeed: 2.0,
        moveSpeedFactor: 0.5,
        dotInterval: 0.5,
        dotDamage: 8,
        maxVineCount: 6,
        activeDuration: 7.0,              // 原 quad 值
        radius: 12.0,
        vineCount: 4
    },

    beam: {
        damagePerTick: 7,
        damageScale: 1.6,
        tickInterval: 0.1,
        range: 25,
        preFireDelay: 0.5,
        firingDuration: 3,
        postFireDelay: 0.6,
        decayRate: 25,
        maxCharge: 200,                  // 原 quad 值
        chargeRates: [0, 50, 150, 250, 500],
        width: 0.8
    },

    visuals: {
        arrowLength: 4,
        colors: {
            p1: 0xff4444,
            p2: 0x4444ff,
            p3: 0xff69b4,
            p4: 0x00ffff,
            body: 0x44aa44,
            head: 0x44aa44,
            mouth: 0x00ffff,
            beam: 0xff00ff,
            indicatorSpacing: 3.5
        }
    }
};

// --- 全域遊戲狀態 ---
const state = {
    // 合體技冷卻 (Phase 1: 新增可運作的 CD 機制)
    comboCooldown: 0,
    comboCooldownMax: CONFIG.combo.cooldown,

    // 4P (Ultra) 是唯一模式
    playerCount: 4,

    input: {
        p1: { move: null, attack: false, charge: false },
        p2: { move: null, attack: false, charge: false },
        p3: { move: null, attack: false, charge: false },
        p4: { move: null, attack: false, charge: false }
    },

    bullets: [],
    particles: [],
    flyingCorpses: [],
    meatChunks: [],

    comboActive: false,

    beamCharge: 0,
    beamPhase: 'idle',
    beamPreFireTimer: 0,
    beamFiringTimer: 0,
    beamPostFireTimer: 0,
    beamDotTimer: 0,
    hpDecayEnabled: false,

    // Phase 1: Dummy 開關狀態 (true = 場上有 Dummy)
    dummyEnabled: true,

    // Spawner 開關
    spawnerEnabled: false,

    lastTime: 0
};
