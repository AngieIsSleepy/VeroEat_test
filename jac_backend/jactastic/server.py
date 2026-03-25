from fastapi import FastAPI
from pydantic import BaseModel, Field
import subprocess
import json
import uvicorn
from fastapi.middleware.cors import CORSMiddleware
from pathlib import Path
from typing import Any, Optional
from datetime import datetime, timezone
import time
import httpx
import re
from urllib.parse import quote


app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

BASE_DIR = Path(__file__).resolve().parent
DATA_FILE = BASE_DIR / "recall_data.json"
PROFILE_CACHE_FILE = BASE_DIR / "profile_cache.json"


def load_json_file(path: Path, default: dict[str, Any]) -> dict[str, Any]:
    if not path.exists():
        return default
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return default


def save_json_file(path: Path, data: dict[str, Any]) -> None:
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def load_recall_data() -> dict[str, Any]:
    return load_json_file(
        DATA_FILE,
        {
            "inventory_by_user": {},
            "recall_settings_by_user": {},
        },
    )


def save_recall_data(data: dict[str, Any]) -> None:
    save_json_file(DATA_FILE, data)


def load_profile_cache() -> dict[str, Any]:
    return load_json_file(
        PROFILE_CACHE_FILE,
        {
            "profiles_by_user": {},
        },
    )


def save_profile_cache(data: dict[str, Any]) -> None:
    save_json_file(PROFILE_CACHE_FILE, data)


class User(BaseModel):
    name: str
    location: str = ""
    allergens: list = []
    dietary_preferences: list = []


class InventoryItem(BaseModel):
    id: str
    name: str
    barcode: str
    imageUrl: Optional[str] = None
    addedAt: int
    scannedBy: Optional[str] = None
    isSafe: Optional[bool] = None
    expiryDate: Optional[int] = None
    ingredientsSummary: Optional[str] = None

    recallStatus: Optional[str] = "none"
    recallTitle: Optional[str] = ""
    recallReason: Optional[str] = ""
    recalledAt: Optional[int] = None
    lastRecallCheckedAt: Optional[int] = None


class InventorySyncRequest(BaseModel):
    username: str
    items: list[InventoryItem] = Field(default_factory=list)


class RecallSettingsRequest(BaseModel):
    username: str
    recallAlertsEnabled: bool = True
    expoPushToken: Optional[str] = None


@app.post("/walker/create_or_update_user")
def create_user(user: User):
    """
    Jac is still the source of truth for profile create/update.
    We also mirror the result into a fast local cache for reads.
    """
    try:
        cmd = [
            "jac",
            "run",
            "main.jac",
            "-a",
            json.dumps(user.dict())
        ]
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=10)

        if result.returncode != 0:
            return {
                "status": "error",
                "message": result.stderr or "Jac command failed"
            }

        profile_cache = load_profile_cache()
        profile_cache["profiles_by_user"][user.name] = {
            "name": user.name,
            "location": user.location,
            "allergens": user.allergens,
            "dietary_preferences": user.dietary_preferences,
        }
        save_profile_cache(profile_cache)

        return {
            "status": "success",
            "output": result.stdout,
            "cached_profile": profile_cache["profiles_by_user"][user.name],
        }
    except Exception as e:
        return {"status": "error", "message": str(e)}


@app.post("/walker/get_user")
def get_user(user: User):
    """
    Fast path: read from local cache instead of spawning Jac every time.
    """
    try:
        profile_cache = load_profile_cache()
        cached_profile = profile_cache["profiles_by_user"].get(user.name)

        if cached_profile:
            return {
                "status": "success",
                "source": "profile_cache",
                "data": cached_profile,
            }

        return {
            "status": "error",
            "source": "profile_cache",
            "message": "User not found",
        }
    except Exception as e:
        return {"status": "error", "message": str(e)}


@app.post("/inventory/sync")
def sync_inventory(payload: InventorySyncRequest):
    data = load_recall_data()
    data["inventory_by_user"][payload.username] = [item.dict() for item in payload.items]
    save_recall_data(data)
    return {
        "status": "success",
        "message": f"Inventory synced for {payload.username}",
        "count": len(payload.items),
    }


@app.get("/inventory/{username}")
def get_inventory(username: str):
    data = load_recall_data()
    items = data["inventory_by_user"].get(username, [])
    return {
        "status": "success",
        "username": username,
        "items": items,
    }


@app.post("/recall-settings/sync")
def sync_recall_settings(payload: RecallSettingsRequest):
    data = load_recall_data()
    data["recall_settings_by_user"][payload.username] = {
        "recallAlertsEnabled": payload.recallAlertsEnabled,
        "expoPushToken": payload.expoPushToken,
    }
    save_recall_data(data)
    return {
        "status": "success",
        "message": f"Recall settings synced for {payload.username}",
    }


@app.get("/recall-settings/{username}")
def get_recall_settings(username: str):
    data = load_recall_data()
    settings = data["recall_settings_by_user"].get(
        username,
        {
            "recallAlertsEnabled": True,
            "expoPushToken": None,
        },
    )
    return {
        "status": "success",
        "username": username,
        "settings": settings,
    }


def current_timestamp_ms() -> int:
    return int(time.time() * 1000)


OPENFDA_FOOD_ENFORCEMENT_URL = "https://api.fda.gov/food/enforcement.json"

HIGH_CONFIDENCE_DAYS = 180
SECONDARY_WINDOW_DAYS = 365
OPENFDA_RESULT_LIMIT = 5

GENERIC_PRODUCT_WORDS = {
    "food", "drink", "snack", "snacks", "water", "cheese", "milk", "juice",
    "bread", "cookie", "cookies", "cracker", "crackers", "gum", "gummies",
    "vitamin", "vitamins", "chips", "popcorn", "butter", "american",
    "extra", "strength", "adult", "count", "oz", "bag", "bags", "carton",
    "solution", "preservative", "purified",
}

STOPWORDS = {
    "and", "with", "for", "the", "a", "an", "of", "in", "on", "to",
}


def normalize_product_name(name: str) -> str:
    if not name:
        return ""
    cleaned = re.sub(r"[^a-zA-Z0-9\s]", " ", name.lower())
    cleaned = re.sub(r"\s+", " ", cleaned).strip()
    return cleaned


def tokenize_name(name: str) -> list[str]:
    normalized = normalize_product_name(name)
    if not normalized:
        return []
    return [
        token for token in normalized.split()
        if len(token) >= 3 and token not in STOPWORDS
    ]


def extract_brand_tokens(item_name: str) -> list[str]:
    tokens = tokenize_name(item_name)
    brand_tokens: list[str] = []

    for token in tokens:
        if token not in GENERIC_PRODUCT_WORDS:
            brand_tokens.append(token)
        if len(brand_tokens) >= 2:
            break

    return brand_tokens[:1] if brand_tokens else []


def extract_core_product_tokens(item_name: str) -> list[str]:
    tokens = tokenize_name(item_name)
    brand_tokens = set(extract_brand_tokens(item_name))

    core_tokens = [
        token for token in tokens
        if token not in GENERIC_PRODUCT_WORDS and token not in brand_tokens
    ]

    if len(core_tokens) < 2:
        core_tokens = [token for token in tokens if token not in brand_tokens]

    return core_tokens[:4]


def parse_openfda_date_to_ms(date_str: Optional[str]) -> Optional[int]:
    if not date_str:
        return None
    if isinstance(date_str, str) and len(date_str) == 8 and date_str.isdigit():
        try:
            dt = datetime.strptime(date_str, "%Y%m%d").replace(tzinfo=timezone.utc)
            return int(dt.timestamp() * 1000)
        except Exception:
            return None
    return None


def days_since_ms(timestamp_ms: Optional[int]) -> Optional[int]:
    if not timestamp_ms:
        return None
    now_ms = current_timestamp_ms()
    diff_ms = now_ms - timestamp_ms
    if diff_ms < 0:
        return 0
    return diff_ms // (1000 * 60 * 60 * 24)


def build_openfda_food_search_terms(item_name: str, barcode: str = "") -> list[str]:
    normalized = normalize_product_name(item_name)
    if not normalized:
        return []

    brand_tokens = extract_brand_tokens(item_name)
    core_tokens = extract_core_product_tokens(item_name)

    queries: list[str] = []

    queries.append(f'product_description:"{normalized}"')

    strong_tokens = brand_tokens + core_tokens[:3]
    if strong_tokens:
        queries.append(" AND ".join([f"product_description:{t}" for t in strong_tokens]))

    if core_tokens:
        queries.append(" AND ".join([f"product_description:{t}" for t in core_tokens[:3]]))

    barcode_digits = re.sub(r"\D", "", barcode or "")
    if len(barcode_digits) >= 8:
        queries.append(f'code_info:"{barcode_digits}"')
        queries.append(f'more_code_info:"{barcode_digits}"')

    deduped: list[str] = []
    seen = set()
    for q in queries:
        if q not in seen:
            deduped.append(q)
            seen.add(q)

    return deduped


def score_openfda_candidate(
    item_name: str,
    barcode: str,
    record: dict[str, Any],
) -> dict[str, Any]:
    product_description = normalize_product_name(record.get("product_description", ""))
    code_info = normalize_product_name(record.get("code_info", ""))
    more_code_info = normalize_product_name(record.get("more_code_info", ""))
    recalling_firm = normalize_product_name(record.get("recalling_firm", ""))

    haystack = " ".join([product_description, code_info, more_code_info, recalling_firm])

    brand_tokens = extract_brand_tokens(item_name)
    core_tokens = extract_core_product_tokens(item_name)

    matched_brand_tokens = [t for t in brand_tokens if t in haystack]
    matched_core_tokens = [t for t in core_tokens if t in haystack]

    barcode_digits = re.sub(r"\D", "", barcode or "")
    upc_matched = False
    if len(barcode_digits) >= 8:
        upc_matched = (
            barcode_digits in re.sub(r"\D", "", record.get("code_info", "") or "")
            or barcode_digits in re.sub(r"\D", "", record.get("more_code_info", "") or "")
            or barcode_digits in re.sub(r"\D", "", record.get("product_description", "") or "")
        )

    report_date_ms = parse_openfda_date_to_ms(record.get("report_date"))
    age_days = days_since_ms(report_date_ms)

    score = 0
    score += len(matched_core_tokens) * 2
    score += len(matched_brand_tokens) * 3

    if upc_matched:
        score += 6

    if age_days is not None:
        if age_days <= HIGH_CONFIDENCE_DAYS:
            score += 3
        elif age_days <= SECONDARY_WINDOW_DAYS:
            score += 1
        else:
            score -= 2

    return {
        "record": record,
        "score": score,
        "matched_brand_tokens": matched_brand_tokens,
        "matched_core_tokens": matched_core_tokens,
        "upc_matched": upc_matched,
        "report_date_ms": report_date_ms,
        "age_days": age_days,
    }


def is_high_confidence_match(scored: dict[str, Any]) -> bool:
    core_match_count = len(scored["matched_core_tokens"])
    brand_or_upc = bool(scored["matched_brand_tokens"]) or scored["upc_matched"]
    age_days = scored["age_days"]

    if age_days is not None and age_days <= HIGH_CONFIDENCE_DAYS:
        return core_match_count >= 2 and brand_or_upc

    if age_days is not None and age_days <= SECONDARY_WINDOW_DAYS:
        return core_match_count >= 2 and scored["upc_matched"]

    return scored["upc_matched"] and scored["score"] >= 8


async def search_openfda_food_recall(
    item_name: str,
    barcode: str = "",
) -> Optional[dict[str, Any]]:
    queries = build_openfda_food_search_terms(item_name, barcode)
    if not queries:
        return None

    collected_results: list[dict[str, Any]] = []

    async with httpx.AsyncClient(timeout=10.0) as client:
        for q in queries:
            url = (
                f"{OPENFDA_FOOD_ENFORCEMENT_URL}"
                f"?search={quote(q)}"
                f"&sort=report_date:desc"
                f"&limit={OPENFDA_RESULT_LIMIT}"
            )

            try:
                response = await client.get(url)
                if response.status_code == 404:
                    continue

                response.raise_for_status()
                data = response.json()
                results = data.get("results", [])
                collected_results.extend(results)

            except httpx.HTTPStatusError as e:
                if e.response.status_code == 404:
                    continue
                print("openFDA HTTP error:", e.response.text)
            except Exception as e:
                print("openFDA search failed:", str(e))

    if not collected_results:
        return None

    deduped_results: list[dict[str, Any]] = []
    seen = set()
    for record in collected_results:
        dedupe_key = record.get("event_id") or json.dumps(record, sort_keys=True)
        if dedupe_key not in seen:
            deduped_results.append(record)
            seen.add(dedupe_key)

    scored_results = [
        score_openfda_candidate(item_name, barcode, record)
        for record in deduped_results
    ]

    scored_results.sort(
        key=lambda x: (
            -(x["report_date_ms"] or 0),
            -x["score"],
        )
    )

    for scored in scored_results:
        if is_high_confidence_match(scored):
            return scored["record"]

    return None


def map_openfda_result_to_recall_fields(
    openfda_record: dict[str, Any],
) -> dict[str, Any]:
    report_date_ms = parse_openfda_date_to_ms(openfda_record.get("report_date"))
    recalled_at_ms = report_date_ms or current_timestamp_ms()

    return {
        "recallStatus": "recalled",
        "recallTitle": openfda_record.get("product_description", "FDA recall match found"),
        "recallReason": openfda_record.get("reason_for_recall", ""),
        "recalledAt": recalled_at_ms,
        "lastRecallCheckedAt": current_timestamp_ms(),
    }


async def apply_recall_check_to_items(
    items: list[dict[str, Any]],
) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    checked_at = current_timestamp_ms()
    updated_items: list[dict[str, Any]] = []
    newly_recalled_items: list[dict[str, Any]] = []

    for item in items:
        updated_item = {**item}
        updated_item["lastRecallCheckedAt"] = checked_at

        item_name = str(item.get("name", "")).strip()
        barcode = str(item.get("barcode", "")).strip()
        openfda_match = None

        if item_name:
            openfda_match = await search_openfda_food_recall(item_name, barcode)

        if openfda_match:
            was_already_recalled = updated_item.get("recallStatus") == "recalled"

            recall_fields = map_openfda_result_to_recall_fields(openfda_match)

            updated_item["recallStatus"] = recall_fields["recallStatus"]
            updated_item["recallTitle"] = recall_fields["recallTitle"]
            updated_item["recallReason"] = recall_fields["recallReason"]
            updated_item["recalledAt"] = (
                updated_item.get("recalledAt") or recall_fields["recalledAt"]
            )
            updated_item["lastRecallCheckedAt"] = recall_fields["lastRecallCheckedAt"]

            if not was_already_recalled:
                newly_recalled_items.append(updated_item)
        else:
            updated_item["recallStatus"] = "none"
            updated_item["recallTitle"] = ""
            updated_item["recallReason"] = ""
            updated_item["lastRecallCheckedAt"] = checked_at

        updated_items.append(updated_item)

    return updated_items, newly_recalled_items


@app.post("/recall/check/{username}")
async def check_recall_for_user(username: str):
    data = load_recall_data()

    items = data["inventory_by_user"].get(username, [])
    updated_items, newly_recalled_items = await apply_recall_check_to_items(items)

    data["inventory_by_user"][username] = updated_items
    save_recall_data(data)

    return {
        "status": "success",
        "username": username,
        "checkedCount": len(updated_items),
        "newRecallCount": len(newly_recalled_items),
        "newlyRecalledItems": newly_recalled_items,
    }


@app.post("/recall/check-all")
async def check_recall_for_all_users():
    data = load_recall_data()
    inventory_by_user = data.get("inventory_by_user", {})

    summary: list[dict[str, Any]] = []

    for username, items in inventory_by_user.items():
        updated_items, newly_recalled_items = await apply_recall_check_to_items(items)
        data["inventory_by_user"][username] = updated_items

        summary.append({
            "username": username,
            "checkedCount": len(updated_items),
            "newRecallCount": len(newly_recalled_items),
        })

    save_recall_data(data)

    return {
        "status": "success",
        "userCount": len(summary),
        "summary": summary,
    }


# ==================== AI 接口部分 ====================

GLOBAL_GEMINI_API_KEY = "AI..."

class AlternativeRequest(BaseModel):
    product_name: str
    allergens: str


@app.post("/ai/alternatives")
async def get_alternatives(req: AlternativeRequest):
    prompt = f"""
    You are a professional nutritionist. The user is allergic to or avoiding: [{req.allergens}].
    They just scanned a product that is unsafe for them: "{req.product_name}".
    Please suggest 3 safe alternative products or generic safe replacements.
    Return ONLY a valid JSON object in this exact format, nothing else:
    {{
      "alternatives": [
        {{ "name": "Alternative Name", "brand": "Brand Name or Generic", "reason": "Why it's safe" }}
      ]
    }}
    """

    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-pro-preview:generateContent?key={GLOBAL_GEMINI_API_KEY}"
    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {"temperature": 0.2},
    }

    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            response = await client.post(
                url,
                headers={"Content-Type": "application/json"},
                json=payload,
            )
            response.raise_for_status()
            raw_text = response.json()["candidates"][0]["content"]["parts"][0]["text"]

            match = re.search(r"\{.*\}", raw_text, re.DOTALL)
            if match:
                return {
                    "status": "success",
                    "data": json.loads(match.group(0)).get("alternatives", []),
                }
            raise ValueError("No JSON found")
    except httpx.HTTPStatusError as e:
        print("========== Gemini Alternatives Error (HTTP) ==========")
        print(e.response.text)
        return {"status": "error", "message": "Gemini API Error"}
    except Exception as e:
        print("========== Gemini Alternatives Error (Other) ==========")
        print(str(e))
        return {"status": "error", "message": "Failed to fetch AI recommendations."}


class ExplainRequest(BaseModel):
    ingredients: str
    allergens: str


@app.post("/ai/explain-ingredients")
async def explain_ingredients(req: ExplainRequest):
    if not req.ingredients or req.ingredients.strip() == "":
        return {
            "status": "success",
            "data": [{
                "name": "No Data",
                "explanation": "No ingredients information is available for this product.",
                "is_allergen": False,
            }]
        }

    prompt = f"""
    Analyze these food ingredients: {req.ingredients}.
    The user is allergic to or avoiding: {req.allergens}.
    Explain what each main ingredient is in very simple, short English.
    Identify if it contains the user's allergens.
    Return ONLY a valid JSON object in this exact format, nothing else:
    {{
      "explanations": [
        {{"name": "Ingredient Name", "explanation": "Simple explanation...", "is_allergen": true}}
      ]
    }}
    """

    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-pro-preview:generateContent?key={GLOBAL_GEMINI_API_KEY}"
    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {"temperature": 0.1},
    }

    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            response = await client.post(
                url,
                headers={"Content-Type": "application/json"},
                json=payload,
            )
            response.raise_for_status()
            raw_text = response.json()["candidates"][0]["content"]["parts"][0]["text"]

            match = re.search(r"\{.*\}", raw_text, re.DOTALL)
            if match:
                return {
                    "status": "success",
                    "data": json.loads(match.group(0)).get("explanations", []),
                }
            raise ValueError("No JSON found")
    except httpx.HTTPStatusError as e:
        print("========== Gemini Explain Error (HTTP) ==========")
        print(e.response.text)
        return {"status": "error", "message": "Gemini API Error"}
    except Exception as e:
        print("========== Gemini Explain Error (Other) ==========")
        print(str(e))
        return {"status": "error", "message": "Failed to explain ingredients."}


if __name__ == "__main__":
    print("VeroEat Backend is starting on http://0.0.0.0:8000")
    uvicorn.run(app, host="0.0.0.0", port=8000)