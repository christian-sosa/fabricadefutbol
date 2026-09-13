type PageResult<T> = { data: T[] | null; error: { message: string } | null; count?: number | null };
const PAGE_SIZE = 500;
const ID_BATCH_SIZE = 200;

/** The query must include a stable, unique order (normally id). */
export async function readAllRows<T>(readPage: (from: number, to: number) => PromiseLike<PageResult<T>>): Promise<T[]> {
  const rows: T[] = [];
  while (true) {
    const { data, error, count } = await readPage(rows.length, rows.length + PAGE_SIZE - 1);
    if (error) throw new Error(error.message);
    const page = data ?? [];
    rows.push(...page);
    if (!page.length || (count !== null && count !== undefined ? rows.length >= count : page.length < PAGE_SIZE)) return rows;
  }
}

export async function readRowsByIds<T>(
  ids: string[],
  readPage: (batch: string[], from: number, to: number) => PromiseLike<PageResult<T>>
): Promise<T[]> {
  const uniqueIds = [...new Set(ids)];
  const rows: T[] = [];
  for (let index = 0; index < uniqueIds.length; index += ID_BATCH_SIZE) {
    const batch = uniqueIds.slice(index, index + ID_BATCH_SIZE);
    rows.push(...await readAllRows((from, to) => readPage(batch, from, to)));
  }
  return rows;
}
