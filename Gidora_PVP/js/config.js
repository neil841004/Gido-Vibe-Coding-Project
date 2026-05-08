// =====================================================================
// config.js — 全域數值與遊戲狀態
// 對應 Unity: ScriptableObject + Singleton GameState
// PVP 版本：所有原本「每隻龍一份」的數值（光束、合體技 CD、輸入）
//          已移到 Gidora 實體內，state 只保留全場共用的資料。
// =====================================================================

const CONFIG = {
    // -----------------------------------------------------------------
    // 角色 / 世界基礎數值
    // -----------------------------------------------------------------
    stats: {
        playerHP: 1200,          // 玩家融合獸基礎最大血量
        structureHPBase: 0.5,   // 可破壞障礙物 HP 係數，會乘上體積
        destructibleHealPct: 0.015, // 破壞白色可破壞關卡物件時，回復自身最大血量比例
        hpDecayRate: 0,         // 開啟敵人生成後，每秒自然扣血量
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
        rotationSpeed: 3.1  // 轉向速度
    },

    // -----------------------------------------------------------------
    // 近戰 / 頭部蓄力攻擊
    // -----------------------------------------------------------------
    combat: {
        meleeDamage: 16,                    // 基礎近戰傷害
        attackRange: 2,                   // 近戰命中半徑
        windupTime: 0.2,                    // 輕攻擊 / 蓄力按下後往後擺的前搖秒數
        recoveryTime: 0.4,                  // 輕攻擊後搖秒數
        heavyWindupTime: 0.16,              // 保留用重攻擊前搖秒數
        heavyRecoveryTime: 0.9,             // 重攻擊後搖秒數，期間禁止移動輸入
        cooldown: 0.6,                      // 攻擊基礎冷卻秒數
        recoilForce: 10,                    // 保留用玩家反作用力
        knockbackBase: 0.2,                 // 傷害轉換為擊退的基礎倍率
        chargeTime: 0.4,                    // 按住多久後蓄力完成並顯示落點預判
        heavyDamageScale: 3.0,              // 蓄力攻擊傷害倍率
        heavyRadiusScale: 1.4,             // 蓄力攻擊範圍倍率
        chargeAimRadius: 6.0,               // 保留用蓄力瞄準最大半徑
        chargeDefaultDistance: 4.2,         // 蓄力落點與身體的固定距離
        chargeAimHalfAngle: Math.PI / 3,    // 每顆頭可瞄準扇形半角，Math.PI / 4 = 45 度
        strikeTime: 0.16,                   // 頭部從後方向前攻擊的動畫秒數
        fireballDamageScale: 1.2,           // 火球型態傷害倍率
        fireballHeavyDamageScale: 1.35,     // 噴火球型態蓄力完成後額外傷害倍率
        fireballAimDistance: 17.0,          // 火球型態固定落點距離，比一般頭槌落點更遠
        fireballSpeed: 24,                  // 火球型態投射物飛行速度
        fireballRadius: 2.4,                // 火球爆炸半徑
        fireballProjectileSize: 0.59,       // 火球型態投射物顯示尺寸，比原本大約 30%
        fireballHeavySizeScale: 1.35,       // 噴火球蓄力完成後投射物與爆炸半徑倍率
        flamethrowerDamagePerSecond: 40,    // 噴火型態每秒傷害
        flamethrowerRange: 5.5,             // 噴火型態射程
        flamethrowerAngle: 0.5,            // 噴火型態半角，單位為弧度
        flamethrowerKnockback: 0.15,        // 噴火型態每次傷害 tick 的擊退力
        flamethrowerBlockDamageScale: 0.7,  // 噴火型態對可破壞關卡物件的傷害倍率
        shockwaveRadius: 3.3,               // 蓄力震波 Buff 的震波半徑
        shockwaveDamageScale: 0.8,          // 蓄力震波 Buff 的震波傷害倍率
        // P4 尾巴蓄力攻擊
        tailChargeTime: 0.4,                // P4 蓄力所需按住秒數（比頭部 chargeTime 0.4s 更長）
        tailSweepDuration: 0.45,            // P4 蓄力重擊旋轉橫掃的動畫持續秒數
        tailSweepRadius: 5,               // P4 尾巴橫掃攻擊半徑
        tailSweepDamageScale: 1.7,          // P4 蓄力橫掃傷害倍率（疊加在 meleeDamage 與 tailPower 之上）
        heavyStaggerBonusScale: 0.5         // 蓄力攻擊命中時，額外造成傷害 50% 的失衡值
    },

    // -----------------------------------------------------------------
    // 失衡 / 架勢值
    // -----------------------------------------------------------------
    stagger: {
        playerThreshold: 400,       // 玩家失衡條滿值，達到後跌倒
        playerWindow: 0,         // 玩家受傷後延遲多久才開始倒退失衡值
        playerRecoveryRate: 25,    // 玩家未受傷後，每秒倒退的失衡值
        playerFallDuration: 3.1,   // 玩家跌倒不可操作秒數
        playerStandUpDuration: 0.5, // 玩家跌倒後重新站起來的動畫秒數
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
        fireDamagePerSecond: 30,      // 火焰地形每秒傷害
        fireParticleInterval: 0.12,   // 火焰地形粒子生成間隔秒數
        fireParticleLife: 0.55,       // 火焰地形粒子存活秒數
        fireParticleBurstCount: 2,    // 每次火焰地形噴出的火苗粒子數量
        poisonDamagePerSecond: 7,    // 毒液 / 毒霧每秒傷害
        poisonSlowFactor: 0.5,       // 毒液造成的敵人速度倍率
        poisonLife: 7,              // 毒液殘留秒數
        poisonDropInterval: 0.4     // 毒液足跡生成間隔秒數
    },

    // -----------------------------------------------------------------
    // 關卡物件生成
    // -----------------------------------------------------------------
    level: {
        arenaHalfSize: 52,       // 有限關卡半邊長，玩家可活動範圍為 -halfSize 到 +halfSize
        arenaWaterWidth: 42,     // 關卡邊界外海面延伸寬度
        arenaSpawnMargin: 4,     // 障礙物 / 道具生成時離邊界保留距離
        playerBoundaryPadding: 0.8, // 玩家碰到邊界時保留的碰撞半徑
        chunkSize: 44,             // 動態關卡區塊邊長，約等於原本一次生成範圍
        generateRadiusChunks: 1,   // 以玩家所在區塊為中心，向外預生成幾圈區塊
        cleanupRadiusChunks: 3,    // 超過玩家幾圈區塊的關卡物件會被清除
        maxAttemptsPerType: 300,   // 每種物件在單一區塊內最多嘗試生成次數
        safeRadius: 10,            // 玩家出生點附近保留空地半徑
        spacingPadding: 0.7,       // 關卡物件彼此避免重疊的額外間距
        destructibleCount: 14,     // 每區塊可破壞實體障礙物數量
        solidCount: 12,            // 每區塊不可破壞實體障礙物數量
        slimeCount: 3,             // 每區塊黏液緩速地面數量
        fireCount: 4,              // 每區塊火焰 DOT 地面數量
        solidSizeMin: 2,           // 實體障礙物最小寬深
        solidSizeRand: 3,          // 實體障礙物寬深隨機增加量
        solidHeightMin: 2,         // 實體障礙物最小高度
        solidHeightRand: 6,        // 實體障礙物高度隨機增加量
        patchSizeMin: 4,           // 地面效果最小寬深
        patchSizeRand: 4,          // 地面效果寬深隨機增加量
        patchHeight: 0.08,         // 地面效果碰撞/生成用高度
        healItemSpawnIntervalMin: 9, // 補血道具生成最短間隔秒數
        healItemSpawnIntervalRand: 9, // 補血道具生成額外隨機秒數
        healItemMaxCount: 2,       // 場上最多同時存在的補血道具數量
        healItemHealPct: 0.2,      // 補血道具回復自身最大血量比例
        healItemPickupRadius: 2.0  // 補血道具拾取半徑
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
        vineCount: 4,         // 藤蔓生成數量
        pteroPreCastDelay: 3, // 飛天墜擊 Buff：落點瞄準預備秒數
        pteroAimSpeed: 10.0,    // 飛天墜擊 Buff：玩家輸入推動落點的速度，世界座標/秒
        pteroFlyHeight: 18.0,   // 飛天墜擊 Buff：起飛後的最高高度
        pteroFlySpeed: 70.0,    // 飛天墜擊 Buff：起飛速度，世界座標/秒
        pteroDropSpeed: 90.0,   // 飛天墜擊 Buff：下墜加速度，世界座標/秒平方
        pteroRadius: 10.0,      // 飛天墜擊 Buff：落地傷害半徑
        pteroDamage: 170,       // 飛天墜擊 Buff：落地基礎傷害
        rushDuration: 7.0,      // 爆衝連擊 Buff：最多向前衝刺秒數
        rushSpeedMultiplier: 1.5, // 爆衝連擊 Buff：相對基礎最高速度的固定衝刺倍率
        rushTurnMultiplier: 2.0,  // 爆衝連擊 Buff：衝刺期間轉向速度倍率
        rushHitRadius: 2.2,       // 爆衝連擊 Buff：前方撞擊偵測半徑
        rushBarrageDuration: 1.8, // 爆衝連擊 Buff：命中後快閃演出秒數
        rushBarrageHits: 10,       // 爆衝連擊 Buff：快閃演出多段攻擊次數
        rushBarrageDamage: 24,    // 爆衝連擊 Buff：每段快閃基礎傷害
        rushBarrageRadius: 1.8,   // 爆衝連擊 Buff：快閃傷害落點半徑
        rushKnockback: 60,        // 爆衝連擊 Buff：每段快閃擊退力
        refractBeamRangeMultiplier: 1.65, // 折光追獵炮 Buff：相對光束炮的射程倍率
        refractBeamTurnStrength: 0.45,    // 折光追獵炮 Buff：光束朝目標彎曲的強度
        refractBeamSegments: 7,           // 折光追獵炮 Buff：扭曲光束視覺分段數
        refractBeamStaggerBonusPct: 0.5   // 折光追獵炮 Buff：額外失衡值比例
    },

    // -----------------------------------------------------------------
    // 合體技光束炮
    // -----------------------------------------------------------------
    beam: {
        damagePerTick: 8,                  // 光束每次 tick 基礎傷害
        damageScale: 1.6,                  // 光束傷害倍率
        tickInterval: 0.1,                 // 光束傷害 tick 間隔秒數
        range: 25,                         // 光束最大射程
        preFireDelay: 0.5,                 // 蓄滿後發射前延遲秒數
        firingDuration: 4,                 // 光束持續發射秒數
        postFireDelay: 0.6,                // 光束結束後搖秒數
        decayRate: 25,                     // 未蓄力或冷卻時蓄力值衰減速度
        maxCharge: 200,                    // 光束最大蓄力值，原 quad 值
        chargeRates: [0, 50, 150, 250, 500], // 依同時蓄力人數決定每秒蓄力速度
        tickKnockback: 2.5,                // 光束每次 DOT tick 造成的微量擊退力
        width: 0.8                         // 光束碰撞與視覺寬度
    },

    // -----------------------------------------------------------------
    // Buff 數值
    // -----------------------------------------------------------------
    buffs: {
        hpBoostPct: 0.3,                  // 可疊加血量 Buff：每層最大血量增加比例
        speedBoostPct: 0.3,               // 可疊加速度 Buff：每層速度與轉向增加比例
        meleeBoostPct: 0.3,               // 可疊加近戰 Buff：每層近戰傷害增加比例
        comboCooldownMultiplier: 0.5,     // 組合技 CD 縮短 Buff：冷卻倍率
        comboDamageMultiplier: 2.0,       // 組合技傷害 Buff：傷害倍率
        lifeStealPct: 0.12,               // 有效傷害回血 Buff：造成傷害轉換回血比例
        tailDamageMultiplier: 2.6,        // 尾巴攻擊力 Buff：尾巴傷害倍率
        tailPowerSweepRadiusMultiplier: 1.45, // 尾巴攻擊力 Buff：尾巴蓄力橫掃範圍倍率
        leafShieldCount: 1,               // 葉子護盾 Buff：護盾葉片數量
        missileInterval: 2.5,             // 飛彈巢 Buff：發射間隔秒數
        missileDamage: 12,                // 飛彈巢 Buff：單發飛彈傷害
        missileSpeed: 14,                 // 飛彈巢 Buff：飛彈速度
        stepShockwaveDistance: 8,        // 落腳震波 Buff：每移動多少距離觸發
        stepShockwaveDamage: 22,          // 落腳震波 Buff：震波傷害
        comboDamageWindow: 3.0,           // 連擊 Buff：有效攻擊後維持連擊的秒數
        comboDamageMinWindow: 1.5,        // 連擊 Buff：高 Combo 時最低斷 Combo 倒數秒數
        comboDamageStepPct: 0.18,         // 連擊 Buff：每層傷害增加比例
        comboDamageMaxStacks: 7,          // 連擊 Buff：最高層數
        frontDamageMultiplier: 0.7,      // 正面減傷 Buff：正面受傷倍率
        projectileReflectChance: 0.5,     // 反彈投射物 Buff：反彈機率
        beamSlowDuration: 2.0,            // 光束緩速 Buff：緩速持續秒數
        beamSlowFactor: 0.4,             // 光束緩速 Buff：敵人速度倍率
        poisonCloudInterval: 8.0,         // 毒霧 Buff：噴發間隔秒數
        poisonCloudDuration: 3.5,         // 毒霧 Buff：毒霧持續秒數
        poisonCloudRadius: 8.0,           // 毒霧 Buff：毒霧半徑
        meleeExplosionChance: 0.5,       // Melee 爆炸 Buff：觸發機率
        ramSpeedThreshold: 8.5,           // 高速衝撞 Buff：觸發所需速度
        ramDamage: 45,                    // 高速衝撞 Buff：撞擊傷害
        ramKnockback: 55,                 // 高速衝撞 Buff：撞擊擊退力
        ramStagger: 100,                   // 高速衝撞 Buff：額外失衡值
        staggerImmuneIncomingMultiplier: 0.5, // 不容易跌倒 Buff：受到失衡值倍率（0.5 = 減少 50%）
        staggerImmuneRecoveryMultiplier: 1.5, // 不容易跌倒 Buff：失衡值衰退速度倍率（1.5 = +50%）
        stationaryShieldDelay: 2.0,       // 靜止護盾 Buff：站定多久後啟用
        stationaryShieldMultiplier: 0.8,  // 靜止護盾 Buff：受傷倍率
        teamworkRegenPerSecond: 25,        // 同心協力回血 Buff：每秒回血量
        lowHpExplosionDamage: 180,        // 半血爆炸 Buff：爆炸傷害
        lowHpExplosionRadius: 15,         // 半血爆炸 Buff：爆炸半徑
        comboFloraDecorVineCount: 3,      // 藤蔓掃場型態 Buff：身體周圍點綴藤蔓數量
        comboPteroWingScale: 1.2,         // 飛天墜擊型態 Buff：小翅膀視覺尺寸倍率
        visualOrbitRadius: 2.8,           // Buff 視覺標記繞角色旋轉半徑
        visualPulseInterval: 0.35,        // Buff 持續粒子特效生成間隔秒數
        hpVisualScalePerStack: 0.1        // 血量 Buff 每層角色視覺放大比例
    },

    // -----------------------------------------------------------------
    // UI 顯示設定
    // -----------------------------------------------------------------
    ui: {
        healthBarTickHP: 50               // 血條每多少 HP 顯示一個刻度
    },

    // -----------------------------------------------------------------
    // PVP 對戰模式
    // -----------------------------------------------------------------
    pvp: {
        // 兩隻三頭龍出生位置（測試模式 / PVP 模式共用）
        dragonASpawn: { x: -8, z: 0, facingY: 0 }, // 第一隻三頭龍出生點與初始面向 (弧度)
        dragonBSpawn: { x: 8, z: 0, facingY: Math.PI }, // 第二隻三頭龍出生點與初始面向 (弧度)
        // PVP 配對介面選項
        maxBuffsPerDragon: 10,            // 配對介面 Buff 數量上限
        cameraMargin: 8,                  // PVP 鏡頭跟隨額外邊界，越大鏡頭拉得越遠
        cameraMinDist: 12,                // PVP 鏡頭最小距離，避免過於貼近
        cameraMaxDist: 50,                // PVP 鏡頭最大距離，避免拉得過遠
        matchDuration: 180,               // PVP 對戰計時秒數（3 分鐘），時間到以血量多者獲勝
        startCountdownSeconds: 5,         // PVP 開場禁止操作並顯示倒數的秒數
        startTextSeconds: 0.7,            // PVP 倒數結束後 Start 文字停留秒數
        respawnButtonLabel: '重新開始',     // 結束畫面按鈕文字
        // 兩隻三頭龍之間的碰撞推擠
        dragonCollisionRadius: 2.1,       // 每隻龍的碰撞半徑，兩龍距離 < 半徑x2 時觸發推擠
        dragonBounceRestitution: 0,     // 碰撞速度反彈係數，0=完全不反彈，1=完全彈性碰撞
        dragonPushForce: 2                // 碰撞時額外施加於 knockbackVel 的推力大小，單位/秒
    },

    // -----------------------------------------------------------------
    // 三頭龍受擊判定
    // -----------------------------------------------------------------
    hitbox: {
        bodyCenterRadius: 1.25,       // 身體中央受擊球半徑，對應橢圓身體中心
        bodyFrontRadius: 1.05,        // 身體前段受擊球半徑，補足視覺模型前胸
        bodyBackRadius: 1.05,         // 身體後段受擊球半徑，補足視覺模型後背
        bodyFrontOffsetZ: 1.15,       // 身體前段受擊球相對龍中心的本地 Z 偏移
        bodyBackOffsetZ: -1.15,       // 身體後段受擊球相對龍中心的本地 Z 偏移
        neckRadius: 0.42,             // 脖子受擊球半徑
        neckLowerY: 0.85,             // 脖子下段受擊球在 neck pivot 內的本地 Y 位置
        neckUpperY: 1.55,             // 脖子上段受擊球在 neck pivot 內的本地 Y 位置
        headRadius: 0.58,             // 頭部受擊球半徑
        tailBaseRadius: 0.55,         // 尾巴根部受擊球半徑
        tailTipRadius: 0.46,          // 尾巴尖端受擊球半徑
        tailBaseOffsetZ: -0.65,       // 尾巴根部受擊球相對 tailGroup 的本地 Z 偏移
        tailTipOffsetZ: -1.75,        // 尾巴尖端受擊球相對 tailGroup 的本地 Z 偏移
        projectilePadding: 0.05,      // 投射物命中三頭龍時額外加上的半徑
        meleePadding: 0.15,           // 地面近戰 / 範圍傷害命中三頭龍時額外加上的半徑
        beamPadding: 0.05,            // 光束命中三頭龍時額外加上的半徑
        ramRadius: 1.2,               // 高速衝撞判定的地面圓半徑
        enemyMeleeRangeScale: 0.65,   // 近戰敵人攻擊距離轉成三頭龍受擊圓時的倍率
        enemySlashRangeScale: 0.55    // 忍者斬擊距離轉成三頭龍受擊圓時的倍率
    },

    // -----------------------------------------------------------------
    // PVE CPU 對手行為
    // -----------------------------------------------------------------
    pve: {
        cpuDecisionIntervalMin: 0.45,     // CPU 每個部位重新判斷行動的最短間隔秒數
        cpuDecisionIntervalMax: 0.95,     // CPU 每個部位重新判斷行動的最長間隔秒數
        cpuTeamIntentMinSeconds: 1.7,     // CPU 整體戰術意圖維持的最短秒數
        cpuTeamIntentMaxSeconds: 3.2,     // CPU 整體戰術意圖維持的最長秒數
        cpuPreferredRange: 4.0,           // CPU 偏好的交戰距離，單位為世界座標距離
        cpuRetreatRange: 2.8,             // CPU 覺得過近而想後退的距離
        cpuChaseRange: 7.5,               // CPU 超過此距離時傾向追擊
        cpuMeleeRange: 5.4,               // CPU 三顆頭嘗試近戰的距離
        cpuTailMeleeRange: 4.6,           // CPU 尾巴嘗試掃擊的距離
        cpuMeleeAlignDuration: 0.3,       // CPU 觸發近戰後，本部位優先朝真實玩家方向對齊的秒數
        cpuMoveNoiseAngle: 0.22,          // CPU 正常移動方向最大隨機偏角，弧度
        cpuConfusedMoveNoiseAngle: 1.15,  // CPU 整體猶豫事件中的移動方向最大隨機偏角，弧度
        cpuIdleMoveChance: 0.05,          // CPU 單一部位本次決策故意不移動的機率
        cpuConfusionChance: 0,            // [Deprecated] 已被 cpuTeamConfusionChance 取代，個別部位不再獨立進入混亂
        cpuTeamConfusionChance: 0.06,     // CPU 在團隊意圖切換時觸發整體猶豫事件的機率
        cpuTeamConfusionDurationMin: 0.8, // CPU 整體猶豫事件最短持續秒數
        cpuTeamConfusionDurationMax: 1.4, // CPU 整體猶豫事件最長持續秒數
        cpuConfusionDurationMin: 2.0,     // [Deprecated] 舊 per-part 混亂事件持續秒數，保留以利對照
        cpuConfusionDurationMax: 3.0,     // [Deprecated] 舊 per-part 混亂事件持續秒數，保留以利對照
        cpuHealItemSeekHpRatio: 0.8,      // CPU 血量比例低於此值時開始搶補血道具
        cpuHealItemSeekRange: 18.0,       // CPU 搜尋補血道具的最大距離
        cpuHealItemSeekBlend: 0.9,        // CPU 朝補血道具移動的方向權重，1 = 完全覆蓋戰術方向
        cpuTargetOffsetRadius: 2.4,       // CPU 判斷玩家位置時的最大誤差半徑，世界座標距離
        cpuTargetOffsetMinSeconds: 1.1,   // CPU 目標位置誤差維持的最短秒數
        cpuTargetOffsetMaxSeconds: 2.4,   // CPU 目標位置誤差維持的最長秒數
        cpuRetreatHpRatio: 0.32,          // CPU 血量低於此比例時更常後退
        cpuRetreatChance: 0.42,           // CPU 低血量且距離偏近時選擇後退的機率
        cpuPressureIntentChance: 0.7,     // CPU 距離適中時選擇壓迫而非繞行的機率
        cpuAttackChance: 0.68,            // CPU 進入攻擊距離時，本次決策嘗試近戰的基礎機率
        cpuHeavyAttackChance: 0.34,       // CPU 嘗試近戰時改成蓄力攻擊的機率
        cpuAttackPressSeconds: 0.1,       // CPU 輕攻擊按鍵維持秒數
        cpuInitialAttackDelayMin: 0.25,   // CPU 開局後同一部位最早可嘗試攻擊的延遲秒數
        cpuAttackIntervalMin: 0.6,        // CPU 同一部位兩次攻擊嘗試的最短間隔秒數
        cpuAttackIntervalMax: 1.65,       // CPU 同一部位兩次攻擊嘗試的最長間隔秒數
        cpuHeavyHoldExtraMin: 0.08,       // CPU 蓄力攻擊達標後額外按住的最短秒數
        cpuHeavyHoldExtraMax: 0.42,       // CPU 蓄力攻擊達標後額外按住的最長秒數
        cpuOrbitBlend: 0.26,              // CPU 一般部位繞行玩家的側向權重
        cpuSideOrbitBlend: 0.42,          // CPU 側邊部位繞行玩家的側向權重
        cpuOrbitApproachWeight: 0.66,     // CPU 距離足夠時朝玩家靠近的前向權重
        cpuOrbitApproachMultiplier: 0.55, // CPU 繞行意圖下，前向靠近權重的倍率
        cpuOrbitBackoffWeight: -0.15,     // CPU 距離偏近時遠離玩家的前向權重
        cpuObstacleAvoidRange: 5.2,       // CPU 提前避開關卡物件的感知距離
        cpuObstacleAvoidPadding: 1.4,     // CPU 判斷關卡物件碰撞邊界時額外加上的距離
        cpuObstacleDefaultSize: 2.0,      // CPU 讀不到物件尺寸時使用的預設寬深
        cpuSolidAvoidWeight: 1.25,        // CPU 避開實體障礙物的方向權重
        cpuHazardAvoidWeight: 0.85,       // CPU 避開火焰 / 黏液地形的方向權重
        cpuObstacleAheadDot: -0.15,       // CPU 只避開大致在行進方向前方的障礙物，內積門檻
        cpuObstacleMoveAwayDot: 0.95,     // CPU 已明顯遠離障礙物時略過避障的內積門檻
        cpuConfusionMoveBlend: 0.8,       // CPU 整體猶豫事件中，混亂方向覆蓋正常方向的比例
        cpuComboPlanIntervalMin: 10,      // CPU 兩次合體技企圖之間的最短間隔秒數
        cpuComboPlanIntervalMax: 22,      // CPU 兩次合體技企圖之間的最長間隔秒數
        cpuComboPlanDurationMin: 2.2,     // CPU 一次合體技企圖持續的最短秒數
        cpuComboPlanDurationMax: 4.0,     // CPU 一次合體技企圖持續的最長秒數
        cpuComboRangeFactor: 1.05,        // CPU 判斷可嘗試合體技時，相對 beam.range 的射程倍率
        cpuComboBaseChance: 0.78,         // CPU 條件合適時啟動合體技企圖的基礎機率
        cpuComboLowHpBonusChance: 0.22,   // CPU 低血量時合體技企圖額外機率
        cpuComboMaxChance: 0.95,          // CPU 合體技企圖機率上限
        cpuComboParticipantChance: 0.84,  // CPU 每個部位參與本次合體技集氣的機率
        cpuComboAimMoveBlend: 0.9,        // CPU 合體技企圖期間，非集氣部位朝真實玩家方向校正的權重
        cpuComboJoinDelayMin: 0.05,       // CPU 部位加入合體技集氣的最短延遲秒數
        cpuComboJoinDelayMax: 0.85,       // CPU 部位加入合體技集氣的最長延遲秒數
        cpuComboFacingDot: 0.05           // CPU 面向玩家且內積高於此值時較可能放合體技
    },

    // -----------------------------------------------------------------
    // 視覺與玩家顏色
    // -----------------------------------------------------------------
    visuals: {
        arrowLength: 4, // 玩家輸入方向箭頭長度
        colors: {
            // 預設第一隻三頭龍配色 (Dragon A)
            p1: 0xff4444,          // P1 紅頭顏色
            p2: 0x4444ff,          // P2 藍頭顏色
            p3: 0xff69b4,          // P3 粉頭顏色
            p4: 0x00ffff,          // P4 尾巴顏色
            body: 0x44aa44,        // 身體顏色
            head: 0x44aa44,        // 預設頭部顏色
            mouth: 0x00ffff,       // 嘴部 / 能量顏色
            beam: 0xff00ff,        // 光束顏色
            indicatorSpacing: 3.5  // 保留用指示器間距
        },
        // 第二隻三頭龍配色 (Dragon B)，用同一組欄位區分敵我
        colorsB: {
            p1: 0xffaa44,          // P1 橘頭顏色
            p2: 0xeeee44,          // P2 黃頭顏色
            p3: 0xaaff66,          // P3 黃綠頭顏色
            p4: 0xff44aa,          // P4 洋紅尾巴顏色
            body: 0x7744aa,        // 紫色身體
            head: 0x7744aa,        // 預設頭部顏色
            mouth: 0xff44aa,       // 嘴部 / 能量顏色
            beam: 0x88ff44         // 光束顏色 (亮綠)
        }
    }
};

// =====================================================================
// 全域遊戲狀態
// PVP 重構後：beam / combo CD / input / HP 等「每隻龍一份」的狀態
//             已搬到 Gidora 實體，state 只放全場共享資料。
// =====================================================================
const state = {
    // 場上所有三頭龍 (Dragon A 永遠存在；Dragon B 由 UI 切換 / PVP 模式建立)
    dragons: [],

    // 全場共享子彈、特效、屍體、肉塊
    bullets: [],
    particles: [],
    flyingCorpses: [],
    meatChunks: [],

    // 全場 HP 倒扣（仍綁在 Spawner 開關，PVP 模式內不啟用）
    hpDecayEnabled: false,

    // Dummy 開關狀態 (true = 場上有 Dummy)，初始預設關閉
    dummyEnabled: false,

    // 一般敵人 Spawner 開關（PVP 模式時禁用，Mode 切換時自動關閉）
    spawnerEnabled: false,

    // 第二隻三頭龍是否生成（左上 Spawn Enemy Dragon 按鈕）
    enemyDragonEnabled: false,

    // Buff 面板目前操作的對象 (0 = Dragon A, 1 = Dragon B)
    buffTarget: 0,

    // PVP 對戰狀態機
    pvp: {
        active: false,        // true = 已進入 PVP 對戰中
        configuring: false,   // true = 配對介面開啟、世界暫停
        ended: false,         // 對戰結束等待重來
        winnerIndex: -1,      // 勝者三頭龍 index (-1 表示未結束 / 平手)
        timeUpVictory: false, // true = 本局由時間到後比較血量決定勝負
        matchTimer: 0,        // PVP 對戰剩餘秒數，從 CONFIG.pvp.matchDuration 開始倒數
        startCountdownTimer: 0, // PVP 開場倒數剩餘秒數，>0 時輸入鎖定
        startTextTimer: 0,    // PVP Start 文字剩餘顯示秒數
        // 配對結果：8 個 slot，slot[i] = { device } 或 null
        // 索引: 0~3 = Dragon A 的 P1/P2/P3/P4，4~7 = Dragon B 的 P1/P2/P3/P4
        slots: [null, null, null, null, null, null, null, null],
        buffCounts: [-1, -1], // Dragon A / B 各自的 Buff 數量設定 (-1 表示「隨機」)
        disableKeyboard: false // 是否禁用鍵鼠裝置
    },

    // PVE 對戰狀態；實際雙龍戰鬥 HUD / 勝負沿用 PVP 對戰基礎，這裡只記錄 CPU 模式差異
    pve: {
        active: false,            // true = Dragon B 由 CPU 控制
        configuring: false,       // true = PVE 配對介面開啟
        cpu: null,                // CpuDragonController instance，由 main.js 建立
        testKeyboardEnabled: true // 鍵鼠測試模式：ON 時 Dragon A 改用 WASD+1~8 操作，並忽略 overlay 指派（Dragon B 仍由 CPU 控制）
    },

    lastTime: 0
};
