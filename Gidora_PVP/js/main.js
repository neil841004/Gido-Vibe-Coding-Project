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
const gridHelper = new THREE.GridHelper(100, 100, 0x555555, 0x444444);
scene.add(gridHelper);

// --- Game Objects ---
const gidora = new Gidora();
window.gidoraInstance = gidora;

state.levelManager = new LevelManager(scene);
state.enemyManager = new EnemyManager(scene);

// Phase 1: 初始就生成一隻 Dummy
if (state.dummyEnabled) {
    state.enemyManager.spawnDummy(gidora.mesh.position);
}

setupInputs();
setupUI();

// --- Main Loop ---
function animate(time) {
    requestAnimationFrame(animate);

    const dt = Math.min((time - state.lastTime) / 1000, 0.1);
    state.lastTime = time;

    gidora.update(dt);

    // HP 緩慢倒扣
    if (state.hpDecayEnabled && !gidora.isDead) {
        const decayRate = (state.beamPhase === 'firing')
            ? CONFIG.stats.hpDecayRateBeam
            : CONFIG.stats.hpDecayRate;
        gidora.hp = Math.max(0, gidora.hp - decayRate * dt);
        if (gidora.hp <= 0) gidora.isDead = true;
    }

    gidora.checkCollisions(state.bullets);
    state.pollInputs();

    if (state.levelManager) {
        state.levelManager.update(dt);
        state.levelManager.checkCollisions(state.bullets);
    }
    if (state.enemyManager) {
        state.enemyManager.update(dt, gidora.mesh.position);
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

    BuffSystem.update(dt);
    updateUI();

    renderer.render(scene, camera);
}

requestAnimationFrame(animate);

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});
