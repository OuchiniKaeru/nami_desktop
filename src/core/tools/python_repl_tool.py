import subprocess
import tempfile
import os
import sys
import json

def code_executor(code: str) -> str:
    """Pythonコードをsubprocessで実行します。

    Args:
        code: 実行するPythonコード文字列

    Returns:
        コード実行の出力
    """
    try:
        if getattr(sys, 'frozen', False):
            # exe 実行時
            BASE_DIR = os.path.dirname(sys.executable)
        else:
            BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
        project_dir = os.path.dirname(BASE_DIR)
        setting_path = os.path.join(project_dir, ".nami", "setting.json")

        with open(setting_path, "r", encoding="utf-8") as f:
            settings = json.load(f)
        output_dir = settings.get("user_dir")

        if not os.path.exists(output_dir):
            os.makedirs(output_dir, exist_ok=True)

        # 一時ファイルにコードを書き込む
        with tempfile.NamedTemporaryFile(mode="w", suffix=".py", delete=False, encoding="utf-8") as tmp_file:
            tmp_file.write(code)
            tmp_file_path = os.path.join(output_dir, tmp_file.name)

        # サブプロセスでPythonコードを実行
        result = subprocess.run(
            [sys.executable, tmp_file_path],
            capture_output=True,
            text=True,
            timeout=240
        )

        # 一時ファイルを削除
        os.remove(tmp_file_path)

        if result.returncode == 0:
            return result.stdout
        else:
            return f"Error (exit code {result.returncode}):\n{result.stderr}"
    except Exception as e:
        return f"Error during code execution: {e}"
