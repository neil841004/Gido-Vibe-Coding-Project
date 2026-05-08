// =====================================================================
// main.js — 場景建立、物件初始化、主迴圈 (≈ Unity GameManager + Camera)
// 所有依賴模組 (config / core / audio / bullet / obstacles / enemies /
// gidora / input / buffs / ui) 必須在本檔之前載入
// =====================================================================

// --- Scene / Camera / Renderer ---
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x333333);

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 20, 10);
camera.lookAt(0, 0, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
document.body.appendChild(renderer.domElement);

window.camera = camera;

// --- Lighting ---
const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
scene.add(ambientLight);

const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
dirLight.position.set(10, 20, 10);
dirLight.castShadow = true;
scene.add(dirLight);

// Ground grid
const gridSize = CONFIG.level.arenaHalfSize * 2;
const gridHelper = new THREE.GridHelper(gridSize, Math.max(10, Math.round(gridSize)), 0x555555, 0x444444);
gridHelper.position.y = 0.01;
scene.add(gridHelper);

function createDragon(index) {
    const dragon = new Gidora(index);
    state.dragons[index] = dragon;
    if (index === 0) window.gidoraInstance = dragon;
    return dragon;
}

function disposeSceneObject(obj) {
    if (!obj) return;
    if (obj.parent) obj.parent.remove(obj);
    if (obj.traverse) {
        obj.traverse(child => {
            if (child.geometry) child.geometry.dispose();
            if (child.material) {
                if (Array.isArray(child.material)) {
                    child.material.forEach(mat => {
                        if (mat.map) mat.map.dispose();
                        mat.dispose();
                    });
                } else {
                    if (child.material.map) child.material.map.dispose();
                    child.material.dispose();
                }
            }
        });
        return;
    }
    if (obj.geometry) obj.geometry.dispose();
    if (obj.material) obj.material.dispose();
}

function resetDragonForBattle(dragon, index, clearBuffs = false) {
    if (!dragon) return;
    const spawn = index === 1 ? CONFIG.pvp.dragonBSpawn : CONFIG.pvp.dragonASpawn;
    dragon.mesh.visible = true;
    dragon.mesh.position.set(spawn.x, 0, spawn.z);
    dragon.mesh.rotation.set(0, spawn.facingY || 0, 0);
    dragon.mesh.scale.set(1, 1, 1);
    dragon.velocity.set(0, 0, 0);
    dragon.knockbackVel.set(0, 0, 0);
    dragon.hp = CONFIG.stats.playerHP;
    dragon.maxHP = CONFIG.stats.playerHP;
    dragon.isDead = false;
    dragon.staggerValue = 0;
    dragon.staggerWindowTimer = 0;
    dragon.fallTimer = 0;
    dragon.standUpTimer = 0;
    dragon.standUpStartRotationX = 0;
    dragon.slowTimer = 0;
    dragon.slowFactor = 1.0;
    dragon.beamCharge = 0;
    dragon.beamPhase = 'idle';
    dragon.comboCooldown = 0;
    dragon.comboCooldownMax = CONFIG.combo.cooldown;
    dragon.cooldowns = { p1: 0, p2: 0, p3: 0, p4: 0 };
    dragon.attackStates = { p1: 'idle', p2: 'idle', p3: 'idle', p4: 'idle' };
    dragon.attackKinds = { p1: 'light', p2: 'light', p3: 'light', p4: 'light' };
    dragon.attackTimers = { p1: 0, p2: 0, p3: 0, p4: 0 };
    dragon.attackHoldTimers = { p1: 0, p2: 0, p3: 0, p4: 0 };
    dragon.attackReleaseQueued = { p1: false, p2: false, p3: false, p4: false };
    dragon.attackQueuedKinds = { p1: 'light', p2: 'light', p3: 'light', p4: 'light' };
    dragon.attackImpactDone = { p1: false, p2: false, p3: false, p4: false };
    dragon.recoveryBufferedPress = { p1: false, p2: false, p3: false, p4: false };
    dragon.lastAttackInput = { p1: false, p2: false, p3: false, p4: false };
    dragon.tailSweepStartY = dragon.mesh.rotation.y;
    dragon.tailSweepImpactDone = false;
    if (dragon.speedLines) {
        dragon.speedLines.forEach(line => disposeSceneObject(line.mesh));
        dragon.speedLines = [];
    }
    if (dragon.hideAllChargeIndicators) dragon.hideAllChargeIndicators();
    if (dragon.hideAllFlamethrowerIndicators) dragon.hideAllFlamethrowerIndicators();
    dragon._hideBeamFX();
    if (clearBuffs && dragon.buffSystem) dragon.buffSystem.clearAll();
    if (dragon.buffSystem) dragon.buffSystem.refreshPlayerStats();
}

function ensureEnemyDragon() {
    if (!state.dragons[1]) createDragon(1);
    state.enemyDragonEnabled = true;
    return state.dragons[1];
}

function removeEnemyDragon() {
    const dragon = state.dragons[1];
    if (!dragon) return;
    dragon.destroy();
    state.dragons[1] = null;
    state.enemyDragonEnabled = false;
    if (state.buffTarget === 1) state.buffTarget = 0;
}

function clearTransientBattleObjects() {
    state.bullets.forEach(b => b.destroy && b.destroy());
    state.bullets = [];
    if (state.enemyManager) {
        state.enemyManager.enemies.forEach(e => {
            if (e.hpBar && e.hpBar.destroy) e.hpBar.destroy();
            if (e.rangeRing && e.rangeRing.parent) {
                e.rangeRing.parent.remove(e.rangeRing);
                if (e.rangeRing.geometry) e.rangeRing.geometry.dispose();
                if (e.rangeRing.material) e.rangeRing.material.dispose();
            }
            if (e.mesh && e.mesh.parent) e.mesh.parent.remove(e.mesh);
            if (e.mesh && e.mesh.traverse) {
                e.mesh.traverse(child => {
                    if (child.geometry) child.geometry.dispose();
                    if (child.material) child.material.dispose();
                });
            }
        });
        state.enemyManager.enemies = [];
        state.enemyManager.spawnTimer = 0;
        state.enemyManager.bossDelayTimer = 0;
        state.enemyManager.bossSpawned = false;
    }
    state.particles.forEach(p => {
        disposeSceneObject(p.mesh);
        disposeSceneObject(p.ring);
        disposeSceneObject(p.shadowMesh);
    });
    state.particles = [];
    state.flyingCorpses.forEach(c => {
        disposeSceneObject(c.mesh);
        disposeSceneObject(c.shadowMesh);
    });
    state.flyingCorpses = [];
    state.meatChunks.forEach(m => {
        disposeSceneObject(m.mesh);
    });
    state.meatChunks = [];
}

function resetLevelForBattle() {
    if (!state.levelManager || !state.levelManager.generateLevel) return;
    state.levelManager.generateLevel();
}

function getRandomBuffCount(setting) {
    if (setting === -1) {
        const minRandomBuffs = Math.min(3, CONFIG.pvp.maxBuffsPerDragon);
        const randomRange = CONFIG.pvp.maxBuffsPerDragon - minRandomBuffs + 1;
        return minRandomBuffs + Math.floor(Math.random() * Math.max(1, randomRange));
    }
    return THREE.MathUtils.clamp(Number(setting) || 0, 0, CONFIG.pvp.maxBuffsPerDragon);
}

function applyRandomBuffs(dragon, countSetting) {
    if (!dragon || !dragon.buffSystem) return;
    dragon.buffSystem.clearAll();
    const count = getRandomBuffCount(countSetting);
    // PVP 模式不抽 pvpExclude 的 Buff（同心協力回血、有效傷害回血）
    const ids = Object.keys(BUFFS).filter(id => !BUFFS[id].pvpExclude && !BUFFS[id].disabled);
    const meleeFormIds = ids.filter(id => BUFFS[id].group === 'meleeForm');
    const comboFormIds = ids.filter(id => BUFFS[id].group === 'comboForm');
    for (let i = ids.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [ids[i], ids[j]] = [ids[j], ids[i]];
    }
    const selectedIds = [];
    const selectedGroups = new Set();
    const trySelectBuff = (id) => {
        const group = BUFFS[id] && BUFFS[id].group;
        if (group && selectedGroups.has(group)) return false;
        selectedIds.push(id);
        if (group) selectedGroups.add(group);
        return true;
    };
    if (count >= 4 && meleeFormIds.length > 0) {
        trySelectBuff(shuffleArray(meleeFormIds.slice())[0]);
    }
    if (count >= 6 && comboFormIds.length > 0) {
        trySelectBuff(shuffleArray(comboFormIds.slice())[0]);
    }
    ids.some(id => {
        if (selectedIds.length >= count) return true;
        trySelectBuff(id);
        return selectedIds.length >= count;
    });
    selectedIds.forEach(id => {
        if (BUFFS[id].stackable) dragon.buffSystem.setStack(id, 1);
        else dragon.buffSystem.toggle(id);
    });
}

function enterPvpBattle() {
    ensureEnemyDragon();
    clearTransientBattleObjects();
    resetLevelForBattle();
    state.pve.active = false;
    state.pve.configuring = false;
    state.spawnerEnabled = false;
    state.hpDecayEnabled = false;
    state.dummyEnabled = false;
    state.pvp.configuring = false;
    state.pvp.active = true;
    state.pvp.ended = false;
    state.pvp.winnerIndex = -1;
    state.pvp.matchTimer = CONFIG.pvp.matchDuration;
    state.pvp.timeUpVictory = false;
    state.pvp.startCountdownTimer = CONFIG.pvp.startCountdownSeconds;
    state.pvp.startTextTimer = 0;
    resetDragonForBattle(state.dragons[0], 0, true);
    resetDragonForBattle(state.dragons[1], 1, true);
    applyRandomBuffs(state.dragons[0], state.pvp.buffCounts[0]);
    applyRandomBuffs(state.dragons[1], state.pvp.buffCounts[1]);
    if (typeof refreshAllUI === 'function') refreshAllUI();
}

function enterPveBattle() {
    ensureEnemyDragon();
    clearTransientBattleObjects();
    resetLevelForBattle();
    state.spawnerEnabled = false;
    state.hpDecayEnabled = false;
    state.dummyEnabled = false;
    state.pvp.configuring = false;
    state.pvp.active = true;
    state.pvp.ended = false;
    state.pvp.winnerIndex = -1;
    state.pvp.matchTimer = CONFIG.pvp.matchDuration;
    state.pvp.timeUpVictory = false;
    state.pvp.startCountdownTimer = CONFIG.pvp.startCountdownSeconds;
    state.pvp.startTextTimer = 0;
    state.pve.active = true;
    state.pve.configuring = false;
    resetDragonForBattle(state.dragons[0], 0, true);
    resetDragonForBattle(state.dragons[1], 1, true);
    applyRandomBuffs(state.dragons[0], state.pvp.buffCounts[0]);
    applyRandomBuffs(state.dragons[1], state.pvp.buffCounts[1]);
    if (!state.pve.cpu && typeof CpuDragonController === 'function') {
        state.pve.cpu = new CpuDragonController(1, 0);
    }
    if (state.pve.cpu) state.pve.cpu.reset();
    if (typeof refreshAllUI === 'function') refreshAllUI();
}

function exitPvpBattle() {
    state.pvp.active = false;
    state.pvp.configuring = false;
    state.pvp.ended = false;
    state.pvp.winnerIndex = -1;
    state.pvp.matchTimer = 0;
    state.pvp.startCountdownTimer = 0;
    state.pvp.startTextTimer = 0;
    state.pvp.slots = [null, null, null, null, null, null, null, null];
    state.pve.active = false;
    state.pve.configuring = false;
    resetDragonForBattle(state.dragons[0], 0, false);
    resetDragonForBattle(state.dragons[1], 1, false);
    if (typeof refreshAllUI === 'function') refreshAllUI();
}

function onPvpTimeUp() {
    if (!state.pvp.active || state.pvp.ended) return;
    state.pvp.ended = true;
    state.pvp.timeUpVictory = true;
    const a = state.dragons[0];
    const b = state.dragons[1];
    const hpA = (a && !a.isDead) ? a.hp : 0;
    const hpB = (b && !b.isDead) ? b.hp : 0;
    if (hpA > hpB) state.pvp.winnerIndex = 0;
    else if (hpB > hpA) state.pvp.winnerIndex = 1;
    else state.pvp.winnerIndex = -1;
    if (typeof showPvpResultOverlay === 'function') showPvpResultOverlay();
}

function updatePvpMatchTimer(dt) {
    if (!state.pvp.active || state.pvp.ended) return;
    if (state.pvp.startCountdownTimer > 0) return;
    if (state.pvp.matchTimer <= 0) return;
    state.pvp.matchTimer = Math.max(0, state.pvp.matchTimer - dt);
    if (state.pvp.matchTimer <= 0) onPvpTimeUp();
}

function onDragonDeath(dragon) {
    if (!state.pvp.active || state.pvp.ended) return;
    const living = state.dragons.filter(d => d && !d.isDead);
    if (living.length > 1) return;
    state.pvp.ended = true;
    state.pvp.winnerIndex = living[0] ? living[0].index : -1;
    if (typeof showPvpResultOverlay === 'function') showPvpResultOverlay();
}

function updatePvpStartCountdown(dt) {
    if (!state.pvp.active || state.pvp.ended) return;
    if (state.pvp.startCountdownTimer > 0) {
        const prev = state.pvp.startCountdownTimer;
        state.pvp.startCountdownTimer = Math.max(0, state.pvp.startCountdownTimer - dt);
        if (prev > 0 && state.pvp.startCountdownTimer <= 0) {
            state.pvp.startTextTimer = CONFIG.pvp.startTextSeconds;
        }
    } else if (state.pvp.startTextTimer > 0) {
        state.pvp.startTextTimer = Math.max(0, state.pvp.startTextTimer - dt);
    }
}

function checkDragonDragonCollisions() {
    const r = CONFIG.pvp.dragonCollisionRadius;
    const minDist = r * 2;
    for (let i = 0; i < state.dragons.length; i++) {
        const a = state.dragons[i];
        if (!a || a.isDead || !a.mesh.visible) continue;
        for (let j = i + 1; j < state.dragons.length; j++) {
            const b = state.dragons[j];
            if (!b || b.isDead || !b.mesh.visible) continue;

            const dx = b.mesh.position.x - a.mesh.position.x;
            const dz = b.mesh.position.z - a.mesh.position.z;
            const distSq = dx * dx + dz * dz;
            if (distSq >= minDist * minDist || distSq < 0.0001) continue;

            const dist = Math.sqrt(distSq);
            const pen = minDist - dist;
            const nx = dx / dist;
            const nz = dz / dist;

            // 推開重疊部分（各退一半）
            a.mesh.position.x -= nx * pen * 0.5;
            a.mesh.position.z -= nz * pen * 0.5;
            b.mesh.position.x += nx * pen * 0.5;
            b.mesh.position.z += nz * pen * 0.5;
            if (state.levelManager && state.levelManager.clampPositionToArena) {
                state.levelManager.clampPositionToArena(a.mesh.position, CONFIG.level.playerBoundaryPadding);
                state.levelManager.clampPositionToArena(b.mesh.position, CONFIG.level.playerBoundaryPadding);
            }

            // 計算相對速度在碰撞法線方向的分量；只在兩龍靠近時施加衝量
            const relVx = b.velocity.x - a.velocity.x;
            const relVz = b.velocity.z - a.velocity.z;
            const relVn = relVx * nx + relVz * nz;
            if (relVn < 0) {
                const impulse = relVn * CONFIG.pvp.dragonBounceRestitution;
                a.velocity.x -= nx * impulse;
                a.velocity.z -= nz * impulse;
                b.velocity.x += nx * impulse;
                b.velocity.z += nz * impulse;
                // 額外推力確保有明顯彈開感
                const push = CONFIG.pvp.dragonPushForce;
                a.knockbackVel.x -= nx * push;
                a.knockbackVel.z -= nz * push;
                b.knockbackVel.x += nx * push;
                b.knockbackVel.z += nz * push;
            }
        }
    }
}

function getCameraTargets() {
    const targets = state.dragons.filter(d => d && !d.isDead && d.mesh.visible);
    if (targets.length > 0) return targets;
    return state.dragons.filter(d => d && d.mesh.visible);
}

function updateCamera(dt) {
    const targets = getCameraTargets();
    if (targets.length === 0) return;

    const center = new THREE.Vector3();
    targets.forEach(d => center.add(d.mesh.position));
    center.divideScalar(targets.length);

    let maxDist = 0;
    targets.forEach(d => {
        maxDist = Math.max(maxDist, d.mesh.position.distanceTo(center));
    });

    const dist = THREE.MathUtils.clamp(
        CONFIG.pvp.cameraMinDist + maxDist + CONFIG.pvp.cameraMargin,
        CONFIG.pvp.cameraMinDist,
        CONFIG.pvp.cameraMaxDist
    );
    const targetCameraPos = center.clone().add(new THREE.Vector3(0, dist * 1.25, dist * 0.72));
    camera.position.lerp(targetCameraPos, Math.min(1, dt * 4));
    camera.lookAt(center.x, 0, center.z);
}

// --- Game Objects ---
createDragon(0);
if (typeof CpuDragonController === 'function') {
    state.pve.cpu = new CpuDragonController(1, 0);
}

state.levelManager = new LevelManager(scene);
state.enemyManager = new EnemyManager(scene);

// 依設定決定初始是否生成 Dummy
if (state.dummyEnabled) {
    state.enemyManager.spawnDummy(state.dragons[0].mesh.position);
}

setupInputs();
setupUI();

// --- Main Loop ---
function animate(time) {
    requestAnimationFrame(animate);

    const dt = Math.min((time - state.lastTime) / 1000, 0.1);
    state.lastTime = time;

    state.pollInputs();
    updatePvpStartCountdown(dt);
    updatePvpMatchTimer(dt);
    if (state.pve.active && state.pve.cpu &&
        !state.pvp.configuring && !state.pvp.ended &&
        state.pvp.startCountdownTimer <= 0) {
        state.pve.cpu.update(dt);
    }

    if (!state.pvp.configuring && !state.pvp.ended) {
        state.dragons.forEach(dragon => {
            if (dragon) dragon.update(dt);
        });

        if (state.hpDecayEnabled && !state.pvp.active) {
            state.dragons.forEach(dragon => {
                if (!dragon || dragon.isDead) return;
                const decayRate = (dragon.beamPhase === 'firing')
                    ? CONFIG.stats.hpDecayRateBeam
                    : CONFIG.stats.hpDecayRate;
                dragon.hp = Math.max(0, dragon.hp - decayRate * dt);
                if (dragon.hp <= 0) dragon.die();
            });
        }

        checkDragonDragonCollisions();

        state.dragons.forEach(dragon => {
            if (dragon) dragon.checkCollisions(state.bullets);
        });

        if (state.levelManager) {
            state.levelManager.update(dt);
            state.levelManager.checkCollisions(state.bullets);
        }
        if (state.enemyManager) {
            const centerTarget = getCameraTargets()[0];
            state.enemyManager.update(dt, centerTarget ? centerTarget.mesh.position : new THREE.Vector3());
            state.enemyManager.checkCollisions(state.bullets);
        }

        updateBullets(dt);

        for (let i = state.particles.length - 1; i >= 0; i--) {
            if (!state.particles[i].update(dt)) state.particles.splice(i, 1);
        }
        for (let i = state.flyingCorpses.length - 1; i >= 0; i--) {
            if (!state.flyingCorpses[i].update(dt)) state.flyingCorpses.splice(i, 1);
        }
        for (let i = state.meatChunks.length - 1; i >= 0; i--) {
            if (!state.meatChunks[i].update(dt)) state.meatChunks.splice(i, 1);
        }

        state.dragons.forEach(dragon => {
            if (dragon && dragon.buffSystem) dragon.buffSystem.update(dt);
        });
    }

    updateCamera(dt);
    updateUI();

    renderer.render(scene, camera);
}

requestAnimationFrame(animate);

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

window.ensureEnemyDragon = ensureEnemyDragon;
window.removeEnemyDragon = removeEnemyDragon;
window.enterPvpBattle = enterPvpBattle;
window.enterPveBattle = enterPveBattle;
window.exitPvpBattle = exitPvpBattle;
window.onDragonDeath = onDragonDeath;
