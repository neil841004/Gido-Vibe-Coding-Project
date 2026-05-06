// =====================================================================
// obstacles.js — 障礙物與地形效果
// 支援：不可通過可破壞、不可通過不可破壞、可通過緩速、可通過 DOT。
// =====================================================================

class LevelManager {
    constructor(scene) {
        this.scene = scene;
        this.blocks = [];
        this.generatedChunks = new Set();
        this.generateLevel();
    }

    generateLevel() {
        if (this.blocks) {
            this.blocks.forEach(b => this.disposeBlock(b));
        }
        this.blocks = [];
        this.generatedChunks.clear();
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

        specs.forEach(spec => {
            let attempts = 0;
            let generated = 0;
            while (generated < spec.count && attempts < levelCfg.maxAttemptsPerType) {
                attempts++;

                const isPatch = spec.type === 'slime' || spec.type === 'fire';
                const sx = isPatch
                    ? levelCfg.patchSizeMin + Math.random() * levelCfg.patchSizeRand
                    : levelCfg.solidSizeMin + Math.random() * levelCfg.solidSizeRand;
                const sy = isPatch
                    ? levelCfg.patchHeight
                    : levelCfg.solidHeightMin + Math.random() * levelCfg.solidHeightRand;
                const sz = isPatch
                    ? levelCfg.patchSizeMin + Math.random() * levelCfg.patchSizeRand
                    : levelCfg.solidSizeMin + Math.random() * levelCfg.solidSizeRand;
                const x = chunkCenterX + (Math.random() - 0.5) * levelCfg.chunkSize;
                const z = chunkCenterZ + (Math.random() - 0.5) * levelCfg.chunkSize;

                if (x * x + z * z < levelCfg.safeRadius * levelCfg.safeRadius) continue;

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
        return { color: 0x888888, solid: true, destructible: true };
    }

    checkCollisions(bullets) {
        const box = new THREE.Box3();
        bullets.forEach(b => {
            if (b.markedForDeletion) return;
            if (b.damage <= 0) return;

            for (let block of this.blocks) {
                if (block.isDead || !block.solid) continue;

                box.setFromObject(block.mesh);
                if (box.containsPoint(b.mesh.position)) {
                    if (b.hitEntities.has(block.id)) continue;
                    b.hitEntities.add(block.id);

                    const didDamage = this.damageBlock(block, b.damage);
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

    damageBlock(block, amount) {
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
