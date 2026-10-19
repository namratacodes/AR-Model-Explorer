import numpy as np
import pandas as pd

rng = np.random.default_rng(7)
n = 500
df = pd.DataFrame(
    {
        "area_sqft": rng.integers(500, 3500, n),
        "bedrooms": rng.integers(1, 6, n),
        "age_years": rng.integers(0, 50, n),
        "city": rng.choice(["Delhi", "Mumbai", "Pune"], n),
    }
)
city_bonus = df["city"].map({"Delhi": 20000, "Mumbai": 60000, "Pune": 0})
df["price"] = (
    df["area_sqft"] * 120 + df["bedrooms"] * 8000 - df["age_years"] * 900
    + city_bonus + rng.normal(0, 15000, n)
).round(2)
df.to_csv("datasets/sample_houses.csv", index=False)
print("Created datasets/sample_houses.csv with", len(df), "rows")