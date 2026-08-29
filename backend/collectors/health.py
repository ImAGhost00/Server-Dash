import subprocess
from typing import Dict


def collect_drive_health(device: str) -> Dict[str, object]:
    try:
        result = subprocess.run(
            ["smartctl", "-H", device],
            capture_output=True,
            text=True,
            timeout=10,
        )
    except (FileNotFoundError, subprocess.TimeoutExpired):
        return {"available": False, "status": "UNKNOWN", "detail": "smartctl not available"}

    output = result.stdout

    if "PASSED" in output:
        return {"available": True, "status": "PASSED", "detail": "SMART overall-health: PASSED"}
    if "FAILED" in output:
        return {"available": True, "status": "FAILED", "detail": "SMART overall-health: FAILED"}

    detail = output.strip()[-200:] if output.strip() else "No SMART data returned"
    return {"available": False, "status": "UNKNOWN", "detail": detail}
