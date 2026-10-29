---
title: "Session 1: Intro to Machine Learning and Linear Regression"
type: tutorial
series: Machine Learning Tutorial Series
order: 1
topics: [machine-learning, supervised-learning, linear-regression, least-squares, gradient-descent, numpy]
attribution: "UCL AI Society; supplied tutorial slides and notebook (authors not named in the slide text or notebook cells)."
archived: true
status: published
---

# Session 1: Intro to Machine Learning and Linear Regression

Session 1 of the seven-session Machine Learning Tutorial Series. These notes cover slides 1–19 of `Tutorial1.pptx`, followed by the 19 ordered cells of `Tutorial1NotebookAnswers.ipynb`. The source files do not state an academic year or session date.

[Download the answers notebook](https://uclai.co.uk/materials/tutorials/machine-learning/tutorial-1-linear-regression-answers.ipynb). Saved outputs and execution counts have been removed. The notebook was not run during publication; its teaching code is unchanged.

The slide illustrations are described in words here. Their source links are retained where the deck supplies them. Third-party images, animations and speaker notes are not reproduced, and the original PowerPoint is not offered as a download in this publication.

## What is machine learning? (slides 1–2)

Instead of writing a rule for every case, supply examples and fit a model to learn patterns. Data and a model provide a way to measure and improve predictions. A spam filter trained on labelled messages is the deck's example.

## Types of learning (slides 3–5)

- **Supervised learning:** use labelled input–target examples to learn a mapping from `x` to `y`.
- **Unsupervised learning:** find structure in input data without supplied target labels.
- **Reinforcement learning:** learn actions through interaction and reward signals.

Slide 4 contrasts clustering unlabelled points with learning a boundary between labelled classes. Slide 5 contrasts recognising a labelled cat with discovering that two unlabelled examples are similar. Most of the series focuses on supervised learning.

## A supervised learning workflow (slide 6)

Collect and clean data, choose features and targets, select a model and loss, fit the model, then assess performance on held-out data.

**Editorial clarification:** the caption under “Train” on slide 6 mentions unseen data. Fitting uses training data; evaluation on held-out data is the testing step, as distinguished on slide 7 and in the notebook.

## Generalisation and dataset splits (slide 7)

The training split is used to fit parameters. The test split is held out to assess performance on unseen examples. The slide's diagram also includes validation data, with illustrative train/validation/test proportions of 80/10/10, 70/15/15 and 60/20/20. These are examples rather than a required split.

## Linear regression: fitting a line (slides 8–12)

The aim is to predict a continuous number by fitting a line to input–target pairs. Slides 9–11 show the same upward-trending scatter plot: first the data, then a flat prediction at 10, then a sloping fitted line. The question is how to choose a line that fits the observations.

## Predictions, weights and intercepts (slide 13)

For one feature, the prediction is `ŷ = wx + b`. The weight `w` controls the slope and the intercept `b` controls the baseline. With several features, `ŷ = w₁x₁ + w₂x₂ + … + w_d x_d + b = wᵀx + b`.

## Least squares and residuals (slide 14)

A residual is `eᵢ = yᵢ − ŷᵢ`, the observed value minus its prediction. Squaring prevents positive and negative residuals from cancelling and gives large errors more weight. The slide and notebook define the loss as half the mean squared residual:

`L(w,b) = (1 / (2n)) Σᵢ₌₁ⁿ (yᵢ − ŷᵢ)²`.

## Two approaches to fitting parameters (slides 15–18)

The normal-equation approach finds a least-squares solution directly. The deck writes `w = (XᵀX)⁻¹Xᵀy`; in the notebook the parameter vector includes both slope and intercept. The notebook uses `np.linalg.solve` rather than explicitly computing an inverse.

Gradient descent instead repeatedly moves parameters opposite to the gradient: `w ← w − η ∂L/∂w` and `b ← b − η ∂L/∂b`. The learning rate `η` sets the step size. For this linear least-squares problem, the loss is convex, which motivates the bowl analogy on slide 16.

**Editorial qualifications:** the inverse formula requires `XᵀX` to be invertible. The slide 18 surface is a generic non-convex illustration; it should not be taken as the shape of this linear least-squares loss. Claims on slide 18 about a single-step solution and scaling describe the two approaches broadly, rather than guaranteeing numerical stability or convergence for every dataset.

Slide 17 credits its gradient-descent illustrations to [GeeksforGeeks](https://www.geeksforgeeks.org/machine-learning/what-is-gradient-descent/) and [Data Science Wizards on Medium](https://medium.com/@datasciencewizards/a-simple-guide-to-gradient-descent-algorithm-60cbb66a0df9). Those links are attributions supplied by the deck; their bodies are not imported here.

## When to stop (slide 19)

The slide shows training cost decreasing and flattening over successive iterations, then asks where to stop. The notebook explores a loss-change tolerance, a maximum iteration count and several learning rates.

## Notebook consistency note

The supplied notebook defines half mean squared error, but its section 5 formula and code use twice the gradient of that loss. For `e = y - predict(x, w, b)`, the matching gradients are `dw = -np.mean(x * e)` and `db = -np.mean(e)`. The original implementation below uses `-(2 / n) * sum(...)`, equivalent to doubling the learning rate for the stated loss. Its code is preserved as supplied, with this correction made explicit rather than silently changing the exercise.

All notebook cells follow in their original order. Markdown headings and equation typography are normalised for this reading page, code is preserved, and exercise prompts are separate from solution code. The final supplied answer refers to a red curve in removed plot output; that colour-based claim has not been revalidated.

## Notebook overview (notebook cell 1)

Source notebook title: “Session 1: Linear Regression - Hands-on Exercises”.



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

`∂L/∂w = −(2/n) Σ xᵢ(yᵢ − ŷᵢ)`, `∂L/∂b = −(2/n) Σ (yᵢ − ŷᵢ)` (the supplied formula; see the consistency note above)

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

Supplied answer: all but red (they settle at a low value whereas red increases with iterations)

This refers to the saved plot colours. The plots have been removed and this answer was not revalidated during publication.
