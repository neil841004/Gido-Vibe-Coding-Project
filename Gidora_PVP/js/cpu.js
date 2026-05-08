// =====================================================================
// cpu.js — PVE CPU input controller
// 只負責把 Dragon B 的四個部位寫成「玩家可產生的 input」；
// 實際移動、攻擊、集氣、互斥與 CD 仍由 Gidora 既有規則處理。
// =====================================================================

class CpuDragonController {
    constructor(dragonIndex = 1, targetIndex = 0) {
        this.dragonIndex = dragonIndex;
        this.targetIndex = targetIndex;
        this.players = ['p1', 'p2', 'p3', 'p4'];
        this.partBrains = {};
        this.time = 0;
        this.nextComboPlanAt = 0;
        this.comboPlanRemaining = 0;
        this.nextTeamIntentAt = 0;
        this.teamIntent = 'chase';
        this.teamTangentSign = 1;
        this.targetOffset = new THREE.Vector2();
        this.nextTargetOffsetAt = 0;
        this.teamConfusedUntil = 0;
        this.teamConfusionMove = new THREE.Vector2();
        this.reset();
    }

    reset() {
        this.time = 0;
        this.comboPlanRemaining = 0;
        this.nextComboPlanAt = this.rand(CONFIG.pve.cpuComboPlanIntervalMin, CONFIG.pve.cpuComboPlanIntervalMax);
        this.nextTeamIntentAt = 0;
        this.teamIntent = 'chase';
        this.teamTangentSign = Math.random() < 0.5 ? -1 : 1;
        this.targetOffset.set(0, 0);
        this.nextTargetOffsetAt = 0;
        this.teamConfusedUntil = 0;
        this.teamConfusionMove.set(0, 0);
        this.players.forEach(player => {
            this.partBrains[player] = {
                nextDecisionAt: this.rand(0, CONFIG.pve.cpuDecisionIntervalMax),
                nextAttackAt: this.rand(CONFIG.pve.cpuInitialAttackDelayMin, CONFIG.pve.cpuAttackIntervalMax),
                attackUntil: 0,
                meleeAlignUntil: 0,
                move: new THREE.Vector2(),
                comboJoinAt: 0,
                comboParticipates: Math.random() < CONFIG.pve.cpuComboParticipantChance
            };
        });
    }

    rand(min, max) {
        return min + Math.random() * Math.max(0, max - min);
    }

    rotateVector2(v, angle) {
        const c = Math.cos(angle);
        const s = Math.sin(angle);
        return new THREE.Vector2(v.x * c - v.y * s, v.x * s + v.y * c);
    }

    getRandomOffset(radius) {
        const angle = Math.random() * Math.PI * 2;
        const dist = Math.sqrt(Math.random()) * radius;
        return new THREE.Vector2(Math.cos(angle) * dist, Math.sin(angle) * dist);
    }

    updateTargetOffset() {
        const cfg = CONFIG.pve;
        if (this.time < this.nextTargetOffsetAt) return;
        this.targetOffset.copy(this.getRandomOffset(cfg.cpuTargetOffsetRadius));
        this.nextTargetOffsetAt = this.time +
            this.rand(cfg.cpuTargetOffsetMinSeconds, cfg.cpuTargetOffsetMaxSeconds);
    }

    getTargetVector(cpuDragon, targetDragon) {
        this.updateTargetOffset();
        const perceivedX = targetDragon.mesh.position.x + this.targetOffset.x;
        const perceivedZ = targetDragon.mesh.position.z + this.targetOffset.y;
        const dx = perceivedX - cpuDragon.mesh.position.x;
        const dz = perceivedZ - cpuDragon.mesh.position.z;
        const toTarget = new THREE.Vector2(dx, dz);
        const distance = toTarget.length();
        if (distance > 0.001) toTarget.divideScalar(distance);
        else toTarget.set(0, 1);
        return { toTarget, distance };
    }

    getTrueTargetVector(cpuDragon, targetDragon) {
        const dx = targetDragon.mesh.position.x - cpuDragon.mesh.position.x;
        const dz = targetDragon.mesh.position.z - cpuDragon.mesh.position.z;
        const toTarget = new THREE.Vector2(dx, dz);
        const distance = toTarget.length();
        if (distance > 0.001) toTarget.divideScalar(distance);
        else toTarget.set(0, 1);
        return { toTarget, distance };
    }

    updateTeamIntent(cpuDragon, distance) {
        const cfg = CONFIG.pve;
        if (this.time < this.nextTeamIntentAt) return;

        const hpRatio = cpuDragon.maxHP > 0 ? cpuDragon.hp / cpuDragon.maxHP : 1;
        if (distance > cfg.cpuChaseRange) {
            this.teamIntent = 'chase';
        } else if (distance < cfg.cpuRetreatRange ||
            (hpRatio <= cfg.cpuRetreatHpRatio && Math.random() < cfg.cpuRetreatChance)) {
            this.teamIntent = 'retreat';
        } else {
            this.teamIntent = Math.random() < cfg.cpuPressureIntentChance ? 'pressure' : 'orbit';
            this.teamTangentSign = Math.random() < 0.5 ? -1 : 1;
        }

        this.nextTeamIntentAt = this.time +
            this.rand(cfg.cpuTeamIntentMinSeconds, cfg.cpuTeamIntentMaxSeconds);

        if (this.time >= this.teamConfusedUntil && Math.random() < cfg.cpuTeamConfusionChance) {
            const angle = Math.random() * Math.PI * 2;
            this.teamConfusionMove.set(Math.cos(angle), Math.sin(angle));
            this.teamConfusedUntil = this.time +
                this.rand(cfg.cpuTeamConfusionDurationMin, cfg.cpuTeamConfusionDurationMax);
        }
    }

    findHealItemDirection(cpuDragon) {
        const cfg = CONFIG.pve;
        const level = state.levelManager;
        if (!level || !level.healItems || level.healItems.length === 0) return null;
        const hpRatio = cpuDragon.maxHP > 0 ? cpuDragon.hp / cpuDragon.maxHP : 1;
        if (hpRatio > cfg.cpuHealItemSeekHpRatio) return null;

        const pos = cpuDragon.mesh.position;
        let bestDistSq = cfg.cpuHealItemSeekRange * cfg.cpuHealItemSeekRange;
        let best = null;
        level.healItems.forEach(item => {
            if (!item || item.isDead || !item.group) return;
            const dx = item.group.position.x - pos.x;
            const dz = item.group.position.z - pos.z;
            const distSq = dx * dx + dz * dz;
            if (distSq < bestDistSq) {
                bestDistSq = distSq;
                best = new THREE.Vector2(dx, dz);
            }
        });
        if (!best) return null;
        if (best.lengthSq() > 0.001) best.normalize();
        return best;
    }

    shouldStartCombo(cpuDragon, targetDragon, distance, toTarget) {
        const cfg = CONFIG.pve;
        if (this.time < this.nextComboPlanAt) return false;
        this.nextComboPlanAt = this.time + this.rand(cfg.cpuComboPlanIntervalMin, cfg.cpuComboPlanIntervalMax);
        if (!cpuDragon || !targetDragon || cpuDragon.isDead || targetDragon.isDead) return false;
        if (cpuDragon.beamPhase !== 'idle' || cpuDragon.comboCooldown > 0) return false;
        if (distance > CONFIG.beam.range * cfg.cpuComboRangeFactor) return false;

        const forward = cpuDragon.getForwardVector();
        const facingDot = forward.x * toTarget.x + forward.z * toTarget.y;
        if (facingDot < cfg.cpuComboFacingDot) return false;

        const hpRatio = cpuDragon.maxHP > 0 ? cpuDragon.hp / cpuDragon.maxHP : 1;
        const chance = cfg.cpuComboBaseChance +
            (hpRatio <= cfg.cpuRetreatHpRatio ? cfg.cpuComboLowHpBonusChance : 0);
        return Math.random() < Math.min(cfg.cpuComboMaxChance, chance);
    }

    startComboPlan() {
        const cfg = CONFIG.pve;
        this.comboPlanRemaining = this.rand(cfg.cpuComboPlanDurationMin, cfg.cpuComboPlanDurationMax);
        this.players.forEach(player => {
            const brain = this.partBrains[player];
            brain.comboParticipates = Math.random() < cfg.cpuComboParticipantChance;
            brain.comboJoinAt = this.time + this.rand(cfg.cpuComboJoinDelayMin, cfg.cpuComboJoinDelayMax);
        });
    }

    getObstacleAvoidance(cpuDragon, desired) {
        const cfg = CONFIG.pve;
        const level = state.levelManager;
        const avoidance = new THREE.Vector2();
        if (!level || !level.blocks || desired.lengthSq() <= 0.001) return avoidance;

        const pos = cpuDragon.mesh.position;
        const moveDir = desired.clone().normalize();
        level.blocks.forEach(block => {
            if (!block || block.isDead) return;
            if (!block.solid && !block.hazard) return;

            const padding = cfg.cpuObstacleAvoidPadding;
            const halfW = (block.width || cfg.cpuObstacleDefaultSize) * 0.5 + padding;
            const halfD = (block.depth || cfg.cpuObstacleDefaultSize) * 0.5 + padding;
            const bx = block.mesh.position.x;
            const bz = block.mesh.position.z;
            const nearestX = THREE.MathUtils.clamp(pos.x, bx - halfW, bx + halfW);
            const nearestZ = THREE.MathUtils.clamp(pos.z, bz - halfD, bz + halfD);
            const away = new THREE.Vector2(pos.x - nearestX, pos.z - nearestZ);
            let dist = away.length();

            if (dist < 0.001) {
                away.set(pos.x - bx, pos.z - bz);
                dist = Math.max(0.001, away.length());
            }

            if (dist > cfg.cpuObstacleAvoidRange) return;
            if (away.clone().normalize().dot(moveDir) > cfg.cpuObstacleMoveAwayDot) return;

            const toBlock = new THREE.Vector2(bx - pos.x, bz - pos.z);
            if (toBlock.lengthSq() > 0.001 && toBlock.normalize().dot(moveDir) < cfg.cpuObstacleAheadDot) return;

            const weight = block.solid ? cfg.cpuSolidAvoidWeight : cfg.cpuHazardAvoidWeight;
            const strength = (1 - dist / cfg.cpuObstacleAvoidRange) * weight;
            avoidance.add(away.normalize().multiplyScalar(strength));
        });

        return avoidance;
    }

    chooseMove(player, cpuDragon, distance, toTarget, comboAimDir = null, healDir = null) {
        const cfg = CONFIG.pve;
        const brain = this.partBrains[player];
        const playerTangentSign = player === 'p1' || player === 'p4' ? -1 : 1;
        const tangentSign = this.teamTangentSign * playerTangentSign;
        const tangent = new THREE.Vector2(-toTarget.y * tangentSign, toTarget.x * tangentSign);
        let desired = toTarget.clone();

        if (comboAimDir && comboAimDir.lengthSq() > 0.001) {
            desired.copy(toTarget).lerp(comboAimDir, cfg.cpuComboAimMoveBlend);
        } else if (healDir && healDir.lengthSq() > 0.001) {
            desired.copy(toTarget).lerp(healDir, cfg.cpuHealItemSeekBlend);
        } else if (Math.random() < cfg.cpuIdleMoveChance) {
            desired.set(0, 0);
        } else if (this.teamIntent === 'retreat') {
            desired.copy(toTarget).multiplyScalar(-1);
        } else if (this.teamIntent === 'chase') {
            desired.copy(toTarget);
        } else {
            const orbitBlend = player === 'p2' ? cfg.cpuSideOrbitBlend : cfg.cpuOrbitBlend;
            const forwardWeight = distance < cfg.cpuPreferredRange
                ? cfg.cpuOrbitBackoffWeight
                : (this.teamIntent === 'pressure'
                    ? cfg.cpuOrbitApproachWeight
                    : cfg.cpuOrbitApproachWeight * cfg.cpuOrbitApproachMultiplier);
            desired.copy(toTarget).multiplyScalar(forwardWeight);
            desired.add(tangent.multiplyScalar(orbitBlend));
        }

        const teamConfused = !comboAimDir && !healDir && this.time < this.teamConfusedUntil;
        if (teamConfused) {
            desired.lerp(this.teamConfusionMove, cfg.cpuConfusionMoveBlend);
        }

        if (desired.lengthSq() > 0.001) {
            const noiseAngle = teamConfused ? cfg.cpuConfusedMoveNoiseAngle : cfg.cpuMoveNoiseAngle;
            const noise = this.rand(-noiseAngle, noiseAngle);
            desired.copy(this.rotateVector2(desired.normalize(), noise));
        }

        const avoidance = this.getObstacleAvoidance(cpuDragon, desired);
        if (avoidance.lengthSq() > 0.001) {
            desired.add(avoidance);
            if (desired.lengthSq() > 0.001) desired.normalize();
        }
        brain.move.copy(desired);
    }

    maybeStartAttack(player, distance) {
        const cfg = CONFIG.pve;
        const brain = this.partBrains[player];
        if (this.time < brain.nextAttackAt || this.time < brain.attackUntil) return;
        const range = player === 'p4' ? cfg.cpuTailMeleeRange : cfg.cpuMeleeRange;
        if (distance > range) return;
        if (Math.random() > cfg.cpuAttackChance) return;

        const chargeTime = player === 'p4' ? CONFIG.combat.tailChargeTime : CONFIG.combat.chargeTime;
        const heavy = Math.random() < cfg.cpuHeavyAttackChance;
        const holdSeconds = heavy
            ? chargeTime + this.rand(cfg.cpuHeavyHoldExtraMin, cfg.cpuHeavyHoldExtraMax)
            : cfg.cpuAttackPressSeconds;
        brain.attackUntil = this.time + holdSeconds;
        brain.meleeAlignUntil = this.time + holdSeconds + cfg.cpuMeleeAlignDuration;
        brain.nextAttackAt = this.time + holdSeconds +
            this.rand(cfg.cpuAttackIntervalMin, cfg.cpuAttackIntervalMax);
    }

    updatePart(player, cpuDragon, distance, toTarget, trueTargetDir, comboAimDir = null, healDir = null) {
        const brain = this.partBrains[player];
        const input = cpuDragon.input[player];
        if (!input) return;

        const joiningCombo = this.comboPlanRemaining > 0 &&
            brain.comboParticipates &&
            this.time >= brain.comboJoinAt;

        if (joiningCombo) {
            input.move.copy(comboAimDir || new THREE.Vector2());
            input.attack = false;
            input.charge = true;
            return;
        }

        if (this.time >= brain.nextDecisionAt) {
            this.chooseMove(player, cpuDragon, distance, toTarget, comboAimDir, healDir);
            if (!comboAimDir) this.maybeStartAttack(player, distance);
            brain.nextDecisionAt = this.time +
                this.rand(CONFIG.pve.cpuDecisionIntervalMin, CONFIG.pve.cpuDecisionIntervalMax);
        }

        if (comboAimDir) {
            brain.move.copy(comboAimDir);
        } else if (this.time < brain.meleeAlignUntil && trueTargetDir && trueTargetDir.lengthSq() > 0.001) {
            brain.move.copy(trueTargetDir);
        }
        input.move.copy(brain.move);
        input.attack = comboAimDir ? false : this.time < brain.attackUntil;
        input.charge = false;
    }

    update(dt) {
        if (!state.pve || !state.pve.active) return;
        const cpuDragon = state.dragons[this.dragonIndex];
        const targetDragon = state.dragons[this.targetIndex];
        if (!cpuDragon || !targetDragon || cpuDragon.isDead || targetDragon.isDead) return;

        this.time += dt;
        const { toTarget, distance } = this.getTargetVector(cpuDragon, targetDragon);
        const trueTarget = this.getTrueTargetVector(cpuDragon, targetDragon);
        this.updateTeamIntent(cpuDragon, distance);

        if (this.comboPlanRemaining > 0) {
            this.comboPlanRemaining = Math.max(0, this.comboPlanRemaining - dt);
        } else if (this.shouldStartCombo(cpuDragon, targetDragon, distance, toTarget)) {
            this.startComboPlan();
        }

        const healDir = this.comboPlanRemaining > 0 ? null : this.findHealItemDirection(cpuDragon);
        this.players.forEach(player => {
            this.updatePart(player, cpuDragon, distance, toTarget,
                trueTarget.toTarget,
                this.comboPlanRemaining > 0 ? trueTarget.toTarget : null,
                healDir);
        });
    }
}
