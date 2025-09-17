from flask import Flask, send_from_directory
from app import create_app
import os

app = create_app()

# servir archivos subidos
@app.route("/uploads/<path:name>")
def uploads(name):
    updir = os.path.join(app.instance_path, "uploads")
    return send_from_directory(updir, name)

if __name__ == "__main__":
    app.run(port=5000)
