import sqlite3
import os
import sys
import ast
import json



def get_db_connection():
    if getattr(sys, 'frozen', False):
        # exe 実行時
        EXTERNAL_BASE = os.path.dirname(sys.executable)
    else:
        EXTERNAL_BASE = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    DB_PATH = os.path.join(os.path.dirname(EXTERNAL_BASE), "chat_history.db")
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db_connection()
    c = conn.cursor()
    c.execute('''
        CREATE TABLE IF NOT EXISTS threads (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            session_id TEXT UNIQUE NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    conn.commit()
    conn.close()

def get_thread_id_by_session_id(session_id):
    """
    指定されたsession_idに対応するスレッドIDを返します。
    存在しない場合はNoneを返します。
    """
    conn = get_db_connection()
    c = conn.cursor()
    c.execute("SELECT id FROM threads WHERE session_id = ?", (session_id,))
    result = c.fetchone()
    conn.close()
    if result:
        return result["id"]
    else:
        return None


def create_thread(session_id, title=''):
    conn = get_db_connection()
    c = conn.cursor()
    c.execute("INSERT INTO threads (title, session_id) VALUES (?, ?)", (title, session_id))
    thread_id = c.lastrowid
    conn.commit()
    conn.close()
    return thread_id

def get_or_create_thread_by_session_id(session_id):
    conn = get_db_connection()
    c = conn.cursor()
    c.execute("SELECT id FROM threads WHERE session_id = ?", (session_id,))
    result = c.fetchone()
    if result:
        thread_id = result["id"]
    else:
        # Create a new thread with a placeholder title
        c.execute("INSERT INTO threads (title, session_id) VALUES (?, ?)", ('', session_id))
        thread_id = c.lastrowid
    conn.commit()
    conn.close()
    return thread_id

def get_threads(user_id):
    conn = get_db_connection()
    c = conn.cursor()
    if user_id:
        c.execute("SELECT * FROM threads WHERE session_id IN (SELECT session_id FROM agent_sessions WHERE user_id = ?) ORDER BY created_at DESC", (user_id,))
    else:
        c.execute("SELECT * FROM threads ORDER BY created_at DESC")
    threads = c.fetchall()
    conn.close()
    return threads

def get_messages_for_thread(session_id):
    conn = get_db_connection()
    c = conn.cursor()
    # session_idからagent_sessionsのmemoryを返す
    # memoryカラムがJSON文字列として保存されていると仮定し、パースする
    c.execute("SELECT memory FROM agent_sessions WHERE session_id = ?", (session_id,))
    memories_raw = c.fetchall()
    
    parsed_memory = []
    for row in memories_raw:
        try:
            # memoryカラムの値をJSONとしてパース
            parsed_memory = json.loads(row["memory"])
            break
        except Exception as e:
            print(f"ERROR: An unexpected error occurred while processing memory: {e}")

    conn.close()
    # return messages
    return parsed_memory

def search_threads_and_agent_sessions(query, user_id):
    conn = get_db_connection()
    c = conn.cursor()

    import re

    def decode_unicode_escapes(s):
        def repl(m):
            return chr(int(m.group(1), 16))
        s = re.sub(r'\\u([0-9a-fA-F]{4})', repl, s)
        s = re.sub(r'\\\\u([0-9a-fA-F]{4})', repl, s)
        return s

    def iter_strings(obj):
        if obj is None:
            return
        if isinstance(obj, str):
            yield obj
        elif isinstance(obj, dict):
            for v in obj.values():
                yield from iter_strings(v)
        elif isinstance(obj, list) or isinstance(obj, tuple):
            for v in obj:
                yield from iter_strings(v)
        else:
            return

    def norm(s: str) -> str:
        try:
            return s.lower()
        except:
            return str(s).lower()

    # クエリをブール式としてパース
    # 仕様:
    # - OR区切り（大文字小文字無視）でグループ分割
    # - グループ内はスペース区切り or 'AND' でAND
    # - '-term' または 'NOT term' でNOT
    def parse_boolean_query(q: str):
        tokens = q.strip().split()
        groups = []
        cur = {'must': [], 'must_not': []}
        negate_next = False

        def push_cur():
            if cur['must'] or cur['must_not']:
                groups.append({'must': cur['must'][:], 'must_not': cur['must_not'][:]})
                cur['must'].clear()
                cur['must_not'].clear()

        i = 0
        while i < len(tokens):
            t = tokens[i]
            tu = t.upper()

            if tu == 'OR':
                push_cur()
                negate_next = False
                i += 1
                continue

            if tu == 'AND':
                i += 1
                continue

            if tu == 'NOT' or t == '-':
                negate_next = True
                i += 1
                continue

            if t.startswith('-'):
                term = t[1:]
                if term:
                    cur['must_not'].append(term)
                i += 1
                continue

            # 通常の語
            if negate_next:
                cur['must_not'].append(t)
                negate_next = False
            else:
                cur['must'].append(t)
            i += 1

        push_cur()
        return groups

    groups = parse_boolean_query(query or '')
    # 空（条件なし）の場合は全件返す
    # user_idが一致している条件を追加
    if not groups:
        rows = c.execute("SELECT id, title, session_id, created_at FROM threads WHERE user_id = ? ORDER BY created_at DESC", (user_id,)).fetchall()
        conn.close()
        return rows

    results = []
    threads = c.execute("SELECT id, title, session_id, created_at FROM threads WHERE user_id = ? ORDER BY created_at DESC", (user_id,)).fetchall()

    for t in threads:
        # タイトルとメモリから検索用コーパスを構築（生/デコード済の両方）
        title = t['title'] or ''
        title_norm = norm(title)
        title_dec = norm(decode_unicode_escapes(title))

        mem_rows = c.execute("SELECT memory FROM agent_sessions WHERE session_id = ?", (t['session_id'],)).fetchall()
        texts = []
        for mr in mem_rows:
            raw = mr['memory']
            if not raw:
                continue
            try:
                parsed = json.loads(raw)
                texts.extend(iter_strings(parsed) or [])
            except Exception:
                texts.append(raw)

        corpus_norm_parts = [title_norm]
        corpus_dec_parts = [title_dec]
        for txt in texts:
            txt_norm = norm(txt)
            txt_dec = norm(decode_unicode_escapes(txt))
            corpus_norm_parts.append(txt_norm)
            corpus_dec_parts.append(txt_dec)

        corpus_norm = ' '.join(corpus_norm_parts)
        corpus_dec = ' '.join(corpus_dec_parts)

        def term_present(term: str) -> bool:
            term_norm = norm(term)
            term_dec = norm(decode_unicode_escapes(term))
            return (term_norm in corpus_norm) or (term_norm in corpus_dec) or (term_dec in corpus_norm) or (term_dec in corpus_dec)

        # ORでどれかのグループが真ならマッチ
        match = False
        for g in groups:
            # AND: 全mustが含まれ、かつmust_notは含まれない
            if all(term_present(x) for x in g['must']) and all(not term_present(x) for x in g['must_not']):
                match = True
                break

        if match:
            results.append(t)

    conn.close()
    return results

def delete_thread(session_id):
    conn = get_db_connection()
    c = conn.cursor()
    c.execute("DELETE FROM threads WHERE session_id = ?", (session_id,))
    if session_id is not None:
        c.execute("DELETE FROM agent_sessions WHERE session_id = ?", (session_id,))
    
    conn.commit()
    conn.close()

def get_user_memory(user_id):
    """
    指定したuser_idのmemoriesテーブルからidとmemoryカラムの値をすべて取得してリストで返す
    Args:
        user_id: ユーザーID
    Returns:
        {"id": id値, "memory": memory値} のリスト
    """
    conn = get_db_connection()
    c = conn.cursor()
    c.execute("SELECT id, memory FROM memories WHERE user_id = ?", (user_id,))
    rows = c.fetchall()
    conn.close()

    result = []
    for row in rows:
        try:
            memory_json = json.loads(row[1])
            memory_value = memory_json.get("memory", "")
            input_value = memory_json.get("input", "")
            memory_result = f"{input_value}: {memory_value}"
        except json.JSONDecodeError:
            try:
                memory_json = ast.literal_eval(row[1])
                memory_value = memory_json.get("memory", "")
                input_value = memory_json.get("input", "")
                memory_result = f"{input_value}: {memory_value}"
            except Exception:
                memory_result = str(row[1])
        result.append({"id": row[0], "memory": memory_result})
    return result

def delete_user_memory(memory_id):
    """
    指定したidのメモリを削除する
    Args:
        memory_id: 削除するメモリのID
    Returns:
        bool: 削除が成功したかどうか
    """
    try:
        conn = get_db_connection()
        c = conn.cursor()
        c.execute("DELETE FROM memories WHERE id = ?", (memory_id,))
        conn.commit()
        success = c.rowcount > 0
        conn.close()
        return success
    except Exception as e:
        print(f"Error deleting memory: {e}")
        return False
    
def delete_all_user_memory(user_id):
    """
    指定したuser_idのメモリをすべて削除する
    Args:
        user_id: 削除するユーザーのID
    Returns:
        bool: 削除が成功したかどうか
    """
    try:
        conn = get_db_connection()
        c = conn.cursor()
        c.execute("DELETE FROM memories WHERE user_id = ?", (user_id,))
        conn.commit()
        success = c.rowcount > 0
        conn.close()
        return success
    except Exception as e:
        print(f"Error deleting memory: {e}")
        return False

# Initialize the database when the module is loaded
init_db()
