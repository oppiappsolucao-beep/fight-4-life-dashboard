from __future__ import annotations

import base64
import hmac
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
LOGO_PATH = BASE_DIR / "assets" / "logo_fight4life.png"

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
        "arquivo": BASE_DIR / "assets" / "muay_thai.jpg",
        "posicao": "center 43%",
    },
    {
        "titulo": "JIU-JITSU",
        "subtitulo": "Estratégia dentro e fora do tatame",
        "arquivo": BASE_DIR / "assets" / "jiu_jitsu.jpg",
        "posicao": "center 57%",
    },
    {
        "titulo": "JIU-JITSU KIDS",
        "subtitulo": "Confiança e evolução desde cedo",
        "arquivo": BASE_DIR / "assets" / "jiu_jitsu_kids.jpg",
        "posicao": "center 46%",
    },
    {
        "titulo": "MMA",
        "subtitulo": "Preparação completa para novos desafios",
        "arquivo": BASE_DIR / "assets" / "mma.jpg",
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
    Busca as credenciais nos Secrets do Streamlit Cloud.

    Também aceita variáveis de ambiente caso o projeto seja
    publicado posteriormente em outro servidor.
    """
    try:
        usuario = str(st.secrets["auth"]["username"])
        senha = str(st.secrets["auth"]["password"])
        return usuario, senha
    except Exception:
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
                margin-top: 2.6rem;
                overflow: hidden;
                padding: 1.1rem 1.15rem 0.15rem 1.15rem;
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
                margin: 0.6rem 0 0.7rem 0;
            }}

            .logo-wrap img {{
                filter: drop-shadow(0 10px 24px rgba(0,0,0,0.48));
                height: 144px;
                object-fit: contain;
                width: 144px;
            }}

            .login-title {{
                color: var(--branco);
                font-size: 1.45rem;
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
                margin: 0.38rem auto 0.78rem auto;
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
                font-size: 0.73rem !important;
                font-weight: 900 !important;
                letter-spacing: 0.07rem !important;
                text-transform: uppercase !important;
            }}

            div[data-testid="stTextInput"] input {{
                background: #ffffff !important;
                border: 2px solid #ffffff !important;
                border-radius: 10px !important;
                color: #000000 !important;
                font-size: 0.9rem !important;
                font-weight: 750 !important;
                min-height: 46px !important;
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
                min-height: 46px !important;
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
                margin: 0.85rem 0 1rem 0;
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
                    margin-top: 1rem;
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
        imagem_src = f"data:image/jpeg;base64,{imagem_b64}"

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


def exibir_dashboard_inicial() -> None:
    topo_texto, topo_botao = st.columns([5, 1])

    with topo_texto:
        st.markdown(
            """
            <div class="dash-head">
                <div>
                    <h1>Dashboard Fight for Life</h1>
                    <p>Painel inicial • Próxima etapa em construção</p>
                </div>
            </div>
            """,
            unsafe_allow_html=True,
        )

    with topo_botao:
        if st.button("Sair"):
            st.session_state["autenticado"] = False
            st.session_state.pop("usuario_logado", None)
            st.rerun()

    metricas = [
        ("Alunos ativos", "—"),
        ("Aulas no mês", "—"),
        ("Aulas teste", "—"),
        ("Novas matrículas", "—"),
    ]

    colunas = st.columns(4)

    for coluna, (titulo, valor) in zip(colunas, metricas):
        with coluna:
            st.markdown(
                f"""
                <div class="metric-card">
                    <div class="metric-label">{titulo}</div>
                    <div class="metric-value">{valor}</div>
                </div>
                """,
                unsafe_allow_html=True,
            )

    st.info(
        "A tela de login está pronta. Na próxima etapa serão definidas "
        "as páginas internas e a planilha que alimentará os indicadores."
    )


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
