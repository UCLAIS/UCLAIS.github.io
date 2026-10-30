---
title: Intro to Machine Learning
type: tutorial
series: Machine Learning Tutorial Series
order: 1
topics: [machine-learning, supervised-learning, linear-regression, least-squares, gradient-descent, numpy]
attribution: UCL AI Society
archived: true
status: published
---

# Intro to Machine Learning

Session 1 of 7

## What is Machine Learning? (slide 2)

**Key idea:** Instead of writing rules, show examples and let the model find the rules.

- **Data + Model:** A systematic way to measure and improve predictions.
- **Data-Driven Logic:** Programs learn patterns from examples instead of explicit code.
- **No Hand-Written Rules:** Complex problems evade rigid if-else programming structures.
- **Classic Application:** Email spam filters trained on thousands of labelled messages.

## Types of Learning (slides 3–5)

- **Supervised:** Predict target outcomes using labelled historical examples.
- **Unsupervised:** Discover hidden structures in data without explicit labels.
- **Reinforcement:** Learn optimal actions via trial, error, and reward signals.

Most of this tutorial series focuses on supervised learning: predicting y from x.

## Supervised Learning (slide 6)

- **Data:** Collect and clean raw information.
- **Features:** Choose inputs (x) and labels (y).
- **Model:** Pick architecture and loss function.
- **Train:** Evaluate parameters on unseen data.
- **Test:** Compare results against test data, diagnose overfitting

**Correction:** The “Train” caption should refer to fitting training data. Unseen data belongs to testing, as slide 7 explains.

## Generalisation (slide 7)

**Train Split**

Fit the parameters.

Model learns patterns directly from this specific dataset.

**Test Split**

Judge the performance.

Unseen data used strictly to verify real-world accuracy.

## Linear Regression (slides 8–12)

**Basic Idea:** How can a machine create a line of best fit for any given graph?

## Predict a Number (slide 13)

Output is continuous (e.g. house price).

**One feature:** `ŷ = wx + b`

**Weights and Intercept:** Learn the slope (w) and baseline (b).

**Multiple Features:** Expand to many input variables.

**Many features:** `ŷ = w₁x₁ + w₂x₂ + … + w_d x_d + b = wᵀx + b`

## Least Squares (slide 14)

**Residuals:** The difference between the actual value and the prediction.

`eᵢ = yᵢ − ŷᵢ`

**Squared Error:** Squaring stops negative/positive signs from cancelling out and amplifies large error.

`L(w,b) = (1 / (2n)) Σᵢ₌₁ⁿ (yᵢ − ŷᵢ)²`

## Solving It (slides 15–18)

**Method 1: Finding the minimum directly**

**Normal Equations**

Exact closed-form mathematical solution in a single step.

Gets very slow with millions of features.

`w = (XᵀX)⁻¹Xᵀy`

**Method 2: Using Gradient Descent**

**Key idea:** The loss function is a bowl. Gradient descent rolls to the bottom.

Repeatedly step downhill opposite to the gradient.

Scales efficiently to massive datasets.

`w ← w − η ∂L/∂w`, `b ← b − η ∂L/∂b`

From [GeeksforGeeks](https://www.geeksforgeeks.org/machine-learning/what-is-gradient-descent/) and [Data Science Wizards](https://medium.com/@datasciencewizards/a-simple-guide-to-gradient-descent-algorithm-60cbb66a0df9) (slide 17).

**Note:** The inverse requires `XᵀX` to be invertible. Slide 18's non-convex illustration is not the shape of this linear least-squares loss.

## Where do we stop? (slide 19)

**Gradient Descent**

Repeatedly step downhill opposite to the gradient.

Scales efficiently to massive datasets.

Where do we stop?

## Session 1: Linear Regression - Hands-on Exercises (notebook cell 1)

[Answers notebook](https://uclai.co.uk/materials/tutorials/machine-learning/tutorial-1-linear-regression-answers.ipynb)
## Notebook setup (notebook cell 2)

```python
import numpy as np
import matplotlib.pyplot as plt

rng = np.random.default_rng(22)
plt.rcParams.update({"figure.figsize": (6, 4), "axes.grid": True, "grid.alpha": 0.3})
```

## 1. Generate data and split it (notebook cell 3)

We create data from a known rule, `y = 2x + 1 + noise`, so we can check whether the model recovers it.
Then we split into a **train** set (fit the parameters) and a **test** set (judge the performance).

## Solution code (notebook cell 4)

```python
n = 50
w_true, b_true = 2.0, 1.0
# choosing random x values between 0, 10
x = rng.uniform(0, 10, n)
print(x)
# making the line
y = w_true * x + b_true + rng.normal(0, 1.5, n) # adding some noise (gotta make life annoying for ourselves)
# using the first 40 values as training, last 40-50 as the testing data 
idx = rng.permutation(n)
train, test = idx[:40], idx[40:]
x_tr, y_tr = x[train], y[train]
x_te, y_te = x[test],  y[test]

#plotting it
plt.scatter(x_tr, y_tr, label="train")
plt.scatter(x_te, y_te, color="orange", label="test")
plt.xlabel("Feature (x)"); plt.ylabel("Target (y)"); plt.legend(); plt.show()
```

## 2. Predict a number: guess a line (notebook cell 5)

The model is `ŷ = wx + b`, where `w` is the slope and `b` is the baseline (intercept).

**Exercise 2.** Change `w` and `b` below until the line looks like a good fit by eye.
Try the flat line `w = 0, b = 10` from the slides first.

## Solution code (notebook cell 6)

```python
def predict(x, w, b):
    return w*x + b

w, b = 10, 10 # try change these around and find the best parameters by hand

xs = np.linspace(0, 10, 100)
plt.scatter(x_tr, y_tr)
plt.plot(xs, predict(xs, w, b), "r")
plt.xlabel("Feature (x)"); plt.ylabel("Target (y)"); plt.title(f"w={w}, b={b}"); plt.show()
```

## 3. Least squares loss (notebook cell 7)

The **residual** is the actual value minus the prediction: `eᵢ = yᵢ − ŷᵢ`.
Squaring stops positive and negative errors cancelling, and we average them:

`L(w,b) = (1 / (2n)) Σᵢ₌₁ⁿ (yᵢ − ŷᵢ)²`

## Solution code (notebook cell 8)

```python
def loss(w, b, x, y):
    residuals = y - predict(x,w,b)
    return np.mean(residuals ** 2) / 2

for (w_, b_) in [(0, 10), (1, 0), (2, 1), (3, 5)]:
    print(f"w={w_}, b={b_}:  loss = {loss(w_, b_, x_tr, y_tr):.2f}")
```

## Exercise 3 (notebook cell 9)

Which guess has the lowest loss? Does it match what you saw by eye in Section 2?

Now look at the loss for *every* pair `(w,b)`. It forms a **bowl**, and the lowest point is the best line.

## Solution code (notebook cell 10)

```python
W, B = np.meshgrid(np.linspace(-1, 5, 200), np.linspace(-5, 8, 200))
Z = np.array([[loss(wi, bi, x_tr, y_tr) for wi in W[0]] for bi in B[:, 0]])

plt.contourf(W, B, Z, levels=30, cmap="viridis")
plt.colorbar(label="Loss")
plt.xlabel("w"); plt.ylabel("b"); plt.title("The loss is a bowl"); plt.show()
```

## 4. Method 1: find the minimum directly (normal equations) (notebook cell 11)

Set the gradient to zero. In matrix form, with `X` = a column of `x` values plus a column of ones:

`∇w L = 0 ⇒ w = (XᵀX)⁻¹Xᵀy`

Here `w` holds both the slope and the intercept.

## Solution code (notebook cell 12)

```python
X_tr = np.column_stack([x_tr, np.ones_like(x_tr)])
# linalg.solve solves for w in the form aw = b
theta = np.linalg.solve(X_tr.T @ X_tr, X_tr.T @ y_tr)
w_ne, b_ne = theta
print(f"Normal equations:  w = {w_ne:.4f}, b = {b_ne:.4f}   (truth: w=2, b=1)")
```

## Exercise 4 (notebook cell 13)

Re-run Sections 1 and 4 with `n = 10`, then `n = 500`. How close do `w` and `b` get to the truth, and why?

## 5. Method 2: gradient descent (notebook cell 14)

Instead of solving in one step, repeatedly step downhill:

`w ← w − η ∂L/∂w`, `b ← b − η ∂L/∂b`

with

`∂L/∂w = −(2/n) Σ xᵢ(yᵢ − ŷᵢ)`, `∂L/∂b = −(2/n) Σ (yᵢ − ŷᵢ)`

`η` (eta) is the **learning rate**. We stop when the loss barely changes (`tol`) or after `max_iter` steps.

## Solution code (notebook cell 15)

```python
def gradient_descent(x, y, eta=0.01, max_iter=5000, tol=1e-9, w0=0.0, b0=0.0):
    w, b = w0, b0
    n = len(x)
    history = [(w, b, loss(w, b, x, y))]
    for k in range(max_iter):
        e = y - predict(x, w, b)# residuals
        dw = -(2 / n) * np.sum(x * e)
        db = -(2 / n) * np.sum(e)
        w, b = w - eta * dw, b - eta * db      # step downhill
        history.append((w, b, loss(w, b, x, y)))
        if abs(history[-2][2] - history[-1][2]) < tol:   # cutoff: loss stopped improving
            break
    return w, b, np.array(history)

w_gd, b_gd, hist = gradient_descent(x_tr, y_tr, eta=0.01)
print(f"Stopped after {len(hist)-1} steps")
print(f"Gradient descent:  w = {w_gd:.4f}, b = {b_gd:.4f}")
print(f"Normal equations:  w = {w_ne:.4f}, b = {b_ne:.4f}")
```

## Exercise 5 (notebook cell 16)

Change `tol` to `1e-3`, then `1e-12`. How many steps does it take each time, and how far from the normal-equation answer do you end up? This is the trade-off in choosing a cutoff: a loose cutoff stops early with a mostly right answer.

## 6. The learning rate (notebook cell 17)

Too small and it crawls; too large and it overshoots. Compare four values of `η`.

## Solution code (notebook cell 18)

```python
fig, ax = plt.subplots(figsize=(7, 4))
for eta in [0.001, 0.01, 0.025, 0.035]:
    _, _, h = gradient_descent(x_tr, y_tr, eta=eta, max_iter=100, tol=0)
    ax.plot(h[:, 2], label=f"eta = {eta}")
ax.set_yscale("log"); ax.set_xlabel("Iteration"); ax.set_ylabel("Loss (log scale)")
ax.legend(); plt.show()
```

## Exercise 6 (notebook cell 19)

Which values converge (work)?

## Solution to Exercise 6 (notebook cell 19)

all but red (they settle at a low value whereas red increases with iterations)

## Publication notes

**Notebook correction:** Section 5 uses twice the gradient of the stated half mean squared error. The matching gradients are `dw = -np.mean(x * e)` and `db = -np.mean(e)`, where `e = y - predict(x, w, b)`. Original code and equations are preserved.

Saved notebook outputs are omitted, including the plot colours referenced in Exercise 6. Slide diagrams are not reproduced here; slide and notebook references identify the source material.

For unanswered questions or corrections, email [info@uclai.co.uk](mailto:info@uclai.co.uk). AI answers may be incorrect; check the sources.
