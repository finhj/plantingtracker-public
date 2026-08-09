import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Plus, X, Sprout, TentTree, Trash2, Pencil, Leaf } from "lucide-react";

/*
  Design notes (Planting Log):
  - Paper-ledger aesthetic grounded in the subject: a farm record book.
  - Palette: unbleached paper bg, deep leaf-green for fields, polytunnel teal for tunnels,
    soil brown for empty beds, wheat gold for "ready to harvest" flags.
  - Signature element: the bed strip — a row of small tiles per location, one per bed,
    coloured by crop family, standing in for the physical rows in the ground.
*/

const PAPER = "#F1EEE2";
const INK = "#2B2A24";
const FIELD = "#4B6B3A";
const TUNNEL = "#3D6B7A";
const SOIL = "#B9AD95";
const GOLD = "#C68A2E";
const RUST = "#A0472E";

const CROP_FAMILIES = {
  Tomato: "#A0472E", Pepper: "#C1562E", Eggplant: "#5B4B8A", Cucumber: "#4B6B3A",
  Squash: "#C68A2E", Zucchini: "#7A8B3A", Lettuce: "#6E9B4A", Kale: "#3F7A4E",
  Spinach: "#2F6B3E", Chard: "#8B7A3A", Carrot: "#D07A2E", Beet: "#8A2E4A",
  Radish: "#B8496A", Onion: "#8A6B3A", Garlic: "#A88B4A", Bean: "#4B7A4A",
  Pea: "#5B9B5A", Potato: "#7A5A3A", Corn: "#C6A62E", Herbs: "#5B7A4A",
  Flowers: "#B04A8A", Other: "#6B6255",
};
const familyColor = (crop) => {
  const key = Object.keys(CROP_FAMILIES).find((f) =>
    crop.toLowerCase().includes(f.toLowerCase())
  );
  return CROP_FAMILIES[key] || CROP_FAMILIES.Other;
};

function uid(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function daysBetween(a, b) {
  return Math.round((new Date(b) - new Date(a)) / 86400000);
}

async function loadData() {
  try {
    const res = await window.storage.get("planting-log-data");
    if (res && res.value) return JSON.parse(res.value);
  } catch (e) {
    /* key not found or error — start fresh */
  }
  return null;
}
async function saveData(data) {
  try {
    await window.storage.set("planting-log-data", JSON.stringify(data));
  } catch (e) {
    console.error("Storage error", e);
    return false;
  }
  return true;
}

const seedData = () => ({
  locations: [
    { id: uid("loc"), name: "North Field", type: "field", beds: 8 },
    { id: uid("loc"), name: "Tunnel 1", type: "tunnel", beds: 6 },
  ],
  plantings: [],
});

export default function PlantingLog() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [locations, setLocations] = useState([]);
  const [plantings, setPlantings] = useState([]);
  const [openLocation, setOpenLocation] = useState(null);
  const [bedModal, setBedModal] = useState(null); // {locationId, bed}
  const [locModalOpen, setLocModalOpen] = useState(false);
  const [editingLoc, setEditingLoc] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      const data = await loadData();
      if (data) {
        setLocations(data.locations || []);
        setPlantings(data.plantings || []);
        if ((data.locations || []).length) setOpenLocation(data.locations[0].id);
      } else {
        const seeded = seedData();
        setLocations(seeded.locations);
        setPlantings(seeded.plantings);
        setOpenLocation(seeded.locations[0].id);
        await saveData(seeded);
      }
      setLoading(false);
    })();
  }, []);

  const persist = useCallback(async (nextLocations, nextPlantings) => {
    setSaving(true);
    const ok = await saveData({ locations: nextLocations, plantings: nextPlantings });
    if (!ok) setError("Couldn't save — your last change may not persist.");
    else setError("");
    setSaving(false);
  }, []);

  const updateAll = (nextLocations, nextPlantings) => {
    setLocations(nextLocations);
    setPlantings(nextPlantings);
    persist(nextLocations, nextPlantings);
  };

  const addLocation = (loc) => {
    const next = [...locations, { ...loc, id: uid("loc") }];
    updateAll(next, plantings);
    setOpenLocation(next[next.length - 1].id);
  };
  const editLocation = (loc) => {
    const next = locations.map((l) => (l.id === loc.id ? loc : l));
    updateAll(next, plantings);
  };
  const deleteLocation = (id) => {
    const next = locations.filter((l) => l.id !== id);
    const nextPlantings = plantings.filter((p) => p.locationId !== id);
    updateAll(next, nextPlantings);
    if (openLocation === id) setOpenLocation(next[0]?.id || null);
  };

  const plantingFor = (locationId, bed) =>
    plantings.find((p) => p.locationId === locationId && p.bed === bed);

  const savePlanting = (planting) => {
    const exists = plantings.some((p) => p.id === planting.id);
    const next = exists
      ? plantings.map((p) => (p.id === planting.id ? planting : p))
      : [...plantings, { ...planting, id: uid("pl") }];
    updateAll(locations, next);
    setBedModal(null);
  };
  const clearBed = (locationId, bed) => {
    const next = plantings.filter((p) => !(p.locationId === locationId && p.bed === bed));
    updateAll(locations, next);
    setBedModal(null);
  };

  const activeLoc = useMemo(
    () => locations.find((l) => l.id === openLocation) || null,
    [locations, openLocation]
  );

  if (loading) {
    return (
      <div style={{ background: PAPER, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'IBM Plex Sans', sans-serif", color: INK }}>
        Loading your planting log…
      </div>
    );
  }

  return (
    <div style={{ background: PAPER, minHeight: "100vh", color: INK, fontFamily: "'IBM Plex Sans', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Zilla+Slab:wght@500;700&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap');
        * { box-sizing: border-box; }
        .plog-btn { cursor: pointer; border: none; font-family: 'IBM Plex Sans', sans-serif; transition: transform 0.12s ease, opacity 0.12s ease; }
        .plog-btn:active { transform: scale(0.97); }
        .plog-tile { cursor: pointer; transition: transform 0.1s ease; }
        .plog-tile:hover { transform: translateY(-2px); }
        .plog-card { transition: box-shadow 0.15s ease; }
        input, select, textarea { font-family: 'IBM Plex Sans', sans-serif; }
        ::placeholder { color: #8a8272; }
      `}</style>

      <header style={{ padding: "28px 20px 16px", borderBottom: `2px solid ${INK}` }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
          <div>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, letterSpacing: 2, textTransform: "uppercase", color: FIELD, marginBottom: 4 }}>
              Field &amp; Tunnel Records
            </div>
            <h1 style={{ fontFamily: "'Zilla Slab', serif", fontWeight: 700, fontSize: 34, margin: 0 }}>
              Planting Log
            </h1>
          </div>
          <button
            className="plog-btn"
            onClick={() => { setEditingLoc(null); setLocModalOpen(true); }}
            style={{ display: "flex", alignItems: "center", gap: 6, background: INK, color: PAPER, padding: "10px 16px", borderRadius: 3, fontSize: 14, fontWeight: 500 }}
          >
            <Plus size={16} /> Add field or tunnel
          </button>
        </div>
        {error && <div style={{ marginTop: 10, color: RUST, fontSize: 13 }}>{error}</div>}
      </header>

      {locations.length === 0 ? (
        <div style={{ padding: "60px 20px", textAlign: "center", color: "#6B6255" }}>
          <Sprout size={32} style={{ marginBottom: 10 }} />
          <div style={{ fontFamily: "'Zilla Slab', serif", fontSize: 20, marginBottom: 6 }}>Nothing planted yet</div>
          <div style={{ fontSize: 14 }}>Add your first field or tunnel to start tracking beds.</div>
        </div>
      ) : (
        <div style={{ display: "flex", gap: 20, padding: "20px", maxWidth: 1100, margin: "0 auto", alignItems: "flex-start", flexWrap: "wrap" }}>
          {/* Location list */}
          <div style={{ display: "flex", flexDirection: "column", gap: 10, minWidth: 220, flex: "0 0 auto" }}>
            {locations.map((loc) => {
              const count = plantings.filter((p) => p.locationId === loc.id).length;
              const isOpen = loc.id === openLocation;
              const accent = loc.type === "tunnel" ? TUNNEL : FIELD;
              return (
                <div
                  key={loc.id}
                  onClick={() => setOpenLocation(loc.id)}
                  className="plog-card"
                  style={{
                    cursor: "pointer",
                    background: isOpen ? accent : "transparent",
                    color: isOpen ? PAPER : INK,
                    border: `1.5px solid ${accent}`,
                    borderRadius: 4,
                    padding: "12px 14px",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    {loc.type === "tunnel" ? <TentTree size={16} /> : <Sprout size={16} />}
                    <span style={{ fontWeight: 600, fontSize: 15 }}>{loc.name}</span>
                  </div>
                  <div style={{ fontSize: 12, marginTop: 4, opacity: 0.85, fontFamily: "'IBM Plex Mono', monospace" }}>
                    {count}/{loc.beds} beds planted
                  </div>
                </div>
              );
            })}
          </div>

          {/* Active location detail */}
          {activeLoc && (
            <div style={{ flex: "1 1 480px", background: "#fff", border: `1.5px solid ${INK}`, borderRadius: 4, padding: 20 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
                <div>
                  <h2 style={{ fontFamily: "'Zilla Slab', serif", fontSize: 24, margin: 0 }}>{activeLoc.name}</h2>
                  <div style={{ fontSize: 12, color: "#6B6255", fontFamily: "'IBM Plex Mono', monospace", marginTop: 2 }}>
                    {activeLoc.type === "tunnel" ? "Polytunnel" : "Open field"} · {activeLoc.beds} beds
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button className="plog-btn" onClick={() => { setEditingLoc(activeLoc); setLocModalOpen(true); }} style={{ background: "transparent", padding: 6 }} title="Edit">
                    <Pencil size={16} color={INK} />
                  </button>
                  <button className="plog-btn" onClick={() => { if (confirm(`Delete ${activeLoc.name} and its planting records?`)) deleteLocation(activeLoc.id); }} style={{ background: "transparent", padding: 6 }} title="Delete">
                    <Trash2 size={16} color={RUST} />
                  </button>
                </div>
              </div>

              {/* Bed strip — signature visualization */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(64px, 1fr))", gap: 8, marginBottom: 20 }}>
                {Array.from({ length: activeLoc.beds }, (_, i) => i + 1).map((bed) => {
                  const p = plantingFor(activeLoc.id, bed);
                  const color = p ? familyColor(p.crop) : SOIL;
                  return (
                    <div
                      key={bed}
                      className="plog-tile"
                      onClick={() => setBedModal({ locationId: activeLoc.id, bed })}
                      style={{
                        background: color,
                        borderRadius: 3,
                        padding: "10px 6px",
                        minHeight: 58,
                        color: "#fff",
                        display: "flex",
                        flexDirection: "column",
                        justifyContent: "space-between",
                        fontSize: 11,
                      }}
                    >
                      <span style={{ fontFamily: "'IBM Plex Mono', monospace", opacity: 0.85 }}>Bed {bed}</span>
                      <span style={{ fontWeight: 600, fontSize: 12, lineHeight: 1.2 }}>
                        {p ? p.crop : "—"}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Planting list */}
              <div style={{ borderTop: `1px solid #DDD6C4`, paddingTop: 14 }}>
                <div style={{ fontSize: 12, letterSpacing: 1, textTransform: "uppercase", color: "#6B6255", marginBottom: 10, fontFamily: "'IBM Plex Mono', monospace" }}>
                  Current plantings
                </div>
                {plantings.filter((p) => p.locationId === activeLoc.id).length === 0 ? (
                  <div style={{ fontSize: 14, color: "#8a8272" }}>No beds planted here yet. Tap a bed above to add one.</div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {plantings
                      .filter((p) => p.locationId === activeLoc.id)
                      .sort((a, b) => a.bed - b.bed)
                      .map((p) => {
                        const days = p.expectedHarvest ? daysBetween(new Date(), p.expectedHarvest) : null;
                        const ready = days !== null && days <= 0;
                        return (
                          <div
                            key={p.id}
                            onClick={() => setBedModal({ locationId: activeLoc.id, bed: p.bed })}
                            style={{ cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 10px", borderRadius: 3, background: "#F8F6EF", border: "1px solid #E6E0D0" }}
                          >
                            <div>
                              <span style={{ fontWeight: 600 }}>Bed {p.bed}: {p.crop}</span>
                              {p.variety && <span style={{ color: "#6B6255" }}> — {p.variety}</span>}
                              <div style={{ fontSize: 12, color: "#6B6255", fontFamily: "'IBM Plex Mono', monospace" }}>
                                Planted {p.plantedDate || "—"}
                                {p.expectedHarvest && ` · Harvest ~${p.expectedHarvest}`}
                              </div>
                            </div>
                            {ready && (
                              <span style={{ background: GOLD, color: "#fff", fontSize: 11, fontWeight: 600, padding: "3px 8px", borderRadius: 20 }}>
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
          )}
        </div>
      )}

      {saving && (
        <div style={{ position: "fixed", bottom: 14, right: 14, fontSize: 12, color: "#6B6255", fontFamily: "'IBM Plex Mono', monospace" }}>
          Saving…
        </div>
      )}

      {locModalOpen && (
        <LocationModal
          initial={editingLoc}
          onClose={() => setLocModalOpen(false)}
          onSave={(loc) => {
            if (editingLoc) editLocation(loc);
            else addLocation(loc);
            setLocModalOpen(false);
          }}
        />
      )}

      {bedModal && (
        <BedModal
          locationId={bedModal.locationId}
          bed={bedModal.bed}
          existing={plantingFor(bedModal.locationId, bedModal.bed)}
          onClose={() => setBedModal(null)}
          onSave={savePlanting}
          onClear={() => clearBed(bedModal.locationId, bedModal.bed)}
        />
      )}
    </div>
  );
}

function Modal({ title, onClose, children }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(43,42,36,0.5)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16, zIndex: 50 }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: PAPER, border: `2px solid ${INK}`, borderRadius: 5, padding: 22, width: "100%", maxWidth: 380, maxHeight: "88vh", overflowY: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h3 style={{ fontFamily: "'Zilla Slab', serif", fontSize: 20, margin: 0 }}>{title}</h3>
          <button className="plog-btn" onClick={onClose} style={{ background: "transparent", padding: 4 }}>
            <X size={18} color={INK} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

const fieldStyle = { width: "100%", padding: "9px 10px", borderRadius: 3, border: "1.5px solid #CFC7B0", background: "#fff", fontSize: 14, marginBottom: 12 };
const labelStyle = { display: "block", fontSize: 12, fontWeight: 600, marginBottom: 4, color: "#6B6255", textTransform: "uppercase", letterSpacing: 0.5 };

function LocationModal({ initial, onClose, onSave }) {
  const [name, setName] = useState(initial?.name || "");
  const [type, setType] = useState(initial?.type || "field");
  const [beds, setBeds] = useState(initial?.beds || 6);

  return (
    <Modal title={initial ? "Edit location" : "New field or tunnel"} onClose={onClose}>
      <label style={labelStyle}>Name</label>
      <input style={fieldStyle} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. South Field, Tunnel 2" />

      <label style={labelStyle}>Type</label>
      <select style={fieldStyle} value={type} onChange={(e) => setType(e.target.value)}>
        <option value="field">Open field</option>
        <option value="tunnel">Polytunnel</option>
      </select>

      <label style={labelStyle}>Number of beds</label>
      <input style={fieldStyle} type="number" min={1} max={60} value={beds} onChange={(e) => setBeds(Math.max(1, Math.min(60, Number(e.target.value) || 1)))} />

      <button
        className="plog-btn"
        disabled={!name.trim()}
        onClick={() => onSave({ id: initial?.id, name: name.trim(), type, beds: Number(beds) })}
        style={{ width: "100%", background: name.trim() ? INK : "#CFC7B0", color: PAPER, padding: "11px", borderRadius: 3, fontWeight: 600, fontSize: 14, marginTop: 4 }}
      >
        {initial ? "Save changes" : "Add location"}
      </button>
    </Modal>
  );
}

function BedModal({ locationId, bed, existing, onClose, onSave, onClear }) {
  const [crop, setCrop] = useState(existing?.crop || "");
  const [variety, setVariety] = useState(existing?.variety || "");
  const [plantedDate, setPlantedDate] = useState(existing?.plantedDate || new Date().toISOString().slice(0, 10));
  const [expectedHarvest, setExpectedHarvest] = useState(existing?.expectedHarvest || "");
  const [notes, setNotes] = useState(existing?.notes || "");

  return (
    <Modal title={`Bed ${bed}${existing ? " — edit" : ""}`} onClose={onClose}>
      <label style={labelStyle}>Crop</label>
      <input style={fieldStyle} value={crop} onChange={(e) => setCrop(e.target.value)} placeholder="e.g. Tomato" />

      <label style={labelStyle}>Variety (optional)</label>
      <input style={fieldStyle} value={variety} onChange={(e) => setVariety(e.target.value)} placeholder="e.g. San Marzano" />

      <label style={labelStyle}>Planted date</label>
      <input style={fieldStyle} type="date" value={plantedDate} onChange={(e) => setPlantedDate(e.target.value)} />

      <label style={labelStyle}>Expected harvest (optional)</label>
      <input style={fieldStyle} type="date" value={expectedHarvest} onChange={(e) => setExpectedHarvest(e.target.value)} />

      <label style={labelStyle}>Notes (optional)</label>
      <textarea style={{ ...fieldStyle, minHeight: 60, resize: "vertical" }} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Spacing, treatment, anything worth remembering" />

      <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
        {existing && (
          <button className="plog-btn" onClick={onClear} style={{ flex: 1, background: "transparent", border: `1.5px solid ${RUST}`, color: RUST, padding: "10px", borderRadius: 3, fontWeight: 600, fontSize: 14 }}>
            Clear bed
          </button>
        )}
        <button
          className="plog-btn"
          disabled={!crop.trim()}
          onClick={() => onSave({ id: existing?.id, locationId, bed, crop: crop.trim(), variety: variety.trim(), plantedDate, expectedHarvest, notes: notes.trim() })}
          style={{ flex: 2, background: crop.trim() ? FIELD : "#CFC7B0", color: "#fff", padding: "10px", borderRadius: 3, fontWeight: 600, fontSize: 14 }}
        >
          {existing ? "Save changes" : "Plant this bed"}
        </button>
      </div>
    </Modal>
  );
}
