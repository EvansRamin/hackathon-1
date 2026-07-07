import json
import pandas as pd
import numpy as np
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, roc_auc_score
from pathlib import Path

DATA_DIR = Path(__file__).parent / "data"
OUT_DIR = Path(__file__).parent / "frontend" / "data"
OUT_DIR.mkdir(parents=True, exist_ok=True)

RAW_CSV = DATA_DIR / "regular_season_totals.csv"

FEATURE_COLS = ["FG_PCT", "FG3_PCT", "FT_PCT", "REB", "AST", "TOV", "STL", "BLK", "PF"]


def load_and_clean():
    df = pd.read_csv(RAW_CSV)

    df = df.dropna(subset=["WL", "PTS", "FG_PCT"])
    df = df[df["WL"].isin(["W", "L"])]
    df["WIN"] = (df["WL"] == "W").astype(int)
    df["GAME_DATE"] = pd.to_datetime(df["GAME_DATE"])
    df["SEASON"] = df["SEASON_YEAR"]

    for col in FEATURE_COLS + ["PTS"]:
        df = df[df[col].notna()]

    return df


def build_team_season_stats(df):
    """Stats moyennes par équipe et par saison."""
    agg = (
        df.groupby(["SEASON", "TEAM_ABBREVIATION", "TEAM_NAME"])
        .agg(
            games=("WIN", "count"),
            wins=("WIN", "sum"),
            pts=("PTS", "mean"),
            fg_pct=("FG_PCT", "mean"),
            fg3_pct=("FG3_PCT", "mean"),
            ft_pct=("FT_PCT", "mean"),
            reb=("REB", "mean"),
            ast=("AST", "mean"),
            tov=("TOV", "mean"),
            stl=("STL", "mean"),
            blk=("BLK", "mean"),
            plus_minus=("PLUS_MINUS", "mean"),
        )
        .reset_index()
    )
    agg["losses"] = agg["games"] - agg["wins"]
    agg["win_pct"] = (agg["wins"] / agg["games"]).round(3)
    for col in ["pts", "fg_pct", "fg3_pct", "ft_pct", "reb", "ast", "tov", "stl", "blk", "plus_minus"]:
        agg[col] = agg[col].round(3)
    return agg.sort_values(["SEASON", "win_pct"], ascending=[True, False])


def build_league_trends(team_season):
    """Évolution de la ligue saison par saison (rythme de jeu, tir à 3pts, etc.)."""
    trend = (
        team_season.groupby("SEASON")
        .agg(
            avg_pts=("pts", "mean"),
            avg_fg3_pct=("fg3_pct", "mean"),
            avg_ast=("ast", "mean"),
            avg_reb=("reb", "mean"),
        )
        .round(2)
        .reset_index()
        .sort_values("SEASON")
    )
    return trend


def train_win_model(df):
    """Régression logistique : prédit la probabilité de victoire
    à partir des statistiques d'une équipe pour un match donné."""
    X = df[FEATURE_COLS].copy()
    y = df["WIN"]

    mins = X.min()
    maxs = X.max()
    X_norm = (X - mins) / (maxs - mins)

    X_train, X_test, y_train, y_test = train_test_split(
        X_norm, y, test_size=0.2, random_state=42
    )

    model = LogisticRegression(max_iter=1000)
    model.fit(X_train, y_train)

    preds = model.predict(X_test)
    proba = model.predict_proba(X_test)[:, 1]
    acc = accuracy_score(y_test, preds)
    auc = roc_auc_score(y_test, proba)

    print(f"Modèle entraîné - Accuracy: {acc:.3f} | AUC: {auc:.3f}")

    return {
        "features": FEATURE_COLS,
        "coefficients": {f: round(c, 4) for f, c in zip(FEATURE_COLS, model.coef_[0])},
        "intercept": round(model.intercept_[0], 4),
        "feature_ranges": {
            f: {"min": round(float(mins[f]), 3), "max": round(float(maxs[f]), 3)}
            for f in FEATURE_COLS
        },
        "metrics": {"accuracy": round(acc, 4), "auc": round(auc, 4), "n_samples": int(len(df))},
    }


def build_top_performers(team_season, season):
    subset = team_season[team_season["SEASON"] == season].copy()
    subset = subset.sort_values("win_pct", ascending=False)
    return subset


def main():
    print("Chargement et nettoyage des données...")
    df = load_and_clean()
    print(f"{len(df)} lignes de match après nettoyage.")

    print("Calcul des statistiques équipe/saison...")
    team_season = build_team_season_stats(df)
    team_season.to_json(OUT_DIR / "team_season_stats.json", orient="records")

    print("Calcul des tendances de la ligue...")
    trends = build_league_trends(team_season)
    trends.to_json(OUT_DIR / "league_trends.json", orient="records")

    print("Entraînement du modèle prédictif (régression logistique)...")
    model_data = train_win_model(df)
    with open(OUT_DIR / "win_model.json", "w") as f:
        json.dump(model_data, f, indent=2)

    seasons = sorted(team_season["SEASON"].unique().tolist())
    with open(OUT_DIR / "seasons.json", "w") as f:
        json.dump(seasons, f)

    teams = (
        team_season[["TEAM_ABBREVIATION", "TEAM_NAME"]]
        .drop_duplicates()
        .sort_values("TEAM_NAME")
        .to_dict(orient="records")
    )
    with open(OUT_DIR / "teams.json", "w") as f:
        json.dump(teams, f)

    print(f"\nTerminé. Fichiers JSON générés dans {OUT_DIR}")
    print(f"- {len(seasons)} saisons, {len(teams)} équipes")


if __name__ == "__main__":
    main()
