/**
 * Solver del Método Simplex en JavaScript (ES6 Modules).
 * Soporta método de Dos Fases para maximizar o minimizar
 * con restricciones de tipo <=, >= y =.
 * 
 * Guarda un registro detallado de cada iteración para fines académicos.
 */
class SimplexSolver {
    constructor(c, A, b, signos, esMaximizar = true) {
        this.c_orig = [...c]; // Coeficientes originales de Z
        this.A_orig = A.map(row => [...row]); // Restricciones
        this.b_orig = [...b]; // Lado derecho
        this.signos = [...signos]; // <=, >=, =
        this.esMaximizar = esMaximizar;

        this.numVars = c.length;
        this.numRestr = b.length;

        // Metadatos
        this.nombresVariables = [];
        this.tiposVariables = []; // 'original', 'holgura', 'exceso', 'artificial'
        
        // Estado del Tableau
        this.tableau = []; // Matriz [filas][columnas]
        this.variablesBasicas = []; // Índices de variables básicas por fila
        this.columnasArtificiales = [];
        
        // Registro de Iteraciones para el estudiante
        this.historial = [];
    }

    resolver() {
        this.inicializar();
        
        // Fase 1: Encontrar solución factible (si hay variables artificiales)
        let tieneArtificiales = this.columnasArtificiales.length > 0;
        let factible = true;

        if (tieneArtificiales) {
            factible = this.ejecutarFase(1);
        } else {
            // Si no hay artificiales, preparamos de una vez la fila Z original
            this.prepararFase2Directa();
        }

        if (!factible) {
            return {
                exito: false,
                mensaje: "El problema no tiene solución factible (es infactible).",
                historial: this.historial
            };
        }

        // Fase 2: Optimizar función original
        let acotado = this.ejecutarFase(2);

        if (!acotado) {
            return {
                exito: false,
                mensaje: "El problema tiene solución ilimitada (no acotada).",
                historial: this.historial
            };
        }

        // Extraer solución
        const solucion = this.obtenerSolucionFinal();
        return {
            exito: true,
            solucion: solucion.variables,
            z: solucion.z,
            historial: this.historial
        };
    }

    inicializar() {
        this.historial = [];
        this.columnasArtificiales = [];
        this.variablesBasicas = [];
        this.nombresVariables = [];
        this.tiposVariables = [];

        // Nombres de variables originales
        for (let i = 0; i < this.numVars; i++) {
            this.nombresVariables.push(`x${i + 1}`);
            this.tiposVariables.push('original');
        }

        // Contar cuántas variables de holgura, exceso y artificiales se necesitan
        let countHolgura = 1;
        let countExceso = 1;
        let countArt = 1;

        const mapeoRestricciones = []; // Guarda qué variables agrega cada restricción

        for (let i = 0; i < this.numRestr; i++) {
            const sig = this.signos[i];
            const info = { holgura: -1, exceso: -1, artificial: -1 };

            if (sig === "<=") {
                info.holgura = this.nombresVariables.length;
                this.nombresVariables.push(`s${countHolgura++}`);
                this.tiposVariables.push('holgura');
            } else if (sig === ">=") {
                info.exceso = this.nombresVariables.length;
                this.nombresVariables.push(`e${countExceso++}`);
                this.tiposVariables.push('exceso');

                info.artificial = this.nombresVariables.length;
                this.columnasArtificiales.push(info.artificial);
                this.nombresVariables.push(`a${countArt++}`);
                this.tiposVariables.push('artificial');
            } else if (sig === "=") {
                info.artificial = this.nombresVariables.length;
                this.columnasArtificiales.push(info.artificial);
                this.nombresVariables.push(`a${countArt++}`);
                this.tiposVariables.push('artificial');
            }
            mapeoRestricciones.push(info);
        }

        const totalColumnas = this.nombresVariables.length; // Excluyendo la columna b
        this.tableau = [];

        // Construir filas de las restricciones
        for (let i = 0; i < this.numRestr; i++) {
            const fila = new Array(totalColumnas + 1).fill(0);
            
            // Coeficientes originales
            for (let j = 0; j < this.numVars; j++) {
                fila[j] = this.A_orig[i][j];
            }

            // Lado derecho
            fila[totalColumnas] = this.b_orig[i];

            // Variables de holgura/exceso/artificiales
            const info = mapeoRestricciones[i];
            if (info.holgura !== -1) {
                fila[info.holgura] = 1;
                this.variablesBasicas.push(info.holgura);
            }
            if (info.exceso !== -1) {
                fila[info.exceso] = -1;
            }
            if (info.artificial !== -1) {
                fila[info.artificial] = 1;
                this.variablesBasicas.push(info.artificial);
            }

            // Si b es negativo, multiplicamos por -1 toda la fila (excepto si tiene artificial,
            // pero asumimos b >= 0 inicialmente para evitar complicaciones)
            if (fila[totalColumnas] < 0) {
                for (let c = 0; c <= totalColumnas; c++) {
                    fila[c] = -fila[c];
                }
            }

            this.tableau.push(fila);
        }

        // Agregar fila objetivo de Fase 1 (Maximizar -W = -sum(a_i))
        const filaW = new Array(totalColumnas + 1).fill(0);
        for (let col of this.columnasArtificiales) {
            filaW[col] = 1; // W = sum(artificiales)
        }
        this.tableau.push(filaW);

        // Hacer cero en fila W para las variables artificiales básicas (reducción)
        for (let i = 0; i < this.numRestr; i++) {
            const bas = this.variablesBasicas[i];
            if (this.columnasArtificiales.includes(bas)) {
                // Restar la fila de la restricción a la fila W
                for (let c = 0; c <= totalColumnas; c++) {
                    this.tableau[this.numRestr][c] -= this.tableau[i][c];
                }
            }
        }

        this.registrarIteracion("Inicio", "Fase 1", "Construcción del Tableau inicial para la Fase 1. El objetivo es minimizar la suma de variables artificiales (W).");
    }

    prepararFase2Directa() {
        // No hay artificiales, se pasa directo a la Fase 2
        // Creamos la fila Z original
        const totalCol = this.nombresVariables.length;
        const filaZ = new Array(totalCol + 1).fill(0);

        // Z = sum(c_i * x_i) -> Max Z -> Z - sum(c_i * x_i) = 0
        // Para Maximizar: coeficientes en Z de variables x son -c_i
        // Para Minimizar: coeficientes son +c_i (o multiplicamos por -1 al final)
        const mult = this.esMaximizar ? -1 : 1;
        for (let j = 0; j < this.numVars; j++) {
            filaZ[j] = this.c_orig[j] * mult;
        }

        this.tableau[this.numRestr] = filaZ;

        // Ajustar fila Z para variables básicas originales si las hubiera (normalmente no, holguras son básicas)
        for (let i = 0; i < this.numRestr; i++) {
            const bas = this.variablesBasicas[i];
            if (bas < this.numVars) {
                const coef = this.tableau[this.numRestr][bas];
                for (let c = 0; c <= totalCol; c++) {
                    this.tableau[this.numRestr][c] -= coef * this.tableau[i][c];
                }
            }
        }

        // Reemplazar la iteración inicial por una limpia de Fase 2
        this.historial = [];
        this.registrarIteracion("Inicio", "Fase 2", "Construcción del Tableau inicial. Se cargan los coeficientes de la función objetivo original.");
    }

    ejecutarFase(faseNum) {
        let iter = 1;
        const maxIter = 100;

        while (iter < maxIter) {
            // Verificar si es óptimo en el tableau actual
            const colPivote = this.obtenerColumnaPivote();
            if (colPivote === null) {
                // Es óptimo para esta fase
                if (faseNum === 1) {
                    const valorW = this.tableau[this.numRestr][this.tableau[0].length - 1];
                    // Si W > 1e-6, es infactible
                    if (valorW < -1e-6) {
                        return false; // Infactible
                    }
                    
                    this.registrarIteracion("Fin Fase 1", "Fase 1", "Se completó la Fase 1 con W = 0. Se ha encontrado una solución básica factible inicial. Procediendo a eliminar variables artificiales.");
                    
                    // Transición a la Fase 2
                    this.transicionFase2();
                    return true;
                } else {
                    this.registrarIteracion("Óptimo", "Fase 2", "¡Se ha alcanzado la solución óptima! Todos los costos reducidos en la fila Z son mayores o iguales a cero.");
                    return true;
                }
            }

            // Obtener fila pivote
            const filaPivote = this.obtenerFilaPivote(colPivote);
            if (filaPivote === null) {
                return false; // No acotado
            }

            const varEntra = this.nombresVariables[colPivote];
            const varSale = this.nombresVariables[this.variablesBasicas[filaPivote]];
            const elementoPivote = this.tableau[filaPivote][colPivote];

            const explicacion = `Entra a la base la variable **${varEntra}** (costo reducido más negativo) y sale la variable **${varSale}** (menor razón positiva). El pivote es **${elementoPivote.toFixed(4)}** en la fila ${filaPivote + 1}, columna ${colPivote + 1}.`;

            // Pivotear
            this.pivotear(filaPivote, colPivote);
            this.registrarIteracion(
                `Iteración ${iter}`, 
                `Fase ${faseNum}`, 
                explicacion,
                { filaPivote, colPivote }
            );

            iter++;
        }
        return true;
    }

    transicionFase2() {
        const totalColFase1 = this.nombresVariables.length;
        
        // 1. Eliminar variables artificiales de las variables y del tableau
        const variablesFase2 = [];
        const tiposFase2 = [];
        const indicesMantener = [];

        for (let j = 0; j < totalColFase1; j++) {
            if (this.tiposVariables[j] !== 'artificial') {
                variablesFase2.push(this.nombresVariables[j]);
                tiposFase2.push(this.tiposVariables[j]);
                indicesMantener.push(j);
            }
        }

        // Crear nuevo tableau reduciendo columnas
        const nuevoTableau = [];
        for (let i = 0; i < this.numRestr; i++) {
            const nuevaFila = [];
            for (let idx of indicesMantener) {
                nuevaFila.push(this.tableau[i][idx]);
            }
            nuevaFila.push(this.tableau[i][totalColFase1]); // b
            nuevoTableau.push(nuevaFila);
        }

        // Actualizar variables básicas
        // Si por alguna razón una variable básica era artificial (cuyo valor debe ser 0 en la solución),
        // debemos sacarla de la base, pero con Dos Fases estándar asumimos que ya no están o valen cero.
        this.variablesBasicas = this.variablesBasicas.map(bas => {
            const nuevoIdx = indicesMantener.indexOf(bas);
            if (nuevoIdx === -1) {
                // Buscar alguna variable no básica no artificial para ponerla en la base
                for (let k = 0; k < variablesFase2.length; k++) {
                    if (!this.variablesBasicas.includes(k)) {
                        return k;
                    }
                }
            }
            return nuevoIdx;
        });

        // Actualizar nombres y tipos
        this.nombresVariables = variablesFase2;
        this.tiposVariables = tiposFase2;

        const totalColFase2 = this.nombresVariables.length;

        // 2. Construir la nueva fila Z original
        const filaZ = new Array(totalColFase2 + 1).fill(0);
        const mult = this.esMaximizar ? -1 : 1;
        for (let j = 0; j < this.numVars; j++) {
            filaZ[j] = this.c_orig[j] * mult;
        }

        nuevoTableau.push(filaZ);
        this.tableau = nuevoTableau;

        // 3. Ajustar fila Z para que las variables básicas tengan costo reducido = 0
        for (let i = 0; i < this.numRestr; i++) {
            const bas = this.variablesBasicas[i];
            const coef = this.tableau[this.numRestr][bas];
            if (Math.abs(coef) > 1e-9) {
                for (let c = 0; c <= totalColFase2; c++) {
                    this.tableau[this.numRestr][c] -= coef * this.tableau[i][c];
                }
            }
        }

        this.columnasArtificiales = []; // Ya no hay
        this.registrarIteracion("Inicio Fase 2", "Fase 2", "Comienza la Fase 2. Se han eliminado las columnas artificiales y se ha reconstruido la fila Z con los coeficientes originales.");
    }

    obtenerColumnaPivote() {
        const filaZ = this.tableau[this.numRestr];
        const numCols = filaZ.length - 1; // Excluir columna b

        let minVal = -1e-9;
        let colIdx = null;

        for (let j = 0; j < numCols; j++) {
            if (filaZ[j] < minVal) {
                // Verificar que exista algún elemento positivo en la columna para poder pivotar
                let tienePositivo = false;
                for (let i = 0; i < this.numRestr; i++) {
                    if (this.tableau[i][j] > 1e-9) {
                        tienePositivo = true;
                        break;
                    }
                }
                if (tienePositivo) {
                    minVal = filaZ[j];
                    colIdx = j;
                }
            }
        }
        return colIdx;
    }

    obtenerFilaPivote(colPivote) {
        let minRatio = Infinity;
        let filaIdx = null;

        for (let i = 0; i < this.numRestr; i++) {
            const valorCol = this.tableau[i][colPivote];
            if (valorCol > 1e-9) {
                const bVal = this.tableau[i][this.tableau[i].length - 1];
                const ratio = bVal / valorCol;
                if (ratio < minRatio) {
                    minRatio = ratio;
                    filaIdx = i;
                }
            }
        }
        return filaIdx;
    }

    pivotear(filaPivote, colPivote) {
        const pivote = this.tableau[filaPivote][colPivote];
        const numCols = this.tableau[0].length;

        // 1. Dividir la fila pivote entre el elemento pivote
        for (let j = 0; j < numCols; j++) {
            this.tableau[filaPivote][j] /= pivote;
        }
        this.tableau[filaPivote][colPivote] = 1.0; // Asegurar precisión numérica

        // 2. Hacer cero en las demás filas para esa columna
        const operacionesFila = [];
        for (let i = 0; i <= this.numRestr; i++) {
            if (i !== filaPivote) {
                const factor = this.tableau[i][colPivote];
                if (Math.abs(factor) > 1e-12) {
                    operacionesFila.push(`F${i + 1} ➔ F${i + 1} - (${factor.toFixed(4)}) × F${filaPivote + 1}`);
                    for (let j = 0; j < numCols; j++) {
                        this.tableau[i][j] -= factor * this.tableau[filaPivote][j];
                    }
                    this.tableau[i][colPivote] = 0.0; // Asegurar precisión numérica
                }
            }
        }

        // 3. Actualizar variable básica de la fila
        this.variablesBasicas[filaPivote] = colPivote;
        this.tableau[filaPivote].operacionesFila = operacionesFila;
    }

    registrarIteracion(nombre, fase, explicacion, pivoteInfo = null) {
        // Deep copy del tableau
        const tableauCopy = this.tableau.map(row => [...row]);
        
        // Copiar variables básicas
        const basicasCopy = [...this.variablesBasicas];

        this.historial.push({
            nombre,
            fase,
            explicacion,
            tableau: tableauCopy,
            nombresVariables: [...this.nombresVariables],
            tiposVariables: [...this.tiposVariables],
            variablesBasicas: basicasCopy,
            pivoteInfo // Contiene { filaPivote, colPivote } si aplica
        });
    }

    obtenerSolucionFinal() {
        const variables = new Array(this.numVars).fill(0);
        const totalCol = this.nombresVariables.length;

        for (let j = 0; j < this.numVars; j++) {
            const idxBas = this.variablesBasicas.indexOf(j);
            if (idxBas !== -1) {
                variables[j] = this.tableau[idxBas][totalCol];
            } else {
                variables[j] = 0;
            }
        }

        // El valor de Z óptimo
        // En el tableau, la última fila representa Z - sum(c_i * x_i) = 0 => Z = RHS
        // Si multiplicamos el objetivo para minimizar, recordamos reestablecer el signo
        let z = this.tableau[this.numRestr][totalCol];
        if (!this.esMaximizar) {
            z = -z;
        }

        return {
            variables,
            z
        };
    }
}
window.SimplexSolver = SimplexSolver;
