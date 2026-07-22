import json

def parse_transcript():
    log_path = "C:\\Users\\ruzie\\.gemini\\antigravity-ide\\brain\\7e058263-0d4a-44f1-8a04-d479911f0c31\\.system_generated\\logs\\transcript.jsonl"
    try:
        with open(log_path, 'r', encoding='utf-8') as f:
            for line in f:
                data = json.loads(line)
                # Look for tool calls to capture_browser_screenshot
                if "tool_calls" in data:
                    for tc in data["tool_calls"]:
                        if tc.get("name") == "capture_browser_screenshot":
                            print(f"Step {data.get('step_index')}: {tc.get('args')}")
                        elif tc.get("name") == "open_browser_url":
                            print(f"Step {data.get('step_index')}: Navigated to {tc.get('args').get('Url')}")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    parse_transcript()
