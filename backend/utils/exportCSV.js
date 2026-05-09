/**
 * Shared CSV export utility.
 * @param {import('express').Response} res - Express response object
 * @param {Array<Object>} rows - Data rows to export
 * @param {string} filename - Download filename (without .csv)
 * @param {Array<{key: string, label: string}>} columns - Column definitions
 */
export const exportToCSV = (res, rows, filename, columns) => {
  const header = columns.map((c) => c.label).join(",");

  const body = rows
    .map((row) =>
      columns
        .map((col) => {
          const val = row[col.key] ?? "";
          // Escape quotes and wrap in quotes if value contains comma/newline/quote
          const str = String(val).replace(/"/g, '""');
          return /[",\n\r]/.test(str) ? `"${str}"` : str;
        })
        .join(",")
    )
    .join("\n");

  const csv = `${header}\n${body}`;

  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}.csv"`);
  res.status(200).send(csv);
};
