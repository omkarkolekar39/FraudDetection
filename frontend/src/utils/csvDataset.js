const identifierPattern = /(^id$|_id$|^id_|account|transaction|txn|customer|reference|ref(?:_|)?number|record(?:_|)?number|case(?:_|)?number|serial|sr(?:_|)?no|index|row(?:_|)?num|row(?:_|)?number|uuid|guid|unnamed)/i;

export function buildMetadataFromResults(results, preferredIgnoredColumns = null) {
    const columnNames = results.meta.fields || [];
    const lockedIgnoredColumns = columnNames.filter((column) => identifierPattern.test(column));
    const ignoredColumns = preferredIgnoredColumns
        ? columnNames.filter((column) => preferredIgnoredColumns.includes(column))
        : lockedIgnoredColumns;

    return {
        total_records: (results.data || []).length,
        total_columns: columnNames.length,
        column_names: columnNames,
        locked_ignored_columns: lockedIgnoredColumns,
        ignored_columns: ignoredColumns,
        analyzed_columns: columnNames.filter((column) => !ignoredColumns.includes(column)),
        preview_data: (results.data || []).slice(0, 12),
    };
}
