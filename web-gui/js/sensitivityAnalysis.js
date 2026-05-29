/**
 * Análisis de Sensibilidad Post-Óptimo en JavaScript.
 * Calcula:
 * - Precios Sombra (Shadow Prices) con explicaciones didácticas.
 * - Costos Reducidos (Reduced Costs) con explicaciones.
 * - Rango de Coeficientes de la Función Objetivo (c).
 * - Rango de Recursos del Lado Derecho (b).
 */

class SensitivityAnalysis {
    constructor(solverResult, simplexSolverInstance) {
        // Guardamos referencias
        this.solver = simplexSolverInstance;
        this.historial = solverResult.historial;
        this.exito = solverResult.exito;
        
        // Si no se resolvió con éxito, no se puede hacer análisis
        if (!this.exito) return;

        // Tomar el último estado del tableau
        const ultimoEstado = this.historial[this.historial.length - 1];
        this.tableau = ultimoEstado.tableau;
        this.nombresVariables = ultimoEstado.nombresVariables;
        this.tiposVariables = ultimoEstado.tiposVariables;
        this.variablesBasicas = ultimoEstado.variablesBasicas;

        this.c = this.solver.c_orig;
        this.A = this.solver.A_orig;
        this.b = this.solver.b_orig;
        this.signos = this.solver.signos;
        this.numVars = this.solver.numVars;
        this.numRestr = this.solver.numRestr;
        this.esMaximizar = this.solver.esMaximizar;
    }

    analizar() {
        if (!this.exito) return null;

        return {
            preciosSombra: this.obtenerPreciosSombra(),
            costosReducidos: this.obtenerCostosReducidos(),
            rangoCoeficientes: this.obtenerRangoCoeficientes(),
            rangoRecursos: this.obtenerRangoRecursos()
        };
    }

    obtenerPreciosSombra() {
        const precios = [];
        const filaZ = this.tableau[this.numRestr];
        const totalCol = this.nombresVariables.length;

        // Encontrar los precios sombra
        // Se ubican en las columnas correspondientes a las variables de holgura/exceso de cada restricción
        // Para restricciones <=: holgura s_i (coeficiente en la última fila Z)
        // Para restricciones >=: exceso e_i (coeficiente en fila Z)
        // Para restricciones =: artificial a_i (coeficiente en fila Z)
        
        // En nuestro simplexSolver, las variables se añadieron en orden de restricciones.
        // Vamos a escanear las variables añadidas en orden.
        let countHolgura = 1;
        let countExceso = 1;
        let countArt = 1;

        for (let i = 0; i < this.numRestr; i++) {
            const sig = this.signos[i];
            let colIdx = -1;
            let factorSigno = 1;

            if (sig === "<=") {
                const nombreBus = `s${countHolgura++}`;
                colIdx = this.nombresVariables.indexOf(nombreBus);
                factorSigno = 1;
            } else if (sig === ">=") {
                const nombreBus = `e${countExceso++}`;
                colIdx = this.nombresVariables.indexOf(nombreBus);
                factorSigno = -1; // Para exceso, el precio sombra es el negativo del costo reducido en Z
            } else if (sig === "=") {
                // Para igualdad, usamos el precio sombra de la variable artificial correspondiente
                // (si está en el tableau)
                const nombreBus = `a${countArt++}`;
                colIdx = this.nombresVariables.indexOf(nombreBus);
                factorSigno = 1;
            }

            let valorPrecio = 0;
            if (colIdx !== -1) {
                // El costo reducido está en filaZ[colIdx]
                // En maximización, filaZ tiene Z_j - C_j. El precio sombra es filaZ[colIdx] * factorSigno.
                // En minimización, filaZ tiene C_j - Z_j o similar.
                // Si la variable de holgura es básica, su costo reducido es 0 (precio sombra 0).
                const costoRed = filaZ[colIdx];
                valorPrecio = this.esMaximizar ? costoRed * factorSigno : -costoRed * factorSigno;
            }

            // Explicación detallada
            let explicacion = "";
            const absPrecio = Math.abs(valorPrecio);
            if (absPrecio < 1e-9) {
                explicacion = `Este recurso no es activo (sobrante). Incrementar su disponibilidad no altera el valor óptimo de Z.`;
            } else {
                const accion = valorPrecio > 0 ? "incrementará" : "reducirá";
                explicacion = `Cada unidad adicional de este recurso ${accion} el valor óptimo de Z en **${absPrecio.toFixed(4)}** unidades.`;
            }

            precios.push({
                restriccion: i + 1,
                signo: sig,
                valorActual: this.b[i],
                precioSombra: valorPrecio,
                explicacion
            });
        }

        return precios;
    }

    obtenerCostosReducidos() {
        const costos = [];
        const filaZ = this.tableau[this.numRestr];

        for (let j = 0; j < this.numVars; j++) {
            const nombre = `x${j + 1}`;
            const esBasica = this.variablesBasicas.includes(j);
            let costoRed = esBasica ? 0 : filaZ[j];
            
            // Ajustar signo para minimización
            if (!this.esMaximizar) {
                costoRed = -costoRed;
            }

            let explicacion = "";
            if (esBasica) {
                explicacion = `La variable está activa en la base. Su producción/uso es rentable.`;
            } else {
                if (Math.abs(costoRed) < 1e-9) {
                    explicacion = `Esta variable no básica tiene costo reducido 0, lo que sugiere que podría haber soluciones óptimas alternativas.`;
                } else {
                    // Para maximización, un costo reducido negativo significa cuánto penaliza a Z si entra.
                    // En nuestro tableau, filaZ[j] >= 0 en el óptimo para no-básicas.
                    // El valor absoluto nos dice cuánto debe mejorar el coeficiente c_j en la función objetivo para que sea rentable producirla.
                    explicacion = `No es rentable producir/usar esta variable. El coeficiente en la función objetivo tendría que mejorar en **${Math.abs(costoRed).toFixed(4)}** para que sea atractiva.`;
                }
            }

            costos.push({
                variable: nombre,
                esBasica,
                costoReducido: costoRed,
                valorSolucion: esBasica ? this.tableau[this.variablesBasicas.indexOf(j)][this.nombresVariables.length] : 0,
                explicacion
            });
        }
        return costos;
    }

    obtenerRangoCoeficientes() {
        const rangos = [];
        const filaZ = this.tableau[this.numRestr];
        const totalCol = this.nombresVariables.length;

        for (let j = 0; j < this.numVars; j++) {
            const actual = this.c[j];
            let minimo = -Infinity;
            let maximo = Infinity;

            const esBasica = this.variablesBasicas.includes(j);

            if (!esBasica) {
                // Variable no básica
                // Para maximización: c_j puede disminuir hasta -infinito.
                // Puede aumentar como máximo hasta c_j + costo_reducido_en_Z
                // (es decir, filaZ[j] en el tableau final)
                const costoRed = filaZ[j];
                if (this.esMaximizar) {
                    maximo = actual + costoRed;
                } else {
                    minimo = actual - costoRed;
                }
            } else {
                // Variable básica
                // El cambio en c_j afecta a todos los costos reducidos de las variables no básicas.
                // Buscamos la fila donde esta variable es básica
                const filaVar = this.variablesBasicas.indexOf(j);

                // Recorremos todas las variables no básicas
                for (let k = 0; k < totalCol; k++) {
                    if (!this.variablesBasicas.includes(k) && this.tiposVariables[k] !== 'artificial') {
                        const aik = this.tableau[filaVar][k];
                        const zk = filaZ[k];

                        if (Math.abs(aik) > 1e-9) {
                            const ratio = zk / aik;
                            if (this.esMaximizar) {
                                if (aik > 0) {
                                    minimo = Math.max(minimo, actual - ratio);
                                } else {
                                    maximo = Math.min(maximo, actual - ratio);
                                }
                            } else {
                                // Minimización
                                if (aik > 0) {
                                    maximo = Math.min(maximo, actual + ratio);
                                } else {
                                    minimo = Math.max(minimo, actual + ratio);
                                }
                            }
                        }
                    }
                }
            }

            // Explicación
            let explicacion = `El coeficiente de **x${j + 1}** (\$${actual.toFixed(2)}) puede oscilar entre `;
            explicacion += `${minimo === -Infinity ? "-∞" : "$" + minimo.toFixed(4)} y `;
            explicacion += `${maximo === Infinity ? "+∞" : "$" + maximo.toFixed(4)} `;
            explicacion += `sin cambiar la combinación óptima actual de variables (aunque sí cambiaría el valor de Z si es una variable básica).`;

            rangos.push({
                variable: `x${j + 1}`,
                actual,
                minimo,
                maximo,
                esBasica,
                explicacion
            });
        }
        return rangos;
    }

    obtenerRangoRecursos() {
        const rangos = [];
        const totalCol = this.nombresVariables.length;

        // Para cada restricción, calculamos el rango de variación de su recurso b_i
        // Esto depende de la columna correspondiente a su variable de holgura/exceso en el tableau final
        let countHolgura = 1;
        let countExceso = 1;
        let countArt = 1;

        for (let idxRestr = 0; idxRestr < this.numRestr; idxRestr++) {
            const sig = this.signos[idxRestr];
            let colIdx = -1;
            let factorDireccion = 1;

            if (sig === "<=") {
                colIdx = this.nombresVariables.indexOf(`s${countHolgura++}`);
                factorDireccion = 1;
            } else if (sig === ">=") {
                colIdx = this.nombresVariables.indexOf(`e${countExceso++}`);
                factorDireccion = -1; // Dirección inversa por el signo -1 en el exceso
            } else if (sig === "=") {
                colIdx = this.nombresVariables.indexOf(`a${countArt++}`);
                factorDireccion = 1;
            }

            const actual = this.b[idxRestr];
            let minDelta = -Infinity;
            let maxDelta = Infinity;

            if (colIdx !== -1) {
                // Analizar el impacto de la columna colIdx en la factibilidad del lado derecho (RHS)
                // Queremos que b_r* - delta * a_{r, colIdx} >= 0  para todo r
                // => delta * a_{r, colIdx} <= b_r*
                for (let r = 0; r < this.numRestr; r++) {
                    const ark = this.tableau[r][colIdx] * factorDireccion;
                    const br = this.tableau[r][totalCol]; // RHS actual de la fila r

                    if (Math.abs(ark) > 1e-9) {
                        const ratio = br / ark;
                        if (ark > 0) {
                            // delta <= br / ark => cota superior del decremento
                            maxDelta = Math.min(maxDelta, ratio);
                        } else {
                            // delta >= br / ark => cota inferior (como ark < 0, ratio es negativo)
                            minDelta = Math.max(minDelta, ratio);
                        }
                    }
                }
            }

            const minimo = maxDelta === Infinity ? -Infinity : actual - maxDelta;
            const maximo = minDelta === -Infinity ? Infinity : actual - minDelta;

            let explicacion = `La disponibilidad del recurso de la **Restricción ${idxRestr + 1}** (${actual.toFixed(2)}) puede oscilar entre `;
            explicacion += `${minimo === -Infinity ? "-∞" : minimo.toFixed(4)} y `;
            explicacion += `${maximo === Infinity ? "+∞" : maximo.toFixed(4)} `;
            explicacion += `manteniendo la validez de los precios sombra actuales y la factibilidad de la base.`;

            rangos.push({
                restriccion: idxRestr + 1,
                signo: sig,
                actual,
                minimo,
                maximo,
                explicacion
            });
        }
        return rangos;
    }
}
window.SensitivityAnalysis = SensitivityAnalysis;
