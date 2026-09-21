# Anambra Erosion Prioritization Dashboard

Interactive decision-support dashboard for the **Anambra Soil Erosion, Sediment Connectivity and Intervention Prioritization Project**.

The dashboard presents 441 validated intervention zones covering 163.6749 km² across Anambra State, with sector, priority-tier and LGA filtering; zone attribution details; primary drainage context; and the statewide LGA delivery-load ranking.

## Live dashboard

The GitHub Pages link will appear here after Pages deployment is enabled.

## Key functions

- Interactive MapLibre map with state, LGA, primary-drainage and intervention-zone layers.
- Filters for intervention sector, priority tier and primary LGA.
- Dynamic zone count, mapped area, represented LGAs and cross-LGA count.
- Zone popups showing area, P-code, LGA confidence and attribution method.
- Clickable ranking of all 21 LGAs by relative primary delivery-load index.
- Longitude/latitude cursor readout and metric scale bar.
- Responsive desktop, tablet and mobile presentation.

## Scientific use constraint

This is a decision-support screening product. RUSLE estimates modeled sheet-and-rill detachment rather than measured sediment yield. Connectivity and delivery priority are relative indices. Intervention zones are prioritization units, not construction-ready footprints. Field and engineering verification is required before intervention design or implementation.

## Technology

- MapLibre GL JS 6.10.0
- OpenFreeMap Liberty basemap
- Static HTML, CSS, JavaScript, GeoJSON and JSON
- No ArcGIS subscription, API key, database or server-side application required

## Coordinate reference

- Analysis: WGS 84 / UTM Zone 32N — EPSG:32632
- Web assets: WGS 84 longitude/latitude — EPSG:4326
- Analysis grid: 30 m

## Validation

Stage 14A web-asset QA passed 10/10. Stage 14B data, application and visual checks passed. The detailed record is provided in `STAGE14B_QA.md`.
