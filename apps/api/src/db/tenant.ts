import { and, eq } from 'drizzle-orm';
import type { PgColumn, PgTable } from 'drizzle-orm/pg-core';
import type { Database } from './client.js';

/** Tabel milik gereja selalu punya kolom `churchId`. */
type TenantTable = PgTable & { churchId: PgColumn };

type Builder = Record<string, unknown>;

interface Whereable {
  where(condition: unknown): Builder;
}

const isThenable = (value: unknown): value is PromiseLike<unknown> =>
  typeof value === 'object' && value !== null && 'then' in value;

export function isTenantTable(table: unknown): table is TenantTable {
  return typeof table === 'object' && table !== null && 'churchId' in table;
}

/**
 * Membungkus query Drizzle agar `church_id` SELALU ikut tersaring:
 * - `select` tanpa `where` tetap mendapat filter church_id,
 * - `update`/`delete` selalu di-AND dengan church_id,
 * - `insert` selalu menyuntikkan church_id dari sesi (nilai dari klien diabaikan).
 *
 * RLS PostgreSQL menjadi lapisan kedua di database.
 */
function wrapBuilder(
  builder: Builder,
  churchId: string,
  table?: TenantTable,
  options: { filtered?: boolean } = {},
): Builder {
  const state = { table, filtered: options.filtered ?? false };

  const applyFilter = (): Builder => {
    if (!state.filtered && state.table) {
      state.filtered = true;
      return (builder as unknown as Whereable).where(eq(state.table.churchId, churchId));
    }
    return builder;
  };

  return new Proxy(builder, {
    get(target, property, receiver) {
      if (property === 'churchId') {
        return churchId;
      }

      if (property === 'then') {
        if (state.filtered) {
          return (target as unknown as { then: unknown }).then;
        }
        return (
          onFulfilled?: ((value: unknown) => unknown) | null,
          onRejected?: ((reason: unknown) => unknown) | null,
        ) => Promise.resolve(applyFilter()).then(onFulfilled, onRejected);
      }

      if (property === 'execute') {
        if (state.filtered) {
          return (target as unknown as { execute: unknown }).execute;
        }
        return () => (applyFilter() as unknown as { execute(): Promise<unknown> }).execute();
      }

      if (property === 'from') {
        return (fromTable: unknown) => {
          const tenantTable = isTenantTable(fromTable) ? fromTable : undefined;
          const next = (target as unknown as { from(t: unknown): Builder }).from(fromTable);
          return wrapBuilder(next, churchId, tenantTable);
        };
      }

      if (property === 'where') {
        return (condition: unknown) => {
          const next = (target as unknown as Whereable).where(
            state.table
              ? and(eq(state.table.churchId, churchId), condition as never)
              : condition,
          );
          return wrapBuilder(next, churchId, state.table, { filtered: true });
        };
      }

      if (
        property === 'leftJoin' ||
        property === 'innerJoin' ||
        property === 'rightJoin' ||
        property === 'fullJoin'
      ) {
        return (joinTable: unknown, on: unknown) => {
          const condition = isTenantTable(joinTable)
            ? and(eq(joinTable.churchId, churchId), on as never)
            : on;
          const joiner = (
            target as unknown as Record<string, (t: unknown, c: unknown) => Builder>
          )[property as string];
          if (!joiner) {
            return undefined;
          }
          return wrapBuilder(joiner.call(target, joinTable, condition), churchId, state.table, { filtered: state.filtered });
        };
      }

      const value = Reflect.get(target, property, receiver) as unknown;
      if (typeof value !== 'function') {
        return value;
      }

      return (...args: unknown[]) => {
        if (property === 'values' && args[0] !== undefined && args[0] !== null) {
          const withChurch = (item: unknown): unknown =>
            typeof item === 'object' && !Array.isArray(item)
              ? { ...(item as Record<string, unknown>), churchId }
              : item;
          args = [Array.isArray(args[0]) ? args[0].map(withChurch) : withChurch(args[0])];
        }

        if (property === 'set' && args[0] !== undefined && args[0] !== null) {
          const values = { ...(args[0] as Record<string, unknown>) };
          delete values.churchId;
          args = [values];
        }

        const result = value.apply(target, args) as unknown;
        return isThenable(result)
          ? wrapBuilder(result as unknown as Builder, churchId, state.table, { filtered: state.filtered })
          : result;
      };
    },
  });
}

export type TenantDb = Database & { readonly churchId: string };

/**
 * Fasad database untuk satu gereja. Semua akses tabel milik gereja lewat fasad
 * ini; koneksi mentah hanya dipakai lapisan sistem (auth, migrasi, seed).
 */
export function createTenantDb(db: Database, churchId: string): TenantDb {
  const proxy = new Proxy(db as unknown as Builder, {
    get(target, property, receiver) {
      if (property === 'churchId') {
        return churchId;
      }

      const value = Reflect.get(target, property, receiver) as unknown;
      if (typeof value !== 'function') {
        return value;
      }

      return (...args: unknown[]) => {
        if (property === 'transaction') {
          const callback = args[0] as (tx: Database) => Promise<unknown>;
          return value.apply(target, [
            (tx: Database) => callback(createTenantDb(tx, churchId)),
            ...args.slice(1),
          ]);
        }

        const result = value.apply(target, args) as unknown;

        if (
          (property === 'update' || property === 'delete') &&
          isTenantTable(args[0])
        ) {
          return wrapBuilder(result as Builder, churchId, args[0]);
        }

        if (property === 'insert' && isTenantTable(args[0])) {
          // Insert tidak punya `.where`; cukup suntikkan church_id pada values.
          return wrapBuilder(result as Builder, churchId, args[0], { filtered: true });
        }

        if (property === 'select') {
          return wrapBuilder(result as Builder, churchId);
        }

        return result;
      };
    },
  });

  return proxy as unknown as TenantDb;
}
