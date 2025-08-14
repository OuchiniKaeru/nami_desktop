from agno.memory.v2.memory import Memory, UserMemory
from agno.models.google import Gemini
from agno.models.azure.openai_chat import AzureOpenAI
from agno.memory.v2.db.sqlite import SqliteMemoryDb
import os
import sys
import json
# from dotenv import load_dotenv

# load_dotenv()


class GetUserMemory:
    def __init__(self, query):
        self.agent = None
        if getattr(sys, 'frozen', False):
            # exe 実行時
            BASE_DIR = os.path.dirname(sys.executable)
        else:
            BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
        self.project_dir = os.path.dirname(BASE_DIR)
        self.user_id = None
        self.query = query
        self.memory = None

    def load_setting(self):
        self.setting_path = os.path.join(self.project_dir, ".nami", "setting.json")
        self.db_path = os.path.join(self.project_dir, "chat_history.db")
        print(self.db_path)

        with open(self.setting_path, "r", encoding="utf-8") as f:
            settings = json.load(f)
        self.user_id = settings.get("user_id")
        self.select_model = settings.get("select_model")
        self.temperature = float(settings.get("temperature"))
        self.top_p = float(settings.get("top_p"))
        self.max_tokens = int(settings.get("max_tokens"))
        self.search_knowledge = bool(settings.get("search_knowledge"))
        self.markdown = bool(settings.get("markdown"))
        self.reasoning = bool(settings.get("reasoning"))
        self.structured_outputs = bool(settings.get("structured_outputs"))
        self.reasoning_max_steps = int(settings.get("reasoning_max_steps"))
        self.stream = bool(settings.get("stream"))
        self.show_full_reasoning = bool(settings.get("show_full_reasoning"))
        

    def create_rag_agent(self):
        if "gemini" in self.select_model:
            self.trg_model = Gemini(
                id=self.select_model,
                temperature=self.temperature,
                top_p=self.top_p,
                max_output_tokens=self.max_tokens
            )
        else:
            self.trg_model = AzureOpenAI(
                id=self.select_model,
                temperature=self.temperature,
                top_p=self.top_p,
                max_output_tokens=self.max_tokens
            )

        self.memory = Memory(
            model=self.trg_model,
            db=SqliteMemoryDb(table_name="memories", db_file=self.db_path),
        )

    def run_user_memory_rag(self):
        self.load_setting()
        self.create_rag_agent()
        # This searches using a model
        memories = self.memory.search_user_memories(
            user_id=self.user_id,
            query=self.query,
            retrieval_method="agentic",
        )

        result_list = []
        for i, m in enumerate(memories):
            result_list.append(f"{i}: {m.memory}")
        
        return '\n'.join(result_list)


def get_user_memory_tool(query: str) -> str:
    """queryに類似したuser_memoryを文字列で返します。

    Args:
        query: ユーザーに関する質問。

    Returns:
        user_memoryからの回答
    """
    get_user_memory = GetUserMemory(query)
    return get_user_memory.run_user_memory_rag()


