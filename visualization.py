"""
visualization.py - Plotly Visualizations for LLM X-Ray
Attention heatmaps, 2D PCA embedding scatter plots, and probability bar charts
"""

import plotly.graph_objects as go
import numpy as np

class XRayVisualizer:
    @staticmethod
    def create_attention_heatmap(attention_matrix: np.ndarray, tokens: list, layer: int = 12, head: int = 4):
        """Creates Plotly heatmap for multi-head attention"""
        fig = go.Figure(data=go.Heatmap(
            z=attention_matrix,
            x=tokens,
            y=tokens,
            colorscale="Blues",
            hoverongaps=False
        ))
        fig.update_layout(
            title=f"Causal Self-Attention Heatmap (Layer {layer}, Head {head})",
            xaxis_title="Key Tokens",
            yaxis_title="Query Tokens",
            template="plotly_dark",
            margin=dict(l=40, r=40, t=50, b=40)
        )
        return fig

    @staticmethod
    def create_probabilities_barchart(candidates: list):
        """Creates Plotly bar chart for next token probability distribution"""
        tokens = [c["token"] for c in candidates]
        probs = [c["probability"] * 100 for c in candidates]

        fig = go.Figure(go.Bar(
            x=probs,
            y=tokens,
            orientation='h',
            marker_color="#2563eb",
            text=[f"{p:.1f}%" for p in probs],
            textposition="auto"
        ))
        fig.update_layout(
            title="Next Token Probabilities (Softmax)",
            xaxis_title="Probability (%)",
            yaxis=dict(autorange="reversed"),
            template="plotly_dark",
            margin=dict(l=40, r=40, t=50, b=40)
        )
        return fig

    @staticmethod
    def create_embeddings_pca(embeddings_2d: np.ndarray, tokens: list):
        """Creates 2D PCA scatter plot for token embeddings"""
        fig = go.Figure(go.Scatter(
            x=embeddings_2d[:, 0],
            y=embeddings_2d[:, 1],
            mode="markers+text",
            text=tokens,
            textposition="top center",
            marker=dict(size=12, color="#0ea5e9", line=dict(width=1, color="white"))
        ))
        fig.update_layout(
            title="Token Embeddings 2D PCA Projection",
            xaxis_title="Principal Component 1",
            yaxis_title="Principal Component 2",
            template="plotly_dark",
            margin=dict(l=40, r=40, t=50, b=40)
        )
        return fig
