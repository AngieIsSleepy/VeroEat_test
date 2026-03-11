from fastapi import FastAPI
from pydantic import BaseModel
import subprocess
import json

app = FastAPI()

class User(BaseModel):
    name: str
    location: str = ""
    allergens: list = []
    dietary_preferences: list = []

@app.post("/walker/create_or_update_user")
def create_user(user: User):
    cmd = [
        "jac",
        "run",
        "main.jac",
        "-a",
        json.dumps(user.dict())
    ]
    result = subprocess.run(cmd, capture_output=True, text=True)
    return {"result": result.stdout}

@app.post("/walker/get_user")
def get_user(user: User):
    cmd = [
        "jac",
        "run",
        "main.jac",
        "-a",
        json.dumps(user.dict())
    ]
    result = subprocess.run(cmd, capture_output=True, text=True)
    return {"result": result.stdout}