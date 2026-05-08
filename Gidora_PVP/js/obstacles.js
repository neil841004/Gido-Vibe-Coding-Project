// =====================================================================
// obstacles.js — 障礙物與地形效果
// 支援：不可通過可破壞、不可通過不可破壞、可通過緩速、可通過 DOT。
// =====================================================================

class LevelManager {
    constructor(scene) {
        this.scene = scene;
        this.blocks = [];
        this.healItems = [];
        this.mysteryBoxes = [];
        this.generatedChunks = new Set();
        this.healItemTimer = 0;
        this.mysteryBoxTimer = 0;
        this.arenaVisuals = [];
        this.createArenaVisuals();
        this.resetHealItemTimer();
        this.resetMysteryBoxTimer();
        this.generateLevel();
    }

    generateLevel() {
        if (this.blocks) {
            this.blocks.forEach(b => this.disposeBlock(b));
        }
        if (this.healItems) {
            this.healItems.forEach(item => this.disposeHealItem(item));
        }
        if (this.mysteryBoxes) {
            this.mysteryBoxes.forEach(item => this.disposeMysteryBox(item));
        }
        this.blocks = [];
        this.healItems = [];
        this.mysteryBoxes = [];
        this.generatedChunks.clear();
        this.resetHealItemTimer();
        this.resetMysteryBoxTimer();
        this.generateAroundPosition(new THREE.Vector3(0, 0, 0));
    }

    generateAroundPosition(position) {
        const levelCfg = CONFIG.level;
        const centerX = this.getChunkCoord(position.x);
        const centerZ = this.getChunkCoord(position.z);
        for (let dz = -levelCfg.generateRadiusChunks; dz <= levelCfg.generateRadiusChunks; dz++) {
            for (let dx = -levelCfg.generateRadiusChunks; dx <= levelCfg.generateRadiusChunks; dx++) {
                this.generateChunk(centerX + dx, centerZ + dz);
            }
        }
    }

    generateChunk(chunkX, chunkZ) {
        const levelCfg = CONFIG.level;
        if (!this.isChunkWithinArena(chunkX, chunkZ)) return;
        const key = this.getChunkKey(chunkX, chunkZ);
        if (this.generatedChunks.has(key)) return;
        this.generatedChunks.add(key);

        const specs = [
            { type: 'destructible', count: levelCfg.destructibleCount },
            { type: 'solid', count: levelCfg.solidCount },
            { type: 'slime', count: levelCfg.slimeCount },
            { type: 'fire', count: levelCfg.fireCount }
        ];
        const chunkCenterX = chunkX * levelCfg.chunkSize;
        const chunkCenterZ = chunkZ * levelCfg.chunkSize;
        const blockBoxes = this.getExistingBoxesNearChunk(chunkX, chunkZ);

        // 河道優先生成，後續障礙物會自動避開
        this.generateRiversForChunk(chunkX, chunkZ, blockBoxes);

        specs.forEach(spec => {
            let attempts = 0;
            let generated = 0;
            while (generated < spec.count && attempts < levelCfg.maxAttemptsPerType) {
                attempts++;

                const isPatch = spec.type === 'slime' || spec.type === 'fire';
                let sx, sy, sz;
                if (isPatch) {
                    sx = levelCfg.patchSizeMin + Math.random() * levelCfg.patchSizeRand;
                    sy = levelCfg.patchHeight;
                    sz = levelCfg.patchSizeMin + Math.random() * levelCfg.patchSizeRand;
                } else {
                    sx = levelCfg.solidSizeMin + Math.random() * levelCfg.solidSizeRand;
                    sy = levelCfg.solidHeightMin + Math.random() * levelCfg.solidHeightRand;
                    sz = levelCfg.solidSizeMin + Math.random() * levelCfg.solidSizeRand;
                }
                const x = chunkCenterX + (Math.random() - 0.5) * levelCfg.chunkSize;
                const z = chunkCenterZ + (Math.random() - 0.5) * levelCfg.chunkSize;

                if (x * x + z * z < levelCfg.safeRadius * levelCfg.safeRadius) continue;
                if (!this.isInsideArenaXZ(x, z, Math.max(sx, sz) * 0.5 + levelCfg.arenaSpawnMargin)) continue;

                const tempBox = new THREE.Box3();
                tempBox.min.set(x - sx / 2 - levelCfg.spacingPadding, 0, z - sz / 2 - levelCfg.spacingPadding);
                tempBox.max.set(x + sx / 2 + levelCfg.spacingPadding, Math.max(0.2, sy), z + sz / 2 + levelCfg.spacingPadding);

                let overlap = false;
                for (let box of blockBoxes) {
                    if (tempBox.intersectsBox(box)) { overlap = true; break; }
                }
                if (overlap) continue;

                const block = this.createBlock(spec.type, sx, sy, sz, x, z, chunkX, chunkZ);
                this.blocks.push(block);
                blockBoxes.push(tempBox);
                generated++;
            }
        });
    }

    makeRiverBox(x, z, sx, sz) {
        const levelCfg = CONFIG.level;
        const box = new THREE.Box3();
        box.min.set(x - sx / 2 - levelCfg.spacingPadding, 0, z - sz / 2 - levelCfg.spacingPadding);
        box.max.set(x + sx / 2 + levelCfg.spacingPadding, levelCfg.riverHeight, z + sz / 2 + levelCfg.spacingPadding);
        return box;
    }

    isRiverSegmentValid(x, z, sx, sz, blockBoxes, ignoreBox = null) {
        const levelCfg = CONFIG.level;
        if (x * x + z * z < levelCfg.safeRadius * levelCfg.safeRadius) return false;
        if (!this.isInsideArenaXZ(x, z, Math.max(sx, sz) * 0.5 + levelCfg.arenaSpawnMargin)) return false;
        const box = this.makeRiverBox(x, z, sx, sz);
        for (let other of blockBoxes) {
            if (other === ignoreBox) continue;
            if (box.intersectsBox(other)) return false;
        }
        return true;
    }

    generateRiversForChunk(chunkX, chunkZ, blockBoxes) {
        const levelCfg = CONFIG.level;
        const chunkCenterX = chunkX * levelCfg.chunkSize;
        const chunkCenterZ = chunkZ * levelCfg.chunkSize;
        const sy = levelCfg.riverHeight;
        let placed = 0;
        let attempts = 0;
        const maxAttempts = levelCfg.maxAttemptsPerType;

        while (placed < levelCfg.riverCount && attempts < maxAttempts) {
            attempts++;
            const long = levelCfg.riverLengthMin + Math.random() * levelCfg.riverLengthRand;
            const wide = levelCfg.riverWidthMin + Math.random() * levelCfg.riverWidthRand;
            const horizontal = Math.random() < 0.5;
            const sx1 = horizontal ? long : wide;
            const sz1 = horizontal ? wide : long;
            const x1 = chunkCenterX + (Math.random() - 0.5) * levelCfg.chunkSize;
            const z1 = chunkCenterZ + (Math.random() - 0.5) * levelCfg.chunkSize;
            if (!this.isRiverSegmentValid(x1, z1, sx1, sz1, blockBoxes)) continue;

            const wantL = Math.random() < levelCfg.riverLShapeChance;
            let secondSeg = null;
            if (wantL) {
                const long2 = levelCfg.riverLengthMin + Math.random() * levelCfg.riverLengthRand;
                const sx2 = horizontal ? wide : long2;
                const sz2 = horizontal ? long2 : wide;
                const endSign = Math.random() < 0.5 ? -1 : 1;
                const sideSign = Math.random() < 0.5 ? -1 : 1;
                let x2, z2;
                if (horizontal) {
                    x2 = x1 + endSign * (sx1 / 2 - wide / 2);
                    z2 = z1 + sideSign * (long2 / 2 - wide / 2);
                } else {
                    x2 = x1 + sideSign * (long2 / 2 - wide / 2);
                    z2 = z1 + endSign * (sz1 / 2 - wide / 2);
                }
                const box1 = this.makeRiverBox(x1, z1, sx1, sz1);
                if (this.isRiverSegmentValid(x2, z2, sx2, sz2, blockBoxes, box1)) {
                    secondSeg = { x: x2, z: z2, sx: sx2, sz: sz2 };
                }
            }

            const block1 = this.createBlock('river', sx1, sy, sz1, x1, z1, chunkX, chunkZ);
            this.blocks.push(block1);
            blockBoxes.push(this.makeRiverBox(x1, z1, sx1, sz1));
            if (secondSeg) {
                const block2 = this.createBlock('river', secondSeg.sx, sy, secondSeg.sz, secondSeg.x, secondSeg.z, chunkX, chunkZ);
                this.blocks.push(block2);
                blockBoxes.push(this.makeRiverBox(secondSeg.x, secondSeg.z, secondSeg.sx, secondSeg.sz));
            }
            placed++;
        }
    }

    createBlock(type, sx, sy, sz, x, z, chunkX, chunkZ) {
        const config = this.getTypeConfig(type);
        let mesh;

        if (type === 'slime' || type === 'fire') {
            const geo = new THREE.CircleGeometry(Math.max(sx, sz) * 0.55, 28);
            const mat = new THREE.MeshBasicMaterial({
                color: config.color,
                transparent: true,
                opacity: type === 'slime' ? 0.55 : 0.65,
                side: THREE.DoubleSide
            });
            mesh = new THREE.Mesh(geo, mat);
            mesh.rotation.x = -Math.PI / 2;
            mesh.scale.set(sx / Math.max(sx, sz), sz / Math.max(sx, sz), 1);
            mesh.position.set(x, 0.04, z);
        } else {
            const geo = new THREE.BoxGeometry(sx, sy, sz);
            const mat = new THREE.MeshLambertMaterial({ color: config.color });
            mesh = new THREE.Mesh(geo, mat);
            mesh.position.set(x, sy / 2, z);
            mesh.castShadow = true;
            mesh.receiveShadow = true;
        }

        this.scene.add(mesh);

        const volume = sx * Math.max(1, sy) * sz;
        const maxHP = config.destructible ? volume * CONFIG.stats.structureHPBase : Infinity;

        return {
            mesh,
            type,
            hp: maxHP,
            maxHP,
            solid: config.solid,
            blocksProjectile: config.blocksProjectile !== undefined ? config.blocksProjectile : !!config.solid,
            destructible: config.destructible,
            hazard: config.hazard,
            slowFactor: config.slowFactor || 1,
            damagePerSecond: config.damagePerSecond || 0,
            width: sx,
            depth: sz,
            chunkX,
            chunkZ,
            isDead: false,
            flashTimer: 0,
            hazardTimer: 0,
            fireParticleTimer: type === 'fire' ? Math.random() * CONFIG.terrain.fireParticleInterval : 0,
            id: Math.random().toString(36).substr(2, 9)
        };
    }

    getTypeConfig(type) {
        if (type === 'solid') {
            return { color: 0x2f3640, solid: true, destructible: false };
        }
        if (type === 'slime') {
            return { color: 0x7a4b22, solid: false, destructible: false, hazard: 'slime', slowFactor: CONFIG.terrain.slimeSlowFactor };
        }
        if (type === 'fire') {
            return { color: 0xff5a18, solid: false, destructible: false, hazard: 'fire', damagePerSecond: CONFIG.terrain.fireDamagePerSecond };
        }
        if (type === 'river') {
            return { color: 0x2a5b87, solid: true, destructible: false, blocksProjectile: false };
        }
        return { color: 0x888888, solid: true, destructible: true };
    }

    checkCollisions(bullets) {
        const box = new THREE.Box3();
        bullets.forEach(b => {
            if (b.markedForDeletion) return;
            if (b.damage <= 0) return;

            for (let block of this.blocks) {
                if (block.isDead || !block.blocksProjectile) continue;

                box.setFromObject(block.mesh);
                if (box.containsPoint(b.mesh.position)) {
                    if (b.hitEntities.has(block.id)) continue;
                    b.hitEntities.add(block.id);

                    const didDamage = this.damageBlock(block, b.damage, b.attackerDragon);
                    if (b.onImpact) b.onImpact(b);

                    b.markedForDeletion = true;
                    b.penetration = -1;
                    if (didDamage && !b.isEnemy && b.attackerDragon && b.attackerDragon.buffSystem) {
                        b.attackerDragon.buffSystem.onEffectiveDamage(b.damage);
                    }
                    break;
                }
            }
        });
    }

    damageBlock(block, amount, sourceDragon = null) {
        if (!block || block.isDead || !block.destructible) {
            if (block && block.mesh && block.mesh.material && block.mesh.material.emissive) {
                block.flashTimer = 0.06;
            }
            return false;
        }

        block.hp -= amount;
        block.flashTimer = 0.1;
        if (block.hp <= 0) {
            block.isDead = true;
            const pos = block.mesh.position.clone();
            this.disposeBlock(block);
            this.spawnDebris(pos);
            this.rewardDestructibleBreak(sourceDragon, pos);
        }
        return true;
    }

    update(dt) {
        // 以場上第一隻活著的龍為 chunk 中心；若都掛了就停留原處
        const center = (state.dragons || []).find(d => d && !d.isDead);
        if (center) {
            this.generateAroundPosition(center.mesh.position);
            this.cleanupFarChunks(center.mesh.position);
        }

        this.blocks.forEach(b => {
            if (b.isDead) return;
            if (b.flashTimer > 0 && b.mesh.material && b.mesh.material.emissive) {
                b.flashTimer -= dt;
                b.mesh.material.emissive.setHex(b.flashTimer > 0 ? 0xff0000 : 0x000000);
            }

            if (b.type === 'fire') {
                const pulse = 0.55 + Math.sin(Date.now() * 0.01 + b.mesh.position.x) * 0.15;
                b.mesh.material.opacity = pulse;
                b.mesh.rotation.z += dt * 0.35;
                b.fireParticleTimer -= dt;
                while (b.fireParticleTimer <= 0) {
                    b.fireParticleTimer += CONFIG.terrain.fireParticleInterval * (0.75 + Math.random() * 0.5);
                    for (let i = 0; i < CONFIG.terrain.fireParticleBurstCount; i++) {
                        this.spawnFireParticle(b);
                    }
                }
            }
            if (b.type === 'slime') {
                b.mesh.rotation.z += dt * 0.2;
            }
        });
        this.updateHealItems(dt);
        this.updateMysteryBoxes(dt);
    }

    createArenaVisuals() {
        const levelCfg = CONFIG.level;
        const arenaSize = levelCfg.arenaHalfSize * 2;
        const waterSize = arenaSize + levelCfg.arenaWaterWidth * 2;

        const waterGeo = new THREE.PlaneGeometry(waterSize, waterSize, 1, 1);
        const waterMat = new THREE.MeshBasicMaterial({
            color: 0x0b5d83,
            transparent: true,
            opacity: 0.78,
            side: THREE.DoubleSide
        });
        const water = new THREE.Mesh(waterGeo, waterMat);
        water.rotation.x = -Math.PI / 2;
        water.position.y = -0.08;
        this.scene.add(water);
        this.arenaVisuals.push(water);

        const groundGeo = new THREE.PlaneGeometry(arenaSize, arenaSize, 1, 1);
        const groundMat = new THREE.MeshLambertMaterial({ color: 0x303631 });
        const ground = new THREE.Mesh(groundGeo, groundMat);
        ground.rotation.x = -Math.PI / 2;
        ground.position.y = -0.04;
        ground.receiveShadow = true;
        this.scene.add(ground);
        this.arenaVisuals.push(ground);

        const shoreMat = new THREE.MeshBasicMaterial({
            color: 0x5ed0ff,
            transparent: true,
            opacity: 0.32,
            side: THREE.DoubleSide
        });
        const shoreThickness = 0.5;
        const makeShore = (sx, sz, x, z) => {
            const geo = new THREE.PlaneGeometry(sx, sz, 1, 1);
            const mesh = new THREE.Mesh(geo, shoreMat.clone());
            mesh.rotation.x = -Math.PI / 2;
            mesh.position.set(x, 0.018, z);
            this.scene.add(mesh);
            this.arenaVisuals.push(mesh);
        };
        makeShore(arenaSize, shoreThickness, 0, levelCfg.arenaHalfSize);
        makeShore(arenaSize, shoreThickness, 0, -levelCfg.arenaHalfSize);
        makeShore(shoreThickness, arenaSize, levelCfg.arenaHalfSize, 0);
        makeShore(shoreThickness, arenaSize, -levelCfg.arenaHalfSize, 0);
    }

    resetHealItemTimer() {
        const levelCfg = CONFIG.level;
        this.healItemTimer = levelCfg.healItemSpawnIntervalMin + Math.random() * levelCfg.healItemSpawnIntervalRand;
    }

    updateHealItems(dt) {
        const levelCfg = CONFIG.level;
        this.healItemTimer -= dt;
        if (this.healItemTimer <= 0) {
            this.resetHealItemTimer();
            if (this.healItems.length < levelCfg.healItemMaxCount) {
                const pos = this.findHealItemSpawnPosition();
                if (pos) this.spawnHealItem(pos);
            }
        }

        for (let i = this.healItems.length - 1; i >= 0; i--) {
            const item = this.healItems[i];
            if (!item || item.isDead) continue;
            item.life += dt;
            item.group.rotation.y += dt * 1.8;
            item.group.position.y = 0.62 + Math.sin(item.life * 4.2) * 0.1;
            const pulse = 1 + Math.sin(item.life * 5.5) * 0.08;
            item.core.scale.setScalar(pulse);
            item.ring.scale.setScalar(1.0 + Math.sin(item.life * 4.5) * 0.06);

            const pickupRadiusSq = levelCfg.healItemPickupRadius * levelCfg.healItemPickupRadius;
            const picker = (state.dragons || []).find(dragon => {
                if (!dragon || dragon.isDead || !dragon.mesh.visible) return false;
                const dx = dragon.mesh.position.x - item.group.position.x;
                const dz = dragon.mesh.position.z - item.group.position.z;
                return dx * dx + dz * dz <= pickupRadiusSq;
            });
            if (!picker) continue;

            picker.heal(picker.maxHP * levelCfg.healItemHealPct);
            this.spawnHealBurst(item.group.position.clone(), 0x56ff86);
            item.isDead = true;
            this.disposeHealItem(item);
            this.healItems.splice(i, 1);
        }
    }

    findHealItemSpawnPosition() {
        const levelCfg = CONFIG.level;
        const limit = levelCfg.arenaHalfSize - levelCfg.arenaSpawnMargin;
        for (let attempt = 0; attempt < 80; attempt++) {
            const pos = new THREE.Vector3(
                (Math.random() * 2 - 1) * limit,
                0,
                (Math.random() * 2 - 1) * limit
            );
            if (pos.x * pos.x + pos.z * pos.z < levelCfg.safeRadius * levelCfg.safeRadius) continue;
            let blocked = false;
            this.blocks.forEach(block => {
                if (blocked || block.isDead || !block.solid) return;
                if (this.isPointInsideBlockFootprint(pos, block, 1.4)) blocked = true;
            });
            if (blocked) continue;
            this.healItems.forEach(item => {
                if (blocked || item.isDead) return;
                if (item.group.position.distanceTo(pos) < 5) blocked = true;
            });
            if (blocked) continue;
            return pos;
        }
        return null;
    }

    spawnHealItem(pos) {
        const group = new THREE.Group();
        group.position.set(pos.x, 0.62, pos.z);

        const coreMat = new THREE.MeshBasicMaterial({
            color: 0x44ff77,
            transparent: true,
            opacity: 0.82
        });
        const core = new THREE.Mesh(new THREE.SphereGeometry(0.42, 14, 10), coreMat);
        group.add(core);

        const ring = new THREE.Mesh(
            new THREE.TorusGeometry(0.62, 0.045, 8, 28),
            new THREE.MeshBasicMaterial({ color: 0xc8ffd7, transparent: true, opacity: 0.75 })
        );
        ring.rotation.x = Math.PI / 2;
        group.add(ring);

        const plusMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
        const plusA = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.72, 0.12), plusMat);
        const plusB = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.18, 0.12), plusMat.clone());
        plusA.position.z = 0.43;
        plusB.position.z = 0.43;
        group.add(plusA);
        group.add(plusB);

        this.scene.add(group);
        this.healItems.push({
            group,
            core,
            ring,
            life: Math.random() * Math.PI * 2,
            isDead: false
        });
    }

    disposeHealItem(item) {
        if (!item || !item.group) return;
        if (item.group.parent) this.scene.remove(item.group);
        item.group.traverse(obj => {
            if (obj.geometry) obj.geometry.dispose();
            if (obj.material) obj.material.dispose();
        });
    }

    spawnInitialMysteryBoxes() {
        const levelCfg = CONFIG.level;
        const target = Math.min(levelCfg.mysteryBoxInitialCount || 0, levelCfg.mysteryBoxMaxCount);
        for (let i = this.mysteryBoxes.length; i < target; i++) {
            const pos = this.findHealItemSpawnPosition();
            if (!pos) break;
            this.spawnMysteryBox(pos);
        }
    }

    resetMysteryBoxTimer() {
        const levelCfg = CONFIG.level;
        this.mysteryBoxTimer = levelCfg.mysteryBoxSpawnIntervalMin + Math.random() * levelCfg.mysteryBoxSpawnIntervalRand;
    }

    updateMysteryBoxes(dt) {
        const levelCfg = CONFIG.level;
        this.mysteryBoxTimer -= dt;
        if (this.mysteryBoxTimer <= 0) {
            this.resetMysteryBoxTimer();
            if (this.mysteryBoxes.length < levelCfg.mysteryBoxMaxCount) {
                const pos = this.findHealItemSpawnPosition();
                if (pos) this.spawnMysteryBox(pos);
            }
        }

        for (let i = this.mysteryBoxes.length - 1; i >= 0; i--) {
            const item = this.mysteryBoxes[i];
            if (!item || item.isDead) continue;
            item.life += dt;
            item.group.rotation.y += dt * 1.4;
            item.group.position.y = 0.85 + Math.sin(item.life * 3.2) * 0.12;

            const pickupRadiusSq = levelCfg.mysteryBoxPickupRadius * levelCfg.mysteryBoxPickupRadius;
            const picker = (state.dragons || []).find(dragon => {
                if (!dragon || dragon.isDead || !dragon.mesh.visible) return false;
                const dx = dragon.mesh.position.x - item.group.position.x;
                const dz = dragon.mesh.position.z - item.group.position.z;
                return dx * dx + dz * dz <= pickupRadiusSq;
            });
            if (!picker) continue;

            this.spawnHealBurst(item.group.position.clone(), 0xffe066);
            item.isDead = true;
            this.disposeMysteryBox(item);
            this.mysteryBoxes.splice(i, 1);
            if (typeof state.onMysteryBoxPickup === 'function') {
                state.onMysteryBoxPickup(picker);
            }
        }
    }

    spawnMysteryBox(pos) {
        const group = new THREE.Group();
        group.position.set(pos.x, 0.85, pos.z);

        const cubeMat = new THREE.MeshBasicMaterial({ color: 0xb55cff, transparent: true, opacity: 0.9 });
        const cube = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.85, 0.85), cubeMat);
        group.add(cube);

        const edgeGeo = new THREE.EdgesGeometry(cube.geometry);
        const edgeMat = new THREE.LineBasicMaterial({ color: 0xfff2a6 });
        const edges = new THREE.LineSegments(edgeGeo, edgeMat);
        group.add(edges);

        const qMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
        const top = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.10, 0.04), qMat);
        const right = new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.18, 0.04), qMat.clone());
        const mid = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.10, 0.04), qMat.clone());
        const stem = new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.18, 0.04), qMat.clone());
        const dot = new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.10, 0.04), qMat.clone());
        top.position.set(0, 0.30, 0.44);
        right.position.set(0.13, 0.16, 0.44);
        mid.position.set(-0.04, 0.02, 0.44);
        stem.position.set(-0.04, -0.14, 0.44);
        dot.position.set(-0.04, -0.34, 0.44);
        group.add(top); group.add(right); group.add(mid); group.add(stem); group.add(dot);

        this.scene.add(group);
        this.mysteryBoxes.push({
            group,
            life: Math.random() * Math.PI * 2,
            isDead: false
        });
    }

    disposeMysteryBox(item) {
        if (!item || !item.group) return;
        if (item.group.parent) this.scene.remove(item.group);
        item.group.traverse(obj => {
            if (obj.geometry) obj.geometry.dispose();
            if (obj.material) obj.material.dispose();
        });
    }

    rewardDestructibleBreak(sourceDragon, pos) {
        if (!sourceDragon || sourceDragon.isDead || !sourceDragon.heal) return;
        sourceDragon.heal(sourceDragon.maxHP * CONFIG.stats.destructibleHealPct);
        this.spawnHealBurst(pos, 0x7cff9a);
    }

    cleanupFarChunks(position) {
        const levelCfg = CONFIG.level;
        const centerX = this.getChunkCoord(position.x);
        const centerZ = this.getChunkCoord(position.z);
        const keepRadius = levelCfg.cleanupRadiusChunks;

        this.blocks.forEach(b => {
            if (b.isDead) return;
            if (Math.abs(b.chunkX - centerX) <= keepRadius && Math.abs(b.chunkZ - centerZ) <= keepRadius) return;
            b.isDead = true;
            this.disposeBlock(b);
        });
        this.blocks = this.blocks.filter(b => !b.isDead);

        Array.from(this.generatedChunks).forEach(key => {
            const [chunkX, chunkZ] = key.split(',').map(Number);
            if (Math.abs(chunkX - centerX) <= keepRadius && Math.abs(chunkZ - centerZ) <= keepRadius) return;
            this.generatedChunks.delete(key);
        });
    }

    getSpeedFactor(pos) {
        let factor = 1.0;
        this.blocks.forEach(b => {
            if (b.isDead || b.hazard !== 'slime') return;
            if (this.isPointInsideBlockFootprint(pos, b, 0.8)) {
                factor = Math.min(factor, b.slowFactor);
            }
        });
        return factor;
    }

    applyHazardsToPlayer(gidora, dt) {
        this.blocks.forEach(b => {
            if (b.isDead || b.hazard !== 'fire') return;
            if (!this.isPointInsideBlockFootprint(gidora.mesh.position, b, 0.8)) return;
            gidora.takeDamage(b.damagePerSecond * dt, b.mesh.position, 0);
        });
    }

    applyHazardsToEnemy(enemy, dt) {
        this.blocks.forEach(b => {
            if (b.isDead || !b.hazard) return;
            if (!this.isPointInsideBlockFootprint(enemy.mesh.position, b, 0.6)) return;
            if (b.hazard === 'slime' && enemy.applySlow) {
                enemy.applySlow(b.slowFactor, 0.25);
            }
            if (b.hazard === 'fire') {
                enemy.takeDamage(b.damagePerSecond * dt, b.mesh.position, 0);
            }
        });
    }

    isPointInsideBlockFootprint(pos, block, padding) {
        const width = block.width || block.mesh.geometry.parameters.width || 2;
        const depth = block.depth || block.mesh.geometry.parameters.depth || 2;
        return pos.x > block.mesh.position.x - width / 2 - padding &&
            pos.x < block.mesh.position.x + width / 2 + padding &&
            pos.z > block.mesh.position.z - depth / 2 - padding &&
            pos.z < block.mesh.position.z + depth / 2 + padding;
    }

    disposeBlock(block) {
        if (!block || !block.mesh) return;
        if (block.mesh.parent) this.scene.remove(block.mesh);
        if (block.mesh.geometry) block.mesh.geometry.dispose();
        if (block.mesh.material) block.mesh.material.dispose();
    }

    isInsideArenaXZ(x, z, padding = 0) {
        const limit = Math.max(0, CONFIG.level.arenaHalfSize - padding);
        return x >= -limit && x <= limit && z >= -limit && z <= limit;
    }

    clampPositionToArena(pos, padding = 0) {
        const limit = Math.max(0, CONFIG.level.arenaHalfSize - padding);
        const beforeX = pos.x;
        const beforeZ = pos.z;
        pos.x = THREE.MathUtils.clamp(pos.x, -limit, limit);
        pos.z = THREE.MathUtils.clamp(pos.z, -limit, limit);
        return {
            x: pos.x !== beforeX,
            z: pos.z !== beforeZ
        };
    }

    isChunkWithinArena(chunkX, chunkZ) {
        const levelCfg = CONFIG.level;
        const centerX = chunkX * levelCfg.chunkSize;
        const centerZ = chunkZ * levelCfg.chunkSize;
        const halfChunk = levelCfg.chunkSize * 0.5;
        return Math.abs(centerX) - halfChunk <= levelCfg.arenaHalfSize &&
            Math.abs(centerZ) - halfChunk <= levelCfg.arenaHalfSize;
    }

    getChunkCoord(value) {
        return Math.round(value / CONFIG.level.chunkSize);
    }

    getChunkKey(chunkX, chunkZ) {
        return `${chunkX},${chunkZ}`;
    }

    getExistingBoxesNearChunk(chunkX, chunkZ) {
        const boxes = [];
        this.blocks.forEach(block => {
            if (block.isDead) return;
            if (Math.abs(block.chunkX - chunkX) > 1 || Math.abs(block.chunkZ - chunkZ) > 1) return;
            const width = block.width || block.mesh.geometry.parameters.width || 2;
            const depth = block.depth || block.mesh.geometry.parameters.depth || 2;
            const box = new THREE.Box3();
            box.min.set(
                block.mesh.position.x - width / 2 - CONFIG.level.spacingPadding,
                0,
                block.mesh.position.z - depth / 2 - CONFIG.level.spacingPadding
            );
            box.max.set(
                block.mesh.position.x + width / 2 + CONFIG.level.spacingPadding,
                Math.max(0.2, block.mesh.position.y * 2),
                block.mesh.position.z + depth / 2 + CONFIG.level.spacingPadding
            );
            boxes.push(box);
        });
        return boxes;
    }

    spawnDebris(pos) {
        const count = 5;
        for (let i = 0; i < count; i++) {
            state.particles.push(new Particle(pos, 0x555555));
        }
    }

    spawnHealBurst(pos, color) {
        for (let i = 0; i < 8; i++) {
            const p = new Particle(pos.clone(), color);
            p.life = 0.35 + Math.random() * 0.2;
            p.maxLife = p.life;
            p.mesh.scale.setScalar(0.55 + Math.random() * 0.35);
            state.particles.push(p);
        }
    }

    spawnFireParticle(block) {
        if (!block || !block.mesh || block.isDead) return;

        const radiusX = Math.max(0.4, block.width * 0.45);
        const radiusZ = Math.max(0.4, block.depth * 0.45);
        const angle = Math.random() * Math.PI * 2;
        const r = Math.sqrt(Math.random());
        const pos = block.mesh.position.clone();
        pos.x += Math.cos(angle) * r * radiusX;
        pos.z += Math.sin(angle) * r * radiusZ;
        pos.y = 0.12;

        const height = 0.75 + Math.random() * 0.85;
        const baseRadius = 0.13 + Math.random() * 0.11;
        const geo = new THREE.ConeGeometry(baseRadius, height, 5);
        const colors = [0xfff06a, 0xffb629, 0xff671f, 0xff2d12];
        const color = colors[Math.floor(Math.random() * colors.length)];
        const mat = new THREE.MeshBasicMaterial({
            color,
            transparent: true,
            opacity: 0.92,
            side: THREE.DoubleSide
        });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.copy(pos);
        mesh.position.y += height * 0.5;
        mesh.rotation.y = Math.random() * Math.PI * 2;
        scene.add(mesh);

        const life = CONFIG.terrain.fireParticleLife * (0.75 + Math.random() * 0.55);
        const drift = new THREE.Vector3(
            (Math.random() - 0.5) * 0.9,
            1.2 + Math.random() * 1.8,
            (Math.random() - 0.5) * 0.9
        );
        const startScale = 0.75 + Math.random() * 0.45;
        mesh.scale.set(startScale, startScale, startScale);

        state.particles.push({
            life,
            maxLife: life,
            mesh,
            update(dt) {
                this.life -= dt;
                const t = 1 - this.life / this.maxLife;
                this.mesh.position.add(drift.clone().multiplyScalar(dt));
                this.mesh.rotation.y += dt * (2.5 + t * 3.5);
                this.mesh.scale.set(
                    startScale * (1.1 - t * 0.45),
                    startScale * (1 + t * 0.9),
                    startScale * (1.1 - t * 0.45)
                );
                this.mesh.material.opacity = Math.max(0, (1 - t) * 0.92);
                if (this.life <= 0) {
                    scene.remove(this.mesh);
                    this.mesh.geometry.dispose();
                    this.mesh.material.dispose();
                    return false;
                }
                return true;
            }
        });

        if (Math.random() < 0.22) this.spawnFireSmoke(block, pos);
    }

    spawnFireSmoke(block, pos) {
        const geo = new THREE.SphereGeometry(0.18 + Math.random() * 0.12, 8, 6);
        const mat = new THREE.MeshBasicMaterial({
            color: 0x33251f,
            transparent: true,
            opacity: 0.28
        });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.copy(pos);
        mesh.position.y = 0.35 + Math.random() * 0.25;
        scene.add(mesh);

        const life = 0.8 + Math.random() * 0.5;
        const drift = new THREE.Vector3(
            (Math.random() - 0.5) * 0.55,
            0.7 + Math.random() * 0.5,
            (Math.random() - 0.5) * 0.55
        );
        state.particles.push({
            life,
            maxLife: life,
            mesh,
            update(dt) {
                this.life -= dt;
                const t = 1 - this.life / this.maxLife;
                this.mesh.position.add(drift.clone().multiplyScalar(dt));
                this.mesh.scale.setScalar(1 + t * 2.4);
                this.mesh.material.opacity = Math.max(0, 0.24 * (1 - t));
                if (this.life <= 0) {
                    scene.remove(this.mesh);
                    this.mesh.geometry.dispose();
                    this.mesh.material.dispose();
                    return false;
                }
                return true;
            }
        });
    }
}
