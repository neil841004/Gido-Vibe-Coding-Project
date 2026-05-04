// =====================================================================
// core.js — Component-style 引擎基底 (對應 Unity: GameObject / MonoBehaviour)
// Phase 1 階段僅放入骨架，後續 Phase 會用 Entity/Component 包裝 Buff 與額外行為。
// =====================================================================

class Entity {
    constructor() {
        this.components = [];
        this.object3d = new THREE.Group();
        this.alive = true;
    }
    add(component) {
        component.entity = this;
        this.components.push(component);
        if (component.onEnable) component.onEnable();
        return component;
    }
    get(ComponentClass) {
        return this.components.find(c => c instanceof ComponentClass);
    }
    remove(component) {
        const i = this.components.indexOf(component);
        if (i < 0) return;
        if (component.onDisable) component.onDisable();
        this.components.splice(i, 1);
    }
    update(dt) {
        for (const c of this.components) {
            if (c.enabled !== false && c.update) c.update(dt);
        }
    }
}

class Component {
    constructor() {
        this.entity = null;
        this.enabled = true;
    }
    onEnable() {}
    onDisable() {}
    update(dt) {}
}

const EventBus = {
    _handlers: {},
    on(event, handler) {
        (this._handlers[event] = this._handlers[event] || []).push(handler);
        return () => this.off(event, handler);
    },
    off(event, handler) {
        const list = this._handlers[event];
        if (!list) return;
        const i = list.indexOf(handler);
        if (i >= 0) list.splice(i, 1);
    },
    emit(event, ...args) {
        const list = this._handlers[event];
        if (!list) return;
        for (const fn of list) fn(...args);
    }
};

// 將 core 物件掛到全域 namespace 供其他模組存取
window.Gidora = window.Gidora || {};
window.Gidora.Entity = Entity;
window.Gidora.Component = Component;
window.Gidora.EventBus = EventBus;
