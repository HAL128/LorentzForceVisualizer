// グローバル変数
let particles = [];
let particleIdCounter = 0;
let simulationTime = 0;
let isPlaying = false;
let timeScale = 1.0;
let trailLength = 200;

// 物理パラメータ
let electricField = { magnitude: 0, angle_deg: 0 };
let magneticField = { magnitude: 0, angle_deg: 90 };

// キャンバスとスケール設定
const CANVAS_WIDTH = 900;
const CANVAS_HEIGHT = 700;
const SCALE = 28; // 1m = 28px (元の1600×1200と同じ範囲を表示)

// メジャーツール
let measureMode = false;
let measureStart = null;
let measureEnd = null;
let measuring = false;

// 座標変換
function worldToScreen(x, y) {
    return {
        x: CANVAS_WIDTH / 2 + x * SCALE,
        y: CANVAS_HEIGHT / 2 - y * SCALE
    };
}

function screenToWorld(sx, sy) {
    return {
        x: (sx - CANVAS_WIDTH / 2) / SCALE,
        y: (CANVAS_HEIGHT / 2 - sy) / SCALE
    };
}

class Particle {
    constructor(id, q, m, x, y, vx, vy) {
        this.id = id;
        this.q = q;
        this.m = m;
        this.x = x;
        this.y = y;
        this.vx = vx;
        this.vy = vy;
        this.trail = [];
        this.selected = false;
    }

    // ローレンツ力の計算
    calculateForce(E, B) {
        // 電場から角度に基づいてベクトル成分を計算
        const E_rad = E.angle_deg * Math.PI / 180;
        const Ex = E.magnitude * Math.cos(E_rad);
        const Ey = E.magnitude * Math.sin(E_rad);

        // 磁場の方向を決定
        // angle_deg = 90° → 紙面から出る方向（Out of plane ⊙）→ Bz = +B
        // angle_deg = 270° → 紙面に入る方向（Into plane ⊗）→ Bz = -B
        let Bz;
        if (B.angle_deg === 90) {
            Bz = B.magnitude;  // 紙面から出る（+Z方向）
        } else {
            Bz = -B.magnitude; // 紙面に入る（-Z方向）
        }

        // ローレンツ力: F = q(E + v × B)
        // 右手系: v × B = (vx, vy, 0) × (0, 0, Bz) = (vy*Bz, -vx*Bz, 0)
        // フレミング左手: 電流(v)×磁場(B)=力(F)
        const Fx = this.q * (Ex + this.vy * Bz);
        const Fy = this.q * (Ey - this.vx * Bz);

        return { Fx, Fy };
    }

    // RK4法による時間発展（簡易版）
    update(dt, E, B) {
        // k1
        const f1 = this.calculateForce(E, B);
        const ax1 = f1.Fx / this.m;
        const ay1 = f1.Fy / this.m;

        // k2
        const vx_temp = this.vx + ax1 * dt / 2;
        const vy_temp = this.vy + ay1 * dt / 2;
        const tempParticle = Object.assign({}, this);
        tempParticle.vx = vx_temp;
        tempParticle.vy = vy_temp;
        const f2 = this.calculateForce.call(tempParticle, E, B);
        const ax2 = f2.Fx / this.m;
        const ay2 = f2.Fy / this.m;

        // k3
        const vx_temp2 = this.vx + ax2 * dt / 2;
        const vy_temp2 = this.vy + ay2 * dt / 2;
        tempParticle.vx = vx_temp2;
        tempParticle.vy = vy_temp2;
        const f3 = this.calculateForce.call(tempParticle, E, B);
        const ax3 = f3.Fx / this.m;
        const ay3 = f3.Fy / this.m;

        // k4
        const vx_temp3 = this.vx + ax3 * dt;
        const vy_temp3 = this.vy + ay3 * dt;
        tempParticle.vx = vx_temp3;
        tempParticle.vy = vy_temp3;
        const f4 = this.calculateForce.call(tempParticle, E, B);
        const ax4 = f4.Fx / this.m;
        const ay4 = f4.Fy / this.m;

        // 更新
        const ax = (ax1 + 2 * ax2 + 2 * ax3 + ax4) / 6;
        const ay = (ay1 + 2 * ay2 + 2 * ay3 + ay4) / 6;

        this.vx += ax * dt;
        this.vy += ay * dt;
        this.x += this.vx * dt;
        this.y += this.vy * dt;

        // 軌跡に追加
        this.trail.push({ x: this.x, y: this.y });
        if (this.trail.length > trailLength) {
            this.trail.shift();
        }
    }

    draw() {
        const pos = worldToScreen(this.x, this.y);

        // 軌跡を描画
        if (this.trail.length > 1) {
            for (let i = 1; i < this.trail.length; i++) {
                const alpha = map(i, 0, this.trail.length, 50, 255);
                const p1 = worldToScreen(this.trail[i - 1].x, this.trail[i - 1].y);
                const p2 = worldToScreen(this.trail[i].x, this.trail[i].y);

                stroke(this.q > 0 ? color(255, 0, 0, alpha) : color(0, 0, 255, alpha));
                strokeWeight(2);
                line(p1.x, p1.y, p2.x, p2.y);
            }
        }

        // 粒子を描画
        noStroke();
        if (this.selected) {
            fill(255, 255, 0, 150);
            circle(pos.x, pos.y, 25);
        }

        fill(this.q > 0 ? color(255, 100, 100) : color(100, 100, 255));
        circle(pos.x, pos.y, 15);

        // 速度ベクトルを描画
        const vEnd = worldToScreen(this.x + this.vx * 0.18, this.y + this.vy * 0.18); // 0.3 * 0.6 = 0.18
        stroke(0, 200, 0);
        strokeWeight(2);
        line(pos.x, pos.y, vEnd.x, vEnd.y);

        // 矢印
        push();
        translate(vEnd.x, vEnd.y);
        const angle = atan2(vEnd.y - pos.y, vEnd.x - pos.x);
        rotate(angle);
        fill(0, 200, 0);
        noStroke();
        triangle(0, 0, -8, -4, -8, 4);
        pop();
    }
}

function setup() {
    const canvas = createCanvas(CANVAS_WIDTH, CANVAS_HEIGHT);
    canvas.parent('p5-canvas');
    frameRate(60);
}

function draw() {
    background(240);

    // グリッド描画
    drawGrid();

    // フィールド表示（オプション）
    drawFieldVectors();

    // 粒子の更新と描画
    if (isPlaying) {
        const dt = (1 / 60) * timeScale;
        for (let particle of particles) {
            particle.update(dt, electricField, magneticField);
        }
        simulationTime += dt;
    }

    for (let particle of particles) {
        particle.draw();
    }

    // メジャーツールの描画
    drawMeasureTool();

    // グリッドスケール表示
    drawGridScale();

    // 情報更新
    updateInfo();
}

function drawGrid() {
    stroke(200);
    strokeWeight(1);

    const gridSpacing = SCALE * 0.5; // 1グリッド = 0.5m

    // 中心をグリッドに合わせる
    const centerX = Math.round(CANVAS_WIDTH / 2 / gridSpacing) * gridSpacing;
    const centerY = Math.round(CANVAS_HEIGHT / 2 / gridSpacing) * gridSpacing;

    // 縦線
    for (let x = 0; x <= CANVAS_WIDTH; x += gridSpacing) {
        line(x, 0, x, CANVAS_HEIGHT);
    }

    // 横線
    for (let y = 0; y <= CANVAS_HEIGHT; y += gridSpacing) {
        line(0, y, CANVAS_WIDTH, y);
    }

    // 軸（グリッドに合わせた位置）
    stroke(100);
    strokeWeight(2);
    line(centerX, 0, centerX, CANVAS_HEIGHT); // y軸
    line(0, centerY, CANVAS_WIDTH, centerY); // x軸
}

function drawFieldVectors() {
    // 電場ベクトルを表示（簡略化）
    if (electricField.magnitude > 0) {
        const E_rad = electricField.angle_deg * Math.PI / 180;
        const scale_factor = 12; // 20 * 0.6 = 12

        stroke(255, 165, 0, 150);
        strokeWeight(2);
        fill(255, 165, 0, 150);

        for (let x = 100; x < CANVAS_WIDTH; x += 150) {
            for (let y = 100; y < CANVAS_HEIGHT; y += 150) {
                const dx = Math.cos(E_rad) * electricField.magnitude * scale_factor;
                const dy = -Math.sin(E_rad) * electricField.magnitude * scale_factor;

                push();
                translate(x, y);
                line(0, 0, dx, dy);
                translate(dx, dy);
                rotate(atan2(dy, dx));
                triangle(0, 0, -6, -3, -6, 3);
                pop();
            }
        }
    }

    // 磁場表示（紙面に垂直、○または×で表示）
    if (magneticField.magnitude > 0) {
        const B_rad = magneticField.angle_deg * Math.PI / 180;
        const Bz = magneticField.magnitude * Math.cos(B_rad);

        // 磁場の強度に応じてアルファ値を調整（0で完全に消え、10で最大）
        const maxB = 10.0; // 最大磁場強度（UI上限と同じ）
        const alpha = map(magneticField.magnitude, 0, maxB, 0, 255);

        fill(0, 0, 255, alpha);
        noStroke();
        textSize(20);
        textAlign(CENTER, CENTER);

        for (let x = 100; x < CANVAS_WIDTH; x += 150) {
            for (let y = 100; y < CANVAS_HEIGHT; y += 150) {
                if (Bz > 0) {
                    // 紙面から出る方向（⊙）
                    text('⊙', x, y);
                } else if (Bz < 0) {
                    // 紙面に入る方向（⊗）
                    text('⊗', x, y);
                }
            }
        }
    }
}

function drawMeasureTool() {
    if (measureMode) {
        // メジャーモードのカーソル表示
        cursor(CROSS);

        // 測定線を描画
        if (measureStart && measuring) {
            const currentX = mouseX;
            const currentY = mouseY;

            // 測定線
            stroke(255, 0, 255);
            strokeWeight(2);
            line(measureStart.x, measureStart.y, currentX, currentY);

            // 開始点と終了点のマーク
            fill(255, 0, 255);
            noStroke();
            circle(measureStart.x, measureStart.y, 8);
            circle(currentX, currentY, 8);

            // 距離を計算（ワールド座標で）
            const startWorld = screenToWorld(measureStart.x, measureStart.y);
            const endWorld = screenToWorld(currentX, currentY);
            const distance = Math.sqrt(
                (endWorld.x - startWorld.x) ** 2 + (endWorld.y - startWorld.y) ** 2
            );

            // 距離を表示
            const midX = (measureStart.x + currentX) / 2;
            const midY = (measureStart.y + currentY) / 2;

            fill(255, 255, 255, 200);
            stroke(255, 0, 255);
            strokeWeight(1);
            rect(midX - 50, midY - 20, 100, 30, 5);

            fill(255, 0, 255);
            noStroke();
            textSize(14);
            textAlign(CENTER, CENTER);
            text(`${distance.toFixed(3)} m`, midX, midY);
        }

        // 完成した測定を表示
        if (measureStart && measureEnd && !measuring) {
            stroke(255, 0, 255);
            strokeWeight(2);
            line(measureStart.x, measureStart.y, measureEnd.x, measureEnd.y);

            fill(255, 0, 255);
            noStroke();
            circle(measureStart.x, measureStart.y, 8);
            circle(measureEnd.x, measureEnd.y, 8);

            const startWorld = screenToWorld(measureStart.x, measureStart.y);
            const endWorld = screenToWorld(measureEnd.x, measureEnd.y);
            const distance = Math.sqrt(
                (endWorld.x - startWorld.x) ** 2 + (endWorld.y - startWorld.y) ** 2
            );

            const midX = (measureStart.x + measureEnd.x) / 2;
            const midY = (measureStart.y + measureEnd.y) / 2;

            fill(255, 255, 255, 200);
            stroke(255, 0, 255);
            strokeWeight(1);
            rect(midX - 50, midY - 20, 100, 30, 5);

            fill(255, 0, 255);
            noStroke();
            textSize(14);
            textAlign(CENTER, CENTER);
            text(`${distance.toFixed(3)} m`, midX, midY);
        }
    } else {
        cursor(ARROW);
    }
}

function drawGridScale() {
    // グリッドのスケール情報を右下に表示
    const gridMeters = 0.5; // 1グリッド = 0.5m

    fill(0);
    noStroke();
    textSize(14);
    textAlign(RIGHT, BOTTOM);
    text(`1 grid = ${gridMeters.toFixed(1)} m`, CANVAS_WIDTH - 20, CANVAS_HEIGHT - 10);
}

function mousePressed() {
    if (measureMode) {
        // メジャーモードでのクリック
        if (!measuring) {
            // 測定開始
            measureStart = { x: mouseX, y: mouseY };
            measureEnd = null;
            measuring = true;
        }
    } else {
        // 既存の粒子をクリックして選択
        let clickedParticle = null;
        const worldPos = screenToWorld(mouseX, mouseY);

        for (let particle of particles) {
            const dist = Math.sqrt((particle.x - worldPos.x) ** 2 + (particle.y - worldPos.y) ** 2);
            if (dist < 0.3) {
                clickedParticle = particle;
                break;
            }
        }

        if (clickedParticle) {
            particles.forEach(p => p.selected = false);
            clickedParticle.selected = true;
        }
    }
}

function mouseReleased() {
    if (measureMode && measuring) {
        // 測定終了
        measureEnd = { x: mouseX, y: mouseY };
        measuring = false;
    }
}

function updateInfo() {
    // UI.jsで実装される関数を呼び出し
    if (typeof updateSimulationInfo === 'function') {
        updateSimulationInfo(simulationTime, particles.length);
    }
}

// UI から呼ばれる関数
function addParticle(q, m, vx, vy) {
    const worldPos = screenToWorld(CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2);
    const particle = new Particle(
        `p${particleIdCounter++}`,
        q, m,
        worldPos.x, worldPos.y,
        vx, vy
    );
    particles.push(particle);
}

function clearParticles() {
    particles = [];
    particleIdCounter = 0;
}

function resetSimulation() {
    particles.forEach(p => {
        p.trail = [];
    });
    simulationTime = 0;
}

function togglePlayPause() {
    isPlaying = !isPlaying;
    return isPlaying;
}

function stepSimulation() {
    const dt = (1 / 60) * timeScale;
    for (let particle of particles) {
        particle.update(dt, electricField, magneticField);
    }
    simulationTime += dt;
}

function setTimeScale(scale) {
    timeScale = scale;
}

function setTrailLength(length) {
    trailLength = length;
}

function setElectricField(magnitude, angle_deg) {
    electricField = { magnitude, angle_deg };
}

function setMagneticField(magnitude, angle_deg) {
    magneticField = { magnitude, angle_deg };
}

function toggleMeasureTool() {
    measureMode = !measureMode;
    if (!measureMode) {
        // メジャーモードを終了したら測定をリセット
        measureStart = null;
        measureEnd = null;
        measuring = false;
    }
}
