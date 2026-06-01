from __future__ import annotations

import base64
import hmac
import hashlib
import os
from pathlib import Path

import streamlit as st


# ============================================================
# CONFIGURAÇÃO DA PÁGINA
# ============================================================
st.set_page_config(
    page_title="Fight for Life | Dashboard",
    page_icon="🥋",
    layout="wide",
    initial_sidebar_state="collapsed",
)

BASE_DIR = Path(__file__).resolve().parent
LOGO_PATH = BASE_DIR / "fight4life.png"

PRETO = "#000000"
AMARELO = "#fbc410"
BRANCO = "#ffffff"
CINZA_ESCURO = "#111111"
CINZA_BORDA = "#2a2a2a"

# Fotos oficiais escolhidas para a tela de login.
# Os arquivos ficam dentro da pasta assets do próprio projeto.
FOTOS_MODALIDADES = [
    {
        "titulo": "MUAY THAI",
        "subtitulo": "Técnica, intensidade e disciplina",
        "arquivo": BASE_DIR / "muaythai.png",
        "posicao": "center 43%",
    },
    {
        "titulo": "JIU-JITSU",
        "subtitulo": "Estratégia dentro e fora do tatame",
        "arquivo": BASE_DIR / "jiujitsu.png",
        "posicao": "center 57%",
    },
    {
        "titulo": "JIU-JITSU KIDS",
        "subtitulo": "Confiança e evolução desde cedo",
        "arquivo": BASE_DIR / "jiujitsukids.png",
        "posicao": "center 46%",
    },
    {
        "titulo": "MMA",
        "subtitulo": "Preparação completa para novos desafios",
        "arquivo": BASE_DIR / "mma.png",
        "posicao": "center 42%",
    },
]


# ============================================================
# FUNÇÕES AUXILIARES
# ============================================================
def arquivo_para_base64(caminho: Path) -> str:
    if not caminho.exists():
        return ""
    return base64.b64encode(caminho.read_bytes()).decode("utf-8")


def carregar_credenciais() -> tuple[str, str]:
    """
    Busca as credenciais principais nos Secrets do Streamlit.

    Aceita qualquer um destes formatos:

    FORMATO 1:
    [auth]
    username = "fight4life"
    password = "Fight4life2026!"

    FORMATO 2:
    username = "fight4life"
    password = "Fight4life2026!"

    FORMATO 3:
    dashboard_username = "fight4life"
    dashboard_password = "Fight4life2026!"
    """
    try:
        # Formato 1: seção [auth]
        if "auth" in st.secrets:
            secao_auth = st.secrets["auth"]
            usuario = str(secao_auth["username"]) if "username" in secao_auth else ""
            senha = str(secao_auth["password"]) if "password" in secao_auth else ""

            if usuario and senha:
                return usuario, senha

        # Formato 2: chaves diretas username/password
        usuario = str(st.secrets["username"]) if "username" in st.secrets else ""
        senha = str(st.secrets["password"]) if "password" in st.secrets else ""

        if usuario and senha:
            return usuario, senha

        # Formato 3: chaves diretas dashboard_username/dashboard_password
        usuario = str(st.secrets["dashboard_username"]) if "dashboard_username" in st.secrets else ""
        senha = str(st.secrets["dashboard_password"]) if "dashboard_password" in st.secrets else ""

        if usuario and senha:
            return usuario, senha

    except Exception:
        pass

    return (
        os.getenv("DASHBOARD_USERNAME", ""),
        os.getenv("DASHBOARD_PASSWORD", ""),
    )


def credenciais_validas(usuario_digitado: str, senha_digitada: str) -> bool:
    usuario_correto, senha_correta = carregar_credenciais()

    if not usuario_correto or not senha_correta:
        return False

    usuario_ok = hmac.compare_digest(
        usuario_digitado.strip(),
        usuario_correto.strip(),
    )
    senha_ok = hmac.compare_digest(
        senha_digitada,
        senha_correta,
    )
    return usuario_ok and senha_ok


def carregar_credenciais_diretoria() -> tuple[str, str]:
    """
    Busca as credenciais exclusivas da Diretoria nos Secrets do Streamlit.

    O código aceita três formatos diferentes para evitar erro de configuração:

    FORMATO RECOMENDADO E MAIS SIMPLES:
    [auth]
    username = "fight4life"
    password = "Fight4life2026!"
    diretoria_username = "fight4lifediretoria"
    diretoria_password = "Fight4LifeDiretoria!"

    FORMATO ALTERNATIVO 1:
    [diretoria]
    username = "fight4lifediretoria"
    password = "Fight4LifeDiretoria!"

    FORMATO ALTERNATIVO 2:
    diretoria_username = "fight4lifediretoria"
    diretoria_password = "Fight4LifeDiretoria!"
    """
    try:
        # Formato recomendado: credenciais da Diretoria dentro da seção [auth]
        if "auth" in st.secrets:
            secao_auth = st.secrets["auth"]

            usuario = (
                str(secao_auth["diretoria_username"])
                if "diretoria_username" in secao_auth
                else ""
            )
            senha = (
                str(secao_auth["diretoria_password"])
                if "diretoria_password" in secao_auth
                else ""
            )

            if usuario and senha:
                return usuario, senha

        # Formato alternativo 1: seção independente [diretoria]
        if "diretoria" in st.secrets:
            secao_diretoria = st.secrets["diretoria"]

            usuario = (
                str(secao_diretoria["username"])
                if "username" in secao_diretoria
                else ""
            )
            senha = (
                str(secao_diretoria["password"])
                if "password" in secao_diretoria
                else ""
            )

            if usuario and senha:
                return usuario, senha

        # Formato alternativo 2: chaves diretas na raiz do Secrets
        usuario = (
            str(st.secrets["diretoria_username"])
            if "diretoria_username" in st.secrets
            else ""
        )
        senha = (
            str(st.secrets["diretoria_password"])
            if "diretoria_password" in st.secrets
            else ""
        )

        if usuario and senha:
            return usuario, senha

    except Exception:
        pass

    return (
        os.getenv("DIRETORIA_USERNAME", ""),
        os.getenv("DIRETORIA_PASSWORD", ""),
    )


def credenciais_diretoria_validas(
    usuario_digitado: str,
    senha_digitada: str,
) -> bool:
    """
    Valida o acesso da Diretoria.

    Primeiro tenta ler as credenciais configuradas nos Secrets do Streamlit.
    Como proteção adicional, também aceita uma validação por hash embutida
    no código. Assim a área Diretoria continua funcionando mesmo se o
    Streamlit não atualizar os Secrets imediatamente.
    """
    usuario_digitado = usuario_digitado.strip()
    senha_digitada = senha_digitada.strip()

    usuario_correto, senha_correta = carregar_credenciais_diretoria()

    if usuario_correto and senha_correta:
        usuario_ok = hmac.compare_digest(
            usuario_digitado,
            usuario_correto.strip(),
        )
        senha_ok = hmac.compare_digest(
            senha_digitada,
            senha_correta,
        )

        if usuario_ok and senha_ok:
            return True

    # Fallback seguro por hash:
    # não expõe a senha real diretamente dentro do código público.
    usuario_hash_esperado = "8c76bd0b84a23f223ff2fbcb9c71c89d6fe911b7e70d1affb1c3c4e2e7efa673"
    senha_hash_esperado = "bf1462cbe311cd19f0b10919d21870e16cd678965d18f0c79bb003a5ad4c2d0e"

    usuario_hash_digitado = hashlib.sha256(
        usuario_digitado.encode("utf-8")
    ).hexdigest()
    senha_hash_digitada = hashlib.sha256(
        senha_digitada.encode("utf-8")
    ).hexdigest()

    return (
        hmac.compare_digest(usuario_hash_digitado, usuario_hash_esperado)
        and hmac.compare_digest(senha_hash_digitada, senha_hash_esperado)
    )


def aplicar_css() -> None:
    st.markdown(
        f"""
        <style>
            :root {{
                --preto: {PRETO};
                --amarelo: {AMARELO};
                --branco: {BRANCO};
                --cinza-escuro: {CINZA_ESCURO};
                --cinza-borda: {CINZA_BORDA};
            }}

            html, body, [data-testid="stAppViewContainer"] {{
                background:
                    radial-gradient(circle at 12% 20%, rgba(251,196,16,0.11), transparent 22rem),
                    radial-gradient(circle at 88% 82%, rgba(251,196,16,0.08), transparent 26rem),
                    linear-gradient(135deg, #000000 0%, #090909 52%, #000000 100%) !important;
            }}

            [data-testid="stHeader"],
            [data-testid="stToolbar"],
            [data-testid="stDecoration"],
            #MainMenu,
            footer {{
                display: none !important;
            }}

            .block-container {{
                max-width: 1460px;
                padding-top: 1.15rem !important;
                padding-bottom: 1.2rem !important;
            }}

            * {{
                box-sizing: border-box;
            }}

            h1, h2, h3, p, span, label, div {{
                font-family: Arial, Helvetica, sans-serif;
            }}

            .top-strip {{
                align-items: center;
                display: flex;
                justify-content: space-between;
                margin-bottom: 1.1rem;
            }}

            .top-brand {{
                color: var(--branco);
                font-size: 0.78rem;
                font-weight: 950;
                letter-spacing: 0.22rem;
                text-transform: uppercase;
            }}

            .top-brand strong {{
                color: var(--amarelo);
            }}

            .top-tag {{
                border: 1px solid rgba(251,196,16,0.46);
                border-radius: 999px;
                color: var(--amarelo);
                font-size: 0.66rem;
                font-weight: 900;
                letter-spacing: 0.12rem;
                padding: 0.5rem 0.78rem;
                text-transform: uppercase;
            }}

            .hero-wrap {{
                padding: 1.7rem 0.35rem 0 0;
            }}

            .hero-kicker {{
                color: var(--amarelo);
                font-size: 0.75rem;
                font-weight: 950;
                letter-spacing: 0.22rem;
                margin-bottom: 0.45rem;
                text-transform: uppercase;
            }}

            .hero-title {{
                color: var(--branco);
                font-size: clamp(2.55rem, 5.2vw, 5.65rem);
                font-weight: 1000;
                letter-spacing: -0.25rem;
                line-height: 0.89;
                margin: 0;
                max-width: 770px;
                text-transform: uppercase;
            }}

            .hero-title strong {{
                color: var(--amarelo);
            }}

            .hero-divider {{
                color: var(--amarelo);
                display: inline-block;
                margin: 0 0.18rem;
            }}

            .hero-text {{
                color: #c8c8c8;
                font-size: 0.95rem;
                line-height: 1.55;
                margin: 1rem 0 1.2rem 0;
                max-width: 690px;
            }}

            .gallery-grid {{
                display: grid;
                gap: 11px;
                grid-template-columns: repeat(2, minmax(0, 1fr));
            }}

            .fight-card {{
                background-position: center;
                background-size: cover;
                border: 1px solid rgba(255,255,255,0.13);
                border-radius: 18px;
                min-height: 142px;
                overflow: hidden;
                position: relative;
                transition: 0.22s ease;
            }}

            .fight-card:hover {{
                border-color: var(--amarelo);
                transform: translateY(-4px);
            }}

            .fight-card::after {{
                background: linear-gradient(
                    180deg,
                    rgba(0,0,0,0.06) 0%,
                    rgba(0,0,0,0.18) 42%,
                    rgba(0,0,0,0.96) 100%
                );
                content: "";
                inset: 0;
                position: absolute;
            }}

            .fight-card-content {{
                bottom: 0;
                left: 0;
                padding: 0.72rem;
                position: absolute;
                z-index: 2;
            }}

            .fight-card-title {{
                color: var(--amarelo);
                font-size: 0.96rem;
                font-weight: 1000;
                letter-spacing: -0.035rem;
                margin: 0;
                text-transform: uppercase;
            }}

            .fight-card-sub {{
                color: var(--branco);
                font-size: 0.66rem;
                font-weight: 700;
                line-height: 1.25;
                margin: 0.22rem 0 0 0;
            }}

            .login-shell {{
                background:
                    linear-gradient(145deg, rgba(255,255,255,0.12), rgba(255,255,255,0.035));
                border: 1px solid rgba(251,196,16,0.42);
                border-radius: 26px;
                box-shadow:
                    0 25px 65px rgba(0,0,0,0.50),
                    inset 0 1px 0 rgba(255,255,255,0.13);
                margin-top: 1.15rem;
                overflow: hidden;
                padding: 0.78rem 1rem 0.05rem 1rem;
                position: relative;
            }}

            .login-shell::before {{
                background: var(--amarelo);
                content: "";
                height: 4px;
                left: 0;
                position: absolute;
                right: 0;
                top: 0;
            }}

            .login-shell::after {{
                background: rgba(251,196,16,0.10);
                border-radius: 50%;
                content: "";
                height: 210px;
                position: absolute;
                right: -95px;
                top: -80px;
                width: 210px;
                z-index: 0;
            }}

            .login-content {{
                position: relative;
                z-index: 2;
            }}

            .logo-wrap {{
                display: flex;
                justify-content: center;
                margin: 0.25rem 0 0.34rem 0;
            }}

            .logo-wrap img {{
                filter: drop-shadow(0 10px 24px rgba(0,0,0,0.48));
                height: 94px;
                object-fit: contain;
                width: 94px;
            }}

            .login-title {{
                color: var(--branco);
                font-size: 1.08rem;
                font-weight: 1000;
                letter-spacing: -0.05rem;
                margin: 0;
                text-align: center;
                text-transform: uppercase;
            }}

            .login-sub {{
                color: #bebebe;
                font-size: 0.76rem;
                line-height: 1.35;
                margin: 0.22rem auto 0.48rem auto;
                max-width: 340px;
                text-align: center;
            }}

            div[data-testid="stForm"] {{
                background: transparent !important;
                border: 0 !important;
                padding: 0 !important;
            }}

            div[data-testid="stTextInput"] label {{
                color: #ffffff !important;
                font-size: 0.70rem !important;
                font-weight: 900 !important;
                letter-spacing: 0.07rem !important;
                text-transform: uppercase !important;
            }}

            div[data-testid="stTextInput"] {{
                margin-bottom: 0.18rem !important;
            }}

            div[data-testid="stFormSubmitButton"] {{
                margin-top: 0.18rem !important;
            }}

            div[data-testid="stTextInput"] input {{
                background: #ffffff !important;
                border: 2px solid #ffffff !important;
                border-radius: 10px !important;
                color: #000000 !important;
                font-size: 0.9rem !important;
                font-weight: 750 !important;
                min-height: 39px !important;
            }}

            div[data-testid="stTextInput"] input:focus {{
                border-color: var(--amarelo) !important;
                box-shadow: 0 0 0 3px rgba(251,196,16,0.20) !important;
            }}

            div[data-testid="stFormSubmitButton"] button,
            div[data-testid="stButton"] button {{
                background: var(--amarelo) !important;
                border: 0 !important;
                border-radius: 10px !important;
                color: #000000 !important;
                font-size: 0.80rem !important;
                font-weight: 1000 !important;
                min-height: 39px !important;
                text-transform: uppercase !important;
                transition: 0.18s ease !important;
                width: 100% !important;
            }}

            div[data-testid="stFormSubmitButton"] button:hover,
            div[data-testid="stButton"] button:hover {{
                filter: brightness(1.08);
                transform: translateY(-1px);
            }}

            .login-note {{
                border-left: 3px solid var(--amarelo);
                color: #a7a7a7;
                font-size: 0.68rem;
                line-height: 1.35;
                margin: 0.54rem 0 0.58rem 0;
                padding-left: 0.68rem;
            }}

            [data-testid="stAlert"] {{
                border-radius: 12px;
                font-size: 0.80rem;
            }}

            .dash-head {{
                align-items: center;
                background: #111111;
                border: 1px solid #2a2a2a;
                border-radius: 18px;
                display: flex;
                justify-content: space-between;
                margin-bottom: 1rem;
                padding: 1.05rem 1.2rem;
            }}

            .dash-head h1 {{
                color: #ffffff;
                font-size: 1.52rem;
                margin: 0;
            }}

            .dash-head p {{
                color: var(--amarelo);
                font-size: 0.66rem;
                font-weight: 950;
                letter-spacing: 0.11rem;
                margin: 0.30rem 0 0 0;
                text-transform: uppercase;
            }}

            .metric-card {{
                background: #111111;
                border: 1px solid #2a2a2a;
                border-radius: 16px;
                min-height: 128px;
                padding: 1rem;
            }}

            .metric-label {{
                color: #a9a9a9;
                font-size: 0.66rem;
                font-weight: 950;
                letter-spacing: 0.08rem;
                text-transform: uppercase;
            }}

            .metric-value {{
                color: var(--amarelo);
                font-size: 2rem;
                font-weight: 1000;
                margin-top: 0.7rem;
            }}


            /* MENU LATERAL DO DASHBOARD */
            [data-testid="stSidebar"] {{
                background:
                    linear-gradient(180deg, #111111 0%, #080808 100%) !important;
                border-right: 1px solid rgba(251,196,16,0.22) !important;
                min-width: 258px !important;
            }}

            [data-testid="stSidebar"] > div:first-child {{
                padding-top: 0.8rem !important;
            }}

            [data-testid="stSidebar"] [data-testid="stSidebarContent"] {{
                background:
                    linear-gradient(180deg, #111111 0%, #080808 100%) !important;
            }}

            [data-testid="stSidebar"] h1,
            [data-testid="stSidebar"] h2,
            [data-testid="stSidebar"] h3,
            [data-testid="stSidebar"] p,
            [data-testid="stSidebar"] label,
            [data-testid="stSidebar"] span {{
                color: #ffffff !important;
            }}

            .sidebar-brand {{
                align-items: center;
                display: flex;
                gap: 0.68rem;
                margin: 0.15rem 0 1rem 0;
                padding: 0.45rem 0.15rem 0.85rem 0.15rem;
                border-bottom: 1px solid rgba(255,255,255,0.10);
            }}

            .sidebar-brand img {{
                border-radius: 50%;
                height: 54px;
                object-fit: contain;
                width: 54px;
            }}

            .sidebar-brand-title {{
                color: #ffffff;
                font-size: 0.88rem;
                font-weight: 1000;
                letter-spacing: 0.08rem;
                line-height: 1.05;
                text-transform: uppercase;
            }}

            .sidebar-brand-sub {{
                color: var(--amarelo);
                font-size: 0.62rem;
                font-weight: 900;
                letter-spacing: 0.08rem;
                margin-top: 0.24rem;
                text-transform: uppercase;
            }}

            [data-testid="stSidebar"] div[role="radiogroup"] {{
                gap: 0.42rem !important;
            }}

            [data-testid="stSidebar"] div[role="radiogroup"] label {{
                align-items: center;
                background: rgba(255,255,255,0.035);
                border: 1px solid rgba(255,255,255,0.08);
                border-radius: 12px;
                cursor: pointer;
                display: flex !important;
                min-height: 48px;
                padding: 0.68rem 0.72rem;
                transition: 0.18s ease;
            }}

            [data-testid="stSidebar"] div[role="radiogroup"] label > div:first-child {{
                flex: 0 0 auto !important;
            }}

            [data-testid="stSidebar"] div[role="radiogroup"] label p {{
                white-space: nowrap !important;
            }}

            [data-testid="stSidebar"] div[role="radiogroup"] {{
                width: 100% !important;
            }}


            [data-testid="stSidebar"] div[role="radiogroup"] label:hover {{
                background: rgba(251,196,16,0.10);
                border-color: rgba(251,196,16,0.35);
            }}

            [data-testid="stSidebar"] div[role="radiogroup"] label:has(input:checked) {{
                background: rgba(251,196,16,0.15);
                border-color: rgba(251,196,16,0.75);
            }}

            [data-testid="stSidebar"] div[role="radiogroup"] label:has(input:checked) p {{
                color: var(--amarelo) !important;
                font-weight: 950 !important;
            }}

            [data-testid="stSidebar"] div[role="radiogroup"] label p {{
                font-size: 0.86rem !important;
                font-weight: 800 !important;
            }}

            [data-testid="stSidebarCollapsedControl"] button,
            [data-testid="collapsedControl"] button {{
                background: var(--amarelo) !important;
                border: 1px solid var(--amarelo) !important;
                border-radius: 10px !important;
                color: #000000 !important;
            }}

            .sidebar-section-label {{
                color: #8e8e8e;
                font-size: 0.62rem;
                font-weight: 950;
                letter-spacing: 0.14rem;
                margin: 0.3rem 0 0.5rem 0.15rem;
                text-transform: uppercase;
            }}

            .page-title {{
                color: #ffffff;
                font-size: 1.56rem;
                font-weight: 1000;
                letter-spacing: -0.05rem;
                margin: 0;
            }}

            .page-subtitle {{
                color: var(--amarelo);
                font-size: 0.72rem;
                font-weight: 950;
                letter-spacing: 0.10rem;
                margin: 0.32rem 0 0 0;
                text-transform: uppercase;
            }}

            .diretoria-login-box {{
                align-items: center;
                background:
                    linear-gradient(145deg, rgba(255,255,255,0.06), rgba(255,255,255,0.025));
                border: 1px solid rgba(251,196,16,0.38);
                border-radius: 22px;
                box-shadow: 0 24px 60px rgba(0,0,0,0.30);
                box-sizing: border-box;
                display: flex;
                flex-direction: column;
                justify-content: center;
                margin: 1.2rem 0 0 0;
                max-width: none;
                padding: 1.2rem 1.2rem 0.25rem 1.2rem;
                text-align: center;
                width: 100%;
            }}

            .diretoria-login-title {{
                color: #ffffff;
                font-size: 1.42rem;
                font-weight: 1000;
                letter-spacing: -0.04rem;
                margin: 0;
                text-align: center;
                text-transform: uppercase;
                width: 100%;
            }}

            .diretoria-login-sub {{
                color: #bdbdbd;
                display: block;
                font-size: 0.80rem;
                line-height: 1.45;
                margin: 0.38rem auto 0.8rem auto;
                max-width: 640px;
                text-align: center;
                width: 100%;
            }}

            .diretoria-badge {{
                border: 1px solid rgba(251,196,16,0.50);
                border-radius: 999px;
                color: var(--amarelo);
                display: inline-block;
                font-size: 0.62rem;
                font-weight: 950;
                letter-spacing: 0.12rem;
                margin-bottom: 0.58rem;
                padding: 0.40rem 0.66rem;
                text-transform: uppercase;
            }}

            .diretoria-badge-wrap {{
                text-align: center;
                width: 100%;
            }}

            @media (max-width: 900px) {{
                .block-container {{
                    padding-left: 0.95rem !important;
                    padding-right: 0.95rem !important;
                    padding-top: 0.75rem !important;
                }}

                .hero-wrap {{
                    padding-top: 0.5rem;
                }}

                .hero-title {{
                    font-size: clamp(2.55rem, 14vw, 4.4rem);
                    letter-spacing: -0.16rem;
                }}

                .gallery-grid {{
                    gap: 8px;
                }}

                .fight-card {{
                    min-height: 112px;
                }}

                .fight-card-title {{
                    font-size: 0.88rem;
                }}

                .fight-card-sub {{
                    font-size: 0.62rem;
                }}

                .login-shell {{
                    margin-top: 0.55rem;
                }}
            }}
        </style>
        """,
        unsafe_allow_html=True,
    )


def montar_cards_modalidades() -> str:
    cards = []

    for modalidade in FOTOS_MODALIDADES:
        posicao = modalidade.get("posicao", "center")
        imagem_b64 = arquivo_para_base64(modalidade["arquivo"])
        imagem_src = f"data:image/png;base64,{imagem_b64}"

        cards.append(
            f"""
            <div
                class="fight-card"
                style="
                    background-image:url('{imagem_src}');
                    background-position:{posicao};
                "
            >
                <div class="fight-card-content">
                    <p class="fight-card-title">{modalidade["titulo"]}</p>
                    <p class="fight-card-sub">{modalidade["subtitulo"]}</p>
                </div>
            </div>
            """
        )

    return f'<div class="gallery-grid">{"".join(cards)}</div>'


def exibir_login() -> None:
    logo_b64 = arquivo_para_base64(LOGO_PATH)

    st.markdown(
        """
        <div class="top-strip">
            <div class="top-brand"><strong>Fight</strong> for Life</div>
            <div class="top-tag">Área interna</div>
        </div>
        """,
        unsafe_allow_html=True,
    )

    coluna_visual, coluna_login = st.columns([1.52, 0.88], gap="large")

    with coluna_visual:
        st.markdown(
            f"""
            <section class="hero-wrap">
                <p class="hero-kicker">Fight for Life • Artes marciais</p>
                <h1 class="hero-title">
                    DISCIPLINA <span class="hero-divider">•</span>
                    FORÇA <span class="hero-divider">•</span>
                    <strong>EVOLUÇÃO</strong>
                </h1>
                <p class="hero-text">
                    Mais do que treino. Um ambiente construído para evolução,
                    técnica, confiança e superação dentro e fora do tatame.
                </p>
                {montar_cards_modalidades()}
            </section>
            """,
            unsafe_allow_html=True,
        )

    with coluna_login:
        st.markdown('<section class="login-shell"><div class="login-content">', unsafe_allow_html=True)

        if logo_b64:
            st.markdown(
                f"""
                <div class="logo-wrap">
                    <img
                        src="data:image/png;base64,{logo_b64}"
                        alt="Logo Fight for Life"
                    />
                </div>
                """,
                unsafe_allow_html=True,
            )

        st.markdown(
            """
            <h2 class="login-title">Acesse o dashboard</h2>
            <p class="login-sub">
                Entre com suas credenciais para visualizar o painel interno
                da Fight for Life.
            </p>
            """,
            unsafe_allow_html=True,
        )

        with st.form("formulario_login", clear_on_submit=False):
            usuario = st.text_input(
                "Usuário",
                placeholder="Digite seu usuário",
            )
            senha = st.text_input(
                "Senha",
                type="password",
                placeholder="Digite sua senha",
            )
            entrar = st.form_submit_button("Entrar")

        if entrar:
            usuario_configurado, senha_configurada = carregar_credenciais()

            if not usuario_configurado or not senha_configurada:
                st.error(
                    "As credenciais ainda não foram configuradas nos Secrets "
                    "do Streamlit."
                )
            elif credenciais_validas(usuario, senha):
                st.session_state["autenticado"] = True
                st.session_state["usuario_logado"] = usuario.strip()
                st.rerun()
            else:
                st.error("Usuário ou senha incorretos.")

        st.markdown(
            """
            <p class="login-note">
                Painel exclusivo para acesso interno da academia.<br>
                Utilize suas credenciais para continuar.
            </p>
            </div></section>
            """,
            unsafe_allow_html=True,
        )


def exibir_login_diretoria() -> None:
    st.markdown(
        """
        <div class="dash-head">
            <div>
                <h1 class="page-title">Diretoria</h1>
                <p class="page-subtitle">Acesso restrito</p>
            </div>
        </div>

        <div class="diretoria-login-box">
            <div class="diretoria-badge-wrap">
                <span class="diretoria-badge">Área protegida</span>
            </div>
            <h2 class="diretoria-login-title">Login da Diretoria</h2>
            <p class="diretoria-login-sub">
                Digite as credenciais exclusivas da diretoria para visualizar
                os indicadores estratégicos da academia.
            </p>
        """,
        unsafe_allow_html=True,
    )

    with st.form("formulario_login_diretoria", clear_on_submit=False):
        usuario_diretoria = st.text_input(
            "Usuário da Diretoria",
            placeholder="Digite o usuário da diretoria",
            key="usuario_diretoria",
        )
        senha_diretoria = st.text_input(
            "Senha da Diretoria",
            type="password",
            placeholder="Digite a senha da diretoria",
            key="senha_diretoria",
        )
        entrar_diretoria = st.form_submit_button("Entrar na Diretoria")

    if entrar_diretoria:
        usuario_configurado, senha_configurada = carregar_credenciais_diretoria()

        if credenciais_diretoria_validas(
            usuario_diretoria,
            senha_diretoria,
        ):
            st.session_state["diretoria_autenticada"] = True
            st.rerun()
        else:
            st.error("Usuário ou senha da Diretoria incorretos.")

    st.markdown("</div>", unsafe_allow_html=True)



def aplicar_css_dashboard_claro() -> None:
    '''
    Estilo interno do dashboard inspirado na referência enviada:
    fundo claro, cards brancos, sombras leves e destaques em preto/amarelo.
    A tela de login externa continua escura.
    '''
    st.markdown(
        '''
        <style>
            [data-testid="stAppViewContainer"] {
                background:
                    radial-gradient(circle at 92% 2%, rgba(251,196,16,0.18), transparent 22rem),
                    linear-gradient(180deg, #f8f8f8 0%, #eef0f3 100%) !important;
            }

            .block-container {
                max-width: none !important;
                width: 100% !important;
                padding: 1.25rem 1.7rem 2rem 1.7rem !important;
            }

            [data-testid="stAppViewBlockContainer"] {
                max-width: none !important;
                width: 100% !important;
            }

            .dashboard-shell {
                width: 100%;
            }

            .dashboard-header {
                align-items: center;
                background: #ffffff;
                border: 1px solid #eceff3;
                border-radius: 24px;
                box-shadow: 0 14px 34px rgba(15, 23, 42, 0.07);
                display: flex;
                gap: 1rem;
                justify-content: space-between;
                margin-bottom: 1rem;
                overflow: hidden;
                padding: 1.05rem 1.2rem;
                position: relative;
            }

            .dashboard-header::after {
                background: #fbc410;
                bottom: 0;
                content: "";
                height: 4px;
                left: 0;
                position: absolute;
                right: 0;
            }

            .dash-brand {
                align-items: center;
                display: flex;
                gap: 0.85rem;
            }

            .dash-brand img {
                height: 58px;
                object-fit: contain;
                width: 58px;
            }

            .dash-brand-kicker {
                color: #a27800;
                font-size: 0.66rem;
                font-weight: 950;
                letter-spacing: 0.15rem;
                margin: 0 0 0.22rem 0;
                text-transform: uppercase;
            }

            .dash-brand-title {
                color: #111111;
                font-size: clamp(1.35rem, 2vw, 2rem);
                font-weight: 1000;
                letter-spacing: -0.06rem;
                line-height: 1;
                margin: 0;
            }

            .dash-brand-sub {
                color: #667085;
                font-size: 0.78rem;
                line-height: 1.35;
                margin: 0.35rem 0 0 0;
            }

            .dash-side-text {
                max-width: 490px;
                text-align: right;
            }

            .dash-side-title {
                color: #111111;
                font-size: 1.08rem;
                font-weight: 950;
                letter-spacing: -0.025rem;
                margin: 0;
            }

            .dash-side-title strong {
                color: #a27800;
            }

            .dash-side-sub {
                color: #667085;
                font-size: 0.75rem;
                line-height: 1.35;
                margin: 0.3rem 0 0 0;
            }

            .dashboard-grid-4 {
                display: grid;
                gap: 0.9rem;
                grid-template-columns: repeat(4, minmax(0, 1fr));
                margin-bottom: 0.95rem;
            }

            .dash-kpi {
                border-radius: 19px;
                box-shadow: 0 12px 24px rgba(15, 23, 42, 0.10);
                color: #ffffff;
                min-height: 124px;
                overflow: hidden;
                padding: 0.95rem 1rem;
                position: relative;
            }

            .dash-kpi::before {
                background: rgba(255,255,255,0.12);
                border-radius: 50%;
                content: "";
                height: 115px;
                position: absolute;
                right: -36px;
                top: -45px;
                width: 115px;
            }

            .dash-kpi::after {
                background: rgba(255,255,255,0.08);
                border-radius: 50%;
                bottom: -52px;
                content: "";
                height: 100px;
                position: absolute;
                right: 18px;
                width: 100px;
            }

            .kpi-black {
                background: linear-gradient(135deg, #080808 0%, #2c2c2c 100%);
            }

            .kpi-yellow {
                background: linear-gradient(135deg, #e7aa00 0%, #fbc410 100%);
                color: #151515;
            }

            .kpi-darkyellow {
                background: linear-gradient(135deg, #4b3900 0%, #9d7600 100%);
            }

            .kpi-gray {
                background: linear-gradient(135deg, #303030 0%, #6b6b6b 100%);
            }

            .dash-kpi-label {
                font-size: 0.74rem;
                font-weight: 850;
                letter-spacing: 0.02rem;
                margin: 0;
                opacity: 0.92;
            }

            .dash-kpi-value {
                font-size: 2rem;
                font-weight: 1000;
                letter-spacing: -0.08rem;
                line-height: 1;
                margin: 0.56rem 0 0 0;
            }

            .dash-kpi-footer {
                align-items: center;
                display: flex;
                font-size: 0.69rem;
                font-weight: 800;
                gap: 0.3rem;
                margin-top: 0.44rem;
                opacity: 0.86;
            }

            .dash-kpi-icon {
                font-size: 1.25rem;
                position: absolute;
                right: 1rem;
                top: 0.92rem;
                z-index: 2;
            }

            .dashboard-grid-main {
                display: grid;
                gap: 0.95rem;
                grid-template-columns: minmax(300px, 0.82fr) minmax(460px, 1.7fr);
                margin-bottom: 0.95rem;
            }

            .dash-panel {
                background: #ffffff;
                border: 1px solid #eceff3;
                border-radius: 22px;
                box-shadow: 0 12px 28px rgba(15, 23, 42, 0.065);
                min-height: 300px;
                overflow: hidden;
                padding: 1.05rem 1.1rem;
                position: relative;
            }

            .dash-panel-large {
                min-height: 300px;
            }

            .dash-panel-header {
                align-items: center;
                display: flex;
                justify-content: space-between;
                margin-bottom: 0.85rem;
            }

            .dash-panel-title {
                color: #202020;
                font-size: 1rem;
                font-weight: 950;
                letter-spacing: -0.025rem;
                margin: 0;
            }

            .dash-panel-icon {
                align-items: center;
                background: #fff7d6;
                border-radius: 12px;
                color: #a27800;
                display: flex;
                font-size: 1rem;
                height: 34px;
                justify-content: center;
                width: 34px;
            }

            .dash-panel-sub {
                color: #7a8494;
                font-size: 0.69rem;
                margin: 0.15rem 0 0 0;
            }

            .gauge-wrap {
                align-items: center;
                display: flex;
                flex-direction: column;
                justify-content: center;
                min-height: 215px;
            }

            .gauge {
                background: conic-gradient(
                    from 270deg,
                    #fbc410 0deg,
                    #fbc410 96deg,
                    #111111 96deg,
                    #111111 190deg,
                    #eceff3 190deg,
                    #eceff3 360deg
                );
                border-radius: 50%;
                height: 176px;
                position: relative;
                width: 176px;
            }

            .gauge::after {
                background: #ffffff;
                border-radius: 50%;
                content: "";
                inset: 22px;
                position: absolute;
            }

            .gauge-center {
                align-items: center;
                display: flex;
                flex-direction: column;
                inset: 0;
                justify-content: center;
                position: absolute;
                z-index: 2;
            }

            .gauge-label {
                color: #7a8494;
                font-size: 0.72rem;
                font-weight: 800;
            }

            .gauge-value {
                color: #111111;
                font-size: 2rem;
                font-weight: 1000;
                letter-spacing: -0.08rem;
                line-height: 1;
                margin-top: 0.25rem;
            }

            .gauge-note {
                color: #a27800;
                font-size: 0.68rem;
                font-weight: 850;
                margin-top: 0.62rem;
            }

            .chart-area {
                height: 218px;
                margin-top: 0.25rem;
                position: relative;
            }

            .chart-area svg {
                height: 100%;
                overflow: visible;
                width: 100%;
            }

            .chart-grid-line {
                stroke: #e6e8ec;
                stroke-width: 1;
            }

            .chart-line-yellow {
                fill: none;
                stroke: #fbc410;
                stroke-linecap: round;
                stroke-linejoin: round;
                stroke-width: 4;
            }

            .chart-line-black {
                fill: none;
                stroke: #1d1d1d;
                stroke-linecap: round;
                stroke-linejoin: round;
                stroke-width: 3;
            }

            .chart-dot-yellow {
                fill: #fbc410;
                stroke: #ffffff;
                stroke-width: 3;
            }

            .chart-dot-black {
                fill: #1d1d1d;
                stroke: #ffffff;
                stroke-width: 3;
            }

            .chart-legend {
                align-items: center;
                color: #667085;
                display: flex;
                flex-wrap: wrap;
                font-size: 0.68rem;
                font-weight: 800;
                gap: 0.85rem;
                margin-bottom: 0.15rem;
            }

            .legend-item {
                align-items: center;
                display: flex;
                gap: 0.35rem;
            }

            .legend-dot {
                border-radius: 50%;
                height: 8px;
                width: 8px;
            }

            .legend-yellow {
                background: #fbc410;
            }

            .legend-black {
                background: #1d1d1d;
            }

            .axis-labels {
                color: #8a94a4;
                display: grid;
                font-size: 0.61rem;
                grid-template-columns: repeat(7, 1fr);
                margin-top: 0.18rem;
                text-align: center;
            }

            .bars-wrap {
                align-items: end;
                display: grid;
                gap: 0.85rem;
                grid-template-columns: repeat(6, minmax(0, 1fr));
                height: 190px;
                margin-top: 0.4rem;
                padding: 0 0.5rem;
            }

            .bar-group {
                align-items: center;
                display: flex;
                flex-direction: column;
                height: 100%;
                justify-content: end;
                min-width: 0;
            }

            .bar {
                border-radius: 10px 10px 4px 4px;
                min-height: 18px;
                width: min(42px, 66%);
            }

            .bar-yellow {
                background: linear-gradient(180deg, #fbc410 0%, #d89e00 100%);
            }

            .bar-black {
                background: linear-gradient(180deg, #2f2f2f 0%, #090909 100%);
            }

            .bar-label {
                color: #667085;
                font-size: 0.62rem;
                font-weight: 800;
                margin-top: 0.5rem;
                overflow: hidden;
                text-align: center;
                text-overflow: ellipsis;
                white-space: nowrap;
                width: 100%;
            }

            .placeholder-pill {
                background: #fff7d6;
                border: 1px solid #f3db80;
                border-radius: 999px;
                color: #866500;
                display: inline-flex;
                font-size: 0.62rem;
                font-weight: 900;
                letter-spacing: 0.06rem;
                padding: 0.32rem 0.52rem;
                text-transform: uppercase;
            }

            .dashboard-footer-note {
                color: #7a8494;
                font-size: 0.69rem;
                margin-top: 0.75rem;
                text-align: right;
            }

            @media (max-width: 1050px) {
                .dashboard-grid-4 {
                    grid-template-columns: repeat(2, minmax(0, 1fr));
                }

                .dashboard-grid-main {
                    grid-template-columns: 1fr;
                }

                .dash-side-text {
                    display: none;
                }
            }

            @media (max-width: 620px) {
                .block-container {
                    padding: 0.85rem 0.75rem 1.5rem 0.75rem !important;
                }

                .dashboard-header {
                    border-radius: 18px;
                    padding: 0.85rem;
                }

                .dash-brand img {
                    height: 46px;
                    width: 46px;
                }

                .dash-brand-title {
                    font-size: 1.18rem;
                }

                .dashboard-grid-4 {
                    gap: 0.65rem;
                    grid-template-columns: repeat(2, minmax(0, 1fr));
                }

                .dash-kpi {
                    min-height: 106px;
                    padding: 0.78rem;
                }

                .dash-kpi-label {
                    font-size: 0.64rem;
                }

                .dash-kpi-value {
                    font-size: 1.55rem;
                }

                .dash-kpi-footer {
                    font-size: 0.58rem;
                }

                .dash-kpi-icon {
                    font-size: 1rem;
                    right: 0.75rem;
                    top: 0.78rem;
                }

                .dash-panel {
                    border-radius: 18px;
                    min-height: 270px;
                    padding: 0.88rem;
                }

                .bars-wrap {
                    gap: 0.45rem;
                    padding: 0;
                }

                .bar {
                    width: min(28px, 74%);
                }
            }
        </style>
        ''',
        unsafe_allow_html=True,
    )


def montar_kpis_dashboard(metricas: list[dict]) -> str:
    cards = []

    for item in metricas:
        cards.append(
            f'''
            <div class="dash-kpi {item["classe"]}">
                <div class="dash-kpi-icon">{item["icone"]}</div>
                <p class="dash-kpi-label">{item["titulo"]}</p>
                <p class="dash-kpi-value">{item["valor"]}</p>
                <div class="dash-kpi-footer">
                    <span>↗</span>
                    <span>{item["rodape"]}</span>
                </div>
            </div>
            '''
        )

    return f'<div class="dashboard-grid-4">{"".join(cards)}</div>'


def montar_dashboard_visual(
    logo_b64: str,
    pagina: str,
) -> str:
    if pagina == "📈 Comercial":
        titulo = "Painel Comercial"
        subtitulo = "Acompanhamento de alunos, aulas teste e novas matrículas"
        chamada = "Transformando acompanhamento em <strong>crescimento</strong>"
        descricao = (
            "Estrutura visual preparada para receber os dados comerciais "
            "da academia em tempo real."
        )

        metricas = [
            {"titulo": "Alunos ativos", "valor": "—", "rodape": "aguardando integração", "icone": "🥋", "classe": "kpi-black"},
            {"titulo": "Aulas teste", "valor": "—", "rodape": "aguardando integração", "icone": "🎯", "classe": "kpi-yellow"},
            {"titulo": "Novas matrículas", "valor": "—", "rodape": "aguardando integração", "icone": "⚡", "classe": "kpi-darkyellow"},
            {"titulo": "Conversão", "valor": "—", "rodape": "aguardando integração", "icone": "🏆", "classe": "kpi-gray"},
        ]

        gauge_title = "Conversão comercial"
        gauge_sub = "Aulas teste convertidas em matrícula"
        gauge_label = "Taxa de conversão"
        painel_title = "Aulas teste e novas matrículas"
        painel_sub = "Comparativo semanal"
        barras_title = "Desempenho por modalidade"
        barras_sub = "Estrutura pronta para exibir procura e matrículas"
        bar_labels = ["Jiu-Jitsu", "Muay Thai", "MMA", "Kids", "Nogi", "Boxe"]

    else:
        titulo = "Painel da Diretoria"
        subtitulo = "Visão estratégica para acompanhamento da academia"
        chamada = "Decisões mais rápidas com <strong>visão clara</strong>"
        descricao = (
            "Indicadores estratégicos organizados para facilitar "
            "o acompanhamento da diretoria."
        )

        metricas = [
            {"titulo": "Receita do mês", "valor": "—", "rodape": "aguardando integração", "icone": "💰", "classe": "kpi-black"},
            {"titulo": "Alunos ativos", "valor": "—", "rodape": "aguardando integração", "icone": "🥋", "classe": "kpi-yellow"},
            {"titulo": "Ticket médio", "valor": "—", "rodape": "aguardando integração", "icone": "📊", "classe": "kpi-darkyellow"},
            {"titulo": "Cancelamentos", "valor": "—", "rodape": "aguardando integração", "icone": "⚠️", "classe": "kpi-gray"},
        ]

        gauge_title = "Retenção de alunos"
        gauge_sub = "Acompanhamento mensal da permanência"
        gauge_label = "Taxa de retenção"
        painel_title = "Receita e matrículas"
        painel_sub = "Evolução semanal da operação"
        barras_title = "Resultado por modalidade"
        barras_sub = "Estrutura pronta para comparar desempenho"
        bar_labels = ["Jiu-Jitsu", "Muay Thai", "MMA", "Kids", "Nogi", "Boxe"]

    kpis_html = montar_kpis_dashboard(metricas)

    barras = [
        ("62%", "bar-yellow"),
        ("78%", "bar-black"),
        ("47%", "bar-yellow"),
        ("70%", "bar-black"),
        ("42%", "bar-yellow"),
        ("57%", "bar-black"),
    ]

    barras_html = "".join(
        [
            f'''
            <div class="bar-group">
                <div class="bar {classe}" style="height:{altura};"></div>
                <div class="bar-label">{label}</div>
            </div>
            '''
            for label, (altura, classe) in zip(bar_labels, barras)
        ]
    )

    return f'''
    <section class="dashboard-shell">
        <div class="dashboard-header">
            <div class="dash-brand">
                <img src="data:image/png;base64,{logo_b64}" alt="Fight for Life" />
                <div>
                    <p class="dash-brand-kicker">Fight for Life • Dashboard</p>
                    <h1 class="dash-brand-title">{titulo}</h1>
                    <p class="dash-brand-sub">{subtitulo}</p>
                </div>
            </div>

            <div class="dash-side-text">
                <p class="dash-side-title">{chamada}</p>
                <p class="dash-side-sub">{descricao}</p>
            </div>
        </div>

        {kpis_html}

        <div class="dashboard-grid-main">
            <article class="dash-panel">
                <div class="dash-panel-header">
                    <div>
                        <h2 class="dash-panel-title">{gauge_title}</h2>
                        <p class="dash-panel-sub">{gauge_sub}</p>
                    </div>
                    <div class="dash-panel-icon">◎</div>
                </div>

                <div class="gauge-wrap">
                    <div class="gauge">
                        <div class="gauge-center">
                            <span class="gauge-label">{gauge_label}</span>
                            <strong class="gauge-value">—</strong>
                        </div>
                    </div>
                    <div class="gauge-note">Aguardando integração dos dados</div>
                </div>
            </article>

            <article class="dash-panel dash-panel-large">
                <div class="dash-panel-header">
                    <div>
                        <h2 class="dash-panel-title">{painel_title}</h2>
                        <p class="dash-panel-sub">{painel_sub}</p>
                    </div>
                    <span class="placeholder-pill">Layout inicial</span>
                </div>

                <div class="chart-legend">
                    <span class="legend-item"><span class="legend-dot legend-yellow"></span>Indicador principal</span>
                    <span class="legend-item"><span class="legend-dot legend-black"></span>Indicador secundário</span>
                </div>

                <div class="chart-area">
                    <svg viewBox="0 0 760 220" preserveAspectRatio="none" aria-label="Estrutura visual do gráfico">
                        <line x1="0" y1="30" x2="760" y2="30" class="chart-grid-line"/>
                        <line x1="0" y1="75" x2="760" y2="75" class="chart-grid-line"/>
                        <line x1="0" y1="120" x2="760" y2="120" class="chart-grid-line"/>
                        <line x1="0" y1="165" x2="760" y2="165" class="chart-grid-line"/>
                        <line x1="0" y1="210" x2="760" y2="210" class="chart-grid-line"/>

                        <polyline points="20,164 135,139 250,74 365,115 480,98 595,139 730,69" class="chart-line-yellow"/>
                        <polyline points="20,184 135,172 250,133 365,126 480,151 595,145 730,112" class="chart-line-black"/>

                        <circle cx="20" cy="164" r="6" class="chart-dot-yellow"/>
                        <circle cx="135" cy="139" r="6" class="chart-dot-yellow"/>
                        <circle cx="250" cy="74" r="6" class="chart-dot-yellow"/>
                        <circle cx="365" cy="115" r="6" class="chart-dot-yellow"/>
                        <circle cx="480" cy="98" r="6" class="chart-dot-yellow"/>
                        <circle cx="595" cy="139" r="6" class="chart-dot-yellow"/>
                        <circle cx="730" cy="69" r="6" class="chart-dot-yellow"/>

                        <circle cx="20" cy="184" r="5" class="chart-dot-black"/>
                        <circle cx="135" cy="172" r="5" class="chart-dot-black"/>
                        <circle cx="250" cy="133" r="5" class="chart-dot-black"/>
                        <circle cx="365" cy="126" r="5" class="chart-dot-black"/>
                        <circle cx="480" cy="151" r="5" class="chart-dot-black"/>
                        <circle cx="595" cy="145" r="5" class="chart-dot-black"/>
                        <circle cx="730" cy="112" r="5" class="chart-dot-black"/>
                    </svg>
                </div>

                <div class="axis-labels">
                    <span>Seg</span><span>Ter</span><span>Qua</span><span>Qui</span><span>Sex</span><span>Sáb</span><span>Dom</span>
                </div>
            </article>
        </div>

        <article class="dash-panel dash-panel-large">
            <div class="dash-panel-header">
                <div>
                    <h2 class="dash-panel-title">{barras_title}</h2>
                    <p class="dash-panel-sub">{barras_sub}</p>
                </div>
                <div class="dash-panel-icon">▥</div>
            </div>

            <div class="bars-wrap">
                {barras_html}
            </div>

            <div class="dashboard-footer-note">
                Valores demonstrativos apenas para visualização do layout.
            </div>
        </article>
    </section>
    '''



def exibir_dashboard_inicial() -> None:
    aplicar_css_dashboard_claro()

    logo_b64 = arquivo_para_base64(LOGO_PATH)

    if "diretoria_autenticada" not in st.session_state:
        st.session_state["diretoria_autenticada"] = False

    with st.sidebar:
        if logo_b64:
            st.markdown(
                f'''
                <div class="sidebar-brand">
                    <img src="data:image/png;base64,{logo_b64}" alt="Fight for Life" />
                    <div>
                        <div class="sidebar-brand-title">Fight for Life</div>
                        <div class="sidebar-brand-sub">Painel interno</div>
                    </div>
                </div>
                ''',
                unsafe_allow_html=True,
            )

        st.markdown(
            '<div class="sidebar-section-label">Navegação</div>',
            unsafe_allow_html=True,
        )

        pagina = st.radio(
            "Menu principal",
            options=["📈 Comercial", "👔 Diretoria"],
            label_visibility="collapsed",
            key="menu_principal",
        )

        st.markdown("<div style='height:0.6rem'></div>", unsafe_allow_html=True)

        if st.button("Sair da conta"):
            st.session_state["autenticado"] = False
            st.session_state["diretoria_autenticada"] = False
            st.session_state.pop("usuario_logado", None)
            st.rerun()

    if pagina == "👔 Diretoria" and not st.session_state["diretoria_autenticada"]:
        exibir_login_diretoria()
        return

    st.markdown(
        montar_dashboard_visual(
            logo_b64=logo_b64,
            pagina=pagina,
        ),
        unsafe_allow_html=True,
    )

    if pagina == "👔 Diretoria":
        st.markdown("<div style='height:0.7rem'></div>", unsafe_allow_html=True)

        col_esquerda, col_botao = st.columns([5, 1])

        with col_botao:
            if st.button("Bloquear Diretoria"):
                st.session_state["diretoria_autenticada"] = False
                st.rerun()


# ============================================================
# EXECUÇÃO
# ============================================================
aplicar_css()

if "autenticado" not in st.session_state:
    st.session_state["autenticado"] = False

if st.session_state["autenticado"]:
    exibir_dashboard_inicial()
else:
    exibir_login()
