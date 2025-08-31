#!/usr/bin/env python3
import os
import shutil
from pathlib import Path
from collections import defaultdict


def organize_downloads():
    downloads_path = Path.home() / "Downloads"

    if not downloads_path.exists():
        print("Downloads folder not found")
        return

    folder_mapping = {
        ".pdf": "Documents",
        ".jpg": "Images",
        ".jpeg": "Images",
        ".mp4": "Videos",
        ".zip": "Archives",
    }

    moved_files = defaultdict(list)

    for folder_name in folder_mapping.values():
        folder_path = downloads_path / folder_name
        folder_path.mkdir(exist_ok=True)

    for file_path in downloads_path.iterdir():
        if file_path.is_file():
            file_ext = file_path.suffix.lower()

            if file_ext in folder_mapping:
                target_folder = folder_mapping[file_ext]
                target_path = downloads_path / target_folder / file_path.name

                if not target_path.exists():
                    try:
                        shutil.move(str(file_path), str(target_path))
                        moved_files[target_folder].append(file_path.name)
                        print(f"Moved {file_path.name} to {target_folder}/")
                    except Exception as e:
                        print(f"Error moving {file_path.name}: {e}")

    print("\nSummary:")
    total_moved = 0
    for folder, files in moved_files.items():
        count = len(files)
        total_moved += count
        print(f"{folder}: {count} files")

    print(f"Total files moved: {total_moved}")


if __name__ == "__main__":
    organize_downloads()
