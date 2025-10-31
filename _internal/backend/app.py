"""
Flask バックエンドアプリケーション
ローレンツ力シミュレーションのREST API
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
from pydantic import BaseModel, Field, ValidationError
from typing import List, Dict, Optional
import traceback

from physics import simulate_multiple_particles, validate_circular_motion, calculate_kinetic_energy


app = Flask(__name__)
CORS(app)  # フロントエンドからのリクエストを許可


# Pydantic モデル（バリデーション用）
class FieldParams(BaseModel):
    magnitude: float = Field(..., ge=0, description="場の強さ")
    angle_deg: float = Field(..., ge=0, le=360, description="場の角度（度）")


class Fields(BaseModel):
    E: FieldParams
    B: FieldParams


class Particle(BaseModel):
    id: str
    q: float = Field(..., description="電荷 (C)")
    m: float = Field(..., gt=0, description="質量 (kg)")
    x: float = Field(..., description="初期位置 x (m)")
    y: float = Field(..., description="初期位置 y (m)")
    vx: float = Field(..., description="初速度 vx (m/s)")
    vy: float = Field(..., description="初速度 vy (m/s)")


class SimulationRequest(BaseModel):
    fields: Fields
    particles: List[Particle]
    t0: float = Field(default=0.0, description="開始時刻 (s)")
    t_final: float = Field(..., gt=0, description="終了時刻 (s)")
    dt: float = Field(..., gt=0, description="時間刻み (s)")
    integrator: str = Field(default="RK4", pattern="^(RK4|Euler)$", description="積分法")


@app.route('/')
def index():
    """ルートエンドポイント"""
    return jsonify({
        'message': 'ローレンツ力シミュレーション API',
        'version': '1.0.0',
        'endpoints': {
            '/': 'API情報',
            '/health': 'ヘルスチェック',
            '/simulate': 'シミュレーション実行 (POST)',
            '/validate-circular': '円運動の検証 (POST)'
        }
    })


@app.route('/health')
def health():
    """ヘルスチェックエンドポイント"""
    return jsonify({'status': 'healthy'})


@app.route('/simulate', methods=['POST'])
def simulate():
    """
    シミュレーションを実行するエンドポイント

    Request Body (JSON):
    {
        "fields": {
            "E": {"magnitude": 1.0, "angle_deg": 30},
            "B": {"magnitude": 0.5, "angle_deg": 90}
        },
        "particles": [
            {"id":"p1", "q":1.0, "m":1.0, "x":0.0, "y":0.0, "vx":1.0, "vy":0.0}
        ],
        "t0": 0.0,
        "t_final": 10.0,
        "dt": 0.01,
        "integrator": "RK4"
    }

    Response (JSON):
    {
        "meta": {"t0": 0.0, "t_final": 10.0, "dt": 0.01},
        "data": {
            "times": [...],
            "particles": {
                "p1": {"x": [...], "y": [...], "vx": [...], ...}
            }
        }
    }
    """
    try:
        # リクエストのバリデーション
        data = request.get_json()
        sim_request = SimulationRequest(**data)

        # パラメータの制限チェック
        if sim_request.t_final > 100:
            return jsonify({'error': 't_final は 100秒以下にしてください'}), 400

        if sim_request.dt < 0.0001:
            return jsonify({'error': 'dt は 0.0001秒以上にしてください'}), 400

        if len(sim_request.particles) > 100:
            return jsonify({'error': '粒子数は100個以下にしてください'}), 400

        # シミュレーション実行
        fields_dict = {
            'E': sim_request.fields.E.model_dump(),
            'B': sim_request.fields.B.model_dump()
        }
        particles_list = [p.model_dump() for p in sim_request.particles]

        results = simulate_multiple_particles(
            fields_dict,
            particles_list,
            sim_request.t0,
            sim_request.t_final,
            sim_request.dt,
            sim_request.integrator
        )

        return jsonify(results)

    except ValidationError as e:
        return jsonify({'error': 'バリデーションエラー', 'details': e.errors()}), 400

    except Exception as e:
        print(f"Error: {e}")
        traceback.print_exc()
        return jsonify({'error': 'サーバーエラー', 'message': str(e)}), 500


@app.route('/validate-circular', methods=['POST'])
def validate_circular():
    """
    円運動の半径を検証するエンドポイント

    Request Body (JSON):
    {
        "q": 1.0,
        "m": 1.0,
        "v": 2.0,
        "B": 1.0,
        "radius": 2.0
    }

    Response (JSON):
    {
        "is_valid": true,
        "expected_radius": 2.0,
        "measured_radius": 2.0,
        "relative_error": 0.0
    }
    """
    try:
        data = request.get_json()

        q = data.get('q')
        m = data.get('m')
        v = data.get('v')
        B = data.get('B')
        radius = data.get('radius')

        if None in [q, m, v, B, radius]:
            return jsonify({'error': '必須パラメータが不足しています'}), 400

        if m <= 0:
            return jsonify({'error': '質量は正の値である必要があります'}), 400

        expected_radius = (m * v) / (abs(q) * B) if q != 0 and B != 0 else float('inf')
        is_valid = validate_circular_motion(q, m, v, B, radius)

        relative_error = abs(radius - expected_radius) / expected_radius if expected_radius != 0 else float('inf')

        return jsonify({
            'is_valid': is_valid,
            'expected_radius': expected_radius,
            'measured_radius': radius,
            'relative_error': relative_error
        })

    except Exception as e:
        print(f"Error: {e}")
        traceback.print_exc()
        return jsonify({'error': 'サーバーエラー', 'message': str(e)}), 500


@app.route('/energy', methods=['POST'])
def calculate_energy():
    """
    運動エネルギーを計算するエンドポイント

    Request Body (JSON):
    {
        "m": 1.0,
        "vx": 1.0,
        "vy": 0.5,
        "vz": 0.0
    }

    Response (JSON):
    {
        "kinetic_energy": 0.625,
        "speed": 1.118
    }
    """
    try:
        data = request.get_json()

        m = data.get('m')
        vx = data.get('vx', 0.0)
        vy = data.get('vy', 0.0)
        vz = data.get('vz', 0.0)

        if m is None or m <= 0:
            return jsonify({'error': '質量は正の値である必要があります'}), 400

        ke = calculate_kinetic_energy(m, vx, vy, vz)
        speed = (vx**2 + vy**2 + vz**2)**0.5

        return jsonify({
            'kinetic_energy': ke,
            'speed': speed
        })

    except Exception as e:
        print(f"Error: {e}")
        traceback.print_exc()
        return jsonify({'error': 'サーバーエラー', 'message': str(e)}), 500


@app.errorhandler(404)
def not_found(error):
    return jsonify({'error': 'エンドポイントが見つかりません'}), 404


@app.errorhandler(500)
def internal_error(error):
    return jsonify({'error': '内部サーバーエラー'}), 500


if __name__ == '__main__':
    print("=" * 60)
    print("ローレンツ力シミュレーション API サーバー")
    print("=" * 60)
    print("サーバー起動中...")
    print("URL: http://localhost:5000")
    print("ドキュメント: http://localhost:5000/")
    print("=" * 60)

    app.run(debug=True, host='0.0.0.0', port=5000)
