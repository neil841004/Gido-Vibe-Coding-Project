// =====================================================================
// buffs.js — Buff 系統
// classic script；所有資料與系統掛在全域，供 Gidora / UI / Enemy 使用。
// =====================================================================

const BUFFS = {
    hpBoost: { name: '增加血量 30%', description: '每層最大血量 +30%。', stackable: true },
    speedBoost: { name: '移動、轉向速度提高', description: '每層速度與轉向 +20%。', stackable: true },
    meleeBoost: { name: 'Melee 攻擊力 +30%', description: '每層頭槌/尾巴近戰 +30%。', stackable: true },

    comboCd: { name: '組合技 CD 縮短 60%', description: '光束波冷卻只剩 40%。' },
    comboDamage: { name: '組合技傷害 +100%', description: '光束波傷害加倍。' },
    lifeSteal: { name: '有效傷害回血', description: '造成有效傷害時回復少量 HP。' },
    tailPower: { name: '尾巴攻擊力 +300%', description: '尾巴傷害變為 4 倍。' },
    poisonTrail: { name: '走路留下毒液', description: '毒液殘留 10 秒，緩速並 DOT 敵人。' },
    leafShield: { name: '四片葉子護盾', description: '四片葉子環繞，會阻擋傷害。' },

    meleeFireball: { name: 'Melee 型態：噴火球', description: '頭部近戰改成落點火球；尾巴不變。', group: 'meleeForm' },
    meleeShockwave: { name: 'Melee 型態：蓄力震波', description: '蓄力重擊會打出暈眩震波。', group: 'meleeForm' },
    meleeFlame: { name: 'Melee 型態：噴火', description: '按住頭部攻擊會持續朝前方扇形吐火。', group: 'meleeForm' },

    stepShockwave: { name: '落腳震波', description: '每隔幾步，下一次落腳產生震波。' },
    comboRamp: { name: '連擊傷害提高', description: '2 秒內有效攻擊會逐步提高傷害。' },
    missileNest: { name: '背上飛彈巢', description: '定期發射追蹤飛彈。' },
    directionalGuard: { name: '正面減傷背面增傷', description: '正面受傷降低，背面受傷提高。' },
    reflectProjectile: { name: '50% 反彈投射物', description: '有機率反彈敵方投射物。' },
    beamSlow: { name: '光束波緩速', description: '組合技命中時使敵方緩速。' },
    poisonCloud: { name: '定期毒霧', description: '週期性噴出大範圍 DOT 毒霧。' },
    meleeExplosion: { name: 'Melee 爆炸', description: '近戰命中有機率引發爆炸。' },
    ramStagger: { name: '高速衝撞', description: '高速移動撞擊敵人，造成大量失衡值。' },
    staggerImmune: { name: '免疫失衡', description: '不會因失衡跌倒。' },
    stationaryShield: { name: '停止不動護盾', description: '站定後免疫 30% 傷害。' },
    teamworkRegen: { name: '同心協力回血', description: '同向加速時持續回血。' },
    lowHpExplosion: { name: '半血超大爆炸', description: '血量低於一半時觸發一次。' },
    comboInvincible: { name: '組合技期間無敵', description: '光束波施放期間免疫傷害。' }
};

const BuffSystem = {
    active: new Map(),
    timers: {},
    objects: {
        poisonPools: [],
        leafShields: [],
        poisonClouds: []
    },
    lowHpExplosionUsed: false,
    lastPoisonDropPos: null,
    poisonDropTimer: 0,
    lastStepShockwavePos: null,

    toggle(id) {
        const cfg = BUFFS[id];
        if (!cfg) return;

        if (cfg.stackable) {
            this.active.set(id, (this.active.get(id) || 0) + 1);
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
    },

    onEffectiveDamage(amount) {
        const gidora = window.gidoraInstance;
        if (!gidora || amount <= 0) return;

        if (this.isActive('lifeSteal')) {
            gidora.heal(amount * CONFIG.buffs.lifeStealPct);
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
        this._updateLowHpExplosion(gidora);
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
        if (!this.isActive('missileNest')) return;
        this.timers.missile = (this.timers.missile || 0) - dt;
        if (this.timers.missile > 0) return;
        this.timers.missile = CONFIG.buffs.missileInterval;

        if (!state.enemyManager) return;
        const target = state.enemyManager.enemies.find(e => !e.isDead);
        if (!target) return;
        const startPos = gidora.mesh.position.clone();
        startPos.y = 2.8;
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
        gidora.createAreaDamage(gidora.mesh.position.clone(), 4.0, CONFIG.buffs.stepShockwaveDamage, 0xddddff, { stagger: 45 });
    },

    _updatePoisonCloud(dt, gidora) {
        if (!this.isActive('poisonCloud')) return;
        this.timers.poisonCloud = (this.timers.poisonCloud || CONFIG.buffs.poisonCloudInterval) - dt;
        if (this.timers.poisonCloud > 0) return;
        this.timers.poisonCloud = CONFIG.buffs.poisonCloudInterval;
        const pos = gidora.mesh.position.clone();
        pos.y = 0.04;
        this._spawnPoisonPool(pos, CONFIG.buffs.poisonCloudRadius, CONFIG.buffs.poisonCloudDuration, false);
    },

    _updateLowHpExplosion(gidora) {
        if (!this.isActive('lowHpExplosion') || this.lowHpExplosionUsed) return;
        if (gidora.hp > gidora.maxHP * 0.5) return;
        this.lowHpExplosionUsed = true;
        gidora.createAreaDamage(gidora.mesh.position.clone(), CONFIG.buffs.lowHpExplosionRadius, CONFIG.buffs.lowHpExplosionDamage, 0xffaa00, { stagger: 100 });
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
        if (mesh.geometry) mesh.geometry.dispose();
        if (mesh.material) mesh.material.dispose();
    }
};
