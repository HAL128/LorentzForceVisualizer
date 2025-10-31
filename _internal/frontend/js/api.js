// API通信モジュール
const API_BASE_URL = 'http://localhost:5000';

// シミュレーションをバックエンドで実行
async function runSimulation(fields, particles, t0, t_final, dt, integrator = 'RK4') {
    const requestBody = {
        fields: fields,
        particles: particles,
        t0: t0,
        t_final: t_final,
        dt: dt,
        integrator: integrator
    };

    try {
        const response = await fetch(`${API_BASE_URL}/simulate`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        return data;
    } catch (error) {
        console.error('API Error:', error);
        return null;
    }
}

// バックエンドのヘルスチェック
async function checkBackendHealth() {
    try {
        const response = await fetch(`${API_BASE_URL}/health`);
        return response.ok;
    } catch (error) {
        console.error('Backend is not available:', error);
        return false;
    }
}

// シミュレーション結果をパーティクルに適用
function applySimulationResults(results) {
    if (!results || !results.data) {
        console.error('Invalid simulation results');
        return;
    }

    const { times, particles: particleData } = results.data;

    // 各粒子のデータを更新
    for (let particleId in particleData) {
        const particle = particles.find(p => p.id === particleId);
        if (particle) {
            const data = particleData[particleId];
            // 最新の状態を適用
            const lastIndex = data.x.length - 1;
            particle.x = data.x[lastIndex];
            particle.y = data.y[lastIndex];
            particle.vx = data.vx[lastIndex];
            particle.vy = data.vy[lastIndex];

            // 軌跡を更新
            particle.trail = [];
            for (let i = 0; i < data.x.length; i++) {
                particle.trail.push({ x: data.x[i], y: data.y[i] });
            }
        }
    }
}

// シミュレーションをバックエンドで長時間実行（オプション機能）
async function runLongSimulation() {
    const isHealthy = await checkBackendHealth();
    if (!isHealthy) {
        console.warn('Backend is not available. Using frontend calculation.');
        return;
    }

    const fields = {
        E: { magnitude: electricField.magnitude, angle_deg: electricField.angle_deg },
        B: { magnitude: magneticField.magnitude, angle_deg: magneticField.angle_deg }
    };

    const particlesData = particles.map(p => ({
        id: p.id,
        q: p.q,
        m: p.m,
        x: p.x,
        y: p.y,
        vx: p.vx,
        vy: p.vy
    }));

    const results = await runSimulation(fields, particlesData, 0, 10, 0.01);
    if (results) {
        applySimulationResults(results);
        console.log('Simulation completed using backend');
    }
}

// WebSocket接続（将来の拡張用）
class SimulationWebSocket {
    constructor(url) {
        this.url = url;
        this.ws = null;
        this.isConnected = false;
    }

    connect() {
        this.ws = new WebSocket(this.url);

        this.ws.onopen = () => {
            console.log('WebSocket connected');
            this.isConnected = true;
        };

        this.ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            this.handleMessage(data);
        };

        this.ws.onerror = (error) => {
            console.error('WebSocket error:', error);
        };

        this.ws.onclose = () => {
            console.log('WebSocket disconnected');
            this.isConnected = false;
        };
    }

    send(data) {
        if (this.isConnected) {
            this.ws.send(JSON.stringify(data));
        } else {
            console.error('WebSocket is not connected');
        }
    }

    handleMessage(data) {
        // メッセージ処理のロジック
        console.log('Received:', data);
    }

    disconnect() {
        if (this.ws) {
            this.ws.close();
        }
    }
}

// エクスポート（シーンの保存）
function exportScene() {
    const scene = {
        fields: {
            E: electricField,
            B: magneticField
        },
        particles: particles.map(p => ({
            id: p.id,
            q: p.q,
            m: p.m,
            x: p.x,
            y: p.y,
            vx: p.vx,
            vy: p.vy
        })),
        simulationTime: simulationTime,
        timeScale: timeScale,
        trailLength: trailLength
    };

    const json = JSON.stringify(scene, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'lorentz_simulation.json';
    a.click();
    URL.revokeObjectURL(url);
}

// インポート（シーンの読み込み）
function importScene(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const scene = JSON.parse(e.target.result);

            // フィールドを設定
            setElectricField(scene.fields.E.magnitude, scene.fields.E.angle_deg);
            setMagneticField(scene.fields.B.magnitude, scene.fields.B.angle_deg);

            // パーティクルをクリアして再作成
            clearParticles();
            scene.particles.forEach(pData => {
                const particle = new Particle(
                    pData.id,
                    pData.q,
                    pData.m,
                    pData.x,
                    pData.y,
                    pData.vx,
                    pData.vy
                );
                particles.push(particle);
            });

            // その他のパラメータ
            simulationTime = scene.simulationTime || 0;
            setTimeScale(scene.timeScale || 1.0);
            setTrailLength(scene.trailLength || 200);

            console.log('Scene loaded successfully');
        } catch (error) {
            console.error('Failed to load scene:', error);
            alert('シーンの読み込みに失敗しました');
        }
    };
    reader.readAsText(file);
}
