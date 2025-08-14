import threading
import uvicorn
import webview
import requests
import time
import os
import sys
from src.main import app

if getattr(sys, 'frozen', False):
    # exe 実行時
    BASE_DIR = os.path.dirname(sys.executable)
else:
    # スクリプト実行時
    BASE_DIR = os.path.dirname(os.path.abspath(__file__))

def start_server():
    uvicorn.run(app, host="127.0.0.1", port=8000)

def wait_and_load(window):
    while True:
        try:
            requests.get("http://127.0.0.1:8000")
            break
        except requests.exceptions.ConnectionError:
            time.sleep(0.2)
    window.load_url("http://127.0.0.1:8000")

if __name__ == "__main__":
    threading.Thread(target=start_server, daemon=True).start()
    loading_path = os.path.abspath(os.path.join(BASE_DIR, "templates", "loading.html"))
    icon_path = os.path.abspath(os.path.join(BASE_DIR, "static", "icon.png"))
    window = webview.create_window(
        "My App",
        f"file:///{loading_path}",
        maximized=True
    )
    threading.Thread(target=wait_and_load, args=(window,), daemon=True).start()
    webview.start(icon=icon_path)