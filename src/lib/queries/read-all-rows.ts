import { readAllRows as readPaginatedRows } from "@/lib/supabase/pagination";
type Page<T> = { data: T[] | null; error: { message: string } | null; count?: number | null };

/** Count-aware paging also works when the API caps pages below the requested size. */
export async function readAllRows<T>(read: (from: number, to: number) => PromiseLike<Page<T>>): Promise<{ data: T[]; error: { message: string } | null }> {
  try {
    return { data: await readPaginatedRows(read), error: null };
  } catch (error) {
    return { data: [], error: { message: error instanceof Error ? error.message : "No se pudieron consultar los datos." } };
  }
}
