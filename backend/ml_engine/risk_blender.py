import numpy as np


def calculate_blended_risk(ae_errors, if_scores, high_thresh, medium_thresh):
    def min_max_scale(arr):
        arr = np.array(arr) if not isinstance(arr, np.ndarray) else arr
        arr_min, arr_max = np.min(arr), np.max(arr)

        if arr_max == arr_min:
            return np.zeros_like(arr)

        return (arr - arr_min) / (arr_max - arr_min)

    try:
        ae_norm = min_max_scale(ae_errors)
        if_norm = min_max_scale(if_scores)

        blended_score = (ae_norm * 0.60) + (if_norm * 0.40)
        final_scores = np.round(blended_score * 100, 2)

        categories = []
        for score in final_scores:
            if score >= high_thresh:
                categories.append("High Risk")
            elif score >= medium_thresh:
                categories.append("Medium Risk")
            else:
                categories.append("Low Risk")

        return final_scores.tolist(), categories

    except Exception as e:
        print(f"Risk calculation failed: {str(e)}")
        raise e


def calculate_single_blended_risk(ae_error, if_score, scaling, high_thresh, medium_thresh):
    def min_max_scale(value, min_key, max_key):
        min_value = float(scaling.get(min_key, 0.0))
        max_value = float(scaling.get(max_key, 0.0))
        if max_value == min_value:
            return 0.0
        return (float(value) - min_value) / (max_value - min_value)

    ae_norm = min_max_scale(ae_error, "ae_min", "ae_max")
    if_norm = min_max_scale(if_score, "if_min", "if_max")
    blended_score = round(((ae_norm * 0.60) + (if_norm * 0.40)) * 100, 2)

    if blended_score >= float(high_thresh):
        category = "High Risk"
    elif blended_score >= float(medium_thresh):
        category = "Medium Risk"
    else:
        category = "Low Risk"

    return blended_score, category
