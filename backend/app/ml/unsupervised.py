import numpy as np
import pandas as pd
from pandas.api import types as ptypes
from sklearn.decomposition import PCA
from sklearn.metrics import davies_bouldin_score, silhouette_score

from app.ml.evaluation import to_jsonable
from app.ml.model_registry import get_model_spec
from app.ml.preprocessing import build_preprocessor, select_features
from app.ml.training import TrainingError, TrainingOutcome

MAX_CLUSTER_ROWS = 50_000        # DBSCAN memory grows fast with rows
MIN_USABLE_ROWS = 10
MAX_PROJECTION_POINTS = 800      # points sent to the web/AR views
MAX_PROFILE_FEATURES = 12


def _clean_name(name: str) -> str:
    """'num__age' -> 'age', 'cat__city_Delhi' -> 'city_Delhi'."""
    return name.split("__", 1)[-1]


def _pad3(coords: np.ndarray) -> np.ndarray:
    coords = coords[:, :3]
    if coords.shape[1] < 3:
        coords = np.hstack([coords, np.zeros((len(coords), 3 - coords.shape[1]))])
    return coords


def _project_3d(Z: np.ndarray, random_state: int):
    k = min(3, Z.shape[0], Z.shape[1])
    pca = PCA(n_components=k, random_state=random_state).fit(Z)
    return _pad3(pca.transform(Z)), [float(r) for r in pca.explained_variance_ratio_]


def _projection(coords, ratios, labels, random_state) -> dict:
    n = len(coords)
    k = min(n, MAX_PROJECTION_POINTS)
    idx = np.sort(np.random.default_rng(random_state).choice(n, size=k, replace=False))
    points = []
    for i in idx:
        point = {
            "x": round(float(coords[i, 0]), 4),
            "y": round(float(coords[i, 1]), 4),
            "z": round(float(coords[i, 2]), 4),
        }
        if labels is not None:
            point["cluster"] = int(labels[i])
        points.append(point)
    return {"explained_variance_ratio": ratios, "n_points_total": int(n), "points": points}


def _clustering_metrics(Z, labels, model, X, features, coords, ratios, random_state) -> dict:
    total = len(labels)
    in_cluster = labels != -1  # DBSCAN marks noise points as -1
    cluster_ids = sorted(int(c) for c in set(labels))
    real_ids = [c for c in cluster_ids if c != -1]
    n_noise = int((~in_cluster).sum())

    scores = {
        "n_clusters": len(real_ids),
        "n_noise": n_noise,
        "noise_fraction": n_noise / total,
        "silhouette": None,
        "davies_bouldin": None,
        "inertia": float(model.inertia_) if hasattr(model, "inertia_") else None,
    }
    if len(real_ids) >= 2 and int(in_cluster.sum()) > len(real_ids):
        try:
            scores["silhouette"] = silhouette_score(
                Z[in_cluster], labels[in_cluster],
                sample_size=min(int(in_cluster.sum()), 5000), random_state=random_state,
            )
            scores["davies_bouldin"] = davies_bouldin_score(Z[in_cluster], labels[in_cluster])
        except ValueError:
            pass  # not enough variety to score: report "not available"

    numeric_cols = [
        c for c in features
        if ptypes.is_numeric_dtype(X[c]) and not ptypes.is_bool_dtype(X[c])
    ][:MAX_PROFILE_FEATURES]
    X_num = X[numeric_cols].reset_index(drop=True)

    distribution, profiles = [], []
    for cid in cluster_ids:
        mask = labels == cid
        size = int(mask.sum())
        name = "Noise" if cid == -1 else f"Cluster {cid}"
        percent = round(size / total * 100, 2)
        center = coords[mask].mean(axis=0)
        distribution.append({"cluster": cid, "label": name, "size": size, "percent": percent})
        profiles.append(
            {
                "cluster": cid,
                "label": name,
                "size": size,
                "percent": percent,
                "numeric_means": {c: round(float(v), 3) for c, v in X_num[mask].mean().items()},
                "center_3d": {"x": float(center[0]), "y": float(center[1]), "z": float(center[2])},
            }
        )

    return {
        "scores": scores,
        "cluster_distribution": distribution,
        "cluster_profiles": profiles,
        "projection": _projection(coords, ratios, labels, random_state),
    }


def _pca_metrics(model, preprocessor, coords, random_state) -> dict:
    names = [_clean_name(n) for n in preprocessor.get_feature_names_out()]
    ratios = model.explained_variance_ratio_
    cumulative = np.cumsum(ratios)

    components = []
    for i, loadings in enumerate(model.components_):
        top = np.argsort(-np.abs(loadings))[:5]
        components.append(
            {
                "component": i + 1,
                "explained_variance_ratio": float(ratios[i]),
                "cumulative": float(cumulative[i]),
                "top_features": [
                    {"feature": names[j], "loading": round(float(loadings[j]), 4)} for j in top
                ],
            }
        )
    return {
        "scores": {
            "n_components": int(model.n_components_),
            "total_explained_variance": float(cumulative[-1]),
        },
        "components": components,
        "projection": _projection(coords, [float(r) for r in ratios[:3]], None, random_state),
    }


def train_unsupervised(
    df: pd.DataFrame, target: str | None, model_key: str, params: dict, random_state: int
) -> TrainingOutcome:
    spec = get_model_spec(model_key)
    if len(df) > MAX_CLUSTER_ROWS:
        raise TrainingError(
            f"Too many rows for this model ({len(df):,}). The limit is {MAX_CLUSTER_ROWS:,}."
        )

    excluded_target = None
    if target and target in df.columns:
        df = df.drop(columns=[target])  # clustering must not see the label
        excluded_target = target
    if len(df) < MIN_USABLE_ROWS:
        raise TrainingError(f"At least {MIN_USABLE_ROWS} rows are required.")

    features, dropped_columns = select_features(df)
    if not features:
        raise TrainingError("No usable feature columns remain after removing unusable ones.")
    X = df[features]

    # Distance-based methods need scaled features, so scaling is always on here.
    preprocessor = build_preprocessor(X, scale=True)
    try:
        Z = np.asarray(preprocessor.fit_transform(X), dtype=float)
    except Exception as exc:
        raise TrainingError(f"The data could not be prepared: {str(exc)[:300]}")

    model = spec.build(params, random_state)
    if spec.task == "dimensionality_reduction" and model.n_components > min(Z.shape):
        raise TrainingError(
            f"n_components={model.n_components} is larger than the available "
            f"dimensions ({min(Z.shape)})."
        )

    try:
        if spec.task == "clustering":
            labels = model.fit_predict(Z)
        else:
            model.fit(Z)
    except Exception as exc:
        raise TrainingError(f"The model could not be trained: {str(exc)[:300]}")

    if spec.task == "clustering":
        coords, ratios = _project_3d(Z, random_state)
        metrics = _clustering_metrics(Z, labels, model, X, features, coords, ratios, random_state)
    else:
        coords = _pad3(model.transform(Z))
        metrics = _pca_metrics(model, preprocessor, coords, random_state)

    summary = {
        "task": spec.task,
        "n_rows_used": int(len(df)),
        "dropped_columns": dropped_columns,
        "features_used": features,
        "n_features_after_encoding": int(Z.shape[1]),
        "excluded_target": excluded_target,
        "random_state": random_state,
        "note": "Unsupervised model: no train/test split; metrics describe the fitted data.",
    }
    return TrainingOutcome(
        pipeline={"preprocess": preprocessor, "model": model},
        metrics=to_jsonable(metrics),
        summary=to_jsonable(summary),
    )