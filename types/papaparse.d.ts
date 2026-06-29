declare module "papaparse" {
  export type ParseResult<T> = {
    data: T[];
    errors: unknown[];
    meta: {
      fields?: string[];
    };
  };

  export type ParseConfig<T> = {
    header?: boolean;
    skipEmptyLines?: boolean;
    complete?: (results: ParseResult<T>) => void;
    error?: (error: unknown) => void;
  };

  function parse<T = unknown>(
    file: File,
    config: ParseConfig<T>
  ): void;

  function unparse<T extends Record<string, unknown>>(
    data: T[],
    config?: { quotes?: boolean }
  ): string;

  export { parse, unparse };

  const Papa: {
    parse: typeof parse;
    unparse: typeof unparse;
  };

  export default Papa;
}
