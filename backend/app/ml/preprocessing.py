import pandas as pd
from pandas.api import types as ptypes
from sklearn.compose import ColumnTransformer
from sklearn.impute import SimpleImputer
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler


def _is_numeric(series: pd.Series) -> bool:
    return ptypes.is_numeric_dtype(series) and not ptypes.is_bool_dtype(series)


def select_features(X: pd.DataFrame) -> tuple[list[str], list[dict]]:
    """Drops columns that can't help a model, and REPORTS every drop."""
    n = len(X)
    keep, dropped = [], []
    for col in X.columns:
        s = X[col]
        unique = int(s.nunique(dropna=True))
        if unique <= 1:
            dropped.append({"column": col, "reason": "constant or empty column"})
        elif not _is_numeric(s) and unique > 0.9 * n:
            dropped.append({"column": col, "reason": "looks like an ID or free text"})
        elif ptypes.is_integer_dtype(s) and n >= 30 and unique == n:
            dropped.append({"column": col, "reason": "every value is unique (possible ID)"})
        else:
            keep.append(col)
    return keep, dropped


def build_preprocessor(X: pd.DataFrame, scale: bool) -> ColumnTransformer:
    """Unfitted recipe. It is fitted later, on TRAINING data only."""
    numeric = [c for c in X.columns if _is_numeric(X[c])]
    categorical = [c for c in X.columns if c not in numeric]

    transformers = []
    if numeric:
        steps = [("imputer", SimpleImputer(strategy="median"))]
        if scale:
            steps.append(("scaler", StandardScaler()))
        transformers.append(("num", Pipeline(steps), numeric))
    if categorical:
        transformers.append(
            (
                "cat",
                Pipeline(
                    [
                        ("imputer", SimpleImputer(strategy="most_frequent")),
                        (
                            "onehot",
                            OneHotEncoder(
                                handle_unknown="infrequent_if_exist",
                                max_categories=20,
                                sparse_output=False,
                            ),
                        ),
                    ]
                ),
                categorical,
            )
        )
    return ColumnTransformer(transformers)