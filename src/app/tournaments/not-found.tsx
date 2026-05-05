import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";

export default function TournamentsNotFound() {
  return (
    <div className="space-y-4">
      <Card>
        <CardTitle>No encontramos esa pagina</CardTitle>
        <CardDescription className="mt-2">
          Puede que no exista o que ya no este disponible.
        </CardDescription>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link href="/">
            <Button>Ir al inicio</Button>
          </Link>
        </div>
      </Card>
    </div>
  );
}
