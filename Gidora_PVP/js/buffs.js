// =====================================================================
// buffs.js — Buff 系統 (Phase 3 才會實作；目前為佔位符)
// 預期結構:
//   const BUFFS = {
//       hpBoost:       { name, description, stackable: true,  apply(gidora){...}, remove(gidora){...} },
//       fireballHead:  { name, description, stackable: false, group: 'meleeForm', apply(...){...} },
//       ...
//   };
//   BuffSystem.toggle(id) / .isActive(id) / .update(dt)
// =====================================================================

const BUFFS = {};

const BuffSystem = {
    active: new Set(),
    toggle(id) { /* Phase 3 */ },
    isActive(id) { return this.active.has(id); },
    update(dt) { /* Phase 3 */ }
};
