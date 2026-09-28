"""Dependency-free DTOs for the original heuristic code analyzer."""
from dataclasses import dataclass, field


@dataclass
class CodeSample:
    code: str
    language: str


@dataclass
class CodeStyleMetrics:
    sample_count: int = 0
    language_distribution: dict = field(default_factory=dict)
    line_counts: list = field(default_factory=list)
    comment_rates: list = field(default_factory=list)
    naming_camel: int = 0
    naming_snake: int = 0
    avg_nesting_depth: float = 0.0
    avg_complexity: float = 0.0
