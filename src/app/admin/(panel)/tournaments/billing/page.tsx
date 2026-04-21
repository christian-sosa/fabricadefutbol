import { Card, CardDescription, CardTitle } from "@/components/ui/card";

export default function AdminTournamentBillingPage() {
  return (
    <div className="space-y-4">
      <Card>
        <CardTitle>Facturacion de torneos</CardTitle>
        <CardDescription>
          Este subpanel queda separado del billing de organizaciones para evitar mezclar productos y permisos.
        </CardDescription>
      </Card>

      <Card>
        <CardTitle>Proximo paso</CardTitle>
        <CardDescription className="mt-1">
          La estructura de navegacion ya quedo preparada para que `Torneos` tenga su propio billing, planes y estado de acceso.
          En esta version todavia no conectamos cobros ni suscripciones del modulo torneo.
        </CardDescription>
      </Card>
    </div>
  );
}
