// =====================================================================
// input.js — 鍵盤 + Gamepad 輸入
// 測試模式：鍵盤可直接同時操作兩隻三頭龍。
// PVP 模式：配對完成後，只有被指派的 slot 會接收對應裝置輸入。
// =====================================================================

function setupInputs() {
    const keys = {};
    const gamepadButtonMemory = new Map();
    let mouseAttack = false;
    let mouseCharge = false;
    let mousePos = new THREE.Vector2(window.innerWidth / 2, window.innerHeight / 2);

    const keyboardDevice = { type: 'keyboard', id: 'keyboard', label: 'Keyboard / Mouse' };

    const setKey = (e, isDown) => {
        keys[e.code] = isDown;
        if (isDown) {
            SoundSystem.init();
            if (state.pvp && state.pvp.configuring && typeof window.pvpSetPendingDevice === 'function') {
                window.pvpSetPendingDevice(keyboardDevice);
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
        if (state.pvp && state.pvp.configuring && typeof window.pvpSetPendingDevice === 'function') {
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
        });
        if (dragon.input.p1.pointer) dragon.input.p1.pointer.copy(mousePos);
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

        if (dragonA) {
            let vx = 0, vy = 0;
            if (keys['KeyW']) vy -= 1;
            if (keys['KeyS']) vy += 1;
            if (keys['KeyA']) vx -= 1;
            if (keys['KeyD']) vx += 1;
            assignMove(dragonA, 'p1', vx, vy);
            dragonA.input.p1.pointer.copy(mousePos);
            dragonA.input.p1.attack = mouseAttack || !!keys['Digit1'];
            dragonA.input.p2.attack = !!keys['Digit2'];
            dragonA.input.p3.attack = !!keys['Digit3'];
            dragonA.input.p4.attack = !!keys['Digit4'];
            dragonA.input.p1.charge = canCharge && (mouseCharge || !!keys['Digit5']);
            dragonA.input.p2.charge = canCharge && !!keys['Digit6'];
            dragonA.input.p3.charge = canCharge && !!keys['Digit7'];
            dragonA.input.p4.charge = canCharge && !!keys['Digit8'];
        }

        if (dragonB) {
            let vx = 0, vy = 0;
            if (keys['ArrowUp']) vy -= 1;
            if (keys['ArrowDown']) vy += 1;
            if (keys['ArrowLeft']) vx -= 1;
            if (keys['ArrowRight']) vx += 1;
            assignMove(dragonB, 'p1', vx, vy);
            dragonB.input.p1.attack = !!keys['Numpad1'];
            dragonB.input.p2.attack = !!keys['Numpad2'];
            dragonB.input.p3.attack = !!keys['Numpad3'];
            dragonB.input.p4.attack = !!keys['Numpad4'];
            dragonB.input.p1.charge = canCharge && !!keys['Numpad5'];
            dragonB.input.p2.charge = canCharge && !!keys['Numpad6'];
            dragonB.input.p3.charge = canCharge && !!keys['Numpad7'];
            dragonB.input.p4.charge = canCharge && !!keys['Numpad8'];
        }
    };

    const getKeyboardSlotControls = (slotIndex) => {
        const dragonIndex = slotIndex < 4 ? 0 : 1;
        const partOffset = slotIndex % 4;
        const player = ['p1', 'p2', 'p3', 'p4'][partOffset];

        if (dragonIndex === 0) {
            let vx = 0, vy = 0;
            if (keys['KeyW']) vy -= 1;
            if (keys['KeyS']) vy += 1;
            if (keys['KeyA']) vx -= 1;
            if (keys['KeyD']) vx += 1;
            return {
                player,
                move: new THREE.Vector2(vx, vy),
                attack: !!keys[`Digit${partOffset + 1}`] || (partOffset === 0 && mouseAttack),
                charge: !!keys[`Digit${partOffset + 5}`] || (partOffset === 0 && mouseCharge),
                pointer: mousePos
            };
        }

        let vx = 0, vy = 0;
        if (keys['ArrowUp']) vy -= 1;
        if (keys['ArrowDown']) vy += 1;
        if (keys['ArrowLeft']) vx -= 1;
        if (keys['ArrowRight']) vx += 1;
        return {
            player,
            move: new THREE.Vector2(vx, vy),
            attack: !!keys[`Numpad${partOffset + 1}`],
            charge: !!keys[`Numpad${partOffset + 5}`],
            pointer: mousePos
        };
    };

    const getGamepadSlotControls = (slotIndex, gp) => {
        const player = ['p1', 'p2', 'p3', 'p4'][slotIndex % 4];
        const axisX = Math.abs(gp.axes[0]) > 0.1 ? gp.axes[0] : 0;
        const axisY = Math.abs(gp.axes[1]) > 0.1 ? gp.axes[1] : 0;
        return {
            player,
            move: new THREE.Vector2(axisX, axisY),
            attack: !!(gp.buttons[2] && gp.buttons[2].pressed),
            charge: !!(gp.buttons[7] && gp.buttons[7].pressed)
        };
    };

    const pollPairingDevices = (gamepads) => {
        if (!state.pvp || !state.pvp.configuring || typeof window.pvpSetPendingDevice !== 'function') return;
        gamepads.forEach(gp => {
            if (!gp) return;
            const pressed = gp.buttons.some(b => b && b.pressed);
            const key = `gp:${gp.index}`;
            const wasPressed = gamepadButtonMemory.get(key) || false;
            if (pressed && !wasPressed) {
                window.pvpSetPendingDevice({
                    type: 'gamepad',
                    id: key,
                    index: gp.index,
                    label: gp.id || `Gamepad ${gp.index + 1}`
                });
            }
            gamepadButtonMemory.set(key, pressed);
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

            const input = dragon.input[controls.player];
            input.move.copy(controls.move);
            if (input.move.length() > 1) input.move.normalize();
            input.attack = controls.attack;
            input.charge = controls.charge;
            if (controls.pointer && input.pointer) input.pointer.copy(controls.pointer);
        });
    };

    state.pollInputs = () => {
        const gamepads = navigator.getGamepads ? Array.from(navigator.getGamepads()) : [];
        pollPairingDevices(gamepads);

        state.dragons.forEach(resetDragonInput);
        if (state.pvp && state.pvp.configuring) return;
        if (state.pvp && state.pvp.active) applyPvpControls(gamepads);
        else applyKeyboardTestControls();
    };
}
