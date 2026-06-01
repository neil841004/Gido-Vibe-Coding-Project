// =====================================================================
// input.js — 鍵盤 + Gamepad 輸入
// 測試模式：鍵盤可直接同時操作兩隻三頭龍。
// PVP 模式：配對完成後，只有被指派的 slot 會接收對應裝置輸入。
// =====================================================================

function setupInputs() {
    const keys = {};
    const gamepadButtonMemory = new Map();
    const gamepadSetupNavMemory = new Map();
    let mouseAttack = false;
    let mouseCharge = false;
    let mousePos = new THREE.Vector2(window.innerWidth / 2, window.innerHeight / 2);

    const keyboardDevice = { type: 'keyboard', id: 'keyboard', label: 'Keyboard / Mouse' };

    const isPointerOnGameUI = (target) => {
        if (!target || !target.closest) return false;
        return !!target.closest(
            '#info, #buff-panel, #pvp-setup-overlay, #pvp-result-overlay, #mystery-box-overlay, button, input, select, textarea, label'
        );
    };

    const setKey = (e, isDown) => {
        keys[e.code] = isDown;
        if (e.code && e.code.startsWith('Arrow')) e.preventDefault();
        if (isDown) {
            SoundSystem.init();
            if (state.pvp && state.pvp.configuring) {
                if (typeof window.pvpSetPendingDevice === 'function') {
                    window.pvpSetPendingDevice(keyboardDevice);
                }
                if (typeof window.pvpHandleKeyboardSetupInput === 'function') {
                    const handled = window.pvpHandleKeyboardSetupInput(keyboardDevice, {
                        code: e.code,
                        repeat: !!e.repeat
                    });
                    if (handled) e.preventDefault();
                }
            }
        }
    };

    window.addEventListener('keydown', (e) => setKey(e, true));
    window.addEventListener('keyup', (e) => setKey(e, false));

    window.addEventListener('blur', () => {
        Object.keys(keys).forEach(k => keys[k] = false);
        mouseAttack = false;
        mouseCharge = false;
    });

    window.addEventListener('mousedown', (e) => {
        SoundSystem.init();
        mousePos.set(e.clientX, e.clientY);
        if (isPointerOnGameUI(e.target)) {
            if (e.button === 0) mouseAttack = false;
            if (e.button === 2) mouseCharge = false;
            return;
        }
        const isPvpSetupClick = e.target && e.target.closest && e.target.closest('#pvp-setup-overlay');
        if (!isPvpSetupClick && state.pvp && state.pvp.configuring && typeof window.pvpSetPendingDevice === 'function') {
            window.pvpSetPendingDevice(keyboardDevice);
        }
        if (e.button === 0) mouseAttack = true;
        if (e.button === 2) mouseCharge = true;
    });
    window.addEventListener('mousemove', (e) => {
        mousePos.set(e.clientX, e.clientY);
    });
    window.addEventListener('mouseup', (e) => {
        if (e.button === 0) mouseAttack = false;
        if (e.button === 2) mouseCharge = false;
    });
    window.addEventListener('contextmenu', e => e.preventDefault());

    window.addEventListener("gamepadconnected", (e) => {
        console.log("Gamepad connected at index %d: %s. %d buttons, %d axes.",
            e.gamepad.index, e.gamepad.id,
            e.gamepad.buttons.length, e.gamepad.axes.length);
    });

    const resetDragonInput = (dragon) => {
        if (!dragon) return;
        ['p1', 'p2', 'p3', 'p4'].forEach(p => {
            dragon.input[p].move.set(0, 0);
            dragon.input[p].attack = false;
            dragon.input[p].charge = false;
            dragon.input[p].pointerActive = false;
        });
    };

    const assignMove = (dragon, player, vx, vy) => {
        if (!dragon || !dragon.input[player]) return;
        dragon.input[player].move.set(vx, vy);
        if (dragon.input[player].move.length() > 1) dragon.input[player].move.normalize();
    };

    const applyKeyboardTestControls = () => {
        const dragonA = state.dragons[0];
        const dragonB = state.dragons[1];
        const canCharge = true;
        let arrowVx = 0, arrowVy = 0;
        if (keys['ArrowUp']) arrowVy -= 1;
        if (keys['ArrowDown']) arrowVy += 1;
        if (keys['ArrowLeft']) arrowVx -= 1;
        if (keys['ArrowRight']) arrowVx += 1;
        const hasArrowMove = arrowVx !== 0 || arrowVy !== 0;

        if (dragonA) {
            let vx = 0, vy = 0;
            if (keys['KeyW']) vy -= 1;
            if (keys['KeyS']) vy += 1;
            if (keys['KeyA']) vx -= 1;
            if (keys['KeyD']) vx += 1;
            if (hasArrowMove) {
                ['p1', 'p2', 'p3', 'p4'].forEach(player => assignMove(dragonA, player, arrowVx, arrowVy));
            } else {
                assignMove(dragonA, 'p1', vx, vy);
            }
            dragonA.input.p1.pointer.copy(mousePos);
            dragonA.input.p1.pointerActive = true;
            dragonA.input.p1.attack = mouseAttack || !!keys['Digit1'];
            dragonA.input.p3.attack = !!keys['Digit2'];
            dragonA.input.p2.attack = !!keys['Digit3'];
            dragonA.input.p4.attack = !!keys['Digit4'];
            dragonA.input.p1.charge = canCharge && (mouseCharge || !!keys['Digit5']);
            dragonA.input.p3.charge = canCharge && !!keys['Digit6'];
            dragonA.input.p2.charge = canCharge && !!keys['Digit7'];
            dragonA.input.p4.charge = canCharge && !!keys['Digit8'];
        }

        if (dragonB) {
            if (!dragonA && hasArrowMove) assignMove(dragonB, 'p1', arrowVx, arrowVy);
            dragonB.input.p1.attack = !!keys['Numpad1'];
            dragonB.input.p3.attack = !!keys['Numpad2'];
            dragonB.input.p2.attack = !!keys['Numpad3'];
            dragonB.input.p4.attack = !!keys['Numpad4'];
            dragonB.input.p1.charge = canCharge && !!keys['Numpad5'];
            dragonB.input.p3.charge = canCharge && !!keys['Numpad6'];
            dragonB.input.p2.charge = canCharge && !!keys['Numpad7'];
            dragonB.input.p4.charge = canCharge && !!keys['Numpad8'];
        }
    };

    const applyKeyboardTestControlsForPveDragonA = () => {
        const dragonA = state.dragons[0];
        if (!dragonA) return;
        let vx = 0, vy = 0;
        if (keys['ArrowUp']) vy -= 1;
        if (keys['ArrowDown']) vy += 1;
        if (keys['ArrowLeft']) vx -= 1;
        if (keys['ArrowRight']) vx += 1;
        // 方向鍵移動同步套用到四個部位，等同四位玩家同時推同方向
        assignMove(dragonA, 'p1', vx, vy);
        assignMove(dragonA, 'p2', vx, vy);
        assignMove(dragonA, 'p3', vx, vy);
        assignMove(dragonA, 'p4', vx, vy);
        dragonA.input.p1.pointer.copy(mousePos);
        dragonA.input.p1.pointerActive = true;
        dragonA.input.p1.attack = mouseAttack || !!keys['Digit1'];
        dragonA.input.p3.attack = !!keys['Digit2'];
        dragonA.input.p2.attack = !!keys['Digit3'];
        dragonA.input.p4.attack = !!keys['Digit4'];
        dragonA.input.p1.charge = mouseCharge || !!keys['Digit5'];
        dragonA.input.p3.charge = !!keys['Digit6'];
        dragonA.input.p2.charge = !!keys['Digit7'];
        dragonA.input.p4.charge = !!keys['Digit8'];
    };

    const getKeyboardSlotControls = (slotIndex) => {
        const partOffset = slotIndex % 4;
        const player = ['p1', 'p2', 'p3', 'p4'][partOffset];

        let vx = 0, vy = 0;
        if (keys['KeyW']) vy -= 1;
        if (keys['KeyS']) vy += 1;
        if (keys['KeyA']) vx -= 1;
        if (keys['KeyD']) vx += 1;
        return {
            player,
            move: new THREE.Vector2(vx, vy),
            attack: mouseAttack,
            charge: mouseCharge,
            pointer: mousePos
        };
    };

    const getKeyboardAssignedSlotIndex = () => {
        if (!state.pvp || !state.pvp.active) return -1;
        return state.pvp.slots.findIndex(slot => slot && slot.device && slot.device.id === keyboardDevice.id);
    };

    const applyKeyboardDebugControlsForPvp = () => {
        const dragonA = state.dragons[0];
        const dragonB = state.dragons[1];
        const keyboardAssignedSlot = getKeyboardAssignedSlotIndex();
        const allowWasdDebug = keyboardAssignedSlot < 0 || keyboardAssignedSlot === 0;
        const anyMoveA = allowWasdDebug && !!(keys['KeyW'] || keys['KeyS'] || keys['KeyA'] || keys['KeyD']);
        const anyMoveB = !!(keys['ArrowUp'] || keys['ArrowDown'] || keys['ArrowLeft'] || keys['ArrowRight']);

        if (dragonA) {
            if (anyMoveA) {
                let vx = 0, vy = 0;
                if (keys['KeyW']) vy -= 1;
                if (keys['KeyS']) vy += 1;
                if (keys['KeyA']) vx -= 1;
                if (keys['KeyD']) vx += 1;
                assignMove(dragonA, 'p1', vx, vy);
            }
            ['p1', 'p3', 'p2', 'p4'].forEach((p, i) => {
                if (keys[`Digit${i + 1}`]) dragonA.input[p].attack = true;
                if (keys[`Digit${i + 5}`]) dragonA.input[p].charge = true;
            });
        }

        if (dragonB) {
            if (anyMoveB) {
                let vx = 0, vy = 0;
                if (keys['ArrowUp']) vy -= 1;
                if (keys['ArrowDown']) vy += 1;
                if (keys['ArrowLeft']) vx -= 1;
                if (keys['ArrowRight']) vx += 1;
                assignMove(dragonB, 'p1', vx, vy);
            }
            ['p1', 'p3', 'p2', 'p4'].forEach((p, i) => {
                if (keys[`Numpad${i + 1}`]) dragonB.input[p].attack = true;
                if (keys[`Numpad${i + 5}`]) dragonB.input[p].charge = true;
            });
        }
    };

    // 已知標準手把（Xbox / PlayStation）使用 West (button 2) 作為 Melee；
    // 雜牌手把可能改成 South (button 0)，故對未識別手把同時接受兩顆按鍵。
    const isKnownController = (gpId) => {
        if (!gpId) return false;
        const id = gpId.toLowerCase();
        return id.includes('xbox') || id.includes('045e') ||
               id.includes('dualsense') || id.includes('dualshock') ||
               id.includes('054c') || id.includes('wireless controller');
    };

    const getGamepadMeleePressed = (gp) => {
        const west  = !!(gp.buttons[2] && gp.buttons[2].pressed);
        const south = !!(gp.buttons[3] && gp.buttons[3].pressed);
        return isKnownController(gp.id) ? west : (west || south);
    };

    const getGamepadSlotControls = (slotIndex, gp) => {
        const player = ['p1', 'p2', 'p3', 'p4'][slotIndex % 4];
        const axisX = Math.abs(gp.axes[0]) > 0.1 ? gp.axes[0] : 0;
        const axisY = Math.abs(gp.axes[1]) > 0.1 ? gp.axes[1] : 0;
        return {
            player,
            move: new THREE.Vector2(axisX, axisY),
            attack: getGamepadMeleePressed(gp),
            charge: !!(gp.buttons[7] && gp.buttons[7].pressed)
        };
    };

    const applyControlsToSlot = (slotIndex, controls) => {
        if (!controls) return;
        const dragon = state.dragons[slotIndex < 4 ? 0 : 1];
        if (!dragon) return;
        const input = dragon.input[controls.player];
        if (!input) return;

        input.move.copy(controls.move);
        if (input.move.length() > 1) input.move.normalize();
        input.attack = input.attack || controls.attack;
        input.charge = input.charge || controls.charge;
        if (controls.pointer && input.pointer) {
            input.pointer.copy(controls.pointer);
            input.pointerActive = true;
        }
    };

    const applyAutoDeviceControls = (gamepads) => {
        const devices = [{ type: 'keyboard' }];
        gamepads.forEach(gp => {
            if (gp) devices.push({ type: 'gamepad', gamepad: gp });
        });

        devices.slice(0, 8).forEach((device, slotIndex) => {
            if (slotIndex >= 4 && !state.dragons[1] && typeof window.ensureEnemyDragon === 'function') {
                window.ensureEnemyDragon();
                if (typeof refreshAllUI === 'function') refreshAllUI();
            }
            if (slotIndex >= 4 && !state.dragons[1]) return;
            const controls = device.type === 'keyboard'
                ? getKeyboardSlotControls(slotIndex)
                : getGamepadSlotControls(slotIndex, device.gamepad);
            applyControlsToSlot(slotIndex, controls);
        });
    };

    const pollPairingDevices = (gamepads) => {
        if (!state.pvp || !state.pvp.configuring || typeof window.pvpSetPendingDevice !== 'function') return;
        gamepads.forEach(gp => {
            if (!gp) return;
            const pressed = gp.buttons.some(b => b && b.pressed);
            const key = `gp:${gp.index}`;
            const wasPressed = gamepadButtonMemory.get(key) || false;
            if (pressed && !wasPressed) {
                const device = {
                    type: 'gamepad',
                    id: key,
                    index: gp.index,
                    label: gp.id || `Gamepad ${gp.index + 1}`
                };
                window.pvpSetPendingDevice(device);
            }
            gamepadButtonMemory.set(key, pressed);
            if (typeof window.pvpHandleGamepadSetupInput === 'function') {
                const device = {
                    type: 'gamepad',
                    id: key,
                    index: gp.index,
                    label: gp.id || `Gamepad ${gp.index + 1}`
                };
                const axisX = Math.abs(gp.axes[0]) > 0.55 ? Math.sign(gp.axes[0]) : 0;
                const axisY = Math.abs(gp.axes[1]) > 0.55 ? Math.sign(gp.axes[1]) : 0;
                const hasSetupActivity = pressed || axisX || axisY;
                if (!hasSetupActivity) {
                    if (gamepadSetupNavMemory.has(key)) {
                        gamepadSetupNavMemory.set(key, {
                            dx: 0,
                            dy: 0,
                            confirm: false,
                            clear: false,
                            start: false,
                            lastMoveAt: gamepadSetupNavMemory.get(key).lastMoveAt || 0
                        });
                    }
                    return;
                }
                const dx = (gp.buttons[15] && gp.buttons[15].pressed ? 1 : 0) -
                    (gp.buttons[14] && gp.buttons[14].pressed ? 1 : 0) || axisX;
                const dy = (gp.buttons[13] && gp.buttons[13].pressed ? 1 : 0) -
                    (gp.buttons[12] && gp.buttons[12].pressed ? 1 : 0) || axisY;
                const now = performance.now();
                const nav = gamepadSetupNavMemory.get(key) || {
                    dx: 0,
                    dy: 0,
                    confirm: false,
                    clear: false,
                    start: false,
                    lastMoveAt: 0
                };
                const moveReady = (dx || dy) && (
                    dx !== nav.dx ||
                    dy !== nav.dy ||
                    now - nav.lastMoveAt > 220
                );
                const confirm = [0, 1, 2, 3].some(index => gp.buttons[index] && gp.buttons[index].pressed);
                const clear = !!(gp.buttons[8] && gp.buttons[8].pressed);
                const start = !!((gp.buttons[9] && gp.buttons[9].pressed) || (gp.buttons[7] && gp.buttons[7].pressed));
                window.pvpHandleGamepadSetupInput(device, {
                    dx: moveReady ? dx : 0,
                    dy: moveReady ? dy : 0,
                    confirm: confirm && !nav.confirm,
                    clear: clear && !nav.clear,
                    start: start && !nav.start
                });
                gamepadSetupNavMemory.set(key, {
                    dx,
                    dy,
                    confirm,
                    clear,
                    start,
                    lastMoveAt: moveReady ? now : nav.lastMoveAt
                });
            }
        });
    };

    const applyPvpControls = (gamepads) => {
        state.pvp.slots.forEach((slot, slotIndex) => {
            if (!slot || !slot.device) return;
            const dragon = state.dragons[slotIndex < 4 ? 0 : 1];
            if (!dragon) return;

            let controls = null;
            if (slot.device.type === 'keyboard') {
                controls = getKeyboardSlotControls(slotIndex);
            } else if (slot.device.type === 'gamepad') {
                const gp = gamepads[slot.device.index];
                if (gp) controls = getGamepadSlotControls(slotIndex, gp);
            }
            if (!controls) return;

            applyControlsToSlot(slotIndex, controls);
        });
    };

    state.pollInputs = () => {
        const gamepads = navigator.getGamepads ? Array.from(navigator.getGamepads()) : [];
        pollPairingDevices(gamepads);

        state.dragons.forEach(resetDragonInput);
        if (state.pvp && state.pvp.configuring) return;
        if (state.pvp && state.pvp.active && state.pvp.startCountdownTimer > 0) return;
        if (state.pvp && state.pvp.active) {
            const testKeyboard = !!state.pvp.disableKeyboard;
            if (testKeyboard) {
                // 啟用鍵鼠測試：鍵盤直接控制 Dragon A 全部位，手把仍依 overlay 指派生效
                applyKeyboardTestControlsForPveDragonA();
                applyPvpControls(gamepads);
            } else {
                applyPvpControls(gamepads);
                if (!state.pve || !state.pve.active) applyKeyboardDebugControlsForPvp();
            }
        } else {
            applyKeyboardTestControls();
            gamepads.forEach((gp, gpIndex) => {
                if (!gp) return;
                const slotIndex = gpIndex + 1;
                if (slotIndex >= 8) return;
                if (slotIndex >= 4 && !state.dragons[1] && typeof window.ensureEnemyDragon === 'function') {
                    window.ensureEnemyDragon();
                    if (typeof refreshAllUI === 'function') refreshAllUI();
                }
                if (slotIndex >= 4 && !state.dragons[1]) return;
                applyControlsToSlot(slotIndex, getGamepadSlotControls(slotIndex, gp));
            });
        }
    };
}
