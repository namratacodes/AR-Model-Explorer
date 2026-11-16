import logging
from collections import deque

import numpy as np

from app.ml.evaluation import to_jsonable
from app.ml.model_registry import get_model_spec
from app.services.storage import load_model_artifact

logger = logging.getLogger(__name__)

SCHEMA_VERSION = 1

MAX_AR_POINTS = 500
MAX_AR_CLASSES = 10
MAX_IMPORTANCE_ITEMS = 15
MAX_LOCAL_EXAMPLES = 5
MAX_LOCAL_FEATURES = 6
TREE_MAX_DEPTH = 4
TREE_MODELS = {"decision_tree", "decision_tree_regressor"}

# (key, label, format, description) per task. Shared with the comparison endpoint.
METRIC_CARDS = {
    "classification": [
        ("accuracy", "Accuracy", "percent", "Share of test rows predicted correctly"),
        ("precision", "Precision", "percent", "When it predicts a class, how often it is right"),
        ("recall", "Recall", "percent", "How many of the real cases of a class it finds"),
        ("f1", "F1 Score", "percent", "Balance between precision and recall"),
        ("roc_auc", "ROC-AUC", "number", "Ability to rank positives above negatives (1.0 is perfect)"),
        ("balanced_accuracy", "Balanced Accuracy", "percent", "Accuracy that treats every class equally"),
    ],
    "regression": [
        ("r2", "R²", "number", "Share of variation explained (1.0 is perfect)"),
        ("rmse", "RMSE", "number", "Typical prediction error, in the target's units"),
        ("mae", "MAE", "number", "Average absolute error, in the target's units"),
        ("mse", "MSE", "number", "Average squared error"),
    ],
    "clustering": [
        ("silhouette", "Silhouette", "number", "How well separated the clusters are (-1 to 1)"),
        ("n_clusters", "Clusters", "integer", "Number of clusters found"),
        ("davies_bouldin", "Davies-Bouldin", "number", "Cluster overlap (lower is better)"),
        ("noise_fraction", "Noise", "percent", "Share of points not placed in any cluster"),
    ],
    "dimensionality_reduction": [
        ("total_explained_variance", "Explained Variance", "percent", "Information kept by the components"),
        ("n_components", "Components", "integer", "Number of components kept"),
    ],
}
HEADLINE = {
    "classification": "accuracy",
    "regression": "r2",
    "clustering": "silhouette",
    "dimensionality_reduction": "total_explained_variance",
}
LOWER_IS_BETTER = {"mae", "mse", "rmse", "davies_bouldin", "noise_fraction"}
NO_BEST = {"n_clusters", "n_components"}  # "more" is not "better" for these


def model_label(key: str) -> str:
    try:
        return get_model_spec(key).label
    except KeyError:
        return key


def _display(value: float, fmt: str) -> str:
    if fmt == "percent":
        return f"{value * 100:.1f}%"
    if fmt == "integer":
        return str(int(value))
    return f"{value:.3f}"


def _metric_cards(task: str, scores: dict) -> list[dict]:
    cards = []
    for key, label, fmt, description in METRIC_CARDS.get(task, []):
        value = scores.get(key)
        if value is None:
            continue
        cards.append(
            {
                "key": key, "label": label, "value": value, "format": fmt,
                "display": _display(value, fmt), "description": description,
            }
        )
    return cards


def _confusion(cm: dict | None) -> dict | None:
    if not cm:
        return None
    labels = cm["labels"]
    matrix = np.asarray(cm["matrix"], dtype=float)
    row_totals = matrix.sum(axis=1)
    total = float(matrix.sum())

    keep = np.arange(len(labels))
    truncated = len(labels) > MAX_AR_CLASSES
    if truncated:  # keep the most common classes only
        keep = np.sort(np.argsort(-row_totals)[:MAX_AR_CLASSES])
    sub = matrix[np.ix_(keep, keep)]

    cells = []
    for a, i in enumerate(keep):
        for b, j in enumerate(keep):
            count = int(sub[a, b])
            cells.append(
                {
                    "actual": labels[i],
                    "predicted": labels[j],
                    "count": count,
                    "percent_of_total": round(count / total * 100, 2) if total else 0.0,
                    "percent_of_actual": round(count / row_totals[i] * 100, 2) if row_totals[i] else 0.0,
                    "correct": bool(i == j),
                }
            )
    return {
        "labels": [labels[i] for i in keep],
        "matrix": sub.astype(int).tolist(),
        "max_value": int(sub.max()),
        "total": int(total),
        "n_classes_total": len(labels),
        "truncated": truncated,
        "cells": cells,
    }


def _importance(explanations: dict | None) -> dict | None:
    gi = (explanations or {}).get("global_importance")
    if not gi:
        return None
    items = gi["items"][:MAX_IMPORTANCE_ITEMS]
    peak = max([abs(i["importance"]) for i in items] + [1e-12])
    return {
        "method": gi["method"],
        "n_features_total": len(gi["items"]),
        "items": [{**i, "bar": round(max(i["importance"], 0) / peak, 3)} for i in items],
    }


def _local(explanations: dict | None) -> dict | None:
    local = (explanations or {}).get("local_explanations")
    if not local:
        return None
    examples = []
    for ex in local["examples"][:MAX_LOCAL_EXAMPLES]:
        contribs = ex["contributions"][:MAX_LOCAL_FEATURES]
        peak = max([abs(c["contribution"]) for c in contribs] + [1e-12])
        examples.append(
            {
                **{k: ex.get(k) for k in ("test_row", "prediction", "actual", "predicted_probability", "correct")},
                "contributions": [
                    {
                        **c,
                        "sign": "+" if c["direction"] == "increases" else "-",
                        "bar": round(abs(c["contribution"]) / peak, 3),
                    }
                    for c in contribs
                ],
                "other_features_contribution": ex.get("other_features_contribution"),
            }
        )
    return {"method": local["method"], "value_scale": local["value_scale"], "examples": examples}


def _curves(metrics: dict) -> dict | None:
    roc, pr = metrics.get("roc_curve"), metrics.get("pr_curve")
    if not roc and not pr:
        return None
    return {"roc": roc, "pr": pr}


def _regression(metrics: dict) -> dict | None:
    points = metrics.get("predictions_sample")
    if not points:
        return None
    values = [p["actual"] for p in points] + [p["predicted"] for p in points]
    return {
        "predictions_sample": points,
        "residuals": metrics.get("residuals"),
        "axis_range": {"min": min(values), "max": max(values)},
    }


def _normalize_projection(projection: dict, profiles: list | None = None):
    """Thins the points and scales everything into [-1, 1], so Unity can place it directly."""
    points = projection["points"]
    if len(points) > MAX_AR_POINTS:
        step = len(points) / MAX_AR_POINTS
        points = [points[int(i * step)] for i in range(MAX_AR_POINTS)]

    centers = [p["center_3d"] for p in (profiles or []) if p.get("center_3d")]
    extent = max([abs(c[a]) for c in [*points, *centers] for a in "xyz"] + [1e-9])

    def scale(c):
        return {a: round(c[a] / extent, 4) for a in "xyz"}

    scaled_points = []
    for p in points:
        q = scale(p)
        if "cluster" in p:
            q["cluster"] = p["cluster"]
        scaled_points.append(q)
    scaled_profiles = [{**p, "center_3d": scale(p["center_3d"])} for p in (profiles or [])]
    return scaled_points, scaled_profiles, extent


def _clusters(metrics: dict) -> dict | None:
    distribution, projection = metrics.get("cluster_distribution"), metrics.get("projection")
    if not distribution or not projection:
        return None
    points, profiles, extent = _normalize_projection(projection, metrics.get("cluster_profiles"))
    return {
        "distribution": distribution,
        "profiles": profiles,
        "points": points,
        "scale_factor": round(extent, 6),
        "n_points_total": projection.get("n_points_total"),
        "explained_variance_ratio": projection.get("explained_variance_ratio"),
    }


def _pca(metrics: dict) -> dict | None:
    components, projection = metrics.get("components"), metrics.get("projection")
    if not components or not projection:
        return None
    points, _, extent = _normalize_projection(projection)
    return {
        "components": components,
        "points": points,
        "scale_factor": round(extent, 6),
        "explained_variance_ratio": projection.get("explained_variance_ratio"),
    }


def _extract_tree(pipeline, class_names: list[str] | None) -> dict:
    model = pipeline.named_steps["model"]
    tree = model.tree_
    names = [n.split("__", 1)[-1] for n in pipeline.named_steps["preprocess"].get_feature_names_out()]

    nodes = []
    queue = deque([(0, None, 0, None)])  # (node id, parent id, depth, branch)
    while queue:
        node, parent, depth, branch = queue.popleft()
        left, right = int(tree.children_left[node]), int(tree.children_right[node])
        is_leaf = left == -1
        cut = (not is_leaf) and depth >= TREE_MAX_DEPTH  # shown as a leaf, but really continues
        value = tree.value[node][0]

        record = {
            "id": node,
            "parent": parent,
            "depth": depth,
            "branch": branch,  # "yes" = the question below the parent was true
            "is_leaf": is_leaf or cut,
            "truncated": cut,
            "samples": int(tree.n_node_samples[node]),
            "impurity": round(float(tree.impurity[node]), 4),
        }
        if class_names is not None:
            total = value.sum()
            probs = value / total if total > 0 else value
            top = np.argsort(-probs)[:3]
            record["prediction"] = class_names[int(top[0])]
            record["class_distribution"] = [
                {"label": class_names[int(i)], "share": round(float(probs[i]), 3)} for i in top
            ]
        else:
            record["prediction"] = round(float(value[0]), 4)

        if not (is_leaf or cut):
            feature = names[int(tree.feature[node])]
            threshold = round(float(tree.threshold[node]), 4)
            record.update(
                {"feature": feature, "threshold": threshold, "question": f"{feature} ≤ {threshold}?"}
            )
            queue.append((left, node, depth + 1, "yes"))
            queue.append((right, node, depth + 1, "no"))
        nodes.append(record)

    return {
        "root_id": 0,
        "nodes": nodes,
        "max_depth_shown": TREE_MAX_DEPTH,
        "total_nodes": int(tree.node_count),
        "total_depth": int(model.get_depth()),
    }


def _decision_tree(run, class_names) -> dict | None:
    if run.model_type not in TREE_MODELS or not run.artifact_name:
        return None
    try:
        # Loaded only after the checksum recorded at training time is verified.
        pipeline = load_model_artifact(run.artifact_name, run.artifact_sha256)
        return _extract_tree(pipeline, class_names)
    except Exception:
        logger.exception("Could not extract the decision tree for run %s", run.id)
        return None


def build_ar_payload(project, dataset, run, explanations: dict | None) -> dict:
    metrics = run.metrics or {}
    summary = run.summary or {}
    task = run.task_type

    cards = _metric_cards(task, metrics.get("scores", {}))
    headline = next((c for c in cards if c["key"] == HEADLINE.get(task)), None)
    curves = _curves(metrics)

    sections = {
        "metrics": cards or None,
        "confusion_matrix": _confusion(metrics.get("confusion_matrix")),
        "feature_importance": _importance(explanations),
        "roc": curves["roc"] if curves else None,
        "pr": curves["pr"] if curves else None,
        "regression": _regression(metrics) if task == "regression" else None,
        "clusters": _clusters(metrics) if task == "clustering" else None,
        "pca": _pca(metrics) if task == "dimensionality_reduction" else None,
        "decision_tree": _decision_tree(run, summary.get("class_names")),
        "explanations": _local(explanations),
    }

    profile = dataset.profile or {}
    payload = {
        "schema_version": SCHEMA_VERSION,
        "project": {"id": project.id, "name": project.name, "description": project.description},
        "run": {
            "id": run.id,
            "trained_at": run.finished_at.isoformat() if run.finished_at else None,
            "duration_s": run.duration_s,
        },
        "model": {
            "key": run.model_type,
            "label": model_label(run.model_type),
            "task": task,
            "hyperparameters": run.hyperparameters,
        },
        "dataset": {
            "name": dataset.original_filename.rsplit(".", 1)[0],
            "rows": dataset.n_rows,
            "columns": dataset.n_cols,
            "target": dataset.target_column,
            "numeric_features": profile.get("numeric_features", [])[:30],
            "categorical_features": profile.get("categorical_features", [])[:30],
            "features_used": summary.get("features_used", [])[:30],
            "duplicate_rows": profile.get("duplicate_rows"),
            "missing_total": profile.get("missing_total"),
        },
        "headline": headline,
        "metrics": {"cards": cards},
        "confusion_matrix": sections["confusion_matrix"],
        "feature_importance": sections["feature_importance"],
        "curves": curves,
        "regression": sections["regression"],
        "clusters": sections["clusters"],
        "pca": sections["pca"],
        "decision_tree": sections["decision_tree"],
        "explanations": sections["explanations"],
        "available_views": [name for name, value in sections.items() if value],
    }
    return to_jsonable(payload)