import numpy as np
import pandas as pd

rng = np.random.default_rng(11)

# (income in thousands, spending score, age, visits per month, how many customers)
segments = [
    (25, 80, 24, 14, 200),
    (85, 30, 48, 4, 150),
    (60, 65, 36, 9, 100),
]

parts = []
for income, spend, age, visits, count in segments:
    parts.append(
        pd.DataFrame(
            {
                "annual_income_k": rng.normal(income, 6, count).round(1),
                "spending_score": np.clip(rng.normal(spend, 8, count), 1, 100).round(0),
                "age": np.clip(rng.normal(age, 4, count), 18, 80).round(0),
                "visits_per_month": np.clip(rng.normal(visits, 1.5, count), 0, None).round(0),
            }
        )
    )

df = pd.concat(parts, ignore_index=True).sample(frac=1, random_state=11)
df.to_csv("datasets/sample_customers.csv", index=False)
print("Created datasets/sample_customers.csv with", len(df), "rows")