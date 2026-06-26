import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { initializeApp } from "firebase/app";
import {
  getDatabase,
  ref,
  onValue,
  set,
  remove,
  update,
} from "firebase/database";
import {
  Plus,
  X,
  Clock,
  Users,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Trash2,
  Check,
  AlertCircle,
  Phone,
  Upload,
  CarFront,
  FileSpreadsheet,
  MapPin,
  Pencil,
  WifiOff,
  Wifi,
} from "lucide-react";
import * as XLSX from "xlsx";

// =====================================================================
// CONFIGURACIÓN DE FIREBASE (Realtime Database)
// Sustituye estos valores por los de tu propio proyecto de Firebase.
// Instrucciones completas: ver guía aparte "Cómo alojar tu agenda".
// El campo "databaseURL" es imprescindible para Realtime Database
// (no aparece en el bloque de configuración por defecto que copia Firebase
// para apps web — cópialo desde la URL que ves arriba de tu Realtime Database,
// algo como https://TU_PROYECTO-default-rtdb.europe-west1.firebasedatabase.app).
// =====================================================================
const firebaseConfig = {
  apiKey: "AIzaSyC9WndH7H0c5NRGSQzMrBYquF2sq-vPJVo",
  authDomain: "agenda-vendedores-40cc8.firebaseapp.com",
  databaseURL: "https://agenda-vendedores-40cc8-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "agenda-vendedores-40cc8",
  storageBucket: "agenda-vendedores-40cc8.firebasestorage.app",
  messagingSenderId: "220024137396",
  appId: "1:220024137396:web:e4529ac83e5526af4219e1",
};
let app, db, firebaseDisponible = false;
try {
  if (firebaseConfig.apiKey && firebaseConfig.apiKey !== "TU_API_KEY") {
    app = initializeApp(firebaseConfig);
    db = getDatabase(app);
    firebaseDisponible = true;
  }
} catch (e) {
  console.error("Error inicializando Firebase", e);
}

// ---------- Constantes ----------
const DIAS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
const DIAS_CORTO = ["LUN", "MAR", "MIÉ", "JUE", "VIE", "SÁB"];
const HORA_INICIO = 9;
const HORA_FIN = 20;
const SLOT_MIN = 60;

// Cada isla tiene su propia familia de color; todas las sedes de esa isla
// comparten el mismo tono (varían ligeramente en intensidad para diferenciarlas).
const PALETA_ISLAS = {
  "Tenerife": { hue: "#3F6FB0", family: [
    { bg: "#E7EEF8", border: "#3F6FB0", text: "#1E3A60" },
    { bg: "#DCE7F5", border: "#33619F", text: "#1A3454" },
    { bg: "#D1E0F2", border: "#27538D", text: "#162D49" },
  ]},
  "Gran Canaria": { hue: "#3F9999", family: [
    { bg: "#E3F1F1", border: "#3F9999", text: "#1F4D4D" },
    { bg: "#D8ECEC", border: "#358888", text: "#1A4343" },
  ]},
  "Lanzarote": { hue: "#C97C4A", family: [
    { bg: "#FBEFE6", border: "#C97C4A", text: "#7A4426" },
  ]},
  "Fuerteventura": { hue: "#A88B4A", family: [
    { bg: "#F3EFE3", border: "#A88B4A", text: "#5E4A1F" },
  ]},
  "La Palma": { hue: "#7AAE4A", family: [
    { bg: "#EAF5E3", border: "#7AAE4A", text: "#3D5E22" },
  ]},
};

const ISLAS_SEDES = {
  "Tenerife": ["Mayorazgo", "La Orotava", "Chafiras", "Sebadal", "Miller Bajo", "Arinaga"],
  "Gran Canaria": [],
  "Lanzarote": ["Lanzarote"],
  "Fuerteventura": ["Fuerteventura"],
  "La Palma": ["La Palma"],
};
const ISLAS = Object.keys(ISLAS_SEDES);

// Asigna un color a cada sede dentro de su isla, ciclando si hay más sedes que tonos.
function colorParaSede(isla, sede) {
  const paleta = PALETA_ISLAS[isla] || PALETA_ISLAS["Tenerife"];
  const sedesIsla = ISLAS_SEDES[isla] || [];
  const idx = Math.max(0, sedesIsla.indexOf(sede));
  return paleta.family[idx % paleta.family.length];
}

function genId() {
  return Math.random().toString(36).slice(2, 10);
}

function normalizePhone(raw) {
  if (!raw) return "";
  let digits = String(raw).replace(/[^\d]/g, "");
  if (digits.startsWith("0034")) digits = digits.slice(4);
  else if (digits.startsWith("34") && digits.length > 9) digits = digits.slice(2);
  if (digits.length > 9) digits = digits.slice(-9);
  return digits;
}

function parseAnyDate(val) {
  if (val == null || val === "") return null;
  if (val instanceof Date && !isNaN(val)) return val;
  if (typeof val === "number") {
    const d = XLSX.SSF.parse_date_code(val);
    if (d) return new Date(d.y, d.m - 1, d.d);
    return null;
  }
  const s = String(val).trim();
  const m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/);
  if (m) {
    let [, d, mo, y] = m;
    if (y.length === 2) y = "20" + y;
    return new Date(Number(y), Number(mo) - 1, Number(d));
  }
  const d2 = new Date(s);
  return isNaN(d2) ? null : d2;
}

function fmtDateShort(d) {
  if (!d) return "";
  return d.toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "2-digit" });
}

function horaLabel(h) {
  return `${String(Math.floor(h)).padStart(2, "0")}:${h % 1 === 0 ? "00" : "30"}`;
}

function slotsDia() {
  const slots = [];
  for (let h = HORA_INICIO; h < HORA_FIN; h += SLOT_MIN / 60) slots.push(h);
  return slots;
}

function getMonday(d) {
  const date = new Date(d);
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

function fmtWeekKey(monday) {
  return monday.toISOString().slice(0, 10);
}

function fmtDateLabel(date) {
  return date.toLocaleDateString("es-ES", { day: "2-digit", month: "short" });
}

function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

// =====================================================================
// CAPA DE DATOS — Firebase Firestore (compartido, tiempo real)
// Con fallback automático a localStorage-en-memoria si Firebase no está
// configurado, para que la app siga siendo usable en modo demo/individual.
// Estructura de colecciones:
//   vendedores/{id}            -> {nombre, isla, sede}
//   turnos/{weekKey}_{vendorId} -> {weekKey, vendorId, dias: {0:[...],...}}
//   citas/{id}                  -> {weekKey, vendorId, day, hour, cliente, telefono}
//   ventas/listado               -> {fileName, uploadedAt, records}
// =====================================================================

function useVendedoresSync() {
  const [vendedores, setVendedores] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!firebaseDisponible) {
      setLoading(false);
      return;
    }
    const vendedoresRef = ref(db, "vendedores");
    const unsub = onValue(vendedoresRef, (snap) => {
      const data = snap.val() || {};
      const list = Object.entries(data).map(([id, v]) => ({ id, ...v }));
      setVendedores(list);
      setLoading(false);
    }, (err) => {
      console.error("Error sincronizando vendedores", err);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const addVendedor = useCallback(async (vendedor) => {
    if (!firebaseDisponible) {
      setVendedores((prev) => [...prev, vendedor]);
      return;
    }
    await set(ref(db, `vendedores/${vendedor.id}`), {
      nombre: vendedor.nombre,
      isla: vendedor.isla,
      sede: vendedor.sede,
    });
  }, []);

  const removeVendedor = useCallback(async (id) => {
    if (!firebaseDisponible) {
      setVendedores((prev) => prev.filter((v) => v.id !== id));
      return;
    }
    await remove(ref(db, `vendedores/${id}`));
  }, []);

  const updateVendedor = useCallback(async (id, fields) => {
    if (!firebaseDisponible) {
      setVendedores((prev) => prev.map((v) => (v.id === id ? { ...v, ...fields } : v)));
      return;
    }
    await update(ref(db, `vendedores/${id}`), fields);
  }, []);

  return { vendedores, loading, addVendedor, removeVendedor, updateVendedor };
}

function useTurnosSync(weekKey) {
  const [turnos, setTurnos] = useState({}); // { vendorId: { day: [hours] } }

  useEffect(() => {
    if (!firebaseDisponible) {
      setTurnos({});
      return;
    }
    const turnosRef = ref(db, `turnos/${weekKey}`);
    const unsub = onValue(turnosRef, (snap) => {
      setTurnos(snap.val() || {});
    }, (err) => console.error("Error sincronizando turnos", err));
    return () => unsub();
  }, [weekKey]);

  const setTurnoVendorDia = useCallback(
    async (vendorId, dias) => {
      if (!firebaseDisponible) {
        setTurnos((prev) => ({ ...prev, [vendorId]: dias }));
        return;
      }
      await set(ref(db, `turnos/${weekKey}/${vendorId}`), dias);
    },
    [weekKey]
  );

  return { turnos, setTurnoVendorDia };
}

function useCitasSync(weekKey) {
  const [citas, setCitas] = useState([]);

  useEffect(() => {
    if (!firebaseDisponible) {
      setCitas([]);
      return;
    }
    const citasRef = ref(db, `citas/${weekKey}`);
    const unsub = onValue(citasRef, (snap) => {
      const data = snap.val() || {};
      const list = Object.entries(data).map(([id, c]) => ({ id, ...c }));
      setCitas(list);
    }, (err) => console.error("Error sincronizando citas", err));
    return () => unsub();
  }, [weekKey]);

  const addCita = useCallback(
    async (cita) => {
      if (!firebaseDisponible) {
        setCitas((prev) => [...prev, cita]);
        return;
      }
      const { id, ...resto } = cita;
      await set(ref(db, `citas/${weekKey}/${id}`), resto);
    },
    [weekKey]
  );

  const updateCita = useCallback(
    async (id, fields) => {
      if (!firebaseDisponible) {
        setCitas((prev) => prev.map((c) => (c.id === id ? { ...c, ...fields } : c)));
        return;
      }
      await update(ref(db, `citas/${weekKey}/${id}`), fields);
    },
    [weekKey]
  );

  const removeCita = useCallback(async (id) => {
    if (!firebaseDisponible) {
      setCitas((prev) => prev.filter((c) => c.id !== id));
      return;
    }
    await remove(ref(db, `citas/${weekKey}/${id}`));
  }, [weekKey]);

  return { citas, addCita, updateCita, removeCita };
}

function useVentasSync() {
  const [ventas, setVentas] = useState(null);

  useEffect(() => {
    if (!firebaseDisponible) return;
    const ventasRef = ref(db, "ventas/listado");
    const unsub = onValue(ventasRef, (snap) => {
      setVentas(snap.exists() ? snap.val() : null);
    }, (err) => console.error("Error sincronizando ventas", err));
    return () => unsub();
  }, []);

  const guardarVentas = useCallback(async (data) => {
    if (!firebaseDisponible) {
      setVentas(data);
      return;
    }
    if (data === null) {
      await remove(ref(db, "ventas/listado"));
    } else {
      await set(ref(db, "ventas/listado"), data);
    }
  }, []);

  return { ventas, guardarVentas };
}

// ---------- Componente principal ----------
export default function AgendaVendedores() {
  const [weekStart, setWeekStart] = useState(() => getMonday(new Date()));
  const weekKey = useMemo(() => fmtWeekKey(weekStart), [weekStart]);

  const { vendedores, loading, addVendedor, removeVendedor, updateVendedor } = useVendedoresSync();
  const { turnos, setTurnoVendorDia } = useTurnosSync(weekKey);
  const { citas, addCita, updateCita, removeCita } = useCitasSync(weekKey);
  const { ventas, guardarVentas } = useVentasSync();

  const [vista, setVista] = useState("agenda");
  const [modalCita, setModalCita] = useState(null);
  const [nuevoVendedorNombre, setNuevoVendedorNombre] = useState("");
  const [nuevoVendedorIsla, setNuevoVendedorIsla] = useState(ISLAS[0]);
  const [nuevoVendedorSede, setNuevoVendedorSede] = useState((ISLAS_SEDES[ISLAS[0]] || [])[0] || "");
  const [toast, setToast] = useState(null);
  const [subiendoArchivo, setSubiendoArchivo] = useState(false);
  const [errorArchivo, setErrorArchivo] = useState(null);
  const fileInputRef = useRef(null);
  const [filtroIslas, setFiltroIslas] = useState([]);
  const [filtroSedes, setFiltroSedes] = useState([]);

  const showToast = useCallback((msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2200);
  }, []);

  // ---------- Vendedores ----------
  const handleAddVendedor = useCallback(async () => {
    const nombre = nuevoVendedorNombre.trim();
    if (!nombre) return;
    const sede = nuevoVendedorSede || nuevoVendedorIsla;
    const nuevo = { id: genId(), nombre, isla: nuevoVendedorIsla, sede };
    await addVendedor(nuevo);
    setNuevoVendedorNombre("");
    showToast(`${nombre} añadido`);
  }, [nuevoVendedorNombre, nuevoVendedorIsla, nuevoVendedorSede, addVendedor, showToast]);

  const handleRemoveVendedor = useCallback(
    async (id) => {
      const v = vendedores.find((x) => x.id === id);
      await removeVendedor(id);
      // limpiar también sus citas de esta semana
      const citasDelVendedor = citas.filter((c) => c.vendorId === id);
      await Promise.all(citasDelVendedor.map((c) => removeCita(c.id)));
      showToast(v ? `${v.nombre} eliminado` : "Vendedor eliminado");
    },
    [vendedores, citas, removeVendedor, removeCita, showToast]
  );

  const vendedoresFiltrados = useMemo(() => {
    return vendedores.filter((v) => {
      const okIsla = filtroIslas.length === 0 || filtroIslas.includes(v.isla);
      const okSede = filtroSedes.length === 0 || filtroSedes.includes(v.sede);
      return okIsla && okSede;
    });
  }, [vendedores, filtroIslas, filtroSedes]);

  const toggleFiltroIsla = useCallback((isla) => {
    setFiltroIslas((prev) => {
      const next = prev.includes(isla) ? prev.filter((i) => i !== isla) : [...prev, isla];
      if (prev.includes(isla)) {
        setFiltroSedes((s) => s.filter((sede) => !(ISLAS_SEDES[isla] || []).includes(sede)));
      }
      return next;
    });
  }, []);

  const toggleFiltroSede = useCallback((sede) => {
    setFiltroSedes((prev) => (prev.includes(sede) ? prev.filter((s) => s !== sede) : [...prev, sede]));
  }, []);

  const limpiarFiltros = useCallback(() => {
    setFiltroIslas([]);
    setFiltroSedes([]);
  }, []);

  const sedesFiltrablesDisponibles = useMemo(() => {
    const islasAUsar = filtroIslas.length > 0 ? filtroIslas : ISLAS;
    const set = new Set();
    islasAUsar.forEach((isla) => (ISLAS_SEDES[isla] || []).forEach((s) => set.add(s)));
    return Array.from(set);
  }, [filtroIslas]);

  // ---------- Turnos ----------
  const toggleTurno = useCallback(
    async (vendorId, dayIdx, hour) => {
      const actual = { ...(turnos[vendorId] || {}) };
      const dayList = new Set(actual[dayIdx] || []);
      if (dayList.has(hour)) dayList.delete(hour);
      else dayList.add(hour);
      actual[dayIdx] = Array.from(dayList);
      await setTurnoVendorDia(vendorId, actual);
    },
    [turnos, setTurnoVendorDia]
  );

  const isWorking = useCallback(
    (vendorId, dayIdx, hour) => (turnos[vendorId]?.[dayIdx] || []).includes(hour),
    [turnos]
  );

  const setBulkTurno = useCallback(
    async (vendorId, dayIdx, tramo) => {
      const actual = { ...(turnos[vendorId] || {}) };
      const slots = slotsDia();
      const mid = HORA_INICIO + (HORA_FIN - HORA_INICIO) / 2;
      let hours;
      if (tramo === "manana") hours = slots.filter((h) => h < mid);
      else if (tramo === "tarde") hours = slots.filter((h) => h >= mid);
      else if (tramo === "completo") hours = slots;
      else hours = [];
      actual[dayIdx] = hours;
      await setTurnoVendorDia(vendorId, actual);
    },
    [turnos, setTurnoVendorDia]
  );

  // ---------- Citas ----------
  const vendoresDisponibles = useCallback(
    (dayIdx, hour) => vendedoresFiltrados.filter((v) => isWorking(v.id, dayIdx, hour)),
    [vendedoresFiltrados, isWorking]
  );

  const citasDeVendorEnSemana = useCallback(
    (vendorId) => citas.filter((c) => c.vendorId === vendorId && c.estado !== "cancelada").length,
    [citas]
  );

  const sugerirVendedor = useCallback(
    (dayIdx, hour) => {
      const disponibles = vendoresDisponibles(dayIdx, hour);
      if (disponibles.length === 0) return null;
      const ocupadosEnSlot = new Set(
        citas
          .filter((c) => c.day === dayIdx && c.hour === hour && c.estado !== "cancelada")
          .map((c) => c.vendorId)
      );
      const libres = disponibles.filter((v) => !ocupadosEnSlot.has(v.id));
      const pool = libres.length > 0 ? libres : disponibles;
      return pool.reduce((min, v) =>
        citasDeVendorEnSemana(v.id) < citasDeVendorEnSemana(min.id) ? v : min
      , pool[0]);
    },
    [vendoresDisponibles, citas, citasDeVendorEnSemana]
  );

  const handleSaveCita = useCallback(
    async (vendorId, dayIdx, hour, cliente, telefono, idExistente) => {
      if (idExistente) {
        await updateCita(idExistente, { vendorId, day: dayIdx, hour, cliente: cliente || "", telefono: telefono || "" });
        showToast("Cita actualizada");
      } else {
        await addCita({
          id: genId(),
          vendorId,
          day: dayIdx,
          hour,
          cliente: cliente || "",
          telefono: telefono || "",
          estado: "activa",
        });
        showToast("Cita asignada");
      }
      setModalCita(null);
    },
    [addCita, updateCita, showToast]
  );

  const handleCancelCita = useCallback(
    async (id) => {
      await updateCita(id, { estado: "cancelada" });
      setModalCita(null);
      showToast("Cita cancelada");
    },
    [updateCita, showToast]
  );

  const handleDeleteCita = useCallback(
    async (id) => {
      await removeCita(id);
      setModalCita(null);
      showToast("Cita eliminada");
    },
    [removeCita, showToast]
  );

  // ---------- Listado de ventas ----------
  const handleFileUpload = useCallback(async (file) => {
    if (!file) return;
    setSubiendoArchivo(true);
    setErrorArchivo(null);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array", cellDates: true });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });

      if (rows.length === 0) {
        setErrorArchivo("El archivo no tiene filas con datos.");
        setSubiendoArchivo(false);
        return;
      }

      const keys = Object.keys(rows[0]);
      const findKey = (...patterns) =>
        keys.find((k) => patterns.some((p) => k.toLowerCase().replace(/[^a-z0-9]/g, "").includes(p)));

      const kPhone = findKey("telefono", "tel", "movil", "phone");
      const kDate = findKey("fecha");
      const kVendedor = findKey("vendedor", "comercial", "asesor");
      const kCoche = findKey("matricula", "coche", "vehiculo", "modelo", "car");

      if (!kPhone) {
        setErrorArchivo("No he encontrado una columna de teléfono en el archivo.");
        setSubiendoArchivo(false);
        return;
      }

      const records = rows
        .map((r) => ({
          phone: normalizePhone(r[kPhone]),
          date: kDate ? parseAnyDate(r[kDate]) : null,
          vendedor: kVendedor ? String(r[kVendedor] || "").trim() : "",
          coche: kCoche ? String(r[kCoche] || "").trim() : "",
        }))
        .filter((r) => r.phone);

      const data = {
        fileName: file.name,
        uploadedAt: new Date().toISOString(),
        totalFilas: rows.length,
        records,
      };
      await guardarVentas(data);
      showToast(`Listado cargado: ${records.length} ventas con teléfono válido`);
    } catch (e) {
      console.error(e);
      setErrorArchivo("No he podido leer el archivo. Comprueba que sea un .xlsx o .csv válido.");
    } finally {
      setSubiendoArchivo(false);
    }
  }, [guardarVentas, showToast]);

  const removeVentas = useCallback(async () => {
    await guardarVentas(null);
    showToast("Listado de ventas eliminado");
  }, [guardarVentas, showToast]);

  const ventasParaTelefono = useCallback(
    (phone) => {
      if (!ventas || !phone) return [];
      const norm = normalizePhone(phone);
      if (!norm) return [];
      return ventas.records.filter((r) => r.phone === norm);
    },
    [ventas]
  );

  // ---------- Navegación semana ----------
  const goWeek = useCallback((delta) => {
    setWeekStart((prev) => addDays(prev, delta * 7));
  }, []);

  const weekDates = useMemo(() => DIAS.map((_, i) => addDays(weekStart, i)), [weekStart]);
  const slots = useMemo(() => slotsDia(), []);

  const citasActivas = useMemo(() => citas.filter((c) => c.estado !== "cancelada"), [citas]);
  const totalCitasSemana = citasActivas.length;

  const citasConVenta = useMemo(() => {
    if (!ventas) return new Set();
    const ids = new Set();
    citasActivas.forEach((c) => {
      if (c.telefono && ventasParaTelefono(c.telefono).length > 0) ids.add(c.id);
    });
    return ids;
  }, [citasActivas, ventas, ventasParaTelefono]);

  const cargaPorVendedor = useMemo(() => {
    const map = {};
    vendedores.forEach((v) => (map[v.id] = 0));
    citasActivas.forEach((c) => {
      map[c.vendorId] = (map[c.vendorId] || 0) + 1;
    });
    return map;
  }, [vendedores, citasActivas]);
  const maxCarga = Math.max(1, ...Object.values(cargaPorVendedor));
  const minCarga = vendedores.length ? Math.min(...Object.values(cargaPorVendedor)) : 0;
  const desbalanceado = vendedores.length > 1 && maxCarga - minCarga >= 2;

  if (loading) {
    return (
      <div style={{ ...styles.root, display: "flex", alignItems: "center", justifyContent: "center", minHeight: 400 }}>
        <div style={{ color: "#8A7B5C", fontFamily: "var(--font-body)" }}>Cargando agenda…</div>
      </div>
    );
  }

  return (
    <div style={styles.root}>
      <style>{globalCss}</style>

      <div style={styles.header}>
        <div style={styles.headerTop}>
          <div style={styles.brand}>
            <div style={styles.brandMark}>AV</div>
            <div>
              <div style={styles.brandTitle}>Agenda de vendedores</div>
              <div style={styles.brandSub}>
                {firebaseDisponible ? (
                  <span style={styles.syncOk}><Wifi size={11} /> Sincronizada en tiempo real</span>
                ) : (
                  <span style={styles.syncOff}><WifiOff size={11} /> Modo local — configura Firebase para compartirla</span>
                )}
              </div>
            </div>
          </div>
          <div style={styles.tabs}>
            <button onClick={() => setVista("agenda")} style={vista === "agenda" ? styles.tabActive : styles.tab}>
              <Calendar size={15} /> Agenda
            </button>
            <button onClick={() => setVista("turnos")} style={vista === "turnos" ? styles.tabActive : styles.tab}>
              <Clock size={15} /> Turnos
            </button>
            <button onClick={() => setVista("vendedores")} style={vista === "vendedores" ? styles.tabActive : styles.tab}>
              <Users size={15} /> Vendedores
            </button>
            <button onClick={() => setVista("ventas")} style={vista === "ventas" ? styles.tabActive : styles.tab}>
              <CarFront size={15} /> Ventas
            </button>
          </div>
        </div>

        <div style={styles.weekNav}>
          <button onClick={() => goWeek(-1)} style={styles.navBtn} aria-label="Semana anterior">
            <ChevronLeft size={18} />
          </button>
          <div style={styles.weekLabel}>
            Semana del {fmtDateLabel(weekDates[0])} al {fmtDateLabel(weekDates[5])}
          </div>
          <button onClick={() => goWeek(1)} style={styles.navBtn} aria-label="Semana siguiente">
            <ChevronRight size={18} />
          </button>
          <button onClick={() => setWeekStart(getMonday(new Date()))} style={styles.todayBtn}>
            Hoy
          </button>

          <div style={{ flex: 1 }} />

          {vendedores.length > 0 && (
            <div style={styles.balanceWrap}>
              {desbalanceado && (
                <span style={styles.balanceWarn}>
                  <AlertCircle size={13} /> Carga desigual
                </span>
              )}
              <span style={styles.balanceCount}>{totalCitasSemana} citas esta semana</span>
              {ventas && (
                <span style={styles.balanceSold}>
                  <CarFront size={12} /> {citasConVenta.size} vendidas
                </span>
              )}
            </div>
          )}
        </div>

        {vendedores.length > 0 && (
          <div style={styles.filterBar}>
            <MapPin size={13} color="#A89B7E" style={{ flexShrink: 0 }} />
            <div style={styles.filterChips}>
              {ISLAS.filter((isla) => vendedores.some((v) => v.isla === isla)).map((isla) => {
                const colorIsla = PALETA_ISLAS[isla]?.hue || "#5C5240";
                const activo = filtroIslas.includes(isla);
                return (
                  <button
                    key={isla}
                    onClick={() => toggleFiltroIsla(isla)}
                    style={{
                      ...styles.filterChip,
                      borderColor: activo ? colorIsla : "#E5E0D4",
                      background: activo ? colorIsla : "#fff",
                      color: activo ? "#fff" : "#5C5240",
                    }}
                  >
                    <span style={{ ...styles.filterDot, background: activo ? "#fff" : colorIsla }} />
                    {isla}
                  </button>
                );
              })}
              {sedesFiltrablesDisponibles.filter((sede) => vendedores.some((v) => v.sede === sede)).length > 0 && (
                <span style={styles.filterDivider} />
              )}
              {sedesFiltrablesDisponibles
                .filter((sede) => vendedores.some((v) => v.sede === sede))
                .map((sede) => {
                  const islaDeSede = ISLAS.find((i) => (ISLAS_SEDES[i] || []).includes(sede));
                  const c = colorParaSede(islaDeSede, sede);
                  const activo = filtroSedes.includes(sede);
                  return (
                    <button
                      key={sede}
                      onClick={() => toggleFiltroSede(sede)}
                      style={{
                        ...styles.filterChipSede,
                        borderColor: activo ? c.border : "#E5E0D4",
                        background: activo ? c.bg : "#F7F3E8",
                        color: activo ? c.text : "#7A6B4C",
                      }}
                    >
                      <span style={{ ...styles.filterDot, background: c.border }} />
                      {sede}
                    </button>
                  );
                })}
            </div>
            {(filtroIslas.length > 0 || filtroSedes.length > 0) && (
              <button onClick={limpiarFiltros} style={styles.filterClear}>
                <X size={11} /> Limpiar
              </button>
            )}
          </div>
        )}
      </div>

      {vendedores.length === 0 && (
        <div style={styles.emptyState}>
          <div style={styles.emptyIcon}>👥</div>
          <div style={styles.emptyTitle}>Aún no hay vendedores</div>
          <div style={styles.emptyText}>Añade tu equipo para empezar a repartir turnos y citas.</div>
          <button onClick={() => setVista("vendedores")} style={styles.primaryBtn}>
            <Plus size={16} /> Añadir vendedores
          </button>
        </div>
      )}

      {vendedores.length >= 0 && vista === "vendedores" && (
        <div style={styles.panel}>
          <div style={styles.panelTitle}>Equipo de ventas</div>
          <div style={styles.addRow}>
            <input
              value={nuevoVendedorNombre}
              onChange={(e) => setNuevoVendedorNombre(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAddVendedor()}
              placeholder="Nombre del vendedor"
              style={styles.input}
            />
            <select
              value={nuevoVendedorIsla}
              onChange={(e) => {
                const isla = e.target.value;
                setNuevoVendedorIsla(isla);
                setNuevoVendedorSede((ISLAS_SEDES[isla] || [])[0] || isla);
              }}
              style={styles.select}
            >
              {ISLAS.map((isla) => (
                <option key={isla} value={isla}>{isla}</option>
              ))}
            </select>
            {(ISLAS_SEDES[nuevoVendedorIsla] || []).length > 0 && (
              <select
                value={nuevoVendedorSede}
                onChange={(e) => setNuevoVendedorSede(e.target.value)}
                style={styles.select}
              >
                {ISLAS_SEDES[nuevoVendedorIsla].map((sede) => (
                  <option key={sede} value={sede}>{sede}</option>
                ))}
              </select>
            )}
            <button onClick={handleAddVendedor} style={styles.primaryBtn}>
              <Plus size={16} /> Añadir
            </button>
          </div>
          <div style={styles.vendorList}>
            {vendedores.map((v) => (
              <VendedorRow
                key={v.id}
                vendedor={v}
                citasCount={cargaPorVendedor[v.id] || 0}
                onRemove={() => handleRemoveVendedor(v.id)}
                onUpdateUbicacion={(isla, sede) => updateVendedor(v.id, { isla, sede })}
              />
            ))}
          </div>
        </div>
      )}

      {vendedores.length > 0 && vista === "turnos" && (
        <div style={styles.panel}>
          <div style={styles.panelTitle}>Turnos rotativos de la semana</div>
          <div style={styles.panelHint}>Marca las horas en las que cada vendedor trabaja. Usa los botones rápidos para mañana, tarde o jornada completa.</div>
          {vendedoresFiltrados.length === 0 && (
            <div style={styles.noVendorWarn}>Ningún vendedor coincide con el filtro de isla/sede seleccionado.</div>
          )}
          {vendedoresFiltrados.map((v) => {
            const c = colorParaSede(v.isla, v.sede);
            return (
              <div key={v.id} style={styles.turnoBlock}>
                <div style={styles.turnoVendorHeader}>
                  <div style={{ ...styles.vendorDot, background: c.border }} />
                  <span style={styles.turnoVendorName}>{v.nombre}</span>
                  <span style={styles.turnoVendorLoc}>{v.sede}, {v.isla}</span>
                </div>
                <div style={styles.turnoGrid}>
                  <div style={styles.turnoGridCorner} />
                  {DIAS_CORTO.map((d, i) => (
                    <div key={i} style={styles.turnoDayHeader}>
                      <div>{d}</div>
                      <div style={styles.turnoQuickRow}>
                        <button style={styles.quickBtn} onClick={() => setBulkTurno(v.id, i, "manana")}>M</button>
                        <button style={styles.quickBtn} onClick={() => setBulkTurno(v.id, i, "tarde")}>T</button>
                        <button style={styles.quickBtn} onClick={() => setBulkTurno(v.id, i, "completo")}>C</button>
                        <button style={styles.quickBtnClear} onClick={() => setBulkTurno(v.id, i, "ninguno")}>×</button>
                      </div>
                    </div>
                  ))}
                  {slots.map((h) => (
                    <FragmentRow key={h}>
                      <div style={styles.turnoHourLabel}>{horaLabel(h)}</div>
                      {DIAS.map((_, dayIdx) => {
                        const active = isWorking(v.id, dayIdx, h);
                        return (
                          <button
                            key={dayIdx}
                            onClick={() => toggleTurno(v.id, dayIdx, h)}
                            style={{
                              ...styles.turnoCell,
                              background: active ? c.bg : "transparent",
                              borderColor: active ? c.border : "#E5E0D4",
                            }}
                            aria-label={`${v.nombre} ${active ? "trabaja" : "no trabaja"} ${DIAS[dayIdx]} ${horaLabel(h)}`}
                          >
                            {active && <Check size={12} color={c.border} />}
                          </button>
                        );
                      })}
                    </FragmentRow>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {vendedores.length >= 0 && vista === "ventas" && (
        <div style={styles.panel}>
          <div style={styles.panelTitle}>Listado de ventas</div>
          <div style={styles.panelHint}>
            Sube el Excel o CSV de ventas (teléfono, fecha, vendedor, matrícula/coche) para cruzarlo automáticamente con los teléfonos de tus citas.
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            style={{ display: "none" }}
            onChange={(e) => handleFileUpload(e.target.files?.[0])}
          />

          {!ventas ? (
            <button onClick={() => fileInputRef.current?.click()} disabled={subiendoArchivo} style={styles.uploadBox}>
              <Upload size={22} color="#A8835A" />
              <div style={styles.uploadTitle}>{subiendoArchivo ? "Leyendo archivo…" : "Subir archivo de ventas"}</div>
              <div style={styles.uploadHint}>Excel (.xlsx) o CSV</div>
            </button>
          ) : (
            <div style={styles.fileCard}>
              <FileSpreadsheet size={20} color="#4F9B72" />
              <div style={{ flex: 1 }}>
                <div style={styles.fileName}>{ventas.fileName}</div>
                <div style={styles.fileMeta}>
                  {ventas.records.length} ventas con teléfono válido · subido el{" "}
                  {new Date(ventas.uploadedAt).toLocaleDateString("es-ES")}
                </div>
              </div>
              <button onClick={() => fileInputRef.current?.click()} style={styles.secondaryBtn}>Reemplazar</button>
              <button onClick={removeVentas} style={styles.iconBtn} aria-label="Eliminar listado">
                <Trash2 size={15} />
              </button>
            </div>
          )}

          {errorArchivo && <div style={styles.noVendorWarn}>{errorArchivo}</div>}

          {ventas && (
            <>
              <div style={{ ...styles.panelTitle, marginTop: 26, fontSize: 15 }}>
                Cotejo de citas con teléfono — semana actual
              </div>
              {citasActivas.filter((c) => c.telefono).length === 0 ? (
                <div style={styles.panelHint}>Ninguna cita de esta semana tiene teléfono registrado todavía.</div>
              ) : (
                <div style={styles.cotejoList}>
                  {citasActivas
                    .filter((c) => c.telefono)
                    .map((c) => {
                      const v = vendedores.find((vv) => vv.id === c.vendorId);
                      const matches = ventasParaTelefono(c.telefono);
                      const vendida = matches.length > 0;
                      const colorV = v ? colorParaSede(v.isla, v.sede) : null;
                      return (
                        <div key={c.id} style={{ ...styles.cotejoRow, borderLeftColor: vendida ? "#4F9B72" : "#E5E0D4" }}>
                          <div style={{ ...styles.vendorDot, background: colorV?.border || "#ccc" }} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={styles.cotejoName}>
                              {c.cliente || "Cliente sin nombre"} <span style={styles.cotejoPhone}>{c.telefono}</span>
                            </div>
                            <div style={styles.cotejoMeta}>
                              {DIAS[c.day]} {horaLabel(c.hour)} · {v?.nombre || "—"}
                            </div>
                          </div>
                          {vendida ? (
                            <div style={styles.vendidaTag}>
                              <Check size={12} /> Vendido{matches[0].coche ? ` · ${matches[0].coche}` : ""}
                              {matches[0].date ? ` · ${fmtDateShort(matches[0].date)}` : ""}
                            </div>
                          ) : (
                            <div style={styles.pendienteTag}>Sin venta registrada</div>
                          )}
                        </div>
                      );
                    })}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {vendedores.length > 0 && vista === "agenda" && (
        <div style={styles.panel}>
          <div style={styles.agendaGrid}>
            <div style={styles.agendaCorner}>Hora</div>
            {weekDates.map((d, i) => (
              <div key={i} style={styles.agendaDayHeader}>
                <div style={styles.agendaDayName}>{DIAS_CORTO[i]}</div>
                <div style={styles.agendaDayDate}>{fmtDateLabel(d)}</div>
              </div>
            ))}

            {slots.map((h) => (
              <FragmentRow key={h}>
                <div style={styles.agendaHourLabel}>{horaLabel(h)}</div>
                {DIAS.map((_, dayIdx) => {
                  const disponibles = vendoresDisponibles(dayIdx, h);
                  const citasSlot = citasActivas.filter((c) => c.day === dayIdx && c.hour === h);
                  return (
                    <div key={dayIdx} style={styles.agendaCell}>
                      {citasSlot.map((c) => {
                        const v = vendedores.find((vv) => vv.id === c.vendorId);
                        if (!v) return null;
                        const colorV = colorParaSede(v.isla, v.sede);
                        const vendida = citasConVenta.has(c.id);
                        const fueraDeFiltro = !vendedoresFiltrados.some((vf) => vf.id === v.id);
                        return (
                          <button
                            key={c.id}
                            onClick={() => setModalCita({ existing: c })}
                            style={{
                              ...styles.citaChip,
                              background: colorV.bg,
                              borderColor: colorV.border,
                              color: colorV.text,
                              opacity: fueraDeFiltro ? 0.4 : 1,
                            }}
                            title={`${v.nombre}${c.cliente ? " · " + c.cliente : ""}${c.telefono ? " · " + c.telefono : ""}`}
                          >
                            <span style={{ ...styles.citaDot, background: colorV.border }} />
                            <span style={styles.citaChipText}>{v.nombre.split(" ")[0]}{c.cliente ? ` · ${c.cliente}` : ""}</span>
                            {vendida && <Check size={11} color="#4F9B72" style={{ flexShrink: 0 }} />}
                          </button>
                        );
                      })}
                      {disponibles.length > 0 && (
                        <button
                          onClick={() => setModalCita({ day: dayIdx, hour: h })}
                          style={styles.addCitaBtn}
                          aria-label={`Añadir cita ${DIAS[dayIdx]} ${horaLabel(h)}`}
                        >
                          <Plus size={13} />
                        </button>
                      )}
                      {disponibles.length === 0 && citasSlot.length === 0 && <div style={styles.noOneCell} />}
                    </div>
                  );
                })}
              </FragmentRow>
            ))}
          </div>

          <div style={styles.legend}>
            {vendedoresFiltrados.length === 0 ? (
              <div style={styles.panelHint}>Ningún vendedor coincide con el filtro de isla/sede seleccionado.</div>
            ) : (
              vendedoresFiltrados.map((v) => {
                const c = colorParaSede(v.isla, v.sede);
                return (
                  <div key={v.id} style={styles.legendItem}>
                    <span style={{ ...styles.vendorDot, background: c.border }} />
                    <span style={styles.legendName}>{v.nombre}</span>
                    <span style={styles.legendLocation}>{v.sede}</span>
                    <span style={styles.legendBarWrap}>
                      <span
                        style={{
                          ...styles.legendBar,
                          width: `${Math.max(6, ((cargaPorVendedor[v.id] || 0) / maxCarga) * 100)}%`,
                          background: c.border,
                        }}
                      />
                    </span>
                    <span style={styles.legendCount}>{cargaPorVendedor[v.id] || 0}</span>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {modalCita && (
        <CitaModal
          modalCita={modalCita}
          vendedores={vendedores}
          vendoresDisponibles={vendoresDisponibles}
          sugerirVendedor={sugerirVendedor}
          dias={DIAS}
          ventasParaTelefono={ventasParaTelefono}
          onClose={() => setModalCita(null)}
          onSave={handleSaveCita}
          onCancel={handleCancelCita}
          onDelete={handleDeleteCita}
        />
      )}

      {toast && <div style={styles.toast}>{toast}</div>}
    </div>
  );
}

function FragmentRow({ children }) {
  return <>{children}</>;
}

// ---------- Fila de vendedor (con edición de isla/sede) ----------
function VendedorRow({ vendedor, citasCount, onRemove, onUpdateUbicacion }) {
  const [editando, setEditando] = useState(false);
  const [isla, setIsla] = useState(vendedor.isla || ISLAS[0]);
  const [sede, setSede] = useState(vendedor.sede || (ISLAS_SEDES[vendedor.isla] || [])[0] || vendedor.isla);
  const c = colorParaSede(vendedor.isla, vendedor.sede);

  const guardar = () => {
    onUpdateUbicacion(isla, sede);
    setEditando(false);
  };

  return (
    <div style={{ ...styles.vendorCard, borderLeftColor: c.border, flexWrap: "wrap" }}>
      <div style={{ ...styles.vendorDot, background: c.border }} />
      <div style={{ flex: 1, minWidth: 140 }}>
        <div style={styles.vendorName}>{vendedor.nombre}</div>
        {!editando && (
          <div style={styles.vendorMeta}>
            {citasCount} citas esta semana
            {vendedor.isla && ` · ${vendedor.sede}, ${vendedor.isla}`}
          </div>
        )}
      </div>
      {editando ? (
        <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
          <select
            value={isla}
            onChange={(e) => {
              const nuevaIsla = e.target.value;
              setIsla(nuevaIsla);
              setSede((ISLAS_SEDES[nuevaIsla] || [])[0] || nuevaIsla);
            }}
            style={styles.selectSmall}
          >
            {ISLAS.map((i) => (
              <option key={i} value={i}>{i}</option>
            ))}
          </select>
          {(ISLAS_SEDES[isla] || []).length > 0 && (
            <select value={sede} onChange={(e) => setSede(e.target.value)} style={styles.selectSmall}>
              {ISLAS_SEDES[isla].map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          )}
          <button onClick={guardar} style={styles.iconBtnConfirm} aria-label="Guardar ubicación">
            <Check size={14} />
          </button>
        </div>
      ) : (
        <button onClick={() => setEditando(true)} style={styles.secondaryBtnSmall}>
          <Pencil size={12} /> Editar sede
        </button>
      )}
      <button onClick={onRemove} style={styles.iconBtn} aria-label={`Eliminar ${vendedor.nombre}`}>
        <Trash2 size={15} />
      </button>
    </div>
  );
}

// ---------- Modal de cita (crear / editar / cancelar / eliminar) ----------
function CitaModal({ modalCita, vendedores, vendoresDisponibles, sugerirVendedor, dias, ventasParaTelefono, onClose, onSave, onCancel, onDelete }) {
  const isEdit = !!modalCita.existing;
  const existing = modalCita.existing;
  const day = isEdit ? existing.day : modalCita.day;
  const hour = isEdit ? existing.hour : modalCita.hour;
  const cancelada = isEdit && existing.estado === "cancelada";

  const disponibles = vendoresDisponibles(day, hour);
  const sugerido = !isEdit ? sugerirVendedor(day, hour) : null;

  const [vendorId, setVendorId] = useState(isEdit ? existing.vendorId : sugerido?.id || disponibles[0]?.id || "");
  const [cliente, setCliente] = useState(isEdit ? existing.cliente : "");
  const [telefono, setTelefono] = useState(isEdit ? existing.telefono || "" : "");

  const vendorActual = vendedores.find((v) => v.id === vendorId);
  const matches = telefono ? ventasParaTelefono(telefono) : [];

  // Para editar, ofrecemos también al vendedor actual aunque ya no tenga turno disponible,
  // para no "perder" la asignación si los turnos cambiaron después de crear la cita.
  const opcionesVendedor = useMemo(() => {
    if (!isEdit) return disponibles;
    const yaIncluido = disponibles.some((v) => v.id === existing.vendorId);
    if (yaIncluido) return disponibles;
    const actual = vendedores.find((v) => v.id === existing.vendorId);
    return actual ? [actual, ...disponibles] : disponibles;
  }, [isEdit, disponibles, vendedores, existing]);

  return (
    <div style={styles.modalOverlay} onClick={onClose}>
      <div style={styles.modalCard} onClick={(e) => e.stopPropagation()}>
        <div style={styles.modalHeader}>
          <div>
            <div style={styles.modalTitle}>
              {isEdit ? (cancelada ? "Cita cancelada" : "Editar cita") : "Nueva cita"}
            </div>
            <div style={styles.modalSub}>{dias[day]} · {horaLabel(hour)}</div>
          </div>
          <button onClick={onClose} style={styles.iconBtn} aria-label="Cerrar">
            <X size={18} />
          </button>
        </div>

        {cancelada && (
          <div style={styles.cancelBanner}>
            <AlertCircle size={13} /> Esta cita está cancelada. Puedes reactivarla guardando cambios o eliminarla.
          </div>
        )}

        {sugerido && !isEdit && (
          <div style={styles.suggestBox}>
            <span style={{ ...styles.vendorDot, background: colorParaSede(sugerido.isla, sugerido.sede).border }} />
            Sugerencia: <strong>{sugerido.nombre}</strong> es quien menos citas tiene esta semana.
          </div>
        )}

        <div style={styles.modalField}>
          <label style={styles.modalLabel}>Vendedor</label>
          {opcionesVendedor.length === 0 ? (
            <div style={styles.noVendorWarn}>Nadie tiene turno en este horario.</div>
          ) : (
            <div style={styles.vendorPicker}>
              {opcionesVendedor.map((v) => {
                const c = colorParaSede(v.isla, v.sede);
                return (
                  <button
                    key={v.id}
                    onClick={() => setVendorId(v.id)}
                    style={{
                      ...styles.vendorOption,
                      background: vendorId === v.id ? c.bg : "#fff",
                      borderColor: vendorId === v.id ? c.border : "#E5E0D4",
                    }}
                  >
                    <span style={{ ...styles.vendorDot, background: c.border }} />
                    {v.nombre} <span style={styles.vendorOptionSede}>{v.sede}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div style={styles.modalField}>
          <label style={styles.modalLabel}>Cliente (opcional)</label>
          <input value={cliente} onChange={(e) => setCliente(e.target.value)} placeholder="Nombre del cliente" style={styles.input} />
        </div>

        <div style={styles.modalField}>
          <label style={styles.modalLabel}>Teléfono</label>
          <div style={styles.phoneInputWrap}>
            <Phone size={14} color="#A89B7E" />
            <input
              value={telefono}
              onChange={(e) => setTelefono(e.target.value)}
              placeholder="600 123 456"
              style={styles.phoneInput}
              inputMode="tel"
            />
          </div>
          {matches.length > 0 && (
            <div style={styles.vendidaInline}>
              <Check size={13} /> Este teléfono ya aparece en el listado de ventas
              {matches[0].coche ? ` · ${matches[0].coche}` : ""}
              {matches[0].date ? ` · ${fmtDateShort(matches[0].date)}` : ""}
            </div>
          )}
        </div>

        <div style={styles.modalActions}>
          {isEdit && !cancelada && (
            <button onClick={() => onCancel(existing.id)} style={styles.warnBtn}>
              <X size={15} /> Cancelar cita
            </button>
          )}
          {isEdit && (
            <button onClick={() => onDelete(existing.id)} style={styles.dangerBtn}>
              <Trash2 size={15} /> Eliminar
            </button>
          )}
          <div style={{ flex: 1 }} />
          <button onClick={onClose} style={styles.secondaryBtn}>Cerrar</button>
          <button
            disabled={!vendorActual}
            onClick={() => onSave(vendorId, day, hour, cliente, telefono, isEdit ? existing.id : null)}
            style={{ ...styles.primaryBtn, opacity: vendorActual ? 1 : 0.5 }}
          >
            <Check size={15} /> {isEdit ? (cancelada ? "Reactivar y guardar" : "Guardar cambios") : "Asignar cita"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------- Estilos ----------
const globalCss = `
  @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600&family=Inter:wght@400;500;600;700&display=swap');
  :root {
    --font-display: 'Fraunces', serif;
    --font-body: 'Inter', sans-serif;
  }
  * { box-sizing: border-box; }
  button { cursor: pointer; font-family: var(--font-body); }
  button:focus-visible, input:focus-visible, select:focus-visible { outline: 2px solid #C45A2E; outline-offset: 2px; }
  input, select { font-family: var(--font-body); }
  @media (prefers-reduced-motion: reduce) {
    * { transition: none !important; animation: none !important; }
  }
`;

const styles = {
  root: { fontFamily: "var(--font-body)", background: "#FBF8F2", color: "#2B2620", minHeight: 500, borderRadius: 16, overflow: "hidden", border: "1px solid #EBE4D3" },
  header: { background: "#FBF8F2", borderBottom: "1px solid #EBE4D3", padding: "18px 22px 14px" },
  headerTop: { display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, marginBottom: 14 },
  brand: { display: "flex", alignItems: "center", gap: 12 },
  brandMark: { width: 38, height: 38, borderRadius: 10, background: "#C45A2E", color: "#FFF8EE", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 15, flexShrink: 0 },
  brandTitle: { fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 19, lineHeight: 1.1 },
  brandSub: { fontSize: 12, marginTop: 2 },
  syncOk: { display: "inline-flex", alignItems: "center", gap: 4, color: "#2F5E3F" },
  syncOff: { display: "inline-flex", alignItems: "center", gap: 4, color: "#A14B2C" },
  tabs: { display: "flex", gap: 4, background: "#F1EAD9", padding: 4, borderRadius: 10 },
  tab: { display: "flex", alignItems: "center", gap: 6, border: "none", background: "transparent", color: "#7A6B4C", fontSize: 13, fontWeight: 500, padding: "7px 12px", borderRadius: 8 },
  tabActive: { display: "flex", alignItems: "center", gap: 6, border: "none", background: "#FFFFFF", color: "#C45A2E", fontSize: 13, fontWeight: 600, padding: "7px 12px", borderRadius: 8, boxShadow: "0 1px 3px rgba(0,0,0,0.08)" },
  weekNav: { display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" },
  navBtn: { width: 30, height: 30, borderRadius: 8, border: "1px solid #E5E0D4", background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", color: "#5C5240" },
  weekLabel: { fontSize: 13.5, fontWeight: 600, color: "#3D362A", minWidth: 190 },
  todayBtn: { border: "1px solid #E5E0D4", background: "#fff", borderRadius: 8, fontSize: 12.5, padding: "6px 10px", color: "#5C5240", fontWeight: 500 },
  balanceWrap: { display: "flex", alignItems: "center", gap: 10 },
  balanceWarn: { display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: "#A14B2C", background: "#FBE9DF", padding: "5px 9px", borderRadius: 7, fontWeight: 600 },
  balanceCount: { fontSize: 12.5, color: "#8A7B5C", fontWeight: 500 },
  balanceSold: { display: "flex", alignItems: "center", gap: 4, fontSize: 12, color: "#2F5E3F", background: "#EAF2EC", padding: "5px 9px", borderRadius: 7, fontWeight: 600 },

  filterBar: { display: "flex", alignItems: "center", gap: 8, marginTop: 12, paddingTop: 12, borderTop: "1px solid #EFE9DA", flexWrap: "wrap" },
  filterChips: { display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" },
  filterDot: { width: 6, height: 6, borderRadius: "50%", display: "inline-block" },
  filterChip: { display: "flex", alignItems: "center", gap: 5, border: "1px solid #E5E0D4", background: "#fff", color: "#5C5240", borderRadius: 999, padding: "4px 11px", fontSize: 12, fontWeight: 600 },
  filterChipSede: { display: "flex", alignItems: "center", gap: 5, border: "1px solid #E5E0D4", background: "#F7F3E8", color: "#7A6B4C", borderRadius: 999, padding: "4px 11px", fontSize: 11.5, fontWeight: 500 },
  filterDivider: { width: 1, height: 16, background: "#E5E0D4", margin: "0 2px" },
  filterClear: { display: "flex", alignItems: "center", gap: 4, border: "none", background: "transparent", color: "#A14B2C", fontSize: 12, fontWeight: 600, padding: "4px 6px", marginLeft: "auto" },

  emptyState: { display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "70px 20px", gap: 8, textAlign: "center" },
  emptyIcon: { fontSize: 34, marginBottom: 4 },
  emptyTitle: { fontFamily: "var(--font-display)", fontSize: 19, fontWeight: 600 },
  emptyText: { fontSize: 13.5, color: "#8A7B5C", marginBottom: 10 },

  panel: { padding: "20px 22px 26px" },
  panelTitle: { fontFamily: "var(--font-display)", fontSize: 17, fontWeight: 600, marginBottom: 4 },
  panelHint: { fontSize: 12.5, color: "#8A7B5C", marginBottom: 16 },

  addRow: { display: "flex", gap: 8, marginBottom: 18, maxWidth: 560, flexWrap: "wrap" },
  input: { flex: 1, border: "1px solid #E5E0D4", borderRadius: 9, padding: "9px 12px", fontSize: 13.5, background: "#fff", color: "#2B2620", minWidth: 140 },
  select: { border: "1px solid #E5E0D4", borderRadius: 9, padding: "9px 10px", fontSize: 13, background: "#fff", color: "#2B2620", minWidth: 120 },
  selectSmall: { border: "1px solid #E5E0D4", borderRadius: 7, padding: "5px 7px", fontSize: 12, background: "#fff", color: "#2B2620" },
  primaryBtn: { display: "flex", alignItems: "center", gap: 6, border: "none", background: "#C45A2E", color: "#FFF8EE", borderRadius: 9, padding: "9px 14px", fontSize: 13.5, fontWeight: 600, whiteSpace: "nowrap" },
  secondaryBtn: { border: "1px solid #E5E0D4", background: "#fff", color: "#5C5240", borderRadius: 9, padding: "9px 14px", fontSize: 13.5, fontWeight: 500 },
  secondaryBtnSmall: { display: "flex", alignItems: "center", gap: 5, border: "1px solid #E5E0D4", background: "#fff", color: "#5C5240", borderRadius: 7, padding: "5px 10px", fontSize: 12, fontWeight: 500, whiteSpace: "nowrap" },
  warnBtn: { display: "flex", alignItems: "center", gap: 6, border: "1px solid #E8D2A8", background: "#FBF1DE", color: "#8A5E10", borderRadius: 9, padding: "9px 14px", fontSize: 13, fontWeight: 600 },
  dangerBtn: { display: "flex", alignItems: "center", gap: 6, border: "1px solid #E8BBAB", background: "#FBEDE6", color: "#A14B2C", borderRadius: 9, padding: "9px 14px", fontSize: 13, fontWeight: 600 },
  iconBtn: { border: "none", background: "transparent", color: "#A89B7E", padding: 6, borderRadius: 7, display: "flex", alignItems: "center", justifyContent: "center" },
  iconBtnConfirm: { border: "none", background: "#EAF2EC", color: "#2F5E3F", padding: 6, borderRadius: 7, display: "flex", alignItems: "center", justifyContent: "center" },

  vendorList: { display: "flex", flexDirection: "column", gap: 8, maxWidth: 560 },
  vendorCard: { display: "flex", alignItems: "center", gap: 10, background: "#fff", border: "1px solid #EBE4D3", borderLeft: "4px solid", borderRadius: 10, padding: "10px 12px" },
  vendorDot: { width: 9, height: 9, borderRadius: "50%", flexShrink: 0 },
  vendorName: { fontSize: 14, fontWeight: 600 },
  vendorMeta: { fontSize: 12, color: "#8A7B5C", marginTop: 1 },

  turnoBlock: { marginBottom: 26 },
  turnoVendorHeader: { display: "flex", alignItems: "center", gap: 8, marginBottom: 8 },
  turnoVendorName: { fontSize: 13.5, fontWeight: 600 },
  turnoVendorLoc: { fontSize: 11.5, color: "#A89B7E" },
  turnoGrid: { display: "grid", gridTemplateColumns: "56px repeat(6, 1fr)", gap: 3 },
  turnoGridCorner: {},
  turnoDayHeader: { fontSize: 11, fontWeight: 700, color: "#7A6B4C", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 3, paddingBottom: 4 },
  turnoQuickRow: { display: "flex", gap: 2 },
  quickBtn: { border: "1px solid #E5E0D4", background: "#fff", color: "#7A6B4C", fontSize: 9.5, fontWeight: 700, width: 16, height: 16, borderRadius: 4, padding: 0, display: "flex", alignItems: "center", justifyContent: "center" },
  quickBtnClear: { border: "1px solid #E5E0D4", background: "#fff", color: "#B0654A", fontSize: 11, fontWeight: 700, width: 16, height: 16, borderRadius: 4, padding: 0, display: "flex", alignItems: "center", justifyContent: "center" },
  turnoHourLabel: { fontSize: 10.5, color: "#A89B7E", display: "flex", alignItems: "center", justifyContent: "flex-end", paddingRight: 6 },
  turnoCell: { height: 18, border: "1px solid #E5E0D4", borderRadius: 4, background: "transparent", display: "flex", alignItems: "center", justifyContent: "center", padding: 0 },

  agendaGrid: { display: "grid", gridTemplateColumns: "58px repeat(6, 1fr)", gap: 3 },
  agendaCorner: { fontSize: 10.5, color: "#A89B7E", paddingBottom: 6 },
  agendaDayHeader: { textAlign: "center", paddingBottom: 8 },
  agendaDayName: { fontSize: 11, fontWeight: 700, color: "#7A6B4C" },
  agendaDayDate: { fontSize: 10.5, color: "#A89B7E" },
  agendaHourLabel: { fontSize: 10.5, color: "#A89B7E", display: "flex", alignItems: "flex-start", justifyContent: "flex-end", paddingRight: 6, paddingTop: 5 },
  agendaCell: { minHeight: 38, border: "1px solid #EFE9DA", borderRadius: 6, background: "#FFFEFB", display: "flex", flexDirection: "column", gap: 2, padding: 3, position: "relative" },
  noOneCell: { width: "100%", height: "100%", minHeight: 28 },
  addCitaBtn: { border: "1px dashed #D8CFB8", background: "transparent", color: "#C2B796", borderRadius: 5, height: 22, display: "flex", alignItems: "center", justifyContent: "center" },
  citaChip: { display: "flex", alignItems: "center", gap: 5, border: "1px solid", borderRadius: 6, padding: "3px 6px", fontSize: 10.5, fontWeight: 600, textAlign: "left", overflow: "hidden" },
  citaDot: { width: 6, height: 6, borderRadius: "50%", flexShrink: 0 },
  citaChipText: { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },

  legend: { marginTop: 20, display: "flex", flexDirection: "column", gap: 7, maxWidth: 500 },
  legendItem: { display: "flex", alignItems: "center", gap: 8 },
  legendName: { fontSize: 12, width: 100, flexShrink: 0, color: "#5C5240", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  legendLocation: { fontSize: 11, color: "#A89B7E", width: 90, flexShrink: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  legendBarWrap: { flex: 1, height: 7, background: "#F1EAD9", borderRadius: 4, overflow: "hidden" },
  legendBar: { display: "block", height: "100%", borderRadius: 4 },
  legendCount: { fontSize: 12, fontWeight: 600, width: 20, textAlign: "right", color: "#5C5240" },

  modalOverlay: { position: "fixed", inset: 0, background: "rgba(43,38,32,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 16 },
  modalCard: { background: "#FBF8F2", borderRadius: 14, padding: 22, width: 380, maxWidth: "100%", boxShadow: "0 12px 32px rgba(0,0,0,0.18)", border: "1px solid #EBE4D3" },
  modalHeader: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 },
  modalTitle: { fontFamily: "var(--font-display)", fontSize: 17, fontWeight: 600 },
  modalSub: { fontSize: 12.5, color: "#8A7B5C", marginTop: 2 },
  cancelBanner: { display: "flex", alignItems: "center", gap: 7, fontSize: 12, background: "#FBF1DE", color: "#8A5E10", padding: "8px 10px", borderRadius: 8, marginBottom: 14, fontWeight: 600 },
  suggestBox: { display: "flex", alignItems: "center", gap: 7, fontSize: 12, background: "#EAF2EC", color: "#2F5E3F", padding: "8px 10px", borderRadius: 8, marginBottom: 14 },
  modalField: { marginBottom: 14 },
  modalLabel: { display: "block", fontSize: 12, fontWeight: 600, color: "#7A6B4C", marginBottom: 6 },
  noVendorWarn: { fontSize: 12.5, color: "#A14B2C", background: "#FBEDE6", padding: "8px 10px", borderRadius: 8 },
  vendorPicker: { display: "flex", flexWrap: "wrap", gap: 6 },
  vendorOption: { display: "flex", alignItems: "center", gap: 6, border: "1px solid", borderRadius: 8, padding: "6px 10px", fontSize: 12.5, fontWeight: 500 },
  vendorOptionSede: { fontSize: 10.5, opacity: 0.7, fontWeight: 400 },
  modalActions: { display: "flex", alignItems: "center", gap: 8, marginTop: 18, flexWrap: "wrap" },

  toast: { position: "fixed", bottom: 20, left: "50%", transform: "translateX(-50%)", background: "#2B2620", color: "#FBF8F2", padding: "9px 16px", borderRadius: 9, fontSize: 13, fontWeight: 500, boxShadow: "0 6px 18px rgba(0,0,0,0.25)", zIndex: 60 },

  uploadBox: { display: "flex", flexDirection: "column", alignItems: "center", gap: 4, width: "100%", maxWidth: 420, border: "1.5px dashed #D8CFB8", background: "#FFFEFB", borderRadius: 12, padding: "26px 20px" },
  uploadTitle: { fontSize: 13.5, fontWeight: 600, color: "#5C5240", marginTop: 4 },
  uploadHint: { fontSize: 12, color: "#A89B7E" },

  fileCard: { display: "flex", alignItems: "center", gap: 10, background: "#fff", border: "1px solid #EBE4D3", borderRadius: 10, padding: "12px 14px", maxWidth: 560 },
  fileName: { fontSize: 13.5, fontWeight: 600 },
  fileMeta: { fontSize: 11.5, color: "#8A7B5C", marginTop: 1 },

  cotejoList: { display: "flex", flexDirection: "column", gap: 7, maxWidth: 640 },
  cotejoRow: { display: "flex", alignItems: "center", gap: 10, background: "#fff", border: "1px solid #EBE4D3", borderLeft: "3px solid", borderRadius: 9, padding: "9px 12px" },
  cotejoName: { fontSize: 13, fontWeight: 600 },
  cotejoPhone: { fontSize: 11.5, color: "#A89B7E", fontWeight: 400 },
  cotejoMeta: { fontSize: 11.5, color: "#8A7B5C", marginTop: 1 },
  vendidaTag: { display: "flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 600, color: "#2F5E3F", background: "#EAF2EC", padding: "4px 8px", borderRadius: 7, whiteSpace: "nowrap" },
  pendienteTag: { fontSize: 11, color: "#A89B7E", whiteSpace: "nowrap" },

  phoneInputWrap: { display: "flex", alignItems: "center", gap: 7, border: "1px solid #E5E0D4", borderRadius: 9, padding: "9px 12px", background: "#fff" },
  phoneInput: { flex: 1, border: "none", outline: "none", fontSize: 13.5, background: "transparent", color: "#2B2620" },
  vendidaInline: { display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#2F5E3F", background: "#EAF2EC", padding: "7px 10px", borderRadius: 8, marginTop: 8, fontWeight: 600 },
};
