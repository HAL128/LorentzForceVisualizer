// UI初期化
document.addEventListener('DOMContentLoaded', () => {
    initializeControls();
});

function initializeControls() {
    // スライダーのイベントリスナー
    const eMagnitude = document.getElementById('e-magnitude');
    const eMagnitudeValue = document.getElementById('e-magnitude-value');
    const eAngle = document.getElementById('e-angle');
    const eAngleValue = document.getElementById('e-angle-value');

    const bMagnitude = document.getElementById('b-magnitude');
    const bMagnitudeValue = document.getElementById('b-magnitude-value');
    const bDirectionRadios = document.getElementsByName('b-direction');

    const trailLengthSlider = document.getElementById('trail-length');
    const trailLengthValue = document.getElementById('trail-length-value');

    // 電場スライダー
    eMagnitude.addEventListener('input', (e) => {
        const value = parseFloat(e.target.value);
        eMagnitudeValue.textContent = value.toFixed(1);
        setElectricField(value, parseFloat(eAngle.value));
    });

    eAngle.addEventListener('input', (e) => {
        const value = parseInt(e.target.value);
        eAngleValue.textContent = value;
        setElectricField(parseFloat(eMagnitude.value), value);
    });

    // Helper function to get B direction angle
    function getBDirectionAngle() {
        const selected = Array.from(bDirectionRadios).find(r => r.checked);
        return selected && selected.value === 'in' ? 270 : 90; // into=-Z (270°), out=+Z (90°)
    }

    // 磁場スライダー
    bMagnitude.addEventListener('input', (e) => {
        const value = parseFloat(e.target.value);
        bMagnitudeValue.textContent = value.toFixed(1);
        setMagneticField(value, getBDirectionAngle());
    });

    // 磁場方向ラジオボタン
    bDirectionRadios.forEach(radio => {
        radio.addEventListener('change', () => {
            setMagneticField(parseFloat(bMagnitude.value), getBDirectionAngle());
        });
    });

    // 軌跡の長さスライダー
    trailLengthSlider.addEventListener('input', (e) => {
        const value = parseInt(e.target.value);
        if (value === 1000) {
            trailLengthValue.textContent = 'Full';
            setTrailLength(Infinity); // 無限の軌跡
        } else {
            trailLengthValue.textContent = value;
            setTrailLength(value);
        }
    });

    // ボタンのイベントリスナー
    document.getElementById('add-particle').addEventListener('click', () => {
        const q = parseFloat(document.getElementById('particle-charge').value);
        const m = parseFloat(document.getElementById('particle-mass').value);
        const vx = parseFloat(document.getElementById('particle-vx').value);
        const vy = parseFloat(document.getElementById('particle-vy').value);

        if (isNaN(q) || isNaN(m) || isNaN(vx) || isNaN(vy)) {
            alert('Please enter valid numbers for all parameters');
            return;
        }

        if (m <= 0) {
            alert('Mass must be a positive value');
            return;
        }

        addParticle(q, m, vx, vy);
    });

    document.getElementById('play-pause').addEventListener('click', () => {
        const playing = togglePlayPause();
        const btn = document.getElementById('play-pause');
        btn.textContent = playing ? 'Pause' : 'Play';
        if (playing) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });

    document.getElementById('step').addEventListener('click', () => {
        stepSimulation();
    });

    document.getElementById('reset').addEventListener('click', () => {
        resetAllValues();
    });

    document.getElementById('clear').addEventListener('click', () => {
        clearParticles();
    });

    document.getElementById('measure-tool').addEventListener('click', () => {
        toggleMeasureTool();
        const btn = document.getElementById('measure-tool');
        btn.style.backgroundColor = measureMode ? '#667eea' : '';
        btn.style.color = measureMode ? '#fff' : '';
    });

    // キーボードショートカット
    document.addEventListener('keydown', (e) => {
        switch(e.key) {
            case ' ':
                e.preventDefault();
                const playing = togglePlayPause();
                const btn = document.getElementById('play-pause');
                btn.textContent = playing ? 'Pause' : 'Play';
                if (playing) {
                    btn.classList.add('active');
                } else {
                    btn.classList.remove('active');
                }
                break;
            case 'r':
            case 'R':
                resetAllValues();
                break;
            case 'c':
            case 'C':
                if (e.ctrlKey || e.metaKey) {
                    break; // Don't interfere with copy operation
                }
                clearParticles();
                break;
        }
    });

    // 初期フィールド設定
    setElectricField(parseFloat(eMagnitude.value), parseFloat(eAngle.value));
    setMagneticField(parseFloat(bMagnitude.value), getBDirectionAngle());
}

// Reset all values to initial state
function resetAllValues() {
    // Electric Field
    document.getElementById('e-magnitude').value = 0;
    document.getElementById('e-magnitude-value').textContent = '0.0';
    document.getElementById('e-angle').value = 0;
    document.getElementById('e-angle-value').textContent = '0';
    setElectricField(0, 0);

    // Magnetic Field
    document.getElementById('b-magnitude').value = 0;
    document.getElementById('b-magnitude-value').textContent = '0.0';
    const outRadio = document.querySelector('input[name="b-direction"][value="out"]');
    if (outRadio) outRadio.checked = true;
    setMagneticField(0, 90);

    // Particle Parameters
    document.getElementById('particle-charge').value = 1.0;
    document.getElementById('particle-mass').value = 1.0;
    document.getElementById('particle-vx').value = 1.0;
    document.getElementById('particle-vy').value = 0.0;

    // Trail Length
    document.getElementById('trail-length').value = 200;
    document.getElementById('trail-length-value').textContent = '200';
    setTrailLength(200);

    // Clear particles and reset simulation
    clearParticles();
    resetSimulation();
}

// Update simulation info (情報表示は削除されたため、空の関数)
function updateSimulationInfo(time, particleCount) {
    // Information section removed - no action needed
}

// Display selected particle info (情報表示は削除されたため、空の関数)
function updateSelectedParticleInfo(particle) {
    // Information section removed - no action needed
}

// プリセット機能（オプション）
function loadPreset(presetName) {
    clearParticles();
    resetSimulation();

    switch(presetName) {
        case 'circular':
            // 円運動のプリセット
            document.getElementById('e-magnitude').value = 0;
            document.getElementById('b-magnitude').value = 1.0;
            document.getElementById('b-angle').value = 90;
            setElectricField(0, 0);
            setMagneticField(1.0, 90);
            addParticle(1.0, 1.0, 2.0, 0.0);
            break;

        case 'drift':
            // ドリフト運動のプリセット
            document.getElementById('e-magnitude').value = 1.0;
            document.getElementById('e-angle').value = 0;
            document.getElementById('b-magnitude').value = 1.0;
            document.getElementById('b-angle').value = 90;
            setElectricField(1.0, 0);
            setMagneticField(1.0, 90);
            addParticle(1.0, 1.0, 0.0, 0.0);
            break;

        case 'helix':
            // らせん運動のプリセット（電場と磁場が並行）
            document.getElementById('e-magnitude').value = 0.5;
            document.getElementById('e-angle').value = 90;
            document.getElementById('b-magnitude').value = 1.0;
            document.getElementById('b-angle').value = 90;
            setElectricField(0.5, 90);
            setMagneticField(1.0, 90);
            addParticle(1.0, 1.0, 2.0, 0.0);
            break;
    }

    // スライダー表示を更新
    document.querySelectorAll('input[type="range"]').forEach(slider => {
        slider.dispatchEvent(new Event('input'));
    });
}
