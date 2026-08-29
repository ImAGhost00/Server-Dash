import time
from pathlib import Path
from typing import Dict, List

import psutil


def _disk_stats(path: str) -> Dict[str, float]:
    try:
        usage = psutil.disk_usage(path)
    except OSError:
        return {"percent": 0.0, "used_gb": 0.0, "total_gb": 0.0, "available": False}

    return {
        "percent": round(float(usage.percent), 1),
        "used_gb": round(float(usage.used / (1024 ** 3)), 1),
        "total_gb": round(float(usage.total / (1024 ** 3)), 1),
        "available": True,
    }


def collect_system_metrics(media_pool_path: str) -> Dict[str, float]:
    cpu_percent = psutil.cpu_percent(interval=None)
    memory = psutil.virtual_memory()
    root_disk = _disk_stats("/")
    media_disk = _disk_stats(media_pool_path)

    return {
        "cpu_percent": round(float(cpu_percent), 1),
        "ram_percent": round(float(memory.percent), 1),
        "disk_percent": root_disk["percent"],
        "disk_used_gb": root_disk["used_gb"],
        "disk_total_gb": root_disk["total_gb"],
        "media_percent": media_disk["percent"],
        "media_used_gb": media_disk["used_gb"],
        "media_total_gb": media_disk["total_gb"],
        "media_available": media_disk["available"],
        "timestamp": time.time(),
    }


def collect_media_pool_breakdown(media_pool_path: str) -> Dict[str, object]:
    root = Path(media_pool_path)
    if not root.exists():
        return {"available": False, "categories": []}

    categories: List[Dict[str, float]] = []
    for entry in sorted(root.iterdir()):
        if not entry.is_dir():
            continue

        size_bytes = 0
        for file_path in entry.rglob("*"):
            if file_path.is_file():
                try:
                    size_bytes += file_path.stat().st_size
                except OSError:
                    continue

        categories.append({
            "name": entry.name,
            "used_gb": round(size_bytes / (1024 ** 3), 1),
        })

    return {"available": True, "categories": categories}
