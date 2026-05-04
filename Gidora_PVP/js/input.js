// =====================================================================
// input.js — 鍵盤 + Gamepad 輸入 (4P 控制配置)
// 在 main.js 呼叫 setupInputs() 後，每幀呼叫 state.pollInputs()
// =====================================================================

function setupInputs() {
    const keys = {};
    let mouseAttack = false;
    let mouseCharge = false;

    window.addEventListener('keydown', (e) => {
        keys[e.code] = true;
        SoundSystem.init();
    });
    window.addEventListener('keyup', (e) => keys[e.code] = false);

    window.addEventListener('blur', () => {
        Object.keys(keys).forEach(k => keys[k] = false);
        mouseAttack = false;
        mouseCharge = false;
    });

    window.addEventListener('mousedown', (e) => {
        SoundSystem.init();
        if (e.button === 0) mouseAttack = true;
        if (e.button === 2) mouseCharge = true;
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

    // 初始化每個玩家的 move Vector2
    ['p1', 'p2', 'p3', 'p4'].forEach(p => {
        if (!state.input[p].move) state.input[p].move = new THREE.Vector2();
    });

    state.pollInputs = () => {
        const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
        const canCharge = true;

        // P1 (Keyboard / Mouse)
        let vx = 0, vy = 0;
        if (keys['KeyW']) vy -= 1;
        if (keys['KeyS']) vy += 1;
        if (keys['KeyA']) vx -= 1;
        if (keys['KeyD']) vx += 1;
        state.input.p1.move.set(vx, vy).normalize();
        state.input.p1.attack = mouseAttack || keys['Digit1'];
        state.input.p1.charge = canCharge && (mouseCharge || keys['ShiftLeft']);

        // P2 (Gamepad 0 / Arrows)
        const gp2 = gamepads[0];
        if (gp2) {
            const axisX = Math.abs(gp2.axes[0]) > 0.1 ? gp2.axes[0] : 0;
            const axisY = Math.abs(gp2.axes[1]) > 0.1 ? gp2.axes[1] : 0;
            state.input.p2.move.set(axisX, axisY);
            if (state.input.p2.move.length() > 1) state.input.p2.move.normalize();
            state.input.p2.attack = gp2.buttons[2].pressed;
            state.input.p2.charge = canCharge && gp2.buttons[7].pressed;
        } else {
            let vx2 = 0, vy2 = 0;
            if (keys['ArrowUp']) vy2 -= 1;
            if (keys['ArrowDown']) vy2 += 1;
            if (keys['ArrowLeft']) vx2 -= 1;
            if (keys['ArrowRight']) vx2 += 1;
            state.input.p2.move.set(vx2, vy2).normalize();
            state.input.p2.attack = keys['Enter'] || keys['Digit2'];
            state.input.p2.charge = canCharge && keys['ShiftRight'];
        }
        if (keys['Digit2']) state.input.p2.attack = true;

        // P3 (Gamepad 1)
        const gp3 = gamepads[1];
        state.input.p3.charge = false;
        state.input.p3.attack = false;
        if (gp3) {
            const axisX = Math.abs(gp3.axes[0]) > 0.1 ? gp3.axes[0] : 0;
            const axisY = Math.abs(gp3.axes[1]) > 0.1 ? gp3.axes[1] : 0;
            state.input.p3.move.set(axisX, axisY);
            state.input.p3.attack = gp3.buttons[2].pressed;
            state.input.p3.charge = canCharge && gp3.buttons[7].pressed;
        }
        if (keys['Digit3']) state.input.p3.attack = true;

        // P4 (Gamepad 2)
        const gp4 = gamepads[2];
        state.input.p4.charge = false;
        state.input.p4.attack = false;
        if (gp4) {
            const axisX = Math.abs(gp4.axes[0]) > 0.1 ? gp4.axes[0] : 0;
            const axisY = Math.abs(gp4.axes[1]) > 0.1 ? gp4.axes[1] : 0;
            state.input.p4.move.set(axisX, axisY);
            state.input.p4.attack = gp4.buttons[2].pressed;
            state.input.p4.charge = canCharge && gp4.buttons[7].pressed;
        }
        if (keys['Digit4']) state.input.p4.attack = true;
    };
}
