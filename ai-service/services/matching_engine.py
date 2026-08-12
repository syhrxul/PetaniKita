from __future__ import annotations
import math
import numpy as np
from scipy.optimize import linprog
from dataclasses import dataclass


@dataclass
class Supply:
    id: str
    lat: float
    lon: float
    stock_kg: float
    days_to_harvest: int = 0  # 0 = sudah tersedia


@dataclass
class Demand:
    id: str
    lat: float
    lon: float
    need_kg: float


@dataclass
class AllocationResult:
    feasible: bool
    total_cost: float
    allocations: list[dict]
    message: str


def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    R = 6371.0
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    return R * 2 * math.asin(math.sqrt(a))


def spoilage_penalty(days_to_harvest: int, distance_km: float, speed_kmh: float = 40.0) -> float:
    """
    Penalty tambahan jika estimasi perjalanan + hari panen mendekati batas busuk.
    Asumsikan komoditas segar busuk dalam 5 hari (120 jam).
    """
    travel_hours = distance_km / speed_kmh
    total_hours = days_to_harvest * 24 + travel_hours
    spoilage_limit_hours = 120.0
    ratio = total_hours / spoilage_limit_hours
    # Penalty eksponensial jika > 70% batas busuk
    if ratio > 0.7:
        return 10.0 * math.exp(ratio - 0.7)
    return 0.0


def build_cost_matrix(supplies: list[Supply], demands: list[Demand]) -> np.ndarray:
    """
    Matriks biaya [n_supply x n_demand].
    Biaya per kg = jarak (km) + spoilage_penalty.
    """
    n_s, n_d = len(supplies), len(demands)
    C = np.zeros((n_s, n_d))
    for i, s in enumerate(supplies):
        for j, d in enumerate(demands):
            dist = haversine_km(s.lat, s.lon, d.lat, d.lon)
            penalty = spoilage_penalty(s.days_to_harvest, dist)
            C[i][j] = dist + penalty
    return C


def optimize_supply_chain(
    demands: list[Demand],
    supplies: list[Supply],
) -> AllocationResult:
    """
    Linear programming transportation problem.
    Variabel: x[i][j] = kg dialokasikan dari supply i ke demand j
    Minimize: sum( C[i][j] * x[i][j] )
    Subject to:
        sum_j( x[i][j] ) <= stock_kg[i]   (supply constraint)
        sum_i( x[i][j] ) >= need_kg[j]    (demand constraint)
        x[i][j] >= 0
    """
    n_s = len(supplies)
    n_d = len(demands)
    n_vars = n_s * n_d  # flatten: x[i*n_d + j]

    C = build_cost_matrix(supplies, demands)
    c = C.flatten()  # objective coefficients

    # Inequality constraints (A_ub @ x <= b_ub)
    # 1. Supply constraints: sum_j x[i][j] <= stock_kg[i]
    A_supply = np.zeros((n_s, n_vars))
    b_supply = np.zeros(n_s)
    for i in range(n_s):
        for j in range(n_d):
            A_supply[i][i * n_d + j] = 1.0
        b_supply[i] = supplies[i].stock_kg

    # 2. Demand constraints: sum_i x[i][j] >= need_kg[j]
    #    Rewrite as: -sum_i x[i][j] <= -need_kg[j]
    A_demand = np.zeros((n_d, n_vars))
    b_demand = np.zeros(n_d)
    for j in range(n_d):
        for i in range(n_s):
            A_demand[j][i * n_d + j] = -1.0
        b_demand[j] = -demands[j].need_kg

    A_ub = np.vstack([A_supply, A_demand])
    b_ub = np.concatenate([b_supply, b_demand])

    bounds = [(0, None)] * n_vars

    result = linprog(c, A_ub=A_ub, b_ub=b_ub, bounds=bounds, method="highs")

    if not result.success:
        return AllocationResult(
            feasible=False,
            total_cost=0.0,
            allocations=[],
            message=f"Optimasi gagal: {result.message}",
        )

    x = result.x.reshape((n_s, n_d))
    allocations = []
    for i, s in enumerate(supplies):
        for j, d in enumerate(demands):
            kg = round(x[i][j], 3)
            if kg > 0.01:
                dist = haversine_km(s.lat, s.lon, d.lat, d.lon)
                allocations.append({
                    "supply_id": s.id,
                    "demand_id": d.id,
                    "allocated_kg": kg,
                    "distance_km": round(dist, 3),
                    "cost": round(C[i][j] * kg, 3),
                })

    return AllocationResult(
        feasible=True,
        total_cost=round(float(result.fun), 4),
        allocations=allocations,
        message="OK",
    )
