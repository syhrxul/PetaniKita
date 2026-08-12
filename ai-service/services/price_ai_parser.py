import json
import urllib.request
from typing import Any

ROUTER_URL = "https://9router.syhrulimtkhan.my.id/v1/chat/completions"
API_KEY = "sk-92234d58ac30fd89-ek8z31-71e3c791"


def parse_regional_prices(region_name: str) -> list[dict[str, Any]]:
    """
    Panggil 9Router AI API (model: Hervest) untuk ekstrak estimasi harga pasar pangan regional.
    Super-lean prompt: return pure RAW JSON array sahaja.
    """
    prompt = (
        f"Return ONLY a RAW JSON Array without markdown or formatting of current & yesterday commodity prices per kg in IDR for {region_name}. "
        "Format: [{\"commodity\":\"cabai_rawit\",\"price\":28000,\"prev_price\":27500},{\"commodity\":\"bawang_merah\",\"price\":24000,\"prev_price\":25000},{\"commodity\":\"tomat_segar\",\"price\":12000,\"prev_price\":12000},{\"commodity\":\"cabai_merah\",\"price\":30000,\"prev_price\":29000},{\"commodity\":\"bawang_putih\",\"price\":35000,\"prev_price\":35000}]"
    )

    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {API_KEY}",
    }

    body = {
        "model": "Hervest",
        "messages": [
            {"role": "system", "content": "You are a price data JSON API. Output JSON array only."},
            {"role": "user", "content": prompt},
        ],
        "temperature": 0.1,
    }

    try:
        req = urllib.request.Request(
            ROUTER_URL,
            data=json.dumps(body).encode("utf-8"),
            headers=headers,
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=10) as response:
            res_data = json.loads(response.read().decode("utf-8"))
            content = res_data["choices"][0]["message"]["content"].strip()
            # Clean possible markdown wrapper if model adds ```json
            if content.startswith("```"):
                lines = content.splitlines()
                content = "\n".join([line for line in lines if not line.startswith("```")])
            return json.loads(content)
    except Exception as e:
        print(f"9Router AI Call Error: {e}, fallback default prices")
        # Fallback default prices jika AI API unreachable
        return [
            {"commodity": "Cabai Rawit Merah", "price": 28000, "prev_price": 27500},
            {"commodity": "Bawang Merah", "price": 24000, "prev_price": 25000},
            {"commodity": "Tomat Segar", "price": 12000, "prev_price": 12000},
            {"commodity": "Cabai Merah Keriting", "price": 30000, "prev_price": 29000},
            {"commodity": "Bawang Putih", "price": 35000, "prev_price": 35000},
        ]
