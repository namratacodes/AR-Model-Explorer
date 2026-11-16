import logging

import numpy as np
from sklearn.inspection import permutation_importance

from app.ml.evaluation import to_jsonable

try:
    import shap
except Exception:  # not installed, or one of its dependencies failed to load
    shap = None

logger = logging.getLogger(__name__)

# Which SHAP explainer fits which model. To support a new model, add a line here.
SHAP_KIND = {
    "decision_tree": "tree",
    "random_forest": "tree",
    "xgboost_classifier": "tree",
    "decision_tree_regressor": "tree",
    "random_forest_regressor": "tree",
    "xgboost_regressor": "tree",
    "logistic_regression": "linear",
    "linear_regression": "linear",
}

# The unit SHAP contributions are measured in (needed to read them correctly).
VALUE_SCALE = {
    "logistic_regression": "log-odds",
    "xgboost_classifier": "log-odds",
    "decision_tree": "probability",
    "random_forest": "probability",
}

MAX_PERMUTATION_ROWS = 2000
MAX_SHAP_ROWS = 300
MAX_BACKGROUND_ROWS = 100
N_LOCAL_EXAMPLES = 5
TOP_LOCAL_FEATURES = 8


def _items(names, values, stds=None) -> list[dict]:
    values = np.asarray(values, dtype=float)
    positive = np.clip(values, 0, None)
    total = positive.sum()
    items = []
    for i, name in enumerate(names):
        item = {
            "feature": name,
            "importance": round(float(values[i]), 5),
            "relative_percent": round(float(positive[i] / total * 100), 2) if total > 0 else 0.0,
        }
        if stds is not None:
            item["std"] = round(float(stds[i]), 5)
        items.append(item)
    items.sort(key=lambda it: it["importance"], reverse=True)
    return items


# ---------------------------------------------------------------- permutation
def _permutation(pipeline, X_test, y_test, random_state) -> dict:
    y_arr = np.asarray(y_test)
    n = len(X_test)
    if n > MAX_PERMUTATION_ROWS:  # keeps slow models (KNN, SVM) fast enough
        idx = np.random.default_rng(random_state).choice(n, MAX_PERMUTATION_ROWS, replace=False)
        X_s, y_s = X_test.iloc[idx], y_arr[idx]
    else:
        X_s, y_s = X_test, y_arr

    result = permutation_importance(pipeline, X_s, y_s, n_repeats=5, random_state=random_state)
    return {
        "method": "permutation",
        "rows_used": int(len(X_s)),
        "items": _items(list(X_test.columns), result.importances_mean, result.importances_std),
    }


# ----------------------------------------------------------------------- SHAP
def _onehot_widths(encoder) -> list[int]:
    infrequent = getattr(encoder, "infrequent_categories_", None)
    widths = []
    for i, cats in enumerate(encoder.categories_):
        n = len(cats)
        if infrequent is not None and infrequent[i] is not None:
            n = n - len(infrequent[i]) + 1  # rare categories are merged into one column
        widths.append(n)
    return widths


def _encoded_to_original(preprocess) -> list[str]:
    """For every column the model sees, which ORIGINAL feature did it come from?"""
    mapping = []
    for name, transformer, cols in preprocess.transformers_:
        if name == "remainder" or len(cols) == 0:
            continue
        if name == "num":
            mapping.extend(cols)  # one output per input column
        elif name == "cat":
            encoder = transformer.named_steps["onehot"]
            widths = _onehot_widths(encoder)
            if sum(widths) != len(encoder.get_feature_names_out()):
                raise ValueError("cannot map one-hot columns back to their features")
            for col, width in zip(cols, widths):
                mapping.extend([col] * width)
    if len(mapping) != len(preprocess.get_feature_names_out()):
        raise ValueError("cannot map encoded columns back to their features")
    return mapping


def _compute_shap(pipeline, model_key, task, kind, X_train, X_test, y_test, class_names, random_state):
    preprocess = pipeline.named_steps["preprocess"]
    model = pipeline.named_steps["model"]
    features = list(X_test.columns)
    groups = _encoded_to_original(preprocess)
    rng = np.random.default_rng(random_state)
    is_classification = task == "classification"
    n_classes = len(class_names) if is_classification else 1

    Z_all = np.asarray(preprocess.transform(X_test), dtype=float)
    sample_idx = np.sort(rng.choice(len(Z_all), size=min(len(Z_all), MAX_SHAP_ROWS), replace=False))
    Z = Z_all[sample_idx]
    X_sample = X_test.iloc[sample_idx]

    if kind == "tree":
        explanation = shap.TreeExplainer(model)(Z, check_additivity=False)
    else:
        Z_train = np.asarray(preprocess.transform(X_train), dtype=float)
        bg_idx = rng.choice(len(Z_train), size=min(len(Z_train), MAX_BACKGROUND_ROWS), replace=False)
        explanation = shap.LinearExplainer(model, Z_train[bg_idx])(Z)

    values = np.asarray(explanation.values, dtype=float)
    if values.ndim == 2:  # one score per row: binary classification or regression
        if is_classification:
            if n_classes != 2:
                raise ValueError("unexpected SHAP output for a multiclass model")
            values = np.stack([-values, values], axis=2)  # class 0 is the mirror of class 1
        else:
            values = values[:, :, None]
    if values.ndim != 3 or values.shape[2] != n_classes:
        raise ValueError("unexpected SHAP output shape")

    # Add up the contributions of one-hot columns belonging to the same original feature
    grouped = np.stack(
        [values[:, [i for i, g in enumerate(groups) if g == f], :].sum(axis=1) for f in features],
        axis=1,
    )  # shape: (rows, original features, classes)

    global_values = np.abs(grouped).mean(axis=(0, 2))

    # ----- local examples
    pred = np.asarray(pipeline.predict(X_sample))
    proba = pipeline.predict_proba(X_sample) if (is_classification and hasattr(pipeline, "predict_proba")) else None
    explained = pred.astype(int) if is_classification else np.zeros(len(pred), dtype=int)
    y_arr = np.asarray(y_test)

    chosen, seen = [], set()
    for r in range(len(sample_idx)):  # first: one example per predicted class
        if int(explained[r]) not in seen and len(chosen) < N_LOCAL_EXAMPLES:
            chosen.append(r)
            seen.add(int(explained[r]))
    for r in range(len(sample_idx)):  # then fill up
        if len(chosen) >= N_LOCAL_EXAMPLES:
            break
        if r not in chosen:
            chosen.append(r)

    examples = []
    for r in chosen:
        c = int(explained[r])
        contrib = grouped[r, :, c]
        order = np.argsort(-np.abs(contrib))
        row = X_sample.iloc[r]
        actual_raw = y_arr[sample_idx[r]]
        example = {
            "test_row": int(sample_idx[r]),
            "prediction": class_names[c] if is_classification else float(pred[r]),
            "actual": class_names[int(actual_raw)] if is_classification else float(actual_raw),
            "predicted_probability": float(proba[r, c]) if proba is not None else None,
            "contributions": [
                {
                    "feature": features[j],
                    "value": row[features[j]],
                    "contribution": round(float(contrib[j]), 5),
                    "direction": "increases" if contrib[j] >= 0 else "decreases",
                }
                for j in order[:TOP_LOCAL_FEATURES]
            ],
            "other_features_contribution": round(float(contrib[order[TOP_LOCAL_FEATURES:]].sum()), 5),
        }
        if is_classification:
            example["correct"] = example["prediction"] == example["actual"]
        examples.append(example)

    return {
        "available": True,
        "reason": None,
        "global_items": _items(features, global_values),
        "local": {
            "method": "shap",
            "value_scale": VALUE_SCALE.get(model_key, "target units"),
            "n_rows_explained": int(len(sample_idx)),
            "examples": examples,
        },
    }


def _shap(pipeline, model_key, task, X_train, X_test, y_test, class_names, random_state) -> dict:
    if shap is None:
        return {"available": False, "reason": "The optional 'shap' package is not installed on the server."}
    kind = SHAP_KIND.get(model_key)
    if kind is None:
        return {
            "available": False,
            "reason": "SHAP is not supported for this model type (it needs a tree-based or linear model).",
        }
    try:
        return _compute_shap(
            pipeline, model_key, task, kind, X_train, X_test, y_test, class_names, random_state
        )
    except Exception:
        logger.exception("SHAP failed for model %s", model_key)
        return {"available": False, "reason": "SHAP could not be computed for this model."}


# ----------------------------------------------------------------- entry point
def build_explanations(
    pipeline, model_key, task, X_train, X_test, y_test, class_names, random_state
) -> dict:
    notes = []
    permutation = None
    try:
        permutation = _permutation(pipeline, X_test, y_test, random_state)
    except Exception:
        logger.exception("Permutation importance failed")
        notes.append("Permutation importance could not be computed for this run.")

    shap_result = _shap(pipeline, model_key, task, X_train, X_test, y_test, class_names, random_state)

    if shap_result["available"]:
        global_importance = {"method": "shap", "items": shap_result["global_items"]}
        notes.append(
            "Global importance is the average absolute SHAP contribution of each feature "
            "across sampled test rows."
        )
    elif permutation is not None:
        global_importance = permutation
    else:
        global_importance = None

    if permutation is not None:
        notes.append(
            "Permutation importance is the drop in test score when a feature is shuffled. "
            "Correlated features can share or hide each other's importance."
        )
    if shap_result["available"]:
        notes.append(
            "Local contributions show how each feature pushed the model's score for the predicted "
            "outcome up (increases) or down (decreases), in the stated value scale."
        )
    else:
        notes.append("Local (per-prediction) explanations are unavailable: " + shap_result["reason"])

    return to_jsonable(
        {
            "task": task,
            "global_importance": global_importance,
            "permutation_importance": permutation,
            "local_explanations": shap_result.get("local"),
            "availability": {
                "global": global_importance is not None,
                "local": bool(shap_result["available"]),
                "shap": {"available": bool(shap_result["available"]), "reason": shap_result["reason"]},
            },
            "notes": notes,
        }
    )