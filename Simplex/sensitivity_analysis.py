"""
Análisis de Sensibilidad para el Método Simplex.

Proporciona análisis post-óptimo:
- Rangos de coeficientes de la función objetivo (c)
- Rangos de recursos (lado derecho b)
- Precios sombra
- Análisis de cambios en restricciones
"""

import numpy as np


class SensitivityAnalysis:

    def __init__(self, simplex_instance):
        """
        Inicializa el análisis de sensibilidad.
        
        Args:
            simplex_instance: Instancia resuelta de la clase Simplex
        """
        self.simplex = simplex_instance
        self.c = simplex_instance.c
        self.A = simplex_instance.A
        self.b = simplex_instance.b
        self.tableau = simplex_instance.tableau
        self.nombres_variables = simplex_instance.nombres_variables
        self.tipos_variables = simplex_instance.tipos_variables
        self.num_variables = simplex_instance.num_variables
        self.num_restricciones = simplex_instance.num_restricciones
        self.variables_basicas = simplex_instance.variables_basicas

    # =========================================================
    # PRECIOS SOMBRA (DUAL VALUES)
    # =========================================================

    def obtener_precios_sombra(self):
        """
        Obtiene los precios sombra de las restricciones.
        
        Los precios sombra indican cuánto cambia el valor óptimo Z
        si se incrementa en 1 unidad el recurso (lado derecho) de cada restricción.
        
        Returns:
            list: Precios sombra para cada restricción
        """
        precios = []
        fila_z = self.tableau[-1, :]
        
        # Los precios sombra se encuentran en la fila Z
        # en las columnas correspondientes a las variables de holgura/exceso
        for i in range(self.num_restricciones):
            # Columna de la variable de holgura/exceso de la restricción i
            columna_holgura = self.num_variables + i
            precio = -fila_z[columna_holgura]
            precios.append(precio)
        
        return precios

    # =========================================================
    # RANGO DE COEFICIENTES OBJETIVO (c)
    # =========================================================

    def rango_coeficiente_objetivo(self, variable_idx):
        """
        Calcula el rango permitido para un coeficiente de la función objetivo.
        
        Args:
            variable_idx: Índice de la variable (0-indexado)
        
        Returns:
            dict: {'minimo': float, 'maximo': float, 'actual': float}
        """
        if variable_idx >= self.num_variables:
            return None
        
        # Si la variable es básica
        if variable_idx in self.variables_basicas:
            # El rango depende de cómo cambian los costos reducidos
            # Esta es una aproximación simplificada
            fila_z = self.tableau[-1, :]
            
            # Buscar la fila de la variable básica
            fila_var = self.variables_basicas.index(variable_idx)
            
            # Valores que mantienen la optimalidad
            minimo = -np.inf
            maximo = np.inf
            
            # Revisar todas las variables no básicas
            for j in range(len(fila_z) - 1):
                if j not in self.variables_basicas:
                    if self.tableau[fila_var, j] != 0:
                        valor = fila_z[j] / self.tableau[fila_var, j]
                        if self.tableau[fila_var, j] > 0:
                            maximo = min(maximo, valor)
                        else:
                            minimo = max(minimo, valor)
            
            return {
                'minimo': minimo,
                'maximo': maximo,
                'actual': self.c[variable_idx]
            }
        else:
            # Variable no básica
            fila_z = self.tableau[-1, variable_idx]
            
            return {
                'minimo': -np.inf,
                'maximo': self.c[variable_idx] + fila_z,
                'actual': self.c[variable_idx]
            }

    # =========================================================
    # RANGO DE RECURSOS (b)
    # =========================================================

    def rango_recurso(self, restriccion_idx):
        """
        Calcula el rango permitido para el recurso de una restricción.
        
        Args:
            restriccion_idx: Índice de la restricción (0-indexado)
        
        Returns:
            dict: {'minimo': float, 'maximo': float, 'actual': float}
        """
        if restriccion_idx >= self.num_restricciones:
            return None
        
        # Valores actuales de los recursos
        valor_actual = self.b[restriccion_idx]
        
        # Obtener la columna de valores de solución
        columna_solucion = self.tableau[:self.num_restricciones, -1]
        
        # Ratios para calcular el rango
        minimo = 0
        maximo = np.inf
        
        # Analizar cada fila para cambios que mantengan factibilidad
        fila_restriccion = restriccion_idx
        
        if fila_restriccion < len(self.tableau) - 1:
            for i in range(len(self.tableau) - 1):
                if self.tableau[i, restriccion_idx + self.num_variables] != 0:
                    elemento = self.tableau[i, restriccion_idx + self.num_variables]
                    valor_bi = self.tableau[i, -1]
                    
                    if elemento > 0:
                        maximo = min(maximo, valor_bi / elemento)
                    else:
                        minimo = max(minimo, -valor_bi / elemento)
        
        return {
            'minimo': max(0, valor_actual - minimo) if minimo > 0 else 0,
            'maximo': valor_actual + maximo if maximo < np.inf else np.inf,
            'actual': valor_actual
        }

    # =========================================================
    # COSTOS REDUCIDOS
    # =========================================================

    def obtener_costos_reducidos(self):
        """
        Obtiene los costos reducidos de todas las variables.
        
        El costo reducido indica cuánto debe cambiar el coeficiente objetivo
        de una variable no básica para que sea rentable usarla.
        
        Returns:
            dict: {'variable': nombre, 'costo_reducido': valor}
        """
        costos = []
        fila_z = self.tableau[-1, :-1]
        
        for j in range(len(fila_z)):
            if j not in self.variables_basicas:
                costos.append({
                    'variable': self.nombres_variables[j] if j < len(self.nombres_variables) else f"var_{j}",
                    'costo_reducido': fila_z[j],
                    'es_basica': False
                })
            else:
                costos.append({
                    'variable': self.nombres_variables[j] if j < len(self.nombres_variables) else f"var_{j}",
                    'costo_reducido': 0,
                    'es_basica': True
                })
        
        return costos

    # =========================================================
    # MOSTRAR REPORTE COMPLETO DE SENSIBILIDAD
    # =========================================================

    def mostrar_reporte_sensibilidad(self):
        """
        Muestra un reporte completo del análisis de sensibilidad.
        """
        print("\n" + "=" * 70)
        print("ANÁLISIS DE SENSIBILIDAD")
        print("=" * 70)

        # Precios sombra
        print("\n" + "-" * 70)
        print("PRECIOS SOMBRA (Dual Values)")
        print("-" * 70)
        precios = self.obtener_precios_sombra()
        for i, precio in enumerate(precios):
            print(f"Restricción {i + 1}: {precio:.6f}")

        # Costos reducidos
        print("\n" + "-" * 70)
        print("COSTOS REDUCIDOS")
        print("-" * 70)
        costos = self.obtener_costos_reducidos()
        for item in costos:
            basica = " (Básica)" if item['es_basica'] else " (No básica)"
            print(f"{item['variable']}: {item['costo_reducido']:.6f}{basica}")

        # Rangos de coeficientes objetivo
        print("\n" + "-" * 70)
        print("RANGO DE COEFICIENTES OBJETIVO")
        print("-" * 70)
        for i in range(self.num_variables):
            rango = self.rango_coeficiente_objetivo(i)
            if rango:
                print(f"\n{self.nombres_variables[i]}:")
                print(f"  Valor actual: {rango['actual']:.6f}")
                if rango['minimo'] != -np.inf:
                    print(f"  Mínimo permitido: {rango['minimo']:.6f}")
                else:
                    print(f"  Mínimo permitido: -∞")
                
                if rango['maximo'] != np.inf:
                    print(f"  Máximo permitido: {rango['maximo']:.6f}")
                else:
                    print(f"  Máximo permitido: +∞")

        # Rangos de recursos
        print("\n" + "-" * 70)
        print("RANGO DE RECURSOS (Lado Derecho)")
        print("-" * 70)
        for i in range(self.num_restricciones):
            rango = self.rango_recurso(i)
            if rango:
                print(f"\nRestricción {i + 1}:")
                print(f"  Valor actual: {rango['actual']:.6f}")
                print(f"  Mínimo permitido: {rango['minimo']:.6f}")
                
                if rango['maximo'] != np.inf:
                    print(f"  Máximo permitido: {rango['maximo']:.6f}")
                else:
                    print(f"  Máximo permitido: +∞")

        print("\n" + "=" * 70)
