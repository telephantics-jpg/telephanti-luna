"""Windows desktop paths — Luna.lnk on Desktop, everything else in Luna-Telephanti."""

from __future__ import annotations

import os
from pathlib import Path

LUNA_DESKTOP_DIRNAME = "Luna-Telephanti"


def desktop_roots() -> list[Path]:
    dirs: list[Path] = []
    if os.name == "nt":
        try:
            import ctypes
            from ctypes import wintypes

            buf = ctypes.create_unicode_buffer(260)
            if ctypes.windll.shell32.SHGetFolderPathW(None, 0x0010, None, 0, buf) == 0:
                p = Path(buf.value)
                if p.is_dir():
                    dirs.append(p)
        except OSError:
            pass
        try:
            import winreg

            with winreg.OpenKey(
                winreg.HKEY_CURRENT_USER,
                r"Software\Microsoft\Windows\CurrentVersion\Explorer\Shell Folders",
            ) as key:
                desk, _ = winreg.QueryValueEx(key, "Desktop")
                p = Path(desk)
                if p.is_dir() and p not in dirs:
                    dirs.append(p)
        except OSError:
            pass
    if "USERPROFILE" in os.environ:
        home = Path(os.environ["USERPROFILE"])
        for candidate in (home / "OneDrive" / "Desktop", home / "Desktop"):
            if candidate.is_dir():
                resolved = candidate.resolve()
                if resolved not in {d.resolve() for d in dirs}:
                    dirs.append(candidate)
    return dirs


def desktop_shortcut_dir() -> Path:
    roots = desktop_roots()
    if roots:
        return roots[0]
    home = Path(os.environ.get("USERPROFILE", Path.home()))
    return home / "Desktop"


def luna_artifacts_dir(*, create: bool = True) -> Path:
    folder = desktop_shortcut_dir() / LUNA_DESKTOP_DIRNAME
    if create:
        folder.mkdir(parents=True, exist_ok=True)
    return folder