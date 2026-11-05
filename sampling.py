"""Shared, reproducible finite-population sampling calculations."""
import numpy as np
import pandas as pd


def true_mean(df):
    return float(df['wait_time'].mean())


def allocation(df, n, group):
    sizes = df.groupby(group, sort=True, observed=True).size()
    if n < len(sizes):
        raise ValueError(f'n must be at least {len(sizes)} to include every stratum.')
    if n > len(df):
        raise ValueError('n cannot exceed population size.')
    alloc = pd.Series(1, index=sizes.index, dtype=int)
    remaining = n - len(sizes)
    # Largest remainder on residual capacity, ensuring each stratum receives at least one.
    # Iterative quota redistribution if a stratum fills its capacity.
    while remaining:
        capacity = sizes - alloc
        active = capacity[capacity > 0]
        if active.empty:
            raise ValueError('Insufficient population capacity')
        quota = remaining * sizes.loc[active.index] / sizes.loc[active.index].sum()
        floors = np.minimum(np.floor(quota).astype(int), active)
        if int(floors.sum()):
            alloc.loc[floors.index] += floors
            remaining -= int(floors.sum())
        else:
            fractional = (quota - np.floor(quota)).sort_values(ascending=False, kind='stable')
            for key in fractional.index:
                if remaining == 0:
                    break
                if alloc[key] < sizes[key]:
                    alloc[key] += 1
                    remaining -= 1
    return alloc


def systematic_indices(N, n, rng, start=None):
    if not 1 <= n <= N:
        raise ValueError('Sample size must be between 1 and N')
    k = N / n
    if N % n == 0:
        r = int(rng.integers(1, int(k) + 1)) if start is None else int(start)
        return np.arange(r - 1, N, int(k), dtype=int)[:n]
    u = float(rng.uniform(0, k)) if start is None else float(start)
    if u <= 0:
        u = np.nextafter(0.0, 1.0)
    # Compute in float64, clamp rounding near N and 0.
    vals = u + np.arange(n, dtype=float) * k
    indices = np.ceil(np.nextafter(vals, -np.inf)).astype(int) - 1
    indices = np.clip(indices, 0, N - 1)
    if len(np.unique(indices)) != n:
        raise ArithmeticError('Fractional systematic selection produced duplicates')
    return indices


def draw(df, method, n, rng, group='visit_type', start=None):
    N = len(df)
    if not 1 <= n <= N:
        raise ValueError('n must be between 1 and N')
    if method == 'Simple random':
        idx = rng.choice(N, size=n, replace=False)
        estimate = float(df.iloc[idx]['wait_time'].mean())
    elif method == 'Systematic':
        idx = systematic_indices(N, n, rng, start)
        estimate = float(df.iloc[idx]['wait_time'].mean())
    elif method == 'Stratified':
        alloc = allocation(df, n, group)
        idx_parts = []
        estimate = 0.0
        for key, nh in alloc.items():
            positions = np.flatnonzero(df[group].to_numpy() == key)
            picked = rng.choice(positions, size=int(nh), replace=False)
            idx_parts.append(picked)
            estimate += len(positions) / N * float(df.iloc[picked]['wait_time'].mean())
        idx = np.concatenate(idx_parts)
    else:
        raise ValueError('Unknown sampling method')
    return np.asarray(idx, dtype=int), estimate


def repeat(df, method, n, seed, repetitions=1000, group='visit_type'):
    N = len(df)
    truth = true_mean(df)
    if method == 'Systematic' and N % n == 0:
        k = N // n
        estimates = np.array([draw(df, method, n, np.random.default_rng(0), group, start=r)[1]
                              for r in range(1, k + 1)])
        kind = 'Exact'
        seed_label = 'Exact (all starts)'
    else:
        if repetitions < 1000:
            raise ValueError('Monte Carlo requires at least 1,000 repetitions')
        rng = np.random.default_rng(seed)
        estimates = np.array([draw(df, method, n, rng, group)[1] for _ in range(repetitions)])
        kind = 'Monte Carlo'
        seed_label = str(seed)
    error = estimates - truth
    return {'method': method, 'n': n, 'seed': seed_label, 'runs': len(estimates),
            'type': kind, 'bias': float(error.mean()), 'SD': float(estimates.std(ddof=0)),
            'RMSE': float(np.sqrt(np.mean(error**2))), 'estimates': estimates}
