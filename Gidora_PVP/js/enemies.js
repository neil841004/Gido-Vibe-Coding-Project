// =====================================================================
// enemies.js — Enemy 基底、四種子類、Boss、Dummy、EnemyManager
// 依賴: scene, state, CONFIG, Bullet, FlyingCorpse
// PVP 版本：原本 window.gidoraInstance 直接引用，改為「最近的活龍」。
// =====================================================================

// 取得距離 pos 最近、且仍存活的三頭龍；找不到回傳 null。
function getClosestAliveDragon(pos) {
    let best = null;
    let bestDistSq = Infinity;
    (state.dragons || []).forEach(d => {
        if (!d || d.isDead) return;
        const dx = d.mesh.position.x - pos.x;
        const dz = d.mesh.position.z - pos.z;
        const distSq = dx * dx + dz * dz;
        if (distSq < bestDistSq) {
            best = d;
            bestDistSq = distSq;
        }
    });
    return best;
}

class HealthBar {
    constructor(scene, yOffset, width = 1.5, height = 0.15) {
        this.group = new THREE.Group();
        this.yOffset = yOffset;
        this.initialWidth = width;
        this.height = height;
        this.tickCount = -1;
        this.buffIconKey = '';

        scene.add(this.group);

        const bgGeo = new THREE.PlaneGeometry(width, height);
        const bgMat = new THREE.MeshBasicMaterial({ color: 0x550000, depthTest: false, transparent: true });
        this.bg = new THREE.Mesh(bgGeo, bgMat);
        this.bg.renderOrder = 999;
        this.group.add(this.bg);

        const fgGeo = new THREE.PlaneGeometry(width, height);
        const fgMat = new THREE.MeshBasicMaterial({ color: 0x00ff00, depthTest: false, transparent: true });
        this.fg = new THREE.Mesh(fgGeo, fgMat);
        this.fg.position.z = 0.01;
        this.fg.renderOrder = 1000;
        this.group.add(this.fg);

        const staggerBgGeo = new THREE.PlaneGeometry(width, height * 0.55);
        const staggerBgMat = new THREE.MeshBasicMaterial({ color: 0x2b2410, depthTest: false, transparent: true, opacity: 0.9 });
        this.staggerBg = new THREE.Mesh(staggerBgGeo, staggerBgMat);
        this.staggerBg.position.y = -height * 0.9;
        this.staggerBg.renderOrder = 999;
        this.group.add(this.staggerBg);

        const staggerFgGeo = new THREE.PlaneGeometry(width, height * 0.55);
        const staggerFgMat = new THREE.MeshBasicMaterial({ color: 0xffcc33, depthTest: false, transparent: true, opacity: 0.95 });
        this.staggerFg = new THREE.Mesh(staggerFgGeo, staggerFgMat);
        this.staggerFg.position.set(0, -height * 0.9, 0.012);
        this.staggerFg.renderOrder = 1000;
        this.group.add(this.staggerFg);

        this.tickGroup = new THREE.Group();
        this.tickGroup.position.z = 0.02;
        this.group.add(this.tickGroup);

        this.buffIconGroup = new THREE.Group();
        this.buffIconGroup.position.y = height * 2.2;
        this.buffIconGroup.position.z = 0.04;
        this.group.add(this.buffIconGroup);
    }

    update(position, current, max, staggerCurrent, staggerMax) {
        this.group.position.copy(position);
        this.group.position.y += this.yOffset;
        const pct = Math.max(0, current / max);
        this.fg.scale.x = pct;
        this.fg.position.x = (pct - 1) * this.initialWidth / 2;
        this.syncTicks(max);

        const showStagger = staggerMax !== undefined && staggerMax > 0;
        this.staggerBg.visible = showStagger;
        this.staggerFg.visible = showStagger;
        if (showStagger) {
            const staggerPct = THREE.MathUtils.clamp(staggerCurrent / staggerMax, 0, 1);
            this.staggerFg.scale.x = staggerPct;
            this.staggerFg.position.x = (staggerPct - 1) * this.initialWidth / 2;
            const heat = 0.35 + staggerPct * 0.65;
            this.staggerFg.material.color.setRGB(1, 0.55 + heat * 0.35, 0.1);
        }
        if (window.camera) this.group.quaternion.copy(window.camera.quaternion);
    }

    syncTicks(maxHP) {
        const tickHP = CONFIG.ui.healthBarTickHP;
        const ticks = Math.max(0, Math.floor((maxHP - 0.001) / tickHP));
        if (ticks === this.tickCount) return;

        while (this.tickGroup.children.length > 0) {
            const child = this.tickGroup.children[0];
            this.tickGroup.remove(child);
            child.geometry.dispose();
            child.material.dispose();
        }
        this.tickCount = ticks;

        for (let i = 1; i <= ticks; i++) {
            const hpAtTick = i * tickHP;
            if (hpAtTick >= maxHP) continue;
            const x = (hpAtTick / maxHP - 0.5) * this.initialWidth;
            const geo = new THREE.PlaneGeometry(0.018, this.height);
            const mat = new THREE.MeshBasicMaterial({
                color: 0x000000,
                depthTest: false,
                transparent: true,
                opacity: 0.9
            });
            const tick = new THREE.Mesh(geo, mat);
            tick.position.x = x;
            tick.renderOrder = 1001;
            this.tickGroup.add(tick);
        }
    }

    setBuffIcons(entries) {
        entries = entries || [];
        const key = entries.map(entry => `${entry.id}:${entry.stack}`).join('|');
        if (key === this.buffIconKey) return;
        this.buffIconKey = key;

        while (this.buffIconGroup.children.length > 0) {
            const child = this.buffIconGroup.children[0];
            this.buffIconGroup.remove(child);
            if (child.material && child.material.map) child.material.map.dispose();
            if (child.material) child.material.dispose();
        }

        if (entries.length === 0 || typeof createBuffIconSprite !== 'function') return;

        const iconSize = 0.28;
        const gap = 0.05;
        const maxPerRow = Math.max(1, Math.floor(this.initialWidth / (iconSize + gap)));
        entries.forEach((entry, index) => {
            const sprite = createBuffIconSprite(entry.id, entry.stack);
            const row = Math.floor(index / maxPerRow);
            const col = index % maxPerRow;
            const countInRow = Math.min(maxPerRow, entries.length - row * maxPerRow);
            const rowWidth = countInRow * iconSize + (countInRow - 1) * gap;
            sprite.scale.set(iconSize, iconSize, 1);
            sprite.position.set(
                -rowWidth / 2 + iconSize / 2 + col * (iconSize + gap),
                row * (iconSize + gap),
                0
            );
            this.buffIconGroup.add(sprite);
        });
    }

    destroy() {
        if (this.group.parent) this.group.parent.remove(this.group);
        this.group.traverse(obj => {
            if (obj.geometry) obj.geometry.dispose();
            if (obj.material) obj.material.dispose();
        });
    }
}

class Enemy {
    constructor(manager, pos, config) {
        this.manager = manager;
        this.hp = config.hp;
        this.damage = config.damage;
        this.speed = config.speed;
        this.attackRange = config.attackRange;
        this.attackRate = config.attackRate;
        this.color = config.color;

        this.mesh = new THREE.Mesh(
            new THREE.BoxGeometry(0.8, 2.0, 0.8),
            new THREE.MeshLambertMaterial({ color: this.color })
        );
        this.mesh.position.copy(pos);
        this.mesh.position.y = 1.0;
        this.mesh.castShadow = true;
        manager.scene.add(this.mesh);

        const shadowGeo = new THREE.CircleGeometry(0.6, 16);
        const shadowMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.5 });
        this.shadowMesh = new THREE.Mesh(shadowGeo, shadowMat);
        this.shadowMesh.rotation.x = -Math.PI / 2;
        this.shadowMesh.position.set(0, -0.98, 0);
        this.mesh.add(this.shadowMesh);

        this.attackTimer = 0;
        this.isDead = false;
        this.flashTimer = 0;
        this.knockbackVel = new THREE.Vector3();
        this.staggerValue = 0;
        this.staggerWindowTimer = 0;
        this.fallTimer = 0;
        this.slowTimer = 0;
        this.slowFactor = 1.0;

        this.maxHP = this.hp;
        this.hpBar = new HealthBar(this.manager.scene, 1.2);
    }

    takeDamage(amount, sourcePos, knockbackForce) {
        if (amount <= 0) return;
        this.hp -= amount;
        this.flashTimer = 0.1;
        this.addStagger(amount, sourcePos);

        if (sourcePos) {
            const dir = this.mesh.position.clone().sub(sourcePos).normalize();
            dir.y = 0;
            const force = (knockbackForce !== undefined) ? knockbackForce : amount * CONFIG.combat.knockbackBase;
            this.knockbackVel.add(dir.multiplyScalar(force));
        }

        if (this.hp <= 0) this.die();
    }

    addStagger(amount, sourcePos) {
        if (amount <= 0 || this.fallTimer > 0) return;
        this.staggerWindowTimer = CONFIG.stagger.enemyWindow;
        this.staggerValue = Math.min(CONFIG.stagger.enemyThreshold, this.staggerValue + amount);
        if (this.staggerValue >= CONFIG.stagger.enemyThreshold) {
            this.fallTimer = CONFIG.stagger.enemyFallDuration;
            this.staggerValue = 0;
            this.knockbackVel.multiplyScalar(0.3);
        }
    }

    updateStagger(dt) {
        if (this.staggerWindowTimer > 0) {
            this.staggerWindowTimer -= dt;
            return;
        }
        if (this.staggerValue > 0) {
            this.staggerValue = Math.max(0, this.staggerValue - CONFIG.stagger.enemyRecoveryRate * dt);
        }
    }

    applySlow(factor, duration) {
        this.slowFactor = Math.min(this.slowFactor, factor);
        this.slowTimer = Math.max(this.slowTimer, duration);
    }

    die() {
        this.isDead = true;
        this.mesh.material.emissive.setHex(0x000000);
        if (this.hpBar) this.hpBar.destroy();
        state.flyingCorpses.push(new FlyingCorpse(this.mesh, this.color));
    }

    update(dt, _ignoredPos) {
        if (this.isDead) return;
        if (this.hpBar) this.hpBar.update(this.mesh.position, this.hp, this.maxHP, this.staggerValue, CONFIG.stagger.enemyThreshold);

        this.updateStagger(dt);
        if (this.slowTimer > 0) {
            this.slowTimer -= dt;
            if (this.slowTimer <= 0) this.slowFactor = 1.0;
        }
        if (state.levelManager) state.levelManager.applyHazardsToEnemy(this, dt);

        if (this.flashTimer > 0) {
            this.flashTimer -= dt;
            this.mesh.material.emissive.setHex(this.flashTimer > 0 ? 0xffffff : 0x000000);
        }

        // PVP：每幀重新鎖定最近的活龍
        const target = getClosestAliveDragon(this.mesh.position);
        if (!target) return; // 場上沒有活龍，待機
        const playerPos = target.mesh.position;
        const dist = this.mesh.position.distanceTo(playerPos);

        if (this.knockbackVel.lengthSq() > 0.001) {
            this.mesh.position.add(this.knockbackVel.clone().multiplyScalar(dt));
            this.mesh.position.y = 1.0;
            this.knockbackVel.multiplyScalar(0.9);
        }

        if (this.fallTimer > 0) {
            this.fallTimer -= dt;
            this.mesh.rotation.x = THREE.MathUtils.lerp(this.mesh.rotation.x, -1.2, dt * 8);
            return;
        } else if (Math.abs(this.mesh.rotation.x) > 0.001) {
            this.mesh.rotation.x = THREE.MathUtils.lerp(this.mesh.rotation.x, 0, dt * 8);
        }

        if (dist > this.attackRange) {
            const dir = playerPos.clone().sub(this.mesh.position).normalize();
            dir.y = 0;
            this.mesh.position.add(dir.multiplyScalar(this.speed * this.slowFactor * dt));
            this.mesh.lookAt(playerPos);
        } else {
            if (this.attackTimer <= 0) {
                this.performAttack(playerPos, target);
                this.attackTimer = this.attackRate;
            }
        }
        if (this.attackTimer > 0) this.attackTimer -= dt;
    }

    performAttack(targetPos, targetDragon) {}
}

class MeleeEnemy extends Enemy {
    constructor(manager, pos) { super(manager, pos, CONFIG.enemy.melee); }
    performAttack(targetPos, targetDragon) {
        const flash = new THREE.Mesh(
            new THREE.SphereGeometry(1.2, 8, 8),
            new THREE.MeshBasicMaterial({ color: 0xff0000, transparent: true, opacity: 0.5 })
        );
        flash.position.copy(this.mesh.position);
        this.manager.scene.add(flash);
        setTimeout(() => {
            this.manager.scene.remove(flash);
            flash.geometry.dispose();
            flash.material.dispose();
        }, 100);

        const hit = targetDragon && targetDragon.intersectsHitCircle
            ? targetDragon.intersectsHitCircle(this.mesh.position, this.attackRange * CONFIG.hitbox.enemyMeleeRangeScale)
            : targetDragon && this.mesh.position.distanceTo(targetPos) < this.attackRange * 1.5;
        if (hit) {
            targetDragon.takeDamage(this.damage, this.mesh.position, this.damage * 0.6);
        }
    }
}

class RangedEnemy extends Enemy {
    constructor(manager, pos) { super(manager, pos, CONFIG.enemy.ranged); }
    performAttack(targetPos, targetDragon) {
        const dir = targetPos.clone().sub(this.mesh.position).normalize();
        const stats = { damage: this.damage, penetration: 0 };
        const bullet = new Bullet(
            'enemy',
            this.mesh.position.clone().add(new THREE.Vector3(0, 0.5, 0)),
            dir,
            CONFIG.enemy.ranged.projectileSpeed, 2.0, 0, 0.4, stats
        );
        bullet.isEnemy = true;
        bullet.mesh.material.color.setHex(0xff00ff);
        state.bullets.push(bullet);
    }
}

class NinjaEnemy extends Enemy {
    constructor(manager, pos) {
        super(manager, pos, CONFIG.enemy.ninja);
        this.teleportCooldown = 0;
        this.warningTimer = 0;
        this.isWarning = false;
        this.recoveryTimer = 0;
    }

    update(dt, _ignoredPos) {
        if (this.isDead) return;

        if (this.hpBar) this.hpBar.update(this.mesh.position, this.hp, this.maxHP, this.staggerValue, CONFIG.stagger.enemyThreshold);
        this.updateStagger(dt);
        if (this.slowTimer > 0) {
            this.slowTimer -= dt;
            if (this.slowTimer <= 0) this.slowFactor = 1.0;
        }
        if (state.levelManager) state.levelManager.applyHazardsToEnemy(this, dt);
        if (this.flashTimer > 0) {
            this.flashTimer -= dt;
            this.mesh.material.emissive.setHex(this.flashTimer > 0 ? 0xffffff : 0x000000);
        }

        if (this.knockbackVel.lengthSq() > 0.001) {
            this.mesh.position.add(this.knockbackVel.clone().multiplyScalar(dt));
            this.mesh.position.y = 1.0;
            this.knockbackVel.multiplyScalar(0.9);
            return;
        }

        if (this.fallTimer > 0) {
            this.fallTimer -= dt;
            this.mesh.rotation.x = THREE.MathUtils.lerp(this.mesh.rotation.x, -1.2, dt * 8);
            return;
        } else if (Math.abs(this.mesh.rotation.x) > 0.001) {
            this.mesh.rotation.x = THREE.MathUtils.lerp(this.mesh.rotation.x, 0, dt * 8);
        }

        // PVP：每幀重新鎖定最近的活龍
        const target = getClosestAliveDragon(this.mesh.position);
        if (!target) return;
        const playerPos = target.mesh.position;

        if (this.recoveryTimer > 0) { this.recoveryTimer -= dt; return; }

        if (this.isWarning) {
            this.warningTimer -= dt;
            this.mesh.rotation.y += 10 * dt;
            if (this.warningTimer <= 0) {
                this.performAttack(playerPos, target);
                this.isWarning = false;
                this.teleportCooldown = 5.0;
            }
            return;
        }

        if (this.teleportCooldown > 0) this.teleportCooldown -= dt;

        const dist = this.mesh.position.distanceTo(playerPos);

        if (dist < CONFIG.enemy.ninja.teleportDist && this.teleportCooldown <= 0) {
            const fwd = target.getForwardVector().normalize();
            let backPos = playerPos.clone().sub(fwd.multiplyScalar(3.0));
            backPos.y = 1.0;

            const smokeGeo = new THREE.SphereGeometry(1, 8, 8);
            const smokeMat = new THREE.MeshBasicMaterial({ color: 0x555555, transparent: true, opacity: 0.8 });
            const smoke = new THREE.Mesh(smokeGeo, smokeMat);
            smoke.position.copy(this.mesh.position);
            this.manager.scene.add(smoke);

            let sOp = 0.8;
            const animSmoke = () => {
                sOp -= 0.05;
                if (sOp <= 0) {
                    this.manager.scene.remove(smoke);
                    smoke.geometry.dispose();
                    smoke.material.dispose();
                    return;
                }
                smoke.material.opacity = sOp;
                smoke.scale.multiplyScalar(1.1);
                requestAnimationFrame(animSmoke);
            };
            animSmoke();

            this.mesh.position.copy(backPos);
            this.isWarning = true;
            this.warningTimer = CONFIG.enemy.ninja.warningTime;
        } else {
            if (dist > this.attackRange) {
                const dir = playerPos.clone().sub(this.mesh.position).normalize();
                dir.y = 0;
                this.mesh.position.add(dir.multiplyScalar(this.speed * this.slowFactor * dt));
                this.mesh.lookAt(playerPos);
            }
        }
    }

    performAttack(playerPos, targetDragon) {
        this.mesh.material.color.setHex(this.color);

        const slashGeo = new THREE.RingGeometry(1.0, 2.5, 32, 1, 0, Math.PI);
        const slashMat = new THREE.MeshBasicMaterial({ color: 0x00ffff, side: THREE.DoubleSide, transparent: true, opacity: 0.8 });
        const slash = new THREE.Mesh(slashGeo, slashMat);

        slash.position.copy(this.mesh.position);
        slash.position.y = 1.0;
        slash.lookAt(playerPos);
        slash.rotateX(-Math.PI / 2);
        slash.rotateZ(Math.PI);
        this.manager.scene.add(slash);

        const startTime = Date.now();
        const duration = 200;
        const animateSlash = () => {
            const elapsed = Date.now() - startTime;
            if (elapsed > duration) {
                this.manager.scene.remove(slash);
                slash.geometry.dispose();
                slash.material.dispose();
                return;
            }
            slash.material.opacity = 1.0 - (elapsed / duration);
            slash.scale.setScalar(1.0 + (elapsed / duration) * 0.5);
            requestAnimationFrame(animateSlash);
        };
        animateSlash();

        const slashRange = 4.0;
        const hit = targetDragon && targetDragon.intersectsHitCircle
            ? targetDragon.intersectsHitCircle(this.mesh.position, slashRange * CONFIG.hitbox.enemySlashRangeScale)
            : targetDragon && this.mesh.position.distanceTo(playerPos) < slashRange;
        if (hit) {
            targetDragon.takeDamage(this.damage, this.mesh.position, this.damage);
        }

        this.recoveryTimer = 0.5;
    }
}

class DummyEnemy extends Enemy {
    constructor(manager, pos) {
        super(manager, pos, { hp: 100, damage: 0, speed: 0, attackRange: 0, attackRate: 999, color: 0x8B4513 });
        this.hpBar.yOffset = 2.5;
        this.mesh.scale.set(1.5, 1.5, 1.5);
        this.healing = false;
    }

    update(dt, playerPos) {
        if (this.hpBar) this.hpBar.update(this.mesh.position, this.hp, this.maxHP, this.staggerValue, CONFIG.stagger.enemyThreshold);

        if (this.flashTimer > 0) {
            this.flashTimer -= dt;
            if (this.healing) {
                this.mesh.material.emissive.setHex(0x00ff00);
                if (this.flashTimer <= 0) this.healing = false;
            } else {
                this.mesh.material.emissive.setHex(this.flashTimer > 0 ? 0xffffff : 0x000000);
            }
        }

        if (this.knockbackVel.lengthSq() > 0.001) {
            this.mesh.position.add(this.knockbackVel.clone().multiplyScalar(dt));
            this.mesh.position.y = 1.0;
            this.knockbackVel.multiplyScalar(0.9);
        }
    }

    die() {
        this.isDead = true;
        this.mesh.material.emissive.setHex(0x000000);
        if (this.hpBar) this.hpBar.destroy();
        const manager = this.manager;
        state.flyingCorpses.push(new FlyingCorpse(this.mesh, this.color, () => {
            // Phase 1: 只在 dummyEnabled 為 true 時自動重生
            if (manager && state.dummyEnabled) {
                const refDragon = (state.dragons || []).find(d => d && !d.isDead);
                const playerPos = refDragon
                    ? refDragon.mesh.position.clone()
                    : new THREE.Vector3(0, 1, 0);
                manager.spawnDummy(playerPos);
            }
        }));
    }
}

class TauntEnemy extends Enemy {
    constructor(manager, pos) {
        super(manager, pos, CONFIG.enemy.boss);
        this.targetPos = pos.clone();
        this.waitTime = 0;

        this.mesh.scale.set(2.5, 2.5, 2.5);

        if (this.hpBar) {
            this.hpBar.yOffset = 4.0;
            if (this.hpBar.destroy) this.hpBar.destroy();
            this.hpBar = new HealthBar(this.manager.scene, 4.0, 4.0, 0.4);
        }

        this.attackRange = 15.0;
        this.attackCooldown = 0;
        this.setupRangeVisual();
    }

    setupRangeVisual() {
        const geo = new THREE.RingGeometry(this.attackRange - 0.2, this.attackRange, 64);
        geo.rotateX(-Math.PI / 2);
        const mat = new THREE.MeshBasicMaterial({ color: 0xff0000, side: THREE.DoubleSide, transparent: true, opacity: 0.3 });
        this.rangeRing = new THREE.Mesh(geo, mat);
        this.manager.scene.add(this.rangeRing);
    }

    update(dt, playerPos) {
        if (this.isDead) return;

        this.updateStagger(dt);
        if (this.slowTimer > 0) {
            this.slowTimer -= dt;
            if (this.slowTimer <= 0) this.slowFactor = 1.0;
        }
        if (state.levelManager) state.levelManager.applyHazardsToEnemy(this, dt);

        if (this.flashTimer > 0) {
            this.flashTimer -= dt;
            this.mesh.material.emissive.setHex(this.flashTimer > 0 ? 0xffffff : 0x000000);
        }

        if (this.hpBar) this.hpBar.update(this.mesh.position, this.hp, this.maxHP, this.staggerValue, CONFIG.stagger.enemyThreshold);

        if (this.knockbackVel.lengthSq() > 0.001) {
            this.mesh.position.add(this.knockbackVel.clone().multiplyScalar(dt));
            this.knockbackVel.multiplyScalar(0.9);
        }

        if (this.fallTimer > 0) {
            this.fallTimer -= dt;
            this.mesh.rotation.x = THREE.MathUtils.lerp(this.mesh.rotation.x, -1.2, dt * 8);
            return;
        } else if (Math.abs(this.mesh.rotation.x) > 0.001) {
            this.mesh.rotation.x = THREE.MathUtils.lerp(this.mesh.rotation.x, 0, dt * 8);
        }

        if (this.attackCooldown > 0) this.attackCooldown -= dt;

        const target = getClosestAliveDragon(this.mesh.position);
        const distToPlayer = target ? this.mesh.position.distanceTo(target.mesh.position) : Infinity;

        if (this.rangeRing) {
            this.rangeRing.position.copy(this.mesh.position);
            this.rangeRing.position.y = 0.1;
        }

        if (target && distToPlayer <= this.attackRange) {
            if (this.attackCooldown <= 0) {
                this.fireHomingMissile(target);
                this.attackCooldown = 2.0;
            }
            this.waitTime = 0.5;
        }

        if (this.waitTime > 0) { this.waitTime -= dt; return; }

        const dist = this.mesh.position.distanceTo(this.targetPos);
        if (dist < 1.0) {
            this.pickNewTarget();
        } else {
            const dir = this.targetPos.clone().sub(this.mesh.position).normalize();
            const moveStep = dir.multiplyScalar(this.speed * this.slowFactor * dt);
            const nextPos = this.mesh.position.clone().add(moveStep);

            let hitBlock = false;
            if (state.levelManager) {
                state.levelManager.blocks.forEach(b => {
                    if (hitBlock || b.isDead) return;
                    if (!b.solid) return;
                    const dx = Math.abs(b.mesh.position.x - nextPos.x);
                    const dz = Math.abs(b.mesh.position.z - nextPos.z);
                    if (dx < 4.0 && dz < 4.0) hitBlock = true;
                });
            }

            if (hitBlock) this.pickNewTarget();
            else {
                this.mesh.position.add(moveStep);
                this.mesh.lookAt(this.targetPos);
            }
        }
    }

    pickNewTarget() {
        const angle = Math.random() * Math.PI * 2;
        const r = Math.random() * 20;
        this.targetPos.set(Math.sin(angle) * r, 1, Math.cos(angle) * r);
        this.waitTime = 1.0 + Math.random() * 2.0;
    }

    fireHomingMissile(target) {
        if (!target) target = getClosestAliveDragon(this.mesh.position);
        if (!target) return;
        const startPos = this.mesh.position.clone();
        startPos.y = 2.5;

        const bullet = new Bullet(
            'enemy', startPos, new THREE.Vector3(0, 0, 1),
            CONFIG.enemy.boss.projectileSpeed, 5.0, 0, 0.8,
            {
                damage: 15,
                color: 0x8800ff,
                isHoming: true,
                target: target.mesh,
                homingStrength: 2.0,
                knockback: CONFIG.enemy.boss.projectileKnockback
            }
        );
        const dir = target.mesh.position.clone().sub(startPos).normalize();
        bullet.velocity = dir.multiplyScalar(bullet.speed);
        bullet.mesh.lookAt(bullet.mesh.position.clone().add(bullet.velocity));
        state.bullets.push(bullet);
    }

    die() {
        if (this.rangeRing) {
            this.manager.scene.remove(this.rangeRing);
            this.rangeRing.geometry.dispose();
            this.rangeRing.material.dispose();
        }
        super.die();

        const div = document.createElement('div');
        div.style.position = 'absolute';
        div.style.top = '50%';
        div.style.left = '50%';
        div.style.transform = 'translate(-50%, -50%)';
        div.style.color = '#ffD700';
        div.style.fontSize = '100px';
        div.style.fontFamily = 'Impact, sans-serif';
        div.style.textShadow = '0 0 30px black';
        div.style.zIndex = '9999';
        div.innerText = 'VICTORY!';
        document.body.appendChild(div);

        state.spawnerEnabled = false;
        this.manager.killAll();
    }
}

class EnemyManager {
    constructor(scene) {
        this.scene = scene;
        this.enemies = [];
        this.spawnTimer = 0;
        this.bossDelayTimer = 0;
        this.bossSpawned = false;
    }

    update(dt, playerPos) {
        if (state.spawnerEnabled) {
            if (this.enemies.length < CONFIG.enemy.maxEnemies) {
                this.spawnTimer += dt;
                if (this.spawnTimer >= CONFIG.enemy.spawnRate) {
                    this.spawnTimer = 0;
                    this.spawnEnemy(playerPos);
                }
            }

            if (!this.bossSpawned) {
                this.bossDelayTimer += dt;
                if (this.bossDelayTimer >= CONFIG.enemy.boss.spawnDelay) {
                    this.bossSpawned = true;

                    let spawnPos = new THREE.Vector3(0, 1, -10);
                    let safe = false;
                    let attempts = 0;
                    while (!safe && attempts < 10) {
                        let hitBlock = false;
                        if (state.levelManager) {
                            state.levelManager.blocks.forEach(b => {
                                if (hitBlock) return;
                                if (b.isDead || !b.solid) return;
                                const dx = Math.abs(b.mesh.position.x - spawnPos.x);
                                const dz = Math.abs(b.mesh.position.z - spawnPos.z);
                                if (dx < 4.0 && dz < 4.0) hitBlock = true;
                            });
                        }

                        if (!hitBlock) {
                            safe = true;
                            if (playerPos && spawnPos.distanceTo(playerPos) < 10) safe = false;
                        }

                        if (!safe) {
                            const angle = Math.random() * Math.PI * 2;
                            const r = 5 + Math.random() * 15;
                            spawnPos.set(Math.sin(angle) * r, 1, Math.cos(angle) * r);
                            attempts++;
                        }
                    }

                    const boss = new TauntEnemy(this, spawnPos);
                    this.enemies.push(boss);
                }
            }
        }

        this.enemies.forEach(e => e.update(dt, playerPos));
        this.enemies = this.enemies.filter(e => !e.isDead);
    }

    spawnEnemy(playerPos) {
        const angle = Math.random() * Math.PI * 2;
        const dist = 25 + Math.random() * 10;
        const x = Math.sin(angle) * dist;
        const z = Math.cos(angle) * dist;
        const pos = new THREE.Vector3(x, 1, z);

        const weights = [
            { type: 'melee', weight: CONFIG.enemy.melee.spawnWeight },
            { type: 'ranged', weight: CONFIG.enemy.ranged.spawnWeight },
            { type: 'ninja', weight: CONFIG.enemy.ninja.spawnWeight || 0 }
        ];

        const totalWeight = weights.reduce((s, i) => s + i.weight, 0);
        let randomVal = Math.random() * totalWeight;
        let selectedType = 'melee';
        for (let item of weights) {
            if (randomVal < item.weight) { selectedType = item.type; break; }
            randomVal -= item.weight;
        }

        let enemy;
        if (selectedType === 'melee') enemy = new MeleeEnemy(this, pos);
        else if (selectedType === 'ranged') enemy = new RangedEnemy(this, pos);
        else if (selectedType === 'ninja') enemy = new NinjaEnemy(this, pos);

        if (enemy) this.enemies.push(enemy);
    }

    spawnDummy(playerPos) {
        let spawnPos;
        const ref = (state.dragons || []).find(d => d && !d.isDead);
        if (ref) {
            const dir = ref.getForwardVector().normalize();
            spawnPos = ref.mesh.position.clone().add(dir.multiplyScalar(8));
        } else if (playerPos) {
            spawnPos = playerPos.clone();
        } else {
            spawnPos = new THREE.Vector3(0, 1, -10);
        }
        spawnPos.y = 1;

        const dummy = new DummyEnemy(this, spawnPos);
        this.enemies.push(dummy);
        return dummy;
    }

    // Phase 1: 移除場上所有 Dummy (用於 Close Dummy 按鈕)
    removeDummies() {
        this.enemies.forEach(e => {
            if (e instanceof DummyEnemy) {
                e.isDead = true;
                if (e.hpBar) e.hpBar.destroy();
                this.scene.remove(e.mesh);
                if (e.mesh.geometry) e.mesh.geometry.dispose();
                if (e.mesh.material) e.mesh.material.dispose();
            }
        });
        this.enemies = this.enemies.filter(e => !e.isDead);
    }

    killAll() {
        this.enemies.forEach(e => e.die());
        this.enemies = [];
    }

    checkCollisions(bullets) {
        bullets.forEach(b => {
            if (b.markedForDeletion || b.isEnemy) return;
            if (b.damage <= 0) return;

            for (let e of this.enemies) {
                if (e.isDead) continue;

                const distSq = (e.mesh.position.x - b.mesh.position.x) ** 2 +
                               (e.mesh.position.z - b.mesh.position.z) ** 2;
                const hitDist = 1.0 + b.size;

                if (distSq < hitDist * hitDist) {
                    if (b.hitEntities.has(e.mesh.uuid)) continue;
                    b.hitEntities.add(e.mesh.uuid);

                    e.takeDamage(b.damage, b.mesh.position, b.knockback);
                    if (b.onImpact) b.onImpact(b);
                    if (b.attackerDragon && b.attackerDragon.buffSystem) {
                        b.attackerDragon.buffSystem.onEffectiveDamage(b.damage);
                    }

                    b.penetration--;
                    if (b.penetration < 0) b.markedForDeletion = true;
                    break;
                }
            }
        });
    }
}
