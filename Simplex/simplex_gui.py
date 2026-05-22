import re
import numpy as np
import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
from itertools import combinations
from scipy.optimize import linprog
from sympy import symbols
from sympy.parsing.sympy_parser import (parse_expr,
                                        standard_transformations,
                                         implicit_multiplication_application)
import tkinter as tk
from tkinter import ttk, messagebox
from matplotlib.backends.backend_tkagg import FigureCanvasTkAgg

# LÓGICA MATEMÁTICA 

X1, X2 = symbols('X1 X2')
TRANSFORMACIONES = (standard_transformations +
                    (implicit_multiplication_application,))
LOCAL_DICT = {'X1': X1, 'X2': X2,
              'x1': X1, 'x2': X2}

def parsear_funcion_objetivo(texto): # Transforma la sintaxis a lenguaje para poder operar
    texto = texto.strip()
    if re.search(r'max', texto, re.IGNORECASE):
        tipo = 'max'
    elif re.search(r'min', texto, re.IGNORECASE):
        tipo = 'min'
    else:
        raise ValueError("La funcion objetivo debe comenzar con 'Maximizar' o 'Minimizar'.")

    if '=' not in texto:
        raise ValueError("La funcion objetivo debe tener '=' (ej: Z = 3X1 + 5X2).")
    expr_str = texto.split('=', 1)[1].strip() #Hace una división 0|=|1 y selecciona lo que despues del =

    expr = parse_expr(expr_str,
                      local_dict=LOCAL_DICT,
                      transformations=TRANSFORMACIONES) # Ayuda a transforma 3X1 a 3*X1

    c1 = float(expr.coeff(X1)) # Extrae los coeficientes de costos de la funcion objetivo
    c2 = float(expr.coeff(X2))
    return tipo, c1, c2, expr

def parsear_restriccion(texto):
    texto = texto.strip()
    if not texto:
        return None

    for op in ['<=', '>=', '=']:
        if op in texto:
            partes = texto.split(op, 1)
            lhs_str = partes[0].strip()
            rhs_str = partes[1].strip()

            lhs = parse_expr(lhs_str,
                             local_dict=LOCAL_DICT,
                             transformations=TRANSFORMACIONES)
            rhs = parse_expr(rhs_str,
                             local_dict=LOCAL_DICT,
                             transformations=TRANSFORMACIONES)

            expr = lhs - rhs
            a1 = float(expr.coeff(X1))
            a2 = float(expr.coeff(X2))
            b  = float(-expr.subs([(X1, 0), (X2, 0)]))

            return a1, a2, op, b

    raise ValueError(f"No se encontro operador (<=, >=, =) en: '{texto}'")

def resolver(prob):
    c    = prob["c"]
    tipo = prob["tipo"]
    c_opt = [-ci for ci in c] if tipo == "max" else list(c) #Si es de maximizar, multiplica por -1 para que linprog lo pueda interpretar

    A_ub, b_ub, A_eq, b_eq = [], [], [], [] #ub = Upper Bound, eq = Equality
    for (a1, a2, op, b) in prob["restricciones"]:
        if op == "<=":
            A_ub.append([a1, a2]); b_ub.append(b)
        elif op == ">=":
            A_ub.append([-a1, -a2]); b_ub.append(-b) 
        else:
            A_eq.append([a1, a2]); b_eq.append(b)
    
    #linprog por defecto Minimiza, por eso si es de maximizar multiplicamos por -1 para que minimice lo negativo.
    res = linprog(c_opt, #linprog es una librería especial de SciPy que resuelve problemas de programación lineal.
                  A_ub=A_ub or None, b_ub=b_ub or None,
                  A_eq=A_eq or None, b_eq=b_eq or None,
                  bounds=[(0, None), (0, None)],
                  method="highs")
    
    if res.success:
        x1o, x2o = res.x
        zo = c[0]*x1o + c[1]*x2o
        return x1o, x2o, zo, True
    return 0, 0, 0, False

def obtener_vertices(prob): #Encuentra los vertices de la región factible para ayudar a graficar.
    restricciones = prob["restricciones"]
    lineas = [(a1, a2, b) for a1, a2, op, b in restricciones]
    lineas += [(1, 0, 0), (0, 1, 0)]

    vertices = []
    for (a1, a2, b1), (a3, a4, b2) in combinations(lineas, 2):
        A = np.array([[a1, a2], [a3, a4]], dtype=float)
        if abs(np.linalg.det(A)) < 1e-10:
            continue
        try:
            pt = np.linalg.solve(A, [b1, b2])
        except np.linalg.LinAlgError:
            continue
        x1v, x2v = pt
        if x1v < -1e-6 or x2v < -1e-6:
            continue
        
        ok = True
        for (ra1, ra2, rop, rb) in restricciones:
            lhs = ra1*x1v + ra2*x2v
            if rop == "<=" and lhs > rb + 1e-6: ok = False; break
            if rop == ">=" and lhs < rb - 1e-6: ok = False; break
            if rop == "="  and abs(lhs - rb) > 1e-6: ok = False; break
        if ok:
            vertices.append((round(x1v, 6), round(x2v, 6)))

    unicos = []
    for v in vertices:
        if not any(abs(v[0]-u[0]) < 1e-4 and abs(v[1]-u[1]) < 1e-4 for u in unicos):
            unicos.append(v)
    return unicos

def evaluar_vertices(vertices, c, tipo):
    resultados = [(x1, x2, c[0]*x1 + c[1]*x2) for x1, x2 in vertices]
    resultados.sort(key=lambda r: r[2], reverse=(tipo == "max")) #Ordena los vertices de menor a mayor o viceversa dependiendo de si es maximizar o minimizar.
    return resultados

def calcular_limite(prob, x1_opt, x2_opt):
    vals = [x1_opt * 1.7, x2_opt * 1.7, 8.0]
    for (a1, a2, op, b) in prob["restricciones"]:
        if abs(a1) > 1e-9: vals.append(b / a1 * 1.5)
        if abs(a2) > 1e-9: vals.append(b / a2 * 1.5)
    lim = max(v for v in vals if v > 0 and v < 1e6)
    return lim

def fmt_num(v):
    return int(v) if v == int(v) else round(v, 4)

def graficar(prob, x1_opt, x2_opt, z_opt, resultados):
    c    = prob["c"]
    tipo = prob["tipo"]
    restricciones = prob["restricciones"]

    lim = calcular_limite(prob, x1_opt, x2_opt)
    x   = np.linspace(0, lim * 1.15, 1000)

    fig, ax = plt.subplots(figsize=(6, 5), dpi=100)
    fig.patch.set_facecolor('#F8F9FA')
    ax.set_facecolor('#F8F9FA')

    x1g, x2g = np.meshgrid(np.linspace(0, lim*1.15, 500),
                            np.linspace(0, lim*1.15, 500))
    fact = np.ones_like(x1g, dtype=bool)
    for (a1, a2, op, b) in restricciones:
        lhs = a1*x1g + a2*x2g
        if op == "<=":  fact &= lhs <= b + 1e-9
        elif op == ">=": fact &= lhs >= b - 1e-9
        else:            fact &= np.abs(lhs - b) < 0.05
    fact &= (x1g >= 0) & (x2g >= 0)

    ax.contourf(x1g, x2g, fact.astype(float),
                levels=[0.5, 1.5], colors=['#4CAF50'], alpha=0.22)
    ax.contour(x1g, x2g, fact.astype(float),
               levels=[0.5], colors=['#2E7D32'],
               linewidths=1.2, linestyles='--')

    colores = ['#1565C0', '#AD1457', '#E65100',
               '#6A1B9A', '#00695C', '#4E342E', '#37474F']
    for i, (a1, a2, op, b) in enumerate(restricciones):
        color = colores[i % len(colores)]
        signo = {'<=': u'\u2264', '>=': u'\u2265', '=': '='}[op]

        t = []
        if a1 != 0: t.append(f"{fmt_num(a1)}X\u2081")
        if a2 != 0: t.append(f"{fmt_num(a2)}X\u2082")
        label_r = " + ".join(t) + f" {signo} {fmt_num(b)}"

        if abs(a2) > 1e-9:
            y_line = (b - a1 * x) / a2
            mask = (y_line >= -0.5) & (y_line <= lim * 1.2)
            ax.plot(x[mask], y_line[mask],
                    color=color, linewidth=2.2, label=label_r)
        else:
            xv = b / a1 if abs(a1) > 1e-9 else 0
            ax.axvline(xv, color=color, linewidth=2.2, label=label_r)

    for x1v, x2v, zv in resultados:
        es_opt = (abs(x1v - x1_opt) < 1e-3 and abs(x2v - x2_opt) < 1e-3)
        if es_opt:
            ax.plot(x1v, x2v, 'o', color='#F44336',
                    markersize=10, zorder=7,
                    label=f'\u266A Optimo ({fmt_num(x1v)}, {fmt_num(x2v)})  Z={fmt_num(zv)}')
            ax.annotate(
                f"  \u266A ({fmt_num(x1v)}, {fmt_num(x2v)})\n  Z = {fmt_num(zv)}",
                (x1v, x2v), fontsize=9, fontweight='bold', color='#B71C1C',
                xytext=(5, 5), textcoords='offset points')
        else:
            ax.plot(x1v, x2v, 's', color='#37474F', markersize=6, zorder=6)
            ax.annotate(
                f"  ({fmt_num(x1v)}, {fmt_num(x2v)})\n  Z={fmt_num(zv)}",
                (x1v, x2v), fontsize=8, color='#37474F',
                xytext=(4, 4), textcoords='offset points')

    for frac, alpha, lw in [(0.30, 0.30, 1.2),
                             (0.65, 0.55, 1.6),
                             (1.00, 1.00, 2.5)]:
        zv = z_opt * frac
        if abs(c[1]) > 1e-9:
            y_iso = (zv - c[0]*x) / c[1]
            mask = (y_iso >= 0) & (y_iso <= lim*1.15)
            lbl = f"Z = {fmt_num(zv)}  (isoutilidad)" if frac == 1.0 else None
            ax.plot(x[mask], y_iso[mask], color='#FF6F00',
                    linewidth=lw, linestyle='--', alpha=alpha, label=lbl)

    ax.set_xlim(-0.5, lim)
    ax.set_ylim(-0.5, lim)
    ax.set_xlabel("$X_1$", fontsize=11)
    ax.set_ylabel("$X_2$", fontsize=11)
    ax.set_title(
        f"Método Gráfico\n"
        f"{'Maximizar' if tipo=='max' else 'Minimizar'} "
        f"Z = {fmt_num(c[0])}X\u2081 + {fmt_num(c[1])}X\u2082",
        fontsize=11, fontweight='bold')
    ax.axhline(0, color='black', linewidth=0.9)
    ax.axvline(0, color='black', linewidth=0.9)
    ax.grid(True, linestyle=':', alpha=0.45, color='#90A4AE')

    patch_rf = mpatches.Patch(color='#4CAF50', alpha=0.35,
                               label='Región Factible')
    handles, labels = ax.get_legend_handles_labels()
    ax.legend([patch_rf] + handles,
              ['Región Factible'] + labels,
              loc='upper right', fontsize=8,
              framealpha=0.92, edgecolor='#B0BEC5')

    plt.tight_layout()
    return fig

def generar_texto_reporte(prob, resultados, x1_opt, x2_opt, z_opt, encontrado):
    c    = prob["c"]
    tipo = prob["tipo"]
    
    lineas = []
    lineas.append("=====================================================")
    lineas.append("SOLUCIÓN -- MÉTODO GRÁFICO")
    lineas.append("=====================================================")
    lineas.append(f"Objetivo : {'Maximizar' if tipo=='max' else 'Minimizar'} Z = {fmt_num(c[0])}X1 + {fmt_num(c[1])}X2")
    lineas.append("\nRestricciones ingresadas:")
    for i, (a1, a2, op, b) in enumerate(prob["restricciones"]):
        lineas.append(f"  R{i+1}: {fmt_num(a1)}X1 + {fmt_num(a2)}X2 {op} {fmt_num(b)}")
    lineas.append("  No negatividad: X1, X2 >= 0")
    
    lineas.append("\n-----------------------------------------------------")
    lineas.append("VÉRTICES EVALUADOS")
    lineas.append("-----------------------------------------------------")
    for x1v, x2v, zv in resultados:
        es_opt = (abs(x1v-x1_opt) < 1e-3 and abs(x2v-x2_opt) < 1e-3)
        marca = "  <-- ÓPTIMO" if es_opt else ""
        lineas.append(f"({fmt_num(x1v):>5}, {fmt_num(x2v):>5})  ->  Z = {zv:>8.4f}{marca}")
        
    lineas.append("\n-----------------------------------------------------")
    lineas.append("SOLUCIÓN ÓPTIMA")
    if encontrado:
        lineas.append(f"X1* = {x1_opt:.4f}")
        lineas.append(f"X2* = {x2_opt:.4f}")
        lineas.append(f"Z*  = {z_opt:.4f} ({'máximo' if tipo=='max' else 'mínimo'})")
    else:
        lineas.append("No se encontró solución (problema no acotado o infactible).")
        
    return "\n".join(lineas)

# =====================================================================
# INTERFAZ GRÁFICA (TKINTER)
# =====================================================================

class SimplexApp:
    def __init__(self, root):
        self.root = root
        self.root.title("Método Gráfico - Programación Lineal")
        self.root.geometry("1100x700")
        self.root.configure(bg="#F8F9FA")
        
        # Estilos
        style = ttk.Style()
        style.theme_use('clam')
        style.configure('TLabel', background="#F8F9FA", font=('Segoe UI', 10))
        style.configure('TButton', font=('Segoe UI', 10, 'bold'))
        style.configure('TFrame', background="#F8F9FA")
        
        # Frame Principal
        main_frame = ttk.Frame(root, padding="10")
        main_frame.pack(fill=tk.BOTH, expand=True)
        
        # ================= PANEL IZQUIERDO (Entradas y Resultados) =================
        left_frame = ttk.Frame(main_frame, width=350)
        left_frame.pack(side=tk.LEFT, fill=tk.Y, padx=(0, 10))
        
        # --- Función Objetivo ---
        fo_frame = ttk.LabelFrame(left_frame, text="1. Función Objetivo", padding="10")
        fo_frame.pack(fill=tk.X, pady=(0, 10))
        
        ttk.Label(fo_frame, text="Ejemplo: Maximizar Z = 3X1 + 5X2").pack(anchor=tk.W)
        self.entry_fo = ttk.Entry(fo_frame, font=('Consolas', 11))
        self.entry_fo.pack(fill=tk.X, pady=(5, 0))
        self.entry_fo.insert(0, "Maximizar Z = 3X1 + 5X2")
        
        # --- Restricciones ---
        res_frame = ttk.LabelFrame(left_frame, text="2. Restricciones (Una por línea)", padding="10")
        res_frame.pack(fill=tk.BOTH, expand=True, pady=(0, 10))
        
        ttk.Label(res_frame, text="Ejemplo:\nX1 <= 4\n2X2 <= 12\n3X1 + 2X2 <= 18").pack(anchor=tk.W)
        self.text_res = tk.Text(res_frame, height=8, font=('Consolas', 11), width=40)
        self.text_res.pack(fill=tk.BOTH, expand=True, pady=(5, 0))
        self.text_res.insert(tk.END, "X1 <= 4\n2X2 <= 12\n3X1 + 2X2 <= 18")
        
        # --- Botón Resolver ---
        self.btn_resolver = ttk.Button(left_frame, text="Resolver y Graficar", command=self.procesar_y_resolver)
        self.btn_resolver.pack(fill=tk.X, pady=(0, 10), ipady=5)
        
        # --- Resultados ---
        out_frame = ttk.LabelFrame(left_frame, text="3. Resultados", padding="10")
        out_frame.pack(fill=tk.BOTH, expand=True)
        
        self.text_out = tk.Text(out_frame, height=15, font=('Consolas', 10), width=40, bg="#E9ECEF")
        self.text_out.pack(fill=tk.BOTH, expand=True)
        self.text_out.config(state=tk.DISABLED)
        
        # ================= PANEL DERECHO (Gráfica) =================
        self.right_frame = ttk.Frame(main_frame)
        self.right_frame.pack(side=tk.RIGHT, fill=tk.BOTH, expand=True)
        
        self.canvas_widget = None

    def procesar_y_resolver(self):
        fo_str = self.entry_fo.get().strip()
        res_str = self.text_res.get("1.0", tk.END).strip()
        
        if not fo_str:
            messagebox.showerror("Error", "Debes ingresar la función objetivo.")
            return
            
        try:
            tipo, c1, c2, expr_fo = parsear_funcion_objetivo(fo_str)
        except Exception as e:
            messagebox.showerror("Error FO", f"Error en función objetivo:\n{e}")
            return
            
        lineas_res = [linea.strip() for linea in res_str.split('\n') if linea.strip()]
        if not lineas_res:
            messagebox.showerror("Error", "Debes ingresar al menos una restricción.")
            return
            
        restricciones = []
        for r_line in lineas_res:
            try:
                r = parsear_restriccion(r_line)
                if r:
                    restricciones.append(r)
            except Exception as e:
                messagebox.showerror("Error Restricción", f"Error en:\n{r_line}\n{e}")
                return
                
        prob = {
            "tipo": tipo,
            "c": [c1, c2],
            "expr_fo": expr_fo,
            "fo_original": fo_str,
            "restricciones": restricciones,
        }
        
        # Resolver
        x1_opt, x2_opt, z_opt, encontrado = resolver(prob)
        vertices = obtener_vertices(prob)
        resultados = evaluar_vertices(vertices, prob["c"], prob["tipo"])
        
        # Mostrar texto
        texto_reporte = generar_texto_reporte(prob, resultados, x1_opt, x2_opt, z_opt, encontrado)
        self.text_out.config(state=tk.NORMAL)
        self.text_out.delete("1.0", tk.END)
        self.text_out.insert(tk.END, texto_reporte)
        self.text_out.config(state=tk.DISABLED)
        
        # Graficar
        fig = graficar(prob, x1_opt, x2_opt, z_opt, resultados)
        
        if self.canvas_widget:
            self.canvas_widget.get_tk_widget().destroy()
            
        self.canvas_widget = FigureCanvasTkAgg(fig, master=self.right_frame)
        self.canvas_widget.draw()
        self.canvas_widget.get_tk_widget().pack(fill=tk.BOTH, expand=True)

if __name__ == "__main__":
    root = tk.Tk()
    app = SimplexApp(root)
    root.mainloop()
