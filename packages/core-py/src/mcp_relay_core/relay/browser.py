"""Cross-platform browser opening with WSL detection."""

import logging
import subprocess
import webbrowser

logger = logging.getLogger(__name__)


def _is_wsl() -> bool:
    """Detect if running inside WSL."""
    try:
        with open("/proc/version", encoding="utf-8") as f:
            version = f.read().lower()
        return "microsoft" in version or "wsl" in version
    except OSError:
        return False


def _open_in_wsl(url: str) -> bool:
    """Open URL from inside WSL using wslview or cmd.exe."""
    # Try wslview first (from wslu package, commonly available)
    try:
        subprocess.run(
            ["wslview", url],
            check=True,
            capture_output=True,
            timeout=10,
        )
        return True
    except (FileNotFoundError, subprocess.SubprocessError):
        pass

    # Fallback to cmd.exe /c start
    try:
        subprocess.run(
            ["cmd.exe", "/c", "start", url.replace("&", "^&")],
            check=True,
            capture_output=True,
            timeout=10,
        )
        return True
    except (FileNotFoundError, subprocess.SubprocessError):
        pass

    return False


def try_open_browser(url: str) -> bool:
    """Try to open URL in default browser. Returns True if likely succeeded.

    Detection order:
    1. WSL: check /proc/version for Microsoft/WSL, use 'wslview' or 'cmd.exe /c start'
    2. Standard: webbrowser.open()

    Never raises. Returns False on failure.

    Args:
        url: The URL to open.

    Returns:
        True if the browser was likely opened, False otherwise.
    """
    try:
        # 1. WSL detection
        if _is_wsl():
            logger.debug("WSL detected, using WSL-specific browser opening")
            result = _open_in_wsl(url)
            if result:
                return True
            logger.debug("WSL browser opening failed, falling through to webbrowser")

        # 2. Standard webbrowser
        result = webbrowser.open(url)
        if result:
            logger.debug("Opened browser via webbrowser.open()")
        else:
            logger.debug("webbrowser.open() returned False")
        return result

    except Exception as err:
        logger.debug("Failed to open browser: %s", err)
        return False
