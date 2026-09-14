"""Tema visual do painel (FR-5/FR-6/FR-11).

Arquitetura de tokens no padrão do Design System Pulso (espaçamento em
unidades "pulse", radius de container/form, papéis semânticos de cor).
As primitivas de marca vêm da identidade do Banco Senff (Readex Pro,
navy #112369, acqua #05AACA) — o Pulso público da RD Saúde é multi-marca
e o tema "Senff" ocupa o mesmo papel que Raia/Drogasil ocupam lá.
"""

from __future__ import annotations

import base64
from pathlib import Path

import streamlit as st

ASSETS = Path(__file__).resolve().parent / "assets"
LOGO_NAVY = ASSETS / "logo-senff.png"
LOGO_BRANCA = ASSETS / "logo-senff-branca.png"


def _data_uri(path: Path) -> str:
    if not path.exists():
        return ""
    b64 = base64.b64encode(path.read_bytes()).decode("ascii")
    return f"data:image/png;base64,{b64}"

CSS = r"""
@import url("https://fonts.googleapis.com/css2?family=Readex+Pro:wght@300;400;500;600;700&display=swap");

:root {
  --senff-navy: #112369;
  --senff-navy-text: #393b75;
  --senff-sky: #4b90e2;
  --senff-acqua: #05aaca;
  --senff-acqua-hover: #048fb0;
  --senff-grey-blue: #90c4db;
  --senff-light-blue: #a9d7eb;
  --senff-light-grey: #f3f5f7;
  --senff-grey: #82929b;

  --color-fill-neutral-default: #ffffff;
  --color-fill-neutral-alternative: #f3f5f7;
  --color-fill-informative-default: #e8f4fc;
  --color-fill-success-default: #e6faf4;
  --color-fill-warning-default: #fff6e8;
  --color-fill-danger-default: #fdecef;
  --color-border-neutral-default: #e4ebf0;
  --color-text-neutral-default: #112369;
  --color-text-neutral-alternative: #393b75;
  --color-text-neutral-placeholder: #82929b;
  --color-text-neutral-inverse: #ffffff;
  --color-text-success-default: #0a6b5c;
  --color-text-warning-default: #8a5a12;
  --color-text-danger-default: #9b1c3a;
  --color-action-fill-brand-primary-enabled: #05aaca;
  --color-action-fill-brand-primary-hovered: #048fb0;
  --color-action-fill-brand-primary-pressed: #112369;

  --font-family: "Readex Pro", sans-serif;
  --font-size-threeandhalfpulse: 0.875rem;
  --font-size-fourpulse: 1rem;
  --font-size-fivepulse: 1.25rem;
  --font-size-sixpulse: 1.5rem;
  --font-size-eightpulse: 2rem;
  --border-radius-smallcontainer: 0.5rem;
  --border-radius-mediumcontainer: 0.75rem;
  --border-radius-form: 0.75rem;
  --border-radius-pill: 62.4375rem;
  --spacing-stack-twopulse: 0.5rem;
  --spacing-stack-fourpulse: 1rem;
  --spacing-stack-sixpulse: 1.5rem;
}

html, body, [data-testid="stAppViewContainer"],
[data-testid="stMarkdownContainer"], [data-testid="stHeader"],
.stButton, .stTextInput, .stSelectbox, .stTextArea, .stRadio,
.stDateInput, .stMetric, .stDataFrame, .stTabs, button, input, textarea {
  font-family: var(--font-family) !important;
}

[data-testid="stAppViewContainer"] {
  background: var(--color-fill-neutral-alternative);
}
[data-testid="stHeader"] {
  background: transparent;
}
[data-testid="stToolbar"] {
  visibility: hidden;
  height: 0;
}

[data-testid="stSidebar"] {
  background: var(--senff-navy) !important;
  color: var(--color-text-neutral-inverse);
}
[data-testid="stSidebar"] * {
  color: var(--color-text-neutral-inverse) !important;
}
[data-testid="stSidebar"] p,
[data-testid="stSidebar"] span,
[data-testid="stSidebar"] label {
  font-family: var(--font-family) !important;
}
[data-testid="stSidebar"] .stButton > button {
  background: rgba(255,255,255,0.12);
  border: 1px solid rgba(255,255,255,0.25);
  color: #fff !important;
  border-radius: var(--border-radius-form);
}
[data-testid="stSidebar"] .stButton > button:hover {
  background: var(--senff-acqua);
  border-color: var(--senff-acqua);
}
section[data-testid="stSidebar"] > div {
  padding-top: 1.25rem;
}

.stButton > button[kind="primary"],
.stButton > button[data-testid="baseButton-primary"],
button[kind="primary"] {
  background: var(--color-action-fill-brand-primary-enabled) !important;
  border: 0 !important;
  color: #fff !important;
  border-radius: var(--border-radius-form) !important;
  font-weight: 600 !important;
  padding: 0.55rem 1.15rem !important;
}
.stButton > button[kind="primary"]:hover {
  background: var(--color-action-fill-brand-primary-hovered) !important;
}

[data-testid="stTabs"] button[data-baseweb="tab"] {
  font-family: var(--font-family) !important;
  font-weight: 500;
  color: var(--senff-navy-text);
}
[data-testid="stTabs"] button[aria-selected="true"] {
  color: var(--senff-navy) !important;
}
[data-testid="stTabs"] [data-baseweb="tab-highlight"] {
  background-color: var(--senff-acqua) !important;
}

[data-testid="stMetric"] {
  background: var(--color-fill-neutral-default);
  border: 1px solid var(--color-border-neutral-default);
  border-radius: var(--border-radius-mediumcontainer);
  padding: 0.85rem 1rem;
}
[data-testid="stMetricLabel"] {
  color: var(--color-text-neutral-placeholder) !important;
}

div[data-testid="stAlert"] {
  border-radius: var(--border-radius-mediumcontainer);
}

.pq-topbar {
  display: flex;
  align-items: center;
  gap: 1rem;
  background: var(--senff-navy);
  color: #fff;
  border-radius: var(--border-radius-mediumcontainer);
  padding: 0.9rem 1.25rem;
  margin-bottom: 1.25rem;
}
.pq-topbar img {
  height: 44px;
  width: auto;
}
.pq-topbar-title {
  font-size: var(--font-size-fivepulse);
  font-weight: 600;
  line-height: 1.2;
  margin: 0;
}
.pq-topbar-sub {
  font-size: var(--font-size-threeandhalfpulse);
  opacity: 0.82;
  margin: 0.15rem 0 0;
  font-weight: 400;
}

.pq-kpis {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0.85rem;
  margin: 0 0 1.25rem;
}
.pq-kpi {
  background: var(--color-fill-neutral-default);
  border: 1px solid var(--color-border-neutral-default);
  border-radius: var(--border-radius-mediumcontainer);
  padding: 1rem 1.1rem 0.95rem;
  box-shadow: 0 1px 2px rgba(17, 35, 105, 0.04);
}
.pq-kpi-label {
  font-size: 0.75rem;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--color-text-neutral-placeholder);
  font-weight: 600;
}
.pq-kpi-value {
  font-size: var(--font-size-eightpulse);
  font-weight: 600;
  color: var(--senff-navy);
  line-height: 1.15;
  margin: 0.25rem 0 0.15rem;
}
.pq-kpi-hint {
  font-size: var(--font-size-threeandhalfpulse);
  color: var(--senff-navy-text);
}
.pq-kpi--acqua { border-top: 3px solid var(--senff-acqua); }
.pq-kpi--navy { border-top: 3px solid var(--senff-navy); }
.pq-kpi--sky { border-top: 3px solid var(--senff-sky); }
.pq-kpi--warn { border-top: 3px solid #e0a106; }
.pq-kpi--danger { border-top: 3px solid #c43b5a; }
.pq-kpi--ok { border-top: 3px solid #1aa37a; }

.pq-login-hero {
  background: var(--senff-navy);
  border-radius: var(--border-radius-mediumcontainer);
  padding: 1.6rem 1.5rem 1.4rem;
  color: #fff;
  text-align: center;
  margin-bottom: 1.25rem;
}
.pq-login-hero img {
  height: 52px;
  margin-bottom: 0.75rem;
}
.pq-login-hero h1 {
  font-size: 1.35rem;
  font-weight: 600;
  margin: 0 0 0.35rem;
  color: #fff;
}
.pq-login-hero p {
  margin: 0;
  font-size: 0.9rem;
  opacity: 0.85;
}

.pq-chip {
  display: inline-block;
  border-radius: var(--border-radius-pill);
  padding: 0.15rem 0.65rem;
  font-size: 0.75rem;
  font-weight: 600;
}
.pq-chip--ok { background: var(--color-fill-success-default); color: var(--color-text-success-default); }
.pq-chip--warn { background: var(--color-fill-warning-default); color: var(--color-text-warning-default); }
.pq-chip--off { background: var(--color-fill-neutral-alternative); color: var(--senff-grey); }
.pq-chip--danger { background: var(--color-fill-danger-default); color: var(--color-text-danger-default); }

.pq-legend {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem 1rem;
  font-size: 0.8rem;
  color: var(--senff-navy-text);
  margin: 0.25rem 0 1rem;
}

@media (max-width: 960px) {
  .pq-kpis { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
"""


def aplicar_tema(*, esconder_sidebar: bool = False) -> None:
    extra = ""
    if esconder_sidebar:
        extra = "[data-testid='stSidebar']{display:none;} [data-testid='stSidebarCollapsedControl']{display:none;}"
    st.markdown(f"<style>{CSS}{extra}</style>", unsafe_allow_html=True)


def logo_sidebar() -> None:
    if LOGO_BRANCA.exists():
        st.logo(str(LOGO_BRANCA), size="large")


def cabecalho(subtitulo: str) -> None:
    src = _data_uri(LOGO_BRANCA)
    img = f'<img src="{src}" alt="Banco Senff" />' if src else ""
    st.markdown(
        f"""
        <div class="pq-topbar">
          {img}
          <div>
            <p class="pq-topbar-title">Plano de Qualidade de Correspondentes</p>
            <p class="pq-topbar-sub">{subtitulo}</p>
          </div>
        </div>
        """,
        unsafe_allow_html=True,
    )


def render_kpis(cards: list[dict]) -> None:
    """cards: label, value, hint?, tone? (acqua|navy|sky|warn|danger|ok)."""
    partes = ['<div class="pq-kpis">']
    for card in cards:
        tone = card.get("tone", "acqua")
        hint = card.get("hint") or ""
        partes.append(
            f'<div class="pq-kpi pq-kpi--{tone}">'
            f'<div class="pq-kpi-label">{card["label"]}</div>'
            f'<div class="pq-kpi-value">{card["value"]}</div>'
            f'<div class="pq-kpi-hint">{hint}</div>'
            f"</div>"
        )
    partes.append("</div>")
    st.markdown("".join(partes), unsafe_allow_html=True)


def hero_login() -> None:
    src = _data_uri(LOGO_BRANCA)
    img = f'<img src="{src}" alt="Banco Senff" />' if src else ""
    st.markdown(
        f"""
        <div class="pq-login-hero">
          {img}
          <h1>Plano de Qualidade de Correspondentes</h1>
          <p>Banco Senff · Autorregulação do Crédito Consignado (FEBRABAN)</p>
        </div>
        """,
        unsafe_allow_html=True,
    )
