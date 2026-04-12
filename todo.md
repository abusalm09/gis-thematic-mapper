# GIS Thematic Mapper - TODO

## Phase 1: Setup & Schema
- [x] Install GIS dependencies (gdal, shapefile, geojson processing)
- [x] Design and apply database schema (datasets, map_requests, generated_maps, automation_rules, activity_log)
- [x] Setup S3 storage helpers for spatial data files

## Phase 2: Backend API
- [x] File upload endpoint: accept SHP (zip), ECW, DXF with CRS detection
- [x] Dataset management: list, get, delete datasets
- [x] Spatial data processing: convert to GeoJSON for Leaflet rendering
- [x] Map request creation and queue management
- [x] Automated map generation: choropleth, heatmap, proportional symbol
- [x] Map output storage (PNG + PDF) via S3
- [x] Admin API: stats, import status, user management, automation rules
- [x] User limit enforcement (max 3 users)

## Phase 3: Frontend - Layout & Data Management
- [x] Global design system: color palette, typography, CSS variables (dark/elegant theme)
- [x] DashboardLayout with sidebar navigation (GIS Mapper branding, role-based admin link)
- [x] Home/landing page
- [x] Dataset management page: list, metadata, delete
- [x] File upload page with drag-and-drop, format validation, progress

## Phase 4: Leaflet Map Viewer
- [x] Interactive Leaflet map viewer component
- [x] Layer toggling panel
- [x] Zoom controls
- [x] Feature click → attribute inspection popup
- [x] Dataset viewer page integrating map

## Phase 5: Thematic Map Generation
- [x] Map request form: dataset selection, map type, classification, color scheme
- [x] Map generation queue display (status tracking, auto-refresh)
- [x] Map gallery/history page with thumbnails and status filters
- [x] PNG and PDF download options
- [x] Online map preview viewer (MapDetail page)

## Phase 6: Admin Panel
- [x] Admin-only route protection
- [x] Database monitoring dashboard (stats, storage)
- [x] User management (view users, enforce 3-user limit)
- [x] Activity log display
- [x] Automation rule configuration (create, toggle, delete)

## Phase 7: Polish & Testing
- [x] Responsive design across all pages
- [x] Loading states, empty states, error handling
- [x] Vitest unit tests for backend procedures (14 tests passing)
- [x] Final checkpoint and delivery
