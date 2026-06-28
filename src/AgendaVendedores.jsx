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
  BarChart3,
  UserCog,
  UserPlus,
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
    { bg: "#CDE6E6", border: "#2B7777", text: "#163939" },
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
  "Tenerife": ["Mayorazgo", "La Orotava", "Chafiras"],
  "Gran Canaria": ["Miller Bajo", "Sebadal", "Arinaga"],
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

// Mes/año en formato "YYYY-MM", para guardar y filtrar a qué mes corresponde un lead sin cita
// (independiente de la fecha en la que se haya dado de alta el registro en la app).
function mesAnioActual() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

const MESES_LABEL = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

function mesAnioLabel(mesAnio) {
  if (!mesAnio) return "Sin mes";
  const [anio, mes] = mesAnio.split("-");
  const idx = Number(mes) - 1;
  if (Number.isNaN(idx) || idx < 0 || idx > 11) return mesAnio;
  return `${MESES_LABEL[idx]} ${anio}`;
}

// Convierte el nombre de mes en español (tal como aparece en muchos Excel: "JUNIO", "Junio"...)
// y el año, a formato "YYYY-MM". Devuelve "" si no se puede interpretar.
function mesAnioDesdeExcel(anioVal, mesVal) {
  const anio = String(anioVal || "").trim();
  const mesTexto = String(mesVal || "").trim().toLowerCase();
  if (!anio || !mesTexto) return "";
  const idx = MESES_LABEL.findIndex((m) => m.toLowerCase() === mesTexto);
  if (idx === -1) return "";
  return `${anio}-${String(idx + 1).padStart(2, "0")}`;
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
//   gestores/{id}               -> {nombre}  (gestor lead: crea la cita, distinto del vendedor)
//   leadsSinCita/{id}            -> {cliente, telefono, gestorId, vendorId, isla, sede, creadoEn}
//   turnos/{weekKey}_{vendorId} -> {weekKey, vendorId, dias: {0:[...],...}}
//   citas/{id}                  -> {weekKey, vendorId, gestorId, day, hour, cliente, telefono}
//   ventas/historico             -> {fileName, uploadedAt, records}  (se sube una vez, KPIs anuales)
//   ventas/cotejo                 -> {fileName, uploadedAt, records}  (se sube a menudo, cotejo en vivo)
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

// Gestores lead: personas que generan/crean la cita, distintas del vendedor que la atiende.
// Solo tienen nombre, sin isla/sede ni turnos asociados.
function useGestoresSync() {
  const [gestores, setGestores] = useState([]);
  const [loadingGestores, setLoadingGestores] = useState(true);

  useEffect(() => {
    if (!firebaseDisponible) {
      setLoadingGestores(false);
      return;
    }
    const gestoresRef = ref(db, "gestores");
    const unsub = onValue(gestoresRef, (snap) => {
      const data = snap.val() || {};
      const list = Object.entries(data).map(([id, g]) => ({ id, ...g }));
      setGestores(list);
      setLoadingGestores(false);
    }, (err) => {
      console.error("Error sincronizando gestores", err);
      setLoadingGestores(false);
    });
    return () => unsub();
  }, []);

  const addGestor = useCallback(async (gestor) => {
    if (!firebaseDisponible) {
      setGestores((prev) => [...prev, gestor]);
      return;
    }
    await set(ref(db, `gestores/${gestor.id}`), { nombre: gestor.nombre });
  }, []);

  const removeGestor = useCallback(async (id) => {
    if (!firebaseDisponible) {
      setGestores((prev) => prev.filter((g) => g.id !== id));
      return;
    }
    await remove(ref(db, `gestores/${id}`));
  }, []);

  return { gestores, loadingGestores, addGestor, removeGestor };
}

// Leads sin cita: clientes que reciben presupuesto o se derivan directamente a un vendedor
// (p.ej. empresas), sin pasar por una cita en la agenda. Se guardan de forma permanente
// (no por semana) para poder cotejarlos igual que una cita cuando se sube un listado de ventas.
function useLeadsSinCitaSync() {
  const [leadsSinCita, setLeadsSinCita] = useState([]);
  const [loadingLeads, setLoadingLeads] = useState(true);

  useEffect(() => {
    if (!firebaseDisponible) {
      setLoadingLeads(false);
      return;
    }
    const leadsRef = ref(db, "leadsSinCita");
    const unsub = onValue(leadsRef, (snap) => {
      const data = snap.val() || {};
      const list = Object.entries(data).map(([id, l]) => ({ id, ...l }));
      setLeadsSinCita(list);
      setLoadingLeads(false);
    }, (err) => {
      console.error("Error sincronizando leads sin cita", err);
      setLoadingLeads(false);
    });
    return () => unsub();
  }, []);

  const addLeadSinCita = useCallback(async (lead) => {
    if (!firebaseDisponible) {
      setLeadsSinCita((prev) => [...prev, lead]);
      return;
    }
    const { id, ...resto } = lead;
    await set(ref(db, `leadsSinCita/${id}`), resto);
  }, []);

  const addLeadsSinCitaEnLote = useCallback(async (leads) => {
    if (!firebaseDisponible) {
      setLeadsSinCita((prev) => [...prev, ...leads]);
      return;
    }
    const updates = {};
    leads.forEach((lead) => {
      const { id, ...resto } = lead;
      updates[`leadsSinCita/${id}`] = resto;
    });
    await update(ref(db), updates);
  }, []);

  const updateLeadSinCita = useCallback(async (id, fields) => {
    if (!firebaseDisponible) {
      setLeadsSinCita((prev) => prev.map((l) => (l.id === id ? { ...l, ...fields } : l)));
      return;
    }
    await update(ref(db, `leadsSinCita/${id}`), fields);
  }, []);

  const removeLeadSinCita = useCallback(async (id) => {
    if (!firebaseDisponible) {
      setLeadsSinCita((prev) => prev.filter((l) => l.id !== id));
      return;
    }
    await remove(ref(db, `leadsSinCita/${id}`));
  }, []);

  return { leadsSinCita, loadingLeads, addLeadSinCita, addLeadsSinCitaEnLote, updateLeadSinCita, removeLeadSinCita };
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

// tipo: "historico" (se sube una vez, alimenta los KPIs del informe anual) o
// "cotejo" (se sube/reemplaza con frecuencia, alimenta el cotejo en vivo de la agenda).
// Cada tipo vive en su propia ruta de Firebase, independiente del otro.
function useVentasSync(tipo) {
  const [ventas, setVentas] = useState(null);
  const path = `ventas/${tipo}`;

  useEffect(() => {
    if (!firebaseDisponible) return;
    const ventasRef = ref(db, path);
    const unsub = onValue(ventasRef, (snap) => {
      setVentas(snap.exists() ? snap.val() : null);
    }, (err) => console.error(`Error sincronizando ventas (${tipo})`, err));
    return () => unsub();
  }, [path, tipo]);

  const guardarVentas = useCallback(
    async (data) => {
      if (!firebaseDisponible) {
        setVentas(data);
        return;
      }
      if (data === null) {
        await remove(ref(db, path));
      } else {
        await set(ref(db, path), data);
      }
    },
    [path]
  );

  return { ventas, guardarVentas };
}

// ---------- Componente principal ----------
export default function AgendaVendedores() {
  const [weekStart, setWeekStart] = useState(() => getMonday(new Date()));
  const weekKey = useMemo(() => fmtWeekKey(weekStart), [weekStart]);

  const { vendedores, loading, addVendedor, removeVendedor, updateVendedor } = useVendedoresSync();
  const { gestores, loadingGestores, addGestor, removeGestor } = useGestoresSync();
  const { leadsSinCita, addLeadSinCita, addLeadsSinCitaEnLote, updateLeadSinCita, removeLeadSinCita } = useLeadsSinCitaSync();
  const { turnos, setTurnoVendorDia } = useTurnosSync(weekKey);
  const { citas, addCita, updateCita, removeCita } = useCitasSync(weekKey);
  const { ventas: ventasHistorico, guardarVentas: guardarVentasHistorico } = useVentasSync("historico");
  const { ventas: ventasCotejo, guardarVentas: guardarVentasCotejo } = useVentasSync("cotejo");

  const [vista, setVista] = useState("agenda");
  const [modalCita, setModalCita] = useState(null);
  const [nuevoVendedorNombre, setNuevoVendedorNombre] = useState("");
  const [nuevoVendedorIsla, setNuevoVendedorIsla] = useState(ISLAS[0]);
  const [nuevoVendedorSede, setNuevoVendedorSede] = useState((ISLAS_SEDES[ISLAS[0]] || [])[0] || "");
  const [nuevoGestorNombre, setNuevoGestorNombre] = useState("");
  const [nuevoLeadCliente, setNuevoLeadCliente] = useState("");
  const [nuevoLeadTelefono, setNuevoLeadTelefono] = useState("");
  const [nuevoLeadGestorId, setNuevoLeadGestorId] = useState("");
  const [nuevoLeadVendorId, setNuevoLeadVendorId] = useState("");
  const [nuevoLeadIsla, setNuevoLeadIsla] = useState("");
  const [nuevoLeadSede, setNuevoLeadSede] = useState("");
  const [nuevoLeadMesAnio, setNuevoLeadMesAnio] = useState(mesAnioActual());
  const [toast, setToast] = useState(null);
  const [subiendoHistorico, setSubiendoHistorico] = useState(false);
  const [errorHistorico, setErrorHistorico] = useState(null);
  const fileInputHistoricoRef = useRef(null);
  const [subiendoCotejo, setSubiendoCotejo] = useState(false);
  const [errorCotejo, setErrorCotejo] = useState(null);
  const fileInputCotejoRef = useRef(null);
  const [filtroIslas, setFiltroIslas] = useState([]);
  const [filtroSedes, setFiltroSedes] = useState([]);
  const [leadBusqueda, setLeadBusqueda] = useState("");
  const [leadFiltroEstado, setLeadFiltroEstado] = useState("todos");
  const [leadFiltroGestorId, setLeadFiltroGestorId] = useState("");
  const [leadFiltroIsla, setLeadFiltroIsla] = useState("");
  const [leadFiltroMesAnio, setLeadFiltroMesAnio] = useState("");

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

  // ---------- Gestores lead ----------
  const handleAddGestor = useCallback(async () => {
    const nombre = nuevoGestorNombre.trim();
    if (!nombre) return;
    const nuevo = { id: genId(), nombre };
    await addGestor(nuevo);
    setNuevoGestorNombre("");
    showToast(`${nombre} añadido como gestor lead`);
  }, [nuevoGestorNombre, addGestor, showToast]);

  const handleRemoveGestor = useCallback(
    async (id) => {
      const g = gestores.find((x) => x.id === id);
      await removeGestor(id);
      showToast(g ? `${g.nombre} eliminado` : "Gestor eliminado");
      // No borramos las citas que ya tuviera asignado este gestor: simplemente quedan
      // sin gestor asociado (gestorId apunta a un id que ya no existe en la lista).
    },
    [gestores, removeGestor, showToast]
  );

  // ---------- Leads sin cita (presupuesto / derivados directamente a vendedor) ----------
  const handleAddLeadSinCita = useCallback(async () => {
    const cliente = nuevoLeadCliente.trim();
    const telefono = nuevoLeadTelefono.trim();
    if (!cliente && !telefono) return;
    const nuevo = {
      id: genId(),
      cliente,
      telefono,
      gestorId: nuevoLeadGestorId || "",
      vendorId: nuevoLeadVendorId || "",
      isla: nuevoLeadIsla || "",
      sede: nuevoLeadSede || "",
      mesAnio: nuevoLeadMesAnio || "",
      creadoEn: new Date().toISOString(),
      origen: "manual",
    };
    await addLeadSinCita(nuevo);
    setNuevoLeadCliente("");
    setNuevoLeadTelefono("");
    setNuevoLeadGestorId("");
    setNuevoLeadVendorId("");
    setNuevoLeadIsla("");
    setNuevoLeadSede("");
    // El mes/año NO se resetea: si está añadiendo varios leads del mismo mes seguidos,
    // no tiene que volver a seleccionarlo cada vez.
    showToast(`${cliente || "Lead"} añadido`);
  }, [nuevoLeadCliente, nuevoLeadTelefono, nuevoLeadGestorId, nuevoLeadVendorId, nuevoLeadIsla, nuevoLeadSede, nuevoLeadMesAnio, addLeadSinCita, showToast]);

  const handleRemoveLeadSinCita = useCallback(
    async (id) => {
      await removeLeadSinCita(id);
      showToast("Lead eliminado");
    },
    [removeLeadSinCita, showToast]
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
    async (vendorId, dayIdx, hour, cliente, telefono, idExistente, gestorId) => {
      if (idExistente) {
        await updateCita(idExistente, { vendorId, day: dayIdx, hour, cliente: cliente || "", telefono: telefono || "", gestorId: gestorId || "" });
        showToast("Cita actualizada");
      } else {
        await addCita({
          id: genId(),
          vendorId,
          day: dayIdx,
          hour,
          cliente: cliente || "",
          telefono: telefono || "",
          gestorId: gestorId || "",
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

  // ---------- Listado de ventas (histórico anual + cotejo en vivo, independientes) ----------
  // Construye el manejador de subida para un slot concreto ("historico" o "cotejo"),
  // reutilizando la misma lógica de lectura y detección de columnas para ambos.
  // Si crearLeadsAutomaticos es true (solo se usa para el histórico), las filas sin fecha de
  // cita se interpretan como "leads sin cita" (presupuesto / derivado directo a vendedor) y se
  // crean automáticamente en esa lista, emparejando vendedor y gestor lead por nombre si existen.
  const crearHandleFileUpload = useCallback(
    (guardarFn, setSubiendo, setError, crearLeadsAutomaticos) =>
      async (file) => {
        if (!file) return;
        setSubiendo(true);
        setError(null);
        try {
          const buf = await file.arrayBuffer();
          const wb = XLSX.read(buf, { type: "array", cellDates: true });
          const sheet = wb.Sheets[wb.SheetNames[0]];
          const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });

          if (rows.length === 0) {
            setError("El archivo no tiene filas con datos.");
            setSubiendo(false);
            return;
          }

          const keys = Object.keys(rows[0]);
          const findKey = (...patterns) =>
            keys.find((k) => patterns.some((p) => k.toLowerCase().replace(/[^a-z0-9]/g, "").includes(p)));

          const kPhone = findKey("telefono", "tel", "movil", "phone");
          const kDate = findKey("fecha");
          const kVendedor = findKey("vendedor", "comercial", "asesor");
          const kGestorLead = findKey("gestor", "lead", "captador");
          const kCoche = findKey("matricula", "coche", "vehiculo", "car");
          const kModelo = findKey("modelo", "model");
          const kIsla = findKey("isla", "island", "provincia");
          const kSede = findKey("sede", "oficina", "delegacion", "branch");
          const kCliente = findKey("cliente", "nombre", "customer", "client");
          const kVendido = findKey("vendido", "venta", "sold", "estado", "cierre");
          const kAnio = findKey("ao", "anyo", "year");
          const kMes = findKey("mes", "month");

          if (!kPhone) {
            setError("No he encontrado una columna de teléfono en el archivo.");
            setSubiendo(false);
            return;
          }

          // Algunos listados usan siglas de provincia en vez del nombre completo de la isla.
          const SIGLAS_ISLA = {
            tf: "Tenerife",
            gc: "Gran Canaria",
            lz: "Lanzarote",
            fv: "Fuerteventura",
            lp: "La Palma",
          };
          const normalizarIsla = (val) => {
            const s = String(val ?? "").trim();
            if (!s) return "";
            const sigla = SIGLAS_ISLA[s.toLowerCase()];
            return sigla || s;
          };

          // Estados que cuentan como venta confirmada (p.ej. "Vendido", "Pedido" = reserva en curso).
          // Vacío o estados intermedios (p.ej. "Presupuesto") se consideran "sin decidir todavía".
          const esVendidoTexto = (val) => {
            if (val === true || val === 1) return true;
            const s = String(val ?? "").trim().toLowerCase();
            if (!s) return null; // sin dato: no afirmamos nada
            if (["si", "sí", "vendido", "vendida", "pedido", "yes", "true", "1", "x"].includes(s)) return true;
            if (["no", "perdido", "perdida", "cancelado", "cancelada", "no interesa", "pendiente", "false", "0"].includes(s)) return false;
            return null; // estados intermedios desconocidos (ej. "Presupuesto"): no afirmamos nada
          };

          const filasLeidas = rows.map((r) => {
            const fecha = kDate ? parseAnyDate(r[kDate]) : null;
            let mesAnio = kAnio && kMes ? mesAnioDesdeExcel(r[kAnio], r[kMes]) : "";
            if (!mesAnio && fecha) {
              mesAnio = `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, "0")}`;
            }
            return {
              phone: normalizePhone(r[kPhone]),
              date: fecha,
              vendedor: kVendedor ? String(r[kVendedor] || "").trim() : "",
              gestorLead: kGestorLead ? String(r[kGestorLead] || "").trim() : "",
              coche: kCoche ? String(r[kCoche] || "").trim() : "",
              modelo: kModelo ? String(r[kModelo] || "").trim() : "",
              isla: kIsla ? normalizarIsla(r[kIsla]) : "",
              sede: kSede ? String(r[kSede] || "").trim() : "",
              cliente: kCliente ? String(r[kCliente] || "").trim() : "",
              vendido: kVendido ? esVendidoTexto(r[kVendido]) : null,
              mesAnio,
            };
          });

          const records = filasLeidas.filter((r) => r.phone);

          let leadsCreados = 0;
          if (crearLeadsAutomaticos) {
            // Filas sin fecha de cita = lead sin cita (presupuesto / derivado directo).
            // Se ignoran las que ya existan (mismo teléfono) para no duplicar al reemplazar el archivo.
            const sinFecha = records.filter((r) => !r.date);
            const telefonosExistentes = new Set(
              leadsSinCita.map((l) => normalizePhone(l.telefono)).filter(Boolean)
            );
            const normalizaNombre = (s) => String(s || "").trim().toLowerCase();
            const nuevosLeads = sinFecha
              .filter((r) => !telefonosExistentes.has(r.phone))
              .map((r) => {
                const vendedorMatch = vendedores.find((v) => normalizaNombre(v.nombre) === normalizaNombre(r.vendedor));
                const gestorMatch = gestores.find((g) => normalizaNombre(g.nombre) === normalizaNombre(r.gestorLead));
                return {
                  id: genId(),
                  cliente: r.cliente || "",
                  telefono: r.phone || "",
                  gestorId: gestorMatch?.id || "",
                  vendorId: vendedorMatch?.id || "",
                  isla: r.isla || "",
                  sede: r.sede || "",
                  mesAnio: r.mesAnio || "",
                  creadoEn: new Date().toISOString(),
                  origen: "excel",
                };
              });
            // Evita duplicados también dentro del propio archivo si el mismo teléfono se repite.
            const vistos = new Set();
            const nuevosLeadsUnicos = nuevosLeads.filter((l) => {
              if (!l.telefono || vistos.has(l.telefono)) return !l.telefono;
              vistos.add(l.telefono);
              return true;
            });
            if (nuevosLeadsUnicos.length > 0) {
              await addLeadsSinCitaEnLote(nuevosLeadsUnicos);
              leadsCreados = nuevosLeadsUnicos.length;
            }
          }

          const data = {
            fileName: file.name,
            uploadedAt: new Date().toISOString(),
            totalFilas: rows.length,
            records,
          };
          await guardarFn(data);
          showToast(
            leadsCreados > 0
              ? `Listado cargado: ${records.length} filas · ${leadsCreados} clientes sin cita añadidos`
              : `Listado cargado: ${records.length} ventas con teléfono válido`
          );
        } catch (e) {
          console.error(e);
          setError("No he podido leer el archivo. Comprueba que sea un .xlsx o .csv válido.");
        } finally {
          setSubiendo(false);
        }
      },
    [showToast, leadsSinCita, vendedores, gestores, addLeadsSinCitaEnLote]
  );

  const handleFileUploadHistorico = useCallback(
    (file) => crearHandleFileUpload(guardarVentasHistorico, setSubiendoHistorico, setErrorHistorico, true)(file),
    [crearHandleFileUpload, guardarVentasHistorico]
  );
  const handleFileUploadCotejo = useCallback(
    (file) => crearHandleFileUpload(guardarVentasCotejo, setSubiendoCotejo, setErrorCotejo, false)(file),
    [crearHandleFileUpload, guardarVentasCotejo]
  );

  const removeVentasHistorico = useCallback(async () => {
    await guardarVentasHistorico(null);
    showToast("Listado histórico eliminado");
  }, [guardarVentasHistorico, showToast]);

  const removeVentasCotejo = useCallback(async () => {
    await guardarVentasCotejo(null);
    showToast("Listado de cotejo eliminado");
  }, [guardarVentasCotejo, showToast]);

  // Combina los registros de ambos listados (histórico anual + cotejo en vivo) en uno solo,
  // para que el cotejo de teléfonos y los KPIs del informe tengan en cuenta toda la información
  // disponible, sin importar en qué pestaña se cargó cada listado.
  const todosLosRegistros = useMemo(() => {
    const a = ventasHistorico?.records || [];
    const b = ventasCotejo?.records || [];
    return [...a, ...b];
  }, [ventasHistorico, ventasCotejo]);

  const hayVentasCargadas = (ventasHistorico?.records?.length || 0) > 0 || (ventasCotejo?.records?.length || 0) > 0;

  const ventasParaTelefono = useCallback(
    (phone) => {
      if (!phone || todosLosRegistros.length === 0) return [];
      const norm = normalizePhone(phone);
      if (!norm) return [];
      return todosLosRegistros.filter((r) => r.phone === norm);
    },
    [todosLosRegistros]
  );

  // Determina si un conjunto de coincidencias de ventas representa una venta confirmada.
  // Si el conjunto combinado de listados trae una columna de estado (CIERRE/vendido) con
  // al menos un valor explícito en alguna fila, se asume que esa columna existe de verdad:
  // una coincidencia sin ese dato entonces cuenta como "sin decidir todavía", no como venta.
  // Solo si ningún listado tiene esa columna (listados antiguos) se usa el respaldo de
  // "aparecer en el listado = venta".
  const esVendida = useCallback(
    (matches) => {
      if (!matches || matches.length === 0) return false;
      const columnaEstadoExiste = todosLosRegistros.some((r) => r.vendido !== null && r.vendido !== undefined);
      if (!columnaEstadoExiste) return true;
      return matches.some((m) => m.vendido === true);
    },
    [todosLosRegistros]
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
    if (!hayVentasCargadas) return new Set();
    const ids = new Set();
    citasActivas.forEach((c) => {
      if (c.telefono && esVendida(ventasParaTelefono(c.telefono))) ids.add(c.id);
    });
    return ids;
  }, [citasActivas, hayVentasCargadas, ventasParaTelefono, esVendida]);

  const leadsSinCitaConVenta = useMemo(() => {
    if (!hayVentasCargadas) return new Set();
    const ids = new Set();
    leadsSinCita.forEach((l) => {
      if (l.telefono && esVendida(ventasParaTelefono(l.telefono))) ids.add(l.id);
    });
    return ids;
  }, [leadsSinCita, hayVentasCargadas, ventasParaTelefono, esVendida]);

  // Meses/años presentes en los leads sin cita, ordenados del más reciente al más antiguo,
  // para rellenar el desplegable de filtro sin tener que escribirlos a mano.
  const mesesDisponiblesLeads = useMemo(() => {
    const set = new Set(leadsSinCita.map((l) => l.mesAnio).filter(Boolean));
    return Array.from(set).sort().reverse();
  }, [leadsSinCita]);

  const leadsSinCitaFiltrados = useMemo(() => {
    const busqueda = leadBusqueda.trim().toLowerCase();
    return leadsSinCita.filter((l) => {
      if (busqueda) {
        const nombre = (l.cliente || "").toLowerCase();
        const tel = (l.telefono || "").toLowerCase();
        if (!nombre.includes(busqueda) && !tel.includes(busqueda)) return false;
      }
      if (leadFiltroGestorId && l.gestorId !== leadFiltroGestorId) return false;
      if (leadFiltroIsla && l.isla !== leadFiltroIsla) return false;
      if (leadFiltroMesAnio && l.mesAnio !== leadFiltroMesAnio) return false;
      if (leadFiltroEstado !== "todos") {
        const matches = ventasParaTelefono(l.telefono);
        const estado = matches.length === 0 ? "sinregistro" : esVendida(matches) ? "vendido" : "novendido";
        if (estado !== leadFiltroEstado) return false;
      }
      return true;
    });
  }, [leadsSinCita, leadBusqueda, leadFiltroGestorId, leadFiltroIsla, leadFiltroMesAnio, leadFiltroEstado, ventasParaTelefono, esVendida]);

  const limpiarFiltrosLeads = useCallback(() => {
    setLeadBusqueda("");
    setLeadFiltroEstado("todos");
    setLeadFiltroGestorId("");
    setLeadFiltroIsla("");
    setLeadFiltroMesAnio("");
  }, []);

  const hayFiltrosLeadsActivos =
    leadBusqueda || leadFiltroEstado !== "todos" || leadFiltroGestorId || leadFiltroIsla || leadFiltroMesAnio;

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

  const citasPorGestor = useMemo(() => {
    const map = {};
    gestores.forEach((g) => (map[g.id] = 0));
    citasActivas.forEach((c) => {
      if (c.gestorId) map[c.gestorId] = (map[c.gestorId] || 0) + 1;
    });
    return map;
  }, [gestores, citasActivas]);

  // Convierte cada lead sin cita en un registro con la misma forma que los del Excel,
  // para que entre igual en los KPIs (citas generadas por gestor lead, con o sin vendedor).
  // El estado de venta se resuelve en vivo cruzando su teléfono con los listados cargados.
  const registrosDeLeadsSinCita = useMemo(() => {
    return leadsSinCita.map((l) => {
      const v = vendedores.find((vv) => vv.id === l.vendorId);
      const g = gestores.find((gg) => gg.id === l.gestorId);
      const matches = ventasParaTelefono(l.telefono);
      const columnaEstadoExiste = todosLosRegistros.some((r) => r.vendido !== null && r.vendido !== undefined);
      const vendido = matches.length === 0
        ? null
        : columnaEstadoExiste
          ? (matches.some((m) => m.vendido === true) ? true : matches.some((m) => m.vendido === false) ? false : null)
          : true;
      return {
        phone: normalizePhone(l.telefono),
        date: l.creadoEn ? new Date(l.creadoEn) : null,
        vendedor: v?.nombre || "",
        gestorLead: g?.nombre || "",
        coche: "",
        modelo: matches[0]?.modelo || matches[0]?.coche || "",
        isla: l.isla || matches[0]?.isla || "",
        sede: l.sede || matches[0]?.sede || "",
        cliente: l.cliente || matches[0]?.cliente || "",
        vendido,
      };
    });
  }, [leadsSinCita, vendedores, gestores, ventasParaTelefono, todosLosRegistros]);

  // ---------- Resumen anual del listado de ventas (histórico + cotejo + leads sin cita) ----------
  const resumenVentas = useMemo(() => {
    const registrosCombinados = [...todosLosRegistros, ...registrosDeLeadsSinCita];
    if (registrosCombinados.length === 0) return null;

    // Si el mismo teléfono aparece en varios orígenes (p.ej. una cita del histórico que luego
    // se vuelve a ver en un cotejo posterior, o un lead sin cita que coincide con una fila del
    // Excel), evitamos contarla dos veces en los KPIs. Nos quedamos con un registro por
    // teléfono, priorizando el que confirme una venta.
    const porTelefono = new Map();
    registrosCombinados.forEach((r) => {
      if (!r.phone) return;
      const previo = porTelefono.get(r.phone);
      if (!previo) {
        porTelefono.set(r.phone, r);
      } else if (previo.vendido !== true && r.vendido === true) {
        porTelefono.set(r.phone, r);
      }
    });
    // Los leads sin cita sin teléfono (puede pasar, ya que solo el nombre es obligatorio)
    // no se pueden cotejar por teléfono, pero igualmente deben contar en el informe.
    const sinTelefono = registrosCombinados.filter((r) => !r.phone);
    const registrosUnicos = [...Array.from(porTelefono.values()), ...sinTelefono];

    const conDatoExplicito = (r) => r.vendido !== null && r.vendido !== undefined;
    // Si el conjunto combinado trae la columna de estado (CIERRE/vendido) con al menos un
    // valor explícito, asumimos que esa columna existe de verdad: una fila vacía entonces
    // significa "aún sin decidir", no "vendido". Solo si NINGUNA fila trae ese dato (listados
    // antiguos sin columna de estado) usamos el respaldo de "aparecer en el listado = vendido".
    const columnaEstadoExiste = registrosUnicos.some(conDatoExplicito);
    const esVendidaRecord = (r) =>
      columnaEstadoExiste ? r.vendido === true : true;

    const totalRegistros = registrosUnicos.length;
    const vendidos = registrosUnicos.filter(esVendidaRecord);
    const noVendidos = columnaEstadoExiste
      ? registrosUnicos.filter((r) => r.vendido === false)
      : [];
    const totalVendidos = vendidos.length;
    const tasaConversion = totalRegistros > 0 ? Math.round((totalVendidos / totalRegistros) * 100) : 0;

    const agrupar = (campo) => {
      const map = {};
      registrosUnicos.forEach((r) => {
        const clave = (r[campo] || "Sin especificar").trim() || "Sin especificar";
        if (!map[clave]) map[clave] = { total: 0, vendidos: 0 };
        map[clave].total += 1;
        if (esVendidaRecord(r)) map[clave].vendidos += 1;
      });
      return Object.entries(map)
        .map(([nombre, datos]) => ({ nombre, ...datos }))
        .sort((a, b) => b.vendidos - a.vendidos || b.total - a.total);
    };

    const porVendedor = agrupar("vendedor");
    const porGestorLead = agrupar("gestorLead");
    const porIsla = agrupar("isla");
    const porModelo = agrupar("modelo");

    const fechasValidas = registrosUnicos.map((r) => r.date).filter(Boolean);
    const fechaMin = fechasValidas.length ? new Date(Math.min(...fechasValidas)) : null;
    const fechaMax = fechasValidas.length ? new Date(Math.max(...fechasValidas)) : null;

    return {
      totalRegistros,
      totalVendidos,
      totalNoVendidos: noVendidos.length,
      tasaConversion,
      porVendedor,
      porGestorLead,
      porIsla,
      porModelo,
      fechaMin,
      fechaMax,
    };
  }, [todosLosRegistros, registrosDeLeadsSinCita]);

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
            <button onClick={() => setVista("gestores")} style={vista === "gestores" ? styles.tabActive : styles.tab}>
              <UserCog size={15} /> Gestores
            </button>
            <button onClick={() => setVista("sincita")} style={vista === "sincita" ? styles.tabActive : styles.tab}>
              <UserPlus size={15} /> Sin cita
            </button>
            <button onClick={() => setVista("ventas")} style={vista === "ventas" ? styles.tabActive : styles.tab}>
              <CarFront size={15} /> Ventas
            </button>
            <button onClick={() => setVista("informe")} style={vista === "informe" ? styles.tabActive : styles.tab}>
              <BarChart3 size={15} /> Informe
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
              {hayVentasCargadas && (
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

      {gestores.length >= 0 && vista === "gestores" && (
        <div style={styles.panel}>
          <div style={styles.panelTitle}>Gestores lead</div>
          <div style={styles.panelHint}>
            Quienes generan o captan la cita, antes de que la atienda un vendedor. Se usan para analizar KPIs de citas, ventas y visitas por gestor.
          </div>
          <div style={styles.addRow}>
            <input
              value={nuevoGestorNombre}
              onChange={(e) => setNuevoGestorNombre(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAddGestor()}
              placeholder="Nombre del gestor lead"
              style={styles.input}
            />
            <button onClick={handleAddGestor} style={styles.primaryBtn}>
              <Plus size={16} /> Añadir
            </button>
          </div>
          <div style={styles.vendorList}>
            {gestores.length === 0 ? (
              <div style={styles.panelHint}>Aún no hay gestores lead añadidos.</div>
            ) : (
              gestores.map((g) => (
                <div key={g.id} style={{ ...styles.vendorCard, borderLeftColor: "#A8835A" }}>
                  <div style={{ ...styles.vendorDot, background: "#A8835A" }} />
                  <div style={{ flex: 1, minWidth: 140 }}>
                    <div style={styles.vendorName}>{g.nombre}</div>
                    <div style={styles.vendorMeta}>{citasPorGestor[g.id] || 0} citas esta semana</div>
                  </div>
                  <button onClick={() => handleRemoveGestor(g.id)} style={styles.iconBtn} aria-label={`Eliminar ${g.nombre}`}>
                    <Trash2 size={15} />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {vista === "sincita" && (
        <div style={styles.panel}>
          <div style={styles.panelTitle}>Clientes sin cita</div>
          <div style={styles.panelHint}>
            Presupuestos enviados o derivaciones directas a un vendedor (p.ej. empresas), sin pasar por la agenda. Cuentan igualmente en los KPIs de gestor lead y se cotejan por teléfono como una cita más.
          </div>

          <div style={styles.leadFormGrid}>
            <input
              value={nuevoLeadCliente}
              onChange={(e) => setNuevoLeadCliente(e.target.value)}
              placeholder="Nombre del cliente"
              style={styles.input}
            />
            <div style={styles.phoneInputWrap}>
              <Phone size={14} color="#A89B7E" />
              <input
                value={nuevoLeadTelefono}
                onChange={(e) => setNuevoLeadTelefono(e.target.value)}
                placeholder="Teléfono"
                style={styles.phoneInput}
                inputMode="tel"
              />
            </div>
            <select value={nuevoLeadGestorId} onChange={(e) => setNuevoLeadGestorId(e.target.value)} style={styles.select}>
              <option value="">Gestor lead…</option>
              {gestores.map((g) => (
                <option key={g.id} value={g.id}>{g.nombre}</option>
              ))}
            </select>
            <select value={nuevoLeadVendorId} onChange={(e) => setNuevoLeadVendorId(e.target.value)} style={styles.select}>
              <option value="">Vendedor (opcional)…</option>
              {vendedores.map((v) => (
                <option key={v.id} value={v.id}>{v.nombre}</option>
              ))}
            </select>
            <select
              value={nuevoLeadIsla}
              onChange={(e) => {
                const isla = e.target.value;
                setNuevoLeadIsla(isla);
                setNuevoLeadSede((ISLAS_SEDES[isla] || [])[0] || "");
              }}
              style={styles.select}
            >
              <option value="">Isla (opcional)…</option>
              {ISLAS.map((isla) => (
                <option key={isla} value={isla}>{isla}</option>
              ))}
            </select>
            {(ISLAS_SEDES[nuevoLeadIsla] || []).length > 0 && (
              <select value={nuevoLeadSede} onChange={(e) => setNuevoLeadSede(e.target.value)} style={styles.select}>
                {ISLAS_SEDES[nuevoLeadIsla].map((sede) => (
                  <option key={sede} value={sede}>{sede}</option>
                ))}
              </select>
            )}
            <input
              type="month"
              value={nuevoLeadMesAnio}
              onChange={(e) => setNuevoLeadMesAnio(e.target.value)}
              style={styles.select}
              title="Mes al que corresponde este lead"
            />
            <button onClick={handleAddLeadSinCita} style={styles.primaryBtn}>
              <Plus size={16} /> Añadir
            </button>
          </div>

          {leadsSinCita.length > 0 && (
            <div style={styles.leadFiltrosBar}>
              <input
                value={leadBusqueda}
                onChange={(e) => setLeadBusqueda(e.target.value)}
                placeholder="Buscar por nombre o teléfono…"
                style={{ ...styles.input, maxWidth: 220 }}
              />
              <select value={leadFiltroEstado} onChange={(e) => setLeadFiltroEstado(e.target.value)} style={styles.selectSmall}>
                <option value="todos">Todos los estados</option>
                <option value="vendido">Vendido</option>
                <option value="novendido">No vendido</option>
                <option value="sinregistro">Sin venta registrada</option>
              </select>
              <select value={leadFiltroGestorId} onChange={(e) => setLeadFiltroGestorId(e.target.value)} style={styles.selectSmall}>
                <option value="">Todos los gestores</option>
                {gestores.map((g) => (
                  <option key={g.id} value={g.id}>{g.nombre}</option>
                ))}
              </select>
              <select value={leadFiltroIsla} onChange={(e) => setLeadFiltroIsla(e.target.value)} style={styles.selectSmall}>
                <option value="">Todas las islas</option>
                {ISLAS.map((isla) => (
                  <option key={isla} value={isla}>{isla}</option>
                ))}
              </select>
              <select value={leadFiltroMesAnio} onChange={(e) => setLeadFiltroMesAnio(e.target.value)} style={styles.selectSmall}>
                <option value="">Todos los meses</option>
                {mesesDisponiblesLeads.map((m) => (
                  <option key={m} value={m}>{mesAnioLabel(m)}</option>
                ))}
              </select>
              {hayFiltrosLeadsActivos && (
                <button onClick={limpiarFiltrosLeads} style={styles.filterClear}>
                  <X size={11} /> Limpiar
                </button>
              )}
            </div>
          )}

          <div style={styles.vendorList}>
            {leadsSinCita.length === 0 ? (
              <div style={styles.panelHint}>Aún no hay clientes sin cita añadidos.</div>
            ) : leadsSinCitaFiltrados.length === 0 ? (
              <div style={styles.panelHint}>Ningún cliente coincide con los filtros seleccionados.</div>
            ) : (
              <>
                <div style={styles.panelHint}>{leadsSinCitaFiltrados.length} de {leadsSinCita.length} clientes</div>
                {leadsSinCitaFiltrados.map((l) => {
                  const v = vendedores.find((vv) => vv.id === l.vendorId);
                  const g = gestores.find((gg) => gg.id === l.gestorId);
                  const vendido = leadsSinCitaConVenta.has(l.id);
                  const matches = ventasParaTelefono(l.telefono);
                  return (
                    <div key={l.id} style={{ ...styles.cotejoRow, borderLeftColor: vendido ? "#4F9B72" : "#E5E0D4" }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={styles.cotejoName}>
                          {l.cliente || "Cliente sin nombre"} <span style={styles.cotejoPhone}>{l.telefono}</span>
                        </div>
                        <div style={styles.cotejoMeta}>
                          {g?.nombre ? `Gestor: ${g.nombre}` : "Sin gestor"}
                          {v?.nombre ? ` · ${v.nombre}` : " · Sin vendedor"}
                          {l.isla ? ` · ${l.isla}` : ""}
                          {l.sede ? ` (${l.sede})` : ""}
                          {l.mesAnio ? ` · ${mesAnioLabel(l.mesAnio)}` : ""}
                        </div>
                      </div>
                      {matches.length > 0 ? (
                        vendido ? (
                          <div style={styles.vendidaTag}>
                            <Check size={12} /> Vendido
                            {matches[0]?.modelo ? ` · ${matches[0].modelo}` : matches[0]?.coche ? ` · ${matches[0].coche}` : ""}
                          </div>
                        ) : (
                          <div style={styles.pendienteTag}>No vendido</div>
                        )
                      ) : (
                        <div style={styles.pendienteTag}>Sin venta registrada</div>
                      )}
                      <button onClick={() => handleRemoveLeadSinCita(l.id)} style={styles.iconBtn} aria-label={`Eliminar ${l.cliente}`}>
                        <Trash2 size={15} />
                      </button>
                    </div>
                  );
                })}
              </>
            )}
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
          <div style={styles.panelTitle}>Listado histórico (KPIs del año)</div>
          <div style={styles.panelHint}>
            Súbelo una sola vez con todas las citas del año en curso. Alimenta el informe anual de KPIs. No hace falta volver a subirlo salvo que quieras añadir más datos.
          </div>

          <input
            ref={fileInputHistoricoRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            style={{ display: "none" }}
            onChange={(e) => handleFileUploadHistorico(e.target.files?.[0])}
          />

          {!ventasHistorico ? (
            <button onClick={() => fileInputHistoricoRef.current?.click()} disabled={subiendoHistorico} style={styles.uploadBox}>
              <Upload size={22} color="#A8835A" />
              <div style={styles.uploadTitle}>{subiendoHistorico ? "Leyendo archivo…" : "Subir listado histórico"}</div>
              <div style={styles.uploadHint}>Excel (.xlsx) o CSV</div>
            </button>
          ) : (
            <div style={styles.fileCard}>
              <FileSpreadsheet size={20} color="#4F9B72" />
              <div style={{ flex: 1 }}>
                <div style={styles.fileName}>{ventasHistorico.fileName}</div>
                <div style={styles.fileMeta}>
                  {ventasHistorico.records.length} citas con teléfono válido · subido el{" "}
                  {new Date(ventasHistorico.uploadedAt).toLocaleDateString("es-ES")}
                </div>
              </div>
              <button onClick={() => fileInputHistoricoRef.current?.click()} style={styles.secondaryBtn}>Reemplazar</button>
              <button onClick={removeVentasHistorico} style={styles.iconBtn} aria-label="Eliminar listado histórico">
                <Trash2 size={15} />
              </button>
            </div>
          )}
          {errorHistorico && <div style={styles.noVendorWarn}>{errorHistorico}</div>}

          <div style={{ ...styles.panelTitle, marginTop: 30 }}>Listado de cotejo (ventas recientes)</div>
          <div style={styles.panelHint}>
            Súbelo cada vez que quieras comprobar si las citas de la agenda ya se han convertido en venta. Al subir uno nuevo, reemplaza solo a este listado — el histórico no se ve afectado.
          </div>

          <input
            ref={fileInputCotejoRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            style={{ display: "none" }}
            onChange={(e) => handleFileUploadCotejo(e.target.files?.[0])}
          />

          {!ventasCotejo ? (
            <button onClick={() => fileInputCotejoRef.current?.click()} disabled={subiendoCotejo} style={styles.uploadBox}>
              <Upload size={22} color="#A8835A" />
              <div style={styles.uploadTitle}>{subiendoCotejo ? "Leyendo archivo…" : "Subir listado de cotejo"}</div>
              <div style={styles.uploadHint}>Excel (.xlsx) o CSV</div>
            </button>
          ) : (
            <div style={styles.fileCard}>
              <FileSpreadsheet size={20} color="#4F9B72" />
              <div style={{ flex: 1 }}>
                <div style={styles.fileName}>{ventasCotejo.fileName}</div>
                <div style={styles.fileMeta}>
                  {ventasCotejo.records.length} ventas con teléfono válido · subido el{" "}
                  {new Date(ventasCotejo.uploadedAt).toLocaleDateString("es-ES")}
                </div>
              </div>
              <button onClick={() => fileInputCotejoRef.current?.click()} style={styles.secondaryBtn}>Reemplazar</button>
              <button onClick={removeVentasCotejo} style={styles.iconBtn} aria-label="Eliminar listado de cotejo">
                <Trash2 size={15} />
              </button>
            </div>
          )}
          {errorCotejo && <div style={styles.noVendorWarn}>{errorCotejo}</div>}

          {hayVentasCargadas && (
            <>
              <div style={{ ...styles.panelTitle, marginTop: 30, fontSize: 15 }}>
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
                      const g = gestores.find((gg) => gg.id === c.gestorId);
                      const matches = ventasParaTelefono(c.telefono);
                      const vendida = esVendida(matches);
                      const mejor = matches[0];
                      const colorV = v ? colorParaSede(v.isla, v.sede) : null;
                      return (
                        <div key={c.id} style={{ ...styles.cotejoRow, borderLeftColor: vendida ? "#4F9B72" : "#E5E0D4" }}>
                          <div style={{ ...styles.vendorDot, background: colorV?.border || "#ccc" }} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={styles.cotejoName}>
                              {c.cliente || mejor?.cliente || "Cliente sin nombre"} <span style={styles.cotejoPhone}>{c.telefono}</span>
                            </div>
                            <div style={styles.cotejoMeta}>
                              {DIAS[c.day]} {horaLabel(c.hour)} · {v?.nombre || "—"}
                              {(g?.nombre || mejor?.gestorLead) ? ` · Gestor: ${g?.nombre || mejor.gestorLead}` : ""}
                              {mejor?.isla ? ` · ${mejor.isla}` : ""}
                              {mejor?.sede ? ` (${mejor.sede})` : ""}
                            </div>
                          </div>
                          {matches.length > 0 ? (
                            vendida ? (
                              <div style={styles.vendidaTag}>
                                <Check size={12} /> Vendido
                                {mejor?.modelo ? ` · ${mejor.modelo}` : mejor?.coche ? ` · ${mejor.coche}` : ""}
                                {mejor?.date ? ` · ${fmtDateShort(mejor.date)}` : ""}
                              </div>
                            ) : (
                              <div style={styles.pendienteTag}>No vendido{mejor?.date ? ` · ${fmtDateShort(mejor.date)}` : ""}</div>
                            )
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

      {vista === "informe" && (
        <div style={styles.panel}>
          <div style={styles.panelTitle}>Informe anual de ventas</div>
          <div style={styles.panelHint}>
            Resumen calculado a partir del listado histórico y del listado de cotejo, cargados en la pestaña "Ventas".
          </div>

          {!resumenVentas ? (
            <div style={styles.noVendorWarn}>
              Aún no hay ningún listado cargado. Ve a la pestaña "Ventas" y sube tu Excel o CSV para ver aquí el informe.
            </div>
          ) : (
            <>
              {(resumenVentas.fechaMin || resumenVentas.fechaMax) && (
                <div style={{ ...styles.panelHint, marginBottom: 18 }}>
                  Periodo cubierto: {resumenVentas.fechaMin ? fmtDateShort(resumenVentas.fechaMin) : "?"} — {resumenVentas.fechaMax ? fmtDateShort(resumenVentas.fechaMax) : "?"}
                </div>
              )}

              <div style={styles.informeStatsRow}>
                <div style={styles.informeStatCard}>
                  <div style={styles.informeStatNumber}>{resumenVentas.totalRegistros}</div>
                  <div style={styles.informeStatLabel}>Registros totales</div>
                </div>
                <div style={{ ...styles.informeStatCard, borderColor: "#4F9B72" }}>
                  <div style={{ ...styles.informeStatNumber, color: "#2F5E3F" }}>{resumenVentas.totalVendidos}</div>
                  <div style={styles.informeStatLabel}>Vendidos</div>
                </div>
                {resumenVentas.totalNoVendidos > 0 && (
                  <div style={styles.informeStatCard}>
                    <div style={styles.informeStatNumber}>{resumenVentas.totalNoVendidos}</div>
                    <div style={styles.informeStatLabel}>No vendidos</div>
                  </div>
                )}
                <div style={styles.informeStatCard}>
                  <div style={styles.informeStatNumber}>{resumenVentas.tasaConversion}%</div>
                  <div style={styles.informeStatLabel}>Tasa de conversión</div>
                </div>
              </div>

              <InformeTabla titulo="Por vendedor" filas={resumenVentas.porVendedor} />
              <InformeTabla titulo="Por gestor lead" filas={resumenVentas.porGestorLead} />
              <InformeTabla titulo="Por isla" filas={resumenVentas.porIsla} />
              <InformeTabla titulo="Por modelo" filas={resumenVentas.porModelo} />
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
                        const g = gestores.find((gg) => gg.id === c.gestorId);
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
                            title={`${v.nombre}${c.cliente ? " · " + c.cliente : ""}${c.telefono ? " · " + c.telefono : ""}${g ? " · Gestor: " + g.nombre : ""}`}
                          >
                            <span style={{ ...styles.citaDot, background: colorV.border }} />
                            <span style={styles.citaChipTextWrap}>
                              <span style={styles.citaChipText}>{v.nombre.split(" ")[0]}{c.cliente ? ` · ${c.cliente}` : ""}</span>
                              {g && <span style={styles.citaChipGestor}>Gestor: {g.nombre}</span>}
                            </span>
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
          gestores={gestores}
          vendoresDisponibles={vendoresDisponibles}
          sugerirVendedor={sugerirVendedor}
          dias={DIAS}
          ventasParaTelefono={ventasParaTelefono}
          esVendida={esVendida}
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

// ---------- Tabla de desglose para el informe anual ----------
function InformeTabla({ titulo, filas }) {
  if (!filas || filas.length === 0) return null;
  const maxVendidos = Math.max(1, ...filas.map((f) => f.vendidos));
  return (
    <div style={styles.informeTablaWrap}>
      <div style={styles.informeTablaTitulo}>{titulo}</div>
      <div style={styles.informeTablaRows}>
        {filas.map((f) => {
          const tasa = f.total > 0 ? Math.round((f.vendidos / f.total) * 100) : 0;
          return (
            <div key={f.nombre} style={styles.informeTablaRow}>
              <span style={styles.informeTablaNombre}>{f.nombre}</span>
              <span style={styles.legendBarWrap}>
                <span
                  style={{
                    ...styles.legendBar,
                    width: `${Math.max(6, (f.vendidos / maxVendidos) * 100)}%`,
                    background: "#4F9B72",
                  }}
                />
              </span>
              <span style={styles.informeTablaCifras}>{f.vendidos}/{f.total}</span>
              <span style={styles.informeTablaTasa}>{tasa}%</span>
            </div>
          );
        })}
      </div>
    </div>
  );
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
function CitaModal({ modalCita, vendedores, gestores, vendoresDisponibles, sugerirVendedor, dias, ventasParaTelefono, esVendida, onClose, onSave, onCancel, onDelete }) {
  const isEdit = !!modalCita.existing;
  const existing = modalCita.existing;
  const day = isEdit ? existing.day : modalCita.day;
  const hour = isEdit ? existing.hour : modalCita.hour;
  const cancelada = isEdit && existing.estado === "cancelada";

  const disponibles = vendoresDisponibles(day, hour);
  const sugerido = !isEdit ? sugerirVendedor(day, hour) : null;

  const [vendorId, setVendorId] = useState(isEdit ? existing.vendorId : sugerido?.id || disponibles[0]?.id || "");
  const [gestorId, setGestorId] = useState(isEdit ? existing.gestorId || "" : "");
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
          <label style={styles.modalLabel}>Gestor lead (quién generó la cita)</label>
          {gestores.length === 0 ? (
            <div style={styles.panelHint}>Aún no hay gestores lead creados. Puedes añadirlos en la pestaña "Gestores".</div>
          ) : (
            <select value={gestorId} onChange={(e) => setGestorId(e.target.value)} style={{ ...styles.select, width: "100%" }}>
              <option value="">Sin gestor asignado</option>
              {gestores.map((g) => (
                <option key={g.id} value={g.id}>{g.nombre}</option>
              ))}
            </select>
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
          {matches.length > 0 && (() => {
            const mejor = matches[0];
            const vendida = esVendida(matches);
            return (
              <div style={{ ...styles.vendidaInline, ...(vendida ? {} : { background: "#FBF1DE", color: "#8A5E10" }) }}>
                <Check size={13} /> {vendida ? "Vendido" : "Registrado, sin venta"} según el listado
                {mejor.modelo ? ` · ${mejor.modelo}` : mejor.coche ? ` · ${mejor.coche}` : ""}
                {mejor.isla ? ` · ${mejor.isla}` : ""}
                {mejor.sede ? ` (${mejor.sede})` : ""}
                {mejor.date ? ` · ${fmtDateShort(mejor.date)}` : ""}
              </div>
            );
          })()}
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
            onClick={() => onSave(vendorId, day, hour, cliente, telefono, isEdit ? existing.id : null, gestorId)}
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
  leadFormGrid: { display: "flex", gap: 8, marginBottom: 18, flexWrap: "wrap", maxWidth: 760, alignItems: "center" },
  leadFiltrosBar: { display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap", alignItems: "center", paddingTop: 14, borderTop: "1px solid #EFE9DA" },
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
  citaChipTextWrap: { display: "flex", flexDirection: "column", overflow: "hidden", flex: 1, minWidth: 0 },
  citaChipGestor: { fontSize: 9, fontWeight: 500, opacity: 0.75, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },

  legend: { marginTop: 20, display: "flex", flexDirection: "column", gap: 7, maxWidth: 500 },
  legendItem: { display: "flex", alignItems: "center", gap: 8 },
  legendName: { fontSize: 12, width: 100, flexShrink: 0, color: "#5C5240", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  legendLocation: { fontSize: 11, color: "#A89B7E", width: 90, flexShrink: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  legendBarWrap: { flex: 1, height: 7, background: "#F1EAD9", borderRadius: 4, overflow: "hidden" },
  legendBar: { display: "block", height: "100%", borderRadius: 4 },
  legendCount: { fontSize: 12, fontWeight: 600, width: 20, textAlign: "right", color: "#5C5240" },

  informeStatsRow: { display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 26 },
  informeStatCard: { border: "1px solid #EBE4D3", borderRadius: 10, padding: "14px 18px", background: "#fff", minWidth: 120 },
  informeStatNumber: { fontFamily: "var(--font-display)", fontSize: 24, fontWeight: 600, color: "#3D362A" },
  informeStatLabel: { fontSize: 11.5, color: "#8A7B5C", marginTop: 2 },

  informeTablaWrap: { marginBottom: 24, maxWidth: 560 },
  informeTablaTitulo: { fontSize: 13.5, fontWeight: 600, marginBottom: 10, color: "#3D362A" },
  informeTablaRows: { display: "flex", flexDirection: "column", gap: 7 },
  informeTablaRow: { display: "flex", alignItems: "center", gap: 8 },
  informeTablaNombre: { fontSize: 12, width: 130, flexShrink: 0, color: "#5C5240", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  informeTablaCifras: { fontSize: 12, fontWeight: 600, width: 48, textAlign: "right", color: "#5C5240", flexShrink: 0 },
  informeTablaTasa: { fontSize: 11.5, width: 38, textAlign: "right", color: "#8A7B5C", flexShrink: 0 },

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
