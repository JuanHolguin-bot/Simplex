#La ejecución 
from simplex import Simplex
from sensitivity_analysis import SensitivityAnalysis


def main():

    """
    Maximizar:

    Z = 5x1 + 4x2

    Sujeto a:

    2x1 + x2 <= 20
    x1 + x2 <= 18
    x1 + 2x2 >= 12
    """

    c = [5, 4]

    A = [
        [2, 1],
        [1, 1],
        [1, 2]
    ]

    b = [20, 18, 12]

    signos = [
        "<=",
        "<=",
        ">="
    ]

    simplex = Simplex(
        c,
        A,
        b,
        signos
    )
    
    # Resolver
    solucion, z = simplex.resolver()

    # Mostrar resultados
    print("\n========== RESULTADO FINAL ==========")

    for i, valor in enumerate(solucion, start=1):
        print(f"x{i} = {valor}")

    print(f"\nValor óptimo Z = {z}")

    # Análisis de sensibilidad
    analisis = SensitivityAnalysis(simplex)
    analisis.mostrar_reporte_sensibilidad()

    



if __name__ == "__main__":
    main()