from dataclasses import dataclass

import numpy as np
import pandas as pd
from pandas.api import types as ptypes
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import LabelEncoder

from app.ml.evaluation import evaluate_classification, evaluate_regression, to_jsonable
from app.ml.model_registry import get_model_spec
from app.ml.preprocessing import build_preprocessor, select_features

MAX_CLASSES = 50
MIN_USABLE_ROWS = 10


class TrainingError(Exception):
    """A problem the user can understand and fix."""


@dataclass
class TrainingOutcome:
    pipeline: object
    metrics: dict
    summary: dict


def _prepare_classification_target(y_raw: pd.Series):
    n_classes = int(y_raw.nunique())
    if n_classes < 2:
        raise TrainingError("The target has fewer than 2 classes after cleaning.")
    if n_classes > MAX_CLASSES:
        raise TrainingError(
            f"The target has {n_classes} distinct values. Classification supports up to "
            f"{MAX_CLASSES}; for a continuous target use a regression model."
        )
    if int(y_raw.value_counts().min()) < 2:
        raise TrainingError("Some classes have fewer than 2 rows, so the data can't be split fairly.")
    encoder = LabelEncoder()
    y = encoder.fit_transform(y_raw)
    return y, [str(c) for c in encoder.classes_]


def _prepare_regression_target(y_raw: pd.Series):
    if not ptypes.is_numeric_dtype(y_raw) or ptypes.is_bool_dtype(y_raw):
        raise TrainingError(
            "Regression needs a numeric target column; this one contains text or categories. "
            "Choose a classification model instead."
        )
    y = y_raw.to_numpy(dtype=float)
    if not np.isfinite(y).all():
        raise TrainingError("The target contains infinite values.")
    if int(y_raw.nunique()) < 2:
        raise TrainingError("The target has only one distinct value.")
    return y


def train_model(
    df: pd.DataFrame,
    target: str,
    model_key: str,
    params: dict,
    test_size: float,
    random_state: int,
) -> TrainingOutcome:
    spec = get_model_spec(model_key)
    is_classification = spec.task == "classification"
    if target not in df.columns:
        raise TrainingError(f"Target column '{target}' not found in the dataset.")

    # 1. Clean rows BEFORE splitting (duplicates in both halves would inflate scores)
    n_input = len(df)
    df = df.dropna(subset=[target])
    dropped_missing_target = n_input - len(df)
    before = len(df)
    df = df.drop_duplicates()
    dropped_duplicates = before - len(df)
    if len(df) < MIN_USABLE_ROWS:
        raise TrainingError(f"Fewer than {MIN_USABLE_ROWS} usable rows remain after cleaning.")

    # 2. Prepare the target for this kind of task
    class_names = None
    if is_classification:
        y, class_names = _prepare_classification_target(df[target])
    else:
        y = _prepare_regression_target(df[target])
    X = df.drop(columns=[target])

    # 3. SPLIT FIRST
    try:
        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=test_size, random_state=random_state,
            stratify=y if is_classification else None,
        )
    except ValueError:
        raise TrainingError(
            "Too few rows to split into training and test sets "
            "(for classification, every class also needs rows in both)."
        )
    if len(y_test) < 2:
        raise TrainingError("The test set would have fewer than 2 rows. Upload more data.")

    # 4. Everything below is learned from the TRAINING part only
    features, dropped_columns = select_features(X_train)
    if not features:
        raise TrainingError("No usable feature columns remain after removing unusable ones.")
    X_train, X_test = X_train[features], X_test[features]

    pipeline = Pipeline(
        [
            ("preprocess", build_preprocessor(X_train, scale=spec.needs_scaling)),
            ("model", spec.build(params, random_state)),
        ]
    )
    try:
        pipeline.fit(X_train, y_train)
    except Exception as exc:
        raise TrainingError(f"The model could not be trained: {str(exc)[:300]}")

    # 5. Evaluate on the untouched test part
    if is_classification:
        metrics = evaluate_classification(pipeline, X_test, y_test, class_names)
        metrics["scores"]["train_accuracy"] = float(pipeline.score(X_train, y_train))
    else:
        metrics = evaluate_regression(pipeline, X_test, y_test, random_state)
        metrics["scores"]["train_r2"] = float(pipeline.score(X_train, y_train))

    summary = {
        "task": spec.task,
        "n_rows_used": int(len(df)),
        "n_train": int(len(X_train)),
        "n_test": int(len(X_test)),
        "dropped_missing_target": int(dropped_missing_target),
        "dropped_duplicates": int(dropped_duplicates),
        "dropped_columns": dropped_columns,
        "features_used": features,
        "n_features_after_encoding": int(len(pipeline.named_steps["preprocess"].get_feature_names_out())),
        "class_names": class_names,
        "test_size": test_size,
        "random_state": random_state,
    }
    return TrainingOutcome(
        pipeline=pipeline, metrics=to_jsonable(metrics), summary=to_jsonable(summary)
    )