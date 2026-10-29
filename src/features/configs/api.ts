import { invoke } from "@tauri-apps/api/core";

export interface ConfigEntry {
  name: string;
  size: number;
  modified: number;
}

export interface ApplyResult {
  target: string;
  backup_created: boolean;
}

export const BACKUP_NAME = "autoexec (резервная копия).cfg";

export const configsApi = {
  list: () => invoke<ConfigEntry[]>("config_list"),
  import: (path: string) => invoke<ConfigEntry>("config_import", { path }),
  read: (name: string) => invoke<string>("config_read", { name }),
  remove: (name: string) => invoke<void>("config_delete", { name }),
  apply: (name: string, dotaPath: string) => invoke<ApplyResult>("config_apply", { name, dotaPath }),
  active: (dotaPath: string) => invoke<string | null>("config_active", { dotaPath }),
};

export function formatSize(bytes: number): string {
  return bytes < 1024 ? `${bytes} Б` : `${(bytes / 1024).toFixed(1)} КБ`;
}

/** Imports several files, collecting per-file errors instead of stopping at the first. */
export async function importMany(
  paths: string[],
  importOne: (p: string) => Promise<ConfigEntry> = configsApi.import,
): Promise<{ imported: ConfigEntry[]; errors: string[] }> {
  const imported: ConfigEntry[] = [];
  const errors: string[] = [];
  for (const p of paths) {
    try {
      imported.push(await importOne(p));
    } catch (e) {
      errors.push(`${p.split(/[\\/]/).pop()}: ${String(e)}`);
    }
  }
  return { imported, errors };
}
