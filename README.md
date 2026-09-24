# Geospatial Neighborhood Mapping Tool

A professional, web-based tool for drawing, editing, and managing hierarchical geospatial zones (polygons) using the Google Maps API. Built with TypeScript and Vite.

This application allows teams to map out parent districts and standard delivery/service zones, organize them hierarchically, and export the data into standard database formats, mobile-ready folder structures, and universal GeoJSON files.

## 🚀 Features

* **Smart Drawing & Editing:** Draw custom polygons, undo points instantly (`Ctrl+Z`), and reshape or delete zones via interactive pop-up menus.
* **Hierarchical Organization:** Create "Parent" boundaries that act as folders to contain standard "Child" zones.
* **Interactive Sidebar & Search:** Instantly fly to any saved zone using the local datalist search, and manage visibility through collapsible folder trees.
* **Local Auto-Save:** Automatically persists your mapping progress to the browser's local storage.
* **Robust Data Export:** Export your map into three distinct formats:
  * `survey_raw_data.json`: Flat database structure with `parentId` relational links.
  * `driver_dropdown_list.json`: Nested folder structure for mobile app UI generation.
  * `survey_map.geojson`: Industry-standard format for importing into QGIS, ArcGIS, or other mapping software.

---

## 🔑 Getting Your Google Maps API Key (Required)

To run this application locally, you must generate your own Google Maps API key. **The application only requires the core Maps JavaScript API.** You do not need to enable billing-heavy APIs like Places or Geocoding.

### Step-by-Step API Key Setup:
1. Go to the [Google Cloud Console](https://console.cloud.google.com/).
2. Create a **New Project** (or select an existing one).
3. In the left-hand menu, navigate to **APIs & Services > Library**.
4. Search for and click on **Maps JavaScript API**, then click **Enable**.
5. Navigate to **APIs & Services > Credentials**.
6. Click **+ CREATE CREDENTIALS** at the top of the screen and select **API key**.
7. Copy your new API Key. 

### Securing Your Key:
To prevent unauthorized use, click on your newly created key to edit its restrictions:
* Under **Application restrictions**, select **Websites (HTTP referrers)** and add your local or production URLs (e.g., `http://localhost:5173/*`).
* Under **API restrictions**, choose **Restrict key** and select ONLY the **Maps JavaScript API**.

### Adding the Key to the Project:
Open the `index.html` file in the root of the project. Locate the Google Maps script tag near the bottom and replace `YOUR_API_KEY_HERE` with your actual key:

```html
<!-- The 'geometry' library is required for area calculation and parent-child bounding logic -->
<script src="https://maps.googleapis.com/maps/api/js?key=YOUR_API_KEY_HERE&libraries=geometry"></script>
```

---

## 💻 Installation & Local Setup

1. **Clone the repository:**
   ```bash
   git clone <your-github-repo-url>
   cd geospatial-mapping-tool
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Run the development server:**
   ```bash
   npm run dev
   ```

4. Open your browser and navigate to the local URL provided by Vite (usually `http://localhost:5173`).

---

## 📖 How to Use the Tool

### 1. Drawing Zones
* Select a zone type from the top bar: **Parent Zone** (acts as a folder/district) or **Standard Zone** (sub-regions).
* Click on the map to drop vertices. 
* To complete the shape, click back on your starting point.
* **Mistake?** Press `Ctrl+Z` to undo your last clicked point while drawing.

### 2. Editing Zones
* Click on any completed polygon to open the InfoWindow menu.
* **Reshape:** Click "Edit Shape" to reveal draggable markers on the polygon's corners. Click "Save Shape" when finished.
* **Rename:** Click "Rename" to update the zone's label.
* **Delete:** Click "Delete" to permanently remove the zone from the map.

### 3. Importing & Exporting Data
Use the buttons in the left sidebar to manage your data files:
* **Import Data:** Upload a previously saved `survey_raw_data.json` file to restore your map.
* **Export Reports:** Downloads all three necessary mapping files (Raw Data, Nested Dropdown List, and GeoJSON).
* **Reset Map:** Clears the canvas and wipes local storage. *(Ensure you have exported your data first!)*
