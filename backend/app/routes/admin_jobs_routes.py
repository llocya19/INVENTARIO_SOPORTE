from flask import Blueprint, jsonify
from app.core.security import require_roles
from app.jobs.notifs_job import send_pending_notifs

bp = Blueprint("admin_jobs", __name__, url_prefix="/api/admin/jobs")

@bp.post("/send-notifs")
@require_roles(["ADMIN"])
def run_send_notifs():
    n, ids = send_pending_notifs("admin-job")
    return jsonify({"sent": n, "ids": ids})
