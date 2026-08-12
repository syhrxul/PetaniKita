from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
from services.matching_engine import Supply, Demand, optimize_supply_chain, AllocationResult
from services.forecasting_engine import DailyRecord, predict_next_demand
from services.price_ai_parser import parse_regional_prices

app = FastAPI(title="PetaniKita AI Service", version="1.0.0")


class SupplyIn(BaseModel):
    id: str
    lat: float
    lon: float
    stock_kg: float = Field(gt=0)
    days_to_harvest: int = Field(default=0, ge=0)


class DemandIn(BaseModel):
    id: str
    lat: float
    lon: float
    need_kg: float = Field(gt=0)


class OptimizeRequest(BaseModel):
    supplies: list[SupplyIn]
    demands: list[DemandIn]


class OptimizeResponse(BaseModel):
    feasible: bool
    total_cost: float
    allocations: list[dict]
    message: str


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/api/v1/optimize-matching", response_model=OptimizeResponse)
def optimize_matching(req: OptimizeRequest):
    if not req.supplies:
        raise HTTPException(400, "supplies tidak boleh kosong")
    if not req.demands:
        raise HTTPException(400, "demands tidak boleh kosong")

    total_supply = sum(s.stock_kg for s in req.supplies)
    total_demand = sum(d.need_kg for d in req.demands)
    if total_supply < total_demand:
        raise HTTPException(400, f"Total stok ({total_supply}kg) < total kebutuhan ({total_demand}kg)")

    supplies = [Supply(**s.model_dump()) for s in req.supplies]
    demands = [Demand(**d.model_dump()) for d in req.demands]

    result: AllocationResult = optimize_supply_chain(demands, supplies)

    return OptimizeResponse(
        feasible=result.feasible,
        total_cost=result.total_cost,
        allocations=result.allocations,
        message=result.message,
    )


class HistoryRecord(BaseModel):
    ds: str
    y: float = Field(gt=0)


class PredictRequest(BaseModel):
    history: list[HistoryRecord]
    days_ahead: int = Field(default=7, ge=3, le=30)


class ForecastPointOut(BaseModel):
    ds: str
    yhat: float
    yhat_lower: float
    yhat_upper: float


class PredictResponse(BaseModel):
    success: bool
    model: str
    forecast: list[ForecastPointOut]
    message: str


@app.post("/api/v1/predict-demand", response_model=PredictResponse)
def predict_demand(req: PredictRequest):
    if len(req.history) < 7:
        raise HTTPException(400, "Minimal 7 data historis harian")

    records = [DailyRecord(ds=r.ds, y=r.y) for r in req.history]
    result = predict_next_demand(records, days_ahead=req.days_ahead)

    return PredictResponse(
        success=result.success,
        model=result.model,
        forecast=[
            ForecastPointOut(ds=p.ds, yhat=p.yhat, yhat_lower=p.yhat_lower, yhat_upper=p.yhat_upper)
            for p in result.forecast
        ],
        message=result.message,
    )


class ParsePriceRequest(BaseModel):
    region_name: str = Field(default="Kabupaten Sleman")


@app.post("/api/v1/parse-prices")
def parse_prices_endpoint(req: ParsePriceRequest):
    data = parse_regional_prices(req.region_name)
    return {"region_name": req.region_name, "prices": data}
