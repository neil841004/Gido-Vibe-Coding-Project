// =====================================================================
// gidora.js — Vine + Gidora 主類 (4 頭融合獸)
// 對應 Unity: Player Character (含 Movement / Combat / Beam / FX)
// 已移除 2P (Duo) 模式所有分支；僅保留 4P (Ultra) 路徑
// =====================================================================

class Vine {
    constructor(parent, index, total, radius) {
        this.mesh = new THREE.Group();
        parent.add(this.mesh);

        this.segments = [];
        const segmentCount = 6;
        const length = radius;
        const segLen = length / segmentCount;

        let parentObj = this.mesh;
        for (let i = 0; i < segmentCount; i++) {
            const pivot = new THREE.Group();
            pivot.position.z = i === 0 ? 0 : segLen;

            const geo = new THREE.BoxGeometry(0.8, 0.8, segLen);
            const color = new THREE.Color().lerpColors(
                new THREE.Color(0x228822),
                new THREE.Color(0x88dd88),
                i / (segmentCount - 1)
            );
            const mat = new THREE.MeshLambertMaterial({ color });
            const mesh = new THREE.Mesh(geo, mat);
            mesh.position.z = segLen / 2;
            mesh.castShadow = true;

            pivot.add(mesh);
            parentObj.add(pivot);
            this.segments.push({ pivot, mesh });
            parentObj = pivot;
        }

        this.baseAngle = (index / total) * Math.PI * 2;
        this.mesh.rotation.y = this.baseAngle;

        this.isActive = false;
        this.timer = 0;
        this.rndSpeed = 0.5 + Math.random() * 1.5;
        this.rndPhase = Math.random() * 100;
        this.rndAmp = 0.8 + Math.random() * 0.4;
    }

    setVisible(v) { this.mesh.visible = v; }

    update(dt, isSweeping) {
        this.timer += dt;
        if (isSweeping) {
            const baseSpeed = CONFIG.combo.vineSpeed * this.rndSpeed;
            const t = this.timer * baseSpeed + this.rndPhase;
            const sweep = Math.sin(t) * 1.5 + Math.sin(t * 0.3) * 0.5;
            this.mesh.rotation.y = this.baseAngle + sweep * this.rndAmp;
            this.segments.forEach((seg, i) => {
                const segT = t - (i * 0.3);
                seg.pivot.rotation.y = Math.sin(segT * 3.0) * (Math.PI / 4) * (1 + i * 0.2);
                seg.pivot.rotation.x = Math.sin(t * 2.0 + i) * 0.05;
            });
        } else {
            this.segments.forEach(seg => {
                seg.pivot.rotation.x = (Math.random() - 0.5) * 0.1;
            });
        }
    }

    destroy() {
        this.segments.forEach(s => {
            s.mesh.geometry.dispose();
            s.mesh.material.dispose();
        });
        if (this.mesh.parent) this.mesh.parent.remove(this.mesh);
    }
}

class Gidora {
    // index: 0 = Dragon A (預設配色)、1 = Dragon B (替代配色)
    // opts.spawn: { x, z, facingY }；可選擇出生位置與面向
    constructor(index = 0, opts = {}) {
        this.index = index;
        this.colors = (index === 1) ? CONFIG.visuals.colorsB : CONFIG.visuals.colors;

        this.mesh = new THREE.Group();
        this.velocity = new THREE.Vector3();

        // 每隻龍擁有獨立的 BuffSystem (per-instance)
        this.buffSystem = new BuffSystem(this);

        this.hp = CONFIG.stats.playerHP;
        this.maxHP = CONFIG.stats.playerHP;
        this.isDead = false;
        this.damageFlashTimer = 0;

        this.hpBar = new HealthBar(scene, 4.5, 4.0, 0.2);

        // 每隻龍獨立的輸入槽 (4 名 sub-player)
        this.input = {
            p1: { move: new THREE.Vector2(), attack: false, charge: false, pointer: new THREE.Vector2(), pointerActive: false },
            p2: { move: new THREE.Vector2(), attack: false, charge: false, pointer: new THREE.Vector2(), pointerActive: false },
            p3: { move: new THREE.Vector2(), attack: false, charge: false, pointer: new THREE.Vector2(), pointerActive: false },
            p4: { move: new THREE.Vector2(), attack: false, charge: false, pointer: new THREE.Vector2(), pointerActive: false }
        };

        // 每隻龍獨立的光束/合體技狀態
        this.beamCharge = 0;
        this.beamPhase = 'idle';
        this.beamPreFireTimer = 0;
        this.beamFiringTimer = 0;
        this.beamPostFireTimer = 0;
        this.beamDotTimer = 0;
        this.comboCooldown = 0;
        this.comboCooldownMax = CONFIG.combo.cooldown;
        this.activeComboForm = 'beam';
        this.comboTimer = 0;
        this.comboDotTimer = 0;
        this.comboState = 'idle';
        this.comboTargetPos = new THREE.Vector3();
        this.pteroDropVelocity = 0;
        this.rushTarget = null;
        this.rushHitCount = 0;
        this.rushHitTimer = 0;
        this.rushWasHidden = false;
        this.refractBeamSegments = [];
        this.comboVines = [];

        this.cooldowns = { p1: 0, p2: 0, p3: 0, p4: 0 };
        this.attackStates = { p1: 'idle', p2: 'idle', p3: 'idle', p4: 'idle' };
        this.attackKinds = { p1: 'light', p2: 'light', p3: 'light', p4: 'light' };
        this.windupTimer = { p1: 0, p2: 0, p3: 0, p4: 0 };
        this.isWindup = { p1: false, p2: false, p3: false, p4: false };
        this.attackTimers = { p1: 0, p2: 0, p3: 0, p4: 0 };
        this.lastAttackInput = { p1: false, p2: false, p3: false, p4: false };
        this.attackHoldTimers = { p1: 0, p2: 0, p3: 0, p4: 0 };
        this.attackReleaseQueued = { p1: false, p2: false, p3: false, p4: false };
        this.attackQueuedKinds = { p1: 'light', p2: 'light', p3: 'light', p4: 'light' };
        this.attackImpactDone = { p1: false, p2: false, p3: false, p4: false };
        this.recoveryBufferedPress = { p1: false, p2: false, p3: false, p4: false };
        this.chargeAim = {
            p1: new THREE.Vector2(0, 1),
            p2: new THREE.Vector2(0, 1),
            p3: new THREE.Vector2(0, 1),
            p4: new THREE.Vector2(0, -1)
        };
        this.chargeTargets = { p1: null, p2: null, p3: null, p4: null };
        this.headAimYaw = { p1: -0.6, p2: 0.6, p3: 0 };
        this.flamethrowerTimers = { p1: 0, p2: 0, p3: 0 };
        this.fireballAimArrows = {};
        this.flamethrowerIndicators = {};
        this.bufferedInput = { p1: false, p2: false, p3: false, p4: false };
        this.rhythmBonus = { p1: false, p2: false, p3: false, p4: false };
        this.activeIndicators = { p1: null, p2: null, p3: null, p4: null };
        this.activeSynergyIndicator = null;
        this.lastShotType = { p1: null, p2: null, p3: null, p4: null };

        this.pendingDuo = false;
        this.isFiringBeam = false;
        this.beamTimer = 0;
        this.speedLines = [];
        this.isBoosting = false;
        this.isBursting = false;
        this.burstTimer = 0;
        this.lastReadyCount = 0;
        this.legPhase = 0;
        this.lastRotationY = 0;
        this.angularVelocity = 0;

        this.knockbackVel = new THREE.Vector3();
        this.staggerValue = 0;
        this.staggerWindowTimer = 0;
        this.fallTimer = 0;
        this.standUpTimer = 0;
        this.standUpStartRotationX = 0;
        this.slowTimer = 0;
        this.slowFactor = 1.0;
        this.comboRampStacks = 0;
        this.comboRampTimer = 0;
        this.stationaryTimer = 0;
        this.lastRamHit = new Map();
        this.ramShockwaveFxTimer = 0;
        this.teamworkRegenFxTimer = 0;
        this.tailSweepStartY = 0;
        this.tailSweepImpactDone = false;

        this.buildModel();
        this.buildIndicators();

        this.baseColorP1 = new THREE.Color(this.colors.p1);
        this.baseColorP2 = new THREE.Color(this.colors.p2);
        this.baseColorP3 = new THREE.Color(this.colors.p3);
        this.baseColorP4 = new THREE.Color(this.colors.p4);

        scene.add(this.mesh);

        // 套用出生位置與面向
        const spawn = opts.spawn || (index === 1
            ? CONFIG.pvp.dragonBSpawn
            : CONFIG.pvp.dragonASpawn);
        this.mesh.position.set(spawn.x, 0, spawn.z);
        this.mesh.rotation.y = spawn.facingY || 0;
    }

    takeDamage(amount, sourcePos, knockbackForce) {
        if (this.isDead) return;
        if (this.buffSystem.isActive('comboInvincible') && this.beamPhase === 'firing') return;
        if (this.buffSystem.blockIncomingDamage(sourcePos)) return;

        let finalAmount = amount;
        if (this.buffSystem.isActive('directionalGuard') && sourcePos) {
            const toSource = sourcePos.clone().sub(this.mesh.position).normalize();
            const facing = this.getForwardVector().normalize();
            const dot = facing.dot(toSource);
            if (dot >= 0) finalAmount *= CONFIG.buffs.frontDamageMultiplier;
        }
        if (this.buffSystem.isActive('stationaryShield') && this.stationaryTimer >= CONFIG.buffs.stationaryShieldDelay) {
            finalAmount *= CONFIG.buffs.stationaryShieldMultiplier;
        }
        finalAmount *= this.buffSystem.getDefenseMultiplier();

        const isStaggered = this.staggerValue > 0 || this.fallTimer > 0 || this.standUpTimer > 0;
        if (isStaggered) {
            finalAmount *= 1 + CONFIG.stagger.staggeredDamageBonusPct;
        }

        finalAmount = Math.max(0, finalAmount);
        this.damageFlashTimer = 0.2;
        this.hp = Math.max(0, this.hp - finalAmount);

        this.addStagger(finalAmount, sourcePos);

        if (sourcePos && this.mesh.position) {
            const dir = this.mesh.position.clone().sub(sourcePos).normalize();
            dir.y = 0;
            const force = (knockbackForce !== undefined) ? knockbackForce : finalAmount * CONFIG.combat.knockbackBase;
            this.knockbackVel.add(dir.multiplyScalar(force));
        }

        if (this.hp <= 0) this.die();
    }

    applySlow(factor, duration) {
        this.slowFactor = Math.min(this.slowFactor, factor);
        this.slowTimer = Math.max(this.slowTimer, duration);
    }

    heal(amount) {
        if (this.isDead || amount <= 0) return;
        this.hp = Math.min(this.maxHP, this.hp + amount);
    }

    addStagger(amount, sourcePos) {
        if (this.fallTimer > 0 || this.standUpTimer > 0 || amount <= 0) return;
        if (this.buffSystem.isActive('staggerImmune')) {
            amount *= CONFIG.buffs.staggerImmuneIncomingMultiplier;
        }
        if (amount <= 0) return;
        this.staggerWindowTimer = CONFIG.stagger.playerWindow;
        this.staggerValue = Math.min(CONFIG.stagger.playerThreshold, this.staggerValue + amount);
        if (this.staggerValue >= CONFIG.stagger.playerThreshold) {
            this.fallTimer = CONFIG.stagger.playerFallDuration;
            this.staggerValue = 0;
            this.attackStates = { p1: 'idle', p2: 'idle', p3: 'idle', p4: 'idle' };
            this.attackReleaseQueued = { p1: false, p2: false, p3: false, p4: false };
            this.hideAllChargeIndicators();
            this.hideAllFlamethrowerIndicators();
            if (this.buffSystem && this.buffSystem.suspendAll) {
                this.buffSystem.suspendAll(CONFIG.stagger.playerFallDuration + CONFIG.stagger.playerStandUpDuration);
            }
            // 組合技施放期間失衡→直接中斷光束
            if (this.beamPhase === 'firing' || this.beamPhase === 'prefire') {
                this.beamCharge = 0;
                this.beamPhase = 'idle';
                this._hideBeamFX();
                this._hideSpecialComboFX();
                if (this.mesh.position.y > 0) this.mesh.position.y = 0;
                if (this.beamChargeRing) this.beamChargeRing.material.opacity = 0;
            }
            this.velocity.multiplyScalar(0.2);
            this.knockbackVel.multiplyScalar(0.2);
            this.pulseScale = 1.25;
            const pos = this.mesh.position.clone();
            pos.y = 1.0;
            for (let i = 0; i < 10; i++) state.particles.push(new Particle(pos, 0xffff66));
        }
    }

    updateStagger(dt) {
        if (this.staggerWindowTimer > 0) {
            this.staggerWindowTimer -= dt;
            return;
        }
        if (this.staggerValue > 0) {
            const recoveryMultiplier = this.buffSystem.isActive('staggerImmune')
                ? CONFIG.buffs.staggerImmuneRecoveryMultiplier
                : 1;
            this.staggerValue = Math.max(0, this.staggerValue - CONFIG.stagger.playerRecoveryRate * recoveryMultiplier * dt);
        }
    }

    die() {
        this.isDead = true;
        // PVP 模式：交給 main.js 顯示勝負畫面，不重新整理。
        if (state.pvp && (state.pvp.active || (state.dragons || []).filter(d => d).length > 1)) {
            this.mesh.visible = false;
            if (typeof onDragonDeath === 'function') onDragonDeath(this);
            return;
        }
        alert("GAME OVER");
        location.reload();
    }

    getHitSpheres(extraRadius = 0) {
        const cfg = CONFIG.hitbox;
        const spheres = [];
        const addLocal = (local, radius) => {
            const pos = local.clone().applyQuaternion(this.mesh.quaternion).add(this.mesh.position);
            spheres.push({ pos, radius: radius + extraRadius });
        };

        addLocal(new THREE.Vector3(0, 1.2, 0), cfg.bodyCenterRadius);
        addLocal(new THREE.Vector3(0, 1.2, cfg.bodyFrontOffsetZ), cfg.bodyFrontRadius);
        addLocal(new THREE.Vector3(0, 1.2, cfg.bodyBackOffsetZ), cfg.bodyBackRadius);

        if (this.necks) {
            this.necks.forEach(neck => {
                if (!neck || !neck.pivot || !neck.head) return;
                const lower = new THREE.Vector3(0, cfg.neckLowerY, 0);
                const upper = new THREE.Vector3(0, cfg.neckUpperY, 0);
                neck.pivot.localToWorld(lower);
                neck.pivot.localToWorld(upper);
                spheres.push({ pos: lower, radius: cfg.neckRadius + extraRadius });
                spheres.push({ pos: upper, radius: cfg.neckRadius + extraRadius });
                const headPos = new THREE.Vector3();
                neck.head.getWorldPosition(headPos);
                spheres.push({ pos: headPos, radius: cfg.headRadius + extraRadius });
            });
        }

        if (this.tailGroup) {
            const base = new THREE.Vector3(0, 0, cfg.tailBaseOffsetZ);
            const tip = new THREE.Vector3(0, 0, cfg.tailTipOffsetZ);
            this.tailGroup.localToWorld(base);
            this.tailGroup.localToWorld(tip);
            spheres.push({ pos: base, radius: cfg.tailBaseRadius + extraRadius });
            spheres.push({ pos: tip, radius: cfg.tailTipRadius + extraRadius });
        }

        return spheres;
    }

    intersectsHitSpheres(pos, radius = 0) {
        return this.getHitSpheres(radius).some(s => s.pos.distanceTo(pos) <= s.radius);
    }

    intersectsHitCircle(center, radius = 0) {
        return this.getHitSpheres(CONFIG.hitbox.meleePadding).some(s => {
            const dx = s.pos.x - center.x;
            const dz = s.pos.z - center.z;
            return dx * dx + dz * dz <= Math.pow(radius + s.radius, 2);
        });
    }

    intersectsHitRay(origin, forward, length, radius = 0) {
        let bestAlong = Infinity;
        this.getHitSpheres(CONFIG.hitbox.beamPadding).forEach(s => {
            const toSphere = s.pos.clone().sub(origin);
            const along = toSphere.dot(forward);
            if (along < 0 || along > length + s.radius) return;
            const perp = toSphere.sub(forward.clone().multiplyScalar(along));
            if (perp.length() <= radius + s.radius) bestAlong = Math.min(bestAlong, Math.max(0, along));
        });
        return bestAlong;
    }

    checkCollisions(bullets) {
        if (this.isDead) return;

        bullets.forEach(b => {
            if (b.markedForDeletion) return;
            // PVP：受擊條件擴充為「敵人子彈」或「來自其他龍的子彈」(非自己發射)。
            const isFromOtherDragon = (b.attackerDragon && b.attackerDragon !== this);
            if (!b.isEnemy && !isFromOtherDragon) return;
            const projectileRadius = (b.size || 0) + CONFIG.hitbox.projectilePadding;
            if (this.intersectsHitSpheres(b.mesh.position, projectileRadius)) {
                if (this.buffSystem.reflectProjectile(b, this)) return;
                b.markedForDeletion = true;
                this.takeDamage(b.damage || 10, b.mesh.position, b.knockback);
            }
        });
    }

    buildModel() {
        const colors = this.colors;
        const bodyMat = new THREE.MeshLambertMaterial({ color: colors.body });
        const p1Mat = new THREE.MeshLambertMaterial({ color: colors.p1 });
        const p2Mat = new THREE.MeshLambertMaterial({ color: colors.p2 });
        const p3Mat = new THREE.MeshLambertMaterial({ color: colors.p3 });
        const p4Mat = new THREE.MeshLambertMaterial({ color: colors.p4 });

        // 1. Body (Quad scale)
        const bodyGeo = new THREE.SphereGeometry(1.5, 16, 16);
        this.body = new THREE.Mesh(bodyGeo, bodyMat);
        this.body.position.y = 1.2;
        this.body.scale.set(1, 0.8, 1.5);
        this.body.castShadow = true;
        this.mesh.add(this.body);

        // Legs (4)
        this.legs = [];
        const legConfigs = [
            { id: 'fl', x: -0.9, z: 0.8, mat: bodyMat, isFront: true },
            { id: 'fr', x: 0.9, z: 0.8, mat: bodyMat, isFront: true },
            { id: 'bl', x: -0.9, z: -0.8, mat: bodyMat, isFront: false },
            { id: 'br', x: 0.9, z: -0.8, mat: bodyMat, isFront: false }
        ];
        legConfigs.forEach(cfg => {
            const legGroup = new THREE.Group();
            legGroup.position.set(cfg.x, 0.8, cfg.z);
            const legGeo = new THREE.CylinderGeometry(0.35, 0.25, 1.0, 8);
            const leg = new THREE.Mesh(legGeo, cfg.mat);
            leg.position.y = -0.5;
            leg.castShadow = true;
            legGroup.add(leg);
            this.mesh.add(legGroup);
            this.legs.push({ group: legGroup, id: cfg.id, isFront: cfg.isFront });
        });

        // Necks & Heads (P1/P2/P3)
        this.necks = [];
        const neckConfigs = [
            { id: 'p1', angle: 0.5, mat: p1Mat, x: -0.7, z: 1.1 },
            { id: 'p2', angle: -0.5, mat: p2Mat, x: 0.7, z: 1.1 },
            { id: 'p3', angle: 0, mat: p3Mat, x: 0, z: 1.0 }
        ];

        neckConfigs.forEach(cfg => {
            const neckGroup = new THREE.Group();
            neckGroup.position.set(cfg.x, 1.5, cfg.z);
            neckGroup.rotation.y = cfg.angle;

            const neckLen = 2.2;
            const leanAngle = -0.3;

            const neckGeo = new THREE.CylinderGeometry(0.3, 0.45, neckLen, 8);
            const neckMesh = new THREE.Mesh(neckGeo, cfg.mat);
            const pivotGroup = new THREE.Group();
            pivotGroup.rotation.x = leanAngle;
            neckMesh.position.y = neckLen / 2;
            pivotGroup.add(neckMesh);
            neckGroup.add(pivotGroup);

            const headGeo = new THREE.BoxGeometry(0.65, 0.65, 0.85);
            const headMesh = new THREE.Mesh(headGeo, cfg.mat);
            headMesh.position.y = neckLen;
            headMesh.position.z = 0.2;
            headMesh.rotation.x = 0.3;
            headMesh.castShadow = true;

            const eyeGeo = new THREE.SphereGeometry(0.12, 8, 8);
            const eyeMat = new THREE.MeshBasicMaterial({ color: 0xffff00 });
            const eyeL = new THREE.Mesh(eyeGeo, eyeMat); eyeL.position.set(-0.22, 0.1, 0.35); headMesh.add(eyeL);
            const eyeR = new THREE.Mesh(eyeGeo, eyeMat); eyeR.position.set(0.22, 0.1, 0.35); headMesh.add(eyeR);

            pivotGroup.add(headMesh);
            this.mesh.add(neckGroup);

            this.necks.push({ group: neckGroup, pivot: pivotGroup, head: headMesh, id: cfg.id, baseLean: leanAngle, baseYaw: cfg.angle, baseZ: cfg.z });

            if (cfg.id === 'p1') { this.p1Part = neckGroup; this.p1HeadPart = headMesh; }
            if (cfg.id === 'p2') { this.p2Part = neckGroup; this.p2HeadPart = headMesh; }
            if (cfg.id === 'p3') { this.p3Part = neckGroup; this.p3HeadPart = headMesh; }
        });

        // Tail (P4)
        this.tailGroup = new THREE.Group();
        this.tailGroup.position.set(0, 1.2, -1.2);
        const tailGeo = new THREE.ConeGeometry(0.6, 2.5, 8);
        tailGeo.rotateX(-Math.PI / 2);
        this.tailBase = new THREE.Mesh(tailGeo, p4Mat);
        this.tailGroup.add(this.tailBase);

        const tipGeo = new THREE.CylinderGeometry(0.0, 0.6, 1.2, 8);
        tipGeo.rotateX(-Math.PI / 2);
        this.tailTip = new THREE.Mesh(tipGeo, p4Mat);
        this.tailTip.position.z = -1.5;
        this.tailGroup.add(this.tailTip);

        this.mesh.add(this.tailGroup);
        this.p4Part = this.tailGroup;
        this.p4HeadPart = this.tailTip;

        // Beam meshes
        const _beamBase = () => {
            const g = new THREE.CylinderGeometry(1, 1, 1, 12);
            g.rotateX(Math.PI / 2);
            g.translate(0, 0, 0.5);
            return g;
        };

        this.beamMesh = new THREE.Mesh(_beamBase(), new THREE.MeshBasicMaterial({
            color: 0xffffff, transparent: true, opacity: 0.95, depthWrite: false
        }));
        this.beamMesh.visible = false;
        scene.add(this.beamMesh);

        this.beamGlowMesh = new THREE.Mesh(_beamBase(), new THREE.MeshBasicMaterial({
            color: colors.beam, transparent: true, opacity: 0.0,
            blending: THREE.AdditiveBlending, depthWrite: false
        }));
        this.beamGlowMesh.visible = false;
        scene.add(this.beamGlowMesh);

        this.beamImpactMesh = new THREE.Mesh(
            new THREE.SphereGeometry(1, 10, 8),
            new THREE.MeshBasicMaterial({
                color: 0xffffff, transparent: true, opacity: 0.0,
                blending: THREE.AdditiveBlending, depthWrite: false
            })
        );
        this.beamImpactMesh.visible = false;
        scene.add(this.beamImpactMesh);

        this.beamOriginLight = new THREE.PointLight(colors.beam, 0, 12);
        scene.add(this.beamOriginLight);
        this.beamImpactLight = new THREE.PointLight(0xffffff, 0, 14);
        scene.add(this.beamImpactLight);

        const chargeRingGeo = new THREE.RingGeometry(1.2, 2.2, 32);
        chargeRingGeo.rotateX(-Math.PI / 2);
        const chargeRingMat = new THREE.MeshBasicMaterial({
            color: colors.beam,
            side: THREE.DoubleSide, transparent: true, opacity: 0.0,
            blending: THREE.AdditiveBlending, depthWrite: false
        });
        this.beamChargeRing = new THREE.Mesh(chargeRingGeo, chargeRingMat);
        this.beamChargeRing.position.y = 0.2;
        scene.add(this.beamChargeRing);

        this.buildComboFormFx();
    }

    buildComboFormFx() {
        const colors = this.colors;
        this.comboFxGroup = new THREE.Group();
        scene.add(this.comboFxGroup);

        const floraRingGeo = new THREE.RingGeometry(CONFIG.combo.radius - 0.5, CONFIG.combo.radius, 64);
        floraRingGeo.rotateX(-Math.PI / 2);
        this.floraComboRing = new THREE.Mesh(floraRingGeo, new THREE.MeshBasicMaterial({
            color: 0x88ff66,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0,
            depthWrite: false
        }));
        this.floraComboRing.visible = false;
        this.comboFxGroup.add(this.floraComboRing);

        const pteroRingGeo = new THREE.RingGeometry(CONFIG.combo.pteroRadius - 0.5, CONFIG.combo.pteroRadius, 48);
        pteroRingGeo.rotateX(-Math.PI / 2);
        this.pteroComboRing = new THREE.Mesh(pteroRingGeo, new THREE.MeshBasicMaterial({
            color: 0xffaa00,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0,
            depthWrite: false
        }));
        this.pteroComboRing.visible = false;
        scene.add(this.pteroComboRing);

        this.pteroTimerRing = new THREE.Mesh(pteroRingGeo.clone(), new THREE.MeshBasicMaterial({
            color: colors.beam,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        }));
        this.pteroTimerRing.visible = false;
        scene.add(this.pteroTimerRing);
    }

    updateDragon(dt) {
        const t = Date.now() * 0.002;

        if (this.legs && this.legs.length > 0) {
            const speedSq = this.velocity.lengthSq();
            const isMoving = speedSq > 0.001;

            if (isMoving) {
                const speed = Math.sqrt(speedSq);
                const walkFreq = Math.max(4, speed * 2);
                const walkAmp = 0.8;
                if (!this.legPhase) this.legPhase = 0;
                this.legPhase += dt * walkFreq;
                this.legs.forEach((l, i) => {
                    const offset = (i === 0 || i === 3) ? 0 : Math.PI;
                    l.group.rotation.x = Math.sin(this.legPhase + offset) * walkAmp;
                });
            } else {
                this.legs.forEach(l => {
                    l.group.rotation.x *= (1.0 - dt * 10);
                });
                this.mesh.position.y = THREE.MathUtils.lerp(this.mesh.position.y, 0, dt * 5);
            }

            // Banking
            const currentRotY = this.mesh.rotation.y;
            let deltaRot = currentRotY - this.lastRotationY;
            if (deltaRot > Math.PI) deltaRot -= Math.PI * 2;
            if (deltaRot < -Math.PI) deltaRot += Math.PI * 2;

            const angVel = deltaRot / dt;
            this.angularVelocity = THREE.MathUtils.lerp(this.angularVelocity, angVel, dt * 10);
            this.lastRotationY = currentRotY;

            const bankFactor = 0.15;
            const maxBank = 0.3;
            const targetLean = THREE.MathUtils.clamp(-this.angularVelocity * bankFactor, -maxBank, maxBank);
            this.mesh.rotation.z = THREE.MathUtils.lerp(this.mesh.rotation.z, targetLean, dt * 5);

            if (isMoving) {
                const bounce = Math.abs(Math.sin(this.legPhase)) * 0.15;
                this.mesh.position.y = bounce;
            }
        }

        // Necks P1-P3
        if (this.necks) {
            ['p1', 'p2', 'p3'].forEach(p => {
                const n = this.necks.find(x => x.id === p);
                if (!n) return;

                const currentState = this.attackStates[p] || 'idle';

                if (currentState === 'charging') {
                    this.attackHoldTimers[p] += dt;
                    this.updateChargeTarget(p);
                    const windupT = Math.min(1, this.attackHoldTimers[p] / CONFIG.combat.windupTime);
                    const ease = windupT * (2 - windupT);
                    const backLean = this.getBackLean(n);
                    n.pivot.rotation.x = n.baseLean * (1 - ease) + backLean * ease;
                    n.group.position.z = THREE.MathUtils.lerp(n.group.position.z, n.baseZ + 0.18, dt * 12);
                    n.group.rotation.y = THREE.MathUtils.lerp(n.group.rotation.y, this.headAimYaw[p], dt * 16);
                    n.group.rotation.z = Math.sin(t * 18) * 0.02 * Math.min(1, this.attackHoldTimers[p] / CONFIG.combat.chargeTime);
                    if (this.attackReleaseQueued[p] && windupT >= 1) {
                        this.beginHeadStrike(p, this.attackQueuedKinds[p]);
                    }
                } else if (currentState === 'flamethrower') {
                    this.attackHoldTimers[p] += dt;
                    this.updateChargeTarget(p);
                    n.pivot.rotation.x = n.baseLean + 0.2 + Math.sin(t * 30) * 0.06;
                    n.group.position.z = THREE.MathUtils.lerp(n.group.position.z, n.baseZ, dt * 10);
                    n.group.rotation.y = THREE.MathUtils.lerp(n.group.rotation.y, this.headAimYaw[p], dt * 18);
                    this.updateFlamethrower(p, dt);
                } else if (currentState === 'strike') {
                    this.attackTimers[p] -= dt;
                    const totalStrike = CONFIG.combat.strikeTime;
                    const progress = THREE.MathUtils.clamp(1 - (this.attackTimers[p] / totalStrike), 0, 1);
                    const ease = progress * progress * (3 - 2 * progress);
                    n.group.rotation.y = THREE.MathUtils.lerp(n.group.rotation.y, this.headAimYaw[p], dt * 18);
                    n.pivot.rotation.x = this.getBackLean(n) * (1 - ease) + this.getForwardLean(n) * ease;
                    n.group.position.z = THREE.MathUtils.lerp(n.group.position.z, n.baseZ, dt * 16);

                    if (!this.attackImpactDone[p] && progress >= 0.65) {
                        this.attackImpactDone[p] = true;
                        this.triggerAttackImpact(p);
                    }
                    if (this.attackTimers[p] <= 0) {
                        this.attackStates[p] = 'recovery';
                        this.attackTimers[p] = this.attackKinds[p] === 'heavy'
                            ? CONFIG.combat.heavyRecoveryTime
                            : CONFIG.combat.recoveryTime;
                    }
                } else if (currentState === 'windup') {
                    this.attackTimers[p] -= dt;
                    const totalWindup = this.attackKinds[p] === 'heavy'
                        ? CONFIG.combat.heavyWindupTime
                        : CONFIG.combat.windupTime;
                    const progress = 1 - (this.attackTimers[p] / totalWindup);
                    const ease = progress * (2 - progress);
                    n.pivot.rotation.x = n.baseLean * (1 - ease) + this.getBackLean(n) * ease;
                    n.group.position.z = THREE.MathUtils.lerp(n.group.position.z, n.baseZ + 0.18, dt * 12);

                    if (this.attackTimers[p] <= 0) {
                        this.triggerAttackImpact(p);
                        this.attackStates[p] = 'recovery';
                        this.attackTimers[p] = this.attackKinds[p] === 'heavy'
                            ? CONFIG.combat.heavyRecoveryTime
                            : CONFIG.combat.recoveryTime;
                    }
                } else if (currentState === 'recovery') {
                    this.attackTimers[p] -= dt;
                    const totalRecovery = this.attackKinds[p] === 'heavy'
                        ? CONFIG.combat.heavyRecoveryTime
                        : CONFIG.combat.recoveryTime;
                    const progress = THREE.MathUtils.clamp(1 - (this.attackTimers[p] / totalRecovery), 0, 1);
                    const ease = progress * progress * (3 - 2 * progress);
                    n.pivot.rotation.x = this.getForwardLean(n) * (1 - ease) + n.baseLean * ease;
                    n.group.position.z = THREE.MathUtils.lerp(n.group.position.z, n.baseZ, dt * 10);
                    const targetYaw = this.recoveryBufferedPress[p] && this.input[p].attack
                        ? this.headAimYaw[p]
                        : n.baseYaw;
                    n.group.rotation.y = THREE.MathUtils.lerp(n.group.rotation.y, targetYaw, dt * 8);
                    if (this.attackTimers[p] <= 0) this.finishHeadRecovery(p);
                } else {
                    const lag = -this.angularVelocity * 0.1;
                    n.group.rotation.z = Math.sin(t * 5 + (p === 'p2' ? 1 : (p === 'p3' ? 2 : 0))) * 0.05 + lag;
                    n.group.rotation.y = THREE.MathUtils.lerp(n.group.rotation.y, n.baseYaw, dt * 8);
                    n.pivot.rotation.x = n.baseLean + Math.sin(t * 8) * 0.05;
                    n.group.position.z = THREE.MathUtils.lerp(n.group.position.z, n.baseZ, dt * 10);
                }
            });
        }

        // Tail P4
        if (this.tailGroup) {
            const p = 'p4';
            const currentState = this.attackStates[p] || 'idle';
            if (currentState === 'tailCharging') {
                // 蓄力期間尾巴往右側擺（前搖）
                this.attackHoldTimers.p4 += dt;
                this.updateTailChargeIndicator();
                const windupT = Math.min(1, this.attackHoldTimers.p4 / CONFIG.combat.windupTime);
                const ease = windupT * (2 - windupT);
                this.tailGroup.rotation.y = ease * 1.8; // 往右擺
                this.tailGroup.rotation.x = ease * -0.3;
                // 放開後依種類切換狀態
                if (this.attackReleaseQueued.p4) {
                    const kind = this.attackQueuedKinds.p4;
                    this.attackReleaseQueued.p4 = false;
                    if (kind === 'heavy') {
                        // 重擊：180° 旋轉橫掃
                        this.attackKinds.p4 = 'heavy';
                        this.attackStates.p4 = 'tailSweep';
                        this.attackTimers.p4 = CONFIG.combat.tailSweepDuration;
                        this.tailSweepStartY = this.mesh.rotation.y;
                        this.tailSweepImpactDone = false;
                        this.cooldowns.p4 = CONFIG.combat.tailSweepDuration + CONFIG.combat.heavyRecoveryTime;
                    } else {
                        // 輕攻擊：直接進入 recovery 揮動（跳過 windup）
                        this.attackKinds.p4 = 'light';
                        this.triggerAttackImpact('p4');
                        this.attackStates.p4 = 'recovery';
                        this.attackTimers.p4 = CONFIG.combat.recoveryTime;
                        this.cooldowns.p4 = CONFIG.combat.cooldown;
                        const windupT = Math.min(1, this.attackHoldTimers.p4 / CONFIG.combat.windupTime);
                        this.tailStartRecoveryY = (windupT * (2 - windupT)) * 1.8;
                    }
                }
            } else if (currentState === 'tailSweep') {
                this.hideChargeIndicator(p);
                // 180° 旋轉橫掃
                this.attackTimers.p4 -= dt;
                const totalSweep = CONFIG.combat.tailSweepDuration;
                const progress = THREE.MathUtils.clamp(1 - (this.attackTimers.p4 / totalSweep), 0, 1);
                const sweepEase = progress * progress * (3 - 2 * progress);
                this.mesh.rotation.y = this.tailSweepStartY + Math.PI * sweepEase;
                
                // 優化尾巴動態：使用 easeOutCubic 讓甩尾初段極具爆發力，並擴大揮動角度至約 250 度 (4.4 rad)
                const tailEase = 1 - Math.pow(1 - progress, 3);
                this.tailGroup.rotation.y = 1.8 * (1 - tailEase) + (-2.6) * tailEase;
                this.tailGroup.rotation.x = Math.sin(progress * Math.PI) * -0.5;
                
                // 在 40% 進度時觸發全圓傷害
                if (!this.tailSweepImpactDone && progress >= 0.4) {
                    this.tailSweepImpactDone = true;
                    this._triggerTailSweepImpact();
                }
                if (this.attackTimers.p4 <= 0) {
                    this.attackStates.p4 = 'recovery';
                    this.attackTimers.p4 = CONFIG.combat.heavyRecoveryTime;
                    this.tailGroup.rotation.x = 0;
                    this.tailStartRecoveryY = -2.6;
                }
            } else if (currentState === 'windup') {
                this.hideChargeIndicator(p);
                this.attackTimers[p] -= dt;
                const progress = 1 - (this.attackTimers[p] / CONFIG.combat.windupTime);
                this.tailGroup.rotation.y = Math.sin(progress * Math.PI * 0.5) * 1.2;
                this.tailGroup.rotation.x = 0;
                if (this.attackTimers[p] <= 0) {
                    this.triggerAttackImpact(p);
                    this.attackStates[p] = 'recovery';
                    this.attackTimers[p] = CONFIG.combat.recoveryTime;
                    this.tailStartRecoveryY = 1.2;
                }
            } else if (currentState === 'recovery') {
                this.hideChargeIndicator(p);
                this.attackTimers[p] -= dt;
                const duration = this.attackKinds.p4 === 'heavy' ? CONFIG.combat.heavyRecoveryTime : CONFIG.combat.recoveryTime;
                const progress = 1 - (this.attackTimers[p] / duration);
                const startY = this.tailStartRecoveryY !== undefined ? this.tailStartRecoveryY : 1.8;
                
                if (this.attackKinds.p4 === 'heavy') {
                    // 對於蓄力重擊，後搖只是緩慢讓尾巴平穩回正
                    const ease = progress * (2 - progress); // ease-out
                    this.tailGroup.rotation.y = startY * (1 - ease);
                } else {
                    // 輕攻擊：從 startY 快速揮到 -1.5 再回正
                    if (progress < 0.3) {
                        const p2 = progress / 0.3;
                        this.tailGroup.rotation.y = startY * (1 - p2) + (-1.5) * p2;
                    } else {
                        const p2 = (progress - 0.3) / 0.7;
                        const ease = p2 * p2; // ease-in
                        this.tailGroup.rotation.y = -1.5 * (1 - ease);
                    }
                }
                this.tailGroup.rotation.x = THREE.MathUtils.lerp(this.tailGroup.rotation.x, 0, dt * 8);
                if (this.attackTimers[p] <= 0) {
                    this.finishTailRecovery();
                }
            } else {
                this.hideChargeIndicator(p);
                this.tailGroup.rotation.y = Math.sin(t * 2.0) * 0.1;
                this.tailGroup.rotation.x = THREE.MathUtils.lerp(this.tailGroup.rotation.x, 0, dt * 6);
            }
        }
    }

    updateSpeedLines(dt) {
        for (let i = this.speedLines.length - 1; i >= 0; i--) {
            const line = this.speedLines[i];
            line.life -= dt;
            line.mesh.position.add(line.velocity.clone().multiplyScalar(dt));
            line.mesh.material.opacity = (line.life / line.maxLife) * 0.3;
            if (line.life <= 0) {
                if (line.mesh.parent) line.mesh.parent.remove(line.mesh);
                line.mesh.geometry.dispose();
                line.mesh.material.dispose();
                this.speedLines.splice(i, 1);
            }
        }

        if (this.isBoosting) {
            if (Math.random() > 0.5) return;
            const geo = new THREE.BoxGeometry(0.05, 0.05, 3.0);
            const mat = new THREE.MeshBasicMaterial({ color: 0x00ffff, transparent: true, opacity: 0.0 });
            const mesh = new THREE.Mesh(geo, mat);
            const angle = Math.random() * Math.PI * 2;
            const radius = 1.2 + Math.random() * 1.3;
            const height = 0.5 + Math.random() * 2.0;
            const offset = new THREE.Vector3(Math.cos(angle) * radius, height, Math.sin(angle) * radius);
            mesh.position.copy(this.mesh.position).add(offset);

            const moveDir = (this.velocity.lengthSq() > 0.1)
                ? this.velocity.clone().normalize().negate()
                : this.getForwardVector().negate();

            mesh.lookAt(mesh.position.clone().add(moveDir));
            scene.add(mesh);
            this.speedLines.push({
                mesh,
                velocity: moveDir.multiplyScalar(15 + Math.random() * 10),
                life: 0.3, maxLife: 0.3
            });
        }
    }

    createFanGeometry(range, halfAngle, segments = 24) {
        const vertices = [0, 0, 0];
        const indices = [];
        for (let i = 0; i <= segments; i++) {
            const a = -halfAngle + (halfAngle * 2 * i / segments);
            vertices.push(Math.sin(a) * range, 0, Math.cos(a) * range);
            if (i > 0) indices.push(0, i, i + 1);
        }
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
        geo.setIndex(indices);
        geo.computeBoundingSphere();
        return geo;
    }

    createFlamethrowerIndicator() {
        const group = new THREE.Group();
        const range = CONFIG.combat.flamethrowerRange;
        const halfAngle = CONFIG.combat.flamethrowerAngle;

        const fanMat = new THREE.MeshBasicMaterial({
            color: 0xff4a00,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0,
            depthWrite: false
        });
        const fan = new THREE.Mesh(this.createFanGeometry(range, halfAngle, 28), fanMat);
        group.add(fan);

        const coreMat = new THREE.MeshBasicMaterial({
            color: 0xffdd55,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0,
            depthWrite: false
        });
        const core = new THREE.Mesh(this.createFanGeometry(range * 0.72, halfAngle * 0.55, 18), coreMat);
        core.position.y = 0.025;
        group.add(core);

        const centerArrow = new THREE.ArrowHelper(new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 0.04, 0), range, 0xfff2a0, 0.42, 0.2);
        const leftEdge = new THREE.ArrowHelper(new THREE.Vector3(Math.sin(-halfAngle), 0, Math.cos(-halfAngle)).normalize(), new THREE.Vector3(0, 0.035, 0), range, 0xff9a22, 0.24, 0.1);
        const rightEdge = new THREE.ArrowHelper(new THREE.Vector3(Math.sin(halfAngle), 0, Math.cos(halfAngle)).normalize(), new THREE.Vector3(0, 0.035, 0), range, 0xff9a22, 0.24, 0.1);
        [centerArrow, leftEdge, rightEdge].forEach(arrow => {
            arrow.line.material.transparent = true;
            arrow.line.material.opacity = 0;
            arrow.line.material.depthWrite = false;
            arrow.cone.material.transparent = true;
            arrow.cone.material.opacity = 0;
            arrow.cone.material.depthWrite = false;
            group.add(arrow);
        });

        group.userData = { fan, core, centerArrow, leftEdge, rightEdge };
        group.visible = false;
        scene.add(group);
        return group;
    }

    buildIndicators() {
        const colors = this.colors;
        this.p1Arrow = new THREE.ArrowHelper(new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 2, 0), CONFIG.visuals.arrowLength, colors.p1);
        scene.add(this.p1Arrow);
        this.p2Arrow = new THREE.ArrowHelper(new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 2, 0), CONFIG.visuals.arrowLength, colors.p2);
        scene.add(this.p2Arrow);
        this.p3Arrow = new THREE.ArrowHelper(new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 2, 0), CONFIG.visuals.arrowLength, colors.p3);
        scene.add(this.p3Arrow);
        this.p4Arrow = new THREE.ArrowHelper(new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 2, 0), CONFIG.visuals.arrowLength, colors.p4);
        scene.add(this.p4Arrow);

        this.attackLandingIndicators = {};
        ['p1', 'p2', 'p3', 'p4'].forEach(p => {
            const outerRadius = p === 'p4'
                ? CONFIG.combat.tailSweepRadius * CONFIG.buffs.tailPowerSweepRadiusMultiplier
                : CONFIG.combat.attackRange;
            const innerRadius = p === 'p4'
                ? Math.max(0.1, outerRadius - 0.16)
                : 0.45;
            const geo = new THREE.RingGeometry(innerRadius, outerRadius, 48);
            geo.rotateX(-Math.PI / 2);
            const mat = new THREE.MeshBasicMaterial({
                color: colors[p],
                side: THREE.DoubleSide,
                transparent: true,
                opacity: 0.0,
                depthWrite: false
            });
            const ring = new THREE.Mesh(geo, mat);
            ring.visible = false;
            ring.position.y = 0.08;

            if (p === 'p4') {
                const arrowGroup = new THREE.Group();
                for (let i = 0; i < 4; i++) {
                    const angle = (Math.PI / 2) * i;
                    const r = innerRadius - 0.9;
                    const shape = new THREE.Shape();
                    shape.moveTo(0, 0);
                    shape.lineTo(-0.7, -1.4);
                    shape.lineTo(0.7, -1.4);
                    shape.lineTo(0, 0);
                    const arrowGeo = new THREE.ShapeGeometry(shape);
                    arrowGeo.rotateX(-Math.PI / 2);
                    const arrowMesh = new THREE.Mesh(arrowGeo, mat);
                    arrowMesh.position.set(Math.cos(angle) * r, 0, -Math.sin(angle) * r);
                    arrowMesh.rotation.y = -angle;
                    arrowGroup.add(arrowMesh);
                }
                ring.add(arrowGroup);
                ring.userData.arrowGroup = arrowGroup;
            }

            scene.add(ring);
            this.attackLandingIndicators[p] = ring;
        });

        ['p1', 'p2', 'p3'].forEach(p => {
            const arrow = new THREE.ArrowHelper(new THREE.Vector3(0, 0, 1), new THREE.Vector3(), 1, colors[p], 1.0, 0.45);
            arrow.visible = false;
            arrow.line.material.transparent = true;
            arrow.line.material.opacity = 0;
            arrow.line.material.depthWrite = false;
            arrow.cone.material.transparent = true;
            arrow.cone.material.opacity = 0;
            arrow.cone.material.depthWrite = false;
            scene.add(arrow);
            this.fireballAimArrows[p] = arrow;

            this.flamethrowerIndicators[p] = this.createFlamethrowerIndicator();
        });
    }

    getForwardVector() {
        const forward = new THREE.Vector3(0, 0, 1);
        forward.applyQuaternion(this.mesh.quaternion);
        return forward;
    }

    canChargeAttack(playerIndex) {
        return playerIndex !== 'p4';
    }

    isPlayerMeleeBusy(playerIndex) {
        return (this.attackStates[playerIndex] || 'idle') !== 'idle';
    }

    isPlayerMovementLocked(playerIndex) {
        if (this.activeComboForm === 'flora' && this.beamPhase !== 'idle') {
            return this.isPlayerMeleeBusy(playerIndex);
        }
        if (this.activeComboForm === 'rush' && this.beamPhase === 'firing' && this.comboState === 'rushDash') {
            return this.isPlayerMeleeBusy(playerIndex);
        }
        return this.input[playerIndex].charge || this.isPlayerMeleeBusy(playerIndex);
    }

    cancelMeleeForCombo(playerIndex, forceAll = false) {
        const stateName = this.attackStates[playerIndex] || 'idle';
        const cancellable = forceAll ||
            stateName === 'charging' ||
            stateName === 'tailCharging' ||
            stateName === 'flamethrower';
        if (!cancellable || stateName === 'idle') return;

        this.attackStates[playerIndex] = 'idle';
        this.attackTimers[playerIndex] = 0;
        this.attackHoldTimers[playerIndex] = 0;
        this.attackReleaseQueued[playerIndex] = false;
        this.attackQueuedKinds[playerIndex] = 'light';
        this.attackImpactDone[playerIndex] = false;
        this.recoveryBufferedPress[playerIndex] = false;
        this.lastAttackInput[playerIndex] = false;
        this.hideChargeIndicator(playerIndex);
        if (playerIndex !== 'p4') this.hideFlamethrowerIndicator(playerIndex);
        if (playerIndex === 'p4') {
            this.tailSweepImpactDone = false;
            this.tailGroup.rotation.x = 0;
            this.tailGroup.rotation.y = 0;
        }
    }

    cancelAllMeleeForCombo() {
        ['p1', 'p2', 'p3', 'p4'].forEach(p => this.cancelMeleeForCombo(p, true));
    }

    startAttackPress(playerIndex) {
        if (this.attackStates[playerIndex] !== 'idle') {
            if (playerIndex === 'p4' && this.attackStates.p4 === 'recovery') {
                this.recoveryBufferedPress.p4 = true;
            }
            if (this.canChargeAttack(playerIndex) &&
                (this.attackStates[playerIndex] === 'strike' || this.attackStates[playerIndex] === 'recovery')) {
                this.recoveryBufferedPress[playerIndex] = true;
            }
            return;
        }
        if (this.cooldowns[playerIndex] > 0) return;
        if (this.buffSystem.getMeleeForm() === 'flame' && this.canChargeAttack(playerIndex)) {
            this.resetChargeAim(playerIndex);
            this.attackStates[playerIndex] = 'flamethrower';
            this.attackHoldTimers[playerIndex] = 0;
            this.updateChargeTarget(playerIndex);
            return;
        }
        if (playerIndex === 'p4') {
            // P4 尾巴蓄力攻擊（獨立狀態，不走頭部流程）
            this.attackStates.p4 = 'tailCharging';
            this.attackHoldTimers.p4 = 0;
            this.attackReleaseQueued.p4 = false;
            this.attackQueuedKinds.p4 = 'light';
            this.attackImpactDone.p4 = false;
            this.updateTailChargeIndicator();
        } else if (this.canChargeAttack(playerIndex)) {
            this.resetChargeAim(playerIndex);
            this.attackStates[playerIndex] = 'charging';
            this.attackHoldTimers[playerIndex] = 0;
            this.attackReleaseQueued[playerIndex] = false;
            this.attackQueuedKinds[playerIndex] = 'light';
            this.attackImpactDone[playerIndex] = false;
            this.recoveryBufferedPress[playerIndex] = false;
            this.updateChargeTarget(playerIndex);
        } else {
            this.attack(playerIndex, 'light');
        }
    }

    releaseAttackPress(playerIndex) {
        if (this.attackStates[playerIndex] === 'flamethrower') {
            this.attackStates[playerIndex] = 'idle';
            this.cooldowns[playerIndex] = CONFIG.combat.cooldown;
            this.hideFlamethrowerIndicator(playerIndex);
            return;
        }
        // P4 尾巴蓄力放開
        if (playerIndex === 'p4' && this.attackStates.p4 === 'tailCharging') {
            const holdTime = this.attackHoldTimers.p4;
            const kind = holdTime >= CONFIG.combat.tailChargeTime ? 'heavy' : 'light';
            this.attackQueuedKinds.p4 = kind;
            this.attackReleaseQueued.p4 = true;
            this.hideChargeIndicator('p4');
            return;
        }
        if (this.attackStates[playerIndex] !== 'charging') return;
        const holdTime = this.attackHoldTimers[playerIndex];
        const kind = holdTime >= CONFIG.combat.chargeTime ? 'heavy' : 'light';
        this.attackQueuedKinds[playerIndex] = kind;
        this.attackReleaseQueued[playerIndex] = true;
        if (holdTime >= CONFIG.combat.windupTime) this.beginHeadStrike(playerIndex, kind);
    }

    attack(playerIndex, kind = 'light') {
        if (this.attackStates[playerIndex] !== 'idle') return;
        this.attackKinds[playerIndex] = kind;
        this.attackStates[playerIndex] = 'windup';
        this.attackTimers[playerIndex] = kind === 'heavy'
            ? CONFIG.combat.heavyWindupTime
            : CONFIG.combat.windupTime;
        this.cooldowns[playerIndex] = CONFIG.combat.cooldown;
        if (kind === 'heavy') this.cooldowns[playerIndex] = CONFIG.combat.cooldown + CONFIG.combat.heavyRecoveryTime;
    }

    beginHeadStrike(playerIndex, kind) {
        if (kind === 'light') this.resetChargeAim(playerIndex);
        this.attackKinds[playerIndex] = kind;
        this.attackStates[playerIndex] = 'strike';
        this.attackTimers[playerIndex] = CONFIG.combat.strikeTime;
        this.attackReleaseQueued[playerIndex] = false;
        this.attackImpactDone[playerIndex] = false;
        this.hideChargeIndicator(playerIndex);
        this.cooldowns[playerIndex] = kind === 'heavy'
            ? CONFIG.combat.heavyRecoveryTime
            : CONFIG.combat.recoveryTime;
    }

    finishHeadRecovery(playerIndex) {
        this.attackStates[playerIndex] = 'idle';
        this.attackTimers[playerIndex] = 0;
        this.attackReleaseQueued[playerIndex] = false;
        this.attackImpactDone[playerIndex] = false;
        if (this.recoveryBufferedPress[playerIndex] && this.input[playerIndex].attack) {
            this.cooldowns[playerIndex] = 0;
            this.recoveryBufferedPress[playerIndex] = false;
            this.startAttackPress(playerIndex);
        } else {
            this.recoveryBufferedPress[playerIndex] = false;
        }
    }

    finishTailRecovery() {
        const playerIndex = 'p4';
        this.attackStates[playerIndex] = 'idle';
        this.attackTimers[playerIndex] = 0;
        this.attackHoldTimers[playerIndex] = 0;
        this.attackReleaseQueued[playerIndex] = false;
        this.attackQueuedKinds[playerIndex] = 'light';
        this.attackImpactDone[playerIndex] = false;
        if (this.tailGroup) this.tailGroup.rotation.x = 0;
        if (this.recoveryBufferedPress[playerIndex] && this.input[playerIndex].attack) {
            this.cooldowns[playerIndex] = 0;
            this.recoveryBufferedPress[playerIndex] = false;
            this.startAttackPress(playerIndex);
        } else {
            this.recoveryBufferedPress[playerIndex] = false;
        }
    }

    getBackLean(neck) {
        return neck.baseLean - 0.48;
    }

    getForwardLean(neck) {
        return neck.baseLean + 1.45;
    }

    getBaseAimYaw(playerIndex) {
        if (playerIndex === 'p1') return -0.6;
        if (playerIndex === 'p2') return 0.6;
        return 0;
    }

    resetChargeAim(playerIndex) {
        const yaw = this.getBaseAimYaw(playerIndex);
        this.chargeAim[playerIndex].set(Math.sin(yaw), Math.cos(yaw));
        this.headAimYaw[playerIndex] = yaw;
        this.chargeTargets[playerIndex] = null;
    }

    updateChargeTarget(playerIndex) {
        if (!this.canChargeAttack(playerIndex)) return null;
        const rawAim = this.getRawAimVector(playerIndex);
        if (rawAim && rawAim.lengthSq() > 0.05) {
            this.chargeAim[playerIndex].copy(rawAim).normalize();
        }

        const baseYaw = this.getBaseAimYaw(playerIndex);
        const aimYaw = Math.atan2(this.chargeAim[playerIndex].x, this.chargeAim[playerIndex].y);
        let delta = aimYaw - baseYaw;
        while (delta > Math.PI) delta -= Math.PI * 2;
        while (delta < -Math.PI) delta += Math.PI * 2;
        const clampedYaw = baseYaw + THREE.MathUtils.clamp(delta, -CONFIG.combat.chargeAimHalfAngle, CONFIG.combat.chargeAimHalfAngle);
        this.headAimYaw[playerIndex] = clampedYaw;
        this.chargeAim[playerIndex].set(Math.sin(clampedYaw), Math.cos(clampedYaw));

        let local = new THREE.Vector3(
            this.chargeAim[playerIndex].x * this.getChargeAimDistance(),
            0,
            this.chargeAim[playerIndex].y * this.getChargeAimDistance()
        );
        local.applyQuaternion(this.mesh.quaternion);

        const target = this.mesh.position.clone().add(local);
        target.y = 0.1;
        this.chargeTargets[playerIndex] = target;

        const ring = this.attackLandingIndicators[playerIndex];
        if (ring) {
            const visible = this.attackStates[playerIndex] === 'charging' &&
                this.attackHoldTimers[playerIndex] >= CONFIG.combat.chargeTime;
            ring.visible = visible;
            ring.material.opacity = visible
                ? 0.75
                : 0.0;
            ring.position.copy(target);
            const scale = this.attackHoldTimers[playerIndex] >= CONFIG.combat.chargeTime
                ? CONFIG.combat.heavyRadiusScale
                : 1.0;
            ring.scale.setScalar(scale);
        }
        this.updateFireballAimIndicator(playerIndex, target);
        return target;
    }

    getChargeAimDistance() {
        return this.buffSystem.getMeleeForm() === 'fireball'
            ? CONFIG.combat.fireballAimDistance
            : CONFIG.combat.chargeDefaultDistance;
    }

    getAttackAimWorldVector(playerIndex) {
        const yaw = this.headAimYaw[playerIndex] !== undefined
            ? this.headAimYaw[playerIndex]
            : this.getBaseAimYaw(playerIndex);
        const local = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw));
        local.applyQuaternion(this.mesh.quaternion);
        return local.normalize();
    }

    getRawAimVector(playerIndex) {
        const input = this.input[playerIndex];
        if (input && input.pointer && input.pointerActive && window.camera) {
            const pointer = input.pointer;
            const ndc = new THREE.Vector2(
                (pointer.x / window.innerWidth) * 2 - 1,
                -(pointer.y / window.innerHeight) * 2 + 1
            );
            const raycaster = new THREE.Raycaster();
            raycaster.setFromCamera(ndc, camera);
            const ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
            const hit = new THREE.Vector3();
            if (raycaster.ray.intersectPlane(ground, hit)) {
                const worldDir = hit.sub(this.mesh.position);
                worldDir.y = 0;
                if (worldDir.lengthSq() > 0.05) {
                    worldDir.normalize();
                    worldDir.applyQuaternion(this.mesh.quaternion.clone().invert());
                    return new THREE.Vector2(worldDir.x, worldDir.z);
                }
            }
        }

        const move = this.input[playerIndex].move;
        if (move && move.lengthSq() > 0.05) {
            const worldDir = new THREE.Vector3(move.x, 0, move.y).normalize();
            worldDir.applyQuaternion(this.mesh.quaternion.clone().invert());
            return new THREE.Vector2(worldDir.x, worldDir.z).normalize();
        }
        return null;
    }


    hideChargeIndicator(playerIndex) {
        const ring = this.attackLandingIndicators[playerIndex];
        if (ring) {
            ring.visible = false;
            ring.material.opacity = 0;
        }
        this.hideFireballAimIndicator(playerIndex);
    }

    hideAllChargeIndicators() {
        if (!this.attackLandingIndicators) return;
        Object.keys(this.attackLandingIndicators).forEach(p => this.hideChargeIndicator(p));
    }

    hideFireballAimIndicator(playerIndex) {
        const arrow = this.fireballAimArrows && this.fireballAimArrows[playerIndex];
        if (!arrow) return;
        arrow.visible = false;
        arrow.line.material.opacity = 0;
        arrow.cone.material.opacity = 0;
    }

    updateFireballAimIndicator(playerIndex, target) {
        const arrow = this.fireballAimArrows && this.fireballAimArrows[playerIndex];
        const isFireballCharging = this.buffSystem.getMeleeForm() === 'fireball' &&
            this.attackStates[playerIndex] === 'charging' &&
            this.attackHoldTimers[playerIndex] >= CONFIG.combat.chargeTime;
        if (!arrow || !target || !isFireballCharging) {
            this.hideFireballAimIndicator(playerIndex);
            return;
        }

        const origin = this.mesh.position.clone();
        const forward = this.getAttackAimWorldVector(playerIndex);
        origin.add(forward.clone().multiplyScalar(1.25));
        origin.y = 0.28;

        const dir = target.clone().sub(origin);
        dir.y = 0;
        const length = Math.max(1.5, dir.length());
        dir.normalize();

        const chargeRatio = THREE.MathUtils.clamp(this.attackHoldTimers[playerIndex] / CONFIG.combat.chargeTime, 0, 1);
        const pulse = 0.5 + 0.5 * Math.sin(Date.now() * 0.022);
        const opacity = 0.48 + chargeRatio * 0.32 + pulse * 0.12;
        const arrowColor = chargeRatio >= 1 ? 0xfff066 : this.colors[playerIndex];

        arrow.visible = true;
        arrow.position.copy(origin);
        arrow.setDirection(dir);
        arrow.setLength(length, 1.05 + chargeRatio * 0.35, 0.46 + chargeRatio * 0.18);
        arrow.setColor(arrowColor);
        arrow.line.material.opacity = opacity;
        arrow.cone.material.opacity = Math.min(1, opacity + 0.12);
    }

    hideFlamethrowerIndicator(playerIndex) {
        const indicator = this.flamethrowerIndicators && this.flamethrowerIndicators[playerIndex];
        if (!indicator) return;
        indicator.visible = false;
        const parts = indicator.userData || {};
        [parts.fan, parts.core].forEach(mesh => {
            if (mesh && mesh.material) mesh.material.opacity = 0;
        });
        [parts.centerArrow, parts.leftEdge, parts.rightEdge].forEach(arrow => {
            if (!arrow) return;
            arrow.line.material.opacity = 0;
            arrow.cone.material.opacity = 0;
        });
    }

    hideAllFlamethrowerIndicators() {
        if (!this.flamethrowerIndicators) return;
        Object.keys(this.flamethrowerIndicators).forEach(p => this.hideFlamethrowerIndicator(p));
    }

    updateFlamethrowerIndicator(playerIndex, origin, forward) {
        const indicator = this.flamethrowerIndicators && this.flamethrowerIndicators[playerIndex];
        if (!indicator) return;
        const base = origin.clone();
        base.y = 0.1;
        indicator.visible = true;
        indicator.position.copy(base);
        indicator.rotation.y = Math.atan2(forward.x, forward.z);

        const pulse = 0.5 + 0.5 * Math.sin(Date.now() * 0.035);
        const parts = indicator.userData || {};
        if (parts.fan) parts.fan.material.opacity = 0.24 + pulse * 0.08;
        if (parts.core) parts.core.material.opacity = 0.28 + pulse * 0.12;
        [parts.centerArrow, parts.leftEdge, parts.rightEdge].forEach((arrow, idx) => {
            if (!arrow) return;
            const edgeOpacity = idx === 0 ? 0.72 : 0.5;
            arrow.line.material.opacity = edgeOpacity + pulse * 0.12;
            arrow.cone.material.opacity = Math.min(1, edgeOpacity + 0.1 + pulse * 0.12);
        });
    }

    updateTailChargeIndicator() {
        const ring = this.attackLandingIndicators && this.attackLandingIndicators.p4;
        if (!ring) return;
        const ready = this.attackStates.p4 === 'tailCharging' &&
            this.attackHoldTimers.p4 >= CONFIG.combat.tailChargeTime;
        ring.visible = ready;
        ring.position.copy(this.mesh.position);
        ring.position.y = 0.09;
        if (!ready) {
            ring.material.opacity = 0;
            ring.scale.setScalar(1);
            return;
        }
        const pulse = 0.5 + 0.5 * Math.sin(Date.now() * 0.018);
        ring.material.opacity = 0.48 + pulse * 0.24;
        const radiusScale = this.getTailSweepRadius() / (CONFIG.combat.tailSweepRadius * CONFIG.buffs.tailPowerSweepRadiusMultiplier);
        ring.scale.setScalar(radiusScale * (1 + pulse * 0.035));
        
        if (ring.userData.arrowGroup) {
            ring.userData.arrowGroup.rotation.y = Date.now() * 0.0035;
        }
    }

    getTailSweepRadius() {
        const buffScale = this.buffSystem && this.buffSystem.isActive('tailPower')
            ? CONFIG.buffs.tailPowerSweepRadiusMultiplier
            : 1;
        return CONFIG.combat.tailSweepRadius * buffScale;
    }

    _triggerTailSweepImpact() {
        const damage = this.getMeleeDamage('p4', 'heavy') * CONFIG.combat.tailSweepDamageScale;
        const center = this.mesh.position.clone();
        center.y = 0.5;
        this.createHitbox(center, this.getTailSweepRadius(), damage, 0.35, true, this.colors.p4, { heavy: true, stagger: 160 });
        this.buffSystem.onEffectiveDamage(damage);
    }

    triggerAttackImpact(playerIndex) {
        let isTail = (playerIndex === 'p4');
        const kind = this.attackKinds[playerIndex] || 'light';
        let damage = this.getMeleeDamage(playerIndex, kind);
        let radius = CONFIG.combat.attackRange;
        let color = this.colors[playerIndex];
        const form = this.buffSystem.getMeleeForm();

        const forward = this.getForwardVector();
        const spawnPos = this.mesh.position.clone();
        spawnPos.y = 0.5;

        if (isTail) {
            spawnPos.add(forward.clone().negate().multiplyScalar(3.0));
        } else {
            if (kind === 'heavy' && this.chargeTargets[playerIndex]) {
                spawnPos.copy(this.chargeTargets[playerIndex]);
                spawnPos.y = 0.5;
            } else {
                if (playerIndex === 'p1') spawnPos.add(forward.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), -0.6).multiplyScalar(3.0));
                if (playerIndex === 'p2') spawnPos.add(forward.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), 0.6).multiplyScalar(3.0));
                if (playerIndex === 'p3') spawnPos.add(forward.multiplyScalar(3.2));
            }
        }

        if (!isTail && form === 'fireball') {
            const impactPos = this.mesh.position.clone()
                .add(this.getAttackAimWorldVector(playerIndex).multiplyScalar(CONFIG.combat.fireballAimDistance));
            impactPos.y = 0.5;
            const heavyScale = kind === 'heavy' ? CONFIG.combat.fireballHeavyDamageScale : 1;
            this.fireHeadFireball(playerIndex, impactPos, damage * CONFIG.combat.fireballDamageScale * heavyScale, kind === 'heavy');
            return;
        }

        if (kind === 'heavy') radius *= CONFIG.combat.heavyRadiusScale;
        this.createHitbox(spawnPos, radius, damage, 0.2, isTail, color, { heavy: kind === 'heavy', form });
        if (!isTail && kind === 'heavy' && form === 'shockwave') {
            this.createShockwave(spawnPos);
        }
    }

    getMeleeDamage(playerIndex, kind) {
        let damage = CONFIG.combat.meleeDamage * this.buffSystem.getMeleeMultiplier();
        if (playerIndex === 'p4' && this.buffSystem.isActive('tailPower')) {
            damage *= CONFIG.buffs.tailDamageMultiplier;
        }
        if (kind === 'heavy') damage *= CONFIG.combat.heavyDamageScale;
        if (this.buffSystem.isActive('comboRamp')) {
            const stacks = this.comboRampStacks || 0;
            damage *= 1 + stacks * CONFIG.buffs.comboDamageStepPct;
        }
        return damage;
    }

    createHitbox(pos, radius, damage, duration, isTail, color, options = {}) {
        const hitKnockback = (isTail ? CONFIG.combat.tailMeleeKnockback : CONFIG.combat.meleeKnockback)
            * this.buffSystem.getKnockbackMultiplier();
        const ringGeo = new THREE.RingGeometry(0.5, radius, 32);
        ringGeo.rotateX(-Math.PI / 2);
        const ringMat = new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide, transparent: true, opacity: 0.8 });
        const ring = new THREE.Mesh(ringGeo, ringMat);
        ring.position.copy(pos);
        ring.position.y = 0.1;
        scene.add(ring);

        for (let i = 0; i < 8; i++) {
            const pPos = pos.clone().add(new THREE.Vector3((Math.random() - 0.5) * radius, Math.random() * 2, (Math.random() - 0.5) * radius));
            state.particles.push(new Particle(pPos, color));
        }

        const owner = this; // 命中時用作攻擊者，避免 closure 內 this 指到 particle entry

        state.particles.push({
            ring,
            life: duration,
            maxLife: duration,
            hitList: new Set(),
            update(dt) {
                this.life -= dt;
                const progress = 1 - (this.life / this.maxLife);
                this.ring.material.opacity = 0.8 * (1 - progress);
                const s = 1 + progress * 0.5;
                this.ring.scale.set(s, s, s);

                if (this.life <= 0) {
                    scene.remove(this.ring);
                    this.ring.geometry.dispose();
                    return false;
                }

                if (state.enemyManager) {
                    state.enemyManager.enemies.forEach(e => {
                        if (e.isDead || this.hitList.has(e)) return;
                        if (e.mesh.position.distanceTo(ring.position) < radius + 0.5) {
                            e.takeDamage(damage, owner.mesh.position, hitKnockback);
                            if (e.addStagger) {
                                const baseStagger = options.stagger || (options.heavy ? 35 : 0);
                                const heavyBonus = options.heavy ? damage * CONFIG.combat.heavyStaggerBonusScale : 0;
                                e.addStagger(baseStagger + heavyBonus, ring.position);
                            }
                            this.hitList.add(e);
                            owner.buffSystem.onEffectiveDamage(damage);
                            owner.tryMeleeExplosion(e.mesh.position, damage);
                            if (!isTail && !options.noRecoil) {
                                const recoilDir = owner.mesh.position.clone().sub(e.mesh.position).normalize();
                                recoilDir.y = 0;
                                owner.knockbackVel.add(recoilDir.multiplyScalar(CONFIG.combat.headRecoilForce));
                            }
                        }
                    });
                }

                // PVP：對其他三頭龍造成傷害
                state.dragons.forEach(d => {
                    if (!d || d === owner || d.isDead || this.hitList.has(d)) return;
                    if (d.intersectsHitCircle && d.intersectsHitCircle(ring.position, radius)) {
                        d.takeDamage(damage, owner.mesh.position, hitKnockback);
                        if (options.heavy && d.addStagger) {
                            d.addStagger(damage * CONFIG.combat.heavyStaggerBonusScale, ring.position);
                        }
                        this.hitList.add(d);
                        owner.buffSystem.onEffectiveDamage(damage);
                        owner.tryMeleeExplosion(d.mesh.position, damage);
                        if (!isTail && !options.noRecoil) {
                            const recoilDir = owner.mesh.position.clone().sub(d.mesh.position).normalize();
                            recoilDir.y = 0;
                            owner.knockbackVel.add(recoilDir.multiplyScalar(CONFIG.combat.headRecoilForce));
                        }
                    }
                });

                if (state.levelManager && state.levelManager.blocks) {
                    state.levelManager.blocks.forEach(block => {
                        if (block.isDead || this.hitList.has(block)) return;
                        if (!block.solid) return;
                        if (block.mesh.position.distanceTo(ring.position) < radius + 2.5) {
                            const didDamage = state.levelManager.damageBlock(block, damage, owner);
                            this.hitList.add(block);
                            if (didDamage) owner.buffSystem.onEffectiveDamage(damage);
                            if (!isTail && !options.noRecoil) {
                                const recoilDir = owner.mesh.position.clone().sub(block.mesh.position).normalize();
                                recoilDir.y = 0;
                                owner.knockbackVel.add(recoilDir.multiplyScalar(CONFIG.combat.blockRecoilForce));
                            }
                        }
                    });
                }
                return true;
            }
        });
    }

    createAreaDamage(pos, radius, damage, color, options = {}) {
        options.noRecoil = true;
        this.createHitbox(pos, radius, damage, 0.35, false, color, options);
    }

    createShockwaveBlast(pos, radius, damage, stagger = 80) {
        this.createAreaDamage(pos, radius, damage, 0xffffff, { heavy: true, stagger });
    }

    createShockwave(pos) {
        this.createShockwaveBlast(
            pos,
            CONFIG.combat.shockwaveRadius,
            CONFIG.combat.meleeDamage * CONFIG.combat.shockwaveDamageScale,
            80
        );
        if (state.enemyManager) {
            state.enemyManager.enemies.forEach(e => {
                if (!e.isDead && e.mesh.position.distanceTo(pos) < CONFIG.combat.shockwaveRadius + 0.5 && e.addStagger) {
                    e.addStagger(CONFIG.stagger.enemyThreshold, pos);
                }
            });
        }
    }

    fireHeadFireball(playerIndex, targetPos, damage, isHeavy = false) {
        const startPos = this.mesh.position.clone();
        startPos.y = 2.2;
        const dir = targetPos.clone().sub(startPos).normalize();
        const sizeScale = isHeavy ? CONFIG.combat.fireballHeavySizeScale : 1;
        const radius = CONFIG.combat.fireballRadius * sizeScale;
        const bullet = new Bullet(playerIndex, startPos, dir, CONFIG.combat.fireballSpeed, 1.4, 0, CONFIG.combat.fireballProjectileSize * sizeScale, {
            damage,
            color: this.colors[playerIndex],
            knockback: (isHeavy ? CONFIG.combat.fireballHeavyKnockback : CONFIG.combat.fireballKnockback)
                * this.buffSystem.getKnockbackMultiplier(),
            penetration: 0
        });
        bullet.attackerDragon = this;
        bullet.targetPoint = targetPos.clone();
        bullet.explodeRadius = radius;
        bullet.onImpact = (b) => {
            this.createAreaDamage(b.mesh.position.clone(), radius, damage, this.colors[playerIndex], { heavy: true, stagger: isHeavy ? 70 : 35 });
        };
        state.bullets.push(bullet);
    }

    tryMeleeExplosion(pos, sourceDamage) {
        if (!this.buffSystem.isActive('meleeExplosion')) return;
        if (Math.random() >= CONFIG.buffs.meleeExplosionChance) return;
        this.createAreaDamage(pos.clone(), 3.5, sourceDamage * 0.6, 0xff6600, { stagger: 45 });
    }

    spawnFlamePuff(pos, velocity, color, size, life) {
        const geo = new THREE.SphereGeometry(0.34, 8, 6);
        const mat = new THREE.MeshBasicMaterial({
            color,
            transparent: true,
            opacity: 0.86,
            depthWrite: false
        });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.copy(pos);
        scene.add(mesh);
        state.particles.push({
            mesh,
            velocity,
            life,
            maxLife: life,
            size,
            update(dt) {
                this.life -= dt;
                const progress = 1 - (this.life / this.maxLife);
                mesh.position.add(this.velocity.clone().multiplyScalar(dt));
                mesh.position.y += Math.sin(progress * Math.PI) * dt * 1.8;
                mesh.scale.setScalar(this.size * (0.75 + progress * 1.25));
                mesh.material.opacity = Math.max(0, 0.86 * (1 - progress));
                if (this.life <= 0) {
                    if (mesh.parent) mesh.parent.remove(mesh);
                    mesh.geometry.dispose();
                    mesh.material.dispose();
                    return false;
                }
                return true;
            }
        });
    }

    updateFlamethrower(playerIndex, dt) {
        this.updateChargeTarget(playerIndex);
        const forward = this.getAttackAimWorldVector(playerIndex);
        const origin = this.mesh.position.clone();
        origin.y = 1.3;
        const range = CONFIG.combat.flamethrowerRange;
        const halfAngle = CONFIG.combat.flamethrowerAngle;
        const damage = CONFIG.combat.flamethrowerDamagePerSecond * dt * this.buffSystem.getMeleeMultiplier();

        this.updateFlamethrowerIndicator(playerIndex, origin, forward);
        this.flamethrowerTimers[playerIndex] = (this.flamethrowerTimers[playerIndex] || 0) + dt;
        if (this.flamethrowerTimers[playerIndex] >= 0.032) {
            this.flamethrowerTimers[playerIndex] = 0;
            for (let i = 0; i < 5; i++) {
                const dist = 0.7 + Math.random() * range;
                const lateralWidth = Math.tan(halfAngle) * dist * 0.85;
                const pPos = origin.clone().add(forward.clone().multiplyScalar(dist));
                const side = new THREE.Vector3(forward.z, 0, -forward.x).multiplyScalar((Math.random() - 0.5) * 2 * lateralWidth);
                pPos.add(side);
                pPos.y = 0.55 + Math.random() * 1.25;

                const sideDrift = new THREE.Vector3(forward.z, 0, -forward.x).multiplyScalar((Math.random() - 0.5) * 2.2);
                const velocity = forward.clone()
                    .multiplyScalar(4.5 + Math.random() * 5.5)
                    .add(sideDrift);
                velocity.y = 0.2 + Math.random() * 1.2;

                const colorRoll = Math.random();
                const color = colorRoll > 0.72 ? 0xffff88 : (colorRoll > 0.35 ? 0xff8a00 : 0xff2500);
                const size = 0.55 + (dist / range) * 0.8 + Math.random() * 0.4;
                this.spawnFlamePuff(pPos, velocity, color, size, 0.22 + Math.random() * 0.14);
            }
            if (Math.random() > 0.5) {
                const smokePos = origin.clone().add(forward.clone().multiplyScalar(range * (0.75 + Math.random() * 0.25)));
                smokePos.y = 1.0 + Math.random() * 0.7;
                const smokeVel = forward.clone().multiplyScalar(1.2 + Math.random() * 1.5);
                smokeVel.y = 1.0 + Math.random() * 1.1;
                this.spawnFlamePuff(smokePos, smokeVel, 0x3a342f, 0.75 + Math.random() * 0.6, 0.35 + Math.random() * 0.18);
            }
        }

        const isInCone = (pos, targetRadius = 0.9) => {
            const flatPos = pos.clone();
            flatPos.y = origin.y;
            const toTarget = flatPos.sub(origin);
            const along = toTarget.dot(forward);
            if (along < 0.2 || along > range + targetRadius) return false;
            const perp = toTarget.sub(forward.clone().multiplyScalar(along)).length();
            return perp <= Math.tan(halfAngle) * Math.max(0.6, along) + targetRadius;
        };

        if (state.enemyManager) {
            state.enemyManager.enemies.forEach(e => {
                if (e.isDead || !isInCone(e.mesh.position)) return;
                e.takeDamage(damage, origin, CONFIG.combat.flamethrowerKnockback);
                this.buffSystem.onEffectiveDamage(damage);
            });
        }

        state.dragons.forEach(d => {
            if (!d || d === this || d.isDead) return;
            const hit = d.getHitSpheres
                ? d.getHitSpheres(CONFIG.hitbox.meleePadding).some(s => isInCone(s.pos, s.radius))
                : isInCone(d.mesh.position, 1.2);
            if (!hit) return;
            d.takeDamage(damage, origin, CONFIG.combat.flamethrowerKnockback);
            this.buffSystem.onEffectiveDamage(damage);
        });

        if (state.levelManager && state.levelManager.blocks) {
            state.levelManager.blocks.forEach(block => {
                if (block.isDead || !block.solid || !block.destructible) return;
                if (!isInCone(block.mesh.position)) return;
                const didDamage = state.levelManager.damageBlock(block, damage * CONFIG.combat.flamethrowerBlockDamageScale, this);
                if (didDamage) this.buffSystem.onEffectiveDamage(damage * CONFIG.combat.flamethrowerBlockDamageScale);
            });
        }
    }

    updateRamStagger(dt) {
        if (!this.buffSystem.isActive('ramStagger')) return;
        if (this.velocity.length() < CONFIG.buffs.ramSpeedThreshold) return;
        this.ramShockwaveFxTimer -= dt;
        if (this.ramShockwaveFxTimer <= 0) {
            this.ramShockwaveFxTimer = 0.12;
            this.spawnRamShockwave();
        }
        const applyRam = (target) => {
            const lastHit = this.lastRamHit.get(target) || 0;
            if (lastHit > 0) {
                this.lastRamHit.set(target, lastHit - dt);
                return;
            }
            const hit = target.intersectsHitCircle
                ? target.intersectsHitCircle(this.mesh.position, CONFIG.hitbox.ramRadius)
                : target.mesh.position.distanceTo(this.mesh.position) <= 2.0;
            if (!hit) return;
            target.takeDamage(CONFIG.buffs.ramDamage, this.mesh.position, CONFIG.buffs.ramKnockback);
            if (target.addStagger) target.addStagger(CONFIG.buffs.ramStagger, this.mesh.position);
            this.buffSystem.onEffectiveDamage(CONFIG.buffs.ramDamage);
            this.lastRamHit.set(target, 0.8);
        };
        if (state.enemyManager) {
            state.enemyManager.enemies.forEach(e => {
                if (!e.isDead) applyRam(e);
            });
        }
        // PVP：高速衝撞也對其他三頭龍生效
        state.dragons.forEach(d => {
            if (d && d !== this && !d.isDead) applyRam(d);
        });
    }

    spawnRamShockwave() {
        const forward = this.getForwardVector().normalize();
        const pos = this.mesh.position.clone().add(forward.clone().multiplyScalar(2.2));
        pos.y = 0.55;
        const geo = new THREE.TorusGeometry(1.25, 0.055, 6, 36, Math.PI);
        const mat = new THREE.MeshBasicMaterial({ color: 0x9ef7ff, transparent: true, opacity: 0.55, side: THREE.DoubleSide });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.copy(pos);
        mesh.rotation.x = Math.PI / 2;
        mesh.rotation.z = -this.mesh.rotation.y + Math.PI / 2;
        scene.add(mesh);
        state.particles.push({
            life: 0.22,
            maxLife: 0.22,
            update(dt) {
                this.life -= dt;
                const t = 1 - this.life / this.maxLife;
                mesh.position.add(forward.clone().multiplyScalar(dt * 4.5));
                mesh.scale.setScalar(1 + t * 0.8);
                mesh.material.opacity = Math.max(0, 0.55 * (1 - t));
                if (this.life <= 0) {
                    scene.remove(mesh);
                    mesh.geometry.dispose();
                    mesh.material.dispose();
                    return false;
                }
                return true;
            }
        });
    }

    _hideBeamFX() {
        this.beamMesh.visible = false;
        if (this.beamGlowMesh) this.beamGlowMesh.visible = false;
        if (this.beamImpactMesh) this.beamImpactMesh.visible = false;
        if (this.beamOriginLight) this.beamOriginLight.intensity = 0;
        if (this.beamImpactLight) this.beamImpactLight.intensity = 0;
        if (this.refractBeamSegments) {
            this.refractBeamSegments.forEach(seg => {
                seg.core.visible = false;
                seg.glow.visible = false;
            });
        }
    }

    _clearComboVines() {
        if (!this.comboVines) return;
        this.comboVines.forEach(v => v.destroy());
        this.comboVines = [];
    }

    _hideSpecialComboFX() {
        if (this.floraComboRing) {
            this.floraComboRing.visible = false;
            this.floraComboRing.material.opacity = 0;
        }
        if (this.pteroComboRing) {
            this.pteroComboRing.visible = false;
            this.pteroComboRing.material.opacity = 0;
        }
        if (this.pteroTimerRing) {
            this.pteroTimerRing.visible = false;
            this.pteroTimerRing.material.opacity = 0;
        }
        this._clearComboVines();
        if (this.rushWasHidden) {
            this.mesh.visible = true;
            this.rushWasHidden = false;
        }
        this.comboState = 'idle';
    }

    startChargedCombo() {
        this.activeComboForm = this.buffSystem && this.buffSystem.getComboForm
            ? this.buffSystem.getComboForm()
            : 'beam';
        if (this.activeComboForm === 'flora') {
            this.startFloraCombo();
            return;
        }
        if (this.activeComboForm === 'ptero') {
            this.startPteroCombo();
            return;
        }
        if (this.activeComboForm === 'rush') {
            this.startRushCombo();
            return;
        }

        if (this.activeComboForm !== 'refractBeam') this.activeComboForm = 'beam';
        this.beamPhase = 'prefire';
        this.beamPreFireTimer = CONFIG.beam.preFireDelay;
        this.beamChargeRing.position.copy(this.mesh.position);
    }

    startFloraCombo() {
        this.beamPhase = 'prefire';
        this.comboState = 'floraPrecast';
        this.comboTimer = CONFIG.combo.preCastDelay;
        this.comboDotTimer = 0;
        this.comboFxGroup.position.copy(this.mesh.position);
        this.comboFxGroup.position.y = 0.08;

        const r = CONFIG.combo.radius;
        this.floraComboRing.geometry.dispose();
        this.floraComboRing.geometry = new THREE.RingGeometry(r - 0.5, r, 64);
        this.floraComboRing.geometry.rotateX(-Math.PI / 2);
        this.floraComboRing.visible = true;
        this.floraComboRing.material.opacity = 0.5;
        this.floraComboRing.scale.setScalar(0.01);

        this._clearComboVines();
        for (let i = 0; i < CONFIG.combo.vineCount; i++) {
            const vine = new Vine(this.comboFxGroup, i, CONFIG.combo.vineCount, CONFIG.combo.radius);
            vine.setVisible(false);
            this.comboVines.push(vine);
        }
    }

    startPteroCombo() {
        this.beamPhase = 'prefire';
        this.comboState = 'pteroAim';
        this.comboTimer = CONFIG.combo.pteroPreCastDelay;
        this.comboTargetPos.copy(this.mesh.position);
        this.comboTargetPos.y = 0.1;
        this.pteroDropVelocity = 0;

        const r = CONFIG.combo.pteroRadius;
        this.pteroComboRing.geometry.dispose();
        this.pteroComboRing.geometry = new THREE.RingGeometry(r - 0.5, r, 48);
        this.pteroComboRing.geometry.rotateX(-Math.PI / 2);
        this.pteroComboRing.visible = true;
        this.pteroComboRing.position.copy(this.comboTargetPos);
        this.pteroComboRing.material.opacity = 0.95;
        this.pteroComboRing.scale.setScalar(1);

        this.pteroTimerRing.geometry.dispose();
        this.pteroTimerRing.geometry = new THREE.RingGeometry(r - 0.5, r, 48);
        this.pteroTimerRing.geometry.rotateX(-Math.PI / 2);
        this.pteroTimerRing.visible = true;
        this.pteroTimerRing.position.copy(this.comboTargetPos);
        this.pteroTimerRing.position.y = 0.16;
        this.pteroTimerRing.material.opacity = 0.75;
        this.pteroTimerRing.scale.setScalar(0.01);
    }

    startRushCombo() {
        this.beamPhase = 'firing';
        this.comboState = 'rushDash';
        this.comboTimer = CONFIG.combo.rushDuration;
        this.rushTarget = null;
        this.rushHitCount = 0;
        this.rushHitTimer = 0;
        this.rushWasHidden = false;
        this.beamCharge = CONFIG.beam.maxCharge;
        this.velocity.copy(this.getForwardVector().normalize().multiplyScalar(CONFIG.movement.maxSpeed * CONFIG.combo.rushSpeedMultiplier));
    }

    beginSpecialComboPostfire() {
        if (this.rushWasHidden) {
            this.mesh.visible = true;
            this.rushWasHidden = false;
        }
        this.beamCharge = 0;
        this.beamPhase = 'postfire';
        this.beamPostFireTimer = CONFIG.beam.postFireDelay;
        this.comboCooldown = this.comboCooldownMax;
        this.rushTarget = null;
        this._hideSpecialComboFX();
    }

    applyComboAreaDamage(center, radius, damage, color, knockback, stagger = 70) {
        const baseKnockback = (knockback === undefined) ? CONFIG.combo.defaultAreaKnockback : knockback;
        knockback = baseKnockback * this.buffSystem.getKnockbackMultiplier();
        const origin = center.clone();
        origin.y = 0.1;
        if (state.enemyManager) {
            state.enemyManager.enemies.forEach(e => {
                if (e.isDead) return;
                const dx = e.mesh.position.x - origin.x;
                const dz = e.mesh.position.z - origin.z;
                const dist = Math.sqrt(dx * dx + dz * dz);
                if (dist > radius + 1.0) return;
                e.takeDamage(damage, origin, knockback);
                if (e.addStagger) e.addStagger(stagger, origin);
                this.buffSystem.onEffectiveDamage(damage);
            });
        }
        state.dragons.forEach(d => {
            if (!d || d === this || d.isDead) return;
            const hit = d.intersectsHitCircle
                ? d.intersectsHitCircle(origin, radius)
                : d.mesh.position.distanceTo(origin) <= radius + 1.2;
            if (!hit) return;
            d.takeDamage(damage, origin, knockback);
            if (d.addStagger) d.addStagger(stagger, origin);
            this.buffSystem.onEffectiveDamage(damage);
        });
        if (state.levelManager && state.levelManager.blocks) {
            state.levelManager.blocks.forEach(block => {
                if (block.isDead || !block.solid) return;
                const dx = block.mesh.position.x - origin.x;
                const dz = block.mesh.position.z - origin.z;
                const dist = Math.sqrt(dx * dx + dz * dz);
                if (dist > radius + 2.5) return;
                const didDamage = state.levelManager.damageBlock(block, damage, this);
                if (didDamage) this.buffSystem.onEffectiveDamage(damage);
            });
        }
    }

    spawnPteroImpactFX(center, radius) {
        const waveGeo = new THREE.RingGeometry(0.5, radius, 48);
        waveGeo.rotateX(-Math.PI / 2);
        const wave = new THREE.Mesh(waveGeo, new THREE.MeshBasicMaterial({
            color: 0xffaa00,
            transparent: true,
            opacity: 0.85,
            side: THREE.DoubleSide,
            depthWrite: false
        }));
        wave.position.copy(center);
        wave.position.y = 0.1;
        scene.add(wave);
        state.particles.push({
            mesh: wave,
            life: 0.55,
            maxLife: 0.55,
            update(dt) {
                this.life -= dt;
                const t = 1 - this.life / this.maxLife;
                this.mesh.material.opacity = Math.max(0, 0.85 * (1 - t));
                this.mesh.scale.setScalar(1 + t * 1.7);
                if (this.life <= 0) {
                    scene.remove(this.mesh);
                    this.mesh.geometry.dispose();
                    this.mesh.material.dispose();
                    return false;
                }
                return true;
            }
        });

        for (let i = 0; i < 28; i++) {
            const pPos = center.clone().add(new THREE.Vector3((Math.random() - 0.5) * radius, 0.4 + Math.random() * 0.8, (Math.random() - 0.5) * radius));
            state.particles.push(new Particle(pPos, 0xffaa00));
        }
    }

    spawnRushShockwave() {
        const forward = this.getForwardVector().normalize();
        const pos = this.mesh.position.clone().add(forward.clone().multiplyScalar(2.2));
        pos.y = 0.7;
        const geo = new THREE.TorusGeometry(1.0, 0.045, 6, 28, Math.PI);
        const mat = new THREE.MeshBasicMaterial({
            color: 0x9ef7ff,
            transparent: true,
            opacity: 0.62,
            side: THREE.DoubleSide,
            depthWrite: false
        });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.copy(pos);
        mesh.rotation.x = Math.PI / 2;
        mesh.rotation.z = -this.mesh.rotation.y;
        scene.add(mesh);
        state.particles.push({
            life: 0.18,
            maxLife: 0.18,
            update(dt) {
                this.life -= dt;
                const t = 1 - this.life / this.maxLife;
                mesh.position.add(forward.clone().multiplyScalar(dt * 8));
                mesh.scale.setScalar(1 + t * 1.2);
                mesh.material.opacity = Math.max(0, 0.62 * (1 - t));
                if (this.life <= 0) {
                    scene.remove(mesh);
                    mesh.geometry.dispose();
                    mesh.material.dispose();
                    return false;
                }
                return true;
            }
        });
    }

    findRushComboTarget() {
        const forward = this.getForwardVector().normalize();
        const center = this.mesh.position.clone().add(forward.clone().multiplyScalar(CONFIG.combo.rushHitRadius));
        let best = null;
        let bestDist = Infinity;
        const consider = (target) => {
            if (!target || target.isDead) return;
            const hit = target.intersectsHitCircle
                ? target.intersectsHitCircle(center, CONFIG.combo.rushHitRadius)
                : target.mesh.position.distanceTo(center) <= CONFIG.combo.rushHitRadius + 1.0;
            if (!hit) return;
            const dist = target.mesh.position.distanceTo(this.mesh.position);
            if (dist < bestDist) {
                best = target;
                bestDist = dist;
            }
        };
        if (state.enemyManager) state.enemyManager.enemies.forEach(consider);
        state.dragons.forEach(d => {
            if (d && d !== this) consider(d);
        });
        return best;
    }

    startRushBarrage(target) {
        this.rushTarget = target;
        this.comboState = 'rushBarrage';
        this.comboTimer = CONFIG.combo.rushBarrageDuration;
        this.rushHitCount = 0;
        this.rushHitTimer = 0;
        this.rushWasHidden = true;
        this.mesh.visible = false;
        this.velocity.set(0, 0, 0);
    }

    updateRushBarrage(dt) {
        if (!this.rushTarget || this.rushTarget.isDead) {
            this.beginSpecialComboPostfire();
            return;
        }

        this.comboTimer -= dt;
        if (this.rushTarget.applySlow) this.rushTarget.applySlow(0.05, 0.2);
        if (this.rushTarget.velocity) this.rushTarget.velocity.set(0, 0, 0);
        if (this.rushTarget.knockbackVel) this.rushTarget.knockbackVel.set(0, 0, 0);
        const hitInterval = CONFIG.combo.rushBarrageDuration / Math.max(1, CONFIG.combo.rushBarrageHits);
        this.rushHitTimer -= dt;
        while (this.rushHitTimer <= 0 && this.rushHitCount < CONFIG.combo.rushBarrageHits) {
            this.rushHitTimer += hitInterval;
            this.rushHitCount += 1;
            const targetPos = this.rushTarget.mesh.position.clone();
            const offsets = [
                new THREE.Vector3(0, 2.8, 0),
                new THREE.Vector3(2.8, 1.1, 0),
                new THREE.Vector3(-2.8, 1.1, 0),
                new THREE.Vector3(0, 1.1, 2.8),
                new THREE.Vector3(0, 1.1, -2.8)
            ];
            const from = targetPos.clone().add(offsets[this.rushHitCount % offsets.length]);
            from.y = Math.max(0.6, from.y);
            this.spawnRushAfterimageSlash(from, targetPos);
            const damage = CONFIG.combo.rushBarrageDamage * this.buffSystem.getComboDamageMultiplier();
            this.rushTarget.takeDamage(damage, from, CONFIG.combo.rushKnockback);
            if (this.rushTarget.addStagger) this.rushTarget.addStagger(35, from);
            this.buffSystem.onEffectiveDamage(damage);
        }

        if (this.comboTimer <= 0 || this.rushHitCount >= CONFIG.combo.rushBarrageHits) {
            const back = this.rushTarget.mesh.position.clone().sub(this.getForwardVector().normalize().multiplyScalar(2.2));
            back.y = 0;
            this.mesh.position.copy(back);
            this.beginSpecialComboPostfire();
        }
    }

    spawnRushAfterimageSlash(from, to) {
        const dir = to.clone().sub(from).normalize();
        const geo = new THREE.BoxGeometry(0.18, 0.18, 2.8);
        const mat = new THREE.MeshBasicMaterial({
            color: 0xdfffff,
            transparent: true,
            opacity: 0.85,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.copy(from);
        mesh.lookAt(to);
        scene.add(mesh);
        state.particles.push({
            life: 0.12,
            maxLife: 0.12,
            update(dt) {
                this.life -= dt;
                mesh.position.add(dir.clone().multiplyScalar(dt * 40));
                mesh.material.opacity = Math.max(0, 0.85 * (this.life / this.maxLife));
                if (this.life <= 0) {
                    scene.remove(mesh);
                    mesh.geometry.dispose();
                    mesh.material.dispose();
                    return false;
                }
                return true;
            }
        });
        const p = new Particle(to.clone().add(new THREE.Vector3(0, 1.2, 0)), 0x9ef7ff);
        p.life = 0.25;
        p.maxLife = 0.25;
        p.mesh.scale.setScalar(0.75);
        state.particles.push(p);
    }

    updateActiveCombo(dt) {
        if (this.activeComboForm === 'flora') {
            this.updateFloraCombo(dt);
            return;
        }
        if (this.activeComboForm === 'ptero') {
            this.updatePteroCombo(dt);
            return;
        }
        if (this.activeComboForm === 'rush') {
            this.updateRushCombo(dt);
            return;
        }
        if (this.activeComboForm === 'refractBeam') {
            this.updateRefractBeam(dt);
            return;
        }
        this.updateBeam(dt);
    }

    updateSpecialPostfire(dt) {
        this.beamCharge = Math.max(0, this.beamCharge - CONFIG.beam.decayRate * dt);
        this.beamPostFireTimer -= dt;
        if (this.beamPostFireTimer <= 0) {
            this.beamPhase = 'idle';
            this.activeComboForm = 'beam';
        }
    }

    updateFloraCombo(dt) {
        if (this.beamPhase === 'postfire') {
            this.updateSpecialPostfire(dt);
            return;
        }

        this.comboFxGroup.position.copy(this.mesh.position);
        this.comboFxGroup.position.y = 0.08;

        if (this.beamPhase === 'prefire') {
            this.comboTimer -= dt;
            const progress = THREE.MathUtils.clamp(1 - this.comboTimer / CONFIG.combo.preCastDelay, 0, 1);
            this.floraComboRing.scale.setScalar(Math.max(0.01, progress));
            this.floraComboRing.material.opacity = 0.45 + Math.sin(progress * 20) * 0.2;
            if (this.comboTimer <= 0) {
                this.beamPhase = 'firing';
                this.comboState = 'floraActive';
                this.comboTimer = CONFIG.combo.activeDuration;
                this.comboDotTimer = 0;
                this.floraComboRing.scale.setScalar(1);
                this.floraComboRing.material.opacity = 0.8;
                this.comboVines.forEach(v => v.setVisible(true));
            }
            return;
        }

        if (this.beamPhase !== 'firing') return;
        this.comboTimer -= dt;
        this.comboVines.forEach(v => v.update(dt, true));
        const pulse = 0.9 + Math.sin(Date.now() * 0.006) * 0.08;
        this.floraComboRing.scale.setScalar(pulse);
        this.floraComboRing.material.opacity = 0.68 + Math.sin(Date.now() * 0.01) * 0.12;

        this.comboDotTimer += dt;
        if (this.comboDotTimer >= CONFIG.combo.dotInterval) {
            this.comboDotTimer = 0;
            const damage = CONFIG.combo.dotDamage * this.buffSystem.getComboDamageMultiplier();
            this.applyComboAreaDamage(this.mesh.position, CONFIG.combo.radius, damage, 0x88ff66, 8, 20);
        }

        if (this.comboTimer <= 0) this.beginSpecialComboPostfire();
    }

    updatePteroCombo(dt) {
        if (this.beamPhase === 'postfire') {
            this.updateSpecialPostfire(dt);
            return;
        }

        if (this.beamPhase === 'prefire') {
            this.comboTimer -= dt;
            let moveVec = new THREE.Vector3();
            ['p1', 'p2', 'p3', 'p4'].forEach(p => {
                const inp = this.input[p].move;
                if (!inp) return;
                moveVec.x += inp.x;
                moveVec.z += inp.y;
            });
            if (moveVec.lengthSq() > 0.01) {
                moveVec.normalize().multiplyScalar(CONFIG.combo.pteroAimSpeed * dt);
                this.comboTargetPos.add(moveVec);
            }
            if (state.levelManager && state.levelManager.clampPositionToArena) {
                state.levelManager.clampPositionToArena(this.comboTargetPos, CONFIG.level.playerBoundaryPadding);
            }
            this.comboTargetPos.y = 0.1;
            this.pteroComboRing.position.copy(this.comboTargetPos);
            this.pteroTimerRing.position.copy(this.comboTargetPos);
            this.pteroTimerRing.position.y = 0.16;
            const progress = THREE.MathUtils.clamp(1 - this.comboTimer / CONFIG.combo.pteroPreCastDelay, 0, 1);
            this.pteroTimerRing.scale.setScalar(Math.max(0.01, progress));
            this.pteroComboRing.scale.setScalar(1 + Math.sin(Date.now() * 0.009) * 0.08);
            if (this.comboTimer <= 0) {
                this.beamPhase = 'firing';
                this.comboState = 'pteroFly';
                this.comboTimer = Math.max(0.2, CONFIG.combo.pteroFlyHeight / CONFIG.combo.pteroFlySpeed);
                this.pteroDropVelocity = 0;
            }
            return;
        }

        if (this.beamPhase !== 'firing') return;

        if (this.comboState === 'pteroFly') {
            this.comboTimer -= dt;
            this.mesh.position.y = Math.min(CONFIG.combo.pteroFlyHeight, this.mesh.position.y + CONFIG.combo.pteroFlySpeed * dt);
            this.pteroComboRing.material.opacity = 0.55 + Math.sin(Date.now() * 0.015) * 0.2;
            if (this.comboTimer <= 0) {
                this.comboState = 'pteroDrop';
                this.mesh.position.x = this.comboTargetPos.x;
                this.mesh.position.z = this.comboTargetPos.z;
                this.mesh.position.y = CONFIG.combo.pteroFlyHeight;
                this.pteroDropVelocity = 0;
            }
            return;
        }

        if (this.comboState === 'pteroDrop') {
            this.pteroDropVelocity += CONFIG.combo.pteroDropSpeed * dt;
            this.mesh.position.y -= this.pteroDropVelocity * dt;
            if (this.mesh.position.y > 0) return;
            this.mesh.position.y = 0;
            const damage = CONFIG.combo.pteroDamage * this.buffSystem.getComboDamageMultiplier();
            this.spawnPteroImpactFX(this.mesh.position.clone(), CONFIG.combo.pteroRadius);
            this.applyComboAreaDamage(this.mesh.position, CONFIG.combo.pteroRadius, damage, 0xffaa00, 45, 120);
            this.pulseScale = 1.35;
            this.beginSpecialComboPostfire();
        }
    }

    updateRushCombo(dt) {
        if (this.beamPhase === 'postfire') {
            this.updateSpecialPostfire(dt);
            return;
        }
        if (this.beamPhase !== 'firing') return;

        if (this.comboState === 'rushBarrage') {
            this.updateRushBarrage(dt);
            return;
        }

        this.comboTimer -= dt;
        const forward = this.getForwardVector().normalize();
        this.velocity.copy(forward.multiplyScalar(CONFIG.movement.maxSpeed * CONFIG.combo.rushSpeedMultiplier));

        this.ramShockwaveFxTimer -= dt;
        if (this.ramShockwaveFxTimer <= 0) {
            this.ramShockwaveFxTimer = 0.055;
            this.spawnRushShockwave();
        }

        const target = this.findRushComboTarget();
        if (target) {
            this.startRushBarrage(target);
            return;
        }
        if (this.comboTimer <= 0) this.beginSpecialComboPostfire();
    }

    _ensureRefractBeamSegments(count) {
        if (!this.refractBeamSegments) this.refractBeamSegments = [];
        while (this.refractBeamSegments.length < count) {
            const geo = new THREE.CylinderGeometry(1, 1, 1, 10);
            geo.rotateX(Math.PI / 2);
            geo.translate(0, 0, 0.5);
            const core = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
                color: 0xffffff,
                transparent: true,
                opacity: 0,
                depthWrite: false
            }));
            const glow = new THREE.Mesh(geo.clone(), new THREE.MeshBasicMaterial({
                color: this.colors.beam,
                transparent: true,
                opacity: 0,
                blending: THREE.AdditiveBlending,
                depthWrite: false
            }));
            core.visible = false;
            glow.visible = false;
            scene.add(glow);
            scene.add(core);
            this.refractBeamSegments.push({ core, glow });
        }
        this.refractBeamSegments.forEach((seg, i) => {
            const active = i < count;
            seg.core.visible = active;
            seg.glow.visible = active;
        });
    }

    _setRefractBeamSegment(seg, start, end, width, opacity) {
        const dir = end.clone().sub(start);
        const len = Math.max(0.01, dir.length());
        dir.normalize();
        const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir);
        seg.core.position.copy(start);
        seg.core.quaternion.copy(q);
        seg.core.scale.set(width, width, len);
        seg.core.material.opacity = opacity;
        seg.glow.position.copy(start);
        seg.glow.quaternion.copy(q);
        seg.glow.scale.set(width * 2.6, width * 2.6, len);
        seg.glow.material.opacity = 0.26 + Math.sin(Date.now() * 0.014) * 0.08;
    }

    _distancePointToSegment(point, a, b) {
        const ab = b.clone().sub(a);
        const denom = Math.max(0.0001, ab.lengthSq());
        const t = THREE.MathUtils.clamp(point.clone().sub(a).dot(ab) / denom, 0, 1);
        const closest = a.clone().add(ab.multiplyScalar(t));
        return point.distanceTo(closest);
    }

    _isPointNearRefractPath(point, radius, points) {
        for (let i = 0; i < points.length - 1; i++) {
            if (this._distancePointToSegment(point, points[i], points[i + 1]) <= radius) return true;
        }
        return false;
    }

    _findRefractBeamTarget(origin, forward, range) {
        let best = null;
        let bestScore = Infinity;
        const consider = (target) => {
            if (!target || target.isDead || !target.mesh) return;
            const toTarget = target.mesh.position.clone().sub(origin);
            const dist = toTarget.length();
            if (dist <= 0.01 || dist > range) return;
            const dot = toTarget.clone().normalize().dot(forward);
            if (dot < -0.12) return;
            const score = dist - dot * 10;
            if (score < bestScore) {
                best = target;
                bestScore = score;
            }
        };
        if (state.enemyManager) state.enemyManager.enemies.forEach(consider);
        state.dragons.forEach(d => {
            if (d && d !== this) consider(d);
        });
        return best;
    }

    _buildRefractBeamPath(origin, forward, range, target) {
        const count = Math.max(2, CONFIG.combo.refractBeamSegments);
        const points = [origin.clone()];
        const step = range / count;
        let dir = forward.clone().normalize();
        let current = origin.clone();
        const targetPos = target && target.mesh ? target.mesh.position.clone() : null;
        if (targetPos) targetPos.y = 1.2;
        for (let i = 1; i <= count; i++) {
            if (targetPos) {
                const desired = targetPos.clone().sub(current);
                if (desired.lengthSq() > 0.01) {
                    dir.lerp(desired.normalize(), CONFIG.combo.refractBeamTurnStrength).normalize();
                }
            }
            const side = new THREE.Vector3(dir.z, 0, -dir.x).normalize();
            const wobble = Math.sin(Date.now() * 0.006 + i * 1.7) * 0.08 * i;
            current = current.clone().add(dir.clone().multiplyScalar(step)).add(side.multiplyScalar(wobble));
            points.push(current.clone());
        }
        return points;
    }

    updateRefractBeam(dt) {
        const beamCfg = CONFIG.beam;
        const maxCharge = beamCfg.maxCharge;
        const beamWidth = beamCfg.width * 0.92;
        const range = beamCfg.range * CONFIG.combo.refractBeamRangeMultiplier;
        const now = Date.now();

        if (this.beamPhase === 'prefire') {
            this.beamCharge = maxCharge;
            this.beamPreFireTimer -= dt;
            const progress = 1.0 - (this.beamPreFireTimer / beamCfg.preFireDelay);
            this.beamChargeRing.position.copy(this.mesh.position);
            this.beamChargeRing.position.y = 0.2;
            this.beamChargeRing.material.opacity = 0.55 + Math.sin(progress * 46) * 0.45;
            this.beamChargeRing.scale.setScalar(0.9 + progress * 1.7);
            if (this.beamPreFireTimer <= 0) {
                this.beamPhase = 'firing';
                this.beamFiringTimer = beamCfg.firingDuration;
                this.beamDotTimer = 0;
                this.beamChargeRing.material.opacity = 0;
                this.beamImpactMesh.visible = true;
            }
            return;
        }

        if (this.beamPhase === 'postfire') {
            this.updateSpecialPostfire(dt);
            return;
        }

        if (this.beamPhase !== 'firing') return;
        this.beamFiringTimer -= dt;
        if (this.beamFiringTimer <= 0) {
            this.beginSpecialComboPostfire();
            this._hideBeamFX();
            return;
        }

        this.beamMesh.visible = false;
        if (this.beamGlowMesh) this.beamGlowMesh.visible = false;
        const forward = this.getForwardVector().normalize();
        const origin = this.mesh.position.clone();
        origin.y = 1.0;
        const target = this._findRefractBeamTarget(origin, forward, range);
        const points = this._buildRefractBeamPath(origin, forward, range, target);
        this._ensureRefractBeamSegments(points.length - 1);
        const pulse = 0.78 + Math.sin(now * 0.024) * 0.18;
        for (let i = 0; i < points.length - 1; i++) {
            this._setRefractBeamSegment(this.refractBeamSegments[i], points[i], points[i + 1], beamWidth, pulse);
        }

        const impactPos = points[points.length - 1];
        if (this.beamImpactMesh) {
            this.beamImpactMesh.position.copy(impactPos);
            this.beamImpactMesh.scale.setScalar(beamWidth * (2.1 + Math.sin(now * 0.025) * 0.7));
            this.beamImpactMesh.material.opacity = 0.68 + Math.sin(now * 0.035) * 0.32;
        }
        if (this.beamOriginLight) {
            this.beamOriginLight.position.copy(origin);
            this.beamOriginLight.intensity = 2.8 + Math.sin(now * 0.02) * 0.9;
        }
        if (this.beamImpactLight) {
            this.beamImpactLight.position.copy(impactPos);
            this.beamImpactLight.intensity = 3.8 + Math.sin(now * 0.028) * 1.6;
        }

        this.beamDotTimer += dt;
        if (this.beamDotTimer < beamCfg.tickInterval) return;
        this.beamDotTimer = 0;
        const damage = beamCfg.damagePerTick * beamCfg.damageScale * this.buffSystem.getComboDamageMultiplier();
        const hitRadius = beamWidth + 0.25;
        if (state.enemyManager) {
            state.enemyManager.enemies.forEach(e => {
                if (e.isDead) return;
                if (!this._isPointNearRefractPath(e.mesh.position, hitRadius + 1.2, points)) return;
                e.takeDamage(damage, origin, CONFIG.beam.tickKnockback);
                if (e.addStagger) e.addStagger(damage * CONFIG.combo.refractBeamStaggerBonusPct, origin);
                if (this.buffSystem.isActive('beamSlow') && e.applySlow) {
                    e.applySlow(CONFIG.buffs.beamSlowFactor, CONFIG.buffs.beamSlowDuration);
                }
                this.buffSystem.onEffectiveDamage(damage);
            });
        }
        state.dragons.forEach(d => {
            if (!d || d === this || d.isDead) return;
            const hit = d.getHitSpheres
                ? d.getHitSpheres(CONFIG.hitbox.beamPadding).some(s => this._isPointNearRefractPath(s.pos, hitRadius + s.radius, points))
                : this._isPointNearRefractPath(d.mesh.position, hitRadius + 1.2, points);
            if (!hit) return;
            d.takeDamage(damage, origin, CONFIG.beam.tickKnockback);
            if (d.addStagger) d.addStagger(damage * CONFIG.combo.refractBeamStaggerBonusPct, origin);
            if (this.buffSystem.isActive('beamSlow') && d.applySlow) {
                d.applySlow(CONFIG.buffs.beamSlowFactor, CONFIG.buffs.beamSlowDuration);
            }
            this.buffSystem.onEffectiveDamage(damage);
        });
        if (state.levelManager) {
            state.levelManager.blocks.forEach(b => {
                if (b.isDead || !b.solid) return;
                if (!this._isPointNearRefractPath(b.mesh.position, hitRadius + 2.0, points)) return;
                if (state.levelManager.damageBlock(b, damage, this)) this.buffSystem.onEffectiveDamage(damage);
            });
        }
    }

    updateBeam(dt) {
        const beamCfg = CONFIG.beam;
        const maxCharge = beamCfg.maxCharge;
        const beamWidth = beamCfg.width;
        const now = Date.now();

        if (this.beamPhase === 'prefire') {
            this.beamCharge = maxCharge;
            this.beamPreFireTimer -= dt;
            const progress = 1.0 - (this.beamPreFireTimer / beamCfg.preFireDelay);
            this.beamChargeRing.position.copy(this.mesh.position);
            this.beamChargeRing.position.y = 0.2;
            const flicker = 0.5 + Math.sin(progress * 40) * 0.5;
            this.beamChargeRing.material.opacity = flicker;
            this.beamChargeRing.scale.setScalar(0.8 + progress * 1.5);

            if (this.beamPreFireTimer <= 0) {
                this.beamPhase = 'firing';
                this.beamFiringTimer = beamCfg.firingDuration;
                this.beamDotTimer = 0;
                this.beamChargeRing.material.opacity = 0;
                this.beamMesh.visible = true;
                if (this.beamGlowMesh) this.beamGlowMesh.visible = true;
                if (this.beamImpactMesh) this.beamImpactMesh.visible = true;
            }
        }
        else if (this.beamPhase === 'firing') {
            this.beamFiringTimer -= dt;
            if (this.beamFiringTimer <= 0) {
                this.beamCharge = 0;
                this.beamPhase = 'postfire';
                this.beamPostFireTimer = beamCfg.postFireDelay;
                // Phase 1: 啟動合體技 CD
                this.comboCooldown = this.comboCooldownMax;
                this._hideBeamFX();
                return;
            }

            const forward = this.getForwardVector().normalize();
            const origin = this.mesh.position.clone();
            origin.y = 1.0;

            const hitRadius = beamWidth;
            let beamLength = beamCfg.range;

            if (state.enemyManager) {
                state.enemyManager.enemies.forEach(e => {
                    if (e.isDead) return;
                    const toE = e.mesh.position.clone().sub(origin);
                    const along = toE.dot(forward);
                    if (along < 0 || along > beamLength) return;
                    const perp = toE.clone().sub(forward.clone().multiplyScalar(along));
                    if (perp.length() < 1.2 + hitRadius) beamLength = Math.min(beamLength, along);
                });
            }
            // PVP：其他三頭龍會擋光束 (但不擋自己)
            state.dragons.forEach(d => {
                if (!d || d === this || d.isDead) return;
                const along = d.intersectsHitRay
                    ? d.intersectsHitRay(origin, forward, beamLength, hitRadius)
                    : Infinity;
                if (along < Infinity) beamLength = Math.min(beamLength, along);
            });
            if (state.levelManager) {
                state.levelManager.blocks.forEach(b => {
                    if (b.isDead) return;
                    if (!b.solid) return;
                    const toB = b.mesh.position.clone().sub(origin);
                    const along = toB.dot(forward);
                    if (along < 0 || along > beamLength) return;
                    const perp = toB.clone().sub(forward.clone().multiplyScalar(along));
                    const hw = (b.mesh.geometry.parameters.width || 2) / 2 + hitRadius;
                    const hd = (b.mesh.geometry.parameters.depth || 2) / 2 + hitRadius;
                    if (Math.abs(perp.x) < hw && Math.abs(perp.z) < hd) beamLength = Math.min(beamLength, along);
                });
            }

            this.beamMesh.position.copy(origin);
            this.beamMesh.quaternion.copy(this.mesh.quaternion);
            this.beamMesh.scale.set(beamWidth, beamWidth, beamLength);

            const glowW = beamWidth * 2.5;
            if (this.beamGlowMesh) {
                this.beamGlowMesh.position.copy(origin);
                this.beamGlowMesh.quaternion.copy(this.mesh.quaternion);
                this.beamGlowMesh.scale.set(glowW, glowW, beamLength);
            }

            const impactPos = origin.clone().add(forward.clone().multiplyScalar(beamLength));
            if (this.beamImpactMesh) {
                this.beamImpactMesh.position.copy(impactPos);
                const impactSize = beamWidth * (1.8 + Math.sin(now * 0.025) * 0.7);
                this.beamImpactMesh.scale.setScalar(impactSize);
            }

            const pulse = 0.8 + Math.sin(now * 0.022) * 0.2;
            this.beamMesh.material.opacity = pulse;
            if (this.beamGlowMesh) this.beamGlowMesh.material.opacity = 0.22 + Math.sin(now * 0.013) * 0.08;
            if (this.beamImpactMesh) this.beamImpactMesh.material.opacity = 0.65 + Math.sin(now * 0.035) * 0.35;

            if (this.beamOriginLight) {
                this.beamOriginLight.position.copy(origin);
                this.beamOriginLight.intensity = 2.5 + Math.sin(now * 0.02) * 0.8;
            }
            if (this.beamImpactLight) {
                this.beamImpactLight.position.copy(impactPos);
                this.beamImpactLight.intensity = 3.5 + Math.sin(now * 0.028) * 1.5;
            }

            this.beamDotTimer += dt;
            if (this.beamDotTimer >= beamCfg.tickInterval) {
                this.beamDotTimer = 0;
                const damage = beamCfg.damagePerTick * beamCfg.damageScale * this.buffSystem.getComboDamageMultiplier();

                if (state.enemyManager) {
                    state.enemyManager.enemies.forEach(e => {
                        if (e.isDead) return;
                        const toE = e.mesh.position.clone().sub(origin);
                        const along = toE.dot(forward);
                        if (along < 0 || along > beamLength + 1.2) return;
                        const perp = toE.clone().sub(forward.clone().multiplyScalar(along));
                        if (perp.length() < 1.2 + hitRadius) {
                            e.takeDamage(damage, origin, CONFIG.beam.tickKnockback);
                            if (this.buffSystem.isActive('beamSlow') && e.applySlow) {
                                e.applySlow(CONFIG.buffs.beamSlowFactor, CONFIG.buffs.beamSlowDuration);
                            }
                            this.buffSystem.onEffectiveDamage(damage);
                        }
                    });
                }
                // PVP：光束 tick 也對其他龍生效
                state.dragons.forEach(d => {
                    if (!d || d === this || d.isDead) return;
                    const along = d.intersectsHitRay
                        ? d.intersectsHitRay(origin, forward, beamLength + 1.2, hitRadius)
                        : Infinity;
                    if (along < Infinity) {
                        d.takeDamage(damage, origin, CONFIG.beam.tickKnockback);
                        if (this.buffSystem.isActive('beamSlow') && d.applySlow) {
                            d.applySlow(CONFIG.buffs.beamSlowFactor, CONFIG.buffs.beamSlowDuration);
                        }
                        this.buffSystem.onEffectiveDamage(damage);
                    }
                });
                if (state.levelManager) {
                    state.levelManager.blocks.forEach(b => {
                        if (b.isDead) return;
                        if (!b.solid) return;
                        const toB = b.mesh.position.clone().sub(origin);
                        const along = toB.dot(forward);
                        if (along < 0 || along > beamLength + 1.0) return;
                        const perp = toB.clone().sub(forward.clone().multiplyScalar(along));
                        const hw = (b.mesh.geometry.parameters.width || 2) / 2 + hitRadius;
                        const hd = (b.mesh.geometry.parameters.depth || 2) / 2 + hitRadius;
                        if (Math.abs(perp.x) < hw && Math.abs(perp.z) < hd) {
                            if (state.levelManager.damageBlock(b, damage, this)) this.buffSystem.onEffectiveDamage(damage);
                        }
                    });
                }
            }
        }
        else if (this.beamPhase === 'postfire') {
            // Phase 1 修正: 後搖期間不再允許再蓄力 (避免「放開時跳到 0%」的視覺異常)
            // 統一在 idle 階段處理蓄力與衰減，後搖只負責倒數計時與衰減顯示
            this.beamCharge = Math.max(0, this.beamCharge - beamCfg.decayRate * dt);

            this.beamPostFireTimer -= dt;
            if (this.beamPostFireTimer <= 0) this.beamPhase = 'idle';
        }
    }

    update(dt) {
        const t = Date.now() * 0.002;
        this.updateDragon(dt);
        if (this.hpBar) {
            this.hpBar.update(this.mesh.position, this.hp, this.maxHP, this.staggerValue, CONFIG.stagger.playerThreshold);
            this.hpBar.setBuffIcons(this.buffSystem.getActiveIconEntries());
        }

        this.updateStagger(dt);
        if (this.comboRampTimer > 0) {
            this.comboRampTimer -= dt;
            if (this.comboRampTimer <= 0) this.comboRampStacks = 0;
        }
        if (this.velocity.lengthSq() < 0.05 && this.knockbackVel.lengthSq() < 0.05) this.stationaryTimer += dt;
        else this.stationaryTimer = 0;

        if (this.fallTimer > 0) {
            this.fallTimer -= dt;
            this.mesh.rotation.x = THREE.MathUtils.lerp(this.mesh.rotation.x, -0.9, dt * 8);
            this.velocity.multiplyScalar(Math.max(0, 1 - 12 * dt));
            this.knockbackVel.set(0, 0, 0);
            // 鏡頭跟隨改由 main.js 集中管理 (PVP 多龍模式需要中點跟隨)
            if (this.fallTimer <= 0) {
                this.fallTimer = 0;
                this.standUpTimer = CONFIG.stagger.playerStandUpDuration;
                this.standUpStartRotationX = this.mesh.rotation.x;
            }
            return;
        }

        if (this.standUpTimer > 0) {
            const duration = Math.max(0.001, CONFIG.stagger.playerStandUpDuration);
            this.standUpTimer = Math.max(0, this.standUpTimer - dt);
            const t = THREE.MathUtils.clamp(1 - this.standUpTimer / duration, 0, 1);
            const ease = t * t * (3 - 2 * t);
            this.mesh.rotation.x = THREE.MathUtils.lerp(this.standUpStartRotationX, 0, ease);
            this.velocity.multiplyScalar(Math.max(0, 1 - 10 * dt));
            this.knockbackVel.set(0, 0, 0);
            if (this.standUpTimer <= 0) {
                this.mesh.rotation.x = 0;
                if (this.buffSystem && this.buffSystem.onStandUpComplete) this.buffSystem.onStandUpComplete();
            }
            return;
        } else if (Math.abs(this.mesh.rotation.x) > 0.001) {
            this.mesh.rotation.x = THREE.MathUtils.lerp(this.mesh.rotation.x, 0, dt * 8);
        }

        if (this.damageFlashTimer > 0) {
            this.damageFlashTimer -= dt;
        }

        const players = ['p1', 'p2', 'p3', 'p4'];
        const beamCfg = CONFIG.beam;
        const maxCharge = beamCfg.maxCharge;
        const isBeamActive = (this.beamPhase !== 'idle');
        const isFloraComboActive = this.activeComboForm === 'flora' && this.beamPhase !== 'idle';
        const isRushComboActive = this.activeComboForm === 'rush' && this.beamPhase === 'firing';

        if (isBeamActive) {
            this.cancelAllMeleeForCombo();
            this.updateActiveCombo(dt);
            if (!isFloraComboActive && (this.beamPhase === 'prefire' || this.beamPhase === 'postfire')) return;
        }

        // Phase 1: Combo CD 倒數 (idle 階段)
        if (this.beamPhase === 'idle' && this.comboCooldown > 0) {
            this.comboCooldown = Math.max(0, this.comboCooldown - dt);
        }

        // 蓄力邏輯 (idle 階段)；CD 期間禁止蓄力，按住也只會緩慢衰減
        // 互斥：Melee 進行中的玩家不計入集氣；正在 tailCharging 的 P4 也不計入
        if (this.beamPhase === 'idle') {
            players.forEach(p => {
                if (this.input[p].charge) this.cancelMeleeForCombo(p);
            });
            const chargeCount = players.filter(p =>
                this.input[p].charge && !this.isPlayerMeleeBusy(p)
            ).length;
            const rates = beamCfg.chargeRates;
            const onCooldown = this.comboCooldown > 0;
            const rate = (chargeCount > 0 && !onCooldown)
                ? rates[Math.min(chargeCount, rates.length - 1)]
                : -beamCfg.decayRate;
            this.beamCharge = Math.min(maxCharge, Math.max(0, this.beamCharge + rate * dt));
        }

        if (this.beamPhase === 'idle' && this.beamCharge >= maxCharge && this.comboCooldown <= 0) {
            this.beamCharge = maxCharge;
            this.cancelAllMeleeForCombo();
            this.startChargedCombo();
            return;
        }

        // Cooldown
        players.forEach(p => {
            if (this.cooldowns[p] > 0) this.cooldowns[p] = Math.max(0, this.cooldowns[p] - dt);
        });

        // Attack input；互斥：集氣期間鎖定 Melee
        players.forEach(p => {
            const isDown = this.input[p].attack;
            const isPress = isDown && !this.lastAttackInput[p];
            const isRelease = !isDown && this.lastAttackInput[p];
            this.lastAttackInput[p] = isDown;
            if (isBeamActive) return;
            if (isRelease) this.releaseAttackPress(p);
            if (this.input[p].charge) return; // 集氣時忽略新的 Melee 按下
            if (isPress) this.startAttackPress(p);
        });

        // Visual: head/tail colors（含集氣發光）
        const chargeGlowRatio = this.beamCharge / maxCharge;
        players.forEach(p => {
            const headMap = { p1: this.p1HeadPart, p2: this.p2HeadPart, p3: this.p3HeadPart, p4: this.p4HeadPart };
            const baseMap = { p1: this.colors.p1, p2: this.colors.p2, p3: this.colors.p3, p4: this.colors.p4 };
            const head = headMap[p];
            if (!head) return;
            // 受傷閃爍最優先（修正：原本未覆蓋所有部位）
            if (this.damageFlashTimer > 0) {
                head.material.color.setHex(0xff2222);
                return;
            }
            // P4 尾巴蓄力已滿時閃爍金光
            if (p === 'p4' && this.attackStates.p4 === 'tailCharging' &&
                this.attackHoldTimers.p4 >= CONFIG.combat.tailChargeTime) {
                const flicker = 0.5 + 0.5 * Math.sin(t * 22);
                const brightCol = new THREE.Color(this.colors.p4).multiplyScalar(2.5 + flicker * 2);
                head.material.color.copy(brightCol);
                return;
            }
            // 集氣發光（按住集氣且正在貢獻蓄力時，發出光束色光）
            const isContributing = this.input[p].charge && !this.isPlayerMeleeBusy(p) &&
                                   this.beamPhase === 'idle' && this.comboCooldown <= 0 && chargeGlowRatio > 0;
            if (isContributing) {
                const flicker = 0.5 + 0.5 * Math.sin(t * 12 * (1 + chargeGlowRatio * 3));
                const beamCol = new THREE.Color(this.colors.beam);
                const baseCol = new THREE.Color(baseMap[p]);
                const blend = Math.min(1, chargeGlowRatio * 1.5) * (0.5 + 0.5 * flicker);
                head.material.color.lerpColors(baseCol, beamCol, blend);
                return;
            }
            // 冷卻暗色 / 正常色
            if (this.cooldowns[p] > 0) {
                const base = new THREE.Color(baseMap[p]);
                base.multiplyScalar(0.5);
                head.material.color.copy(base);
            } else {
                head.material.color.set(baseMap[p]);
            }
        });

        // Movement
        let totalInput = new THREE.Vector3();
        let totalRotationInput = new THREE.Vector3();
        const activeDirs = [];
        const tailSweepRotating = this.attackStates.p4 === 'tailSweep';

        players.forEach(p => {
            const moveInput = this.input[p].move;
            const hasInput = moveInput.lengthSq() > 0.01;
            const playerLocked = this.isPlayerMovementLocked(p);

            const arrowMap = { p1: this.p1Arrow, p2: this.p2Arrow, p3: this.p3Arrow, p4: this.p4Arrow };
            const arrow = arrowMap[p];

            if (hasInput && !playerLocked) {
                const inputVec = new THREE.Vector3(moveInput.x, 0, moveInput.y);
                const dir = inputVec.clone().normalize();
                if (!tailSweepRotating) totalRotationInput.add(inputVec);
                if (!isBeamActive || isFloraComboActive) {
                    totalInput.add(inputVec);
                    activeDirs.push(dir);
                }
                arrow.visible = true;
                arrow.position.copy(this.mesh.position);
                arrow.setDirection(dir);
            } else {
                arrow.visible = false;
            }
        });

        let speedMult = 1.0;
        if (activeDirs.length >= 2) {
            for (let i = 0; i < activeDirs.length; i++) {
                for (let j = i + 1; j < activeDirs.length; j++) {
                    const dot = activeDirs[i].dot(activeDirs[j]);
                    if (dot > 0.707) { speedMult = 1.5; break; }
                }
                if (speedMult > 1.0) break;
            }
        }
        if (this.buffSystem.isActive('teamworkRegen') && speedMult > 1.0) {
            this.heal(CONFIG.buffs.teamworkRegenPerSecond * dt);
            if (!this.teamworkRegenFxTimer || this.teamworkRegenFxTimer <= 0) {
                this.teamworkRegenFxTimer = 0.28;
                if (this.buffSystem && this.buffSystem._spawnHealCross) this.buffSystem._spawnHealCross(this);
            }
        }
        if (this.teamworkRegenFxTimer > 0) this.teamworkRegenFxTimer -= dt;
        if (this.slowTimer > 0) {
            this.slowTimer -= dt;
            if (this.slowTimer <= 0) this.slowFactor = 1.0;
        }

        // Rotation
        let turnPenalty = 1.0;
        if (totalRotationInput.lengthSq() > 0.01 && !this.isBursting) {
            const targetAngle = Math.atan2(totalRotationInput.x, totalRotationInput.z);
            const currentAngle = this.mesh.rotation.y;
            let deltaAngle = targetAngle - currentAngle;
            while (deltaAngle > Math.PI) deltaAngle -= Math.PI * 2;
            while (deltaAngle < -Math.PI) deltaAngle += Math.PI * 2;

            const rotSpeedMult = isRushComboActive
                ? CONFIG.combo.rushTurnMultiplier
                : ((this.beamPhase === 'firing' && !isFloraComboActive) ? 0.35 : 1.0);
            const teamworkTurnMult = speedMult > 1.0 ? speedMult : 1.0;
            const rotStep = CONFIG.movement.rotationSpeed * this.buffSystem.getTurnMultiplier() * rotSpeedMult * teamworkTurnMult * dt;
            if (Math.abs(deltaAngle) < rotStep) this.mesh.rotation.y = targetAngle;
            else this.mesh.rotation.y += Math.sign(deltaAngle) * rotStep;

            const absDelta = Math.abs(deltaAngle);
            const deg = absDelta * (180 / Math.PI);
            if (deg <= 30) turnPenalty = 1.0;
            else if (deg >= 180) turnPenalty = 0.5;
            else {
                const t = (deg - 30) / 150.0;
                turnPenalty = 1.0 - (t * 0.5);
            }
        }

        this.isBoosting = (speedMult > 1.0);
        this.updateSpeedLines(dt);

        const currentSpeed = this.velocity.length();
        const terrainSpeedFactor = state.levelManager ? state.levelManager.getSpeedFactor(this.mesh.position) : 1.0;
        const maxSpeed = CONFIG.movement.maxSpeed * this.buffSystem.getSpeedMultiplier() * terrainSpeedFactor * this.slowFactor * speedMult * turnPenalty;
        const forward = this.getForwardVector();
        const isInputting = totalInput.lengthSq() > 0.01;

        if (isRushComboActive) {
            // 爆衝組合技由 updateRushCombo 固定速度，這裡只讓位置積分繼續走。
        } else if (isBeamActive && !isFloraComboActive) {
            this.velocity.multiplyScalar(Math.max(0, 1 - 20 * dt));
        } else if (isInputting) {
            if (currentSpeed > 0.1) {
                const currentDir = this.velocity.clone().normalize();
                const traction = CONFIG.movement.traction * dt;
                currentDir.lerp(forward, traction).normalize();
                this.velocity.copy(currentDir.multiplyScalar(currentSpeed));
            }
            const accel = CONFIG.movement.acceleration * this.buffSystem.getSpeedMultiplier() * terrainSpeedFactor * this.slowFactor * dt;
            this.velocity.add(forward.multiplyScalar(accel));
            if (this.velocity.length() > maxSpeed) this.velocity.setLength(maxSpeed);
        } else {
            const friction = CONFIG.movement.friction * dt;
            const spd = this.velocity.length();
            if (spd > 0) {
                if (spd < friction) this.velocity.set(0, 0, 0);
                else this.velocity.multiplyScalar(1 - (friction / spd));
            }
        }

        this.mesh.position.add(this.velocity.clone().multiplyScalar(dt));

        if (this.knockbackVel.lengthSq() > 0.001) {
            this.mesh.position.add(this.knockbackVel.clone().multiplyScalar(dt));
            this.knockbackVel.multiplyScalar(0.9);
        }

        if (state.levelManager && state.levelManager.clampPositionToArena) {
            const clamped = state.levelManager.clampPositionToArena(this.mesh.position, CONFIG.level.playerBoundaryPadding);
            if (clamped.x) {
                this.velocity.x = 0;
                this.knockbackVel.x = 0;
            }
            if (clamped.z) {
                this.velocity.z = 0;
                this.knockbackVel.z = 0;
            }
        }

        // Player-Block Collision
        if (state.levelManager) {
            const pRadius = 0.8;
            const pPos = this.mesh.position;
            state.levelManager.blocks.forEach(b => {
                if (b.isDead) return;
                if (!b.solid) return;
                const width = b.mesh.geometry.parameters.width;
                const depth = b.mesh.geometry.parameters.depth;
                const minX = b.mesh.position.x - width / 2 - pRadius;
                const maxX = b.mesh.position.x + width / 2 + pRadius;
                const minZ = b.mesh.position.z - depth / 2 - pRadius;
                const maxZ = b.mesh.position.z + depth / 2 + pRadius;
                if (pPos.x > minX && pPos.x < maxX && pPos.z > minZ && pPos.z < maxZ) {
                    const clampX = Math.max(b.mesh.position.x - width / 2, Math.min(pPos.x, b.mesh.position.x + width / 2));
                    const clampZ = Math.max(b.mesh.position.z - depth / 2, Math.min(pPos.z, b.mesh.position.z + depth / 2));
                    const diffX = pPos.x - clampX;
                    const diffZ = pPos.z - clampZ;
                    const distSq = diffX * diffX + diffZ * diffZ;
                    if (distSq < pRadius * pRadius && distSq > 0.0001) {
                        const dist = Math.sqrt(distSq);
                        const pen = pRadius - dist;
                        const normalX = diffX / dist;
                        const normalZ = diffZ / dist;
                        this.mesh.position.x += normalX * pen;
                        this.mesh.position.z += normalZ * pen;
                    }
                }
            });
            state.levelManager.applyHazardsToPlayer(this, dt);
        }

        this.updateRamStagger(dt);

        // 鏡頭跟隨改由 main.js 統一管理；單龍 / PVP / 失衡跌倒皆由外部處理。
        if (!this.pulseScale) this.pulseScale = 1.0;
        if (this.pulseScale > 1.0) {
            this.pulseScale -= (this.pulseScale - 1.0) * 10.0 * dt;
            if (this.pulseScale < 1.0) this.pulseScale = 1.0;
        }
        const buffScale = this.buffSystem.getBodyVisualScale ? this.buffSystem.getBodyVisualScale() : 1.0;
        const finalScale = this.pulseScale * buffScale;
        this.mesh.scale.set(finalScale, finalScale, finalScale);
    }

    destroy() {
        if (this.buffSystem && this.buffSystem.clearAll) this.buffSystem.clearAll();
        if (this.hpBar && this.hpBar.destroy) this.hpBar.destroy();
        this._hideSpecialComboFX();

        [
            this.p1Arrow, this.p2Arrow, this.p3Arrow, this.p4Arrow,
            this.beamMesh, this.beamGlowMesh, this.beamImpactMesh,
            this.beamOriginLight, this.beamImpactLight, this.beamChargeRing,
            this.comboFxGroup, this.pteroComboRing, this.pteroTimerRing,
            ...((this.refractBeamSegments || []).flatMap(seg => [seg.core, seg.glow])),
            ...Object.values(this.fireballAimArrows || {}),
            ...Object.values(this.flamethrowerIndicators || {})
        ].forEach(obj => {
            if (!obj) return;
            if (obj.parent) obj.parent.remove(obj);
            if (obj.traverse) {
                obj.traverse(child => {
                    if (child.geometry) child.geometry.dispose();
                    if (child.material && child.material.map) child.material.map.dispose();
                    if (child.material) child.material.dispose();
                });
            }
        });

        if (this.attackLandingIndicators) {
            Object.values(this.attackLandingIndicators).forEach(ring => {
                if (!ring) return;
                if (ring.parent) ring.parent.remove(ring);
                if (ring.geometry) ring.geometry.dispose();
                if (ring.material) ring.material.dispose();
            });
        }

        if (this.mesh && this.mesh.parent) this.mesh.parent.remove(this.mesh);
        if (this.mesh && this.mesh.traverse) {
            this.mesh.traverse(child => {
                if (child.geometry) child.geometry.dispose();
                if (child.material && child.material.map) child.material.map.dispose();
                if (child.material) child.material.dispose();
            });
        }
    }
}
