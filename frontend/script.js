const FEATURE_LABELS = {
  FG_PCT: "Adresse au tir (FG%)",
  FG3_PCT: "Adresse à 3pts (3P%)",
  FT_PCT: "Adresse lancers francs (FT%)",
  REB: "Rebonds",
  AST: "Passes décisives",
  TOV: "Balles perdues",
  STL: "Interceptions",
  BLK: "Contres",
  PF: "Fautes",
};

let teamSeasonStats = [];
let leagueTrends = [];
let seasons = [];
let teams = [];
let winModel = null;

async function loadData() {
  const [tss, trends, seas, tms, model] = await Promise.all([
    fetch("data/team_season_stats.json").then((r) => r.json()),
    fetch("data/league_trends.json").then((r) => r.json()),
    fetch("data/seasons.json").then((r) => r.json()),
    fetch("data/teams.json").then((r) => r.json()),
    fetch("data/win_model.json").then((r) => r.json()),
  ]);
  teamSeasonStats = tss;
  leagueTrends = trends;
  seasons = seas;
  teams = tms;
  winModel = model;
}

function fmtPct(v) {
  return (v * 100).toFixed(1) + "%";
}

function initHeroStats() {
  document.getElementById("statGames").textContent = winModel.metrics.n_samples.toLocaleString("fr-FR");
  document.getElementById("statTeams").textContent = teams.length;
  document.getElementById("statAcc").textContent = fmtPct(winModel.metrics.accuracy);
}

function populateTrendsTeamSelect() {
  const sel = document.getElementById("trendsTeamSelect");
  teams.forEach((t) => {
    const opt = document.createElement("option");
    opt.value = t.TEAM_ABBREVIATION;
    opt.textContent = t.TEAM_NAME;
    sel.appendChild(opt);
  });
  sel.addEventListener("change", renderTrendsChart);
}

function trendsDataForTeam(teamAbbr) {
  if (!teamAbbr) {
    return {
      label: "Points / match (moy. ligue)",
      pts: leagueTrends.map((d) => d.avg_pts),
      ast: leagueTrends.map((d) => d.avg_ast),
      reb: leagueTrends.map((d) => d.avg_reb),
      fg3: leagueTrends.map((d) => d.avg_fg3_pct * 100),
    };
  }
  const byseason = new Map(
    teamSeasonStats.filter((d) => d.TEAM_ABBREVIATION === teamAbbr).map((d) => [d.SEASON, d])
  );
  const teamName = byseason.values().next().value?.TEAM_NAME || teamAbbr;
  return {
    label: `Points / match (${teamName})`,
    pts: seasons.map((s) => byseason.get(s)?.pts ?? null),
    ast: seasons.map((s) => byseason.get(s)?.ast ?? null),
    reb: seasons.map((s) => byseason.get(s)?.reb ?? null),
    fg3: seasons.map((s) => (byseason.get(s) ? byseason.get(s).fg3_pct * 100 : null)),
  };
}

let trendsChart = null;

function renderTrendsChart() {
  const teamAbbr = document.getElementById("trendsTeamSelect").value;
  const d = trendsDataForTeam(teamAbbr);

  if (trendsChart) {
    trendsChart.data.datasets[0].label = d.label;
    trendsChart.data.datasets[0].data = d.pts;
    trendsChart.data.datasets[1].data = d.ast;
    trendsChart.data.datasets[2].data = d.reb;
    trendsChart.data.datasets[3].data = d.fg3;
    trendsChart.update();
    return;
  }

  const ctx = document.getElementById("trendsChart");
  const labels = seasons;
  trendsChart = new Chart(ctx, {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label: d.label,
          data: d.pts,
          borderColor: "#F2A93B",
          backgroundColor: "rgba(242,169,59,0.08)",
          yAxisID: "y",
          tension: 0.3,
        },
        {
          label: "Passes décisives / match",
          data: d.ast,
          borderColor: "#3FB68B",
          backgroundColor: "transparent",
          yAxisID: "y",
          tension: 0.3,
        },
        {
          label: "Rebonds / match",
          data: d.reb,
          borderColor: "#8592A1",
          backgroundColor: "transparent",
          yAxisID: "y",
          tension: 0.3,
        },
        {
          label: "Adresse à 3pts (%)",
          data: d.fg3,
          borderColor: "#E5573D",
          backgroundColor: "transparent",
          yAxisID: "y1",
          tension: 0.3,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: "index", intersect: false },
      plugins: {
        legend: { labels: { color: "#8592A1", font: { family: "IBM Plex Mono", size: 11 } } },
      },
      scales: {
        x: { ticks: { color: "#8592A1" }, grid: { color: "rgba(237,239,242,0.06)" } },
        y: {
          position: "left",
          ticks: { color: "#8592A1" },
          grid: { color: "rgba(237,239,242,0.06)" },
          title: { display: true, text: "Points / Passes / Rebonds", color: "#8592A1" },
        },
        y1: {
          position: "right",
          ticks: { color: "#8592A1" },
          grid: { display: false },
          title: { display: true, text: "3P%", color: "#8592A1" },
        },
      },
    },
  });
}

function populateSeasonSelect() {
  const sel = document.getElementById("seasonSelect");
  seasons
    .slice()
    .reverse()
    .forEach((s) => {
      const opt = document.createElement("option");
      opt.value = s;
      opt.textContent = s;
      sel.appendChild(opt);
    });
  sel.addEventListener("change", renderStandings);

  const teamFilter = document.getElementById("teamFilter");
  teams.forEach((t) => {
    const opt = document.createElement("option");
    opt.value = t.TEAM_ABBREVIATION;
    opt.textContent = t.TEAM_NAME;
    teamFilter.appendChild(opt);
  });
  teamFilter.addEventListener("change", renderStandings);
}

function renderStandings() {
  const season = document.getElementById("seasonSelect").value;
  const filter = document.getElementById("teamFilter").value;
  const rows = teamSeasonStats
    .filter((d) => d.SEASON === season)
    .filter((d) => !filter || d.TEAM_ABBREVIATION === filter)
    .sort((a, b) => b.win_pct - a.win_pct);

  const tbody = document.querySelector("#standingsTable tbody");
  tbody.innerHTML = "";
  rows.forEach((d, i) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td class="${i === 0 ? "rank-1" : ""}">${i + 1}</td>
      <td>${d.TEAM_NAME}</td>
      <td>${d.wins}</td>
      <td>${d.losses}</td>
      <td>${fmtPct(d.win_pct)}</td>
      <td>${d.pts.toFixed(1)}</td>
      <td>${d.reb.toFixed(1)}</td>
      <td>${d.ast.toFixed(1)}</td>
      <td>${(d.fg_pct * 100).toFixed(1)}%</td>
      <td>${(d.fg3_pct * 100).toFixed(1)}%</td>
    `;
    tbody.appendChild(tr);
  });
}

let radarChart = null;

function populateTeamSelects() {
  const a = document.getElementById("teamA");
  const b = document.getElementById("teamB");
  teams.forEach((t) => {
    const optA = document.createElement("option");
    optA.value = t.TEAM_ABBREVIATION;
    optA.textContent = t.TEAM_NAME;
    a.appendChild(optA);
    const optB = optA.cloneNode(true);
    b.appendChild(optB);
  });
  a.value = "BOS";
  b.value = "LAL";
  a.addEventListener("change", renderRadar);
  b.addEventListener("change", renderRadar);
  document.getElementById("seasonSelect").addEventListener("change", renderRadar);
}

function latestStatsFor(teamAbbr, season) {
  return teamSeasonStats.find((d) => d.SEASON === season && d.TEAM_ABBREVIATION === teamAbbr);
}

function renderRadar() {
  const season = document.getElementById("seasonSelect").value;
  const teamAId = document.getElementById("teamA").value;
  const teamBId = document.getElementById("teamB").value;
  const a = latestStatsFor(teamAId, season);
  const b = latestStatsFor(teamBId, season);
  if (!a || !b) return;

  const labels = ["Points", "Rebonds", "Passes", "Interceptions", "Contres", "Adresse FG%"];
  const dataA = [a.pts, a.reb, a.ast, a.stl, a.blk, a.fg_pct * 100];
  const dataB = [b.pts, b.reb, b.ast, b.stl, b.blk, b.fg_pct * 100];

  if (radarChart) {
    radarChart.data.labels = labels;
    radarChart.data.datasets[0].data = dataA;
    radarChart.data.datasets[0].label = a.TEAM_NAME;
    radarChart.data.datasets[1].data = dataB;
    radarChart.data.datasets[1].label = b.TEAM_NAME;
    radarChart.update();
    return;
  }

  const ctx = document.getElementById("radarChart");
  radarChart = new Chart(ctx, {
    type: "radar",
    data: {
      labels,
      datasets: [
        {
          label: a.TEAM_NAME,
          data: dataA,
          borderColor: "#F2A93B",
          backgroundColor: "rgba(242,169,59,0.15)",
        },
        {
          label: b.TEAM_NAME,
          data: dataB,
          borderColor: "#3FB68B",
          backgroundColor: "rgba(63,182,139,0.15)",
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { labels: { color: "#EDEFF2", font: { family: "IBM Plex Mono", size: 11 } } },
      },
      scales: {
        r: {
          angleLines: { color: "rgba(237,239,242,0.1)" },
          grid: { color: "rgba(237,239,242,0.1)" },
          pointLabels: { color: "#8592A1", font: { size: 11 } },
          ticks: { display: false },
        },
      },
    },
  });
}

function buildSliders() {
  const container = document.getElementById("sliders");
  winModel.features.forEach((feat) => {
    const range = winModel.feature_ranges[feat];
    const mid = (range.min + range.max) / 2;
    const step = (range.max - range.min) / 100;

    const row = document.createElement("div");
    row.className = "slider-row";
    row.innerHTML = `
      <div class="slider-row-head">
        <span>${FEATURE_LABELS[feat] || feat}</span>
        <span id="val-${feat}">${mid.toFixed(2)}</span>
      </div>
      <input type="range" id="slider-${feat}" min="${range.min}" max="${range.max}" step="${step || 0.01}" value="${mid}">
    `;
    container.appendChild(row);
  });

  winModel.features.forEach((feat) => {
    document.getElementById(`slider-${feat}`).addEventListener("input", updatePrediction);
  });
}

function updatePrediction() {
  let z = winModel.intercept;
  winModel.features.forEach((feat) => {
    const range = winModel.feature_ranges[feat];
    const raw = parseFloat(document.getElementById(`slider-${feat}`).value);
    document.getElementById(`val-${feat}`).textContent = raw.toFixed(2);
    const norm = (raw - range.min) / (range.max - range.min);
    z += winModel.coefficients[feat] * norm;
  });
  const proba = 1 / (1 + Math.exp(-z));
  document.getElementById("gaugeFill").style.width = `${(proba * 100).toFixed(1)}%`;
  document.getElementById("gaugeValue").textContent = `${(proba * 100).toFixed(1)}%`;
}

function initModelMeta() {
  document.getElementById("modelMeta").textContent =
    `Régression logistique · Précision ${fmtPct(winModel.metrics.accuracy)} · AUC ${winModel.metrics.auc.toFixed(3)} · ${winModel.metrics.n_samples.toLocaleString("fr-FR")} matchs`;
}

async function init() {
  await loadData();
  initHeroStats();
  populateTrendsTeamSelect();
  renderTrendsChart();
  populateSeasonSelect();
  populateTeamSelects();
  renderStandings();
  renderRadar();
  buildSliders();
  updatePrediction();
  initModelMeta();
}

init();
