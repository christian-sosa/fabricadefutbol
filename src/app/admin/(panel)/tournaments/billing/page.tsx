import { Card, CardDescription, CardTitle } from "@/components/ui/card";

export default function AdminTournamentBillingPage() {
  return (
    <div className="space-y-4">
      <Card>
        <CardTitle>Facturacion de torneos</CardTitle>
        <CardDescription>
          El alta de nuevos torneos vuelve a iniciarse desde Mercado Pago antes de habilitar la competencia.
        </CardDescription>
      </Card>

      <Card>
        <CardTitle>Estado actual</CardTitle>
        <CardDescription className="mt-1">
          El detalle fino de pagos todavia no tiene pantalla propia en este modulo, pero el checkout ya esta activo
          desde el alta de torneos.
        </CardDescription>
      </Card>
    </div>
  );
}
