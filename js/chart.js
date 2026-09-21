(function () {
  "use strict";
  let instance = null;

  function scoreColor(score) {
    if (score < 1.5) return "#d92d20";
    if (score < 2.5) return "#f97066";
    if (score < 3.5) return "#fdb022";
    if (score < 4.5) return "#32b98c";
    return "#067647";
  }

  function renderRadar(canvas, dimensions) {
    if (instance) instance.destroy();
    if (typeof Chart === "undefined") return false;

    const ordered = [...dimensions].sort((a, b) => b.score - a.score);
    instance = new Chart(canvas, {
      type: "bar",
      data: {
        labels: ordered.map((dimension) => dimension.name),
        datasets: [{
          label: "Score sur 5",
          data: ordered.map((dimension) => dimension.score),
          backgroundColor: ordered.map((dimension) => scoreColor(dimension.score)),
          borderRadius: 7,
          borderSkipped: false,
          barThickness: 18
        }]
      },
      options: {
        indexAxis: "y",
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 650, easing: "easeOutQuart" },
        layout: { padding: { right: 12 } },
        scales: {
          x: {
            min: 0,
            max: 5,
            ticks: { stepSize: 1, color: "#718096", callback: (value) => `${value}` },
            title: { display: true, text: "Score de maturité / 5", color: "#52677c", font: { weight: "600" } },
            grid: { color: "rgba(7, 27, 51, .08)" },
            border: { display: false }
          },
          y: {
            grid: { display: false },
            border: { display: false },
            ticks: { color: "#14263b", autoSkip: false, font: { family: "DM Sans", size: 11, weight: "600" } }
          }
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            displayColors: false,
            backgroundColor: "#071b33",
            padding: 12,
            callbacks: { label: (context) => `${Number(context.raw).toFixed(2).replace(".", ",")} / 5` }
          }
        }
      }
    });
    return true;
  }

  window.FinasureChart = Object.freeze({ renderRadar });
})();
