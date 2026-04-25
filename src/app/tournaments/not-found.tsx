import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";

export default function TournamentsNotFound() {
  return (
    <div className="space-y-4">
      <Card>
        <CardTitle>No encontramos esa liga o competencia</CardTitle>
        <CardDescription className="mt-2">
          Puede que no exista, que siga en borrador o que ya no este disponible publicamente.
        </CardDescription>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link href="/tournaments">
            <Button>Volver a torneos</Button>
          </Link>
          <Link href="/">
            <Button variant="secondary">Ir al inicio</Button>
          </Link>
        </div>
      </Card>
    </div>
  );
}
