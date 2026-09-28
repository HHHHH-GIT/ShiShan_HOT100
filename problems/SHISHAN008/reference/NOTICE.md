# 来源说明

本工程改编自本地 `F:\Projects\leetcode_analyzer`（项目名 leetcode-analyzer，版本 0.1.0）。原项目 `pyproject.toml` 的作者字段为 `leetcode-analyzer`，许可证声明为 MIT；本地源目录未附单独 LICENSE 文件。随包保留 MIT 授权文本，不推断原作者的真实身份。

- `reporting/samplers.py` 原样复制原项目 `leetcode_analyzer/samplers.py`，SHA-256：`7dc18ebf6a3775d229f20fad401b5a32522e25a6f82ffe9fd0c8950947470280`。
- `reporting/analyzers/code_style_analysis.py` 原样复制同名分析模块，SHA-256：`4aa5cab2d9603c09b1b744c2d10c6c2772ed9536fe8f431c45572acfefa9e4cd`。
- 身份路由、提交采集及 JSON 存储改编自 `fetchers/code_style.py` 和 `cache.py`；数据模型改为 Python 标准库实现。
- 离线数据源、任务工作台、展示投影及 HTTP 接口为题库适配代码。所有账号、代码和统计都是虚构样本，不含真实 Cookie 或账号数据。

原项目保持不变。本工程用于调试练习，不代表原工程全部功能或质量。
