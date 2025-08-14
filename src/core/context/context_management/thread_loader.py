import json
import ast

def _escape_newlines_in_json_strings(text: str) -> str:
    """
    JSONライク文字列内のダブルクォートで囲まれた文字列の中に含まれる
    生の改行(\r, \n)を、JSONで有効なエスケープ(\\r, \\n)へ置換する。
    これにより「unterminated string literal」エラーを回避する。
    """
    result_chars: list[str] = []
    in_string = False
    escape = False
    quote_char = '"'  # JSONでは文字列はダブルクォートのみ
    for ch in text:
        if in_string:
            if escape:
                # 直前がバックスラッシュ: そのまま出力して通常モードに戻る
                result_chars.append(ch)
                escape = False
            else:
                if ch == '\\':
                    result_chars.append(ch)
                    escape = True
                elif ch == quote_char:
                    result_chars.append(ch)
                    in_string = False
                elif ch == '\n':
                    result_chars.append('\\n')
                elif ch == '\r':
                    result_chars.append('\\r')
                else:
                    result_chars.append(ch)
        else:
            if ch == '"':
                result_chars.append(ch)
                in_string = True
                escape = False
            else:
                result_chars.append(ch)
    return ''.join(result_chars)


def _neutralize_invalid_unicode_escapes_in_strings(text: str) -> str:
    """
    文字列中の無効な \\u エスケープ(4桁の16進数が続かない)を無害化する。
    無効な "\\u" を "\\\\u" に変換し、JSONパーサにリテラルとして扱わせる。
    """
    result_chars: list[str] = []
    in_string = False
    escape = False
    i = 0
    n = len(text)
    while i < n:
        ch = text[i]
        result_chars.append(ch)
        if in_string:
            if escape:
                escape = False
            else:
                if ch == '\\':
                    # 直後が 'u' で、かつ 4桁のHEXが揃っていなければ "\\u" にする
                    if i + 1 < n and text[i + 1] == 'u':
                        hex_ok = False
                        if i + 5 < n:
                            hex_part = text[i + 2:i + 6]
                            hex_ok = all(c in '0123456789abcdefABCDEF' for c in hex_part)
                        if not hex_ok:
                            # 直前に追加した '\\' をもう一つ追加して "\\\\u" にする
                            result_chars.append('\\')
                    escape = True
                elif ch == '"':
                    in_string = False
        else:
            if ch == '"':
                in_string = True
                escape = False
        i += 1
    return ''.join(result_chars)

def _auto_close_truncated_json(s: str) -> str:
    """
    末尾が途中で切れているJSONを推測で補修する（ベストエフォート）。
    - ダブルクォート文字列を追跡し、未クローズなら '"' を付与
    - {} と [] のネストを追跡し、足りないクローズ括弧を付与
    - 末尾の余分なカンマ/コロンは削除
    """
    out_chars: list[str] = []
    stack: list[str] = []  # 期待するクローズ記号 '}' または ']'
    in_string = False
    escape_next = False

    for ch in s:
        out_chars.append(ch)
        if in_string:
            if escape_next:
                escape_next = False
            else:
                if ch == '\\':
                    escape_next = True
                elif ch == '"':
                    in_string = False
        else:
            if ch == '"':
                in_string = True
            elif ch == '{':
                stack.append('}')
            elif ch == '[':
                stack.append(']')
            elif ch == '}' or ch == ']':
                if stack and stack[-1] == ch:
                    stack.pop()
                else:
                    # 予期しないクローズは無視
                    pass

    # 末尾がバックスラッシュで終わっていたら除去（エスケープ中断防止）
    while out_chars and out_chars[-1] == '\\':
        out_chars.pop()

    # 末尾のカンマ/コロンは削除
    while out_chars and out_chars[-1] in [',', ':', ' ', '\n', '\r', '\t']:
        last = out_chars[-1]
        if last in [',', ':']:
            out_chars.pop()
            break
        else:
            out_chars.pop()

    # 未クローズの文字列を閉じる
    if in_string:
        out_chars.append('"')

    # 必要なクローズ括弧を付与（スタックの逆順）
    while stack:
        closer = stack.pop()
        # クローズ前に末尾がカンマ/コロンなら取り除く
        while out_chars and out_chars[-1] in [',', ':', ' ', '\n', '\r', '\t']:
            if out_chars[-1] in [',', ':']:
                out_chars.pop()
                break
            else:
                out_chars.pop()
        out_chars.append(closer)

    return ''.join(out_chars)


def parse_json_like(json_like_str: str):
    """
    JSONまたはJSONライクな文字列をPythonオブジェクト(dict/list)にデコードする。
    1) まず純粋なJSONとして `json.loads` を試す（ユニコードエスケープは自動的にデコードされる）。
    2) 失敗した場合のみ `ast.literal_eval` でPythonリテラル→JSON化の順でフォールバック。
    """
    # まずはそのままJSONとして読み込む
    try:
        return json.loads(json_like_str)
    except json.JSONDecodeError as e:
        print(f"DEBUG json.loads fail@({e.lineno},{e.colno}): {e.msg}")
        snippet = json_like_str[max(0, e.pos-80): e.pos+80]
        print(f"DEBUG around pos {e.pos}: {snippet[:200]}")

    # JSONDecoder(strict=False) で制約を緩めて再試行
    try:
        decoder = json.JSONDecoder(strict=False)
        return decoder.decode(json_like_str)
    except Exception as e:
        print(f"DEBUG JSONDecoder(strict=False) fail: {e}")

    # 文字列内の生改行をエスケープ + 無効な \u エスケープ無害化して再試行
    sanitized = _escape_newlines_in_json_strings(json_like_str)
    sanitized = _neutralize_invalid_unicode_escapes_in_strings(sanitized)
    try:
        return json.loads(sanitized)
    except json.JSONDecodeError as e:
        print(f"DEBUG json.loads(sanitized) fail@({e.lineno},{e.colno}): {e.msg}")
        snippet = sanitized[max(0, e.pos-80): e.pos+80]
        print(f"DEBUG sanitized around pos {e.pos}: {snippet[:200]}")
        # 自動クローズで補修して再試行
        repaired = _auto_close_truncated_json(sanitized)
        try:
            return json.loads(repaired)
        except json.JSONDecodeError as e2:
            print(f"DEBUG json.loads(repaired) fail@({e2.lineno},{e2.colno}): {e2.msg}")

        # JSONとして読めない場合のみ安全なPythonリテラル評価にフォールバック
        try:
            py_obj = ast.literal_eval(sanitized)
            # ensure_ascii=False で日本語をそのまま保持したJSON文字列へ
            json_str = json.dumps(py_obj, ensure_ascii=False)
            return json.loads(json_str)
        except (SyntaxError, ValueError) as e2:
            raise ValueError(f"JSONデコードに失敗しました: {e2}")


def create_chat_history(json_like_str: str):
    """
    JSON/JSONライクな文字列からchat_historyを作成する関数
    """
    chat_history = []
    try:
        # 文字列をPythonオブジェクトに変換（Unicodeは自動的にデコードされる）
        data = parse_json_like(json_like_str)
        
        if isinstance(data, dict) and 'runs' in data and data['runs']:
            # 最後のrunのmessagesを抽出
            messages = data['runs'][-1].get('messages', [])
            
        for i, msg in enumerate(messages):
            if 'role' not in msg:
                continue
                
            role = msg['role']
            
            # roleが'system'の場合、パス
            if role == 'system':
                continue
            
            # roleが'user'の場合、msg["role"]と"content"をchat_historyに追加
            elif role == 'user':
                if 'content' in msg:
                    # contentを文字列へ正規化
                    raw_content = msg["content"]
                    if isinstance(raw_content, list):
                        normalized_content = "\n".join(str(part) for part in raw_content)
                    elif isinstance(raw_content, dict):
                        normalized_content = json.dumps(raw_content, ensure_ascii=False)
                    else:
                        normalized_content = str(raw_content)
                    
                    chat_history.append({
                        "role": msg["role"],
                        "content": normalized_content
                    })
            
            # roleが'assistant'の場合
            elif role == 'assistant':
                # 最後の場合、または次のroleが'user'の場合
                is_last = (i == len(messages) - 1)
                next_is_user = (i < len(messages) - 1 and messages[i + 1].get('role') == 'user')
                
                if is_last or next_is_user:
                    # msg["role"]と"content"をchat_historyに追加
                    if 'content' in msg:
                        # contentを文字列へ正規化
                        raw_content = msg["content"]
                        if isinstance(raw_content, list):
                            normalized_content = "\n".join(str(part) for part in raw_content)
                        elif isinstance(raw_content, dict):
                            normalized_content = json.dumps(raw_content, ensure_ascii=False)
                        else:
                            normalized_content = str(raw_content)
                        
                        chat_history.append({
                            "role": msg["role"],
                            "content": normalized_content
                        })
                else:
                    # それ以外の場合
                    thinking_content_parts = []
                    
                    # "content"がある場合は、"content"を取得
                    if 'content' in msg and msg['content']:
                        raw_content = msg["content"]
                        if isinstance(raw_content, list):
                            content_str = "\n".join(str(part) for part in raw_content)
                        elif isinstance(raw_content, dict):
                            content_str = json.dumps(raw_content, ensure_ascii=False)
                        else:
                            content_str = str(raw_content)
                        
                        if content_str.strip():
                            thinking_content_parts.append(content_str)
                    
                    # "tool_calls"がある場合は、tool_callsの情報を取得
                    if 'tool_calls' in msg:
                        for tool_call in msg['tool_calls']:
                            tool_info = {}
                            
                            # "tool_name"と"content"を取得
                            if 'tool_name' in tool_call:
                                tool_info['tool_name'] = tool_call['tool_name']
                            if 'content' in tool_call:
                                tool_info['content'] = tool_call['content']
                            
                            # "function"の"name"と"arguments"を取得
                            if 'function' in tool_call:
                                 function = tool_call['function']
                                 if 'name' in function:
                                     tool_info['function_name'] = function['name']
                                 if 'arguments' in function:
                                    arg_raw = function['arguments']
                                    try:
                                        # まずJSONとして解釈（辞書/文字列のどちらでもOK）
                                        arg_obj = json.loads(arg_raw)
                                    except Exception:
                                        pass
                                    tool_info['arguments'] = arg_obj
                            
                            print(tool_info)
                            thinking_content_parts.append(json.dumps(tool_info))
                    
                    # 取得した情報をchat_historyに追加
                    if thinking_content_parts:
                        combined_content = "\n".join(thinking_content_parts)
                        chat_history.append({
                            "role": "thinking",
                            "content": combined_content
                        })
            
            # roleが'tool'の場合、roleを'thinking'にして、"content"を取得してchat_historyに追加
            elif role == 'tool':
                if 'content' in msg:
                    # contentを文字列へ正規化
                    raw_content = msg["content"]
                    if isinstance(raw_content, list):
                        normalized_content = "\n".join(str(part) for part in raw_content)
                    elif isinstance(raw_content, dict):
                        normalized_content = json.dumps(raw_content, ensure_ascii=False)
                    else:
                        normalized_content = str(raw_content)
                    
                    chat_history.append({
                        "role": "thinking",
                        "content": normalized_content
                    })
    
    except Exception as e:
        print(f"データの解析中にエラーが発生しました: {e}")
    
    return chat_history

# # データ（提供されたデータをjson_like_str変数として定義）
# data_path = r"C:\Users\ooa42\Documents\agno_agent_app\thread_data01.md"
# with open(data_path, "r", encoding="utf-8") as f:
#     json_like_str = f.read()

# # 実行
# chat_history = create_chat_history(json_like_str)

# # 結果を表示
# print("作成されたchat_history:")
# print(json.dumps(chat_history, ensure_ascii=False, indent=2))

# print(f"\n会話履歴の件数: {len(chat_history)}件")

# # 各メッセージの詳細を表示
# for i, msg in enumerate(chat_history, 1):
#     print(f"\n--- メッセージ {i} ---")
#     print(f"Role: {msg['role']}")
#     print(f"Content: {msg['content'][:100]}..." if len(msg['content']) > 100 else f"Content: {msg['content']}")