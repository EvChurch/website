#!/usr/bin/env python3
"""Post-install configuration for the Codex devcontainer.

Runs on container creation to set up:
- Compound Engineering for Codex
- Tmux configuration (200k history, mouse support)
- Directory ownership fixes for mounted volumes
"""

import os
import shutil
import subprocess
import sys
from pathlib import Path

COMPOUND_ENGINEERING_REF = "a9f6d530d4446d805a3100387dedd86268d7e695"
COMPOUND_ENGINEERING_MARKETPLACE = "compound-engineering-plugin"
COMPOUND_ENGINEERING_PLUGIN = (
    f"compound-engineering@{COMPOUND_ENGINEERING_MARKETPLACE}"
)


def setup_compound_engineering():
    """Install the Compound Engineering marketplace and plugin for Codex."""
    codex = shutil.which("codex")
    if codex is None:
        print(
            "[post_install] Warning: Codex is not on PATH; "
            "Compound Engineering was not installed",
            file=sys.stderr,
        )
        return

    try:
        marketplaces = subprocess.run(
            [codex, "plugin", "marketplace", "list"],
            check=True,
            capture_output=True,
            text=True,
        ).stdout
        plugins = subprocess.run(
            [codex, "plugin", "list"],
            check=True,
            capture_output=True,
            text=True,
        ).stdout
        plugin_installed = any(
            line.startswith(f"{COMPOUND_ENGINEERING_PLUGIN} ")
            and "installed, enabled" in line
            for line in plugins.splitlines()
        )

        marketplace_line = next(
            (
                line
                for line in marketplaces.splitlines()
                if line.startswith(f"{COMPOUND_ENGINEERING_MARKETPLACE} ")
            ),
            None,
        )
        if marketplace_line is not None:
            marketplace_path = marketplace_line.split(maxsplit=1)[1]
            installed_ref = subprocess.run(
                ["git", "-C", marketplace_path, "rev-parse", "HEAD"],
                check=True,
                capture_output=True,
                text=True,
            ).stdout.strip()
            if installed_ref != COMPOUND_ENGINEERING_REF:
                if plugin_installed:
                    subprocess.run(
                        [codex, "plugin", "remove", COMPOUND_ENGINEERING_PLUGIN],
                        check=True,
                    )
                    plugin_installed = False
                subprocess.run(
                    [
                        codex,
                        "plugin",
                        "marketplace",
                        "remove",
                        COMPOUND_ENGINEERING_MARKETPLACE,
                    ],
                    check=True,
                )
                marketplace_line = None

        if marketplace_line is None:
            subprocess.run(
                [
                    codex,
                    "plugin",
                    "marketplace",
                    "add",
                    "--ref",
                    COMPOUND_ENGINEERING_REF,
                    "EveryInc/compound-engineering-plugin",
                ],
                check=True,
            )

        if not plugin_installed:
            subprocess.run(
                [
                    codex,
                    "plugin",
                    "add",
                    COMPOUND_ENGINEERING_PLUGIN,
                ],
                check=True,
            )

        print("[post_install] Compound Engineering ready", file=sys.stderr)
    except subprocess.CalledProcessError as error:
        print(
            "[post_install] Warning: Could not install Compound Engineering: "
            f"{error}",
            file=sys.stderr,
        )


def setup_tmux_config():
    """Configure tmux with 200k history, mouse support, and vi keys."""
    tmux_conf = Path.home() / ".tmux.conf"

    if tmux_conf.exists():
        print("[post_install] Tmux config exists, skipping", file=sys.stderr)
        return

    config = """\
# 200k line scrollback history
set-option -g history-limit 200000

# Enable mouse support
set -g mouse on

# Use vi keys in copy mode
setw -g mode-keys vi

# Start windows and panes at 1, not 0
set -g base-index 1
setw -g pane-base-index 1

# Renumber windows when one is closed
set -g renumber-windows on

# Faster escape time for vim
set -sg escape-time 10

# True color support
set -g default-terminal "tmux-256color"
set -ag terminal-overrides ",xterm-256color:RGB"

# Terminal features (ghostty, cursor shape in vim)
set -as terminal-features ",xterm-ghostty:RGB"
set -as terminal-features ",xterm*:RGB"
set -ga terminal-overrides ",xterm*:colors=256"
set -ga terminal-overrides '*:Ss=\\E[%p1%d q:Se=\\E[ q'

# Status bar
set -g status-style 'bg=#333333 fg=#ffffff'
set -g status-left '[#S] '
set -g status-right '%Y-%m-%d %H:%M'
"""
    tmux_conf.write_text(config, encoding="utf-8")
    print(f"[post_install] Tmux configured: {tmux_conf}", file=sys.stderr)


def fix_directory_ownership():
    """Fix ownership of mounted volumes that may have root ownership."""
    uid = os.getuid()
    gid = os.getgid()

    dirs_to_fix = [
        Path.home() / ".codex",
        Path("/commandhistory"),
        Path.home() / ".config" / "gh",
    ]

    for dir_path in dirs_to_fix:
        if dir_path.exists():
            try:
                # Use sudo to fix ownership if needed
                stat_info = dir_path.stat()
                if stat_info.st_uid != uid:
                    subprocess.run(
                        ["sudo", "chown", "-R", f"{uid}:{gid}", str(dir_path)],
                        check=True,
                        capture_output=True,
                    )
                    print(f"[post_install] Fixed ownership: {dir_path}", file=sys.stderr)
            except (PermissionError, subprocess.CalledProcessError) as e:
                print(
                    f"[post_install] Warning: Could not fix ownership of {dir_path}: {e}",
                    file=sys.stderr,
                )


def setup_global_gitignore():
    """Set up global gitignore and local git config.

    Since ~/.gitconfig is mounted read-only from host, we create a local
    config file that includes the host config and adds container-specific
    settings like core.excludesfile and delta configuration.

    GIT_CONFIG_GLOBAL env var (set in devcontainer.json) points git to this
    local config as the "global" config.
    """
    home = Path.home()
    gitignore = home / ".gitignore_global"
    local_gitconfig = home / ".gitconfig.local"
    host_gitconfig = home / ".gitconfig"

    # Create global gitignore with common patterns
    patterns = """\
# Codex user state
.codex/

# macOS
.DS_Store
.AppleDouble
.LSOverride
._*

# Python
*.pyc
*.pyo
__pycache__/
*.egg-info/
.eggs/
*.egg
.venv/
venv/
.mypy_cache/
.ruff_cache/

# Node
node_modules/
.npm/

# Editors
*.swp
*.swo
*~
.idea/
.vscode/
*.sublime-*

# Misc
*.log
.env.local
.env.*.local
"""
    gitignore.write_text(patterns, encoding="utf-8")
    print(f"[post_install] Global gitignore created: {gitignore}", file=sys.stderr)

    # Create local git config that includes host config and sets excludesfile + delta
    # Delta config is included here so it works even if host doesn't have it configured
    local_config = f"""\
# Container-local git config
# Includes host config (mounted read-only) and adds container settings

[include]
    path = {host_gitconfig}

[core]
    excludesfile = {gitignore}
    pager = delta

[interactive]
    diffFilter = delta --color-only

[delta]
    navigate = true
    light = false
    line-numbers = true
    side-by-side = false

[merge]
    conflictstyle = diff3

[diff]
    colorMoved = default

[gpg "ssh"]
    program = /usr/bin/ssh-keygen
"""
    local_gitconfig.write_text(local_config, encoding="utf-8")
    print(f"[post_install] Local git config created: {local_gitconfig}", file=sys.stderr)


def main():
    """Run all post-install configuration."""
    print("[post_install] Starting post-install configuration...", file=sys.stderr)

    fix_directory_ownership()
    setup_compound_engineering()
    setup_tmux_config()
    setup_global_gitignore()

    print("[post_install] Configuration complete!", file=sys.stderr)


if __name__ == "__main__":
    main()
