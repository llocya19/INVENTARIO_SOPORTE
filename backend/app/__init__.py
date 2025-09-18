# backend/app/__init__.py
import os
from flask import Flask, send_from_directory
from flask_cors import CORS

def create_app():
    app = Flask(__name__, instance_relative_config=True)
    CORS(app, supports_credentials=True)

    from app.routes.auth_routes import bp as auth_bp
    from app.routes.users_routes import bp as users_bp
    from app.routes.reports_routes import bp as reports_bp
    from app.routes.areas_routes import bp as areas_bp
    from app.routes.items_routes import bp as items_bp
    from app.routes.spec_routes import bp as spec_bp
    from app.routes.media_routes import bp as media_bp
    from app.routes.equipos_routes import bp as equipos_bp
    app.register_blueprint(spec_bp)
    app.register_blueprint(media_bp)

    app.register_blueprint(items_bp)
    app.register_blueprint(auth_bp)
    app.register_blueprint(users_bp)
    app.register_blueprint(reports_bp)
    app.register_blueprint(areas_bp)
    app.register_blueprint(equipos_bp)



    @app.get("/health")
    def health(): return {"ok": True}
    
   
    @app.route("/uploads/<path:filename>")
    def _uploads(filename):
        updir = os.path.join(app.instance_path, "uploads")
        return send_from_directory(updir, filename)

    return app 
