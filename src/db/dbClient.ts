export interface DbClient {
  select<T>(sql: string, params?: unknown[]): Promise<T>;
  execute(
    sql: string,
    params?: unknown[]
  ): Promise<{ rowsAffected: number }>;
}
