<div align="center">

# 💩 ShiShan Hot 100 (Legacy Code Benchmark)

**The "LeetCode 100" for the AI Era · Real-world Backend Bug Fixing Benchmark & OnCall Simulator**

[![Next.js](https://img.shields.io/badge/Next.js-15-black?style=flat-square&logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19-blue?style=flat-square&logo=react)](https://react.dev/)
[![Spring Boot](https://img.shields.io/badge/Spring%20Boot-3.2.5-brightgreen?style=flat-square&logo=springboot)](https://spring.io/projects/spring-boot)
[![Java](https://img.shields.io/badge/Java-17-orange?style=flat-square&logo=openjdk)](https://openjdk.org/)
[![License](https://img.shields.io/badge/license-MIT-green?style=flat-square)](LICENSE)

**English** · [简体中文](./README.md) · [Problems](#-problems) · [Quick Start](#-quick-start)

<br/>

</div>

> **"A decade ago, engineers inverted binary trees on whiteboards.**  
> **Today, LLMs write quicksort in 1 second, yet crumble when debugging deadlocks, stale caches, and encoding corruption in legacy codebases."**

---

## 💡 Why ShiShan Hot 100?

In traditional competitive programming, LeetCode tests pure algorithmic skills.  
In the age of AI coding assistants, synthesizing standalone functions is no longer a challenge. **The real-world bottleneck is Root Cause Analysis (RCA):**

- Real production outages never come with input/output boundary hints.
- Codebases are convoluted: lock-order inversions, cache-aside race conditions, silent character encoding truncation, multi-tenant unit mismatches.
- Can Coding Agents (Cursor, Claude Code, Trae, Gemini, Copilot, etc.) and software engineers actually diagnose and fix complex production bugs?

**ShiShan Hot 100 is designed as an industrial-grade benchmark and playground.**  
Every problem is a **working but bug-ridden** Spring Boot backend service. Download it to your local workspace, fix it (yourself or with AI Agents), and run local regression tests: **Heartbeat → Contract Check → Multi-step Workflow → Concurrency Load Test → Log Assertions. All green = AC!**

---

## ✨ Features

- 🏭 **Realistic Production Outages**: Full-fledged Spring Boot backend projects with zero spoiler comments.
- 🎯 **LeetCode-Style Minimalist UI**: Category tags with auto-folding, progress tracking, and clean status indicators.
- ⚙️ **Hardcore Local Regression Engine**:
  - Heartbeat probe with timeout detection;
  - HTTP contract assertions (status, JSON path, max latency);
  - Multi-step workflows with variable extraction and interpolation;
  - Concurrency load testing with P95 latency and status code assertions;
  - Real-time log scanning for deadlock warnings and stale cache回填 traces.
- 🛡️ **Anti-Leak Design**: Ticket-style problem descriptions without spoilers; each passing test unlocks its name, description, and detailed logs immediately; unfinished and failed tests remain masked.
- 🏆 **10 Codeforces Tiers**: From `Newbie` up to `Candidate Master` and `Legendary Grandmaster`.
- 🔒 **100% Local & Private**: No cloud dependencies, no code leaves your machine, zero API token costs.

---

## 📚 Problems

| ID | Title | Tier | Tags | Production Symptom |
| :---: | :--- | :---: | :--- | :--- |
| **01** | [SHISHAN001 · Slow Request Under Load](problems/SHISHAN001) | Newbie | `Java` `Multithreading` `Thread Synchronization` | Works in development, but throws 504 timeouts under promotional traffic spikes. |
| **02** | [SHISHAN002 · The Two Faces of Shared Wallet](problems/SHISHAN002) | Expert | `Java` `Data Consistency` `Read/Write Ordering` | Two games share a wallet: one sees balance 1000x smaller; top-ups revert on logout. |
| **03** | [SHISHAN003 · Corrupted File Vault](problems/SHISHAN003) | Candidate Master | `Java` `File Handling` `Hashing` | File uploads succeed but cannot be retrieved by hash; downloaded images are corrupted. |
| **04** | [SHISHAN004 · Time-Warped File Service](problems/SHISHAN004) | Pupil | `Java` `File Handling` | Upload returns success and a resource URL, but immediately fetching that URL returns 404. |
| **05** | [SHISHAN005 · Duplicate Message Reception](problems/SHISHAN005) | Grandmaster (Red) | `Java` `Multithreading` `Producer–Consumer` | Messages randomly appear 2~3 times; cursor pagination returns overlapping items; reconnect doubles message count. |
| **06** | [SHISHAN006 · Incomplete Streaming Replies](problems/SHISHAN006) | Expert | `JavaScript` `Streaming` `SSE` | Replies can be incomplete or empty while marked complete, including after reloading history. |
| **07** | [SHISHAN007 · Inconsistent Usage Statistics](problems/SHISHAN007) | Master | `JavaScript` `Data Consistency` `Read/Write Ordering` | Usage totals and breakdowns disagree around shift changes and quota refreshes. |
| **08** | [SHISHAN008 · Mistaken Identity](problems/SHISHAN008) | Candidate Master | `Python` `Data Consistency` `Caching` | Switching accounts changes report ownership and availability; summary and source views disagree. |

---

## 🚀 Quick Start

### 1. Prerequisites
- **Node.js**: `>= 18.18.0`
- **Java JDK**: `>= 17` for SHISHAN001–005; SHISHAN006–007 use **Node.js >= 22**, with no Java or database required.
- **Apache Maven**: `>= 3.8.0` for SHISHAN001–005; run `npm ci` and then `npm start` for SHISHAN006–007.

### 2. Setup & Launch
```bash
git clone https://github.com/HHHHH-GIT/ShiShan_HOT100.git
cd ShiShan_HOT100

npm install
npm run pack:problem
npm run dev
```
Open `http://localhost:3000` to start exploring the problemset!

---

## 📄 License

Distributed under the [MIT License](LICENSE).
