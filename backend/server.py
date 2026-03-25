from fastapi import FastAPI, APIRouter, HTTPException, Depends, Header
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional
import uuid
from datetime import datetime, timezone, timedelta
import jwt
import bcrypt

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

JWT_SECRET = "girogirotondo-secret-key-2024"
JWT_ALGORITHM = "HS256"

app = FastAPI()
api_router = APIRouter(prefix="/api")

# --- Pydantic Models ---

class LoginRequest(BaseModel):
    email: str
    password: str

class LoginResponse(BaseModel):
    token: str
    user: dict

class UserCreate(BaseModel):
    name: str
    email: str
    password: str
    role: str  # admin, teacher, parent
    class_id: Optional[str] = None
    child_id: Optional[str] = None

class ClassCreate(BaseModel):
    name: str
    teacher_id: Optional[str] = None

class StudentCreate(BaseModel):
    name: str
    class_id: str
    parent_id: Optional[str] = None
    date_of_birth: Optional[str] = None

class GrigliaEntry(BaseModel):
    class_id: str
    student_ids: List[str]
    date: str
    presence: bool = False
    bathroom: bool = False
    sleep: bool = False
    meal_first: bool = False
    meal_second: bool = False
    snack: bool = False
    notes: str = ""

class DiaryEntry(BaseModel):
    class_id: str
    date: str
    summary: str

class AppointmentCreate(BaseModel):
    parent_id: str
    date: str
    time_slot: str
    reason: str

class DocumentCreate(BaseModel):
    title: str
    description: str
    file_url: str

class ReadReceipt(BaseModel):
    document_id: str
    parent_id: str

class MediaUpload(BaseModel):
    class_id: str
    student_ids: List[str]
    media_url: str
    media_type: str  # photo or video
    caption: str = ""

# --- Auth Helpers ---

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()

def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode(), hashed.encode())

def create_token(user_id: str, role: str) -> str:
    payload = {
        "user_id": user_id,
        "role": role,
        "exp": datetime.now(timezone.utc) + timedelta(days=7)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

def decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

async def get_current_user(authorization: str = None):
    if not authorization:
        raise HTTPException(status_code=401, detail="No token provided")
    token = authorization.replace("Bearer ", "")
    payload = decode_token(token)
    user = await db.users.find_one({"id": payload["user_id"]}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user

# --- Seed Data ---

async def seed_database():
    existing = await db.users.find_one({"role": "admin"})
    if existing:
        return

    logger.info("Seeding database...")

    # Classes
    classes = [
        {"id": str(uuid.uuid4()), "name": "Farfalle", "teacher_id": None},
        {"id": str(uuid.uuid4()), "name": "Coccinelle", "teacher_id": None},
        {"id": str(uuid.uuid4()), "name": "Apine", "teacher_id": None},
    ]

    # Admin
    admin = {
        "id": str(uuid.uuid4()),
        "name": "Maria Rossi",
        "email": "admin@girogirotondo.it",
        "password": hash_password("admin123"),
        "role": "admin",
        "class_id": None,
        "child_id": None,
        "created_at": datetime.now(timezone.utc).isoformat()
    }

    # Teachers
    teachers = [
        {
            "id": str(uuid.uuid4()),
            "name": "Giulia Bianchi",
            "email": "giulia@girogirotondo.it",
            "password": hash_password("teacher123"),
            "role": "teacher",
            "class_id": classes[0]["id"],
            "child_id": None,
            "created_at": datetime.now(timezone.utc).isoformat()
        },
        {
            "id": str(uuid.uuid4()),
            "name": "Anna Verdi",
            "email": "anna@girogirotondo.it",
            "password": hash_password("teacher123"),
            "role": "teacher",
            "class_id": classes[1]["id"],
            "child_id": None,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
    ]

    classes[0]["teacher_id"] = teachers[0]["id"]
    classes[1]["teacher_id"] = teachers[1]["id"]

    # Students
    students = [
        {"id": str(uuid.uuid4()), "name": "Luca Marino", "class_id": classes[0]["id"], "parent_id": None, "date_of_birth": "2021-03-15", "child_code": "GGT-001"},
        {"id": str(uuid.uuid4()), "name": "Sofia Ferrari", "class_id": classes[0]["id"], "parent_id": None, "date_of_birth": "2021-06-22", "child_code": "GGT-002"},
        {"id": str(uuid.uuid4()), "name": "Marco Russo", "class_id": classes[0]["id"], "parent_id": None, "date_of_birth": "2021-01-10", "child_code": "GGT-003"},
        {"id": str(uuid.uuid4()), "name": "Emma Colombo", "class_id": classes[1]["id"], "parent_id": None, "date_of_birth": "2020-11-05", "child_code": "GGT-004"},
        {"id": str(uuid.uuid4()), "name": "Leonardo Ricci", "class_id": classes[1]["id"], "parent_id": None, "date_of_birth": "2021-08-18", "child_code": "GGT-005"},
    ]

    # Parents
    parents = [
        {
            "id": str(uuid.uuid4()),
            "name": "Paolo Marino",
            "email": "paolo@famiglia.it",
            "password": hash_password("parent123"),
            "role": "parent",
            "class_id": classes[0]["id"],
            "child_id": students[0]["id"],
            "created_at": datetime.now(timezone.utc).isoformat()
        },
        {
            "id": str(uuid.uuid4()),
            "name": "Laura Ferrari",
            "email": "laura@famiglia.it",
            "password": hash_password("parent123"),
            "role": "parent",
            "class_id": classes[0]["id"],
            "child_id": students[1]["id"],
            "created_at": datetime.now(timezone.utc).isoformat()
        },
        {
            "id": str(uuid.uuid4()),
            "name": "Andrea Colombo",
            "email": "andrea@famiglia.it",
            "password": hash_password("parent123"),
            "role": "parent",
            "class_id": classes[1]["id"],
            "child_id": students[3]["id"],
            "created_at": datetime.now(timezone.utc).isoformat()
        }
    ]

    students[0]["parent_id"] = parents[0]["id"]
    students[1]["parent_id"] = parents[1]["id"]
    students[3]["parent_id"] = parents[2]["id"]

    await db.users.insert_many([admin] + teachers + parents)
    await db.classes.insert_many(classes)
    await db.students.insert_many(students)

    # Seed griglia data
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    griglia_entries = []
    for s in students[:3]:
        griglia_entries.append({
            "id": str(uuid.uuid4()),
            "class_id": classes[0]["id"],
            "student_id": s["id"],
            "date": today,
            "presence": True,
            "bathroom": True,
            "sleep": s["name"] != "Marco Russo",
            "meal_first": True,
            "meal_second": True,
            "snack": True,
            "notes": "Giornata serena" if s == students[0] else "",
            "created_at": datetime.now(timezone.utc).isoformat()
        })
    await db.griglia.insert_many(griglia_entries)

    # Seed diary
    await db.diary.insert_many([
        {
            "id": str(uuid.uuid4()),
            "class_id": classes[0]["id"],
            "date": today,
            "summary": "Oggi abbiamo fatto attivita creative con colori a tempera. I bambini hanno dipinto il loro animale preferito. Dopo la merenda abbiamo giocato in giardino.",
            "created_at": datetime.now(timezone.utc).isoformat()
        }
    ])

    # Seed gallery
    gallery_items = [
        {
            "id": str(uuid.uuid4()),
            "class_id": classes[0]["id"],
            "student_ids": [students[0]["id"], students[1]["id"]],
            "media_url": "https://images.unsplash.com/photo-1627764940620-90393d0e8c34?w=600",
            "media_type": "photo",
            "caption": "Attivita in giardino",
            "uploaded_by": teachers[0]["id"],
            "created_at": datetime.now(timezone.utc).isoformat()
        },
        {
            "id": str(uuid.uuid4()),
            "class_id": classes[0]["id"],
            "student_ids": [students[0]["id"]],
            "media_url": "https://images.pexels.com/photos/5435599/pexels-photo-5435599.jpeg?w=600",
            "media_type": "photo",
            "caption": "Gioco con i blocchi",
            "uploaded_by": teachers[0]["id"],
            "created_at": datetime.now(timezone.utc).isoformat()
        },
        {
            "id": str(uuid.uuid4()),
            "class_id": classes[0]["id"],
            "student_ids": [students[1]["id"], students[2]["id"]],
            "media_url": "https://images.pexels.com/photos/3662648/pexels-photo-3662648.jpeg?w=600",
            "media_type": "photo",
            "caption": "Giochi creativi",
            "uploaded_by": teachers[0]["id"],
            "created_at": datetime.now(timezone.utc).isoformat()
        },
    ]
    await db.gallery.insert_many(gallery_items)

    # Seed meals
    await db.meals.insert_many([
        {
            "id": str(uuid.uuid4()),
            "class_id": classes[0]["id"],
            "date": today,
            "primo": "Pasta al pomodoro",
            "secondo": "Petto di pollo alla griglia",
            "contorno": "Carote al vapore",
            "frutta": "Mela",
            "merenda_mattina": "Crackers integrali",
            "merenda_pomeriggio": "Yogurt alla frutta",
            "created_at": datetime.now(timezone.utc).isoformat()
        }
    ])

    # Seed modulistica
    await db.documents.insert_many([
        {
            "id": str(uuid.uuid4()),
            "title": "Autorizzazione Gita Scolastica",
            "description": "Modulo di autorizzazione per la gita al parco naturale prevista per il 15 marzo.",
            "file_url": "https://example.com/docs/gita.pdf",
            "created_at": datetime.now(timezone.utc).isoformat()
        },
        {
            "id": str(uuid.uuid4()),
            "title": "Circolare N.5 - Orari Festivi",
            "description": "Comunicazione degli orari modificati durante il periodo festivo.",
            "file_url": "https://example.com/docs/circolare5.pdf",
            "created_at": datetime.now(timezone.utc).isoformat()
        },
        {
            "id": str(uuid.uuid4()),
            "title": "Informativa Privacy GDPR",
            "description": "Documento informativo sul trattamento dei dati personali.",
            "file_url": "https://example.com/docs/privacy.pdf",
            "created_at": datetime.now(timezone.utc).isoformat()
        }
    ])

    # Seed appointments
    await db.appointments.insert_many([
        {
            "id": str(uuid.uuid4()),
            "parent_id": parents[0]["id"],
            "parent_name": parents[0]["name"],
            "date": (datetime.now(timezone.utc) + timedelta(days=3)).strftime("%Y-%m-%d"),
            "time_slot": "10:00",
            "reason": "Colloquio su andamento scolastico",
            "status": "confirmed",
            "created_at": datetime.now(timezone.utc).isoformat()
        }
    ])

    logger.info("Database seeded successfully!")

# --- API Routes ---

@api_router.get("/")
async def root():
    return {"message": "Girogirotondo API"}

@api_router.post("/auth/login")
async def login(req: LoginRequest):
    user = await db.users.find_one({"email": req.email}, {"_id": 0})
    if not user or not verify_password(req.password, user["password"]):
        raise HTTPException(status_code=401, detail="Credenziali non valide")
    token = create_token(user["id"], user["role"])
    safe_user = {k: v for k, v in user.items() if k != "password"}
    return {"token": token, "user": safe_user}

@api_router.get("/auth/me")
async def get_me(authorization: Optional[str] = Header(None)):
    if not authorization:
        raise HTTPException(status_code=401, detail="No token provided")
    token = authorization.replace("Bearer ", "")
    payload = decode_token(token)
    user = await db.users.find_one({"id": payload["user_id"]}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    safe_user = {k: v for k, v in user.items() if k != "password"}
    return safe_user

# --- Users CRUD ---

@api_router.get("/users")
async def get_users():
    users = await db.users.find({}, {"_id": 0, "password": 0}).to_list(1000)
    return users

@api_router.post("/users")
async def create_user(user: UserCreate):
    existing = await db.users.find_one({"email": user.email})
    if existing:
        raise HTTPException(status_code=400, detail="Email gia in uso")
    user_dict = user.model_dump()
    user_dict["id"] = str(uuid.uuid4())
    user_dict["password"] = hash_password(user_dict["password"])
    user_dict["created_at"] = datetime.now(timezone.utc).isoformat()
    await db.users.insert_one(user_dict)
    del user_dict["password"]
    user_dict.pop("_id", None)
    return user_dict

@api_router.delete("/users/{user_id}")
async def delete_user(user_id: str):
    result = await db.users.delete_one({"id": user_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Utente non trovato")
    return {"message": "Utente eliminato"}

# --- Classes CRUD ---

@api_router.get("/classes")
async def get_classes():
    classes = await db.classes.find({}, {"_id": 0}).to_list(100)
    return classes

@api_router.post("/classes")
async def create_class(cls: ClassCreate):
    class_dict = cls.model_dump()
    class_dict["id"] = str(uuid.uuid4())
    await db.classes.insert_one(class_dict)
    class_dict.pop("_id", None)
    return class_dict

@api_router.delete("/classes/{class_id}")
async def delete_class(class_id: str):
    result = await db.classes.delete_one({"id": class_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Classe non trovata")
    return {"message": "Classe eliminata"}

# --- Students ---

@api_router.get("/students")
async def get_students(class_id: Optional[str] = None):
    query = {}
    if class_id:
        query["class_id"] = class_id
    students = await db.students.find(query, {"_id": 0}).to_list(1000)
    return students

@api_router.get("/students/{student_id}")
async def get_student(student_id: str):
    student = await db.students.find_one({"id": student_id}, {"_id": 0})
    if not student:
        raise HTTPException(status_code=404, detail="Studente non trovato")
    return student

@api_router.post("/students")
async def create_student(student: StudentCreate):
    student_dict = student.model_dump()
    student_dict["id"] = str(uuid.uuid4())
    student_dict["child_code"] = f"GGT-{str(uuid.uuid4())[:4].upper()}"
    await db.students.insert_one(student_dict)
    student_dict.pop("_id", None)
    return student_dict

# --- Griglia (Daily Grid) ---

@api_router.get("/griglia")
async def get_griglia(class_id: Optional[str] = None, date: Optional[str] = None, student_id: Optional[str] = None):
    query = {}
    if class_id:
        query["class_id"] = class_id
    if date:
        query["date"] = date
    if student_id:
        query["student_id"] = student_id
    entries = await db.griglia.find(query, {"_id": 0}).to_list(1000)
    return entries

@api_router.post("/griglia")
async def save_griglia(entry: GrigliaEntry):
    entries_created = []
    for sid in entry.student_ids:
        existing = await db.griglia.find_one({"student_id": sid, "date": entry.date, "class_id": entry.class_id})
        doc = {
            "id": str(uuid.uuid4()),
            "class_id": entry.class_id,
            "student_id": sid,
            "date": entry.date,
            "presence": entry.presence,
            "bathroom": entry.bathroom,
            "sleep": entry.sleep,
            "meal_first": entry.meal_first,
            "meal_second": entry.meal_second,
            "snack": entry.snack,
            "notes": entry.notes,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        if existing:
            await db.griglia.replace_one({"_id": existing["_id"]}, doc)
        else:
            await db.griglia.insert_one(doc)
        doc.pop("_id", None)
        entries_created.append(doc)
    return entries_created

# --- Diary ---

@api_router.get("/diary")
async def get_diary(class_id: Optional[str] = None, date: Optional[str] = None):
    query = {}
    if class_id:
        query["class_id"] = class_id
    if date:
        query["date"] = date
    entries = await db.diary.find(query, {"_id": 0}).to_list(100)
    return entries

@api_router.post("/diary")
async def create_diary(entry: DiaryEntry):
    doc = entry.model_dump()
    doc["id"] = str(uuid.uuid4())
    doc["created_at"] = datetime.now(timezone.utc).isoformat()
    await db.diary.insert_one(doc)
    doc.pop("_id", None)
    return doc

# --- Gallery ---

@api_router.get("/gallery")
async def get_gallery(class_id: Optional[str] = None, student_id: Optional[str] = None):
    query = {}
    if class_id:
        query["class_id"] = class_id
    if student_id:
        query["student_ids"] = student_id
    items = await db.gallery.find(query, {"_id": 0}).to_list(1000)
    return items

@api_router.post("/gallery")
async def upload_media(media: MediaUpload):
    doc = media.model_dump()
    doc["id"] = str(uuid.uuid4())
    doc["uploaded_by"] = ""
    doc["created_at"] = datetime.now(timezone.utc).isoformat()
    await db.gallery.insert_one(doc)
    doc.pop("_id", None)
    return doc

# --- Meals ---

@api_router.get("/meals")
async def get_meals(class_id: Optional[str] = None, date: Optional[str] = None):
    query = {}
    if class_id:
        query["class_id"] = class_id
    if date:
        query["date"] = date
    meals = await db.meals.find(query, {"_id": 0}).to_list(100)
    return meals

# --- Appointments ---

@api_router.get("/appointments")
async def get_appointments(parent_id: Optional[str] = None):
    query = {}
    if parent_id:
        query["parent_id"] = parent_id
    appointments = await db.appointments.find(query, {"_id": 0}).to_list(1000)
    return appointments

@api_router.post("/appointments")
async def create_appointment(apt: AppointmentCreate):
    parent = await db.users.find_one({"id": apt.parent_id}, {"_id": 0})
    doc = apt.model_dump()
    doc["id"] = str(uuid.uuid4())
    doc["parent_name"] = parent["name"] if parent else "Sconosciuto"
    doc["status"] = "pending"
    doc["created_at"] = datetime.now(timezone.utc).isoformat()
    await db.appointments.insert_one(doc)
    doc.pop("_id", None)
    return doc

@api_router.put("/appointments/{apt_id}/status")
async def update_appointment_status(apt_id: str, status: str):
    result = await db.appointments.update_one({"id": apt_id}, {"$set": {"status": status}})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Appuntamento non trovato")
    return {"message": "Stato aggiornato"}

# --- Modulistica / Documents ---

@api_router.get("/documents")
async def get_documents():
    docs = await db.documents.find({}, {"_id": 0}).to_list(100)
    return docs

@api_router.post("/documents")
async def create_document(doc: DocumentCreate):
    doc_dict = doc.model_dump()
    doc_dict["id"] = str(uuid.uuid4())
    doc_dict["created_at"] = datetime.now(timezone.utc).isoformat()
    await db.documents.insert_one(doc_dict)
    doc_dict.pop("_id", None)
    return doc_dict

@api_router.delete("/documents/{doc_id}")
async def delete_document(doc_id: str):
    await db.documents.delete_one({"id": doc_id})
    await db.read_receipts.delete_many({"document_id": doc_id})
    return {"message": "Documento eliminato"}

# --- Read Receipts ---

@api_router.get("/read-receipts")
async def get_read_receipts(document_id: Optional[str] = None, parent_id: Optional[str] = None):
    query = {}
    if document_id:
        query["document_id"] = document_id
    if parent_id:
        query["parent_id"] = parent_id
    receipts = await db.read_receipts.find(query, {"_id": 0}).to_list(1000)
    return receipts

@api_router.post("/read-receipts")
async def create_read_receipt(receipt: ReadReceipt):
    existing = await db.read_receipts.find_one({"document_id": receipt.document_id, "parent_id": receipt.parent_id})
    if existing:
        return {"message": "Gia preso visione"}
    doc = receipt.model_dump()
    doc["id"] = str(uuid.uuid4())
    doc["acknowledged_at"] = datetime.now(timezone.utc).isoformat()
    await db.read_receipts.insert_one(doc)
    doc.pop("_id", None)
    return doc

# --- Available Appointment Slots ---

@api_router.get("/appointment-slots")
async def get_appointment_slots(date: Optional[str] = None):
    slots = ["09:00", "09:30", "10:00", "10:30", "11:00", "11:30", "14:00", "14:30", "15:00", "15:30", "16:00"]
    if date:
        booked = await db.appointments.find({"date": date}, {"_id": 0}).to_list(100)
        booked_slots = [a["time_slot"] for a in booked]
        available = [s for s in slots if s not in booked_slots]
        return {"date": date, "available_slots": available, "booked_slots": booked_slots}
    return {"slots": slots}

# Include router
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

@app.on_event("startup")
async def startup():
    await seed_database()

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
