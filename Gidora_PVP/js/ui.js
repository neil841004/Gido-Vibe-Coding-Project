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

    setupBuffUI();
}

function setupBuffUI() {
    const panel = document.createElement('div');
    panel.id = 'buff-panel';
    panel.style.position = 'absolute';
    panel.style.top = '10px';
    panel.style.right = '10px';
    panel.style.width = '310px';
    panel.style.maxHeight = '78vh';
    panel.style.overflow = 'hidden';
    panel.style.pointerEvents = 'auto';
    panel.style.color = 'white';
    panel.style.background = 'rgba(6, 18, 16, 0.78)';
    panel.style.border = '1px solid rgba(120,255,190,0.35)';
    panel.style.borderRadius = '10px';
    panel.style.boxShadow = '0 8px 30px rgba(0,0,0,0.35)';
    panel.style.zIndex = '20';

    const header = document.createElement('button');
    header.id = 'buff-panel-toggle';
    header.textContent = 'Buff 系統 ▾';
    header.style.width = '100%';
    header.style.pointerEvents = 'auto';
    header.style.border = '0';
    header.style.color = 'white';
    header.style.background = 'linear-gradient(90deg,#1e7f5c,#205a7f)';
    header.style.padding = '10px 12px';
    header.style.fontWeight = 'bold';
    header.style.cursor = 'pointer';
    panel.appendChild(header);

    const list = document.createElement('div');
    list.id = 'buff-list';
    list.style.maxHeight = 'calc(78vh - 42px)';
    list.style.overflowY = 'auto';
    list.style.padding = '10px';
    panel.appendChild(list);

    Object.keys(BUFFS).forEach(id => {
        const cfg = BUFFS[id];
        const row = document.createElement('label');
        row.className = 'buff-row';
        row.dataset.buffId = id;
        row.style.display = 'flex';
        row.style.alignItems = 'flex-start';
        row.style.gap = '8px';
        row.style.padding = '7px 6px';
        row.style.marginBottom = '4px';
        row.style.borderRadius = '7px';
        row.style.background = 'rgba(255,255,255,0.05)';
        row.style.cursor = 'pointer';

        const input = document.createElement('input');
        input.type = 'checkbox';
        input.dataset.buffId = id;
        input.style.marginTop = '3px';
        input.addEventListener('change', () => {
            BuffSystem.toggle(id);
            refreshBuffUI();
        });
        row.appendChild(input);

        const text = document.createElement('div');
        text.style.flex = '1';
        const title = document.createElement('div');
        title.className = 'buff-title';
        title.style.fontSize = '13px';
        title.style.fontWeight = 'bold';
        title.textContent = cfg.name;
        text.appendChild(title);

        const desc = document.createElement('div');
        desc.style.fontSize = '11px';
        desc.style.color = '#b7d8d0';
        desc.textContent = cfg.description || '';
        text.appendChild(desc);

        const meta = document.createElement('div');
        meta.className = 'buff-meta';
        meta.style.fontSize = '10px';
        meta.style.color = cfg.stackable ? '#ffe08a' : (cfg.group ? '#ffb7dd' : '#89f2c1');
        meta.textContent = cfg.stackable ? '可疊加' : (cfg.group ? '型態互斥' : '不可疊加');
        text.appendChild(meta);

        row.appendChild(text);
        list.appendChild(row);
    });

    let collapsed = false;
    header.addEventListener('click', () => {
        collapsed = !collapsed;
        list.style.display = collapsed ? 'none' : 'block';
        header.textContent = collapsed ? 'Buff 系統 ◂' : 'Buff 系統 ▾';
    });

    document.body.appendChild(panel);
    refreshBuffUI();
}

function refreshBuffUI() {
    document.querySelectorAll('.buff-row').forEach(row => {
        const id = row.dataset.buffId;
        const input = row.querySelector('input');
        const title = row.querySelector('.buff-title');
        const stack = BuffSystem.getStack(id);
        input.checked = stack > 0;
        row.style.background = stack > 0 ? 'rgba(84, 255, 175, 0.16)' : 'rgba(255,255,255,0.05)';
        title.textContent = BUFFS[id].name + (BUFFS[id].stackable && stack > 0 ? ` x${stack}` : '');
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
        Beam: ${state.beamPhase} | Charge: ${(state.beamCharge).toFixed(1)} | CD: ${state.comboCooldown.toFixed(1)}s | Bullets: ${state.bullets.length}<br>
        HP: ${window.gidoraInstance ? window.gidoraInstance.hp.toFixed(0) : 0}/${window.gidoraInstance ? window.gidoraInstance.maxHP.toFixed(0) : 0}
        | 失衡: ${window.gidoraInstance ? window.gidoraInstance.staggerValue.toFixed(0) : 0}
        | 跌倒: ${window.gidoraInstance && window.gidoraInstance.fallTimer > 0 ? window.gidoraInstance.fallTimer.toFixed(1) + 's' : 'no'}
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
