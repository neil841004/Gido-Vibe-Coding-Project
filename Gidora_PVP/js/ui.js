// =====================================================================
// ui.js — DOM 按鈕、蓄力條、玩家蓄力指示燈、Debug HUD
// 在 main.js 場景初始化完成後呼叫 setupUI()
// =====================================================================

function setupUI() {
    // --- Spawner Toggle ---
    const spawnerBtn = document.getElementById('spawner-toggle');
    spawnerBtn.addEventListener('click', () => {
        state.spawnerEnabled = !state.spawnerEnabled;
        spawnerBtn.innerText = state.spawnerEnabled ? "Enemy Spawner: ON" : "Enemy Spawner: OFF";
        spawnerBtn.style.backgroundColor = state.spawnerEnabled ? "#aa4444" : "#44aa44";

        if (state.spawnerEnabled) state.hpDecayEnabled = true;
        if (!state.spawnerEnabled && state.enemyManager) state.enemyManager.killAll();
    });

    // --- Dummy Toggle (Phase 1: Spawn ↔ Close) ---
    const dummyBtn = document.createElement('button');
    dummyBtn.id = 'dummy-toggle';
    dummyBtn.innerText = state.dummyEnabled ? 'Close Dummy' : 'Spawn Dummy';
    dummyBtn.style.marginTop = '10px';
    dummyBtn.style.marginLeft = '10px';
    dummyBtn.style.pointerEvents = 'auto';
    dummyBtn.style.backgroundColor = state.dummyEnabled ? '#aa4444' : '#aa8844';
    dummyBtn.style.color = 'white';
    document.getElementById('info').appendChild(dummyBtn);

    dummyBtn.addEventListener('click', () => {
        if (!state.enemyManager) return;
        state.dummyEnabled = !state.dummyEnabled;
        if (state.dummyEnabled) {
            state.enemyManager.spawnDummy(window.gidoraInstance.mesh.position);
            dummyBtn.innerText = 'Close Dummy';
            dummyBtn.style.backgroundColor = '#aa4444';
        } else {
            state.enemyManager.removeDummies();
            dummyBtn.innerText = 'Spawn Dummy';
            dummyBtn.style.backgroundColor = '#aa8844';
        }
    });
}

// 主迴圈每幀呼叫，更新所有 DOM HUD
function updateUI() {
    // Debug HUD
    document.getElementById('debug').innerHTML = `
        P1: Atk=${state.input.p1.attack} Chg=${state.input.p1.charge ? 'ON' : 'OFF'}<br>
        P2: Atk=${state.input.p2.attack} Chg=${state.input.p2.charge ? 'ON' : 'OFF'}<br>
        P3: Atk=${state.input.p3.attack} Chg=${state.input.p3.charge ? 'ON' : 'OFF'}<br>
        P4: Atk=${state.input.p4.attack} Chg=${state.input.p4.charge ? 'ON' : 'OFF'}<br>
        Beam: ${state.beamPhase} | Charge: ${(state.beamCharge).toFixed(1)} | CD: ${state.comboCooldown.toFixed(1)}s | Bullets: ${state.bullets.length}
    `;

    // Charge bar (Phase 1: 直接以 state.beamCharge 為準，CSS transition 已移除以避免顯示落差)
    const beamMaxUI = CONFIG.beam.maxCharge;
    const pct = Math.min(100, Math.max(0, (state.beamCharge / beamMaxUI) * 100));
    const barFill = document.getElementById('charge-bar-fill');
    const barWrap = document.getElementById('charge-bar-wrap');
    const chargeLabel = document.getElementById('charge-label');
    barFill.style.width = pct + '%';

    barWrap.classList.toggle('beam-firing', state.beamPhase === 'firing');
    barWrap.classList.toggle('beam-prefire', state.beamPhase === 'prefire');

    if (state.beamPhase === 'firing') {
        barFill.style.background = 'linear-gradient(90deg,#cc00cc,#ff00ff,#ffffff)';
        chargeLabel.style.color = '#ffffff';
        chargeLabel.style.textShadow = '0 0 12px #ffffff, 0 0 24px #ff00ff';
    } else if (state.beamPhase === 'postfire' || state.comboCooldown > 0) {
        barFill.style.background = 'linear-gradient(90deg,#440044,#880088,#cc00cc88)';
        chargeLabel.style.color = '#cc88cc';
        chargeLabel.style.textShadow = '0 0 6px #cc00cc';
    } else {
        barFill.style.background = 'linear-gradient(90deg,#660066,#cc00cc,#ff00ff,#ffffff88)';
        chargeLabel.style.color = '#ffffff';
        chargeLabel.style.textShadow = '0 0 8px #ff00ff, 0 0 16px #ff00ff88';
    }

    let labelText;
    if (state.beamPhase === 'firing') {
        labelText = `★ 光束炮發射中！ ${Math.ceil(state.beamFiringTimer)}s`;
    } else if (state.beamPhase === 'prefire') {
        labelText = '▶▶ 即將發射！';
    } else if (state.comboCooldown > 0) {
        labelText = `◀◀ 合體技冷卻 ${state.comboCooldown.toFixed(1)}s`;
    } else if (state.beamPhase === 'postfire') {
        labelText = '◀◀ 後搖中';
    } else {
        labelText = `⚡ 蓄力 ${pct.toFixed(0)}%`;
    }
    chargeLabel.textContent = labelText;

    // 左下角玩家蓄力指示燈
    ['p1', 'p2', 'p3', 'p4'].forEach(p => {
        const el = document.getElementById('ci-' + p);
        if (!el) return;
        el.style.display = 'flex';
        const pressing = state.input[p].charge;
        el.classList.toggle('pressing', pressing);
        el.querySelector('.ci-status').textContent = pressing ? '蓄力中 ⚡' : '未蓄力';
    });
}
