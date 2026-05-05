// =====================================================================
// bullet.js — 子彈、粒子、噴飛屍體、肉塊
// 依賴: window.scene, state, CONFIG
// =====================================================================

class Bullet {
    constructor(owner, position, direction, speed, life, gravity, size, stats = {}) {
        this.owner = owner;
        this.isEnemy = (owner === 'enemy');
        // PVP：發射來源三頭龍 (Gidora)；後續可由建立者填入。
        // 用來判斷子彈屬於哪一隻龍，避免打到自己；也用於 onEffectiveDamage 路由。
        this.attackerDragon = stats.attackerDragon || null;

        if (direction && direction.clone) {
            this.direction = direction.clone();
        } else {
            console.error("Bullet created with invalid direction:", direction);
            this.direction = new THREE.Vector3(0, 0, 1);
        }

        this.velocity = this.direction.clone().multiplyScalar(speed);
        this.speed = speed;
        this.gravity = gravity;
        this.maxLife = life;
        this.lifeTimer = 0;
        this.markedForDeletion = false;

        this.damage = stats.damage || 5;
        this.penetration = stats.penetration || 0;
        this.knockback = stats.knockback;
        this.hitEntities = new Set();

        this.isHoming = stats.isHoming || false;
        this.homingTarget = stats.target || null;
        this.homingStrength = stats.homingStrength || 5.0;
        this.targetPoint = stats.targetPoint || null;
        this.explodeRadius = stats.explodeRadius || 0;
        this.onImpact = stats.onImpact || null;

        let color;
        if (stats.color) color = stats.color;
        else if (owner === 'merged' || owner === 'quad' || owner === 'trio' || owner === 'duo') color = 0xffff00;
        else if (CONFIG.visuals.colors[owner]) color = CONFIG.visuals.colors[owner];
        else color = 0xffff00;

        let geo;
        this.isRotator = false;
        this.size = size;
        this.hasTrail = (owner === 'quad' || owner === 'trio' || owner === 'duo');
        this.trailTimer = 0;

        if (owner === 'quad') {
            geo = new THREE.OctahedronGeometry(size, 0);
            this.isRotator = true;
            this.rotationSpeed = 8.0;
        } else if (owner === 'trio') {
            geo = new THREE.IcosahedronGeometry(size, 0);
            this.isRotator = true;
            this.rotationSpeed = 4.0;
        } else {
            geo = new THREE.SphereGeometry(size);
        }

        const mat = new THREE.MeshBasicMaterial({ color: color, wireframe: false });
        this.mesh = new THREE.Mesh(geo, mat);
        this.mesh.position.copy(position);

        if (this.isRotator) {
            this.mesh.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
        }

        scene.add(this.mesh);

        const shadowGeo = new THREE.CircleGeometry(size, 8);
        const shadowMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.5 });
        this.shadowMesh = new THREE.Mesh(shadowGeo, shadowMat);
        this.shadowMesh.rotation.x = -Math.PI / 2;
        this.shadowMesh.position.set(position.x, 0.02, position.z);
        scene.add(this.shadowMesh);
    }

    update(dt) {
        if (this.gravity !== 0) this.velocity.y -= this.gravity * dt;
        this.mesh.position.add(this.velocity.clone().multiplyScalar(dt));

        if (this.isHoming && this.homingTarget && !this.homingTarget.markedForDeletion) {
            const targetPos = this.homingTarget.position ? this.homingTarget.position : this.homingTarget;
            const currentDir = this.velocity.clone().normalize();
            const targetDir = targetPos.clone().sub(this.mesh.position).normalize();
            currentDir.lerp(targetDir, this.homingStrength * dt);
            currentDir.normalize();
            this.velocity = currentDir.multiplyScalar(this.speed);
        }

        this.shadowMesh.position.x = this.mesh.position.x;
        this.shadowMesh.position.z = this.mesh.position.z;

        this.lifeTimer += dt;
        if (this.lifeTimer >= this.maxLife) this.markedForDeletion = true;
        if (this.mesh.position.y < 0) this.markedForDeletion = true;
        if (this.targetPoint && this.mesh.position.distanceTo(this.targetPoint) < Math.max(0.5, this.size + 0.3)) {
            if (this.onImpact) this.onImpact(this);
            this.markedForDeletion = true;
        }

        if (this.isRotator) {
            this.mesh.rotation.x += this.rotationSpeed * dt;
            this.mesh.rotation.y += this.rotationSpeed * dt;
        }

        if (this.hasTrail) {
            this.trailTimer += dt;
            if (this.trailTimer > 0.05) {
                this.trailTimer = 0;
                const pSize = this.size;
                const meshPos = this.mesh.position;
                state.particles.push({
                    life: 0.3, maxLife: 0.3,
                    mesh: (() => {
                        const m = new THREE.Mesh(
                            new THREE.BoxGeometry(pSize * 0.3, pSize * 0.3, pSize * 0.3),
                            new THREE.MeshBasicMaterial({ color: 0xffff00, transparent: true, opacity: 0.5 })
                        );
                        m.position.copy(meshPos);
                        scene.add(m);
                        return m;
                    })(),
                    velocity: new THREE.Vector3(0, 0, 0),
                    update(dt) {
                        this.life -= dt;
                        const s = this.life / this.maxLife;
                        this.mesh.scale.set(s, s, s);
                        this.mesh.rotation.x += 5 * dt;
                        if (this.life <= 0) { scene.remove(this.mesh); return false; }
                        return true;
                    }
                });
            }
        }
    }

    destroy() {
        scene.remove(this.mesh);
        this.mesh.geometry.dispose();
        this.mesh.material.dispose();
        scene.remove(this.shadowMesh);
        this.shadowMesh.geometry.dispose();
        this.shadowMesh.material.dispose();
    }
}

class Particle {
    constructor(position, color) {
        this.life = 0.5;
        this.maxLife = 0.5;
        this.velocity = new THREE.Vector3(
            (Math.random() - 0.5) * 10,
            (Math.random() - 0.5) * 10,
            (Math.random() - 0.5) * 10
        );

        const geo = new THREE.BoxGeometry(0.2, 0.2, 0.2);
        const mat = new THREE.MeshBasicMaterial({ color: color });
        this.mesh = new THREE.Mesh(geo, mat);
        this.mesh.position.copy(position);
        scene.add(this.mesh);
    }

    update(dt) {
        this.life -= dt;
        this.mesh.position.add(this.velocity.clone().multiplyScalar(dt));
        this.mesh.rotation.x += dt * 5;
        this.mesh.rotation.y += dt * 5;

        const s = this.life / this.maxLife;
        this.mesh.scale.set(s, s, s);

        if (this.life <= 0) {
            scene.remove(this.mesh);
            this.mesh.geometry.dispose();
            this.mesh.material.dispose();
            return false;
        }
        return true;
    }
}

class FlyingCorpse {
    constructor(mesh, color, onLand) {
        this.mesh = mesh;
        this.color = color;
        this.onLand = onLand || null;
        this.isDone = false;

        const angle = Math.random() * Math.PI * 2;
        const hSpeed = 16 + Math.random() * 6;
        this.velocity = new THREE.Vector3(
            Math.cos(angle) * hSpeed,
            16 + Math.random() * 5,
            Math.sin(angle) * hSpeed
        );
        this.gravity = 30;
        this.drag = 1.2;
        this.rotVel = new THREE.Vector3(
            (Math.random() - 0.5) * 18,
            (Math.random() - 0.5) * 18,
            (Math.random() - 0.5) * 18
        );
        this.trailTimer = 0;

        const shadowGeo = new THREE.CircleGeometry(1.0, 12);
        const shadowMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.5 });
        this.shadowMesh = new THREE.Mesh(shadowGeo, shadowMat);
        this.shadowMesh.rotation.x = -Math.PI / 2;
        this.shadowMesh.position.set(mesh.position.x, 0.02, mesh.position.z);
        scene.add(this.shadowMesh);

        this._spawnRing(mesh.position.clone(), 0xffcc00, 2.5);
    }

    _spawnRing(pos, color, expandScale) {
        const ringGeo = new THREE.RingGeometry(0.4, 0.8, 20);
        const ringMat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 1.0, side: THREE.DoubleSide });
        const ring = new THREE.Mesh(ringGeo, ringMat);
        ring.position.copy(pos);
        ring.rotation.x = -Math.PI / 2;
        scene.add(ring);
        let life = 0.3;
        const maxLife = 0.3;
        state.particles.push({
            update(dt) {
                life -= dt;
                if (life <= 0) {
                    scene.remove(ring);
                    ring.geometry.dispose();
                    ring.material.dispose();
                    return false;
                }
                const t = 1 - life / maxLife;
                const s = 1 + t * expandScale;
                ring.scale.set(s, s, s);
                ring.material.opacity = life / maxLife;
                return true;
            }
        });
    }

    update(dt) {
        if (this.isDone) return false;

        const dragFactor = Math.exp(-this.drag * dt);
        this.velocity.x *= dragFactor;
        this.velocity.z *= dragFactor;

        this.velocity.y -= this.gravity * dt;
        this.mesh.position.add(this.velocity.clone().multiplyScalar(dt));
        this.mesh.rotation.x += this.rotVel.x * dt;
        this.mesh.rotation.y += this.rotVel.y * dt;
        this.mesh.rotation.z += this.rotVel.z * dt;

        const heightAbove = Math.max(0, this.mesh.position.y - 1.0);
        const shadowScale = Math.max(0.25, 1.0 - heightAbove * 0.06);
        this.shadowMesh.position.x = this.mesh.position.x;
        this.shadowMesh.position.z = this.mesh.position.z;
        this.shadowMesh.scale.setScalar(shadowScale);
        this.shadowMesh.material.opacity = Math.max(0.08, 0.5 - heightAbove * 0.04);

        this.trailTimer -= dt;
        if (this.trailTimer <= 0) {
            this.trailTimer = 0.035;
            const spark = new Particle(this.mesh.position, Math.random() > 0.5 ? 0xff6600 : 0xffaa00);
            spark.velocity.multiplyScalar(0.3);
            spark.life = 0.15;
            spark.maxLife = 0.15;
            state.particles.push(spark);
        }

        if (this.mesh.position.y <= 1.0 && this.velocity.y < 0) {
            this.mesh.position.y = 1.0;
            this._land();
            return false;
        }
        return true;
    }

    _land() {
        this.isDone = true;
        const pos = this.mesh.position.clone();

        scene.remove(this.shadowMesh);
        this.shadowMesh.geometry.dispose();
        this.shadowMesh.material.dispose();

        scene.remove(this.mesh);
        this.mesh.geometry.dispose();
        this.mesh.material.dispose();

        this._spawnRing(pos, 0xffffff, 4.0);

        for (let i = 0; i < 18; i++) {
            const smoke = new Particle(pos, i < 9 ? 0x888888 : 0xaaaaaa);
            smoke.velocity.set(
                (Math.random() - 0.5) * 5,
                2 + Math.random() * 6,
                (Math.random() - 0.5) * 5
            );
            smoke.life = 0.7 + Math.random() * 0.5;
            smoke.maxLife = smoke.life;
            smoke.mesh.scale.setScalar(2.5 + Math.random() * 1.5);
            state.particles.push(smoke);
        }

        const count = 5 + Math.floor(Math.random() * 4);
        for (let i = 0; i < count; i++) {
            state.meatChunks.push(new MeatChunk(pos));
        }

        if (this.onLand) {
            const cb = this.onLand;
            let countdown = 1.0;
            state.particles.push({
                update(dt) {
                    countdown -= dt;
                    if (countdown <= 0) { cb(); return false; }
                    return true;
                }
            });
        }
    }
}

class MeatChunk {
    constructor(position) {
        const w = 0.25 + Math.random() * 0.3;
        const h = w * (0.4 + Math.random() * 0.4);
        const d = 0.25 + Math.random() * 0.3;
        const geo = new THREE.BoxGeometry(w, h, d);
        const meatColors = [0x8B2500, 0xA0381A, 0x7B1F00, 0xC0392B, 0x6B2500, 0x9B3A1A];
        const mat = new THREE.MeshLambertMaterial({ color: meatColors[Math.floor(Math.random() * meatColors.length)] });
        this.mesh = new THREE.Mesh(geo, mat);
        this.mesh.position.copy(position);
        this.mesh.position.y = 1.0;

        const angle = Math.random() * Math.PI * 2;
        const speed = 3 + Math.random() * 6;
        this.velocity = new THREE.Vector3(
            Math.cos(angle) * speed,
            3 + Math.random() * 5,
            Math.sin(angle) * speed
        );
        this.gravity = 28;
        this.rotVel = new THREE.Vector3(
            (Math.random() - 0.5) * 18,
            (Math.random() - 0.5) * 18,
            (Math.random() - 0.5) * 18
        );
        this.life = 3.0 + Math.random() * 1.5;
        this.maxLife = this.life;
        this.onGround = false;
        this.halfH = h / 2;

        scene.add(this.mesh);
    }

    update(dt) {
        this.life -= dt;
        if (this.life <= 0) {
            scene.remove(this.mesh);
            this.mesh.geometry.dispose();
            this.mesh.material.dispose();
            return false;
        }

        if (!this.onGround) {
            this.velocity.y -= this.gravity * dt;
            this.mesh.position.add(this.velocity.clone().multiplyScalar(dt));
            this.mesh.rotation.x += this.rotVel.x * dt;
            this.mesh.rotation.y += this.rotVel.y * dt;
            this.mesh.rotation.z += this.rotVel.z * dt;

            if (this.mesh.position.y <= this.halfH) {
                this.mesh.position.y = this.halfH;
                this.onGround = true;
            }
        }

        if (this.life < 1.0) {
            this.mesh.material.transparent = true;
            this.mesh.material.opacity = this.life;
        }

        return true;
    }
}

function updateBullets(dt) {
    for (let i = state.bullets.length - 1; i >= 0; i--) {
        const b = state.bullets[i];
        b.update(dt);
        if (b.markedForDeletion) {
            b.destroy();
            state.bullets.splice(i, 1);
        }
    }
}
