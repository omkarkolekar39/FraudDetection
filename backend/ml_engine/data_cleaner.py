import pandas as pd
import numpy as np
from sklearn.preprocessing import StandardScaler
from services.dataset_service import build_numeric_analysis_frame

def clean_and_normalize_data(raw_df: pd.DataFrame, ignored_columns: list[str] | None = None):
    """
    Cleans raw uploaded data, extracts numerical features, and normalizes it.
    """
    numeric_df, id_columns, analysis_columns = build_numeric_analysis_frame(raw_df, ignored_columns)
    numeric_df = numeric_df.fillna(0)

    # 3. Standardize (Mean=0, Std=1)
    # This is vital for Autoencoders to converge properly.
    scaler = StandardScaler()
    data_normalized = scaler.fit_transform(numeric_df.values)

    return numeric_df, data_normalized, scaler, id_columns, analysis_columns
