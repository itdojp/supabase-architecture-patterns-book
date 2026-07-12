from __future__ import annotations

import json
import re
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Any
from urllib.parse import unquote

REPOSITORY = "itdojp/supabase-architecture-patterns-book"
REPO_URL = f"https://github.com/{REPOSITORY}"
REPO_GIT_URL = f"{REPO_URL}.git"
PAGES_URL = "https://itdojp.github.io/supabase-architecture-patterns-book/"
TITLE = "Supabaseアーキテクチャパターン実践技術書"
DESCRIPTION = "スケーラブルな3層構成の設計と実装 - 初心者から上級者まで段階的に学べる、Supabase完全マスターガイド"
AUTHOR = "ITDO Inc.（株式会社アイティードゥ）"
VERSION = "1.0.0"
LICENSE = "CC-BY-NC-SA-4.0"
SECTION_KEYS = ["introduction", "guides", "chapters", "appendices", "afterword"]
REQUIRED_ASSETS = [
    "assets/css/main.css",
    "assets/css/syntax-highlighting.css",
    "assets/js/theme.js",
    "assets/js/search.js",
    "assets/js/code-copy-lightweight.js",
]
EXPECTED_UX_MODULES = {
    "quickStart": False,
    "readingGuide": True,
    "checklistPack": True,
    "troubleshootingFlow": True,
    "conceptMap": False,
    "figureIndex": True,
    "legalNotice": False,
    "glossary": True,
}
REQUIRED_READER_ROUTES = {
    "figure index": "/guides/figure-index/",
    "glossary": "/guides/glossary/",
    "troubleshooting": "/guides/troubleshooting/",
    "checklist evidence": "/appendices/appendix01/#operational-checklists",
}


@dataclass(frozen=True)
class Entry:
    section: str
    title: str
    path: str


@dataclass(frozen=True)
class Page:
    path: Path
    public_path: str
    title: str | None


FRONT_MATTER_RE = re.compile(r"^---\r?\n(.*?)\r?\n---\r?\n", re.DOTALL)
SCALAR_RE = re.compile(r"^(?P<key>[A-Za-z0-9_-]+):\s*(?P<value>.*?)\s*$")
SECTION_RE = re.compile(r"^(?P<section>[A-Za-z0-9_-]+):\s*$")
TITLE_RE = re.compile(r"^\s*-\s*title:\s*(?P<value>.*?)\s*$")
PATH_RE = re.compile(r"^\s*path:\s*(?P<value>.*?)\s*$")


class CheckError(ValueError):
    pass


def unquote_scalar(value: Any) -> Any:
    if not isinstance(value, str):
        return value
    value = value.strip()
    if len(value) >= 2 and value[0] == value[-1] and value[0] in ('"', "'"):
        return value[1:-1]
    return value


def parse_scalar_block(text: str) -> dict[str, str]:
    data: dict[str, str] = {}
    for line in text.splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith("#") or line[:1].isspace():
            continue
        match = SCALAR_RE.match(line)
        if match:
            data[match.group("key")] = str(unquote_scalar(match.group("value")))
    return data


def parse_front_matter(path: Path) -> dict[str, str]:
    match = FRONT_MATTER_RE.match(path.read_text(encoding="utf-8"))
    if not match:
        return {}
    return parse_scalar_block(match.group(1))


def normalize_public_path(value: Any, *, source: str) -> str:
    if not isinstance(value, str):
        raise CheckError(f"{source}: path must be a string")
    path = value.strip()
    if not path:
        raise CheckError(f"{source}: path must not be empty")
    if path.startswith(("http://", "https://", "mailto:")):
        raise CheckError(f"{source}: external paths are not allowed: {path!r}")
    if "{{" in path or "}}" in path:
        raise CheckError(f"{source}: Liquid expressions are not allowed in canonical paths")
    if "#" in path or "?" in path:
        raise CheckError(f"{source}: path must not include query or fragment: {path!r}")
    if "\\" in path:
        raise CheckError(f"{source}: path must use forward slashes: {path!r}")
    if not path.startswith("/"):
        path = "/" + path
    decoded = unquote(path)
    parts = [part for part in decoded.split("/") if part]
    if any(part in (".", "..") for part in parts):
        raise CheckError(f"{source}: path traversal is not allowed: {path!r}")
    if "%2f" in path.lower() or "%5c" in path.lower():
        raise CheckError(f"{source}: encoded path separators are not allowed: {path!r}")
    lower = path.lower()
    if path != "/" and not lower.endswith((".md", ".html", ".htm", ".pdf", ".txt", "/")):
        path += "/"
    return path


def parse_navigation(path: Path) -> dict[str, list[Entry]]:
    data: dict[str, list[Entry]] = {key: [] for key in SECTION_KEYS}
    current_section: str | None = None
    pending_title: str | None = None
    pending_title_line: int | None = None
    for lineno, line in enumerate(path.read_text(encoding="utf-8").splitlines(), start=1):
        stripped = line.strip()
        if not stripped or stripped.startswith("#"):
            continue
        section_match = SECTION_RE.match(stripped)
        if section_match and not line[:1].isspace():
            if pending_title is not None:
                raise CheckError(f"{path}:{lineno}: title without path before section (title at line {pending_title_line})")
            current_section = section_match.group("section")
            if current_section not in data:
                data[current_section] = []
            pending_title = None
            pending_title_line = None
            continue
        if current_section is None:
            continue
        title_match = TITLE_RE.match(line)
        if title_match:
            if pending_title is not None:
                raise CheckError(f"{path}:{lineno}: title without path before line {lineno} (title at line {pending_title_line})")
            pending_title = str(unquote_scalar(title_match.group("value")))
            if not pending_title:
                raise CheckError(f"{path}:{lineno}: title must not be empty")
            pending_title_line = lineno
            continue
        path_match = PATH_RE.match(line)
        if path_match:
            if pending_title is None:
                raise CheckError(f"{path}:{lineno}: path without preceding title")
            data.setdefault(current_section, []).append(
                Entry(
                    section=current_section,
                    title=pending_title,
                    path=normalize_public_path(unquote_scalar(path_match.group("value")), source=f"{path}:{lineno}"),
                )
            )
            pending_title = None
            pending_title_line = None
    if pending_title is not None:
        raise CheckError(f"{path}: title without path at end of file (title at line {pending_title_line})")
    return data


def require_str(mapping: dict[str, Any], key: str, *, source: str) -> str:
    value = mapping.get(key)
    if not isinstance(value, str) or not value.strip():
        raise CheckError(f"{source}.{key} must be a non-empty string")
    return value.strip()


def collect_book_entries(book: dict[str, Any]) -> dict[str, list[Entry]]:
    structure = book.get("structure")
    if not isinstance(structure, dict):
        raise CheckError("book-config.json: structure must be an object")
    result: dict[str, list[Entry]] = {key: [] for key in SECTION_KEYS}
    for section in SECTION_KEYS:
        raw_items = structure.get(section)
        if not isinstance(raw_items, list):
            raise CheckError(f"book-config.json: structure.{section} must be a list")
        for i, item in enumerate(raw_items):
            source = f"book-config.json: structure.{section}[{i}]"
            if not isinstance(item, dict):
                raise CheckError(f"{source} must be an object")
            for key in ("id", "title", "description", "path"):
                require_str(item, key, source=source)
            result[section].append(
                Entry(
                    section=section,
                    title=require_str(item, "title", source=source),
                    path=normalize_public_path(item.get("path"), source=f"{source}.path"),
                )
            )
    return result


def page_path_for(file_path: Path) -> str | None:
    if file_path.parts[0] != "docs":
        return None
    if any(part.startswith("_") for part in file_path.parts[1:]):
        return None
    if "assets" in file_path.parts:
        return None
    if file_path.name != "index.md":
        return None
    if file_path == Path("docs/index.md"):
        return "/"
    rel_parent = file_path.parent.relative_to("docs")
    return "/" + str(rel_parent).replace("\\", "/").strip("/") + "/"


def collect_pages() -> list[Page]:
    pages: list[Page] = []
    for file_path in sorted(Path("docs").glob("**/index.md")):
        public_path = page_path_for(file_path)
        if public_path is None:
            continue
        fm = parse_front_matter(file_path)
        permalink = fm.get("permalink")
        if permalink:
            public_path = normalize_public_path(permalink, source=f"{file_path}:permalink")
        pages.append(Page(path=file_path, public_path=public_path, title=fm.get("title")))
    return pages


def duplicate_values(values: list[str]) -> list[str]:
    seen: set[str] = set()
    duplicates: list[str] = []
    for value in values:
        if value in seen and value not in duplicates:
            duplicates.append(value)
        seen.add(value)
    return duplicates


def compare_sections(book_entries: dict[str, list[Entry]], nav_entries: dict[str, list[Entry]]) -> list[str]:
    errors: list[str] = []
    for section in SECTION_KEYS:
        book = book_entries.get(section, [])
        nav = nav_entries.get(section, [])
        if len(book) != len(nav):
            errors.append(f"{section}: count mismatch (book-config={len(book)}, navigation={len(nav)})")
        for i, (book_item, nav_item) in enumerate(zip(book, nav)):
            if book_item.title != nav_item.title:
                errors.append(f"{section}: title mismatch at index {i} (book-config={book_item.title!r}, navigation={nav_item.title!r})")
            if book_item.path != nav_item.path:
                errors.append(f"{section}: path mismatch at index {i} (book-config={book_item.path!r}, navigation={nav_item.path!r})")
        if len(book) > len(nav):
            errors.append(f"{section}: extra in book-config: {book[len(nav):]!r}")
        elif len(nav) > len(book):
            errors.append(f"{section}: extra in navigation: {nav[len(book):]!r}")
    return errors


def validate_public_version() -> list[str]:
    errors: list[str] = []
    for relative_path in ("src/introduction/index.md", "docs/introduction/index.md"):
        path = Path(relative_path)
        text = path.read_text(encoding="utf-8")
        if f"Version: {VERSION}" not in text:
            errors.append(f"{relative_path}: version badge must display {VERSION!r}")
        edition_pattern = rf"^\s*(?:-\s*)?\*\*版\*\*:\s*{re.escape(VERSION)}版\s*$"
        if not re.search(edition_pattern, text, re.MULTILINE):
            errors.append(f"{relative_path}: edition must display {VERSION!r}")
    return errors


def validate_ux_and_reader_routes(book: dict[str, Any], entries: list[Entry]) -> list[str]:
    errors: list[str] = []
    ux = book.get("ux")
    modules = ux.get("modules") if isinstance(ux, dict) else None
    if not isinstance(modules, dict):
        return ["book-config.json: ux.modules must be an object"]
    for key, expected in EXPECTED_UX_MODULES.items():
        actual = modules.get(key)
        if actual != expected:
            errors.append(f"book-config.json: ux.modules.{key} must be {expected!r} (actual={actual!r})")

    configured_paths = {entry.path for entry in entries}
    for label, route in REQUIRED_READER_ROUTES.items():
        route_path = route.split("#", 1)[0]
        if route_path not in configured_paths:
            errors.append(f"reader route missing ({label}): {route}")
    checklist = Path("docs/appendices/appendix01/index.md").read_text(encoding="utf-8")
    if "{#operational-checklists}" not in checklist:
        errors.append("reader route missing (checklist evidence): #operational-checklists anchor")
    return errors


def validate_build_scripts(package: dict[str, Any]) -> list[str]:
    errors: list[str] = []
    scripts = package.get("scripts")
    if not isinstance(scripts, dict):
        return ["package.json: scripts must be an object"]
    expected = {
        "start": "bundle exec jekyll serve --source docs --config docs/_config.yml --destination _site --livereload",
        "build": "bundle exec jekyll build --source docs --config docs/_config.yml --destination _site",
        "build:gh-pages": "bundle exec jekyll build --source docs --config docs/_config.yml --destination _site",
    }
    for name, command in expected.items():
        if scripts.get(name) != command:
            errors.append(f"package.json: scripts.{name} must be {command!r} (actual={scripts.get(name)!r})")
    return errors


def validate_metadata(book: dict[str, Any], package: dict[str, Any]) -> list[str]:
    errors: list[str] = []
    expected_book = {
        "title": TITLE,
        "description": DESCRIPTION,
        "author": AUTHOR,
        "version": VERSION,
        "language": "ja",
        "license": LICENSE,
        "homepage": PAGES_URL,
    }
    for key, expected in expected_book.items():
        actual = book.get(key)
        if actual != expected:
            errors.append(f"book-config.json: {key} must be {expected!r} (actual={actual!r})")
    repository = book.get("repository")
    if not isinstance(repository, dict):
        errors.append("book-config.json: repository must be an object")
    else:
        expected_repo = {"owner": "itdojp", "name": "supabase-architecture-patterns-book", "url": REPO_GIT_URL, "branch": "main"}
        for key, expected in expected_repo.items():
            actual = repository.get(key)
            if actual != expected:
                errors.append(f"book-config.json: repository.{key} must be {expected!r} (actual={actual!r})")

    expected_package = {
        "name": "supabase-architecture-patterns-book",
        "version": VERSION,
        "description": "Supabaseアーキテクチャパターン - 実践的な設計手法",
        "author": AUTHOR,
        "license": LICENSE,
        "homepage": PAGES_URL,
    }
    for key, expected in expected_package.items():
        actual = package.get(key)
        if actual != expected:
            errors.append(f"package.json: {key} must be {expected!r} (actual={actual!r})")
    pkg_repo = package.get("repository")
    if not isinstance(pkg_repo, dict) or pkg_repo.get("url") != f"git+{REPO_GIT_URL}":
        errors.append("package.json: repository.url must match canonical git+ GitHub URL")
    pkg_bugs = package.get("bugs")
    if not isinstance(pkg_bugs, dict) or pkg_bugs.get("url") != f"{REPO_URL}/issues":
        errors.append("package.json: bugs.url must match canonical GitHub issues URL")
    scripts = package.get("scripts")
    if not isinstance(scripts, dict):
        errors.append("package.json: scripts must be an object")
    else:
        if scripts.get("check:security") != "npm audit --omit=optional":
            errors.append("package.json: scripts.check:security must run 'npm audit --omit=optional'")
        test_script = scripts.get("test")
        if not isinstance(test_script, str):
            errors.append("package.json: scripts.test must be a string")
        else:
            for command in ("npm run check:metadata", "npm run check:security", "npm run lint", "npm run check-links"):
                if command not in test_script:
                    errors.append(f"package.json: scripts.test must include {command!r}")

    docs_cfg = parse_scalar_block(Path("docs/_config.yml").read_text(encoding="utf-8"))
    expected_docs = {
        "title": TITLE,
        "description": DESCRIPTION,
        "author": AUTHOR,
        "version": VERSION,
        "license": LICENSE,
        "homepage": PAGES_URL,
        "lang": "ja",
        "url": "https://itdojp.github.io",
        "baseurl": "/supabase-architecture-patterns-book",
        "repository": REPO_URL,
    }
    for key, expected in expected_docs.items():
        actual = docs_cfg.get(key)
        if actual != expected:
            errors.append(f"docs/_config.yml: {key} must be {expected!r} (actual={actual!r})")

    index_fm = parse_front_matter(Path("docs/index.md"))
    expected_index = {
        "title": TITLE,
        "description": DESCRIPTION,
        "author": AUTHOR,
        "version": VERSION,
        "permalink": "/",
    }
    for key, expected in expected_index.items():
        actual = index_fm.get(key)
        if actual != expected:
            errors.append(f"docs/index.md: front matter {key} must be {expected!r} (actual={actual!r})")

    readme = Path("README.md").read_text(encoding="utf-8")
    for command in ("npm run check:metadata", "npm run check:security", "npm test"):
        if command not in readme:
            errors.append(f"README.md: quality gate must document {command!r}")
    return errors


def validate_pages_and_assets(entries: list[Entry]) -> list[str]:
    errors: list[str] = []
    pages = collect_pages()
    page_paths = [page.public_path for page in pages]
    configured_paths = [entry.path for entry in entries]
    for duplicate in duplicate_values(page_paths):
        errors.append(f"duplicate public page path: {duplicate}")
    for duplicate in duplicate_values(configured_paths):
        errors.append(f"duplicate configured path: {duplicate}")
    page_set = set(page_paths)
    configured_set = set(configured_paths) | {"/"}
    for entry in entries:
        if entry.path not in page_set:
            errors.append(f"configured path has no docs page: {entry.section}:{entry.title} -> {entry.path}")
    for page in pages:
        if page.public_path not in configured_set:
            errors.append(f"docs page is not listed in book-config/navigation: {page.path} -> {page.public_path}")
    for asset in REQUIRED_ASSETS:
        path = Path("docs") / asset
        if not path.is_file() or path.stat().st_size == 0:
            errors.append(f"required public asset is missing or empty: docs/{asset}")
    return errors


def main() -> int:
    try:
        book = json.loads(Path("book-config.json").read_text(encoding="utf-8"))
        package = json.loads(Path("package.json").read_text(encoding="utf-8"))
        if not isinstance(book, dict):
            raise CheckError("book-config.json must be a JSON object")
        if not isinstance(package, dict):
            raise CheckError("package.json must be a JSON object")
        book_entries = collect_book_entries(book)
        nav_entries = parse_navigation(Path("docs/_data/navigation.yml"))
    except (CheckError, json.JSONDecodeError) as e:
        sys.stderr.write(f"{e}\n")
        return 1

    errors: list[str] = []
    errors.extend(validate_metadata(book, package))
    errors.extend(compare_sections(book_entries, nav_entries))
    all_entries = [entry for section in SECTION_KEYS for entry in book_entries.get(section, [])]
    errors.extend(validate_public_version())
    errors.extend(validate_ux_and_reader_routes(book, all_entries))
    errors.extend(validate_build_scripts(package))
    errors.extend(validate_pages_and_assets(all_entries))

    if errors:
        sys.stderr.write("metadata consistency check failed:\n")
        for error in errors:
            sys.stderr.write(f"- {error}\n")
        return 1

    counts = ", ".join(f"{section}={len(book_entries.get(section, []))}" for section in SECTION_KEYS)
    print(f"OK: metadata, navigation, configured pages, and assets match ({counts})")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
