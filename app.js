import * as maplibregl from 'https://unpkg.com/maplibre-gl@6.10.0/dist/maplibre-gl.mjs';

const DATA = {
  state: 'anambra_state_boundary.geojson',
  lgas: 'anambra_lga_boundaries.geojson',
  zones: 'anambra_intervention_zones.geojson',
  drainage: 'anambra_primary_drainage.geojson',
  summary: 'anambra_dashboard_summary.json',
  lgaSummary: 'anambra_lga_summary.json'
};

const HOME_BOUNDS = [[6.60, 5.68], [7.38, 6.82]];
const ZONE_LAYER_IDS = ['zones-fill', 'zones-outline', 'zones-selected'];
const LGA_LAYER_IDS = ['lga-fill', 'lga-outline', 'lga-labels'];
const DRAINAGE_LAYER_IDS = ['drainage-lines'];
const sectorNames = {
  1: 'Hillslope land management',
  2: 'Urban erosion & drainage screening'
};

const state = {
  map: null,
  data: null,
  popup: null,
  selectedZone: null,
  filters: { sector: 'all', tier: 'all', lga: 'all' }
};

const els = {
  sector: document.querySelector('#sector-filter'),
  tier: document.querySelector('#tier-filter'),
  lga: document.querySelector('#lga-filter'),
  reset: document.querySelector('#reset-filters'),
  zoomHome: document.querySelector('#zoom-home'),
  metricZones: document.querySelector('#metric-zones'),
  metricZonesNote: document.querySelector('#metric-zones-note'),
  metricArea: document.querySelector('#metric-area'),
  metricLgas: document.querySelector('#metric-lgas'),
  metricReduction: document.querySelector('#metric-reduction'),
  ranking: document.querySelector('#lga-ranking'),
  sectors: document.querySelector('#sector-summary'),
  interpretation: document.querySelector('#interpretation-list'),
  loading: document.querySelector('#map-loading'),
  error: document.querySelector('#map-error'),
  coordinates: document.querySelector('#coordinate-readout')
};

const fmt0 = new Intl.NumberFormat('en-NG', { maximumFractionDigits: 0 });
const fmt1 = new Intl.NumberFormat('en-NG', { maximumFractionDigits: 1 });
const fmt2 = new Intl.NumberFormat('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Could not load ${url} (${response.status})`);
  return response.json();
}

async function loadData() {
  const [stateBoundary, lgas, zones, drainage, summary, lgaSummary] = await Promise.all([
    fetchJson(DATA.state),
    fetchJson(DATA.lgas),
    fetchJson(DATA.zones),
    fetchJson(DATA.drainage),
    fetchJson(DATA.summary),
    fetchJson(DATA.lgaSummary)
  ]);

  const lgaByCode = new Map(lgaSummary.map(row => [row.lga_pcode, row]));
  lgas.features.forEach(feature => {
    const row = lgaByCode.get(feature.properties.adm2_pcode);
    feature.properties.lga_name = row?.lga_name ?? feature.properties.adm2_pcode;
  });

  state.data = { stateBoundary, lgas, zones, drainage, summary, lgaSummary };
}

function populateDashboard() {
  const { summary, lgaSummary } = state.data;
  const metrics = summary.headline_metrics;

  els.metricReduction.textContent = `${fmt0.format(metrics.modeled_reduction_t_per_year)} t/yr`;
  els.interpretation.innerHTML = summary.interpretation
    .map(item => `<li>${escapeHtml(item)}</li>`)
    .join('');

  [...lgaSummary]
    .sort((a, b) => a.lga_name.localeCompare(b.lga_name))
    .forEach(row => {
      const option = document.createElement('option');
      option.value = row.lga_name;
      option.textContent = row.lga_name;
      els.lga.append(option);
    });

  renderRanking();
  renderSectors();
  updateMetrics();
}

function renderRanking() {
  const rows = [...state.data.lgaSummary]
    .sort((a, b) => b.primary_delivery_load_index - a.primary_delivery_load_index);
  const max = rows[0].primary_delivery_load_index;

  els.ranking.innerHTML = rows.map((row, index) => {
    const width = (row.primary_delivery_load_index / max) * 100;
    const active = state.filters.lga === row.lga_name ? ' active' : '';
    return `
      <button class="rank-row${active}" type="button" role="listitem"
        data-lga="${escapeHtml(row.lga_name)}" style="--bar:${width.toFixed(2)}%"
        title="${escapeHtml(row.lga_name)}: ${fmt0.format(row.primary_delivery_load_index)} relative load index; ${row.primary_zone_count} zones">
        <span class="rank-number">${index + 1}</span>
        <span class="rank-name">${escapeHtml(row.lga_name)}</span>
        <span class="rank-value">${fmt0.format(row.primary_delivery_load_index)}</span>
      </button>`;
  }).join('');

  els.ranking.querySelectorAll('.rank-row').forEach(button => {
    button.addEventListener('click', () => {
      const next = state.filters.lga === button.dataset.lga ? 'all' : button.dataset.lga;
      els.lga.value = next;
      state.filters.lga = next;
      applyFilters();
    });
  });
}

function renderSectors() {
  const sectors = state.data.summary.sectors.filter(item => item.zones > 0);
  const total = sectors.reduce((sum, item) => sum + item.zones, 0);
  els.sectors.innerHTML = sectors.map(item => {
    const share = total ? (item.zones / total) * 100 : 0;
    return `
      <div class="sector-item">
        <div class="sector-topline"><span>${escapeHtml(item.name)}</span><strong>${item.zones}</strong></div>
        <div class="sector-track"><div class="sector-fill" style="width:${share.toFixed(1)}%"></div></div>
        <div class="sector-meta">${fmt2.format(item.area_km2)} km² · ${share.toFixed(1)}% of zones</div>
      </div>`;
  }).join('');
}

function matchingZones() {
  return state.data.zones.features.filter(feature => {
    const p = feature.properties;
    return (state.filters.sector === 'all' || Number(state.filters.sector) === Number(p.Sector)) &&
      (state.filters.tier === 'all' || Number(state.filters.tier) === Number(p.Tier)) &&
      (state.filters.lga === 'all' || state.filters.lga === p.lga_name);
  });
}

function updateMetrics() {
  const matches = matchingZones();
  const areaKm2 = matches.reduce((sum, feature) => sum + Number(feature.properties.Area_ha || 0), 0) / 100;
  const lgas = new Set(matches.map(feature => feature.properties.lga_name).filter(Boolean));
  const crossLga = matches.filter(feature => Number(feature.properties.lga_count) >= 2).length;

  els.metricZones.textContent = fmt0.format(matches.length);
  els.metricArea.textContent = `${fmt2.format(areaKm2)} km²`;
  els.metricLgas.textContent = fmt0.format(lgas.size);
  els.metricZonesNote.textContent = `${crossLga} cross-LGA ${crossLga === 1 ? 'zone' : 'zones'}`;
}

function mapFilterExpression() {
  const expressions = ['all'];
  if (state.filters.sector !== 'all') expressions.push(['==', ['get', 'Sector'], Number(state.filters.sector)]);
  if (state.filters.tier !== 'all') expressions.push(['==', ['get', 'Tier'], Number(state.filters.tier)]);
  if (state.filters.lga !== 'all') expressions.push(['==', ['get', 'lga_name'], state.filters.lga]);
  return expressions;
}

function applyFilters() {
  state.filters = {
    sector: els.sector.value,
    tier: els.tier.value,
    lga: els.lga.value
  };

  if (state.map?.getLayer('zones-fill')) {
    const filter = mapFilterExpression();
    state.map.setFilter('zones-fill', filter);
    state.map.setFilter('zones-outline', filter);
  }

  state.selectedZone = null;
  if (state.map?.getLayer('zones-selected')) {
    state.map.setFilter('zones-selected', ['==', ['get', 'Zone_ID'], -1]);
  }
  state.popup?.remove();
  updateMetrics();
  renderRanking();
}

function setVisibility(layerIds, visible) {
  layerIds.forEach(id => {
    if (state.map?.getLayer(id)) state.map.setLayoutProperty(id, 'visibility', visible ? 'visible' : 'none');
  });
}

function popupMarkup(properties) {
  const p = properties;
  return `
    <article class="zone-popup">
      <header><small>Intervention zone</small><br><strong>Zone ${escapeHtml(p.Zone_ID)}</strong></header>
      <dl>
        <dt>Priority</dt><dd>Tier ${escapeHtml(p.Tier)}</dd>
        <dt>Sector</dt><dd>${escapeHtml(sectorNames[p.Sector] ?? p.Sector)}</dd>
        <dt>Area</dt><dd>${fmt2.format(Number(p.Area_ha))} ha</dd>
        <dt>Primary LGA</dt><dd>${escapeHtml(p.lga_name)}</dd>
        <dt>P-code</dt><dd>${escapeHtml(p.lga_pcode)}</dd>
        <dt>LGA confidence</dt><dd>${escapeHtml(p.lga_conf)}</dd>
        <dt>Attribution</dt><dd>${escapeHtml(String(p.lga_method).replaceAll('_', ' ').toLowerCase())}</dd>
      </dl>
    </article>`;
}

function addPortfolioLayers(map) {
  const { stateBoundary, lgas, zones, drainage } = state.data;

  map.addSource('state-boundary', { type: 'geojson', data: stateBoundary });
  map.addSource('lga-boundaries', { type: 'geojson', data: lgas });
  map.addSource('intervention-zones', { type: 'geojson', data: zones, promoteId: 'Zone_ID' });
  map.addSource('primary-drainage', { type: 'geojson', data: drainage });

  map.addLayer({ id: 'state-fill', type: 'fill', source: 'state-boundary', paint: { 'fill-color': '#e9f3ee', 'fill-opacity': 0.14 } });
  map.addLayer({ id: 'lga-fill', type: 'fill', source: 'lga-boundaries', paint: { 'fill-color': '#ffffff', 'fill-opacity': 0.01 } });
  map.addLayer({ id: 'drainage-lines', type: 'line', source: 'primary-drainage', minzoom: 6, paint: {
    'line-color': '#3182a8', 'line-width': ['interpolate', ['linear'], ['zoom'], 6, 0.35, 11, 1.05], 'line-opacity': 0.60
  }});
  map.addLayer({ id: 'zones-fill', type: 'fill', source: 'intervention-zones', paint: {
    'fill-color': ['match', ['get', 'Tier'], 1, '#c64b36', 2, '#e4943a', 3, '#2a9d7f', '#aab5ae'],
    'fill-opacity': ['interpolate', ['linear'], ['zoom'], 6, 0.72, 11, 0.88]
  }});
  map.addLayer({ id: 'zones-outline', type: 'line', source: 'intervention-zones', paint: {
    'line-color': '#5e3c20', 'line-width': ['interpolate', ['linear'], ['zoom'], 6, 0.25, 11, 0.9], 'line-opacity': 0.72
  }});
  map.addLayer({ id: 'zones-selected', type: 'line', source: 'intervention-zones', filter: ['==', ['get', 'Zone_ID'], -1], paint: {
    'line-color': '#ffffff', 'line-width': 3.2, 'line-opacity': 1
  }});
  map.addLayer({ id: 'lga-outline', type: 'line', source: 'lga-boundaries', paint: {
    'line-color': '#294954', 'line-width': ['interpolate', ['linear'], ['zoom'], 6, 0.6, 10, 1.25], 'line-opacity': 0.78, 'line-dasharray': [3, 2]
  }});
  map.addLayer({ id: 'state-outline', type: 'line', source: 'state-boundary', paint: {
    'line-color': '#092b35', 'line-width': ['interpolate', ['linear'], ['zoom'], 6, 2.1, 10, 3.1], 'line-opacity': 0.95
  }});
  map.addLayer({ id: 'lga-labels', type: 'symbol', source: 'lga-boundaries', minzoom: 7.2, layout: {
    'text-field': ['get', 'lga_name'], 'text-size': ['interpolate', ['linear'], ['zoom'], 7, 9.5, 10, 12],
    'text-font': ['Noto Sans Regular'], 'text-max-width': 9, 'text-allow-overlap': false
  }, paint: { 'text-color': '#17343e', 'text-halo-color': 'rgba(255,255,255,0.92)', 'text-halo-width': 1.4 } });

  map.on('mouseenter', 'zones-fill', () => { map.getCanvas().style.cursor = 'pointer'; });
  map.on('mouseleave', 'zones-fill', () => { map.getCanvas().style.cursor = ''; });
  map.on('click', 'zones-fill', event => {
    const feature = event.features?.[0];
    if (!feature) return;
    state.selectedZone = Number(feature.properties.Zone_ID);
    map.setFilter('zones-selected', ['==', ['get', 'Zone_ID'], state.selectedZone]);
    state.popup?.remove();
    state.popup = new maplibregl.Popup({ closeButton: true, closeOnClick: false, maxWidth: '310px' })
      .setLngLat(event.lngLat)
      .setHTML(popupMarkup(feature.properties))
      .addTo(map);
  });

  map.on('click', event => {
    const hits = map.queryRenderedFeatures(event.point, { layers: ['zones-fill'] });
    if (!hits.length) {
      state.selectedZone = null;
      map.setFilter('zones-selected', ['==', ['get', 'Zone_ID'], -1]);
      state.popup?.remove();
    }
  });
}

function initializeMap() {
  const map = new maplibregl.Map({
    container: 'map',
    style: 'https://tiles.openfreemap.org/styles/liberty',
    center: [6.99, 6.24],
    zoom: 7.65,
    minZoom: 6.1,
    maxZoom: 15,
    maxBounds: [[5.9, 5.0], [8.1, 7.5]],
    attributionControl: true,
    cooperativeGestures: true
  });
  state.map = map;

  map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'top-right');
  map.addControl(new maplibregl.ScaleControl({ maxWidth: 120, unit: 'metric' }), 'bottom-left');

  map.on('load', () => {
    addPortfolioLayers(map);
    applyFilters();
    map.fitBounds(HOME_BOUNDS, { padding: 32, duration: 0 });
    els.loading.hidden = true;
    els.error.hidden = true;
  });

  map.on('mousemove', event => {
    els.coordinates.textContent = `${event.lngLat.lng.toFixed(5)}°, ${event.lngLat.lat.toFixed(5)}°`;
  });
  map.on('mouseout', () => { els.coordinates.textContent = 'Move over map for coordinates'; });
  map.on('error', event => {
    console.error('MapLibre error:', event.error || event);
  });

  window.setTimeout(() => {
    if (!map.loaded()) {
      els.loading.hidden = true;
      els.error.hidden = false;
    }
  }, 20000);
}

function wireControls() {
  [els.sector, els.tier, els.lga].forEach(control => control.addEventListener('change', applyFilters));
  els.reset.addEventListener('click', () => {
    els.sector.value = 'all';
    els.tier.value = 'all';
    els.lga.value = 'all';
    applyFilters();
  });
  els.zoomHome.addEventListener('click', () => state.map?.fitBounds(HOME_BOUNDS, { padding: 32, duration: 700 }));
  document.querySelectorAll('[data-layer-group]').forEach(input => {
    input.addEventListener('change', () => {
      const groups = { zones: ZONE_LAYER_IDS, lga: LGA_LAYER_IDS, drainage: DRAINAGE_LAYER_IDS };
      setVisibility(groups[input.dataset.layerGroup], input.checked);
    });
  });
}

async function start() {
  try {
    await loadData();
    populateDashboard();
    wireControls();
    initializeMap();
  } catch (error) {
    console.error(error);
    els.loading.hidden = true;
    els.error.hidden = false;
    els.error.textContent = `Dashboard assets could not load: ${error.message}. Run this folder through a local web server.`;
  }
}

start();
