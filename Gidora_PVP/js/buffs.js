// =====================================================================
// buffs.js — Buff 系統
// classic script；所有資料與系統掛在全域，供 Gidora / UI / Enemy 使用。
// =====================================================================

const BUFFS = {
    hpBoost: { name: '增加血量 30%', description: '每層最大血量 +30%。', stackable: true, implemented: true, icon: { glyph: '+', color: '#62f28f', bg: '#14371f' } },
    speedBoost: { name: '移動、轉向速度提高', description: '每層速度與轉向 +30%。', stackable: true, implemented: true, icon: { glyph: '>>', color: '#59d8ff', bg: '#12303b' } },
    meleeBoost: { name: 'Melee 攻擊力 +30%', description: '每層頭槌/尾巴近戰 +30%。', stackable: true, implemented: true, icon: { glyph: 'X', color: '#ffd166', bg: '#3a2c12' } },

    comboCd: { name: '組合技 CD 縮短 60%', description: '光束波冷卻只剩 40%。', implemented: true, icon: { glyph: 'CD', color: '#c4a7ff', bg: '#231a3d' } },
    comboDamage: { name: '組合技傷害 +100%', description: '光束波傷害加倍。', implemented: true, icon: { glyph: 'B', color: '#ff8cff', bg: '#39183c' } },
    lifeSteal: { name: '有效傷害回血', description: '造成有效傷害時回復少量 HP。', implemented: true, icon: { glyph: 'L', color: '#ff6b7a', bg: '#3d151b' } },
    tailPower: { name: '尾巴攻擊力 +300%', description: '尾巴傷害變為 4 倍。', implemented: true, icon: { glyph: 'T', color: '#60efff', bg: '#12393d' } },
    poisonTrail: { name: '走路留下毒液', description: '毒液殘留 10 秒，緩速並 DOT 敵人。', implemented: true, icon: { glyph: 'P', color: '#8cff5f', bg: '#173a14' } },
    leafShield: { name: '四片葉子護盾', description: '四片葉子環繞，會阻擋傷害。', implemented: true, icon: { glyph: '4', color: '#a7ff83', bg: '#203714' } },

    meleeFireball: { name: 'Melee 型態：噴火球', description: '頭部近戰改成落點火球；尾巴不變。', group: 'meleeForm', implemented: true, icon: { glyph: 'F', color: '#ff9f1c', bg: '#3d2410' } },
    meleeShockwave: { name: 'Melee 型態：蓄力震波', description: '蓄力重擊會打出暈眩震波。', group: 'meleeForm', implemented: true, icon: { glyph: '~', color: '#a6c8ff', bg: '#172845' } },
    meleeFlame: { name: 'Melee 型態：噴火', description: '按住頭部攻擊會持續朝前方扇形吐火。', group: 'meleeForm', implemented: true, icon: { glyph: 'W', color: '#ff5e2e', bg: '#40180e' } },

    stepShockwave: { name: '落腳震波', description: '每隔幾步，下一次落腳產生震波。', implemented: true, icon: { glyph: 'S', color: '#d9e7ff', bg: '#202d45' } },
    comboRamp: { name: '連擊傷害提高', description: '2 秒內有效攻擊會逐步提高傷害。', implemented: true, icon: { glyph: 'x', color: '#ffe66d', bg: '#383312' } },
    missileNest: { name: '背上飛彈巢', description: '定期發射追蹤飛彈。', implemented: true, icon: { glyph: 'M', color: '#ffb347', bg: '#3d2a10' } },
    directionalGuard: { name: '正面減傷背面增傷', description: '正面受傷降低，背面受傷提高。', implemented: true, icon: { glyph: 'G', color: '#9ad1ff', bg: '#162f45' } },
    reflectProjectile: { name: '50% 反彈投射物', description: '有機率反彈敵方投射物。', implemented: true, icon: { glyph: 'R', color: '#b7ffdd', bg: '#12382a' } },
    beamSlow: { name: '光束波緩速', description: '組合技命中時使敵方緩速。', implemented: true, icon: { glyph: 'SL', color: '#b7d7ff', bg: '#17283f' } },
    poisonCloud: { name: '定期毒霧', description: '週期性噴出大範圍 DOT 毒霧。', implemented: true, icon: { glyph: 'C', color: '#78ff8f', bg: '#14351c' } },
    meleeExplosion: { name: 'Melee 爆炸', description: '近戰命中有機率引發爆炸。', implemented: true, icon: { glyph: '*', color: '#ffcf66', bg: '#3f2610' } },
    ramStagger: { name: '高速衝撞', description: '高速移動撞擊敵人，造成大量失衡值。', implemented: true, icon: { glyph: 'R', color: '#66f7ff', bg: '#12373b' } },
    staggerImmune: { name: '免疫失衡', description: '不會因失衡跌倒。', implemented: true, icon: { glyph: 'I', color: '#ffffff', bg: '#303030' } },
    stationaryShield: { name: '停止不動護盾', description: '站定後免疫 30% 傷害。', implemented: true, icon: { glyph: 'D', color: '#d8fff5', bg: '#173631' } },
    teamworkRegen: { name: '同心協力回血', description: '同向加速時持續回血。', implemented: true, icon: { glyph: 'H', color: '#73ff9a', bg: '#17351e' } },
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

const BuffSystem = {
    active: new Map(),
    timers: {},
    objects: {
        poisonPools: [],
        leafShields: [],
        poisonClouds: [],
        missileNest: null
    },
    lowHpExplosionUsed: false,
    lastPoisonDropPos: null,
    poisonDropTimer: 0,
    lastStepShockwavePos: null,

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
    },

    addStack(id) {
        const cfg = BUFFS[id];
        if (!cfg || !cfg.stackable) return;
        this.active.set(id, (this.active.get(id) || 0) + 1);
        this.refreshPlayerStats();
    },

    removeStack(id) {
        const cfg = BUFFS[id];
        if (!cfg || !cfg.stackable) return;
        const next = (this.active.get(id) || 0) - 1;
        if (next > 0) this.active.set(id, next);
        else this.active.delete(id);
        this.refreshPlayerStats();
    },

    setStack(id, stack) {
        const cfg = BUFFS[id];
        if (!cfg || !cfg.stackable) return;
        const next = Math.max(0, Math.floor(stack));
        if (next > 0) this.active.set(id, next);
        else this.active.delete(id);
        this.refreshPlayerStats();
    },

    clear(id) {
        this.active.delete(id);
        this.refreshPlayerStats();
    },

    isActive(id) {
        return this.active.has(id);
    },

    getStack(id) {
        return this.active.get(id) || 0;
    },

    getActiveIconEntries() {
        return Array.from(this.active.entries()).map(([id, stack]) => ({ id, stack }));
    },

    getBodyVisualScale() {
        return 1 + this.getStack('hpBoost') * CONFIG.buffs.hpVisualScalePerStack;
    },

    getMeleeForm() {
        if (this.isActive('meleeFireball')) return 'fireball';
        if (this.isActive('meleeShockwave')) return 'shockwave';
        if (this.isActive('meleeFlame')) return 'flame';
        return 'default';
    },

    getHpMultiplier() {
        return 1 + CONFIG.buffs.hpBoostPct * this.getStack('hpBoost');
    },

    getSpeedMultiplier() {
        return 1 + CONFIG.buffs.speedBoostPct * this.getStack('speedBoost');
    },

    getTurnMultiplier() {
        return this.getSpeedMultiplier();
    },

    getMeleeMultiplier() {
        return 1 + CONFIG.buffs.meleeBoostPct * this.getStack('meleeBoost');
    },

    getComboCooldownMultiplier() {
        return this.isActive('comboCd') ? CONFIG.buffs.comboCooldownMultiplier : 1;
    },

    getComboDamageMultiplier() {
        return this.isActive('comboDamage') ? CONFIG.buffs.comboDamageMultiplier : 1;
    },

    refreshPlayerStats() {
        const gidora = window.gidoraInstance;
        if (!gidora) return;
        const oldMax = gidora.maxHP || CONFIG.stats.playerHP;
        gidora.maxHP = CONFIG.stats.playerHP * this.getHpMultiplier();
        if (gidora.hp > gidora.maxHP) gidora.hp = gidora.maxHP;
        if (gidora.hp === oldMax && gidora.maxHP > oldMax) gidora.hp = gidora.maxHP;
        state.comboCooldownMax = CONFIG.combo.cooldown * this.getComboCooldownMultiplier();
        state.comboCooldown = Math.min(state.comboCooldown, state.comboCooldownMax);
    },

    onEffectiveDamage(amount) {
        const gidora = window.gidoraInstance;
        if (!gidora || amount <= 0) return;

        if (this.isActive('lifeSteal')) {
            const healAmount = amount * CONFIG.buffs.lifeStealPct;
            gidora.heal(healAmount);
            this._spawnHealCross(gidora);
        }
        if (this.isActive('comboRamp')) {
            gidora.comboRampStacks = Math.min(
                CONFIG.buffs.comboDamageMaxStacks,
                (gidora.comboRampStacks || 0) + 1
            );
            gidora.comboRampTimer = CONFIG.buffs.comboDamageWindow;
        }
    },

    blockIncomingDamage(sourcePos) {
        if (!this.isActive('leafShield')) return false;
        const shield = this.objects.leafShields.find(s => !s.cooldown || s.cooldown <= 0);
        if (!shield) return false;
        shield.cooldown = 1.6;
        shield.mesh.visible = false;
        this._spawnRing(sourcePos || shield.mesh.position, 0x99ff55, 2.0);
        return true;
    },

    reflectProjectile(bullet, gidora) {
        if (!this.isActive('reflectProjectile')) return false;
        if (Math.random() >= CONFIG.buffs.projectileReflectChance) return false;
        const dir = bullet.mesh.position.clone().sub(gidora.mesh.position).normalize();
        dir.y = Math.max(0.05, dir.y);
        bullet.isEnemy = false;
        bullet.owner = 'reflected';
        bullet.velocity.copy(dir.multiplyScalar(bullet.speed || 16));
        bullet.damage = Math.max(bullet.damage || 5, 10);
        bullet.knockback = 12;
        bullet.hitEntities = new Set();
        if (bullet.mesh && bullet.mesh.material) bullet.mesh.material.color.setHex(0x99ff55);
        return true;
    },

    update(dt) {
        const gidora = window.gidoraInstance;
        if (!gidora) return;

        this.refreshPlayerStats();
        this._updateLeafShields(dt, gidora);
        this._updatePoisonTrail(dt, gidora);
        this._updatePoisonPools(dt);
        this._updateMissileNest(dt, gidora);
        this._updateStepShockwave(gidora);
        this._updatePoisonCloud(dt, gidora);
        this._updatePoisonClouds(dt);
        this._updateLowHpExplosion(gidora);
        this._updateBuffVisuals(dt, gidora);
    },

    _updateLeafShields(dt, gidora) {
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
            s.mesh.position.copy(gidora.mesh.position).add(new THREE.Vector3(Math.cos(s.angle) * 2.1, 1.8, Math.sin(s.angle) * 2.1));
            s.mesh.lookAt(camera.position);
        });
    },

    _updatePoisonTrail(dt, gidora) {
        if (!this.isActive('poisonTrail') || gidora.velocity.lengthSq() < 1.0) return;
        this.poisonDropTimer -= dt;
        if (this.poisonDropTimer > 0) return;
        this.poisonDropTimer = CONFIG.terrain.poisonDropInterval;

        const pos = gidora.mesh.position.clone();
        pos.y = 0.03;
        if (this.lastPoisonDropPos && this.lastPoisonDropPos.distanceTo(pos) < 1.0) return;
        this.lastPoisonDropPos = pos.clone();
        this._spawnPoisonPool(pos, 2.1, CONFIG.terrain.poisonLife, true);
    },

    _spawnPoisonPool(pos, radius, life, slows) {
        const geo = new THREE.CircleGeometry(radius, 24);
        const mat = new THREE.MeshBasicMaterial({ color: slows ? 0x33aa33 : 0x55cc66, transparent: true, opacity: slows ? 0.45 : 0.25, side: THREE.DoubleSide });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.rotation.x = -Math.PI / 2;
        mesh.position.copy(pos);
        scene.add(mesh);
        this.objects.poisonPools.push({ mesh, radius, life, maxLife: life, slows, damageTimer: 0 });
    },

    _updatePoisonPools(dt) {
        for (let i = this.objects.poisonPools.length - 1; i >= 0; i--) {
            const pool = this.objects.poisonPools[i];
            pool.life -= dt;
            pool.mesh.material.opacity = (pool.life / pool.maxLife) * (pool.slows ? 0.45 : 0.25);
            pool.damageTimer += dt;
            if (pool.damageTimer >= 0.5) {
                pool.damageTimer = 0;
                this._damageEnemiesInRadius(pool.mesh.position, pool.radius, CONFIG.terrain.poisonDamagePerSecond * 0.5, pool.slows);
            }
            if (pool.life <= 0) {
                this._disposeMesh(pool.mesh);
                this.objects.poisonPools.splice(i, 1);
            }
        }
    },

    _updateMissileNest(dt, gidora) {
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
        this.objects.missileNest.position.copy(gidora.mesh.position);
        this.objects.missileNest.position.y += 2.35 * bodyScale + 0.35;
        this.objects.missileNest.quaternion.copy(gidora.mesh.quaternion);

        this.timers.missile = (this.timers.missile || 0) - dt;
        if (this.timers.missile > 0) return;
        this.timers.missile = CONFIG.buffs.missileInterval;

        if (!state.enemyManager) return;
        const target = state.enemyManager.enemies.find(e => !e.isDead);
        if (!target) return;
        const startPos = this.objects.missileNest
            ? this.objects.missileNest.position.clone()
            : gidora.mesh.position.clone();
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
        state.bullets.push(missile);
    },

    _updateStepShockwave(gidora) {
        if (!this.isActive('stepShockwave')) {
            this.lastStepShockwavePos = gidora.mesh.position.clone();
            return;
        }
        if (!this.lastStepShockwavePos) this.lastStepShockwavePos = gidora.mesh.position.clone();
        if (this.lastStepShockwavePos.distanceTo(gidora.mesh.position) < CONFIG.buffs.stepShockwaveDistance) return;
        this.lastStepShockwavePos.copy(gidora.mesh.position);
        gidora.createShockwaveBlast(gidora.mesh.position.clone(), 4.0, CONFIG.buffs.stepShockwaveDamage, 45);
    },

    _updatePoisonCloud(dt, gidora) {
        if (!this.isActive('poisonCloud')) return;
        this.timers.poisonCloud = (this.timers.poisonCloud || CONFIG.buffs.poisonCloudInterval) - dt;
        if (this.timers.poisonCloud > 0) return;
        this.timers.poisonCloud = CONFIG.buffs.poisonCloudInterval;
        const pos = gidora.mesh.position.clone();
        pos.y = 1.2;
        this._spawnPoisonCloud(pos, CONFIG.buffs.poisonCloudRadius, CONFIG.buffs.poisonCloudDuration);
    },

    _spawnPoisonCloud(pos, radius, life) {
        const cloud = { pos: pos.clone(), radius, life, maxLife: life, damageTimer: 0, puffs: [] };
        for (let i = 0; i < 34; i++) {
            const angle = Math.random() * Math.PI * 2;
            const r = Math.sqrt(Math.random()) * radius;
            const y = pos.y + Math.random() * 2.4;
            const geo = new THREE.SphereGeometry(0.45 + Math.random() * 0.9, 8, 6);
            const mat = new THREE.MeshBasicMaterial({
                color: Math.random() > 0.5 ? 0x55cc66 : 0x88ff77,
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
    },

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
                this._damageEnemiesInRadius(cloud.pos, cloud.radius, CONFIG.terrain.poisonDamagePerSecond * 0.5, false);
            }

            if (cloud.life <= 0) {
                cloud.puffs.forEach(p => this._disposeMesh(p.mesh));
                this.objects.poisonClouds.splice(i, 1);
            }
        }
    },

    _updateLowHpExplosion(gidora) {
        if (!this.isActive('lowHpExplosion') || this.lowHpExplosionUsed) return;
        if (gidora.hp > gidora.maxHP * 0.5) return;
        this.lowHpExplosionUsed = true;
        gidora.createAreaDamage(gidora.mesh.position.clone(), CONFIG.buffs.lowHpExplosionRadius, CONFIG.buffs.lowHpExplosionDamage, 0xffaa00, { stagger: 100 });
    },

    _updateBuffVisuals(dt, gidora) {
        if (gidora.tailGroup) {
            const tailScale = this.isActive('tailPower') ? 1.45 : 1.0;
            gidora.tailGroup.scale.set(tailScale, tailScale, tailScale);
        }

        this.timers.visualPulse = (this.timers.visualPulse || 0) - dt;
        if (this.timers.visualPulse > 0) return;
        this.timers.visualPulse = CONFIG.buffs.visualPulseInterval;

        if (this.isActive('speedBoost') && gidora.velocity.lengthSq() > 0.2) {
            this._spawnFeather(gidora);
        }
        if (this.isActive('lifeSteal')) this._spawnBuffParticle(gidora, 0xff3355, 2.4, 0.55);
        if (this.isActive('meleeBoost')) this._spawnBuffParticle(gidora, 0xffcc33, 2.1, 0.55);
        if (this.isActive('comboCd') && state.comboCooldown > 0) this._spawnRing(gidora.mesh.position, 0xaaaaaa, 1.1);
        if (this.isActive('comboDamage')) this._spawnBuffParticle(gidora, 0xff55ff, 2.8, 0.6);
        if (this.isActive('directionalGuard')) this._spawnGuardArc(gidora);
        if (this.isActive('reflectProjectile')) this._spawnRing(gidora.mesh.position, 0x99ffdd, 1.4);
        if (this.isActive('beamSlow')) this._spawnBuffParticle(gidora, 0xaaddff, 2.6, 0.6);
        if (this.isActive('staggerImmune')) this._spawnBuffParticle(gidora, 0xffffff, 2.7, 0.6);
        if (this.isActive('stationaryShield') && gidora.stationaryTimer >= CONFIG.buffs.stationaryShieldDelay) this._spawnRing(gidora.mesh.position, 0xd8fff5, 1.6);
        if (this.isActive('teamworkRegen')) this._spawnBuffParticle(gidora, 0x66ff99, 2.2, 0.5);
        if (this.isActive('comboInvincible') && state.beamPhase === 'firing') this._spawnRing(gidora.mesh.position, 0xffffff, 2.0);
    },

    _spawnBuffParticle(gidora, color, height, scale) {
        const angle = Math.random() * Math.PI * 2;
        const pos = gidora.mesh.position.clone().add(new THREE.Vector3(Math.cos(angle) * 1.5, height, Math.sin(angle) * 1.5));
        const p = new Particle(pos, color);
        p.velocity.multiplyScalar(0.2);
        p.velocity.y = Math.abs(p.velocity.y) + 1.5;
        p.life = 0.45;
        p.maxLife = 0.45;
        p.mesh.scale.setScalar(scale);
        state.particles.push(p);
    },

    _spawnFeather(gidora) {
        const back = gidora.getForwardVector().normalize().negate();
        const side = new THREE.Vector3(back.z, 0, -back.x).multiplyScalar((Math.random() - 0.5) * 1.8);
        const pos = gidora.mesh.position.clone().add(back.multiplyScalar(1.8)).add(side);
        pos.y = 1.0 + Math.random() * 1.3;
        const p = new Particle(pos, 0xf3f3f3);
        p.velocity.set((Math.random() - 0.5) * 1.5, 1 + Math.random(), (Math.random() - 0.5) * 1.5);
        p.life = 0.7;
        p.maxLife = 0.7;
        p.mesh.scale.set(0.18, 0.5, 0.08);
        state.particles.push(p);
    },

    _spawnGuardArc(gidora) {
        const pos = gidora.mesh.position.clone().add(gidora.getForwardVector().normalize().multiplyScalar(1.6));
        pos.y = 0.1;
        this._spawnRing(pos, 0x88bbff, 1.0);
    },

    _spawnHealCross(gidora) {
        const group = new THREE.Group();
        const mat = new THREE.MeshBasicMaterial({ color: 0x66ff88, transparent: true, opacity: 0.95, depthTest: false });
        const v = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.9, 0.08), mat);
        const h = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.18, 0.08), mat.clone());
        group.add(v);
        group.add(h);
        group.position.copy(gidora.mesh.position);
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
    },

    _damageEnemiesInRadius(pos, radius, damage, slows) {
        if (!state.enemyManager) return;
        state.enemyManager.enemies.forEach(e => {
            if (e.isDead || e.mesh.position.distanceTo(pos) > radius + 0.8) return;
            e.takeDamage(damage, pos, 0);
            this.onEffectiveDamage(damage);
            if (slows && e.applySlow) e.applySlow(CONFIG.terrain.poisonSlowFactor, 0.7);
        });
    },

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
    },

    _disposeMesh(mesh) {
        if (!mesh) return;
        if (mesh.parent) mesh.parent.remove(mesh);
        mesh.traverse(obj => {
            if (obj.geometry) obj.geometry.dispose();
            if (obj.material && obj.material.map) obj.material.map.dispose();
            if (obj.material) obj.material.dispose();
        });
    }
};
