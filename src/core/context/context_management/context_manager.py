import json
import os
from enum import Enum
from typing import List, Dict, Tuple, TypedDict, NewType

# --- Type Definitions ---

class EditType(Enum):
    UNDEFINED = 0
    NO_FILE_READ = 1
    READ_FILE_TOOL = 2
    ALTER_FILE_TOOL = 3
    FILE_MENTION = 4

MessageContent = NewType('MessageContent', List[str])
MessageMetadata = NewType('MessageMetadata', List[List[str]])

# [timestamp, updateType, update, metadata]
ContextUpdate = NewType('ContextUpdate', Tuple[float, str, MessageContent, MessageMetadata])

# { blockIndex => [ContextUpdate, ...] }
InnerContextHistory = NewType('InnerContextHistory', Dict[int, List[ContextUpdate]])

# [EditType, InnerContextHistory]
ContextHistoryTuple = NewType('ContextHistoryTuple', Tuple[int, InnerContextHistory])

# { messageIndex => ContextHistoryTuple }
ContextHistoryUpdates = NewType('ContextHistoryUpdates', Dict[int, ContextHistoryTuple])

# --- Helper Functions for Dummy Classes ---

def format_context_truncation_notice():
    return "[NOTE] Some previous conversation history with the user has been removed to keep the context within the model's limits. The full conversation history is still available in the chat."

# --- Class Definition ---

class ContextManager:
    """
    Manages the conversation context, including truncation and history updates.
    """
    def __init__(self):
        # { messageIndex => [EditType, { innerIndex => [[timestamp, updateType, update, metadata], ...] }] }
        self.context_history_updates: Dict[int, Tuple[int, Dict[int, List[Tuple[float, str, List[str], List[List[str]]]]]]] = {}

    async def initialize_context_history(self, task_id: str):
        """
        Loads contextHistoryUpdates from disk, if it exists.
        """
        self.context_history_updates = await self._get_saved_context_history(task_id)

    async def _get_saved_context_history(self, task_id: str) -> Dict[int, Tuple[int, Dict[int, List[Tuple[float, str, List[str], List[List[str]]]]]]]:
        """
        Gets the stored context history updates from disk.
        """
        task_directory = ensure_task_directory_exists(None, task_id)
        file_path = os.path.join(task_directory, GlobalFileNames.CONTEXT_HISTORY)
        if not os.path.exists(file_path):
            return {}

        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                serialized_updates = json.load(f)
            
            # Reconstruct the nested dictionary structure
            reconstructed_map = {}
            for msg_idx_str, (edit_type, inner_map_list) in serialized_updates.items():
                inner_map = {int(k): v for k, v in inner_map_list.items()}
                reconstructed_map[int(msg_idx_str)] = (edit_type, inner_map)
            return reconstructed_map
        except (IOError, json.JSONDecodeError) as e:
            print(f"Failed to load context history: {e}")
            return {}

    async def _save_context_history(self, task_id: str):
        """
        Saves the context history updates to disk.
        """
        try:
            # The dictionary is already in a serializable format
            serialized_updates = self.context_history_updates
            
            task_directory = ensure_task_directory_exists(None, task_id)
            os.makedirs(task_directory, exist_ok=True)
            file_path = os.path.join(task_directory, GlobalFileNames.CONTEXT_HISTORY)
            
            with open(file_path, 'w', encoding='utf-8') as f:
                json.dump(serialized_updates, f, indent=2)
        except IOError as e:
            print(f"Failed to save context history: {e}")

    def apply_standard_context_truncation_notice_change(self, timestamp: float) -> bool:
        """
        If there is any truncation and no other alteration is set,
        alter the assistant message to indicate this occurred.
        """
        if 1 not in self.context_history_updates:
            # First assistant message is always at index 1
            inner_map = {0: [[timestamp, "text", [format_context_truncation_notice()], []]]}
            self.context_history_updates[1] = (EditType.UNDEFINED.value, inner_map)
            return True
        return False

    async def get_new_context_messages_and_metadata(self, api_conversation_history, cline_messages, api, conversation_history_deleted_range, previous_api_req_index, task_directory):
        # This is a placeholder for the full logic which is quite complex.
        # For now, it just returns the history as is.
        
        # A simplified version of the truncation logic for demonstration
        updated_conversation_history_deleted_range = False
        if len(api_conversation_history) > 10: # Arbitrary limit for demo
            self.apply_standard_context_truncation_notice_change(float('inf'))
            # In a real implementation, we would calculate the new range
            # and save the history.
            await self._save_context_history(task_directory)
            updated_conversation_history_deleted_range = True


        return {
            "conversation_history_deleted_range": conversation_history_deleted_range,
            "updated_conversation_history_deleted_range": updated_conversation_history_deleted_range,
            "truncated_conversation_history": api_conversation_history,
        }
