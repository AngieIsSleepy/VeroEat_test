from fastapi import FastAPI
from pydantic import BaseModel, Field
import subprocess
import json
import uvicorn
from fastapi.middleware.cors import CORSMiddleware
from pathlib import Path
from typing import Any, Optional
from datetime import datetime
import time

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
    
MOCK_RECALLS = {
        "1234567890123": {
            "title": "Mock Recall: Peanut Butter Product",
            "reason": "Potential salmonella contamination.",
        },
        "04963406": {
            "title": "Mock Recall: Snack Product",
            "reason": "Undeclared milk allergen.",
        },
        "0000000000000": {
            "title": "Mock Recall: Test Product",
            "reason": "Packaging defect may affect safety.",
        },
}


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

        # Mirror into fast local cache
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
    This keeps Jac in the project for create/update, while making reads fast.
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

        # Fallback: no cache found
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

def current_timestamp_ms() -> int:
    return int(time.time() * 1000)


def apply_recall_check_to_items(items: list[dict[str, Any]]) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    checked_at = current_timestamp_ms()
    updated_items: list[dict[str, Any]] = []
    newly_recalled_items: list[dict[str, Any]] = []

    for item in items:
        barcode = item.get("barcode", "")
        recall_info = MOCK_RECALLS.get(barcode)

        updated_item = {**item}
        updated_item["lastRecallCheckedAt"] = checked_at

        if recall_info:
            was_already_recalled = updated_item.get("recallStatus") == "recalled"

            updated_item["recallStatus"] = "recalled"
            updated_item["recallTitle"] = recall_info["title"]
            updated_item["recallReason"] = recall_info["reason"]
            updated_item["recalledAt"] = updated_item.get("recalledAt") or checked_at

            if not was_already_recalled:
                newly_recalled_items.append(updated_item)
        else:
            # 保持未召回状态；这里先不主动清空旧 recall，避免 demo 过程中状态来回跳
            updated_item["recallStatus"] = updated_item.get("recallStatus", "none") or "none"

        updated_items.append(updated_item)

    return updated_items, newly_recalled_items


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

@app.post("/recall/check/{username}")
def check_recall_for_user(username: str):
    data = load_recall_data()

    items = data["inventory_by_user"].get(username, [])
    updated_items, newly_recalled_items = apply_recall_check_to_items(items)

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
def check_recall_for_all_users():
    data = load_recall_data()
    inventory_by_user = data.get("inventory_by_user", {})

    summary: list[dict[str, Any]] = []

    for username, items in inventory_by_user.items():
        updated_items, newly_recalled_items = apply_recall_check_to_items(items)
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

if __name__ == "__main__":
    print("VeroEat Backend is starting on http://0.0.0.0:8000")
    uvicorn.run(app, host="0.0.0.0", port=8000)