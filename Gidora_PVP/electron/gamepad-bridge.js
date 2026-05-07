const fs = require('fs');

const W3C_BUTTON_COUNT = 17;
const W3C_AXIS_COUNT = 4;

function clamp(value, min = -1, max = 1) {
    if (!Number.isFinite(value)) return 0;
    return Math.max(min, Math.min(max, value));
}

function makeButton(pressed, value) {
    const safeValue = value === undefined ? (pressed ? 1 : 0) : clamp(value, 0, 1);
    return {
        pressed: !!pressed,
        touched: !!pressed || safeValue > 0,
        value: safeValue
    };
}

function normalizeTrigger(value) {
    if (!Number.isFinite(value)) return 0;
    if (value < 0) return clamp((value + 1) / 2, 0, 1);
    return clamp(value, 0, 1);
}

function padButtons(buttons) {
    const padded = buttons.slice(0, Math.max(W3C_BUTTON_COUNT, buttons.length));
    while (padded.length < W3C_BUTTON_COUNT) padded.push(makeButton(false));
    return padded;
}

function padAxes(axes) {
    const padded = axes.slice(0, Math.max(W3C_AXIS_COUNT, axes.length)).map(value => clamp(value));
    while (padded.length < W3C_AXIS_COUNT) padded.push(0);
    return padded;
}

function hatPressed(hat, direction) {
    if (!hat || hat === 'centered') return false;
    return String(hat).toLowerCase().includes(direction);
}

function describeDevice(device, fallbackName) {
    const parts = [device.name || fallbackName || 'SDL Gamepad'];
    if (device.guid) parts.push(`GUID ${device.guid}`);
    if (device.vendor !== null && device.vendor !== undefined) parts.push(`VID ${device.vendor}`);
    if (device.product !== null && device.product !== undefined) parts.push(`PID ${device.product}`);
    return parts.join(' / ');
}

function makeDeviceKey(device) {
    const guid = device.guid || 'no-guid';
    const path = device.path || `id-${device.id}`;
    const vendor = device.vendor === null || device.vendor === undefined ? 'no-vendor' : device.vendor;
    const product = device.product === null || device.product === undefined ? 'no-product' : device.product;
    return `${guid}:${vendor}:${product}:${path}`;
}

function readMappingsFile(mappingsPath) {
    if (!mappingsPath || !fs.existsSync(mappingsPath)) return [];
    const text = fs.readFileSync(mappingsPath, 'utf8');
    return text
        .split(/\r?\n/)
        .map(line => line.trim())
        .filter(line => line && !line.startsWith('#'));
}

function serializeController(entry, timestamp) {
    const { device, instance, nativeIndex, key } = entry;
    const axes = instance.axes || {};
    const buttons = instance.buttons || {};
    const leftTrigger = normalizeTrigger(axes.leftTrigger);
    const rightTrigger = normalizeTrigger(axes.rightTrigger);

    return {
        index: nativeIndex,
        uid: key,
        id: describeDevice(device, 'SDL Controller'),
        label: device.name || `Gamepad ${nativeIndex + 1}`,
        mapping: 'standard',
        connected: !instance.closed,
        timestamp,
        axes: padAxes([
            axes.leftStickX || 0,
            axes.leftStickY || 0,
            axes.rightStickX || 0,
            axes.rightStickY || 0
        ]),
        buttons: padButtons([
            makeButton(buttons.a),
            makeButton(buttons.b),
            makeButton(buttons.x),
            makeButton(buttons.y),
            makeButton(buttons.leftShoulder),
            makeButton(buttons.rightShoulder),
            makeButton(leftTrigger > 0.5, leftTrigger),
            makeButton(rightTrigger > 0.5, rightTrigger),
            makeButton(buttons.back),
            makeButton(buttons.start),
            makeButton(buttons.leftStick),
            makeButton(buttons.rightStick),
            makeButton(buttons.dpadUp),
            makeButton(buttons.dpadDown),
            makeButton(buttons.dpadLeft),
            makeButton(buttons.dpadRight),
            makeButton(buttons.guide)
        ])
    };
}

function serializeJoystick(entry, timestamp) {
    const { device, instance, nativeIndex, key } = entry;
    const buttons = (instance.buttons || []).map(pressed => makeButton(pressed));
    const hats = instance.hats || [];
    const firstHat = hats[0];

    while (buttons.length < W3C_BUTTON_COUNT) buttons.push(makeButton(false));
    buttons[12] = makeButton(buttons[12].pressed || hatPressed(firstHat, 'up'));
    buttons[13] = makeButton(buttons[13].pressed || hatPressed(firstHat, 'down'));
    buttons[14] = makeButton(buttons[14].pressed || hatPressed(firstHat, 'left'));
    buttons[15] = makeButton(buttons[15].pressed || hatPressed(firstHat, 'right'));

    return {
        index: nativeIndex,
        uid: key,
        id: describeDevice(device, 'SDL Joystick'),
        label: device.name || `Gamepad ${nativeIndex + 1}`,
        mapping: '',
        connected: !instance.closed,
        timestamp,
        axes: padAxes(instance.axes || []),
        buttons: padButtons(buttons)
    };
}

class GamepadBridge {
    constructor(options = {}) {
        this.mappingsPath = options.mappingsPath;
        this.onSnapshot = typeof options.onSnapshot === 'function' ? options.onSnapshot : () => {};
        this.pollIntervalMs = options.pollIntervalMs || 16;
        this.logger = options.logger || console;
        this.sdl = null;
        this.instances = new Map();
        this.indexByKey = new Map();
        this.nextIndex = 0;
        this.latestSnapshot = [];
        this.pollTimer = null;
        this.refreshTimer = null;
        this.boundRefresh = () => this.scheduleRefresh();
    }

    start() {
        if (this.sdl) return;
        this.sdl = require('@kmamal/sdl');
        this.loadMappings();
        this.bindDeviceEvents();
        this.refreshDevices();
        this.pollAndPush();
        this.pollTimer = setInterval(() => this.pollAndPush(), this.pollIntervalMs);
    }

    stop() {
        if (this.pollTimer) clearInterval(this.pollTimer);
        if (this.refreshTimer) clearTimeout(this.refreshTimer);
        this.pollTimer = null;
        this.refreshTimer = null;
        this.instances.forEach(entry => this.closeEntry(entry));
        this.instances.clear();
        this.latestSnapshot = [];
    }

    snapshot() {
        return this.latestSnapshot;
    }

    loadMappings() {
        if (!this.sdl || !this.sdl.controller || typeof this.sdl.controller.addMappings !== 'function') return;
        try {
            const mappings = readMappingsFile(this.mappingsPath);
            if (mappings.length > 0) {
                this.sdl.controller.addMappings(mappings);
                this.logger.info(`[gamepad] Loaded ${mappings.length} custom SDL controller mappings.`);
            }
        } catch (error) {
            this.logger.warn('[gamepad] Failed to load custom controller mappings.', error);
        }
    }

    bindDeviceEvents() {
        const targets = [this.sdl.controller, this.sdl.joystick].filter(Boolean);
        targets.forEach(target => {
            if (typeof target.on !== 'function') return;
            target.on('deviceAdd', this.boundRefresh);
            target.on('deviceRemove', this.boundRefresh);
        });
    }

    scheduleRefresh() {
        if (this.refreshTimer) clearTimeout(this.refreshTimer);
        this.refreshTimer = setTimeout(() => {
            this.refreshTimer = null;
            this.refreshDevices();
            this.pollAndPush();
        }, 120);
    }

    getNativeIndex(key) {
        if (!this.indexByKey.has(key)) {
            this.indexByKey.set(key, this.nextIndex);
            this.nextIndex += 1;
        }
        return this.indexByKey.get(key);
    }

    openDevice(kind, device) {
        const key = makeDeviceKey(device);
        const existing = this.instances.get(key);
        if (existing && !existing.instance.closed) {
            existing.kind = kind;
            existing.device = device;
            return existing;
        }

        try {
            const opener = kind === 'controller' ? this.sdl.controller : this.sdl.joystick;
            const instance = opener.openDevice(device);
            const entry = {
                kind,
                device,
                instance,
                key,
                nativeIndex: this.getNativeIndex(key)
            };
            if (typeof instance.on === 'function') {
                instance.on('close', () => this.instances.delete(key));
            }
            this.instances.set(key, entry);
            this.logger.info(`[gamepad] Opened ${kind} #${entry.nativeIndex}: ${device.name || key}`);
            return entry;
        } catch (error) {
            this.logger.warn(`[gamepad] Failed to open ${kind}: ${device.name || key}`, error);
            return null;
        }
    }

    closeEntry(entry) {
        try {
            if (entry && entry.instance && !entry.instance.closed) entry.instance.close();
        } catch (error) {
            this.logger.warn('[gamepad] Failed to close device.', error);
        }
    }

    refreshDevices() {
        if (!this.sdl) return;

        const seenKeys = new Set();
        const failedControllerIds = new Set();
        const controllerDevices = this.sdl.controller ? this.sdl.controller.devices || [] : [];
        const joystickDevices = this.sdl.joystick ? this.sdl.joystick.devices || [] : [];
        const controllerIds = new Set(controllerDevices.map(device => device.id));

        controllerDevices.forEach(device => {
            const entry = this.openDevice('controller', device);
            if (entry) seenKeys.add(entry.key);
            else failedControllerIds.add(device.id);
        });

        joystickDevices
            .filter(device => !controllerIds.has(device.id) || failedControllerIds.has(device.id))
            .forEach(device => {
                const entry = this.openDevice('joystick', device);
                if (entry) seenKeys.add(entry.key);
            });

        this.instances.forEach((entry, key) => {
            if (!seenKeys.has(key) || entry.instance.closed) {
                this.closeEntry(entry);
                this.instances.delete(key);
            }
        });
    }

    pollAndPush() {
        const timestamp = Date.now();
        const snapshot = [];

        this.instances.forEach(entry => {
            if (entry.instance.closed) return;
            try {
                const serialized = entry.kind === 'controller'
                    ? serializeController(entry, timestamp)
                    : serializeJoystick(entry, timestamp);
                snapshot[entry.nativeIndex] = serialized;
            } catch (error) {
                this.logger.warn(`[gamepad] Failed to serialize device #${entry.nativeIndex}.`, error);
            }
        });

        for (let index = 0; index < this.nextIndex; index++) {
            if (!snapshot[index]) snapshot[index] = null;
        }

        this.latestSnapshot = snapshot;
        this.onSnapshot(snapshot);
    }
}

function createGamepadBridge(options) {
    return new GamepadBridge(options);
}

module.exports = {
    createGamepadBridge,
    GamepadBridge
};
