import json

def parse_main_transcript():
    log_path = "C:\\Users\\ruzie\\.gemini\\antigravity-ide\\brain\\7e058263-0d4a-44f1-8a04-d479911f0c31\\.system_generated\\logs\\transcript.jsonl"
    try:
        with open(log_path, 'r', encoding='utf-8') as f:
            for line in f:
                data = json.loads(line)
                if "tool_calls" in data:
                    for tc in data["tool_calls"]:
                        if "browser_subagent" in tc.get("name", ""):
                            print(f"Subagent Tool Call at Step {data.get('step_index')}: {tc.get('args').get('TaskName')}")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    parse_main_transcript()
