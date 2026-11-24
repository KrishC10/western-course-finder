import sys
from pathlib import Path

# Let tests import the scraper modules the same way the scripts do.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
