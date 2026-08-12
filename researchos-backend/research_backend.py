# research_backend.py — PASTE YOUR CODE BELOW THIS LINE
#
# ============================================================
# KNOWN BUGS TO FIX AFTER YOU PASTE YOUR CODE:
# ============================================================
# 1) DELETE the stray import line:
#        from curses import raw
#    It will break on Windows (curses doesn't exist there) and
#    `raw` isn't used. Remove it as part of the cleanup.
#
# 2) ADD this import to the top-of-file imports block
#    (next to the other `from ... import ...` lines):
#        from pathlib import Path
#    fetch_github_context() uses Path(...) but pathlib is not
#    currently imported, so the file will NameError on call.
# ============================================================
