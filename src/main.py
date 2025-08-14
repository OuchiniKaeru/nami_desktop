import os
import sys
from dotenv import load_dotenv

load_dotenv()

import uuid
import time
import json
import subprocess
import platform
import shutil
from fastapi import FastAPI, Request, File, UploadFile, HTTPException, Form
from fastapi.responses import HTMLResponse, StreamingResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from .core.task.task import Task
from .core.task.setting_load import McpSettingsUpdate, McpHub
from .core.storage import database
from .core.context.context_management.thread_loader import create_chat_history
from agno.exceptions import ModelProviderError
from agno.tools.mcp import MultiMCPTools

# --------------- グローバル変数 ---------------
active_tasks = {}
global_mcp_hub = None
global_mcp_tools = None
if getattr(sys, 'frozen', False):
    # exe 実行時
    BASE_DIR = os.path.dirname(sys.executable)
else:
    BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# 外部フォルダのパスを指定
project_root = os.path.dirname(BASE_DIR)
mcp_setting_path = os.path.join(project_root, ".nami", "mcp_setting.json")
setting_path = os.path.join(project_root, ".nami", "setting.json")
upload_dir_path = os.path.join(project_root, "uploads")

# --------------- app設定 ---------------
app = FastAPI()

# Mount the static directory
app.mount("/static", StaticFiles(directory=os.path.join(BASE_DIR, "static")), name="static")
app.mount("/base_dir", StaticFiles(directory=os.path.dirname(BASE_DIR)), name="base_dir")

templates = Jinja2Templates(directory=os.path.join(BASE_DIR, "templates"))

# --------------- MCP設定 ---------------
def load_mcp_hub():
    if os.path.exists(mcp_setting_path):
        with open(mcp_setting_path, "r", encoding="utf-8") as f:
            mcp_settings = json.load(f)
        return McpHub(mcp_servers=mcp_settings.get("mcpServers", {}))
    else:
        return McpHub()

def load_mcp_tools(mcp_hub: McpHub):
    mcp_tools = MultiMCPTools(
        commands=mcp_hub.commands,
        urls=mcp_hub.urls,
        env=mcp_hub.envs,
        timeout_seconds=7200
    )
    return mcp_tools

async def async_init_mcp():
    global global_mcp_hub, global_mcp_tools
    global_mcp_hub = load_mcp_hub()
    global_mcp_tools = load_mcp_tools(global_mcp_hub)
    
    # 全てのサーバーを初期状態に設定
    for server_name in global_mcp_hub.get_server_statuses().keys():
        global_mcp_hub.update_server_status(server_name, "connecting")

    try:
        await global_mcp_tools.connect()
        # 接続成功した場合、全てのサーバーを"ok"に設定
        for server_name in global_mcp_hub.get_server_statuses().keys():
            global_mcp_hub.update_server_status(server_name, "ok")
    except Exception as e:
        print(f"ERROR: MCP connection failed: {e}")
        # 接続失敗した場合、全てのサーバーを"error"に設定
        for server_name in global_mcp_hub.get_server_statuses().keys():
            global_mcp_hub.update_server_status(server_name, "error")

# リロード用関数
async def async_reload_mcp():
    global global_mcp_hub, global_mcp_tools
    global_mcp_hub = load_mcp_hub()
    global_mcp_tools = load_mcp_tools(global_mcp_hub)

    # 全てのサーバーを初期状態に設定
    for server_name in global_mcp_hub.get_server_statuses().keys():
        global_mcp_hub.update_server_status(server_name, "connecting")

    try:
        await global_mcp_tools.connect()
        # 接続成功した場合、全てのサーバーを"ok"に設定
        for server_name in global_mcp_hub.get_server_statuses().keys():
            global_mcp_hub.update_server_status(server_name, "ok")
    except Exception as e:
        print(f"ERROR: MCP reload failed: {e}")
        # 接続失敗した場合、全てのサーバーを"error"に設定
        for server_name in global_mcp_hub.get_server_statuses().keys():
            global_mcp_hub.update_server_status(server_name, "error")

async def ensure_mcp_connected():
    global global_mcp_tools
    if global_mcp_tools is None or not global_mcp_tools.is_connected():
        await async_init_mcp()

# --------------- 機能関数 ---------------
def generate_safe_filename(filename):
    """安全なファイル名を生成する関数"""
    import re
    import time
    
    if not filename:
        timestamp = int(time.time() * 1000)
        return f"uploaded_file_{timestamp}"
    
    # 危険な文字を除去
    safe_name = re.sub(r'[<>:"/\\|?*]', '_', filename)
    
    # ファイル名が長すぎる場合は短縮
    name, ext = os.path.splitext(safe_name)
    if len(name) > 100:
        name = name[:100]
    
    # タイムスタンプを追加してユニーク性を保証
    timestamp = int(time.time() * 1000)
    return f"{name}_{timestamp}{ext}"

# --------------- 基本機能 ---------------
@app.on_event("startup")
async def on_startup():
    await async_init_mcp()

@app.get("/", response_class=HTMLResponse)
async def read_root(request: Request):
    return templates.TemplateResponse("index.html", {"request": request})

@app.post("/task")
async def start_task(
    task: str = Form(...),
    session_id: str | None = Form(None),
    files: list[UploadFile] = File([])
):
    print(f"DEBUG: Received POST request to /task. Task: {task}, Session ID: {session_id}, Files: {[f.filename for f in files]}") # デバッグログ追加
    if not os.environ.get("GOOGLE_API_KEY"):
        raise HTTPException(status_code=400, detail="GOOGLE_API_KEY environment variable not set.")

    # セッションIDの取得または生成
    session_id = session_id if session_id else str(uuid.uuid4())
    print(f"task: {session_id}")

    # データベースからスレッドIDを取得または作成
    thread_id = database.get_thread_id_by_session_id(session_id)
    if thread_id is None:
        title = task[:200]
        print(f"titleを表示: {title}")
        thread_id = database.create_thread(title=title, session_id=session_id)
    print(f"DEBUG: Thread ID obtained/created: {thread_id}") # デバッグログ追加

    # アップロードされたファイルを保存
    uploaded_file_paths = []
    uploaded_image_paths = []
    if not os.path.exists(upload_dir_path):
        os.makedirs(upload_dir_path)

    for file in files:
        # ファイル名の重複を防ぐために、ユニークな名前を生成
        safe_filename = generate_safe_filename(file.filename)
        file_location = os.path.join(upload_dir_path, safe_filename)
        
        # 同じファイル名が既に存在する場合は、さらにユニークな名前を生成
        counter = 1
        while os.path.exists(file_location):
            name, ext = os.path.splitext(safe_filename)
            file_location = os.path.join(upload_dir_path, f"{name}_{counter}{ext}")
            counter += 1
        
        try:
            with open(file_location, "wb+") as file_object:
                shutil.copyfileobj(file.file, file_object)
            # 画像ファイルの場合はuploaded_image_pathsに、それ以外はuploaded_file_pathsに追加
            if file.content_type and file.content_type.startswith("image/"):
                uploaded_image_paths.append(file_location)
                print(f"DEBUG: Image file saved: {file_location}")
            else:
                uploaded_file_paths.append(file_location)
                print(f"DEBUG: File saved: {file_location}")
        except Exception as e:
            print(f"ERROR: Failed to save file {file.filename}: {e}")
            raise HTTPException(status_code=500, detail=f"ファイル '{file.filename}' の保存に失敗しました: {str(e)}")

    # Task生成時にmcp_toolsとアップロードされたファイルのパスを渡す
    task_instance = Task(
        session_id,
        task,
        mcp_hub=global_mcp_hub,
        mcp_tools=global_mcp_tools,
        uploaded_files=uploaded_file_paths,
        uploaded_images=uploaded_image_paths
    )
    active_tasks[session_id] = task_instance

    async def generate_stream():
        final_response_content = ""
        task_completed = False
        
        try:
            await task_instance.initialize_and_run(task)

            async for chunk in task_instance.process_responses():
                yield chunk

                if "event: content" in chunk:
                    try:
                        data_part = chunk.split("data: ", 1)[1].strip()
                        content_json = json.loads(data_part)
                        if "content" in content_json:
                            final_response_content = content_json["content"]
                    except (json.JSONDecodeError, IndexError):
                        pass
                
                if "event: end" in chunk:
                    task_completed = True
                    break
            
            print("DEBUG: Stream generation completed")
            
        except Exception as e:
            print(f"ERROR: Exception in generate_stream: {e}")
            yield f"event: error\ndata: {json.dumps({'error': str(e)})}\n\n"
        finally:
            # クリーンアップ処理
            await task_instance.cleanup()
            if session_id in active_tasks:
                del active_tasks[session_id]

    return StreamingResponse(generate_stream(), media_type="text/event-stream")

@app.post("/stop_agent")
async def stop_agent(request: Request):
    data = await request.json()
    session_id = data.get("session_id")
    if session_id and session_id in active_tasks:
        task = active_tasks[session_id]
        task.stop_requested = True # 停止フラグを設定
        print(f"Agent for session {session_id} stop requested.")
        # タスクが完全に停止するまで待つ必要はないため、すぐにレスポンスを返す
        time.sleep(0.5)
        del active_tasks[session_id] # 停止したタスクをリストから削除
        return {"message": f"Agent for session {session_id} stop requested successfully."}

# --------------- スレッド ---------------
@app.get("/threads")
async def get_threads():
    threads = database.get_threads()
    return [{"id": thread["id"], "title": thread["title"], "session_id": thread["session_id"]} for thread in threads]

@app.post("/chat-search")
async def chat_search(request: Request):
    data = await request.json()
    query = (data.get("query") or "").strip()
    if not query:
        threads = database.get_threads()
    else:
        threads = database.search_threads_and_agent_sessions(query)
    return [{"id": t["id"], "title": t["title"], "session_id": t["session_id"]} for t in threads]

@app.get("/threads/{session_id}")
async def get_thread_messages(session_id: str):
    memories = database.get_messages_for_thread(session_id)
    memories = json.dumps(memories)
    chat_history = create_chat_history(memories)
    result = [{"sender": msg["role"], "content": msg["content"]} for msg in chat_history]
    return result

@app.delete("/threads/{session_id}")
async def delete_thread(session_id: str):
    database.delete_thread(session_id)
    return {"message": f"Thread {session_id} deleted"}

# --------------- MCP ---------------
@app.get("/mcp_settings")
async def get_mcp_settings():
    if os.path.exists(mcp_setting_path):
        with open(mcp_setting_path, "r", encoding="utf-8") as f:
            return json.load(f)
    return {"mcpServers": {}}

@app.put("/mcp_settings")
async def update_mcp_settings(settings_update: McpSettingsUpdate):
    current_mcp_settings = {}
    if os.path.exists(mcp_setting_path):
        with open(mcp_setting_path, "r", encoding="utf-8") as f:
            current_mcp_settings = json.load(f)
    
    # mcpServersセクションを更新
    if "mcpServers" not in current_mcp_settings:
        current_mcp_settings["mcpServers"] = {}

    for server_name, server_info in settings_update.mcpServers.items():
        if server_name not in current_mcp_settings["mcpServers"]:
            current_mcp_settings["mcpServers"][server_name] = {}
        current_mcp_settings["mcpServers"][server_name].update(server_info)

    with open(mcp_setting_path, "w", encoding="utf-8") as f:
        json.dump(current_mcp_settings, f, indent=4)
    
    # MCP HubとToolsをリロードして変更を適用
    await async_reload_mcp()
    
    return {"message": "MCP settings updated successfully"}

@app.get("/mcp_status")
async def get_mcp_status():
    global global_mcp_hub
    
    mcp_settings_from_file = {}
    if os.path.exists(mcp_setting_path):
        with open(mcp_setting_path, "r", encoding="utf-8") as f:
            mcp_settings_from_file = json.load(f).get("mcpServers", {})

    if global_mcp_hub:
        current_statuses = global_mcp_hub.get_server_statuses()
        # ファイルからのdisabled情報と現在のステータス情報をマージ
        merged_statuses = {}
        for server_name, status_info in current_statuses.items():
            merged_statuses[server_name] = {
                **status_info,
                "disabled": mcp_settings_from_file.get(server_name, {}).get("disabled", False)
            }
        return merged_statuses
    return {"error": "MCP Hub not initialized"}, 500

@app.post("/mcp_reload")
async def reload_mcp():
    await async_reload_mcp()
    return {"message": "MCP reloaded successfully"}

# --------------- 設定 ---------------
@app.get("/settings")
async def get_settings():
    if os.path.exists(setting_path):
        with open(setting_path, "r", encoding="utf-8") as f:
            return json.load(f)
    return {}

@app.put("/settings") # POSTからPUTに変更
async def update_settings(settings: dict):
    current_settings = {}
    if os.path.exists(setting_path):
        with open(setting_path, "r", encoding="utf-8") as f:
            current_settings = json.load(f)
    
    # 既存の設定を更新し、新しい設定をマージ
    current_settings.update(settings)

    with open(setting_path, "w", encoding="utf-8") as f:
        json.dump(current_settings, f, indent=4)
    return {"message": "Settings updated successfully"}

@app.post("/delete_rule")
async def delete_rule(request: Request):
    data = await request.json()
    file_to_delete = data.get("file")

    if not file_to_delete:
        raise HTTPException(status_code=400, detail="File path is required")

    current_settings = {}
    if os.path.exists(setting_path):
        with open(setting_path, "r", encoding="utf-8") as f:
            current_settings = json.load(f)

    rules = current_settings.get("rules", [])

    updated_rules = [rule for rule in rules if rule.get("file") != file_to_delete]

    if len(rules) == len(updated_rules):
        raise HTTPException(status_code=404, detail=f"Rule for file '{file_to_delete}' not found.")

    current_settings["rules"] = updated_rules

    print(current_settings)
    print(os.path.abspath(setting_path))

    with open(setting_path, "w", encoding="utf-8") as f:
        f.write(json.dumps(current_settings, indent=4))
    
    return {"message": f"Rule for file '{file_to_delete}' deleted successfully."}

@app.post("/open_rule_file")
async def open_rule_file(request: dict):
    """Open a rule file in the system's default text editor (notepad on Windows)"""
    try:
        file_path = request.get("file_path")
        if not file_path:
            raise HTTPException(status_code=400, detail="file_path is required")

        if str(file_path).startswith("."):
            rule_file_path = os.path.join(project_root, file_path)
        else:
            rule_file_path = str(file_path)

        if not os.path.exists(rule_file_path):
            with open(rule_file_path, "w", encoding="utf-8") as f:
                pass  # 空ファイルを新規作成
        
        if not str(rule_file_path).startswith(str(project_root)):
            raise HTTPException(status_code=403, detail="Access denied")

        system = platform.system()        
        if system == "Windows":
            subprocess.Popen(["notepad.exe", str(rule_file_path)])
        elif system == "Darwin":  # macOS
            subprocess.Popen(["open", "-a", "TextEdit", str(rule_file_path)])
        elif system == "Linux":
            editors = ["gedit", "nano", "vim", "code"]
            for editor in editors:
                try:
                    subprocess.Popen([editor, str(rule_file_path)])
                    break
                except FileNotFoundError:
                    continue
            else:
                subprocess.Popen(["xdg-open", str(rule_file_path)])
        else:
            raise HTTPException(status_code=501, detail="Unsupported operating system")
        
        return {"message": f"Opened {file_path} in text editor"}
        
    except subprocess.SubprocessError as e:
        raise HTTPException(status_code=500, detail=f"Failed to open file: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error opening file: {str(e)}")

# --------------- ユーザーメモリ ---------------
@app.get("/memory")
async def get_memories():
    user_id = ""
    memory_list = []
    if os.path.exists(setting_path):
        with open(setting_path, "r", encoding="utf-8") as f:
            settings = json.load(f)
        user_id = settings.get("user_id")
    memory_list = database.get_user_memory(user_id)
    return memory_list

@app.delete("/memory/{memory_id}")
async def delete_memory(memory_id: str):
    try:
        success = database.delete_user_memory(memory_id)
        if success:
            return {"message": "Memory deleted successfully"}
        else:
            raise HTTPException(status_code=404, detail="Memory not found")
    except Exception as e:
        print(f"Error deleting memory: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@app.get("/all_memory")
async def delete_all_memory():
    user_id = ""
    if os.path.exists(setting_path):
        with open(setting_path, "r", encoding="utf-8") as f:
            settings = json.load(f)
        user_id = settings.get("user_id")
    try:
        success = database.delete_all_user_memory(user_id)
        if success:
            return {"message": "Memory deleted successfully"}
        else:
            raise HTTPException(status_code=404, detail="Memory not found")
    except Exception as e:
        print(f"Error deleting memory: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

# --------------- 機能 ---------------
# 複数ファイルのアップロードに対応する
@app.post("/upload")
async def upload_multiple_files(files: list[UploadFile] = File(...)):
    uploaded_files = []
    
    try:
        for file in files:
            file_path = os.path.join(upload_dir_path, file.filename)
            
            with open(file_path, "wb") as buffer:
                shutil.copyfileobj(file.file, buffer)
            
            uploaded_files.append({
                "filename": file.filename,
                "size": file.size
            })
        
        return JSONResponse(
            status_code=200,
            content={
                "message": f"{len(uploaded_files)} 個のファイルがアップロードされました",
                "files": uploaded_files
            }
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"アップロードに失敗しました: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
