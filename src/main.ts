// --- Data Structure Interfaces ---
interface PolygonRecord {
  id: string;
  name: string;
  type: 'parent' | 'standard';
  parentId?: string;
  areaSqKm: number;
  segmentDistancesMeters: number[];
  coordinates: { lat: number; lng: number }[];
  fillColor: string;
  strokeColor: string;
  googlePolygon: google.maps.Polygon;
  labelMarker: google.maps.Marker; 
}

interface GeoJsonFeature {
  type: 'Feature';
  properties: {
    id: string;
    name: string;
    type: 'parent' | 'standard';
    parentId?: string;
    area_sqkm: number;
    segment_distances_m: number[];
    fillColor: string;
    strokeColor: string;
  };
  geometry: {
    type: 'Polygon';
    coordinates: number[][][];
  };
}

// --- Uniform Colors ---
const STANDARD_COLOR = '#2563eb'; 
const PARENT_COLOR = '#000000';   

// --- Application State ---
let map: google.maps.Map;
let infoWindow: google.maps.InfoWindow; 
let isDrawing = false;
let editingPolygonId: string | null = null; 

const expandedSidebarParents = new Set<string>();

let activeCoordinates: google.maps.LatLng[] = [];
let activeMarkers: google.maps.Marker[] = [];
let activePolyline: google.maps.Polyline | null = null;

const savedPolygons: PolygonRecord[] = [];

// UI Elements
const searchBoxElement = document.getElementById('search-box') as HTMLInputElement;
const btnNew = document.getElementById('btn-new') as HTMLButtonElement;
const btnUndo = document.getElementById('btn-undo') as HTMLButtonElement;
const btnFinish = document.getElementById('btn-finish') as HTMLButtonElement;
const btnCancel = document.getElementById('btn-cancel') as HTMLButtonElement;
const btnExport = document.getElementById('btn-export') as HTMLButtonElement;
const btnImport = document.getElementById('btn-import') as HTMLButtonElement;
const fileImport = document.getElementById('file-import') as HTMLInputElement;
const statusDisplay = document.getElementById('status-display') as HTMLDivElement;
const locationList = document.getElementById('location-list') as HTMLDivElement;
const sidebarHeader = document.getElementById('sidebar-header') as HTMLHeadingElement;
const toggleIcon = document.getElementById('toggle-icon') as HTMLSpanElement;

// --- Initialize Map ---
function initMap(): void {
  const defaultLocation = { lat: 8.9806, lng: 38.7578 };

  map = new google.maps.Map(document.getElementById('map') as HTMLElement, {
    zoom: 14,
    center: defaultLocation,
    mapTypeId: 'roadmap',
    disableDefaultUI: false,
  });

  infoWindow = new google.maps.InfoWindow();

  // --- Google Places Search Box Logic ---
  const searchBox = new google.maps.places.SearchBox(searchBoxElement);

  map.addListener('bounds_changed', () => {
    searchBox.setBounds(map.getBounds() as google.maps.LatLngBounds);
  });

  searchBox.addListener('places_changed', () => {
    const places = searchBox.getPlaces();
    if (!places || places.length === 0) return;

    const bounds = new google.maps.LatLngBounds();
    places.forEach((place) => {
      if (!place.geometry || !place.geometry.location) return;
      if (place.geometry.viewport) {
        bounds.union(place.geometry.viewport);
      } else {
        bounds.extend(place.geometry.location);
      }
    });
    map.fitBounds(bounds);
  });

  // --- Event Listeners ---
  map.addListener('click', handleMapClick);

  btnNew.addEventListener('click', startDrawingMode);
  btnUndo.addEventListener('click', undoLastPoint);
  btnFinish.addEventListener('click', finishDrawingMode);
  btnCancel.addEventListener('click', cancelDrawingMode);
  btnExport.addEventListener('click', exportReports);
  
  btnImport.addEventListener('click', () => fileImport.click());
  fileImport.addEventListener('change', handleImport);

  sidebarHeader.addEventListener('click', () => {
    locationList.classList.toggle('collapsed');
    toggleIcon.textContent = locationList.classList.contains('collapsed') ? '▲' : '▼';
  });

  map.addListener('zoom_changed', () => {
    const currentZoom = map.getZoom() || 14;
    savedPolygons.forEach((p) => {
      if (p.labelMarker) {
        const zoomThreshold = p.type === 'parent' ? 14 : 15;
        p.labelMarker.setVisible(currentZoom >= zoomThreshold);
      }
    });
  });

  document.addEventListener('keydown', (e) => {
    if (isDrawing && e.ctrlKey && e.key === 'z') {
      undoLastPoint();
    }
  });

  updateUI();
  restoreProgress();
}

// --- Map Click Handler ---
function handleMapClick(e: google.maps.MapMouseEvent): void {
  if (infoWindow) infoWindow.close();
  if (!isDrawing || !e.latLng) return;

  const latLng = e.latLng;
  activeCoordinates.push(latLng);

  const marker = new google.maps.Marker({
    position: latLng,
    map: map,
    icon: {
      path: google.maps.SymbolPath.CIRCLE,
      scale: 4,
      fillColor: '#FFFFFF',
      fillOpacity: 1,
      strokeColor: '#000000',
      strokeWeight: 2,
    },
  });
  activeMarkers.push(marker);

  if (!activePolyline) {
    activePolyline = new google.maps.Polyline({
      path: activeCoordinates,
      geodesic: true,
      strokeColor: '#FFD700',
      strokeOpacity: 1.0,
      strokeWeight: 3,
      map: map,
    });
  } else {
    activePolyline.setPath(activeCoordinates);
  }

  updateUI();
}

// --- Undo Last Point Logic ---
function undoLastPoint(): void {
  if (!isDrawing || activeCoordinates.length === 0) return;
  activeCoordinates.pop(); 
  const lastMarker = activeMarkers.pop();
  if (lastMarker) lastMarker.setMap(null); 
  if (activePolyline) {
    activePolyline.setPath(activeCoordinates); 
  }
  updateUI();
}

// --- Toggle Clickability helper ---
function togglePolygonsInteractive(interactive: boolean): void {
  savedPolygons.forEach((p) => {
    p.googlePolygon.setOptions({ clickable: interactive });
    p.labelMarker.setOptions({ clickable: interactive });
  });
}

// --- State Controls ---
function startDrawingMode(): void {
  isDrawing = true;
  if (infoWindow) infoWindow.close(); 
  togglePolygonsInteractive(false); 
  clearActiveDrawing();
  
  if (editingPolygonId) {
    (window as any).toggleEditPolygon(editingPolygonId);
  }
  updateUI();
}

function cancelDrawingMode(): void {
  isDrawing = false;
  togglePolygonsInteractive(true); 
  clearActiveDrawing();
  updateUI();
}

function clearActiveDrawing(): void {
  activeCoordinates = [];
  activeMarkers.forEach((marker) => marker.setMap(null));
  activeMarkers = [];
  if (activePolyline) {
    activePolyline.setMap(null);
    activePolyline = null;
  }
}

// --- Text Label Creation ---
function createLabelMarker(name: string, coordinates: { lat: number; lng: number }[] | google.maps.LatLng[], isParent: boolean = false): google.maps.Marker {
  const bounds = new google.maps.LatLngBounds();
  coordinates.forEach((c) => bounds.extend(c));
  
  const currentZoom = map.getZoom() || 14;
  const zoomThreshold = isParent ? 14 : 15;
  
  return new google.maps.Marker({
    position: bounds.getCenter(),
    map: map,
    icon: { path: google.maps.SymbolPath.CIRCLE, scale: 0 }, 
    label: {
      text: name,
      color: isParent ? '#FFD700' : '#ffffff', 
      fontWeight: 'bold',
      fontSize: isParent ? '15px' : '11px',    
      className: 'map-label', 
    },
    clickable: !isDrawing, 
    zIndex: isParent ? 1 : 2,
    visible: currentZoom >= zoomThreshold,
  });
}

// --- Map Menu Click Attachment ---
function attachPolygonClickMenu(polygonInstance: google.maps.Polygon, labelMarker: google.maps.Marker, polygonId: string): void {
  const clickHandler = (e: any) => {
    if (isDrawing) return;
    
    const pRecord = savedPolygons.find(p => p.id === polygonId);
    if (!pRecord) return;

    const position = e.latLng || pRecord.labelMarker.getPosition();
    let menuContent = '';

    if (editingPolygonId === polygonId) {
      menuContent = `
        <div style="padding: 5px; min-width: 140px; font-family: sans-serif; text-align: center;">
          <h4 style="margin-top: 0; margin-bottom: 10px; color: #111827; font-size: 14px;">Editing: ${pRecord.name}</h4>
          <button style="width: 100%; padding: 8px; cursor: pointer; background: #16a34a; color: white; border: none; border-radius: 4px; font-weight: bold;" onclick="toggleEditPolygon('${polygonId}'); closeInfoWindow();">✅ Save Edit</button>
        </div>
      `;
    } else {
      menuContent = `
        <div style="padding: 5px; min-width: 140px; font-family: sans-serif;">
          <h4 style="margin-top: 0; margin-bottom: 10px; color: #111827; font-size: 14px; text-align: center; border-bottom: 1px solid #e5e7eb; padding-bottom: 5px;">${pRecord.name}</h4>
          <div style="display: flex; flex-direction: column; gap: 6px;">
            <button style="padding: 6px; cursor: pointer; background: #4b5563; color: white; border: none; border-radius: 4px;" onclick="renamePolygon('${polygonId}'); closeInfoWindow();">✏️ Edit Name</button>
            <button style="padding: 6px; cursor: pointer; background: #2563eb; color: white; border: none; border-radius: 4px;" onclick="toggleEditPolygon('${polygonId}'); closeInfoWindow();">📍 Reshape</button>
            <button style="padding: 6px; cursor: pointer; background: #dc2626; color: white; border: none; border-radius: 4px;" onclick="deletePolygon('${polygonId}'); closeInfoWindow();">🗑️ Delete</button>
          </div>
        </div>
      `;
    }

    infoWindow.setContent(menuContent);
    infoWindow.setPosition(position);
    infoWindow.open(map);
  };

  polygonInstance.addListener('click', clickHandler);
  labelMarker.addListener('click', clickHandler);
}

(window as any).closeInfoWindow = () => {
  if (infoWindow) infoWindow.close();
};

// --- Core Polygon Processing Logic ---
function finishDrawingMode(): void {
  if (activeCoordinates.length < 3) {
    alert('A valid polygon requires at least 3 points.');
    return;
  }

  const customName = prompt('Please enter a name for this location:');
  if (!customName || customName.trim() === '') {
    alert('Save cancelled. You must provide a name to finish the polygon.');
    return; 
  }

  const areaSqMeters = google.maps.geometry.spherical.computeArea(activeCoordinates);
  const areaSqKm = areaSqMeters / 1000000;
  const segmentDistances: number[] = [];
  
  for (let i = 0; i < activeCoordinates.length; i++) {
    const nextIndex = (i + 1) % activeCoordinates.length;
    const distance = google.maps.geometry.spherical.computeDistanceBetween(
      activeCoordinates[i],
      activeCoordinates[nextIndex]
    );
    segmentDistances.push(Math.round(distance));
  }

  const firstPoint = activeCoordinates[0];
  let parentId: string | undefined = undefined;
  const containingPolygon = savedPolygons.find((p) =>
    google.maps.geometry.poly.containsLocation(firstPoint, p.googlePolygon)
  );

  if (containingPolygon) {
    parentId = containingPolygon.id;
    if (containingPolygon.type !== 'parent') {
      containingPolygon.type = 'parent';
      containingPolygon.strokeColor = PARENT_COLOR;
      containingPolygon.fillColor = PARENT_COLOR;
      
      containingPolygon.googlePolygon.setOptions({
        strokeColor: PARENT_COLOR,
        strokeWeight: 4,
        fillColor: PARENT_COLOR,
        fillOpacity: 0.05, 
        zIndex: 1, 
      });

      const updatedLabel = containingPolygon.labelMarker.getLabel();
      if (updatedLabel) {
        updatedLabel.color = '#FFD700';
        updatedLabel.fontSize = '15px';
        containingPolygon.labelMarker.setLabel(updatedLabel);
        const currentZoom = map.getZoom() || 14;
        containingPolygon.labelMarker.setVisible(currentZoom >= 14);
        containingPolygon.labelMarker.setZIndex(1);
      }
    }
  }

  const polygonId = `poly_${Date.now()}`;
  const polygonInstance = new google.maps.Polygon({
    paths: activeCoordinates,
    strokeColor: STANDARD_COLOR,
    strokeOpacity: 0.9,
    strokeWeight: 1,
    fillColor: STANDARD_COLOR,
    fillOpacity: 0.45,
    map: map,
    clickable: true, 
    zIndex: 2,       
  });

  const finalName = customName.trim();
  const labelMarker = createLabelMarker(finalName, activeCoordinates, false);

  attachPolygonClickMenu(polygonInstance, labelMarker, polygonId);

  const newRecord: PolygonRecord = {
    id: polygonId,
    name: finalName,
    type: 'standard', 
    parentId: parentId,
    areaSqKm: parseFloat(areaSqKm.toFixed(3)),
    segmentDistancesMeters: segmentDistances,
    coordinates: activeCoordinates.map((c) => ({ lat: c.lat(), lng: c.lng() })),
    fillColor: STANDARD_COLOR,
    strokeColor: STANDARD_COLOR,
    googlePolygon: polygonInstance,
    labelMarker: labelMarker,
  };

  savedPolygons.push(newRecord);
  
  isDrawing = false;
  togglePolygonsInteractive(true); 
  saveProgress();
  clearActiveDrawing();
  updateUI();
}

// --- Import Data Logic ---
function handleImport(event: Event): void {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const importedData = JSON.parse(e.target?.result as string);
      
      importedData.forEach((p: any) => {
        if (savedPolygons.find((existing) => existing.id === p.id)) return;

        const updatedType = p.type === 'child' ? 'standard' : p.type;
        const isParent = updatedType === 'parent';
        const finalName = p.name || 'Imported Location';

        const polygonInstance = new google.maps.Polygon({
          paths: p.coordinates,
          strokeColor: isParent ? PARENT_COLOR : STANDARD_COLOR,
          strokeOpacity: 0.9,
          strokeWeight: isParent ? 4 : 1,
          fillColor: isParent ? PARENT_COLOR : STANDARD_COLOR,
          fillOpacity: isParent ? 0.05 : 0.45,
          map: map,
          clickable: !isDrawing,
          zIndex: isParent ? 1 : 2,
        });

        const labelMarker = createLabelMarker(finalName, p.coordinates, isParent);

        attachPolygonClickMenu(polygonInstance, labelMarker, p.id);

        savedPolygons.push({
          id: p.id,
          name: finalName,
          type: updatedType,
          parentId: p.parentId || undefined,
          areaSqKm: p.area_sqkm || p.areaSqKm,
          segmentDistancesMeters: p.perimeter_segment_distances_m || p.segmentDistancesMeters,
          coordinates: p.coordinates,
          fillColor: isParent ? PARENT_COLOR : STANDARD_COLOR,
          strokeColor: isParent ? PARENT_COLOR : STANDARD_COLOR,
          googlePolygon: polygonInstance,
          labelMarker: labelMarker,
        });
      });

      saveProgress();
      updateUI();
      target.value = ''; 
      alert('Data imported successfully!');
    } catch (error) {
      alert('Error reading the file. Please make sure it is a valid survey JSON file.');
    }
  };
  reader.readAsText(file);
}

// --- Reshape Polygon Logic ---
(window as any).toggleEditPolygon = (id: string) => {
  const polygonRecord = savedPolygons.find((p) => p.id === id);
  if (!polygonRecord) return;

  if (editingPolygonId === id) {
    polygonRecord.googlePolygon.setEditable(false);
    editingPolygonId = null;

    const newPath = polygonRecord.googlePolygon.getPath().getArray();
    polygonRecord.coordinates = newPath.map(c => ({ lat: c.lat(), lng: c.lng() }));

    const areaSqMeters = google.maps.geometry.spherical.computeArea(newPath);
    polygonRecord.areaSqKm = parseFloat((areaSqMeters / 1000000).toFixed(3));

    const segmentDistances: number[] = [];
    for (let i = 0; i < newPath.length; i++) {
      const nextIndex = (i + 1) % newPath.length;
      const distance = google.maps.geometry.spherical.computeDistanceBetween(
        newPath[i],
        newPath[nextIndex]
      );
      segmentDistances.push(Math.round(distance));
    }
    polygonRecord.segmentDistancesMeters = segmentDistances;

    const bounds = new google.maps.LatLngBounds();
    newPath.forEach((c) => bounds.extend(c));
    polygonRecord.labelMarker.setPosition(bounds.getCenter());

    saveProgress();
    updateUI();
    
  } else {
    if (editingPolygonId) {
      const prevEditing = savedPolygons.find((p) => p.id === editingPolygonId);
      if (prevEditing) prevEditing.googlePolygon.setEditable(false);
    }
    editingPolygonId = id;
    polygonRecord.googlePolygon.setEditable(true);
    updateUI();
  }
};

// --- Sidebar Dashboard & Rename/Delete Logic ---
(window as any).renamePolygon = (id: string) => {
  const polygon = savedPolygons.find((p) => p.id === id);
  if (!polygon) return;

  const newName = prompt('Enter a new name for this location:', polygon.name);
  if (newName && newName.trim() !== '') {
    polygon.name = newName.trim();
    
    const updatedLabel = polygon.labelMarker.getLabel();
    if (updatedLabel) {
      updatedLabel.text = polygon.name;
      polygon.labelMarker.setLabel(updatedLabel);
    }
    
    saveProgress();
    updateUI();
  }
};

(window as any).deletePolygon = (id: string) => {
  const polygon = savedPolygons.find((p) => p.id === id);
  if (!polygon) return;

  if (!confirm(`Are you sure you want to delete "${polygon.name}"?`)) return;
  if (infoWindow) infoWindow.close(); 

  const index = savedPolygons.findIndex((p) => p.id === id);
  if (index === -1) return;

  savedPolygons[index].googlePolygon.setMap(null);
  savedPolygons[index].labelMarker.setMap(null);
  savedPolygons.splice(index, 1);

  saveProgress();
  updateUI();
};

(window as any).toggleSidebarParent = (id: string) => {
  if (expandedSidebarParents.has(id)) {
    expandedSidebarParents.delete(id);
  } else {
    expandedSidebarParents.add(id);
  }
  renderSidebar();
};

function renderSidebar(): void {
  if (!locationList) return;
  if (savedPolygons.length === 0) {
    locationList.innerHTML = '<p class="empty-msg">No locations saved yet.</p>';
    return;
  }
  
  const topLevelPolygons = savedPolygons.filter(p => 
    !p.parentId || !savedPolygons.some(parent => parent.id === p.parentId)
  );

  let html = '';

  topLevelPolygons.forEach(p => {
    const children = savedPolygons.filter(child => child.parentId === p.id);
    const hasChildren = children.length > 0;
    const isExpanded = expandedSidebarParents.has(p.id);

    html += `
      <div class="location-item ${editingPolygonId === p.id ? 'editing' : ''}">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <strong>${p.name}</strong>
          ${hasChildren ? `
            <button style="background: none; border: none; cursor: pointer; font-size: 14px; padding: 2px 6px;" onclick="toggleSidebarParent('${p.id}')">
              ${isExpanded ? '▼' : '▶'}
            </button>
          ` : ''}
        </div>
        <span>${p.areaSqKm} sq km | Type: ${p.type.toUpperCase()}</span>
        <div class="action-buttons">
          <button class="btn primary" onclick="toggleEditPolygon('${p.id}')">
            ${editingPolygonId === p.id ? 'Save Edit' : 'Reshape'}
          </button>
          <button class="btn secondary" onclick="renamePolygon('${p.id}')" ${editingPolygonId === p.id ? 'disabled' : ''}>Rename</button>
          <button class="btn danger" onclick="deletePolygon('${p.id}')" ${editingPolygonId === p.id ? 'disabled' : ''}>Delete</button>
        </div>
      </div>
    `;

    if (hasChildren && isExpanded) {
      html += `<div style="margin-left: 15px; border-left: 2px solid #e5e7eb; padding-left: 10px; display: flex; flex-direction: column; gap: 8px; margin-top: 5px; margin-bottom: 5px;">`;
      
      children.forEach(child => {
        html += `
          <div class="location-item ${editingPolygonId === child.id ? 'editing' : ''}" style="background: #f3f4f6;">
            <strong>${child.name}</strong>
            <span>${child.areaSqKm} sq km | Nested Zone</span>
            <div class="action-buttons">
              <button class="btn primary" onclick="toggleEditPolygon('${child.id}')">
                ${editingPolygonId === child.id ? 'Save Edit' : 'Reshape'}
              </button>
              <button class="btn secondary" onclick="renamePolygon('${child.id}')" ${editingPolygonId === child.id ? 'disabled' : ''}>Rename</button>
              <button class="btn danger" onclick="deletePolygon('${child.id}')" ${editingPolygonId === child.id ? 'disabled' : ''}>Delete</button>
            </div>
          </div>
        `;
      });
      html += `</div>`;
    }
  });

  locationList.innerHTML = html;
}

// --- UI State Sync ---
function updateUI(): void {
  btnNew.disabled = isDrawing || editingPolygonId !== null; 
  btnUndo.disabled = !isDrawing || activeCoordinates.length === 0;
  btnFinish.disabled = !isDrawing || activeCoordinates.length < 3;
  btnCancel.disabled = !isDrawing;
  btnExport.disabled = savedPolygons.length === 0;

  let modeText = 'Idle';
  if (isDrawing) modeText = 'ACTIVE DRAWING';
  if (editingPolygonId) modeText = 'RESHAPING POLYGON';

  statusDisplay.innerHTML = `Mode: <strong>${modeText}</strong> | Points Collected: <strong>${activeCoordinates.length}</strong> | Shapes Saved: <strong>${savedPolygons.length}</strong>`;
  renderSidebar(); 
}

// --- Auto-Save & Restore Logic ---
function saveProgress(): void {
  const dataToSave = savedPolygons.map((p) => ({
    id: p.id,
    name: p.name,
    type: p.type,
    parentId: p.parentId,
    areaSqKm: p.areaSqKm,
    segmentDistancesMeters: p.segmentDistancesMeters,
    coordinates: p.coordinates,
    fillColor: p.fillColor,
    strokeColor: p.strokeColor,
  }));
  localStorage.setItem('survey_backup', JSON.stringify(dataToSave));
}

function restoreProgress(): void {
  const cachedData = localStorage.getItem('survey_backup');
  if (!cachedData) return;

  const parsedData = JSON.parse(cachedData);

  parsedData.forEach((p: any) => {
    const isParent = p.type === 'parent';
    const polygonInstance = new google.maps.Polygon({
      paths: p.coordinates,
      strokeColor: p.strokeColor,
      strokeOpacity: 0.9,
      strokeWeight: isParent ? 4 : 1,
      fillColor: p.fillColor,
      fillOpacity: isParent ? 0.05 : 0.45,
      map: map,
      clickable: !isDrawing,
      zIndex: isParent ? 1 : 2,
    });

    const labelMarker = createLabelMarker(p.name, p.coordinates, isParent);
    attachPolygonClickMenu(polygonInstance, labelMarker, p.id);

    savedPolygons.push({
      ...p,
      googlePolygon: polygonInstance,
      labelMarker: labelMarker,
    });
  });

  updateUI();
}

// --- Export Files ---
function exportReports(): void {
  if (savedPolygons.length === 0) {
    alert('No polygons available to export.');
    return;
  }

  const customJsonData = savedPolygons.map((p, index) => ({
    order: index + 1,
    id: p.id,
    name: p.name,
    type: p.type,
    parentId: p.parentId || null,
    area_sqkm: p.areaSqKm,
    perimeter_segment_distances_m: p.segmentDistancesMeters,
    coordinates: p.coordinates,
  }));

  const geoJsonFeatures: GeoJsonFeature[] = savedPolygons.map((p) => {
    const closedCoords = [...p.coordinates, p.coordinates[0]];
    const formattedGeoCoords = closedCoords.map((c) => [c.lng, c.lat]);
    return {
      type: 'Feature',
      properties: {
        id: p.id, name: p.name, type: p.type, parentId: p.parentId,
        area_sqkm: p.areaSqKm, segment_distances_m: p.segmentDistancesMeters,
        fillColor: p.fillColor, strokeColor: p.strokeColor,
      },
      geometry: { type: 'Polygon', coordinates: [formattedGeoCoords] },
    };
  });

  let parentOrderTracker = 1;
  const driverListData = savedPolygons
    .filter(p => !p.parentId || !savedPolygons.some(parent => parent.id === p.parentId))
    .map((parent) => {
      let childOrderTracker = 1;
      const children = savedPolygons
        .filter((child) => child.parentId === parent.id)
        .map((child) => ({
          order: childOrderTracker++,
          place_id: child.id,
          lat: child.coordinates[0].lat,
          lng: child.coordinates[0].lng,
          name: child.name,
        }));

      const result: any = {
        order: parentOrderTracker++,
        place_id: parent.id, lat: parent.coordinates[0].lat,
        lng: parent.coordinates[0].lng, name: parent.name,
      };
      if (children.length > 0) result.children = children;
      return result;
    });

  downloadBlob(JSON.stringify(customJsonData, null, 2), 'survey_raw_data.json', 'application/json');
  downloadBlob(JSON.stringify({ type: 'FeatureCollection', features: geoJsonFeatures }, null, 2), 'survey_map.geojson', 'application/geo+json');
  downloadBlob(JSON.stringify(driverListData, null, 2), 'driver_dropdown_list.json', 'application/json');
}

function downloadBlob(content: string, filename: string, contentType: string): void {
  const blob = new Blob([content], { type: contentType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// Start app on script load
initMap();