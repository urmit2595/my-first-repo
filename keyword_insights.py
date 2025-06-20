import csv
import argparse
from collections import defaultdict
from typing import List, Dict


def load_data(path: str) -> List[Dict[str, str]]:
    """Load keyword planner data from a CSV file."""
    with open(path, newline="", encoding="utf-8") as csvfile:
        reader = csv.DictReader(csvfile)
        return list(reader)


def classify_keywords(records: List[Dict[str, str]], brands: List[str]) -> Dict[str, List[Dict[str, str]]]:
    """Separate records into generic and brand buckets."""
    brand_records = []
    generic_records = []
    lower_brands = [b.lower() for b in brands]
    for row in records:
        keyword = row.get("Keyword", "").lower()
        if any(b in keyword for b in lower_brands):
            brand_records.append(row)
        else:
            generic_records.append(row)
    return {"brand": brand_records, "generic": generic_records}


def aggregate_by(records: List[Dict[str, str]], *keys: str) -> Dict[tuple, Dict[str, float]]:
    """Aggregate metrics like Impressions and Clicks by provided keys."""
    totals = defaultdict(lambda: defaultdict(float))
    for row in records:
        key = tuple(row.get(k, "") for k in keys)
        impressions = float(row.get("Impressions", 0))
        clicks = float(row.get("Clicks", 0))
        cost = float(row.get("Cost", 0))
        totals[key]["Impressions"] += impressions
        totals[key]["Clicks"] += clicks
        totals[key]["Cost"] += cost
    return totals


def calculate_yoy_growth(yearly_totals: Dict[tuple, Dict[str, float]]) -> Dict[str, float]:
    """Calculate year-over-year growth in impressions."""
    growth = {}
    years = sorted(key for (key,) in yearly_totals.keys())
    prev_impr = None
    for year in years:
        current = yearly_totals.get((year,), {}).get("Impressions", 0.0)
        if prev_impr is not None and prev_impr > 0:
            growth[str(year)] = (current - prev_impr) / prev_impr * 100.0
        prev_impr = current
    return growth


def print_aggregates(title: str, data: Dict[tuple, Dict[str, float]]):
    print(f"\n=== {title} ===")
    for key, metrics in sorted(data.items()):
        key_str = ", ".join(str(k) for k in key if k)
        print(f"{key_str}: Impressions={metrics['Impressions']:.0f} Clicks={metrics['Clicks']:.0f} Cost={metrics['Cost']:.2f}")


def main():
    parser = argparse.ArgumentParser(description="Analyze Keyword Planner CSV for VC insights")
    parser.add_argument("csv_file", help="Path to Keyword Planner CSV")
    parser.add_argument("--brands", nargs="*", default=[], help="List of brand terms to classify as branded")
    args = parser.parse_args()

    records = load_data(args.csv_file)
    classified = classify_keywords(records, args.brands)

    # Aggregate generic and branded
    gen_agg = aggregate_by(classified["generic"], "Year")
    brand_agg = aggregate_by(classified["brand"], "Year")

    print_aggregates("Generic Keywords by Year", gen_agg)
    print_aggregates("Branded Keywords by Year", brand_agg)

    # Year-over-year growth for generic keywords
    gen_growth = calculate_yoy_growth(gen_agg)
    if gen_growth:
        print("\nYOY Growth for Generic Keywords (Impressions %):")
        for year, growth in gen_growth.items():
            print(f"{year}: {growth:.2f}%")

    # Month-wise overall trend
    month_agg = aggregate_by(records, "Year", "Month")
    print_aggregates("Overall Month Trend", month_agg)


if __name__ == "__main__":
    main()
