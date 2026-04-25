import { Card, CardDescription, CardTitle } from "@/components/ui/card";

export default function AdminTournamentBillingPage() {
  return (
    <div className="space-y-4">
      <Card>
        <CardTitle>Facturación de ligas</CardTitle>
        <CardDescription>
          El alta de nuevas ligas se inicia desde Mercado Pago. Crear competencias dentro de una liga no dispara un nuevo checkout.
        </CardDescription>
      </Card>

      <Card>
        <CardTitle>Estado actual</CardTitle>
        <CardDescription className="mt-1">
          El detalle fino de pagos todavía no tiene pantalla propia en este módulo, pero el checkout ya está activo
          desde el alta de ligas.
        </CardDescription>
      </Card>
    </div>
  );
}
