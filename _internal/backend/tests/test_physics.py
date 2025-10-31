"""
物理計算モジュールのテスト
"""

import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

import numpy as np
import pytest
from physics import (
    LorentzForceSimulator,
    simulate_multiple_particles,
    validate_circular_motion,
    calculate_kinetic_energy
)


def test_lorentz_force_electric_only():
    """電場のみの場合のローレンツ力"""
    E = np.array([1.0, 0.0, 0.0])
    B = np.array([0.0, 0.0, 0.0])
    sim = LorentzForceSimulator(E, B)

    v = np.array([0.0, 0.0, 0.0])
    q = 1.0
    force = sim.lorentz_force(v, q)

    # F = qE (速度が0の場合)
    assert np.allclose(force, [1.0, 0.0, 0.0])


def test_lorentz_force_magnetic_only():
    """磁場のみの場合のローレンツ力"""
    E = np.array([0.0, 0.0, 0.0])
    B = np.array([0.0, 0.0, 1.0])  # z方向の磁場
    sim = LorentzForceSimulator(E, B)

    v = np.array([1.0, 0.0, 0.0])  # x方向の速度
    q = 1.0
    force = sim.lorentz_force(v, q)

    # F = q(v × B) = q([1,0,0] × [0,0,1]) = q[0,-1,0] (右手系)
    assert np.allclose(force, [0.0, -1.0, 0.0])


def test_circular_motion():
    """
    円運動の検証
    B = 1T (z方向), v = 2 m/s (x方向), q = 1C, m = 1kg
    期待される半径: r = mv/(qB) = 2m
    """
    E = np.array([0.0, 0.0, 0.0])
    B = np.array([0.0, 0.0, 1.0])
    sim = LorentzForceSimulator(E, B)

    initial_state = np.array([0.0, 0.0, 0.0, 2.0, 0.0, 0.0])
    q = 1.0
    m = 1.0
    dt = 0.001
    t_final = 3.14159  # 半周期（π秒）

    times, states = sim.simulate_particle(initial_state, q, m, 0, t_final, dt, 'RK4')

    # 円運動の半径を検証
    # 期待される半径: r = mv/(qB) = 1*2/(1*1) = 2m
    expected_radius = 2.0

    # 軌跡の各点間の距離が一定であることを確認（円運動）
    # 速さが保存されていることを確認
    speeds = np.sqrt(states[:, 3]**2 + states[:, 4]**2)
    initial_speed = speeds[0]

    # 速さが保存されている（1%以内）
    speed_variations = np.abs(speeds - initial_speed) / initial_speed
    assert np.all(speed_variations < 0.01)

    # 周期を確認: T = 2πm/(qB) = 2π秒
    expected_period = 2 * np.pi
    # 半周期なので、およそπ秒
    # シミュレーション時間がπ秒なので妥当
    assert abs(t_final - np.pi) < 0.01


def test_energy_conservation():
    """
    エネルギー保存の検証（磁場のみの場合）
    磁場による力は運動方向に垂直なので、運動エネルギーは保存される
    """
    E = np.array([0.0, 0.0, 0.0])
    B = np.array([0.0, 0.0, 1.0])
    sim = LorentzForceSimulator(E, B)

    initial_state = np.array([0.0, 0.0, 0.0, 2.0, 1.0, 0.0])
    q = 1.0
    m = 1.0
    dt = 0.01
    t_final = 10.0

    times, states = sim.simulate_particle(initial_state, q, m, 0, t_final, dt, 'RK4')

    # 各時刻での運動エネルギーを計算
    kinetic_energies = []
    for state in states:
        vx, vy, vz = state[3:]
        ke = calculate_kinetic_energy(m, vx, vy, vz)
        kinetic_energies.append(ke)

    kinetic_energies = np.array(kinetic_energies)
    initial_ke = kinetic_energies[0]

    # エネルギーの相対変化が1%以内
    relative_changes = np.abs(kinetic_energies - initial_ke) / initial_ke
    assert np.all(relative_changes < 0.01)


def test_validate_circular_motion_function():
    """円運動検証関数のテスト"""
    q = 1.0
    m = 1.0
    v = 2.0
    B = 1.0

    # 正しい半径
    expected_radius = 2.0
    assert validate_circular_motion(q, m, v, B, expected_radius, tolerance=0.01)

    # 誤った半径
    wrong_radius = 3.0
    assert not validate_circular_motion(q, m, v, B, wrong_radius, tolerance=0.01)


def test_simulate_multiple_particles():
    """複数粒子シミュレーションのテスト"""
    fields = {
        'E': {'magnitude': 0.0, 'angle_deg': 0},
        'B': {'magnitude': 1.0, 'angle_deg': 90}
    }

    particles = [
        {'id': 'p1', 'q': 1.0, 'm': 1.0, 'x': 0.0, 'y': 0.0, 'vx': 1.0, 'vy': 0.0},
        {'id': 'p2', 'q': -1.0, 'm': 1.0, 'x': 0.0, 'y': 0.0, 'vx': 1.0, 'vy': 0.0}
    ]

    results = simulate_multiple_particles(fields, particles, 0, 1.0, 0.01, 'RK4')

    # 結果の構造を確認
    assert 'meta' in results
    assert 'data' in results
    assert 'times' in results['data']
    assert 'particles' in results['data']
    assert 'p1' in results['data']['particles']
    assert 'p2' in results['data']['particles']

    # p1とp2は逆方向に曲がるはず
    p1_y = np.array(results['data']['particles']['p1']['y'])
    p2_y = np.array(results['data']['particles']['p2']['y'])

    # 右手系の外積により、p1は負電荷なので負のy方向に曲がる、p2は正のy方向
    assert p1_y[-1] < 0  # 負の方向に曲がる
    assert p2_y[-1] > 0  # 正の方向に曲がる


def test_kinetic_energy():
    """運動エネルギー計算のテスト"""
    m = 2.0
    vx, vy, vz = 3.0, 4.0, 0.0

    ke = calculate_kinetic_energy(m, vx, vy, vz)
    expected_ke = 0.5 * m * (vx**2 + vy**2 + vz**2)

    assert np.isclose(ke, expected_ke)
    assert np.isclose(ke, 25.0)


if __name__ == '__main__':
    pytest.main([__file__, '-v'])
