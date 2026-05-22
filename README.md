# Simplex
# Proyecto: Método Simplex en Python

## Descripción

Este proyecto consiste en desarrollar una aplicación en Python para resolver problemas de Programación Lineal utilizando:

1. Método Simplex Matricial
2. Método Gráfico

La aplicación permitirá al usuario elegir qué método utilizar mediante una interfaz gráfica desarrollada con Tkinter.

---

# Objetivo académico

El método simplex matricial debe implementarse manualmente desde cero con fines académicos.

NO se permite usar librerías que resuelvan automáticamente programación lineal como:

- scipy.optimize.linprog

Sí se permite usar:

- NumPy → manejo matricial
- Matplotlib → gráficas
- Tkinter → interfaz gráfica

---

# Estructura del proyecto

simplex/
│
├── main.py
├── simplex.py
├── graphical.py
├── utils.py
└── gui.py

---

# Responsabilidad de cada archivo

## main.py

Punto de entrada de la aplicación.
Inicializa la interfaz gráfica.

---

## simplex.py

Contiene toda la lógica del método simplex matricial:

- construcción del tableau
- selección de pivotes
- operaciones fila
- iteraciones simplex
- solución óptima

Debe implementarse usando NumPy.

---

## graphical.py

Contiene la lógica del método gráfico:

- graficación de restricciones
- región factible
- intersecciones
- evaluación de vértices

Puede usar Matplotlib y SciPy.

---

## utils.py

Funciones auxiliares reutilizables:

- validaciones
- formateo de matrices
- conversiones
- utilidades algebraicas

---

## gui.py

Interfaz gráfica desarrollada con Tkinter.

Debe:

- recibir datos del usuario
- permitir elegir método
- mostrar resultados
- mostrar iteraciones y gráficas

La GUI NO debe contener lógica matemática.

---

# Requisitos iniciales

Primera versión del simplex matricial:

- Maximización
- Restricciones tipo <=
- Variables de holgura
- Método tableau clásico
- Mostrar iteraciones

---

# Estilo de desarrollo

- Programación orientada a objetos
- Código modular
- Métodos pequeños y reutilizables
- Comentarios claros
- Separación entre GUI y lógica matemática