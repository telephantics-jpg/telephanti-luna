"""Place the Luna desktop shortcut in the center of the visible desktop."""

from __future__ import annotations

import ctypes
import shutil
import sys
import time
from ctypes import wintypes
from pathlib import Path

BASE = Path(__file__).parent
ICON = BASE / "static" / "icons" / "luna.ico"
LAUNCHER = BASE / "scripts" / "Launch_Luna.vbs"
LVM_FIRST = 0x1000
LVM_FINDITEMW = LVM_FIRST + 133
LVM_SETITEMPOSITION32 = LVM_FIRST + 49
LVM_GETITEMCOUNT = LVM_FIRST + 4
LVFI_STRING = 0x0001
LVFI_WRAP = 0x0020
SPI_GETWORKAREA = 0x0030
SW_SHOWDEFAULT = 10


class POINT(ctypes.Structure):
    _fields_ = [("x", ctypes.c_long), ("y", ctypes.c_long)]


class RECT(ctypes.Structure):
    _fields_ = [
        ("left", ctypes.c_long),
        ("top", ctypes.c_long),
        ("right", ctypes.c_long),
        ("bottom", ctypes.c_long),
    ]


class LVFINDINFOW(ctypes.Structure):
    _fields_ = [
        ("flags", wintypes.UINT),
        ("psz", wintypes.LPCWSTR),
        ("lParam", wintypes.LPARAM),
        ("pt", POINT),
        ("vkDirection", wintypes.UINT),
    ]


user32 = ctypes.windll.user32
shell32 = ctypes.windll.shell32


def desktop_paths() -> list[Path]:
    from desktop_paths import desktop_roots

    return desktop_roots()


def ensure_shortcut() -> Path:
    if not LAUNCHER.exists():
        raise FileNotFoundError(f"Missing launcher: {LAUNCHER}")

    targets = desktop_paths()
    if not targets:
        raise RuntimeError("Could not locate Desktop folder")

    primary = targets[0]
    primary.mkdir(parents=True, exist_ok=True)
    dest = primary / "Luna.lnk"

    if sys.platform == "win32":
        try:
            import win32com.client  # type: ignore

            wsh = win32com.client.Dispatch("WScript.Shell")
            sc = wsh.CreateShortcut(str(dest))
            sc.TargetPath = str(LAUNCHER)
            sc.WorkingDirectory = str(BASE)
            sc.WindowStyle = 7
            sc.Description = "Open Luna desktop companion"
            if ICON.exists():
                sc.IconLocation = f"{ICON},0"
            sc.Save()
        except ImportError:
            for desk in targets[1:]:
                src = desk / "Luna.lnk"
                if src.exists():
                    shutil.copy2(src, dest)
                    break
            if not dest.exists():
                raise RuntimeError("Install Luna.lnk first (run install_desktop_shortcut.ps1)")
    else:
        raise RuntimeError("Windows only")

    for desk in targets[1:]:
        try:
            shutil.copy2(dest, desk / "Luna.lnk")
        except OSError:
            pass

    return dest


def find_desktop_listview() -> int | None:
    progman = user32.FindWindowW("Progman", None)
    if not progman:
        return None

    user32.SendMessageTimeoutW(progman, 0x052C, 0, 0, 0, 1000, None)

    def find_defview(parent: int) -> int | None:
        child = 0
        while True:
            child = user32.FindWindowExW(parent, child, "SHELLDLL_DefView", None)
            if not child:
                break
            lv = user32.FindWindowExW(child, None, "SysListView32", None)
            if lv:
                return lv
        return None

    lv = find_defview(progman)
    if lv:
        return lv

    worker = 0
    while True:
        worker = user32.FindWindowExW(None, worker, "WorkerW", None)
        if not worker:
            break
        lv = find_defview(worker)
        if lv:
            return lv
    return None


def work_area() -> RECT:
    rect = RECT()
    user32.SystemParametersInfoW(SPI_GETWORKAREA, 0, ctypes.byref(rect), 0)
    return rect


def center_icon(name: str = "Luna") -> bool:
    lv = find_desktop_listview()
    if not lv:
        return False

    user32.ShowWindow(user32.GetDesktopWindow(), SW_SHOWDEFAULT)

    info = LVFINDINFOW()
    info.flags = LVFI_STRING | LVFI_WRAP
    info.psz = name

    index = user32.SendMessageW(lv, LVM_FINDITEMW, -1, ctypes.byref(info))
    if index == -1:
        return False

    area = work_area()
    cx = (area.left + area.right) // 2 - 32
    cy = (area.top + area.bottom) // 2 - 32

    pos = (cx & 0xFFFF) | ((cy & 0xFFFF) << 16)
    user32.SendMessageW(lv, LVM_SETITEMPOSITION32, index, pos)
    return True


def refresh_desktop() -> None:
    user32.SendMessageW(user32.GetDesktopWindow(), 0x111, 0x7402, 0)  # F5


def main() -> int:
    ensure_shortcut()
    time.sleep(0.4)
    refresh_desktop()
    time.sleep(0.6)

    for attempt in range(8):
        if center_icon("Luna"):
            refresh_desktop()
            print("Luna icon centered on desktop.")
            return 0
        time.sleep(0.5)
        refresh_desktop()

    print("Luna.lnk is on your Desktop — press F5 on the desktop if you still do not see it.")
    print(f"Shortcut: {ensure_shortcut()}")
    return 1


if __name__ == "__main__":
    raise SystemExit(main())