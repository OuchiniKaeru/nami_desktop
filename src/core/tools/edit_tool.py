from typing import List, Dict
from agno.tools import Toolkit
from agno.utils.log import logger

class EditTools(Toolkit):
    def __init__(self):
        super().__init__(name="edit_tool")
        self.register(self.replace_in_file)

    def replace_in_file(file_path: str, edits: List[Dict[str, str]]) -> str:
        """Replaces text in a file.

        Args:
            file_path: The path to the file to modify.
            edits: A list of dictionaries, each with 'old_string' and 'new_string'.

        Returns:
            A message indicating success or failure.
        """
        logger.info(f"Running edit_tool: {file_path}")

        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()

            for edit in edits:
                content = content.replace(edit['old_string'], edit['new_string'])

            with open(file_path, 'w', encoding='utf-8') as f:
                f.write(content)

            return f"Successfully edited {file_path}"
        except Exception as e:
            return f"Error: {e}"
