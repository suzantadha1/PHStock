from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from supabase import create_client
from dotenv import load_dotenv
import os

load_dotenv(os.path.join(os.path.dirname(__file__), '.env'))

supabase = create_client(
    os.getenv("SUPABASE_URL"),
    os.getenv("SUPABASE_SERVICE_KEY")
)

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "https://phstock.vercel.app"
        ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class CreateUserRequest(BaseModel):
    username: str
    password: str
    role: str
    location_id: int | None = None

class DeleteUserRequest(BaseModel):
    user_id: str

@app.post("/users/create")
async def create_user(req: CreateUserRequest):
    email = f"{req.username.strip().lower()}@phstock.local"
    try:
        res = supabase.auth.admin.create_user({
            "email": email,
            "password": req.password,
            "email_confirm": True
        })
        user_id = res.user.id
        supabase.table("profiles").insert({
            "id": user_id,
            "full_name": req.username.strip(),
            "role": req.role,
            "location_id": req.location_id if req.role == "worker" else None
        }).execute()
        return {"success": True, "user_id": user_id}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.delete("/users/delete")
async def delete_user(req: DeleteUserRequest):
    try:
        supabase.auth.admin.delete_user(req.user_id)
        supabase.table("profiles").delete().eq("id", req.user_id).execute()
        return {"success": True}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))