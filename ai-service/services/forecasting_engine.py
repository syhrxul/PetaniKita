from __future__ import annotations
import math
import numpy as np
from dataclasses import dataclass
from datetime import date, timedelta


@dataclass
class DailyRecord:
    ds: str   # format YYYY-MM-DD
    y: float  # kg terjual/dibutuhkan


@dataclass
class ForecastPoint:
    ds: str
    yhat: float       # prediksi tengah
    yhat_lower: float # confidence interval bawah
    yhat_upper: float # confidence interval atas


@dataclass
class ForecastResult:
    success: bool
    forecast: list[ForecastPoint]
    model: str
    message: str


def _holt_winters(
    y: np.ndarray,
    alpha: float = 0.3,
    beta: float = 0.1,
    gamma: float = 0.2,
    season_len: int = 7,
    steps: int = 7,
) -> tuple[np.ndarray, float]:
    """
    Triple Exponential Smoothing (Holt-Winters additive).
    Return: (forecast array, RMSE pada training data)
    """
    n = len(y)
    if n < season_len * 2:
        # Fallback ke simple exponential smoothing jika data terlalu pendek
        return _simple_exp_smoothing(y, alpha, steps)

    # Init level, trend, seasonal
    level = np.mean(y[:season_len])
    trend = (np.mean(y[season_len:season_len*2]) - np.mean(y[:season_len])) / season_len
    seasonal = y[:season_len] - level

    levels = np.zeros(n)
    trends = np.zeros(n)
    seasonals = np.zeros(n + season_len)
    seasonals[:season_len] = seasonal

    fitted = np.zeros(n)

    for t in range(n):
        s_idx = t % season_len
        prev_level = level
        prev_trend = trend
        level = alpha * (y[t] - seasonals[t]) + (1 - alpha) * (prev_level + prev_trend)
        trend = beta * (level - prev_level) + (1 - beta) * prev_trend
        seasonals[t + season_len] = gamma * (y[t] - level) + (1 - gamma) * seasonals[t]
        fitted[t] = prev_level + prev_trend + seasonals[t]

    # Forecast
    forecast = np.zeros(steps)
    for h in range(1, steps + 1):
        s_idx = (n + h - 1) % season_len
        forecast[h - 1] = level + h * trend + seasonals[n + s_idx]

    rmse = float(np.sqrt(np.mean((fitted - y) ** 2)))
    return forecast, rmse


def _simple_exp_smoothing(
    y: np.ndarray,
    alpha: float = 0.3,
    steps: int = 7,
) -> tuple[np.ndarray, float]:
    """Fallback: double exponential smoothing (Holt linear)."""
    level = float(y[0])
    trend = float(y[1] - y[0]) if len(y) > 1 else 0.0
    fitted = np.zeros(len(y))

    for t, val in enumerate(y):
        prev_l, prev_b = level, trend
        level = alpha * val + (1 - alpha) * (prev_l + prev_b)
        trend = 0.1 * (level - prev_l) + 0.9 * prev_b
        fitted[t] = prev_l + prev_b

    forecast = np.array([level + h * trend for h in range(1, steps + 1)])
    rmse = float(np.sqrt(np.mean((fitted - y) ** 2)))
    return forecast, rmse


def _confidence_interval(forecast: np.ndarray, rmse: float, z: float = 1.96) -> tuple[np.ndarray, np.ndarray]:
    margin = z * rmse * np.sqrt(np.arange(1, len(forecast) + 1))
    return np.maximum(forecast - margin, 0), forecast + margin


def predict_next_demand(
    history_data: list[DailyRecord],
    days_ahead: int = 7,
) -> ForecastResult:
    if len(history_data) < 7:
        return ForecastResult(
            success=False,
            forecast=[],
            model="none",
            message=f"Data minimum 7 hari, diberikan {len(history_data)} hari",
        )

    # Sort by date
    sorted_data = sorted(history_data, key=lambda r: r.ds)
    y = np.array([r.y for r in sorted_data], dtype=float)
    last_date = date.fromisoformat(sorted_data[-1].ds)

    days_ahead = max(3, min(days_ahead, 30))

    season_len = 7
    if len(y) >= season_len * 2:
        fc_values, rmse = _holt_winters(y, season_len=season_len, steps=days_ahead)
        model_name = "holt-winters-additive"
    else:
        fc_values, rmse = _simple_exp_smoothing(y, steps=days_ahead)
        model_name = "holt-linear"

    # Clip negatif
    fc_values = np.maximum(fc_values, 0)
    lower, upper = _confidence_interval(fc_values, rmse)

    forecast = []
    for i in range(days_ahead):
        ds = (last_date + timedelta(days=i + 1)).isoformat()
        forecast.append(ForecastPoint(
            ds=ds,
            yhat=round(float(fc_values[i]), 2),
            yhat_lower=round(float(lower[i]), 2),
            yhat_upper=round(float(upper[i]), 2),
        ))

    return ForecastResult(
        success=True,
        forecast=forecast,
        model=model_name,
        message="OK",
    )
