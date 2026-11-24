const SETTINGS_KEY = 'neon_overdrive_settings_v2';
        const CAREER_KEY = 'neon_overdrive_career_v2';

        let userSettings = {
            sfxVolume: 1.0,       // 0.0 - 1.0
            shakeMultiplier: 1.0, // 0.0 - 1.5
            autoFire: false,
            showDamage: true,
            lowPerfMode: false
        };

        let careerStats = {
            bestScore: parseInt(localStorage.getItem('neon_overdrive_best') || '0', 10),
            maxWave: 1,
            totalKills: 0
        };

        try {
            const savedSettings = JSON.parse(localStorage.getItem(SETTINGS_KEY));
            if (savedSettings) Object.assign(userSettings, savedSettings);
            const savedCareer = JSON.parse(localStorage.getItem(CAREER_KEY));
            if (savedCareer) Object.assign(careerStats, savedCareer);
        } catch (e) {}

        function saveSettings() {
            localStorage.setItem(SETTINGS_KEY, JSON.stringify(userSettings));
        }

        function saveCareer() {
            localStorage.setItem(CAREER_KEY, JSON.stringify(careerStats));
            localStorage.setItem('neon_overdrive_best', careerStats.bestScore.toString());
        }

        function applyPerfModeClass() {
            document.body.classList.toggle('low-perf', !!userSettings.lowPerfMode);
        }

        // --- 2. СИНТЕЗАТОР ЗВУКОВ (WEB AUDIO API) ---
        class SoundEngine {
            constructor() {
                this.ctx = null;
                this.muted = false;
                this.masterGain = null;
            }

            init() {
                if (!this.ctx) {
                    const AudioCtx = window.AudioContext || window.webkitAudioContext;
                    this.ctx = new AudioCtx();
                    this.masterGain = this.ctx.createGain();
                    this.updateVolume();
                    this.masterGain.connect(this.ctx.destination);
                }
                if (this.ctx.state === 'suspended') {
                    this.ctx.resume();
                }
            }

            updateVolume() {
                if (this.masterGain) {
                    this.masterGain.gain.value = this.muted ? 0 : (0.28 * userSettings.sfxVolume);
                }
            }

            toggleMute() {
                this.muted = !this.muted;
                this.updateVolume();
                return this.muted;
            }

            playShoot(pitchMod = 1) {
                if (this.muted || !this.ctx || userSettings.sfxVolume <= 0) return;
                const now = this.ctx.currentTime;
                const osc = this.ctx.createOscillator();
                const gain = this.ctx.createGain();
                osc.type = 'sawtooth';
                const startFreq = (520 + Math.random() * 90) * pitchMod;
                osc.frequency.setValueAtTime(startFreq, now);
                osc.frequency.exponentialRampToValueAtTime(110, now + 0.09);
                gain.gain.setValueAtTime(0.28, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
                osc.connect(gain);
                gain.connect(this.masterGain);
                osc.start(now);
                osc.stop(now + 0.095);
            }

            playEnemyShoot() {
                if (this.muted || !this.ctx || userSettings.sfxVolume <= 0) return;
                const now = this.ctx.currentTime;
                const osc = this.ctx.createOscillator();
                const gain = this.ctx.createGain();
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(280, now);
                osc.frequency.exponentialRampToValueAtTime(80, now + 0.14);
                gain.gain.setValueAtTime(0.2, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
                osc.connect(gain);
                gain.connect(this.masterGain);
                osc.start(now);
                osc.stop(now + 0.15);
            }

            playHit(isCrit = false) {
                if (this.muted || !this.ctx || userSettings.sfxVolume <= 0) return;
                const now = this.ctx.currentTime;
                const osc = this.ctx.createOscillator();
                const gain = this.ctx.createGain();
                osc.type = isCrit ? 'square' : 'sine';
                osc.frequency.setValueAtTime(isCrit ? 880 : 320, now);
                osc.frequency.exponentialRampToValueAtTime(90, now + 0.06);
                gain.gain.setValueAtTime(0.22, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
                osc.connect(gain);
                gain.connect(this.masterGain);
                osc.start(now);
                osc.stop(now + 0.065);
            }

            playExplosion(size = 1) {
                if (this.muted || !this.ctx || userSettings.sfxVolume <= 0) return;
                const now = this.ctx.currentTime;
                const duration = Math.min(0.45, 0.18 + size * 0.12);

                const osc = this.ctx.createOscillator();
                const oscGain = this.ctx.createGain();
                osc.type = 'sine';
                osc.frequency.setValueAtTime(140, now);
                osc.frequency.exponentialRampToValueAtTime(28, now + duration);
                oscGain.gain.setValueAtTime(0.45, now);
                oscGain.gain.exponentialRampToValueAtTime(0.001, now + duration);
                osc.connect(oscGain);
                oscGain.connect(this.masterGain);
                osc.start(now);
                osc.stop(now + duration);

                const bufferSize = this.ctx.sampleRate * duration;
                const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
                const data = buffer.getChannelData(0);
                for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;

                const noise = this.ctx.createBufferSource();
                noise.buffer = buffer;
                const filter = this.ctx.createBiquadFilter();
                filter.type = 'lowpass';
                filter.frequency.setValueAtTime(1200, now);
                filter.frequency.exponentialRampToValueAtTime(180, now + duration);

                const noiseGain = this.ctx.createGain();
                noiseGain.gain.setValueAtTime(0.35, now);
                noiseGain.gain.exponentialRampToValueAtTime(0.001, now + duration);

                noise.connect(filter);
                filter.connect(noiseGain);
                noiseGain.connect(this.masterGain);
                noise.start(now);
            }

            playDash() {
                if (this.muted || !this.ctx || userSettings.sfxVolume <= 0) return;
                const now = this.ctx.currentTime;
                const osc = this.ctx.createOscillator();
                const gain = this.ctx.createGain();
                osc.type = 'sine';
                osc.frequency.setValueAtTime(220, now);
                osc.frequency.exponentialRampToValueAtTime(920, now + 0.16);
                gain.gain.setValueAtTime(0.32, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
                osc.connect(gain);
                gain.connect(this.masterGain);
                osc.start(now);
                osc.stop(now + 0.19);
            }

            playPickup(combo = 1) {
                if (this.muted || !this.ctx || userSettings.sfxVolume <= 0) return;
                const now = this.ctx.currentTime;
                const osc = this.ctx.createOscillator();
                const gain = this.ctx.createGain();
                const baseFreq = Math.min(1400, 580 + combo * 18);
                osc.type = 'sine';
                osc.frequency.setValueAtTime(baseFreq, now);
                osc.frequency.exponentialRampToValueAtTime(baseFreq * 1.35, now + 0.08);
                gain.gain.setValueAtTime(0.18, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
                osc.connect(gain);
                gain.connect(this.masterGain);
                osc.start(now);
                osc.stop(now + 0.085);
            }

            playLevelUp() {
                if (this.muted || !this.ctx || userSettings.sfxVolume <= 0) return;
                const notes = [440, 554.37, 659.25, 880];
                notes.forEach((freq, idx) => {
                    const now = this.ctx.currentTime + idx * 0.065;
                    const osc = this.ctx.createOscillator();
                    const gain = this.ctx.createGain();
                    osc.type = 'triangle';
                    osc.frequency.setValueAtTime(freq, now);
                    gain.gain.setValueAtTime(0.28, now);
                    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
                    osc.connect(gain);
                    gain.connect(this.masterGain);
                    osc.start(now);
                    osc.stop(now + 0.26);
                });
            }

            playPlayerHurt() {
                if (this.muted || !this.ctx || userSettings.sfxVolume <= 0) return;
                const now = this.ctx.currentTime;
                const osc = this.ctx.createOscillator();
                const gain = this.ctx.createGain();
                osc.type = 'sawtooth';
                osc.frequency.setValueAtTime(160, now);
                osc.frequency.linearRampToValueAtTime(55, now + 0.24);
                gain.gain.setValueAtTime(0.45, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
                osc.connect(gain);
                gain.connect(this.masterGain);
                osc.start(now);
                osc.stop(now + 0.26);
            }
        }

        const sound = new SoundEngine();

        // --- 3. КЛАССЫ КОРАБЛЕЙ (3 ПРЕСЕТА) ---
        const SHIP_CLASSES = [
            {
                id: 'striker',
                name: 'ШТУРМОВИК',
                tag: 'БАЛАНС',
                color: '#00f3ff',
                desc: 'Универсальный перехватчик с отличной скорострельностью и стабильной броней.',
                stats: { hp: 100, speed: 335, fireRate: 5.8, damage: 24, dashCooldown: 1.55, critChance: 0.15 },
                bars: { hp: 65, spd: 70, dmg: 65 }
            },
            {
                id: 'phantom',
                name: 'ФАНТОМ',
                tag: 'СКОРОСТЬ',
                color: '#b829ff',
                desc: 'Сверхлегкий корпус, мгновенный фазовый рывок и повышенный шанс крита.',
                stats: { hp: 75, speed: 410, fireRate: 6.8, damage: 20, dashCooldown: 1.05, critChance: 0.28 },
                bars: { hp: 40, spd: 98, dmg: 60 }
            },
            {
                id: 'juggernaut',
                name: 'ДЖАГГЕРНАУТ',
                tag: 'ТАНК',
                color: '#ff8800',
                desc: 'Тяжелый дредноут с усиленной броней и разрушительными плазменными зарядами.',
                stats: { hp: 155, speed: 275, fireRate: 4.4, damage: 38, dashCooldown: 2.0, critChance: 0.12 },
                bars: { hp: 98, spd: 45, dmg: 95 }
            }
        ];

        let selectedShipId = 'striker';

        // --- 4. БАЗА ДАННЫХ УЛУЧШЕНИЙ И ВРАГОВ ---
        const UPGRADES_POOL = [
            {
                id: 'multishot',
                name: 'РАСЩЕПИТЕЛЬ ПУЧКА',
                rarity: 'rare',
                rarityLabel: 'РЕДКИЙ МОДУЛЬ',
                icon: '🔱',
                desc: '+1 дополнительный плазменный снаряд при каждом выстреле.',
                apply: (p) => { p.projectiles += 1; }
            },
            {
                id: 'firerate',
                name: 'РАЗГОН ТАКТОВОЙ ЧАСТОТЫ',
                rarity: 'common',
                rarityLabel: 'БАЗОВЫЙ МОДУЛЬ',
                icon: '⚡',
                desc: '+22% к скорострельности основного орудия.',
                apply: (p) => { p.fireRate *= 1.22; }
            },
            {
                id: 'damage',
                name: 'ПЛАЗМЕННЫЙ ПЕРЕГРЕВ',
                rarity: 'common',
                rarityLabel: 'БАЗОВЫЙ МОДУЛЬ',
                icon: '🔥',
                desc: '+28% к урону всех снарядов и увеличению их калибра.',
                apply: (p) => { p.damage *= 1.28; p.bulletRadius += 0.8; }
            },
            {
                id: 'ricochet',
                name: 'КИНЕТИЧЕСКИЙ РИКОШЕТ',
                rarity: 'rare',
                rarityLabel: 'РЕДКИЙ МОДУЛЬ',
                icon: '💠',
                desc: 'Пули отскакивают от стен арены еще +1 раз, сохраняя урон.',
                apply: (p) => { p.bounces += 1; }
            },
            {
                id: 'pierce',
                name: 'РЕЛЬСОТРОННЫЙ ПРОБОЙ',
                rarity: 'rare',
                rarityLabel: 'РЕДКИЙ МОДУЛЬ',
                icon: '☄️',
                desc: 'Снаряды прошивают насквозь на +1 цель больше.',
                apply: (p) => { p.pierce += 1; }
            },
            {
                id: 'chain',
                name: 'ДУГОВОЙ РАЗРЯДНИК',
                rarity: 'legendary',
                rarityLabel: 'ЛЕГЕНДАРНЫЙ',
                icon: '🌩️',
                desc: 'Попадания бьют цепной молнией по ближайшим врагам (+урон дуги).',
                apply: (p) => { p.chainLightning += 1; }
            },
            {
                id: 'drones',
                name: 'ОРБИТАЛЬНЫЙ СТРАЖ',
                rarity: 'legendary',
                rarityLabel: 'ЛЕГЕНДАРНЫЙ',
                icon: '🛸',
                desc: 'Добавляет боевой дрон, вращающийся вокруг вас и сжигающий врагов.',
                apply: (p) => { p.drones += 1; }
            },
            {
                id: 'vampirism',
                name: 'НАНО-СИФОН',
                rarity: 'rare',
                rarityLabel: 'РЕДКИЙ МОДУЛЬ',
                icon: '🩸',
                desc: 'Уничтожение врагов с шансом +14% восстанавливает целостность корпуса.',
                apply: (p) => { p.vampChance += 0.14; }
            },
            {
                id: 'dash_nova',
                name: 'ИМПУЛЬС РЫВКА',
                rarity: 'rare',
                rarityLabel: 'РЕДКИЙ МОДУЛЬ',
                icon: '💥',
                desc: 'Фазовый рывок перезаряжается на 25% быстрее и выпускает шоковую волну.',
                apply: (p) => { p.dashCooldown *= 0.75; p.dashNova = true; }
            },
            {
                id: 'vitality',
                name: 'ТИТАНОВЫЙ КАРКАС',
                rarity: 'common',
                rarityLabel: 'БАЗОВЫЙ МОДУЛЬ',
                icon: '🛡️',
                desc: '+35 к максимальному HP и мгновенный ремонт корпуса на 50%.',
                apply: (p) => {
                    p.maxHp += 35;
                    p.hp = Math.min(p.maxHp, p.hp + p.maxHp * 0.5);
                }
            },
            {
                id: 'magnet_speed',
                name: 'ГРАВИ-МАГНИТ И СЕРВОПРИВОДЫ',
                rarity: 'common',
                rarityLabel: 'БАЗОВЫЙ МОДУЛЬ',
                icon: '🧲',
                desc: '+14% к скорости передвижения и +60% к радиусу притяжения кристаллов.',
                apply: (p) => { p.speed *= 1.14; p.magnetRadius *= 1.6; }
            }
        ];

        const ENEMY_TYPES = {
            rusher: {
                name: 'Ромб-камикадзе',
                icon: '♦️',
                desc: 'Быстрый дрон-перехватчик, стремящийся протаранить ваш корпус.',
                color: '#ff007f',
                radius: 14,
                hp: 34,
                speed: 235,
                score: 100,
                xp: 14,
                shape: 'diamond'
            },
            shooter: {
                name: 'Стрелок-гексагон',
                icon: '⬡',
                desc: 'Держит среднюю дистанцию и ведет прицельный плазменный огонь.',
                color: '#b829ff',
                radius: 18,
                hp: 65,
                speed: 125,
                score: 180,
                xp: 22,
                shape: 'hexagon'
            },
            splitter: {
                name: 'Делитель-тригон',
                icon: '🔺',
                desc: 'После уничтожения распадается на двух быстрых ромбов-камикадзе.',
                color: '#00ff88',
                radius: 20,
                hp: 85,
                speed: 145,
                score: 210,
                xp: 25,
                shape: 'triangle'
            },
            tank: {
                name: 'Тяжелый бастион',
                icon: '🛑',
                desc: 'Массивная бронированная платформа с огромным запасом прочности.',
                color: '#ff9900',
                radius: 26,
                hp: 190,
                speed: 75,
                score: 320,
                xp: 40,
                shape: 'octagon'
            },
            boss: {
                name: 'КИБЕР-ОВЕРЛОРД',
                icon: '☠️',
                desc: 'Босс сектора (каждые 4 волны). Выпускает круговые веерные залпы.',
                color: '#ff2a2a',
                radius: 44,
                hp: 1400,
                speed: 85,
                score: 2500,
                xp: 220,
                shape: 'boss'
            }
        };

        // --- 5. CANVAS И РАДАР ---
        const canvas = document.getElementById('gameCanvas');
        const ctx = canvas.getContext('2d');
        const radarCanvas = document.getElementById('radarCanvas');
        const radarCtx = radarCanvas.getContext('2d');

        let width = window.innerWidth;
        let height = window.innerHeight;
        let dpr = 1;

        function resizeCanvas() {
            width = window.innerWidth;
            height = window.innerHeight;
            const maxDpr = userSettings.lowPerfMode ? 1 : Math.min(window.devicePixelRatio || 1, 1.5);
            dpr = Math.max(1, maxDpr);
            canvas.width = Math.floor(width * dpr);
            canvas.height = Math.floor(height * dpr);
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        }
        window.addEventListener('resize', resizeCanvas);
        applyPerfModeClass();
        resizeCanvas();

        // --- 6. СОСТОЯНИЕ ИГРЫ ---
        const STATE = {
            MENU: 'MENU',
            PLAYING: 'PLAYING',
            PAUSED: 'PAUSED',
            UPGRADE: 'UPGRADE',
            GAMEOVER: 'GAMEOVER'
        };

        let gameState = STATE.MENU;
        const keys = {};
        const mouse = { x: width / 2, y: height / 2, down: false };

        let shakeTime = 0;
        let shakeIntensity = 0;
        let hitStopTimer = 0;
        let bgGridOffset = 0;
        let globalTime = 0;
        let hudSyncTimer = 0;

        let player = null;
        let bullets = [];
        let enemyBullets = [];
        let enemies = [];
        let demoEnemies = [];
        let particles = [];
        let crystals = [];
        let floatingTexts = [];
        let lightningArcs = [];
        let shockwaves = [];

        // Телеметрия текущего забега
        let score = 0;
        let kills = 0;
        let crystalsCollected = 0;
        let totalDamageDealt = 0;
        let survivalSeconds = 0;
        let wave = 1;
        let waveTimer = 0;
        let enemiesToSpawn = 0;
        let spawnTimer = 0;
        let combo = 1.0;
        let comboTimer = 0;
        const MAX_COMBO_TIME = 3.6;

        // --- 7. ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ---
        function rand(min, max) { return Math.random() * (max - min) + min; }
        function dist(x1, y1, x2, y2) { return Math.hypot(x2 - x1, y2 - y1); }

        function formatTime(sec) {
            const m = Math.floor(sec / 60).toString().padStart(2, '0');
            const s = Math.floor(sec % 60).toString().padStart(2, '0');
            return `${m}:${s}`;
        }

        function triggerShake(intensity, duration = 0.18) {
            if (userSettings.shakeMultiplier <= 0) return;
            const scale = userSettings.lowPerfMode ? 0.5 : 1;
            shakeIntensity = Math.max(shakeIntensity, intensity * userSettings.shakeMultiplier * scale);
            shakeTime = Math.max(shakeTime, duration);
        }

        function triggerHitStop(duration = 0.025) {
            if (userSettings.lowPerfMode) return;
            hitStopTimer = Math.max(hitStopTimer, duration);
        }

        function spawnFloatingText(x, y, text, color = '#ffffff', size = 16) {
            if (!userSettings.showDamage && !isNaN(parseInt(text))) return;
            const maxTexts = userSettings.lowPerfMode ? 14 : 36;
            if (floatingTexts.length >= maxTexts) floatingTexts.shift();
            floatingTexts.push({
                x, y, vy: -55, text, color, size, life: 0.75, maxLife: 0.75
            });
        }

        function spawnParticles(x, y, color, count = 14, speedMin = 60, speedMax = 280, size = 3.5) {
            const actualCount = userSettings.lowPerfMode ? Math.max(2, Math.ceil(count * 0.4)) : count;
            const maxParticles = userSettings.lowPerfMode ? 60 : 220;
            for (let i = 0; i < actualCount; i++) {
                if (particles.length >= maxParticles) particles.shift();
                const angle = rand(0, Math.PI * 2);
                const speed = rand(speedMin, speedMax);
                particles.push({
                    x, y,
                    vx: Math.cos(angle) * speed,
                    vy: Math.sin(angle) * speed,
                    color,
                    size: rand(size * 0.5, size * 1.4),
                    life: rand(0.25, 0.55),
                    maxLife: 0.55,
                    drag: 0.93
                });
            }
        }

        function spawnShockwave(x, y, maxRadius, color, width = 3) {
            const maxWaves = userSettings.lowPerfMode ? 4 : 14;
            if (shockwaves.length >= maxWaves) shockwaves.shift();
            shockwaves.push({
                x, y, radius: 8, maxRadius, color, width, life: 0.35, maxLife: 0.35
            });
        }

        // --- 8. СОЗДАНИЕ ИГРОКА ПО ВЫБРАННОМУ КЛАССУ ---
        function createPlayer() {
            const preset = SHIP_CLASSES.find(s => s.id === selectedShipId) || SHIP_CLASSES[0];
            return {
                classId: preset.id,
                className: preset.name,
                color: preset.color,
                x: width / 2,
                y: height / 2,
                vx: 0,
                vy: 0,
                radius: 16,
                angle: 0,
                hp: preset.stats.hp,
                maxHp: preset.stats.hp,
                speed: preset.stats.speed,
                fireRate: preset.stats.fireRate,
                fireCooldown: 0,
                damage: preset.stats.damage,
                critChance: preset.stats.critChance,
                critMult: 1.5,
                bulletSpeed: 850,
                bulletRadius: 4.5,
                projectiles: 1,
                bounces: 0,
                pierce: 0,
                chainLightning: 0,
                drones: 0,
                droneAngle: 0,
                vampChance: 0,
                magnetRadius: 130,
                dashCooldown: preset.stats.dashCooldown,
                dashTimer: 0,
                dashActiveTimer: 0,
                dashDirX: 0,
                dashDirY: 0,
                dashNova: false,
                invulnTimer: 0,
                level: 1,
                xp: 0,
                xpToNext: 60,
                installedModules: {},
                trail: []
            };
        }

        function performDash() {
            if (!player || gameState !== STATE.PLAYING) return;
            if (player.dashTimer > 0 || player.dashActiveTimer > 0) return;

            let dx = 0, dy = 0;
            if (keys['KeyW'] || keys['ArrowUp']) dy -= 1;
            if (keys['KeyS'] || keys['ArrowDown']) dy += 1;
            if (keys['KeyA'] || keys['ArrowLeft']) dx -= 1;
            if (keys['KeyD'] || keys['ArrowRight']) dx += 1;

            if (dx === 0 && dy === 0) {
                dx = Math.cos(player.angle);
                dy = Math.sin(player.angle);
            } else {
                const len = Math.hypot(dx, dy);
                dx /= len;
                dy /= len;
            }

            player.dashDirX = dx;
            player.dashDirY = dy;
            player.dashActiveTimer = 0.16;
            player.dashTimer = player.dashCooldown;
            player.invulnTimer = 0.28;

            sound.playDash();
            triggerShake(6, 0.12);
            spawnParticles(player.x, player.y, player.color, 18, 90, 260, 4);
            spawnShockwave(player.x, player.y, 75, player.color, 2.5);

            if (player.dashNova) {
                spawnShockwave(player.x, player.y, 175, '#b829ff', 4);
                enemies.forEach(e => {
                    if (dist(player.x, player.y, e.x, e.y) <= 175 + e.radius) {
                        damageEnemy(e, player.damage * 1.4, '#b829ff');
                    }
                });
            }
        }

        // --- 9. ВОЛНЫ И ВРАГИ ---
        function startWave(waveNum) {
            wave = waveNum;
            if (wave > careerStats.maxWave) {
                careerStats.maxWave = wave;
                saveCareer();
            }
            document.getElementById('waveBadge').textContent = `ВОЛНА ${wave}`;
            const isBossWave = wave % 4 === 0;
            const bossWarn = document.getElementById('bossWarning');

            if (isBossWave) {
                bossWarn.style.display = 'block';
                spawnEnemy('boss');
                enemiesToSpawn = 4 + Math.floor(wave * 1.2);
            } else {
                bossWarn.style.display = 'none';
                enemiesToSpawn = 6 + Math.floor(wave * 2.6);
            }
            spawnTimer = 0.4;
        }

        function spawnEnemy(forcedType = null, customX = null, customY = null) {
            let typeKey = forcedType;
            if (!typeKey) {
                const r = Math.random();
                if (wave === 1) typeKey = r < 0.8 ? 'rusher' : 'shooter';
                else if (wave === 2) typeKey = r < 0.55 ? 'rusher' : (r < 0.85 ? 'shooter' : 'splitter');
                else {
                    if (r < 0.42) typeKey = 'rusher';
                    else if (r < 0.68) typeKey = 'shooter';
                    else if (r < 0.85) typeKey = 'splitter';
                    else typeKey = 'tank';
                }
            }

            const base = ENEMY_TYPES[typeKey];
            const scaleHp = 1 + (wave - 1) * 0.18;
            const scaleSpeed = 1 + Math.min(0.45, (wave - 1) * 0.03);

            let x = customX, y = customY;
            if (x === null || y === null) {
                const side = Math.floor(Math.random() * 4);
                const pad = 45;
                if (side === 0) { x = rand(0, width); y = -pad; }
                else if (side === 1) { x = width + pad; y = rand(0, height); }
                else if (side === 2) { x = rand(0, width); y = height + pad; }
                else { x = -pad; y = rand(0, height); }
            }

            enemies.push({
                type: typeKey,
                x, y, vx: 0, vy: 0,
                radius: base.radius,
                color: base.color,
                hp: Math.round(base.hp * scaleHp),
                maxHp: Math.round(base.hp * scaleHp),
                speed: base.speed * scaleSpeed,
                score: base.score,
                xp: base.xp,
                shape: base.shape,
                angle: 0,
                shootTimer: rand(1.0, 2.4),
                hitFlash: 0
            });
        }

        // --- 10. БОЕВАЯ СИСТЕМА ---
        function shootPlayerWeapons() {
            const count = player.projectiles;
            const spreadAngle = 0.11;
            const startAngle = player.angle - ((count - 1) * spreadAngle) / 2;

            for (let i = 0; i < count; i++) {
                const a = startAngle + i * spreadAngle + rand(-0.02, 0.02);
                const muzzleX = player.x + Math.cos(player.angle) * (player.radius + 8);
                const muzzleY = player.y + Math.sin(player.angle) * (player.radius + 8);

                bullets.push({
                    x: muzzleX, y: muzzleY,
                    vx: Math.cos(a) * player.bulletSpeed,
                    vy: Math.sin(a) * player.bulletSpeed,
                    radius: player.bulletRadius,
                    damage: player.damage,
                    bouncesLeft: player.bounces,
                    pierceLeft: player.pierce,
                    hitIds: new Set(),
                    life: 1.6,
                    color: player.color,
                    trail: [{ x: muzzleX, y: muzzleY }]
                });
            }

            player.vx -= Math.cos(player.angle) * 26;
            player.vy -= Math.sin(player.angle) * 26;
            sound.playShoot(1 + (count - 1) * 0.04);
        }

        function triggerChainLightning(sourceEnemy, damage, jumps) {
            let current = sourceEnemy;
            const visited = new Set([sourceEnemy]);

            for (let i = 0; i < jumps; i++) {
                let nearest = null;
                let minDist = 215;

                for (const other of enemies) {
                    if (!visited.has(other) && other.hp > 0) {
                        const d = dist(current.x, current.y, other.x, other.y);
                        if (d < minDist) {
                            minDist = d;
                            nearest = other;
                        }
                    }
                }
                if (!nearest) break;
                visited.add(nearest);

                lightningArcs.push({
                    x1: current.x, y1: current.y, x2: nearest.x, y2: nearest.y, life: 0.16
                });
                damageEnemy(nearest, damage * 0.65, '#ffe600', false);
                current = nearest;
            }
        }

        function damageEnemy(enemy, amount, color = '#00f3ff', allowChain = true) {
            if (enemy.hp <= 0) return;

            const isCrit = Math.random() < (player ? player.critChance : 0.15);
            const finalDmg = Math.round(amount * (isCrit ? (player ? player.critMult : 1.5) : 1));
            enemy.hp -= finalDmg;
            enemy.hitFlash = 0.08;
            totalDamageDealt += finalDmg;

            spawnFloatingText(
                enemy.x + rand(-10, 10),
                enemy.y - enemy.radius,
                isCrit ? `${finalDmg}!` : `${finalDmg}`,
                isCrit ? '#ffe600' : '#ffffff',
                isCrit ? 19 : 14
            );

            if (allowChain && player && player.chainLightning > 0) {
                triggerChainLightning(enemy, finalDmg, player.chainLightning);
            }

            if (enemy.hp <= 0) {
                killEnemy(enemy);
            } else {
                sound.playHit(isCrit);
                spawnParticles(enemy.x, enemy.y, color, 4, 40, 130, 2.5);
            }
        }

        function killEnemy(enemy) {
            kills++;
            careerStats.totalKills++;
            combo = Math.min(8.0, +(combo + 0.2).toFixed(1));
            comboTimer = MAX_COMBO_TIME;

            const gainedScore = Math.round(enemy.score * combo);
            score += gainedScore;

            const isBoss = enemy.type === 'boss';
            sound.playExplosion(isBoss ? 2.5 : (enemy.type === 'tank' ? 1.5 : 1));
            triggerShake(isBoss ? 18 : 6, isBoss ? 0.45 : 0.14);
            if (isBoss || enemy.type === 'tank') {
                triggerHitStop(isBoss ? 0.06 : 0.025);
            }

            spawnParticles(enemy.x, enemy.y, enemy.color, isBoss ? 55 : 20, 70, isBoss ? 420 : 260, isBoss ? 5 : 3.5);
            spawnShockwave(enemy.x, enemy.y, enemy.radius * 3.2, enemy.color, isBoss ? 5 : 2.5);

            if (enemy.type === 'splitter') {
                for (let i = 0; i < 2; i++) {
                    spawnEnemy('rusher', enemy.x + rand(-16, 16), enemy.y + rand(-16, 16));
                }
            }

            if (player && player.vampChance > 0 && Math.random() < player.vampChance) {
                const heal = 6;
                player.hp = Math.min(player.maxHp, player.hp + heal);
                spawnFloatingText(player.x, player.y - 24, `+${heal} HP`, '#00ff88', 15);
            }

            const crystalCount = isBoss ? 14 : Math.max(1, Math.round(enemy.xp / 14));
            const xpPerCrystal = enemy.xp / crystalCount;
            for (let i = 0; i < crystalCount; i++) {
                const a = rand(0, Math.PI * 2);
                const spd = rand(50, 160);
                crystals.push({
                    x: enemy.x, y: enemy.y,
                    vx: Math.cos(a) * spd, vy: Math.sin(a) * spd,
                    xp: xpPerCrystal,
                    size: isBoss ? 6 : 4.5,
                    pulse: rand(0, Math.PI * 2)
                });
            }
        }

        function hurtPlayer(amount) {
            if (!player || player.invulnTimer > 0 || player.dashActiveTimer > 0) return;

            player.hp = Math.max(0, player.hp - amount);
            player.invulnTimer = 0.65;
            combo = 1.0;
            comboTimer = 0;

            const flash = document.getElementById('hpDamageFlash');
            flash.style.opacity = '0.85';
            setTimeout(() => { flash.style.opacity = '0'; }, 120);

            sound.playPlayerHurt();
            triggerShake(14, 0.28);
            triggerHitStop(0.04);
            spawnParticles(player.x, player.y, '#ff2a2a', 22, 80, 290, 4);
            spawnShockwave(player.x, player.y, 90, '#ff2a2a', 3);
            spawnFloatingText(player.x, player.y - 22, `-${amount}`, '#ff2a2a', 20);

            if (player.hp <= 0) {
                endGame();
            }
        }

        // --- 11. ПРОКАЧКА И МОДУЛИ В HUD ---
        function gainXp(amount) {
            player.xp += amount;
            if (player.xp >= player.xpToNext) {
                player.xp -= player.xpToNext;
                player.level++;
                player.xpToNext = Math.round(player.xpToNext * 1.32 + 20);
                openUpgradeMenu();
            }
        }

        function updateHudModulesBar() {
            const bar = document.getElementById('hudModulesBar');
            bar.innerHTML = '';
            if (!player) return;

            Object.entries(player.installedModules).forEach(([modId, lvl]) => {
                const mod = UPGRADES_POOL.find(u => u.id === modId);
                if (!mod) return;
                const slot = document.createElement('div');
                slot.className = 'hud-mod-slot cyber-clip-sm';
                slot.innerHTML = `
                    <span>${mod.icon}</span>
                    <span class="hud-mod-lvl">v${lvl}</span>
                    <div class="hud-mod-tooltip cyber-clip-sm">
                        <div style="font-family: var(--font-mono); font-size: 11px; color: var(--neon-cyan); font-weight: 700;">${mod.name} (УР. ${lvl})</div>
                        <div style="font-size: 11px; color: #cbd5e1; margin-top: 3px;">${mod.desc}</div>
                    </div>
                `;
                bar.appendChild(slot);
            });
        }

        function openUpgradeMenu() {
            gameState = STATE.UPGRADE;
            mouse.down = false;
            sound.playLevelUp();

            const shuffled = [...UPGRADES_POOL].sort(() => Math.random() - 0.5);
            const choices = shuffled.slice(0, 3);

            const container = document.getElementById('upgradeCardsContainer');
            container.innerHTML = '';

            choices.forEach(upg => {
                const currentLvl = player.installedModules[upg.id] || 0;
                const card = document.createElement('div');
                card.className = `upgrade-card cyber-clip-sm ${upg.rarity}`;
                card.innerHTML = `
                    <div class="card-icon cyber-clip-sm">${upg.icon}</div>
                    <div style="font-family: var(--font-mono); font-size: 11px; color: var(--neon-cyan); margin-bottom: 4px;">${upg.rarityLabel} • УР. ${currentLvl + 1}</div>
                    <div style="font-family: var(--font-display); font-size: 15px; font-weight: 800; margin-bottom: 8px;">${upg.name}</div>
                    <div style="font-size: 13px; color: #94a3b8; line-height: 1.35;">${upg.desc}</div>
                `;
                card.addEventListener('click', () => {
                    upg.apply(player);
                    player.installedModules[upg.id] = currentLvl + 1;
                    updateHudModulesBar();
                    sound.playPickup(10);
                    document.getElementById('upgradeScreen').classList.add('hidden');
                    gameState = STATE.PLAYING;
                    spawnShockwave(player.x, player.y, 160, '#ffe600', 4);
                });
                container.appendChild(card);
            });

            document.getElementById('upgradeScreen').classList.remove('hidden');
        }

        // --- 12. УПРАВЛЕНИЕ ПАУЗОЙ (ESC) ---
        function togglePause() {
            if (gameState === STATE.PLAYING) {
                gameState = STATE.PAUSED;
                mouse.down = false;
                populatePauseScreen();
                document.getElementById('pauseScreen').classList.remove('hidden');
            } else if (gameState === STATE.PAUSED) {
                resumeGame();
            }
        }

        function resumeGame() {
            if (gameState !== STATE.PAUSED) return;
            document.getElementById('pauseScreen').classList.add('hidden');
            gameState = STATE.PLAYING;
            lastTime = performance.now();
        }

        function populatePauseScreen() {
            if (!player) return;
            document.getElementById('pauseShipTitle').textContent = `КОР: ${player.className}`;

            document.getElementById('pStatHp').textContent = `${Math.ceil(player.hp)} / ${player.maxHp}`;
            document.getElementById('pStatDmg').textContent = Math.round(player.damage);
            document.getElementById('pStatRate').textContent = `${player.fireRate.toFixed(1)} / СЕК`;
            document.getElementById('pStatProj').textContent = player.projectiles;
            document.getElementById('pStatCrit').textContent = `${Math.round(player.critChance * 100)}% / x${player.critMult.toFixed(1)}`;
            document.getElementById('pStatSpeed').textContent = Math.round(player.speed);
            document.getElementById('pStatDash').textContent = `${player.dashCooldown.toFixed(2)} СЕК`;
            document.getElementById('pStatPierce').textContent = `${player.pierce} / ${player.bounces}`;
            document.getElementById('pStatVamp').textContent = `${Math.round(player.vampChance * 100)}%`;
            document.getElementById('pStatDrones').textContent = player.drones;

            document.getElementById('pRunWave').textContent = wave;
            document.getElementById('pRunTime').textContent = formatTime(survivalSeconds);
            document.getElementById('pRunKills').textContent = kills;
            document.getElementById('pRunCrystals').textContent = crystalsCollected;
            document.getElementById('pRunDamage').textContent = totalDamageDealt.toLocaleString('ru-RU');
            document.getElementById('pRunLevel').textContent = player.level;
            document.getElementById('pRunScore').textContent = score.toLocaleString('ru-RU');
            document.getElementById('pRunBest').textContent = Math.max(score, careerStats.bestScore).toLocaleString('ru-RU');

            const modGrid = document.getElementById('pauseModulesGrid');
            const entries = Object.entries(player.installedModules);
            if (entries.length === 0) {
                modGrid.innerHTML = `<div style="font-size: 12px; color: #64748b; font-family: var(--font-mono); grid-column: 1 / -1;">Модули ещё не установлены</div>`;
            } else {
                modGrid.innerHTML = '';
                entries.forEach(([modId, lvl]) => {
                    const mod = UPGRADES_POOL.find(u => u.id === modId);
                    if (!mod) return;
                    const div = document.createElement('div');
                    div.className = 'pause-mod-card cyber-clip-sm';
                    div.innerHTML = `
                        <span style="font-size: 18px;">${mod.icon}</span>
                        <div>
                            <div style="font-family: var(--font-mono); font-size: 11px; color: #fff; font-weight: 700;">${mod.name}</div>
                            <div style="font-family: var(--font-mono); font-size: 10px; color: var(--neon-yellow);">УРОВЕНЬ ${lvl}</div>
                        </div>
                    `;
                    modGrid.appendChild(div);
                });
            }

            syncSettingsUI();
        }

        // --- 13. ЗАПУСК, ЗАВЕРШЕНИЕ И ВОЗВРАТ В ГЛАВНОЕ МЕНЮ ---
        function startGame() {
            sound.init();
            resizeCanvas();
            player = createPlayer();
            bullets = [];
            enemyBullets = [];
            enemies = [];
            particles = [];
            crystals = [];
            floatingTexts = [];
            lightningArcs = [];
            shockwaves = [];

            score = 0;
            kills = 0;
            crystalsCollected = 0;
            totalDamageDealt = 0;
            survivalSeconds = 0;
            combo = 1.0;
            comboTimer = 0;
            hudSyncTimer = 0;

            updateHudModulesBar();
            updateHUD();
            renderRadar();
            document.getElementById('hudShipName').textContent = `КОР: ${player.className}`;
            document.getElementById('hudShipName').style.color = player.color;

            hideAllOverlays();
            document.getElementById('hud').classList.add('visible');

            gameState = STATE.PLAYING;
            lastTime = performance.now();
            startWave(1);
        }

        function returnToMainMenu() {
            saveCareer();
            hideAllOverlays();
            document.getElementById('hud').classList.remove('visible');
            updateCareerUI();
            initDemoArena();
            gameState = STATE.MENU;
            document.getElementById('startScreen').classList.remove('hidden');
        }

        function endGame() {
            gameState = STATE.GAMEOVER;
            mouse.down = false;
            document.getElementById('hud').classList.remove('visible');

            let isNewRecord = false;
            if (score > careerStats.bestScore) {
                careerStats.bestScore = score;
                isNewRecord = true;
            }
            if (wave > careerStats.maxWave) {
                careerStats.maxWave = wave;
            }
            saveCareer();

            document.getElementById('finalScore').textContent = score.toLocaleString('ru-RU');
            document.getElementById('finalWaveTime').textContent = `${wave} / ${formatTime(survivalSeconds)}`;
            document.getElementById('finalKills').textContent = kills;
            document.getElementById('finalDamage').textContent = totalDamageDealt.toLocaleString('ru-RU');
            document.getElementById('newRecordBadge').style.display = isNewRecord ? 'block' : 'none';

            const goMods = document.getElementById('gameOverModulesGrid');
            const entries = player ? Object.entries(player.installedModules) : [];
            if (entries.length === 0) {
                goMods.innerHTML = `<div style="font-size: 12px; color: #64748b; font-family: var(--font-mono);">Модули не были установлены</div>`;
            } else {
                goMods.innerHTML = '';
                entries.forEach(([modId, lvl]) => {
                    const mod = UPGRADES_POOL.find(u => u.id === modId);
                    if (!mod) return;
                    const div = document.createElement('div');
                    div.className = 'pause-mod-card cyber-clip-sm';
                    div.innerHTML = `
                        <span style="font-size: 18px;">${mod.icon}</span>
                        <div>
                            <div style="font-family: var(--font-mono); font-size: 11px; color: #fff;">${mod.name}</div>
                            <div style="font-family: var(--font-mono); font-size: 10px; color: var(--neon-cyan);">УР. ${lvl}</div>
                        </div>
                    `;
                    goMods.appendChild(div);
                });
            }

            document.getElementById('gameOverScreen').classList.remove('hidden');
        }

        function hideAllOverlays() {
            ['startScreen', 'codexScreen', 'settingsScreen', 'pauseScreen', 'upgradeScreen', 'gameOverScreen']
                .forEach(id => document.getElementById(id).classList.add('hidden'));
        }

        // --- 14. ИНИЦИАЛИЗАЦИЯ UI МЕНЮ, КОДЕКСА И НАСТРОЕК ---
        function renderShipSelector() {
            const container = document.getElementById('shipSelectorContainer');
            container.innerHTML = '';
            SHIP_CLASSES.forEach(ship => {
                const card = document.createElement('div');
                card.className = `ship-card cyber-clip-sm ${ship.id === selectedShipId ? 'selected' : ''}`;
                card.innerHTML = `
                    <div class="ship-card-header">
                        <span class="ship-name" style="color: ${ship.color};">${ship.name}</span>
                        <span class="ship-tag" style="color: ${ship.color};">${ship.tag}</span>
                    </div>
                    <div class="ship-desc">${ship.desc}</div>
                    <div class="ship-stat-bars">
                        <div class="mini-stat-row"><span>БРОНЯ</span><div class="mini-bar"><div class="mini-bar-fill" style="width:${ship.bars.hp}%; background:${ship.color};"></div></div></div>
                        <div class="mini-stat-row"><span>СКОРОСТЬ</span><div class="mini-bar"><div class="mini-bar-fill" style="width:${ship.bars.spd}%; background:${ship.color};"></div></div></div>
                        <div class="mini-stat-row"><span>ОГН. МОЩЬ</span><div class="mini-bar"><div class="mini-bar-fill" style="width:${ship.bars.dmg}%; background:${ship.color};"></div></div></div>
                    </div>
                `;
                card.addEventListener('click', () => {
                    selectedShipId = ship.id;
                    sound.init();
                    sound.playPickup(4);
                    renderShipSelector();
                });
                container.appendChild(card);
            });
        }

        function updateCareerUI() {
            document.getElementById('careerBestScore').textContent = careerStats.bestScore.toLocaleString('ru-RU');
            document.getElementById('careerMaxWave').textContent = careerStats.maxWave;
            document.getElementById('careerTotalKills').textContent = careerStats.totalKills.toLocaleString('ru-RU');
        }

        function renderCodex(tab = 'modules') {
            const grid = document.getElementById('codexGrid');
            grid.innerHTML = '';
            if (tab === 'modules') {
                UPGRADES_POOL.forEach(m => {
                    const item = document.createElement('div');
                    item.className = 'codex-item cyber-clip-sm';
                    item.innerHTML = `
                        <div class="codex-icon">${m.icon}</div>
                        <div>
                            <div style="font-family: var(--font-mono); font-size: 10px; color: var(--neon-cyan);">${m.rarityLabel}</div>
                            <div style="font-family: var(--font-display); font-size: 13px; font-weight: 700; margin: 2px 0;">${m.name}</div>
                            <div style="font-size: 12px; color: #94a3b8;">${m.desc}</div>
                        </div>
                    `;
                    grid.appendChild(item);
                });
            } else {
                Object.values(ENEMY_TYPES).forEach(e => {
                    const item = document.createElement('div');
                    item.className = 'codex-item cyber-clip-sm';
                    item.innerHTML = `
                        <div class="codex-icon" style="color:${e.color};">${e.icon}</div>
                        <div>
                            <div style="font-family: var(--font-mono); font-size: 10px; color: ${e.color};">БАЗОВОЕ HP: ${e.hp} • ОЧКИ: ${e.score}</div>
                            <div style="font-family: var(--font-display); font-size: 13px; font-weight: 700; margin: 2px 0;">${e.name}</div>
                            <div style="font-size: 12px; color: #94a3b8;">${e.desc}</div>
                        </div>
                    `;
                    grid.appendChild(item);
                });
            }
        }

        function syncSettingsUI() {
            const volPct = Math.round(userSettings.sfxVolume * 100);
            document.getElementById('sfxVolumeSlider').value = volPct;
            document.getElementById('sfxVolumeVal').textContent = `${volPct}%`;
            document.getElementById('pauseSfxSlider').value = volPct;

            const shakePct = Math.round(userSettings.shakeMultiplier * 100);
            document.getElementById('shakeIntensitySlider').value = shakePct;
            document.getElementById('shakeIntensityVal').textContent = `${shakePct}%`;

            const lowPerfBtns = [document.getElementById('lowPerfToggle'), document.getElementById('pauseLowPerfToggle')];
            lowPerfBtns.forEach(btn => {
                if (!btn) return;
                btn.textContent = userSettings.lowPerfMode ? 'ВКЛ' : 'ВЫКЛ';
                btn.classList.toggle('off', !userSettings.lowPerfMode);
            });

            const pShakeBtn = document.getElementById('pauseShakeToggle');
            const shakeOn = userSettings.shakeMultiplier > 0;
            pShakeBtn.textContent = shakeOn ? 'ВКЛ' : 'ВЫКЛ';
            pShakeBtn.classList.toggle('off', !shakeOn);

            const autoBtns = [document.getElementById('autoFireToggle'), document.getElementById('pauseAutoFireToggle')];
            autoBtns.forEach(btn => {
                btn.textContent = userSettings.autoFire ? 'ВКЛ' : 'ВЫКЛ';
                btn.classList.toggle('off', !userSettings.autoFire);
            });
            document.getElementById('hudAutoFire').textContent = `АВТО-ОГОНЬ: ${userSettings.autoFire ? 'ВКЛ' : 'ВЫКЛ'}`;

            const dmgBtn = document.getElementById('damageNumbersToggle');
            dmgBtn.textContent = userSettings.showDamage ? 'ВКЛ' : 'ВЫКЛ';
            dmgBtn.classList.toggle('off', !userSettings.showDamage);
        }

        // --- 15. ФОНОВЫЙ ДЕМО-РЕЖИМ В ГЛАВНОМ МЕНЮ ---
        function initDemoArena() {
            demoEnemies = [];
            const types = ['rusher', 'shooter', 'splitter', 'tank'];
            for (let i = 0; i < 10; i++) {
                const t = ENEMY_TYPES[types[i % types.length]];
                demoEnemies.push({
                    x: rand(60, width - 60),
                    y: rand(60, height - 60),
                    vx: rand(-90, 90),
                    vy: rand(-90, 90),
                    radius: t.radius,
                    color: t.color,
                    shape: t.shape,
                    angle: rand(0, Math.PI * 2)
                });
            }
        }

        function updateDemoBackground(dt) {
            for (const de of demoEnemies) {
                de.x += de.vx * dt;
                de.y += de.vy * dt;
                de.angle += dt * 1.8;
                if (de.x < 30 || de.x > width - 30) de.vx *= -1;
                if (de.y < 30 || de.y > height - 30) de.vy *= -1;
            }
            if (!userSettings.lowPerfMode && Math.random() < 0.22) {
                const colors = ['#00f3ff', '#ff007f', '#b829ff', '#00ff88'];
                spawnParticles(rand(0, width), rand(0, height), colors[Math.floor(Math.random() * colors.length)], 3, 20, 90, 2.5);
            }
            updateVisualEffects(dt);
        }

        // --- 16. ИГРОВОЙ ЦИКЛ ОБНОВЛЕНИЯ ---
        function update(dt) {
            globalTime += dt;
            bgGridOffset = (bgGridOffset + 24 * dt) % 50;

            if (shakeTime > 0) {
                shakeTime -= dt;
                if (shakeTime <= 0) shakeIntensity = 0;
            }

            if (gameState === STATE.MENU) {
                updateDemoBackground(dt);
                return;
            }

            if (gameState !== STATE.PLAYING) return;

            if (hitStopTimer > 0) {
                hitStopTimer -= dt;
                return;
            }

            survivalSeconds += dt;

            if (comboTimer > 0) {
                comboTimer -= dt;
                if (comboTimer <= 0) combo = 1.0;
            }

            if (enemiesToSpawn > 0) {
                spawnTimer -= dt;
                if (spawnTimer <= 0) {
                    spawnEnemy();
                    enemiesToSpawn--;
                    spawnTimer = Math.max(0.28, 1.05 - wave * 0.05);
                }
            } else if (enemies.length === 0) {
                waveTimer += dt;
                if (waveTimer >= 1.1) {
                    waveTimer = 0;
                    startWave(wave + 1);
                    spawnFloatingText(width / 2, height * 0.28, `ВОЛНА ${wave}`, '#00f3ff', 28);
                }
            }

            player.angle = Math.atan2(mouse.y - player.y, mouse.x - player.x);
            if (player.invulnTimer > 0) player.invulnTimer -= dt;
            if (player.dashTimer > 0) player.dashTimer = Math.max(0, player.dashTimer - dt);

            if (player.dashActiveTimer > 0) {
                player.dashActiveTimer -= dt;
                const dashSpeed = player.speed * 3.3;
                player.x += player.dashDirX * dashSpeed * dt;
                player.y += player.dashDirY * dashSpeed * dt;
                const lastT = player.trail[player.trail.length - 1];
                if (!lastT || dist(lastT.x, lastT.y, player.x, player.y) >= 14) {
                    player.trail.push({ x: player.x, y: player.y, angle: player.angle, alpha: 0.65 });
                    if (player.trail.length > 5) player.trail.shift();
                }
            } else {
                let ix = 0, iy = 0;
                if (keys['KeyW'] || keys['ArrowUp']) iy -= 1;
                if (keys['KeyS'] || keys['ArrowDown']) iy += 1;
                if (keys['KeyA'] || keys['ArrowLeft']) ix -= 1;
                if (keys['KeyD'] || keys['ArrowRight']) ix += 1;

                if (ix !== 0 || iy !== 0) {
                    const len = Math.hypot(ix, iy);
                    ix /= len; iy /= len;
                }

                const targetVx = ix * player.speed;
                const targetVy = iy * player.speed;
                player.vx += (targetVx - player.vx) * Math.min(1, dt * 14);
                player.vy += (targetVy - player.vy) * Math.min(1, dt * 14);

                player.x += player.vx * dt;
                player.y += player.vy * dt;
            }

            const margin = player.radius + 6;
            player.x = Math.max(margin, Math.min(width - margin, player.x));
            player.y = Math.max(margin, Math.min(height - margin, player.y));

            for (let i = player.trail.length - 1; i >= 0; i--) {
                player.trail[i].alpha -= dt * 3.8;
                if (player.trail[i].alpha <= 0) player.trail.splice(i, 1);
            }

            if (player.fireCooldown > 0) player.fireCooldown -= dt;
            if ((mouse.down || userSettings.autoFire) && player.fireCooldown <= 0) {
                shootPlayerWeapons();
                player.fireCooldown = 1 / player.fireRate;
            }

            if (player.drones > 0) {
                player.droneAngle += dt * 3.4;
                const orbitR = 54;
                for (let i = 0; i < player.drones; i++) {
                    const a = player.droneAngle + (i * Math.PI * 2) / player.drones;
                    const dx = player.x + Math.cos(a) * orbitR;
                    const dy = player.y + Math.sin(a) * orbitR;

                    for (const e of enemies) {
                        if (dist(dx, dy, e.x, e.y) < e.radius + 9) {
                            if (!e.droneHitTimer || e.droneHitTimer <= 0) {
                                damageEnemy(e, player.damage * 0.75, '#00ff88', false);
                                e.droneHitTimer = 0.25;
                            }
                        }
                    }
                    for (let j = enemyBullets.length - 1; j >= 0; j--) {
                        if (dist(dx, dy, enemyBullets[j].x, enemyBullets[j].y) < 12) {
                            spawnParticles(enemyBullets[j].x, enemyBullets[j].y, '#00ff88', 5, 30, 100, 2);
                            enemyBullets.splice(j, 1);
                        }
                    }
                }
            }

            // Пули игрока (короткий аккуратный след без «палки» при низком FPS)
            for (let i = bullets.length - 1; i >= 0; i--) {
                const b = bullets[i];
                b.x += b.vx * dt;
                b.y += b.vy * dt;
                b.life -= dt;

                const lastTrail = b.trail[b.trail.length - 1];
                if (!lastTrail || dist(lastTrail.x, lastTrail.y, b.x, b.y) >= 10) {
                    b.trail.push({ x: b.x, y: b.y });
                    if (b.trail.length > 3) b.trail.shift();
                }

                let bounced = false;
                if (b.x < b.radius) { b.x = b.radius; b.vx *= -1; bounced = true; }
                else if (b.x > width - b.radius) { b.x = width - b.radius; b.vx *= -1; bounced = true; }
                if (b.y < b.radius) { b.y = b.radius; b.vy *= -1; bounced = true; }
                else if (b.y > height - b.radius) { b.y = height - b.radius; b.vy *= -1; bounced = true; }

                if (bounced) {
                    b.trail = [{ x: b.x, y: b.y }];
                    if (b.bouncesLeft > 0) {
                        b.bouncesLeft--;
                        b.hitIds.clear();
                        spawnParticles(b.x, b.y, b.color, 5, 40, 120, 2);
                    } else {
                        bullets.splice(i, 1);
                        continue;
                    }
                }

                if (b.life <= 0) {
                    bullets.splice(i, 1);
                    continue;
                }

                let removeBullet = false;
                for (const e of enemies) {
                    if (e.hp > 0 && !b.hitIds.has(e) && dist(b.x, b.y, e.x, e.y) < e.radius + b.radius) {
                        b.hitIds.add(e);
                        damageEnemy(e, b.damage, b.color, true);

                        const pushFactor = e.type === 'boss' ? 4 : (e.type === 'tank' ? 18 : 45);
                        const bAngle = Math.atan2(b.vy, b.vx);
                        e.x += Math.cos(bAngle) * pushFactor * 0.12;
                        e.y += Math.sin(bAngle) * pushFactor * 0.12;

                        if (b.pierceLeft > 0) b.pierceLeft--;
                        else { removeBullet = true; break; }
                    }
                }

                if (removeBullet) bullets.splice(i, 1);
            }

            // Враги
            for (let i = enemies.length - 1; i >= 0; i--) {
                const e = enemies[i];
                if (e.hp <= 0) {
                    enemies.splice(i, 1);
                    continue;
                }

                if (e.hitFlash > 0) e.hitFlash -= dt;
                if (e.droneHitTimer > 0) e.droneHitTimer -= dt;

                const toPlayerAngle = Math.atan2(player.y - e.y, player.x - e.x);
                const dToPlayer = dist(e.x, e.y, player.x, player.y);

                if (e.type === 'rusher' || e.type === 'splitter') {
                    e.angle += dt * 4;
                    e.vx = Math.cos(toPlayerAngle) * e.speed;
                    e.vy = Math.sin(toPlayerAngle) * e.speed;
                } else if (e.type === 'tank') {
                    e.angle += dt * 1.2;
                    e.vx = Math.cos(toPlayerAngle) * e.speed;
                    e.vy = Math.sin(toPlayerAngle) * e.speed;
                } else if (e.type === 'shooter') {
                    e.angle = toPlayerAngle;
                    let moveDir = 0;
                    if (dToPlayer > 330) moveDir = 1;
                    else if (dToPlayer < 230) moveDir = -0.8;

                    const strafe = Math.sin(globalTime * 2 + i) * 0.7;
                    e.vx = (Math.cos(toPlayerAngle) * moveDir - Math.sin(toPlayerAngle) * strafe) * e.speed;
                    e.vy = (Math.sin(toPlayerAngle) * moveDir + Math.cos(toPlayerAngle) * strafe) * e.speed;

                    e.shootTimer -= dt;
                    if (e.shootTimer <= 0 && dToPlayer < 650) {
                        e.shootTimer = rand(1.8, 2.6);
                        sound.playEnemyShoot();
                        enemyBullets.push({
                            x: e.x + Math.cos(toPlayerAngle) * e.radius,
                            y: e.y + Math.sin(toPlayerAngle) * e.radius,
                            vx: Math.cos(toPlayerAngle) * 330,
                            vy: Math.sin(toPlayerAngle) * 330,
                            radius: 6, damage: 14, color: '#b829ff'
                        });
                    }
                } else if (e.type === 'boss') {
                    e.angle += dt * 1.5;
                    e.vx = Math.cos(toPlayerAngle) * e.speed;
                    e.vy = Math.sin(toPlayerAngle) * e.speed;

                    e.shootTimer -= dt;
                    if (e.shootTimer <= 0) {
                        e.shootTimer = 1.45;
                        sound.playEnemyShoot();
                        const shots = 8;
                        for (let s = 0; s < shots; s++) {
                            const a = e.angle + (s * Math.PI * 2) / shots;
                            enemyBullets.push({
                                x: e.x + Math.cos(a) * e.radius,
                                y: e.y + Math.sin(a) * e.radius,
                                vx: Math.cos(a) * 310,
                                vy: Math.sin(a) * 310,
                                radius: 7, damage: 18, color: '#ff2a2a'
                            });
                        }
                    }
                }

                for (let j = 0; j < enemies.length; j++) {
                    if (i === j) continue;
                    const other = enemies[j];
                    const d = dist(e.x, e.y, other.x, other.y);
                    const minSep = e.radius + other.radius + 4;
                    if (d > 0 && d < minSep) {
                        const push = (minSep - d) / minSep;
                        e.vx += ((e.x - other.x) / d) * push * 140;
                        e.vy += ((e.y - other.y) / d) * push * 140;
                    }
                }

                e.x += e.vx * dt;
                e.y += e.vy * dt;

                if (dist(e.x, e.y, player.x, player.y) < e.radius + player.radius - 2) {
                    hurtPlayer(e.type === 'boss' ? 25 : 15);
                }
            }

            // Вражеские пули
            for (let i = enemyBullets.length - 1; i >= 0; i--) {
                const eb = enemyBullets[i];
                eb.x += eb.vx * dt;
                eb.y += eb.vy * dt;

                if (eb.x < -30 || eb.x > width + 30 || eb.y < -30 || eb.y > height + 30) {
                    enemyBullets.splice(i, 1);
                    continue;
                }

                if (dist(eb.x, eb.y, player.x, player.y) < eb.radius + player.radius - 3) {
                    hurtPlayer(eb.damage);
                    spawnParticles(eb.x, eb.y, eb.color, 8, 40, 140, 3);
                    enemyBullets.splice(i, 1);
                }
            }

            // Кристаллы опыта
            for (let i = crystals.length - 1; i >= 0; i--) {
                const c = crystals[i];
                c.pulse += dt * 6;
                c.vx *= 0.92;
                c.vy *= 0.92;

                const d = dist(c.x, c.y, player.x, player.y);
                if (d < player.magnetRadius) {
                    const pullAngle = Math.atan2(player.y - c.y, player.x - c.x);
                    const pullSpeed = 580 * (1 - d / player.magnetRadius) + 220;
                    c.vx = Math.cos(pullAngle) * pullSpeed;
                    c.vy = Math.sin(pullAngle) * pullSpeed;
                }

                c.x += c.vx * dt;
                c.y += c.vy * dt;

                if (d < player.radius + c.size + 6) {
                    crystalsCollected++;
                    gainXp(c.xp);
                    score += Math.round(10 * combo);
                    sound.playPickup(combo);
                    crystals.splice(i, 1);
                }
            }

            updateVisualEffects(dt);

            hudSyncTimer += dt;
            const hudInterval = userSettings.lowPerfMode ? 0.08 : 0.033;
            if (hudSyncTimer >= hudInterval) {
                hudSyncTimer = 0;
                updateHUD();
                renderRadar();
            }
        }

        function updateVisualEffects(dt) {
            for (let i = particles.length - 1; i >= 0; i--) {
                const p = particles[i];
                p.vx *= p.drag;
                p.vy *= p.drag;
                p.x += p.vx * dt;
                p.y += p.vy * dt;
                p.life -= dt;
                if (p.life <= 0) particles.splice(i, 1);
            }
            for (let i = shockwaves.length - 1; i >= 0; i--) {
                const s = shockwaves[i];
                s.life -= dt;
                const progress = 1 - Math.max(0, s.life / s.maxLife);
                s.radius = 8 + (s.maxRadius - 8) * (1 - Math.pow(1 - progress, 3));
                if (s.life <= 0) shockwaves.splice(i, 1);
            }
            for (let i = lightningArcs.length - 1; i >= 0; i--) {
                lightningArcs[i].life -= dt;
                if (lightningArcs[i].life <= 0) lightningArcs.splice(i, 1);
            }
            for (let i = floatingTexts.length - 1; i >= 0; i--) {
                const ft = floatingTexts[i];
                ft.y += ft.vy * dt;
                ft.vy *= 0.94;
                ft.life -= dt;
                if (ft.life <= 0) floatingTexts.splice(i, 1);
            }
        }

        function updateHUD() {
            if (!player) return;
            document.getElementById('hpText').textContent = `${Math.ceil(player.hp)} / ${player.maxHp}`;
            document.getElementById('hpFill').style.width = `${(player.hp / player.maxHp) * 100}%`;

            document.getElementById('lvlText').textContent = `УРОВЕНЬ ${player.level}`;
            document.getElementById('xpText').textContent = `${Math.floor(player.xp)} / ${player.xpToNext} XP`;
            document.getElementById('xpFill').style.width = `${Math.min(100, (player.xp / player.xpToNext) * 100)}%`;

            document.getElementById('survivalTimer').textContent = formatTime(survivalSeconds);

            const dashRatio = player.dashCooldown > 0 ? 1 - (player.dashTimer / player.dashCooldown) : 1;
            document.getElementById('dashFill').style.width = `${Math.max(0, Math.min(100, dashRatio * 100))}%`;
            const dashTxt = document.getElementById('dashText');
            dashTxt.textContent = player.dashTimer <= 0 ? 'ГОТОВ' : `${player.dashTimer.toFixed(1)}С`;
            dashTxt.style.color = player.dashTimer <= 0 ? 'var(--neon-green)' : 'var(--neon-yellow)';

            document.getElementById('scoreText').textContent = score.toLocaleString('ru-RU');
            document.getElementById('comboText').textContent = `x${combo.toFixed(1)}`;
            document.getElementById('comboTimerFill').style.width = `${Math.max(0, (comboTimer / MAX_COMBO_TIME) * 100)}%`;
        }

        function renderRadar() {
            if (!player) return;
            const rw = 112, rh = 112;
            const cx = rw / 2, cy = rh / 2;
            const radarRange = 950;

            radarCtx.clearRect(0, 0, rw, rh);

            radarCtx.strokeStyle = 'rgba(0, 243, 255, 0.2)';
            radarCtx.lineWidth = 1;
            radarCtx.beginPath();
            radarCtx.arc(cx, cy, 48, 0, Math.PI * 2);
            radarCtx.stroke();
            radarCtx.beginPath();
            radarCtx.arc(cx, cy, 24, 0, Math.PI * 2);
            radarCtx.stroke();

            for (const e of enemies) {
                const dx = (e.x - player.x) / radarRange;
                const dy = (e.y - player.y) / radarRange;
                const distNorm = Math.hypot(dx, dy);
                const clampedDist = Math.min(1, distNorm);
                const angle = Math.atan2(dy, dx);

                const rx = cx + Math.cos(angle) * clampedDist * 48;
                const ry = cy + Math.sin(angle) * clampedDist * 48;

                radarCtx.fillStyle = e.color;
                radarCtx.beginPath();
                radarCtx.arc(rx, ry, e.type === 'boss' ? 4.5 : 2.3, 0, Math.PI * 2);
                radarCtx.fill();
            }

            radarCtx.fillStyle = '#ffffff';
            radarCtx.beginPath();
            radarCtx.arc(cx, cy, 3, 0, Math.PI * 2);
            radarCtx.fill();
        }

        // --- 17. ОТРИСОВКА ГЛАВНОГО CANVAS ---
        function drawPolygon(x, y, radius, sides, rotation, color, fillAlpha = 0.18, lineWidth = 2.5, glow = 12) {
            ctx.save();
            ctx.translate(x, y);
            ctx.rotate(rotation);
            ctx.beginPath();
            for (let i = 0; i < sides; i++) {
                const a = (i * Math.PI * 2) / sides;
                const px = Math.cos(a) * radius;
                const py = Math.sin(a) * radius;
                if (i === 0) ctx.moveTo(px, py);
                else ctx.lineTo(px, py);
            }
            ctx.closePath();

            ctx.fillStyle = color;
            ctx.globalAlpha = fillAlpha;
            ctx.fill();

            ctx.globalAlpha = 1;
            ctx.strokeStyle = color;
            ctx.lineWidth = lineWidth;
            if (!userSettings.lowPerfMode && glow > 0) {
                ctx.shadowColor = color;
                ctx.shadowBlur = glow;
            }
            ctx.stroke();
            ctx.restore();
        }

        function drawGrid() {
            ctx.save();
            ctx.strokeStyle = 'rgba(0, 243, 255, 0.065)';
            ctx.lineWidth = 1;
            const step = userSettings.lowPerfMode ? 80 : 50;
            const offset = bgGridOffset % step;

            ctx.beginPath();
            for (let x = offset; x < width; x += step) {
                ctx.moveTo(x, 0);
                ctx.lineTo(x, height);
            }
            for (let y = offset; y < height; y += step) {
                ctx.moveTo(0, y);
                ctx.lineTo(width, y);
            }
            ctx.stroke();

            ctx.strokeStyle = 'rgba(0, 243, 255, 0.35)';
            ctx.lineWidth = 3;
            if (!userSettings.lowPerfMode) {
                ctx.shadowColor = '#00f3ff';
                ctx.shadowBlur = 12;
            }
            ctx.strokeRect(2, 2, width - 4, height - 4);
            ctx.restore();
        }

        function render() {
            ctx.fillStyle = '#05060c';
            ctx.fillRect(0, 0, width, height);

            ctx.save();
            if (shakeTime > 0 && shakeIntensity > 0) {
                ctx.translate(rand(-shakeIntensity, shakeIntensity), rand(-shakeIntensity, shakeIntensity));
            }

            drawGrid();

            if (gameState === STATE.MENU) {
                for (const de of demoEnemies) {
                    let sides = 4;
                    if (de.shape === 'triangle') sides = 3;
                    else if (de.shape === 'hexagon') sides = 6;
                    else if (de.shape === 'octagon') sides = 8;
                    drawPolygon(de.x, de.y, de.radius, sides, de.angle, de.color, 0.14, 2, 0);
                }
            }

            for (const s of shockwaves) {
                const alpha = Math.max(0, s.life / s.maxLife);
                ctx.save();
                ctx.beginPath();
                ctx.arc(s.x, s.y, s.radius, 0, Math.PI * 2);
                ctx.strokeStyle = s.color;
                ctx.globalAlpha = alpha;
                ctx.lineWidth = s.width;
                ctx.stroke();
                ctx.restore();
            }

            for (const c of crystals) {
                const scale = 1 + Math.sin(c.pulse) * 0.2;
                drawPolygon(c.x, c.y, c.size * scale, 4, c.pulse * 0.5, '#00ff88', 0.45, 1.8, 0);
            }

            // Снаряды игрока: короткий хвостик + круглый шар без вытянутой «палки»
            for (const b of bullets) {
                if (b.trail.length > 0) {
                    const tailStart = b.trail[0];
                    const dTail = dist(tailStart.x, tailStart.y, b.x, b.y);
                    if (dTail > 1) {
                        const maxTailLen = Math.min(26, b.radius * 5.2);
                        const ratio = Math.min(1, maxTailLen / dTail);
                        const tx = b.x - (b.x - tailStart.x) * ratio;
                        const ty = b.y - (b.y - tailStart.y) * ratio;

                        ctx.save();
                        ctx.beginPath();
                        ctx.moveTo(tx, ty);
                        ctx.lineTo(b.x, b.y);
                        ctx.strokeStyle = b.color;
                        ctx.globalAlpha = 0.35;
                        ctx.lineWidth = b.radius * 1.1;
                        ctx.lineCap = 'round';
                        ctx.stroke();
                        ctx.restore();
                    }
                }

                ctx.save();
                ctx.beginPath();
                ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
                ctx.fillStyle = '#ffffff';
                if (!userSettings.lowPerfMode) {
                    ctx.shadowColor = b.color;
                    ctx.shadowBlur = 10;
                }
                ctx.fill();
                ctx.restore();
            }

            for (const eb of enemyBullets) {
                ctx.save();
                ctx.beginPath();
                ctx.arc(eb.x, eb.y, eb.radius, 0, Math.PI * 2);
                ctx.fillStyle = eb.color;
                ctx.fill();
                ctx.beginPath();
                ctx.arc(eb.x, eb.y, eb.radius * 0.45, 0, Math.PI * 2);
                ctx.fillStyle = '#ffffff';
                ctx.fill();
                ctx.restore();
            }

            for (const e of enemies) {
                const drawColor = e.hitFlash > 0 ? '#ffffff' : e.color;
                let sides = 4;
                if (e.shape === 'triangle') sides = 3;
                else if (e.shape === 'diamond') sides = 4;
                else if (e.shape === 'hexagon') sides = 6;
                else if (e.shape === 'octagon' || e.shape === 'boss') sides = 8;

                const glow = e.type === 'boss' ? 14 : 6;
                drawPolygon(e.x, e.y, e.radius, sides, e.angle, drawColor, 0.22, e.type === 'boss' ? 4 : 2.5, glow);

                if (e.type === 'boss' || e.type === 'tank') {
                    drawPolygon(e.x, e.y, e.radius * 0.52, 4, -e.angle * 1.5, drawColor, 0.35, 2, 0);
                }

                if (e.hp < e.maxHp) {
                    const barW = e.radius * 2.1;
                    const barH = e.type === 'boss' ? 6 : 4;
                    const bx = e.x - barW / 2;
                    const by = e.y - e.radius - 12;

                    ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
                    ctx.fillRect(bx, by, barW, barH);
                    ctx.fillStyle = e.color;
                    ctx.fillRect(bx, by, barW * Math.max(0, e.hp / e.maxHp), barH);
                }
            }

            for (const arc of lightningArcs) {
                ctx.save();
                ctx.strokeStyle = '#ffe600';
                ctx.lineWidth = 2.5;
                ctx.beginPath();
                ctx.moveTo(arc.x1, arc.y1);
                const midX = (arc.x1 + arc.x2) / 2 + rand(-18, 18);
                const midY = (arc.y1 + arc.y2) / 2 + rand(-18, 18);
                ctx.lineTo(midX, midY);
                ctx.lineTo(arc.x2, arc.y2);
                ctx.stroke();
                ctx.restore();
            }

            if (player && (gameState === STATE.PLAYING || gameState === STATE.UPGRADE || gameState === STATE.PAUSED)) {
                for (const t of player.trail) {
                    drawPlayerShip(t.x, t.y, t.angle, player.color, false, t.alpha);
                }

                const blink = player.invulnTimer > 0 && Math.floor(globalTime * 24) % 2 === 0;
                if (!blink) {
                    drawPlayerShip(player.x, player.y, player.angle, player.color, true, 1);
                }

                if (player.drones > 0) {
                    const orbitR = 54;
                    for (let i = 0; i < player.drones; i++) {
                        const a = player.droneAngle + (i * Math.PI * 2) / player.drones;
                        const dx = player.x + Math.cos(a) * orbitR;
                        const dy = player.y + Math.sin(a) * orbitR;
                        drawPolygon(dx, dy, 8, 3, a * 2, '#00ff88', 0.5, 2, 0);
                    }
                }
            }

            for (const p of particles) {
                const alpha = Math.max(0, p.life / p.maxLife);
                ctx.save();
                ctx.globalAlpha = alpha;
                ctx.fillStyle = p.color;
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
                ctx.fill();
                ctx.restore();
            }

            for (const ft of floatingTexts) {
                const alpha = Math.max(0, ft.life / ft.maxLife);
                ctx.save();
                ctx.globalAlpha = alpha;
                ctx.font = `700 ${ft.size}px var(--font-mono)`;
                ctx.fillStyle = ft.color;
                ctx.textAlign = 'center';
                ctx.fillText(ft.text, ft.x, ft.y);
                ctx.restore();
            }

            ctx.restore();
        }

        function drawPlayerShip(x, y, angle, color, isMain, alpha = 1) {
            ctx.save();
            ctx.globalAlpha = alpha;
            ctx.translate(x, y);
            ctx.rotate(angle);

            ctx.beginPath();
            ctx.moveTo(20, 0);
            ctx.lineTo(-14, -13);
            ctx.lineTo(-8, 0);
            ctx.lineTo(-14, 13);
            ctx.closePath();

            ctx.fillStyle = color;
            ctx.globalAlpha = isMain ? 0.24 : alpha * 0.6;
            ctx.fill();

            ctx.globalAlpha = alpha;
            ctx.strokeStyle = color;
            ctx.lineWidth = 2.6;
            if (isMain && !userSettings.lowPerfMode) {
                ctx.shadowColor = color;
                ctx.shadowBlur = 12;
            }
            ctx.stroke();

            if (isMain) {
                ctx.beginPath();
                ctx.arc(-2, 0, 4, 0, Math.PI * 2);
                ctx.fillStyle = '#ffffff';
                ctx.fill();
            }

            ctx.restore();
        }

        // --- 18. ОБРАБОТЧИКИ СОБЫТИЙ ---
        window.addEventListener('keydown', (e) => {
            keys[e.code] = true;

            if (e.code === 'Escape') {
                e.preventDefault();
                if (gameState === STATE.PLAYING || gameState === STATE.PAUSED) {
                    togglePause();
                } else if (!document.getElementById('codexScreen').classList.contains('hidden') ||
                           !document.getElementById('settingsScreen').classList.contains('hidden')) {
                    hideAllOverlays();
                    document.getElementById('startScreen').classList.remove('hidden');
                }
            }

            if (e.code === 'Space' || e.code === 'ShiftLeft' || e.code === 'ShiftRight') {
                if (gameState === STATE.PLAYING) {
                    e.preventDefault();
                    performDash();
                }
            }

            if (e.code === 'Enter' && gameState === STATE.GAMEOVER) {
                startGame();
            }
        });

        window.addEventListener('keyup', (e) => {
            keys[e.code] = false;
        });

        window.addEventListener('mousemove', (e) => {
            mouse.x = e.clientX;
            mouse.y = e.clientY;
        });

        window.addEventListener('mousedown', (e) => {
            if (e.button === 0) mouse.down = true;
            if (e.button === 2 && gameState === STATE.PLAYING) performDash();
        });

        window.addEventListener('mouseup', (e) => {
            if (e.button === 0) mouse.down = false;
        });

        canvas.addEventListener('contextmenu', (e) => e.preventDefault());

        document.getElementById('startBtn').addEventListener('click', startGame);

        document.getElementById('openCodexBtn').addEventListener('click', () => {
            hideAllOverlays();
            renderCodex('modules');
            document.getElementById('codexScreen').classList.remove('hidden');
        });

        document.getElementById('closeCodexBtn').addEventListener('click', () => {
            hideAllOverlays();
            document.getElementById('startScreen').classList.remove('hidden');
        });

        document.getElementById('tabModulesBtn').addEventListener('click', () => {
            document.getElementById('tabModulesBtn').classList.add('active');
            document.getElementById('tabEnemiesBtn').classList.remove('active');
            renderCodex('modules');
        });

        document.getElementById('tabEnemiesBtn').addEventListener('click', () => {
            document.getElementById('tabEnemiesBtn').classList.add('active');
            document.getElementById('tabModulesBtn').classList.remove('active');
            renderCodex('enemies');
        });

        document.getElementById('openSettingsBtn').addEventListener('click', () => {
            hideAllOverlays();
            syncSettingsUI();
            document.getElementById('settingsScreen').classList.remove('hidden');
        });

        document.getElementById('closeSettingsBtn').addEventListener('click', () => {
            saveSettings();
            hideAllOverlays();
            document.getElementById('startScreen').classList.remove('hidden');
        });

        document.getElementById('sfxVolumeSlider').addEventListener('input', (e) => {
            userSettings.sfxVolume = parseInt(e.target.value, 10) / 100;
            sound.updateVolume();
            syncSettingsUI();
            saveSettings();
        });

        document.getElementById('pauseSfxSlider').addEventListener('input', (e) => {
            userSettings.sfxVolume = parseInt(e.target.value, 10) / 100;
            sound.updateVolume();
            syncSettingsUI();
            saveSettings();
        });

        document.getElementById('shakeIntensitySlider').addEventListener('input', (e) => {
            userSettings.shakeMultiplier = parseInt(e.target.value, 10) / 100;
            syncSettingsUI();
            saveSettings();
        });

        function toggleLowPerf() {
            userSettings.lowPerfMode = !userSettings.lowPerfMode;
            applyPerfModeClass();
            resizeCanvas();
            syncSettingsUI();
            saveSettings();
        }
        document.getElementById('lowPerfToggle').addEventListener('click', toggleLowPerf);
        document.getElementById('pauseLowPerfToggle').addEventListener('click', toggleLowPerf);

        document.getElementById('pauseShakeToggle').addEventListener('click', () => {
            userSettings.shakeMultiplier = userSettings.shakeMultiplier > 0 ? 0 : 1.0;
            syncSettingsUI();
            saveSettings();
        });

        function toggleAutoFire() {
            userSettings.autoFire = !userSettings.autoFire;
            syncSettingsUI();
            saveSettings();
        }
        document.getElementById('autoFireToggle').addEventListener('click', toggleAutoFire);
        document.getElementById('pauseAutoFireToggle').addEventListener('click', toggleAutoFire);

        document.getElementById('damageNumbersToggle').addEventListener('click', () => {
            userSettings.showDamage = !userSettings.showDamage;
            syncSettingsUI();
            saveSettings();
        });

        document.getElementById('hudPauseBtn').addEventListener('click', togglePause);

        document.getElementById('hudSoundBtn').addEventListener('click', () => {
            sound.init();
            const isMuted = sound.toggleMute();
            document.getElementById('hudSoundBtn').textContent = isMuted ? '🔇' : '🔊';
        });

        document.getElementById('resumeBtn').addEventListener('click', resumeGame);
        document.getElementById('pauseRestartBtn').addEventListener('click', startGame);
        document.getElementById('pauseMainMenuBtn').addEventListener('click', returnToMainMenu);

        document.getElementById('restartBtn').addEventListener('click', startGame);
        document.getElementById('overMainMenuBtn').addEventListener('click', returnToMainMenu);

        renderShipSelector();
        updateCareerUI();
        syncSettingsUI();
        initDemoArena();

        let lastTime = performance.now();
        function gameLoop(now) {
            const dt = Math.min(0.05, (now - lastTime) / 1000);
            lastTime = now;

            update(dt);
            render();

            requestAnimationFrame(gameLoop);
        }

        window.onload = () => {
            requestAnimationFrame(gameLoop);
        };