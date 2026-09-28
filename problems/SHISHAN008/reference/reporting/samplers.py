"""时间轴均匀随机采样：把提交按时间分成等距桶，每桶随机取一个，保证时间分布均匀。"""
from __future__ import annotations

import random
from typing import TypeVar

T = TypeVar("T")


def uniform_temporal_sample(items: list[T], timestamp_of, n: int, seed: int | None = None) -> list[T]:
    """按 timestamp_of(items) 排序后均匀分 n 桶，每桶随机取一个。

    - 样本不足 n 时返回全部（去重后）。
    - timestamp 缺失的项归到最旧桶。
    """
    if not items:
        return []
    rng = random.Random(seed)
    ordered = sorted(items, key=timestamp_of)
    if len(ordered) <= n:
        return ordered

    bucket_size = len(ordered) / n
    sampled: list[T] = []
    for i in range(n):
        start = int(i * bucket_size)
        end = int((i + 1) * bucket_size)
        bucket = ordered[start:end] if end > start else [ordered[start]]
        sampled.append(rng.choice(bucket))
    return sampled
