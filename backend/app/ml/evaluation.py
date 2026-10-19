import math

import numpy as np
from sklearn.metrics import (
    accuracy_score,
    average_precision_score,
    balanced_accuracy_score,
    classification_report,
    confusion_matrix,
    f1_score,
    mean_absolute_error,
    mean_squared_error,
    precision_recall_curve,
    precision_score,
    r2_score,
    recall_score,
    roc_auc_score,
    roc_curve,
)

CURVE_POINTS = 100        # max points per curve (keeps payloads small for mobile)
MAX_CURVE_CLASSES = 10    # multiclass: only the 10 most common classes get a curve
MAX_SAMPLE_POINTS = 300   # regression: actual-vs-predicted points kept


def to_jsonable(obj):
    """Converts numpy types and NaN/inf into plain JSON-safe values."""
    if isinstance(obj, dict):
        return {str(k): to_jsonable(v) for k, v in obj.items()}
    if isinstance(obj, (list, tuple)):
        return [to_jsonable(v) for v in obj]
    if isinstance(obj, np.ndarray):
        return obj.tolist()
    if isinstance(obj, np.generic):
        obj = obj.item()
    if isinstance(obj, float) and not math.isfinite(obj):
        return None
    return obj


def _downsample(x, y, n=CURVE_POINTS):
    x, y = np.asarray(x), np.asarray(y)
    if len(x) > n:
        idx = np.linspace(0, len(x) - 1, n).astype(int)
        x, y = x[idx], y[idx]
    return np.round(x, 4), np.round(y, 4)


def _build_curves(y_test, proba, class_names):
    """One-vs-rest ROC and PR curves in a single shape for binary AND multiclass."""
    n_classes = len(class_names)
    y_test = np.asarray(y_test)

    if n_classes == 2:
        candidates = [1]  # the second class is treated as "positive"
    else:
        support = np.bincount(y_test, minlength=n_classes)
        candidates = list(np.argsort(-support)[:MAX_CURVE_CLASSES])

    roc_items, pr_items = [], []
    for i in candidates:
        y_bin = (y_test == i).astype(int)
        if y_bin.sum() == 0 or y_bin.sum() == len(y_bin):
            continue  # a curve needs both positives and negatives in the test set
        scores = proba[:, i]

        fpr, tpr, _ = roc_curve(y_bin, scores)
        precision, recall, _ = precision_recall_curve(y_bin, scores)
        fpr, tpr = _downsample(fpr, tpr)
        recall, precision = _downsample(recall, precision)

        roc_items.append(
            {"label": class_names[i], "auc": roc_auc_score(y_bin, scores), "fpr": fpr, "tpr": tpr}
        )
        pr_items.append(
            {
                "label": class_names[i],
                "average_precision": average_precision_score(y_bin, scores),
                "recall": recall,
                "precision": precision,
            }
        )

    if not roc_items:
        return None, None
    truncated = n_classes > MAX_CURVE_CLASSES
    return (
        {"curves": roc_items, "truncated": truncated},
        {"curves": pr_items, "truncated": truncated},
    )


def evaluate_classification(pipeline, X_test, y_test, class_names: list[str]) -> dict:
    n_classes = len(class_names)
    labels = list(range(n_classes))
    y_pred = pipeline.predict(X_test)

    scores = {
        "accuracy": accuracy_score(y_test, y_pred),
        "balanced_accuracy": balanced_accuracy_score(y_test, y_pred),
        # weighted = averaged over classes, weighted by how common each class is
        "precision": precision_score(y_test, y_pred, average="weighted", zero_division=0),
        "recall": recall_score(y_test, y_pred, average="weighted", zero_division=0),
        "f1": f1_score(y_test, y_pred, average="weighted", zero_division=0),
        "roc_auc": None,
    }

    proba = None
    try:
        proba = pipeline.predict_proba(X_test)
    except (AttributeError, ValueError):
        pass  # this model can't give probabilities: curves are "not available"

    roc_data = pr_data = None
    if proba is not None:
        try:
            if n_classes == 2:
                scores["roc_auc"] = roc_auc_score(y_test, proba[:, 1])
            else:
                scores["roc_auc"] = roc_auc_score(
                    y_test, proba, multi_class="ovr", average="macro", labels=labels
                )
        except ValueError:
            pass  # e.g. a class is missing from the test set
        roc_data, pr_data = _build_curves(y_test, proba, class_names)

    matrix = confusion_matrix(y_test, y_pred, labels=labels)
    report = classification_report(
        y_test, y_pred, labels=labels, target_names=class_names,
        output_dict=True, zero_division=0,
    )

    return to_jsonable(
        {
            "scores": scores,
            "confusion_matrix": {"labels": class_names, "matrix": matrix},
            "classification_report": report,
            "roc_curve": roc_data,
            "pr_curve": pr_data,
        }
    )


def evaluate_regression(pipeline, X_test, y_test, random_state: int) -> dict:
    y_true = np.asarray(y_test, dtype=float)
    y_pred = np.asarray(pipeline.predict(X_test), dtype=float)
    residuals = y_true - y_pred
    mse = mean_squared_error(y_true, y_pred)

    scores = {
        "mae": mean_absolute_error(y_true, y_pred),
        "mse": mse,
        "rmse": math.sqrt(mse),
        "r2": r2_score(y_true, y_pred),
    }

    # A fixed-seed sample of points for scatter / residual plots (web and AR)
    k = min(len(y_true), MAX_SAMPLE_POINTS)
    idx = np.sort(np.random.default_rng(random_state).choice(len(y_true), size=k, replace=False))
    points = [
        {"actual": round(float(y_true[i]), 4), "predicted": round(float(y_pred[i]), 4)}
        for i in idx
    ]

    return to_jsonable(
        {
            "scores": scores,
            "residuals": {"mean": residuals.mean(), "std": residuals.std()},
            "predictions_sample": points,
        }
    )