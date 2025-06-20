# Keyword Planner Insights

This repository includes a simple script for analyzing data exported from Google's Keyword Planner. The script focuses on providing insights useful from a venture-capital perspective, distinguishing between generic and branded search terms and summarizing trends over time.

## Usage

1. Export your Keyword Planner results to a CSV file. The CSV should contain at least the following columns:
   - `Keyword`
   - `Impressions`
   - `Clicks`
   - `Cost`
   - `Year`
   - `Month`

2. Run the analysis script:
   ```bash
   python keyword_insights.py path/to/keywords.csv --brands brand1 brand2
   ```
   Provide any brand keywords with `--brands` so the script can separate branded from generic searches.

The output summarizes generic and branded keyword performance by year, shows year-over-year growth for generic terms, and lists month-wise totals.
