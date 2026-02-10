"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { useAppStore } from "@/app/lib/store";

export default function ExcelForm({ ext }: { ext: string }) {
  const files = useAppStore((s) => s.files);
  const file = useMemo(
    () => files.find(f => (f.name.split(".").pop()?.toLowerCase() ?? "") === ext) ?? null,
    [files, ext],
  );
  const config = useAppStore((s) => s.configByExt[ext]);
  const setConfigForExt = useAppStore((s) => s.setConfigForExt);

  const excelSheet = config?.excelSheet ?? "";
  const excelSheets = config?.excelSheets ?? [];
  const excelColumn = config?.excelColumn ?? "";
  const excelColumns = config?.excelColumns ?? [];

  const setExcelSheet = useCallback((v: string) => setConfigForExt(ext, { excelSheet: v }), [ext, setConfigForExt]);
  const setExcelSheets = useCallback((v: string[]) => setConfigForExt(ext, { excelSheets: v }), [ext, setConfigForExt]);
  const setExcelColumn = useCallback((v: string) => setConfigForExt(ext, { excelColumn: v }), [ext, setConfigForExt]);
  const setExcelColumns = useCallback((v: string[]) => setConfigForExt(ext, { excelColumns: v }), [ext, setConfigForExt]);
  
  const [loadingSheets, setLoadingSheets] = useState(false);
  const [loadingColumns, setLoadingColumns] = useState(false);

  // 1. Load Sheets on file change
  useEffect(() => {
    async function loadSheets() {
      if (!file) return;
      setLoadingSheets(true);
      try {
        const { getExcelSheets } = await import("@/app/lib/parsers");
        const sheets = await getExcelSheets(file);
        setExcelSheets(sheets);
        
        // Auto-select if only 1 sheet
        if (sheets.length === 1) {
          setExcelSheet(sheets[0]);
        } else if (sheets.length > 0) {
          setExcelSheet(""); // Force user to select
        }
      } catch (err) {
        console.error("Failed to read Excel sheets:", err);
        setExcelSheets([]);
      } finally {
        setLoadingSheets(false);
      }
    }
    loadSheets();
  }, [file, setExcelSheets, setExcelSheet]);

  // 2. Load Columns when sheet changes
  useEffect(() => {
    async function loadColumns() {
      if (!file || !excelSheet) {
        setExcelColumns([]);
        return;
      }
      setLoadingColumns(true);
      try {
        const { getExcelColumns } = await import("@/app/lib/parsers");
        const cols = await getExcelColumns(file, excelSheet);
        setExcelColumns(cols);
        if (cols.length > 0) setExcelColumn(cols[0]);
        else setExcelColumn("");
      } catch (err) {
        console.error("Failed to read columns:", err);
        setExcelColumns([]);
      } finally {
        setLoadingColumns(false);
      }
    }
    loadColumns();
  }, [file, excelSheet, setExcelColumns, setExcelColumn]);

  return (
    <div className="space-y-4">
      {/* Sheet Selector */}
      <div>
        <label className="block text-sm font-medium text-gunmetal mb-1">
          Select Sheet
          {loadingSheets && (
            <span className="ml-2 text-xs text-silver-dark animate-pulse">
              Loading sheets…
            </span>
          )}
        </label>
        <select
          value={excelSheet}
          onChange={(e) => setExcelSheet(e.target.value)}
          disabled={loadingSheets || excelSheets.length === 0}
          className="w-full rounded-lg border border-silver px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-sandy/50 focus:border-sandy outline-none appearance-none disabled:opacity-50"
        >
          <option value="" disabled>
            -- Select a sheet --
          </option>
          {excelSheets.map((sheet) => (
            <option key={sheet} value={sheet}>
              {sheet}
            </option>
          ))}
        </select>
        {!loadingSheets && excelSheets.length === 0 && (
          <p className="mt-1 text-xs text-amber-600">
            No sheets found. Is this a valid spreadsheet?
          </p>
        )}
      </div>

      {/* Column Selector */}
      <div>
        <label className="block text-sm font-medium text-gunmetal mb-1">
          Column to extract
          {loadingColumns && (
            <span className="ml-2 text-xs text-silver-dark animate-pulse">
              Reading columns…
            </span>
          )}
        </label>
        <select
          value={excelColumn}
          onChange={(e) => setExcelColumn(e.target.value)}
          disabled={!excelSheet || excelColumns.length === 0}
          className="w-full rounded-lg border border-silver px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-sandy/50 focus:border-sandy outline-none appearance-none disabled:opacity-50"
        >
          {excelColumns.length === 0 && !loadingColumns ? (
            <option value="" disabled>
               -- No columns found --
            </option>
          ) : null}
          {excelColumns.map((col) => (
            <option key={col} value={col}>
              {col}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
