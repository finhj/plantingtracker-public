import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { X, Move, Info } from "lucide-react";

/*
  Planting Map (OpenStreetMap edition) — real, zoomable/pannable map instead of
  a static photo. Marker positions are derived from two GPS reference points
  (the barn, and the Field 6 SW corner) applied to the hand-drawn map's layout,
  so they're approximate — drag-to-adjust in edit mode fixes any that are off.
  Leaflet is loaded from a CDN at runtime since it isn't a bundled import here.
*/

const PAPER = "#F1EEE2";
const INK = "#2B2A24";
const FIELD = "#4B6B3A";
const TUNNEL = "#3D6B7A";
const PLOT = "#8A6B3A";
const GREENHOUSE = "#B04A8A";
const REF = "#8a8272";
const GOLD = "#C68A2E";
const RUST = "#A0472E";
const SOIL = "#B9AD95";

const TYPE_COLOR = { field: FIELD, tunnel: TUNNEL, plot: PLOT, greenhouse: GREENHOUSE, reference: REF };

const CROP_FAMILIES = {
  Tomato: "#A0472E", Pepper: "#C1562E", Eggplant: "#5B4B8A", Cucumber: "#4B6B3A",
  Squash: "#C68A2E", Zucchini: "#7A8B3A", Lettuce: "#6E9B4A", Kale: "#3F7A4E",
  Spinach: "#2F6B3E", Chard: "#8B7A3A", Carrot: "#D07A2E", Beet: "#8A2E4A",
  Radish: "#B8496A", Onion: "#8A6B3A", Garlic: "#A88B4A", Bean: "#4B7A4A",
  Pea: "#5B9B5A", Potato: "#7A5A3A", Corn: "#C6A62E", Herbs: "#5B7A4A",
  Strawberry: "#B0304A", Flowers: "#B04A8A", Other: "#6B6255",
};
const familyColor = (crop) => {
  const key = Object.keys(CROP_FAMILIES).find((f) => crop.toLowerCase().includes(f.toLowerCase()));
  return CROP_FAMILIES[key] || CROP_FAMILIES.Other;
};

function uid(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}
function daysBetween(a, b) {
  return Math.round((new Date(b) - new Date(a)) / 86400000);
}
function bedKey(sectionId, bed) {
  return `${sectionId}__${bed}`;
}
function tileBackground(entries) {
  if (!entries || entries.length === 0) return SOIL;
  if (entries.length === 1) return familyColor(entries[0].crop);
  const colors = entries.map((e) => familyColor(e.crop));
  const step = 100 / colors.length;
  const stops = colors.map((c, i) => `${c} ${i * step}%, ${c} ${(i + 1) * step}%`).join(", ");
  return `linear-gradient(135deg, ${stops})`;
}

async function loadData() {
  try {
    const res = await window.storage.get("planting-map-osm-v1");
    if (res && res.value) return JSON.parse(res.value);
  } catch (e) { /* fresh start */ }
  return null;
}
async function saveData(data) {
  try {
    await window.storage.set("planting-map-osm-v1", JSON.stringify(data));
    return true;
  } catch (e) {
    console.error("Storage error", e);
    return false;
  }
}

// Coordinates derived from: Barn = 41.33814, -73.04185 and Field 6 SW corner =
// 41.33638, -73.04122, applied to each label's position on the hand-drawn map.
function defaultLocations() {
  const field = (id, name, sections) => ({ id, name, type: "field", sections });
  const single = (id, name, type, lat, lng) => ({ id, name, type, sections: [{ id: id + "_main", name, lat, lng, beds: 1 }] });
  const sec = (id, name, lat, lng) => ({ id, name, lat, lng, beds: 1 });

  return [
    field("f1", "Field 1 / Upper Field", [
      sec("f1_nw", "NW", 41.341293, -73.042424),
      sec("f1_ne", "NE", 41.341315, -73.042017),
      sec("f1_sw", "SW", 41.339955, -73.042234),
      sec("f1_se", "SE", 41.339927, -73.041932),
    ]),
    single("f2", "Field 2", "field", 41.339944, -73.041475),
    field("f3", "Field 3 / Lower Field", [
      sec("f3_nn", "NN", 41.341179, -73.039952),
      sec("f3_n", "N", 41.34051, -73.039857),
      sec("f3_s", "S", 41.338946, -73.039179),
    ]),
    field("f4", "Field 4 / U-Pick", [
      sec("f4_n", "N", 41.339027, -73.041299),
      sec("f4_e", "E", 41.338715, -73.041174),
      sec("f4_w", "W", 41.338749, -73.041526),
      sec("f4_s", "S", 41.338492, -73.041345),
    ]),
    field("f6", "Field 6", [
      sec("f6_nw", "NW", 41.337708, -73.04131),
      sec("f6_sw", "SW", 41.33638, -73.04122),
      sec("f6_e", "E", 41.337489, -73.040265),
    ]),
    single("greenhouse", "Greenhouse", "greenhouse", 41.33807, -73.04133),
    single("ht", "High Tunnel", "tunnel", 41.338032, -73.040928),
    single("omt1", "OMT 1", "tunnel", 41.337418, -73.040777),
    single("som1", "SOM1", "plot", 41.337385, -73.040426),
    single("omt2", "OMT 2", "tunnel", 41.337351, -73.040074),
    single("somt2", "SOMT2", "plot", 41.337318, -73.039722),
    single("nft1", "NFT1", "plot", 41.337061, -73.040808),
    single("ft1", "FT1", "tunnel", 41.337028, -73.040456),
    single("sft1", "SFT1", "plot", 41.336994, -73.040104),
    single("ft2", "FT2", "tunnel", 41.336961, -73.039753),
    single("sft2", "SFT2", "plot", 41.336704, -73.040838),
    single("ft3", "FT3", "tunnel", 41.336671, -73.040486),
    single("sft3", "SFT3", "plot", 41.336637, -73.040135),
    single("ft4", "FT4", "tunnel", 41.336604, -73.039783),
    single("ft5", "FT5", "tunnel", 41.336347, -73.040868),
    single("cat1", "Cat 1", "tunnel", 41.336313, -73.040517),
    single("cat2", "Cat 2", "tunnel", 41.33628, -73.040165),
    single("barn", "Barn", "reference", 41.338118, -73.041832),
    single("chicken", "Chicken World", "reference", 41.340308, -73.040887),
    single("goat", "Goat World", "reference", 41.338723, -73.040616),
    single("trail", "Nature Trail", "reference", 41.338313, -73.040094),
  ];
}

function useLeaflet() {
  const [ready, setReady] = useState(!!(typeof window !== "undefined" && window.L));
  useEffect(() => {
    if (ready) return;
    if (window.L) { setReady(true); return; }
    const css = document.createElement("link");
    css.rel = "stylesheet";
    css.href = "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css";
    document.head.appendChild(css);
    const script = document.createElement("script");
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js";
    script.onload = () => setReady(true);
    document.body.appendChild(script);
  }, [ready]);
  return ready;
}

export default function PlantingMapOSM() {
  const leafletReady = useLeaflet();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [locations, setLocations] = useState([]);
  const [plantings, setPlantings] = useState({});
  const [editMode, setEditMode] = useState(false);
  const [sectionPanel, setSectionPanel] = useState(null);
  const [bedPanel, setBedPanel] = useState(null);
  const [entryModal, setEntryModal] = useState(null);
  const [error, setError] = useState("");

  const mapRef = useRef(null);
  const mapInstance = useRef(null);
  const markerRefs = useRef({});
  const stateRef = useRef({ editMode, locations, plantings });
  stateRef.current = { editMode, locations, plantings };

  useEffect(() => {
    (async () => {
      const data = await loadData();
      if (data && data.locations) {
        setLocations(data.locations);
        setPlantings(data.plantings || {});
      } else {
        const defaults = defaultLocations();
        setLocations(defaults);
        await saveData({ locations: defaults, plantings: {} });
      }
      setLoading(false);
    })();
  }, []);

  const persist = useCallback(async (nextLocations, nextPlantings) => {
    setSaving(true);
    const ok = await saveData({ locations: nextLocations, plantings: nextPlantings });
    setError(ok ? "" : "Couldn't save — your last change may not persist.");
    setSaving(false);
  }, []);

  const allSections = useMemo(() => {
    const rows = [];
    locations.forEach((loc) => {
      loc.sections.forEach((s) => rows.push({ ...s, locName: loc.name, type: loc.type, locId: loc.id, multi: loc.sections.length > 1 }));
    });
    return rows;
  }, [locations]);

  const bedsPlantedCount = useCallback((section) => {
    let n = 0;
    for (let b = 1; b <= section.beds; b++) if ((plantings[bedKey(section.id, b)] || []).length) n++;
    return n;
  }, [plantings]);

  // Initialize the Leaflet map once
  useEffect(() => {
    if (!leafletReady || loading || mapInstance.current || !mapRef.current) return;
    const L = window.L;
    const map = L.map(mapRef.current, { zoomControl: true }).setView([41.33814, -73.04185], 17);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 20,
      attribution: '© OpenStreetMap contributors',
    }).addTo(map);
    mapInstance.current = map;

    // fit to all markers once locations are known
    const pts = allSections.map((s) => [s.lat, s.lng]);
    if (pts.length) {
      map.fitBounds(L.latLngBounds(pts), { padding: [30, 30] });
    }
  }, [leafletReady, loading]); // eslint-disable-line react-hooks/exhaustive-deps

  // Sync markers whenever sections/plantings/editMode change
  useEffect(() => {
    if (!leafletReady || !mapInstance.current) return;
    const L = window.L;
    const map = mapInstance.current;
    const currentIds = new Set(allSections.map((s) => s.id));

    // remove stale markers
    Object.keys(markerRefs.current).forEach((id) => {
      if (!currentIds.has(id)) {
        map.removeLayer(markerRefs.current[id]);
        delete markerRefs.current[id];
      }
    });

    allSections.forEach((s) => {
      const planted = bedsPlantedCount(s);
      const baseColor = TYPE_COLOR[s.type] || REF;
      const color = planted > 0 ? GOLD : baseColor;
      const size = s.type === "reference" ? 10 : 16;
      const icon = L.divIcon({
        className: "",
        html: `<div style="width:${size}px;height:${size}px;border-radius:50%;background:${color};border:2px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,0.5);${s.beds > 1 ? `display:flex;align-items:center;justify-content:center;color:#fff;font-size:8px;font-weight:700;font-family:monospace;` : ""}">${s.beds > 1 ? s.beds : ""}</div>`,
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2],
      });

      let marker = markerRefs.current[s.id];
      if (!marker) {
        marker = L.marker([s.lat, s.lng], { icon, draggable: false });
        marker.addTo(map);
        marker.on("click", () => {
          const st = stateRef.current;
          if (st.editMode) return;
          const sec = st.locations.flatMap((l) => l.sections.map((sc) => ({ ...sc, locName: l.name, type: l.type, multi: l.sections.length > 1 }))).find((x) => x.id === s.id);
          if (sec && sec.type !== "reference") setSectionPanel(sec);
        });
        marker.on("dragend", () => {
          const ll = marker.getLatLng();
          setLocations((prev) => {
            const next = prev.map((loc) => ({
              ...loc,
              sections: loc.sections.map((sc) => (sc.id === s.id ? { ...sc, lat: ll.lat, lng: ll.lng } : sc)),
            }));
            persist(next, stateRef.current.plantings);
            return next;
          });
        });
        markerRefs.current[s.id] = marker;
      } else {
        marker.setLatLng([s.lat, s.lng]);
        marker.setIcon(icon);
      }
      marker.dragging[editMode && s.type !== "reference" ? "enable" : "disable"]();

      if (!marker.getTooltip()) {
        marker.bindTooltip(s.multi ? `${s.locName} — ${s.name}` : s.locName, { permanent: editMode || s.type === "reference", direction: "top", offset: [0, -size / 2], className: "pm-osm-tooltip" });
      } else {
        marker.setTooltipContent(s.multi ? `${s.locName} — ${s.name}` : s.locName);
        if (editMode || s.type === "reference") marker.openTooltip(); else if (!(s.type === "reference")) marker.closeTooltip();
      }
    });
  }, [leafletReady, allSections, editMode, bedsPlantedCount, persist]);

  const setSectionBeds = (sectionId, beds) => {
    setLocations((prev) => {
      const next = prev.map((loc) => ({
        ...loc,
        sections: loc.sections.map((s) => (s.id === sectionId ? { ...s, beds } : s)),
      }));
      setPlantings((prevPlantings) => {
        const nextPlantings = {};
        Object.entries(prevPlantings).forEach(([key, val]) => {
          const [sid, bedStr] = key.split("__");
          if (sid !== sectionId || Number(bedStr) <= beds) nextPlantings[key] = val;
        });
        persist(next, nextPlantings);
        return nextPlantings;
      });
      return next;
    });
  };

  const saveEntry = (sectionId, bed, entry) => {
    const key = bedKey(sectionId, bed);
    const existingList = plantings[key] || [];
    const exists = existingList.some((e) => e.id === entry.id);
    const nextList = exists ? existingList.map((e) => (e.id === entry.id ? entry : e)) : [...existingList, entry];
    const next = { ...plantings, [key]: nextList };
    setPlantings(next);
    persist(locations, next);
    setEntryModal(null);
  };
  const deleteEntry = (sectionId, bed, entryId) => {
    const key = bedKey(sectionId, bed);
    const nextList = (plantings[key] || []).filter((e) => e.id !== entryId);
    const next = { ...plantings };
    if (nextList.length) next[key] = nextList;
    else delete next[key];
    setPlantings(next);
    persist(locations, next);
    setEntryModal(null);
  };

  const resetPositions = () => {
    if (!confirm("Reset all markers to their computed default positions? Your plantings and bed counts stay the same.")) return;
    const defaults = defaultLocations();
    const posById = {};
    defaults.forEach((loc) => loc.sections.forEach((s) => { posById[s.id] = { lat: s.lat, lng: s.lng }; }));
    setLocations((prev) => {
      const next = prev.map((loc) => ({
        ...loc,
        sections: loc.sections.map((s) => (posById[s.id] ? { ...s, lat: posById[s.id].lat, lng: posById[s.id].lng } : s)),
      }));
      persist(next, plantings);
      return next;
    });
  };

  const plantedList = useMemo(() => {
    const rows = [];
    allSections.forEach((s) => {
      for (let b = 1; b <= s.beds; b++) {
        const entries = plantings[bedKey(s.id, b)];
        if (entries && entries.length) rows.push({ section: s, bed: b, entries });
      }
    });
    return rows.sort((a, b) => a.section.locName.localeCompare(b.section.locName) || a.bed - b.bed);
  }, [allSections, plantings]);

  if (loading || !leafletReady) {
    return (
      <div style={{ background: PAPER, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'IBM Plex Sans', sans-serif", color: INK }}>
        Loading map…
      </div>
    );
  }

  return (
    <div style={{ background: PAPER, minHeight: "100vh", color: INK, fontFamily: "'IBM Plex Sans', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Zilla+Slab:wght@500;700&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap');
        * { box-sizing: border-box; }
        .pm-btn { cursor: pointer; border: none; font-family: 'IBM Plex Sans', sans-serif; transition: transform 0.12s ease, opacity 0.12s ease; }
        .pm-btn:active { transform: scale(0.96); }
        .pm-tile { cursor: pointer; transition: transform 0.1s ease; }
        .pm-tile:hover { transform: translateY(-2px); }
        input, select, textarea { font-family: 'IBM Plex Sans', sans-serif; }
        .pm-osm-tooltip { font-family: 'IBM Plex Mono', monospace !important; font-size: 10px !important; }
        .leaflet-container { font-family: 'IBM Plex Sans', sans-serif; }
      `}</style>

      <header style={{ padding: "20px 16px 12px", borderBottom: `2px solid ${INK}` }}>
        <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, letterSpacing: 2, textTransform: "uppercase", color: FIELD, marginBottom: 4 }}>
          Farm Map · OpenStreetMap
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
          <h1 style={{ fontFamily: "'Zilla Slab', serif", fontWeight: 700, fontSize: 26, margin: 0 }}>Planting Map</h1>
          <div style={{ display: "flex", gap: 8 }}>
            {editMode && (
              <button className="pm-btn" onClick={resetPositions} style={{ background: "transparent", border: `1.5px solid ${INK}`, color: INK, padding: "9px 12px", borderRadius: 3, fontSize: 13, fontWeight: 600 }}>
                Reset positions
              </button>
            )}
            <button
              className="pm-btn"
              onClick={() => setEditMode((v) => !v)}
              style={{ display: "flex", alignItems: "center", gap: 6, background: editMode ? GOLD : INK, color: "#fff", padding: "9px 14px", borderRadius: 3, fontSize: 13, fontWeight: 600 }}
            >
              <Move size={14} /> {editMode ? "Done adjusting" : "Adjust positions"}
            </button>
          </div>
        </div>
        {editMode && (
          <div style={{ marginTop: 10, fontSize: 13, color: "#6B6255", display: "flex", gap: 6 }}>
            <Info size={15} style={{ flexShrink: 0, marginTop: 1 }} />
            <span>Drag any marker on the map to its real spot. Zoom in for precision — changes save automatically.</span>
          </div>
        )}
        {error && <div style={{ marginTop: 8, color: RUST, fontSize: 13 }}>{error}</div>}
      </header>

      <div style={{ maxWidth: 900, margin: "0 auto", padding: 16 }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginBottom: 14, fontSize: 12 }}>
          {[["Field", FIELD], ["Tunnel", TUNNEL], ["Small plot", PLOT], ["Greenhouse", GREENHOUSE], ["Reference", REF]].map(([label, color]) => (
            <div key={label} style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <span style={{ width: 10, height: 10, borderRadius: "50%", background: color, display: "inline-block" }} />
              {label}
            </div>
          ))}
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <span style={{ width: 10, height: 10, borderRadius: "50%", background: GOLD, display: "inline-block" }} />
            Has planted beds
          </div>
        </div>

        <div
          ref={mapRef}
          style={{ width: "100%", height: "58vh", minHeight: 380, border: `2px solid ${INK}`, borderRadius: 4 }}
        />

        <div style={{ marginTop: 22 }}>
          <div style={{ fontSize: 12, letterSpacing: 1, textTransform: "uppercase", color: "#6B6255", marginBottom: 10, fontFamily: "'IBM Plex Mono', monospace" }}>
            Currently planted ({plantedList.length} beds)
          </div>
          {plantedList.length === 0 ? (
            <div style={{ fontSize: 14, color: "#8a8272" }}>Nothing planted yet — tap any dot on the map, then tap a bed.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {plantedList.map(({ section, bed, entries }) => {
                const anyReady = entries.some((p) => p.expectedHarvest && daysBetween(new Date(), p.expectedHarvest) <= 0);
                return (
                  <div
                    key={bedKey(section.id, bed)}
                    onClick={() => setBedPanel({ section, bed })}
                    style={{ cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center", padding: "9px 11px", borderRadius: 3, background: "#fff", border: "1px solid #E6E0D0" }}
                  >
                    <div>
                      <span style={{ fontWeight: 600 }}>
                        {section.multi ? `${section.locName} — ${section.name}` : section.locName}
                        {section.beds > 1 ? ` · Bed ${bed}` : ""}
                      </span>
                      <span style={{ color: "#6B6255" }}>{" · "}{entries.map((e) => e.crop).join(", ")}</span>
                      <div style={{ fontSize: 12, color: "#6B6255", fontFamily: "'IBM Plex Mono', monospace" }}>
                        {entries.length > 1 ? `${entries.length} plantings sharing this bed` : `Planted ${entries[0].plantedDate || "—"}`}
                      </div>
                    </div>
                    {anyReady && (
                      <span style={{ background: GOLD, color: "#fff", fontSize: 11, fontWeight: 600, padding: "3px 8px", borderRadius: 20, flexShrink: 0, marginLeft: 8 }}>
                        Ready
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {saving && (
        <div style={{ position: "fixed", bottom: 14, right: 14, fontSize: 12, color: "#6B6255", fontFamily: "'IBM Plex Mono', monospace" }}>
          Saving…
        </div>
      )}

      {sectionPanel && (
        <SectionPanel
          section={sectionPanel}
          plantings={plantings}
          onClose={() => setSectionPanel(null)}
          onSetBeds={(beds) => setSectionBeds(sectionPanel.id, beds)}
          onOpenBed={(bed) => setBedPanel({ section: sectionPanel, bed })}
        />
      )}

      {bedPanel && (
        <BedPanel
          section={bedPanel.section}
          bed={bedPanel.bed}
          entries={plantings[bedKey(bedPanel.section.id, bedPanel.bed)] || []}
          onClose={() => setBedPanel(null)}
          onAdd={() => setEntryModal({ section: bedPanel.section, bed: bedPanel.bed, entry: null })}
          onEdit={(entry) => setEntryModal({ section: bedPanel.section, bed: bedPanel.bed, entry })}
        />
      )}

      {entryModal && (
        <EntryModal
          existing={entryModal.entry}
          onClose={() => setEntryModal(null)}
          onSave={(entry) => saveEntry(entryModal.section.id, entryModal.bed, { ...entry, id: entryModal.entry?.id || uid("pl") })}
          onDelete={entryModal.entry ? () => deleteEntry(entryModal.section.id, entryModal.bed, entryModal.entry.id) : null}
        />
      )}
    </div>
  );
}

const fieldStyle = { width: "100%", padding: "9px 10px", borderRadius: 3, border: "1.5px solid #CFC7B0", background: "#fff", fontSize: 14, marginBottom: 12 };
const labelStyle = { display: "block", fontSize: 12, fontWeight: 600, marginBottom: 4, color: "#6B6255", textTransform: "uppercase", letterSpacing: 0.5 };

function ModalShell({ title, onClose, children, maxWidth = 400 }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(43,42,36,0.5)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16, zIndex: 1000 }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: PAPER, border: `2px solid ${INK}`, borderRadius: 5, padding: 22, width: "100%", maxWidth, maxHeight: "88vh", overflowY: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h3 style={{ fontFamily: "'Zilla Slab', serif", fontSize: 19, margin: 0 }}>{title}</h3>
          <button className="pm-btn" onClick={onClose} style={{ background: "transparent", padding: 4 }}>
            <X size={18} color={INK} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function SectionPanel({ section, plantings, onClose, onSetBeds, onOpenBed }) {
  const [bedsInput, setBedsInput] = useState(section.beds);
  const title = section.multi ? `${section.locName} — ${section.name}` : section.locName;

  const commitBeds = (val) => {
    const n = Math.max(1, Math.min(200, Math.round(Number(val) || 1)));
    setBedsInput(n);
    if (n !== section.beds) onSetBeds(n);
  };

  return (
    <ModalShell title={title} onClose={onClose} maxWidth={440}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
        <label style={{ ...labelStyle, marginBottom: 0 }}>Number of beds</label>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <button className="pm-btn" onClick={() => commitBeds(bedsInput - 1)} style={{ width: 28, height: 28, borderRadius: 3, background: INK, color: "#fff", fontWeight: 700 }}>−</button>
          <input
            style={{ width: 48, textAlign: "center", padding: "5px 4px", borderRadius: 3, border: "1.5px solid #CFC7B0" }}
            type="number" min={1} max={200} value={bedsInput}
            onChange={(e) => setBedsInput(e.target.value)}
            onBlur={(e) => commitBeds(e.target.value)}
          />
          <button className="pm-btn" onClick={() => commitBeds(bedsInput + 1)} style={{ width: 28, height: 28, borderRadius: 3, background: INK, color: "#fff", fontWeight: 700 }}>+</button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(60px, 1fr))", gap: 8 }}>
        {Array.from({ length: section.beds }, (_, i) => i + 1).map((bed) => {
          const entries = plantings[bedKey(section.id, bed)] || [];
          return (
            <div
              key={bed}
              className="pm-tile"
              onClick={() => onOpenBed(bed)}
              style={{ background: tileBackground(entries), borderRadius: 3, padding: "9px 6px", minHeight: 54, color: "#fff", display: "flex", flexDirection: "column", justifyContent: "space-between", fontSize: 11 }}
            >
              <span style={{ fontFamily: "'IBM Plex Mono', monospace", opacity: 0.9, textShadow: "0 1px 2px rgba(0,0,0,0.4)" }}>Bed {bed}</span>
              <span style={{ fontWeight: 600, fontSize: 12, lineHeight: 1.2, textShadow: "0 1px 2px rgba(0,0,0,0.4)" }}>
                {entries.length === 0 ? "—" : entries.length === 1 ? entries[0].crop : `${entries.length} crops`}
              </span>
            </div>
          );
        })}
      </div>
      <div style={{ fontSize: 12, color: "#8a8272", marginTop: 12 }}>
        Tap a bed to see or add plantings — a bed can hold more than one if it's split between crops. Change the bed count any time.
      </div>
    </ModalShell>
  );
}

function BedPanel({ section, bed, entries, onClose, onAdd, onEdit }) {
  const locLabel = section.multi ? `${section.locName} — ${section.name}` : section.locName;
  const title = section.beds > 1 ? `${locLabel} · Bed ${bed}` : locLabel;

  return (
    <ModalShell title={title} onClose={onClose}>
      {entries.length === 0 ? (
        <div style={{ fontSize: 14, color: "#8a8272", marginBottom: 16 }}>Nothing planted here yet.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
          {entries.map((e) => {
            const days = e.expectedHarvest ? daysBetween(new Date(), e.expectedHarvest) : null;
            const ready = days !== null && days <= 0;
            return (
              <div
                key={e.id}
                onClick={() => onEdit(e)}
                className="pm-tile"
                style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", padding: "10px 12px", borderRadius: 3, background: "#fff", border: `1px solid #E6E0D0`, borderLeft: `4px solid ${familyColor(e.crop)}` }}
              >
                <div>
                  <div style={{ fontWeight: 600 }}>{e.crop}{e.variety ? ` — ${e.variety}` : ""}</div>
                  <div style={{ fontSize: 12, color: "#6B6255", fontFamily: "'IBM Plex Mono', monospace" }}>
                    {e.portion || "Whole bed"} · Planted {e.plantedDate || "—"}
                    {e.expectedHarvest && ` · Harvest ~${e.expectedHarvest}`}
                  </div>
                </div>
                {ready && (
                  <span style={{ background: GOLD, color: "#fff", fontSize: 11, fontWeight: 600, padding: "3px 8px", borderRadius: 20, flexShrink: 0, marginLeft: 8 }}>
                    Ready
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}
      <button className="pm-btn" onClick={onAdd} style={{ width: "100%", background: FIELD, color: "#fff", padding: "11px", borderRadius: 3, fontWeight: 600, fontSize: 14 }}>
        + Add planting to this bed
      </button>
      <div style={{ fontSize: 12, color: "#8a8272", marginTop: 10 }}>
        Only using part of the bed? Add a second planting and note which portion each one covers.
      </div>
    </ModalShell>
  );
}

function EntryModal({ existing, onClose, onSave, onDelete }) {
  const [portion, setPortion] = useState(existing?.portion || "Whole bed");
  const [crop, setCrop] = useState(existing?.crop || "");
  const [variety, setVariety] = useState(existing?.variety || "");
  const [plantedDate, setPlantedDate] = useState(existing?.plantedDate || new Date().toISOString().slice(0, 10));
  const [expectedHarvest, setExpectedHarvest] = useState(existing?.expectedHarvest || "");
  const [notes, setNotes] = useState(existing?.notes || "");

  return (
    <ModalShell title={existing ? "Edit planting" : "New planting"} onClose={onClose}>
      <label style={labelStyle}>Portion of bed</label>
      <input style={fieldStyle} value={portion} onChange={(e) => setPortion(e.target.value)} placeholder='e.g. "Whole bed", "North half"' />
      <label style={labelStyle}>Crop</label>
      <input style={fieldStyle} value={crop} onChange={(e) => setCrop(e.target.value)} placeholder="e.g. Tomato" autoFocus />
      <label style={labelStyle}>Variety (optional)</label>
      <input style={fieldStyle} value={variety} onChange={(e) => setVariety(e.target.value)} placeholder="e.g. San Marzano" />
      <label style={labelStyle}>Planted date</label>
      <input style={fieldStyle} type="date" value={plantedDate} onChange={(e) => setPlantedDate(e.target.value)} />
      <label style={labelStyle}>Expected harvest (optional)</label>
      <input style={fieldStyle} type="date" value={expectedHarvest} onChange={(e) => setExpectedHarvest(e.target.value)} />
      <label style={labelStyle}>Notes (optional)</label>
      <textarea style={{ ...fieldStyle, minHeight: 60, resize: "vertical" }} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Spacing, treatment, anything worth remembering" />
      <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
        {onDelete && (
          <button className="pm-btn" onClick={onDelete} style={{ flex: 1, background: "transparent", border: `1.5px solid ${RUST}`, color: RUST, padding: "10px", borderRadius: 3, fontWeight: 600, fontSize: 14 }}>
            Remove
          </button>
        )}
        <button
          className="pm-btn"
          disabled={!crop.trim()}
          onClick={() => onSave({ portion: portion.trim() || "Whole bed", crop: crop.trim(), variety: variety.trim(), plantedDate, expectedHarvest, notes: notes.trim() })}
          style={{ flex: 2, background: crop.trim() ? FIELD : "#CFC7B0", color: "#fff", padding: "10px", borderRadius: 3, fontWeight: 600, fontSize: 14 }}
        >
          {existing ? "Save changes" : "Add planting"}
        </button>
      </div>
    </ModalShell>
  );
}
