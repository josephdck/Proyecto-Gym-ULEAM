// --- CONFIGURACIÓN GLOBAL ---
const MAX_FALTAS = 5; // Umbral máximo de inasistencias antes de aplicar el baneo automático.

/**
 * Diccionario de facultades y carreras de la universidad.
 * Se utiliza para popular dinámicamente los `<select>` dependientes en el registro.
 */
const ULEAM_ACADEMICA = {
    "Ciencias de la Salud": ["Medicina", "Odontología", "Enfermería", "Fisioterapia", "Fonoaudiología", "Laboratorio Clínico", "Terapia Ocupacional", "Psicología", "Nutrición y Dietética"],
    "Ciencias Administrativas, Contables y Comercio": ["Administración de Empresas", "Mercadotecnia", "Contabilidad y Auditoría", "Auditoría y Control de Gestión", "Finanzas", "Comercio Exterior", "Gestión de la Información Gerencial"],
    "Educación, Turismo, Artes y Humanidades": ["Educación Inicial", "Educación Especial", "Psicología Educativa", "Educación Básica", "Pedagogía de la Actividad Física y el Deporte", "Pedagogía de la Lengua y la Literatura", "Pedagogía de los Idiomas Nacionales y Extranjeros", "Turismo", "Hospitalidad y Hotelería", "Artes Plásticas", "Sociología", "Artes Escénicas"],
    "Ingeniería, Industria y Construcción": ["Ingeniería Civil", "Ingeniería Marítima", "Ingeniería Eléctrica", "Arquitectura", "Ingeniería Industrial", "Ingeniería de Alimentos"],
    "Ciencias de la Vida y Tecnologías": ["Ingeniería Agropecuaria", "Agronegocios", "Ingeniería Agroindustrial", "Ingeniería Ambiental", "Ingeniería en Tecnologías de la Información", "Ingeniería en Software", "Biología"],
    "Ciencias Sociales, Derecho y Bienestar": ["Derecho", "Economía", "Trabajo Social", "Comunicación"]
};

// --- FUNCIONES UTILITARIAS Y DE GENERACIÓN DE DATOS ---

/**
 * Almacena los feriados nacionales de Ecuador (formato YYYY-MM-DD) traídos
 * desde un servicio web externo. Se llena de forma asíncrona al iniciar la app.
 * Si la consulta falla, queda vacío y el sistema simplemente no excluye feriados
 * (degradación segura: sigue funcionando solo con la regla de fines de semana).
 */
let feriadosEcuador = [];

/**
 * Consume el servicio web público Nager.Date para obtener los feriados de
 * Ecuador del año actual y el siguiente (cubre el caso de que la ventana de
 * 10 días hábiles cruce de diciembre a enero).
 */
async function cargarFeriados() {
    try {
        const anioActual = new Date().getFullYear();
        const anioSiguiente = anioActual + 1;
        const [respActual, respSiguiente] = await Promise.all([
            fetch(`https://date.nager.at/api/v3/PublicHolidays/${anioActual}/EC`),
            fetch(`https://date.nager.at/api/v3/PublicHolidays/${anioSiguiente}/EC`)
        ]);
        const dataActual = await respActual.json();
        const dataSiguiente = await respSiguiente.json();
        feriadosEcuador = [...dataActual, ...dataSiguiente].map(f => f.date);
    } catch (err) {
        feriadosEcuador = [];
    }
}

/**
 * Genera un arreglo con los próximos 10 días hábiles (ignora sábados y domingos).
 * @returns {Array} Array de objetos con el valor (YYYY-MM-DD) y texto formateado para la UI.
 */
function obtenerDiasValidos() {
    const fechas = [];
    let f = new Date();
    let count = 0;
    while(count < 10) { 
        let dia = f.getDay();
        if(dia !== 0 && dia !== 6) { // 0 = Domingo, 6 = Sábado
            let anio = f.getFullYear();
            let mes = String(f.getMonth() + 1).padStart(2, '0');
            let diaStr = String(f.getDate()).padStart(2, '0');
            let valor = `${anio}-${mes}-${diaStr}`;
            if (!feriadosEcuador.includes(valor)) { // Excluye feriados nacionales
                let diasTexto = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
                fechas.push({ valor, texto: `${diasTexto[dia]} ${diaStr}/${mes}/${anio}` });
                count++;
            }
        }
        f.setDate(f.getDate() + 1); // Avanza un día en el bucle
    }
    return fechas;
}

/**
 * Genera la estructura de horarios base del gimnasio (de 08:00 a 19:00).
 * @returns {Array} Array de objetos con ID, rango de horas y cupo máximo.
 */
function generarHorarios() {
    const horas = [];
    for (let i = 8; i < 19; i++) {
        const inicio = i.toString().padStart(2, '0') + ':00';
        const fin = (i + 1).toString().padStart(2, '0') + ':00';
        horas.push({ id: `h${i}`, hora: `${inicio} - ${fin}`, max: 30 });
    }
    return horas;
}

/**
 * Inicializa la base de datos simulada.
 * Si el LocalStorage está vacío, inyecta 100 usuarios aleatorios con reservas
 * para asegurar que el panel de administrador siempre tenga datos de prueba (Seeding).
 */
function initDB() {
    const defaultDB = {
        usuarios: [], admin: { usuario: 'admin', clave: 'admin123', nombre: 'Administrador' },
        horarios: { bailoterapia: generarHorarios(), fuerza: generarHorarios() }, reservas: []
    };
    
    // Arrays semilla para la generación aleatoria de perfiles
    const nombresSeed = ["Juan", "Pedro", "María", "Ana", "Luis", "Carlos", "Diana", "Elena", "Jorge", "Sofía", "Gabriel", "Camila", "Diego", "Valeria", "Alejandro", "Daniela", "José", "Paula", "Andrés", "Natalia"];
    const apellidosSeed = ["Vera", "Párraga", "Cedeño", "Chávez", "Mendoza", "Loor", "Véliz", "Zambrano", "Barcia", "Intriago", "Macías", "Moreira", "Lucas", "Flores", "Saltos", "Bailón"];
    const facultadesKeys = Object.keys(ULEAM_ACADEMICA);
    const fechasPrueba = obtenerDiasValidos().map(d => d.valor);

    // Bucle generador de 100 estudiantes dummy
    for (let i = 2; i <= 101; i++) {
        const nom = nombresSeed[Math.floor(Math.random() * nombresSeed.length)];
        const ape1 = apellidosSeed[Math.floor(Math.random() * apellidosSeed.length)];
        const ape2 = apellidosSeed[Math.floor(Math.random() * apellidosSeed.length)];
        const fac = facultadesKeys[Math.floor(Math.random() * facultadesKeys.length)];
        const carrerasList = ULEAM_ACADEMICA[fac];
        const carr = carrerasList[Math.floor(Math.random() * carrerasList.length)];
        const sem = Math.floor(Math.random() * 10) + 1;
        const ced = "131" + String(1000000 + i).substring(1);
        const corr = `e${ced}@live.uleam.edu.ec`;
        
        defaultDB.usuarios.push({
            id: i, correo: corr, cedula: ced, clave: "1234", nombre: `${nom} ${ape1} ${ape2}`,
            facultad: fac, carrera: carr, semestre: sem, preguntaSeguridad: "ciudad", respuestaSeguridad: "manta",
            faltas: { bailoterapia: 0, fuerza: 0 }, baneadoHasta: { bailoterapia: null, fuerza: null }, activo: true
        });

        // Asignación aleatoria de reservas en los próximos días hábiles
        if (fechasPrueba.length > 0) {
            const catAleatoria = Math.random() > 0.5 ? "bailoterapia" : "fuerza";
            const diaAleatorio = fechasPrueba[Math.floor(Math.random() * fechasPrueba.length)];
            const horaAleatoriaId = `h${Math.floor(Math.random() * 11) + 8}`; 

            defaultDB.reservas.push({
                id: `res_mock_${i}`, usuarioId: i, categoria: catAleatoria,
                horarioId: horaAleatoriaId, dia: diaAleatorio, estado: 'pendiente'
            });
        }
    }

    // Verificación de existencia previa en memoria persistente
    const dbGuardada = localStorage.getItem('gym_db');
    if (dbGuardada) {
        const db = JSON.parse(dbGuardada);
        // Validaciones de integridad estructural
        if (!db.horarios) db.horarios = defaultDB.horarios;
        if (!db.reservas) db.reservas = [];
        if (!db.usuarios || db.usuarios.length < 50) db.usuarios = defaultDB.usuarios; 
        if (!db.admin) db.admin = defaultDB.admin;
        return db;
    }
    return defaultDB;
}

// --- GESTIÓN DE ESTADO (STATE MANAGEMENT) ---
// DB es el "estado global" de toda la app. NO es reactivo por sí solo (es un objeto
// JS plano, no un ref de Vue): cada componente Vue lo lee directamente dentro de sus
// `computed`, y usamos un contador `refreshKey` como truco para forzar el recálculo
// cada vez que DB cambia (ver montarDashboardVue / montarAdminVue más abajo).
let DB = initDB();

// Persiste el objeto DB completo en LocalStorage (memoria que sobrevive a cerrar el navegador).
// Se llama después de CUALQUIER mutación de datos (nueva reserva, cambio de asistencia, etc.)
function saveDB() { localStorage.setItem('gym_db', JSON.stringify(DB)); }

// getSesion/setSesion usan SessionStorage (a diferencia de LocalStorage, se borra al cerrar
// la pestaña). Aquí guardamos solo el id/rol del usuario logueado, no sus datos completos.
function getSesion() { return JSON.parse(sessionStorage.getItem('sesion') || 'null'); }
function setSesion(data) { sessionStorage.setItem('sesion', JSON.stringify(data)); }

/**
 * Componente UI: Toast Notification.
 * Muestra alertas no intrusivas en pantalla. Usa un timer para auto-ocultarse (Debounce).
 */
function mostrarToast(mensaje, tipo = 'exito') {
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.textContent = mensaje;
    toast.className = `toast toast-${tipo} visible`;
    clearTimeout(toast._timer); // Evita superposición de animaciones
    toast._timer = setTimeout(() => toast.classList.remove('visible'), 3500);
}

/**
 * Asigna una acción por defecto a botones que aún no tienen lógica implementada,
 * mejorando la experiencia de usuario (UX).
 */
function activarEnlacesMuertos() {
    document.querySelectorAll('a[href="#"]').forEach(link => {
        if (!link.onclick && !link.dataset.seccion && link.id !== 'btnAbrirRecuperar' && link.id !== 'btnAbrirReglamento' && link.id !== 'btnMisReservas' && link.id !== 'btnMiHistorial') {
            link.onclick = (e) => { e.preventDefault(); mostrarToast('⚙️ Esta subsección se habilitará automáticamente.', 'exito'); };
        }
    });
}

// ============================================================
//  CONTROLADOR DE VISTA: INDEX (Login y Registro)
// ============================================================
// Nota: el login/registro/recuperación en sí ya son manejados por la app Vue
// que vive directamente en index.html (createApp con handleLogin, handleRegistro,
// handleRecuperar). Esta función solo cablea los modales "extra" que quedan
// fuera de esa app Vue (reglamento y aviso de baneo), controlando su visibilidad
// agregando/quitando la clase CSS 'oculto'.
function initIndex() {
    if (!document.getElementById('app')) return; // Si no estamos en index.html, no hace nada

    const modalReglamento = document.getElementById('modalReglamento');
    const btnAbrirReglamento = document.getElementById('btnAbrirReglamento');
    if (modalReglamento && btnAbrirReglamento) {
        const cerrarReglamento = () => modalReglamento.classList.add('oculto');
        btnAbrirReglamento.onclick = (e) => { e.preventDefault(); modalReglamento.classList.remove('oculto'); };
        document.getElementById('btnCerrarReglamento').onclick = cerrarReglamento;
        document.getElementById('btnEntendidoReglamento').onclick = cerrarReglamento;
    }

    // Modal informativo que se muestra si el login detecta un usuario baneado
    const modalBan = document.getElementById('modalBan');
    if (document.getElementById('btnCerrarBan')) {
        document.getElementById('btnCerrarBan').onclick = () => modalBan.classList.add('oculto');
    }
}

// ============================================================
//  CONTROLADOR DE VISTA: DASHBOARD (Estudiante)
// ============================================================

/**
 * Función "pura" (no toca el DOM, solo devuelve datos) que arma la lista de horarios
 * de una categoría para un día específico, ya con toda la lógica de negocio resuelta:
 * cupos disponibles, si el usuario ya tiene turno ahí, si está baneado, si ya pasó
 * la hora límite de reserva, etc.
 *
 * Se llama DESDE DENTRO de un `computed` de Vue (ver montarDashboardVue), por eso no
 * necesita ser reactiva ella misma: Vue solo necesita que el `computed` que la envuelve
 * se vuelva a ejecutar cuando algo cambia, y eso se logra con el truco de `refreshKey`.
 */
function construirFilasHorario(categoria, diaElegido) {
    if (!diaElegido) return [];

    const sesion = getSesion();
    const usuario = sesion ? DB.usuarios.find(u => u.id === sesion.id) : null;
    const hoyStr = new Date().toISOString().split('T')[0];
    const estaBaneado = usuario?.baneadoHasta?.[categoria] && usuario.baneadoHasta[categoria] >= hoyStr;
    const reservaPendienteGlobal = DB.reservas.find(r => r.usuarioId === usuario?.id && r.estado === 'pendiente');
    const reservaEnEsteDia = DB.reservas.find(r => r.usuarioId === usuario?.id && r.dia === diaElegido);

    return DB.horarios[categoria].map(h => {
        const ocupadosEsteDia = DB.reservas.filter(r => r.categoria === categoria && r.horarioId === h.id && r.dia === diaElegido && r.estado !== 'falto').length;
        const disponibles = h.max - ocupadosEsteDia;
        const esEstaFila = !!(reservaPendienteGlobal && reservaPendienteGlobal.categoria === categoria && reservaPendienteGlobal.horarioId === h.id && reservaPendienteGlobal.dia === diaElegido);

        // Cierra la reserva 1 hora antes de que empiece la sesión, solo si el día elegido es hoy.
        // Ej: si el horario es "14:00-15:00" (h14), limiteReserva queda en las 13:00 de hoy;
        // pasada esa hora, cerrado=true y el botón deja de mostrar "Reservar".
        let cerrado = false;
        if (diaElegido === hoyStr) {
            const horaInicio = parseInt(h.id.replace('h', ''), 10); // "h14" -> 14
            const limiteReserva = new Date();
            limiteReserva.setHours(horaInicio - 1, 0, 0, 0);
            cerrado = new Date() >= limiteReserva;
        }

        // Prioridad de estados del botón: de más restrictivo a menos restrictivo.
        // El orden de estos "if" importa: un usuario baneado ve "Baneado" aunque también
        // tenga otras condiciones ciertas, porque esa validación va primero.
        let btnTipo = 'reservar';
        if (estaBaneado) btnTipo = 'baneado';
        else if (esEstaFila) btnTipo = 'cancelar';
        else if (reservaEnEsteDia && reservaEnEsteDia.estado !== 'pendiente') btnTipo = 'yaFuiste';
        else if (reservaPendienteGlobal) btnTipo = 'turnoActivo';
        else if (disponibles <= 0) btnTipo = 'lleno';
        else if (cerrado) btnTipo = 'cerrado';

        return { id: h.id, hora: h.hora, max: h.max, disponibles, esEstaFila, btnTipo };
    });
}

/**
 * Monta la app de Vue 3 sobre el elemento #app-dashboard (todo el <body> de dashboard.html).
 * Este es el corazón de la migración a Vue: en vez de reconstruir HTML a mano con
 * innerHTML cada vez que algo cambia (como se hacía en la versión Vanilla JS),
 * declaramos el estado con `ref`/`computed` y dejamos que Vue actualice el DOM solo.
 */
// Referencia a la instancia montada del dashboard, para poder refrescarla desde
// afuera del setup() cuando otra pestaña (ej. el admin) modifica la base de datos.
let dashboardVM = null;

function montarDashboardVue() {
    const el = document.getElementById('app-dashboard');
    if (!el || el.__vue_app__) return; // Evita montar la app dos veces sobre el mismo elemento

    const { ref, computed } = Vue;
    const diasValidos = obtenerDiasValidos(); // Se calcula una sola vez al montar (no cambia en caliente)

    const app = Vue.createApp({
        setup() {
            // --- ESTADO REACTIVO ---
            // Un `ref` envuelve un valor primitivo en un objeto reactivo: cuando `.value`
            // cambia, Vue automáticamente vuelve a renderizar cualquier parte del HTML
            // que lo esté usando (v-model, {{ }}, :class, etc.)
            const categoriaActiva = ref('bailoterapia');
            const diaBailo = ref(diasValidos[0]?.valor || '');
            const diaFuerza = ref(diasValidos[0]?.valor || '');

            // Truco clave del proyecto: DB es un objeto plano fuera de Vue, así que Vue no
            // "sabe" cuándo cambia. Solución: cada vez que mutamos DB (nueva reserva,
            // cancelación, etc.) incrementamos refreshKey.value++. Como los `computed` de
            // abajo LEEN refreshKey.value en su primera línea, Vue los marca como
            // "dependientes" de refreshKey y los vuelve a ejecutar cada vez que cambia,
            // aunque el valor en sí (0, 1, 2...) no le importe a nadie.
            const refreshKey = ref(0);

            // Un `computed` es un valor derivado: se recalcula automáticamente cuando
            // cualquiera de sus dependencias reactivas cambia (aquí: refreshKey y diaBailo).
            // El HTML usa `v-for="fila in filasBailoterapia"` y listo, no hay que tocar el DOM a mano.
            const filasBailoterapia = computed(() => {
                refreshKey.value; // "Suscribe" este computed a refreshKey (ver comentario arriba)
                return construirFilasHorario('bailoterapia', diaBailo.value);
            });

            const filasFuerza = computed(() => {
                refreshKey.value;
                return construirFilasHorario('fuerza', diaFuerza.value);
            });

            function hacerReserva(categoria, horarioId, dia) {
                const sesion = getSesion();
                if (!sesion) return;

                // Revalida en el momento exacto del click (no solo confía en que el botón esté deshabilitado)
                const filaActual = construirFilasHorario(categoria, dia).find(f => f.id === horarioId);
                if (!filaActual || filaActual.btnTipo !== 'reservar') {
                    mostrarToast('Ese horario ya no está disponible para reservar.', 'error');
                    refreshKey.value++;
                    return;
                }

                DB.reservas.push({ id: 'res_' + Date.now(), usuarioId: sesion.id, categoria, horarioId, dia, estado: 'pendiente' });
                saveDB();
                mostrarToast(`✓ Turno confirmado para el ${dia}`, 'exito');
                refreshKey.value++;
            }

            /**
             * Cancela una reserva pendiente, con la misma regla de "1 hora antes" pero
             * aplicada al momento de CANCELAR (no de reservar): no se puede cancelar
             * sobre la hora, para que el cupo no quede "fantasma" a último momento.
             */
            function cancelarReserva(categoria, horarioId, diaElegido) {
                const sesion = getSesion();
                if (!sesion) return;

                const idx = DB.reservas.findIndex(r => r.usuarioId === sesion.id && r.categoria === categoria && r.horarioId === horarioId && r.dia === diaElegido && r.estado === 'pendiente');
                if (idx > -1) {
                    const hInfo = DB.horarios[categoria].find(h => h.id === horarioId);
                    const hoyStr = new Date().toISOString().split('T')[0];

                    if (diaElegido === hoyStr) {
                        // Convertimos todo a minutos desde la medianoche para poder restar
                        // horas y minutos de golpe sin manejar carries manualmente.
                        const horaInicioReserva = parseInt(hInfo.hora.split(':')[0]);
                        const horaActualReal = new Date().getHours();
                        const minutosActualesReal = new Date().getMinutes();
                        const tiempoReservaMinutos = horaInicioReserva * 60;
                        const tiempoActualMinutos = (horaActualReal * 60) + minutosActualesReal;

                        // Si faltan menos de 60 min para el turno (y todavía no pasó), se bloquea
                        if ((tiempoReservaMinutos - tiempoActualMinutos) < 60 && (tiempoReservaMinutos - tiempoActualMinutos) >= 0) {
                            mostrarToast('No puedes cancelar con menos de una hora de anticipación.', 'error');
                            return;
                        }
                    }
                    DB.reservas.splice(idx, 1);
                    saveDB();
                    mostrarToast('Reserva cancelada correctamente.', 'exito');
                    refreshKey.value++; // Fuerza a los computed a recalcular con la reserva ya eliminada
                }
            }

            // Todo lo que se retorna aquí queda disponible directamente en el <template>
            // del HTML (dashboard.html), por eso ahí se ve `{{ diaBailo }}` o `@click="hacerReserva(...)"`
            // sin necesidad de anteponer nada.
            return {
                categoriaActiva,
                diaBailo,
                diaFuerza,
                diasValidos,
                filasBailoterapia,
                filasFuerza,
                hacerReserva,
                cancelarReserva,
                refreshKey
            };
        }
    });

    dashboardVM = app.mount('#app-dashboard');
}

function initDashboard() {
    if (!document.querySelector('.selector-categoria')) return; // Validación de contexto

    const sesion = getSesion();
    const usuario = sesion ? DB.usuarios.find(u => u.id === sesion.id) : null;

    // Hidratación del Sidebar con datos del usuario activo
    if (usuario) {
        document.getElementById('nombreUsuario').textContent = usuario.nombre;
        actualizarContadoresFaltas(usuario);
        verificarBaneosUI(usuario);
    }

    montarDashboardVue();

    // --- PESTAÑAS: Historial vs Nueva Reserva ---
    // Este switch de pestañas es manejado fuera de Vue con clases CSS 'oculto' /'activo',
    // a diferencia de las tablas de horarios que sí viven dentro de la app Vue. Se dejó así
    // porque el historial es una vista de "solo lectura" simple, sin necesidad de reactividad.
    const btnMisReservas = document.getElementById('btnMisReservas');
    const btnMiHistorial = document.getElementById('btnMiHistorial');
    const seccionReservas = document.querySelector('.grid-reservas');
    const seccionHistorial = document.getElementById('seccionHistorial');
    const selectorCat = document.querySelector('.selector-categoria');
    const panelHeader = document.querySelector('.panel-header');

    if (btnMiHistorial && btnMisReservas) {
        btnMiHistorial.onclick = (e) => {
            e.preventDefault();
            btnMiHistorial.classList.add('activo'); btnMisReservas.classList.remove('activo');
            seccionReservas.classList.add('oculto'); selectorCat.classList.add('oculto');
            if(seccionHistorial) seccionHistorial.classList.remove('oculto');
            if(panelHeader) {
                panelHeader.querySelector('h1').textContent = 'Mi Historial';
                panelHeader.querySelector('p').textContent = 'Revisa tu registro de asistencias y faltas pasadas.';
            }
            renderHistorialUsuario(usuario);
        };

        btnMisReservas.onclick = (e) => {
            e.preventDefault();
            btnMisReservas.classList.add('activo'); btnMiHistorial.classList.remove('activo');
            if(seccionHistorial) seccionHistorial.classList.add('oculto');
            seccionReservas.classList.remove('oculto'); selectorCat.classList.remove('oculto');
            if(panelHeader) {
                panelHeader.querySelector('h1').textContent = 'Reservar Horario';
                panelHeader.querySelector('p').textContent = 'Selecciona una categoría para ver los horarios y realizar tu reserva.';
            }
        };
    }

    // --- ESCUDO DE SEGURIDAD (Web Storage API) ---
    // El evento 'storage' del navegador se dispara automáticamente en TODAS las pestañas
    // abiertas del mismo sitio (menos la que hizo el cambio) cuando localStorage se modifica.
    // Lo usamos para "expulsar" en vivo a un estudiante si un admin lo desactiva desde otra
    // pestaña, sin necesidad de un servidor ni websockets: solo con localStorage + este evento.
    window.addEventListener('storage', (e) => {
        if (e.key === 'gym_db') {
            DB = JSON.parse(e.newValue);

            const checkUsuario = DB.usuarios.find(u => u.id === sesion.id);

            // Refresca en vivo las tablas de horarios/historial (ej. cuando el admin
            // marca "Asistió"/"Faltó" en otra pestaña, el estudiante lo ve al instante,
            // sin necesidad de recargar la página).
            if (dashboardVM) dashboardVM.refreshKey++;

            const seccionHistorialVisible = document.getElementById('seccionHistorial');
            if (seccionHistorialVisible && !seccionHistorialVisible.classList.contains('oculto') && checkUsuario) {
                renderHistorialUsuario(checkUsuario);
            }

            if (checkUsuario) actualizarContadoresFaltas(checkUsuario);

            if (checkUsuario && !checkUsuario.activo) {
                sessionStorage.removeItem('sesion'); 
                alert("ATENCIÓN: Tu sesión ha sido cerrada por un administrador.");
                window.location.href = 'index.html'; // Expulsión de seguridad
            }
        }
    });
}

// --- MÉTODOS DE UI (DASHBOARD) ---

/** Pinta las etiquetas de bloqueo en caso de que el usuario tenga un baneo activo. */
function verificarBaneosUI(usuario) {
    const hoyStr = new Date().toISOString().split('T')[0];
    ['bailoterapia', 'fuerza'].forEach(cat => {
        const banDiv = document.getElementById(`ban-${cat}`);
        if (banDiv) {
            if (usuario.baneadoHasta && usuario.baneadoHasta[cat] && usuario.baneadoHasta[cat] >= hoyStr) {
                banDiv.textContent = `Bloqueado temporalmente hasta: ${usuario.baneadoHasta[cat]}`;
                banDiv.style.display = 'block';
            } else { banDiv.style.display = 'none'; }
        }
    });
}

/** Pinta los indicadores visuales de peligro según las faltas acumuladas. */
function actualizarContadoresFaltas(usuario) {
    ['bailoterapia', 'fuerza'].forEach(cat => {
        const elFaltas = document.getElementById(`faltas-${cat}`);
        if(elFaltas) {
            const f = usuario.faltas[cat];
            elFaltas.textContent = `${f} / ${MAX_FALTAS}`;
            elFaltas.className = 'contador-faltas';
            if (f >= 4) elFaltas.classList.add('peligro');
            else if (f >= 2) elFaltas.classList.add('advertencia');
        }
    });
}

/** Renderiza la tabla de historial (filtrando y ordenando por fecha). */
function renderHistorialUsuario(usuario) {
    const tableEl = document.getElementById('tablaHistorialUsuario');
    if(!tableEl) return;
    const tbody = tableEl.querySelector('tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    // Filtrado: solo muestra reservas que ya fueron evaluadas por el admin
    const historial = DB.reservas.filter(r => r.usuarioId === usuario.id && r.estado !== 'pendiente');
    // Algoritmo de ordenamiento: De fecha más reciente a más antigua
    historial.sort((a, b) => new Date(b.dia) - new Date(a.dia));

    if (historial.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" class="celda-vacia">Aún no tienes registros en tu historial.</td></tr>`;
        return;
    }

    historial.forEach(res => {
        const hInfo = DB.horarios[res.categoria].find(h => h.id === res.horarioId);
        const tr = document.createElement('tr');
        let badge = `<span class="estado-badge pendiente">Pendiente</span>`;
        if(res.estado === 'asistio') badge = `<span class="estado-badge asistio">Asistió</span>`;
        if(res.estado === 'falto') badge = `<span class="estado-badge falto">Faltó</span>`;

        tr.innerHTML = `<td><strong>${res.dia}</strong></td><td style="text-transform: capitalize;">${res.categoria}</td><td>${hInfo ? hInfo.hora : 'N/A'}</td><td>${badge}</td>`;
        tbody.appendChild(tr);
    });
}

// ============================================================
//  CONTROLADOR DE VISTA: ADMIN (Panel de Administración)
// ============================================================

// Referencia a la instancia montada de Vue, usada para forzar refrescos
// reactivos cuando otra pestaña modifica la base de datos (evento 'storage').
let adminVM = null;

/**
 * Monta la app de Vue sobre #app-admin, con el mismo patrón que montarDashboardVue:
 * refs para el estado (sección activa, filtros, día seleccionado) y computed para
 * las listas derivadas (horariosConDatos, usuariosFiltrados). Aquí SÍ guardamos la
 * instancia montada (adminVM) porque, a diferencia del dashboard, necesitamos poder
 * incrementar su refreshKey desde AFUERA del setup() — concretamente, desde el
 * listener de 'storage' en initAdmin(), cuando otra pestaña modifica la BD.
 */
function montarAdminVue() {
    const el = document.getElementById('app-admin');
    if (!el || el.__vue_app__) return;

    const { ref, computed } = Vue;
    const diasValidos = obtenerDiasValidos();

    const app = Vue.createApp({
        setup() {
            const seccionActiva = ref('asistencia');
            const categoriaActiva = ref('bailoterapia');
            const diaAdmin = ref(diasValidos[0]?.valor || '');
            const refreshKey = ref(0);

            const filtroUsuario = ref('todos');
            const busquedaUsuario = ref('');
            const ordenUsuario = ref('defecto');

            // Construye las tarjetas de horario con sus reservas ya resueltas (Reserva -> Usuario)
            const horariosConDatos = computed(() => {
                refreshKey.value;
                if (!diaAdmin.value) return [];
                return DB.horarios[categoriaActiva.value].map(h => {
                    const reservasHora = DB.reservas
                        .filter(r => r.categoria === categoriaActiva.value && r.dia === diaAdmin.value && r.horarioId === h.id)
                        .map(r => {
                            const user = DB.usuarios.find(u => String(u.id) === String(r.usuarioId));
                            return user ? { ...r, nombreUsuario: user.nombre, carreraUsuario: user.carrera } : null;
                        })
                        .filter(Boolean);

                    const ocupados = reservasHora.filter(r => r.estado !== 'falto').length;
                    const disponibles = h.max - ocupados;

                    return { id: h.id, hora: h.hora, max: h.max, disponibles, reservas: reservasHora };
                });
            });

            // Totales para los chips del resumen del día seleccionado
            const resumen = computed(() => {
                let pendientes = 0, asistencias = 0, faltas = 0;
                horariosConDatos.value.forEach(h => {
                    h.reservas.forEach(r => {
                        if (r.estado === 'pendiente') pendientes++;
                        else if (r.estado === 'asistio') asistencias++;
                        else if (r.estado === 'falto') faltas++;
                    });
                });
                return { pendientes, asistencias, faltas };
            });

            // Pipeline de filtrado + ordenamiento de la tabla de usuarios
            const usuariosFiltrados = computed(() => {
                refreshKey.value;
                const busqueda = busquedaUsuario.value.toLowerCase().trim();

                let filtrados = DB.usuarios.filter(u => {
                    if (filtroUsuario.value === 'activos' && !u.activo) return false;
                    if (filtroUsuario.value === 'inactivos' && u.activo) return false;
                    if (busqueda !== '') {
                        const strUsuario = `${u.nombre} ${u.correo} ${u.facultad || ''}`.toLowerCase();
                        if (!strUsuario.includes(busqueda)) return false;
                    }
                    return true;
                });

                if (ordenUsuario.value === 'alfabetico') {
                    filtrados = [...filtrados].sort((a, b) => a.nombre.localeCompare(b.nombre));
                } else if (ordenUsuario.value === 'facultad') {
                    filtrados = [...filtrados].sort((a, b) => {
                        const facA = a.facultad || 'ZZZ';
                        const facB = b.facultad || 'ZZZ';
                        if (facA === facB) return a.nombre.localeCompare(b.nombre);
                        return facA.localeCompare(facB);
                    });
                }
                return filtrados;
            });

            function tieneSuspension(user) {
                const hoyStr = new Date().toISOString().split('T')[0];
                return !!((user.baneadoHasta?.bailoterapia && user.baneadoHasta.bailoterapia >= hoyStr) ||
                          (user.baneadoHasta?.fuerza && user.baneadoHasta.fuerza >= hoyStr));
            }

            /** Lógica de Negocio: Asistencia y Penalizaciones (con toggle al hacer click en el mismo estado). */
            function cambiarAsistencia(reservaId, estadoClickeado) {
                const res = DB.reservas.find(r => r.id === reservaId);
                if (!res) return;
                const user = DB.usuarios.find(u => String(u.id) === String(res.usuarioId));
                if (!user) return;

                let nuevoEstado = estadoClickeado;
                if (res.estado === estadoClickeado) nuevoEstado = 'pendiente';

                // Deshacer penalización: si era falta y se cancela, se resta del historial
                if (res.estado === 'falto') {
                    user.faltas[res.categoria] = Math.max(0, user.faltas[res.categoria] - 1);
                    if (user.faltas[res.categoria] < MAX_FALTAS) { user.baneadoHasta[res.categoria] = null; }
                }

                res.estado = nuevoEstado;

                // Aplicar penalización: si el nuevo estado es falta, se suma y se verifica umbral
                if (nuevoEstado === 'falto') {
                    user.faltas[res.categoria]++;
                    if (user.faltas[res.categoria] >= MAX_FALTAS) {
                        const fechaBan = new Date();
                        fechaBan.setDate(fechaBan.getDate() + 5); // Baneo fijo de 5 días
                        user.baneadoHasta[res.categoria] = fechaBan.toISOString().split('T')[0];
                        mostrarToast(`Usuario ${user.nombre} suspendido en ${res.categoria} por acumular 5 faltas.`, 'error');
                    }
                }

                saveDB();
                refreshKey.value++;
            }

            /** Desactiva/activa administrativamente una cuenta. */
            function toggleEstadoUsuario(id, status) {
                const user = DB.usuarios.find(u => u.id === id);
                if (user) {
                    user.activo = status;
                    saveDB();
                    mostrarToast('Estado de usuario actualizado correctamente.', 'exito');
                    refreshKey.value++;
                }
            }

            function purgarReservas() {
                const confirmacion = confirm("¿Estás seguro de eliminar todas las reservas anteriores a hoy? Esto mantendrá intactas las faltas de los perfiles.");
                if (confirmacion) {
                    const hoyStr = new Date().toISOString().split('T')[0];
                    const prev = DB.reservas.length;
                    DB.reservas = DB.reservas.filter(r => r.dia >= hoyStr);
                    saveDB();
                    refreshKey.value++;
                    mostrarToast(`Limpieza completa. ${prev - DB.reservas.length} reservas eliminadas.`, 'exito');
                }
            }

            return {
                seccionActiva, categoriaActiva, diaAdmin, diasValidos,
                filtroUsuario, busquedaUsuario, ordenUsuario,
                horariosConDatos, resumen, usuariosFiltrados,
                tieneSuspension, cambiarAsistencia, toggleEstadoUsuario, purgarReservas,
                refreshKey
            };
        }
    });

    adminVM = app.mount('#app-admin');
}

function initAdmin() {
    if (!document.getElementById('app-admin')) return;

    montarAdminVue();

    // Sincronización multi-pestaña: si otro admin modifica la BD, refresca los computeds
    window.addEventListener('storage', (e) => {
        if (e.key === 'gym_db') {
            DB = JSON.parse(e.newValue);
            if (adminVM) adminVM.refreshKey++;
        }
    });
}

// --- BOOTSTRAP DEL SISTEMA ---
// Inicia controladores y delegación de eventos una vez que el DOM está listo
document.addEventListener('DOMContentLoaded', async () => {
    await cargarFeriados();
    initIndex(); initDashboard(); initAdmin(); activarEnlacesMuertos();
});