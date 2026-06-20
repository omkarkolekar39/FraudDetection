from sklearn.ensemble import IsolationForest
import numpy as np

def train_and_score_isolation_forest(data: np.ndarray, contamination: float = 0.05):
    model = IsolationForest(
        contamination=contamination,
        max_samples=min(2048, len(data)),
        n_estimators=60,
        random_state=42,
        n_jobs=-1,
    )
    model.fit(data)

    # Invert scores: Higher = More Anomalous
    scores = -model.decision_function(data)
    return model, scores
