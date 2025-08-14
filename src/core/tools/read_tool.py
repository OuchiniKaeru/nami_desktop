from typing import List
from agno.tools import Toolkit
from agno.utils.log import logger

class ReadTools(Toolkit):
    def __init__(self):
        super().__init__(name="read_tool")
        self.register(self.read_file)


    def read_file(file_path: str) -> str:
        """Reads the contents of a file.

        Args:
            file_path: The path to the file to read.

        Returns:
            The contents of the file.
        """
        logger.info(f"Running read_tool: {file_path}")
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                return f.read()
        except Exception as e:
            return f"Error: {e}"

