# backend/train_ranker.py
import numpy as np
import joblib
from sklearn.linear_model import LogisticRegression
from sklearn.calibration import CalibratedClassifierCV

np.random.seed(42)
rows = []

# 60 "culprit" evidence vectors (high spatial/drift/behavioral, LOW AIS reliability = dark vessel)
for _ in range(60):
    rows.append([
        np.random.uniform(70, 100),  # spatial
        np.random.uniform(75, 100),  # temporal
        np.random.uniform(70, 100),  # drift
        np.random.uniform(65, 100),  # behavioral
        np.random.uniform(10, 40),   # ais (low = AIS gap / dark vessel)
        1,
    ])

# 60 "innocent" evidence vectors
for _ in range(60):
    rows.append([
        np.random.uniform(0, 60),
        np.random.uniform(20, 95),
        np.random.uniform(0, 55),
        np.random.uniform(40, 60),
        np.random.uniform(70, 90),
        0,
    ])

data = np.array(rows)
X, y = data[:, :5], data[:, 5].astype(int)

# Logistic Regression + Platt scaling (sigmoid calibration) => true probabilities
model = CalibratedClassifierCV(LogisticRegression(max_iter=1000), method="sigmoid", cv=3)
model.fit(X, y)

joblib.dump({"model": model, "features": ["spatial", "temporal", "drift", "behavioral", "ais"]}, "ranker_model.pkl")
print("✅ ranker_model.pkl saved")

# Sanity checks
print("Culprit-like vector prob:", round(model.predict_proba([[94, 90, 100, 80, 30]])[0][1], 3))
print("Innocent-like vector prob:", round(model.predict_proba([[23, 90, 33, 50, 80]])[0][1], 3))
