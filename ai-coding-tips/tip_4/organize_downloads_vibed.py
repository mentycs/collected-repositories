#!/usr/bin/env python3

import os
import shutil
import logging
from pathlib import Path
from typing import Dict, Set


def setup_logging():
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s - %(levelname)s - %(message)s",
        handlers=[logging.FileHandler("organize_downloads.log"), logging.StreamHandler()],
    )


def get_file_categories() -> Dict[str, Set[str]]:
    return {
        "Images": {".jpg", ".jpeg", ".png", ".gif", ".bmp", ".tiff", ".svg", ".webp", ".ico"},
        "Documents": {".pdf", ".doc", ".docx", ".txt", ".rtf", ".odt", ".pages", ".tex"},
        "Spreadsheets": {".xls", ".xlsx", ".csv", ".ods", ".numbers"},
        "Presentations": {".ppt", ".pptx", ".odp", ".key"},
        "Videos": {".mp4", ".avi", ".mkv", ".mov", ".wmv", ".flv", ".webm", ".m4v"},
        "Audio": {".mp3", ".wav", ".flac", ".aac", ".ogg", ".wma", ".m4a"},
        "Archives": {".zip", ".rar", ".7z", ".tar", ".gz", ".bz2", ".xz"},
        "Executables": {".exe", ".msi", ".deb", ".rpm", ".dmg", ".pkg", ".app"},
        "Code": {".py", ".js", ".html", ".css", ".java", ".cpp", ".c", ".php", ".rb", ".go", ".rs"},
        "Ebooks": {".epub", ".mobi", ".azw", ".azw3", ".fb2"},
    }


def get_downloads_folder() -> Path:
    home = Path.home()
    downloads_folder = home / "Downloads"

    if not downloads_folder.exists():
        downloads_folder = home / "downloads"
        if not downloads_folder.exists():
            raise FileNotFoundError("Downloads folder not found")

    return downloads_folder


def categorize_file(file_path: Path, categories: Dict[str, Set[str]]) -> str:
    file_extension = file_path.suffix.lower()

    for category, extensions in categories.items():
        if file_extension in extensions:
            return category

    return "Others"


def create_category_folders(base_path: Path, categories: Dict[str, Set[str]]):
    for category in categories.keys():
        category_path = base_path / category
        category_path.mkdir(exist_ok=True)

    others_path = base_path / "Others"
    others_path.mkdir(exist_ok=True)


def organize_downloads(downloads_folder: Path, dry_run: bool = False):
    categories = get_file_categories()

    if not dry_run:
        create_category_folders(downloads_folder, categories)

    files_moved = 0

    for item in downloads_folder.iterdir():
        if item.is_file():
            category = categorize_file(item, categories)
            destination_folder = downloads_folder / category
            destination_path = destination_folder / item.name

            if destination_path.exists():
                base_name = item.stem
                extension = item.suffix
                counter = 1
                while destination_path.exists():
                    new_name = f"{base_name}_{counter}{extension}"
                    destination_path = destination_folder / new_name
                    counter += 1

            if dry_run:
                logging.info(f"Would move: {item.name} -> {category}/{destination_path.name}")
            else:
                try:
                    shutil.move(str(item), str(destination_path))
                    logging.info(f"Moved: {item.name} -> {category}/{destination_path.name}")
                    files_moved += 1
                except Exception as e:
                    logging.error(f"Error moving {item.name}: {e}")

    if not dry_run:
        logging.info(f"Organization complete! Moved {files_moved} files.")
    else:
        logging.info(f"Dry run complete! Would move {files_moved} files.")


def main():
    setup_logging()

    try:
        downloads_folder = get_downloads_folder()
        logging.info(f"Organizing files in: {downloads_folder}")

        print("Choose an option:")
        print("1. Dry run (preview changes)")
        print("2. Organize files")

        choice = input("Enter your choice (1 or 2): ").strip()

        if choice == "1":
            organize_downloads(downloads_folder, dry_run=True)
        elif choice == "2":
            confirm = (
                input("This will move files in your Downloads folder. Continue? (y/N): ")
                .strip()
                .lower()
            )
            if confirm == "y":
                organize_downloads(downloads_folder, dry_run=False)
            else:
                logging.info("Operation cancelled.")
        else:
            logging.error("Invalid choice. Please enter 1 or 2.")

    except Exception as e:
        logging.error(f"An error occurred: {e}")


if __name__ == "__main__":
    main()
