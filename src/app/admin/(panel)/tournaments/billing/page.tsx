import { Card, CardDescription, CardTitle } from "@/components/ui/card";

export default function AdminTournamentBillingPage() {
  return (
    <div className="space-y-4">
      <Card>
        <CardTitle>Torneos gratis por ahora</CardTitle>
        <CardDescription>
          Hoy no estamos cobrando el modulo Torneos y no hay checkout activo para esta parte del producto.
        </CardDescription>
      </Card>

      <Card>
        <CardTitle>Estado actual</CardTitle>
        <CardDescription className="mt-1">
          Puedes crear y administrar torneos sin pagar. Cuando definamos el esquema comercial, lo volveremos a
          conectar desde una iteracion separada.
        </CardDescription>
      </Card>
    </div>
  );
}
