
// Formula Engine

/**
 * Built-in formula functions available for computed columns
 * Provides string manipulation and utility functions for URL generation
 *
 * @type {Object<string, Function>}
 * @property {Function} concat - Concatenates multiple values into a single string
 * @property {Function} upper - Converts string to uppercase
 * @property {Function} lower - Converts string to lowercase
 * @property {Function} trim - Removes whitespace from string edges
 * @property {Function} replace - Replaces all occurrences of substring
 * @property {Function} default - Returns fallback value if input is null/empty
 */
const formulaFunctions = {
  concat: (...args) => args.map(x => String(x ?? '')).join(''),
  upper: (s) => String(s ?? '').toUpperCase(),
  lower: (s) => String(s ?? '').toLowerCase(),
  trim: (s) => String(s ?? '').trim(),
  replace: (s, a, b) => String(s ?? '').split(String(a ?? '')).join(String(b ?? '')),
  default: (v, fb) => (v == null || v === '') ? fb : v
};

/**
 * Evaluates a formula expression with the given context variables
 * Supports string literals, function calls, and variable references
 *
 * @function evaluateFormula
 * @param {string} formula - The formula expression to evaluate
 * @param {Object} context - Variable context for formula evaluation
 * @param {string} [context.Brand] - Brand name for URL generation
 * @param {string} [context.OriginalSearch] - Original search keyword
 * @param {string} [context.LocationCID] - Location Customer ID
 * @param {string} [context.GMBCID] - Google My Business Customer ID
 * @param {number} [context.rowIndex] - Current row index (0-based)
 * @param {number} [context.totalRows] - Total number of rows
 * @param {Date} [context.now] - Current timestamp
 * @returns {string|number} The evaluated result of the formula
 * @throws {Error} When formula syntax is invalid or function is unknown
 *
 * @example
 * // String literal
 * evaluateFormula('"Hello World"', {}) // Returns: "Hello World"
 *
 * @example
 * // Function call with variables
 * evaluateFormula('concat(Brand, " - ", OriginalSearch)', {
 *   Brand: "Acme Corp",
 *   OriginalSearch: "roofing services"
 * }) // Returns: "Acme Corp - roofing services"
 *
 * @example
 * // Variable reference
 * evaluateFormula('Brand', { Brand: "Acme Corp" }) // Returns: "Acme Corp"
 *
 * @description Supports three types of expressions:
 * 1. String literals: Quoted strings with escaped quotes
 * 2. Function calls: Built-in functions with parentheses and arguments
 * 3. Variable references: Direct access to context properties
 */
function evaluateFormula(formula, context) {
  if (!formula) return '';
  const s = formula.trim();

  // String literal with quote escaping support
  if (s.startsWith('"') && s.endsWith('"')) {
    return s.slice(1, -1).replace(/""/g, '"');
  }

  // Function call parsing with argument evaluation
  const m = s.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s*\((.*)\)$/);
  if (m) {
    const name = m[1];
    const argsInner = m[2].trim();
    const args = argsInner.length ? splitArgs(argsInner).map(a => parseArg(a, context)) : [];

    if (!(name in formulaFunctions)) {
      throw new Error(`Unknown function: ${name}`);
    }
    return formulaFunctions[name](...args);
  }

  // Variable/identifier lookup in context
  return context[s];
}

/**
 * Renders a template string by replacing placeholders with formula results
 * Processes {{formula}} syntax and evaluates each formula with the given context
 *
 * @function renderTemplate
 * @param {string} template - Template string with {{formula}} placeholders
 * @param {Object} context - Variable context for formula evaluation
 * @returns {string} Rendered template with all placeholders replaced
 *
 * @example
 * // Simple variable substitution
 * renderTemplate('Hello {{Brand}}!', { Brand: 'Acme Corp' })
 * // Returns: "Hello Acme Corp!"
 *
 * @example
 * // Function call in template
 * renderTemplate('{{upper(Brand)}} - {{OriginalSearch}}', {
 *   Brand: 'acme corp',
 *   OriginalSearch: 'roofing'
 * })
 * // Returns: "ACME CORP - roofing"
 *
 * @description Errors in formula evaluation are captured and displayed
 * with [[ERR: ...]] formatting to maintain template integrity while
 * providing debugging information.
 */
function renderTemplate(template, context) {
  return template.replace(/\{\{([^}]+)\}\}/g, (_, body) => {
    try {
      return String(evaluateFormula(body, context) ?? '');
    } catch (e) {
      return `[[ERR: ${e.message}]]`;
    }
  });
}

/**
 * Parses and evaluates a single argument token for function calls
 * Handles string literals, numeric values, function calls, and variable references
 *
 * @function parseArg
 * @param {string} token - The argument token to parse
 * @param {Object} ctx - Context object for variable and function resolution
 * @returns {string|number} Parsed and evaluated argument value
 *
 * @example
 * // String literal
 * parseArg('"hello"', {}) // Returns: "hello"
 *
 * // Numeric value
 * parseArg('42', {}) // Returns: 42
 *
 * // Variable reference
 * parseArg('Brand', { Brand: 'Acme' }) // Returns: "Acme"
 *
 * @description Supports type inference and nested function calls.
 * String literals use double-quote escaping. Numbers are automatically
 * converted to numeric type. Function calls are recursively evaluated.
 */
function parseArg(token, ctx) {
  token = token.trim();

  // String literal with escape sequence handling
  if (token.startsWith('"') && token.endsWith('"')) {
    return token.slice(1, -1).replace(/""/g, '"');
  }

  // Numeric literal detection and conversion
  if (/^-?\d+(?:\.\d+)?$/.test(token)) return Number(token);

  // Nested function call detection and evaluation
  const fm = token.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s*\(.*\)$/);
  if (fm) return evaluateFormula(token, ctx);

  // Variable reference lookup
  return ctx[token];
}

/**
 * Splits a comma-separated argument string while respecting quoted strings
 * Parses function argument lists with proper quote handling
 *
 * @function splitArgs
 * @param {string} inner - The argument string to split (without outer parentheses)
 * @returns {Array<string>} Array of individual argument tokens
 *
 * @example
 * // Simple arguments
 * splitArgs('a, b, c') // Returns: ['a', 'b', 'c']
 *
 * // Arguments with quoted strings
 * splitArgs('"hello, world", var, "test"')
 * // Returns: ['"hello, world"', 'var', '"test"']
 *
 * @description Maintains quote context to avoid splitting on commas within
 * string literals. Handles nested quotes and whitespace normalization.
 * Essential for parsing complex function arguments correctly.
 */
function splitArgs(inner) {
  const args = [];
  let cur = '', inQ = false, i = 0;

  // Character-by-character parsing with quote state tracking
  while (i < inner.length) {
    const c = inner[i];
    if (inQ) {
      // Inside quoted string - only exit on closing quote
      if (c === '"') { inQ = false; cur += c; i++; continue; }
      cur += c; i++; continue;
    }
    if (c === '"') {
      // Entering quoted string
      inQ = true; cur += c; i++; continue;
    }
    if (c === ',') {
      // Argument separator - split here
      args.push(cur.trim()); cur=''; i++; continue;
    }
    cur += c; i++;
  }

  // Add final argument if present
  if (cur.trim().length) args.push(cur.trim());
  return args;
}
