// --- Estado Global de la SPA ---
let currentSolverResult = null;
let currentSolverInstance = null;
let activeTab = "config";
let currentStepIndex = 0;
let autoPlayInterval = null;

// --- Ejemplos Predefinidos ---
const EJEMPLOS = {
    ex1: {
        numVars: 2,
        numRestr: 3,
        esMaximizar: true,
        c: [7, 4],
        A: [
            [2, 1],
            [1, 1],
            [1, 0]
        ],
        b: [20, 18, 8],
        signos: ["<=", "<=", "<="]
    },
    ex2: {
        numVars: 2,
        numRestr: 3,
        esMaximizar: true,
        c: [3, 2],
        A: [
            [1, 1],
            [1, 2],
            [1, -1]
        ],
        b: [4, 2, 1],
        signos: ["<=", ">=", "="]
    },
    ex3: {
        numVars: 2,
        numRestr: 3,
        esMaximizar: true,
        c: [5, 4],
        A: [
            [2, 1],
            [1, 1],
            [1, 2]
        ],
        b: [20, 18, 12],
        signos: ["<=", "<=", ">="]
    },
    ex4: {
        numVars: 3,
        numRestr: 3,
        esMaximizar: true,
        c: [3, 2, 5],
        A: [
            [1, 2, 1],
            [3, 0, 2],
            [1, 4, 0]
        ],
        b: [430, 460, 420],
        signos: ["<=", "<=", "<="]
    },
    ex5: {
        numVars: 2,
        numRestr: 4,
        esMaximizar: false,
        c: [3, 8],
        A: [
            [1, 1],
            [1, 0],
            [0, 1],
            [1, 1]
        ],
        b: [200, 80, 60, 300],
        signos: [">=", "<=", ">=", "<="]
    },
    ex6: {
        numVars: 3,
        numRestr: 2,
        esMaximizar: false,
        c: [4, 2, 3],
        A: [
            [1, 1, 1],
            [2, 1, -1]
        ],
        b: [15, 10],
        signos: [">=", "="]
    },
    ex7: {
        numVars: 2,
        numRestr: 2,
        esMaximizar: true,
        c: [2, 3],
        A: [
            [-1, 1],
            [1, -2]
        ],
        b: [5, 10],
        signos: ["<=", "<="]
    }
};

// --- Al cargar el DOM ---
document.addEventListener("DOMContentLoaded", () => {
    inicializarNavegacion();
    inicializarFormulario();
    document.getElementById("btn-generar-inputs").click(); // Generar inicial
});

// --- Configuración e Interactividad de Pestañas ---
function inicializarNavegacion() {
    const menuItems = document.querySelectorAll(".menu-item");
    menuItems.forEach(item => {
        item.addEventListener("click", () => {
            const targetTab = item.getAttribute("data-tab");
            
            // Si intentamos navegar a resultados sin haber resuelto
            if (targetTab !== "config" && !currentSolverResult) {
                alert("Primero debes resolver el problema en la pestaña de configuración.");
                return;
            }

            // Cambiar pestaña activa
            menuItems.forEach(i => i.classList.remove("active"));
            item.classList.add("active");

            document.querySelectorAll(".tab-pane").forEach(pane => {
                pane.classList.remove("active");
            });
            document.getElementById(`tab-${targetTab}`).classList.add("active");
            
            activeTab = targetTab;
            gestionarCambioPestaña(targetTab);
        });
    });
}

function gestionarCambioPestaña(tabName) {
    // Parar el auto play si se cambia de pestaña
    pararAutoPlay();

    if (tabName === "simplex") {
        renderizarPasoSimplex(currentStepIndex);
    } else if (tabName === "graphical") {
        renderizarModuloGrafico();
    } else if (tabName === "sensitivity") {
        renderizarModuloSensibilidad();
    }
}

// --- Inicialización y Dinamismo de Inputs ---
function inicializarFormulario() {
    const inputVars = document.getElementById("input-vars");
    const inputRestr = document.getElementById("input-restr");
    const btnGenerar = document.getElementById("btn-generar-inputs");
    const btnResolver = document.getElementById("btn-resolver-problema");
    const selectEjemplo = document.getElementById("example-select");

    btnGenerar.addEventListener("click", () => {
        const nVars = parseInt(inputVars.value);
        const nRestr = parseInt(inputRestr.value);
        generarCamposEntrada(nVars, nRestr);
    });

    btnResolver.addEventListener("click", resolverModelo);

    selectEjemplo.addEventListener("change", (e) => {
        const key = e.target.value;
        if (key && EJEMPLOS[key]) {
            const ex = EJEMPLOS[key];
            inputVars.value = ex.numVars;
            inputRestr.value = ex.numRestr;
            
            // Indicar tipo de objetivo
            const radios = document.getElementsByName("opt-goal");
            radios.forEach(r => {
                r.checked = (r.value === (ex.esMaximizar ? "max" : "min"));
            });

            generarCamposEntrada(ex.numVars, ex.numRestr);
            rellenarCamposEjemplo(ex);
        }
    });

    // Controles de paso a paso en Simplex
    document.getElementById("btn-step-first").addEventListener("click", () => {
        currentStepIndex = 0;
        renderizarPasoSimplex(currentStepIndex);
    });
    document.getElementById("btn-step-prev").addEventListener("click", () => {
        if (currentStepIndex > 0) {
            currentStepIndex--;
            renderizarPasoSimplex(currentStepIndex);
        }
    });
    document.getElementById("btn-step-next").addEventListener("click", () => {
        if (currentStepIndex < currentSolverResult.historial.length - 1) {
            currentStepIndex++;
            renderizarPasoSimplex(currentStepIndex);
        }
    });
    document.getElementById("btn-step-last").addEventListener("click", () => {
        currentStepIndex = currentSolverResult.historial.length - 1;
        renderizarPasoSimplex(currentStepIndex);
    });
    
    // Auto Play
    document.getElementById("btn-auto-play").addEventListener("click", alternarAutoPlay);

    // Animación Gráfica
    document.getElementById("btn-animar-recta").addEventListener("click", () => {
        if (currentSolverInstance) {
            const graph = obtenerInstanciaGrafica();
            if (graph) graph.animarRecta("svg-graph-container");
        }
    });
}

function generarCamposEntrada(numVars, numRestr) {
    const foContainer = document.getElementById("fo-inputs-container");
    const restrContainer = document.getElementById("restr-inputs-container");

    foContainer.innerHTML = "";
    restrContainer.innerHTML = "";

    // 1. Generar campos de Función Objetivo Z
    foContainer.innerHTML = `<span>Z = </span>`;
    for (let j = 0; j < numVars; j++) {
        foContainer.innerHTML += `
            <input type="number" id="fo-c-${j}" class="coef-input" placeholder="c${j+1}" step="any">
            <span class="var-label">x<sub>${j+1}</sub></span>
            ${j < numVars - 1 ? '<span>+</span>' : ''}
        `;
    }

    // 2. Generar campos de Restricciones
    for (let i = 0; i < numRestr; i++) {
        const row = document.createElement("div");
        row.className = "restr-row";
        
        row.innerHTML = `<span class="var-label" style="width: 40px; display: inline-block;">R<sub>${i+1}</sub>:</span>`;
        for (let j = 0; j < numVars; j++) {
            row.innerHTML += `
                <input type="number" id="restr-a-${i}-${j}" class="coef-input" placeholder="a${i+1},${j+1}" step="any">
                <span class="var-label">x<sub>${j+1}</sub></span>
                ${j < numVars - 1 ? '<span>+</span>' : ''}
            `;
        }

        // Dropdown del signo
        row.innerHTML += `
            <select id="restr-signo-${i}" class="operator-select">
                <option value="<=">&le;</option>
                <option value=">=">&ge;</option>
                <option value="=">=</option>
            </select>
            <input type="number" id="restr-b-${i}" class="coef-input" style="width: 80px;" placeholder="b${i+1}" step="any">
        `;
        restrContainer.appendChild(row);
    }

    // Mostrar el panel de coeficientes
    document.getElementById("card-inputs-details").classList.remove("hidden");
    
    // Deshabilitar/Habilitar pestaña de método gráfico en el menú lateral
    const btnTabGraphical = document.getElementById("btn-tab-graphical");
    if (numVars === 2) {
        btnTabGraphical.classList.remove("hidden");
        btnTabGraphical.removeAttribute("disabled");
    } else {
        btnTabGraphical.classList.add("hidden");
        btnTabGraphical.setAttribute("disabled", "true");
    }
}

function rellenarCamposEjemplo(ex) {
    // Coeficientes Z
    for (let j = 0; j < ex.numVars; j++) {
        document.getElementById(`fo-c-${j}`).value = ex.c[j];
    }

    // Restricciones
    for (let i = 0; i < ex.numRestr; i++) {
        for (let j = 0; j < ex.numVars; j++) {
            document.getElementById(`restr-a-${i}-${j}`).value = ex.A[i][j];
        }
        document.getElementById(`restr-signo-${i}`).value = ex.signos[i];
        document.getElementById(`restr-b-${i}`).value = ex.b[i];
    }
}

// --- Resolución Matemática ---
function resolverModelo() {
    // Parar reproducción previa
    pararAutoPlay();

    const inputVars = document.getElementById("input-vars");
    const inputRestr = document.getElementById("input-restr");
    const numVars = parseInt(inputVars.value);
    const numRestr = parseInt(inputRestr.value);

    // Obtener objetivo
    const goalVal = document.querySelector('input[name="opt-goal"]:checked').value;
    const esMaximizar = goalVal === "max";

    // Leer coeficientes Z
    const c = [];
    for (let j = 0; j < numVars; j++) {
        const val = parseFloat(document.getElementById(`fo-c-${j}`).value);
        if (isNaN(val)) {
            alert(`Por favor, introduce el coeficiente de la función objetivo para x${j+1}`);
            return;
        }
        c.push(val);
    }

    // Leer restricciones
    const A = [];
    const b = [];
    const signos = [];

    for (let i = 0; i < numRestr; i++) {
        const filaA = [];
        for (let j = 0; j < numVars; j++) {
            const val = parseFloat(document.getElementById(`restr-a-${i}-${j}`).value);
            if (isNaN(val)) {
                alert(`Por favor, introduce el coeficiente a_${i+1},${j+1} en las restricciones.`);
                return;
            }
            filaA.push(val);
        }
        const bVal = parseFloat(document.getElementById(`restr-b-${i}`).value);
        if (isNaN(bVal)) {
            alert(`Por favor, introduce el lado derecho b_${i+1} en las restricciones.`);
            return;
        }
        if (bVal < 0) {
            alert("Por fines académicos, el valor del lado derecho b_i debe ser positivo o cero. Multiplica por -1 la restricción si es necesario.");
            return;
        }
        
        A.push(filaA);
        b.push(bVal);
        signos.push(document.getElementById(`restr-signo-${i}`).value);
    }

    // Resolver
    try {
        currentSolverInstance = new SimplexSolver(c, A, b, signos, esMaximizar);
        currentSolverResult = currentSolverInstance.resolver();

        if (currentSolverResult.exito || currentSolverResult.historial.length > 0) {
            currentStepIndex = 0;
            
            // Navegar automáticamente a la pestaña de Simplex paso a paso
            const menuItemSimplex = document.querySelector('.menu-item[data-tab="simplex"]');
            menuItemSimplex.click();
        } else {
            alert("Error al resolver: " + currentSolverResult.mensaje);
        }
    } catch (err) {
        console.error(err);
        alert("Ocurrió un error matemático o de inicialización: " + err.message);
    }
}

// --- Renderizar Módulo Simplex Paso a Paso ---
function renderizarPasoSimplex(index) {
    if (!currentSolverResult || !currentSolverResult.historial) return;

    const historial = currentSolverResult.historial;
    const step = historial[index];

    // Actualizar indicador
    document.getElementById("current-step-index").textContent = index;
    document.getElementById("total-steps-count").textContent = historial.length - 1;

    // Actualizar título y explicaciones
    document.getElementById("step-phase-badge").textContent = step.fase;
    document.getElementById("step-name-title").textContent = step.nombre;
    
    // Traducir explicaciones a formato amigable HTML
    document.getElementById("step-explanation-text").innerHTML = formatTextMarkdown(step.explicacion);

    // Operaciones Fila
    const opsBox = document.getElementById("row-operations-box");
    const opsList = document.getElementById("row-operations-list");
    opsList.innerHTML = "";

    // Buscar si hay operaciones registradas en las filas del tableau de este paso
    let tieneOps = false;
    step.tableau.forEach((fila, i) => {
        if (fila.operacionesFila && fila.operacionesFila.length > 0) {
            tieneOps = true;
            fila.operacionesFila.forEach(op => {
                const li = document.createElement("li");
                li.textContent = op;
                opsList.appendChild(li);
            });
        }
    });

    if (tieneOps) {
        opsBox.classList.remove("hidden");
    } else {
        opsBox.classList.add("hidden");
    }

    // Renderizar la Tabla (Tableau)
    const table = document.getElementById("simplex-tableau-table");
    table.innerHTML = "";

    // 1. Encabezado de la tabla (Cabecera)
    const thRow = document.createElement("tr");
    thRow.innerHTML = `<th>Base</th>`;
    step.nombresVariables.forEach(nombre => {
        thRow.innerHTML += `<th>${nombre}</th>`;
    });
    thRow.innerHTML += `<th>b</th>`;
    table.appendChild(thRow);

    // 2. Filas de restricciones del tableau
    const m = step.tableau.length - 1;
    const numCols = step.nombresVariables.length;

    for (let i = 0; i < m; i++) {
        const tr = document.createElement("tr");
        
        // Identificar si la fila es pivote
        const esFilaPivote = step.pivoteInfo && step.pivoteInfo.filaPivote === i;
        if (esFilaPivote) {
            tr.className = "pivot-row-bg";
        }

        // Nombre de la variable básica en esta fila
        const basIdx = step.variablesBasicas[i];
        const nomBas = step.nombresVariables[basIdx] || `R${i+1}`;
        tr.innerHTML = `<td class="base-var-bg">${nomBas}</td>`;

        // Valores de la fila
        for (let j = 0; j < numCols; j++) {
            const val = step.tableau[i][j];
            let cellClass = "";

            const esColPivote = step.pivoteInfo && step.pivoteInfo.colPivote === j;

            if (esFilaPivote && esColPivote) {
                cellClass = "pivot-cell-bg";
            } else if (esColPivote) {
                cellClass = "pivot-col-bg";
            }

            tr.innerHTML += `<td class="${cellClass}">${val.toFixed(4)}</td>`;
        }

        // Columna b
        const valB = step.tableau[i][numCols];
        tr.innerHTML += `<td>${valB.toFixed(4)}</td>`;
        table.appendChild(tr);
    }

    // 3. Fila Z / W
    const trZ = document.createElement("tr");
    trZ.className = "z-row-bg";
    
    const labelFilaZ = step.fase === "Fase 1" ? "-W" : "Z";
    trZ.innerHTML = `<td class="base-var-bg">${labelFilaZ}</td>`;

    for (let j = 0; j < numCols; j++) {
        const val = step.tableau[m][j];
        let cellClass = "";
        if (step.pivoteInfo && step.pivoteInfo.colPivote === j) {
            cellClass = "pivot-col-bg";
        }
        trZ.innerHTML += `<td class="${cellClass}">${val.toFixed(4)}</td>`;
    }

    // Lado derecho de Z
    const valZ = step.tableau[m][numCols];
    trZ.innerHTML += `<td>${valZ.toFixed(4)}</td>`;
    table.appendChild(trZ);
}

// --- Auto Play / Reproducción Automática ---
function alternarAutoPlay() {
    const btn = document.getElementById("btn-auto-play");
    
    if (autoPlayInterval) {
        pararAutoPlay();
    } else {
        btn.textContent = "Detener Reproducción";
        btn.classList.add("active");
        
        autoPlayInterval = setInterval(() => {
            if (currentStepIndex < currentSolverResult.historial.length - 1) {
                currentStepIndex++;
                renderizarPasoSimplex(currentStepIndex);
            } else {
                pararAutoPlay();
            }
        }, 1500);
    }
}

function pararAutoPlay() {
    if (autoPlayInterval) {
        clearInterval(autoPlayInterval);
        autoPlayInterval = null;
    }
    const btn = document.getElementById("btn-auto-play");
    if (btn) {
        btn.textContent = "Reproducción Automática";
        btn.classList.remove("active");
    }
}

// --- Renderizar Método Gráfico 2D ---
function obtenerInstanciaGrafica() {
    if (!currentSolverInstance) return null;
    const finalStep = currentSolverResult.historial[currentSolverResult.historial.length - 1];
    
    // Obtener variables de decisión óptimas final
    const sol = currentSolverInstance.obtenerSolucionFinal();

    return new GraphicalMethod(
        currentSolverInstance.c_orig,
        currentSolverInstance.A_orig,
        currentSolverInstance.b_orig,
        currentSolverInstance.signos,
        currentSolverInstance.esMaximizar,
        sol.variables[0],
        sol.variables[1],
        sol.z
    );
}

function renderizarModuloGrafico() {
    if (currentSolverInstance.numVars !== 2) {
        document.getElementById("svg-graph-container").innerHTML = `
            <div style="padding: 2rem; text-align: center; color: var(--text-muted);">
                <h3>El método gráfico solo admite 2 variables de decisión.</h3>
                <p>Tu modelo tiene ${currentSolverInstance.numVars} variables. Por favor, usa la pestaña 'Simplex Paso a Paso'.</p>
            </div>
        `;
        document.getElementById("graphical-vertices-table").querySelector("tbody").innerHTML = "";
        document.getElementById("graphical-solution-summary").innerHTML = "";
        document.getElementById("btn-animar-recta").style.display = "none";
        return;
    }

    document.getElementById("btn-animar-recta").style.display = "inline-flex";

    const graph = obtenerInstanciaGrafica();
    if (!graph) return;

    // Renderizar Gráfico
    graph.render("svg-graph-container");

    // Renderizar Vértices en la Tabla
    const tbody = document.getElementById("graphical-vertices-table").querySelector("tbody");
    tbody.innerHTML = "";

    // Evaluar vértices para mostrarlos ordenados
    const c = currentSolverInstance.c_orig;
    const tipo = currentSolverInstance.esMaximizar ? "max" : "min";
    const resultados = graph.vertices.map(v => {
        return {
            x1: v.x1,
            x2: v.x2,
            z: c[0] * v.x1 + c[1] * v.x2
        };
    });

    // Ordenar de mayor a menor para Maximización, menor a mayor para Minimización
    resultados.sort((a, b) => tipo === "max" ? b.z - a.z : a.z - b.z);

    const sol = currentSolverInstance.obtenerSolucionFinal();

    resultados.forEach(item => {
        const esOpt = Math.abs(item.x1 - sol.variables[0]) < 1e-3 && Math.abs(item.x2 - sol.variables[1]) < 1e-3;
        const tr = document.createElement("tr");
        if (esOpt) {
            tr.style.backgroundColor = "rgba(16, 185, 129, 0.08)";
            tr.style.color = "var(--color-accent-hover)";
            tr.style.fontWeight = "bold";
        }

        tr.innerHTML = `
            <td>(${item.x1.toFixed(4)}, ${item.x2.toFixed(4)})</td>
            <td>${item.z.toFixed(4)}</td>
            <td>${esOpt ? '★ ÓPTIMO' : 'No'}</td>
        `;
        tbody.appendChild(tr);
    });

    // Renderizar Tarjeta de Solución Óptima
    const summary = document.getElementById("graphical-solution-summary");
    summary.innerHTML = `
        <h4>Resultado del Método Gráfico</h4>
        <p>Al evaluar todos los vértices de la región factible, la solución óptima es:</p>
        <div style="display: flex; gap: 2rem; margin: 1rem 0;">
            <div>
                <span style="font-size: 0.8rem; color: var(--text-muted); display: block;">Variable x1*</span>
                <span class="highlight">${sol.variables[0].toFixed(4)}</span>
            </div>
            <div>
                <span style="font-size: 0.8rem; color: var(--text-muted); display: block;">Variable x2*</span>
                <span class="highlight">${sol.variables[1].toFixed(4)}</span>
            </div>
            <div>
                <span style="font-size: 0.8rem; color: var(--text-muted); display: block;">Valor Óptimo Z*</span>
                <span class="highlight">${sol.z.toFixed(4)}</span>
            </div>
        </div>
        <p style="font-size: 0.8rem; color: var(--text-muted); margin-bottom: 0;">
            El sentido de optimización es de <strong>${tipo === "max" ? "Maximizar" : "Minimizar"}</strong>. La línea de isoutilidad óptima pasa por el vértice de la región factible que maximiza la utilidad.
        </p>
    `;
}

// --- Renderizar Análisis de Sensibilidad ---
function renderizarModuloSensibilidad() {
    if (!currentSolverResult || !currentSolverInstance) return;

    const analysis = new SensitivityAnalysis(currentSolverResult, currentSolverInstance);
    const data = analysis.analizar();

    if (!data) {
        alert("No se puede generar el reporte de sensibilidad para un modelo no resuelto.");
        return;
    }

    // 1. Renderizar Precios Sombra
    const tbodyShadow = document.getElementById("table-shadow-prices").querySelector("tbody");
    tbodyShadow.innerHTML = "";
    data.preciosSombra.forEach(item => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td>Restricción ${item.restriccion}</td>
            <td>${item.signo}</td>
            <td>${item.valorActual.toFixed(4)}</td>
            <td style="font-family: var(--font-mono); font-weight: bold; color: ${Math.abs(item.precioSombra) > 1e-9 ? 'var(--color-accent-hover)' : 'var(--text-muted)'}">
                ${item.precioSombra.toFixed(4)}
            </td>
            <td>${item.explicacion}</td>
        `;
        tbodyShadow.appendChild(tr);
    });

    // 2. Renderizar Rangos de Lado Derecho (b)
    const tbodyRhs = document.getElementById("table-rhs-ranges").querySelector("tbody");
    tbodyRhs.innerHTML = "";
    data.rangoRecursos.forEach(item => {
        const tr = document.createElement("tr");
        const minStr = item.minimo === 0 && item.actual === 0 ? "0" : (item.minimo === -Infinity ? "-∞" : item.minimo.toFixed(4));
        const maxStr = item.maximo === Infinity ? "+∞" : item.maximo.toFixed(4);
        
        tr.innerHTML = `
            <td>Restricción ${item.restriccion} (${item.signo})</td>
            <td>${item.actual.toFixed(4)}</td>
            <td>${minStr}</td>
            <td>${maxStr}</td>
        `;
        // Crear un tooltip de interpretación al hacer hover
        tr.setAttribute("title", item.explicacion);
        tbodyRhs.appendChild(tr);
    });

    // 3. Renderizar Rangos de Coeficientes Z (c) y Costos Reducidos
    const tbodyObj = document.getElementById("table-obj-ranges").querySelector("tbody");
    tbodyObj.innerHTML = "";
    
    // Unir la información de coeficientes y costos reducidos
    data.rangoCoeficientes.forEach((item, index) => {
        const costoRed = data.costosReducidos[index].costoReducido;
        const tr = document.createElement("tr");
        const minStr = item.minimo === -Infinity ? "-∞" : item.minimo.toFixed(4);
        const maxStr = item.maximo === Infinity ? "+∞" : item.maximo.toFixed(4);

        tr.innerHTML = `
            <td>x<sub>${index+1}</sub> ${item.esBasica ? '<strong>(Básica)</strong>' : '(No Básica)'}</td>
            <td>${item.actual.toFixed(4)}</td>
            <td style="font-family: var(--font-mono); color: ${Math.abs(costoRed) > 1e-9 ? 'var(--color-danger)' : 'var(--text-muted)'}">
                ${costoRed.toFixed(4)}
            </td>
            <td>${minStr}</td>
            <td>${maxStr}</td>
        `;
        tr.setAttribute("title", item.explicacion);
        tbodyObj.appendChild(tr);
    });
}

// --- Utilidad para Formatear Markdown básico en HTML ---
function formatTextMarkdown(text) {
    if (!text) return "";
    let html = text;
    // Negritas
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    return html;
}
