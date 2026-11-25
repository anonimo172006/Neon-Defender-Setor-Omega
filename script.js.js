// ... existing code ...
const wrapper = document.getElementById('game-wrapper');
const previewCanvas = document.getElementById('shipPreviewCanvas');
const pCtx = previewCanvas.getContext('2d');
const workshopCanvas = document.getElementById('workshopCanvas');
const wCtx = workshopCanvas.getContext('2d');

// Referências aos elementos do HUD
// ... existing code ...
let isMuted = false;
let autoFire = false;
let screenShake = 0;
let frameCount = 0;
let lastBossType = '';
let stars = [];
let workshopScanY = 0;
let workshopWeldSparks = [];

// Entidades
// ... existing code ...
// ================= DESENHO DA GEOMETRIA EVOLUTIVA DA NAVE =================
function renderShipGeometry(context, skin, angle, scale = 1, upgrades = null) {
    const lvls = upgrades || { hull: 0, cannon: 0, reactor: 0, shieldGen: 0 };
    context.save();
    context.rotate(angle);
    context.scale(scale, scale);

    // 1. MÓDULO DE REATOR (Propulsores extras nas asas traseiras)
    if (lvls.reactor > 0) {
        context.fillStyle = skin.secondary;
        context.shadowBlur = 10;
        context.shadowColor = skin.secondary;
        const pods = lvls.reactor >= 3 ? 2 : 1;
        for (let p = 1; p <= pods; p++) {
            const offset = 8 + p * 5;
            context.fillRect(-18, offset - 2, 7, 4);
            context.fillRect(-18, -offset - 2, 7, 4);
        }
    }

    // 2. MÓDULO DE CANHÕES DE PLASMA (Canos acoplados nas pontas das asas)
    if (lvls.cannon > 0) {
        context.strokeStyle = '#ffe600';
        context.fillStyle = '#1e293b';
        context.lineWidth = 1.6;
        const barrelLen = 10 + lvls.cannon * 2.5;
        // Canhão direito e esquerdo
        context.fillRect(0, 12, barrelLen, 3.2);
        context.strokeRect(0, 12, barrelLen, 3.2);
        context.fillRect(0, -15.2, barrelLen, 3.2);
        context.strokeRect(0, -15.2, barrelLen, 3.2);

        if (lvls.cannon >= 3) {
            // Canhões duplos internos
            context.fillRect(4, 7, barrelLen - 2, 2.5);
            context.fillRect(4, -9.5, barrelLen - 2, 2.5);
        }
    }

    // 3. MÓDULO DE BLINDAGEM REFORÇADA (Placas de armadura externas)
    if (lvls.hull > 0) {
        context.save();
        context.strokeStyle = skin.secondary;
        context.fillStyle = 'rgba(255, 255, 255, 0.08)';
        context.lineWidth = 1.8;
        const armorExpand = Math.min(5, lvls.hull * 1.1);
        context.beginPath();
        context.moveTo(14, 0);
        context.lineTo(-8, 16 + armorExpand);
        context.lineTo(-14, 12 + armorExpand);
        context.lineTo(-14, -12 - armorExpand);
        context.lineTo(-8, -16 - armorExpand);
        context.closePath();
        context.fill();
        context.stroke();
        context.restore();
    }

    // 4. CHASSIS PRINCIPAL DA SKIN
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

    // Cockpit brilhante
    context.beginPath();
    context.arc(3, 0, 4.8, 0, Math.PI * 2);
    context.fillStyle = skin.secondary;
    context.fill();

    // 5. MÓDULO GERADOR DE ESCUDO (Emissores de energia nas pontas)
    if (lvls.shieldGen > 0) {
        context.fillStyle = '#00f3ff';
        context.shadowColor = '#00f3ff';
        context.shadowBlur = 12;
        context.beginPath();
        context.arc(16, 0, 2.5 + lvls.shieldGen * 0.4, 0, Math.PI * 2);
        context.fill();
    }

    context.restore();
}
// ... existing code ...
            draw() {
                const skin = getSelectedSkin();

                // Mira laser sutil 360°
// ... existing code ...
                if (this.invulnerable > 0 && Math.floor(this.invulnerable / 4) % 2 === 0) return;

                ctx.save();
                ctx.translate(this.x, this.y);
                // Passa os níveis do hangar para renderizar o sprite evoluído da nave
                renderShipGeometry(ctx, skin, this.angle, 1, this.hangarLevels);
                ctx.restore();
            }
        }
// ... existing code ...
                row.querySelector('button').addEventListener('click', () => {
                    if (score >= item.cost) {
                        score -= item.cost;
                        item.action();
                        playSound('buy');
                        // Gera faíscas de solda na oficina ao instalar upgrade
                        for (let s = 0; s < 16; s++) {
                            workshopWeldSparks.push({
                                x: workshopCanvas.width / 2 + (Math.random() - 0.5) * 50,
                                y: workshopCanvas.height / 2 + (Math.random() - 0.5) * 50,
                                vx: (Math.random() - 0.5) * 4,
                                vy: (Math.random() - 0.5) * 4,
                                life: 25
                            });
                        }
                        renderHangarUI();
                        updateHUD();
                    }
                });
                listEl.appendChild(row);
            });

            // Atualiza etiquetas de módulos instalados na oficina
            const tagsEl = document.getElementById('workshop-modules-tags');
            tagsEl.innerHTML = '';
            const modLabels = [
                { key: 'hull', label: 'BLINDAGEM' },
                { key: 'cannon', label: 'CANHÕES' },
                { key: 'reactor', label: 'REATOR' },
                { key: 'shieldGen', label: 'ESCUDO' }
            ];
            modLabels.forEach(m => {
                const lvl = player.hangarLevels[m.key];
                if (lvl > 0) {
                    const span = document.createElement('span');
                    span.className = 'mod-pill';
                    span.textContent = `${m.label} NV.${lvl}`;
                    tagsEl.appendChild(span);
                }
            });

            renderSkinCards('hangar-skins-list', true);
        }

        // Loop de animação da Doca de Oficina na Zona Segura
        let workshopAngle = -Math.PI / 2;
        function animateWorkshopBay() {
            if (gameState === 'SAFEZONE' && player) {
                const w = workshopCanvas.width;
                const h = workshopCanvas.height;
                wCtx.clearRect(0, 0, w, h);

                // Grade técnica da bancada
                wCtx.strokeStyle = 'rgba(0, 243, 255, 0.1)';
                wCtx.lineWidth = 1;
                for (let x = 0; x < w; x += 20) { wCtx.beginPath(); wCtx.moveTo(x, 0); wCtx.lineTo(x, h); wCtx.stroke(); }
                for (let y = 0; y < h; y += 20) { wCtx.beginPath(); wCtx.moveTo(0, y); wCtx.lineTo(w, y); wCtx.stroke(); }

                // Círculo giratório da plataforma hidráulica
                workshopAngle += 0.012;
                wCtx.save();
                wCtx.translate(w / 2, h / 2);
                wCtx.rotate(-workshopAngle * 0.5);
                wCtx.strokeStyle = 'rgba(0, 255, 136, 0.35)';
                wCtx.setLineDash([10, 6]);
                wCtx.lineWidth = 2;
                wCtx.beginPath();
                wCtx.arc(0, 0, 62, 0, Math.PI * 2);
                wCtx.stroke();
                wCtx.restore();

                // Braços robóticos laterais de manutenção
                const armWave = Math.sin(Date.now() * 0.004) * 8;
                wCtx.strokeStyle = '#64748b';
                wCtx.lineWidth = 4;
                wCtx.beginPath();
                wCtx.moveTo(15, 25); wCtx.lineTo(58, 55 + armWave); wCtx.lineTo(82, 72 + armWave);
                wCtx.moveTo(w - 15, h - 25); wCtx.lineTo(w - 58, h - 55 - armWave); wCtx.lineTo(w - 82, h - 72 - armWave);
                wCtx.stroke();

                // Nave evoluída no centro da doca
                wCtx.save();
                wCtx.translate(w / 2, h / 2);
                renderShipGeometry(wCtx, getSelectedSkin(), workshopAngle, 2.0, player.hangarLevels);
                wCtx.restore();

                // Feixe laser de escaneamento vertical
                workshopScanY = (workshopScanY + 1.6) % h;
                wCtx.fillStyle = 'rgba(0, 255, 136, 0.28)';
                wCtx.fillRect(20, workshopScanY, w - 40, 2);

                // Faíscas de solda ao comprar melhorias
                workshopWeldSparks.forEach(sp => {
                    sp.x += sp.vx; sp.y += sp.vy; sp.life--;
                    wCtx.fillStyle = '#ffe600';
                    wCtx.fillRect(sp.x, sp.y, 2.5, 2.5);
                });
                workshopWeldSparks = workshopWeldSparks.filter(sp => sp.life > 0);
            }
            requestAnimationFrame(animateWorkshopBay);
        }
// ... existing code ...
        function initStars() {
            stars = [];
            for (let i = 0; i < 95; i++) {
                stars.push({
                    x: Math.random() * canvas.width,
                    y: Math.random() * canvas.height,
                    size: Math.random() * 2 + 0.6,
                    layer: Math.floor(Math.random() * 3) + 1,
                    alpha: 0.3 + Math.random() * 0.7
                });
            }
        }

        function drawArenaBackground() {
            ctx.fillStyle = currentSector.bg;
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            // Nebulosa ambiental suave no centro
            const neb = ctx.createRadialGradient(
                canvas.width * 0.5, canvas.height * 0.5, 30,
                canvas.width * 0.5, canvas.height * 0.5, canvas.width * 0.65
            );
            neb.addColorStop(0, `${currentSector.primary}14`);
            neb.addColorStop(0.6, `${currentSector.secondary}08`);
            neb.addColorStop(1, 'transparent');
            ctx.fillStyle = neb;
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            // Estrelas em parallax reativas ao movimento do jogador
            const vx = player ? Math.cos(player.angle) * 0.25 : 0;
            const vy = player ? Math.sin(player.angle) * 0.25 : 0;
            for (let s of stars) {
                s.x -= vx * s.layer;
                s.y -= vy * s.layer;
                if (s.x < 0) s.x += canvas.width;
                if (s.x > canvas.width) s.x -= canvas.width;
                if (s.y < 0) s.y += canvas.height;
                if (s.y > canvas.height) s.y -= canvas.height;

                ctx.fillStyle = s.layer === 3 ? currentSector.primary : '#ffffff';
                ctx.globalAlpha = s.alpha * (0.6 + Math.sin(frameCount * 0.05 + s.x) * 0.3);
                ctx.fillRect(s.x, s.y, s.size, s.size);
            }
            ctx.globalAlpha = 1;

            // Grade Cibernética
            ctx.strokeStyle = currentSector.grid;
            ctx.lineWidth = 1;
            const step = 46;
            ctx.beginPath();
            for (let x = 0; x < canvas.width; x += step) { ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); }
            for (let y = 0; y < canvas.height; y += step) { ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); }
            ctx.stroke();

            // Efeito visual de singularidades gravitacionais
// ... existing code ...
        window.onload = () => {
            resizeCanvas();
            initStars();
            updateMenuUI();
            drawArenaBackground();
            animateMenuPreview();
            animateWorkshopBay();
        };
// ... existing code ...