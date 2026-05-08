// =====================================================================
// buffs.js — Buff 系統
// PVP 重構：BuffSystem 改為 class，每隻三頭龍 (Gidora) 持有自己的 instance。
// 透過 `this.dragon` 取得目標龍；所有原本 `window.gidoraInstance` /
// `state.beamPhase` 等 singleton 用法都改為 `this.dragon.xxx`。
// =====================================================================

const BUFFS = {
    hpBoost: { name: '增加血量 30%', description: '每層最大血量 +30%。', stackable: true, implemented: true, icon: { glyph: '+', color: '#62f28f', bg: '#14371f' } },
    speedBoost: { name: '移動、轉向速度提高', description: '每層速度與轉向 +30%。', stackable: true, implemented: true, icon: { glyph: '>>', color: '#59d8ff', bg: '#12303b' } },
    meleeBoost: { name: 'Melee 攻擊力 +30%', description: '每層頭槌/尾巴近戰 +30%。', stackable: true, implemented: true, icon: { glyph: 'X', color: '#ffd166', bg: '#3a2c12' } },

    comboCd: { name: '組合技 CD 縮短 60%', description: '組合技冷卻只剩 40%。', implemented: true, icon: { glyph: 'CD', color: '#c4a7ff', bg: '#231a3d' } },
    comboDamage: { name: '組合技傷害 +100%', description: '組合技傷害加倍。', implemented: true, icon: { glyph: 'B', color: '#ff8cff', bg: '#39183c' } },
    comboFlora: { name: '組合技型態：藤蔓掃場', description: '組合技改為長出藤蔓，一段時間內範圍攻擊。', group: 'comboForm', implemented: true, icon: { glyph: 'VN', color: '#b8ff8a', bg: '#173719' } },
    comboPtero: { name: '組合技型態：飛天墜擊', description: '組合技改為飛上天空，瞄準落點後墜落攻擊。', group: 'comboForm', implemented: true, icon: { glyph: 'SK', color: '#fff2a6', bg: '#2f2b12' } },
    lifeSteal: { name: '有效傷害回血', description: '造成有效傷害時回復少量 HP。', implemented: true, pvpExclude: true, icon: { glyph: 'L', color: '#ff6b7a', bg: '#3d151b' } },
    tailPower: { name: '尾巴攻擊力 +300%', description: '尾巴傷害變為 4 倍。', implemented: true, icon: { glyph: 'T', color: '#60efff', bg: '#12393d' } },
    poisonTrail: { name: '走路留下毒液', description: '毒液殘留 10 秒，緩速並 DOT 敵人。', implemented: true, icon: { glyph: 'P', color: '#8cff5f', bg: '#173a14' } },
    leafShield: { name: '一片葉子護盾', description: '一片葉子環繞，會阻擋傷害。', implemented: true, icon: { glyph: '4', color: '#a7ff83', bg: '#203714' } },

    meleeFireball: { name: 'Melee 型態：噴火球', description: '頭部近戰改成落點火球；尾巴不變。', group: 'meleeForm', implemented: true, icon: { glyph: 'F', color: '#ff9f1c', bg: '#3d2410' } },
    meleeShockwave: { name: 'Melee 型態：蓄力震波', description: '蓄力重擊會打出暈眩震波。', group: 'meleeForm', implemented: true, icon: { glyph: '~', color: '#a6c8ff', bg: '#172845' } },
    meleeFlame: { name: 'Melee 型態：噴火', description: '按住頭部攻擊會持續朝前方扇形吐火。', group: 'meleeForm', implemented: true, icon: { glyph: 'W', color: '#ff5e2e', bg: '#40180e' } },
    meleeExplosion: { name: 'Melee 型態：爆炸', description: '近戰命中有機率引發爆炸。', group: 'meleeForm', implemented: true, icon: { glyph: '*', color: '#ffcf66', bg: '#3f2610' } },

    stepShockwave: { name: '落腳震波', description: '每隔幾步，下一次落腳產生震波。', implemented: true, icon: { glyph: 'S', color: '#d9e7ff', bg: '#202d45' } },
    comboRamp: { name: '連擊傷害提高', description: '2 秒內有效攻擊會逐步提高傷害。', implemented: true, icon: { glyph: 'x', color: '#ffe66d', bg: '#383312' } },
    missileNest: { name: '背上飛彈巢', description: '定期發射追蹤飛彈。', implemented: true, icon: { glyph: 'M', color: '#ffb347', bg: '#3d2a10' } },
    directionalGuard: { name: '正面減傷', description: '正面受傷降低。', implemented: true, icon: { glyph: 'G', color: '#9ad1ff', bg: '#162f45' } },
    reflectProjectile: { name: '50% 反彈投射物', description: '有機率反彈敵方投射物。', implemented: true, icon: { glyph: 'R', color: '#b7ffdd', bg: '#12382a' } },
    beamSlow: { name: '光束波緩速', description: '組合技命中時使敵方緩速。', implemented: true, icon: { glyph: 'SL', color: '#b7d7ff', bg: '#17283f' } },
    poisonCloud: { name: '定期毒霧', description: '週期性噴出大範圍 DOT 毒霧。', implemented: true, icon: { glyph: 'C', color: '#78ff8f', bg: '#14351c' } },
    ramStagger: { name: '高速衝撞', description: '高速移動撞擊敵人，造成大量失衡值。', implemented: true, icon: { glyph: 'R', color: '#66f7ff', bg: '#12373b' } },
    staggerImmune: { name: '免疫失衡', description: '不會因失衡跌倒。', implemented: true, icon: { glyph: 'I', color: '#ffffff', bg: '#303030' } },
    stationaryShield: { name: '停止不動護盾', description: '站定後免疫 30% 傷害。', implemented: true, icon: { glyph: 'D', color: '#d8fff5', bg: '#173631' } },
    teamworkRegen: { name: '同心協力回血', description: '同向加速時持續回血。', implemented: true, pvpExclude: true, icon: { glyph: 'H', color: '#73ff9a', bg: '#17351e' } },
    lowHpExplosion: { name: '半血超大爆炸', description: '血量低於一半時觸發一次。', implemented: true, icon: { glyph: '!', color: '#ffef73', bg: '#4a2510' } },
    comboInvincible: { name: '組合技期間無敵', description: '光束波施放期間免疫傷害。', implemented: true, icon: { glyph: 'V', color: '#f7f2ff', bg: '#2b1f42' } }
};

function isBuffImplemented(id) {
    return BUFFS[id] && BUFFS[id].implemented !== false;
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

        if (cfg.stackable) {
            if (this.active.has(id)) this.active.delete(id);
            else this.active.set(id, 1);
        } else if (this.active.has(id)) {
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
        if (!cfg || !cfg.stackable) return;
        this.active.set(id, (this.active.get(id) || 0) + 1);
        this.refreshPlayerStats();
    }

    removeStack(id) {
        const cfg = BUFFS[id];
        if (!cfg || !cfg.stackable) return;
        const next = (this.active.get(id) || 0) - 1;
        if (next > 0) this.active.set(id, next);
        else this.active.delete(id);
        this.refreshPlayerStats();
    }

    setStack(id, stack) {
        const cfg = BUFFS[id];
        if (!cfg || !cfg.stackable) return;
        const next = Math.max(0, Math.floor(stack));
        if (next > 0) this.active.set(id, next);
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
        return this.active.get(id) || 0;
    }

    getActiveIconEntries() {
        return Array.from(this.active.entries()).map(([id, stack]) => ({ id, stack }));
    }

    getBodyVisualScale() {
        return 1 + this.getStack('hpBoost') * CONFIG.buffs.hpVisualScalePerStack;
    }

    getMeleeForm() {
        if (this.isActive('meleeFireball')) return 'fireball';
        if (this.isActive('meleeShockwave')) return 'shockwave';
        if (this.isActive('meleeFlame')) return 'flame';
        if (this.isActive('meleeExplosion')) return 'explosion';
        return 'default';
    }

    getComboForm() {
        if (this.isActive('comboFlora')) return 'flora';
        if (this.isActive('comboPtero')) return 'ptero';
        return 'beam';
    }

    getHpMultiplier() {
        return 1 + CONFIG.buffs.hpBoostPct * this.getStack('hpBoost');
    }

    getSpeedMultiplier() {
        return 1 + CONFIG.buffs.speedBoostPct * this.getStack('speedBoost');
    }

    getTurnMultiplier() {
        return this.getSpeedMultiplier();
    }

    getMeleeMultiplier() {
        return 1 + CONFIG.buffs.meleeBoostPct * this.getStack('meleeBoost');
    }

    getComboCooldownMultiplier() {
        return this.isActive('comboCd') ? CONFIG.buffs.comboCooldownMultiplier : 1;
    }

    getComboDamageMultiplier() {
        return this.isActive('comboDamage') ? CONFIG.buffs.comboDamageMultiplier : 1;
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

    blockIncomingDamage(sourcePos) {
        if (!this.isActive('leafShield')) return false;
        const shield = this.objects.leafShields.find(s => !s.cooldown || s.cooldown <= 0);
        if (!shield) return false;
        shield.cooldown = 1.6;
        shield.mesh.visible = false;
        this._spawnRing(sourcePos || shield.mesh.position, 0x99ff55, 2.0);
        return true;
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
        bullet.damage = Math.max(bullet.damage || 5, 10);
        bullet.knockback = 12;
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

        while (this.objects.leafShields.length < CONFIG.buffs.leafShieldCount) {
            const geo = new THREE.PlaneGeometry(0.55, 0.9);
            const mat = new THREE.MeshBasicMaterial({ color: 0x77dd55, side: THREE.DoubleSide, transparent: true, opacity: 0.9 });
            const mesh = new THREE.Mesh(geo, mat);
            scene.add(mesh);
            this.objects.leafShields.push({ mesh, angle: Math.random() * Math.PI * 2, cooldown: 0 });
        }

        const t = Date.now() * 0.002;
        this.objects.leafShields.forEach((s, i) => {
            s.cooldown = Math.max(0, (s.cooldown || 0) - dt);
            if (s.cooldown <= 0) s.mesh.visible = true;
            s.angle = t + (i / CONFIG.buffs.leafShieldCount) * Math.PI * 2;
            s.mesh.position.copy(dragon.mesh.position).add(new THREE.Vector3(Math.cos(s.angle) * 2.1, 1.8, Math.sin(s.angle) * 2.1));
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
            knockback: 18
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
        if (!this.isActive('poisonCloud')) return;
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
        if (!this.isActive('lowHpExplosion') || this.lowHpExplosionUsed) return;
        if (dragon.hp > dragon.maxHP * 0.5) return;
        this.lowHpExplosionUsed = true;
        dragon.createAreaDamage(dragon.mesh.position.clone(), CONFIG.buffs.lowHpExplosionRadius, CONFIG.buffs.lowHpExplosionDamage, 0xffaa00, { stagger: 100 });
    }

    _updateComboFormDecor(dt, dragon) {
        this._updateFloraDecor(dt, dragon);
        this._updatePteroWingDecor(dt, dragon);
    }

    _updateFloraDecor(dt, dragon) {
        if (!this.isActive('comboFlora')) {
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
                const baseAngle = (i / vineCount) * Math.PI * 2;
                vine.userData.baseAngle = baseAngle;
                vine.userData.phase = Math.random() * Math.PI * 2;

                for (let j = 0; j < 3; j++) {
                    const geo = new THREE.CylinderGeometry(0.035, 0.055, 0.78, 6);
                    const mat = new THREE.MeshLambertMaterial({ color: j % 2 === 0 ? 0x2f8f36 : 0x58b84e });
                    const seg = new THREE.Mesh(geo, mat);
                    const angle = baseAngle + (j - 1) * 0.32;
                    const xRadius = 1.68 + j * 0.06;
                    const zRadius = 2.45 + j * 0.08;
                    const tangent = new THREE.Vector3(
                        -Math.sin(angle) * xRadius,
                        0.26 * Math.sin(j + baseAngle),
                        Math.cos(angle) * zRadius
                    ).normalize();
                    seg.quaternion.copy(new THREE.Quaternion().setFromUnitVectors(up, tangent));
                    seg.position.set(
                        Math.cos(angle) * xRadius,
                        1.28 + j * 0.18,
                        Math.sin(angle) * zRadius
                    );
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
            const wave = Math.sin(t + (vine.userData.phase || 0)) * 0.08;
            vine.rotation.y = baseAngle * 0.05 + wave;
            vine.rotation.x = Math.sin(t * 0.8 + i) * 0.035;
        });
    }

    _updatePteroWingDecor(dt, dragon) {
        if (!this.isActive('comboPtero')) {
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
        const active = this.isActive('comboInvincible') && dragon.beamPhase === 'firing';
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
                this.onEffectiveDamage(damage);
                if (slows && e.applySlow) e.applySlow(CONFIG.terrain.poisonSlowFactor, 0.7);
            });
        }
        state.dragons.forEach(d => {
            if (!d || d === owner || d.isDead) return;
            if (d.mesh.position.distanceTo(pos) > radius + 0.8) return;
            d.takeDamage(damage, pos, 0);
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
