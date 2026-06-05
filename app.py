from __future__ import annotations

import base64
import hmac
import hashlib
import html
import json
import mimetypes
import os
import re
import unicodedata
import uuid
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen
from urllib.parse import urlencode
from datetime import date, datetime
from pathlib import Path
from zoneinfo import ZoneInfo

import gspread
import streamlit as st
from google.oauth2.service_account import Credentials
from gspread.utils import rowcol_to_a1


# ============================================================
# CONFIGURAÇÃO DA PÁGINA
# ============================================================
st.set_page_config(
    page_title="Fight for Life | Dashboard",
    page_icon="🥋",
    layout="wide",
    initial_sidebar_state="expanded",
)

BASE_DIR = Path(__file__).resolve().parent
LOGO_PATH = BASE_DIR / "fight4life.png"

PRETO = "#000000"
AMARELO = "#fbc410"
BRANCO = "#ffffff"
CINZA_ESCURO = "#111111"
CINZA_BORDA = "#2a2a2a"

# ============================================================
# GOOGLE SHEETS — BASE PERSISTENTE DOS LEADS
# ============================================================
SPREADSHEET_ID_PADRAO = "1WLjiRuU5iC_uPXCr9QSh1Yp934KYsse2C7yREDF5cA8"
WORKSHEET_NAME_PADRAO = "Leads"

DRIVE_UPLOAD_WEBAPP_URL_PADRAO = (
    "https://script.google.com/macros/s/"
    "AKfycbwEUfOvuG6WSUdMgDNWNjmfkdt5u_DnPM9c7WfmlCyb0qlifvLbzlKjmRDKfgKIk7DNSQ/"
    "exec"
)

COLUNAS_PLANILHA = [
    "IDLead",
    "Data Cadastro",
    "Nome Completo",
    "Data de Nascimento",
    "CPF",
    "E-mail",
    "Endereço",
    "Produto ou Serviço",
    "Rede Social",
    "Status Comercial",
    "Última Atualização",
    "Telefone",
    "Token Documento ZapSign",
    "Link Assinatura ZapSign",
    "Status Contrato",
    "Data Envio Contrato",
    "Erro Envio Contrato",
    "Rua",
    "Bairro",
    "CEP",
    "Complemento",
    "Plano Cliente",
    "Forma de Pagamento",
    "Foto do Rosto Drive",
]

GOOGLE_SCOPES = [
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/drive",
]

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
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');

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
                font-family: "Inter", "Segoe UI", Arial, sans-serif;
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
                font-weight: 800;
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
                font-weight: 700;
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
                font-weight: 800;
                letter-spacing: 0.22rem;
                margin-bottom: 0.45rem;
                text-transform: uppercase;
            }}

            .hero-title {{
                color: var(--branco);
                font-size: clamp(2.55rem, 5.2vw, 5.65rem);
                font-weight: 800;
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
                font-weight: 800;
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
                font-weight: 800;
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
                font-weight: 800;
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
                font-weight: 800;
                letter-spacing: 0.08rem;
                text-transform: uppercase;
            }}

            .metric-value {{
                color: var(--amarelo);
                font-size: 2rem;
                font-weight: 800;
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
                font-weight: 800;
                letter-spacing: 0.08rem;
                line-height: 1.05;
                text-transform: uppercase;
            }}

            .sidebar-brand-sub {{
                color: var(--amarelo);
                font-size: 0.62rem;
                font-weight: 700;
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
                box-sizing: border-box !important;
                cursor: pointer;
                display: flex !important;
                min-height: 48px;
                padding: 0.68rem 0.72rem;
                transition: 0.18s ease;
                width: 100% !important;
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

            [data-testid="stSidebar"] div[role="radiogroup"] > div,
            [data-testid="stSidebar"] div[role="radiogroup"] > label,
            [data-testid="stSidebar"] div[role="radiogroup"] label > div:last-child {{
                box-sizing: border-box !important;
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

            /*
            MENU LATERAL RETRÁTIL:
            mantém o comportamento nativo do Streamlit, com a setinha
            para abrir e fechar, mas deixa os controles sempre visíveis.
            */
            [data-testid="stSidebar"] {{
                background:
                    linear-gradient(180deg, #111111 0%, #080808 100%) !important;
                border-right: 1px solid rgba(251,196,16,0.22) !important;
                min-width: 258px !important;
                width: 258px !important;
            }}

            [data-testid="stSidebar"] > div:first-child,
            [data-testid="stSidebar"] [data-testid="stSidebarContent"],
            [data-testid="stSidebar"] [data-testid="stSidebarUserContent"] {{
                min-width: 258px !important;
                width: 258px !important;
            }}

            [data-testid="stSidebarCollapsedControl"],
            [data-testid="collapsedControl"],
            [data-testid="stSidebarCollapseButton"] {{
                display: flex !important;
                opacity: 1 !important;
                pointer-events: auto !important;
                visibility: visible !important;
                z-index: 999999 !important;
            }}

            [data-testid="stSidebarCollapsedControl"] button,
            [data-testid="collapsedControl"] button,
            [data-testid="stSidebarCollapseButton"] button {{
                align-items: center !important;
                background: var(--amarelo) !important;
                border: 1px solid var(--amarelo) !important;
                border-radius: 10px !important;
                color: #000000 !important;
                display: flex !important;
                height: 38px !important;
                justify-content: center !important;
                opacity: 1 !important;
                visibility: visible !important;
                width: 38px !important;
            }}

            [data-testid="stSidebarCollapsedControl"] svg,
            [data-testid="collapsedControl"] svg,
            [data-testid="stSidebarCollapseButton"] svg {{
                color: #000000 !important;
                fill: #000000 !important;
                stroke: #000000 !important;
            }}

            @media (max-width: 900px) {{
                [data-testid="stSidebarCollapsedControl"],
                [data-testid="collapsedControl"] {{
                    left: 0.65rem !important;
                    position: fixed !important;
                    top: 0.65rem !important;
                }}

                [data-testid="stSidebar"] {{
                    min-width: min(258px, 78vw) !important;
                    width: min(258px, 78vw) !important;
                }}

                [data-testid="stSidebar"] > div:first-child,
                [data-testid="stSidebar"] [data-testid="stSidebarContent"],
                [data-testid="stSidebar"] [data-testid="stSidebarUserContent"] {{
                    min-width: min(258px, 78vw) !important;
                    width: min(258px, 78vw) !important;
                }}
            }}

            .sidebar-section-label {{
                color: #8e8e8e;
                font-size: 0.62rem;
                font-weight: 800;
                letter-spacing: 0.14rem;
                margin: 0.3rem 0 0.5rem 0.15rem;
                text-transform: uppercase;
            }}

            .page-title {{
                color: #ffffff;
                font-size: 1.56rem;
                font-weight: 800;
                letter-spacing: -0.05rem;
                margin: 0;
            }}

            .page-subtitle {{
                color: var(--amarelo);
                font-size: 0.72rem;
                font-weight: 800;
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
                font-weight: 800;
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
                font-weight: 800;
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
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');

            [data-testid="stAppViewContainer"] {
                background:
                    radial-gradient(circle at 90% 8%, rgba(251,196,16,0.26), transparent 28rem),
                    radial-gradient(circle at 12% 90%, rgba(251,196,16,0.10), transparent 30rem),
                    linear-gradient(135deg, #050505 0%, #111111 58%, #fbc410 160%) !important;
            }

            .block-container {
                max-width: none !important;
                width: 100% !important;
                padding: 1.25rem 1.7rem 2rem 1.7rem !important;
            }

            [data-testid="stAppViewBlockContainer"] {
                box-sizing: border-box !important;
                max-width: none !important;
                overflow-x: hidden !important;
                width: 100% !important;
            }

            [data-testid="stMain"] {
                overflow-x: hidden !important;
            }

            .dashboard-shell {
                width: 100%;
            }

            .dashboard-header {
                align-items: center;
                background: rgba(255,255,255,0.96);
                border: 1px solid rgba(255,255,255,0.65);
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
                font-weight: 800;
                letter-spacing: 0.15rem;
                margin: 0 0 0.22rem 0;
                text-transform: uppercase;
            }

            .dash-brand-title {
                color: #111111;
                font-size: clamp(1.35rem, 2vw, 2rem);
                font-weight: 800;
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
                font-weight: 800;
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
                font-weight: 700;
                letter-spacing: 0.02rem;
                margin: 0;
                opacity: 0.92;
            }

            .dash-kpi-value {
                font-size: 2rem;
                font-weight: 800;
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
                background: rgba(255,255,255,0.96);
                border: 1px solid rgba(255,255,255,0.65);
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
                font-weight: 800;
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
                font-weight: 800;
                letter-spacing: -0.08rem;
                line-height: 1;
                margin-top: 0.25rem;
            }

            .gauge-note {
                color: #a27800;
                font-size: 0.68rem;
                font-weight: 700;
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
                grid-template-columns: repeat(4, minmax(0, 1fr));
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

            .bar-value {
                color: #202020;
                font-size: 0.78rem;
                font-weight: 900;
                margin-bottom: 0.34rem;
                text-align: center;
            }

            .placeholder-pill {
                background: #fff7d6;
                border: 1px solid #f3db80;
                border-radius: 999px;
                color: #866500;
                display: inline-flex;
                font-size: 0.62rem;
                font-weight: 700;
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
        

            /* FORMULÁRIO RETRÁTIL COMERCIAL */
            [data-testid="stExpander"] {
                background: rgba(255,255,255,0.96) !important;
                border: 1px solid rgba(255,255,255,0.68) !important;
                border-radius: 22px !important;
                box-shadow: 0 12px 28px rgba(15, 23, 42, 0.065) !important;
                overflow: hidden !important;
            }

            [data-testid="stExpander"] details {
                border: 0 !important;
            }

            [data-testid="stExpander"] summary {
                background: transparent !important;
                padding: 0.95rem 1rem !important;
            }

            [data-testid="stExpander"] summary p {
                color: #202020 !important;
                font-size: 1rem !important;
                font-weight: 800 !important;
                letter-spacing: -0.025rem !important;
            }

            [data-testid="stExpander"] [data-testid="stExpanderDetails"] {
                padding: 0 1rem 1rem 1rem !important;
            }

            .form-card-intro {
                color: #7a8494;
                font-size: 0.70rem;
                line-height: 1.45;
                margin: -0.2rem 0 0.7rem 0;
            }

            .form-card-badge {
                background: #fff7d6;
                border: 1px solid #f3db80;
                border-radius: 999px;
                color: #866500;
                display: inline-flex;
                font-size: 0.61rem;
                font-weight: 800;
                letter-spacing: 0.06rem;
                margin-bottom: 0.55rem;
                padding: 0.30rem 0.50rem;
                text-transform: uppercase;
            }

            [data-testid="stExpander"] label {
                color: #303030 !important;
                font-size: 0.72rem !important;
                font-weight: 700 !important;
            }

            [data-testid="stExpander"] input,
            [data-testid="stExpander"] textarea,
            [data-testid="stExpander"] [data-baseweb="select"] > div {
                background: #ffffff !important;
                border-color: #e1e5ea !important;
                color: #111111 !important;
            }

            [data-testid="stExpander"] textarea {
                min-height: 74px !important;
            }

            [data-testid="stExpander"] div[data-testid="stFormSubmitButton"] button {
                background: #fbc410 !important;
                border: 0 !important;
                border-radius: 10px !important;
                color: #111111 !important;
                font-weight: 800 !important;
                min-height: 42px !important;
                width: 100% !important;
            }

            [data-testid="stExpander"] div[data-testid="stFormSubmitButton"] button:hover {
                filter: brightness(1.04);
            }

            /* TEXTO PRETO EM TODO O FORMULÁRIO RETRÁTIL */
            [data-testid="stExpander"],
            [data-testid="stExpander"] *,
            [data-testid="stExpander"] p,
            [data-testid="stExpander"] span,
            [data-testid="stExpander"] label,
            [data-testid="stExpander"] div,
            [data-testid="stExpander"] input,
            [data-testid="stExpander"] textarea,
            [data-testid="stExpander"] select {
                color: #111111 !important;
            }

            [data-testid="stExpander"] input::placeholder,
            [data-testid="stExpander"] textarea::placeholder {
                color: #7a8494 !important;
                opacity: 1 !important;
            }

            [data-testid="stExpander"] [data-baseweb="select"] *,
            [data-testid="stExpander"] [data-baseweb="input"] *,
            [data-testid="stExpander"] [data-baseweb="textarea"] * {
                color: #111111 !important;
            }

            [data-testid="stExpander"] .form-card-intro {
                color: #5f6875 !important;
            }

            [data-testid="stExpander"] .form-card-badge {
                color: #866500 !important;
            }

            [data-testid="stExpander"] div[data-testid="stFormSubmitButton"] button,
            [data-testid="stExpander"] div[data-testid="stFormSubmitButton"] button * {
                color: #111111 !important;
            }

            .chart-streamlit-wrap {
                background: rgba(255,255,255,0.96);
                border: 1px solid rgba(255,255,255,0.68);
                border-radius: 22px;
                box-shadow: 0 12px 28px rgba(15, 23, 42, 0.065);
                min-height: 355px;
                overflow: hidden;
                padding: 1.05rem 1.1rem;
            }

            @media (max-width: 620px) {
                [data-testid="stExpander"] {
                    border-radius: 18px !important;
                }

                .chart-streamlit-wrap {
                    border-radius: 18px;
                    min-height: 300px;
                    padding: 0.88rem;
                }
            }


            /* CARDS DE STATUS COMERCIAIS */
            .status-panel {
                background: rgba(255,255,255,0.96);
                border: 1px solid rgba(255,255,255,0.68);
                border-radius: 22px;
                box-shadow: 0 12px 28px rgba(15, 23, 42, 0.065);
                min-height: 355px;
                padding: 1.05rem 1.1rem;
            }

            .status-panel-header {
                align-items: center;
                display: flex;
                justify-content: space-between;
                margin-bottom: 0.85rem;
            }

            .status-panel-title {
                color: #202020;
                font-size: 1rem;
                font-weight: 800;
                letter-spacing: -0.025rem;
                margin: 0;
            }

            .status-panel-sub {
                color: #7a8494;
                font-size: 0.69rem;
                margin: 0.15rem 0 0 0;
            }

            .status-grid {
                display: grid;
                gap: 0.75rem;
                grid-template-columns: repeat(2, minmax(0, 1fr));
            }

            .status-card {
                background: #ffffff;
                border: 1px solid #e3e7ec;
                border-radius: 18px;
                box-shadow: 0 8px 18px rgba(15, 23, 42, 0.055);
                min-height: 132px;
                overflow: hidden;
                padding: 0.80rem 0.78rem 0.72rem 0.78rem;
                position: relative;
                transition: 0.18s ease;
            }

            .status-card:hover {
                border-color: rgba(251,196,16,0.80);
                box-shadow: 0 10px 22px rgba(15, 23, 42, 0.09);
                transform: translateY(-2px);
            }

            .status-card-link {
                color: inherit !important;
                display: block;
                text-decoration: none !important;
            }

            .status-card-link:hover,
            .status-card-link:focus,
            .status-card-link:active,
            .status-card-link:visited {
                color: inherit !important;
                text-decoration: none !important;
            }

            .status-card-selected {
                border-color: #fbc410 !important;
                box-shadow: 0 0 0 2px rgba(251,196,16,0.22),
                            0 12px 24px rgba(15,23,42,0.10) !important;
            }

            .status-card-footer strong {
                color: #866500;
            }

            .status-card-top {
                align-items: center;
                display: flex;
                gap: 0.58rem;
            }

            .status-card-icon {
                align-items: center;
                border-radius: 12px;
                display: flex;
                flex: 0 0 auto;
                font-size: 0.86rem;
                height: 36px;
                justify-content: center;
                width: 36px;
            }

            .status-blue { background:#e9f2ff; color:#2f6fc5; }
            .status-brown { background:#f4eee8; color:#a06b2e; }
            .status-red { background:#ffecec; color:#df4545; }
            .status-teal { background:#e7f7f7; color:#0f7f86; }
            .status-green { background:#e8f7ef; color:#13975a; }
            .status-purple { background:#f0eafb; color:#7a4db1; }

            .status-card-name {
                color: #111111;
                font-size: 0.72rem;
                font-weight: 800;
                line-height: 1.15;
                margin: 0;
            }

            .status-card-number {
                color: #111111;
                font-size: 1.44rem;
                font-weight: 800;
                letter-spacing: -0.07rem;
                line-height: 1;
                margin: 0.58rem 0 0 0;
            }

            .status-card-period {
                color: #8a94a4;
                font-size: 0.60rem;
                font-weight: 600;
                margin: 0.20rem 0 0 0;
            }

            .status-card-footer {
                border-top: 1px solid #edf0f3;
                color: #6f7884;
                font-size: 0.61rem;
                font-weight: 700;
                margin-top: 0.62rem;
                padding-top: 0.52rem;
            }

            @media (max-width: 980px) {
                .status-grid {
                    grid-template-columns: repeat(2, minmax(0, 1fr));
                }
            }

            @media (max-width: 620px) {
                .status-panel {
                    border-radius: 18px;
                    min-height: auto;
                    padding: 0.88rem;
                }

                .status-grid {
                    gap: 0.58rem;
                    grid-template-columns: repeat(2, minmax(0, 1fr));
                }

                .status-card {
                    border-radius: 15px;
                    min-height: 116px;
                    padding: 0.66rem;
                }

                .status-card-icon {
                    border-radius: 10px;
                    height: 31px;
                    width: 31px;
                }

                .status-card-name {
                    font-size: 0.64rem;
                }

                .status-card-number {
                    font-size: 1.25rem;
                }
            }


            /* CARDS CLICÁVEIS NATIVOS DO STREAMLIT */
            .status-native-header {
                align-items: center;
                background: rgba(255,255,255,0.96);
                border: 1px solid rgba(255,255,255,0.68);
                border-radius: 22px 22px 0 0;
                box-shadow: 0 12px 28px rgba(15, 23, 42, 0.065);
                display: flex;
                justify-content: space-between;
                padding: 1.05rem 1.1rem 0.75rem 1.1rem;
            }

            .status-native-grid-wrap {
                background: rgba(255,255,255,0.96);
                border: 1px solid rgba(255,255,255,0.68);
                border-radius: 0 0 22px 22px;
                box-shadow: 0 12px 28px rgba(15, 23, 42, 0.065);
                margin-top: -1px;
                padding: 0 1rem 1rem 1rem;
            }

            .status-native-title {
                color: #202020;
                font-size: 1rem;
                font-weight: 800;
                letter-spacing: -0.025rem;
                margin: 0;
            }

            .status-native-sub {
                color: #7a8494;
                font-size: 0.69rem;
                margin: 0.15rem 0 0 0;
            }

            .st-key-status_card_novo_lead button,
            .st-key-status_card_conversando button,
            .st-key-status_card_nao_tem_interesse button,
            .st-key-status_card_nao_responde button,
            .st-key-status_card_fechado button {
                align-items: flex-start !important;
                background: #ffffff !important;
                border: 1px solid #e3e7ec !important;
                border-radius: 18px !important;
                box-shadow: 0 8px 18px rgba(15, 23, 42, 0.055) !important;
                color: #111111 !important;
                display: flex !important;
                justify-content: flex-start !important;
                min-height: 118px !important;
                padding: 0.82rem 0.78rem !important;
                text-align: left !important;
                transition: 0.18s ease !important;
                white-space: pre-line !important;
                width: 100% !important;
            }

            .st-key-status_card_novo_lead button:hover,
            .st-key-status_card_conversando button:hover,
            .st-key-status_card_nao_tem_interesse button:hover,
            .st-key-status_card_nao_responde button:hover,
            .st-key-status_card_fechado button:hover {
                border-color: rgba(251,196,16,0.90) !important;
                box-shadow: 0 10px 22px rgba(15, 23, 42, 0.09) !important;
                transform: translateY(-2px) !important;
            }

            .st-key-status_card_novo_lead button p,
            .st-key-status_card_conversando button p,
            .st-key-status_card_nao_tem_interesse button p,
            .st-key-status_card_nao_responde button p,
            .st-key-status_card_fechado button p {
                color: #111111 !important;
                font-size: 0.76rem !important;
                font-weight: 800 !important;
                line-height: 1.32 !important;
                text-align: left !important;
                white-space: pre-line !important;
            }

            .st-key-status_card_novo_lead_selected button,
            .st-key-status_card_conversando_selected button,
            .st-key-status_card_nao_tem_interesse_selected button,
            .st-key-status_card_nao_responde_selected button,
            .st-key-status_card_fechado_selected button {
                border-color: #fbc410 !important;
                box-shadow: 0 0 0 2px rgba(251,196,16,0.20),
                            0 10px 22px rgba(15,23,42,0.10) !important;
            }

            @media (max-width: 620px) {
                .status-native-header {
                    border-radius: 18px 18px 0 0;
                    padding: 0.88rem 0.88rem 0.68rem 0.88rem;
                }

                .status-native-grid-wrap {
                    border-radius: 0 0 18px 18px;
                    padding: 0 0.74rem 0.74rem 0.74rem;
                }

                .st-key-status_card_novo_lead button,
                .st-key-status_card_conversando button,
                .st-key-status_card_nao_tem_interesse button,
                .st-key-status_card_nao_responde button,
                .st-key-status_card_fechado button {
                    min-height: 104px !important;
                    padding: 0.68rem !important;
                }
            }


            /* ÁREA DOS CARDS CLICÁVEIS - CORREÇÃO VISUAL */
            .st-key-status_cards_area {
                background: rgba(255,255,255,0.97) !important;
                border: 1px solid rgba(255,255,255,0.72) !important;
                border-radius: 22px !important;
                box-shadow: 0 12px 28px rgba(15, 23, 42, 0.065) !important;
                padding: 1rem 1rem 0.85rem 1rem !important;
            }

            .st-key-status_cards_area .status-native-header {
                align-items: center;
                background: transparent !important;
                border: 0 !important;
                box-shadow: none !important;
                display: flex;
                justify-content: space-between;
                margin-bottom: 0.72rem;
                padding: 0 !important;
            }

            .st-key-status_cards_area .status-native-title {
                color: #202020 !important;
                font-size: 1rem !important;
                font-weight: 800 !important;
                letter-spacing: -0.025rem !important;
                margin: 0 !important;
            }

            .st-key-status_cards_area .status-native-sub {
                color: #7a8494 !important;
                font-size: 0.69rem !important;
                margin: 0.15rem 0 0 0 !important;
            }

            .st-key-status_cards_area [data-testid="stHorizontalBlock"] {
                gap: 0.65rem !important;
                margin-bottom: 0.65rem !important;
            }

            .st-key-status_card_novo_lead_container button,
            .st-key-status_card_conversando_container button,
            .st-key-status_card_nao_tem_interesse_container button,
            .st-key-status_card_nao_responde_container button,
            .st-key-status_card_fechado_container button,
            .st-key-status_card_novo_lead_container_selected button,
            .st-key-status_card_conversando_container_selected button,
            .st-key-status_card_nao_tem_interesse_container_selected button,
            .st-key-status_card_nao_responde_container_selected button,
            .st-key-status_card_fechado_container_selected button {
                align-items: flex-start !important;
                background: #ffffff !important;
                border: 1px solid #e3e7ec !important;
                border-radius: 16px !important;
                box-shadow: 0 7px 16px rgba(15, 23, 42, 0.05) !important;
                color: #111111 !important;
                display: flex !important;
                justify-content: flex-start !important;
                min-height: 116px !important;
                padding: 0.78rem 0.75rem !important;
                text-align: left !important;
                text-transform: none !important;
                transition: 0.18s ease !important;
                white-space: pre-line !important;
                width: 100% !important;
            }

            .st-key-status_card_novo_lead_container button:hover,
            .st-key-status_card_conversando_container button:hover,
            .st-key-status_card_nao_tem_interesse_container button:hover,
            .st-key-status_card_nao_responde_container button:hover,
            .st-key-status_card_fechado_container button:hover,
            .st-key-status_card_novo_lead_container_selected button:hover,
            .st-key-status_card_conversando_container_selected button:hover,
            .st-key-status_card_nao_tem_interesse_container_selected button:hover,
            .st-key-status_card_nao_responde_container_selected button:hover,
            .st-key-status_card_fechado_container_selected button:hover {
                background: #fffdf5 !important;
                border-color: rgba(251,196,16,0.95) !important;
                box-shadow: 0 10px 22px rgba(15, 23, 42, 0.09) !important;
                transform: translateY(-2px) !important;
            }

            .st-key-status_card_novo_lead_container button p,
            .st-key-status_card_conversando_container button p,
            .st-key-status_card_nao_tem_interesse_container button p,
            .st-key-status_card_nao_responde_container button p,
            .st-key-status_card_fechado_container button p,
            .st-key-status_card_novo_lead_container_selected button p,
            .st-key-status_card_conversando_container_selected button p,
            .st-key-status_card_nao_tem_interesse_container_selected button p,
            .st-key-status_card_nao_responde_container_selected button p,
            .st-key-status_card_fechado_container_selected button p {
                color: #111111 !important;
                font-size: 0.72rem !important;
                font-weight: 700 !important;
                line-height: 1.40 !important;
                text-align: left !important;
                text-transform: none !important;
                white-space: pre-line !important;
            }

            .st-key-status_card_novo_lead_container_selected button,
            .st-key-status_card_conversando_container_selected button,
            .st-key-status_card_nao_tem_interesse_container_selected button,
            .st-key-status_card_nao_responde_container_selected button,
            .st-key-status_card_fechado_container_selected button {
                background: #fffdf5 !important;
                border-color: #fbc410 !important;
                box-shadow:
                    0 0 0 2px rgba(251,196,16,0.20),
                    0 10px 22px rgba(15,23,42,0.10) !important;
            }

            @media (max-width: 620px) {
                .st-key-status_cards_area {
                    border-radius: 18px !important;
                    padding: 0.82rem 0.74rem 0.58rem 0.74rem !important;
                }

                .st-key-status_card_novo_lead_container button,
                .st-key-status_card_conversando_container button,
                .st-key-status_card_nao_tem_interesse_container button,
                .st-key-status_card_nao_responde_container button,
                .st-key-status_card_fechado_container button,
                .st-key-status_card_novo_lead_container_selected button,
                .st-key-status_card_conversando_container_selected button,
                .st-key-status_card_nao_tem_interesse_container_selected button,
                .st-key-status_card_nao_responde_container_selected button,
                .st-key-status_card_fechado_container_selected button {
                    min-height: 102px !important;
                    padding: 0.64rem !important;
                }
            }


            /* LAYOUT FINAL DOS STATUS: CARD + BOTÃO VER NOMES */
            .status-final-panel {
                background: rgba(255,255,255,0.97);
                border: 1px solid rgba(255,255,255,0.72);
                border-radius: 22px;
                box-shadow: 0 12px 28px rgba(15, 23, 42, 0.065);
                padding: 1rem;
            }

            .status-final-header {
                align-items: center;
                display: flex;
                justify-content: space-between;
                margin-bottom: 0.85rem;
            }

            .status-final-title {
                color: #202020;
                font-size: 1rem;
                font-weight: 800;
                letter-spacing: -0.025rem;
                margin: 0;
            }

            .status-final-sub {
                color: #7a8494;
                font-size: 0.69rem;
                margin: 0.15rem 0 0 0;
            }

            .status-final-card {
                background: #ffffff;
                border: 1px solid #dfe4ea;
                border-radius: 17px;
                box-shadow: 0 7px 16px rgba(15, 23, 42, 0.05);
                min-height: 104px;
                padding: 0.72rem;
                transition: 0.18s ease;
            }

            .status-final-card:hover {
                border-color: rgba(251,196,16,0.90);
                box-shadow: 0 10px 20px rgba(15,23,42,0.09);
                transform: translateY(-2px);
            }

            .status-final-card-selected {
                border-color: #fbc410 !important;
                box-shadow:
                    0 0 0 2px rgba(251,196,16,0.18),
                    0 10px 20px rgba(15,23,42,0.09) !important;
            }

            .status-final-top {
                align-items: center;
                display: flex;
                gap: 0.56rem;
            }

            .status-final-icon {
                align-items: center;
                border-radius: 11px;
                display: flex;
                flex: 0 0 auto;
                font-size: 0.78rem;
                height: 34px;
                justify-content: center;
                width: 34px;
            }

            .status-final-name {
                color: #111111;
                font-size: 0.70rem;
                font-weight: 800;
                line-height: 1.14;
                margin: 0;
            }

            .status-final-number {
                color: #111111;
                font-size: 1.34rem;
                font-weight: 800;
                letter-spacing: -0.06rem;
                line-height: 1;
                margin: 0.45rem 0 0 0;
            }

            .status-final-period {
                color: #8791a0;
                font-size: 0.58rem;
                font-weight: 600;
                margin: 0.18rem 0 0 0;
            }

            .status-final-button-wrap {
                margin-top: 0.35rem;
            }

            .st-key-btn_status_novo_lead button,
            .st-key-btn_status_conversando button,
            .st-key-btn_status_nao_tem_interesse button,
            .st-key-btn_status_nao_responde button,
            .st-key-btn_status_fechado button {
                background: #ffffff !important;
                border: 1px solid #dfe4ea !important;
                border-radius: 999px !important;
                box-shadow: 0 5px 12px rgba(15,23,42,0.04) !important;
                color: #23395d !important;
                font-size: 0.69rem !important;
                font-weight: 700 !important;
                min-height: 34px !important;
                padding: 0.30rem 0.60rem !important;
                text-transform: none !important;
                width: 100% !important;
            }

            .st-key-btn_status_novo_lead button:hover,
            .st-key-btn_status_conversando button:hover,
            .st-key-btn_status_nao_tem_interesse button:hover,
            .st-key-btn_status_nao_responde button:hover,
            .st-key-btn_status_fechado button:hover {
                background: #fffdf5 !important;
                border-color: #fbc410 !important;
                color: #111111 !important;
            }

            .st-key-btn_status_novo_lead button p,
            .st-key-btn_status_conversando button p,
            .st-key-btn_status_nao_tem_interesse button p,
            .st-key-btn_status_nao_responde button p,
            .st-key-btn_status_fechado button p {
                color: inherit !important;
                font-size: 0.69rem !important;
                font-weight: 700 !important;
                text-transform: none !important;
            }

            @media (max-width: 1100px) {
                .status-final-card {
                    min-height: 100px;
                }
            }

            @media (max-width: 620px) {
                .status-final-panel {
                    border-radius: 18px;
                    padding: 0.78rem;
                }

                .status-final-header {
                    margin-bottom: 0.68rem;
                }

                .status-final-card {
                    border-radius: 14px;
                    min-height: 96px;
                    padding: 0.62rem;
                }

                .status-final-name {
                    font-size: 0.63rem;
                }

                .status-final-number {
                    font-size: 1.18rem;
                }
            }


            /* CONTAINER NATIVO DO PAINEL DE STATUS */
            .st-key-status_final_panel_container {
                background: rgba(255,255,255,0.97) !important;
                border: 1px solid rgba(255,255,255,0.72) !important;
                border-radius: 22px !important;
                box-shadow: 0 12px 28px rgba(15, 23, 42, 0.065) !important;
                padding: 1rem !important;
            }

            .st-key-status_final_panel_container [data-testid="stHorizontalBlock"] {
                gap: 0.62rem !important;
            }

            @media (max-width: 620px) {
                .st-key-status_final_panel_container {
                    border-radius: 18px !important;
                    padding: 0.78rem !important;
                }
            }

            @media (max-width: 900px) {
                .dashboard-grid-main {
                    grid-template-columns: 1fr !important;
                }

                .dashboard-grid-4 {
                    grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
                }

                .dash-side-text {
                    display: none !important;
                }
            }

            @media (max-width: 520px) {
                .dashboard-grid-4 {
                    grid-template-columns: 1fr !important;
                }

                .block-container {
                    padding-left: 0.72rem !important;
                    padding-right: 0.72rem !important;
                }
            }


            /* FICHA COMPACTA ABERTA PELO BOTÃO VER NOMES */
            .st-key-ficha_status_compacta {
                background: rgba(255,255,255,0.97) !important;
                border: 1px solid rgba(255,255,255,0.72) !important;
                border-radius: 18px !important;
                box-shadow: 0 10px 22px rgba(15, 23, 42, 0.055) !important;
                margin-top: 0.72rem !important;
                padding: 0.82rem 0.88rem 0.92rem 0.88rem !important;
            }

            .st-key-ficha_status_compacta label,
            .st-key-ficha_status_compacta p,
            .st-key-ficha_status_compacta span,
            .st-key-ficha_status_compacta div {
                color: #111111 !important;
            }

            .st-key-ficha_status_compacta input,
            .st-key-ficha_status_compacta textarea,
            .st-key-ficha_status_compacta [data-baseweb="select"] > div {
                background: #ffffff !important;
                border-color: #e1e5ea !important;
                color: #111111 !important;
            }

            .st-key-ficha_status_compacta input:disabled,
            .st-key-ficha_status_compacta textarea:disabled {
                -webkit-text-fill-color: #111111 !important;
                color: #111111 !important;
                opacity: 1 !important;
            }

            .st-key-ficha_status_compacta div[data-testid="stFormSubmitButton"] button {
                background: #fbc410 !important;
                border: 0 !important;
                border-radius: 10px !important;
                color: #111111 !important;
                font-weight: 800 !important;
                min-height: 40px !important;
                width: 100% !important;
            }

            .ficha-status-mini-label {
                color: #866500 !important;
                font-size: 0.64rem !important;
                font-weight: 800 !important;
                letter-spacing: 0.05rem !important;
                margin: 0 0 0.42rem 0 !important;
                text-transform: uppercase !important;
            }

            @media (max-width: 620px) {
                .st-key-ficha_status_compacta {
                    border-radius: 15px !important;
                    padding: 0.70rem !important;
                }
            }


            /* SETINHA PRÓPRIA DO MENU — SEMPRE VISÍVEL */
            [data-testid="stSidebarCollapsedControl"],
            [data-testid="collapsedControl"],
            [data-testid="stSidebarCollapseButton"] {
                display: none !important;
            }

            .st-key-toggle_menu_lateral {
                left: var(--menu-toggle-left, 222px) !important;
                margin: 0 !important;
                padding: 0 !important;
                position: fixed !important;
                top: 0.85rem !important;
                width: 38px !important;
                z-index: 9999999 !important;
            }

            .st-key-toggle_menu_lateral button {
                align-items: center !important;
                background: #fbc410 !important;
                border: 1px solid #fbc410 !important;
                border-radius: 10px !important;
                box-shadow: 0 8px 18px rgba(0,0,0,0.18) !important;
                color: #000000 !important;
                display: flex !important;
                font-size: 1.15rem !important;
                font-weight: 900 !important;
                height: 38px !important;
                justify-content: center !important;
                min-height: 38px !important;
                padding: 0 !important;
                width: 38px !important;
            }

            .st-key-toggle_menu_lateral button:hover {
                background: #ffd234 !important;
                border-color: #ffd234 !important;
                transform: translateY(-1px) !important;
            }

            .st-key-toggle_menu_lateral button p {
                color: #000000 !important;
                font-size: 1.15rem !important;
                font-weight: 900 !important;
                line-height: 1 !important;
                margin: 0 !important;
            }

            @media (max-width: 900px) {
                .st-key-toggle_menu_lateral {
                    top: 0.65rem !important;
                }
            }


            /* GARANTE VISIBILIDADE REAL DO CONTEÚDO DO MENU */
            [data-testid="stSidebar"] {
                overflow: visible !important;
            }

            [data-testid="stSidebar"] > div:first-child,
            [data-testid="stSidebar"] [data-testid="stSidebarContent"],
            [data-testid="stSidebar"] [data-testid="stSidebarUserContent"] {
                opacity: 1 !important;
                transform: none !important;
                visibility: visible !important;
            }


            /* BARRA DE PESQUISA COMERCIAL */
            .st-key-busca_comercial_container {
                background: rgba(255,255,255,0.97) !important;
                border: 1px solid rgba(255,255,255,0.72) !important;
                border-radius: 18px !important;
                box-shadow: 0 10px 22px rgba(15,23,42,0.055) !important;
                margin-bottom: 0.72rem !important;
                padding: 0.82rem 0.88rem 0.88rem 0.88rem !important;
            }

            .busca-comercial-title {
                color: #202020 !important;
                font-size: 0.92rem !important;
                font-weight: 800 !important;
                letter-spacing: -0.02rem !important;
                margin: 0 0 0.16rem 0 !important;
            }

            .busca-comercial-sub {
                color: #7a8494 !important;
                font-size: 0.68rem !important;
                margin: 0 0 0.58rem 0 !important;
            }

            .busca-status-localizado {
                background: #fff7d6;
                border: 1px solid #f3db80;
                border-radius: 999px;
                color: #866500 !important;
                display: inline-flex;
                font-size: 0.66rem;
                font-weight: 800;
                letter-spacing: 0.03rem;
                margin: 0.18rem 0 0.58rem 0;
                padding: 0.34rem 0.54rem;
            }

            .st-key-busca_comercial_container label,
            .st-key-busca_comercial_container p,
            .st-key-busca_comercial_container span,
            .st-key-busca_comercial_container div {
                color: #111111 !important;
            }

            .st-key-busca_comercial_container input,
            .st-key-busca_comercial_container textarea,
            .st-key-busca_comercial_container [data-baseweb="select"] > div {
                background: #ffffff !important;
                border-color: #e1e5ea !important;
                color: #111111 !important;
            }

            .st-key-busca_comercial_container input:disabled,
            .st-key-busca_comercial_container textarea:disabled {
                -webkit-text-fill-color: #111111 !important;
                color: #111111 !important;
                opacity: 1 !important;
            }

            .st-key-busca_comercial_container div[data-testid="stFormSubmitButton"] button {
                background: #fbc410 !important;
                border: 0 !important;
                border-radius: 10px !important;
                color: #111111 !important;
                font-weight: 800 !important;
                min-height: 40px !important;
                width: 100% !important;
            }

            @media (max-width: 620px) {
                .st-key-busca_comercial_container {
                    border-radius: 15px !important;
                    padding: 0.70rem !important;
                }
            }


            /* SEÇÕES INTERNAS DO FORMULÁRIO */
            .form-section-block {
                background: #fffdf7;
                border: 1px solid #f2e8bd;
                border-left: 4px solid #fbc410;
                border-radius: 14px;
                margin: 0.85rem 0 0.65rem 0;
                padding: 0.68rem 0.78rem;
            }

            .form-section-title {
                color: #202020 !important;
                font-size: 0.82rem !important;
                font-weight: 900 !important;
                letter-spacing: 0.045rem !important;
                margin: 0 !important;
                text-transform: uppercase !important;
            }

            .form-section-sub {
                color: #7a8494 !important;
                font-size: 0.66rem !important;
                line-height: 1.38 !important;
                margin: 0.18rem 0 0 0 !important;
            }

            .st-key-ficha_status_compacta .form-section-block,
            .st-key-busca_comercial_container .form-section-block {
                background: #fffdf7 !important;
                border: 1px solid #f2e8bd !important;
                border-left: 4px solid #fbc410 !important;
            }


            /* FICHA DO ALUNO EM FORMATO DE PLANILHA */
            .sheet-form-title {
                align-items: center;
                background: #111111;
                border: 1px solid #111111;
                border-radius: 10px 10px 0 0;
                color: #ffffff !important;
                display: flex;
                font-size: 0.74rem !important;
                font-weight: 900 !important;
                justify-content: space-between;
                letter-spacing: 0.055rem !important;
                margin: 0.82rem 0 0 0 !important;
                padding: 0.55rem 0.68rem !important;
                text-transform: uppercase !important;
            }

            .sheet-form-title strong {
                color: #fbc410 !important;
                font-size: 0.64rem !important;
                font-weight: 900 !important;
                letter-spacing: 0.045rem !important;
            }

            .sheet-form-sub {
                background: #fff8d9;
                border-bottom: 1px solid #ecd981;
                border-left: 1px solid #ecd981;
                border-right: 1px solid #ecd981;
                color: #6f5a00 !important;
                font-size: 0.62rem !important;
                line-height: 1.35 !important;
                margin: 0 0 0.28rem 0 !important;
                padding: 0.36rem 0.68rem !important;
            }

            .st-key-ficha_status_compacta [data-testid="stForm"],
            .st-key-busca_comercial_container [data-testid="stForm"] {
                background: #ffffff !important;
                border: 1px solid #d9dee5 !important;
                border-radius: 12px !important;
                box-shadow: 0 7px 16px rgba(15, 23, 42, 0.045) !important;
                overflow: hidden !important;
                padding: 0.62rem !important;
            }

            .st-key-ficha_status_compacta [data-testid="stHorizontalBlock"],
            .st-key-busca_comercial_container [data-testid="stHorizontalBlock"] {
                gap: 0.42rem !important;
            }

            .st-key-ficha_status_compacta [data-testid="stTextInput"],
            .st-key-ficha_status_compacta [data-testid="stSelectbox"],
            .st-key-busca_comercial_container [data-testid="stTextInput"],
            .st-key-busca_comercial_container [data-testid="stSelectbox"] {
                margin-bottom: 0.14rem !important;
            }

            .st-key-ficha_status_compacta label,
            .st-key-busca_comercial_container label {
                color: #3a414c !important;
                font-size: 0.61rem !important;
                font-weight: 900 !important;
                letter-spacing: 0.055rem !important;
                margin-bottom: 0.10rem !important;
                text-transform: uppercase !important;
            }

            .st-key-ficha_status_compacta input,
            .st-key-ficha_status_compacta textarea,
            .st-key-ficha_status_compacta [data-baseweb="select"] > div,
            .st-key-busca_comercial_container input,
            .st-key-busca_comercial_container textarea,
            .st-key-busca_comercial_container [data-baseweb="select"] > div {
                background: #ffffff !important;
                border: 1px solid #d8dde5 !important;
                border-radius: 5px !important;
                box-shadow: none !important;
                color: #111111 !important;
                min-height: 36px !important;
            }

            .st-key-ficha_status_compacta input:focus,
            .st-key-ficha_status_compacta textarea:focus,
            .st-key-busca_comercial_container input:focus,
            .st-key-busca_comercial_container textarea:focus {
                border-color: #fbc410 !important;
                box-shadow: 0 0 0 2px rgba(251,196,16,0.16) !important;
            }

            .st-key-ficha_status_compacta input:disabled,
            .st-key-busca_comercial_container input:disabled {
                background: #f0f2f5 !important;
                border-color: #d8dde5 !important;
                -webkit-text-fill-color: #111111 !important;
                color: #111111 !important;
                opacity: 1 !important;
            }

            .sheet-action-note {
                background: #f6f7f9;
                border: 1px dashed #cfd5dd;
                border-radius: 8px;
                color: #687282 !important;
                font-size: 0.62rem !important;
                line-height: 1.35 !important;
                margin: 0.42rem 0 0.18rem 0 !important;
                padding: 0.42rem 0.55rem !important;
            }

            .st-key-ficha_status_compacta div[data-testid="stFormSubmitButton"] button,
            .st-key-busca_comercial_container div[data-testid="stFormSubmitButton"] button {
                border-radius: 6px !important;
                min-height: 39px !important;
            }

            @media (max-width: 760px) {
                .sheet-form-title {
                    border-radius: 8px 8px 0 0 !important;
                    font-size: 0.68rem !important;
                }

                .sheet-form-title strong {
                    display: none !important;
                }

                .st-key-ficha_status_compacta [data-testid="stHorizontalBlock"],
                .st-key-busca_comercial_container [data-testid="stHorizontalBlock"] {
                    gap: 0.28rem !important;
                }
            }


            /* TABELA COMERCIAL INSPIRADA NA REFERÊNCIA */
            .commercial-table-head {
                align-items: center;
                background: #08285f;
                border-radius: 10px 10px 0 0;
                display: flex;
                justify-content: space-between;
                margin-top: 0.18rem;
                padding: 0.62rem 0.72rem;
            }

            .commercial-table-head-title {
                color: #ffffff !important;
                font-size: 0.78rem !important;
                font-weight: 900 !important;
                letter-spacing: 0.045rem !important;
                margin: 0 !important;
                text-transform: uppercase !important;
            }

            .commercial-table-head-sub {
                color: rgba(255,255,255,0.82) !important;
                font-size: 0.61rem !important;
                margin: 0.15rem 0 0 0 !important;
            }

            .commercial-table-count {
                background: rgba(255,255,255,0.14);
                border: 1px solid rgba(255,255,255,0.22);
                border-radius: 999px;
                color: #ffffff !important;
                font-size: 0.61rem !important;
                font-weight: 900 !important;
                padding: 0.34rem 0.52rem;
                white-space: nowrap;
            }

            .commercial-table-columns {
                background: #0b3474;
                border-top: 1px solid rgba(255,255,255,0.16);
                color: #ffffff !important;
                display: grid;
                font-size: 0.61rem !important;
                font-weight: 900 !important;
                gap: 0;
                grid-template-columns: 0.52fr 2.25fr 1.20fr 1.05fr 2.05fr 1.08fr 0.72fr;
                letter-spacing: 0.025rem !important;
                padding: 0.45rem 0.58rem;
            }

            .commercial-table-columns span {
                color: #ffffff !important;
                overflow: hidden;
                padding-right: 0.35rem;
                text-overflow: ellipsis;
                white-space: nowrap;
            }

            .commercial-table-help {
                background: #f5f7fb;
                border-bottom: 1px solid #dae2ed;
                border-left: 1px solid #dae2ed;
                border-right: 1px solid #dae2ed;
                color: #5d6877 !important;
                font-size: 0.61rem !important;
                line-height: 1.40 !important;
                margin: 0 !important;
                padding: 0.40rem 0.62rem !important;
            }

            .st-key-commercial_table_scroll {
                background: #ffffff !important;
                border-bottom: 1px solid #dae2ed !important;
                border-left: 1px solid #dae2ed !important;
                border-radius: 0 0 10px 10px !important;
                border-right: 1px solid #dae2ed !important;
                margin-bottom: 0.40rem !important;
                overflow-x: auto !important;
                padding: 0 !important;
            }

            .st-key-commercial_table_scroll [data-testid="stVerticalBlock"] {
                gap: 0 !important;
            }

            [class*="st-key-lead_table_row_"] {
                background: #ffffff !important;
                border-bottom: 1px solid #e3e8ef !important;
                min-width: 980px !important;
                padding: 0.04rem 0.48rem !important;
                transition: 0.16s ease !important;
            }

            [class*="st-key-lead_table_row_"]:hover {
                background: #f7faff !important;
            }

            [class*="st-key-lead_table_row_"] [data-testid="stHorizontalBlock"] {
                align-items: center !important;
                gap: 0.25rem !important;
            }

            .commercial-cell {
                color: #10213e !important;
                font-size: 0.64rem !important;
                line-height: 1.25 !important;
                margin: 0 !important;
                overflow: hidden !important;
                padding: 0.38rem 0.08rem !important;
                text-overflow: ellipsis !important;
                white-space: nowrap !important;
            }

            .commercial-cell-muted {
                color: #778396 !important;
            }

            [class*="st-key-editar_lead_"] button {
                background: #2f6fd1 !important;
                border: 0 !important;
                border-radius: 999px !important;
                color: #ffffff !important;
                font-size: 0.59rem !important;
                font-weight: 900 !important;
                min-height: 26px !important;
                padding: 0.18rem 0.48rem !important;
                text-transform: none !important;
                width: 100% !important;
            }

            [class*="st-key-editar_lead_"] button:hover {
                background: #1f5cb9 !important;
                transform: translateY(-1px) !important;
            }

            [class*="st-key-fechar_ficha_lead"] button {
                background: #111111 !important;
                color: #ffffff !important;
                max-width: 190px !important;
            }

            .commercial-selected-head {
                align-items: center;
                background: #fff8d9;
                border: 1px solid #ecd981;
                border-radius: 10px;
                display: flex;
                justify-content: space-between;
                margin: 0.75rem 0 0.35rem 0;
                padding: 0.58rem 0.68rem;
            }

            .commercial-selected-head strong {
                color: #111111 !important;
                font-size: 0.72rem !important;
            }

            .commercial-selected-head span {
                color: #866500 !important;
                font-size: 0.62rem !important;
                font-weight: 900 !important;
                text-transform: uppercase !important;
            }

            @media (max-width: 760px) {
                .commercial-table-columns {
                    min-width: 980px !important;
                }

                .commercial-table-head {
                    border-radius: 8px 8px 0 0 !important;
                }
            }


            /* TABELA COMERCIAL — VERSÃO MAIS AMIGÁVEL */
            .friendly-table-card {
                background: #ffffff;
                border: 1px solid #dfe6ef;
                border-radius: 16px;
                box-shadow: 0 10px 24px rgba(15, 23, 42, 0.055);
                margin-top: 0.20rem;
                overflow: hidden;
            }

            .friendly-table-toolbar {
                align-items: center;
                background: #ffffff;
                display: flex;
                justify-content: space-between;
                padding: 0.72rem 0.82rem 0.64rem 0.82rem;
            }

            .friendly-table-toolbar-title {
                color: #162033 !important;
                font-size: 0.82rem !important;
                font-weight: 900 !important;
                letter-spacing: 0.01rem !important;
                margin: 0 !important;
            }

            .friendly-table-toolbar-sub {
                color: #7a8494 !important;
                font-size: 0.62rem !important;
                margin: 0.16rem 0 0 0 !important;
            }

            .friendly-table-count {
                background: #edf4ff;
                border: 1px solid #cfe0fb;
                border-radius: 999px;
                color: #205db3 !important;
                font-size: 0.61rem !important;
                font-weight: 900 !important;
                padding: 0.32rem 0.52rem;
                white-space: nowrap;
            }

            .friendly-table-columns {
                background: #0a2d67;
                color: #ffffff !important;
                display: grid;
                font-size: 0.60rem !important;
                font-weight: 900 !important;
                gap: 0;
                grid-template-columns: 0.46fr 2.10fr 1.18fr 1.06fr 2.05fr 1.00fr 1.18fr 0.72fr;
                letter-spacing: 0.025rem !important;
                min-width: 1120px;
                padding: 0.46rem 0.62rem;
                text-transform: uppercase !important;
            }

            .friendly-table-columns span {
                color: #ffffff !important;
                overflow: hidden;
                padding-right: 0.34rem;
                text-overflow: ellipsis;
                white-space: nowrap;
            }

            .st-key-friendly_table_scroll {
                background: #ffffff !important;
                border: 1px solid #dfe6ef !important;
                border-top: 0 !important;
                border-radius: 0 0 16px 16px !important;
                margin-bottom: 0.44rem !important;
                overflow-x: auto !important;
                padding: 0 !important;
            }

            .st-key-friendly_table_scroll [data-testid="stVerticalBlock"] {
                gap: 0 !important;
            }

            [class*="st-key-friendly_row_"] {
                background: #ffffff !important;
                border-bottom: 1px solid #edf1f5 !important;
                min-width: 1120px !important;
                padding: 0.06rem 0.52rem !important;
                transition: 0.14s ease !important;
            }

            [class*="st-key-friendly_row_even_"] {
                background: #fbfcfe !important;
            }

            [class*="st-key-friendly_row_"]:hover {
                background: #f2f7ff !important;
            }

            [class*="st-key-friendly_row_"] [data-testid="stHorizontalBlock"] {
                align-items: center !important;
                gap: 0.22rem !important;
            }

            .friendly-cell {
                color: #25324a !important;
                font-size: 0.63rem !important;
                line-height: 1.20 !important;
                margin: 0 !important;
                overflow: hidden !important;
                padding: 0.39rem 0.05rem !important;
                text-overflow: ellipsis !important;
                white-space: nowrap !important;
            }

            .friendly-cell-name {
                color: #10274f !important;
                font-weight: 800 !important;
            }

            .friendly-cell-muted {
                color: #8a95a5 !important;
            }

            .friendly-cell-empty {
                color: #b4bdc9 !important;
                font-style: italic !important;
            }

            [class*="st-key-abrir_ficha_"] button {
                background: #2f6fd1 !important;
                border: 0 !important;
                border-radius: 999px !important;
                box-shadow: none !important;
                color: #ffffff !important;
                font-size: 0.58rem !important;
                font-weight: 900 !important;
                min-height: 25px !important;
                padding: 0.14rem 0.45rem !important;
                width: 100% !important;
            }

            [class*="st-key-abrir_ficha_"] button:hover {
                background: #1f5dbd !important;
                transform: translateY(-1px) !important;
            }

            .friendly-table-bottom-note {
                color: #7a8494 !important;
                font-size: 0.61rem !important;
                margin: 0.18rem 0 0.42rem 0 !important;
            }

            .friendly-selected-card {
                align-items: center;
                background: #fff8d9;
                border: 1px solid #ecd981;
                border-radius: 12px;
                display: flex;
                justify-content: space-between;
                margin: 0.72rem 0 0.36rem 0;
                padding: 0.58rem 0.68rem;
            }

            .friendly-selected-card strong {
                color: #111111 !important;
                font-size: 0.72rem !important;
            }

            .friendly-selected-card span {
                color: #866500 !important;
                font-size: 0.60rem !important;
                font-weight: 900 !important;
                letter-spacing: 0.04rem !important;
                text-transform: uppercase !important;
            }

            @media (max-width: 760px) {
                .friendly-table-toolbar {
                    padding: 0.62rem 0.68rem !important;
                }

                .friendly-table-columns,
                [class*="st-key-friendly_row_"] {
                    min-width: 1120px !important;
                }
            }


            /* PLANILHA EDITÁVEL COMERCIAL — ESTILO FIGHT FOR LIFE */
            .inline-sheet-card {
                background: #ffffff;
                border: 1px solid #e2e6ec;
                border-radius: 16px;
                box-shadow: 0 10px 24px rgba(15, 23, 42, 0.06);
                margin-top: 0.24rem;
                overflow: hidden;
            }

            .inline-sheet-toolbar {
                align-items: center;
                background: #ffffff;
                display: flex;
                justify-content: space-between;
                padding: 0.76rem 0.88rem 0.68rem 0.88rem;
            }

            .inline-sheet-toolbar-title {
                color: #161616 !important;
                font-size: 0.86rem !important;
                font-weight: 900 !important;
                margin: 0 !important;
            }

            .inline-sheet-toolbar-sub {
                color: #7a8494 !important;
                font-size: 0.63rem !important;
                margin: 0.18rem 0 0 0 !important;
            }

            .inline-sheet-count {
                background: #fff7d6;
                border: 1px solid #eed16f;
                border-radius: 999px;
                color: #7a5b00 !important;
                font-size: 0.62rem !important;
                font-weight: 900 !important;
                padding: 0.34rem 0.56rem;
                white-space: nowrap;
            }

            .inline-sheet-columns {
                background: #111111;
                border-bottom: 3px solid #fbc410;
                color: #ffffff !important;
                display: grid;
                font-size: 0.61rem !important;
                font-weight: 900 !important;
                gap: 0;
                grid-template-columns: 0.42fr 1.68fr 1.12fr 0.95fr 1.05fr 1.72fr 1.08fr 1.48fr 1.12fr 1.08fr;
                letter-spacing: 0.024rem !important;
                min-width: 1550px;
                padding: 0.50rem 0.62rem;
                text-transform: uppercase !important;
            }

            .inline-sheet-columns span {
                color: #ffffff !important;
                overflow: hidden;
                padding-right: 0.34rem;
                text-overflow: ellipsis;
                white-space: nowrap;
            }

            .inline-sheet-help {
                background: #fffdf5;
                border-bottom: 1px solid #eee1ac;
                border-left: 1px solid #eee1ac;
                border-right: 1px solid #eee1ac;
                color: #6f6250 !important;
                font-size: 0.62rem !important;
                line-height: 1.42 !important;
                margin: 0 !important;
                padding: 0.44rem 0.66rem !important;
            }

            .st-key-inline_sheet_scroll {
                background: #ffffff !important;
                border: 1px solid #e2e6ec !important;
                border-top: 0 !important;
                border-radius: 0 0 16px 16px !important;
                margin-bottom: 0.48rem !important;
                overflow-x: auto !important;
                padding: 0 !important;
            }

            .st-key-inline_sheet_scroll [data-testid="stVerticalBlock"] {
                gap: 0 !important;
            }

            [class*="st-key-inline_row_"] {
                background: #ffffff !important;
                border-bottom: 1px solid #edf0f4 !important;
                min-width: 1550px !important;
                padding: 0.18rem 0.52rem 0.08rem 0.52rem !important;
            }

            [class*="st-key-inline_row_even_"] {
                background: #fbfcfe !important;
            }

            [class*="st-key-inline_row_"]:hover {
                background: #fffaf0 !important;
            }

            [class*="st-key-inline_row_"] [data-testid="stHorizontalBlock"] {
                align-items: center !important;
                gap: 0.22rem !important;
            }

            [class*="st-key-inline_row_"] label {
                display: none !important;
            }

            [class*="st-key-inline_row_"] [data-testid="stTextInput"],
            [class*="st-key-inline_row_"] [data-testid="stSelectbox"],
            [class*="st-key-inline_row_"] [data-testid="stCheckbox"] {
                margin: 0 !important;
                padding: 0 !important;
            }

            [class*="st-key-inline_row_"] input,
            [class*="st-key-inline_row_"] [data-baseweb="select"] > div {
                background: #ffffff !important;
                border: 1px solid #dde2e8 !important;
                border-radius: 6px !important;
                box-shadow: none !important;
                color: #1b2738 !important;
                font-size: 0.66rem !important;
                min-height: 34px !important;
            }

            [class*="st-key-inline_row_"] input:focus,
            [class*="st-key-inline_row_"] [data-baseweb="select"] > div:focus-within {
                border-color: #fbc410 !important;
                box-shadow: 0 0 0 2px rgba(251,196,16,0.14) !important;
            }

            [class*="st-key-inline_row_"] input:disabled {
                background: #f0f2f5 !important;
                border-color: #dde2e8 !important;
                -webkit-text-fill-color: #27364a !important;
                color: #27364a !important;
                opacity: 1 !important;
            }

            .inline-sheet-line {
                color: #738096 !important;
                font-size: 0.66rem !important;
                font-weight: 800 !important;
                margin: 0 !important;
                padding: 0.50rem 0 0 0.04rem !important;
            }

            [class*="st-key-inline_row_"] [data-testid="stCheckbox"] {
                align-items: center !important;
                display: flex !important;
                justify-content: center !important;
                min-height: 34px !important;
            }

            .inline-sheet-footer-note {
                color: #7a8494 !important;
                font-size: 0.62rem !important;
                line-height: 1.42 !important;
                margin: 0.16rem 0 0.50rem 0 !important;
            }

            .st-key-inline_sheet_actions button {
                background: #fbc410 !important;
                border: 1px solid #fbc410 !important;
                border-radius: 9px !important;
                color: #111111 !important;
                font-size: 0.72rem !important;
                font-weight: 900 !important;
                min-height: 42px !important;
                width: 100% !important;
            }

            .st-key-inline_sheet_actions button:hover {
                background: #ffd23c !important;
                border-color: #ffd23c !important;
                transform: translateY(-1px) !important;
            }

            @media (max-width: 760px) {
                .inline-sheet-columns,
                [class*="st-key-inline_row_"] {
                    min-width: 1550px !important;
                }

                .inline-sheet-toolbar {
                    padding: 0.68rem 0.72rem !important;
                }
            }


            /* CORREÇÃO DOS SELECTS INLINE — UM ÚNICO QUADRINHO */
            [class*="st-key-inline_row_"] [data-baseweb="select"] {
                width: 100% !important;
            }

            [class*="st-key-inline_row_"] [data-baseweb="select"] > div {
                align-items: center !important;
                background: #ffffff !important;
                border: 1px solid #dde2e8 !important;
                border-radius: 6px !important;
                box-shadow: none !important;
                display: flex !important;
                min-height: 34px !important;
                overflow: hidden !important;
                padding: 0 !important;
            }

            [class*="st-key-inline_row_"] [data-baseweb="select"] > div > div,
            [class*="st-key-inline_row_"] [data-baseweb="select"] > div > div > div,
            [class*="st-key-inline_row_"] [data-baseweb="select"] span {
                background: transparent !important;
                border: 0 !important;
                border-radius: 0 !important;
                box-shadow: none !important;
            }

            [class*="st-key-inline_row_"] [data-baseweb="select"] > div > div:first-child {
                flex: 1 1 auto !important;
                min-width: 0 !important;
                padding-left: 0.52rem !important;
            }

            [class*="st-key-inline_row_"] [data-baseweb="select"] > div > div:last-child {
                align-items: center !important;
                border-left: 0 !important;
                display: flex !important;
                justify-content: center !important;
                min-width: 28px !important;
                padding: 0 0.32rem !important;
                width: 28px !important;
            }

            [class*="st-key-inline_row_"] [data-baseweb="select"] svg {
                color: #5d6877 !important;
                fill: #5d6877 !important;
            }

            [class*="st-key-inline_row_"] [data-baseweb="select"] > div:focus-within {
                border-color: #fbc410 !important;
                box-shadow: 0 0 0 2px rgba(251,196,16,0.14) !important;
            }


            /* REMOVE A BARRINHA INTERNA DO SELECT */
            [class*="st-key-inline_row_"] [data-baseweb="select"] input {
                background: transparent !important;
                border: 0 !important;
                border-radius: 0 !important;
                box-shadow: none !important;
                height: 0 !important;
                margin: 0 !important;
                min-height: 0 !important;
                opacity: 0 !important;
                outline: 0 !important;
                padding: 0 !important;
                position: absolute !important;
                width: 0 !important;
            }

            [class*="st-key-inline_row_"] [data-baseweb="select"] input:focus,
            [class*="st-key-inline_row_"] [data-baseweb="select"] input:focus-visible {
                border: 0 !important;
                box-shadow: none !important;
                outline: 0 !important;
            }

            [class*="st-key-inline_row_"] [data-baseweb="select"] > div::before,
            [class*="st-key-inline_row_"] [data-baseweb="select"] > div::after {
                border: 0 !important;
                box-shadow: none !important;
                content: none !important;
            }


            /* PÁGINA CADASTRO DE ALUNOS */
            .cadastro-alunos-header {
                align-items: center;
                background: rgba(255,255,255,0.97);
                border: 1px solid rgba(255,255,255,0.74);
                border-bottom: 4px solid #fbc410;
                border-radius: 22px;
                box-shadow: 0 12px 26px rgba(15, 23, 42, 0.07);
                display: flex;
                justify-content: space-between;
                margin-bottom: 0.90rem;
                padding: 1.05rem 1.12rem;
            }

            .cadastro-alunos-kicker {
                color: #a27800 !important;
                font-size: 0.64rem !important;
                font-weight: 900 !important;
                letter-spacing: 0.14rem !important;
                margin: 0 0 0.24rem 0 !important;
                text-transform: uppercase !important;
            }

            .cadastro-alunos-title {
                color: #111111 !important;
                font-size: 1.62rem !important;
                font-weight: 900 !important;
                letter-spacing: -0.055rem !important;
                line-height: 1 !important;
                margin: 0 !important;
            }

            .cadastro-alunos-sub {
                color: #667085 !important;
                font-size: 0.74rem !important;
                line-height: 1.40 !important;
                margin: 0.38rem 0 0 0 !important;
                max-width: 720px;
            }

            .cadastro-alunos-badge {
                background: #fff7d6;
                border: 1px solid #eed16f;
                border-radius: 999px;
                color: #866500 !important;
                font-size: 0.62rem !important;
                font-weight: 900 !important;
                letter-spacing: 0.06rem !important;
                padding: 0.42rem 0.62rem;
                text-transform: uppercase !important;
                white-space: nowrap;
            }

            @media (max-width: 760px) {
                .cadastro-alunos-header {
                    align-items: flex-start;
                    flex-direction: column;
                    gap: 0.70rem;
                    padding: 0.90rem;
                }

                .cadastro-alunos-title {
                    font-size: 1.32rem !important;
                }
            }


            /* CONSULTA DE LEADS — SOMENTE NÚMERO E STATUS */
            .lead-consulta-card {
                background: #ffffff;
                border: 1px solid #e4e7ec;
                border-radius: 16px;
                box-shadow: 0 10px 24px rgba(15, 23, 42, 0.06);
                margin-top: 0.22rem;
                overflow: hidden;
            }

            .lead-consulta-toolbar {
                align-items: center;
                background: #ffffff;
                display: flex;
                justify-content: space-between;
                padding: 0.76rem 0.88rem 0.66rem 0.88rem;
            }

            .lead-consulta-title {
                color: #161616 !important;
                font-size: 0.86rem !important;
                font-weight: 900 !important;
                margin: 0 !important;
            }

            .lead-consulta-sub {
                color: #7a8494 !important;
                font-size: 0.63rem !important;
                margin: 0.18rem 0 0 0 !important;
            }

            .lead-consulta-count {
                background: #fff7d6;
                border: 1px solid #eed16f;
                border-radius: 999px;
                color: #7a5b00 !important;
                font-size: 0.62rem !important;
                font-weight: 900 !important;
                padding: 0.34rem 0.56rem;
                white-space: nowrap;
            }

            .lead-consulta-columns {
                background: #111111;
                border-bottom: 3px solid #fbc410;
                color: #ffffff !important;
                display: grid;
                font-size: 0.62rem !important;
                font-weight: 900 !important;
                grid-template-columns: 0.65fr 2.10fr 1.35fr;
                letter-spacing: 0.035rem !important;
                padding: 0.50rem 0.72rem;
                text-transform: uppercase !important;
            }

            .lead-consulta-columns span {
                color: #ffffff !important;
            }

            .lead-consulta-help {
                background: #fffdf5;
                border-bottom: 1px solid #eee1ac;
                border-left: 1px solid #eee1ac;
                border-right: 1px solid #eee1ac;
                color: #6f6250 !important;
                font-size: 0.62rem !important;
                line-height: 1.42 !important;
                margin: 0 !important;
                padding: 0.44rem 0.66rem !important;
            }

            .st-key-lead_consulta_scroll {
                background: #ffffff !important;
                border: 1px solid #e4e7ec !important;
                border-top: 0 !important;
                border-radius: 0 0 16px 16px !important;
                margin-bottom: 0.44rem !important;
                padding: 0 !important;
            }

            .st-key-lead_consulta_scroll [data-testid="stVerticalBlock"] {
                gap: 0 !important;
            }

            [class*="st-key-lead_consulta_row_"] {
                background: #ffffff !important;
                border-bottom: 1px solid #edf0f4 !important;
                padding: 0.12rem 0.62rem !important;
            }

            [class*="st-key-lead_consulta_row_even_"] {
                background: #fbfcfe !important;
            }

            [class*="st-key-lead_consulta_row_"]:hover {
                background: #fffaf0 !important;
            }

            [class*="st-key-lead_consulta_row_"] [data-testid="stHorizontalBlock"] {
                align-items: center !important;
                gap: 0.50rem !important;
            }

            [class*="st-key-lead_consulta_row_"] label {
                display: none !important;
            }

            .lead-consulta-line {
                color: #7a8494 !important;
                font-size: 0.68rem !important;
                font-weight: 800 !important;
                margin: 0 !important;
                padding: 0.48rem 0 0 0.04rem !important;
            }

            .lead-consulta-phone {
                color: #10274f !important;
                font-size: 0.72rem !important;
                font-weight: 900 !important;
                margin: 0 !important;
                padding: 0.47rem 0 0 0 !important;
            }

            [class*="st-key-lead_consulta_row_"] [data-baseweb="select"] > div {
                background: #ffffff !important;
                border: 1px solid #dde2e8 !important;
                border-radius: 7px !important;
                box-shadow: none !important;
                min-height: 36px !important;
            }

            [class*="st-key-lead_consulta_row_"] [data-baseweb="select"] input {
                border: 0 !important;
                height: 0 !important;
                min-height: 0 !important;
                opacity: 0 !important;
                position: absolute !important;
                width: 0 !important;
            }

            [class*="st-key-lead_consulta_row_"] [data-baseweb="select"] > div:focus-within {
                border-color: #fbc410 !important;
                box-shadow: 0 0 0 2px rgba(251,196,16,0.14) !important;
            }

            .lead-consulta-footer {
                color: #7a8494 !important;
                font-size: 0.62rem !important;
                margin: 0.16rem 0 0.44rem 0 !important;
            }


            /* ÁREA DE FOTO DO ROSTO DO ALUNO */
            .foto-rosto-info {
                background: #fffdf5;
                border: 1px solid #eee1ac;
                border-left: 4px solid #fbc410;
                border-radius: 12px;
                color: #6f6250 !important;
                font-size: 0.68rem !important;
                line-height: 1.45 !important;
                margin: 0.10rem 0 0.52rem 0 !important;
                padding: 0.62rem 0.72rem !important;
            }

            .foto-rosto-preview-title {
                color: #3a414c !important;
                font-size: 0.68rem !important;
                font-weight: 900 !important;
                letter-spacing: 0.045rem !important;
                margin: 0.28rem 0 0.30rem 0 !important;
                text-transform: uppercase !important;
            }

            [data-testid="stCameraInput"] {
                background: #ffffff !important;
                border: 1px dashed #d6dbe3 !important;
                border-radius: 12px !important;
                padding: 0.42rem !important;
            }

            [data-testid="stFileUploader"] {
                background: #ffffff !important;
                border: 1px dashed #d6dbe3 !important;
                border-radius: 12px !important;
                padding: 0.42rem !important;
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


def montar_config_dashboard(pagina: str) -> dict:
    if pagina == "📈 Comercial":
        return {
            "titulo": "Painel Comercial",
            "subtitulo": "Acompanhamento de alunos, aulas teste e novas matrículas",
            "chamada": "Transformando acompanhamento em <strong>crescimento</strong>",
            "descricao": (
                "Estrutura visual preparada para receber os dados comerciais "
                "da academia em tempo real."
            ),
            "metricas": [
                {"titulo": "Alunos ativos", "valor": "—", "rodape": "aguardando integração", "icone": "🥋", "classe": "kpi-black"},
                {"titulo": "Aulas teste", "valor": "—", "rodape": "aguardando integração", "icone": "🎯", "classe": "kpi-yellow"},
                {"titulo": "Novas matrículas", "valor": "—", "rodape": "aguardando integração", "icone": "⚡", "classe": "kpi-darkyellow"},
                {"titulo": "Conversão", "valor": "—", "rodape": "aguardando integração", "icone": "🏆", "classe": "kpi-gray"},
            ],
            "barras_title": "Modalidade mais escolhida",
            "barras_sub": "Quantidade de alunos por modalidade escolhida",
            "bar_labels": ["Jiu-Jitsu", "Muay Thai", "MMA", "Kids"],
            "painel_title": "Aulas teste e novas matrículas",
            "painel_sub": "Comparativo semanal",
        }

    return {
        "titulo": "Painel da Diretoria",
        "subtitulo": "Visão estratégica para acompanhamento da academia",
        "chamada": "Decisões mais rápidas com <strong>visão clara</strong>",
        "descricao": (
            "Indicadores estratégicos organizados para facilitar "
            "o acompanhamento da diretoria."
        ),
        "metricas": [
            {"titulo": "Receita do mês", "valor": "—", "rodape": "aguardando integração", "icone": "💰", "classe": "kpi-black"},
            {"titulo": "Alunos ativos", "valor": "—", "rodape": "aguardando integração", "icone": "🥋", "classe": "kpi-yellow"},
            {"titulo": "Ticket médio", "valor": "—", "rodape": "aguardando integração", "icone": "📊", "classe": "kpi-darkyellow"},
            {"titulo": "Cancelamentos", "valor": "—", "rodape": "aguardando integração", "icone": "⚠️", "classe": "kpi-gray"},
        ],
        "barras_title": "Resultado por modalidade",
        "barras_sub": "Estrutura pronta para comparar desempenho",
        "bar_labels": ["Jiu-Jitsu", "Muay Thai", "MMA", "Kids", "Nogi", "Boxe"],
        "painel_title": "Receita e matrículas",
        "painel_sub": "Evolução semanal da operação",
    }



def normalizar_modalidade_grafico(valor: str) -> str:
    """
    Converte variações antigas da planilha para os quatro grupos exibidos
    no gráfico comercial.
    """
    modalidade = normalizar_texto_busca(valor)

    mapa = {
        "jiu-jitsu": "Jiu-Jitsu",
        "jiu jitsu": "Jiu-Jitsu",
        "jiujitsu": "Jiu-Jitsu",
        "muay thai": "Muay Thai",
        "muaythai": "Muay Thai",
        "mma": "MMA",
        "kids": "Kids",
        "jiu-jitsu infantil": "Kids",
        "jiu jitsu infantil": "Kids",
        "jiujitsu infantil": "Kids",
    }

    return mapa.get(modalidade, "")


def contar_modalidades_comerciais() -> dict[str, int]:
    """
    Conta as modalidades escolhidas nos leads do acompanhamento comercial.

    Leads ainda sem modalidade preenchida são ignorados até que o cadastro
    seja complementado.
    """
    contagem = {
        "Jiu-Jitsu": 0,
        "Muay Thai": 0,
        "MMA": 0,
        "Kids": 0,
    }

    for cadastro in obter_cadastros_comerciais():
        modalidade = normalizar_modalidade_grafico(
            cadastro.get("Produto ou Serviço", "")
        )

        if modalidade in contagem:
            contagem[modalidade] += 1

    return contagem


def montar_barras_modalidades_comerciais() -> str:
    """
    Monta as barras dinamicamente conforme os dados salvos na planilha.
    """
    contagem = contar_modalidades_comerciais()
    maior_valor = max(contagem.values(), default=0)

    classes = {
        "Jiu-Jitsu": "bar-yellow",
        "Muay Thai": "bar-black",
        "MMA": "bar-yellow",
        "Kids": "bar-black",
    }

    barras_html = []

    for modalidade in ["Jiu-Jitsu", "Muay Thai", "MMA", "Kids"]:
        total = contagem[modalidade]

        if maior_valor <= 0:
            altura = 10
        else:
            altura = 18 + round((total / maior_valor) * 132)

        barras_html.append(
            f"""
            <div class="bar-group">
                <div class="bar-value">{total}</div>
                <div
                    class="bar {classes[modalidade]}"
                    style="height:{altura}px;"
                    title="{modalidade}: {total}"
                ></div>
                <div class="bar-label">{modalidade}</div>
            </div>
            """
        )

    return "".join(barras_html)



def montar_dashboard_topo_visual(
    logo_b64: str,
    pagina: str,
) -> str:
    config = montar_config_dashboard(pagina)
    kpis_html = montar_kpis_dashboard(config["metricas"])

    if pagina == "📈 Comercial":
        barras_html = montar_barras_modalidades_comerciais()
        rodape_barras = (
            "Atualizado automaticamente conforme as modalidades "
            "selecionadas nos cadastros comerciais."
        )
    else:
        barras_diretoria = [
            ("62%", "bar-yellow"),
            ("78%", "bar-black"),
            ("47%", "bar-yellow"),
            ("70%", "bar-black"),
        ]

        barras_html = "".join(
            [
                f"""
                <div class="bar-group">
                    <div class="bar {classe}" style="height:{altura};"></div>
                    <div class="bar-label">{label}</div>
                </div>
                """
                for label, (altura, classe) in zip(
                    config["bar_labels"],
                    barras_diretoria,
                )
            ]
        )

        rodape_barras = "Valores demonstrativos apenas para visualização do layout."

    return f"""
    <section class="dashboard-shell">
        <div class="dashboard-header">
            <div class="dash-brand">
                <img src="data:image/png;base64,{logo_b64}" alt="Fight for Life" />
                <div>
                    <p class="dash-brand-kicker">Fight for Life • Dashboard</p>
                    <h1 class="dash-brand-title">{config["titulo"]}</h1>
                    <p class="dash-brand-sub">{config["subtitulo"]}</p>
                </div>
            </div>

            <div class="dash-side-text">
                <p class="dash-side-title">{config["chamada"]}</p>
                <p class="dash-side-sub">{config["descricao"]}</p>
            </div>
        </div>

        {kpis_html}

        <article class="dash-panel dash-panel-large" style="margin-bottom:0.95rem;">
            <div class="dash-panel-header">
                <div>
                    <h2 class="dash-panel-title">{config["barras_title"]}</h2>
                    <p class="dash-panel-sub">{config["barras_sub"]}</p>
                </div>
                <div class="dash-panel-icon">▥</div>
            </div>

            <div class="bars-wrap">
                {barras_html}
            </div>

            <div class="dashboard-footer-note">
                {rodape_barras}
            </div>
        </article>
    </section>
    """


def montar_painel_grafico_html(
    titulo: str,
    subtitulo: str,
) -> str:
    return f"""
    <article class="chart-streamlit-wrap">
        <div class="dash-panel-header">
            <div>
                <h2 class="dash-panel-title">{titulo}</h2>
                <p class="dash-panel-sub">{subtitulo}</p>
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
    """


def montar_painel_retencao_diretoria_html() -> str:
    return """
    <article class="chart-streamlit-wrap">
        <div class="dash-panel-header">
            <div>
                <h2 class="dash-panel-title">Retenção de alunos</h2>
                <p class="dash-panel-sub">Acompanhamento mensal da permanência</p>
            </div>
            <div class="dash-panel-icon">◎</div>
        </div>

        <div class="gauge-wrap">
            <div class="gauge">
                <div class="gauge-center">
                    <span class="gauge-label">Taxa de retenção</span>
                    <strong class="gauge-value">—</strong>
                </div>
            </div>
            <div class="gauge-note">Aguardando integração dos dados</div>
        </div>
    </article>
    """



def obter_configuracao_planilha() -> tuple[str, str]:
    """
    Usa as configurações dos Secrets quando estiverem disponíveis.
    Mantém os valores padrão deste projeto como fallback.
    """
    spreadsheet_id = SPREADSHEET_ID_PADRAO
    worksheet_name = WORKSHEET_NAME_PADRAO

    try:
        if "google_sheets" in st.secrets:
            config = st.secrets["google_sheets"]
            spreadsheet_id = str(
                config.get("spreadsheet_id", spreadsheet_id)
            ).strip()
            worksheet_name = str(
                config.get("worksheet_name", worksheet_name)
            ).strip()
    except Exception:
        pass

    return spreadsheet_id, worksheet_name


def obter_info_conta_servico() -> dict:
    """
    Lê as credenciais da conta de serviço diretamente dos Secrets.
    A chave privada pode ser colada como texto multilinha ou com \\n.
    """
    if "gcp_service_account" not in st.secrets:
        raise RuntimeError(
            "As credenciais [gcp_service_account] não foram encontradas "
            "nos Secrets do Streamlit."
        )

    info = dict(st.secrets["gcp_service_account"])

    if "private_key" not in info:
        raise RuntimeError(
            'O campo "private_key" não foi encontrado em '
            "[gcp_service_account]."
        )

    info["private_key"] = str(info["private_key"]).replace("\\n", "\n")

    return info


@st.cache_resource(show_spinner=False)
def obter_worksheet_leads():
    """
    Cria uma conexão reutilizável com a aba Leads.
    """
    info = obter_info_conta_servico()
    credentials = Credentials.from_service_account_info(
        info,
        scopes=GOOGLE_SCOPES,
    )

    cliente = gspread.authorize(credentials)
    spreadsheet_id, worksheet_name = obter_configuracao_planilha()

    planilha = cliente.open_by_key(spreadsheet_id)
    worksheet = planilha.worksheet(worksheet_name)

    return worksheet


def validar_cabecalho_planilha(valores: list[list[str]]) -> None:
    """
    Garante a estrutura da aba Leads sem apagar dados existentes.

    Quando novas colunas são adicionadas ao dashboard, elas são incluídas
    automaticamente no final da linha 1 da planilha.
    """
    worksheet = obter_worksheet_leads()

    if not valores:
        ultima_coluna = rowcol_to_a1(1, len(COLUNAS_PLANILHA))
        worksheet.update(
            range_name=f"A1:{ultima_coluna}",
            values=[COLUNAS_PLANILHA],
        )
        return

    cabecalho_existente = [
        str(valor).strip()
        for valor in valores[0]
    ]

    quantidade_existente = len(cabecalho_existente)
    prefixo_esperado = COLUNAS_PLANILHA[:quantidade_existente]

    if cabecalho_existente != prefixo_esperado:
        esperado = " | ".join(COLUNAS_PLANILHA)
        encontrado = " | ".join(cabecalho_existente)

        raise RuntimeError(
            "A linha 1 da aba Leads não está na ordem esperada. "
            f"Esperado: {esperado}. Encontrado: {encontrado}."
        )

    if quantidade_existente < len(COLUNAS_PLANILHA):
        primeira_nova_coluna = quantidade_existente + 1
        ultima_nova_coluna = len(COLUNAS_PLANILHA)

        inicio = rowcol_to_a1(1, primeira_nova_coluna)
        fim = rowcol_to_a1(1, ultima_nova_coluna)

        worksheet.update(
            range_name=f"{inicio}:{fim}",
            values=[COLUNAS_PLANILHA[quantidade_existente:]],
        )


def normalizar_telefone_lead(valor: str) -> str:
    """
    Normaliza o telefone para comparar leads vindos do WhatsApp.

    Exemplos equivalentes:
    5511983637594
    (11) 98363-7594
    11 98363 7594
    """
    digitos = re.sub(r"\D", "", str(valor or ""))

    if digitos.startswith("55") and len(digitos) > 11:
        digitos = digitos[2:]

    return digitos



@st.cache_data(ttl=8, show_spinner=False)
def carregar_cadastros_planilha() -> list[dict]:
    """
    Lê os leads salvos no Google Sheets.

    Quando um novo contato entra pela automação do WhatsApp, a linha pode
    chegar somente com o telefone e sem IDLead. Nesse caso, o dashboard:
    - identifica automaticamente a nova linha;
    - gera um IDLead;
    - define o status inicial como Novo Lead;
    - registra as datas de cadastro e atualização;
    - exibe apenas um cadastro por telefone.

    Caso o WhatsApp envie novamente o mesmo número, a linha duplicada não
    entra nos cards e não cria outro lead.
    """
    worksheet = obter_worksheet_leads()
    valores = worksheet.get_all_values()

    validar_cabecalho_planilha(valores)

    if len(valores) <= 1:
        return []

    cadastros = []
    telefones_vistos = set()

    for numero_linha, linha in enumerate(valores[1:], start=2):
        linha_completa = list(linha) + [""] * (
            len(COLUNAS_PLANILHA) - len(linha)
        )

        linha_completa = linha_completa[: len(COLUNAS_PLANILHA)]

        possui_alguma_informacao = any(
            str(valor).strip()
            for valor in linha_completa
        )

        if not possui_alguma_informacao:
            continue

        telefone_normalizado = normalizar_telefone_lead(
            linha_completa[11]
        )

        if telefone_normalizado and telefone_normalizado in telefones_vistos:
            continue

        id_lead = str(linha_completa[0]).strip()

        if not id_lead:
            agora = obter_data_hora_atual()
            id_lead = gerar_id_lead()

            linha_completa[0] = id_lead

            if not str(linha_completa[1]).strip():
                linha_completa[1] = agora

            if not str(linha_completa[9]).strip():
                linha_completa[9] = "Novo Lead"

            if not str(linha_completa[10]).strip():
                linha_completa[10] = agora

            worksheet.update(
                range_name=f"A{numero_linha}:K{numero_linha}",
                values=[linha_completa[:11]],
                value_input_option="USER_ENTERED",
            )

        cadastro = {
            coluna: str(linha_completa[indice]).strip()
            for indice, coluna in enumerate(COLUNAS_PLANILHA)
        }

        cadastro["Status Comercial"] = normalizar_status_comercial(
            cadastro.get("Status Comercial", "Novo Lead")
        )

        cadastro["_Linha Planilha"] = numero_linha
        cadastros.append(cadastro)

        if telefone_normalizado:
            telefones_vistos.add(telefone_normalizado)

    return cadastros


def limpar_cache_planilha() -> None:
    carregar_cadastros_planilha.clear()


def obter_data_hora_atual() -> str:
    """
    Registra data e hora no fuso de São Paulo.
    """
    agora = datetime.now(ZoneInfo("America/Sao_Paulo"))
    return agora.strftime("%d/%m/%Y %H:%M:%S")


def gerar_id_lead() -> str:
    return f"LEAD-{uuid.uuid4().hex[:10].upper()}"




def sanitizar_nome_arquivo_drive(valor: str) -> str:
    """
    Limpa o nome do aluno antes de criar o arquivo no Google Drive.
    """
    nome = str(valor or "").strip()
    nome = re.sub(r'[\\/:*?"<>|]+', " ", nome)
    nome = re.sub(r"\s+", " ", nome).strip()

    if not nome:
        nome = "Aluno sem nome"

    return nome[:120]


def obter_url_upload_foto_drive() -> str:
    """
    Permite substituir a URL pelo Streamlit Secrets no futuro.
    Caso não exista configuração externa, usa a API publicada agora.
    """
    try:
        if "DRIVE_UPLOAD_WEBAPP_URL" in st.secrets:
            url = str(st.secrets["DRIVE_UPLOAD_WEBAPP_URL"]).strip()

            if url:
                return url
    except Exception:
        pass

    url_ambiente = os.getenv("DRIVE_UPLOAD_WEBAPP_URL", "").strip()

    if url_ambiente:
        return url_ambiente

    return DRIVE_UPLOAD_WEBAPP_URL_PADRAO


def upload_foto_rosto_aluno_drive(
    foto_rosto,
    nome_aluno: str,
) -> str:
    """
    Envia a foto do rosto para a API do Google Apps Script.

    O Apps Script salva o arquivo na pasta Fotos Alunos Fight for Life
    e devolve o link do Google Drive.
    """
    if foto_rosto is None:
        return ""

    upload_url = obter_url_upload_foto_drive()

    if not upload_url:
        raise RuntimeError(
            "A URL da API de fotos do Google Drive não foi configurada."
        )

    nome_original = str(
        getattr(foto_rosto, "name", "foto_rosto.jpg")
    ).strip()

    extensao = Path(nome_original).suffix.lower()

    if extensao not in [".png", ".jpg", ".jpeg"]:
        extensao_detectada = mimetypes.guess_extension(
            str(getattr(foto_rosto, "type", "") or "")
        )

        extensao = (
            extensao_detectada
            if extensao_detectada in [".png", ".jpg", ".jpeg"]
            else ".jpg"
        )

    nome_limpo = sanitizar_nome_arquivo_drive(nome_aluno)
    timestamp = datetime.now(
        ZoneInfo("America/Sao_Paulo")
    ).strftime("%Y%m%d_%H%M%S")

    nome_arquivo = f"{nome_limpo}_{timestamp}{extensao}"

    bytes_foto = foto_rosto.getvalue()
    foto_base64 = base64.b64encode(bytes_foto).decode("utf-8")

    mime_type = (
        str(getattr(foto_rosto, "type", "") or "").strip()
        or mimetypes.guess_type(nome_arquivo)[0]
        or "image/jpeg"
    )

    payload = {
        "filename": nome_arquivo,
        "mimeType": mime_type,
        "base64": foto_base64,
    }

    corpo = urlencode(
        {
            "payload": json.dumps(
                payload,
                ensure_ascii=False,
            )
        }
    ).encode("utf-8")

    requisicao = Request(
        url=upload_url,
        data=corpo,
        headers={
            "Content-Type": "application/x-www-form-urlencoded",
            "Accept": "application/json",
        },
        method="POST",
    )

    try:
        with urlopen(requisicao, timeout=120) as resposta:
            conteudo = resposta.read().decode("utf-8", errors="replace")

    except HTTPError as erro:
        detalhe = erro.read().decode("utf-8", errors="replace")

        raise RuntimeError(
            f"Erro HTTP {erro.code} ao enviar a foto: {detalhe[:700]}"
        ) from erro

    except URLError as erro:
        raise RuntimeError(
            f"Não foi possível acessar a API de fotos: {erro.reason}"
        ) from erro

    try:
        dados = json.loads(conteudo)
    except Exception as erro:
        raise RuntimeError(
            "A API de fotos respondeu em um formato inesperado. "
            f"Resposta recebida: {conteudo[:700]}"
        ) from erro

    if not dados.get("ok"):
        raise RuntimeError(
            f"A API de fotos retornou erro: {dados}"
        )

    return str(dados.get("url", "")).strip()



def telefone_ja_cadastrado(telefone: str) -> bool:
    """
    Verifica se o telefone já existe no banco de dados antes de criar
    um novo lead manualmente.
    """
    telefone_normalizado = normalizar_telefone_lead(telefone)

    if not telefone_normalizado:
        return False

    for cadastro in carregar_cadastros_planilha():
        telefone_existente = normalizar_telefone_lead(
            cadastro.get("Telefone", "")
        )

        if telefone_existente == telefone_normalizado:
            return True

    return False



def salvar_novo_lead_planilha(cadastro: dict) -> str:
    """
    Cria uma nova linha na planilha e devolve o ID gerado.

    Telefones já existentes não são cadastrados novamente.
    """
    telefone = str(cadastro.get("Telefone", "")).strip()

    if telefone_ja_cadastrado(telefone):
        raise RuntimeError(
            "Este telefone já está cadastrado no banco de dados."
        )

    worksheet = obter_worksheet_leads()
    id_lead = gerar_id_lead()
    agora = obter_data_hora_atual()

    valores = [
        id_lead,
        agora,
        str(cadastro.get("Nome Completo", "")).strip(),
        str(cadastro.get("Data de Nascimento", "")).strip(),
        str(cadastro.get("CPF", "")).strip(),
        str(cadastro.get("E-mail", "")).strip(),
        str(cadastro.get("Endereço", "")).strip(),
        str(cadastro.get("Produto ou Serviço", "")).strip(),
        str(cadastro.get("Rede Social", "")).strip(),
        normalizar_status_comercial(
            cadastro.get("Status Comercial", "Novo Lead")
        ),
        agora,
        str(cadastro.get("Telefone", "")).strip(),
        "",
        "",
        "Não enviado",
        "",
        "",
        str(cadastro.get("Rua", "")).strip(),
        str(cadastro.get("Bairro", "")).strip(),
        str(cadastro.get("CEP", "")).strip(),
        str(cadastro.get("Complemento", "")).strip(),
        str(cadastro.get("Plano Cliente", "")).strip(),
        str(cadastro.get("Forma de Pagamento", "")).strip(),
        str(cadastro.get("Foto do Rosto Drive", "")).strip(),
    ]

    worksheet.append_row(
        valores,
        value_input_option="USER_ENTERED",
    )

    limpar_cache_planilha()
    return id_lead



def obter_configuracao_zapsign() -> dict:
    """
    Lê a configuração da ZapSign nos Secrets do Streamlit.

    Formato esperado:
    [zapsign]
    api_token = "..."
    template_id = "..."
    base_url = "https://api.zapsign.com.br"
    """
    if "zapsign" not in st.secrets:
        raise RuntimeError(
            "A seção [zapsign] não foi encontrada nos Secrets do Streamlit."
        )

    config = st.secrets["zapsign"]

    api_token = str(config.get("api_token", "")).strip()
    template_id = str(config.get("template_id", "")).strip()
    base_url = str(
        config.get("base_url", "https://api.zapsign.com.br")
    ).strip().rstrip("/")

    if not api_token:
        raise RuntimeError("O api_token da ZapSign não foi configurado.")

    if not template_id:
        raise RuntimeError("O template_id da ZapSign não foi configurado.")

    return {
        "api_token": api_token,
        "template_id": template_id,
        "base_url": base_url,
    }


def normalizar_telefone_zapsign(telefone: str) -> str:
    """
    Envia somente DDD + número para a ZapSign.
    O código do Brasil é enviado separadamente como 55.
    """
    digitos = somente_digitos(telefone)

    if digitos.startswith("55") and len(digitos) > 11:
        digitos = digitos[2:]

    return digitos


def enviar_post_json_zapsign(
    endpoint: str,
    payload: dict,
) -> dict:
    config = obter_configuracao_zapsign()
    url = f'{config["base_url"]}{endpoint}'

    corpo = json.dumps(
        payload,
        ensure_ascii=False,
    ).encode("utf-8")

    requisicao = Request(
        url=url,
        data=corpo,
        headers={
            "Authorization": f'Bearer {config["api_token"]}',
            "Content-Type": "application/json",
            "Accept": "application/json",
        },
        method="POST",
    )

    try:
        with urlopen(requisicao, timeout=35) as resposta:
            conteudo = resposta.read().decode("utf-8")
            return json.loads(conteudo) if conteudo else {}

    except HTTPError as erro:
        detalhe = erro.read().decode("utf-8", errors="replace")
        detalhe = detalhe[:600]

        raise RuntimeError(
            f"ZapSign retornou HTTP {erro.code}. Detalhes: {detalhe}"
        ) from erro

    except URLError as erro:
        raise RuntimeError(
            f"Não foi possível acessar a ZapSign: {erro.reason}"
        ) from erro


def criar_contrato_zapsign(
    cadastro: dict,
    id_lead: str,
) -> dict:
    """
    Cria o contrato do aluno a partir do modelo DOCX e solicita
    o envio automático do e-mail com o link de assinatura.
    """
    config = obter_configuracao_zapsign()

    nome = str(cadastro.get("Nome Completo", "")).strip()
    email = str(cadastro.get("E-mail", "")).strip()

    if not nome:
        nome = "Aluno Fight for Life"
    telefone_original = str(cadastro.get("Telefone", "")).strip()
    telefone = normalizar_telefone_zapsign(telefone_original)

    if not email:
        raise RuntimeError(
            "Preencha o e-mail do aluno para enviar o contrato."
        )

    payload = {
        "template_id": config["template_id"],
        "signer_name": nome,
        "signer_email": email,
        "signer_phone_country": "55",
        "signer_phone_number": telefone,
        "lang": "pt-br",
        "send_automatic_email": True,
        "disable_signer_emails": False,
        "brand_name": "Fight for Life",
        "brand_primary_color": "#fbc410",
        "external_id": id_lead,
        "folder_path": "/Fight for Life/Contratos/",
        "custom_message": (
            f"Olá, {nome}!\\n\\n"
            "Seu cadastro na Fight for Life foi realizado com sucesso. "
            "Esta é a próxima etapa da sua matrícula. "
            "Confira o contrato e conclua sua assinatura digital.\\n\\n"
            "Fight for Life"
        ),
        "signature_order_active": True,
        "data": [
            {
                "de": "{{NOME_COMPLETO}}",
                "para": nome,
            },
            {
                "de": "{{CPF}}",
                "para": str(cadastro.get("CPF", "")).strip(),
            },
            {
                "de": "{{DATA_NASCIMENTO}}",
                "para": str(
                    cadastro.get("Data de Nascimento", "")
                ).strip(),
            },
            {
                "de": "{{TELEFONE}}",
                "para": telefone_original,
            },
            {
                "de": "{{EMAIL}}",
                "para": email,
            },
            {
                "de": "{{ENDERECO}}",
                "para": str(cadastro.get("Endereço", "")).strip(),
            },
            {
                "de": "{{RUA}}",
                "para": str(cadastro.get("Rua", "")).strip(),
            },
            {
                "de": "{{BAIRRO}}",
                "para": str(cadastro.get("Bairro", "")).strip(),
            },
            {
                "de": "{{CEP}}",
                "para": str(cadastro.get("CEP", "")).strip(),
            },
            {
                "de": "{{COMPLEMENTO}}",
                "para": str(cadastro.get("Complemento", "")).strip(),
            },
            {
                "de": "{{PLANO_CLIENTE}}",
                "para": str(cadastro.get("Plano Cliente", "")).strip(),
            },
            {
                "de": "{{FORMA_PAGAMENTO}}",
                "para": str(cadastro.get("Forma de Pagamento", "")).strip(),
            },
            {
                "de": "{{MODALIDADE}}",
                "para": str(
                    cadastro.get("Produto ou Serviço", "")
                ).strip(),
            },
        ],
    }

    resposta = enviar_post_json_zapsign(
        endpoint="/api/v1/models/create-doc/",
        payload=payload,
    )

    token_documento = str(resposta.get("token", "")).strip()
    signatarios = resposta.get("signers", []) or []

    signatario_aluno = None

    for signatario in signatarios:
        email_signatario = str(signatario.get("email", "")).strip().lower()

        if email_signatario and email_signatario == email.lower():
            signatario_aluno = signatario
            break

    if signatario_aluno is None and signatarios:
        signatario_aluno = signatarios[0]

    signatario_aluno = signatario_aluno or {}

    token_signatario = str(
        signatario_aluno.get("token", "")
    ).strip()

    link_assinatura = str(
        signatario_aluno.get("sign_url", "")
    ).strip()

    if not link_assinatura and token_signatario:
        link_assinatura = (
            f"https://app.zapsign.com.br/verificar/{token_signatario}"
        )

    if not token_documento:
        raise RuntimeError(
            "A ZapSign criou uma resposta sem o token do documento."
        )

    return {
        "token_documento": token_documento,
        "link_assinatura": link_assinatura,
        "status_contrato": str(
            resposta.get("status", "pending")
        ).strip() or "pending",
    }


def atualizar_dados_contrato_planilha(
    id_lead: str,
    token_documento: str = "",
    link_assinatura: str = "",
    status_contrato: str = "",
    data_envio: str = "",
    erro_envio: str = "",
) -> None:
    """
    Salva o resultado da integração ZapSign na mesma linha do aluno.
    """
    worksheet = obter_worksheet_leads()
    linha = localizar_linha_por_id(id_lead)

    indice_inicial = COLUNAS_PLANILHA.index(
        "Token Documento ZapSign"
    ) + 1

    indice_final = COLUNAS_PLANILHA.index(
        "Erro Envio Contrato"
    ) + 1

    inicio = rowcol_to_a1(linha, indice_inicial)
    fim = rowcol_to_a1(linha, indice_final)

    worksheet.update(
        range_name=f"{inicio}:{fim}",
        values=[[
            str(token_documento).strip(),
            str(link_assinatura).strip(),
            str(status_contrato).strip(),
            str(data_envio).strip(),
            str(erro_envio).strip(),
        ]],
        value_input_option="USER_ENTERED",
    )

    limpar_cache_planilha()


def enviar_contrato_aluno_zapsign(
    cadastro: dict,
    id_lead: str,
) -> dict:
    """
    Executa o envio e registra o resultado na planilha.
    """
    data_envio = obter_data_hora_atual()

    try:
        resultado = criar_contrato_zapsign(
            cadastro=cadastro,
            id_lead=id_lead,
        )

        atualizar_dados_contrato_planilha(
            id_lead=id_lead,
            token_documento=resultado["token_documento"],
            link_assinatura=resultado["link_assinatura"],
            status_contrato="Aguardando assinatura",
            data_envio=data_envio,
            erro_envio="",
        )

        return resultado

    except Exception as erro:
        atualizar_dados_contrato_planilha(
            id_lead=id_lead,
            status_contrato="Erro no envio",
            data_envio=data_envio,
            erro_envio=str(erro)[:700],
        )

        raise



def localizar_linha_por_id(id_lead: str) -> int:
    """
    Localiza a linha real da planilha pelo IDLead.
    """
    id_lead = str(id_lead or "").strip()

    if not id_lead:
        raise RuntimeError("O registro selecionado não possui IDLead.")

    worksheet = obter_worksheet_leads()
    celula = worksheet.find(id_lead, in_column=1)

    if celula is None:
        raise RuntimeError(
            f'O lead "{id_lead}" não foi encontrado na planilha.'
        )

    return int(celula.row)


def atualizar_status_lead_planilha(
    id_lead: str,
    novo_status: str,
) -> None:
    """
    Atualiza somente o status e a data da última atualização.
    """
    worksheet = obter_worksheet_leads()
    linha = localizar_linha_por_id(id_lead)
    agora = obter_data_hora_atual()

    worksheet.update(
        range_name=f"J{linha}:K{linha}",
        values=[[normalizar_status_comercial(novo_status), agora]],
        value_input_option="USER_ENTERED",
    )

    limpar_cache_planilha()


def atualizar_cadastro_lead_planilha(
    id_lead: str,
    cadastro: dict,
) -> None:
    """
    Atualiza os dados editáveis da ficha do aluno.

    O telefone não é alterado aqui porque ele vem automaticamente
    do WhatsApp e permanece bloqueado no formulário.
    """
    worksheet = obter_worksheet_leads()
    linha = localizar_linha_por_id(id_lead)
    agora = obter_data_hora_atual()

    endereco_completo = montar_endereco_completo(
        rua=cadastro.get("Rua", ""),
        bairro=cadastro.get("Bairro", ""),
        cep=cadastro.get("CEP", ""),
        complemento=cadastro.get("Complemento", ""),
    )

    worksheet.update(
        range_name=f"C{linha}:K{linha}",
        values=[[
            str(cadastro.get("Nome Completo", "")).strip(),
            str(cadastro.get("Data de Nascimento", "")).strip(),
            str(cadastro.get("CPF", "")).strip(),
            str(cadastro.get("E-mail", "")).strip(),
            endereco_completo,
            str(cadastro.get("Produto ou Serviço", "")).strip(),
            str(cadastro.get("Rede Social", "")).strip(),
            normalizar_status_comercial(
                cadastro.get("Status Comercial", "Novo Lead")
            ),
            agora,
        ]],
        value_input_option="USER_ENTERED",
    )

    primeira_coluna_adicional = COLUNAS_PLANILHA.index("Rua") + 1
    ultima_coluna_adicional = COLUNAS_PLANILHA.index(
        "Forma de Pagamento"
    ) + 1

    inicio = rowcol_to_a1(linha, primeira_coluna_adicional)
    fim = rowcol_to_a1(linha, ultima_coluna_adicional)

    worksheet.update(
        range_name=f"{inicio}:{fim}",
        values=[[
            str(cadastro.get("Rua", "")).strip(),
            str(cadastro.get("Bairro", "")).strip(),
            str(cadastro.get("CEP", "")).strip(),
            str(cadastro.get("Complemento", "")).strip(),
            str(cadastro.get("Plano Cliente", "")).strip(),
            str(cadastro.get("Forma de Pagamento", "")).strip(),
        ]],
        value_input_option="USER_ENTERED",
    )

    limpar_cache_planilha()


def testar_conexao_planilha() -> tuple[bool, str]:
    """
    Faz uma leitura simples para exibir um retorno amigável no menu lateral.
    """
    try:
        cadastros = carregar_cadastros_planilha()
        return True, f"Google Sheets conectado • {len(cadastros)} lead(s)"
    except Exception as erro:
        return False, str(erro)



def montar_endereco_completo(
    rua: str,
    bairro: str,
    cep: str,
    complemento: str,
) -> str:
    """
    Monta uma versão consolidada do endereço para manter compatibilidade
    com o contrato da ZapSign e com registros antigos da planilha.
    """
    partes = []

    if str(rua or "").strip():
        partes.append(str(rua).strip())

    if str(bairro or "").strip():
        partes.append(f"Bairro: {str(bairro).strip()}")

    if str(cep or "").strip():
        partes.append(f"CEP: {str(cep).strip()}")

    if str(complemento or "").strip():
        partes.append(f"Complemento: {str(complemento).strip()}")

    return " | ".join(partes)


def garantir_opcao_atual(
    opcoes: list[str],
    valor_atual: str,
) -> list[str]:
    """
    Preserva valores antigos da planilha mesmo quando não fazem parte
    das opções padronizadas atuais.
    """
    resultado = list(opcoes)
    valor_atual = str(valor_atual or "").strip()

    if valor_atual and valor_atual not in resultado:
        resultado.append(valor_atual)

    return resultado



STATUS_COMERCIAL_OPCOES = [
    "Novo Lead",
    "Conversando",
    "Não tem Interesse",
    "Não Responde",
    "Fechado",
]

PLANOS_CLIENTE_OPCOES = [
    "",
    "Mensal — R$ 259,00",
    "Trimestral — R$ 239,00",
    "Semestral — R$ 219,00 • recorrência 6 meses • contrato fidelidade",
    "Anual — R$ 199,00 • recorrência 6 meses • contrato fidelidade",
]

FORMAS_PAGAMENTO_OPCOES = [
    "",
    "Dinheiro",
    "Cartão de Crédito",
    "Cartão de Crédito Recorrente",
    "Pix",
]

MODALIDADES_OPCOES = [
    "",
    "Muay Thai",
    "Jiu-Jitsu",
    "Jiu-Jitsu Infantil",
    "MMA",
]


def obter_cadastros_comerciais() -> list[dict]:
    """
    A planilha é a fonte oficial dos leads.
    """
    try:
        return carregar_cadastros_planilha()
    except Exception as erro:
        st.error(
            "Não foi possível acessar a aba Leads do Google Sheets. "
            "Confira os Secrets e o compartilhamento da planilha."
        )
        st.caption(f"Detalhes técnicos: {erro}")
        return []


def normalizar_status_comercial(status: str) -> str:
    """
    Garante compatibilidade com cadastros antigos da sessão.
    Qualquer status fora do fluxo atual retorna para Novo Lead.
    """
    status = str(status or "").strip()

    mapa_compatibilidade = {
        "Sem Resposta": "Não Responde",
        "Não tem interesse": "Não tem Interesse",
        "Fechou": "Fechado",
    }

    status = mapa_compatibilidade.get(status, status)

    if status not in STATUS_COMERCIAL_OPCOES:
        return "Novo Lead"

    return status


def contar_status_comercial() -> dict[str, int]:
    contagem = {status: 0 for status in STATUS_COMERCIAL_OPCOES}

    for cadastro in obter_cadastros_comerciais():
        status_atual = normalizar_status_comercial(
            cadastro.get("Status Comercial", "Novo Lead")
        )

        cadastro["Status Comercial"] = status_atual
        contagem[status_atual] += 1

    return contagem


@st.fragment(run_every="10s")
def render_cards_status_comercial_clicaveis() -> None:
    """
    Exibe os status em cards e atualiza os totais automaticamente.
    """
    limpar_cache_planilha()
    contagem = contar_status_comercial()
    status_selecionado = st.session_state.get("status_card_selecionado", "")

    cards = [
        {
            "icone": "✦",
            "nome": "Novo Lead",
            "classe": "status-blue",
            "botao_key": "btn_status_novo_lead",
        },
        {
            "icone": "●",
            "nome": "Conversando",
            "classe": "status-brown",
            "botao_key": "btn_status_conversando",
        },
        {
            "icone": "⊘",
            "nome": "Não tem Interesse",
            "classe": "status-teal",
            "botao_key": "btn_status_nao_tem_interesse",
        },
        {
            "icone": "⚑",
            "nome": "Não Responde",
            "classe": "status-red",
            "botao_key": "btn_status_nao_responde",
        },
        {
            "icone": "✓",
            "nome": "Fechado",
            "classe": "status-green",
            "botao_key": "btn_status_fechado",
        },
    ]

    with st.container(key="status_final_panel_container"):
        st.html(
            """
            <div class="status-final-header">
                <div>
                    <h2 class="status-final-title">Acompanhamento comercial</h2>
                    <p class="status-final-sub">
                        Clique em “Ver nomes” para visualizar os alunos daquela etapa
                    </p>
                </div>
                <span class="placeholder-pill">Status</span>
            </div>
            """
        )

        colunas = st.columns(5, gap="small")

        for coluna, item in zip(colunas, cards):
            total = int(contagem[item["nome"]])
            texto_registro = (
                "registro nesta sessão"
                if total == 1
                else "registros nesta sessão"
            )

            classe_selecionado = (
                " status-final-card-selected"
                if item["nome"] == status_selecionado
                else ""
            )

            with coluna:
                st.html(
                    f"""
                    <article class="status-final-card{classe_selecionado}">
                        <div class="status-final-top">
                            <div class="status-final-icon {item["classe"]}">
                                {item["icone"]}
                            </div>
                            <p class="status-final-name">{item["nome"]}</p>
                        </div>

                        <p class="status-final-number">{total}</p>
                        <p class="status-final-period">{texto_registro}</p>
                    </article>
                    """
                )

                with st.container(key=item["botao_key"]):
                    if st.button(
                        "Ver nomes",
                        key=f'acao_{item["botao_key"]}',
                        use_container_width=True,
                    ):
                        if st.session_state.get("status_card_selecionado") == item["nome"]:
                            st.session_state["status_card_selecionado"] = ""
                        else:
                            st.session_state["status_card_selecionado"] = item["nome"]

                        st.rerun()


def converter_data_texto_para_date(valor: str):
    valor = str(valor or "").strip()

    if not valor:
        return None

    try:
        return datetime.strptime(valor, "%d/%m/%Y").date()
    except ValueError:
        return None



def normalizar_texto_busca(valor: str) -> str:
    texto = str(valor or "").strip().lower()
    texto = unicodedata.normalize("NFKD", texto)
    return "".join(
        caractere
        for caractere in texto
        if not unicodedata.combining(caractere)
    )


def somente_digitos(valor: str) -> str:
    return re.sub(r"\\D", "", str(valor or ""))


def buscar_leads_comerciais(termo: str) -> list[dict]:
    termo_texto = normalizar_texto_busca(termo)
    termo_numerico = somente_digitos(termo)

    if not termo_texto:
        return []

    resultados = []

    for cadastro in obter_cadastros_comerciais():
        nome = normalizar_texto_busca(cadastro.get("Nome Completo", ""))
        cpf = somente_digitos(cadastro.get("CPF", ""))
        telefone = normalizar_telefone_lead(cadastro.get("Telefone", ""))

        encontrou_nome = termo_texto in nome
        encontrou_cpf = bool(termo_numerico) and termo_numerico in cpf
        encontrou_telefone = bool(termo_numerico) and termo_numerico in telefone

        if encontrou_nome or encontrou_cpf or encontrou_telefone:
            resultados.append(cadastro)

    return resultados



def validar_cadastro_para_envio_contrato(cadastro: dict) -> list[str]:
    """
    Retorna os campos obrigatórios que ainda precisam ser preenchidos
    antes de gerar e enviar o contrato pela ZapSign.
    """
    campos_obrigatorios = [
        ("Nome Completo", "Nome completo"),
        ("Data de Nascimento", "Data de nascimento"),
        ("CPF", "CPF"),
        ("Telefone", "Telefone"),
        ("E-mail", "E-mail"),
        ("Rua", "Rua"),
        ("Bairro", "Bairro"),
        ("CEP", "CEP"),
        ("Produto ou Serviço", "Modalidade escolhida"),
        ("Plano Cliente", "Plano escolhido"),
        ("Forma de Pagamento", "Forma de pagamento"),
    ]

    faltantes = []

    for chave, rotulo in campos_obrigatorios:
        if not str(cadastro.get(chave, "")).strip():
            faltantes.append(rotulo)

    return faltantes



def render_ficha_lead_preenchida(
    cadastro: dict,
    chave_prefixo: str,
) -> None:
    """
    Exibe a ficha completa do lead em formato compacto de planilha.

    O lead já existe na planilha porque entrou pelo WhatsApp.
    Ao preencher os dados, o dashboard atualiza exatamente a mesma linha.
    Nenhuma nova linha é criada ao incluir nome, endereço ou plano.

    O contrato é enviado somente quando o usuário clicar no botão
    "Finalizar novo cadastro e enviar contrato".
    """
    status_atual = normalizar_status_comercial(
        cadastro.get("Status Comercial", "Novo Lead")
    )
    id_lead = str(cadastro.get("IDLead", chave_prefixo)).strip()
    telefone_original = str(cadastro.get("Telefone", "")).strip()

    st.markdown(
        f'<div class="busca-status-localizado">Quadro atual: {status_atual}</div>',
        unsafe_allow_html=True,
    )

    status_contrato = str(
        cadastro.get("Status Contrato", "Não enviado")
    ).strip() or "Não enviado"

    st.caption(f"Contrato digital: {status_contrato}")

    link_assinatura = str(
        cadastro.get("Link Assinatura ZapSign", "")
    ).strip()

    if link_assinatura:
        st.link_button(
            "Abrir link de assinatura",
            link_assinatura,
            use_container_width=True,
        )

    produto_atual = str(
        cadastro.get("Produto ou Serviço", "")
    ).strip()

    plano_atual = str(
        cadastro.get("Plano Cliente", "")
    ).strip()

    pagamento_atual = str(
        cadastro.get("Forma de Pagamento", "")
    ).strip()

    modalidades = garantir_opcao_atual(
        MODALIDADES_OPCOES,
        produto_atual,
    )

    planos = garantir_opcao_atual(
        PLANOS_CLIENTE_OPCOES,
        plano_atual,
    )

    pagamentos = garantir_opcao_atual(
        FORMAS_PAGAMENTO_OPCOES,
        pagamento_atual,
    )

    rua_atual = str(cadastro.get("Rua", "")).strip()

    if not rua_atual:
        rua_atual = str(cadastro.get("Endereço", "")).strip()

    with st.form(
        f"formulario_ficha_{chave_prefixo}_{id_lead}",
        clear_on_submit=False,
    ):
        st.markdown(
            """
            <p class="sheet-form-title">
                <span>Dados do cliente</span>
                <strong>Informações pessoais</strong>
            </p>
            <p class="sheet-form-sub">
                Preencha os dados do aluno. O telefone é captado automaticamente pelo WhatsApp.
            </p>
            """,
            unsafe_allow_html=True,
        )

        col_nome, col_data, col_cpf = st.columns([1.55, 0.72, 0.92])

        with col_nome:
            nome_completo = st.text_input(
                "Nome Completo",
                value=str(cadastro.get("Nome Completo", "")),
                key=f"{chave_prefixo}_nome_{id_lead}",
            )

        with col_data:
            data_nascimento = st.text_input(
                "Data de Nascimento",
                value=str(cadastro.get("Data de Nascimento", "")),
                placeholder="DD/MM/AAAA",
                key=f"{chave_prefixo}_data_{id_lead}",
            )

        with col_cpf:
            cpf = st.text_input(
                "CPF",
                value=str(cadastro.get("CPF", "")),
                placeholder="000.000.000-00",
                key=f"{chave_prefixo}_cpf_{id_lead}",
            )

        col_telefone, col_email, col_rede = st.columns([0.90, 1.35, 1.05])

        with col_telefone:
            st.text_input(
                "Telefone",
                value=telefone_original,
                disabled=True,
                help=(
                    "O telefone vem automaticamente do WhatsApp "
                    "e não pode ser alterado nesta ficha."
                ),
                key=f"{chave_prefixo}_telefone_{id_lead}",
            )

        with col_email:
            email = st.text_input(
                "E-mail",
                value=str(cadastro.get("E-mail", "")),
                placeholder="nome@exemplo.com",
                key=f"{chave_prefixo}_email_{id_lead}",
            )

        with col_rede:
            rede_social = st.text_input(
                "Rede Social",
                value=str(cadastro.get("Rede Social", "")),
                placeholder="@usuario ou link",
                key=f"{chave_prefixo}_rede_{id_lead}",
            )

        st.markdown(
            """
            <p class="sheet-form-title">
                <span>Endereço do cliente</span>
                <strong>Cadastro residencial</strong>
            </p>
            <p class="sheet-form-sub">
                Endereço separado em colunas para facilitar a conferência.
            </p>
            """,
            unsafe_allow_html=True,
        )

        col_rua, col_bairro, col_cep = st.columns([1.58, 0.88, 0.70])

        with col_rua:
            rua = st.text_input(
                "Rua",
                value=rua_atual,
                placeholder="Rua, avenida e número",
                key=f"{chave_prefixo}_rua_{id_lead}",
            )

        with col_bairro:
            bairro = st.text_input(
                "Bairro",
                value=str(cadastro.get("Bairro", "")),
                placeholder="Bairro",
                key=f"{chave_prefixo}_bairro_{id_lead}",
            )

        with col_cep:
            cep = st.text_input(
                "CEP",
                value=str(cadastro.get("CEP", "")),
                placeholder="00000-000",
                key=f"{chave_prefixo}_cep_{id_lead}",
            )

        complemento = st.text_input(
            "Complemento",
            value=str(cadastro.get("Complemento", "")),
            placeholder="Apartamento, bloco ou ponto de referência",
            key=f"{chave_prefixo}_complemento_{id_lead}",
        )

        st.markdown(
            """
            <p class="sheet-form-title">
                <span>Plano do cliente</span>
                <strong>Configuração comercial</strong>
            </p>
            <p class="sheet-form-sub">
                Escolha modalidade, plano e forma de pagamento.
            </p>
            """,
            unsafe_allow_html=True,
        )

        col_modalidade, col_plano, col_pagamento = st.columns([0.92, 1.55, 1.10])

        with col_modalidade:
            modalidade = st.selectbox(
                "Modalidade escolhida",
                options=modalidades,
                index=modalidades.index(produto_atual),
                key=f"{chave_prefixo}_produto_{id_lead}",
            )

        with col_plano:
            plano_cliente = st.selectbox(
                "Plano escolhido",
                options=planos,
                index=planos.index(plano_atual),
                key=f"{chave_prefixo}_plano_{id_lead}",
            )

        with col_pagamento:
            forma_pagamento = st.selectbox(
                "Forma de Pagamento",
                options=pagamentos,
                index=pagamentos.index(pagamento_atual),
                key=f"{chave_prefixo}_pagamento_{id_lead}",
            )

        st.markdown(
            """
            <p class="sheet-form-title">
                <span>Adicionais</span>
                <strong>Acompanhamento comercial</strong>
            </p>
            <p class="sheet-form-sub">
                Atualize o quadro do cliente conforme o andamento do atendimento.
            </p>
            """,
            unsafe_allow_html=True,
        )

        novo_status = st.selectbox(
            "Status comercial",
            options=STATUS_COMERCIAL_OPCOES,
            index=STATUS_COMERCIAL_OPCOES.index(status_atual),
            key=f"{chave_prefixo}_status_{id_lead}",
        )

        st.markdown(
            """
            <p class="sheet-action-note">
                Use <strong>Salvar alterações</strong> para atualizar a mesma linha da planilha.
                O contrato será enviado somente ao clicar em
                <strong>Finalizar novo cadastro e enviar contrato</strong>.
            </p>
            """,
            unsafe_allow_html=True,
        )

        coluna_salvar, coluna_finalizar = st.columns(2)

        with coluna_salvar:
            salvar_alteracoes = st.form_submit_button(
                "Salvar alterações",
                use_container_width=True,
            )

        with coluna_finalizar:
            finalizar_cadastro = st.form_submit_button(
                "Finalizar novo cadastro e enviar contrato",
                use_container_width=True,
            )

    cadastro_atualizado = {
        "Nome Completo": nome_completo,
        "Data de Nascimento": data_nascimento,
        "CPF": cpf,
        "Telefone": telefone_original,
        "E-mail": email,
        "Rua": rua,
        "Bairro": bairro,
        "CEP": cep,
        "Complemento": complemento,
        "Produto ou Serviço": modalidade,
        "Plano Cliente": plano_cliente,
        "Forma de Pagamento": forma_pagamento,
        "Rede Social": rede_social,
        "Status Comercial": novo_status,
    }

    if salvar_alteracoes:
        try:
            atualizar_cadastro_lead_planilha(
                id_lead=id_lead,
                cadastro=cadastro_atualizado,
            )
        except Exception as erro:
            st.error("Não foi possível atualizar o cadastro no banco de dados.")
            st.caption(f"Detalhes técnicos: {erro}")
            return

        st.session_state["status_card_selecionado"] = novo_status
        st.success(
            f'Cadastro de {nome_completo or "aluno"} atualizado com sucesso.'
        )
        st.rerun()

    if finalizar_cadastro:
        faltantes = validar_cadastro_para_envio_contrato(
            cadastro_atualizado
        )

        if faltantes:
            st.error(
                "Preencha os campos obrigatórios antes de enviar o contrato: "
                + ", ".join(faltantes)
                + "."
            )
            return

        try:
            atualizar_cadastro_lead_planilha(
                id_lead=id_lead,
                cadastro=cadastro_atualizado,
            )
        except Exception as erro:
            st.error("Não foi possível atualizar o cadastro no banco de dados.")
            st.caption(f"Detalhes técnicos: {erro}")
            return

        token_documento_existente = str(
            cadastro.get("Token Documento ZapSign", "")
        ).strip()

        if token_documento_existente:
            st.warning(
                "Este aluno já possui um contrato enviado. "
                "O cadastro foi atualizado, mas nenhum novo e-mail foi disparado."
            )
            st.session_state["status_card_selecionado"] = novo_status
            return

        try:
            enviar_contrato_aluno_zapsign(
                cadastro=cadastro_atualizado,
                id_lead=id_lead,
            )
        except Exception as erro:
            st.warning(
                "O cadastro foi atualizado, mas o contrato não pôde ser "
                "enviado pela ZapSign."
            )
            st.caption(f"Detalhes técnicos: {erro}")
            return

        st.session_state["status_card_selecionado"] = novo_status
        st.success(
            "Cadastro finalizado e contrato enviado por e-mail "
            "para assinatura digital."
        )
        st.rerun()


def formatar_rotulo_lead(cadastro: dict) -> str:
    """
    Exibe uma identificação clara e única no seletor.

    Leads vindos do WhatsApp podem chegar inicialmente apenas com telefone.
    Por isso, o telefone aparece no rótulo e evita que vários registros
    vazios sejam confundidos com o primeiro cadastro da lista.
    """
    nome = str(cadastro.get("Nome Completo", "")).strip()
    telefone = str(cadastro.get("Telefone", "")).strip()
    produto = str(cadastro.get("Produto ou Serviço", "")).strip()
    status = normalizar_status_comercial(
        cadastro.get("Status Comercial", "Novo Lead")
    )

    identificacao = nome or "Lead sem nome"
    telefone_exibido = telefone or "telefone não informado"

    partes = [
        identificacao,
        telefone_exibido,
        status,
    ]

    if produto:
        partes.append(produto)

    return " — ".join(partes)



def render_barra_pesquisa_comercial() -> None:
    with st.container(key="busca_comercial_container"):
        st.markdown(
            """
            <p class="busca-comercial-title">Pesquisar aluno</p>
            <p class="busca-comercial-sub">
                Localize rapidamente pelo nome, CPF ou telefone.
            </p>
            """,
            unsafe_allow_html=True,
        )

        termo = st.text_input(
            "Pesquisar aluno",
            placeholder="Digite nome, CPF ou telefone",
            label_visibility="collapsed",
            key="pesquisa_aluno_comercial",
        )

        if not termo.strip():
            return

        resultados = buscar_leads_comerciais(termo)

        if not resultados:
            st.info("Nenhum aluno encontrado.")
            return

        resultados_por_id = {
            str(cadastro.get("IDLead", "")).strip(): cadastro
            for cadastro in resultados
            if str(cadastro.get("IDLead", "")).strip()
        }

        ids_resultados = list(resultados_por_id.keys())

        if not ids_resultados:
            st.info("Nenhum aluno encontrado.")
            return

        id_escolhido = st.selectbox(
            "Resultado encontrado",
            options=ids_resultados,
            format_func=lambda id_lead: formatar_rotulo_lead(
                resultados_por_id[id_lead]
            ),
            key="resultado_pesquisa_aluno_comercial",
        )

        cadastro = resultados_por_id[id_escolhido]

        render_ficha_lead_preenchida(
            cadastro=cadastro,
            chave_prefixo="busca",
        )




def salvar_linha_editada_inline(
    cadastro_original: dict,
    dados_editados: dict,
) -> None:
    """
    Atualiza a mesma linha já existente no Google Sheets.
    O telefone permanece intocado porque vem diretamente do WhatsApp.
    """
    cadastro_atualizado = {
        "Nome Completo": str(dados_editados.get("Nome Completo", "")).strip(),
        "Data de Nascimento": str(
            dados_editados.get("Data de Nascimento", "")
        ).strip(),
        "CPF": str(dados_editados.get("CPF", "")).strip(),
        "Telefone": str(cadastro_original.get("Telefone", "")).strip(),
        "E-mail": str(dados_editados.get("E-mail", "")).strip(),
        "Rua": str(cadastro_original.get("Rua", "")).strip(),
        "Bairro": str(cadastro_original.get("Bairro", "")).strip(),
        "CEP": str(cadastro_original.get("CEP", "")).strip(),
        "Complemento": str(
            cadastro_original.get("Complemento", "")
        ).strip(),
        "Produto ou Serviço": str(
            dados_editados.get("Produto ou Serviço", "")
        ).strip(),
        "Plano Cliente": str(
            dados_editados.get("Plano Cliente", "")
        ).strip(),
        "Forma de Pagamento": str(
            dados_editados.get("Forma de Pagamento", "")
        ).strip(),
        "Rede Social": str(cadastro_original.get("Rede Social", "")).strip(),
        "Status Comercial": str(
            dados_editados.get("Status Comercial", "Novo Lead")
        ).strip(),
    }

    atualizar_cadastro_lead_planilha(
        id_lead=str(cadastro_original.get("IDLead", "")).strip(),
        cadastro=cadastro_atualizado,
    )




def atualizar_status_lead_consulta(
    id_lead: str,
    chave_widget: str,
) -> None:
    """
    Atualiza imediatamente o status do lead na mesma linha do Google Sheets.
    """
    novo_status = normalizar_status_comercial(
        st.session_state.get(chave_widget, "Novo Lead")
    )

    atualizar_status_lead_planilha(
        id_lead=id_lead,
        novo_status=novo_status,
    )

    st.session_state["status_card_selecionado"] = novo_status
    st.session_state["mensagem_status_atualizado"] = (
        f"Lead movido para: {novo_status}."
    )



def render_registros_card_clicado() -> None:
    """
    Exibe somente os novos números e o status comercial.

    A planilha é usada apenas para consulta dos leads recebidos pelo WhatsApp
    e movimentação entre os cards. A troca de status é salva automaticamente.
    """
    cadastros = obter_cadastros_comerciais()
    status_selecionado = st.session_state.get("status_card_selecionado", "")

    if not status_selecionado:
        return

    mensagem = st.session_state.pop(
        "mensagem_status_atualizado",
        "",
    )

    if mensagem:
        st.success(mensagem)

    cadastros_filtrados = [
        cadastro
        for cadastro in cadastros
        if normalizar_status_comercial(
            cadastro.get("Status Comercial", "Novo Lead")
        ) == status_selecionado
    ]

    with st.container(key="ficha_status_compacta"):
        if not cadastros_filtrados:
            st.info(f'Nenhum lead cadastrado em "{status_selecionado}".')
            return

        st.markdown(
            f"""
            <div class="lead-consulta-card">
                <div class="lead-consulta-toolbar">
                    <div>
                        <p class="lead-consulta-title">{html.escape(status_selecionado)}</p>
                        <p class="lead-consulta-sub">
                            Consulte os novos números e movimente cada lead entre as etapas.
                        </p>
                    </div>
                    <span class="lead-consulta-count">
                        {len(cadastros_filtrados)} registro(s)
                    </span>
                </div>
                <div class="lead-consulta-columns">
                    <span>Linha</span>
                    <span>Telefone</span>
                    <span>Status comercial</span>
                </div>
            </div>
            <p class="lead-consulta-help">
                O telefone entra automaticamente pelo WhatsApp.
                Para movimentar o lead, altere somente o status na própria linha.
                A atualização é salva automaticamente.
            </p>
            """,
            unsafe_allow_html=True,
        )

        with st.container(
            key="lead_consulta_scroll",
            height=min(470, 66 + (len(cadastros_filtrados) * 49)),
        ):
            for indice, cadastro in enumerate(cadastros_filtrados):
                id_lead = str(cadastro.get("IDLead", "")).strip()

                if not id_lead:
                    continue

                chave_segura = re.sub(
                    r"[^a-zA-Z0-9_]+",
                    "_",
                    id_lead,
                )

                classe_par = "_even" if indice % 2 == 0 else ""
                status_atual = normalizar_status_comercial(
                    cadastro.get("Status Comercial", "Novo Lead")
                )
                chave_status = f"consulta_status_{chave_segura}"

                with st.container(
                    key=f"lead_consulta_row{classe_par}_{chave_segura}"
                ):
                    col_linha, col_telefone, col_status = st.columns(
                        [0.65, 2.10, 1.35],
                        gap="small",
                    )

                    with col_linha:
                        st.markdown(
                            f'<p class="lead-consulta-line">{html.escape(str(cadastro.get("_Linha Planilha", "")))}</p>',
                            unsafe_allow_html=True,
                        )

                    with col_telefone:
                        telefone = str(cadastro.get("Telefone", "")).strip()
                        st.markdown(
                            f'<p class="lead-consulta-phone">{html.escape(telefone)}</p>',
                            unsafe_allow_html=True,
                        )

                    with col_status:
                        st.selectbox(
                            "Status comercial",
                            options=STATUS_COMERCIAL_OPCOES,
                            index=STATUS_COMERCIAL_OPCOES.index(
                                status_atual
                            ),
                            key=chave_status,
                            label_visibility="collapsed",
                            on_change=atualizar_status_lead_consulta,
                            args=(id_lead, chave_status),
                        )

        st.markdown(
            """
            <p class="lead-consulta-footer">
                Não existe botão de envio: a movimentação é gravada automaticamente
                assim que o status é alterado.
            </p>
            """,
            unsafe_allow_html=True,
        )


def render_movimentacao_status_comercial() -> None:
    cadastros = obter_cadastros_comerciais()

    if not cadastros:
        return

    with st.expander("Movimentar aluno entre os status", expanded=False):
        st.markdown(
            """
            <p class="form-card-intro">
                Escolha um aluno já cadastrado e altere o status comercial.
                Os cards serão atualizados automaticamente.
            </p>
            """,
            unsafe_allow_html=True,
        )

        opcoes_alunos = [
            f'{indice + 1} • {cadastro.get("Nome Completo", "Sem nome")} '
            f'— {normalizar_status_comercial(cadastro.get("Status Comercial", "Novo Lead"))}'
            for indice, cadastro in enumerate(cadastros)
        ]

        with st.form("formulario_movimentar_status", clear_on_submit=False):
            aluno_escolhido = st.selectbox(
                "Aluno cadastrado",
                options=opcoes_alunos,
            )

            indice_selecionado = opcoes_alunos.index(aluno_escolhido)
            status_atual = normalizar_status_comercial(
                cadastros[indice_selecionado].get(
                    "Status Comercial",
                    "Novo Lead",
                )
            )

            novo_status = st.selectbox(
                "Novo status comercial",
                options=STATUS_COMERCIAL_OPCOES,
                index=STATUS_COMERCIAL_OPCOES.index(status_atual),
            )

            atualizar_status = st.form_submit_button("Atualizar status")

        if atualizar_status:
            cadastro_selecionado = cadastros[indice_selecionado]

            try:
                atualizar_status_lead_planilha(
                    id_lead=cadastro_selecionado.get("IDLead", ""),
                    novo_status=novo_status,
                )
            except Exception as erro:
                st.error(
                    "Não foi possível atualizar o status na planilha."
                )
                st.caption(f"Detalhes técnicos: {erro}")
                return

            st.session_state["status_card_selecionado"] = novo_status
            st.success(
                f'Status de {cadastro_selecionado.get("Nome Completo", "aluno")} '
                f'alterado para: {novo_status}.'
            )
            st.rerun()


def render_formulario_retratil_comercial(
    expanded: bool = False,
) -> None:
    with st.expander("Cadastrar novo aluno", expanded=expanded):
        st.markdown(
            """
            <div class="form-card-badge">Formulário comercial</div>
            <p class="form-card-intro">
                Abra o formulário para registrar os dados do novo aluno.
                Os dados serão salvos automaticamente no banco de dados da academia.
            </p>
            """,
            unsafe_allow_html=True,
        )

        mensagem_cadastro = st.session_state.pop(
            "mensagem_cadastro_aluno",
            "",
        )

        tipo_mensagem_cadastro = st.session_state.pop(
            "tipo_mensagem_cadastro_aluno",
            "success",
        )

        if mensagem_cadastro:
            if tipo_mensagem_cadastro == "warning":
                st.warning(mensagem_cadastro)
            else:
                st.success(mensagem_cadastro)

        st.session_state.setdefault(
            "versao_upload_foto_rosto",
            0,
        )

        with st.form("formulario_novo_aluno", clear_on_submit=True):
            st.markdown(
                """
                <div class="form-section-block">
                    <p class="form-section-title">Dados do cliente</p>
                    <p class="form-section-sub">
                        Informações pessoais e meios de contato do aluno.
                    </p>
                </div>
                """,
                unsafe_allow_html=True,
            )

            coluna_nome, coluna_data = st.columns([1.55, 0.85])

            with coluna_nome:
                nome_completo = st.text_input(
                    "Nome Completo",
                    placeholder="Digite o nome completo",
                )

            with coluna_data:
                data_nascimento = st.date_input(
                    "Data de Nascimento",
                    value=None,
                    min_value=date(1900, 1, 1),
                    max_value=date.today(),
                    format="DD/MM/YYYY",
                )

            coluna_cpf, coluna_telefone = st.columns(2)

            with coluna_cpf:
                cpf = st.text_input(
                    "CPF",
                    placeholder="000.000.000-00",
                )

            with coluna_telefone:
                telefone = st.text_input(
                    "Telefone",
                    placeholder="(00) 00000-0000",
                )

            coluna_email, coluna_rede = st.columns(2)

            with coluna_email:
                email = st.text_input(
                    "E-mail",
                    placeholder="nome@exemplo.com",
                )

            with coluna_rede:
                rede_social = st.text_input(
                    "Rede Social",
                    placeholder="@usuario ou link do perfil",
                )

            st.markdown(
                """
                <div class="form-section-block">
                    <p class="form-section-title">Foto do rosto do aluno</p>
                    <p class="form-section-sub">
                        Selecione uma imagem já salva no aparelho.
                    </p>
                </div>
                <p class="foto-rosto-info">
                    Use uma foto nítida, com o rosto centralizado e boa iluminação.
                    Nesta etapa a imagem fica pronta para conferência dentro do cadastro.
                </p>
                """,
                unsafe_allow_html=True,
            )

            foto_rosto = st.file_uploader(
                "Enviar foto do rosto",
                type=["jpg", "jpeg", "png"],
                accept_multiple_files=False,
                key=(
                    "cadastro_foto_rosto_upload_"
                    f'{st.session_state["versao_upload_foto_rosto"]}'
                ),
            )

            if foto_rosto is not None:
                st.markdown(
                    '<p class="foto-rosto-preview-title">Pré-visualização da foto</p>',
                    unsafe_allow_html=True,
                )

                st.image(
                    foto_rosto,
                    caption="Foto do rosto selecionada",
                    width=220,
                )

            st.markdown(
                """
                <div class="form-section-block">
                    <p class="form-section-title">Endereço do cliente</p>
                    <p class="form-section-sub">
                        Preencha o endereço em campos separados.
                    </p>
                </div>
                """,
                unsafe_allow_html=True,
            )

            rua = st.text_input(
                "Rua",
                placeholder="Rua, avenida e número",
            )

            coluna_bairro, coluna_cep = st.columns(2)

            with coluna_bairro:
                bairro = st.text_input(
                    "Bairro",
                    placeholder="Digite o bairro",
                )

            with coluna_cep:
                cep = st.text_input(
                    "CEP",
                    placeholder="00000-000",
                )

            complemento = st.text_input(
                "Complemento",
                placeholder="Apartamento, bloco ou ponto de referência",
            )

            st.markdown(
                """
                <div class="form-section-block">
                    <p class="form-section-title">Planos do cliente</p>
                    <p class="form-section-sub">
                        Escolha a modalidade, o plano comercial e a forma de pagamento.
                    </p>
                </div>
                """,
                unsafe_allow_html=True,
            )

            modalidade = st.selectbox(
                "Modalidade escolhida",
                options=MODALIDADES_OPCOES,
            )

            plano_cliente = st.selectbox(
                "Plano escolhido",
                options=PLANOS_CLIENTE_OPCOES,
            )

            forma_pagamento = st.selectbox(
                "Forma de Pagamento",
                options=FORMAS_PAGAMENTO_OPCOES,
            )

            st.markdown(
                """
                <div class="form-section-block">
                    <p class="form-section-title">Adicionais</p>
                    <p class="form-section-sub">
                        Defina o status inicial do atendimento comercial.
                    </p>
                </div>
                """,
                unsafe_allow_html=True,
            )

            status_comercial = st.selectbox(
                "Status comercial",
                options=STATUS_COMERCIAL_OPCOES,
                index=0,
                help="Escolha o quadro em que o aluno deve entrar inicialmente.",
            )

            enviar = st.form_submit_button("Registrar aluno")

        if enviar:
            if not nome_completo.strip():
                st.error("Preencha o nome completo.")
            elif not email.strip():
                st.error(
                    "Preencha o e-mail do aluno para enviar o contrato."
                )
            elif not modalidade:
                st.error("Selecione a modalidade escolhida.")
            elif not plano_cliente:
                st.error("Selecione o plano do cliente.")
            elif not forma_pagamento:
                st.error("Selecione a forma de pagamento.")
            else:
                endereco_completo = montar_endereco_completo(
                    rua=rua,
                    bairro=bairro,
                    cep=cep,
                    complemento=complemento,
                )

                link_foto_rosto = ""

                if foto_rosto is not None:
                    try:
                        link_foto_rosto = upload_foto_rosto_aluno_drive(
                            foto_rosto=foto_rosto,
                            nome_aluno=nome_completo,
                        )
                    except Exception as erro:
                        st.error(
                            "Não foi possível salvar a foto do rosto no Google Drive."
                        )
                        st.caption(f"Detalhes técnicos: {erro}")
                        return

                cadastro = {
                    "Nome Completo": nome_completo.strip(),
                    "Data de Nascimento": (
                        data_nascimento.strftime("%d/%m/%Y")
                        if data_nascimento
                        else ""
                    ),
                    "CPF": cpf.strip(),
                    "Telefone": telefone.strip(),
                    "E-mail": email.strip(),
                    "Endereço": endereco_completo,
                    "Rua": rua.strip(),
                    "Bairro": bairro.strip(),
                    "CEP": cep.strip(),
                    "Complemento": complemento.strip(),
                    "Produto ou Serviço": modalidade,
                    "Plano Cliente": plano_cliente,
                    "Forma de Pagamento": forma_pagamento,
                    "Rede Social": rede_social.strip(),
                    "Status Comercial": status_comercial,
                    "Foto do Rosto Drive": link_foto_rosto,
                }

                try:
                    id_lead = salvar_novo_lead_planilha(cadastro)
                except Exception as erro:
                    st.error(
                        "Não foi possível salvar o aluno no banco de dados."
                    )
                    st.caption(f"Detalhes técnicos: {erro}")
                    return

                try:
                    enviar_contrato_aluno_zapsign(
                        cadastro=cadastro,
                        id_lead=id_lead,
                    )

                    mensagem_cadastro = (
                        "Aluno cadastrado e contrato enviado por e-mail "
                        "para assinatura digital."
                    )

                    if link_foto_rosto:
                        mensagem_cadastro += (
                            " A foto do rosto também foi salva no Google Drive."
                        )

                    tipo_mensagem = "success"

                except Exception as erro:
                    mensagem_cadastro = (
                        "O aluno foi salvo no banco de dados, mas o contrato "
                        "não pôde ser enviado pela ZapSign. "
                        f"Detalhes técnicos: {erro}"
                    )

                    tipo_mensagem = "warning"

                st.session_state["status_card_selecionado"] = status_comercial

                # Troca a chave do uploader para remover a imagem anterior
                # somente da tela. O arquivo já enviado permanece no Drive.
                st.session_state["versao_upload_foto_rosto"] += 1

                st.session_state["mensagem_cadastro_aluno"] = mensagem_cadastro
                st.session_state["tipo_mensagem_cadastro_aluno"] = tipo_mensagem

                st.rerun()




def render_cabecalho_cadastro_alunos() -> None:
    st.markdown(
        """
        <section class="cadastro-alunos-header">
            <div>
                <p class="cadastro-alunos-kicker">Fight for Life • Cadastro</p>
                <h1 class="cadastro-alunos-title">Cadastro de alunos</h1>
                <p class="cadastro-alunos-sub">
                    Registre um novo aluno, escolha o plano e envie o contrato
                    digital para assinatura.
                </p>
            </div>
            <div class="cadastro-alunos-badge">Novo cadastro</div>
        </section>
        """,
        unsafe_allow_html=True,
    )


def render_pagina_cadastro_alunos() -> None:
    render_cabecalho_cadastro_alunos()
    render_formulario_retratil_comercial(expanded=True)



def render_toggle_menu_lateral() -> None:
    """
    Controla o menu lateral com uma setinha própria e estável.

    Quando aberto, força a barra lateral e todo o conteúdo interno
    a ficarem visíveis. Quando fechado, oculta completamente a barra
    para liberar o espaço do dashboard.
    """
    st.session_state.setdefault("menu_lateral_aberto", True)

    menu_aberto = bool(st.session_state["menu_lateral_aberto"])
    icone = "‹" if menu_aberto else "›"

    if menu_aberto:
        sidebar_css = """
            display: block !important;
            left: 0 !important;
            max-width: 258px !important;
            min-width: 258px !important;
            opacity: 1 !important;
            transform: translateX(0) !important;
            visibility: visible !important;
            width: 258px !important;
        """

        sidebar_content_css = """
            display: block !important;
            max-width: 258px !important;
            min-width: 258px !important;
            opacity: 1 !important;
            transform: none !important;
            visibility: visible !important;
            width: 258px !important;
        """

        left_position = "222px"
    else:
        sidebar_css = """
            display: none !important;
            max-width: 0 !important;
            min-width: 0 !important;
            opacity: 0 !important;
            visibility: hidden !important;
            width: 0 !important;
        """

        sidebar_content_css = """
            display: none !important;
            opacity: 0 !important;
            visibility: hidden !important;
        """

        left_position = "12px"

    st.markdown(
        f"""
        <style>
            :root {{
                --menu-toggle-left: {left_position};
            }}

            [data-testid="stSidebar"] {{
                {sidebar_css}
            }}

            [data-testid="stSidebar"] > div:first-child,
            [data-testid="stSidebar"] [data-testid="stSidebarContent"],
            [data-testid="stSidebar"] [data-testid="stSidebarUserContent"] {{
                {sidebar_content_css}
            }}
        </style>
        """,
        unsafe_allow_html=True,
    )

    with st.container(key="toggle_menu_lateral"):
        if st.button(
            icone,
            key="acao_toggle_menu_lateral",
            help="Abrir ou fechar menu",
        ):
            st.session_state["menu_lateral_aberto"] = not menu_aberto
            st.rerun()


def exibir_dashboard_inicial() -> None:
    aplicar_css_dashboard_claro()
    render_toggle_menu_lateral()

    logo_b64 = arquivo_para_base64(LOGO_PATH)

    if "diretoria_autenticada" not in st.session_state:
        st.session_state["diretoria_autenticada"] = False

    with st.sidebar:
        if logo_b64:
            st.markdown(
                f"""
                <div class="sidebar-brand">
                    <img src="data:image/png;base64,{logo_b64}" alt="Fight for Life" />
                    <div>
                        <div class="sidebar-brand-title">Fight for Life</div>
                        <div class="sidebar-brand-sub">Painel interno</div>
                    </div>
                </div>
                """,
                unsafe_allow_html=True,
            )

        st.markdown(
            '<div class="sidebar-section-label">Navegação</div>',
            unsafe_allow_html=True,
        )

        pagina = st.radio(
            "Menu principal",
            options=[
                "📈 Comercial",
                "📝 Cadastro de alunos",
                "👔 Diretoria",
            ],
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

    if pagina == "📈 Comercial":
        st.html(
            montar_dashboard_topo_visual(
                logo_b64=logo_b64,
                pagina=pagina,
            )
        )

        render_barra_pesquisa_comercial()
        render_cards_status_comercial_clicaveis()
        render_registros_card_clicado()

    elif pagina == "📝 Cadastro de alunos":
        render_pagina_cadastro_alunos()

    else:
        st.html(
            montar_dashboard_topo_visual(
                logo_b64=logo_b64,
                pagina=pagina,
            )
        )

        config = montar_config_dashboard(pagina)

        coluna_esquerda, coluna_direita = st.columns(
            [0.82, 1.7],
            gap="medium",
        )

        with coluna_esquerda:
            st.html(montar_painel_retencao_diretoria_html())

        with coluna_direita:
            st.html(
                montar_painel_grafico_html(
                    titulo=config["painel_title"],
                    subtitulo=config["painel_sub"],
                )
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
