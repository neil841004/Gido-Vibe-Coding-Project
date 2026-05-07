// =====================================================================
// ui.js — DOM 按鈕、Buff 面板、PVP 配對介面、蓄力 HUD
// 在 main.js 場景初始化完成後呼叫 setupUI()
// =====================================================================

let pvpOverlay = null;
let pvpResultOverlay = null;
let pendingDevice = null;
let pvpDevices = [];
let selectedPvpDeviceId = null;
let pvpDeviceFocus = {};
let pvpNewDeviceConfirmBlock = {};

const PVP_KEYBOARD_DEVICE = { type: 'keyboard', id: 'keyboard', label: 'Keyboard / Mouse' };

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
        dummyBtn.innerText = state.dummyEnabled ? 'Dummy: ON' : 'Dummy: OFF';
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
        row.style.background = cfg.pvpExclude ? 'rgba(180,40,40,0.18)' : 'rgba(255,255,255,0.05)';
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
        const isPvpExclude = !!(BUFFS[id] && BUFFS[id].pvpExclude);
        row.style.background = stack > 0
            ? (isPvpExclude ? 'rgba(200,60,60,0.30)' : 'rgba(84, 255, 175, 0.16)')
            : (isPvpExclude ? 'rgba(180,40,40,0.18)' : 'rgba(255,255,255,0.05)');
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

function getPvpSlotColor(slotIndex) {
    const palette = slotIndex < 4 ? CONFIG.visuals.colors : CONFIG.visuals.colorsB;
    const part = ['p1', 'p2', 'p3', 'p4'][slotIndex % 4];
    return palette[part] || 0xffffff;
}

function colorToRgba(hex, alpha) {
    const r = (hex >> 16) & 255;
    const g = (hex >> 8) & 255;
    const b = hex & 255;
    return `rgba(${r},${g},${b},${alpha})`;
}

function getPvpPlayerLabel(slotIndex) {
    return `P${slotIndex + 1}`;
}

function openPvpSetupOverlay() {
    window.ensureEnemyDragon();
    state.pvp.configuring = true;
    state.pvp.active = false;
    state.pvp.ended = false;
    pendingDevice = null;
    selectedPvpDeviceId = null;
    pvpDeviceFocus = {};
    pvpNewDeviceConfirmBlock = {};
    if (state.pvp.keyboardEnabled !== false) {
        upsertPvpDevice(PVP_KEYBOARD_DEVICE, true);
    }

    if (!pvpOverlay) buildPvpSetupOverlay();
    pvpOverlay.style.display = 'flex';
    refreshPvpOverlay();
}

function upsertPvpDevice(device, selectForMouse = false) {
    if (!device || !device.id) return null;
    const normalized = { ...device };
    const existingIndex = pvpDevices.findIndex(d => d.id === normalized.id);
    if (existingIndex >= 0) pvpDevices[existingIndex] = { ...pvpDevices[existingIndex], ...normalized };
    else {
        pvpDevices.push(normalized);
        pvpNewDeviceConfirmBlock[normalized.id] = true;
    }
    if (pvpDeviceFocus[normalized.id] === undefined) {
        pvpDeviceFocus[normalized.id] = getFirstFocusablePvpSlotIndex(normalized);
    }
    if (selectForMouse || !selectedPvpDeviceId) {
        selectedPvpDeviceId = normalized.id;
        pendingDevice = normalized;
    }
    return normalized;
}

function getSelectedPvpDevice() {
    if (selectedPvpDeviceId) {
        const selected = pvpDevices.find(d => d.id === selectedPvpDeviceId);
        if (selected) return selected;
    }
    if (pendingDevice) return pendingDevice;
    return null;
}

function getSlotGridPosition(slotIndex) {
    const team = slotIndex < 4 ? 0 : 1;
    const part = slotIndex % 4;
    return {
        col: team * 2 + (part % 2),
        row: Math.floor(part / 2)
    };
}

function getSlotIndexFromGrid(col, row) {
    const safeCol = (col + 4) % 4;
    const safeRow = (row + 2) % 2;
    const team = safeCol < 2 ? 0 : 1;
    const part = safeRow * 2 + (safeCol % 2);
    return team * 4 + part;
}

function getAssignedSlotIndexForDevice(device) {
    if (!device || !device.id) return -1;
    return state.pvp.slots.findIndex(slot => slot && slot.device && slot.device.id === device.id);
}

function canDeviceFocusPvpSlot(slotIndex, device) {
    const slot = state.pvp.slots[slotIndex];
    return !slot || (device && slot.device && slot.device.id === device.id);
}

function getFirstFocusablePvpSlotIndex(device) {
    const assignedIndex = getAssignedSlotIndexForDevice(device);
    if (assignedIndex >= 0) return assignedIndex;
    const emptyIndex = state.pvp.slots.findIndex((slot, index) => !slot && canDeviceFocusPvpSlot(index, device));
    return emptyIndex >= 0 ? emptyIndex : 0;
}

function getPvpDeviceFocusIndex(device) {
    if (!device || !device.id) return 0;
    if (pvpDeviceFocus[device.id] === undefined || !canDeviceFocusPvpSlot(pvpDeviceFocus[device.id], device)) {
        pvpDeviceFocus[device.id] = getFirstFocusablePvpSlotIndex(device);
    }
    return pvpDeviceFocus[device.id];
}

function setPvpDeviceFocusIndex(device, slotIndex) {
    if (!device || !device.id || !canDeviceFocusPvpSlot(slotIndex, device)) return;
    pvpDeviceFocus[device.id] = slotIndex;
}

function movePvpDeviceFocus(device, dx, dy) {
    if (!device || (!dx && !dy)) return;
    const startIndex = getPvpDeviceFocusIndex(device);
    const startPos = getSlotGridPosition(startIndex);
    for (let step = 1; step <= state.pvp.slots.length; step++) {
        const nextIndex = getSlotIndexFromGrid(startPos.col + dx * step, startPos.row + dy * step);
        if (canDeviceFocusPvpSlot(nextIndex, device)) {
            pvpDeviceFocus[device.id] = nextIndex;
            return;
        }
    }
}

function clearPvpFocusedSlot(device) {
    const focusIndex = getPvpDeviceFocusIndex(device);
    const slot = state.pvp.slots[focusIndex];
    if (!slot || !device || !slot.device || slot.device.id !== device.id) return;
    state.pvp.slots[focusIndex] = null;
    refreshPvpOverlay();
}

function shuffleArray(items) {
    for (let i = items.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [items[i], items[j]] = [items[j], items[i]];
    }
    return items;
}

function autoAssignUnassignedPvpDevices() {
    const assignedIds = new Set(state.pvp.slots
        .filter(slot => slot && slot.device)
        .map(slot => slot.device.id));
    const unassigned = shuffleArray(pvpDevices
        .filter(device => !assignedIds.has(device.id))
        .map(device => ({ ...device })));
    const emptySlots = shuffleArray(state.pvp.slots
        .map((slot, index) => slot ? -1 : index)
        .filter(index => index >= 0));

    unassigned.forEach(device => {
        const slotIndex = emptySlots.pop();
        if (slotIndex === undefined) return;
        state.pvp.slots[slotIndex] = { device };
    });
}

function startPvpFromSetup() {
    autoAssignUnassignedPvpDevices();
    if (pvpOverlay) pvpOverlay.style.display = 'none';
    if (pvpResultOverlay) pvpResultOverlay.style.display = 'none';
    window.enterPvpBattle();
}

function createPvpTeamColumn(dragonName, dragonIndex) {
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

        const accent = document.createElement('div');
        accent.className = 'pvp-slot-accent';
        accent.style.height = '4px';
        accent.style.borderRadius = '999px';
        accent.style.marginBottom = '7px';
        slot.appendChild(accent);

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
    return column;
}

function createPvpDeviceColumn() {
    const column = document.createElement('div');
    column.style.border = '1px solid rgba(120,190,255,0.26)';
    column.style.borderRadius = '8px';
    column.style.padding = '12px';
    column.style.background = 'rgba(80,130,180,0.08)';
    column.style.minHeight = '220px';

    const heading = document.createElement('div');
    heading.style.display = 'flex';
    heading.style.justifyContent = 'space-between';
    heading.style.alignItems = 'center';
    heading.style.marginBottom = '8px';

    const title = document.createElement('div');
    title.textContent = 'Joined Devices';
    title.style.fontSize = '16px';
    title.style.fontWeight = '900';
    heading.appendChild(title);

    const kbToggleLabel = document.createElement('label');
    kbToggleLabel.style.fontSize = '12px';
    kbToggleLabel.style.display = 'flex';
    kbToggleLabel.style.alignItems = 'center';
    kbToggleLabel.style.gap = '4px';
    kbToggleLabel.style.cursor = 'pointer';

    const kbToggle = document.createElement('input');
    kbToggle.type = 'checkbox';
    kbToggle.id = 'pvp-keyboard-toggle';
    kbToggle.checked = state.pvp.keyboardEnabled !== false;
    kbToggle.addEventListener('change', (e) => {
        state.pvp.keyboardEnabled = e.target.checked;
        if (!state.pvp.keyboardEnabled) {
            pvpDevices = pvpDevices.filter(d => d.id !== PVP_KEYBOARD_DEVICE.id);
            state.pvp.slots.forEach((slot, idx) => {
                if (slot && slot.device && slot.device.id === PVP_KEYBOARD_DEVICE.id) {
                    state.pvp.slots[idx] = null;
                }
            });
            if (selectedPvpDeviceId === PVP_KEYBOARD_DEVICE.id) {
                selectedPvpDeviceId = null;
                pendingDevice = null;
            }
        } else {
            upsertPvpDevice(PVP_KEYBOARD_DEVICE, true);
        }
        refreshPvpOverlay();
    });

    kbToggleLabel.appendChild(kbToggle);
    kbToggleLabel.appendChild(document.createTextNode('啟用鍵鼠'));
    heading.appendChild(kbToggleLabel);

    column.appendChild(heading);

    const hint = document.createElement('div');
    hint.textContent = '鍵鼠會自動加入；手把按任意鍵加入。每個裝置各自用 WASD/方向鍵/左搖桿選位置，Space/Enter/ABXY 確定，已被選走的位置會自動跳過。';
    hint.style.fontSize = '12px';
    hint.style.color = '#a9bfd6';
    hint.style.lineHeight = '1.45';
    hint.style.marginBottom = '10px';
    column.appendChild(hint);

    const list = document.createElement('div');
    list.id = 'pvp-device-list';
    list.style.display = 'flex';
    list.style.flexDirection = 'column';
    list.style.gap = '8px';
    column.appendChild(list);
    return column;
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
    panel.style.width = 'min(1080px, calc(100vw - 36px))';
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
    grid.style.gridTemplateColumns = '1fr minmax(190px, 0.85fr) 1fr';
    grid.style.gap = '14px';
    panel.appendChild(grid);

    grid.appendChild(createPvpTeamColumn('Dragon A', 0));
    grid.appendChild(createPvpDeviceColumn());
    grid.appendChild(createPvpTeamColumn('Dragon B', 1));

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
        startPvpFromSetup();
    });
    actions.appendChild(start);

    document.body.appendChild(pvpOverlay);
}

function refreshPvpOverlay() {
    if (!pvpOverlay) return;
    const kbToggle = document.getElementById('pvp-keyboard-toggle');
    if (kbToggle) kbToggle.checked = state.pvp.keyboardEnabled !== false;

    const line = document.getElementById('pvp-device-line');
    if (line) {
        const selected = getSelectedPvpDevice();
        line.textContent = selected
            ? `滑鼠點選目標：${selected.label}。所有裝置可同時移動自己的選位並確認。`
            : '鍵鼠已可加入；手把按任意按鈕會出現在中間，所有裝置可同時選位。';
    }
    const list = document.getElementById('pvp-device-list');
    if (list) {
        list.innerHTML = '';

        if (pvpDevices.length === 0) {
            const empty = document.createElement('div');
            empty.textContent = 'Waiting for input...';
            empty.style.color = '#74879c';
            empty.style.fontSize = '12px';
            empty.style.padding = '10px';
            empty.style.border = '1px dashed rgba(255,255,255,0.18)';
            empty.style.borderRadius = '7px';
            list.appendChild(empty);
        }

        pvpDevices.forEach(deviceInfo => {
            const assignedIndex = getAssignedSlotIndexForDevice(deviceInfo);
            const focusIndex = getPvpDeviceFocusIndex(deviceInfo);
            const assignedColor = assignedIndex >= 0 ? getPvpSlotColor(assignedIndex) : 0x78beff;
            const focusColor = getPvpSlotColor(focusIndex);
            const card = document.createElement('button');
            card.type = 'button';
            card.className = 'pvp-device-card';
            card.dataset.deviceId = deviceInfo.id;
            card.style.pointerEvents = 'auto';
            card.style.textAlign = 'left';
            card.style.border = '1px solid rgba(255,255,255,0.18)';
            card.style.borderRadius = '7px';
            card.style.padding = '9px';
            card.style.color = 'white';
            card.style.cursor = 'pointer';
            card.style.background = assignedIndex >= 0
                ? `linear-gradient(135deg, ${colorToRgba(assignedColor, 0.38)}, rgba(18,28,38,0.9))`
                : (selectedPvpDeviceId === deviceInfo.id
                    ? `linear-gradient(135deg, ${colorToRgba(focusColor, 0.30)}, rgba(18,28,38,0.9))`
                    : `linear-gradient(135deg, ${colorToRgba(focusColor, 0.16)}, rgba(18,28,38,0.9))`);
            card.style.border = assignedIndex >= 0
                ? `1px solid ${colorToRgba(assignedColor, 0.82)}`
                : (selectedPvpDeviceId === deviceInfo.id
                    ? `1px solid ${colorToRgba(focusColor, 0.72)}`
                    : '1px solid rgba(255,255,255,0.18)');
            card.style.boxShadow = assignedIndex >= 0 ? `0 0 14px ${colorToRgba(assignedColor, 0.22)}` : 'none';
            card.style.opacity = '1';
            card.addEventListener('click', () => {
                selectedPvpDeviceId = deviceInfo.id;
                pendingDevice = { ...deviceInfo };
                refreshPvpOverlay();
            });

            const label = document.createElement('div');
            label.textContent = deviceInfo.label;
            label.style.fontSize = '12px';
            label.style.fontWeight = '900';
            card.appendChild(label);

            const status = document.createElement('div');
            status.textContent = assignedIndex >= 0
                ? getPvpPlayerLabel(assignedIndex)
                : `選擇中：${getPvpPlayerLabel(focusIndex)}`;
            status.style.marginTop = '4px';
            status.style.fontSize = assignedIndex >= 0 ? '16px' : '11px';
            status.style.fontWeight = assignedIndex >= 0 ? '1000' : '700';
            status.style.color = assignedIndex >= 0 ? '#ffffff' : '#adc1d8';
            card.appendChild(status);
            list.appendChild(card);
        });
    }
    document.querySelectorAll('.pvp-slot').forEach(slotEl => {
        const slotIndex = Number(slotEl.dataset.slotIndex);
        const slot = state.pvp.slots[slotIndex];
        const device = slotEl.querySelector('.pvp-slot-device');
        const accent = slotEl.querySelector('.pvp-slot-accent');
        const selected = getSelectedPvpDevice();
        const focusDevices = pvpDevices.filter(deviceInfo =>
            getPvpDeviceFocusIndex(deviceInfo) === slotIndex && canDeviceFocusPvpSlot(slotIndex, deviceInfo));
        const focusedBySelected = selected && getPvpDeviceFocusIndex(selected) === slotIndex && canDeviceFocusPvpSlot(slotIndex, selected);
        const focusedByAny = focusDevices.length > 0;
        const lockedByOther = slot && selected && slot.device && slot.device.id !== selected.id;
        const color = getPvpSlotColor(slotIndex);
        slotEl.style.background = slot
            ? `linear-gradient(135deg, ${colorToRgba(color, 0.58)}, rgba(10,14,18,0.95))`
            : (selected
                ? `linear-gradient(135deg, ${colorToRgba(color, 0.22)}, rgba(16,24,34,0.82))`
                : `linear-gradient(135deg, ${colorToRgba(color, 0.13)}, rgba(16,24,34,0.78))`);
        slotEl.style.border = focusedBySelected
            ? `2px solid ${colorToRgba(color, 0.95)}`
            : (focusedByAny
                ? `2px solid ${colorToRgba(color, 0.72)}`
                : `1px solid ${colorToRgba(color, slot ? 0.9 : 0.42)}`);
        slotEl.style.boxShadow = focusedBySelected
            ? `0 0 18px ${colorToRgba(color, 0.38)}`
            : (focusedByAny && !slot ? `0 0 14px ${colorToRgba(color, 0.26)}` : 'none');
        slotEl.style.opacity = lockedByOther ? '0.72' : '1';
        slotEl.style.cursor = lockedByOther ? 'not-allowed' : 'pointer';
        if (accent) accent.style.background = colorToRgba(color, slot ? 0.95 : 0.78);
        device.textContent = slot && slot.device
            ? getPvpPlayerLabel(slotIndex)
            : (focusDevices.length > 0
                ? `選擇中：${focusDevices.map(d => d.label.split(' ')[0]).join(', ')}`
                : 'Empty');
        device.style.color = slot ? '#ffffff' : '#adc1d8';
        device.style.fontSize = slot ? '20px' : (focusDevices.length > 0 ? '11px' : '12px');
        device.style.fontWeight = slot ? '1000' : '700';
    });
    document.querySelectorAll('[data-pvp-buff-count]').forEach(select => {
        const idx = Number(select.dataset.pvpBuffCount);
        select.value = String(state.pvp.buffCounts[idx]);
    });
}

function assignPendingDeviceToSlot(slotIndex) {
    const device = getSelectedPvpDevice();
    if (!device) {
        refreshPvpOverlay();
        return;
    }
    assignDeviceToPvpSlot(device, slotIndex);
    refreshPvpOverlay();
}

function assignDeviceToPvpSlot(device, slotIndex) {
    if (!device || !canDeviceFocusPvpSlot(slotIndex, device)) return;
    const usedIndex = getAssignedSlotIndexForDevice(device);
    if (usedIndex === slotIndex) {
        setPvpDeviceFocusIndex(device, slotIndex);
        return;
    }
    if (usedIndex >= 0) state.pvp.slots[usedIndex] = null;
    state.pvp.slots[slotIndex] = { device: { ...device } };
    setPvpDeviceFocusIndex(device, slotIndex);
}

function pvpSetPendingDevice(device) {
    upsertPvpDevice(device, device && device.type === 'keyboard');
    refreshPvpOverlay();
}

function pvpHandleGamepadSetupInput(device, action) {
    if (!state.pvp || !state.pvp.configuring) return;
    const selected = upsertPvpDevice(device, false);
    if (!selected) return;

    if (action.dx || action.dy) pvpNewDeviceConfirmBlock[selected.id] = false;
    if (action.dx || action.dy) movePvpDeviceFocus(selected, action.dx || 0, action.dy || 0);
    if (action.confirm && !pvpNewDeviceConfirmBlock[selected.id]) {
        assignDeviceToPvpSlot(selected, getPvpDeviceFocusIndex(selected));
    }
    if (action.confirm) pvpNewDeviceConfirmBlock[selected.id] = false;
    if (action.clear) clearPvpFocusedSlot(selected);
    if (action.start) startPvpFromSetup();
    refreshPvpOverlay();
}

function pvpHandleKeyboardSetupInput(device, action) {
    if (!state.pvp || !state.pvp.configuring) return false;
    const selected = upsertPvpDevice(device, false);
    if (!selected || !action || action.repeat) return false;

    let dx = 0;
    let dy = 0;
    let confirm = false;
    let clear = false;

    if (action.code === 'KeyA' || action.code === 'ArrowLeft') dx = -1;
    if (action.code === 'KeyD' || action.code === 'ArrowRight') dx = 1;
    if (action.code === 'KeyW' || action.code === 'ArrowUp') dy = -1;
    if (action.code === 'KeyS' || action.code === 'ArrowDown') dy = 1;
    if (action.code === 'Space' || action.code === 'Enter' || action.code === 'NumpadEnter') confirm = true;
    if (action.code === 'Backspace' || action.code === 'Delete') clear = true;

    if (!dx && !dy && !confirm && !clear) return false;
    if (dx || dy) {
        pvpNewDeviceConfirmBlock[selected.id] = false;
        movePvpDeviceFocus(selected, dx, dy);
    }
    if (confirm && !pvpNewDeviceConfirmBlock[selected.id]) {
        assignDeviceToPvpSlot(selected, getPvpDeviceFocusIndex(selected));
    }
    if (confirm) pvpNewDeviceConfirmBlock[selected.id] = false;
    if (clear) clearPvpFocusedSlot(selected);
    refreshPvpOverlay();
    return true;
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
    const timeUp = state.pvp.timeUpVictory;
    const winText = state.pvp.winnerIndex === 0
        ? 'Dragon A Wins'
        : (state.pvp.winnerIndex === 1 ? 'Dragon B Wins' : 'Draw');
    title.textContent = timeUp ? `時間到！${winText}` : winText;
    pvpResultOverlay.style.display = 'flex';
}

function ensurePvpBattleHud() {
    const wrapA = document.getElementById('charge-bar-wrap');
    const fillA = document.getElementById('charge-bar-fill');
    const labelA = document.getElementById('charge-label');
    if (wrapA) wrapA.classList.add('charge-bar-wrap');
    if (fillA) fillA.classList.add('charge-bar-fill');
    if (labelA) labelA.classList.add('charge-label');

    if (!document.getElementById('charge-bar-wrap-b')) {
        const wrap = document.createElement('div');
        wrap.id = 'charge-bar-wrap-b';
        wrap.className = 'charge-bar-wrap';
        wrap.style.position = 'absolute';
        wrap.style.bottom = '24px';
        wrap.style.left = '50%';
        wrap.style.transform = 'translateX(5%)';
        wrap.style.width = '320px';
        wrap.style.pointerEvents = 'none';
        wrap.style.zIndex = '10';
        wrap.style.display = 'none';

        const label = document.createElement('div');
        label.id = 'charge-label-b';
        label.className = 'charge-label';
        label.style.textAlign = 'center';
        label.style.color = 'white';
        label.style.fontSize = '13px';
        label.style.fontWeight = 'bold';
        label.style.marginBottom = '5px';
        label.style.textShadow = '0 0 8px #88ff44,0 0 16px #88ff4488';
        label.style.letterSpacing = '2px';
        label.textContent = 'Dragon B 蓄力 0%';
        wrap.appendChild(label);

        const track = document.createElement('div');
        track.style.background = 'rgba(0,0,0,0.7)';
        track.style.height = '22px';
        track.style.borderRadius = '11px';
        track.style.overflow = 'hidden';
        track.style.border = '1px solid rgba(136,255,68,0.5)';
        track.style.boxShadow = '0 0 8px rgba(136,255,68,0.3)';
        wrap.appendChild(track);

        const fill = document.createElement('div');
        fill.id = 'charge-bar-fill-b';
        fill.className = 'charge-bar-fill';
        fill.style.height = '100%';
        fill.style.width = '0%';
        fill.style.background = 'linear-gradient(90deg,#245f18,#52c936,#88ff44,#ffffff88)';
        fill.style.borderRadius = '11px';
        fill.style.boxShadow = '0 0 10px #88ff44';
        track.appendChild(fill);

        document.body.appendChild(wrap);
    }

    if (!document.getElementById('pvp-buff-summary-a')) {
        ['a', 'b'].forEach((suffix, index) => {
            const combo = document.createElement('div');
            combo.id = `pvp-combo-ramp-${suffix}`;
            combo.style.position = 'absolute';
            combo.style.bottom = 'calc(72px + 32vh + 10px)';
            combo.style[index === 0 ? 'left' : 'right'] = '18px';
            combo.style.pointerEvents = 'none';
            combo.style.zIndex = '13';
            combo.style.color = '#ffe66d';
            combo.style.display = 'none';
            combo.style.fontSize = '13px';
            combo.style.fontWeight = '900';
            combo.style.textShadow = '0 0 8px #000, 0 0 14px rgba(255,230,109,0.45)';
            combo.style.background = 'rgba(0,0,0,0.42)';
            combo.style.border = '1px solid rgba(255,230,109,0.35)';
            combo.style.borderRadius = '6px';
            combo.style.padding = '5px 8px';
            document.body.appendChild(combo);

            const panel = document.createElement('div');
            panel.id = `pvp-buff-summary-${suffix}`;
            panel.style.position = 'absolute';
            panel.style.bottom = '72px';
            panel.style[index === 0 ? 'left' : 'right'] = '18px';
            panel.style.width = '230px';
            panel.style.maxHeight = '32vh';
            panel.style.overflow = 'hidden';
            panel.style.pointerEvents = 'none';
            panel.style.zIndex = '12';
            panel.style.color = 'white';
            panel.style.display = 'none';
            panel.style.transition = 'left 0.45s ease, right 0.45s ease, bottom 0.45s ease, width 0.45s ease, transform 0.45s ease';

            const title = document.createElement('div');
            title.textContent = index === 0 ? 'Dragon A Buffs' : 'Dragon B Buffs';
            title.style.fontSize = '12px';
            title.style.fontWeight = '900';
            title.style.marginBottom = '6px';
            title.style.textAlign = index === 0 ? 'left' : 'right';
            title.style.textShadow = '0 0 8px #000';
            panel.appendChild(title);

            const list = document.createElement('div');
            list.className = 'pvp-buff-summary-list';
            list.style.display = 'flex';
            list.style.flexDirection = 'column';
            list.style.gap = '5px';
            list.style.alignItems = index === 0 ? 'flex-start' : 'flex-end';
            panel.appendChild(list);

            document.body.appendChild(panel);
        });
    }

    if (!document.getElementById('pvp-match-timer')) {
        const timerEl = document.createElement('div');
        timerEl.id = 'pvp-match-timer';
        timerEl.style.position = 'absolute';
        timerEl.style.top = '18px';
        timerEl.style.left = '50%';
        timerEl.style.transform = 'translateX(-50%)';
        timerEl.style.zIndex = '20';
        timerEl.style.display = 'none';
        timerEl.style.color = 'white';
        timerEl.style.fontSize = '28px';
        timerEl.style.fontWeight = '900';
        timerEl.style.letterSpacing = '3px';
        timerEl.style.textShadow = '0 0 10px #000, 0 0 20px rgba(255,255,255,0.4)';
        timerEl.style.pointerEvents = 'none';
        timerEl.style.fontFamily = 'monospace';
        document.body.appendChild(timerEl);
    }

    if (!document.getElementById('pvp-start-countdown')) {
        const overlay = document.createElement('div');
        overlay.id = 'pvp-start-countdown';
        overlay.style.position = 'absolute';
        overlay.style.inset = '0';
        overlay.style.zIndex = '95';
        overlay.style.display = 'none';
        overlay.style.alignItems = 'center';
        overlay.style.justifyContent = 'center';
        overlay.style.pointerEvents = 'none';
        overlay.style.color = 'white';
        overlay.style.fontSize = '76px';
        overlay.style.fontWeight = '1000';
        overlay.style.textShadow = '0 0 18px #000, 0 0 34px rgba(255,255,255,0.55)';
        overlay.style.letterSpacing = '0';
        document.body.appendChild(overlay);
    }
}

function updatePvpComboRampSummary(panelId, dragon) {
    const panel = document.getElementById(panelId);
    if (!panel) return;
    const active = state.pvp.active && dragon && dragon.buffSystem && dragon.buffSystem.isActive('comboRamp');
    panel.style.display = active ? 'block' : 'none';
    if (!active) return;

    const stacks = dragon.comboRampStacks || 0;
    const mult = 1 + stacks * CONFIG.buffs.comboDamageStepPct;
    const timer = Math.max(0, dragon.comboRampTimer || 0);
    const intro = state.pvp.startCountdownTimer > 0 || state.pvp.startTextTimer > 0;
    const isA = panelId.endsWith('-a');
    panel.style.bottom = intro ? 'calc(50% + 190px)' : 'calc(72px + 32vh + 10px)';
    panel.style.left = isA ? (intro ? '8vw' : '18px') : '';
    panel.style.right = isA ? '' : (intro ? '8vw' : '18px');
    panel.style.fontSize = intro ? '18px' : '13px';
    panel.style.zIndex = intro ? '97' : '13';
    panel.textContent = `Combo ${stacks}  ${timer.toFixed(1)}s  x${mult.toFixed(2)}`;
}

function updateChargeBarForDragon(dragon, ids, dragonLabel, palette) {
    const wrap = document.getElementById(ids.wrap);
    const fill = document.getElementById(ids.fill);
    const label = document.getElementById(ids.label);
    if (!wrap || !fill || !label) return;

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

    fill.style.width = pct + '%';
    wrap.classList.toggle('beam-firing', dragon && dragon.beamPhase === 'firing');
    wrap.classList.toggle('beam-prefire', dragon && dragon.beamPhase === 'prefire');

    if (dragon && dragon.beamPhase === 'firing') {
        fill.style.background = palette.firing;
        label.style.color = '#ffffff';
        label.style.textShadow = `0 0 12px #ffffff, 0 0 24px ${palette.glow}`;
    } else if (isCooldownLocked) {
        fill.style.background = 'linear-gradient(90deg,#5f6268,#8b8f96,#c8ccd2)';
        label.style.color = '#d9dde3';
        label.style.textShadow = '0 0 6px #111';
    } else if (dragon && dragon.beamPhase === 'postfire') {
        fill.style.background = palette.postfire;
        label.style.color = palette.postText;
        label.style.textShadow = `0 0 6px ${palette.glow}`;
    } else {
        fill.style.background = palette.idle;
        label.style.color = '#ffffff';
        label.style.textShadow = `0 0 8px ${palette.glow}, 0 0 16px ${palette.glow}88`;
    }

    if (!dragon) {
        label.textContent = `Dragon ${dragonLabel} 蓄力 0%`;
    } else if (dragon.beamPhase === 'firing') {
        label.textContent = `Dragon ${dragonLabel} 光束炮發射中 ${Math.ceil(dragon.beamFiringTimer)}s`;
    } else if (dragon.beamPhase === 'prefire') {
        label.textContent = `Dragon ${dragonLabel} 即將發射`;
    } else if (isCooldownLocked) {
        label.textContent = `Dragon ${dragonLabel} 合體技封鎖 ${dragon.comboCooldown.toFixed(1)}s`;
    } else if (dragon.beamPhase === 'postfire') {
        label.textContent = `Dragon ${dragonLabel} 後搖中`;
    } else {
        label.textContent = `Dragon ${dragonLabel} 蓄力 ${pct.toFixed(0)}%`;
    }
}

function updatePvpBuffSummaryPanel(panelId, dragon) {
    const panel = document.getElementById(panelId);
    if (!panel) return;
    const list = panel.querySelector('.pvp-buff-summary-list');
    if (!list) return;
    panel.style.display = state.pvp.active ? 'block' : 'none';
    if (!state.pvp.active) return;

    const isA = panelId.endsWith('-a');
    const intro = state.pvp.startCountdownTimer > 0 || state.pvp.startTextTimer > 0;
    panel.style.bottom = intro ? '50%' : '72px';
    panel.style.width = intro ? '320px' : '230px';
    panel.style.maxHeight = intro ? '44vh' : '32vh';
    panel.style.transform = intro ? 'translateY(50%) scale(1.18)' : 'translateY(0) scale(1)';
    panel.style.left = isA ? (intro ? '8vw' : '18px') : '';
    panel.style.right = isA ? '' : (intro ? '8vw' : '18px');
    panel.style.zIndex = intro ? '96' : '12';

    const title = panel.firstChild;
    if (title && title.style) {
        title.style.fontSize = intro ? '18px' : '12px';
        title.style.marginBottom = intro ? '10px' : '6px';
    }
    list.style.gap = intro ? '9px' : '5px';

    list.innerHTML = '';
    const entries = dragon && dragon.buffSystem ? dragon.buffSystem.getActiveIconEntries() : [];
    if (entries.length === 0) {
        const empty = document.createElement('div');
        empty.textContent = 'No Buff';
        empty.style.fontSize = intro ? '18px' : '12px';
        empty.style.color = 'rgba(255,255,255,0.52)';
        empty.style.textShadow = '0 0 8px #000';
        list.appendChild(empty);
        return;
    }

    entries.forEach(entry => {
        const row = document.createElement('div');
        row.style.display = 'inline-flex';
        row.style.alignItems = 'center';
        row.style.gap = '6px';
        row.style.background = 'rgba(0,0,0,0.42)';
        row.style.border = '1px solid rgba(255,255,255,0.12)';
        row.style.borderRadius = '6px';
        row.style.padding = intro ? '8px 11px' : '4px 7px';
        row.style.backdropFilter = 'blur(2px)';
        const icon = createBuffIconElement(entry.id);
        icon.style.width = intro ? '30px' : '20px';
        icon.style.height = intro ? '30px' : '20px';
        icon.style.fontSize = intro ? (getBuffIconSpec(entry.id).glyph.length > 1 ? '13px' : '17px') : (getBuffIconSpec(entry.id).glyph.length > 1 ? '9px' : '12px');
        row.appendChild(icon);

        const text = document.createElement('span');
        text.textContent = `${BUFFS[entry.id].name}${entry.stack > 1 ? ` x${entry.stack}` : ''}`;
        text.style.fontSize = intro ? '18px' : '12px';
        text.style.fontWeight = '700';
        text.style.textShadow = '0 0 8px #000';
        row.appendChild(text);
        list.appendChild(row);
    });
}

function updatePvpCountdownUI() {
    const overlay = document.getElementById('pvp-start-countdown');
    if (!overlay) return;
    const show = state.pvp.active && !state.pvp.ended &&
        (state.pvp.startCountdownTimer > 0 || state.pvp.startTextTimer > 0);
    overlay.style.display = show ? 'flex' : 'none';
    if (!show) return;
    overlay.textContent = state.pvp.startCountdownTimer > 0
        ? String(Math.ceil(state.pvp.startCountdownTimer))
        : 'Start';
}

// 主迴圈每幀呼叫，更新所有 DOM HUD
function updateUI() {
    ensurePvpBattleHud();
    const isPvpHud = state.pvp.active;
    const barA = document.getElementById('charge-bar-wrap');
    const barB = document.getElementById('charge-bar-wrap-b');
    const paletteA = {
        idle: 'linear-gradient(90deg,#660066,#cc00cc,#ff00ff,#ffffff88)',
        firing: 'linear-gradient(90deg,#cc00cc,#ff00ff,#ffffff)',
        postfire: 'linear-gradient(90deg,#440044,#880088,#cc00cc88)',
        glow: '#ff00ff',
        postText: '#cc88cc'
    };
    const paletteB = {
        idle: 'linear-gradient(90deg,#245f18,#52c936,#88ff44,#ffffff88)',
        firing: 'linear-gradient(90deg,#52c936,#88ff44,#ffffff)',
        postfire: 'linear-gradient(90deg,#183f12,#357f26,#88ff4488)',
        glow: '#88ff44',
        postText: '#9fd982'
    };

    if (barA) {
        barA.style.display = 'block';
        barA.style.width = isPvpHud ? '320px' : '360px';
        barA.style.left = '50%';
        barA.style.transform = isPvpHud ? 'translateX(-105%)' : 'translateX(-50%)';
    }
    if (barB) barB.style.display = isPvpHud ? 'block' : 'none';

    if (isPvpHud) {
        updateChargeBarForDragon(state.dragons[0], { wrap: 'charge-bar-wrap', fill: 'charge-bar-fill', label: 'charge-label' }, 'A', paletteA);
        updateChargeBarForDragon(state.dragons[1], { wrap: 'charge-bar-wrap-b', fill: 'charge-bar-fill-b', label: 'charge-label-b' }, 'B', paletteB);
    } else {
        const dragon = getHudDragon();
        const label = state.buffTarget === 1 ? 'B' : 'A';
        updateChargeBarForDragon(dragon, { wrap: 'charge-bar-wrap', fill: 'charge-bar-fill', label: 'charge-label' }, label, label === 'B' ? paletteB : paletteA);
    }

    updatePvpBuffSummaryPanel('pvp-buff-summary-a', state.dragons[0]);
    updatePvpBuffSummaryPanel('pvp-buff-summary-b', state.dragons[1]);
    updatePvpComboRampSummary('pvp-combo-ramp-a', state.dragons[0]);
    updatePvpComboRampSummary('pvp-combo-ramp-b', state.dragons[1]);
    updatePvpCountdownUI();
    updatePvpTimerUI();
}

function updatePvpTimerUI() {
    const el = document.getElementById('pvp-match-timer');
    if (!el) return;
    const show = state.pvp.active && !state.pvp.ended && !state.pvp.configuring &&
                 state.pvp.startCountdownTimer <= 0;
    el.style.display = show ? 'block' : 'none';
    if (!show) return;
    const secs = Math.ceil(Math.max(0, state.pvp.matchTimer));
    const mm = String(Math.floor(secs / 60)).padStart(2, '0');
    const ss = String(secs % 60).padStart(2, '0');
    el.textContent = `${mm}:${ss}`;
    // 最後 30 秒文字變紅並加大
    if (secs <= 30) {
        el.style.color = secs <= 10 ? '#ff4444' : '#ffaa44';
        el.style.fontSize = secs <= 10 ? '34px' : '30px';
    } else {
        el.style.color = 'white';
        el.style.fontSize = '28px';
    }
}

window.pvpSetPendingDevice = pvpSetPendingDevice;
window.pvpHandleGamepadSetupInput = pvpHandleGamepadSetupInput;
window.pvpHandleKeyboardSetupInput = pvpHandleKeyboardSetupInput;
window.showPvpResultOverlay = showPvpResultOverlay;
window.refreshAllUI = refreshAllUI;
