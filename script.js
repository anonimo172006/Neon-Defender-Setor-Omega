/**
 * NEON DEFENDER: SETOR OMEGA
 * Roguelite Espacial 360° | 5 Fases Randomizadas | 4 Chefes Únicos | Hangar & Skins
 */

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const wrapper = document.getElementById('game-wrapper');
const previewCanvas = document.getElementById('shipPreviewCanvas');
const pCtx = previewCanvas.getContext('2d');

// Referências aos elementos do HUD
const scoreDisplay = document.getElementById('score-display');
const upgradeBar = document.getElementById('upgrade-bar');
const stageBar = document.getElementById('stage-bar');
const hpFill = document.getElementById('hp-fill');
const shieldFill = document.getElementById('shield-fill');
const hpText = document.getElementById('hp-text');
const bossHud = document.getElementById('boss-hud');
const bossHpFill = document.getElementById('boss-hp-fill');

// ================= CATÁLOGO DE SKINS =================
const SHIP_SKINS = [
    { id: 'cyan', name: 'Valkyrie Ciano', primary: '#00f3ff', secondary: '#ff00ea', hull: '#09182d', cost: 0, shape: 'interceptor' },
    { id: 'crimson', name: 'Espectro Carmesim', primary: '#ff2a55', secondary: '#ffe600', hull: '#260812', cost: 4000, shape: 'razor' },
    { id: 'solar', name: 'Fênix Solar', primary: '#ffe600', secondary: '#ff6a00', hull: '#241805', cost: 8000, shape: 'phoenix' },
    { id: 'emerald', name: 'Vortex Esmeralda', primary: '#00ff88', secondary: '#00d9ff', hull: '#052216', cost: 14000, shape: 'viper' },
    { id: 'sovereign', name: 'Soberano Violeta', primary: '#c84bff', secondary: '#00f3ff', hull: '#190829', cost: 22000, shape: 'sovereign' }
];

// ================= SETORES RANDOMIZADOS (5 FASES) =================
const SECTOR_TYPES = [
    {
        id: 'standard',
        name: 'NEBULOSA AZUL',
        desc: 'Setor estável sem anomalias climáticas. Condições padrão de combate.',
        primary: '#00f3ff',
        secondary: '#ff00ea',
        bg: '#050612',
        grid: 'rgba(0, 243, 255, 0.06)',
        projMult: 1.0,
        spawnMult: 1.0,
        scoreMult: 1.0
    },
    {
        id: 'ion_storm',
        name: 'TEMPESTADE IÔNICA',
        desc: 'Alta carga eletromagnética: todos os projéteis viajam +22% mais rápido.',
        primary: '#b537f2',
        secondary: '#00f3ff',
        bg: '#0d0517',
        grid: 'rgba(181, 55, 242, 0.08)',
        projMult: 1.22,
        spawnMult: 1.0,
        scoreMult: 1.15
    },
    {
        id: 'gravity_void',
        name: 'VAZIO GRAVITACIONAL',
        desc: 'Singularidades errantes na arena puxam naves e curvam trajetórias de tiros.',
        primary: '#ffe600',
        secondary: '#ff7b00',
        bg: '#0e0b04',
        grid: 'rgba(255, 230, 0, 0.06)',
        projMult: 1.0,
        spawnMult: 1.0,
        scoreMult: 1.2
    },
    {
        id: 'crimson_nebula',
        name: 'NEBULOSA CARMESIM',
        desc: 'Alerta máximo: +25% de frequência de inimigos e +25% de pontos obtidos.',
        primary: '#ff2a55',
        secondary: '#ffe600',
        bg: '#140509',
        grid: 'rgba(255, 42, 85, 0.07)',
        projMult: 1.05,
        spawnMult: 1.25,
        scoreMult: 1.25
    },
    {
        id: 'asteroid_belt',
        name: 'CINTURÃO DE ASTEROIDES',
        desc: 'Rochas espaciais neon cruzam a arena. Destrua-as para abrir caminho e ganhar pontos.',
        primary: '#00ff88',
        secondary: '#ffe600',
        bg: '#04120c',
        grid: 'rgba(0, 255, 136, 0.06)',
        projMult: 1.0,
        spawnMult: 0.95,
        scoreMult: 1.15
    }
];

// ================= PERSISTÊNCIA (LOCALSTORAGE) =================
let savedData = JSON.parse(localStorage.getItem('neonDefenderOmegaSave')) || {
    highScore: 0,
    bankPoints: 0,
    unlockedSkins: ['cyan'],
    selectedSkin: 'cyan'
};

function saveProgress() {
    localStorage.setItem('neonDefenderOmegaSave', JSON.stringify(savedData));
}

function getSelectedSkin() {
    return SHIP_SKINS.find(s => s.id === savedData.selectedSkin) || SHIP_SKINS[0];
}

// ================= ESTADO GLOBAL DO JOGO =================
const MAX_STAGES = 5;
const STAGE_BOSS_GOAL = 10000;

let gameState = 'MENU';
let difficultyMult = 1.0;
let score = 0;
let stageScore = 0;
let stage = 1;
let currentSector = SECTOR_TYPES[0];
let upcomingSector = SECTOR_TYPES[1];

let buffCount = 0;
let nextBuffThreshold = 2500;
let prevBuffThreshold = 0;

let isMuted = false;
let autoFire = false;
let screenShake = 0;
let frameCount = 0;
let lastBossType = '';

let player;
let boss = null;
let bullets = [];
let enemyBullets = [];
let enemies = [];
let asteroids = [];
let gravityWells = [];
let particles = [];
let floatingTexts = [];
let spawnWarnings = [];
let activeUpgradeChoices = [];

const keys = {};
const mouse = { x: 0, y: 0, down: false, active: false };
const touchMove = { active: false, dx: 0, dy: 0 };
const touchAim = { active: false, dx: 0, dy: 0 };

// ================= ÁUDIO PROCEDURAL WEB AUDIO API =================
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
function playSound(type) {
    if (isMuted) return;
    try {
        if (audioCtx.state === 'suspended') audioCtx.resume();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        const now = audioCtx.currentTime;

        if (type === 'shoot') {
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(720, now);
            osc.frequency.exponentialRampToValueAtTime(140, now + 0.08);
            gain.gain.setValueAtTime(0.055, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
            osc.start(now); osc.stop(now + 0.08);
        } else if (type === 'explosion') {
            osc.type = 'square';
            osc.frequency.setValueAtTime(135, now);
            osc.frequency.exponentialRampToValueAtTime(24, now + 0.25);
            gain.gain.setValueAtTime(0.11, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
            osc.start(now); osc.stop(now + 0.25);
        } else if (type === 'upgrade') {
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(440, now);
            osc.frequency.setValueAtTime(660, now + 0.08);
            osc.frequency.setValueAtTime(880, now + 0.16);
            gain.gain.setValueAtTime(0.12, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.34);
            osc.start(now); osc.stop(now + 0.34);
        } else if (type === 'buy') {
            osc.type = 'sine';
            osc.frequency.setValueAtTime(580, now);
            osc.frequency.setValueAtTime(920, now + 0.07);
            gain.gain.setValueAtTime(0.12, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
            osc.start(now); osc.stop(now + 0.18);
        } else if (type === 'bossAlert') {
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(175, now);
            osc.frequency.linearRampToValueAtTime(85, now + 0.4);
            osc.frequency.linearRampToValueAtTime(175, now + 0.8);
            gain.gain.setValueAtTime(0.16, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.85);
            osc.start(now); osc.stop(now + 0.85);
        } else if (type === 'laser') {
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(300, now);
            osc.frequency.linearRampToValueAtTime(110, now + 0.3);
            gain.gain.setValueAtTime(0.1, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
            osc.start(now); osc.stop(now + 0.3);
        } else if (type === 'hit') {
            osc.type = 'sine';
            osc.frequency.setValueAtTime(150, now);
            osc.frequency.linearRampToValueAtTime(45, now + 0.2);
            gain.gain.setValueAtTime(0.16, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
            osc.start(now); osc.stop(now + 0.2);
        }
    } catch (e) {}
}

// ================= DESENHO DA GEOMETRIA DA NAVE =================
function renderShipGeometry(context, skin, angle, scale = 1) {
    context.save();
    context.rotate(angle);
    context.scale(scale, scale);

    context.shadowBlur = 16;
    context.shadowColor = skin.primary;
    context.strokeStyle = skin.primary;
    context.fillStyle = skin.hull;
    context.lineWidth = 2.4;

    context.beginPath();
    if (skin.shape === 'razor') {
        context.moveTo(24, 0);
        context.lineTo(-10, 17);
        context.lineTo(-16, 7);
        context.lineTo(-8, 0);
        context.lineTo(-16, -7);
        context.lineTo(-10, -17);
    } else if (skin.shape === 'phoenix') {
        context.moveTo(23, 0);
        context.lineTo(4, 9);
        context.lineTo(-14, 19);
        context.lineTo(-9, 0);
        context.lineTo(-14, -19);
        context.lineTo(4, -9);
    } else if (skin.shape === 'viper') {
        context.moveTo(25, 0);
        context.lineTo(-6, 12);
        context.lineTo(-17, 14);
        context.lineTo(-11, 0);
        context.lineTo(-17, -14);
        context.lineTo(-6, -12);
    } else if (skin.shape === 'sovereign') {
        context.moveTo(25, 0);
        context.lineTo(6, 16);
        context.lineTo(-15, 18);
        context.lineTo(-10, 6);
        context.lineTo(-18, 0);
        context.lineTo(-10, -6);
        context.lineTo(-15, -18);
        context.lineTo(6, -16);
    } else {
        context.moveTo(22, 0);
        context.lineTo(-15, 15);
        context.lineTo(-9, 0);
        context.lineTo(-15, -15);
    }
    context.closePath();
    context.fill();
    context.stroke();

    context.beginPath();
    context.arc(3, 0, 4.8, 0, Math.PI * 2);
    context.fillStyle = skin.secondary;
    context.fill();

    context.restore();
}

// ================= CATÁLOGO DE BUFFS TÁTICOS EM COMBATE =================
const COMBAT_BUFFS = [
    {
        id: 'multishot', icon: '🔱', title: 'Tiro Múltiplo',
        desc: 'Adiciona +1 projétil em leque por disparo.', maxLvl: 5,
        apply: (p) => { p.multiShot++; }
    },
    {
        id: 'firerate', icon: '⚡', title: 'Cadência Turbo',
        desc: 'Aumenta a velocidade de disparo em +18%.', maxLvl: 6,
        apply: (p) => { p.fireDelay = Math.max(4.5, p.fireDelay * 0.82); }
    },
    {
        id: 'speed', icon: '🚀', title: 'Propulsores Ágeis',
        desc: 'Aumenta a velocidade da nave em +14%.', maxLvl: 5,
        apply: (p) => { p.speed *= 1.14; }
    },
    {
        id: 'damage', icon: '💥', title: 'Calibre Pesado',
        desc: 'Aumenta o dano dos tiros em +28% e projéteis maiores.', maxLvl: 6,
        apply: (p) => { p.damage = Math.round(p.damage * 1.28); p.bulletSize += 0.7; }
    },
    {
        id: 'shield', icon: '🛡️', title: 'Escudo Regenerativo',
        desc: 'Restaura 35 HP e recarrega +45 de Escudo.', maxLvl: 99,
        apply: (p) => {
            p.hp = Math.min(p.maxHp, p.hp + 35);
            p.shield = Math.min(p.maxShield, p.shield + 45);
        }
    },
    {
        id: 'orbitals', icon: '⚛️', title: 'Drones Orbitais',
        desc: 'Adiciona +1 esfera de plasma giratória defensiva.', maxLvl: 4,
        apply: (p) => { p.orbitals++; }
    },
    {
        id: 'emp', icon: '🌀', title: 'Onda PEM Defensiva',
        desc: 'Ao sofrer dano, emite um pulso que destrói tiros inimigos próximos.', maxLvl: 3,
        apply: (p) => { p.empLevel++; }
    }
];

// ================= CLASSE DO JOGADOR =================
class Player {
    constructor() {
        this.x = canvas.width / 2;
        this.y = canvas.height / 2;
        this.radius = 18;
        this.angle = -Math.PI / 2;
        this.speed = 4.4;
        this.hp = 100;
        this.maxHp = 100;
        this.shield = 30;
        this.maxShield = 50;
        this.shieldRegenRate = 1;
        this.fireDelay = 15;
        this.cooldown = 0;
        this.multiShot = 1;
        this.damage = 20;
        this.bulletSize = 4;
        this.orbitals = 0;
        this.orbitalAngle = 0;
        this.empLevel = 0;
        this.invulnerable = 0;
        this.buffLevels = {};
        this.hangarLevels = { hull: 0, cannon: 0, reactor: 0, shieldGen: 0, thruster: 0 };
    }

    update() {
        let vx = 0, vy = 0;
        if (touchMove.active) {
            vx = touchMove.dx;
            vy = touchMove.dy;
        } else {
            if (keys['KeyW'] || keys['ArrowUp']) vy -= 1;
            if (keys['KeyS'] || keys['ArrowDown']) vy += 1;
            if (keys['KeyA'] || keys['ArrowLeft']) vx -= 1;
            if (keys['KeyD'] || keys['ArrowRight']) vx += 1;
            if (vx !== 0 && vy !== 0) {
                const n = Math.hypot(vx, vy);
                vx /= n; vy /= n;
            }
        }

        this.x += vx * this.speed;
        this.y += vy * this.speed;

        for (let gw of gravityWells) {
            const dx = gw.x - this.x;
            const dy = gw.y - this.y;
            const dist = Math.hypot(dx, dy);
            if (dist < gw.radius && dist > 15) {
                const pull = (1 - dist / gw.radius) * 1.4;
                this.x += (dx / dist) * pull;
                this.y += (dy / dist) * pull;
            }
        }

        this.x = Math.max(this.radius + 8, Math.min(canvas.width - this.radius - 8, this.x));
        this.y = Math.max(this.radius + 8, Math.min(canvas.height - this.radius - 8, this.y));

        if (touchAim.active && (Math.abs(touchAim.dx) > 0.1 || Math.abs(touchAim.dy) > 0.1)) {
            this.angle = Math.atan2(touchAim.dy, touchAim.dx);
        } else if (mouse.active) {
            this.angle = Math.atan2(mouse.y - this.y, mouse.x - this.x);
        } else if (vx !== 0 || vy !== 0) {
            this.angle = Math.atan2(vy, vx);
        }

        const skin = getSelectedSkin();
        if (Math.abs(vx) > 0.1 || Math.abs(vy) > 0.1) {
            const ex = this.x - Math.cos(this.angle) * 17;
            const ey = this.y - Math.sin(this.angle) * 17;
            particles.push(new Particle(
                ex + (Math.random() - 0.5) * 5,
                ey + (Math.random() - 0.5) * 5,
                -Math.cos(this.angle) * 2.4,
                -Math.sin(this.angle) * 2.4,
                skin.primary,
                14
            ));
        }

        if (this.cooldown > 0) this.cooldown--;
        const firing = mouse.down || keys['Space'] || autoFire || touchAim.active;
        if (firing && this.cooldown <= 0) {
            this.shoot();
            this.cooldown = this.fireDelay;
        }

        if (this.orbitals > 0) {
            this.orbitalAngle += 0.065;
            const dist = 50;
            for (let i = 0; i < this.orbitals; i++) {
                const a = this.orbitalAngle + (i * Math.PI * 2) / this.orbitals;
                const ox = this.x + Math.cos(a) * dist;
                const oy = this.y + Math.sin(a) * dist;

                for (let e of enemies) {
                    if (!e.dead && Math.hypot(ox - e.x, oy - e.y) < e.radius + 9) {
                        e.takeDamage(this.damage * 0.35, ox, oy);
                    }
                }
                if (boss && !boss.dead && Math.hypot(ox - boss.x, oy - boss.y) < boss.radius + 9) {
                    boss.takeDamage(this.damage * 0.25, ox, oy);
                }
            }
        }

        if (this.invulnerable > 0) this.invulnerable--;
        if (this.shield < this.maxShield && frameCount % 150 === 0) {
            this.shield = Math.min(this.maxShield, this.shield + 2 * this.shieldRegenRate);
            updateHUD();
        }
    }

    shoot() {
        const skin = getSelectedSkin();
        const spread = 0.13;
        const startAngle = this.angle - ((this.multiShot - 1) * spread) / 2;
        const speed = 10.5 * currentSector.projMult;

        for (let i = 0; i < this.multiShot; i++) {
            const a = startAngle + i * spread;
            bullets.push(new Bullet(
                this.x + Math.cos(a) * 20,
                this.y + Math.sin(a) * 20,
                Math.cos(a) * speed,
                Math.sin(a) * speed,
                this.damage,
                this.bulletSize,
                skin.primary,
                true
            ));
        }
        playSound('shoot');
    }

    takeDamage(amount) {
        if (this.invulnerable > 0) return;
        screenShake = 11;
        playSound('hit');
        createExplosion(this.x, this.y, '#ff2a55', 16);

        if (this.empLevel > 0) {
            const empRadius = 110 + this.empLevel * 45;
            enemyBullets.forEach(eb => {
                if (Math.hypot(eb.x - this.x, eb.y - this.y) < empRadius) eb.dead = true;
            });
            createExplosion(this.x, this.y, '#00f3ff', 24);
        }

        if (this.shield > 0) {
            const absorbed = Math.min(this.shield, amount);
            this.shield -= absorbed;
            amount -= absorbed;
        }
        this.hp = Math.max(0, this.hp - amount);
        this.invulnerable = 45;
        updateHUD();

        if (this.hp <= 0) triggerGameOver();
    }

    draw() {
        const skin = getSelectedSkin();

        ctx.save();
        ctx.beginPath();
        ctx.setLineDash([5, 7]);
        ctx.moveTo(this.x + Math.cos(this.angle) * 24, this.y + Math.sin(this.angle) * 24);
        ctx.lineTo(this.x + Math.cos(this.angle) * 135, this.y + Math.sin(this.angle) * 135);
        ctx.strokeStyle = `${skin.primary}44`;
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.restore();

        if (this.orbitals > 0) {
            for (let i = 0; i < this.orbitals; i++) {
                const a = this.orbitalAngle + (i * Math.PI * 2) / this.orbitals;
                const ox = this.x + Math.cos(a) * 50;
                const oy = this.y + Math.sin(a) * 50;
                ctx.save();
                ctx.shadowBlur = 12;
                ctx.shadowColor = '#ffe600';
                ctx.fillStyle = '#ffe600';
                ctx.beginPath();
                ctx.arc(ox, oy, 6, 0, Math.PI * 2);
                ctx.fill();
                ctx.restore();
            }
        }

        if (this.shield > 0) {
            ctx.save();
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.radius + 7, 0, Math.PI * 2);
            ctx.strokeStyle = `rgba(0, 243, 255, ${0.22 + (this.shield / this.maxShield) * 0.45})`;
            ctx.lineWidth = 2;
            ctx.stroke();
            ctx.restore();
        }

        if (this.invulnerable > 0 && Math.floor(this.invulnerable / 4) % 2 === 0) return;

        ctx.save();
        ctx.translate(this.x, this.y);
        renderShipGeometry(ctx, skin, this.angle, 1);
        ctx.restore();
    }
}

// ================= PROJÉTEIS & MÍSSEIS =================
class Bullet {
    constructor(x, y, vx, vy, damage, radius, color, isPlayer, homing = false) {
        this.x = x; this.y = y; this.vx = vx; this.vy = vy;
        this.damage = damage; this.radius = radius;
        this.color = color; this.isPlayer = isPlayer;
        this.homing = homing;
        this.hp = homing ? 25 : 1;
        this.life = homing ? 260 : 999;
        this.dead = false;
    }

    update() {
        this.life--;
        if (this.life <= 0) this.dead = true;

        if (this.homing && !this.isPlayer) {
            const desired = Math.atan2(player.y - this.y, player.x - this.x);
            const cur = Math.atan2(this.vy, this.vx);
            let diff = desired - cur;
            while (diff > Math.PI) diff -= Math.PI * 2;
            while (diff < -Math.PI) diff += Math.PI * 2;
            const newAngle = cur + Math.sign(diff) * Math.min(Math.abs(diff), 0.045);
            const spd = Math.hypot(this.vx, this.vy);
            this.vx = Math.cos(newAngle) * spd;
            this.vy = Math.sin(newAngle) * spd;
        }

        for (let gw of gravityWells) {
            const dx = gw.x - this.x;
            const dy = gw.y - this.y;
            const dist = Math.hypot(dx, dy);
            if (dist < gw.radius && dist > 15) {
                this.vx += (dx / dist) * 0.12;
                this.vy += (dy / dist) * 0.12;
            }
        }

        this.x += this.vx;
        this.y += this.vy;
        if (this.x < -40 || this.x > canvas.width + 40 || this.y < -40 || this.y > canvas.height + 40) {
            this.dead = true;
        }
    }

    draw() {
        ctx.save();
        ctx.shadowBlur = 10;
        ctx.shadowColor = this.color;
        if (this.homing) {
            ctx.translate(this.x, this.y);
            ctx.rotate(Math.atan2(this.vy, this.vx));
            ctx.fillStyle = '#ffe600';
            ctx.beginPath();
            ctx.moveTo(10, 0); ctx.lineTo(-8, 6); ctx.lineTo(-8, -6);
            ctx.closePath();
            ctx.fill();
        } else {
            ctx.fillStyle = this.isPlayer ? '#ffffff' : this.color;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = this.color;
            ctx.lineWidth = 2;
            ctx.stroke();
        }
        ctx.restore();
    }
}

// ================= INIMIGOS 360° =================
class Enemy {
    constructor(x, y, type) {
        this.x = x; this.y = y; this.type = type;
        this.angle = 0; this.dead = false;
        this.shootTimer = Math.floor(Math.random() * 80) + 55;
        this.strafeDir = Math.random() < 0.5 ? 1 : -1;

        const mult = (1 + (stage - 1) * 0.28) * difficultyMult;

        if (type === 'interceptor') {
            this.radius = 15; this.speed = 2.6 + stage * 0.18;
            this.hp = Math.round(28 * mult); this.points = 130; this.color = '#ff2a55';
        } else if (type === 'shooter') {
            this.radius = 17; this.speed = 1.95;
            this.hp = Math.round(45 * mult); this.points = 190; this.color = '#ff00ea';
        } else if (type === 'kamikaze') {
            this.radius = 14; this.speed = 2.2;
            this.hp = Math.round(22 * mult); this.points = 150; this.color = '#ff7b00';
        } else {
            this.radius = 24; this.speed = 1.15;
            this.hp = Math.round(105 * mult); this.points = 320; this.color = '#ffe600';
        }
    }

    update() {
        const dx = player.x - this.x;
        const dy = player.y - this.y;
        const dist = Math.hypot(dx, dy);
        this.angle = Math.atan2(dy, dx);

        if (this.type === 'kamikaze') {
            const boost = dist < 210 ? 1.85 : 1.0;
            this.x += Math.cos(this.angle) * this.speed * boost;
            this.y += Math.sin(this.angle) * this.speed * boost;
        } else if (this.type === 'interceptor' || this.type === 'tank') {
            this.x += Math.cos(this.angle) * this.speed;
            this.y += Math.sin(this.angle) * this.speed;

            if (this.type === 'tank') {
                this.shootTimer--;
                if (this.shootTimer <= 0) {
                    const spd = 4.0 * currentSector.projMult;
                    for (let s = -0.22; s <= 0.22; s += 0.22) {
                        enemyBullets.push(new Bullet(
                            this.x, this.y,
                            Math.cos(this.angle + s) * spd,
                            Math.sin(this.angle + s) * spd,
                            14, 5, '#ffe600', false
                        ));
                    }
                    this.shootTimer = 150;
                }
            }
        } else if (this.type === 'shooter') {
            const ideal = 235;
            let moveA = this.angle;
            if (dist < ideal - 30) moveA = this.angle + Math.PI;
            else if (dist <= ideal + 30) moveA = this.angle + (Math.PI / 2) * this.strafeDir;

            this.x += Math.cos(moveA) * this.speed;
            this.y += Math.sin(moveA) * this.speed;

            this.shootTimer--;
            if (this.shootTimer <= 0) {
                const spd = 4.5 * currentSector.projMult;
                enemyBullets.push(new Bullet(
                    this.x + Math.cos(this.angle) * 18,
                    this.y + Math.sin(this.angle) * 18,
                    Math.cos(this.angle) * spd,
                    Math.sin(this.angle) * spd,
                    12, 4.5, '#ff00ea', false
                ));
                this.shootTimer = Math.max(65, 135 - stage * 8);
            }
        }
    }

    takeDamage(dmg, hx, hy) {
        this.hp -= dmg;
        createExplosion(hx || this.x, hy || this.y, this.color, 4);
        if (this.hp <= 0 && !this.dead) {
            this.dead = true;
            const earned = Math.round(this.points * currentSector.scoreMult);
            addScore(earned);
            createExplosion(this.x, this.y, this.color, 20);
            floatingTexts.push(new FloatingText(this.x, this.y - 20, `+${earned}`, this.color, 13));
            playSound('explosion');
            screenShake = Math.max(screenShake, 4);
        }
    }

    draw() {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle);
        ctx.shadowBlur = 12;
        ctx.shadowColor = this.color;
        ctx.strokeStyle = this.color;
        ctx.fillStyle = '#12081d';
        ctx.lineWidth = 2.2;

        ctx.beginPath();
        if (this.type === 'interceptor') {
            ctx.moveTo(16, 0); ctx.lineTo(-12, 12); ctx.lineTo(-6, 0); ctx.lineTo(-12, -12);
        } else if (this.type === 'kamikaze') {
            ctx.moveTo(15, 0); ctx.lineTo(0, 10); ctx.lineTo(-14, 0); ctx.lineTo(0, -10);
        } else if (this.type === 'shooter') {
            ctx.moveTo(16, 0); ctx.lineTo(0, 14); ctx.lineTo(-14, 0); ctx.lineTo(0, -14);
        } else {
            for (let i = 0; i < 6; i++) {
                const a = (i * Math.PI) / 3;
                if (i === 0) ctx.moveTo(Math.cos(a) * this.radius, Math.sin(a) * this.radius);
                else ctx.lineTo(Math.cos(a) * this.radius, Math.sin(a) * this.radius);
            }
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.restore();
    }
}

// ================= 4 CHEFÕES ÚNICOS =================
class Boss {
    constructor(bossType, stageNum) {
        this.bossType = bossType;
        this.x = canvas.width / 2;
        this.y = -90;
        this.targetY = canvas.height * 0.24;
        this.radius = bossType === 'sovereign' ? 62 : 52;

        const baseHp = bossType === 'sovereign' ? 3600 : (1400 + (stageNum - 1) * 750);
        this.maxHp = Math.round(baseHp * difficultyMult);
        this.hp = this.maxHp;

        this.angle = 0;
        this.movePhase = 0;
        this.timer = 0;
        this.spiralAngle = 0;
        this.laserAngle = Math.PI / 2;
        this.laserActive = false;
        this.laserTelegraph = false;
        this.shockwaves = [];
        this.dead = false;
        this.entering = true;

        const names = {
            omega: 'GUARDIÃO ÔMEGA — ARTILHARIA ESPIRAL',
            hydra: 'HIDRA PRISMA — FEIXES DE VARREDURA',
            colossus: 'COLOSSO BÉLICO — MÍSSEIS & ONDAS DE CHOQUE',
            sovereign: 'NÚCLEO SOBERANO — AMEAÇA FINAL DO SETOR'
        };
        this.displayName = names[bossType];
    }

    update() {
        this.angle += 0.016;
        if (this.entering) {
            this.y += (this.targetY - this.y) * 0.04;
            if (Math.abs(this.y - this.targetY) < 2) this.entering = false;
            return;
        }

        this.timer++;
        this.movePhase += 0.014;

        const cx = canvas.width / 2 + Math.cos(this.movePhase) * (canvas.width * 0.27);
        const cy = canvas.height * 0.3 + Math.sin(this.movePhase * 1.6) * (canvas.height * 0.14);
        this.x += (cx - this.x) * 0.03;
        this.y += (cy - this.y) * 0.03;

        const projMult = currentSector.projMult;

        if (this.bossType === 'omega') {
            if (this.timer % 10 === 0) {
                this.spiralAngle += 0.32;
                const arms = 4;
                for (let i = 0; i < arms; i++) {
                    const a = this.spiralAngle + (i * Math.PI * 2) / arms;
                    enemyBullets.push(new Bullet(
                        this.x + Math.cos(a) * this.radius,
                        this.y + Math.sin(a) * this.radius,
                        Math.cos(a) * 3.8 * projMult,
                        Math.sin(a) * 3.8 * projMult,
                        13, 5, '#ff2a55', false
                    ));
                }
            }
            if (this.timer % 95 === 0) {
                const aim = Math.atan2(player.y - this.y, player.x - this.x);
                for (let s = -0.28; s <= 0.28; s += 0.14) {
                    enemyBullets.push(new Bullet(
                        this.x, this.y,
                        Math.cos(aim + s) * 6.0 * projMult,
                        Math.sin(aim + s) * 6.0 * projMult,
                        16, 5.5, '#ffe600', false
                    ));
                }
            }
        }

        if (this.bossType === 'hydra') {
            const cycle = this.timer % 240;
            if (cycle === 1) {
                this.laserAngle = Math.atan2(player.y - this.y, player.x - this.x) - 0.5;
                this.laserTelegraph = true;
                this.laserActive = false;
            } else if (cycle === 65) {
                this.laserTelegraph = false;
                this.laserActive = true;
                playSound('laser');
            } else if (cycle > 65 && cycle < 185) {
                this.laserAngle += 0.011;
                this.checkLaserHit(2);
            } else {
                this.laserActive = false;
                this.laserTelegraph = false;
            }

            if (this.timer % 150 === 0 && enemies.length < 5) {
                enemies.push(new Enemy(this.x - 55, this.y, 'shooter'));
                enemies.push(new Enemy(this.x + 55, this.y, 'interceptor'));
            }
        }

        if (this.bossType === 'colossus') {
            if (this.timer % 110 === 0) {
                for (let side of [-1, 1]) {
                    const a = Math.atan2(player.y - this.y, player.x - this.x) + side * 0.7;
                    enemyBullets.push(new Bullet(
                        this.x + side * 40, this.y,
                        Math.cos(a) * 3.6 * projMult,
                        Math.sin(a) * 3.6 * projMult,
                        18, 7, '#ffe600', false, true
                    ));
                }
            }
            if (this.timer % 175 === 0) {
                this.shockwaves.push({ r: this.radius, maxR: 460, hit: false });
                playSound('bossAlert');
            }
        }

        if (this.bossType === 'sovereign') {
            const hpRatio = this.hp / this.maxHp;

            if (this.timer % 11 === 0) {
                this.spiralAngle += 0.28;
                const arms = hpRatio < 0.5 ? 5 : 3;
                for (let i = 0; i < arms; i++) {
                    const a = this.spiralAngle + (i * Math.PI * 2) / arms;
                    enemyBullets.push(new Bullet(
                        this.x + Math.cos(a) * this.radius,
                        this.y + Math.sin(a) * this.radius,
                        Math.cos(a) * 4.1 * projMult,
                        Math.sin(a) * 4.1 * projMult,
                        14, 5, '#ff00ea', false
                    ));
                }
            }

            if (hpRatio < 0.75) {
                const cycle = this.timer % 260;
                if (cycle === 1) {
                    this.laserAngle = Math.atan2(player.y - this.y, player.x - this.x) - 0.6;
                    this.laserTelegraph = true;
                    this.laserActive = false;
                } else if (cycle === 60) {
                    this.laserTelegraph = false;
                    this.laserActive = true;
                    playSound('laser');
                } else if (cycle > 60 && cycle < 170) {
                    this.laserAngle += 0.013;
                    this.checkLaserHit(2);
                } else {
                    this.laserActive = false;
                    this.laserTelegraph = false;
                }
            }

            if (hpRatio < 0.45 && this.timer % 160 === 0) {
                this.shockwaves.push({ r: this.radius, maxR: 480, hit: false });
                const aim = Math.atan2(player.y - this.y, player.x - this.x);
                enemyBullets.push(new Bullet(this.x, this.y, Math.cos(aim) * 3.8, Math.sin(aim) * 3.8, 18, 7, '#ffe600', false, true));
            }
        }

        for (let sw of this.shockwaves) {
            sw.r += 3.6;
            const distToPlayer = Math.hypot(player.x - this.x, player.y - this.y);
            if (!sw.hit && Math.abs(distToPlayer - sw.r) < player.radius + 6) {
                sw.hit = true;
                player.takeDamage(18);
            }
        }
        this.shockwaves = this.shockwaves.filter(sw => sw.r < sw.maxR);
    }

    checkLaserHit(beams) {
        for (let b = 0; b < beams; b++) {
            const a = this.laserAngle + (b * Math.PI);
            const lx = Math.cos(a);
            const ly = Math.sin(a);
            const px = player.x - this.x;
            const py = player.y - this.y;
            const proj = px * lx + py * ly;
            if (proj > 0 && proj < 900) {
                const perpDist = Math.abs(px * ly - py * lx);
                if (perpDist < player.radius + 6) {
                    player.takeDamage(16);
                }
            }
        }
    }

    takeDamage(dmg, hx, hy) {
        if (this.entering || this.dead) return;
        this.hp -= dmg;
        createExplosion(hx || this.x, hy || this.y, '#ffe600', 4);
        bossHpFill.style.width = `${Math.max(0, (this.hp / this.maxHp) * 100)}%`;

        if (this.hp <= 0) {
            this.dead = true;
            onBossDefeated();
        }
    }

    draw() {
        for (let sw of this.shockwaves) {
            ctx.save();
            ctx.beginPath();
            ctx.arc(this.x, this.y, sw.r, 0, Math.PI * 2);
            ctx.strokeStyle = `rgba(255, 230, 0, ${1 - sw.r / sw.maxR})`;
            ctx.lineWidth = 4;
            ctx.stroke();
            ctx.restore();
        }

        if (this.laserTelegraph || this.laserActive) {
            for (let b = 0; b < 2; b++) {
                const a = this.laserAngle + b * Math.PI;
                ctx.save();
                ctx.beginPath();
                ctx.moveTo(this.x, this.y);
                ctx.lineTo(this.x + Math.cos(a) * 1000, this.y + Math.sin(a) * 1000);
                if (this.laserTelegraph) {
                    ctx.setLineDash([8, 8]);
                    ctx.strokeStyle = 'rgba(255, 42, 85, 0.5)';
                    ctx.lineWidth = 2;
                } else {
                    ctx.shadowBlur = 20;
                    ctx.shadowColor = '#ff00ea';
                    ctx.strokeStyle = '#ffffff';
                    ctx.lineWidth = 10;
                }
                ctx.stroke();
                ctx.restore();
            }
        }

        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.shadowBlur = 25;
        ctx.shadowColor = '#ff2a55';

        ctx.save();
        ctx.rotate(this.angle);
        const sides = this.bossType === 'sovereign' ? 10 : (this.bossType === 'colossus' ? 6 : 8);
        ctx.beginPath();
        for (let i = 0; i < sides; i++) {
            const a = (i * Math.PI * 2) / sides;
            const px = Math.cos(a) * this.radius;
            const py = Math.sin(a) * this.radius;
            if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fillStyle = '#1b0614';
        ctx.fill();
        ctx.lineWidth = 3.5;
        ctx.strokeStyle = '#ff2a55';
        ctx.stroke();
        ctx.restore();

        ctx.save();
        ctx.rotate(-this.angle * 1.7);
        ctx.strokeStyle = '#ffe600';
        ctx.lineWidth = 2.5;
        ctx.strokeRect(-26, -26, 52, 52);
        ctx.restore();

        ctx.beginPath();
        ctx.arc(0, 0, 16, 0, Math.PI * 2);
        ctx.fillStyle = '#ff00ea';
        ctx.fill();

        ctx.restore();
    }
}

// ================= ASTEROIDES & PARTÍCULAS =================
class Asteroid {
    constructor() {
        const edge = Math.floor(Math.random() * 4);
        if (edge === 0) { this.x = Math.random() * canvas.width; this.y = -30; }
        else if (edge === 1) { this.x = canvas.width + 30; this.y = Math.random() * canvas.height; }
        else if (edge === 2) { this.x = Math.random() * canvas.width; this.y = canvas.height + 30; }
        else { this.x = -30; this.y = Math.random() * canvas.height; }

        const targetX = canvas.width * (0.2 + Math.random() * 0.6);
        const targetY = canvas.height * (0.2 + Math.random() * 0.6);
        const a = Math.atan2(targetY - this.y, targetX - this.x);
        const spd = 1.1 + Math.random() * 1.2;
        this.vx = Math.cos(a) * spd;
        this.vy = Math.sin(a) * spd;
        this.radius = 22 + Math.random() * 14;
        this.hp = 85;
        this.rot = 0;
        this.rotSpd = (Math.random() - 0.5) * 0.04;
        this.dead = false;
    }
    update() {
        this.x += this.vx; this.y += this.vy; this.rot += this.rotSpd;
        if (this.x < -80 || this.x > canvas.width + 80 || this.y < -80 || this.y > canvas.height + 80) {
            this.dead = true;
        }
    }
    draw() {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rot);
        ctx.strokeStyle = '#00ff88';
        ctx.fillStyle = '#081c14';
        ctx.lineWidth = 2;
        ctx.beginPath();
        for (let i = 0; i < 7; i++) {
            const a = (i * Math.PI * 2) / 7;
            const r = this.radius * (i % 2 === 0 ? 1 : 0.8);
            if (i === 0) ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
            else ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.restore();
    }
}

class Particle {
    constructor(x, y, vx, vy, color, life) {
        this.x = x; this.y = y; this.vx = vx; this.vy = vy;
        this.color = color; this.life = life; this.maxLife = life;
        this.size = Math.random() * 3 + 1.5;
    }
    update() { this.x += this.vx; this.y += this.vy; this.vx *= 0.95; this.vy *= 0.95; this.life--; }
    draw() {
        ctx.save();
        ctx.globalAlpha = Math.max(0, this.life / this.maxLife);
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
}

class FloatingText {
    constructor(x, y, text, color, size = 13) {
        this.x = x; this.y = y; this.text = text;
        this.color = color; this.size = size; this.life = 36;
    }
    update() { this.y -= 1; this.life--; }
    draw() {
        ctx.save();
        ctx.globalAlpha = Math.max(0, this.life / 36);
        ctx.font = `bold ${this.size}px Orbitron, sans-serif`;
        ctx.fillStyle = this.color;
        ctx.textAlign = 'center';
        ctx.fillText(this.text, this.x, this.y);
        ctx.restore();
    }
}

function createExplosion(x, y, color, count = 18) {
    for (let i = 0; i < count; i++) {
        const a = Math.random() * Math.PI * 2;
        const spd = Math.random() * 4.5 + 1;
        particles.push(new Particle(x, y, Math.cos(a) * spd, Math.sin(a) * spd, color, 22));
    }
}

// ================= SPAWN 360° & SETORES =================
function pickRandomSector(excludeId) {
    const pool = SECTOR_TYPES.filter(s => s.id !== excludeId);
    return pool[Math.floor(Math.random() * pool.length)];
}

function setupSectorEnvironment(sector) {
    currentSector = sector;
    gravityWells = [];
    asteroids = [];

    if (sector.id === 'gravity_void') {
        gravityWells.push({ x: canvas.width * 0.3, y: canvas.height * 0.35, radius: 170 });
        gravityWells.push({ x: canvas.width * 0.7, y: canvas.height * 0.65, radius: 170 });
    }

    wrapper.style.borderColor = sector.primary;
    wrapper.style.boxShadow = `0 0 28px ${sector.primary}55, inset 0 0 25px ${sector.primary}22`;
    document.getElementById('sector-name-badge').textContent = sector.name;
    document.getElementById('sector-name-badge').style.color = sector.primary;
    document.getElementById('sector-name-badge').style.borderColor = sector.primary;
}

function scheduleEnemySpawn() {
    if (boss) return;
    const maxEnemies = Math.min(6 + stage * 2, 16);
    if (enemies.length + spawnWarnings.length >= maxEnemies) return;

    const edge = Math.floor(Math.random() * 4);
    let x, y;
    const m = 22;
    if (edge === 0) { x = Math.random() * (canvas.width - 60) + 30; y = m; }
    else if (edge === 1) { x = canvas.width - m; y = Math.random() * (canvas.height - 60) + 30; }
    else if (edge === 2) { x = Math.random() * (canvas.width - 60) + 30; y = canvas.height - m; }
    else { x = m; y = Math.random() * (canvas.height - 60) + 30; }

    if (Math.hypot(x - player.x, y - player.y) < 145) return;

    const r = Math.random();
    let type = 'interceptor';
    if (r > 0.8) type = 'tank';
    else if (r > 0.55) type = 'shooter';
    else if (r > 0.35) type = 'kamikaze';

    spawnWarnings.push({ x, y, type, timer: 45 });
}

function updateSpawnWarnings() {
    for (let w of spawnWarnings) {
        w.timer--;
        ctx.save();
        ctx.strokeStyle = w.type === 'tank' ? '#ffe600' : (w.type === 'shooter' ? '#ff00ea' : '#ff2a55');
        ctx.lineWidth = 2.2;
        ctx.globalAlpha = (w.timer % 10 < 5) ? 0.9 : 0.3;
        ctx.beginPath();
        ctx.arc(w.x, w.y, 14 + (45 - w.timer) * 0.22, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();

        if (w.timer <= 0) enemies.push(new Enemy(w.x, w.y, w.type));
    }
    spawnWarnings = spawnWarnings.filter(w => w.timer > 0);
}

// ================= PONTUAÇÃO, BUFFS ESCALÁVEIS & CHEFÕES =================
function addScore(pts) {
    score += pts;
    stageScore += pts;
    updateHUD();

    if (!boss && stageScore >= STAGE_BOSS_GOAL) {
        triggerBossEncounter();
        return;
    }

    if (score >= nextBuffThreshold) {
        buffCount++;
        prevBuffThreshold = nextBuffThreshold;
        const step = 2500 + buffCount * 750;
        nextBuffThreshold += step;
        openCombatBuffModal();
    }
}

function triggerBossEncounter() {
    enemies = [];
    spawnWarnings = [];
    enemyBullets = [];

    let chosenType = 'sovereign';
    if (stage < MAX_STAGES) {
        const pool = ['omega', 'hydra', 'colossus'].filter(t => t !== lastBossType);
        chosenType = pool[Math.floor(Math.random() * pool.length)];
        lastBossType = chosenType;
    }

    boss = new Boss(chosenType, stage);
    document.getElementById('boss-name').textContent = boss.displayName;
    bossHpFill.style.width = '100%';
    bossHud.classList.remove('hidden');

    const banner = document.getElementById('alert-banner');
    banner.textContent = `⚠️ ALERTA: ${boss.displayName}! ⚠️`;
    banner.classList.remove('hidden');
    playSound('bossAlert');
    screenShake = 16;

    setTimeout(() => banner.classList.add('hidden'), 3200);
}

function onBossDefeated() {
    playSound('explosion');
    screenShake = 24;
    createExplosion(boss.x, boss.y, '#ff2a55', 55);
    createExplosion(boss.x, boss.y, '#ffe600', 45);

    const stageBonus = 2000 * stage;
    score += stageBonus;
    boss = null;
    bossHud.classList.add('hidden');
    enemyBullets = [];
    enemies = [];

    if (stage >= MAX_STAGES) {
        setTimeout(triggerVictory, 900);
    } else {
        upcomingSector = pickRandomSector(currentSector.id);
        setTimeout(openSafeZoneHangar, 900);
    }
}

// ================= MODAL DE BUFFS EM COMBATE =================
function openCombatBuffModal() {
    gameState = 'UPGRADE';
    playSound('upgrade');
    keys['Space'] = false;
    mouse.down = false;

    const available = COMBAT_BUFFS.filter(u => (player.buffLevels[u.id] || 0) < u.maxLvl);
    activeUpgradeChoices = available.sort(() => 0.5 - Math.random()).slice(0, 3);

    const container = document.getElementById('cards-container');
    container.innerHTML = '';
    activeUpgradeChoices.forEach((upg, idx) => {
        const lvl = player.buffLevels[upg.id] || 0;
        const card = document.createElement('div');
        card.className = 'upgrade-card';
        card.innerHTML = `
            <span class="card-hotkey">[${idx + 1}]</span>
            <div class="card-icon">${upg.icon}</div>
            <div>
                <div class="card-title">${upg.title}</div>
                <div class="card-desc">${upg.desc}</div>
            </div>
            <div class="card-lvl">NÍVEL ${lvl + 1}</div>
        `;
        card.addEventListener('click', () => selectCombatBuff(idx));
        container.appendChild(card);
    });

    document.getElementById('upgrade-screen').classList.remove('hidden');
}

function selectCombatBuff(index) {
    const chosen = activeUpgradeChoices[index];
    if (!chosen) return;
    player.buffLevels[chosen.id] = (player.buffLevels[chosen.id] || 0) + 1;
    chosen.apply(player);
    document.getElementById('upgrade-screen').classList.add('hidden');
    updateHUD();
    gameState = 'PLAYING';
    requestAnimationFrame(gameLoop);
}

// ================= ZONA SEGURA / HANGAR ENTRE FASES =================
function openSafeZoneHangar() {
    gameState = 'SAFEZONE';
    keys['Space'] = false;
    mouse.down = false;

    document.getElementById('next-stage-num').textContent = stage + 1;
    document.getElementById('launch-stage-num').textContent = stage + 1;
    document.getElementById('next-sector-title').textContent = upcomingSector.name;
    document.getElementById('next-sector-desc').textContent = upcomingSector.desc;

    renderHangarUI();
    document.getElementById('safezone-screen').classList.remove('hidden');
}

function renderHangarUI() {
    document.getElementById('hangar-points').textContent = score.toLocaleString('pt-BR');

    const hangarItems = [
        {
            name: 'Reparo de Emergência (+35 HP)',
            desc: `Integridade atual: ${Math.ceil(player.hp)} / ${player.maxHp}`,
            cost: 600,
            disabled: player.hp >= player.maxHp || score < 600,
            action: () => { player.hp = Math.min(player.maxHp, player.hp + 35); }
        },
        {
            name: 'Restauração Completa (100% HP & Escudo)',
            desc: 'Repara todo o casco e recarrega o gerador de escudo.',
            cost: 1400,
            disabled: (player.hp >= player.maxHp && player.shield >= player.maxShield) || score < 1400,
            action: () => { player.hp = player.maxHp; player.shield = player.maxShield; }
        },
        {
            name: `Blindagem Reforçada (Nv.${player.hangarLevels.hull + 1}/5)`,
            desc: 'Aumenta o HP Máximo em +25 e repara +25 HP.',
            cost: 1200 + player.hangarLevels.hull * 600,
            disabled: player.hangarLevels.hull >= 5 || score < (1200 + player.hangarLevels.hull * 600),
            action: () => { player.hangarLevels.hull++; player.maxHp += 25; player.hp += 25; }
        },
        {
            name: `Canhões de Plasma (Nv.${player.hangarLevels.cannon + 1}/5)`,
            desc: 'Aumenta o dano base permanente em +22%.',
            cost: 1500 + player.hangarLevels.cannon * 750,
            disabled: player.hangarLevels.cannon >= 5 || score < (1500 + player.hangarLevels.cannon * 750),
            action: () => { player.hangarLevels.cannon++; player.damage = Math.round(player.damage * 1.22); }
        },
        {
            name: `Reator de Energia (Nv.${player.hangarLevels.reactor + 1}/5)`,
            desc: 'Reduz o intervalo entre disparos em -12%.',
            cost: 1500 + player.hangarLevels.reactor * 750,
            disabled: player.hangarLevels.reactor >= 5 || score < (1500 + player.hangarLevels.reactor * 750),
            action: () => { player.hangarLevels.reactor++; player.fireDelay = Math.max(4.5, player.fireDelay * 0.88); }
        },
        {
            name: `Gerador de Escudo (Nv.${player.hangarLevels.shieldGen + 1}/5)`,
            desc: 'Adiciona +25 de Escudo Máximo e acelera regeneração.',
            cost: 1300 + player.hangarLevels.shieldGen * 650,
            disabled: player.hangarLevels.shieldGen >= 5 || score < (1300 + player.hangarLevels.shieldGen * 650),
            action: () => { player.hangarLevels.shieldGen++; player.maxShield += 25; player.shield = player.maxShield; player.shieldRegenRate += 0.35; }
        }
    ];

    const listEl = document.getElementById('hangar-upgrades-list');
    listEl.innerHTML = '';
    hangarItems.forEach(item => {
        const row = document.createElement('div');
        row.className = 'shop-row';
        row.innerHTML = `
            <div class="shop-info">
                <strong>${item.name}</strong>
                <span>${item.desc}</span>
            </div>
            <button class="buy-btn" ${item.disabled ? 'disabled' : ''}>${item.cost.toLocaleString('pt-BR')} PTS</button>
        `;
        row.querySelector('button').addEventListener('click', () => {
            if (score >= item.cost) {
                score -= item.cost;
                item.action();
                playSound('buy');
                renderHangarUI();
                updateHUD();
            }
        });
        listEl.appendChild(row);
    });

    renderSkinCards('hangar-skins-list', true);
}

function launchNextStage() {
    stage++;
    stageScore = 0;
    setupSectorEnvironment(upcomingSector);
    document.getElementById('safezone-screen').classList.add('hidden');
    updateHUD();
    gameState = 'PLAYING';
    requestAnimationFrame(gameLoop);
}

// ================= RENDERIZAÇÃO DE SKINS =================
function renderSkinCards(containerId, useRunPoints) {
    const container = document.getElementById(containerId);
    container.innerHTML = '';

    SHIP_SKINS.forEach(skin => {
        const unlocked = savedData.unlockedSkins.includes(skin.id);
        const selected = savedData.selectedSkin === skin.id;
        const availablePts = useRunPoints ? score : savedData.bankPoints;

        const div = document.createElement('div');
        div.className = `skin-item ${selected ? 'selected' : ''}`;
        div.innerHTML = `
            <div class="skin-swatch" style="background: linear-gradient(90deg, ${skin.primary}, ${skin.secondary});"></div>
            <strong style="font-size: 0.74rem; color: #fff;">${skin.name}</strong>
            <span style="font-size: 0.65rem; color: ${unlocked ? '#00ff88' : '#ffe600'};">
                ${selected ? '✔ EQUIPADA' : (unlocked ? 'DESBLOQUEADA' : `🔒 ${skin.cost.toLocaleString('pt-BR')} PTS`)}
            </span>
        `;

        div.addEventListener('click', () => {
            if (unlocked) {
                savedData.selectedSkin = skin.id;
                saveProgress();
                playSound('buy');
            } else if (availablePts >= skin.cost) {
                if (useRunPoints) score -= skin.cost;
                else savedData.bankPoints -= skin.cost;
                savedData.unlockedSkins.push(skin.id);
                savedData.selectedSkin = skin.id;
                saveProgress();
                playSound('upgrade');
            }
            updateMenuUI();
            if (gameState === 'SAFEZONE') renderHangarUI();
        });

        container.appendChild(div);
    });
}

function updateMenuUI() {
    document.getElementById('bank-points-display').textContent = savedData.bankPoints.toLocaleString('pt-BR');
    document.getElementById('menu-highscore').textContent = savedData.highScore.toLocaleString('pt-BR');
    document.getElementById('preview-skin-name').textContent = getSelectedSkin().name.toUpperCase();
    document.getElementById('preview-skin-name').style.color = getSelectedSkin().primary;
    renderSkinCards('menu-skins-list', false);
}

let previewAngle = 0;
function animateMenuPreview() {
    if (gameState === 'MENU') {
        pCtx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
        previewAngle += 0.02;
        pCtx.save();
        pCtx.translate(previewCanvas.width / 2, previewCanvas.height / 2);
        renderShipGeometry(pCtx, getSelectedSkin(), previewAngle, 2.2);
        pCtx.restore();
    }
    requestAnimationFrame(animateMenuPreview);
}

// ================= HUD & CENÁRIO =================
function updateHUD() {
    scoreDisplay.textContent = score.toLocaleString('pt-BR');
    document.getElementById('stage-label').textContent = `FASE ${stage} / ${MAX_STAGES}`;
    document.getElementById('next-upg-txt').textContent = nextBuffThreshold.toLocaleString('pt-BR');

    const buffPct = Math.min(100, Math.max(0, ((score - prevBuffThreshold) / (nextBuffThreshold - prevBuffThreshold)) * 100));
    upgradeBar.style.width = `${buffPct}%`;

    if (boss) {
        document.getElementById('boss-goal-txt').textContent = 'CHEFÃO ATIVO NA ARENA!';
        stageBar.style.width = '100%';
    } else {
        const rem = Math.max(0, STAGE_BOSS_GOAL - stageScore);
        document.getElementById('boss-goal-txt').textContent = `FALTAM ${rem.toLocaleString('pt-BR')} PTS P/ CHEFÃO`;
        stageBar.style.width = `${Math.min(100, (stageScore / STAGE_BOSS_GOAL) * 100)}%`;
    }

    hpFill.style.width = `${(player.hp / player.maxHp) * 100}%`;
    shieldFill.style.width = `${player.maxShield > 0 ? (player.shield / player.maxShield) * 100 : 0}%`;
    hpText.textContent = `${Math.ceil(player.hp)} / ${player.maxHp}`;
}

function drawArenaBackground() {
    ctx.fillStyle = currentSector.bg;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.strokeStyle = currentSector.grid;
    ctx.lineWidth = 1;
    const step = 46;
    ctx.beginPath();
    for (let x = 0; x < canvas.width; x += step) { ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); }
    for (let y = 0; y < canvas.height; y += step) { ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); }
    ctx.stroke();

    for (let gw of gravityWells) {
        const grad = ctx.createRadialGradient(gw.x, gw.y, 8, gw.x, gw.y, gw.radius);
        grad.addColorStop(0, 'rgba(255, 230, 0, 0.35)');
        grad.addColorStop(0.5, 'rgba(255, 123, 0, 0.08)');
        grad.addColorStop(1, 'transparent');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(gw.x, gw.y, gw.radius, 0, Math.PI * 2);
        ctx.fill();
    }
}

// ================= COLISÕES =================
function checkCollisions() {
    for (let b of bullets) {
        if (b.dead) continue;

        for (let e of enemies) {
            if (!e.dead && Math.hypot(b.x - e.x, b.y - e.y) < e.radius + b.radius) {
                b.dead = true;
                e.takeDamage(b.damage, b.x, b.y);
                break;
            }
        }

        if (!b.dead) {
            for (let eb of enemyBullets) {
                if (!eb.dead && eb.homing && Math.hypot(b.x - eb.x, b.y - eb.y) < eb.radius + b.radius + 4) {
                    b.dead = true;
                    eb.hp -= b.damage;
                    if (eb.hp <= 0) {
                        eb.dead = true;
                        createExplosion(eb.x, eb.y, '#ffe600', 10);
                    }
                    break;
                }
            }
        }

        if (!b.dead) {
            for (let ast of asteroids) {
                if (!ast.dead && Math.hypot(b.x - ast.x, b.y - ast.y) < ast.radius + b.radius) {
                    b.dead = true;
                    ast.hp -= b.damage;
                    createExplosion(b.x, b.y, '#00ff88', 5);
                    if (ast.hp <= 0) {
                        ast.dead = true;
                        createExplosion(ast.x, ast.y, '#00ff88', 18);
                        addScore(90);
                    }
                    break;
                }
            }
        }

        if (!b.dead && boss && !boss.dead) {
            if (Math.hypot(b.x - boss.x, b.y - boss.y) < boss.radius + b.radius) {
                b.dead = true;
                boss.takeDamage(b.damage, b.x, b.y);
            }
        }
    }

    for (let eb of enemyBullets) {
        if (!eb.dead && Math.hypot(eb.x - player.x, eb.y - player.y) < player.radius + eb.radius) {
            eb.dead = true;
            player.takeDamage(eb.damage);
        }
    }

    for (let e of enemies) {
        if (!e.dead && Math.hypot(e.x - player.x, e.y - player.y) < e.radius + player.radius - 4) {
            e.takeDamage(999);
            player.takeDamage(18);
        }
    }

    for (let ast of asteroids) {
        if (!ast.dead && Math.hypot(ast.x - player.x, ast.y - player.y) < ast.radius + player.radius - 4) {
            ast.dead = true;
            createExplosion(ast.x, ast.y, '#00ff88', 18);
            player.takeDamage(16);
        }
    }

    if (boss && !boss.dead && Math.hypot(boss.x - player.x, boss.y - player.y) < boss.radius + player.radius) {
        player.takeDamage(24);
    }
}

// ================= LOOP PRINCIPAL =================
function gameLoop() {
    if (gameState !== 'PLAYING') return;
    frameCount++;

    ctx.save();
    if (screenShake > 0) {
        ctx.translate((Math.random() - 0.5) * screenShake, (Math.random() - 0.5) * screenShake);
        screenShake *= 0.85;
        if (screenShake < 0.4) screenShake = 0;
    }

    drawArenaBackground();

    const spawnRate = Math.max(36, Math.round((95 - stage * 9) / currentSector.spawnMult));
    if (frameCount % spawnRate === 0) scheduleEnemySpawn();
    updateSpawnWarnings();

    if (currentSector.id === 'asteroid_belt' && frameCount % 140 === 0 && asteroids.length < 5) {
        asteroids.push(new Asteroid());
    }

    player.update();
    player.draw();

    if (boss) { boss.update(); boss.draw(); }

    asteroids.forEach(a => { a.update(); a.draw(); });
    asteroids = asteroids.filter(a => !a.dead);

    bullets.forEach(b => { b.update(); b.draw(); });
    bullets = bullets.filter(b => !b.dead);

    enemyBullets.forEach(eb => { eb.update(); eb.draw(); });
    enemyBullets = enemyBullets.filter(eb => !eb.dead);

    enemies.forEach(e => { e.update(); e.draw(); });
    enemies = enemies.filter(e => !e.dead);

    checkCollisions();

    particles.forEach(p => { p.update(); p.draw(); });
    particles = particles.filter(p => p.life > 0);

    floatingTexts.forEach(ft => { ft.update(); ft.draw(); });
    floatingTexts = floatingTexts.filter(ft => ft.life > 0);

    ctx.restore();
    requestAnimationFrame(gameLoop);
}

// ================= FLUXO DE TELAS =================
function startMission() {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    score = 0;
    stageScore = 0;
    stage = 1;
    buffCount = 0;
    prevBuffThreshold = 0;
    nextBuffThreshold = 2500;
    boss = null;
    bullets = [];
    enemyBullets = [];
    enemies = [];
    particles = [];
    floatingTexts = [];
    spawnWarnings = [];

    player = new Player();
    setupSectorEnvironment(SECTOR_TYPES[0]);
    updateHUD();

    hideAllOverlays();
    document.getElementById('hud').classList.remove('hidden');
    gameState = 'PLAYING';
    requestAnimationFrame(gameLoop);
}

function triggerVictory() {
    gameState = 'VICTORY';
    score += 5000;
    savedData.bankPoints += score;
    if (score > savedData.highScore) savedData.highScore = score;
    saveProgress();

    document.getElementById('vic-score').textContent = score.toLocaleString('pt-BR');
    document.getElementById('vic-bank').textContent = savedData.bankPoints.toLocaleString('pt-BR');
    hideAllOverlays();
    document.getElementById('victory-screen').classList.remove('hidden');
}

function triggerGameOver() {
    gameState = 'GAMEOVER';
    savedData.bankPoints += Math.floor(score * 0.5);
    if (score > savedData.highScore) savedData.highScore = score;
    saveProgress();

    document.getElementById('go-sector').textContent = currentSector.name;
    document.getElementById('final-stage').textContent = `${stage} / ${MAX_STAGES}`;
    document.getElementById('final-score').textContent = score.toLocaleString('pt-BR');
    document.getElementById('high-score').textContent = savedData.highScore.toLocaleString('pt-BR');
    hideAllOverlays();
    document.getElementById('gameover-screen').classList.remove('hidden');
}

function returnToMainMenu() {
    gameState = 'MENU';
    boss = null;
    hideAllOverlays();
    document.getElementById('hud').classList.add('hidden');
    updateMenuUI();
    document.getElementById('start-screen').classList.remove('hidden');
}

function togglePause() {
    if (gameState === 'PLAYING') {
        gameState = 'PAUSED';
        document.getElementById('pause-screen').classList.remove('hidden');
    } else if (gameState === 'PAUSED') {
        gameState = 'PLAYING';
        document.getElementById('pause-screen').classList.add('hidden');
        requestAnimationFrame(gameLoop);
    }
}

function hideAllOverlays() {
    ['start-screen', 'upgrade-screen', 'safezone-screen', 'pause-screen', 'victory-screen', 'gameover-screen', 'boss-hud', 'alert-banner']
        .forEach(id => document.getElementById(id).classList.add('hidden'));
}

// ================= EVENT LISTENERS =================
function resizeCanvas() {
    canvas.width = wrapper.clientWidth;
    canvas.height = wrapper.clientHeight;
    if (player) {
        player.x = Math.min(Math.max(player.x, 25), canvas.width - 25);
        player.y = Math.min(Math.max(player.y, 25), canvas.height - 25);
    }
}
window.addEventListener('resize', resizeCanvas);

canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    mouse.x = e.clientX - rect.left;
    mouse.y = e.clientY - rect.top;
    mouse.active = true;
});

canvas.addEventListener('mousedown', (e) => { if (e.button === 0) mouse.down = true; });
window.addEventListener('mouseup', () => { mouse.down = false; });

window.addEventListener('keydown', (e) => {
    keys[e.code] = true;
    if (gameState === 'UPGRADE') {
        if (e.key === '1') selectCombatBuff(0);
        if (e.key === '2') selectCombatBuff(1);
        if (e.key === '3') selectCombatBuff(2);
    } else if (e.code === 'Escape' || e.code === 'KeyP') {
        if (gameState === 'PLAYING' || gameState === 'PAUSED') togglePause();
    } else if (e.code === 'KeyF' && gameState === 'PLAYING') {
        autoFire = !autoFire;
        document.getElementById('autofire-btn').textContent = `🔫 AUTO: ${autoFire ? 'ON' : 'OFF'} [F]`;
    }
});

window.addEventListener('keyup', (e) => { keys[e.code] = false; });

document.querySelectorAll('.diff-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.diff-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        difficultyMult = parseFloat(btn.dataset.diff);
    });
});

document.getElementById('start-btn').addEventListener('click', startMission);
document.getElementById('restart-btn').addEventListener('click', startMission);
document.getElementById('launch-next-btn').addEventListener('click', launchNextStage);
document.getElementById('pause-btn').addEventListener('click', togglePause);
document.getElementById('resume-btn').addEventListener('click', togglePause);
document.getElementById('abandon-btn').addEventListener('click', returnToMainMenu);
document.getElementById('victory-menu-btn').addEventListener('click', returnToMainMenu);
document.getElementById('go-menu-btn').addEventListener('click', returnToMainMenu);

document.getElementById('autofire-btn').addEventListener('click', (e) => {
    autoFire = !autoFire;
    e.target.textContent = `🔫 AUTO: ${autoFire ? 'ON' : 'OFF'} [F]`;
});

function toggleMuteAll() {
    isMuted = !isMuted;
    document.getElementById('mute-btn').textContent = isMuted ? '🔇 MUDO' : '🔊 SOM';
}
document.getElementById('mute-btn').addEventListener('click', toggleMuteAll);
document.getElementById('pause-mute-btn').addEventListener('click', toggleMuteAll);

function setupVirtualJoystick(zoneId, knobId, stateObj) {
    const zone = document.getElementById(zoneId);
    const knob = document.getElementById(knobId);
    function handleTouch(e) {
        e.preventDefault();
        const touch = e.touches[0];
        const rect = zone.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        const maxD = rect.width / 2 - 14;
        let dx = touch.clientX - cx;
        let dy = touch.clientY - cy;
        const dist = Math.hypot(dx, dy);
        if (dist > maxD) { dx = (dx / dist) * maxD; dy = (dy / dist) * maxD; }
        knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
        stateObj.active = true;
        stateObj.dx = dx / maxD;
        stateObj.dy = dy / maxD;
        mouse.active = false;
    }
    zone.addEventListener('touchstart', handleTouch);
    zone.addEventListener('touchmove', handleTouch);
    zone.addEventListener('touchend', (e) => {
        e.preventDefault();
        knob.style.transform = 'translate(-50%, -50%)';
        stateObj.active = false; stateObj.dx = 0; stateObj.dy = 0;
    });
}
setupVirtualJoystick('joy-move', 'knob-move', touchMove);
setupVirtualJoystick('joy-aim', 'knob-aim', touchAim);

window.onload = () => {
    resizeCanvas();
    updateMenuUI();
    drawArenaBackground();
    animateMenuPreview();
};