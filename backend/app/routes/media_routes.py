import os
from flask import Blueprint, request, jsonify, current_app
from werkzeug.utils import secure_filename
from app.core.security import require_auth
from app.models.media_model import add_media

bp = Blueprint("media", __name__, url_prefix="/api/items")

ALLOWED = {"png","jpg","jpeg","webp","gif"}

@bp.post("/<int:item_id>/media")
@require_auth
def upload_media(item_id: int):
    files = request.files.getlist("files")
    if not files: return {"error":"Sin archivos"}, 400

    saved = []
    updir = os.path.join(current_app.instance_path, "uploads")
    os.makedirs(updir, exist_ok=True)

    for f in files:
        ext = (f.filename.rsplit(".",1)[-1] or "").lower()
        if ext not in ALLOWED:
            return {"error": f"Extensión no permitida: {ext}"}, 400
        fname = secure_filename(f.filename)
        path = os.path.join(updir, fname)
        f.save(path)
        # guardamos ruta relativa pública
        rel = f"/uploads/{fname}"
        add_media(request.claims["username"], item_id, rel, es_principal=False, orden=None)
        saved.append(rel)

    return jsonify({"ok": True, "files": saved})
