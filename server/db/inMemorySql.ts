export interface SqlExecutionOutput {
  columns: string[];
  rows: any[];
  executionTimeMs: number;
}

export function executeInMemorySql(
  sql: string,
  tables: Record<string, any[]>,
  defaultTableName = 'products'
): SqlExecutionOutput {
  const startTime = performance.now();
  const cleanSql = sql.trim().replace(/;+$/, '');
  const lowerSql = cleanSql.toLowerCase();

  // 1. SHOW TABLES
  if (/^show\s+(full\s+)?tables/i.test(cleanSql)) {
    const availableTables = Object.keys(tables);
    const colName = 'Tables_in_database';
    return {
      columns: [colName],
      rows: availableTables.map(t => ({ [colName]: t })),
      executionTimeMs: Math.round(performance.now() - startTime)
    };
  }

  // 2. DESCRIBE / EXPLAIN
  const descMatch = cleanSql.match(/^(?:describe|desc|explain)\s+`?([a-zA-Z0-9_]+)`?/i);
  if (descMatch) {
    const targetTable = descMatch[1].toLowerCase();
    const records = tables[targetTable] || tables[defaultTableName] || [];
    const firstRow = records[0] || {};
    const cols = Object.keys(firstRow);

    const descRows = cols.map(c => {
      const sampleVal = records.find(r => r[c] !== undefined && r[c] !== null)?.[c];
      const isNum = typeof sampleVal === 'number' || (!isNaN(Number(sampleVal)) && sampleVal !== '' && sampleVal !== null);
      const isInt = isNum && Number.isInteger(Number(sampleVal));
      return {
        Field: c,
        Type: isInt ? 'int' : (isNum ? 'decimal(10,2)' : 'varchar(255)'),
        Null: 'YES',
        Key: (/id$/i.test(c) || c.toLowerCase() === 'id') ? 'PRI' : '',
        Default: null,
        Extra: (/id$/i.test(c) && isInt) ? 'auto_increment' : ''
      };
    });

    return {
      columns: ['Field', 'Type', 'Null', 'Key', 'Default', 'Extra'],
      rows: descRows,
      executionTimeMs: Math.round(performance.now() - startTime)
    };
  }

  // 3. SELECT Queries
  if (!lowerSql.startsWith('select')) {
    throw new Error('Only SELECT, SHOW, DESCRIBE, and EXPLAIN statements are supported in this engine.');
  }

  // Determine target table
  const fromMatch = cleanSql.match(/\bfrom\s+`?([a-zA-Z0-9_]+)`?/i);
  let tableName = defaultTableName;
  if (fromMatch) {
    const requested = fromMatch[1].toLowerCase();
    if (tables[requested]) {
      tableName = requested;
    } else if (tables['products'] && (requested === 'products' || requested === 't_shirts' || requested === 'inventory')) {
      tableName = 'products';
    } else if (tables[Object.keys(tables)[0]]) {
      tableName = Object.keys(tables)[0];
    }
  }

  const sourceRecords = tables[tableName] || [];
  let workingRows: any[] = sourceRecords.map(r => ({ ...r }));

  // Helper for case-insensitive value lookup on row
  const getRowVal = (row: any, fieldName: string): any => {
    if (row[fieldName] !== undefined) return row[fieldName];
    const lower = fieldName.toLowerCase().trim();
    for (const [k, v] of Object.entries(row)) {
      if (k.toLowerCase().trim() === lower) return v;
    }
    // Common retail aliases
    if (lower === 'product_id' || lower === 't_shirt_id' || lower === 'id') {
      return row.product_id ?? row.t_shirt_id ?? row.id ?? row.sku;
    }
    if (lower === 'price' || lower === 'unit_price') {
      return row.price ?? row.effective_price ?? row.unit_price;
    }
    if (lower === 'stock_quantity' || lower === 'units' || lower === 'stock') {
      return row.stock_quantity ?? row.stock ?? row.units ?? row.quantity;
    }
    return undefined;
  };

  // 4. WHERE clause filtering
  const whereMatch = cleanSql.match(/\bwhere\s+(.+?)(?:\s+group\s+by|\s+order\s+by|\s+limit\b|$)/i);
  if (whereMatch) {
    const rawWhere = whereMatch[1].trim();
    // Split by AND
    const conditions = rawWhere.split(/\s+and\s+/i);

    for (const cond of conditions) {
      const trimmedCond = cond.trim();

      // col IS NULL / IS NOT NULL
      if (/is\s+null/i.test(trimmedCond)) {
        const col = trimmedCond.replace(/\s+is\s+null/i, '').trim().replace(/[`'"]/g, '');
        workingRows = workingRows.filter(r => getRowVal(r, col) === null || getRowVal(r, col) === undefined || getRowVal(r, col) === '');
        continue;
      }
      if (/is\s+not\s+null/i.test(trimmedCond)) {
        const col = trimmedCond.replace(/\s+is\s+not\s+null/i, '').trim().replace(/[`'"]/g, '');
        workingRows = workingRows.filter(r => getRowVal(r, col) !== null && getRowVal(r, col) !== undefined && getRowVal(r, col) !== '');
        continue;
      }

      // col LIKE '%term%'
      const likeMatch = trimmedCond.match(/`?([a-zA-Z0-9_]+)`?\s+like\s+['"]([^'"]+)['"]/i);
      if (likeMatch) {
        const col = likeMatch[1];
        const pattern = likeMatch[2].replace(/%/g, '.*');
        const regex = new RegExp(`^${pattern}$`, 'i');
        workingRows = workingRows.filter(r => regex.test(String(getRowVal(r, col) ?? '')));
        continue;
      }

      // Comparison operators: <=, >=, !=, <>, <, >, =
      const compMatch = trimmedCond.match(/`?([a-zA-Z0-9_]+)`?\s*(<=|>=|!=|<>|<|>|=)\s*([^\s;]+(?:\s+[^\s;]+)*)/i);
      if (compMatch) {
        const col = compMatch[1];
        const op = compMatch[2];
        let rawVal = compMatch[3].trim().replace(/^['"]|['"]$/g, '');

        const isNumVal = !isNaN(Number(rawVal)) && rawVal !== '';
        const targetNum = isNumVal ? Number(rawVal) : 0;

        workingRows = workingRows.filter(r => {
          const actual = getRowVal(r, col);
          if (actual === undefined || actual === null) return false;

          if (isNumVal) {
            const actualNum = Number(actual);
            switch (op) {
              case '=': return actualNum === targetNum;
              case '!=':
              case '<>': return actualNum !== targetNum;
              case '<': return actualNum < targetNum;
              case '<=': return actualNum <= targetNum;
              case '>': return actualNum > targetNum;
              case '>=': return actualNum >= targetNum;
            }
          } else {
            const actualStr = String(actual).toLowerCase().trim();
            const targetStr = rawVal.toLowerCase().trim();
            switch (op) {
              case '=': return actualStr === targetStr;
              case '!=':
              case '<>': return actualStr !== targetStr;
              case '<': return actualStr < targetStr;
              case '<=': return actualStr <= targetStr;
              case '>': return actualStr > targetStr;
              case '>=': return actualStr >= targetStr;
            }
          }
          return true;
        });
      }
    }
  }

  // 5. Check for GROUP BY and Aggregations
  const selectClauseMatch = cleanSql.match(/^select\s+(.+?)\s+from\b/i);
  const selectClause = selectClauseMatch ? selectClauseMatch[1].trim() : '*';

  const groupByMatch = cleanSql.match(/\bgroup\s+by\s+`?([a-zA-Z0-9_]+)`?/i);
  const hasAggregates = /\b(count|sum|avg|min|max)\s*\(/i.test(selectClause);

  let resultRows: any[] = [];
  let resultColumns: string[] = [];

  if (groupByMatch || hasAggregates) {
    const groupCol = groupByMatch ? groupByMatch[1] : null;

    // Split group
    const groups: Map<string, any[]> = new Map();
    if (groupCol) {
      for (const row of workingRows) {
        const key = String(getRowVal(row, groupCol) ?? 'Unknown');
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key)!.push(row);
      }
    } else {
      groups.set('__all__', workingRows);
    }

    // Parse select items: e.g. "category, COUNT(*) AS sku_count, SUM(stock_quantity) AS total_units, SUM(price * stock_quantity) AS total_valuation"
    const selectItems = selectClause.split(',').map(s => s.trim());
    resultColumns = selectItems.map(item => {
      const aliasMatch = item.match(/\bas\s+`?([a-zA-Z0-9_]+)`?$/i) || item.match(/\s+`?([a-zA-Z0-9_]+)`?$/i);
      if (aliasMatch && !item.toLowerCase().startsWith('count') && !item.toLowerCase().startsWith('sum') && !item.toLowerCase().startsWith('avg') && !item.toLowerCase().startsWith('min') && !item.toLowerCase().startsWith('max')) {
        return aliasMatch[1];
      }
      if (aliasMatch) return aliasMatch[1];
      return item.replace(/[`() *]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '') || item;
    });

    for (const [groupKey, groupRows] of groups.entries()) {
      const rowObj: Record<string, any> = {};

      for (let i = 0; i < selectItems.length; i++) {
        const item = selectItems[i];
        const colName = resultColumns[i];

        if (groupCol && (item.toLowerCase() === groupCol.toLowerCase() || item.toLowerCase().includes(groupCol.toLowerCase()))) {
          rowObj[colName] = groupKey;
          continue;
        }

        // COUNT(*) or COUNT(col)
        if (/count\s*\(/i.test(item)) {
          rowObj[colName] = groupRows.length;
        }
        // SUM(price * stock_quantity)
        else if (/sum\s*\(\s*`?price`?\s*\*\s*`?stock_quantity`?\s*\)/i.test(item) || /sum\s*\(\s*`?stock_quantity`?\s*\*\s*`?price`?\s*\)/i.test(item)) {
          const sum = groupRows.reduce((acc, r) => {
            const p = Number(getRowVal(r, 'price')) || 0;
            const q = Number(getRowVal(r, 'stock_quantity')) || 0;
            return acc + (p * q);
          }, 0);
          rowObj[colName] = Math.round(sum * 100) / 100;
        }
        // SUM(col)
        else if (/sum\s*\(\s*`?([a-zA-Z0-9_]+)`?\s*\)/i.test(item)) {
          const field = item.match(/sum\s*\(\s*`?([a-zA-Z0-9_]+)`?\s*\)/i)![1];
          const sum = groupRows.reduce((acc, r) => acc + (Number(getRowVal(r, field)) || 0), 0);
          rowObj[colName] = Math.round(sum * 100) / 100;
        }
        // AVG(col)
        else if (/avg\s*\(\s*`?([a-zA-Z0-9_]+)`?\s*\)/i.test(item)) {
          const field = item.match(/avg\s*\(\s*`?([a-zA-Z0-9_]+)`?\s*\)/i)![1];
          const sum = groupRows.reduce((acc, r) => acc + (Number(getRowVal(r, field)) || 0), 0);
          const avg = groupRows.length > 0 ? sum / groupRows.length : 0;
          rowObj[colName] = Math.round(avg * 100) / 100;
        }
        // MIN(col)
        else if (/min\s*\(\s*`?([a-zA-Z0-9_]+)`?\s*\)/i.test(item)) {
          const field = item.match(/min\s*\(\s*`?([a-zA-Z0-9_]+)`?\s*\)/i)![1];
          const min = Math.min(...groupRows.map(r => Number(getRowVal(r, field)) || 0));
          rowObj[colName] = isFinite(min) ? min : 0;
        }
        // MAX(col)
        else if (/max\s*\(\s*`?([a-zA-Z0-9_]+)`?\s*\)/i.test(item)) {
          const field = item.match(/max\s*\(\s*`?([a-zA-Z0-9_]+)`?\s*\)/i)![1];
          const max = Math.max(...groupRows.map(r => Number(getRowVal(r, field)) || 0));
          rowObj[colName] = isFinite(max) ? max : 0;
        }
        // Direct field from first row
        else {
          const field = item.replace(/[`'"]/g, '').trim();
          rowObj[colName] = getRowVal(groupRows[0], field) ?? null;
        }
      }

      resultRows.push(rowObj);
    }
  } else {
    // Standard SELECT projection without GROUP BY
    if (selectClause === '*' || selectClause === '`*`') {
      resultRows = workingRows;
      resultColumns = sourceRecords.length > 0 ? Object.keys(sourceRecords[0]) : [];
    } else {
      const selectItems = selectClause.split(',').map(s => s.trim());
      resultColumns = selectItems.map(item => {
        const aliasMatch = item.match(/\bas\s+`?([a-zA-Z0-9_]+)`?$/i) || item.match(/\s+`?([a-zA-Z0-9_]+)`?$/i);
        if (aliasMatch) return aliasMatch[1];
        return item.replace(/[`'"]/g, '').trim();
      });

      resultRows = workingRows.map(r => {
        const rowObj: Record<string, any> = {};
        for (let i = 0; i < selectItems.length; i++) {
          const rawItem = selectItems[i];
          const colName = resultColumns[i];
          const sourceField = rawItem.replace(/\bas\s+.*$/i, '').replace(/\s+[a-zA-Z0-9_]+$/, '').replace(/[`'"]/g, '').trim();
          rowObj[colName] = getRowVal(r, sourceField);
        }
        return rowObj;
      });
    }
  }

  // 6. ORDER BY clause
  const orderMatch = cleanSql.match(/\border\s+by\s+(.+?)(?:\s+limit\b|$)/i);
  if (orderMatch) {
    const orderClause = orderMatch[1].trim();
    const orderParts = orderClause.split(',').map(p => p.trim());

    resultRows.sort((a, b) => {
      for (const part of orderParts) {
        const isDesc = /\bdesc\b/i.test(part);
        const col = part.replace(/\s+(?:asc|desc)\b/i, '').replace(/[`'"]/g, '').trim();

        const valA = getRowVal(a, col);
        const valB = getRowVal(b, col);

        if (valA === valB) continue;
        if (valA === null || valA === undefined) return isDesc ? 1 : -1;
        if (valB === null || valB === undefined) return isDesc ? -1 : 1;

        const numA = Number(valA);
        const numB = Number(valB);
        const bothNum = !isNaN(numA) && !isNaN(numB) && valA !== '' && valB !== '';

        if (bothNum) {
          return isDesc ? numB - numA : numA - numB;
        }

        const cmp = String(valA).localeCompare(String(valB));
        return isDesc ? -cmp : cmp;
      }
      return 0;
    });
  }

  // 7. LIMIT and OFFSET
  const limitMatch = cleanSql.match(/\blimit\s+(\d+)(?:\s*(?:offset|,)\s*(\d+))?/i);
  if (limitMatch) {
    const num1 = parseInt(limitMatch[1], 10);
    const num2 = limitMatch[2] ? parseInt(limitMatch[2], 10) : undefined;

    let offset = 0;
    let limitCount = num1;

    if (num2 !== undefined) {
      if (/limit\s+\d+\s+offset\s+\d+/i.test(cleanSql)) {
        limitCount = num1;
        offset = num2;
      } else {
        // LIMIT offset, count
        offset = num1;
        limitCount = num2;
      }
    }

    resultRows = resultRows.slice(offset, offset + limitCount);
  }

  // Fallback for column list if empty
  if (resultColumns.length === 0 && resultRows.length > 0) {
    resultColumns = Object.keys(resultRows[0]);
  }

  const executionTimeMs = Math.round(performance.now() - startTime);

  return {
    columns: resultColumns,
    rows: resultRows,
    executionTimeMs
  };
}
