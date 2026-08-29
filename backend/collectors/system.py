import time
from typing import Dict

import psutil


def collect_system_metrics() -> Dict[str, float]:
    cpu_percent = psutil.cpu_percent(interval=None)
    memory = psutil.virtual_memory()
    disk = psutil.disk_usage("/")

    return {
        "cpu_percent": round(float(cpu_percent), 1),
        "ram_percent": round(float(memory.percent), 1),
        "disk_percent": round(float(disk.percent), 1),
        "disk_used_gb": round(float(disk.used / (1024 ** 3)), 1),
        "disk_free_gb": round(float(disk.free / (1024 ** 3)), 1),
        "timestamp": time.time(),
    }
