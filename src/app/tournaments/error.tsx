"use client";

import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";

export default function TournamentsError({
  error: _error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  void _error;

  return (
    <div className="space-y-4">
      <Card>
        <CardTitle>No pudimos cargar esta seccion</CardTitle>
        <CardDescription className="mt-2">
          Hubo un problema al traer la informacion publica. Puedes reintentar o volver al listado de ligas.
        </CardDescription>
        <div className="mt-4 flex flex-wrap gap-3">
          <Button onClick={reset} type="button">
            Reintentar
          </Button>
          <Link href="/tournaments">
            <Button variant="secondary">Volver a torneos</Button>
          </Link>
        </div>
      </Card>
    </div>
  );
}
