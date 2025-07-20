"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/utils/supabaseClient";
import Papa from "papaparse";
import { useMemo } from "react";
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
} from "@tanstack/react-table";

export default function DashboardPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [csvError, setCsvError] = useState("");
  const [csvData, setCsvData] = useState<any[][] | null>(null);
  const [tableData, setTableData] = useState<any[][] | null>(null);
  const [originalData, setOriginalData] = useState<any[][] | null>(null);

  useEffect(() => {
    const getUser = async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) {
        router.replace("/login");
      } else {
        setUser(data.user);
      }
      setLoading(false);
    };
    getUser();
  }, [router]);

  useEffect(() => {
    if (csvData) {
      setTableData(csvData);
      setOriginalData(csvData);
    }
  }, [csvData]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCsvError("");
    setCsvData(null);
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setCsvError("File is too large (max 5MB)");
      return;
    }
    if (!file.name.endsWith(".csv")) {
      setCsvError("Only .csv files are allowed");
      return;
    }
    Papa.parse(file, {
      complete: (results) => {
        const data = results.data as any[][];
        if (!Array.isArray(data) || data.length === 0) {
          setCsvError("CSV is empty or malformed");
          return;
        }
        if (data[0].length > 15) {
          setCsvError("CSV has more than 15 columns");
          return;
        }
        if (data.length > 5000) {
          setCsvError("CSV has more than 5000 rows");
          return;
        }
        setCsvData(data);
      },
      error: (err) => {
        setCsvError("Failed to parse CSV: " + err.message);
      },
    });
  };

  const handleCellChange = (rowIdx: number, colIdx: number, value: string) => {
    if (!tableData) return;
    const updated = tableData.map((row, i) =>
      i === rowIdx ? row.map((cell, j) => (j === colIdx ? value : cell)) : row
    );
    setTableData(updated);
  };

  const handleAddRow = () => {
    if (!tableData) return;
    const emptyRow = Array(tableData[0].length).fill("");
    setTableData([...tableData, emptyRow]);
  };

  const handleDeleteRow = (rowIdx: number) => {
    if (!tableData) return;
    setTableData(tableData.filter((_, i) => i !== rowIdx));
  };

  const handleReset = () => {
    if (originalData) setTableData(originalData);
  };

  const columns = useMemo(() =>
    tableData && tableData[0]
      ? tableData[0].map((header: string, idx: number) => ({
          header,
          accessorKey: String(idx),
          cell: ({ row, getValue }: any) =>
            row.index === 0 ? (
              <span className="font-bold">{getValue()}</span>
            ) : (
              <input
                className="w-full px-2 py-1 border rounded text-gray-900 bg-gray-50"
                value={getValue() ?? ""}
                onChange={e => handleCellChange(row.index, idx, e.target.value)}
              />
            ),
        }))
      : [],
    [tableData]
  );

  const data = useMemo(() => (tableData ? tableData.slice(1) : []), [tableData]);
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center">Loading...</div>;
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="bg-white p-12 rounded-xl shadow-2xl w-full max-w-4xl text-center">
        <h1 className="text-4xl font-extrabold mb-6 text-gray-900">Dashboard</h1>
        <p className="mb-8 text-lg text-gray-700">Welcome, <span className="font-mono">{user?.email}</span></p>
        <div className="mb-10">
          <label className="block mb-3 font-bold text-lg text-gray-800">Upload your CSV file</label>
          <input
            type="file"
            accept=".csv"
            className="block w-full text-base text-gray-700 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-base file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
            onChange={handleFileChange}
          />
          {csvError && <p className="text-sm text-red-500 mt-2">{csvError}</p>}
          {csvData && (
            <div className="mt-6 text-left overflow-x-auto">
              <div className="font-bold mb-2 text-gray-800 text-lg">Preview:</div>
              <table className="min-w-full border text-base">
                <tbody>
                  {csvData.slice(0, 5).map((row, i) => (
                    <tr key={i}>
                      {row.map((cell, j) => (
                        <td key={j} className="border px-4 py-2 bg-white text-gray-900 font-medium">{cell}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="text-gray-600 mt-2 text-base">Showing first 5 rows{csvData.length > 5 ? ` of ${csvData.length}` : ""}</div>
            </div>
          )}
        </div>
        {tableData && (
          <div className="mt-10 overflow-x-auto">
            <div className="flex gap-4 mb-4">
              <button onClick={handleAddRow} className="bg-green-600 text-white px-4 py-2 rounded font-bold hover:bg-green-700">Add Row</button>
              <button onClick={handleReset} className="bg-gray-300 text-gray-800 px-4 py-2 rounded font-bold hover:bg-gray-400">Reset Changes</button>
            </div>
            <table className="min-w-full border text-base">
              <thead>
                <tr>
                  {columns.map((col, i) => (
                    <th key={i} className="border px-4 py-2 bg-gray-100 text-gray-900 font-bold">{col.header}</th>
                  ))}
                  <th className="border px-4 py-2 bg-gray-100"></th>
                </tr>
              </thead>
              <tbody>
                {table.getRowModel().rows.map((row, i) => (
                  <tr key={row.id}>
                    {row.getVisibleCells().map(cell => (
                      <td key={cell.id} className="border px-4 py-2">{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>
                    ))}
                    <td className="border px-4 py-2 text-center">
                      <button onClick={() => handleDeleteRow(i + 1)} className="text-red-600 font-bold hover:underline">Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="text-gray-600 mt-2 text-base">Total rows: {tableData.length - 1}</div>
          </div>
        )}
        <button
          className="mt-6 bg-blue-600 text-white py-3 px-8 rounded-lg font-bold text-lg hover:bg-blue-700 transition shadow-md"
          onClick={async () => {
            await supabase.auth.signOut();
            router.replace("/login");
          }}
        >
          Log out
        </button>
      </div>
    </div>
  );
} 