import math
from dataclasses import dataclass, field
from typing import Any

from sklearn.ensemble import RandomForestClassifier, RandomForestRegressor
from sklearn.linear_model import LinearRegression, LogisticRegression
from sklearn.naive_bayes import GaussianNB
from sklearn.neighbors import KNeighborsClassifier
from sklearn.svm import SVC
from sklearn.tree import DecisionTreeClassifier, DecisionTreeRegressor

try:
    from xgboost import XGBClassifier, XGBRegressor
except ImportError:  # optional dependency: the registry just leaves XGBoost out
    XGBClassifier = XGBRegressor = None


class ParamError(ValueError):
    """A hyperparameter the user supplied is not allowed."""


@dataclass(frozen=True)
class ParamSpec:
    type: str  # "int", "float" or "choice"
    default: Any
    min: float | None = None
    max: float | None = None
    choices: tuple | None = None
    nullable: bool = False
    description: str = ""

    def coerce(self, name: str, value: Any) -> Any:
        if value is None:
            if self.nullable:
                return None
            raise ParamError(f"'{name}' cannot be null.")

        if self.type == "choice":
            if value not in self.choices:
                raise ParamError(f"'{name}' must be one of: {', '.join(map(str, self.choices))}.")
            return value

        if isinstance(value, bool) or not isinstance(value, (int, float)):
            raise ParamError(f"'{name}' must be a number.")
        if isinstance(value, float) and not math.isfinite(value):
            raise ParamError(f"'{name}' must be a finite number.")

        if self.type == "int":
            if int(value) != value:
                raise ParamError(f"'{name}' must be a whole number.")
            value = int(value)
        else:
            value = float(value)

        if value < self.min or value > self.max:
            raise ParamError(f"'{name}' must be between {self.min} and {self.max}.")
        return value


@dataclass(frozen=True)
class ModelSpec:
    key: str
    label: str
    task: str  # "classification" for now
    estimator_class: type
    params: dict[str, ParamSpec]
    fixed_params: dict = field(default_factory=dict)
    needs_scaling: bool = False
    accepts_random_state: bool = True

    def resolve_params(self, user_params: dict | None) -> dict:
        """Validates user input against the whitelist and fills in defaults."""
        user_params = user_params or {}
        unknown = set(user_params) - set(self.params)
        if unknown:
            raise ParamError(
                f"Unknown parameter(s) for {self.label}: {', '.join(sorted(unknown))}."
            )
        return {
            name: spec.coerce(name, user_params.get(name, spec.default))
            for name, spec in self.params.items()
        }

    def build(self, user_params: dict | None, random_state: int):
        kwargs = {**self.fixed_params, **self.resolve_params(user_params)}
        if self.accepts_random_state:
            kwargs["random_state"] = random_state
        return self.estimator_class(**kwargs)

    def describe(self) -> dict:
        return {
            "key": self.key,
            "label": self.label,
            "task": self.task,
            "params": {
                name: {
                    "type": p.type,
                    "default": p.default,
                    "min": p.min,
                    "max": p.max,
                    "choices": list(p.choices) if p.choices else None,
                    "nullable": p.nullable,
                    "description": p.description,
                }
                for name, p in self.params.items()
            },
        }


_SPECS = [
    ModelSpec(
        key="logistic_regression",
        label="Logistic Regression",
        task="classification",
        estimator_class=LogisticRegression,
        needs_scaling=True,
        params={
            "C": ParamSpec("float", 1.0, 0.0001, 1000, description="Inverse regularization strength"),
            "max_iter": ParamSpec("int", 1000, 50, 5000, description="Maximum solver iterations"),
        },
    ),
    ModelSpec(
        key="decision_tree",
        label="Decision Tree",
        task="classification",
        estimator_class=DecisionTreeClassifier,
        params={
            "max_depth": ParamSpec("int", None, 1, 50, nullable=True, description="Tree depth limit (empty = unlimited)"),
            "min_samples_split": ParamSpec("int", 2, 2, 100, description="Min samples to split a node"),
            "min_samples_leaf": ParamSpec("int", 1, 1, 100, description="Min samples in a leaf"),
        },
    ),
    ModelSpec(
        key="random_forest",
        label="Random Forest",
        task="classification",
        estimator_class=RandomForestClassifier,
        params={
            "n_estimators": ParamSpec("int", 100, 10, 500, description="Number of trees"),
            "max_depth": ParamSpec("int", None, 1, 50, nullable=True, description="Tree depth limit (empty = unlimited)"),
            "min_samples_leaf": ParamSpec("int", 1, 1, 100, description="Min samples in a leaf"),
        },
    ),
    ModelSpec(
        key="knn",
        label="K-Nearest Neighbors",
        task="classification",
        estimator_class=KNeighborsClassifier,
        needs_scaling=True,
        accepts_random_state=False,
        params={
            "n_neighbors": ParamSpec("int", 5, 1, 50, description="Number of neighbors"),
            "weights": ParamSpec("choice", "uniform", choices=("uniform", "distance"), description="Neighbor weighting"),
        },
    ),
    ModelSpec(
        key="svm",
        label="Support Vector Machine",
        task="classification",
        estimator_class=SVC,
        needs_scaling=True,
        fixed_params={"probability": True},
        params={
            "C": ParamSpec("float", 1.0, 0.001, 1000, description="Regularization strength"),
            "kernel": ParamSpec("choice", "rbf", choices=("linear", "rbf", "poly"), description="Kernel type"),
        },
    ),
    ModelSpec(
        key="naive_bayes",
        label="Naive Bayes (Gaussian)",
        task="classification",
        estimator_class=GaussianNB,
        accepts_random_state=False,
        params={
            "var_smoothing": ParamSpec("float", 1e-9, 1e-12, 1e-3, description="Variance smoothing"),
        },
    ),
]
_TREE_DEPTH = ParamSpec(
    "int", None, 1, 50, nullable=True, description="Tree depth limit (empty = unlimited)"
)

_REGRESSION_SPECS = [
    ModelSpec(
        key="linear_regression",
        label="Linear Regression",
        task="regression",
        estimator_class=LinearRegression,
        needs_scaling=True,
        accepts_random_state=False,
        params={},
    ),
    ModelSpec(
        key="decision_tree_regressor",
        label="Decision Tree Regressor",
        task="regression",
        estimator_class=DecisionTreeRegressor,
        params={
            "max_depth": _TREE_DEPTH,
            "min_samples_split": ParamSpec("int", 2, 2, 100, description="Min samples to split a node"),
            "min_samples_leaf": ParamSpec("int", 1, 1, 100, description="Min samples in a leaf"),
        },
    ),
    ModelSpec(
        key="random_forest_regressor",
        label="Random Forest Regressor",
        task="regression",
        estimator_class=RandomForestRegressor,
        params={
            "n_estimators": ParamSpec("int", 100, 10, 500, description="Number of trees"),
            "max_depth": _TREE_DEPTH,
            "min_samples_leaf": ParamSpec("int", 1, 1, 100, description="Min samples in a leaf"),
        },
    ),
]

_XGBOOST_SPECS = []
if XGBClassifier is not None:
    _xgb_params = {
        "n_estimators": ParamSpec("int", 100, 10, 500, description="Number of boosting rounds"),
        "max_depth": ParamSpec("int", 6, 1, 12, description="Tree depth"),
        "learning_rate": ParamSpec("float", 0.1, 0.001, 1.0, description="Step size shrinkage"),
    }
    _XGBOOST_SPECS = [
        ModelSpec(
            key="xgboost_classifier",
            label="XGBoost Classifier",
            task="classification",
            estimator_class=XGBClassifier,
            params=_xgb_params,
            fixed_params={"verbosity": 0},
        ),
        ModelSpec(
            key="xgboost_regressor",
            label="XGBoost Regressor",
            task="regression",
            estimator_class=XGBRegressor,
            params=_xgb_params,
            fixed_params={"verbosity": 0},
        ),
    ]

REGISTRY: dict[str, ModelSpec] = {
    spec.key: spec for spec in [*_SPECS, *_REGRESSION_SPECS, *_XGBOOST_SPECS]
}


def get_model_spec(key: str) -> ModelSpec:
    """Raises KeyError for unknown models."""
    return REGISTRY[key]


def list_models(task: str | None = None) -> list[ModelSpec]:
    return [s for s in REGISTRY.values() if task is None or s.task == task]