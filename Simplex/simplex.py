"""
Implementación del método simplex con Gran M.

Características:
- Maximización
- Restricciones <=, >= y =
- Variables de holgura
- Variables de exceso
- Variables artificiales
- Método Gran M
- Tableau clásico

"""

import numpy as np


class Simplex:

    def __init__(self, c, A, b, signos, M=1e6):

        self.c = np.array(c, dtype=float)
        self.A = np.array(A, dtype=float)
        self.b = np.array(b, dtype=float)
        self.signos = signos

        self.M = M

        self.num_variables = len(c)
        self.num_restricciones = len(b)

        self.tableau = None

        # Guardar qué columnas son artificiales
        self.columnas_artificiales = []

        # Variables básicas
        self.variables_basicas = []

        # Metadatos de variables
        self.nombres_variables = []
        self.tipos_variables = []

        # Historial
        self.iteraciones = []

        # Construir tableau
        self.crear_tableau()

    # =========================================================
    # CREAR TABLEAU CON GRAN M
    # =========================================================

    def crear_tableau(self):

        filas = []

        num_holgura = 0
        num_artificial = 0

        # -----------------------------------------------------
        # Contar cuántas columnas extra necesitaremos
        # -----------------------------------------------------

        for signo in self.signos:

            if signo == "<=":
                num_holgura += 1

            elif signo == ">=":
                num_holgura += 1
                num_artificial += 1

            elif signo == "=":
                num_artificial += 1

        total_columnas = (
            self.num_variables
            + num_holgura
            + num_artificial
        )

        self.total_columnas = total_columnas

        # -----------------------------------------------------
        # Construir restricciones
        # -----------------------------------------------------

        holgura_actual = 0
        artificial_actual = 0

        for i in range(self.num_restricciones):

            fila = np.zeros(total_columnas)

            # Variables originales
            fila[:self.num_variables] = self.A[i]

            signo = self.signos[i]

            # =================================================
            # Restricción <=
            # =================================================

            if signo == "<=":

                columna_holgura = (
                    self.num_variables
                    + holgura_actual
                )

                fila[columna_holgura] = 1

                self.variables_basicas.append(
                    columna_holgura
                )

                holgura_actual += 1

            # =================================================
            # Restricción >=
            # =================================================

            elif signo == ">=":

                # Variable de exceso (-1)
                columna_exceso = (
                    self.num_variables
                    + holgura_actual
                )

                fila[columna_exceso] = -1

                holgura_actual += 1

                # Variable artificial (+1)
                columna_artificial = (
                    self.num_variables
                    + num_holgura
                    + artificial_actual
                )

                fila[columna_artificial] = 1

                self.columnas_artificiales.append(
                    columna_artificial
                )

                self.variables_basicas.append(
                    columna_artificial
                )

                artificial_actual += 1

            # =================================================
            # Restricción =
            # =================================================

            elif signo == "=":

                columna_artificial = (
                    self.num_variables
                    + num_holgura
                    + artificial_actual
                )

                fila[columna_artificial] = 1

                self.columnas_artificiales.append(
                    columna_artificial
                )

                self.variables_basicas.append(
                    columna_artificial
                )

                artificial_actual += 1

            filas.append(fila)

        # -----------------------------------------------------
        # Convertir a matriz
        # -----------------------------------------------------

        restricciones = np.array(filas)

        # Agregar columna b
        restricciones = np.hstack(
            (restricciones, self.b.reshape(-1, 1))
        )

        self.restricciones = restricciones

        # Llenar metadatos de variables
        self._crear_metadatos_variables()

        # =====================================================
        # Tableau de fase 1 y fase 2
        # =====================================================

        self.tableau = np.vstack(
            (restricciones, self.crear_fila_z_fase1())
        )

    def crear_fila_z_original(self):

        fila_z = np.zeros(self.total_columnas + 1)
        fila_z[:self.num_variables] = -self.c
        return fila_z

    def crear_fila_z_fase1(self):

        fila_w = np.zeros(self.total_columnas + 1)

        for col in self.columnas_artificiales:
            fila_w[col] = 1

        for i, variable_basica in enumerate(self.variables_basicas):
            if variable_basica in self.columnas_artificiales:
                fila_w -= self.restricciones[i]

        return fila_w

    # =========================================================
    # CREAR METADATOS DE VARIABLES
    # =========================================================

    def _crear_metadatos_variables(self):

        self.nombres_variables = []
        self.tipos_variables = []

        # Variables originales
        for i in range(self.num_variables):
            self.nombres_variables.append(f"x{i + 1}")
            self.tipos_variables.append("original")

        # Contadores para holgura, exceso y artificial
        contador_holgura = 1
        contador_exceso = 1
        contador_artificial = 1

        for i, signo in enumerate(self.signos):

            if signo == "<=":
                self.nombres_variables.append(f"s{contador_holgura}")
                self.tipos_variables.append("holgura")
                contador_holgura += 1

            elif signo == ">=":
                self.nombres_variables.append(f"e{contador_exceso}")
                self.tipos_variables.append("exceso")
                contador_exceso += 1

                self.nombres_variables.append(f"a{contador_artificial}")
                self.tipos_variables.append("artificial")
                contador_artificial += 1

            elif signo == "=":
                self.nombres_variables.append(f"a{contador_artificial}")
                self.tipos_variables.append("artificial")
                contador_artificial += 1

    # =========================================================
    # MOSTRAR TABLEAU
    # =========================================================

    def mostrar_tableau(self):

        print("\nTABLEAU:")
        print(np.round(self.tableau, 3))

    # =========================================================
    # VERIFICAR ÓPTIMO
    # =========================================================

    def es_optimo(self):

        fila_z = self.tableau[-1, :-1]

        return np.all(fila_z >= 0)

    # =========================================================
    # COLUMNA PIVOTE
    # =========================================================

    def obtener_columna_pivote(self):

        fila_z = self.tableau[-1, :-1]

        mejor_columna = None
        valor_mas_negativo = 0

        for j in range(len(fila_z)):

            valor = fila_z[j]

            if valor < valor_mas_negativo:

                columna = self.tableau[:-1, j]

                # Verificar si existe al menos
                # un positivo en la columna
                if np.any(columna > 0):

                    valor_mas_negativo = valor
                    mejor_columna = j

        return mejor_columna

    # =========================================================
    # FILA PIVOTE
    # =========================================================

    def obtener_fila_pivote(self, columna_pivote):

        columna = self.tableau[:-1, columna_pivote]
        b = self.tableau[:-1, -1]

        razones = []

        for i in range(len(columna)):

            if columna[i] > 0:
                razones.append(
                    b[i] / columna[i]
                )
            else:
                razones.append(np.inf)

        if all(r == np.inf for r in razones):

            raise Exception(
                "El problema tiene solución ilimitada."
            )

        return np.argmin(razones)

    # =========================================================
    # PIVOTEAR
    # =========================================================

    def pivotear(self, fila_pivote, columna_pivote):

        pivote = self.tableau[
            fila_pivote,
            columna_pivote
        ]

        # Hacer pivote = 1
        self.tableau[fila_pivote] /= pivote

        # Hacer ceros
        for i in range(len(self.tableau)):

            if i != fila_pivote:

                factor = self.tableau[
                    i,
                    columna_pivote
                ]

                self.tableau[i] -= (
                    factor
                    * self.tableau[fila_pivote]
                )

        # Actualizar variable básica
        self.variables_basicas[
            fila_pivote
        ] = columna_pivote

    # =========================================================
    # GUARDAR ITERACIÓN
    # =========================================================

    def guardar_iteracion(self):

        self.iteraciones.append(
            np.copy(self.tableau)
        )

    # =========================================================
    # RESOLVER
    # =========================================================

    def resolver(self):

        # -----------------------------------------------------
        # Fase 1: encontrar solución factible
        # -----------------------------------------------------

        self.tableau = np.vstack(
            (self.restricciones, self.crear_fila_z_fase1())
        )

        iteracion = 1

        self.guardar_iteracion()

        while not self.es_optimo():

            print(f"\n========== FASE 1 - ITERACIÓN {iteracion} ==========")

            self.mostrar_tableau()

            columna_pivote = self.obtener_columna_pivote()
            if columna_pivote is None:
                break

            fila_pivote = self.obtener_fila_pivote(
                columna_pivote
            )

            print(f"Columna pivote: {columna_pivote}")
            print(f"Fila pivote: {fila_pivote}")

            self.pivotear(fila_pivote, columna_pivote)
            self.guardar_iteracion()
            iteracion += 1

        if self.tableau[-1, -1] < -1e-6:
            raise Exception(
                "El problema es infactible."
            )

        # -----------------------------------------------------
        # Fase 2: optimizar la función original
        # -----------------------------------------------------

        self.tableau[-1, :] = self.crear_fila_z_original()

        for i, variable_basica in enumerate(self.variables_basicas):
            if variable_basica < self.num_variables:
                self.tableau[-1, :] -= (
                    self.c[variable_basica]
                    * self.tableau[i, :]
                )

        iteracion = 1

        while not self.es_optimo():

            print(f"\n========== FASE 2 - ITERACIÓN {iteracion} ==========")

            self.mostrar_tableau()

            columna_pivote = self.obtener_columna_pivote()
            if columna_pivote is None:
                break

            fila_pivote = self.obtener_fila_pivote(
                columna_pivote
            )

            print(f"Columna pivote: {columna_pivote}")
            print(f"Fila pivote: {fila_pivote}")

            self.pivotear(fila_pivote, columna_pivote)
            self.guardar_iteracion()
            iteracion += 1

        print("\n========== SOLUCIÓN ÓPTIMA ==========")

        self.mostrar_tableau()

        return self.obtener_solucion()

    # =========================================================
    # OBTENER SOLUCIÓN
    # =========================================================

    def obtener_solucion(self):

        solucion = np.zeros(
            self.num_variables
        )

        for j in range(self.num_variables):

            columna = self.tableau[:, j]

            if (
                np.count_nonzero(columna[:-1]) == 1
                and np.sum(columna[:-1]) == 1
            ):

                fila = np.where(
                    columna[:-1] == 1
                )[0][0]

                solucion[j] = (
                    self.tableau[fila, -1]
                )

        valor_z = self.tableau[-1, -1]

        return solucion, valor_z