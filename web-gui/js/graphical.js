/**
 * Módulo del Método Gráfico utilizando SVG dinámico.
 * Calcula intersecciones, región factible, vértices
 * y realiza el dibujado y animación de la recta de isoutilidad.
 */

class GraphicalMethod {
    constructor(c, A, b, signos, esMaximizar, x1Opt, x2Opt, zOpt) {
        this.c = [...c];
        this.A = A.map(row => [...row]);
        this.b = [...b];
        this.signos = [...signos];
        this.esMaximizar = esMaximizar;
        
        this.x1Opt = x1Opt;
        this.x2Opt = x2Opt;
        this.zOpt = zOpt;

        this.vertices = [];
        this.limiteMax = 10; // Límite de graficación
        
        this.calcularVertices();
        this.calcularLimite();
    }

    calcularVertices() {
        // Encontrar intersecciones de todas las restricciones entre sí
        // incluyendo las restricciones de no negatividad x1 >= 0 y x2 >= 0
        const lineas = []; // Cada elemento es { a1, a2, b, label }
        
        for (let i = 0; i < this.A.length; i++) {
            lineas.push({
                a1: this.A[i][0],
                a2: this.A[i][1],
                b: this.b[i],
                restrIdx: i
            });
        }
        
        // Ejes
        lineas.push({ a1: 1, a2: 0, b: 0, restrIdx: -1, nombre: "x1 >= 0" });
        lineas.push({ a1: 0, a2: 1, b: 0, restrIdx: -2, nombre: "x2 >= 0" });

        const ptsInterseccion = [];

        // Combinaciones de 2 en 2
        for (let i = 0; i < lineas.length; i++) {
            for (let j = i + 1; j < lineas.length; j++) {
                const l1 = lineas[i];
                const l2 = lineas[j];

                // Resolver sistema 2x2
                // l1.a1 * x1 + l1.a2 * x2 = l1.b
                // l2.a1 * x1 + l2.a2 * x2 = l2.b
                const det = l1.a1 * l2.a2 - l1.a2 * l2.a1;
                if (Math.abs(det) < 1e-9) continue; // Paralelas

                const x1 = (l1.b * l2.a2 - l1.a2 * l2.b) / det;
                const x2 = (l1.a1 * l2.b - l1.b * l2.a1) / det;

                // Verificar si el punto es factible (dentro de tolerancia)
                if (x1 < -1e-5 || x2 < -1e-5) continue;

                let factible = true;
                for (let k = 0; k < this.A.length; k++) {
                    const lhs = this.A[k][0] * x1 + this.A[k][1] * x2;
                    const rhs = this.b[k];
                    const sig = this.signos[k];

                    if (sig === "<=" && lhs > rhs + 1e-4) { factible = false; break; }
                    if (sig === ">=" && lhs < rhs - 1e-4) { factible = false; break; }
                    if (sig === "=" && Math.abs(lhs - rhs) > 1e-4) { factible = false; break; }
                }

                if (factible) {
                    // Evitar duplicados
                    const existe = ptsInterseccion.some(p => Math.abs(p.x1 - x1) < 1e-4 && Math.abs(p.x2 - x2) < 1e-4);
                    if (!existe) {
                        ptsInterseccion.push({ x1: Math.round(x1 * 10000) / 10000, x2: Math.round(x2 * 10000) / 10000 });
                    }
                }
            }
        }

        // Ordenar los vértices en sentido horario/antihorario para dibujar el polígono
        if (ptsInterseccion.length > 0) {
            // Calcular centroide
            let cx = 0, cy = 0;
            for (let p of ptsInterseccion) {
                cx += p.x1;
                cy += p.x2;
            }
            cx /= ptsInterseccion.length;
            cy /= ptsInterseccion.length;

            // Ordenar por ángulo respecto al centroide
            ptsInterseccion.sort((a, b) => {
                const angleA = Math.atan2(a.x2 - cy, a.x1 - cx);
                const angleB = Math.atan2(b.x2 - cy, b.x1 - cx);
                return angleA - angleB;
            });
        }

        this.vertices = ptsInterseccion;
    }

    calcularLimite() {
        const vals = [8.0];
        if (this.x1Opt && !isNaN(this.x1Opt)) vals.push(this.x1Opt * 1.8);
        if (this.x2Opt && !isNaN(this.x2Opt)) vals.push(this.x2Opt * 1.8);

        for (let i = 0; i < this.A.length; i++) {
            const a1 = this.A[i][0];
            const a2 = this.A[i][1];
            const rhs = this.b[i];

            if (Math.abs(a1) > 1e-9) vals.push((rhs / a1) * 1.3);
            if (Math.abs(a2) > 1e-9) vals.push((rhs / a2) * 1.3);
        }

        // Filtrar valores válidos
        const validos = vals.filter(v => v > 0 && v < 1e6);
        this.limiteMax = validos.length > 0 ? Math.max(...validos) : 10;
    }

    calcularPoligonoDibujo() {
        const lineas = [];
        for (let i = 0; i < this.A.length; i++) {
            lineas.push({ a1: this.A[i][0], a2: this.A[i][1], b: this.b[i] });
        }
        lineas.push({ a1: 1, a2: 0, b: 0 });
        lineas.push({ a1: 0, a2: 1, b: 0 });
        
        const L = this.limiteMax * 1.5;
        lineas.push({ a1: 1, a2: 0, b: L });
        lineas.push({ a1: 0, a2: 1, b: L });

        const pts = [];
        for (let i = 0; i < lineas.length; i++) {
            for (let j = i + 1; j < lineas.length; j++) {
                const l1 = lineas[i];
                const l2 = lineas[j];
                const det = l1.a1 * l2.a2 - l1.a2 * l2.a1;
                if (Math.abs(det) < 1e-9) continue;
                
                const x1 = (l1.b * l2.a2 - l1.a2 * l2.b) / det;
                const x2 = (l1.a1 * l2.b - l1.b * l2.a1) / det;

                if (x1 < -1e-5 || x2 < -1e-5 || x1 > L + 1e-4 || x2 > L + 1e-4) continue;

                let factible = true;
                for (let k = 0; k < this.A.length; k++) {
                    const lhs = this.A[k][0] * x1 + this.A[k][1] * x2;
                    const rhs = this.b[k];
                    const sig = this.signos[k];

                    if (sig === "<=" && lhs > rhs + 1e-4) { factible = false; break; }
                    if (sig === ">=" && lhs < rhs - 1e-4) { factible = false; break; }
                    if (sig === "=" && Math.abs(lhs - rhs) > 1e-4) { factible = false; break; }
                }

                if (factible) {
                    const x1_r = Math.round(x1 * 10000) / 10000;
                    const x2_r = Math.round(x2 * 10000) / 10000;
                    const existe = pts.some(p => Math.abs(p.x1 - x1_r) < 1e-4 && Math.abs(p.x2 - x2_r) < 1e-4);
                    if (!existe) pts.push({ x1: x1_r, x2: x2_r });
                }
            }
        }

        if (pts.length > 0) {
            let cx = 0, cy = 0;
            for (let p of pts) { cx += p.x1; cy += p.x2; }
            cx /= pts.length; cy /= pts.length;
            pts.sort((a, b) => Math.atan2(a.x2 - cy, a.x1 - cx) - Math.atan2(b.x2 - cy, b.x1 - cx));
        }
        return pts;
    }

    render(containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;
        container.innerHTML = ""; // Limpiar

        const svgNS = "http://www.w3.org/2000/svg";
        const svg = document.createElementNS(svgNS, "svg");
        svg.setAttribute("width", "100%");
        svg.setAttribute("height", "100%");
        svg.setAttribute("viewBox", "0 0 500 500");
        svg.style.backgroundColor = "#1e293b";
        svg.style.borderRadius = "12px";
        svg.style.border = "1px solid rgba(255, 255, 255, 0.1)";

        // Margen de dibujo en SVG (eje X e Y de 40 a 460)
        const padding = 50;
        const graphSize = 400; // 500 - 2 * 50

        // Funciones de mapeo de coordenadas reales a coordenadas SVG
        const scaleX = (val) => padding + (val / this.limiteMax) * graphSize;
        // El eje Y en SVG va hacia abajo, por eso invertimos
        const scaleY = (val) => padding + graphSize - (val / this.limiteMax) * graphSize;

        // 1. Dibujar Cuadrícula y Fondo
        const gridGroup = document.createElementNS(svgNS, "g");
        gridGroup.setAttribute("class", "grid");
        
        const numDivisiones = 10;
        for (let i = 0; i <= numDivisiones; i++) {
            const valReal = (this.limiteMax / numDivisiones) * i;
            const x = scaleX(valReal);
            const y = scaleY(valReal);

            // Línea vertical
            const vLine = document.createElementNS(svgNS, "line");
            vLine.setAttribute("x1", x);
            vLine.setAttribute("y1", padding);
            vLine.setAttribute("x2", x);
            vLine.setAttribute("y2", padding + graphSize);
            vLine.setAttribute("stroke", "rgba(255, 255, 255, 0.05)");
            vLine.setAttribute("stroke-width", "1");
            gridGroup.appendChild(vLine);

            // Línea horizontal
            const hLine = document.createElementNS(svgNS, "line");
            hLine.setAttribute("x1", padding);
            hLine.setAttribute("y1", y);
            hLine.setAttribute("x2", padding + graphSize);
            hLine.setAttribute("y2", y);
            hLine.setAttribute("stroke", "rgba(255, 255, 255, 0.05)");
            hLine.setAttribute("stroke-width", "1");
            gridGroup.appendChild(hLine);

            // Etiquetas de ejes
            if (i > 0) {
                const labelX = document.createElementNS(svgNS, "text");
                labelX.setAttribute("x", x);
                labelX.setAttribute("y", padding + graphSize + 15);
                labelX.setAttribute("fill", "#94a3b8");
                labelX.setAttribute("font-size", "10");
                labelX.setAttribute("text-anchor", "middle");
                labelX.textContent = valReal.toFixed(1);
                gridGroup.appendChild(labelX);

                const labelY = document.createElementNS(svgNS, "text");
                labelY.setAttribute("x", padding - 8);
                labelY.setAttribute("y", y + 4);
                labelY.setAttribute("fill", "#94a3b8");
                labelY.setAttribute("font-size", "10");
                labelY.setAttribute("text-anchor", "end");
                labelY.textContent = valReal.toFixed(1);
                gridGroup.appendChild(labelY);
            }
        }
        svg.appendChild(gridGroup);

        // 2. Dibujar Región Factible (Polígono)
        const polyPts = this.calcularPoligonoDibujo();
        if (polyPts.length > 2) {
            const polygon = document.createElementNS(svgNS, "polygon");
            const pointsStr = polyPts.map(p => `${scaleX(p.x1)},${scaleY(p.x2)}`).join(" ");
            polygon.setAttribute("points", pointsStr);
            polygon.setAttribute("fill", "url(#feasibleGrad)");
            polygon.setAttribute("stroke", "#10b981");
            polygon.setAttribute("stroke-width", "2");
            polygon.setAttribute("stroke-dasharray", "4,4");
            polygon.setAttribute("opacity", "0.7");
            
            // Animación CSS simple en la región factible
            const anim = document.createElementNS(svgNS, "animate");
            anim.setAttribute("attributeName", "opacity");
            anim.setAttribute("values", "0.55;0.75;0.55");
            anim.setAttribute("dur", "4s");
            anim.setAttribute("repeatCount", "indefinite");
            polygon.appendChild(anim);

            svg.appendChild(polygon);
        }

        // Definir Gradientes en SVG
        const defs = document.createElementNS(svgNS, "defs");
        const grad = document.createElementNS(svgNS, "linearGradient");
        grad.setAttribute("id", "feasibleGrad");
        grad.setAttribute("x1", "0%");
        grad.setAttribute("y1", "0%");
        grad.setAttribute("x2", "100%");
        grad.setAttribute("y2", "100%");
        
        const stop1 = document.createElementNS(svgNS, "stop");
        stop1.setAttribute("offset", "0%");
        stop1.setAttribute("stop-color", "#10b981");
        stop1.setAttribute("stop-opacity", "0.15");
        
        const stop2 = document.createElementNS(svgNS, "stop");
        stop2.setAttribute("offset", "100%");
        stop2.setAttribute("stop-color", "#047857");
        stop2.setAttribute("stop-opacity", "0.4");

        grad.appendChild(stop1);
        grad.appendChild(stop2);
        defs.appendChild(grad);
        svg.appendChild(defs);

        // 3. Dibujar Líneas de Restricción
        const colors = ["#3b82f6", "#ec4899", "#f59e0b", "#a855f7", "#06b6d4", "#14b8a6"];
        const linesGroup = document.createElementNS(svgNS, "g");

        for (let i = 0; i < this.A.length; i++) {
            const a1 = this.A[i][0];
            const a2 = this.A[i][1];
            const rhs = this.b[i];
            const sig = this.signos[i];

            let x1Start, x2Start, x1End, x2End;

            // Encontrar intersección de la línea de restricción extendiéndola suficientemente
            if (Math.abs(a2) > 1e-9) {
                x1Start = -this.limiteMax;
                x2Start = (rhs - a1 * x1Start) / a2;
                x1End = this.limiteMax * 2;
                x2End = (rhs - a1 * x1End) / a2;
            } else {
                x1Start = rhs / a1;
                x2Start = -this.limiteMax;
                x1End = rhs / a1;
                x2End = this.limiteMax * 2;
            }

            const line = document.createElementNS(svgNS, "line");
            line.setAttribute("x1", scaleX(x1Start));
            line.setAttribute("y1", scaleY(x2Start));
            line.setAttribute("x2", scaleX(x1End));
            line.setAttribute("y2", scaleY(x2End));
            line.setAttribute("stroke", colors[i % colors.length]);
            line.setAttribute("stroke-width", "2");
            line.setAttribute("class", "constraint-line");
            line.setAttribute("data-index", i);

            // Agregar un título hover simple de SVG
            const title = document.createElementNS(svgNS, "title");
            title.textContent = `R${i + 1}: ${a1}x1 + ${a2}x2 ${sig} ${rhs}`;
            line.appendChild(title);

            linesGroup.appendChild(line);
        }
        svg.appendChild(linesGroup);

        // 4. Ejes Coordenados Principales
        const axesGroup = document.createElementNS(svgNS, "g");
        
        // Eje X
        const xAxis = document.createElementNS(svgNS, "line");
        xAxis.setAttribute("x1", padding - 10);
        xAxis.setAttribute("y1", padding + graphSize);
        xAxis.setAttribute("x2", padding + graphSize + 20);
        xAxis.setAttribute("y2", padding + graphSize);
        xAxis.setAttribute("stroke", "#ffffff");
        xAxis.setAttribute("stroke-width", "1.5");
        axesGroup.appendChild(xAxis);

        // Eje Y
        const yAxis = document.createElementNS(svgNS, "line");
        yAxis.setAttribute("x1", padding);
        yAxis.setAttribute("y1", padding - 20);
        yAxis.setAttribute("x2", padding);
        yAxis.setAttribute("y2", padding + graphSize + 10);
        yAxis.setAttribute("stroke", "#ffffff");
        yAxis.setAttribute("stroke-width", "1.5");
        axesGroup.appendChild(yAxis);

        // Nombres de ejes
        const labelXAxis = document.createElementNS(svgNS, "text");
        labelXAxis.setAttribute("x", padding + graphSize + 25);
        labelXAxis.setAttribute("y", padding + graphSize + 4);
        labelXAxis.setAttribute("fill", "#ffffff");
        labelXAxis.setAttribute("font-size", "12");
        labelXAxis.setAttribute("font-weight", "bold");
        labelXAxis.textContent = "x1";
        axesGroup.appendChild(labelXAxis);

        const labelYAxis = document.createElementNS(svgNS, "text");
        labelYAxis.setAttribute("x", padding);
        labelYAxis.setAttribute("y", padding - 28);
        labelYAxis.setAttribute("fill", "#ffffff");
        labelYAxis.setAttribute("font-size", "12");
        labelYAxis.setAttribute("font-weight", "bold");
        labelYAxis.setAttribute("text-anchor", "middle");
        labelYAxis.textContent = "x2";
        axesGroup.appendChild(labelYAxis);

        svg.appendChild(axesGroup);

        // 5. Dibujar los Vértices factibles como círculos interactivos
        const verticesGroup = document.createElementNS(svgNS, "g");
        this.vertices.forEach((v, index) => {
            const isOpt = this.x1Opt !== undefined && Math.abs(v.x1 - this.x1Opt) < 1e-3 && Math.abs(v.x2 - this.x2Opt) < 1e-3;
            
            const circle = document.createElementNS(svgNS, "circle");
            circle.setAttribute("cx", scaleX(v.x1));
            circle.setAttribute("cy", scaleY(v.x2));
            circle.setAttribute("r", isOpt ? "7" : "5");
            circle.setAttribute("fill", isOpt ? "#ef4444" : "#f1f5f9");
            circle.setAttribute("stroke", isOpt ? "#fca5a5" : "#475569");
            circle.setAttribute("stroke-width", "2");
            circle.setAttribute("cursor", "pointer");

            // Animación de pulso si es el óptimo
            if (isOpt) {
                const pulse = document.createElementNS(svgNS, "animate");
                pulse.setAttribute("attributeName", "r");
                pulse.setAttribute("values", "6;9;6");
                pulse.setAttribute("dur", "2s");
                pulse.setAttribute("repeatCount", "indefinite");
                circle.appendChild(pulse);
            }

            const title = document.createElementNS(svgNS, "title");
            const valZ = this.c[0] * v.x1 + this.c[1] * v.x2;
            title.textContent = `Vértice (${v.x1}, ${v.x2})\nZ = ${valZ.toFixed(2)}${isOpt ? " (Óptimo)" : ""}`;
            circle.appendChild(title);

            verticesGroup.appendChild(circle);
        });
        svg.appendChild(verticesGroup);

        // 6. Grupo de Recta de Isoutilidad (Línea de objetivo) animada
        const isoGroup = document.createElementNS(svgNS, "g");
        isoGroup.setAttribute("id", "iso-lines");
        
        // Creamos la recta de isoutilidad principal en el óptimo
        if (this.zOpt !== undefined && !isNaN(this.zOpt) && (Math.abs(this.c[0]) > 0 || Math.abs(this.c[1]) > 0)) {
            const c0 = this.c[0];
            const c1 = this.c[1];
            
            // Dibujar la recta Z_opt extendida a través del gráfico
            let x1S = -this.limiteMax, x2S = c1 !== 0 ? (this.zOpt - c0 * x1S) / c1 : 0;
            let x1E = this.limiteMax * 2, x2E = c1 !== 0 ? (this.zOpt - c0 * x1E) / c1 : 0;

            if (c1 === 0) {
                x1S = this.zOpt / c0; x2S = -this.limiteMax;
                x1E = this.zOpt / c0; x2E = this.limiteMax * 2;
            }

            const optLine = document.createElementNS(svgNS, "line");
            optLine.setAttribute("id", "opt-iso-line");
            optLine.setAttribute("x1", scaleX(x1S));
            optLine.setAttribute("y1", scaleY(x2S));
            optLine.setAttribute("x2", scaleX(x1E));
            optLine.setAttribute("y2", scaleY(x2E));
            optLine.setAttribute("stroke", "#f59e0b");
            optLine.setAttribute("stroke-width", "2.5");
            optLine.setAttribute("stroke-dasharray", "6,4");
            
            const title = document.createElementNS(svgNS, "title");
            title.textContent = `Línea de Utilidad Óptima (Z = ${this.zOpt.toFixed(2)})`;
            optLine.appendChild(title);
            isoGroup.appendChild(optLine);
        }
        svg.appendChild(isoGroup);

        container.appendChild(svg);
    }

    animarRecta(containerId) {
        const svg = document.querySelector(`#${containerId} svg`);
        if (!svg) return;

        // Eliminar animaciones previas de isoutilidad
        const viejaAnim = svg.querySelector("#anim-iso-line");
        if (viejaAnim) viejaAnim.remove();

        const svgNS = "http://www.w3.org/2000/svg";
        const scaleX = (val) => 50 + (val / this.limiteMax) * 400;
        const scaleY = (val) => 50 + 400 - (val / this.limiteMax) * 400;

        const c0 = this.c[0];
        const c1 = this.c[1];

        // Crear una línea para animar
        const animLine = document.createElementNS(svgNS, "line");
        animLine.setAttribute("id", "anim-iso-line");
        animLine.setAttribute("stroke", "#ef4444");
        animLine.setAttribute("stroke-width", "2");
        animLine.setAttribute("opacity", "0.9");
        animLine.setAttribute("stroke-dasharray", "4,4");

        svg.appendChild(animLine);

        // Queremos animar el valor Z desde 0 hasta el Z óptimo (o un valor cercano)
        let zActual = 0;
        const zFinal = this.zOpt || (c0 * this.limiteMax / 2 + c1 * this.limiteMax / 2);
        const duracion = 2500; // ms
        const fps = 60;
        const pasos = (duracion / 1000) * fps;
        const incremento = zFinal / pasos;
        let paso = 0;

        const interval = setInterval(() => {
            paso++;
            if (incremento > 0) {
                zActual = Math.min(zFinal, zActual + incremento);
            } else {
                zActual = Math.max(zFinal, zActual + incremento);
            }

            let x1S = -this.limiteMax, x2S = c1 !== 0 ? (zActual - c0 * x1S) / c1 : 0;
            let x1E = this.limiteMax * 2, x2E = c1 !== 0 ? (zActual - c0 * x1E) / c1 : 0;

            if (c1 === 0) {
                x1S = zActual / c0; x2S = -this.limiteMax;
                x1E = zActual / c0; x2E = this.limiteMax * 2;
            }

            animLine.setAttribute("x1", scaleX(x1S));
            animLine.setAttribute("y1", scaleY(x2S));
            animLine.setAttribute("x2", scaleX(x1E));
            animLine.setAttribute("y2", scaleY(x2E));

            if (paso >= pasos || (incremento > 0 ? zActual >= zFinal : zActual <= zFinal)) {
                clearInterval(interval);
                // Hacer parpadear un par de veces y dejarla fija
                let visible = true;
                let parpadeos = 0;
                const parpadeoInterval = setInterval(() => {
                    animLine.setAttribute("opacity", visible ? "0.9" : "0.1");
                    visible = !visible;
                    parpadeos++;
                    if (parpadeos >= 6) {
                        clearInterval(parpadeoInterval);
                        animLine.setAttribute("opacity", "0.7");
                        animLine.setAttribute("stroke", "#10b981"); // cambiar a verde al finalizar
                    }
                }, 150);
            }
        }, 1000 / fps);
    }
}
window.GraphicalMethod = GraphicalMethod;
