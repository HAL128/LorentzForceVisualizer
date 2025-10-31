"""
物理計算モジュール
ローレンツ力による荷電粒子の運動を数値的に解く
"""

import numpy as np
from typing import Dict, List, Tuple


class LorentzForceSimulator:
    """ローレンツ力シミュレータ"""

    def __init__(self, E: np.ndarray, B: np.ndarray):
        """
        Args:
            E: 電場ベクトル [Ex, Ey, Ez] (N/C)
            B: 磁場ベクトル [Bx, By, Bz] (T)
        """
        self.E = np.array(E, dtype=float)
        self.B = np.array(B, dtype=float)

    def lorentz_force(self, v: np.ndarray, q: float) -> np.ndarray:
        """
        ローレンツ力を計算
        F = q(E + v × B)

        Args:
            v: 速度ベクトル [vx, vy, vz] (m/s)
            q: 電荷 (C)

        Returns:
            力ベクトル [Fx, Fy, Fz] (N)
        """
        v_cross_B = np.cross(v, self.B)
        return q * (self.E + v_cross_B)

    def equations_of_motion(self, state: np.ndarray, q: float, m: float) -> np.ndarray:
        """
        運動方程式
        state = [x, y, z, vx, vy, vz]
        d(state)/dt = [vx, vy, vz, ax, ay, az]

        Args:
            state: 状態ベクトル [x, y, z, vx, vy, vz]
            q: 電荷 (C)
            m: 質量 (kg)

        Returns:
            状態の時間微分 [vx, vy, vz, ax, ay, az]
        """
        pos = state[:3]
        vel = state[3:]

        force = self.lorentz_force(vel, q)
        acc = force / m

        return np.concatenate([vel, acc])

    def rk4_step(self, state: np.ndarray, dt: float, q: float, m: float) -> np.ndarray:
        """
        4次ルンゲ＝クッタ法による1ステップ

        Args:
            state: 現在の状態 [x, y, z, vx, vy, vz]
            dt: 時間刻み (s)
            q: 電荷 (C)
            m: 質量 (kg)

        Returns:
            次の状態 [x, y, z, vx, vy, vz]
        """
        k1 = self.equations_of_motion(state, q, m)
        k2 = self.equations_of_motion(state + 0.5 * dt * k1, q, m)
        k3 = self.equations_of_motion(state + 0.5 * dt * k2, q, m)
        k4 = self.equations_of_motion(state + dt * k3, q, m)

        return state + (dt / 6.0) * (k1 + 2 * k2 + 2 * k3 + k4)

    def euler_step(self, state: np.ndarray, dt: float, q: float, m: float) -> np.ndarray:
        """
        オイラー法による1ステップ（精度は低いが高速）

        Args:
            state: 現在の状態 [x, y, z, vx, vy, vz]
            dt: 時間刻み (s)
            q: 電荷 (C)
            m: 質量 (kg)

        Returns:
            次の状態 [x, y, z, vx, vy, vz]
        """
        derivative = self.equations_of_motion(state, q, m)
        return state + dt * derivative

    def simulate_particle(
        self,
        initial_state: np.ndarray,
        q: float,
        m: float,
        t0: float,
        t_final: float,
        dt: float,
        integrator: str = 'RK4'
    ) -> Tuple[np.ndarray, np.ndarray]:
        """
        1つの粒子の運動をシミュレート

        Args:
            initial_state: 初期状態 [x, y, z, vx, vy, vz]
            q: 電荷 (C)
            m: 質量 (kg)
            t0: 開始時刻 (s)
            t_final: 終了時刻 (s)
            dt: 時間刻み (s)
            integrator: 積分法 ('RK4' or 'Euler')

        Returns:
            times: 時刻の配列
            states: 状態の配列 (shape: [n_steps, 6])
        """
        times = np.arange(t0, t_final + dt, dt)
        n_steps = len(times)
        states = np.zeros((n_steps, 6))
        states[0] = initial_state

        step_function = self.rk4_step if integrator == 'RK4' else self.euler_step

        for i in range(1, n_steps):
            states[i] = step_function(states[i - 1], dt, q, m)

        return times, states


def simulate_multiple_particles(
    fields: Dict,
    particles: List[Dict],
    t0: float,
    t_final: float,
    dt: float,
    integrator: str = 'RK4'
) -> Dict:
    """
    複数の粒子をシミュレート

    Args:
        fields: フィールド情報 {'E': {'magnitude': ..., 'angle_deg': ...}, 'B': {...}}
        particles: 粒子のリスト [{'id': ..., 'q': ..., 'm': ..., 'x': ..., ...}, ...]
        t0: 開始時刻
        t_final: 終了時刻
        dt: 時間刻み
        integrator: 積分法

    Returns:
        シミュレーション結果
    """
    # 電場・磁場をベクトルに変換（2D -> 3D）
    E_mag = fields['E']['magnitude']
    E_angle = np.deg2rad(fields['E']['angle_deg'])
    E = np.array([E_mag * np.cos(E_angle), E_mag * np.sin(E_angle), 0.0])

    B_mag = fields['B']['magnitude']
    B_angle = np.deg2rad(fields['B']['angle_deg'])
    # 2Dシミュレーションでは磁場は紙面に垂直（z方向）
    Bz = B_mag * np.cos(B_angle)
    B = np.array([0.0, 0.0, Bz])

    simulator = LorentzForceSimulator(E, B)

    results = {
        'meta': {
            't0': t0,
            't_final': t_final,
            'dt': dt,
            'integrator': integrator
        },
        'data': {
            'times': None,
            'particles': {}
        }
    }

    for particle in particles:
        initial_state = np.array([
            particle['x'],
            particle['y'],
            0.0,  # z=0 (2Dシミュレーション)
            particle['vx'],
            particle['vy'],
            0.0   # vz=0
        ])

        times, states = simulator.simulate_particle(
            initial_state,
            particle['q'],
            particle['m'],
            t0,
            t_final,
            dt,
            integrator
        )

        if results['data']['times'] is None:
            results['data']['times'] = times.tolist()

        # 加速度も計算
        accelerations = []
        for state in states:
            acc = simulator.lorentz_force(state[3:], particle['q']) / particle['m']
            accelerations.append(acc)
        accelerations = np.array(accelerations)

        results['data']['particles'][particle['id']] = {
            'x': states[:, 0].tolist(),
            'y': states[:, 1].tolist(),
            'z': states[:, 2].tolist(),
            'vx': states[:, 3].tolist(),
            'vy': states[:, 4].tolist(),
            'vz': states[:, 5].tolist(),
            'ax': accelerations[:, 0].tolist(),
            'ay': accelerations[:, 1].tolist(),
            'az': accelerations[:, 2].tolist()
        }

    return results


def validate_circular_motion(q: float, m: float, v: float, B: float, radius: float, tolerance: float = 0.01) -> bool:
    """
    円運動の半径を検証
    r = mv / (qB)

    Args:
        q: 電荷
        m: 質量
        v: 速さ
        B: 磁場の強さ
        radius: 測定された半径
        tolerance: 許容誤差

    Returns:
        検証結果
    """
    if q == 0 or B == 0:
        return False

    expected_radius = (m * v) / (abs(q) * B)
    relative_error = abs(radius - expected_radius) / expected_radius

    return relative_error < tolerance


def calculate_kinetic_energy(m: float, vx: float, vy: float, vz: float = 0.0) -> float:
    """
    運動エネルギーを計算
    KE = (1/2) m v²

    Args:
        m: 質量
        vx, vy, vz: 速度成分

    Returns:
        運動エネルギー
    """
    v_squared = vx**2 + vy**2 + vz**2
    return 0.5 * m * v_squared
