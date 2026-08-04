from collections import defaultdict

class MemoryService:

    def __init__(self):
        self.sessions = defaultdict(list)

    def add_message(self, session_id, role, content):
        self.sessions[session_id].append({
            "role": role,
            "content": content
        })

    def get_history(self, session_id):
        return self.sessions[session_id]

    def clear_history(self, session_id):
        self.sessions.pop(session_id, None)


memory_service = MemoryService()