/* ======================================================
   BASIC MAP
====================================================== */
const map = L.map("map").setView([34, 66], 6);

L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
  attribution: "© OpenStreetMap"
}).addTo(map);

/* ======================================================
   STATE
====================================================== */
let currentMonth = "January";

const foodIndex = {
  region: {},
  province: {},
  national: {}
};

let regionLayer = null;
let provinceLayer = null;

/* ======================================================
   UTILITIES
====================================================== */
const norm = v => String(v).trim().toUpperCase();

function getColor(v) {
  if (!v) return "#cccccc";
  if (v <= 16500) return "#1a9850";
  if (v <= 18000) return "#91cf60";
  if (v <= 19500) return "#ffffbf";
  if (v <= 21000) return "#fc8d59";
  return "#d73027";
}

/* ======================================================
   LOAD CSV (FIXED)
====================================================== */
Papa.parse("data/meb.csv", {
  download: true,
  header: true,
  dynamicTyping: true,
  complete: r => {
    r.data.forEach(row => {
      if (!row.level || !row.month) return;

      const level = row.level.trim().toLowerCase();

      // NATIONAL (FIX)
      if (level === "national") {
        foodIndex.national[row.month] = {
          meb_AFN: +row.meb_AFN
        };
        return;
      }

      // REGION / PROVINCE
      if (!row.admin_code || !foodIndex[level]) return;

      const key = `${row.month}_${norm(row.admin_code)}`;
      foodIndex[level][key] = row;
    });

    initMonthDropdown();
    loadGeoJSON();
    updateNationalPanel();
  }
});

/* ======================================================
   LOAD GEOJSON
====================================================== */
function loadGeoJSON() {
  fetch("data/regions.geojson")
    .then(r => r.json())
    .then(g => {
      regionLayer = L.geoJSON(g, {
        style: f => styleFeature("region", f.properties.Region_Code),
        onEachFeature: (f, l) => bindPopup(l, f, "region")
      }).addTo(map);
    });

  fetch("data/provinces.geojson")
    .then(r => r.json())
    .then(g => {
      provinceLayer = L.geoJSON(g, {
        style: f => styleFeature("province", f.properties.Province_Code),
        onEachFeature: (f, l) => bindPopup(l, f, "province")
      }).addTo(map);
    });
}

/* ======================================================
   STYLE
====================================================== */
function styleFeature(level, code) {
  const d = foodIndex[level][`${currentMonth}_${norm(code)}`];

  return {
    fillColor: getColor(d?.meb_AFN),
    fillOpacity: level === "region" ? 0.45 : 0.3,
    weight: level === "region" ? 2 : 1.2,
    color: "#555"
  };
}

/* ======================================================
   POPUPS
====================================================== */
function bindPopup(layer, feature, level) {
  const code =
    level === "region"
      ? feature.properties.Region_Code
      : feature.properties.Province_Code;

  const name =
    feature.properties.Region_Name ||
    feature.properties.Province_Eng;

  layer.bindPopup(() => {
    const d = foodIndex[level][`${currentMonth}_${norm(code)}`];
    return d
      ? `<b>${name}</b><br>MEB: ${d.meb_AFN.toLocaleString()} AFN`
      : `<b>${name}</b><br>No data`;
  });

  layer.on({
    mouseover: e => e.target.setStyle({ weight: 3, color: "#000" }),
    mouseout: e =>
      (level === "region" ? regionLayer : provinceLayer)
        .resetStyle(e.target)
  });
}

/* ======================================================
   MONTH DROPDOWN
====================================================== */
function initMonthDropdown() {
  const months = [
    "January","February","March","April","May","June",
    "July","August","September","October","November","December"
  ];

  const sel = document.getElementById("monthSelect");
  sel.innerHTML = "";

  months.forEach(m => {
    const opt = document.createElement("option");
    opt.value = m;
    opt.textContent = m;
    sel.appendChild(opt);
  });

  sel.value = currentMonth;

  sel.onchange = e => {
    currentMonth = e.target.value;
    refreshMapStyles();
    updateNationalPanel();
  };
}

/* ======================================================
   REFRESH STYLES
====================================================== */
function refreshMapStyles() {
  regionLayer?.eachLayer(l =>
    l.setStyle(styleFeature("region", l.feature.properties.Region_Code))
  );

  provinceLayer?.eachLayer(l =>
    l.setStyle(styleFeature("province", l.feature.properties.Province_Code))
  );
}

/* ======================================================
   NATIONAL PANEL (NOW WORKS)
====================================================== */
function updateNationalPanel() {
  const el = document.getElementById("nationalContent");
  const d = foodIndex.national[currentMonth];
  let count = 0;

  if (!d) {
    el.innerHTML = "No national data";
    return;
  }

  Object.values(foodIndex.province).forEach(d => {
    if (d.month === currentMonth && d.meb_AFN) {
      count++;
    }
  });


  el.innerHTML = `
    <b>Month:</b> ${currentMonth}<br>
    <b>National MEB:</b> ${d.meb_AFN.toLocaleString()} AFN
    <b>Coverage:</b> ${count} provinces
  `;
}

/* ======================================================
   LAYER TOGGLES
====================================================== */
document.getElementById("regionsToggle").onchange = e =>
  regionLayer && (e.target.checked ? map.addLayer(regionLayer) : map.removeLayer(regionLayer));

document.getElementById("provincesToggle").onchange = e =>
  provinceLayer && (e.target.checked ? map.addLayer(provinceLayer) : map.removeLayer(provinceLayer));
