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
    constructor() {
        this.mesh = new THREE.Group();
        this.velocity = new THREE.Vector3();

        this.hp = CONFIG.stats.playerHP;
        this.maxHP = CONFIG.stats.playerHP;
        this.isDead = false;
        this.damageFlashTimer = 0;

        this.hpBar = new HealthBar(scene, 4.5, 4.0, 0.2);

        this.cooldowns = { p1: 0, p2: 0, p3: 0, p4: 0 };
        this.attackStates = { p1: 'idle', p2: 'idle', p3: 'idle', p4: 'idle' };
        this.windupTimer = { p1: 0, p2: 0, p3: 0, p4: 0 };
        this.isWindup = { p1: false, p2: false, p3: false, p4: false };
        this.attackTimers = { p1: 0, p2: 0, p3: 0, p4: 0 };
        this.lastAttackInput = { p1: false, p2: false, p3: false, p4: false };
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

        this.buildModel();
        this.buildIndicators();

        this.baseColorP1 = new THREE.Color(CONFIG.visuals.colors.p1);
        this.baseColorP2 = new THREE.Color(CONFIG.visuals.colors.p2);
        this.baseColorP3 = new THREE.Color(CONFIG.visuals.colors.p3);
        this.baseColorP4 = new THREE.Color(CONFIG.visuals.colors.p4);

        scene.add(this.mesh);
    }

    takeDamage(amount, sourcePos, knockbackForce) {
        if (this.isDead) return;
        this.hp -= amount;
        this.damageFlashTimer = 0.2;

        if (sourcePos && this.mesh.position) {
            const dir = this.mesh.position.clone().sub(sourcePos).normalize();
            dir.y = 0;
            const force = (knockbackForce !== undefined) ? knockbackForce : amount * 0.2;
            this.knockbackVel.add(dir.multiplyScalar(force));
        }

        if (this.hp <= 0) this.die();
    }

    die() {
        this.isDead = true;
        alert("GAME OVER");
        location.reload();
    }

    checkCollisions(bullets) {
        if (this.isDead) return;

        const pPos = this.mesh.position.clone();
        pPos.y += 1.2;
        let hitRadius = 1.5;

        if (this.body) {
            const bodyWorldPos = new THREE.Vector3();
            this.body.getWorldPosition(bodyWorldPos);
            pPos.copy(bodyWorldPos);
        }

        bullets.forEach(b => {
            if (b.markedForDeletion || !b.isEnemy) return;
            if (b.mesh.position.distanceTo(pPos) < hitRadius) {
                b.markedForDeletion = true;
                this.takeDamage(b.damage || 10, b.mesh.position, b.knockback);
            }
        });
    }

    buildModel() {
        const bodyMat = new THREE.MeshLambertMaterial({ color: CONFIG.visuals.colors.body });
        const p1Mat = new THREE.MeshLambertMaterial({ color: CONFIG.visuals.colors.p1 });
        const p2Mat = new THREE.MeshLambertMaterial({ color: CONFIG.visuals.colors.p2 });
        const p3Mat = new THREE.MeshLambertMaterial({ color: CONFIG.visuals.colors.p3 });
        const p4Mat = new THREE.MeshLambertMaterial({ color: CONFIG.visuals.colors.p4 });

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

            this.necks.push({ group: neckGroup, pivot: pivotGroup, head: headMesh, id: cfg.id, baseLean: leanAngle });

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
            color: CONFIG.visuals.colors.beam, transparent: true, opacity: 0.0,
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

        this.beamOriginLight = new THREE.PointLight(CONFIG.visuals.colors.beam, 0, 12);
        scene.add(this.beamOriginLight);
        this.beamImpactLight = new THREE.PointLight(0xffffff, 0, 14);
        scene.add(this.beamImpactLight);

        const chargeRingGeo = new THREE.RingGeometry(1.2, 2.2, 32);
        chargeRingGeo.rotateX(-Math.PI / 2);
        const chargeRingMat = new THREE.MeshBasicMaterial({
            color: CONFIG.visuals.colors.beam,
            side: THREE.DoubleSide, transparent: true, opacity: 0.0,
            blending: THREE.AdditiveBlending, depthWrite: false
        });
        this.beamChargeRing = new THREE.Mesh(chargeRingGeo, chargeRingMat);
        this.beamChargeRing.position.y = 0.2;
        scene.add(this.beamChargeRing);
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

                if (currentState === 'windup') {
                    this.attackTimers[p] -= dt;
                    const progress = 1 - (this.attackTimers[p] / CONFIG.combat.windupTime);
                    const ease = progress * (2 - progress);
                    n.pivot.rotation.x = n.baseLean - (ease * 1.0);

                    if (this.attackTimers[p] <= 0) {
                        this.triggerAttackImpact(p);
                        this.attackStates[p] = 'recovery';
                        this.attackTimers[p] = CONFIG.combat.recoveryTime;
                    }
                } else if (currentState === 'recovery') {
                    this.attackTimers[p] -= dt;
                    const progress = 1 - (this.attackTimers[p] / CONFIG.combat.recoveryTime);
                    let targetLean = n.baseLean;
                    if (progress < 0.2) {
                        const p2 = progress / 0.2;
                        targetLean = (n.baseLean - 1.0) * (1 - p2) + (n.baseLean + 1.5) * p2;
                    } else {
                        const p2 = (progress - 0.2) / 0.8;
                        const ease = p2 * p2 * (3 - 2 * p2);
                        targetLean = (n.baseLean + 1.5) * (1 - ease) + (n.baseLean) * ease;
                    }
                    n.pivot.rotation.x = targetLean;
                    if (this.attackTimers[p] <= 0) this.attackStates[p] = 'idle';
                } else {
                    const lag = -this.angularVelocity * 0.1;
                    n.group.rotation.z = Math.sin(t * 5 + (p === 'p2' ? 1 : (p === 'p3' ? 2 : 0))) * 0.05 + lag;
                    n.pivot.rotation.x = n.baseLean + Math.sin(t * 8) * 0.05;
                    n.group.position.z = (p === 'p3' ? 1.0 : 1.1);
                }
            });
        }

        // Tail P4
        if (this.tailGroup) {
            const p = 'p4';
            const currentState = this.attackStates[p] || 'idle';
            if (currentState === 'windup') {
                this.attackTimers[p] -= dt;
                const progress = 1 - (this.attackTimers[p] / CONFIG.combat.windupTime);
                this.tailGroup.rotation.y = Math.sin(progress * Math.PI * 0.5) * 1.2;
                if (this.attackTimers[p] <= 0) {
                    this.triggerAttackImpact(p);
                    this.attackStates[p] = 'recovery';
                    this.attackTimers[p] = CONFIG.combat.recoveryTime;
                }
            } else if (currentState === 'recovery') {
                this.attackTimers[p] -= dt;
                const progress = 1 - (this.attackTimers[p] / CONFIG.combat.recoveryTime);
                if (progress < 0.3) {
                    const p2 = progress / 0.3;
                    this.tailGroup.rotation.y = 1.2 * (1 - p2) + (-1.5) * p2;
                } else {
                    const p2 = (progress - 0.3) / 0.7;
                    const ease = p2 * p2;
                    this.tailGroup.rotation.y = -1.5 * (1 - ease);
                }
                if (this.attackTimers[p] <= 0) this.attackStates[p] = 'idle';
            } else {
                this.tailGroup.rotation.y = Math.sin(t * 2.0) * 0.1;
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

    buildIndicators() {
        this.p1Arrow = new THREE.ArrowHelper(new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 2, 0), CONFIG.visuals.arrowLength, CONFIG.visuals.colors.p1);
        scene.add(this.p1Arrow);
        this.p2Arrow = new THREE.ArrowHelper(new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 2, 0), CONFIG.visuals.arrowLength, CONFIG.visuals.colors.p2);
        scene.add(this.p2Arrow);
        this.p3Arrow = new THREE.ArrowHelper(new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 2, 0), CONFIG.visuals.arrowLength, CONFIG.visuals.colors.p3);
        scene.add(this.p3Arrow);
        this.p4Arrow = new THREE.ArrowHelper(new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 2, 0), CONFIG.visuals.arrowLength, CONFIG.visuals.colors.p4);
        scene.add(this.p4Arrow);
    }

    getForwardVector() {
        const forward = new THREE.Vector3(0, 0, 1);
        forward.applyQuaternion(this.mesh.quaternion);
        return forward;
    }

    attack(playerIndex) {
        if (this.attackStates[playerIndex] !== 'idle') return;
        this.attackStates[playerIndex] = 'windup';
        this.attackTimers[playerIndex] = CONFIG.combat.windupTime;
    }

    triggerAttackImpact(playerIndex) {
        let isTail = (playerIndex === 'p4');
        let damage = CONFIG.combat.meleeDamage;
        let radius = CONFIG.combat.attackRange;
        let color = CONFIG.visuals.colors[playerIndex];

        const forward = this.getForwardVector();
        const spawnPos = this.mesh.position.clone();
        spawnPos.y = 0.5;

        if (isTail) {
            spawnPos.add(forward.clone().negate().multiplyScalar(3.0));
        } else {
            if (playerIndex === 'p1') spawnPos.add(forward.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), -0.6).multiplyScalar(3.0));
            if (playerIndex === 'p2') spawnPos.add(forward.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), 0.6).multiplyScalar(3.0));
            if (playerIndex === 'p3') spawnPos.add(forward.multiplyScalar(3.2));
        }

        this.createHitbox(spawnPos, radius, damage, 0.2, isTail, color);
    }

    createHitbox(pos, radius, damage, duration, isTail, color) {
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
                            e.takeDamage(damage, window.gidoraInstance.mesh.position, isTail ? 15 : 10);
                            this.hitList.add(e);
                            if (!isTail) {
                                const recoilDir = window.gidoraInstance.mesh.position.clone().sub(e.mesh.position).normalize();
                                recoilDir.y = 0;
                                window.gidoraInstance.knockbackVel.add(recoilDir.multiplyScalar(4));
                            }
                        }
                    });
                }

                if (state.levelManager && state.levelManager.blocks) {
                    state.levelManager.blocks.forEach(block => {
                        if (block.isDead || this.hitList.has(block)) return;
                        if (block.mesh.position.distanceTo(ring.position) < radius + 2.5) {
                            block.hp -= damage;
                            block.flashTimer = 0.1;
                            this.hitList.add(block);
                            if (block.hp <= 0) {
                                block.isDead = true;
                                scene.remove(block.mesh);
                                block.mesh.geometry.dispose();
                                block.mesh.material.dispose();
                            }
                            if (!isTail) {
                                const recoilDir = window.gidoraInstance.mesh.position.clone().sub(block.mesh.position).normalize();
                                recoilDir.y = 0;
                                window.gidoraInstance.knockbackVel.add(recoilDir.multiplyScalar(5));
                            }
                        }
                    });
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
    }

    updateBeam(dt) {
        const beamCfg = CONFIG.beam;
        const maxCharge = beamCfg.maxCharge;
        const beamWidth = beamCfg.width;
        const now = Date.now();
        const players = ['p1', 'p2', 'p3', 'p4'];
        const chargeCount = players.filter(p => state.input[p].charge).length;

        if (state.beamPhase === 'prefire') {
            if (chargeCount === 0) {
                state.beamPhase = 'postfire';
                state.beamPostFireTimer = beamCfg.postFireDelay;
                this.beamChargeRing.material.opacity = 0;
                this._hideBeamFX();
                return;
            }

            state.beamPreFireTimer -= dt;
            const progress = 1.0 - (state.beamPreFireTimer / beamCfg.preFireDelay);
            this.beamChargeRing.position.copy(this.mesh.position);
            this.beamChargeRing.position.y = 0.2;
            const flicker = 0.5 + Math.sin(progress * 40) * 0.5;
            this.beamChargeRing.material.opacity = flicker;
            this.beamChargeRing.scale.setScalar(0.8 + progress * 1.5);

            if (state.beamPreFireTimer <= 0) {
                state.beamPhase = 'firing';
                state.beamFiringTimer = beamCfg.firingDuration;
                state.beamDotTimer = 0;
                this.beamChargeRing.material.opacity = 0;
                this.beamMesh.visible = true;
                if (this.beamGlowMesh) this.beamGlowMesh.visible = true;
                if (this.beamImpactMesh) this.beamImpactMesh.visible = true;
            }
        }
        else if (state.beamPhase === 'firing') {
            state.beamFiringTimer -= dt;
            if (state.beamFiringTimer <= 0) {
                state.beamCharge = 0;
                state.beamPhase = 'postfire';
                state.beamPostFireTimer = beamCfg.postFireDelay;
                // Phase 1: 啟動合體技 CD
                state.comboCooldown = state.comboCooldownMax;
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
            if (state.levelManager) {
                state.levelManager.blocks.forEach(b => {
                    if (b.isDead) return;
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

            state.beamDotTimer += dt;
            if (state.beamDotTimer >= beamCfg.tickInterval) {
                state.beamDotTimer = 0;
                const damage = beamCfg.damagePerTick * beamCfg.damageScale;

                if (state.enemyManager) {
                    state.enemyManager.enemies.forEach(e => {
                        if (e.isDead) return;
                        const toE = e.mesh.position.clone().sub(origin);
                        const along = toE.dot(forward);
                        if (along < 0 || along > beamLength + 1.2) return;
                        const perp = toE.clone().sub(forward.clone().multiplyScalar(along));
                        if (perp.length() < 1.2 + hitRadius) e.takeDamage(damage, origin, 0);
                    });
                }
                if (state.levelManager) {
                    state.levelManager.blocks.forEach(b => {
                        if (b.isDead) return;
                        const toB = b.mesh.position.clone().sub(origin);
                        const along = toB.dot(forward);
                        if (along < 0 || along > beamLength + 1.0) return;
                        const perp = toB.clone().sub(forward.clone().multiplyScalar(along));
                        const hw = (b.mesh.geometry.parameters.width || 2) / 2 + hitRadius;
                        const hd = (b.mesh.geometry.parameters.depth || 2) / 2 + hitRadius;
                        if (Math.abs(perp.x) < hw && Math.abs(perp.z) < hd) {
                            b.hp -= damage;
                            b.flashTimer = 0.1;
                            if (b.hp <= 0) {
                                b.isDead = true;
                                scene.remove(b.mesh);
                                b.mesh.geometry.dispose();
                                b.mesh.material.dispose();
                            }
                        }
                    });
                }
            }
        }
        else if (state.beamPhase === 'postfire') {
            // Phase 1 修正: 後搖期間不再允許再蓄力 (避免「放開時跳到 0%」的視覺異常)
            // 統一在 idle 階段處理蓄力與衰減，後搖只負責倒數計時與衰減顯示
            state.beamCharge = Math.max(0, state.beamCharge - beamCfg.decayRate * dt);

            state.beamPostFireTimer -= dt;
            if (state.beamPostFireTimer <= 0) state.beamPhase = 'idle';
        }
    }

    update(dt) {
        this.updateDragon(dt);
        if (this.hpBar) this.hpBar.update(this.mesh.position, this.hp, this.maxHP);

        if (this.damageFlashTimer > 0) {
            this.damageFlashTimer -= dt;
            if (this.damageFlashTimer > 0) {
                this.p1HeadPart.material.color.setHex(0xff0000);
                this.p2HeadPart.material.color.setHex(0xff0000);
            }
        }

        const players = ['p1', 'p2', 'p3', 'p4'];
        const beamCfg = CONFIG.beam;
        const maxCharge = beamCfg.maxCharge;
        const isBeamActive = (state.beamPhase !== 'idle');

        if (isBeamActive) {
            this.updateBeam(dt);
            if (state.beamPhase === 'prefire' || state.beamPhase === 'postfire') return;
        }

        // Phase 1: Combo CD 倒數 (idle 階段)
        if (state.beamPhase === 'idle' && state.comboCooldown > 0) {
            state.comboCooldown = Math.max(0, state.comboCooldown - dt);
        }

        // 蓄力邏輯 (idle 階段)；CD 期間禁止蓄力，按住也只會緩慢衰減
        if (state.beamPhase === 'idle') {
            const chargeCount = players.filter(p => state.input[p].charge).length;
            const rates = beamCfg.chargeRates;
            const onCooldown = state.comboCooldown > 0;
            const rate = (chargeCount > 0 && !onCooldown)
                ? rates[Math.min(chargeCount, rates.length - 1)]
                : -beamCfg.decayRate;
            state.beamCharge = Math.min(maxCharge, Math.max(0, state.beamCharge + rate * dt));
        }

        if (state.beamPhase === 'idle' && state.beamCharge >= maxCharge && state.comboCooldown <= 0) {
            state.beamPhase = 'prefire';
            state.beamPreFireTimer = beamCfg.preFireDelay;
            this.beamChargeRing.position.copy(this.mesh.position);
            return;
        }

        // Cooldown
        players.forEach(p => { if (this.cooldowns[p] > 0) this.cooldowns[p] -= dt; });

        // Attack input
        players.forEach(p => {
            const isPress = state.input[p].attack && !this.lastAttackInput[p];
            this.lastAttackInput[p] = state.input[p].attack;
            if (this.cooldowns[p] <= 0) {
                if (isPress || state.input[p].attack) {
                    this.attack(p);
                    this.cooldowns[p] = 0.5;
                }
            }
        });

        // Visual: head colors
        players.forEach(p => {
            const headMap = { p1: this.p1HeadPart, p2: this.p2HeadPart, p3: this.p3HeadPart, p4: this.p4HeadPart };
            const baseMap = { p1: CONFIG.visuals.colors.p1, p2: CONFIG.visuals.colors.p2, p3: CONFIG.visuals.colors.p3, p4: CONFIG.visuals.colors.p4 };
            const head = headMap[p];
            if (!head) return;
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
        const isAnyWindup = players.some(p => this.attackStates[p] === 'windup');

        players.forEach(p => {
            const moveInput = state.input[p].move;
            const hasInput = moveInput.lengthSq() > 0.01;
            const isCharging = state.input[p].charge;

            const arrowMap = { p1: this.p1Arrow, p2: this.p2Arrow, p3: this.p3Arrow, p4: this.p4Arrow };
            const arrow = arrowMap[p];

            if (hasInput && !isAnyWindup) {
                const inputVec = new THREE.Vector3(moveInput.x, 0, moveInput.y);
                const dir = inputVec.clone().normalize();
                totalRotationInput.add(inputVec);
                if (!isBeamActive && !isCharging) {
                    if (!this.isWindup[p] && (this.cooldowns[p] <= 0.05 || (this.lastShotType[p] === 'single' || this.lastShotType[p] === 'ultraSingle'))) {
                        totalInput.add(inputVec);
                        activeDirs.push(dir);
                    }
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

        // Rotation
        let turnPenalty = 1.0;
        if (totalRotationInput.lengthSq() > 0.01 && !this.isBursting) {
            const targetAngle = Math.atan2(totalRotationInput.x, totalRotationInput.z);
            const currentAngle = this.mesh.rotation.y;
            let deltaAngle = targetAngle - currentAngle;
            while (deltaAngle > Math.PI) deltaAngle -= Math.PI * 2;
            while (deltaAngle < -Math.PI) deltaAngle += Math.PI * 2;

            const rotSpeedMult = (state.beamPhase === 'firing') ? 0.35 : 1.0;
            const rotStep = CONFIG.movement.rotationSpeed * rotSpeedMult * dt;
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
        const maxSpeed = CONFIG.movement.maxSpeed * speedMult * turnPenalty;
        const forward = this.getForwardVector();
        const isInputting = totalInput.lengthSq() > 0.01;

        if (isBeamActive) {
            this.velocity.multiplyScalar(Math.max(0, 1 - 20 * dt));
        } else if (isInputting) {
            if (currentSpeed > 0.1) {
                const currentDir = this.velocity.clone().normalize();
                const traction = CONFIG.movement.traction * dt;
                currentDir.lerp(forward, traction).normalize();
                this.velocity.copy(currentDir.multiplyScalar(currentSpeed));
            }
            const accel = CONFIG.movement.acceleration * dt;
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

        // Player-Block Collision
        if (state.levelManager) {
            const pRadius = 0.8;
            const pPos = this.mesh.position;
            state.levelManager.blocks.forEach(b => {
                if (b.isDead) return;
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
        }

        // Camera follow
        camera.position.x = this.mesh.position.x;
        camera.position.z = this.mesh.position.z + 10;
        camera.lookAt(this.mesh.position.x, 1.2, this.mesh.position.z);

        if (!this.pulseScale) this.pulseScale = 1.0;
        if (this.pulseScale > 1.0) {
            this.pulseScale -= (this.pulseScale - 1.0) * 10.0 * dt;
            if (this.pulseScale < 1.0) this.pulseScale = 1.0;
        }
        this.mesh.scale.set(this.pulseScale, this.pulseScale, this.pulseScale);
    }
}
