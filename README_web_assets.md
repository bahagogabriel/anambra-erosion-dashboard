# Anambra dashboard web assets

These files are lightweight publication copies created from the accepted Anambra GIS outputs. All GeoJSON coordinates are WGS84 longitude and latitude in EPSG:4326.

## Files

- `anambra_state_boundary.geojson` - accepted raster-domain state outline.
- `anambra_lga_boundaries.geojson` - 21 official LGA polygons.
- `anambra_intervention_zones.geojson` - 441 final attributed intervention zones.
- `anambra_primary_drainage.geojson` - accepted primary drainage network.
- `anambra_dashboard_summary.json` - statewide, sector and confidence metrics.
- `anambra_lga_summary.json` - LGA summary records for charts and tables.
- `anambra_web_asset_manifest.csv` - sizes, hashes, feature counts and bounds.

## Interpretation

The layers support interactive screening and communication. They do not replace the authoritative EPSG:32632 geodatabase datasets. RUSLE outputs represent modeled gross sheet-and-rill loss; connectivity and delivery priority are relative indices; and intervention zones require field and engineering verification.

## Drainage source

`C:\GIS_Projects\Anambra_Erosion_Project\outputs\vectors\anambra_stream_network_primary_1km2_state.shp`
