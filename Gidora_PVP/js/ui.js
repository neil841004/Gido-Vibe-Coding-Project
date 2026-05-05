// =====================================================================
// ui.js — DOM 按鈕、Buff 面板、PVP 配對介面、蓄力 HUD
// 在 main.js 場景初始化完成後呼叫 setupUI()
// =====================================================================

let pvpOverlay = null;
let pvpResultOverlay = null;
let pendingDevice = null;

function getBuffTargetDragon() {
    return state.dragons[state.buffTarget] || state.dragons[0];
}

function getHudDragon() {
    return getBuffTargetDragon();
}

function styleTopButton(btn, color) {
    btn.style.backgroundColor = color;
    btn.style.pointerEvents = 'auto';
    btn.style.color = 'white';
}

function setupUI() {
    const info = document.getElementById('info');

    const spawnerBtn = document.getElementById('spawner-toggle');
    spawnerBtn.addEventListener('click', () => {
        state.spawnerEnabled = !state.spawnerEnabled;
        if (state.spawnerEnabled) {
            state.hpDecayEnabled = true;
            state.pvp.active = false;
        }
        if (!state.spawnerEnabled && state.enemyManager) state.enemyManager.killAll();
        refreshTopLeftUI();
    });

    const dummyBtn = document.createElement('button');
    dummyBtn.id = 'dummy-toggle';
    info.appendChild(dummyBtn);
    dummyBtn.addEventListener('click', () => {
        if (!state.enemyManager) return;
        state.dummyEnabled = !state.dummyEnabled;
        if (state.dummyEnabled) {
            const ref = state.dragons.find(d => d && !d.isDead);
            state.enemyManager.spawnDummy(ref ? ref.mesh.position : new THREE.Vector3());
        } else {
            state.enemyManager.removeDummies();
        }
        refreshTopLeftUI();
    });

    const enemyDragonBtn = document.createElement('button');
    enemyDragonBtn.id = 'enemy-dragon-toggle';
    info.appendChild(enemyDragonBtn);
    enemyDragonBtn.addEventListener('click', () => {
        if (state.enemyDragonEnabled) window.removeEnemyDragon();
        else window.ensureEnemyDragon();
        refreshAllUI();
    });

    const pvpBtn = document.createElement('button');
    pvpBtn.id = 'pvp-mode-button';
    pvpBtn.textContent = 'Enter PVP Mode';
    styleTopButton(pvpBtn, '#5c55c8');
    info.appendChild(pvpBtn);
    pvpBtn.addEventListener('click', openPvpSetupOverlay);

    setupBuffUI();
    refreshTopLeftUI();
}

function refreshTopLeftUI() {
    const spawnerBtn = document.getElementById('spawner-toggle');
    if (spawnerBtn) {
        spawnerBtn.innerText = state.spawnerEnabled ? "Enemy Spawner: ON" : "Enemy Spawner: OFF";
        styleTopButton(spawnerBtn, state.spawnerEnabled ? "#aa4444" : "#44aa44");
    }

    const dummyBtn = document.getElementById('dummy-toggle');
    if (dummyBtn) {
        dummyBtn.innerText = state.dummyEnabled ? 'Cummy: ON' : 'Cummy: OFF';
        styleTopButton(dummyBtn, state.dummyEnabled ? '#aa4444' : '#aa8844');
    }

    const enemyDragonBtn = document.getElementById('enemy-dragon-toggle');
    if (enemyDragonBtn) {
        enemyDragonBtn.innerText = state.enemyDragonEnabled ? 'Enemy Dragon: ON' : 'Enemy Dragon: OFF';
        styleTopButton(enemyDragonBtn, state.enemyDragonEnabled ? '#aa4444' : '#4466aa');
    }
}

function refreshAllUI() {
    refreshTopLeftUI();
    refreshBuffUI();
    refreshPvpOverlay();
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
    header.textContent = 'Buff 系統 ◂';
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
    list.style.display = 'none';
    panel.appendChild(list);

    const targetRow = document.createElement('div');
    targetRow.style.display = 'grid';
    targetRow.style.gridTemplateColumns = '1fr 1fr';
    targetRow.style.gap = '6px';
    targetRow.style.marginBottom = '10px';

    ['Dragon A', 'Dragon B'].forEach((label, index) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.dataset.buffTarget = String(index);
        btn.textContent = label;
        btn.style.pointerEvents = 'auto';
        btn.style.border = '1px solid rgba(255,255,255,0.25)';
        btn.style.borderRadius = '6px';
        btn.style.padding = '7px 6px';
        btn.style.color = 'white';
        btn.style.cursor = 'pointer';
        btn.addEventListener('click', () => {
            state.buffTarget = index;
            if (index === 1 && !state.dragons[1]) window.ensureEnemyDragon();
            refreshAllUI();
        });
        targetRow.appendChild(btn);
    });
    list.appendChild(targetRow);

    Object.keys(BUFFS).forEach(id => {
        const cfg = BUFFS[id];
        const row = document.createElement('div');
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
        row.classList.toggle('buff-incomplete', !isBuffImplemented(id));

        const input = document.createElement('input');
        input.type = 'checkbox';
        input.dataset.buffId = id;
        input.style.marginTop = '3px';
        input.addEventListener('change', () => {
            const dragon = getBuffTargetDragon();
            if (!dragon || !dragon.buffSystem) return;
            if (cfg.stackable) {
                if (input.checked && dragon.buffSystem.getStack(id) === 0) dragon.buffSystem.setStack(id, 1);
                if (!input.checked) dragon.buffSystem.clear(id);
            } else {
                dragon.buffSystem.toggle(id);
            }
            refreshBuffUI();
        });
        row.appendChild(input);

        const text = document.createElement('div');
        text.style.flex = '1';

        const titleLine = document.createElement('div');
        titleLine.style.display = 'flex';
        titleLine.style.alignItems = 'center';
        titleLine.style.gap = '6px';
        titleLine.appendChild(createBuffIconElement(id));

        const title = document.createElement('div');
        title.className = 'buff-title';
        title.style.fontSize = '13px';
        title.style.fontWeight = 'bold';
        title.style.color = isBuffImplemented(id) ? '#ffffff' : '#ff5a5a';
        title.textContent = cfg.name;
        titleLine.appendChild(title);
        text.appendChild(titleLine);

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

        if (cfg.stackable) {
            const controls = document.createElement('div');
            controls.style.display = 'flex';
            controls.style.flexDirection = 'column';
            controls.style.gap = '4px';

            const plus = document.createElement('button');
            plus.type = 'button';
            plus.textContent = '+';
            plus.title = '增加一層';
            plus.style.pointerEvents = 'auto';
            plus.style.width = '24px';
            plus.style.height = '22px';
            plus.style.border = '1px solid rgba(255,255,255,0.25)';
            plus.style.background = 'rgba(80,255,170,0.22)';
            plus.style.color = 'white';
            plus.style.cursor = 'pointer';
            plus.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const dragon = getBuffTargetDragon();
                if (dragon && dragon.buffSystem) dragon.buffSystem.addStack(id);
                refreshBuffUI();
            });
            controls.appendChild(plus);

            const minus = document.createElement('button');
            minus.type = 'button';
            minus.textContent = '-';
            minus.title = '減少一層';
            minus.style.pointerEvents = 'auto';
            minus.style.width = '24px';
            minus.style.height = '22px';
            minus.style.border = '1px solid rgba(255,255,255,0.25)';
            minus.style.background = 'rgba(255,255,255,0.08)';
            minus.style.color = 'white';
            minus.style.cursor = 'pointer';
            minus.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const dragon = getBuffTargetDragon();
                if (dragon && dragon.buffSystem) dragon.buffSystem.removeStack(id);
                refreshBuffUI();
            });
            controls.appendChild(minus);

            row.appendChild(controls);
        }
        list.appendChild(row);
    });

    let collapsed = true;
    header.addEventListener('click', () => {
        collapsed = !collapsed;
        list.style.display = collapsed ? 'none' : 'block';
        header.textContent = collapsed ? 'Buff 系統 ◂' : 'Buff 系統 ▾';
    });

    document.body.appendChild(panel);
    refreshBuffUI();
}

function refreshBuffUI() {
    const dragon = getBuffTargetDragon();
    document.querySelectorAll('[data-buff-target]').forEach(btn => {
        const active = Number(btn.dataset.buffTarget) === state.buffTarget;
        const exists = !!state.dragons[Number(btn.dataset.buffTarget)];
        btn.style.background = active ? 'rgba(84,255,175,0.32)' : 'rgba(255,255,255,0.08)';
        btn.style.opacity = exists ? '1' : '0.58';
    });

    document.querySelectorAll('.buff-row').forEach(row => {
        const id = row.dataset.buffId;
        const input = row.querySelector('input');
        const title = row.querySelector('.buff-title');
        const stack = dragon && dragon.buffSystem ? dragon.buffSystem.getStack(id) : 0;
        input.checked = stack > 0;
        row.style.background = stack > 0 ? 'rgba(84, 255, 175, 0.16)' : 'rgba(255,255,255,0.05)';
        title.textContent = BUFFS[id].name + (BUFFS[id].stackable && stack > 0 ? ` x${stack}` : '');
        title.style.color = isBuffImplemented(id) ? '#ffffff' : '#ff5a5a';
    });
}

function makeOverlayButton(text, color) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = text;
    btn.style.pointerEvents = 'auto';
    btn.style.border = '1px solid rgba(255,255,255,0.22)';
    btn.style.borderRadius = '7px';
    btn.style.padding = '9px 12px';
    btn.style.background = color;
    btn.style.color = 'white';
    btn.style.fontWeight = '800';
    btn.style.cursor = 'pointer';
    return btn;
}

function openPvpSetupOverlay() {
    window.ensureEnemyDragon();
    state.pvp.configuring = true;
    state.pvp.active = false;
    state.pvp.ended = false;
    pendingDevice = null;

    if (!pvpOverlay) buildPvpSetupOverlay();
    pvpOverlay.style.display = 'flex';
    refreshPvpOverlay();
}

function buildPvpSetupOverlay() {
    pvpOverlay = document.createElement('div');
    pvpOverlay.id = 'pvp-setup-overlay';
    pvpOverlay.style.position = 'absolute';
    pvpOverlay.style.inset = '0';
    pvpOverlay.style.zIndex = '100';
    pvpOverlay.style.display = 'none';
    pvpOverlay.style.alignItems = 'center';
    pvpOverlay.style.justifyContent = 'center';
    pvpOverlay.style.pointerEvents = 'auto';
    pvpOverlay.style.background = 'rgba(0,0,0,0.72)';
    pvpOverlay.style.color = 'white';

    const panel = document.createElement('div');
    panel.style.width = 'min(880px, calc(100vw - 36px))';
    panel.style.maxHeight = 'calc(100vh - 36px)';
    panel.style.overflowY = 'auto';
    panel.style.background = 'rgba(10,16,22,0.96)';
    panel.style.border = '1px solid rgba(120,190,255,0.35)';
    panel.style.borderRadius = '10px';
    panel.style.boxShadow = '0 18px 60px rgba(0,0,0,0.55)';
    panel.style.padding = '18px';
    pvpOverlay.appendChild(panel);

    const title = document.createElement('div');
    title.textContent = 'PVP Mode';
    title.style.fontSize = '24px';
    title.style.fontWeight = '900';
    title.style.marginBottom = '6px';
    panel.appendChild(title);

    const deviceLine = document.createElement('div');
    deviceLine.id = 'pvp-device-line';
    deviceLine.style.fontSize = '13px';
    deviceLine.style.color = '#c9d7e8';
    deviceLine.style.marginBottom = '14px';
    panel.appendChild(deviceLine);

    const grid = document.createElement('div');
    grid.style.display = 'grid';
    grid.style.gridTemplateColumns = '1fr 1fr';
    grid.style.gap = '14px';
    panel.appendChild(grid);

    ['Dragon A', 'Dragon B'].forEach((dragonName, dragonIndex) => {
        const column = document.createElement('div');
        column.style.border = '1px solid rgba(255,255,255,0.16)';
        column.style.borderRadius = '8px';
        column.style.padding = '12px';
        column.style.background = 'rgba(255,255,255,0.04)';

        const heading = document.createElement('div');
        heading.textContent = dragonName;
        heading.style.fontSize = '18px';
        heading.style.fontWeight = '900';
        heading.style.marginBottom = '10px';
        column.appendChild(heading);

        const slotGrid = document.createElement('div');
        slotGrid.style.display = 'grid';
        slotGrid.style.gridTemplateColumns = '1fr 1fr';
        slotGrid.style.gap = '8px';
        column.appendChild(slotGrid);

        ['P1 Head', 'P2 Head', 'P3 Head', 'P4 Tail'].forEach((slotName, partIndex) => {
            const slotIndex = dragonIndex * 4 + partIndex;
            const slot = document.createElement('button');
            slot.type = 'button';
            slot.className = 'pvp-slot';
            slot.dataset.slotIndex = String(slotIndex);
            slot.style.minHeight = '70px';
            slot.style.textAlign = 'left';
            slot.style.pointerEvents = 'auto';
            slot.style.border = '1px solid rgba(255,255,255,0.18)';
            slot.style.borderRadius = '7px';
            slot.style.padding = '8px';
            slot.style.color = 'white';
            slot.style.cursor = 'pointer';
            slot.addEventListener('click', () => assignPendingDeviceToSlot(slotIndex));
            slotGrid.appendChild(slot);

            const label = document.createElement('div');
            label.textContent = slotName;
            label.style.fontWeight = '900';
            label.style.fontSize = '13px';
            slot.appendChild(label);

            const device = document.createElement('div');
            device.className = 'pvp-slot-device';
            device.style.marginTop = '8px';
            device.style.fontSize = '12px';
            device.style.color = '#adc1d8';
            slot.appendChild(device);
        });

        const buffRow = document.createElement('label');
        buffRow.style.display = 'flex';
        buffRow.style.alignItems = 'center';
        buffRow.style.gap = '8px';
        buffRow.style.marginTop = '12px';
        buffRow.style.fontSize = '13px';
        buffRow.textContent = 'Buff 數';
        const select = document.createElement('select');
        select.dataset.pvpBuffCount = String(dragonIndex);
        select.style.pointerEvents = 'auto';
        select.style.flex = '1';
        select.style.background = '#172333';
        select.style.color = 'white';
        select.style.border = '1px solid rgba(255,255,255,0.22)';
        select.style.borderRadius = '6px';
        select.style.padding = '7px';
        for (let i = 0; i <= CONFIG.pvp.maxBuffsPerDragon; i++) {
            const opt = document.createElement('option');
            opt.value = String(i);
            opt.textContent = String(i);
            select.appendChild(opt);
        }
        const randomOpt = document.createElement('option');
        randomOpt.value = '-1';
        randomOpt.textContent = '隨機';
        select.appendChild(randomOpt);
        select.addEventListener('change', () => {
            state.pvp.buffCounts[dragonIndex] = Number(select.value);
        });
        buffRow.appendChild(select);
        column.appendChild(buffRow);
        grid.appendChild(column);
    });

    const actions = document.createElement('div');
    actions.style.display = 'flex';
    actions.style.justifyContent = 'flex-end';
    actions.style.gap = '10px';
    actions.style.marginTop = '16px';
    panel.appendChild(actions);

    const cancel = makeOverlayButton('Cancel', 'rgba(255,255,255,0.12)');
    cancel.addEventListener('click', () => {
        state.pvp.configuring = false;
        pvpOverlay.style.display = 'none';
    });
    actions.appendChild(cancel);

    const start = makeOverlayButton('Start PVP', '#2f9c67');
    start.addEventListener('click', () => {
        pvpOverlay.style.display = 'none';
        if (pvpResultOverlay) pvpResultOverlay.style.display = 'none';
        window.enterPvpBattle();
    });
    actions.appendChild(start);

    document.body.appendChild(pvpOverlay);
}

function refreshPvpOverlay() {
    if (!pvpOverlay) return;
    const line = document.getElementById('pvp-device-line');
    if (line) {
        line.textContent = pendingDevice
            ? `目前裝置：${pendingDevice.label}。點一個空格佔位；點已佔格可清除。`
            : '按鍵盤、滑鼠或手把任意按鈕加入，然後點一個格子佔位。';
    }
    document.querySelectorAll('.pvp-slot').forEach(slotEl => {
        const slotIndex = Number(slotEl.dataset.slotIndex);
        const slot = state.pvp.slots[slotIndex];
        const device = slotEl.querySelector('.pvp-slot-device');
        slotEl.style.background = slot ? 'rgba(84,255,175,0.18)' : 'rgba(255,255,255,0.06)';
        device.textContent = slot && slot.device ? slot.device.label : 'Empty';
    });
    document.querySelectorAll('[data-pvp-buff-count]').forEach(select => {
        const idx = Number(select.dataset.pvpBuffCount);
        select.value = String(state.pvp.buffCounts[idx]);
    });
}

function assignPendingDeviceToSlot(slotIndex) {
    const slot = state.pvp.slots[slotIndex];
    if (slot) {
        state.pvp.slots[slotIndex] = null;
        refreshPvpOverlay();
        return;
    }
    const device = pendingDevice || { type: 'keyboard', id: 'keyboard', label: 'Keyboard / Mouse' };
    const usedIndex = state.pvp.slots.findIndex(existing => existing && existing.device && existing.device.id === device.id);
    if (usedIndex >= 0) state.pvp.slots[usedIndex] = null;
    state.pvp.slots[slotIndex] = { device: { ...device } };
    pendingDevice = null;
    refreshPvpOverlay();
}

function pvpSetPendingDevice(device) {
    pendingDevice = { ...device };
    refreshPvpOverlay();
}

function showPvpResultOverlay() {
    if (!pvpResultOverlay) {
        pvpResultOverlay = document.createElement('div');
        pvpResultOverlay.style.position = 'absolute';
        pvpResultOverlay.style.inset = '0';
        pvpResultOverlay.style.zIndex = '110';
        pvpResultOverlay.style.display = 'none';
        pvpResultOverlay.style.alignItems = 'center';
        pvpResultOverlay.style.justifyContent = 'center';
        pvpResultOverlay.style.pointerEvents = 'auto';
        pvpResultOverlay.style.background = 'rgba(0,0,0,0.58)';

        const panel = document.createElement('div');
        panel.style.background = 'rgba(12,18,26,0.96)';
        panel.style.border = '1px solid rgba(255,255,255,0.22)';
        panel.style.borderRadius = '10px';
        panel.style.padding = '24px';
        panel.style.color = 'white';
        panel.style.textAlign = 'center';
        panel.style.minWidth = '280px';
        pvpResultOverlay.appendChild(panel);

        const title = document.createElement('div');
        title.id = 'pvp-result-title';
        title.style.fontSize = '30px';
        title.style.fontWeight = '900';
        title.style.marginBottom = '16px';
        panel.appendChild(title);

        const restart = makeOverlayButton(CONFIG.pvp.respawnButtonLabel, '#2f9c67');
        restart.addEventListener('click', () => {
            pvpResultOverlay.style.display = 'none';
            window.enterPvpBattle();
        });
        panel.appendChild(restart);

        document.body.appendChild(pvpResultOverlay);
    }

    const title = document.getElementById('pvp-result-title');
    title.textContent = state.pvp.winnerIndex === 0
        ? 'Dragon A Wins'
        : (state.pvp.winnerIndex === 1 ? 'Dragon B Wins' : 'Draw');
    pvpResultOverlay.style.display = 'flex';
}

// 主迴圈每幀呼叫，更新所有 DOM HUD
function updateUI() {
    const dragon = getHudDragon();

    const beamMaxUI = CONFIG.beam.maxCharge;
    const cooldownPct = dragon && dragon.comboCooldownMax > 0
        ? Math.min(100, Math.max(0, (dragon.comboCooldown / dragon.comboCooldownMax) * 100))
        : 0;
    const isCooldownLocked = dragon && dragon.comboCooldown > 0 && dragon.beamPhase === 'idle';
    const pct = !dragon
        ? 0
        : (isCooldownLocked
            ? cooldownPct
            : Math.min(100, Math.max(0, (dragon.beamCharge / beamMaxUI) * 100)));
    const barFill = document.getElementById('charge-bar-fill');
    const barWrap = document.getElementById('charge-bar-wrap');
    const chargeLabel = document.getElementById('charge-label');
    barFill.style.width = pct + '%';

    barWrap.classList.toggle('beam-firing', dragon && dragon.beamPhase === 'firing');
    barWrap.classList.toggle('beam-prefire', dragon && dragon.beamPhase === 'prefire');

    if (dragon && dragon.beamPhase === 'firing') {
        barFill.style.background = 'linear-gradient(90deg,#cc00cc,#ff00ff,#ffffff)';
        chargeLabel.style.color = '#ffffff';
        chargeLabel.style.textShadow = '0 0 12px #ffffff, 0 0 24px #ff00ff';
    } else if (isCooldownLocked) {
        barFill.style.background = 'linear-gradient(90deg,#5f6268,#8b8f96,#c8ccd2)';
        chargeLabel.style.color = '#d9dde3';
        chargeLabel.style.textShadow = '0 0 6px #111';
    } else if (dragon && dragon.beamPhase === 'postfire') {
        barFill.style.background = 'linear-gradient(90deg,#440044,#880088,#cc00cc88)';
        chargeLabel.style.color = '#cc88cc';
        chargeLabel.style.textShadow = '0 0 6px #cc00cc';
    } else {
        barFill.style.background = 'linear-gradient(90deg,#660066,#cc00cc,#ff00ff,#ffffff88)';
        chargeLabel.style.color = '#ffffff';
        chargeLabel.style.textShadow = '0 0 8px #ff00ff, 0 0 16px #ff00ff88';
    }

    const dragonLabel = state.buffTarget === 1 ? 'B' : 'A';
    let labelText;
    if (!dragon) {
        labelText = '蓄力 0%';
    } else if (dragon.beamPhase === 'firing') {
        labelText = `Dragon ${dragonLabel} 光束炮發射中 ${Math.ceil(dragon.beamFiringTimer)}s`;
    } else if (dragon.beamPhase === 'prefire') {
        labelText = `Dragon ${dragonLabel} 即將發射`;
    } else if (isCooldownLocked) {
        labelText = `Dragon ${dragonLabel} 合體技封鎖 ${dragon.comboCooldown.toFixed(1)}s`;
    } else if (dragon.beamPhase === 'postfire') {
        labelText = `Dragon ${dragonLabel} 後搖中`;
    } else {
        labelText = `Dragon ${dragonLabel} 蓄力 ${pct.toFixed(0)}%`;
    }
    chargeLabel.textContent = labelText;

    ['p1', 'p2', 'p3', 'p4'].forEach(p => {
        const el = document.getElementById('ci-' + p);
        if (!el) return;
        el.style.display = 'flex';
        const pressing = dragon && dragon.input[p].charge;
        el.classList.toggle('pressing', !!pressing);
        el.querySelector('.ci-status').textContent = pressing ? '蓄力中' : '未蓄力';
    });
}

window.pvpSetPendingDevice = pvpSetPendingDevice;
window.showPvpResultOverlay = showPvpResultOverlay;
window.refreshAllUI = refreshAllUI;
