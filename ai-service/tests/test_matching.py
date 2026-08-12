import pytest
from services.matching_engine import Supply, Demand, optimize_supply_chain, haversine_km


# Mock dataset:
# 3 UMKM butuh cabai: 50kg, 30kg, 20kg → total 100kg
# 2 Petani stok: 60kg (Sleman) dan 40kg (Bantul)
SUPPLIES = [
    Supply(id="petani-1", lat=-7.7558, lon=110.4052, stock_kg=60.0, days_to_harvest=0),  # Sleman
    Supply(id="petani-2", lat=-7.9494, lon=110.3325, stock_kg=40.0, days_to_harvest=1),  # Bantul
]

DEMANDS = [
    Demand(id="umkm-1", lat=-7.8014, lon=110.3644, need_kg=50.0),  # Kota Jogja
    Demand(id="umkm-2", lat=-7.8636, lon=110.4031, need_kg=30.0),  # Kotagede
    Demand(id="umkm-3", lat=-7.8251, lon=110.3290, need_kg=20.0),  # Wirobrajan
]


def test_haversine_sanity():
    dist = haversine_km(-7.7558, 110.4052, -7.8014, 110.3644)
    assert 5.0 < dist < 10.0, f"Jarak Sleman-Jogja expected ~6-8km, got {dist:.2f}"


def test_total_supply_covers_demand():
    total_supply = sum(s.stock_kg for s in SUPPLIES)
    total_demand = sum(d.need_kg for d in DEMANDS)
    assert total_supply >= total_demand, "Supply harus >= demand"


def test_optimize_feasible():
    result = optimize_supply_chain(DEMANDS, SUPPLIES)
    assert result.feasible, f"Harus feasible: {result.message}"
    assert result.total_cost > 0


def test_no_supply_overload():
    result = optimize_supply_chain(DEMANDS, SUPPLIES)
    assert result.feasible

    # Cek tiap petani tidak dialokasikan melebihi stoknya
    alloc_per_supply: dict[str, float] = {}
    for a in result.allocations:
        sid = a["supply_id"]
        alloc_per_supply[sid] = alloc_per_supply.get(sid, 0.0) + a["allocated_kg"]

    supply_map = {s.id: s.stock_kg for s in SUPPLIES}
    for sid, total_alloc in alloc_per_supply.items():
        assert total_alloc <= supply_map[sid] + 0.01, (
            f"{sid} overload: dialokasikan {total_alloc:.2f}kg > stok {supply_map[sid]}kg"
        )


def test_all_demands_fulfilled():
    result = optimize_supply_chain(DEMANDS, SUPPLIES)
    assert result.feasible

    alloc_per_demand: dict[str, float] = {}
    for a in result.allocations:
        did = a["demand_id"]
        alloc_per_demand[did] = alloc_per_demand.get(did, 0.0) + a["allocated_kg"]

    demand_map = {d.id: d.need_kg for d in DEMANDS}
    for did, need in demand_map.items():
        got = alloc_per_demand.get(did, 0.0)
        assert got >= need - 0.01, (
            f"{did} tidak terpenuhi: dapat {got:.2f}kg dari kebutuhan {need}kg"
        )


def test_allocation_detail():
    result = optimize_supply_chain(DEMANDS, SUPPLIES)
    assert result.feasible
    print(f"\n=== Hasil Optimasi ===")
    print(f"Total Cost: {result.total_cost:.4f} (km-kg)")
    for a in result.allocations:
        print(
            f"  {a['supply_id']} → {a['demand_id']}: "
            f"{a['allocated_kg']}kg, jarak {a['distance_km']}km, cost {a['cost']}"
        )
    assert len(result.allocations) > 0


def test_infeasible_when_supply_insufficient():
    low_supplies = [
        Supply(id="petani-kecil", lat=-7.7558, lon=110.4052, stock_kg=10.0),
    ]
    result = optimize_supply_chain(DEMANDS, low_supplies)
    assert not result.feasible, "Harus infeasible jika supply < demand"
