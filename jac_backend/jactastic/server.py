from fastapi import FastAPI
from pydantic import BaseModel
import subprocess
import json
import uvicorn
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

# 允许跨域请求（Expo 开发环境必需）
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

class User(BaseModel):
    name: str
    location: str = ""
    allergens: list = []
    dietary_preferences: list = []

@app.post("/walker/create_or_update_user")
def create_user(user: User):
    try:
        # 将用户数据作为 JSON 传递给 Jac
        cmd = [
            "jac",
            "run",
            "main.jac",
            "-a",
            json.dumps(user.dict())
        ]
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=10)
        return {"status": "success", "output": result.stdout}
    except Exception as e:
        return {"status": "error", "message": str(e)}

@app.post("/walker/get_user")
def get_user(user: User):
    try:
        cmd = [
            "jac",
            "run",
            "main.jac",
            "-a",
            json.dumps({"name": user.name})
        ]
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=10)
        return {"status": "success", "output": result.stdout}
    except Exception as e:
        return {"status": "error", "message": str(e)}

# 🚀 启动入口：解决你之前运行没反应的问题
if __name__ == "__main__":
    print("VeroEat Backend is starting on http://0.0.0.0:8000")
    uvicorn.run(app, host="0.0.0.0", port=8000)