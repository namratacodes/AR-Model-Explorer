import io
import json
from pathlib import Path

import pandas as pd
from pandas.api import types as ptypes

MIN_ROWS = 10
MIN_COLS = 2
MAX_COLS = 200
MAX_ROWS = 200_000
MAX_CLASSES = 50


class DatasetValidationError(Exception):
    """A problem with the data that the user can understand and fix."""


def _check_dataframe(df: pd.DataFrame) -> pd.DataFrame:
    df.columns = [str(c).strip() for c in df.columns]
    if df.columns.duplicated().any():
        raise DatasetValidationError("Some column names are duplicated. Please make them unique.")
    if df.shape[1] < MIN_COLS:
        raise DatasetValidationError(
            "The file has fewer than 2 columns. Check that it is comma-separated."
        )
    if df.shape[1] > MAX_COLS:
        raise DatasetValidationError(f"Too many columns (maximum is {MAX_COLS}).")
    if df.shape[0] < MIN_ROWS:
        raise DatasetValidationError(f"Too few rows (at least {MIN_ROWS} are required).")
    if df.shape[0] > MAX_ROWS:
        raise DatasetValidationError(f"Too many rows (maximum is {MAX_ROWS:,}).")
    return df


def read_csv_bytes(raw: bytes) -> pd.DataFrame:
    """Parse uploaded bytes into a validated DataFrame."""
    if not raw.strip():
        raise DatasetValidationError("The file is empty.")
    try:
        df = pd.read_csv(io.BytesIO(raw), encoding="utf-8-sig")
    except UnicodeDecodeError:
        raise DatasetValidationError("The file is not valid UTF-8 text. Re-save it as CSV (UTF-8).")
    except pd.errors.EmptyDataError:
        raise DatasetValidationError("The file contains no data.")
    except (pd.errors.ParserError, ValueError):
        raise DatasetValidationError("The file could not be read as a CSV.")
    return _check_dataframe(df)


def load_dataframe(path: Path, nrows: int | None = None) -> pd.DataFrame:
    """Load an already-validated file from disk."""
    df = pd.read_csv(path, encoding="utf-8-sig", nrows=nrows)
    df.columns = [str(c).strip() for c in df.columns]
    return df


def _kind(series: pd.Series) -> str:
    if ptypes.is_bool_dtype(series):
        return "categorical"
    if ptypes.is_numeric_dtype(series):
        return "numeric"
    return "categorical"


def profile_dataframe(df: pd.DataFrame) -> dict:
    n = len(df)
    columns = []
    for name in df.columns:
        s = df[name]
        kind = _kind(s)
        missing = int(s.isna().sum())
        unique = int(s.nunique(dropna=True))

        warnings = []
        if unique <= 1:
            warnings.append("Constant column (no information for a model).")
        if n and missing / n > 0.5:
            warnings.append("More than 50% of values are missing.")
        if kind == "categorical" and unique > 0.9 * n:
            warnings.append("Almost every value is unique (looks like an ID or free text).")
        if kind == "numeric" and ptypes.is_integer_dtype(s) and unique == n:
            warnings.append("Every value is unique (possible ID column).")

        columns.append(
            {
                "name": name,
                "kind": kind,
                "dtype": str(s.dtype),
                "missing": missing,
                "missing_pct": round(missing / n * 100, 2) if n else 0.0,
                "unique": unique,
                "warnings": warnings,
            }
        )

    return {
        "n_rows": n,
        "n_cols": int(df.shape[1]),
        "duplicate_rows": int(df.duplicated().sum()),
        "missing_total": int(df.isna().sum().sum()),
        "numeric_features": [c["name"] for c in columns if c["kind"] == "numeric"],
        "categorical_features": [c["name"] for c in columns if c["kind"] == "categorical"],
        "columns": columns,
    }


def analyze_target(df: pd.DataFrame, target: str) -> dict:
    """Describe what choosing this column as the target would mean.
    The task type is only a SUGGESTION; the user stays in control."""
    if target not in df.columns:
        raise DatasetValidationError(f"Column '{target}' does not exist in this dataset.")

    series = df[target]
    n_missing = int(series.isna().sum())
    series = series.dropna()
    if series.empty:
        raise DatasetValidationError("The target column has no values.")

    n_unique = int(series.nunique())
    if n_unique < 2:
        raise DatasetValidationError("The target has only one distinct value, so there is nothing to learn.")

    is_numeric = ptypes.is_numeric_dtype(series) and not ptypes.is_bool_dtype(series)
    suggested = "regression" if is_numeric and n_unique > 20 else "classification"

    warnings = []
    if n_missing:
        warnings.append(f"{n_missing} rows have no target value and will be dropped during training.")

    info = {
        "column": target,
        "suggested_task": suggested,
        "n_unique": n_unique,
        "missing": n_missing,
        "class_distribution": None,
        "warnings": warnings,
    }

    if suggested == "classification":
        counts = series.value_counts()
        total = int(counts.sum())
        info["class_distribution"] = [
            {"label": str(label), "count": int(c), "percent": round(c / total * 100, 2)}
            for label, c in counts.head(MAX_CLASSES).items()
        ]
        if n_unique > MAX_CLASSES:
            warnings.append(
                f"{n_unique} distinct values: this may not be a good classification target."
            )
        if counts.min() < 2:
            warnings.append("Some classes have fewer than 2 rows, so a stratified split is impossible.")
        if counts.max() / counts.min() >= 10:
            warnings.append("Classes are heavily imbalanced; accuracy alone may be misleading.")

    return info


def preview_records(df: pd.DataFrame) -> list[dict]:
    # to_json converts NaN to null and numpy numbers to plain numbers.
    return json.loads(df.to_json(orient="records"))