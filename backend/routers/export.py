"""Router Export — CSV per segreteria/commercialista. Solo admin, filtrato per sede.

Ogni endpoint restituisce un file CSV (text/csv, separatore ';', BOM per Excel IT).
"""
from typing import Optional
from fastapi import APIRouter, Depends, Header
from fastapi.responses import Response

from services.database import get_db
from services import export_service as exp
from middleware.auth import get_current_user, validate_admin_sede_access

router = APIRouter(prefix="/api/export", tags=["export"])


def _csv_response(content: str, filename: str) -> Response:
    return Response(
        content=content,
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/addebiti.csv")
async def export_addebiti(
    current_user: dict = Depends(get_current_user),
    x_sede_id: Optional[str] = Header(None),
):
    sede_id = await validate_admin_sede_access(current_user, x_sede_id)
    return _csv_response(await exp.addebiti_csv(get_db(), sede_id), f"addebiti-{sede_id}.csv")


@router.get("/pagamenti.csv")
async def export_pagamenti(
    current_user: dict = Depends(get_current_user),
    x_sede_id: Optional[str] = Header(None),
):
    sede_id = await validate_admin_sede_access(current_user, x_sede_id)
    return _csv_response(await exp.pagamenti_csv(get_db(), sede_id), f"pagamenti-{sede_id}.csv")


@router.get("/anagrafiche.csv")
async def export_anagrafiche(
    current_user: dict = Depends(get_current_user),
    x_sede_id: Optional[str] = Header(None),
):
    sede_id = await validate_admin_sede_access(current_user, x_sede_id)
    return _csv_response(await exp.anagrafiche_csv(get_db(), sede_id), f"anagrafiche-{sede_id}.csv")


@router.get("/sidi-alunni.csv")
async def export_sidi(
    current_user: dict = Depends(get_current_user),
    x_sede_id: Optional[str] = Header(None),
):
    sede_id = await validate_admin_sede_access(current_user, x_sede_id)
    return _csv_response(await exp.sidi_alunni_csv(get_db(), sede_id), f"sidi-alunni-{sede_id}.csv")
