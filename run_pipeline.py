"""Backwards-compatible shim: prefer `python -m uk_equalising_cgt` or the
`uk-equalising-cgt-build` console script."""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent / "src"))

from uk_equalising_cgt.cli import main  # noqa: E402

if __name__ == "__main__":
    raise SystemExit(main())
