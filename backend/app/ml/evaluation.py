import math

import numpy as np
from sklearn.metrics import (
    accuracy_score,
    balanced_accuracy_score,
    classification_report,
    confusion_matrix,
    f1_score,
    precision_score,
    recall_score,
    roc_auc_score,
)


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

    try:
        proba = pipeline.predict_proba(X_test)
        if n_classes == 2:
            scores["roc_auc"] = roc_auc_score(y_test, proba[:, 1])
        else:
            scores["roc_auc"] = roc_auc_score(
                y_test, proba, multi_class="ovr", average="macro", labels=labels
            )
    except (ValueError, AttributeError):
        pass  # e.g. a class is missing from the test set: report "not available"

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
        }
    )