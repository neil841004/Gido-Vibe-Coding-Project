// =====================================================================
// config.js — 全域數值與遊戲狀態 (移除 2P/duo 配置，僅保留 Ultra 4P)
// 對應 Unity: ScriptableObject + Singleton GameState
// =====================================================================

const CONFIG = {
    // -----------------------------------------------------------------
    // 角色 / 世界基礎數值
    // -----------------------------------------------------------------
    stats: {
        playerHP: 200,          // 玩家融合獸基礎最大血量
        structureHPBase: 0.5,   // 可破壞障礙物 HP 係數，會乘上體積
        hpDecayRate: 2,         // 開啟敵人生成後，每秒自然扣血量
        hpDecayRateBeam: 6      // 光束施放期間，每秒自然扣血量
    },

    // -----------------------------------------------------------------
    // 敵人與生成設定
    // -----------------------------------------------------------------
    enemy: {
        maxEnemies: 10,          // 場上同時存在的一般敵人上限
        spawnRate: 2.6,          // 一般敵人生成間隔秒數，Quad 原值

        // 近戰敵人：靠近後直接攻擊
        melee: {
            hp: 24,              // 血量
            damage: 4,           // 每次攻擊傷害
            speed: 3,            // 移動速度
            attackRange: 2.0,    // 進入攻擊的距離
            attackRate: 1.0,     // 攻擊冷卻秒數
            color: 0xff4444,     // 顯示顏色
            spawnWeight: 52      // 生成權重
        },

        // 遠程敵人：保持距離並發射投射物
        ranged: {
            hp: 6,               // 血量
            damage: 6,           // 投射物傷害
            speed: 2,            // 移動速度
            attackRange: 15.0,   // 進入射擊的距離
            attackRate: 2.0,     // 射擊冷卻秒數
            projectileSpeed: 15, // 投射物速度
            color: 0xaa44ff,     // 顯示顏色
            spawnWeight: 26      // 生成權重
        },

        // 忍者敵人：靠近後瞬移至背後並預警攻擊
        ninja: {
            hp: 9,               // 血量
            damage: 8,           // 斬擊傷害
            speed: 4.0,          // 移動速度
            attackRange: 2.5,    // 一般追擊攻擊距離
            attackRate: 2.0,     // 保留用攻擊冷卻秒數
            teleportDist: 8,     // 觸發瞬移的距離
            warningTime: 1.0,    // 瞬移後攻擊前預警秒數
            color: 0x222222,     // 顯示顏色
            spawnWeight: 18      // 生成權重
        },

        // Boss：遊走並發射追蹤彈
        boss: {
            hp: 600,                 // 血量
            damage: 25,              // 保留用近戰傷害
            speed: 2.0,              // 移動速度
            attackRange: 4.0,        // 基底攻擊距離，Boss 內會覆寫成飛彈範圍
            spawnDelay: 50,          // Spawner 開啟後延遲生成 Boss 的秒數
            projectileSpeed: 18,     // Boss 追蹤彈速度
            projectileKnockback: 42, // Boss 追蹤彈擊退力
            color: 0x8800ff          // 顯示顏色
        }
    },

    // -----------------------------------------------------------------
    // 玩家移動手感
    // -----------------------------------------------------------------
    movement: {
        maxSpeed: 7,        // 最高移動速度
        acceleration: 7,    // 加速度
        friction: 10,       // 無輸入時的減速力
        traction: 100,      // 速度方向貼齊面向方向的速度
        rotationSpeed: 2.5  // 轉向速度
    },

    // -----------------------------------------------------------------
    // 近戰 / 頭部蓄力攻擊
    // -----------------------------------------------------------------
    combat: {
        meleeDamage: 25,                    // 基礎近戰傷害
        attackRange: 2.5,                   // 近戰命中半徑
        windupTime: 0.2,                    // 輕攻擊 / 蓄力按下後往後擺的前搖秒數
        recoveryTime: 0.4,                  // 輕攻擊後搖秒數
        heavyWindupTime: 0.16,              // 保留用重攻擊前搖秒數
        heavyRecoveryTime: 0.9,             // 重攻擊後搖秒數，期間禁止移動輸入
        cooldown: 0.6,                      // 攻擊基礎冷卻秒數
        recoilForce: 10,                    // 保留用玩家反作用力
        knockbackBase: 0.2,                 // 傷害轉換為擊退的基礎倍率
        chargePreviewTime: 0.5,             // 按住多久後顯示落點預判
        heavyChargeTime: 0.5,               // 按住多久後視為蓄力攻擊完成
        heavyDamageScale: 2.0,              // 蓄力攻擊傷害倍率
        heavyRadiusScale: 1.25,             // 蓄力攻擊範圍倍率
        chargeAimRadius: 6.0,               // 保留用蓄力瞄準最大半徑
        chargeDefaultDistance: 4.2,         // 蓄力落點與身體的固定距離
        chargeAimHalfAngle: Math.PI / 4,    // 每顆頭可瞄準扇形半角，Math.PI / 4 = 45 度
        strikeTime: 0.16,                   // 頭部從後方向前攻擊的動畫秒數
        fireballDamageScale: 1.2,           // 火球型態傷害倍率
        fireballRadius: 2.4,                // 火球爆炸半徑
        flamethrowerDamagePerSecond: 36,    // 噴火型態每秒傷害
        flamethrowerRange: 7.0,             // 噴火型態射程
        flamethrowerAngle: 0.75             // 噴火型態半角，單位為弧度
    },

    // -----------------------------------------------------------------
    // 失衡 / 架勢值
    // -----------------------------------------------------------------
    stagger: {
        playerThreshold: 45,       // 玩家失衡條滿值，達到後跌倒
        playerWindow: 3,         // 玩家受傷後延遲多久才開始倒退失衡值
        playerRecoveryRate: 15,    // 玩家未受傷後，每秒倒退的失衡值
        playerFallDuration: 3.5,   // 玩家跌倒不可操作秒數
        enemyThreshold: 60,        // 敵人失衡條滿值，達到後跌倒
        enemyWindow: 1.0,          // 敵人受傷後延遲多久才開始倒退失衡值
        enemyRecoveryRate: 85,     // 敵人未受傷後，每秒倒退的失衡值
        enemyFallDuration: 1.2     // 敵人跌倒不可行動秒數
    },

    // -----------------------------------------------------------------
    // 地形 / 持續區域效果
    // -----------------------------------------------------------------
    terrain: {
        slimeSlowFactor: 0.45,       // 黏液地形速度倍率，越低越慢
        fireDamagePerSecond: 8,      // 火焰地形每秒傷害
        poisonDamagePerSecond: 7,    // 毒液 / 毒霧每秒傷害
        poisonSlowFactor: 0.5,       // 毒液造成的敵人速度倍率
        poisonLife: 10,              // 毒液殘留秒數
        poisonDropInterval: 0.25     // 毒液足跡生成間隔秒數
    },

    // -----------------------------------------------------------------
    // 關卡物件生成
    // -----------------------------------------------------------------
    level: {
        chunkSize: 44,             // 動態關卡區塊邊長，約等於原本一次生成範圍
        generateRadiusChunks: 1,   // 以玩家所在區塊為中心，向外預生成幾圈區塊
        cleanupRadiusChunks: 3,    // 超過玩家幾圈區塊的關卡物件會被清除
        maxAttemptsPerType: 300,   // 每種物件在單一區塊內最多嘗試生成次數
        safeRadius: 10,            // 玩家出生點附近保留空地半徑
        spacingPadding: 0.7,       // 關卡物件彼此避免重疊的額外間距
        destructibleCount: 14,     // 每區塊可破壞實體障礙物數量
        solidCount: 12,            // 每區塊不可破壞實體障礙物數量
        slimeCount: 4,             // 每區塊黏液緩速地面數量
        fireCount: 7,              // 每區塊火焰 DOT 地面數量
        solidSizeMin: 2,           // 實體障礙物最小寬深
        solidSizeRand: 3,          // 實體障礙物寬深隨機增加量
        solidHeightMin: 2,         // 實體障礙物最小高度
        solidHeightRand: 6,        // 實體障礙物高度隨機增加量
        patchSizeMin: 4,           // 地面效果最小寬深
        patchSizeRand: 4,          // 地面效果寬深隨機增加量
        patchHeight: 0.08          // 地面效果碰撞/生成用高度
    },

    // -----------------------------------------------------------------
    // 玩家一般投射物
    // -----------------------------------------------------------------
    bullet: {
        single: {
            damage: 6,       // 單發子彈傷害
            size: 0.4,       // 子彈顯示尺寸與碰撞半徑
            speedMin: 18,    // 子彈隨機最低速度
            speedMax: 22,    // 子彈隨機最高速度
            lifeMin: 0.9,    // 子彈最短存活秒數
            lifeMax: 1.3,    // 子彈最長存活秒數
            spread: 0.4,     // 子彈散射幅度
            gravity: 25,     // 子彈重力
            penetration: 0,  // 子彈可穿透次數
            recoil: 0,       // 發射後座力
            knockback: 6     // 命中擊退力
        }
    },

    // -----------------------------------------------------------------
    // 合體技前置 / 藤蔓掃場
    // -----------------------------------------------------------------
    combo: {
        cooldown: 15.0,       // 合體技冷卻秒數
        preCastDelay: 2.3,    // 合體技前置延遲秒數
        vineSpeed: 2.0,       // 藤蔓掃動速度
        moveSpeedFactor: 0.5, // 合體技期間移動速度倍率
        dotInterval: 0.5,     // 藤蔓 DoT 觸發間隔秒數
        dotDamage: 8,         // 藤蔓 DoT 每次傷害
        maxVineCount: 6,      // 最大藤蔓數量
        activeDuration: 7.0,  // 合體技作用秒數，原 quad 值
        radius: 12.0,         // 藤蔓作用半徑
        vineCount: 4          // 藤蔓生成數量
    },

    // -----------------------------------------------------------------
    // 合體技光束炮
    // -----------------------------------------------------------------
    beam: {
        damagePerTick: 7,                  // 光束每次 tick 基礎傷害
        damageScale: 1.6,                  // 光束傷害倍率
        tickInterval: 0.1,                 // 光束傷害 tick 間隔秒數
        range: 25,                         // 光束最大射程
        preFireDelay: 0.5,                 // 蓄滿後發射前延遲秒數
        firingDuration: 3,                 // 光束持續發射秒數
        postFireDelay: 0.6,                // 光束結束後搖秒數
        decayRate: 25,                     // 未蓄力或冷卻時蓄力值衰減速度
        maxCharge: 200,                    // 光束最大蓄力值，原 quad 值
        chargeRates: [0, 50, 150, 250, 500], // 依同時蓄力人數決定每秒蓄力速度
        width: 0.8                         // 光束碰撞與視覺寬度
    },

    // -----------------------------------------------------------------
    // Buff 數值
    // -----------------------------------------------------------------
    buffs: {
        hpBoostPct: 0.3,                  // 可疊加血量 Buff：每層最大血量增加比例
        speedBoostPct: 0.2,               // 可疊加速度 Buff：每層速度與轉向增加比例
        meleeBoostPct: 0.3,               // 可疊加近戰 Buff：每層近戰傷害增加比例
        comboCooldownMultiplier: 0.4,     // 組合技 CD 縮短 Buff：冷卻倍率
        comboDamageMultiplier: 2.0,       // 組合技傷害 Buff：傷害倍率
        lifeStealPct: 0.12,               // 有效傷害回血 Buff：造成傷害轉換回血比例
        tailDamageMultiplier: 4.0,        // 尾巴攻擊力 Buff：尾巴傷害倍率
        leafShieldCount: 4,               // 葉子護盾 Buff：護盾葉片數量
        missileInterval: 2.5,             // 飛彈巢 Buff：發射間隔秒數
        missileDamage: 18,                // 飛彈巢 Buff：單發飛彈傷害
        missileSpeed: 18,                 // 飛彈巢 Buff：飛彈速度
        stepShockwaveDistance: 10,        // 落腳震波 Buff：每移動多少距離觸發
        stepShockwaveDamage: 18,          // 落腳震波 Buff：震波傷害
        comboDamageWindow: 2.0,           // 連擊 Buff：有效攻擊後維持連擊的秒數
        comboDamageStepPct: 0.18,         // 連擊 Buff：每層傷害增加比例
        comboDamageMaxStacks: 5,          // 連擊 Buff：最高層數
        frontDamageMultiplier: 0.65,      // 正面減傷 Buff：正面受傷倍率
        backDamageMultiplier: 1.45,       // 正面減傷 Buff：背面受傷倍率
        projectileReflectChance: 0.5,     // 反彈投射物 Buff：反彈機率
        beamSlowDuration: 3.0,            // 光束緩速 Buff：緩速持續秒數
        beamSlowFactor: 0.55,             // 光束緩速 Buff：敵人速度倍率
        poisonCloudInterval: 8.0,         // 毒霧 Buff：噴發間隔秒數
        poisonCloudDuration: 3.5,         // 毒霧 Buff：毒霧持續秒數
        poisonCloudRadius: 9.0,           // 毒霧 Buff：毒霧半徑
        meleeExplosionChance: 0.25,       // Melee 爆炸 Buff：觸發機率
        ramSpeedThreshold: 8.5,           // 高速衝撞 Buff：觸發所需速度
        ramDamage: 16,                    // 高速衝撞 Buff：撞擊傷害
        ramStagger: 80,                   // 高速衝撞 Buff：額外失衡值
        stationaryShieldDelay: 1.0,       // 靜止護盾 Buff：站定多久後啟用
        stationaryShieldMultiplier: 0.7,  // 靜止護盾 Buff：受傷倍率
        teamworkRegenPerSecond: 4,        // 同心協力回血 Buff：每秒回血量
        lowHpExplosionDamage: 120,        // 半血爆炸 Buff：爆炸傷害
        lowHpExplosionRadius: 12          // 半血爆炸 Buff：爆炸半徑
    },

    // -----------------------------------------------------------------
    // 視覺與玩家顏色
    // -----------------------------------------------------------------
    visuals: {
        arrowLength: 4, // 玩家輸入方向箭頭長度
        colors: {
            p1: 0xff4444,          // P1 紅頭顏色
            p2: 0x4444ff,          // P2 藍頭顏色
            p3: 0xff69b4,          // P3 粉頭顏色
            p4: 0x00ffff,          // P4 尾巴顏色
            body: 0x44aa44,        // 身體顏色
            head: 0x44aa44,        // 預設頭部顏色
            mouth: 0x00ffff,       // 嘴部 / 能量顏色
            beam: 0xff00ff,        // 光束顏色
            indicatorSpacing: 3.5  // 保留用指示器間距
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
