"use client";

import { useEffect, useState, useCallback } from "react";
import { useAppStore } from "@/app/lib/store";

export default function ExcelForm() {
  const file = useAppStore((s) => s.file);
  const excelColumn = useAppStore((s) => s.excelColumn);
  const excelColumns = useAppStore((s) => s.excelColumns);
  const setExcelColumn = useAppStore((s) => s.setExcelColumn);
  const setExcelColumns = useAppStore((s) => s.setExcelColumns);
  const [loading, setLoading] = useState(false);

  const loadColumns = useCallback(async () => {
    if (!file) return;
    setLoading(true);
    try {
      const { getExcelColumns } = await import("@/app/lib/parsers");
      const cols = await getExcelColumns(file);
      setExcelColumns(cols);
      if (cols.length > 0) setExcelColumn(cols[0]);
    } catch (err) {
      console.error("Failed to read Excel columns:", err);
      setExcelColumns([]);
    } finally {
      setLoading(false);
    }
  }, [file, setExcelColumn, setExcelColumns]);

  useEffect(() => {
    loadColumns();
  }, [loadColumns]);

  return (
    <div>
      <label className="block text-sm font-medium text-gunmetal mb-1">
        Column to extract
        {loading && (
          <span className="ml-2 text-xs text-silver-dark animate-pulse">
            Reading columns…
          </span>
        )}
      </label>
      <select
        value={excelColumn}
        onChange={(e) => setExcelColumn(e.target.value)}
        disabled={excelColumns.length === 0}
        className="w-full rounded-lg border border-silver px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-sandy/50 focus:border-sandy outline-none appearance-none disabled:opacity-50"
      >
        {excelColumns.map((col) => (
          <option key={col} value={col}>
            {col}
          </option>
        ))}
      </select>
      {!loading && excelColumns.length === 0 && (
        <p className="mt-1 text-xs text-amber-600">
          No columns found. Is this a valid spreadsheet?
        </p>
      )}
    </div>
  );
}
