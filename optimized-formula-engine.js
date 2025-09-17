// Optimized Formula Engine with Caching and Performance Improvements

class OptimizedFormulaEngine {
  constructor() {
    // LRU cache for parsed expressions
    this.astCache = new Map();
    this.resultCache = new Map();
    this.maxCacheSize = 1000;

    // Pre-compiled regex patterns
    this.patterns = {
      stringLiteral: /^"((?:[^"\\]|\\.|"")*)"/,
      functionCall: /^([a-zA-Z_][a-zA-Z0-9_]*)\s*\((.*)\)$/,
      number: /^-?\d+(?:\.\d+)?$/,
      identifier: /^[a-zA-Z_][a-zA-Z0-9_]*$/
    };

    this.functions = new Map([
      ['concat', (...args) => args.map(x => String(x ?? '')).join('')],
      ['upper', (s) => String(s ?? '').toUpperCase()],
      ['lower', (s) => String(s ?? '').toLowerCase()],
      ['trim', (s) => String(s ?? '').trim()],
      ['replace', (s, a, b) => String(s ?? '').split(String(a ?? '')).join(String(b ?? ''))],
      ['default', (v, fb) => (v == null || v === '') ? fb : v],
      // Add more functions as needed
      ['substring', (s, start, length) => String(s ?? '').substring(start, length)],
      ['length', (s) => String(s ?? '').length],
      ['padStart', (s, length, pad = ' ') => String(s ?? '').padStart(length, pad)]
    ]);
  }

  /**
   * Main evaluation method with caching
   */
  evaluateFormula(formula, context) {
    if (!formula) return '';

    const cacheKey = this._getCacheKey(formula, context);

    // Check result cache first
    if (this.resultCache.has(cacheKey)) {
      return this.resultCache.get(cacheKey);
    }

    try {
      // Parse or get from AST cache
      const ast = this._parseWithCache(formula);
      const result = this._evaluateAST(ast, context);

      // Cache result
      this._cacheResult(cacheKey, result);
      return result;
    } catch (error) {
      return `[[ERR: ${error.message}]]`;
    }
  }

  /**
   * Batch evaluation for multiple rows - more efficient
   */
  evaluateFormulasBatch(formulas, contexts) {
    const results = new Array(contexts.length);

    // Group by formula to maximize cache hits
    const formulaGroups = new Map();

    formulas.forEach((formula, index) => {
      if (!formulaGroups.has(formula)) {
        formulaGroups.set(formula, []);
      }
      formulaGroups.get(formula).push({ index, context: contexts[index] });
    });

    // Process each formula group
    formulaGroups.forEach((items, formula) => {
      const ast = this._parseWithCache(formula);

      items.forEach(({ index, context }) => {
        try {
          results[index] = this._evaluateAST(ast, context);
        } catch (error) {
          results[index] = `[[ERR: ${error.message}]]`;
        }
      });
    });

    return results;
  }

  /**
   * Parse with AST caching
   */
  _parseWithCache(formula) {
    const trimmed = formula.trim();

    if (this.astCache.has(trimmed)) {
      return this.astCache.get(trimmed);
    }

    const ast = this._parseExpression(trimmed);

    // Implement LRU cache management
    if (this.astCache.size >= this.maxCacheSize) {
      const firstKey = this.astCache.keys().next().value;
      this.astCache.delete(firstKey);
    }

    this.astCache.set(trimmed, ast);
    return ast;
  }

  /**
   * Parse expression into AST
   */
  _parseExpression(expr) {
    // String literal
    const stringMatch = expr.match(this.patterns.stringLiteral);
    if (stringMatch) {
      return {
        type: 'literal',
        value: stringMatch[1].replace(/""/g, '"')
      };
    }

    // Function call
    const funcMatch = expr.match(this.patterns.functionCall);
    if (funcMatch) {
      const [, name, argsStr] = funcMatch;
      const args = argsStr.trim() ? this._parseArguments(argsStr) : [];

      return {
        type: 'function',
        name,
        arguments: args
      };
    }

    // Number
    if (this.patterns.number.test(expr)) {
      return {
        type: 'literal',
        value: Number(expr)
      };
    }

    // Identifier/Variable
    if (this.patterns.identifier.test(expr)) {
      return {
        type: 'variable',
        name: expr
      };
    }

    throw new Error(`Invalid expression: ${expr}`);
  }

  /**
   * Optimized argument parsing with proper quote handling
   */
  _parseArguments(argsStr) {
    const args = [];
    let current = '';
    let inQuotes = false;
    let i = 0;

    while (i < argsStr.length) {
      const char = argsStr[i];

      if (inQuotes) {
        if (char === '"' && argsStr[i + 1] !== '"') {
          inQuotes = false;
          current += char;
        } else if (char === '"' && argsStr[i + 1] === '"') {
          current += '""';
          i++; // Skip next quote
        } else {
          current += char;
        }
      } else {
        if (char === '"') {
          inQuotes = true;
          current += char;
        } else if (char === ',') {
          args.push(this._parseExpression(current.trim()));
          current = '';
        } else {
          current += char;
        }
      }
      i++;
    }

    if (current.trim()) {
      args.push(this._parseExpression(current.trim()));
    }

    return args;
  }

  /**
   * Evaluate AST node
   */
  _evaluateAST(ast, context) {
    switch (ast.type) {
      case 'literal':
        return ast.value;

      case 'variable':
        return context[ast.name];

      case 'function':
        const func = this.functions.get(ast.name);
        if (!func) {
          throw new Error(`Unknown function: ${ast.name}`);
        }

        const evaluatedArgs = ast.arguments.map(arg => this._evaluateAST(arg, context));
        return func(...evaluatedArgs);

      default:
        throw new Error(`Unknown AST node type: ${ast.type}`);
    }
  }

  /**
   * Generate cache key for result caching
   */
  _getCacheKey(formula, context) {
    // Create a stable key from formula and relevant context values
    const contextStr = JSON.stringify(context, Object.keys(context).sort());
    return `${formula}|${contextStr}`;
  }

  /**
   * Cache result with LRU management
   */
  _cacheResult(key, result) {
    if (this.resultCache.size >= this.maxCacheSize) {
      const firstKey = this.resultCache.keys().next().value;
      this.resultCache.delete(firstKey);
    }
    this.resultCache.set(key, result);
  }

  /**
   * Clear caches
   */
  clearCache() {
    this.astCache.clear();
    this.resultCache.clear();
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return {
      astCacheSize: this.astCache.size,
      resultCacheSize: this.resultCache.size,
      maxCacheSize: this.maxCacheSize
    };
  }
}

// Enhanced template rendering with caching
function optimizedRenderTemplate(template, context, engine) {
  const placeholderRegex = /\{\{([^}]+)\}\}/g;

  return template.replace(placeholderRegex, (match, expression) => {
    try {
      const result = engine.evaluateFormula(expression, context);
      return String(result ?? '');
    } catch (error) {
      return `[[ERR: ${error.message}]]`;
    }
  });
}

// Export for use in main application
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { OptimizedFormulaEngine, optimizedRenderTemplate };
}