"""
Launcher de compatibilidade com o EasyPanel.

O serviço antigo ainda pode ter Start Command = `streamlit run app.py`.
Nesse caso, este arquivo troca o processo pelo servidor Node (API + front).
"""
from __future__ import annotations

import os
import sys


def main() -> None:
    os.environ.setdefault("HOST", "0.0.0.0")
    os.environ.setdefault("WEB_DIST_PATH", "apps/web/dist")
    # EasyPanel costuma injetar PORT; se não vier, usa 3000
    os.environ.setdefault("PORT", "3000")

    os.execvp(
        "npm",
        ["npm", "run", "start", "-w", "@oppi/api"],
    )


# Streamlit executa o arquivo no import — precisa rodar no topo.
main()
