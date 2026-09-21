(function () {
  "use strict";
  let instance = null;

  function renderRadar(canvas, dimensions) {
    if (instance) {
      instance.destroy();
      instance = null;
    }
    if (typeof Chart === "undefined") return false;

    instance = new Chart(canvas, {
      type: "radar",
      data: {
        labels: dimensions.map((dimension) => dimension.name),
        datasets: [{
          label: "Niveau de maturité",
          data: dimensions.map((dimension) => dimension.score),
          backgroundColor: "rgba(0, 169, 212, .22)",
          borderColor: "#087f9e",
          borderWidth: 2.5,
          pointBackgroundColor: "#ffffff",
          pointBorderColor: "#087f9e",
          pointBorderWidth: 2,
          pointRadius: 4,
          pointHoverRadius: 6,
          pointHoverBackgroundColor: "#071b33"
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 650, easing: "easeOutQuart" },
        layout: { padding: 12 },
        scales: {
          r: {
            min: 0,
            max: 5,
            beginAtZero: true,
            angleLines: { color: "rgba(7, 27, 51, .12)" },
            grid: { color: "rgba(7, 27, 51, .10)", circular: false },
            ticks: { stepSize: 1, showLabelBackdrop: false, color: "#718096", font: { size: 9 } },
            pointLabels: { color: "#14263b", padding: 12, font: { family: "DM Sans", size: 11, weight: "600" } }
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
