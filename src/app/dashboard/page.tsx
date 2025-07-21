"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/utils/supabaseClient";
import { Sidebar, SidebarProvider, SidebarHeader, SidebarContent } from "@/components/ui/sidebar";
import type { User } from "@supabase/auth-js";
import Papa from "papaparse";
import type { ParseResult, ParseError, ParseLocalConfig } from "papaparse";
import { useReactTable, getCoreRowModel, flexRender, ColumnDef } from "@tanstack/react-table";
import { useRef } from "react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { LogOut, ChevronDown, UserCircle2, Settings, BarChart2, Search, Scissors, Copy, ClipboardPaste, Trash2, Edit, Plus, Rows, Columns } from "lucide-react";
import { nanoid } from 'nanoid';

export default function DashboardPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [csvError, setCsvError] = useState("");
  const [csvData, setCsvData] = useState<any[][] | null>(null);
  const [tableData, setTableData] = useState<any[][]>([]);
  // Refactor columns state to { id, name }[]
  const [columns, setColumns] = useState<{ id: string, name: string }[]>([]);
  const [renamingCol, setRenamingCol] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [renameError, setRenameError] = useState('');
  const [activeCell, setActiveCell] = useState<{ row: number; col: number } | null>(null);
  const inputRefs = useRef<(HTMLInputElement | null)[][]>([]);
  // Update columnHistory to store { columns: { id, name }[], tableData: any[][] }
  const [columnHistory, setColumnHistory] = useState<{ columns: { id: string, name: string }[]; tableData: any[][] }[]>([]);
  const [showConfirm, setShowConfirm] = useState<{ colIdx: number; colName: string } | null>(null);
  const [showAddCol, setShowAddCol] = useState(false);
  const [newColName, setNewColName] = useState("");
  const [colWidths, setColWidths] = useState<number[]>([]);
  const [resizingCol, setResizingCol] = useState<{ idx: number; startX: number; startWidth: number } | null>(null);
  const [dragCol, setDragCol] = useState<number | null>(null);
  const [dragOverCol, setDragOverCol] = useState<number | null>(null);
  const [colMenu, setColMenu] = useState<null | { idx: number; x: number; y: number }>(null);
  const [renameCol, setRenameCol] = useState("");
  const [resizeVal, setResizeVal] = useState<number | null>(null);
  const [addColPos, setAddColPos] = useState<"before" | "after">("after");
  const [addColName, setAddColName] = useState("");
  const [csvFiles, setCsvFiles] = useState<any[]>([]);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [showSave, setShowSave] = useState(false);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [page, setPage] = useState(0);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [tableSize, setTableSize] = useState<'sm' | 'md' | 'lg'>('md');
  const [contextMenu, setContextMenu] = useState<null | { x: number; y: number; type: 'cell' | 'row' | 'col'; rowIdx?: number; colIdx?: number }>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [darkMode, setDarkMode] = useState(false);

  function increaseTableSize() {
    setTableSize(size => (size === 'sm' ? 'md' : size === 'md' ? 'lg' : 'lg'));
  }
  function decreaseTableSize() {
    setTableSize(size => (size === 'lg' ? 'md' : size === 'md' ? 'sm' : 'sm'));
  }

  // CSV upload handler
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCsvError("");
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setCsvError("File size exceeds 5MB limit.");
      return;
    }
    Papa.parse(file, {
      complete: (results: ParseResult<any[]>) => {
        const data = results.data as any[][];
        if (!Array.isArray(data) || data.length === 0) {
          setCsvError("No data found in CSV.");
          return;
        }
        if (data[0].length > 15) {
          setCsvError("CSV has more than 15 columns.");
          return;
        }
        if (data.length > 5000) {
          setCsvError("CSV has more than 5000 rows.");
          return;
        }
        setCsvData(data);
      },
      error: (error: Error, _file: File) => {
        setCsvError("Error parsing CSV: " + error.message);
      },
      skipEmptyLines: true,
      dynamicTyping: true,
    } as ParseLocalConfig<any[], File>);
  };

  function handleUploadClick() {
    fileInputRef.current?.click();
  }

  // When CSV is loaded, initialize columns as { id, name }
  useEffect(() => {
    if (csvData) {
      setColumns(csvData[0].map((name: string) => ({ id: nanoid(), name })));
      setTableData(csvData.slice(1));
    } else {
      setColumns([]);
      setTableData([]);
    }
  }, [csvData]);

  // Update colWidths when columns change
  useEffect(() => {
    setColWidths(columns.map(() => 150)); // default width
  }, [columns.length]);

  // Handle column resizing
  function handleResizeStart(e: React.MouseEvent, idx: number) {
    setResizingCol({ idx, startX: e.clientX, startWidth: colWidths[idx] });
  }
  function handleResize(e: MouseEvent) {
    if (!resizingCol) return;
    const delta = e.clientX - resizingCol.startX;
    setColWidths(widths => widths.map((w, i) => i === resizingCol.idx ? Math.max(60, resizingCol.startWidth + delta) : w));
  }
  function handleResizeEnd() {
    setResizingCol(null);
  }
  useEffect(() => {
    if (resizingCol) {
      window.addEventListener("mousemove", handleResize);
      window.addEventListener("mouseup", handleResizeEnd);
      return () => {
        window.removeEventListener("mousemove", handleResize);
        window.removeEventListener("mouseup", handleResizeEnd);
      };
    }
  }, [resizingCol]);

  // Handle column drag and drop (reorder)
  function handleDragStart(idx: number) {
    setDragCol(idx);
  }
  function handleDragOver(idx: number) {
    setDragOverCol(idx);
  }
  function handleDrop(idx: number) {
    if (dragCol === null || dragCol === idx) return;
    const newColumns = [...columns];
    const [movedCol] = newColumns.splice(dragCol, 1);
    newColumns.splice(idx, 0, movedCol);
    setColumns(newColumns);
    // Move data for each row
    setTableData(prev => prev.map(row => {
      const newRow = [...row];
      const [movedCell] = newRow.splice(dragCol, 1);
      newRow.splice(idx, 0, movedCell);
      return newRow;
    }));
    // Move colWidths
    setColWidths(prev => {
      const arr = [...prev];
      const [movedW] = arr.splice(dragCol, 1);
      arr.splice(idx, 0, movedW);
      return arr;
    });
    setDragCol(null);
    setDragOverCol(null);
  }
  function handleDragEnd() {
    setDragCol(null);
    setDragOverCol(null);
  }

  // Open context menu
  function openColMenu(e: React.MouseEvent, idx: number) {
    e.preventDefault();
    setColMenu({ idx, x: e.clientX, y: e.clientY });
    setRenameCol(columns[idx]);
    setResizeVal(colWidths[idx]);
    setAddColName("");
    setAddColPos("after");
  }
  // Close menu on click outside
  useEffect(() => {
    if (!colMenu) return;
    function close() { setColMenu(null); }
    window.addEventListener("mousedown", close);
    return () => window.removeEventListener("mousedown", close);
  }, [colMenu]);

  // Rename column
  function handleRenameCol() {
    setColumns(cols => cols.map((c, i) => i === colMenu!.idx ? renameCol : c));
    setColMenu(null);
  }
  // Resize column
  function handleResizeCol() {
    setColWidths(ws => ws.map((w, i) => i === colMenu!.idx && resizeVal ? resizeVal : w));
    setColMenu(null);
  }
  // Move column
  function handleMoveColMenu(dir: "left" | "right") {
    const idx = colMenu!.idx;
    const target = dir === "left" ? idx - 1 : idx + 1;
    if (target < 0 || target >= columns.length) return;
    // Move column
    const newColumns = [...columns];
    const [movedCol] = newColumns.splice(idx, 1);
    newColumns.splice(target, 0, movedCol);
    setColumns(newColumns);
    // Move data for each row
    setTableData(prev => prev.map(row => {
      const newRow = [...row];
      const [movedCell] = newRow.splice(idx, 1);
      newRow.splice(target, 0, movedCell);
      return newRow;
    }));
    // Move colWidths
    setColWidths(prev => {
      const arr = [...prev];
      const [movedW] = arr.splice(idx, 1);
      arr.splice(target, 0, movedW);
      return arr;
    });
    setColMenu(null);
  }
  // Delete column (from menu)
  function handleDeleteColMenu() {
    handleDeleteColumn(colMenu!.idx);
    setColMenu(null);
  }
  // Add column (from menu)
  function handleAddColMenu() {
    if (!addColName.trim()) return;
    const idx = colMenu!.idx + (addColPos === "after" ? 1 : 0);
    setColumns(prev => {
      const arr = [...prev];
      arr.splice(idx, 0, { id: nanoid(), name: addColName.trim() });
      return arr;
    });
    setTableData(prev => prev.map(row => {
      const arr = [...row];
      arr.splice(idx, 0, "");
      return arr;
    }));
    setColWidths(prev => {
      const arr = [...prev];
      arr.splice(idx, 0, 150);
      return arr;
    });
    setColMenu(null);
  }

  // Table columns for react-table
  const tableColumns: ColumnDef<any, any>[] = columns.map((col, colIdx) => ({
    header: col.name,
    accessorFn: (row: any[]) => row[colIdx],
    cell: ({ row, getValue }) => {
      const rowIdx = row.index;
      const value = getValue();
      return activeCell && activeCell.row === rowIdx && activeCell.col === colIdx ? (
        <input
          ref={el => {
            inputRefs.current[rowIdx] = inputRefs.current[rowIdx] || [];
            inputRefs.current[rowIdx][colIdx] = el;
          }}
          className="border px-1 py-0.5 w-full text-xs"
          value={value ?? ""}
          autoFocus
          onChange={e => handleCellChange(rowIdx, colIdx, e.target.value)}
          onBlur={() => setActiveCell(null)}
          onKeyDown={e => handleCellKeyDown(e, rowIdx, colIdx)}
        />
      ) : (
        <div
          className="min-h-[24px] px-1 cursor-pointer"
          onClick={() => setActiveCell({ row: rowIdx, col: colIdx })}
        >
          {value ?? ""}
        </div>
      );
    },
  }));

  // Table instance
  const table = useReactTable({
    data: tableData,
    columns: tableColumns,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
  });

  // Cell change handler
  function handleCellChange(rowIdx: number, colIdx: number, value: string) {
    setTableData(prev => {
      const next = prev.map(row => [...row]);
      next[rowIdx][colIdx] = value;
      return next;
    });
  }

  // Keyboard navigation for cell editing
  function handleCellKeyDown(e: React.KeyboardEvent<HTMLInputElement>, rowIdx: number, colIdx: number) {
    if (e.key === "Enter" || e.key === "Tab") {
      e.preventDefault();
      // Move to next cell
      let nextRow = rowIdx;
      let nextCol = colIdx + 1;
      if (nextCol >= columns.length) {
        nextCol = 0;
        nextRow++;
      }
      if (nextRow < tableData.length) {
        setActiveCell({ row: nextRow, col: nextCol });
        setTimeout(() => inputRefs.current[nextRow]?.[nextCol]?.focus(), 0);
      } else {
        setActiveCell(null);
      }
    } else if (e.key === "Escape") {
      setActiveCell(null);
    }
    // (Arrow key navigation can be added in next step)
  }

  // Add row
  function handleAddRow() {
    setTableData(prev => [...prev, Array(columns.length).fill("")]);
  }

  // Delete row
  function handleDeleteRow(rowIdx: number) {
    setTableData(prev => prev.filter((_, i) => i !== rowIdx));
  }

  // Delete column
  function handleDeleteColumn(colIdx: number) {
    setColumnHistory(prev => [...prev, { columns, tableData }]);
    setColumns(prev => prev.filter((_, i) => i !== colIdx));
    setTableData(prev => prev.map(row => row.filter((_, i) => i !== colIdx)));
    setShowConfirm(null);
  }

  // Undo column delete
  function handleUndo() {
    setColumnHistory(prev => {
      if (prev.length === 0) return prev;
      const last = prev[prev.length - 1];
      setColumns(last.columns);
      setTableData(last.tableData);
      return prev.slice(0, -1);
    });
  }

  // Add column
  function handleAddColumn() {
    if (!newColName.trim()) return;
    setColumns(prev => [...prev, { id: nanoid(), name: newColName.trim() }]);
    setTableData(prev => prev.map(row => [...row, ""]));
    setShowAddCol(false);
    setNewColName("");
  }

  // Export as CSV
  function handleExportCSV() {
    if (columns.length === 0 || tableData.length === 0) return;
    const csv = Papa.unparse([columns.map(c => c.name), ...tableData]);
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "table.csv";
    a.click();
    URL.revokeObjectURL(url);
  }
  // Export as PDF
  function handleExportPDF() {
    if (columns.length === 0 || tableData.length === 0) return;
    const doc = new jsPDF();
    autoTable(doc, {
      head: [columns.map(c => c.name)],
      body: tableData,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [41, 128, 185] },
    });
    doc.save("table.pdf");
  }

  // Fetch previous CSVs for the user
  useEffect(() => {
    if (!user) return;
    setLoadingFiles(true);
    supabase
      .from("user_csv_files")
      .select("id, name, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .then(({ data, error }) => {
        setCsvFiles(data || []);
        setLoadingFiles(false);
      });
  }, [user, showSave]);

  // Save current CSV to Supabase
  async function handleSave() {
    if (!user || !saveName.trim() || columns.length === 0) return;
    await supabase.from("user_csv_files").insert({
      user_id: user.id,
      name: saveName.trim(),
      data: { columns, tableData },
    });
    setShowSave(false);
    setSaveName("");
  }
  // Load a previous CSV
  async function handleLoadCsv(id: string) {
    const { data, error } = await supabase.from("user_csv_files").select("data").eq("id", id).single();
    if (data && data.data) {
      setColumns(data.data.columns);
      setTableData(data.data.tableData);
    }
  }

  // Paginated table data
  const paginatedData = tableData.slice(page * rowsPerPage, (page + 1) * rowsPerPage);
  const totalPages = Math.ceil(tableData.length / rowsPerPage);

  // Log out handler
  async function handleLogout() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  useEffect(() => {
    // Initial check
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) {
        router.replace("/login");
      } else {
        setUser(user);
      }
      setLoading(false);
    });
    // Listen for session changes
    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (!session || !session.user) {
        setUser(null);
        router.replace("/login");
      } else {
        setUser(session.user);
      }
    });
    return () => {
      listener?.subscription?.unsubscribe?.();
    };
  }, [router]);

  function handleTableContextMenu(e: React.MouseEvent, type: 'cell' | 'row' | 'col', rowIdx?: number, colIdx?: number) {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, type, rowIdx, colIdx });
  }
  useEffect(() => {
    if (!contextMenu) return;
    function close() { setContextMenu(null); }
    window.addEventListener("mousedown", close);
    return () => window.removeEventListener("mousedown", close);
  }, [contextMenu]);

  // Clipboard helpers
  const clipboardRef = useRef<{ type: 'cell' | 'row' | 'col'; data: any } | null>(null);

  async function handleMenuAction(action: string) {
    if (!contextMenu) return;
    const { type, rowIdx, colIdx } = contextMenu;
    if (type === 'col' && typeof colIdx === 'number') {
      if (action === 'cut' || action === 'copy') {
        // Copy column data
        const colData = tableData.map(row => row[colIdx]);
        clipboardRef.current = { type: 'col', data: colData };
        await navigator.clipboard.writeText(JSON.stringify(colData));
        if (action === 'cut') {
          // Remove column
          setColumns(cols => cols.filter((_, i) => i !== colIdx));
          setTableData(rows => rows.map(row => row.filter((_, i) => i !== colIdx)));
        }
      } else if (action === 'paste' && clipboardRef.current?.type === 'col') {
        // Paste column data
        const colData = clipboardRef.current.data;
        setTableData(rows => rows.map((row, i) => {
          const newRow = [...row];
          newRow[colIdx] = colData[i] ?? '';
          return newRow;
        }));
      } else if (action === 'edit' || action === 'rename') {
        console.log('[DEBUG] Rename handler called:', { colIdx, columns });
        const newName = window.prompt('Rename column:', columns[colIdx].name);
        console.log('[DEBUG] Prompt result:', newName);
        if (newName) {
          setColumns(cols => {
            console.log('[DEBUG] setColumns called:', { prev: cols, colIdx, newName });
            return cols.map((c, i) => i === colIdx ? { ...c, name: newName } : c);
          });
        }
      } else if (action === 'resize') {
        const newWidth = window.prompt('Set column width (px):', String(colWidths[colIdx]));
        if (newWidth && !isNaN(Number(newWidth))) setColWidths(ws => ws.map((w, i) => i === colIdx ? Math.max(60, Number(newWidth)) : w));
      } else if (action === 'move-left') {
        if (colIdx > 0) handleDrop(colIdx - 1);
      } else if (action === 'move-right') {
        if (colIdx < columns.length - 1) handleDrop(colIdx + 1);
      } else if (action === 'delete') {
        setColumns(cols => cols.filter((_, i) => i !== colIdx));
        setTableData(rows => rows.map(row => row.filter((_, i) => i !== colIdx)));
      } else if (action === 'add-col') {
        const newName = window.prompt('New column name:');
        if (newName) {
          setColumns(cols => {
            const arr = [...cols];
            arr.splice(colIdx + 1, 0, { id: nanoid(), name: newName });
            return arr;
          });
          setTableData(rows => rows.map(row => {
            const arr = [...row];
            arr.splice(colIdx + 1, 0, '');
            return arr;
          }));
          setColWidths(ws => {
            const arr = [...ws];
            arr.splice(colIdx + 1, 0, 150);
            return arr;
          });
        }
      }
    } else if (type === 'row' && typeof rowIdx === 'number') {
      if (action === 'cut' || action === 'copy') {
        // Copy row data
        const rowData = tableData[rowIdx];
        clipboardRef.current = { type: 'row', data: rowData };
        await navigator.clipboard.writeText(JSON.stringify(rowData));
        if (action === 'cut') {
          setTableData(rows => rows.filter((_, i) => i !== rowIdx));
        }
      } else if (action === 'paste' && clipboardRef.current?.type === 'row') {
        // Paste row data
        setTableData(rows => rows.map((row, i) => i === rowIdx ? clipboardRef.current!.data : row));
      } else if (action === 'edit') {
        // Focus first cell in row
        setActiveCell({ row: rowIdx, col: 0 });
      } else if (action === 'delete') {
        setTableData(rows => rows.filter((_, i) => i !== rowIdx));
      } else if (action === 'add-row') {
        setTableData(rows => {
          const arr = [...rows];
          arr.splice(rowIdx + 1, 0, Array(columns.length).fill(''));
          return arr;
        });
      }
    } else if (type === 'cell' && typeof rowIdx === 'number' && typeof colIdx === 'number') {
      if (action === 'cut' || action === 'copy') {
        // Copy cell value
        const value = tableData[rowIdx][colIdx];
        clipboardRef.current = { type: 'cell', data: value };
        await navigator.clipboard.writeText(String(value ?? ''));
        if (action === 'cut') {
          setTableData(rows => rows.map((row, i) => i === rowIdx ? row.map((v, j) => j === colIdx ? '' : v) : row));
        }
      } else if (action === 'paste' && clipboardRef.current?.type === 'cell') {
        setTableData(rows => rows.map((row, i) => i === rowIdx ? row.map((v, j) => j === colIdx ? clipboardRef.current!.data : v) : row));
      } else if (action === 'edit') {
        setActiveCell({ row: rowIdx, col: colIdx });
      } else if (action === 'delete') {
        setTableData(rows => rows.map((row, i) => i === rowIdx ? row.map((v, j) => j === colIdx ? '' : v) : row));
      }
    }
    setContextMenu(null);
  }

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }
  if (!user) {
    return null; // Redirecting
  }

  const tableFont = tableSize === 'sm' ? 'text-xs' : tableSize === 'md' ? 'text-sm' : 'text-base';
  const rowHeight = tableSize === 'sm' ? 'h-7' : tableSize === 'md' ? 'h-9' : 'h-12';

  return (
    <SidebarProvider>
      <div className="flex flex-col min-h-screen w-full bg-background text-foreground">
        {/* Header */}
        <header className="sticky top-0 z-30 w-full bg-card border-b border-border shadow flex items-center px-6 h-16 gap-4">
          <div className="flex items-center gap-2 text-2xl font-bold text-primary">
            Dashboard
          </div>
          <button
            className="ml-6 px-3 py-1.5 bg-primary text-primary-foreground rounded font-semibold text-sm shadow hover:bg-primary/90 transition"
            onClick={handleUploadClick}
            type="button"
          >
            Upload CSV
          </button>
          <div className="relative group ml-4">
            <button className="flex items-center gap-1 px-3 py-1.5 rounded bg-muted text-foreground font-medium text-sm">
              Files <ChevronDown className="w-4 h-4" />
            </button>
            {/* Dropdown: previous CSVs */}
            <div className="absolute left-0 mt-2 w-56 bg-card border border-border rounded shadow-lg z-40 hidden group-hover:block">
              <div className="p-2 font-semibold text-xs text-muted-foreground">Previous CSVs</div>
              {csvFiles.length === 0 ? (
                <div className="px-4 py-2 text-xs text-muted-foreground">No previous CSVs</div>
              ) : (
                <ul className="max-h-48 overflow-y-auto">
                  {csvFiles.map(f => (
                    <li key={f.id} className="px-4 py-2 text-xs hover:bg-primary/10 cursor-pointer" onClick={() => handleLoadCsv(f.id)}>
                      {f.name}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
          <div className="relative group ml-2">
            <button className="flex items-center gap-1 px-3 py-1.5 rounded bg-muted text-foreground font-medium text-sm">
              Templates <ChevronDown className="w-4 h-4" />
            </button>
            {/* Dropdown: placeholder */}
            <div className="absolute left-0 mt-2 w-40 bg-card border border-border rounded shadow-lg z-40 hidden group-hover:block">
              <div className="px-4 py-2 text-xs text-muted-foreground">No templates yet</div>
            </div>
          </div>
          <div className="flex items-center ml-4 flex-1 max-w-md">
            <div className="relative w-full">
              <input
                type="text"
                placeholder="Search..."
                className="w-full pl-9 pr-3 py-1.5 rounded border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            </div>
          </div>
          <div className="flex items-center gap-2 ml-auto">
            <button className="p-2 rounded-full hover:bg-muted" title="Settings" onClick={() => setShowSettings(true)}><Settings className="w-5 h-5" /></button>
            <button className="p-2 rounded-full hover:bg-muted" title="Stats" onClick={() => setShowStats(true)}><BarChart2 className="w-5 h-5" /></button>
            {/* Profile dropdown */}
            <div className="relative group">
              <button className="flex items-center gap-1 px-3 py-1.5 rounded bg-muted text-foreground font-medium text-sm">
                <UserCircle2 className="w-5 h-5 mr-1" /> Profile <ChevronDown className="w-4 h-4" />
              </button>
              <div className="absolute right-0 mt-2 w-48 bg-card border border-border rounded shadow-lg z-40 hidden group-hover:block">
                <div className="px-4 py-2 text-xs text-muted-foreground border-b border-border">{user.email}</div>
                <button className="w-full text-left px-4 py-2 text-sm hover:bg-primary/10" onClick={() => router.push('/settings')}>Settings ⚙️</button>
                <button className="w-full text-left px-4 py-2 text-sm hover:bg-primary/10" onClick={handleLogout}>Log out <LogOut className="inline w-4 h-4 ml-1" /></button>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 ml-4">
            <span className="text-xs text-muted-foreground">Table size:</span>
            <button className="p-1 rounded bg-muted hover:bg-primary/10" onClick={decreaseTableSize} title="Decrease table size">-</button>
            <span className="px-2 text-xs font-semibold">{tableSize.toUpperCase()}</span>
            <button className="p-1 rounded bg-muted hover:bg-primary/10" onClick={increaseTableSize} title="Increase table size">+</button>
          </div>
        </header>
        <div className="flex flex-1 min-h-0 w-full overflow-hidden">
          {/* Sidebar */}
          <aside className="flex flex-col w-72 min-w-[16rem] max-w-[20vw] h-full bg-sidebar border-r border-sidebar-border shadow-sm overflow-y-auto">
            {/* In the sidebar, remove the Dashboard heading and blue dot, only show the welcome message */}
            <div className="p-6 pb-2">
              <div className="text-sm text-muted-foreground mb-6 truncate">Welcome, {user.email}</div>
            </div>
            <div className="flex-1 flex flex-col gap-4 px-6">
              <div className="bg-card rounded-lg shadow p-4 mb-2">
                <div className="font-semibold mb-2 text-sidebar-foreground">Upload CSV</div>
                <button
                  className="w-full px-2 py-3 bg-primary text-primary-foreground rounded-lg text-base font-semibold mb-3 shadow hover:bg-primary/90 transition"
                  onClick={handleUploadClick}
                  type="button"
                >
                  Upload CSV
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  onChange={handleFileChange}
                  className="hidden"
                />
                {csvError && <div className="text-destructive text-xs mb-1">{csvError}</div>}
                {csvData && <div className="text-green-600 text-xs mb-1">CSV loaded: {csvData.length} rows, {csvData[0]?.length} columns</div>}
                <div className="mt-3 flex flex-col gap-3">
                  <button className="w-full px-2 py-3 bg-primary text-primary-foreground rounded-lg text-base font-semibold shadow hover:bg-primary/90 transition" onClick={handleExportCSV} disabled={columns.length === 0 || tableData.length === 0}>
                    Export as CSV
                  </button>
                  <button className="w-full px-2 py-3 bg-primary/80 text-primary-foreground rounded-lg text-base font-semibold shadow hover:bg-primary/90 transition" onClick={handleExportPDF} disabled={columns.length === 0 || tableData.length === 0}>
                    Export as PDF
                  </button>
                  <button className="w-full px-2 py-3 bg-muted text-foreground rounded-lg text-base font-semibold shadow" onClick={() => window.location.reload()}>
                    Reset Changes
                  </button>
                </div>
              </div>
              <div className="bg-card rounded-lg shadow p-4 flex-1 flex flex-col">
                <div className="font-semibold mb-2 text-sidebar-foreground">Previous CSVs</div>
                {loadingFiles ? (
                  <div className="text-xs text-muted-foreground">Loading...</div>
                ) : csvFiles.length === 0 ? (
                  <div className="text-xs text-muted-foreground">No previous CSVs found.</div>
                ) : (
                  <ul className="space-y-1 max-h-32 overflow-y-auto">
                    {csvFiles.map(f => (
                      <li key={f.id} className="flex items-center justify-between text-xs bg-background rounded px-2 py-1 cursor-pointer hover:bg-primary/10" onClick={() => handleLoadCsv(f.id)}>
                        <span className="truncate max-w-[120px]">{f.name}</span>
                        <span className="text-muted-foreground ml-2">{new Date(f.created_at).toLocaleDateString()}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
            <div className="p-6 mt-auto">
              <button className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg font-semibold text-base shadow hover:bg-primary/90 transition" onClick={handleLogout}>
                <LogOut className="w-5 h-5" /> Log out
              </button>
            </div>
          </aside>
          {/* Main Content */}
          <main className="flex-1 flex flex-col gap-8 p-4 sm:p-8 bg-background text-foreground min-w-0 w-full overflow-auto">
            {/* Preview Card */}
            {columns.length > 0 && (
              <div className="bg-card rounded-xl shadow p-6 mb-2 border border-border max-w-full">
                <div className="font-semibold mb-4 text-lg">Preview:</div>
                <div className="overflow-x-auto">
                  <table className={`min-w-full ${tableFont}`}>
                    <thead>
                      <tr>
                        {columns.map((col, idx) => (
                          <th key={idx} className="border px-2 py-1 bg-muted font-bold text-left">{col.name}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {tableData.slice(0, 5).map((row, rowIdx) => (
                        <tr key={rowIdx} className={rowHeight}>
                          {columns.map((_, colIdx) => (
                            <td key={colIdx} className="border px-2 py-1">{row[colIdx]}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="text-xs text-muted-foreground mt-2">Showing first 5 rows of {tableData.length}</div>
                </div>
              </div>
            )}
            {/* Editable Table Card */}
            <div className="bg-card rounded-xl shadow p-6 border border-border max-w-full">
              <div className="flex items-center gap-2 mb-4">
                <button className="px-4 py-2 bg-primary text-primary-foreground rounded font-semibold text-sm shadow hover:bg-primary/90 transition" onClick={handleAddRow}>Add Row</button>
                <button className="px-4 py-2 bg-muted text-foreground rounded font-semibold text-sm shadow" onClick={handleUndo} disabled={columnHistory.length === 0}>Undo</button>
                <div className="ml-auto flex items-center gap-2">
                  <span className="text-sm">Rows per page:</span>
                  <select className="border border-border rounded px-2 py-1 bg-background text-foreground" value={rowsPerPage} onChange={e => { setRowsPerPage(Number(e.target.value)); setPage(0); }}>
                    {[5, 10, 25, 50, 100].map(n => <option key={n} value={n}>{n}</option>)}
                  </select>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className={`min-w-full ${tableFont}`}>
                  <thead>
                    <tr>
                      {columns.map((col, idx) => (
                        <th
                          key={idx}
                          className={`border px-2 py-1 bg-muted font-bold group relative select-none ${dragOverCol === idx ? 'bg-primary/10' : ''}`}
                          style={{ width: colWidths[idx], minWidth: 60, position: 'relative' }}
                          draggable
                          onDragStart={() => handleDragStart(idx)}
                          onDragOver={e => { e.preventDefault(); handleDragOver(idx); }}
                          onDrop={() => handleDrop(idx)}
                          onDragEnd={handleDragEnd}
                          onContextMenu={e => handleTableContextMenu(e, 'col', undefined, idx)}
                        >
                          {renamingCol === col.id ? (
                            <input
                              className={`border px-1 py-0.5 w-full text-xs rounded ${renameError ? 'border-destructive' : 'border-border'}`}
                              value={renameValue}
                              autoFocus
                              onChange={e => {
                                setRenameValue(e.target.value);
                                setRenameError('');
                              }}
                              onBlur={() => {
                                if (!renameValue.trim()) {
                                  setRenameError('Name cannot be empty');
                                } else if (columns.some((c, i) => c.name === renameValue.trim() && c.id !== renamingCol)) {
                                  setRenameError('Duplicate column name');
                                } else {
                                  setColumns(cols => cols.map((c, i) => c.id === renamingCol ? { ...c, name: renameValue.trim() } : c));
                                  setRenamingCol(null);
                                }
                              }}
                              onKeyDown={e => {
                                if (e.key === 'Enter') {
                                  e.currentTarget.blur();
                                } else if (e.key === 'Escape') {
                                  setRenamingCol(null);
                                }
                              }}
                            />
                          ) : (
                            <span>{col.name}</span>
                          )}
                          <button
                            className="absolute right-5 top-1/2 -translate-y-1/2 text-destructive text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={() => setShowConfirm({ colIdx: idx, colName: col.name })}
                            title="Delete column"
                          >
                            ×
                          </button>
                          {/* Resize handle */}
                          <span
                            className="absolute right-0 top-0 h-full w-2 cursor-col-resize z-10"
                            onMouseDown={e => handleResizeStart(e, idx)}
                            style={{ userSelect: 'none' }}
                          />
                        </th>
                      ))}
                      <th className="border px-2 py-1 bg-muted"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedData.map((row, rowIdx) => (
                      <tr key={rowIdx} className={rowHeight} onContextMenu={e => handleTableContextMenu(e, 'row', rowIdx + page * rowsPerPage)}>
                        {columns.map((_, colIdx) => (
                          <td key={colIdx} className="border px-2 py-1" style={{ width: colWidths[colIdx], minWidth: 60 }} onContextMenu={e => handleTableContextMenu(e, 'cell', rowIdx + page * rowsPerPage, colIdx)}>
                            {activeCell && activeCell.row === (rowIdx + page * rowsPerPage) && activeCell.col === colIdx ? (
                              <input
                                ref={el => {
                                  inputRefs.current[rowIdx + page * rowsPerPage] = inputRefs.current[rowIdx + page * rowsPerPage] || [];
                                  inputRefs.current[rowIdx + page * rowsPerPage][colIdx] = el;
                                }}
                                className="border border-border px-1 py-0.5 w-full text-xs bg-background text-foreground"
                                value={row[colIdx] ?? ""}
                                autoFocus
                                onChange={e => handleCellChange(rowIdx + page * rowsPerPage, colIdx, e.target.value)}
                                onBlur={() => setActiveCell(null)}
                                onKeyDown={e => handleCellKeyDown(e, rowIdx + page * rowsPerPage, colIdx)}
                              />
                            ) : (
                              <div
                                className="min-h-[24px] px-1 cursor-pointer"
                                onClick={() => setActiveCell({ row: rowIdx + page * rowsPerPage, col: colIdx })}
                              >
                                {row[colIdx] ?? ""}
                              </div>
                            )}
                          </td>
                        ))}
                        <td className="border px-2 py-1">
                          <button className="text-destructive text-xs" onClick={() => handleDeleteRow(rowIdx + page * rowsPerPage)}>Delete</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {/* Pagination Controls */}
              <div className="flex items-center justify-end gap-2 mt-4">
                <button className="px-2 py-1 rounded bg-muted text-foreground" disabled={page === 0} onClick={() => setPage(p => Math.max(0, p - 1))}>&lt;</button>
                <span className="text-sm">Page {page + 1} of {totalPages || 1}</span>
                <button className="px-2 py-1 rounded bg-muted text-foreground" disabled={page >= totalPages - 1} onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}>&gt;</button>
              </div>
            </div>
            {/* Add Column Dialog */}
            {showAddCol && (
              <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
                <div className="bg-card p-6 rounded shadow-lg w-80 border border-border">
                  <h2 className="text-lg font-bold mb-2">Add Column</h2>
                  <input
                    className="border border-border px-2 py-1 w-full mb-4 bg-background text-foreground"
                    placeholder="Column name"
                    value={newColName}
                    onChange={e => setNewColName(e.target.value)}
                    autoFocus
                  />
                  <div className="flex gap-2 justify-end">
                    <button className="px-3 py-1 bg-muted rounded" onClick={() => setShowAddCol(false)}>Cancel</button>
                    <button className="px-3 py-1 bg-primary text-primary-foreground rounded" onClick={handleAddColumn}>Add</button>
                  </div>
                </div>
              </div>
            )}
            {/* Delete Column Confirmation */}
            {showConfirm && (
              <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
                <div className="bg-card p-6 rounded shadow-lg w-80 border border-border">
                  <h2 className="text-lg font-bold mb-2">Delete Column</h2>
                  <p>Are you sure you want to delete column <span className="font-semibold">{showConfirm.colName}</span>?</p>
                  <div className="flex gap-2 justify-end mt-4">
                    <button className="px-3 py-1 bg-muted rounded" onClick={() => setShowConfirm(null)}>Cancel</button>
                    <button className="px-3 py-1 bg-destructive text-white rounded" onClick={() => handleDeleteColumn(showConfirm.colIdx)}>Delete</button>
                  </div>
                </div>
              </div>
            )}
            {/* Context Menu */}
            {contextMenu && (
              <div
                className="fixed z-50 bg-card border border-border rounded shadow-lg p-2 w-64 text-foreground"
                style={{ left: contextMenu.x, top: contextMenu.y }}
              >
                <div className="font-semibold mb-2 text-sm">{contextMenu.type === 'col' ? 'Column' : contextMenu.type === 'row' ? 'Row' : 'Cell'} Actions</div>
                <div className="divide-y divide-border">
                  {contextMenu.type === 'col' && (
                    <>
                      <button className="flex items-center w-full gap-2 px-3 py-2 hover:bg-primary/10 rounded" onClick={() => handleMenuAction('rename')}><Edit className="w-4 h-4" /> Rename</button>
                      <button className="flex items-center w-full gap-2 px-3 py-2 hover:bg-primary/10 rounded" onClick={() => handleMenuAction('resize')}><Rows className="w-4 h-4" /> Resize</button>
                      <button className="flex items-center w-full gap-2 px-3 py-2 hover:bg-primary/10 rounded" onClick={() => handleMenuAction('move-left')}><ChevronDown className="w-4 h-4 rotate-90" /> Move Left</button>
                      <button className="flex items-center w-full gap-2 px-3 py-2 hover:bg-primary/10 rounded" onClick={() => handleMenuAction('move-right')}><ChevronDown className="w-4 h-4 rotate-270" /> Move Right</button>
                    </>
                  )}
                  <button className="flex items-center w-full gap-2 px-3 py-2 hover:bg-primary/10 rounded" onClick={() => handleMenuAction('cut')}><Scissors className="w-4 h-4" /> Cut</button>
                  <button className="flex items-center w-full gap-2 px-3 py-2 hover:bg-primary/10 rounded" onClick={() => handleMenuAction('copy')}><Copy className="w-4 h-4" /> Copy</button>
                  <button className="flex items-center w-full gap-2 px-3 py-2 hover:bg-primary/10 rounded" onClick={() => handleMenuAction('paste')}><ClipboardPaste className="w-4 h-4" /> Paste</button>
                  <button className="flex items-center w-full gap-2 px-3 py-2 hover:bg-primary/10 rounded" onClick={() => handleMenuAction('edit')}><Edit className="w-4 h-4" /> Edit</button>
                  <button className="flex items-center w-full gap-2 px-3 py-2 hover:bg-primary/10 rounded" onClick={() => handleMenuAction('delete')}><Trash2 className="w-4 h-4" /> Delete</button>
                  <div className="my-2 border-t border-border" />
                  {contextMenu.type === 'col' && <button className="flex items-center w-full gap-2 px-3 py-2 hover:bg-primary/10 rounded" onClick={() => handleMenuAction('add-col')}><Columns className="w-4 h-4" /> Add Column</button>}
                  {contextMenu.type === 'row' && <button className="flex items-center w-full gap-2 px-3 py-2 hover:bg-primary/10 rounded" onClick={() => handleMenuAction('add-row')}><Rows className="w-4 h-4" /> Add Row</button>}
                </div>
              </div>
            )}
          </main>
        </div>
        {/* Settings Modal */}
        {showSettings && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
            <div className="bg-card rounded-lg shadow-lg p-8 border border-border w-96 max-w-full">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold">Settings</h2>
                <button className="text-xl" onClick={() => setShowSettings(false)}>&times;</button>
              </div>
              <div className="space-y-4">
                <div>
                  <div className="font-semibold mb-1">Profile</div>
                  <div className="text-muted-foreground text-sm">{user.email}</div>
                </div>
                <div>
                  <div className="font-semibold mb-1">Theme</div>
                  <button
                    className="px-3 py-1 rounded bg-muted text-foreground font-semibold"
                    onClick={() => setDarkMode(d => !d)}
                  >
                    {darkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
                  </button>
                </div>
                <div>
                  <div className="font-semibold mb-1">Table Size</div>
                  <select
                    className="border border-border rounded px-2 py-1 bg-background text-foreground"
                    value={tableSize}
                    onChange={e => setTableSize(e.target.value as 'sm' | 'md' | 'lg')}
                  >
                    <option value="sm">Small</option>
                    <option value="md">Medium</option>
                    <option value="lg">Large</option>
                  </select>
                </div>
                <div>
                  <button className="w-full px-3 py-2 bg-destructive text-white rounded font-semibold mt-4" onClick={handleLogout}>Log out</button>
                </div>
              </div>
            </div>
          </div>
        )}
        {/* Stats Modal */}
        {showStats && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
            <div className="bg-card rounded-lg shadow-lg p-8 border border-border w-96 max-w-full">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold">Stats</h2>
                <button className="text-xl" onClick={() => setShowStats(false)}>&times;</button>
              </div>
              <div className="space-y-4">
                <div>
                  <span className="font-semibold">Rows:</span> {tableData.length}
                </div>
                <div>
                  <span className="font-semibold">Columns:</span> {columns.length}
                </div>
                <div>
                  <span className="font-semibold">Non-empty cells:</span> {tableData.reduce((acc, row) => acc + row.filter(cell => cell !== '' && cell !== null && cell !== undefined).length, 0)}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </SidebarProvider>
  );
} 