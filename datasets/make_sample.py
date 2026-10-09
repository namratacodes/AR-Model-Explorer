import numpy as np
import pandas as pd

rng = np.random.default_rng(42)
n = 300
df = pd.DataFrame(
    {
        "age": rng.integers(18, 70, n),
        "income": rng.normal(50000, 15000, n).round(2),
        "city": rng.choice(["Delhi", "Mumbai", "Pune"], n),
        "tenure_months": rng.integers(1, 60, n),
    }
)
df["churn"] = np.where((df["tenure_months"] < 20) | (rng.random(n) < 0.15), "yes", "no")
df.loc[rng.choice(n, 15, replace=False), "income"] = np.nan  # add missing values
df = pd.concat([df, df.head(5)])                              # add 5 duplicate rows
df.to_csv("datasets/sample_churn.csv", index=False)
print("Created datasets/sample_churn.csv with", len(df), "rows")