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
import { LogOut, ChevronDown, UserCircle2, Settings, BarChart2, Search, Scissors, Copy, ClipboardPaste, Trash2, Edit, Plus, Rows, Columns, Sun, Moon } from "lucide-react";
import { nanoid } from 'nanoid';

function ThemeToggle() {
  const [darkMode, setDarkMode] = useState(false);

  useEffect(() => {
    const isDark = localStorage.getItem('darkMode') === 'true';
    setDarkMode(isDark);
    if (isDark) {
      document.documentElement.classList.add('dark');
    }
  }, []);

  const toggleDarkMode = () => {
    const newDarkMode = !darkMode;
    setDarkMode(newDarkMode);
    localStorage.setItem('darkMode', String(newDarkMode));
    if (newDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  return (
    <button
      onClick={toggleDarkMode}
      className="p-2 rounded-full hover:bg-muted transition-colors"
      title={darkMode ? "Switch to light mode" : "Switch to dark mode"}
    >
      {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
    </button>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [csvError, setCsvError] = useState("");
  const [csvData, setCsvData] = useState<any[][] | null>(null);
  const [tableData, setTableData] = useState<any[][]>([]);
  const [columns, setColumns] = useState<{ id: string, name: string }[]>([]);
  const [renamingCol, setRenamingCol] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [renameError, setRenameError] = useState('');
  const [activeCell, setActiveCell] = useState<{ row: number; col: number } | null>(null);
  const inputRefs = useRef<(HTMLInputElement | null)[][]>([]);
  const [columnHistory, setColumnHistory] = useState<{
    columns: { id: string, name: string }[],
    tableData: any[][],
    colWidths: number[]
  }[]>([]);
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
  const [userProfile, setUserProfile] = useState<{ id: string, auth_user_id: string, username: string, employee_type: string, avatar_url: string | null } | null>(null);
  const PRESET_AVATARS = [
    '/avatars/avatar1.png',
    '/avatars/avatar2.png',
    '/avatars/avatar3.png',
    '/avatars/avatar4.png',
  ];
  const EMOJI_AVATARS = ["🦁", "🐼", "🦊", "🦄", "🐵", "🐸", "🐱", "🐶"];
  const [profileSaveStatus, setProfileSaveStatus] = useState<'idle' | 'saving' | 'success' | 'error'>("idle");
  const [showProfileEdit, setShowProfileEdit] = useState(false);
  const [profileEdit, setProfileEdit] = useState<{ username: string; employee_type: string; avatar_url: string | null }>({ username: '', employee_type: 'Staff', avatar_url: null });
  const [avatarUploading, setAvatarUploading] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement | null>(null);
  const [profileError, setProfileError] = useState('');
  const [profileDebug, setProfileDebug] = useState("");
  const [editDialog, setEditDialog] = useState<{ type: 'cell' | 'row' | 'col', rowIdx?: number, colIdx?: number, value?: string } | null>(null);
  const [profileSaving, setProfileSaving] = useState(false);

  function increaseTableSize() {
    setTableSize(size => (size === 'sm' ? 'md' : size === 'md' ? 'lg' : 'lg'));
  }
  function decreaseTableSize() {
    setTableSize(size => (size === 'lg' ? 'md' : size === 'md' ? 'sm' : 'sm'));
  }

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

  useEffect(() => {
    if (csvData) {
      setColumns(csvData[0].map((name: string) => ({ id: nanoid(), name })));
      setTableData(csvData.slice(1));
    } else {
      setColumns([]);
      setTableData([]);
    }
  }, [csvData]);

  useEffect(() => {
    setColWidths(widths => {
      if (columns.length === widths.length) return widths;
      if (columns.length > widths.length) {
        return [...widths, ...Array(columns.length - widths.length).fill(150)];
      } else {
        return widths.slice(0, columns.length);
      }
    });
  }, [columns.length]);

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
    setTableData(prev => prev.map(row => {
      const newRow = [...row];
      const [movedCell] = newRow.splice(dragCol, 1);
      newRow.splice(idx, 0, movedCell);
      return newRow;
    }));
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

  function openColMenu(e: React.MouseEvent, idx: number) {
    e.preventDefault();
    setColMenu({ idx, x: e.clientX, y: e.clientY });
    setRenameCol(columns[idx].name);
    setResizeVal(colWidths[idx]);
    setAddColName("");
    setAddColPos("after");
  }
  
  useEffect(() => {
    if (!colMenu) return;
    function close() { setColMenu(null); }
    window.addEventListener("mousedown", close);
    return () => window.removeEventListener("mousedown", close);
  }, [colMenu]);

  function handleRenameCol() {
    setColumns(cols => cols.map((c, i) => i === colMenu!.idx ? { ...c, name: renameCol } : c));
    setColMenu(null);
  }
  
  function handleResizeCol() {
    setColWidths(ws => ws.map((w, i) => i === colMenu!.idx && resizeVal ? resizeVal : w));
    setColMenu(null);
  }
  
  function handleMoveColMenu(dir: "left" | "right") {
    const idx = colMenu!.idx;
    const target = dir === "left" ? idx - 1 : idx + 1;
    if (target < 0 || target >= columns.length) return;
    const newColumns = [...columns];
    const [movedCol] = newColumns.splice(idx, 1);
    newColumns.splice(target, 0, movedCol);
    setColumns(newColumns);
    setTableData(prev => prev.map(row => {
      const newRow = [...row];
      const [movedCell] = newRow.splice(idx, 1);
      newRow.splice(target, 0, movedCell);
      return newRow;
    }));
    setColWidths(prev => {
      const arr = [...prev];
      const [movedW] = arr.splice(idx, 1);
      arr.splice(target, 0, movedW);
      return arr;
    });
    setColMenu(null);
  }
  
  function handleDeleteColMenu() {
    handleDeleteColumn(colMenu!.idx);
    setColMenu(null);
  }
  
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

  const table = useReactTable({
    data: tableData,
    columns: tableColumns,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
  });

  function handleCellChange(rowIdx: number, colIdx: number, value: string) {
    setTableData(prev => {
      const next = prev.map(row => [...row]);
      next[rowIdx][colIdx] = value;
      return next;
    });
  }

  function handleCellKeyDown(e: React.KeyboardEvent<HTMLInputElement>, rowIdx: number, colIdx: number) {
    if (e.key === "Enter" || e.key === "Tab") {
      e.preventDefault();
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
  }

  function handleAddRow() {
    setTableData(prev => [...prev, Array(columns.length).fill("")]);
  }

  function handleDeleteRow(rowIdx: number) {
    setTableData(prev => prev.filter((_, i) => i !== rowIdx));
  }

  function handleDeleteColumn(colIdx: number) {
    setColumnHistory(prev => [
      ...prev,
      { columns, tableData, colWidths }
    ]);
    setColumns(prev => prev.filter((_, i) => i !== colIdx));
    setTableData(prev => prev.map(row => row.filter((_, i) => i !== colIdx)));
    setColWidths(prev => prev.filter((_, i) => i !== colIdx));
    setShowConfirm(null);
  }

  function handleUndo() {
    setColumnHistory(prev => {
      if (prev.length === 0) return prev;
      const last = prev[prev.length - 1];
      setColumns(Array.isArray(last.columns) ? last.columns : []);
      setTableData(last.tableData);
      setColWidths(last.colWidths ? last.colWidths : []);
      return prev.slice(0, -1);
    });
  }
  
  function handleAddColumn() {
    if (!newColName.trim()) return;
    setColumns(prev => [...prev, { id: nanoid(), name: newColName.trim() }]);
    setTableData(prev => prev.map(row => [...row, ""]));
    setShowAddCol(false);
    setNewColName("");
  }

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
  
  async function handleLoadCsv(id: string) {
    const { data, error } = await supabase.from("user_csv_files").select("data").eq("id", id).single();
    if (data && data.data) {
      setColumns(data.data.columns);
      setTableData(data.data.tableData);
    }
  }

  const paginatedData = tableData.slice(page * rowsPerPage, (page + 1) * rowsPerPage);
  const totalPages = Math.ceil(tableData.length / rowsPerPage);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  // Enhanced Profile Save Function
  async function handleProfileSave(e?: React.FormEvent) {
    if (e) e.preventDefault();
    
    setProfileError('');
    setProfileSaving(true);

    // Validation
    if (!profileEdit.username.trim()) {
      setProfileError('Username cannot be empty.');
      setProfileSaving(false);
      return;
    }

    if (profileEdit.username.trim().length < 2) {
      setProfileError('Username must be at least 2 characters long.');
      setProfileSaving(false);
      return;
    }

    if (!['Staff', 'Manager', 'Admin'].includes(profileEdit.employee_type)) {
      setProfileError('Please select a valid employee type.');
      setProfileSaving(false);
      return;
    }

    try {
      if (!userProfile) {
        setProfileError('User profile not found.');
        setProfileSaving(false);
        return;
      }

      // Save to Supabase
      const { data, error } = await supabase
        .from('users')
        .update({
          username: profileEdit.username.trim(),
          employee_type: profileEdit.employee_type,
          avatar_url: profileEdit.avatar_url,
        })
        .eq('id', userProfile.id)
        .select()
        .single();

      if (error) {
        setProfileError('Failed to update profile. Please try again.');
        setProfileSaving(false);
        return;
      }

      // Update local state
      setUserProfile(data);
      
      // Close modal after successful save
      setShowProfileEdit(false);
      
    } catch (error) {
      setProfileError('An unexpected error occurred. Please try again.');
    } finally {
      setProfileSaving(false);
    }
  }

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) {
        router.replace("/login");
      } else {
        setUser(user);
      }
      setLoading(false);
    });
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

  useEffect(() => {
    if (!user) return;
    setProfileError(''); // Clear previous errors
    async function fetchOrCreateProfile() {
      if (!user) return;

      // Try to fetch the existing profile
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('auth_user_id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116: No rows found
        setProfileError('Failed to fetch user profile: ' + error.message);
        console.error('Fetch profile error:', error);
        return;
      }

      if (data) {
        setUserProfile(data);
        return;
      }

      // If not found, try to create a new profile
      const { data: newProfile, error: insertError } = await supabase
        .from('users')
        .insert({
          auth_user_id: user.id,
          username: user.email?.split('@')[0] || 'User',
          employee_type: 'Staff',
          avatar_url: null,
        })
        .select()
        .single();

      if (insertError) {
        setProfileError('Failed to create user profile: ' + insertError.message);
        console.error('Insert profile error:', insertError);
        return;
      }

      if (newProfile) {
        setUserProfile(newProfile);
      } else {
        setProfileError('Failed to create user profile: Unknown error.');
      }
    }
    fetchOrCreateProfile();
  }, [user]);

  // Initialize Profile Data
  useEffect(() => {
    if (userProfile) {
      setProfileEdit({
        username: userProfile.username || user?.email?.split('@')[0] || '',
        employee_type: userProfile.employee_type || 'Staff',
        avatar_url: userProfile.avatar_url || null,
      });
    }
  }, [userProfile, user]);

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

  const clipboardRef = useRef<{ type: 'cell' | 'row' | 'col'; data: any } | null>(null);

  async function handleMenuAction(action: string) {
    if (!contextMenu) return;
    const { type, rowIdx, colIdx } = contextMenu;
    if (type === 'col' && typeof colIdx === 'number') {
      if (action === 'create') {
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
      } else if (action === 'read') {
        alert('Column values:\n' + tableData.map(row => row[colIdx]).join('\n'));
      } else if (action === 'update') {
        setEditDialog({ type: 'col', colIdx, value: columns[colIdx].name });
      } else if (action === 'delete') {
        setColumns(cols => cols.filter((_, i) => i !== colIdx));
        setTableData(rows => rows.map(row => row.filter((_, i) => i !== colIdx)));
      }
    } else if (type === 'row' && typeof rowIdx === 'number') {
      if (action === 'create') {
        setTableData(rows => {
          const arr = [...rows];
          arr.splice(rowIdx + 1, 0, Array(columns.length).fill(''));
          return arr;
        });
      } else if (action === 'read') {
        alert('Row values:\n' + tableData[rowIdx].join(', '));
      } else if (action === 'update') {
        setEditDialog({ type: 'row', rowIdx, value: tableData[rowIdx].join(',') });
      } else if (action === 'delete') {
        setTableData(rows => rows.filter((_, i) => i !== rowIdx));
      }
    } else if (type === 'cell' && typeof rowIdx === 'number' && typeof colIdx === 'number') {
      if (action === 'create') {
        const choice = window.prompt('Type "row" to add a new row, "col" to add a new column:');
        if (choice === 'row') {
          setTableData(rows => {
            const arr = [...rows];
            arr.splice(rowIdx + 1, 0, Array(columns.length).fill(''));
            return arr;
          });
        } else if (choice === 'col') {
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
      } else if (action === 'read') {
        alert('Cell value: ' + tableData[rowIdx][colIdx]);
      } else if (action === 'update') {
        setEditDialog({ type: 'cell', rowIdx, colIdx, value: tableData[rowIdx][colIdx] });
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
    return null;
  }

  const tableFont = tableSize === 'sm' ? 'text-xs' : tableSize === 'md' ? 'text-sm' : 'text-base';
  const rowHeight = tableSize === 'sm' ? 'h-7' : tableSize === 'md' ? 'h-9' : 'h-12';

  return (
    <SidebarProvider>
      <div className="flex flex-col min-h-screen w-full bg-background text-foreground">
        {/* Dashboard Header with Dynamic Greeting */}
        <header className="sticky top-0 z-30 w-full bg-card border-b border-border shadow flex items-center px-6 h-16 gap-4">
          <div className="flex items-center gap-2 text-2xl font-bold text-primary">
            Dashboard
          </div>
          
          {/* Dynamic Greeting */}
          <div className="text-sm text-muted-foreground ml-4">
            hello, {profileEdit.username || user?.email?.split('@')[0] || 'User'}
          </div>
          
          <div className="flex items-center gap-2 ml-auto">
            <ThemeToggle />
            <button className="p-2 rounded-full hover:bg-muted" title="Stats" onClick={() => setShowStats(true)}>
              <BarChart2 className="w-5 h-5" />
            </button>
            
            {/* Updated Profile Button */}
            <div className="relative">
              <button
                className="ml-2 w-10 h-10 rounded-full border-2 border-primary flex items-center justify-center bg-muted text-2xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                title="Profile"
                onClick={() => setShowProfileEdit(true)}
              >
                <UserCircle2 className="w-8 h-8 text-muted-foreground" />
              </button>
            </div>
          </div>
          <div className="flex items-center gap-2 ml-4">
            <span className="text-xs text-muted-foreground">Table size:</span>
            <button className="p-1 rounded bg-muted hover:bg-primary/10" onClick={decreaseTableSize} title="Decrease table size">-</button>
            <span className="px-2 text-xs">{tableSize.toUpperCase()}</span>
            <button className="p-1 rounded bg-muted hover:bg-primary/10" onClick={increaseTableSize} title="Increase table size">+</button>
          </div>
        </header>
        <div className="flex flex-1 min-h-0 w-full overflow-hidden">
          {/* Sidebar */}
          <aside className="flex flex-col w-72 min-w-[16rem] max-w-[20vw] h-full bg-sidebar border-r border-sidebar-border shadow-sm overflow-y-auto">
            <div className="p-6 pb-2">
              <div className="text-sm text-muted-foreground mb-6 truncate">Welcome, {user?.email}</div>
            </div>
            <div className="flex-1 flex flex-col gap-4 px-6">
              <div className="bg-card rounded-lg shadow p-4 mb-2">
                <div className="font-semibold mb-2 text-lg">Upload CSV</div>
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
                          <span
                            className={`absolute right-0 top-0 h-full w-3 cursor-col-resize z-10 transition-colors ${resizingCol?.idx === idx ? 'bg-primary/40' : 'hover:bg-primary/20'}`}
                            onMouseDown={e => handleResizeStart(e, idx)}
                            style={{ userSelect: 'none', borderRadius: 2 }}
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
                  <h2 className="text-lg font-bold">Add Column</h2>
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
                  <h2 className="text-lg font-bold">Delete Column</h2>
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
                onMouseDown={e => e.stopPropagation()}
              >
                <div className="font-semibold mb-2 text-sm">{contextMenu.type === 'col' ? 'Column' : contextMenu.type === 'row' ? 'Row' : 'Cell'} Actions</div>
                <div className="divide-y divide-border">
                  {contextMenu.type === 'col' && (
                    <>
                      <button className="flex items-center w-full gap-2 px-3 py-2 hover:bg-primary/10 rounded" onMouseDown={() => handleMenuAction('create')}><Plus className="w-4 h-4" /> Add Column</button>
                      <button className="flex items-center w-full gap-2 px-3 py-2 hover:bg-primary/10 rounded" onMouseDown={() => handleMenuAction('read')}><Rows className="w-4 h-4" /> View Column</button>
                      <button className="flex items-center w-full gap-2 px-3 py-2 hover:bg-primary/10 rounded" onMouseDown={() => handleMenuAction('update')}><Edit className="w-4 h-4" /> Rename Column</button>
                      <button className="flex items-center w-full gap-2 px-3 py-2 hover:bg-primary/10 rounded" onMouseDown={() => handleMenuAction('delete')}><Trash2 className="w-4 h-4" /> Delete Column</button>
                    </>
                  )}
                  {contextMenu.type === 'row' && (
                    <>
                      <button className="flex items-center w-full gap-2 px-3 py-2 hover:bg-primary/10 rounded" onMouseDown={() => handleMenuAction('create')}><Plus className="w-4 h-4" /> Add Row</button>
                      <button className="flex items-center w-full gap-2 px-3 py-2 hover:bg-primary/10 rounded" onMouseDown={() => handleMenuAction('read')}><Rows className="w-4 h-4" /> View Row</button>
                      <button className="flex items-center w-full gap-2 px-3 py-2 hover:bg-primary/10 rounded" onMouseDown={() => handleMenuAction('update')}><Edit className="w-4 h-4" /> Edit Row</button>
                      <button className="flex items-center w-full gap-2 px-3 py-2 hover:bg-primary/10 rounded" onMouseDown={() => handleMenuAction('delete')}><Trash2 className="w-4 h-4" /> Delete Row</button>
                    </>
                  )}
                  {contextMenu.type === 'cell' && (
                    <>
                      <button className="flex items-center w-full gap-2 px-3 py-2 hover:bg-primary/10 rounded" onMouseDown={() => handleMenuAction('create')}><Plus className="w-4 h-4" /> Add Cell (Row/Col)</button>
                      <button className="flex items-center w-full gap-2 px-3 py-2 hover:bg-primary/10 rounded" onMouseDown={() => handleMenuAction('read')}><Rows className="w-4 h-4" /> View Cell</button>
                      <button className="flex items-center w-full gap-2 px-3 py-2 hover:bg-primary/10 rounded" onMouseDown={() => handleMenuAction('update')}><Edit className="w-4 h-4" /> Edit Cell</button>
                      <button className="flex items-center w-full gap-2 px-3 py-2 hover:bg-primary/10 rounded" onMouseDown={() => handleMenuAction('delete')}><Trash2 className="w-4 h-4" /> Delete Cell</button>
                    </>
                  )}
                </div>
              </div>
            )}
          </main>
        </div>

        {/* Enhanced Profile Modal */}
        {showProfileEdit && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-card border border-border rounded-lg shadow-xl w-96 max-w-[90vw] p-6">
              {/* Header with Close Button */}
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-foreground">Profile</h2>
                <button
                  onClick={() => setShowProfileEdit(false)}
                  className="p-1 rounded-full hover:bg-muted transition-colors"
                  title="Close"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Profile Form */}
              <form onSubmit={handleProfileSave} className="space-y-4">
                {/* Username Field */}
                <div>
                  <label className="block font-semibold mb-2 text-foreground">Username</label>
                  <input
                    type="text"
                    className="border border-border rounded-md px-3 py-2 w-full bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                    value={profileEdit.username}
                    onChange={e => {
                      setProfileEdit(prev => ({ ...prev, username: e.target.value }));
                      setProfileError(''); // Clear error on change
                    }}
                    placeholder="Enter your username"
                    required
                  />
                </div>

                {/* Email Field (Read-only) */}
                <div>
                  <label className="block font-semibold mb-2 text-foreground">Email</label>
                  <input
                    type="email"
                    className="border border-border rounded-md px-3 py-2 w-full bg-muted text-muted-foreground cursor-not-allowed"
                    value={user?.email || ''}
                    readOnly
                  />
                </div>

                {/* Employee Type Dropdown */}
                <div>
                  <label className="block font-semibold mb-2 text-foreground">Employee Type</label>
                  <select
                    className="border border-border rounded-md px-3 py-2 w-full bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                    value={profileEdit.employee_type}
                    onChange={e => setProfileEdit(prev => ({ ...prev, employee_type: e.target.value }))}
                  >
                    <option value="Staff">Staff</option>
                    <option value="Manager">Manager</option>
                    <option value="Admin">Admin</option>
                  </select>
                </div>

                {/* Error Message */}
                {profileError && (
                  <div className="text-destructive text-sm bg-destructive/10 border border-destructive/20 rounded-md p-2">
                    {profileError}
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex gap-3 justify-end pt-4">
                  <button
                    type="button"
                    className="px-4 py-2 bg-muted text-foreground rounded-md hover:bg-muted/80 transition-colors"
                    onClick={() => setShowProfileEdit(false)}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={profileSaving}
                  >
                    {profileSaving ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

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
                  <div className="font-semibold mb-1">Username</div>
                  <input
                    type="text"
                    className="border border-border rounded px-2 py-1 w-full bg-background text-foreground"
                    value={profileEdit.username}
                    onChange={e => setProfileEdit(edit => ({ ...edit, username: e.target.value }))}
                  />
                </div>
                <div>
                  <div className="font-semibold mb-1">Employee Type</div>
                  <select
                    className="border border-border rounded px-2 py-1 w-full bg-background text-foreground"
                    value={profileEdit.employee_type}
                    onChange={e => setProfileEdit(edit => ({ ...edit, employee_type: e.target.value }))}
                  >
                    <option value="Staff">Staff</option>
                    <option value="Manager">Manager</option>
                    <option value="Admin">Admin</option>
                  </select>
                </div>
                <div className="flex gap-2 justify-end">
                  <button className="px-3 py-1 bg-muted rounded" onClick={() => setShowSettings(false)}>Cancel</button>
                  <button className="px-3 py-1 bg-primary text-primary-foreground rounded" onClick={handleProfileSave} disabled={avatarUploading}>
                    {avatarUploading ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </div>
              {profileDebug && <pre className="text-xs text-muted-foreground bg-muted p-2 rounded mt-2 overflow-x-auto">{profileDebug}</pre>}
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

        {/* Edit Dialog */}
        {editDialog && (
          <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
            <div className="bg-card p-6 rounded shadow-lg w-80 border border-border">
              <h2 className="text-lg font-bold">
                Edit {editDialog.type === 'cell'
                  ? 'Cell'
                  : editDialog.type === 'row'
                  ? 'Row'
                  : 'Column'}
              </h2>
              <input
                className="border border-border px-2 py-1 w-full mb-4 bg-background text-foreground"
                value={editDialog.value ?? ''}
                onChange={e =>
                  setEditDialog(d => (d ? { ...d, value: e.target.value } : null))
                }
                autoFocus
              />
              <div className="flex gap-2 justify-end">
                <button
                  className="px-3 py-1 bg-muted rounded"
                  onClick={() => setEditDialog(null)}
                >
                  Cancel
                </button>
                <button
                  className="px-3 py-1 bg-primary text-primary-foreground rounded"
                  onClick={() => {
                    if (
                      editDialog.type === 'cell' &&
                      typeof editDialog.rowIdx === 'number' &&
                      typeof editDialog.colIdx === 'number'
                    ) {
                      setTableData(rows =>
                        rows.map((row, i) =>
                          i === editDialog.rowIdx
                            ? row.map((v, j) =>
                                j === editDialog.colIdx ? editDialog.value : v
                              )
                            : row
                        )
                      );
                    } else if (
                      editDialog.type === 'row' &&
                      typeof editDialog.rowIdx === 'number'
                    ) {
                      const values = (editDialog.value ?? '').split(',');
                      setTableData(rows =>
                        rows.map((row, i) =>
                          i === editDialog.rowIdx ? values : row
                        )
                      );
                    } else if (
                      editDialog.type === 'col' &&
                      typeof editDialog.colIdx === 'number'
                    ) {
                      setColumns(cols =>
                        cols.map((c, i) =>
                          i === editDialog.colIdx
                            ? { ...c, name: editDialog.value ?? c.name }
                            : c
                        )
                      );
                    }
                    setEditDialog(null);
                  }}
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </SidebarProvider>
  );
}
