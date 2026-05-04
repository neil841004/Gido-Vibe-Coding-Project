// =====================================================================
// obstacles.js — 障礙物 (Phase 1 僅有可破壞方塊；Phase 2 將加入其他三種)
// =====================================================================

class LevelManager {
    constructor(scene) {
        this.scene = scene;
        this.blocks = [];
        this.generateLevel();
    }

    generateLevel() {
        const count = 20;
        const range = 40;

        if (this.blocks) {
            this.blocks.forEach(b => {
                this.scene.remove(b.mesh);
                b.mesh.geometry.dispose();
                b.mesh.material.dispose();
            });
        }
        this.blocks = [];
        const blockBoxes = [];

        let attempts = 0;
        while (this.blocks.length < count && attempts < 200) {
            attempts++;

            const sx = 2 + Math.random() * 3;
            const sy = 2 + Math.random() * 6;
            const sz = 2 + Math.random() * 3;

            const x = (Math.random() - 0.5) * range;
            const z = (Math.random() - 0.5) * range;

            if (x * x + z * z < 100) continue;

            const tempBox = new THREE.Box3();
            tempBox.min.set(x - sx / 2 - 0.5, 0, z - sz / 2 - 0.5);
            tempBox.max.set(x + sx / 2 + 0.5, sy, z + sz / 2 + 0.5);

            let overlap = false;
            for (let box of blockBoxes) {
                if (tempBox.intersectsBox(box)) { overlap = true; break; }
            }
            if (overlap) continue;

            const geo = new THREE.BoxGeometry(sx, sy, sz);
            const mat = new THREE.MeshLambertMaterial({ color: 0x888888 });
            const mesh = new THREE.Mesh(geo, mat);
            mesh.position.set(x, sy / 2, z);
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            this.scene.add(mesh);

            const volume = sx * sy * sz;
            const maxHP = volume * CONFIG.stats.structureHPBase;

            this.blocks.push({
                mesh, hp: maxHP, maxHP,
                isDead: false,
                flashTimer: 0,
                id: Math.random().toString(36).substr(2, 9)
            });
            blockBoxes.push(tempBox);
        }
    }

    checkCollisions(bullets) {
        const box = new THREE.Box3();
        bullets.forEach(b => {
            if (b.markedForDeletion) return;
            if (b.damage <= 0) return;

            for (let block of this.blocks) {
                if (block.isDead) continue;

                box.setFromObject(block.mesh);
                if (box.containsPoint(b.mesh.position)) {
                    if (b.hitEntities.has(block.id)) continue;
                    b.hitEntities.add(block.id);

                    block.hp -= b.damage;
                    block.flashTimer = 0.1;

                    b.markedForDeletion = true;
                    b.penetration = -1;

                    if (block.hp <= 0) {
                        block.isDead = true;
                        this.scene.remove(block.mesh);
                        block.mesh.geometry.dispose();
                        block.mesh.material.dispose();
                        this.spawnDebris(block.mesh.position, block.mesh.scale);
                    }

                    if (b.markedForDeletion) break;
                }
            }
        });
    }

    update(dt) {
        this.blocks.forEach(b => {
            if (b.isDead) return;
            if (b.flashTimer > 0) {
                b.flashTimer -= dt;
                b.mesh.material.emissive.setHex(b.flashTimer > 0 ? 0xff0000 : 0x000000);
            }
        });
    }

    spawnDebris(pos, scale) {
        const count = 5;
        for (let i = 0; i < count; i++) {
            state.particles.push(new Particle(pos, 0x555555));
        }
    }
}
