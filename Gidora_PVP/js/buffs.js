// =====================================================================
// buffs.js — Buff 系統
// PVP 重構：BuffSystem 改為 class，每隻三頭龍 (Gidora) 持有自己的 instance。
// 透過 `this.dragon` 取得目標龍；所有原本 `window.gidoraInstance` /
// `state.beamPhase` 等 singleton 用法都改為 `this.dragon.xxx`。
// =====================================================================

const BUFFS = {
    meleeFireball: { name: 'Melee 型態：噴火球', description: '已禁用：Melee 型態改由「龍型態」決定，不會在 PVP/PVE/問號箱抽取，也無法手動啟用。', group: 'meleeForm', implemented: false, disabled: true, pvpExclude: true, icon: { glyph: 'F', color: '#ff9f1c', bg: '#3d2410' } },
    meleeShockwave: { name: 'Melee 型態：蓄力震波', description: '已禁用：Melee 型態改由「龍型態」決定，不會在 PVP/PVE/問號箱抽取，也無法手動啟用。', group: 'meleeForm', implemented: false, disabled: true, pvpExclude: true, icon: { glyph: '~', color: '#a6c8ff', bg: '#172845' } },
    meleeFlame: { name: 'Melee 型態：噴火', description: '已禁用：Melee 型態改由「龍型態」決定，不會在 PVP/PVE/問號箱抽取，也無法手動啟用。', group: 'meleeForm', implemented: false, disabled: true, pvpExclude: true, icon: { glyph: 'W', color: '#ff5e2e', bg: '#40180e' } },
    meleeExplosion: { name: 'Melee 型態：爆炸', description: '已禁用：Melee 型態改由「龍型態」決定，不會在 PVP/PVE/問號箱抽取，也無法手動啟用。', group: 'meleeForm', implemented: false, disabled: true, pvpExclude: true, icon: { glyph: '*', color: '#ffcf66', bg: '#3f2610' } },

    comboFlora: { name: '組合技型態：藤蔓掃場', description: '已禁用：組合技型態改由「龍型態」決定，不會在 PVP/PVE/問號箱抽取，也無法手動啟用。', group: 'comboForm', implemented: false, disabled: true, pvpExclude: true, icon: { glyph: 'VN', color: '#b8ff8a', bg: '#173719' } },
    comboPtero: { name: '組合技型態：飛天墜擊', description: '已禁用：組合技型態改由「龍型態」決定，不會在 PVP/PVE/問號箱抽取，也無法手動啟用。', group: 'comboForm', implemented: false, disabled: true, pvpExclude: true, icon: { glyph: 'SK', color: '#fff2a6', bg: '#2f2b12' } },
    comboRush: { name: '組合技型態：爆衝連擊', description: '已禁用：組合技型態改由「龍型態」決定，不會在 PVP/PVE/問號箱抽取，也無法手動啟用。', group: 'comboForm', implemented: false, disabled: true, pvpExclude: true, icon: { glyph: 'RS', color: '#9ef7ff', bg: '#12373b' } },
    comboRefractBeam: { name: '組合技型態：折光追獵炮', description: '已禁用：組合技型態改由「龍型態」決定，不會在 PVP/PVE/問號箱抽取，也無法手動啟用。', group: 'comboForm', implemented: false, disabled: true, pvpExclude: true, icon: { glyph: 'RB', color: '#e7fbff', bg: '#182a45' } },

    speedBoost: { name: '移動速度+', description: '移動與轉向速度 +30%。', implemented: true, icon: { glyph: 'MV', color: '#59d8ff', bg: '#12303b' } },
    meleeBoost: { name: '頭部攻擊力+', description: '頭部 Melee 傷害 +30%，不影響尾巴。', implemented: true, icon: { glyph: 'H+', color: '#ffd166', bg: '#3a2c12' } },
    defenseBoost: { name: '防禦+', description: '受傷減少 20%，不影響受到的失衡值。', implemented: true, icon: { glyph: 'D+', color: '#9ad8ff', bg: '#152a3d' } },

    comboCd: { name: '組合技CD縮短', description: '組合技冷卻縮短。', implemented: true, icon: { glyph: 'CD', color: '#c4a7ff', bg: '#231a3d' } },
    comboDamage: { name: '組合技攻擊力+', description: '組合技傷害加倍。', implemented: true, icon: { glyph: 'C+', color: '#ff8cff', bg: '#39183c' } },
    tailPower: { name: '尾巴大幅強化', description: '尾巴傷害與蓄力橫掃範圍大幅提高。', implemented: true, icon: { glyph: 'T+', color: '#60efff', bg: '#12393d' } },
    poisonTrail: { name: '毒毒毒', description: '走路留下毒液，並週期性噴出大範圍毒霧。', implemented: true, icon: { glyph: '毒', color: '#8cff5f', bg: '#173a14' } },
    leafShield: { name: '葉子護盾', description: '4 片葉子反彈投射物；組合技期間變 8 片，且本體無敵。', implemented: true, icon: { glyph: '葉', color: '#a7ff83', bg: '#203714' } },

    stepShockwave: { name: '落腳震波', description: '每隔幾步，下一次落腳產生震波。', implemented: true, icon: { glyph: 'S', color: '#d9e7ff', bg: '#202d45' } },
    comboRamp: { name: '連擊傷害提高', description: '已禁用：此 Buff 不會在 PVP/PVE/問號箱抽取，也無法手動啟用。', implemented: false, disabled: true, pvpExclude: true, icon: { glyph: 'x', color: '#ffe66d', bg: '#383312' } },
    missileNest: { name: '背上飛彈巢', description: '定期發射追蹤飛彈。', implemented: true, icon: { glyph: 'M', color: '#ffb347', bg: '#3d2a10' } },
    directionalGuard: { name: '正面硬鱗', description: '正面受傷降低，背面受傷提高。', implemented: true, icon: { glyph: 'FG', color: '#9ad1ff', bg: '#162f45' } },
    beamSlow: { name: '光束波緩速', description: '組合技命中時使敵方緩速。', implemented: true, icon: { glyph: 'SL', color: '#b7d7ff', bg: '#17283f' } },
    poisonCloud: { name: '定期毒霧', description: '已併入「毒毒毒」：此 Buff 不會抽取，也無法手動啟用。', implemented: false, disabled: true, pvpExclude: true, icon: { glyph: 'C', color: '#78ff8f', bg: '#14351c' } },
    staggerImmune: { name: '不屈爆發', description: '較不容易跌倒；跌倒後站起時向四周噴發一次大爆炸。', implemented: true, icon: { glyph: 'IB', color: '#ffffff', bg: '#303030' } },
    stationaryShield: { name: '停止不動護盾', description: '站定後免疫 30% 傷害。', implemented: true, icon: { glyph: 'D', color: '#d8fff5', bg: '#173631' } },
    lowHpExplosion: { name: '跌倒反擊大爆炸', description: '已併入「不屈爆發」：此 Buff 不會抽取，也無法手動啟用。', implemented: false, disabled: true, pvpExclude: true, icon: { glyph: '!', color: '#ffef73', bg: '#4a2510' } },
    knockbackBoost: { name: '把敵人推得遠遠的', description: '本龍造成的所有擊退力變為 3 倍。', implemented: true, icon: { glyph: 'KB', color: '#ffd166', bg: '#3a1f12' } },
    comboInvincible: { name: '組合技期間無敵', description: '已併入「葉子護盾」：此 Buff 不會抽取，也無法手動啟用。', implemented: false, disabled: true, pvpExclude: true, icon: { glyph: 'V', color: '#f7f2ff', bg: '#2b1f42' } },

    staggerBoost: { name: '破勢重擊', description: '造成的失衡值 +50%。', implemented: true, icon: { glyph: 'ST', color: '#ffef8a', bg: '#3b3012' } },
    teamworkSpark: { name: '同心火花', description: '同心協力移動時，角色周遭生成火花並對敵人造成 DOT 傷害。', implemented: true, icon: { glyph: '火', color: '#ffbd5a', bg: '#3b1d12' } },
    instantCharge: { name: '一念蓄力', description: '蓄力攻擊可瞬間完成。', implemented: true, icon: { glyph: '快', color: '#e6f7ff', bg: '#173042' } },
    comboTripleOnce: { name: '終極一發', description: '下一次組合技傷害變為 3 倍，施放後此 Buff 消失。', implemented: true, icon: { glyph: '1X', color: '#fff0a6', bg: '#3d3210' } },
    speedRisk: { name: '暴走疾行', description: '移動與轉向速度 +60%，但受到失衡值 +40%。', implemented: true, icon: { glyph: '!!', color: '#ff7a7a', bg: '#3d1010' } },
    armoredSlow: { name: '重甲守勢', description: '防禦率 +30%，但移動與轉向速度 -30%。', implemented: true, icon: { glyph: '甲', color: '#d6e2ff', bg: '#202838' } },
    highAttackChaos: { name: '霸道輸出', description: '攻擊力 +70%；但四名玩家同時有輸入時，所有輸入都無效。', implemented: true, icon: { glyph: '霸', color: '#ffcf66', bg: '#3d1710' } },
    noFallSlow: { name: '定海步', description: '不會跌倒，但移動與轉向速度 -20%。', implemented: true, icon: { glyph: '穩', color: '#d9fff2', bg: '#173631' } },
    teamworkGuard: { name: '同心結界', description: '同心協力移動時無敵；不同心協力時受傷 +30%。', implemented: true, icon: { glyph: '結', color: '#9fffd4', bg: '#14352b' } },

    lifeSteal: { name: '有效傷害回血', description: '造成有效傷害時回復少量 HP。', implemented: true, pvpExclude: true, icon: { glyph: 'L', color: '#ff6b7a', bg: '#3d151b' } },
    teamworkRegen: { name: '同心協力回血', description: '同向加速時持續回血。', implemented: true, pvpExclude: true, icon: { glyph: 'H', color: '#73ff9a', bg: '#17351e' } },
    hpBoost: { name: '增加血量 30%', description: '已禁用：此 Buff 不會在 PVP/PVE/問號箱抽取，也無法手動啟用。', implemented: false, disabled: true, pvpExclude: true, icon: { glyph: '+', color: '#62f28f', bg: '#14371f' } },
    reflectProjectile: { name: '50% 反彈投射物', description: '已禁用：此 Buff 不會在 PVP/PVE/問號箱抽取，也無法手動啟用。', implemented: false, disabled: true, pvpExclude: true, icon: { glyph: 'R', color: '#b7ffdd', bg: '#12382a' } },
    ramStagger: { name: '高速衝撞', description: '已禁用：此 Buff 不會在 PVP/PVE 抽取，也無法手動啟用。', implemented: false, disabled: true, pvpExclude: true, icon: { glyph: 'R', color: '#ff5a5a', bg: '#3d1010' } }
};

function isBuffImplemented(id) {
    return BUFFS[id] && BUFFS[id].implemented !== false;
}

function isDragonFormBuff(id) {
    const group = BUFFS[id] && BUFFS[id].group;
    return group === 'meleeForm' || group === 'comboForm';
}

function getBuffIconSpec(id) {
    const cfg = BUFFS[id] || {};
    return cfg.icon || { glyph: '?', color: '#ffffff', bg: '#333333' };
}

function createBuffIconElement(id) {
    const spec = getBuffIconSpec(id);
    const icon = document.createElement('span');
    icon.className = 'buff-icon';
    icon.textContent = spec.glyph;
    icon.style.display = 'inline-flex';
    icon.style.alignItems = 'center';
    icon.style.justifyContent = 'center';
    icon.style.width = '20px';
    icon.style.height = '20px';
    icon.style.borderRadius = '5px';
    icon.style.background = spec.bg;
    icon.style.color = spec.color;
    icon.style.border = '1px solid rgba(255,255,255,0.25)';
    icon.style.fontSize = spec.glyph.length > 1 ? '9px' : '12px';
    icon.style.fontWeight = '800';
    icon.style.lineHeight = '1';
    icon.style.flex = '0 0 auto';
    return icon;
}

function createBuffIconSprite(id, stack) {
    const spec = getBuffIconSpec(id);
    const size = 64;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    const drawRoundRect = (x, y, w, h, r) => {
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.lineTo(x + w - r, y);
        ctx.quadraticCurveTo(x + w, y, x + w, y + r);
        ctx.lineTo(x + w, y + h - r);
        ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
        ctx.lineTo(x + r, y + h);
        ctx.quadraticCurveTo(x, y + h, x, y + h - r);
        ctx.lineTo(x, y + r);
        ctx.quadraticCurveTo(x, y, x + r, y);
        ctx.closePath();
    };

    ctx.clearRect(0, 0, size, size);
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    drawRoundRect(6, 6, 52, 52, 12);
    ctx.fill();
    ctx.fillStyle = spec.bg;
    drawRoundRect(9, 9, 46, 46, 10);
    ctx.fill();
    ctx.strokeStyle = spec.color;
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.fillStyle = spec.color;
    ctx.font = `800 ${spec.glyph.length > 1 ? 20 : 30}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(spec.glyph, 32, 31);

    if (stack > 1) {
        ctx.fillStyle = 'rgba(0,0,0,0.86)';
        ctx.beginPath();
        ctx.arc(49, 49, 12, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.font = '800 14px sans-serif';
        ctx.fillText(String(stack), 49, 49);
    }

    const texture = new THREE.CanvasTexture(canvas);
    const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false });
    const sprite = new THREE.Sprite(material);
    sprite.renderOrder = 1002;
    return sprite;
}

class BuffSystem {
    constructor(dragon) {
        this.dragon = dragon;
        this.active = new Map();
        this.timers = {};
        this.objects = {
            poisonPools: [],
            leafShields: [],
            poisonClouds: [],
            missileNest: null,
            comboFloraVines: null,
            comboPteroWings: null,
            guardShield: null,
            stationaryShield: null,
            invincibleShield: null
        };
        this.lowHpExplosionUsed = false;
        this.lastPoisonDropPos = null;
        this.poisonDropTimer = 0;
        this.lastStepShockwavePos = null;
        this.suspendedActive = null;
        this.suspendedTimer = 0;
        this.suspendedLowHpExplosionUsed = false;
    }

    toggle(id) {
        const cfg = BUFFS[id];
        if (!cfg) return;
        if (cfg.disabled) return;

        if (this.active.has(id)) {
            this.active.delete(id);
        } else {
            if (cfg.group) {
                Object.keys(BUFFS).forEach(otherId => {
                    if (BUFFS[otherId].group === cfg.group) this.active.delete(otherId);
                });
            }
            this.active.set(id, 1);
        }
        this.refreshPlayerStats();
    }

    addStack(id) {
        const cfg = BUFFS[id];
        if (!cfg || cfg.disabled) return;
        this.active.set(id, 1);
        this.refreshPlayerStats();
    }

    removeStack(id) {
        const cfg = BUFFS[id];
        if (!cfg || cfg.disabled) return;
        this.active.delete(id);
        this.refreshPlayerStats();
    }

    setStack(id, stack) {
        const cfg = BUFFS[id];
        if (!cfg || cfg.disabled) return;
        const next = Math.max(0, Math.floor(stack));
        if (next > 0) this.active.set(id, 1);
        else this.active.delete(id);
        this.refreshPlayerStats();
    }

    clear(id) {
        this.active.delete(id);
        this.refreshPlayerStats();
    }

    clearAll(options = {}) {
        const clearSuspended = options.clearSuspended !== false;
        const ids = Array.from(this.active.keys());
        this.active.clear();
        // 清掉視覺物件
        this.objects.leafShields.forEach(s => this._disposeMesh(s.mesh));
        this.objects.leafShields = [];
        this.objects.poisonPools.forEach(p => this._disposeMesh(p.mesh));
        this.objects.poisonPools = [];
        this.objects.poisonClouds.forEach(cloud => {
            cloud.puffs.forEach(p => this._disposeMesh(p.mesh));
        });
        this.objects.poisonClouds = [];
        if (this.objects.missileNest) {
            this._disposeMesh(this.objects.missileNest);
            this.objects.missileNest = null;
        }
        ['comboFloraVines', 'comboPteroWings', 'guardShield', 'stationaryShield', 'invincibleShield'].forEach(key => {
            if (this.objects[key]) {
                this._disposeMesh(this.objects[key]);
                this.objects[key] = null;
            }
        });
        this.lowHpExplosionUsed = false;
        if (clearSuspended) {
            this.suspendedActive = null;
            this.suspendedTimer = 0;
            this.suspendedLowHpExplosionUsed = false;
        }
        this.refreshPlayerStats();
        return ids;
    }

    suspendAll(duration) {
        if (this.suspendedActive) {
            this.suspendedTimer = Math.max(this.suspendedTimer, duration);
            return;
        }
        if (this.active.size === 0) return;
        this.suspendedActive = new Map(this.active);
        this.suspendedTimer = Math.max(0, duration);
        this.suspendedLowHpExplosionUsed = this.lowHpExplosionUsed;
        this.clearAll({ clearSuspended: false });
    }

    isActive(id) {
        return this.active.has(id);
    }

    getStack(id) {
        return this.active.has(id) ? 1 : 0;
    }

    getActiveIconEntries() {
        return Array.from(this.active.entries()).map(([id, stack]) => ({ id, stack }));
    }

    getBodyVisualScale() {
        return 1 + (this.isActive('hpBoost') ? CONFIG.buffs.hpVisualScalePerStack : 0);
    }

    getMeleeForm() {
        const type = getDragonTypeConfig(this.dragon && this.dragon.dragonType);
        return type.meleeForm || 'default';
    }

    getComboForm() {
        const type = getDragonTypeConfig(this.dragon && this.dragon.dragonType);
        return type.comboForm || 'beam';
    }

    getHpMultiplier() {
        return this.isActive('hpBoost') ? 1 + CONFIG.buffs.hpBoostPct : 1;
    }

    getSpeedMultiplier() {
        let multiplier = 1;
        if (this.isActive('speedBoost')) multiplier *= 1 + CONFIG.buffs.speedBoostPct;
        if (this.isActive('speedRisk')) multiplier *= 1 + CONFIG.buffs.speedRiskSpeedPct;
        if (this.isActive('armoredSlow')) multiplier *= CONFIG.buffs.armoredSpeedMultiplier;
        if (this.isActive('noFallSlow')) multiplier *= CONFIG.buffs.noFallSpeedMultiplier;
        return multiplier;
    }

    getTurnMultiplier() {
        return this.getSpeedMultiplier();
    }

    getHeadAttackMultiplier() {
        return this.isActive('meleeBoost') ? 1 + CONFIG.buffs.headAttackBoostPct : 1;
    }

    getAttackMultiplier() {
        return this.isActive('highAttackChaos') ? 1 + CONFIG.buffs.globalAttackBoostPct : 1;
    }

    getMeleeMultiplier(playerIndex) {
        const headMultiplier = playerIndex && playerIndex !== 'p4' ? this.getHeadAttackMultiplier() : 1;
        return headMultiplier * this.getAttackMultiplier();
    }

    getDefenseMultiplier() {
        let multiplier = 1;
        if (this.isActive('defenseBoost')) multiplier *= 1 - CONFIG.buffs.defenseBoostPct;
        if (this.isActive('armoredSlow')) multiplier *= 1 - CONFIG.buffs.armoredDefensePct;
        return multiplier;
    }

    getKnockbackMultiplier() {
        return this.isActive('knockbackBoost') ? CONFIG.buffs.knockbackBoostMultiplier : 1;
    }

    getComboCooldownMultiplier() {
        return this.isActive('comboCd') ? CONFIG.buffs.comboCooldownMultiplier : 1;
    }

    getComboDamageMultiplier() {
        let multiplier = this.getAttackMultiplier();
        if (this.isActive('comboDamage')) multiplier *= CONFIG.buffs.comboDamageMultiplier;
        if (this.dragon && this.dragon.comboTripleOnceActive) multiplier *= CONFIG.buffs.comboTripleOnceMultiplier;
        return multiplier;
    }

    getOutgoingStaggerMultiplier() {
        return this.isActive('staggerBoost') ? CONFIG.buffs.outgoingStaggerMultiplier : 1;
    }

    getIncomingStaggerMultiplier() {
        if (this.isActive('noFallSlow')) return 0;
        let multiplier = 1;
        if (this.isActive('staggerImmune')) multiplier *= CONFIG.buffs.staggerImmuneIncomingMultiplier;
        if (this.isActive('speedRisk')) multiplier *= CONFIG.buffs.speedRiskIncomingStaggerMultiplier;
        return multiplier;
    }

    isComboLeafInvincible() {
        const dragon = this.dragon;
        return this.isActive('leafShield') && dragon && dragon.beamPhase === 'firing';
    }

    isAllInputBlocked(players) {
        const dragon = this.dragon;
        if (!dragon || !this.isActive('highAttackChaos')) return false;
        return players.every(p => {
            const input = dragon.input[p];
            return input && (input.attack || input.charge || input.move.lengthSq() > 0.01);
        });
    }

    getComboRampWindow(stacks) {
        const maxStacks = Math.max(1, CONFIG.buffs.comboDamageMaxStacks);
        const minWindow = CONFIG.buffs.comboDamageMinWindow;
        const baseWindow = CONFIG.buffs.comboDamageWindow;
        const t = maxStacks <= 1
            ? 1
            : THREE.MathUtils.clamp(((stacks || 1) - 1) / (maxStacks - 1), 0, 1);
        return Math.max(minWindow, THREE.MathUtils.lerp(baseWindow, minWindow, t));
    }

    refreshPlayerStats() {
        const dragon = this.dragon;
        if (!dragon) return;
        const oldMax = dragon.maxHP || CONFIG.stats.playerHP;
        dragon.maxHP = CONFIG.stats.playerHP * this.getHpMultiplier();
        if (dragon.hp > dragon.maxHP) dragon.hp = dragon.maxHP;
        if (dragon.hp === oldMax && dragon.maxHP > oldMax) dragon.hp = dragon.maxHP;
        dragon.comboCooldownMax = CONFIG.combo.cooldown * this.getComboCooldownMultiplier();
        dragon.comboCooldown = Math.min(dragon.comboCooldown, dragon.comboCooldownMax);
    }

    onEffectiveDamage(amount) {
        const dragon = this.dragon;
        if (!dragon || amount <= 0) return;

        if (this.isActive('lifeSteal')) {
            const healAmount = amount * CONFIG.buffs.lifeStealPct;
            dragon.heal(healAmount);
            this._spawnHealCross(dragon);
        }
        if (this.isActive('comboRamp')) {
            dragon.comboRampStacks = Math.min(
                CONFIG.buffs.comboDamageMaxStacks,
                (dragon.comboRampStacks || 0) + 1
            );
            dragon.comboRampTimer = this.getComboRampWindow(dragon.comboRampStacks);
        }
    }

    blockIncomingDamage() {
        // 葉子護盾改為投射物反彈，不再擋一般傷害
        return false;
    }

    findLeafShieldHit(bulletPos) {
        if (!this.isActive('leafShield')) return null;
        const hitR = CONFIG.buffs.leafShieldHitRadius;
        const hitRSq = hitR * hitR;
        for (const s of this.objects.leafShields) {
            if (!s.mesh || !s.mesh.visible) continue;
            const dx = bulletPos.x - s.mesh.position.x;
            const dy = bulletPos.y - s.mesh.position.y;
            const dz = bulletPos.z - s.mesh.position.z;
            if (dx * dx + dy * dy + dz * dz <= hitRSq) return s;
        }
        return null;
    }

    reflectProjectile(bullet, dragon) {
        if (!this.isActive('reflectProjectile')) return false;
        if (Math.random() >= CONFIG.buffs.projectileReflectChance) return false;
        const dir = bullet.mesh.position.clone().sub(dragon.mesh.position).normalize();
        dir.y = Math.max(0.05, dir.y);
        bullet.isEnemy = false;
        bullet.owner = 'reflected';
        bullet.attackerDragon = dragon; // 反彈後子彈視為由反彈方發出
        bullet.velocity.copy(dir.multiplyScalar(bullet.speed || 16));
        bullet.damage = Math.max(bullet.damage || 5, CONFIG.buffs.reflectedBulletDamageMin);
        bullet.knockback = CONFIG.buffs.reflectedBulletKnockback * this.getKnockbackMultiplier();
        bullet.hitEntities = new Set();
        if (bullet.mesh && bullet.mesh.material) bullet.mesh.material.color.setHex(0x99ff55);
        return true;
    }

    update(dt) {
        const dragon = this.dragon;
        if (!dragon) return;

        this._updateSuspendedBuffs(dt);
        this.refreshPlayerStats();
        this._updateLeafShields(dt, dragon);
        this._updatePoisonTrail(dt, dragon);
        this._updatePoisonPools(dt);
        this._updateMissileNest(dt, dragon);
        this._updateStepShockwave(dragon);
        this._updatePoisonCloud(dt, dragon);
        this._updatePoisonClouds(dt);
        this._updateTeamworkSpark(dt, dragon);
        this._updateLowHpExplosion(dragon);
        this._updateComboFormDecor(dt, dragon);
        this._updateBuffVisuals(dt, dragon);
    }

    _updateSuspendedBuffs(dt) {
        if (!this.suspendedActive) return;
        this.suspendedTimer = Math.max(0, this.suspendedTimer - dt);
        if (this.suspendedTimer > 0) return;
        this.active = new Map(this.suspendedActive);
        this.suspendedActive = null;
        this.lowHpExplosionUsed = this.suspendedLowHpExplosionUsed;
        this.suspendedLowHpExplosionUsed = false;
        this.refreshPlayerStats();
    }

    _updateLeafShields(dt, dragon) {
        if (!this.isActive('leafShield')) {
            this.objects.leafShields.forEach(s => this._disposeMesh(s.mesh));
            this.objects.leafShields = [];
            return;
        }

        const count = this.isComboLeafInvincible()
            ? CONFIG.buffs.leafShieldComboCount
            : CONFIG.buffs.leafShieldCount;
        while (this.objects.leafShields.length < count) {
            const geo = new THREE.PlaneGeometry(0.55, 0.9);
            const mat = new THREE.MeshBasicMaterial({ color: 0x77dd55, side: THREE.DoubleSide, transparent: true, opacity: 0.9 });
            const mesh = new THREE.Mesh(geo, mat);
            scene.add(mesh);
            this.objects.leafShields.push({ mesh, angle: Math.random() * Math.PI * 2, cooldown: 0 });
        }
        while (this.objects.leafShields.length > count) {
            const shield = this.objects.leafShields.pop();
            this._disposeMesh(shield.mesh);
        }

        const t = Date.now() * 0.002;
        const radius = CONFIG.buffs.leafShieldRadius;
        this.objects.leafShields.forEach((s, i) => {
            s.mesh.visible = true;
            s.angle = t + (i / count) * Math.PI * 2;
            s.mesh.position.copy(dragon.mesh.position).add(new THREE.Vector3(Math.cos(s.angle) * radius, 1.8, Math.sin(s.angle) * radius));
            s.mesh.lookAt(camera.position);
        });
    }

    _updatePoisonTrail(dt, dragon) {
        if (!this.isActive('poisonTrail') || dragon.velocity.lengthSq() < 1.0) return;
        this.poisonDropTimer -= dt;
        if (this.poisonDropTimer > 0) return;
        this.poisonDropTimer = CONFIG.terrain.poisonDropInterval;

        const pos = dragon.mesh.position.clone();
        pos.y = 0.03;
        if (this.lastPoisonDropPos && this.lastPoisonDropPos.distanceTo(pos) < 1.0) return;
        this.lastPoisonDropPos = pos.clone();
        this._spawnPoisonPool(pos, 2.1, CONFIG.terrain.poisonLife, true);
    }

    _spawnPoisonPool(pos, radius, life, slows) {
        const geo = new THREE.CircleGeometry(radius, 24);
        const isDragonB = this.dragon && this.dragon.index === 1;
        const mat = new THREE.MeshBasicMaterial({
            color: isDragonB ? 0x9b45ff : (slows ? 0x33aa33 : 0x55cc66),
            transparent: true,
            opacity: slows ? 0.45 : 0.25,
            side: THREE.DoubleSide
        });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.rotation.x = -Math.PI / 2;
        mesh.position.copy(pos);
        scene.add(mesh);
        this.objects.poisonPools.push({ mesh, radius, life, maxLife: life, slows, damageTimer: 0 });
    }

    _updatePoisonPools(dt) {
        for (let i = this.objects.poisonPools.length - 1; i >= 0; i--) {
            const pool = this.objects.poisonPools[i];
            pool.life -= dt;
            pool.mesh.material.opacity = (pool.life / pool.maxLife) * (pool.slows ? 0.45 : 0.25);
            pool.damageTimer += dt;
            if (pool.damageTimer >= 0.5) {
                pool.damageTimer = 0;
                this._damageTargetsInRadius(pool.mesh.position, pool.radius, CONFIG.terrain.poisonDamagePerSecond * 0.5, pool.slows);
            }
            if (pool.life <= 0) {
                this._disposeMesh(pool.mesh);
                this.objects.poisonPools.splice(i, 1);
            }
        }
    }

    _updateMissileNest(dt, dragon) {
        if (!this.isActive('missileNest')) {
            if (this.objects.missileNest) {
                this._disposeMesh(this.objects.missileNest);
                this.objects.missileNest = null;
            }
            return;
        }

        if (!this.objects.missileNest) {
            const nest = new THREE.Group();
            const base = new THREE.Mesh(
                new THREE.BoxGeometry(1.1, 0.35, 0.8),
                new THREE.MeshLambertMaterial({ color: 0x555555 })
            );
            nest.add(base);
            for (let i = 0; i < 4; i++) {
                const tube = new THREE.Mesh(
                    new THREE.CylinderGeometry(0.12, 0.12, 0.9, 8),
                    new THREE.MeshLambertMaterial({ color: 0xffaa22 })
                );
                tube.rotation.x = Math.PI / 2;
                tube.position.set((i - 1.5) * 0.28, 0.15, 0.08);
                nest.add(tube);
            }
            scene.add(nest);
            this.objects.missileNest = nest;
        }

        const bodyScale = this.getBodyVisualScale();
        this.objects.missileNest.position.copy(dragon.mesh.position);
        this.objects.missileNest.position.y += 2.35 * bodyScale + 0.35;
        this.objects.missileNest.quaternion.copy(dragon.mesh.quaternion);

        if (state.pvp && state.pvp.active && state.pvp.startCountdownTimer > 0) return;

        this.timers.missile = (this.timers.missile || 0) - dt;
        if (this.timers.missile > 0) return;
        this.timers.missile = CONFIG.buffs.missileInterval;

        // 找一個目標：先找敵人，再找另一隻 PVP 三頭龍
        let target = null;
        if (state.enemyManager) {
            target = state.enemyManager.enemies.find(e => !e.isDead);
        }
        if (!target) {
            const otherDragon = state.dragons.find(d => d && d !== dragon && !d.isDead);
            if (otherDragon) target = { mesh: otherDragon.mesh };
        }
        if (!target) return;

        const startPos = this.objects.missileNest
            ? this.objects.missileNest.position.clone()
            : dragon.mesh.position.clone();
        startPos.y += 0.4;
        const dir = target.mesh.position.clone().sub(startPos).normalize();
        const missile = new Bullet('p1', startPos, dir, CONFIG.buffs.missileSpeed, 4.0, 0, 0.35, {
            damage: CONFIG.buffs.missileDamage,
            color: 0xffaa22,
            isHoming: true,
            target: target.mesh,
            homingStrength: 3.5,
            knockback: CONFIG.buffs.missileKnockback * this.getKnockbackMultiplier()
        });
        missile.attackerDragon = dragon; // 飛彈視為由本龍發出
        state.bullets.push(missile);
    }

    _updateStepShockwave(dragon) {
        if (!this.isActive('stepShockwave')) {
            this.lastStepShockwavePos = dragon.mesh.position.clone();
            return;
        }
        if (!this.lastStepShockwavePos) this.lastStepShockwavePos = dragon.mesh.position.clone();
        if (this.lastStepShockwavePos.distanceTo(dragon.mesh.position) < CONFIG.buffs.stepShockwaveDistance) return;
        this.lastStepShockwavePos.copy(dragon.mesh.position);
        dragon.createShockwaveBlast(dragon.mesh.position.clone(), 4.0, CONFIG.buffs.stepShockwaveDamage, 45);
    }

    _updatePoisonCloud(dt, dragon) {
        if (!this.isActive('poisonTrail')) return;
        this.timers.poisonCloud = (this.timers.poisonCloud || CONFIG.buffs.poisonCloudInterval) - dt;
        if (this.timers.poisonCloud > 0) return;
        this.timers.poisonCloud = CONFIG.buffs.poisonCloudInterval;
        const pos = dragon.mesh.position.clone();
        pos.y = 1.2;
        this._spawnPoisonCloud(pos, CONFIG.buffs.poisonCloudRadius, CONFIG.buffs.poisonCloudDuration);
    }

    _spawnPoisonCloud(pos, radius, life) {
        const cloud = { pos: pos.clone(), radius, life, maxLife: life, damageTimer: 0, puffs: [] };
        for (let i = 0; i < 34; i++) {
            const angle = Math.random() * Math.PI * 2;
            const r = Math.sqrt(Math.random()) * radius;
            const y = pos.y + Math.random() * 2.4;
            const geo = new THREE.SphereGeometry(0.45 + Math.random() * 0.9, 8, 6);
            const isDragonB = this.dragon && this.dragon.index === 1;
            const mat = new THREE.MeshBasicMaterial({
                color: isDragonB
                    ? (Math.random() > 0.5 ? 0x9b45ff : 0xc486ff)
                    : (Math.random() > 0.5 ? 0x55cc66 : 0x88ff77),
                transparent: true,
                opacity: 0.22,
                depthWrite: false
            });
            const puff = new THREE.Mesh(geo, mat);
            puff.position.set(
                pos.x + Math.cos(angle) * r,
                y,
                pos.z + Math.sin(angle) * r
            );
            scene.add(puff);
            cloud.puffs.push({
                mesh: puff,
                baseOpacity: mat.opacity,
                drift: new THREE.Vector3((Math.random() - 0.5) * 0.7, 0.08 + Math.random() * 0.18, (Math.random() - 0.5) * 0.7)
            });
        }
        this.objects.poisonClouds.push(cloud);
    }

    _updatePoisonClouds(dt) {
        for (let i = this.objects.poisonClouds.length - 1; i >= 0; i--) {
            const cloud = this.objects.poisonClouds[i];
            cloud.life -= dt;
            const lifePct = Math.max(0, cloud.life / cloud.maxLife);
            cloud.puffs.forEach(p => {
                p.mesh.position.add(p.drift.clone().multiplyScalar(dt));
                p.mesh.material.opacity = p.baseOpacity * lifePct;
                p.mesh.scale.multiplyScalar(1 + dt * 0.08);
            });

            cloud.damageTimer += dt;
            if (cloud.damageTimer >= 0.5) {
                cloud.damageTimer = 0;
                this._damageTargetsInRadius(cloud.pos, cloud.radius, CONFIG.terrain.poisonDamagePerSecond * 0.5, false);
            }

            if (cloud.life <= 0) {
                cloud.puffs.forEach(p => this._disposeMesh(p.mesh));
                this.objects.poisonClouds.splice(i, 1);
            }
        }
    }

    _updateLowHpExplosion(dragon) {
        // 觸發改為跌倒站起完成時 (onStandUpComplete)，這裡保留為 no-op 以維持 update 流程
    }

    onStandUpComplete() {
        const dragon = this.dragon;
        const suspendedHasBuff = this.suspendedActive && this.suspendedActive.has('staggerImmune');
        if (!dragon || dragon.isDead || (!this.isActive('staggerImmune') && !suspendedHasBuff)) return;
        dragon.createAreaDamage(
            dragon.mesh.position.clone(),
            CONFIG.buffs.lowHpExplosionRadius,
            CONFIG.buffs.lowHpExplosionDamage,
            0xffaa00,
            { stagger: 100 }
        );
    }

    _updateTeamworkSpark(dt, dragon) {
        if (!this.isActive('teamworkSpark') || !dragon.isTeamworkMoving) return;
        this.timers.teamworkSpark = (this.timers.teamworkSpark || 0) - dt;
        if (this.timers.teamworkSpark > 0) return;
        this.timers.teamworkSpark = CONFIG.buffs.teamworkSparkInterval;
        const center = dragon.mesh.position.clone();
        center.y = 0.6;
        for (let i = 0; i < 8; i++) {
            const angle = Math.random() * Math.PI * 2;
            const radius = Math.random() * CONFIG.buffs.teamworkSparkRadius;
            const pos = center.clone().add(new THREE.Vector3(Math.cos(angle) * radius, Math.random() * 1.4, Math.sin(angle) * radius));
            const p = new Particle(pos, Math.random() > 0.45 ? 0xffaa22 : 0xffee66);
            p.life = 0.32;
            p.maxLife = 0.32;
            p.mesh.scale.setScalar(0.35 + Math.random() * 0.25);
            state.particles.push(p);
        }
        this._damageTargetsInRadius(
            dragon.mesh.position,
            CONFIG.buffs.teamworkSparkRadius,
            CONFIG.buffs.teamworkSparkDamage * this.getAttackMultiplier(),
            false
        );
    }

    _updateComboFormDecor(dt, dragon) {
        this._updateFloraDecor(dt, dragon);
        this._updatePteroWingDecor(dt, dragon);
    }

    _updateFloraDecor(dt, dragon) {
        if (this.getComboForm() !== 'flora') {
            if (this.objects.comboFloraVines) {
                this._disposeMesh(this.objects.comboFloraVines);
                this.objects.comboFloraVines = null;
            }
            return;
        }

        if (!this.objects.comboFloraVines) {
            const group = new THREE.Group();
            const vineCount = Math.max(1, CONFIG.buffs.comboFloraDecorVineCount);
            const up = new THREE.Vector3(0, 1, 0);
            for (let i = 0; i < vineCount; i++) {
                const vine = new THREE.Group();
                const baseAngle = (i / vineCount) * Math.PI * 2 + (Math.random() - 0.5) * 0.55;
                vine.userData.baseAngle = baseAngle;
                vine.userData.phase = Math.random() * Math.PI * 2;

                for (let j = 0; j < 4; j++) {
                    const geo = new THREE.CylinderGeometry(0.045, 0.075, 0.5 + Math.random() * 0.24, 7);
                    const mat = new THREE.MeshLambertMaterial({ color: j % 2 === 0 ? 0x2f8f36 : 0x58b84e });
                    const seg = new THREE.Mesh(geo, mat);
                    const angle = baseAngle + (j - 1.5) * (0.22 + Math.random() * 0.2) + (Math.random() - 0.5) * 0.32;
                    const xRadius = 1.36 + Math.random() * 0.36;
                    const zRadius = 2.0 + Math.random() * 0.35;
                    const tangent = new THREE.Vector3(
                        -Math.sin(angle) * xRadius,
                        0.85 * Math.sin(j * 1.9 + baseAngle) + (Math.random() - 0.5) * 0.6,
                        Math.cos(angle) * zRadius
                    ).normalize();
                    seg.quaternion.copy(new THREE.Quaternion().setFromUnitVectors(up, tangent));
                    seg.position.set(
                        Math.cos(angle) * xRadius,
                        0.72 + Math.random() * 0.78,
                        Math.sin(angle) * zRadius
                    );
                    seg.userData.basePosition = seg.position.clone();
                    seg.userData.baseQuaternion = seg.quaternion.clone();
                    seg.userData.phase = Math.random() * Math.PI * 2;
                    vine.add(seg);
                }
                group.add(vine);
            }
            dragon.mesh.add(group);
            this.objects.comboFloraVines = group;
        }

        const t = Date.now() * 0.003;
        this.objects.comboFloraVines.children.forEach((vine, i) => {
            const baseAngle = vine.userData.baseAngle || 0;
            const wave = Math.sin(t + (vine.userData.phase || 0)) * 0.13;
            vine.rotation.y = baseAngle * 0.03 + wave;
            vine.rotation.x = Math.sin(t * 0.8 + i) * 0.06;
            vine.children.forEach((seg, j) => {
                if (!seg.userData.basePosition || !seg.userData.baseQuaternion) return;
                const phase = seg.userData.phase || 0;
                seg.position.copy(seg.userData.basePosition);
                seg.position.y += Math.sin(t * 1.4 + phase) * 0.055;
                seg.quaternion.copy(seg.userData.baseQuaternion);
                seg.rotation.y += Math.sin(t * 1.8 + phase + j) * 0.03;
            });
        });
    }

    _updatePteroWingDecor(dt, dragon) {
        if (this.getComboForm() !== 'ptero') {
            if (this.objects.comboPteroWings) {
                this._disposeMesh(this.objects.comboPteroWings);
                this.objects.comboPteroWings = null;
            }
            return;
        }

        if (!this.objects.comboPteroWings) {
            const group = new THREE.Group();
            const makeWing = (side) => {
                const wing = new THREE.Group();
                const shape = new THREE.Shape();
                shape.moveTo(0, 0);
                shape.lineTo(side * 1.45, 0.3);
                shape.lineTo(side * 0.35, -1.05);
                shape.lineTo(0, 0);
                const geo = new THREE.ShapeGeometry(shape);
                const mat = new THREE.MeshLambertMaterial({
                    color: 0xd8c77a,
                    side: THREE.DoubleSide,
                    transparent: true,
                    opacity: 0.92
                });
                const membrane = new THREE.Mesh(geo, mat);
                wing.add(membrane);

                const boneMat = new THREE.MeshLambertMaterial({ color: 0xf2e4aa });
                const bone = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 1.45, 6), boneMat);
                bone.position.set(side * 0.55, 0.08, 0.01);
                bone.rotation.z = side * Math.PI / 2.55;
                wing.add(bone);

                wing.position.set(side * 0.88, 1.52, -0.62);
                wing.rotation.x = -0.18;
                wing.rotation.y = side * 0.42;
                wing.rotation.z = side * 0.24;
                return wing;
            };

            group.add(makeWing(-1));
            group.add(makeWing(1));
            group.scale.setScalar(CONFIG.buffs.comboPteroWingScale);
            dragon.mesh.add(group);
            this.objects.comboPteroWings = group;
        }

        const t = Date.now() * 0.006;
        const flap = Math.sin(t) * 0.08;
        this.objects.comboPteroWings.children.forEach((wing, i) => {
            const side = i === 0 ? -1 : 1;
            wing.rotation.z = side * (0.24 + flap);
        });
    }

    _updateBuffVisuals(dt, dragon) {
        if (dragon.tailGroup) {
            const tailScale = this.isActive('tailPower') ? CONFIG.buffs.tailPowerSweepRadiusMultiplier : 1.0;
            dragon.tailGroup.scale.set(tailScale, tailScale, tailScale);
        }

        this._updateGuardShield(dragon);
        this._updateStationaryShieldVisual(dragon);
        this._updateInvincibleShieldVisual(dragon);

        this.timers.visualPulse = (this.timers.visualPulse || 0) - dt;
        if (this.timers.visualPulse > 0) return;
        this.timers.visualPulse = CONFIG.buffs.visualPulseInterval;

        if (this.isActive('speedBoost') && dragon.velocity.lengthSq() > 0.2) {
            this._spawnFeather(dragon);
        }
        if (this.isActive('lifeSteal')) this._spawnBuffParticle(dragon, 0xff3355, 2.4, 0.55);
        if (this.isActive('meleeBoost')) this._spawnBuffParticle(dragon, 0xffcc33, 2.1, 0.55);
        if (this.isActive('comboCd') && dragon.comboCooldown > 0) this._spawnRing(dragon.mesh.position, 0xaaaaaa, 1.1);
        if (this.isActive('comboDamage')) this._spawnBuffParticle(dragon, 0xff55ff, 2.8, 0.6);
        if (this.isActive('beamSlow')) this._spawnBuffParticle(dragon, 0xaaddff, 2.6, 0.6);
        if (this.isActive('highAttackChaos')) this._spawnBuffParticle(dragon, 0xff7733, 2.5, 0.65);
    }

    _spawnBuffParticle(dragon, color, height, scale) {
        const angle = Math.random() * Math.PI * 2;
        const pos = dragon.mesh.position.clone().add(new THREE.Vector3(Math.cos(angle) * 1.5, height, Math.sin(angle) * 1.5));
        const p = new Particle(pos, color);
        p.velocity.multiplyScalar(0.2);
        p.velocity.y = Math.abs(p.velocity.y) + 1.5;
        p.life = 0.45;
        p.maxLife = 0.45;
        p.mesh.scale.setScalar(scale);
        state.particles.push(p);
    }

    _spawnFeather(dragon) {
        const back = dragon.getForwardVector().normalize().negate();
        const side = new THREE.Vector3(back.z, 0, -back.x).multiplyScalar((Math.random() - 0.5) * 1.8);
        const pos = dragon.mesh.position.clone().add(back.multiplyScalar(1.8)).add(side);
        pos.y = 1.0 + Math.random() * 1.3;
        const p = new Particle(pos, 0xf3f3f3);
        p.velocity.set((Math.random() - 0.5) * 1.5, 1 + Math.random(), (Math.random() - 0.5) * 1.5);
        p.life = 0.7;
        p.maxLife = 0.7;
        p.mesh.scale.set(0.18, 0.5, 0.08);
        state.particles.push(p);
    }

    _updateGuardShield(dragon) {
        if (!this.isActive('directionalGuard')) {
            if (this.objects.guardShield) {
                this._disposeMesh(this.objects.guardShield);
                this.objects.guardShield = null;
            }
            return;
        }
        if (!this.objects.guardShield) {
            const geo = new THREE.CircleGeometry(1.75, 32);
            const mat = new THREE.MeshBasicMaterial({
                color: 0x8ec7ff,
                transparent: true,
                opacity: 0.16,
                side: THREE.DoubleSide,
                depthWrite: false
            });
            this.objects.guardShield = new THREE.Mesh(geo, mat);
            scene.add(this.objects.guardShield);
        }
        const shield = this.objects.guardShield;
        shield.visible = true;
        shield.position.copy(dragon.mesh.position).add(dragon.getForwardVector().normalize().multiplyScalar(1.45));
        shield.position.y += 1.25;
        shield.quaternion.copy(dragon.mesh.quaternion);
        shield.scale.set(1.0, 0.72, 1.0);
    }

    _updateStationaryShieldVisual(dragon) {
        const active = this.isActive('stationaryShield') && dragon.stationaryTimer >= CONFIG.buffs.stationaryShieldDelay;
        if (!active) {
            if (this.objects.stationaryShield) {
                this._disposeMesh(this.objects.stationaryShield);
                this.objects.stationaryShield = null;
            }
            return;
        }
        if (!this.objects.stationaryShield) {
            const geo = new THREE.SphereGeometry(2.35, 28, 16);
            const mat = new THREE.MeshBasicMaterial({
                color: 0xd8fff5,
                transparent: true,
                opacity: 0.12,
                side: THREE.DoubleSide,
                depthWrite: false
            });
            this.objects.stationaryShield = new THREE.Mesh(geo, mat);
            scene.add(this.objects.stationaryShield);
        }
        this.objects.stationaryShield.position.copy(dragon.mesh.position);
        this.objects.stationaryShield.position.y += 1.25;
        this.objects.stationaryShield.scale.set(1.05, 0.82, 1.05);
    }

    _updateInvincibleShieldVisual(dragon) {
        const active = this.isComboLeafInvincible();
        if (!active) {
            if (this.objects.invincibleShield) {
                this._disposeMesh(this.objects.invincibleShield);
                this.objects.invincibleShield = null;
            }
            return;
        }
        if (!this.objects.invincibleShield) {
            const geo = new THREE.SphereGeometry(2.85, 32, 18);
            const mat = new THREE.MeshBasicMaterial({
                color: 0x2f8cff,
                transparent: true,
                opacity: 0.36,
                side: THREE.DoubleSide,
                depthWrite: false
            });
            this.objects.invincibleShield = new THREE.Mesh(geo, mat);
            scene.add(this.objects.invincibleShield);
        }
        const t = Date.now() * 0.006;
        this.objects.invincibleShield.position.copy(dragon.mesh.position);
        this.objects.invincibleShield.position.y += 1.35;
        this.objects.invincibleShield.scale.setScalar(1.0 + Math.sin(t) * 0.025);
        this.objects.invincibleShield.material.opacity = 0.32 + Math.sin(t * 1.4) * 0.05;
    }

    _spawnGuardArc(dragon) {
        const pos = dragon.mesh.position.clone().add(dragon.getForwardVector().normalize().multiplyScalar(1.6));
        pos.y = 0.1;
        this._spawnRing(pos, 0x88bbff, 1.0);
    }

    _spawnHealCross(dragon) {
        const group = new THREE.Group();
        const mat = new THREE.MeshBasicMaterial({ color: 0x66ff88, transparent: true, opacity: 0.95, depthTest: false });
        const v = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.9, 0.08), mat);
        const h = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.18, 0.08), mat.clone());
        group.add(v);
        group.add(h);
        group.position.copy(dragon.mesh.position);
        group.position.y += 3.0 * this.getBodyVisualScale();
        scene.add(group);
        state.particles.push({
            life: 0.65,
            maxLife: 0.65,
            update(dt) {
                this.life -= dt;
                const t = 1 - this.life / this.maxLife;
                group.position.y += dt * 1.2;
                group.scale.setScalar(1 + t * 1.4);
                group.children.forEach(child => {
                    child.material.opacity = Math.max(0, this.life / this.maxLife);
                });
                if (window.camera) group.quaternion.copy(window.camera.quaternion);
                if (this.life <= 0) {
                    group.children.forEach(child => {
                        child.geometry.dispose();
                        child.material.dispose();
                    });
                    scene.remove(group);
                    return false;
                }
                return true;
            }
        });
    }

    // 對範圍內的「敵人 + 其他三頭龍」造成傷害；slows 為 true 時順帶緩速
    _damageTargetsInRadius(pos, radius, damage, slows) {
        const owner = this.dragon;
        if (state.enemyManager) {
            state.enemyManager.enemies.forEach(e => {
                if (e.isDead || e.mesh.position.distanceTo(pos) > radius + 0.8) return;
                e.takeDamage(damage, pos, 0);
                const staggerBonus = damage * (this.getOutgoingStaggerMultiplier() - 1);
                if (staggerBonus > 0 && e.addStagger) e.addStagger(staggerBonus, pos);
                this.onEffectiveDamage(damage);
                if (slows && e.applySlow) e.applySlow(CONFIG.terrain.poisonSlowFactor, 0.7);
            });
        }
        state.dragons.forEach(d => {
            if (!d || d === owner || d.isDead) return;
            if (d.mesh.position.distanceTo(pos) > radius + 0.8) return;
            d.takeDamage(damage, pos, 0, { staggerMultiplier: this.getOutgoingStaggerMultiplier() });
            this.onEffectiveDamage(damage);
        });
    }

    _spawnRing(pos, color, expandScale) {
        if (!pos) return;
        const ringGeo = new THREE.RingGeometry(0.5, 1.0, 24);
        ringGeo.rotateX(-Math.PI / 2);
        const ringMat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, side: THREE.DoubleSide });
        const ring = new THREE.Mesh(ringGeo, ringMat);
        ring.position.copy(pos);
        ring.position.y = 0.08;
        scene.add(ring);
        state.particles.push({
            life: 0.35,
            maxLife: 0.35,
            update(dt) {
                this.life -= dt;
                const t = 1 - this.life / this.maxLife;
                ring.scale.setScalar(1 + t * expandScale);
                ring.material.opacity = Math.max(0, this.life / this.maxLife);
                if (this.life <= 0) {
                    scene.remove(ring);
                    ring.geometry.dispose();
                    ring.material.dispose();
                    return false;
                }
                return true;
            }
        });
    }

    _disposeMesh(mesh) {
        if (!mesh) return;
        if (mesh.parent) mesh.parent.remove(mesh);
        mesh.traverse(obj => {
            if (obj.geometry) obj.geometry.dispose();
            if (obj.material && obj.material.map) obj.material.map.dispose();
            if (obj.material) obj.material.dispose();
        });
    }
}
