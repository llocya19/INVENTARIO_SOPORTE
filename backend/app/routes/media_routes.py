# app/routes/media_routes.py
import os
from flask import Blueprint, request, jsonify, current_app
from werkzeug.utils import secure_filename
from app.core.security import require_auth, require_roles
from app.models.media_model import add_media, delete_media

bp = Blueprint("item_media", __name__, url_prefix="/api/items")

ALLOWED = {"png", "jpg", "jpeg", "webp", "gif"}

@bp.post("/<int:item_id>/media")
@require_auth
def upload_item_media(item_id: int):
    """
    Sube una o más imágenes para el item_id dado.
    - Espera 'files' (input multiple) en multipart/form-data.
    - Guarda en instance/uploads con nombre único.
    - Registra cada archivo vía add_media (no principal por defecto).
    """
    files = request.files.getlist("files")
    if not files:
        return {"error": "Sin archivos"}, 400

    updir = os.path.join(current_app.instance_path, "uploads")
    os.makedirs(updir, exist_ok=True)

    saved = []
    for f in files:
        # Validar extensión
        ext = (f.filename.rsplit(".", 1)[-1] or "").lower()
        if ext not in ALLOWED:
            return {"error": f"Extensión no permitida: {ext}"}, 400

        # Nombre seguro y único
        srcname = f.filename or f"img.{ext}"
        fname = secure_filename(srcname)
        if not fname:
            fname = f"img.{ext}"
        path_fs = os.path.join(updir, fname)
        base, ex = os.path.splitext(fname)
        i = 1
        while os.path.exists(path_fs):
            fname = f"{base}_{i}{ex}"
            path_fs = os.path.join(updir, fname)
            i += 1

        # Guardar a disco
        f.save(path_fs)

        # Ruta pública (sirve /uploads desde instance/)
        rel = f"/uploads/{fname}"

        # Registrar en BD
        err = add_media(request.claims["username"], item_id, rel, es_principal=False, orden=None)
        if err:
            # revertir archivo si falla BD
            try:
                os.remove(path_fs)
            except Exception:
                pass
            return {"error": err}, 400

        saved.append(rel)

    return jsonify({"ok": True, "files": saved})


@bp.delete("/<int:item_id>/media")
@require_auth
@require_roles(["ADMIN", "PRACTICANTE"])
def remove_item_media(item_id: int):
    """
    Elimina una imagen del item. Acepta 'path' por query o JSON body.
    """
    path = (request.args.get("path") or "").strip()
    if not path:
        data = request.get_json(silent=True) or {}
        path = (data.get("path") or "").strip()
    if not path:
        return {"error": "path requerido"}, 400

    err = delete_media(request.claims["username"], item_id, path)
    if err:
        return {"error": err}, 400
    return {"ok": True}
