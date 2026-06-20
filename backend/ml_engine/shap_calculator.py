import shap
import numpy as np

def generate_local_shap(model, data_row: np.ndarray, feature_names: list):
    # TreeExplainer is compatible with Isolation Forest
    explainer = shap.TreeExplainer(model)
    shap_values = explainer.shap_values(data_row)

    # Handling different SHAP output formats
    sv = shap_values[1][0] if isinstance(shap_values, list) else shap_values[0]

    impacts = []
    for i, feature in enumerate(feature_names):
        impacts.append({
            "feature": feature,
            "impact": float(sv[i]),
            "absolute_impact": abs(float(sv[i]))
        })

    # Return Top 10 most influential features
    impacts = sorted(impacts, key=lambda x: x["absolute_impact"], reverse=True)[:10]
    return {"explanations": impacts}