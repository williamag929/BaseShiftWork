export interface WhereCondition {
  field: string;
  operator: '==' | '<' | '<=' | '>' | '>=' | 'array-contains' | 'in' | 'array-contains-any' | 'not-in';
  value: string | string[] | number | number[] | boolean;
}

export interface QueryOptions {
  limit?: number;
  orderBy?: string;
  startAt?: string;
  startAfter?: string;
  endAt?: string;
  endBefore?: string;
  where?: WhereCondition;
  whereIn?: { field: string; values: string[] };
  whereArrayContains?: { field: string; value: string };
  whereArrayContainsAny?: { field: string; values: string[] };
  whereFieldPath?: WhereCondition;
  whereFieldPathIn?: { field: string; values: string[] };
  whereFieldPathArrayContains?: { field: string; value: string };
  whereFieldPathArrayContainsAny?: { field: string; values: string[] };
  startAtFieldPath?: { field: string; value: string };
  startAfterFieldPath?: { field: string; value: string };
  endAtFieldPath?: { field: string; value: string };
  endBeforeFieldPath?: { field: string; value: string };
}