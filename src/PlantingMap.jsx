import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { X, Move, Info, LogOut, Download, Upload } from "lucide-react";
import { supabase } from "./supabaseClient";

const MAP_IMAGE = "/farm-map.jpg";

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

// --- Bed grouping: auto-detect consecutive beds sharing the same crop set ---
function bedCropNames(entries) {
  if (!entries || entries.length === 0) return [];
  const seen = [];
  entries.forEach((e) => { if (!seen.includes(e.crop)) seen.push(e.crop); });
  return seen;
}
function bedGroupKey(entries) {
  return bedCropNames(entries).slice().sort().join("|");
}
function computeBands(section, plantings) {
  const beds = section.beds;
  let breakpoints;
  if (section.groupBreakpoints && section.groupBreakpoints.length) {
    breakpoints = Array.from(new Set([1, ...section.groupBreakpoints.filter((n) => n >= 1 && n <= beds)])).sort((a, b) => a - b);
  } else {
    breakpoints = [1];
    let prevKey = bedGroupKey(plantings[bedKey(section.id, 1)]);
    for (let b = 2; b <= beds; b++) {
      const key = bedGroupKey(plantings[bedKey(section.id, b)]);
      if (key !== prevKey) breakpoints.push(b);
      prevKey = key;
    }
  }
  return breakpoints.map((start, i) => {
    const end = (breakpoints[i + 1] || beds + 1) - 1;
    const firstEntries = plantings[bedKey(section.id, start)] || [];
    const names = bedCropNames(firstEntries);
    const label = names.length ? names.join(", ") : "Not planted";
    return { start, end, label, planted: names.length > 0 };
  });
}

// --- Default layout (same as the artifact version) ---
function defaultLocations() {
  const field = (id, name, sections) => ({ id, name, type: "field", sections });
  const single = (id, name, type, x, y) => ({ id, name, type, sections: [{ id: id + "_main", name, xPct: x, yPct: y, beds: 1, direction: "N", groupBreakpoints: null }] });
  const sec = (id, name, x, y) => ({ id, name, xPct: x, yPct: y, beds: 1, direction: "N", groupBreakpoints: null });

  return [
    field("f1", "Field 1 / Upper Field", [
      sec("f1_nw", "NW", 11, 12),
      sec("f1_ne", "NE", 19, 11),
      sec("f1_sw", "SW", 17, 34),
      sec("f1_se", "SE", 23, 34),
    ]),
    single("f2", "Field 2", "field", 32, 33),
    field("f3", "Field 3 / Lower Field", [
      sec("f3_nn", "NN", 60, 10),
      sec("f3_n", "N", 63, 21),
      sec("f3_s", "S", 79, 46),
    ]),
    field("f4", "Field 4 / U-Pick", [
      sec("f4_n", "N", 37, 48),
      sec("f4_e", "E", 40, 53),
      sec("f4_w", "W", 33, 53),
      sec("f4_s", "S", 37, 57),
    ]),
    field("f6", "Field 6", [
      sec("f6_nw", "NW", 39, 70),
      sec("f6_sw", "SW", 43, 92),
      sec("f6_e", "E", 60, 72),
    ]),
    single("greenhouse", "Greenhouse", "greenhouse", 38, 64),
    single("ht", "High Tunnel", "tunnel", 46, 64),
    single("omt1", "OMT 1", "tunnel", 50, 74),
    single("som1", "SOM1", "plot", 57, 74),
    single("omt2", "OMT 2", "tunnel", 64, 74),
    single("somt2", "SOMT2", "plot", 71, 74),
    single("nft1", "NFT1", "plot", 50, 80),
    single("ft1", "FT1", "tunnel", 57, 80),
    single("sft1", "SFT1", "plot", 64, 80),
    single("ft2", "FT2", "tunnel", 71, 80),
    single("sft2", "SFT2", "plot", 50, 86),
    single("ft3", "FT3", "tunnel", 57, 86),
    single("sft3", "SFT3", "plot", 64, 86),
    single("ft4", "FT4", "tunnel", 71, 86),
    single("ft5", "FT5", "tunnel", 50, 92),
    single("cat1", "Cat 1", "tunnel", 57, 92),
    single("cat2", "Cat 2", "tunnel", 64, 92),
    single("barn", "Barn", "reference", 28, 64),
    single("chicken", "Chicken World", "reference", 43, 26),
    single("goat", "Goat World", "reference", 51, 52),
    single("trail", "Nature Trail", "reference", 62, 58),
  ];
}

// --- Supabase storage layer (replaces window.storage from the artifact version) ---
async function loadLocations() {
  const { data, error } = await supabase.from("farm_locations").select("data").eq("id", "main").single();
  if (error || !data || !data.data || !data.data.length) return null;
  return data.data;
}
async function saveLocations(locations, username) {
  const { error } = await supabase
    .from("farm_locations")
    .upsert({ id: "main", data: locations, updated_by: username, updated_at: new Date().toISOString() });
  return !error;
}
async function seedLocations(locations, username) {
  await saveLocations(locations, username);
}

function rowToEntry(row) {
  return {
    id: row.id,
    portion: row.portion || "Whole bed",
    crop: row.crop,
    variety: row.variety || "",
    plantedDate: row.planted_date || "",
    expectedHarvest: row.expected_harvest || "",
    notes: row.notes || "",
  };
}
async function loadPlantings() {
  const { data, error } = await supabase.from("plantings").select("*");
  if (error || !data) return {};
  const grouped = {};
  data.forEach((row) => {
    const key = bedKey(row.section_id, row.bed);
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(rowToEntry(row));
  });
  return grouped;
}
async function saveEntryRow(sectionId, bed, entry, username, isNew) {
  const row = {
    id: entry.id,
    section_id: sectionId,
    bed,
    portion: entry.portion,
    crop: entry.crop,
    variety: entry.variety || null,
    planted_date: entry.plantedDate || null,
    expected_harvest: entry.expectedHarvest || null,
    notes: entry.notes || null,
    updated_by: username,
    updated_at: new Date().toISOString(),
  };
  if (isNew) row.created_by = username;
  const { error } = await supabase.from("plantings").upsert(row);
  return !error;
}
async function deleteEntryRow(id) {
  const { error } = await supabase.from("plantings").delete().eq("id", id);
  return !error;
}
async function deleteEntryRowsForBeds(sectionId, aboveBed) {
  await supabase.from("plantings").delete().eq("section_id", sectionId).gt("bed", aboveBed);
}

export default function PlantingMap({ username, onSignOut }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [locations, setLocations] = useState([]);
  const [plantings, setPlantings] = useState({});
  const [editMode, setEditMode] = useState(false);
  const [sectionPanel, setSectionPanel] = useState(null);
  const [bedPanel, setBedPanel] = useState(null);
  const [entryModal, setEntryModal] = useState(null);
  const [error, setError] = useState("");
  const [dragging, setDragging] = useState(null);
  const [importMsg, setImportMsg] = useState("");
  const imgWrapRef = useRef(null);
  const fileInputRef = useRef(null);

  // Initial load
  useEffect(() => {
    (async () => {
      let locs = await loadLocations();
      if (!locs) {
        locs = defaultLocations();
        await seedLocations(locs, username);
      }
      const plants = await loadPlantings();
      setLocations(locs);
      setPlantings(plants);
      setLoading(false);
    })();
  }, [username]);

  // Live sync: reload when anyone (including this tab) changes the shared data
  useEffect(() => {
    const channel = supabase
      .channel("planting-map-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "plantings" }, async () => {
        setPlantings(await loadPlantings());
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "farm_locations" }, async () => {
        const locs = await loadLocations();
        if (locs) setLocations(locs);
      })
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, []);

  const persistLocations = useCallback(async (nextLocations) => {
    setSaving(true);
    const ok = await saveLocations(nextLocations, username);
    setError(ok ? "" : "Couldn't save — your last change may not persist.");
    setSaving(false);
  }, [username]);

  const updateSection = (sectionId, patch) => {
    setLocations((prev) => {
      const next = prev.map((loc) => ({
        ...loc,
        sections: loc.sections.map((s) => (s.id === sectionId ? { ...s, ...patch } : s)),
      }));
      persistLocations(next);
      return next;
    });
  };

  const setSectionBeds = (sectionId, beds) => {
    setLocations((prev) => {
      const next = prev.map((loc) => ({
        ...loc,
        sections: loc.sections.map((s) => (s.id === sectionId ? { ...s, beds } : s)),
      }));
      persistLocations(next);
      return next;
    });
    deleteEntryRowsForBeds(sectionId, beds);
    setPlantings((prev) => {
      const next = {};
      Object.entries(prev).forEach(([key, val]) => {
        const [sid, bedStr] = key.split("__");
        if (sid !== sectionId || Number(bedStr) <= beds) next[key] = val;
      });
      return next;
    });
  };

  const saveEntry = async (sectionId, bed, entry, isNew) => {
    setSaving(true);
    const ok = await saveEntryRow(sectionId, bed, entry, username, isNew);
    setError(ok ? "" : "Couldn't save that planting — try again.");
    setSaving(false);
    setPlantings((prev) => {
      const key = bedKey(sectionId, bed);
      const list = prev[key] || [];
      const exists = list.some((e) => e.id === entry.id);
      const nextList = exists ? list.map((e) => (e.id === entry.id ? entry : e)) : [...list, entry];
      return { ...prev, [key]: nextList };
    });
    setEntryModal(null);
  };
  const deleteEntry = async (sectionId, bed, entryId) => {
    setSaving(true);
    await deleteEntryRow(entryId);
    setSaving(false);
    setPlantings((prev) => {
      const key = bedKey(sectionId, bed);
      const nextList = (prev[key] || []).filter((e) => e.id !== entryId);
      const next = { ...prev };
      if (nextList.length) next[key] = nextList;
      else delete next[key];
      return next;
    });
    setEntryModal(null);
  };

  const resetPositions = () => {
    if (!confirm("Reset all markers to their default positions? Your plantings and bed counts stay the same.")) return;
    const defaults = defaultLocations();
    const posById = {};
    defaults.forEach((loc) => loc.sections.forEach((s) => { posById[s.id] = { xPct: s.xPct, yPct: s.yPct }; }));
    setLocations((prev) => {
      const next = prev.map((loc) => ({
        ...loc,
        sections: loc.sections.map((s) => (posById[s.id] ? { ...s, xPct: posById[s.id].xPct, yPct: posById[s.id].yPct } : s)),
      }));
      persistLocations(next);
      return next;
    });
  };

  const handleBackup = () => {
    const payload = {
      exportedAt: new Date().toISOString(),
      exportedBy: username,
      app: "planting-map",
      version: 1,
      locations,
      plantings,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const stamp = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `planting-map-backup-${stamp}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleRestoreFile = (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = "";
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      let parsed;
      try {
        parsed = JSON.parse(reader.result);
      } catch (err) {
        setImportMsg("That file isn't valid JSON — nothing was changed.");
        return;
      }
      if (!parsed || !Array.isArray(parsed.locations) || typeof parsed.plantings !== "object") {
        setImportMsg("That file doesn't look like a planting map backup — nothing was changed.");
        return;
      }
      if (!confirm("Restore from this backup? This replaces everything currently in the shared tracker — for everyone — with what's in this file.")) return;

      setSaving(true);
      // Replace the shared locations row
      await saveLocations(parsed.locations, username);
      // Replace all planting rows: clear existing, then re-insert from the backup
      await supabase.from("plantings").delete().neq("id", "__none__");
      const inserts = [];
      Object.entries(parsed.plantings || {}).forEach(([key, entries]) => {
        const [sectionId, bedStr] = key.split("__");
        const bed = Number(bedStr);
        (entries || []).forEach((entry) => {
          inserts.push({
            id: entry.id || uid("pl"),
            section_id: sectionId,
            bed,
            portion: entry.portion || "Whole bed",
            crop: entry.crop,
            variety: entry.variety || null,
            planted_date: entry.plantedDate || null,
            expected_harvest: entry.expectedHarvest || null,
            notes: entry.notes || null,
            created_by: username,
            updated_by: username,
          });
        });
      });
      if (inserts.length) await supabase.from("plantings").insert(inserts);

      setLocations(parsed.locations);
      setPlantings(await loadPlantings());
      setSaving(false);
      setImportMsg(`Restored backup from ${parsed.exportedAt ? new Date(parsed.exportedAt).toLocaleString() : "file"}.`);
    };
    reader.readAsText(file);
  };

  const handlePointerDown = (sectionId) => (e) => {
    if (!editMode) return;
    e.preventDefault();
    e.stopPropagation();
    setDragging(sectionId);
  };
  useEffect(() => {
    if (!dragging) return;
    const move = (e) => {
      const rect = imgWrapRef.current.getBoundingClientRect();
      const point = e.touches ? e.touches[0] : e;
      let xPct = ((point.clientX - rect.left) / rect.width) * 100;
      let yPct = ((point.clientY - rect.top) / rect.height) * 100;
      xPct = Math.max(0, Math.min(100, xPct));
      yPct = Math.max(0, Math.min(100, yPct));
      setLocations((prev) =>
        prev.map((loc) => ({
          ...loc,
          sections: loc.sections.map((s) => (s.id === dragging ? { ...s, xPct, yPct } : s)),
        }))
      );
    };
    const up = () => {
      setDragging(null);
      setLocations((prev) => {
        persistLocations(prev);
        return prev;
      });
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
    window.addEventListener("touchmove", move, { passive: false });
    window.addEventListener("touchend", up);
    return () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
      window.removeEventListener("touchmove", move);
      window.removeEventListener("touchend", up);
    };
  }, [dragging, persistLocations]);

  const allSections = useMemo(() => {
    const rows = [];
    locations.forEach((loc) => {
      loc.sections.forEach((s) => rows.push({ ...s, locName: loc.name, type: loc.type, locId: loc.id, multi: loc.sections.length > 1 }));
    });
    return rows;
  }, [locations]);

  const bedsPlantedCount = (section) => {
    let n = 0;
    for (let b = 1; b <= section.beds; b++) if ((plantings[bedKey(section.id, b)] || []).length) n++;
    return n;
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

  if (loading) {
    return (
      <div style={{ background: PAPER, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'IBM Plex Sans', sans-serif", color: INK }}>
        Loading your planting map…
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
        .pm-marker { position: absolute; transform: translate(-50%, -50%); cursor: pointer; touch-action: none; }
        .pm-dot { border-radius: 50%; border: 2px solid #fff; box-shadow: 0 1px 3px rgba(0,0,0,0.4); display: flex; align-items: center; justify-content: center; }
        .pm-tile { cursor: pointer; transition: transform 0.1s ease; }
        .pm-tile:hover { transform: translateY(-2px); }
        .pm-band { cursor: pointer; }
        input, select, textarea { font-family: 'IBM Plex Sans', sans-serif; }
      `}</style>

      <header style={{ padding: "20px 16px 12px", borderBottom: `2px solid ${INK}` }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, letterSpacing: 2, textTransform: "uppercase", color: FIELD }}>
            Farm Map
          </div>
          <button className="pm-btn" onClick={onSignOut} style={{ display: "flex", alignItems: "center", gap: 5, background: "transparent", color: "#6B6255", fontSize: 12, padding: "4px 6px" }}>
            <LogOut size={13} /> {username} · Sign out
          </button>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10, marginTop: 4 }}>
          <h1 style={{ fontFamily: "'Zilla Slab', serif", fontWeight: 700, fontSize: 28, margin: 0 }}>Planting Map</h1>
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
            <span>Drag any marker to line it up with the real spot on the map. Changes save for everyone.</span>
          </div>
        )}
        <div style={{ display: "flex", gap: 14, marginTop: 10 }}>
          <button className="pm-btn" onClick={handleBackup} style={{ display: "flex", alignItems: "center", gap: 5, background: "transparent", color: FIELD, fontSize: 12, fontWeight: 600, padding: 0 }}>
            <Download size={13} /> Backup (JSON)
          </button>
          <button className="pm-btn" onClick={() => fileInputRef.current && fileInputRef.current.click()} style={{ display: "flex", alignItems: "center", gap: 5, background: "transparent", color: FIELD, fontSize: 12, fontWeight: 600, padding: 0 }}>
            <Upload size={13} /> Restore from backup
          </button>
          <input ref={fileInputRef} type="file" accept="application/json" onChange={handleRestoreFile} style={{ display: "none" }} />
        </div>
        {importMsg && <div style={{ marginTop: 6, fontSize: 12, color: FIELD }}>{importMsg}</div>}
        {error && <div style={{ marginTop: 8, color: RUST, fontSize: 13 }}>{error}</div>}
      </header>

      <div style={{ maxWidth: 720, margin: "0 auto", padding: 16 }}>
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

        <div ref={imgWrapRef} style={{ position: "relative", width: "100%", border: `2px solid ${INK}`, borderRadius: 4, overflow: "hidden", touchAction: editMode ? "none" : "auto" }}>
          <img src={MAP_IMAGE} alt="Farm map" style={{ width: "100%", display: "block", userSelect: "none", pointerEvents: "none" }} draggable={false} />
          {allSections.map((s) => {
            const planted = bedsPlantedCount(s);
            const baseColor = TYPE_COLOR[s.type] || REF;
            const color = planted > 0 ? GOLD : baseColor;
            const size = s.type === "reference" ? 9 : 15;
            return (
              <div
                key={s.id}
                className="pm-marker"
                style={{ left: `${s.xPct}%`, top: `${s.yPct}%`, zIndex: dragging === s.id ? 30 : 10 }}
                onMouseDown={handlePointerDown(s.id)}
                onTouchStart={handlePointerDown(s.id)}
                onClick={() => {
                  if (editMode || s.type === "reference") return;
                  setSectionPanel(s);
                }}
                title={s.multi ? `${s.locName} — ${s.name}` : s.locName}
              >
                <div className="pm-dot" style={{ width: size, height: size, background: color, fontSize: 8, color: "#fff", fontWeight: 700 }}>
                  {s.beds > 1 && !editMode ? s.beds : ""}
                </div>
                {(editMode || s.type === "reference") && (
                  <div style={{
                    position: "absolute", top: size + 3, left: "50%", transform: "translateX(-50%)",
                    fontSize: 10, whiteSpace: "nowrap", background: "rgba(255,255,255,0.9)",
                    padding: "1px 4px", borderRadius: 2, fontFamily: "'IBM Plex Mono', monospace",
                    color: INK, pointerEvents: "none",
                  }}>
                    {s.multi ? s.name : s.locName}
                  </div>
                )}
              </div>
            );
          })}
        </div>

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
          section={allSections.find((s) => s.id === sectionPanel.id) || sectionPanel}
          plantings={plantings}
          onClose={() => setSectionPanel(null)}
          onSetBeds={(beds) => setSectionBeds(sectionPanel.id, beds)}
          onSetDirection={(direction) => updateSection(sectionPanel.id, { direction })}
          onSetGroupBreakpoints={(bp) => updateSection(sectionPanel.id, { groupBreakpoints: bp })}
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
          onSave={(entry) =>
            saveEntry(
              entryModal.section.id,
              entryModal.bed,
              { ...entry, id: entryModal.entry?.id || uid("pl") },
              !entryModal.entry
            )
          }
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
    <div style={{ position: "fixed", inset: 0, background: "rgba(43,42,36,0.5)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16, zIndex: 50 }} onClick={onClose}>
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

function BedTile({ bed, entries, onClick }) {
  return (
    <div
      className="pm-tile"
      onClick={onClick}
      style={{ background: tileBackground(entries), borderRadius: 3, padding: "9px 6px", minHeight: 54, color: "#fff", display: "flex", flexDirection: "column", justifyContent: "space-between", fontSize: 11 }}
    >
      <span style={{ fontFamily: "'IBM Plex Mono', monospace", opacity: 0.9, textShadow: "0 1px 2px rgba(0,0,0,0.4)" }}>Bed {bed}</span>
      <span style={{ fontWeight: 600, fontSize: 12, lineHeight: 1.2, textShadow: "0 1px 2px rgba(0,0,0,0.4)" }}>
        {entries.length === 0 ? "—" : entries.length === 1 ? entries[0].crop : `${entries.length} crops`}
      </span>
    </div>
  );
}

const BAND_THRESHOLD = 12;

function SectionPanel({ section, plantings, onClose, onSetBeds, onSetDirection, onSetGroupBreakpoints, onOpenBed }) {
  const [bedsInput, setBedsInput] = useState(section.beds);
  const [jumpVal, setJumpVal] = useState("");
  const [expanded, setExpanded] = useState({});
  const [editingGroups, setEditingGroups] = useState(false);
  const [groupsInput, setGroupsInput] = useState("");

  const title = section.multi ? `${section.locName} — ${section.name}` : section.locName;
  const direction = section.direction || "N";

  const commitBeds = (val) => {
    const n = Math.max(1, Math.min(200, Math.round(Number(val) || 1)));
    setBedsInput(n);
    if (n !== section.beds) onSetBeds(n);
  };

  const handleJump = () => {
    const n = Math.round(Number(jumpVal));
    if (n >= 1 && n <= section.beds) {
      onOpenBed(n);
      setJumpVal("");
    }
  };

  const bands = useMemo(() => computeBands(section, plantings), [section, plantings]);
  const showBands = section.beds > BAND_THRESHOLD;

  const openGroupEditor = () => {
    setGroupsInput(bands.filter((b, i) => i > 0).map((b) => b.start).join(", "));
    setEditingGroups(true);
  };
  const applyGroups = () => {
    const nums = groupsInput.split(",").map((s) => parseInt(s.trim(), 10)).filter((n) => n >= 2 && n <= section.beds);
    onSetGroupBreakpoints(nums.length ? nums : null);
    setEditingGroups(false);
  };
  const resetGroups = () => {
    onSetGroupBreakpoints(null);
    setEditingGroups(false);
  };

  return (
    <ModalShell title={title} onClose={onClose} maxWidth={460}>
      <div style={{ marginBottom: 16 }}>
        <label style={labelStyle}>Bed 1 starts at</label>
        <div style={{ display: "flex", gap: 8, marginBottom: 6 }}>
          <button
            className="pm-btn"
            onClick={() => onSetDirection("N")}
            style={{ flex: 1, padding: "8px", borderRadius: 3, fontSize: 13, fontWeight: 600, background: direction === "N" ? FIELD : "transparent", color: direction === "N" ? "#fff" : INK, border: `1.5px solid ${FIELD}` }}
          >
            North end
          </button>
          <button
            className="pm-btn"
            onClick={() => onSetDirection("E")}
            style={{ flex: 1, padding: "8px", borderRadius: 3, fontSize: 13, fontWeight: 600, background: direction === "E" ? FIELD : "transparent", color: direction === "E" ? "#fff" : INK, border: `1.5px solid ${FIELD}` }}
          >
            East end
          </button>
        </div>
        <div style={{ fontSize: 12, color: "#6B6255" }}>
          {direction === "N" ? "Beds run north → south, Bed 1 at the north end." : "Beds run east → west, Bed 1 at the east end."}
        </div>
      </div>

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

      <div style={{ marginBottom: 18 }}>
        <label style={labelStyle}>Jump to bed #</label>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            style={{ ...fieldStyle, marginBottom: 0, flex: 1 }}
            type="number" min={1} max={section.beds} value={jumpVal}
            placeholder={`1–${section.beds}`}
            onChange={(e) => setJumpVal(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleJump()}
          />
          <button className="pm-btn" onClick={handleJump} style={{ background: INK, color: "#fff", padding: "0 16px", borderRadius: 3, fontWeight: 600, fontSize: 13 }}>Go</button>
        </div>
      </div>

      {showBands ? (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <label style={{ ...labelStyle, marginBottom: 0 }}>Groups ({bands.length})</label>
            <button className="pm-btn" onClick={openGroupEditor} style={{ background: "transparent", color: FIELD, fontSize: 12, fontWeight: 600, textDecoration: "underline" }}>
              {section.groupBreakpoints && section.groupBreakpoints.length ? "Edit groups" : "Adjust groupings"}
            </button>
          </div>

          {editingGroups && (
            <div style={{ background: "#F8F6EF", border: "1px solid #E6E0D0", borderRadius: 3, padding: 12, marginBottom: 12 }}>
              <div style={{ fontSize: 12, color: "#6B6255", marginBottom: 6 }}>
                Bed numbers where a new group starts (comma-separated), e.g. "4, 12, 20"
              </div>
              <input style={fieldStyle} value={groupsInput} onChange={(e) => setGroupsInput(e.target.value)} placeholder="4, 12, 20" />
              <div style={{ display: "flex", gap: 8 }}>
                <button className="pm-btn" onClick={resetGroups} style={{ flex: 1, background: "transparent", border: `1.5px solid ${RUST}`, color: RUST, padding: "8px", borderRadius: 3, fontSize: 13, fontWeight: 600 }}>Reset to automatic</button>
                <button className="pm-btn" onClick={applyGroups} style={{ flex: 1, background: FIELD, color: "#fff", padding: "8px", borderRadius: 3, fontSize: 13, fontWeight: 600 }}>Apply</button>
              </div>
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {bands.map((band) => {
              const isOpen = !!expanded[band.start];
              const rangeLabel = band.start === band.end ? `Bed ${band.start}` : `Beds ${band.start}–${band.end}`;
              return (
                <div key={band.start} style={{ border: "1px solid #E6E0D0", borderRadius: 3, background: "#fff" }}>
                  <div
                    className="pm-band"
                    onClick={() => setExpanded((prev) => ({ ...prev, [band.start]: !prev[band.start] }))}
                    style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 12px" }}
                  >
                    <div>
                      <span style={{ fontWeight: 600, fontSize: 13 }}>{rangeLabel}</span>
                      <span style={{ color: band.planted ? "#6B6255" : "#a89f8c", fontSize: 13 }}> · {band.label}</span>
                    </div>
                    <span style={{ fontSize: 12, color: "#8a8272" }}>{isOpen ? "▲" : "▼"}</span>
                  </div>
                  {isOpen && (
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(60px, 1fr))", gap: 8, padding: "0 12px 12px" }}>
                      {Array.from({ length: band.end - band.start + 1 }, (_, i) => band.start + i).map((bed) => (
                        <BedTile key={bed} bed={bed} entries={plantings[bedKey(section.id, bed)] || []} onClick={() => onOpenBed(bed)} />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(60px, 1fr))", gap: 8 }}>
          {Array.from({ length: section.beds }, (_, i) => i + 1).map((bed) => (
            <BedTile key={bed} bed={bed} entries={plantings[bedKey(section.id, bed)] || []} onClick={() => onOpenBed(bed)} />
          ))}
        </div>
      )}

      <div style={{ fontSize: 12, color: "#8a8272", marginTop: 12 }}>
        Tap a bed to see or add plantings — a bed can hold more than one if it's split between crops.
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
