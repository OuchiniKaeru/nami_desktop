from typing import List
from agno.tools import Toolkit
from agno.utils.log import logger

class WriteTools(Toolkit):
    def __init__(self):
        super().__init__(name="write_tool")
        self.register(self.write_to_file)

    def write_to_file(file_path: str, content: str) -> str:
        """Writes content to a file.

        Args:
            file_path: The path to the file to write to.
            content: The content to write to the file.

        Returns:
            A message indicating success or failure.
        """
        import os

        logger.info(f"Running write_tool: {file_path}")

        try:
            os.makedirs(os.path.dirname(file_path), exist_ok=True)
            with open(file_path, 'w', encoding='utf-8') as f:
                f.write(content)
            return f"Successfully wrote to {file_path}"
        except Exception as e:
            return f"Error: {e}"

