import threading
import uvicorn
import webview
import requests
import time
import os
import sys

if getattr(sys, 'frozen', False):
    INTERNAL_BASE = sys._MEIPASS
    PROJECT_ROOT = os.path.dirname(INTERNAL_BASE)
    if PROJECT_ROOT not in sys.path:
        sys.path.insert(0, PROJECT_ROOT)
else:
    # スクリプト実行時
    INTERNAL_BASE = os.path.dirname(os.path.abspath(__file__))

from src.main import app

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
    loading_path = os.path.abspath(os.path.join(INTERNAL_BASE, "templates", "loading.html"))
    icon_path = os.path.abspath(os.path.join(INTERNAL_BASE, "static", "icon.png"))
    window = webview.create_window(
        "My App",
        f"file:///{loading_path}",
        maximized=True,
        text_select=True,
    )
    threading.Thread(target=wait_and_load, args=(window,), daemon=True).start()
    webview.settings['OPEN_DEVTOOLS_IN_DEBUG'] = False
    webview.start(icon=icon_path, debug=True)