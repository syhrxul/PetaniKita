import pytest
from datetime import date, timedelta
from services.forecasting_engine import DailyRecord, predict_next_demand


def make_history(n: int = 30) -> list[DailyRecord]:
    """30 hari data sintetis dengan tren naik + pola mingguan."""
    base = date(2026, 6, 1)
    records = []
    for i in range(n):
        d = base + timedelta(days=i)
        # Tren naik: 40kg + 0.5/hari, pola mingguan ±5kg, noise kecil
        weekly = 5.0 * (1 if i % 7 < 3 else -1)
        noise = (i * 13 % 7) - 3.0
        y = max(20.0, 40.0 + 0.5 * i + weekly + noise)
        records.append(DailyRecord(ds=d.isoformat(), y=round(y, 1)))
    return records


HISTORY = make_history(30)


def test_history_length():
    assert len(HISTORY) == 30


def test_predict_returns_success():
    result = predict_next_demand(HISTORY, days_ahead=7)
    assert result.success, f"Harus success: {result.message}"


def test_forecast_length_7():
    result = predict_next_demand(HISTORY, days_ahead=7)
    assert len(result.forecast) == 7


def test_forecast_length_3():
    result = predict_next_demand(HISTORY, days_ahead=3)
    assert len(result.forecast) == 3


def test_yhat_positive():
    result = predict_next_demand(HISTORY, days_ahead=7)
    for p in result.forecast:
        assert p.yhat >= 0, f"yhat negatif pada {p.ds}: {p.yhat}"


def test_confidence_interval_valid():
    result = predict_next_demand(HISTORY, days_ahead=7)
    for p in result.forecast:
        assert p.yhat_lower <= p.yhat <= p.yhat_upper, (
            f"CI tidak valid pada {p.ds}: [{p.yhat_lower}, {p.yhat}, {p.yhat_upper}]"
        )


def test_dates_sequential():
    result = predict_next_demand(HISTORY, days_ahead=7)
    dates = [p.ds for p in result.forecast]
    for i in range(1, len(dates)):
        prev = date.fromisoformat(dates[i - 1])
        curr = date.fromisoformat(dates[i])
        assert (curr - prev).days == 1, f"Tanggal tidak berurutan: {prev} → {curr}"


def test_dates_start_after_history():
    result = predict_next_demand(HISTORY, days_ahead=7)
    last_history = date.fromisoformat(HISTORY[-1].ds)
    first_forecast = date.fromisoformat(result.forecast[0].ds)
    assert first_forecast == last_history + timedelta(days=1)


def test_model_name_present():
    result = predict_next_demand(HISTORY, days_ahead=7)
    assert result.model in ("holt-winters-additive", "holt-linear")


def test_insufficient_data_fails():
    short = HISTORY[:5]
    result = predict_next_demand(short, days_ahead=7)
    assert not result.success


def test_print_forecast_detail():
    result = predict_next_demand(HISTORY, days_ahead=7)
    print(f"\n=== Forecast Demand (model: {result.model}) ===")
    for p in result.forecast:
        print(f"  {p.ds}: {p.yhat:6.2f} kg  [{p.yhat_lower:.2f} – {p.yhat_upper:.2f}]")
    assert result.success
