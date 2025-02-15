export const HOST_DATA_CACHE_TTL = 3600; // 1 hour

export type HostData = {
  host: string;
  period: number;
  duration: number;
  frequency: number;
  protocol: "http" | "https";
  port?: string;
  filter: "custom" | "all";
  expressions: Rule[];
};

export interface RedisHostData extends Record<string, string> {
  host: string;
  period: string;
  duration: string;
  frequency: string;
  protocol: "http" | "https";
  port: string;
  filter: "custom" | "all";
  expressions: string;
  ratelimitCached: string;
}

export enum RuleTypes {
  FULL_URI = "FULL_URI",
  URI = "URI", //path + query string
  URI_PATH = "URI_PATH",
  URI_QUERY_STRING = "URI_QUERY_STRING",
  REQUEST_METHOD = "REQUEST_METHOD",
  // HEADER = "HEADER",
  // COOKIE = "COOKIE",
  // USER_AGENT = "USER_AGENT",
}

export enum RuleOperators {
  WILDCARD = "WILDCARD",
  EQUALS = "EQUALS",
  NOT_EQUALS = "NOT_EQUALS",
  GREATER_THAN = "GREATER_THAN",
  LESS_THAN = "LESS_THAN",
  GREATER_THAN_OR_EQUAL = "GREATER_THAN_OR_EQUAL",
  LESS_THAN_OR_EQUAL = "LESS_THAN_OR_EQUAL",
  CONTAINS = "CONTAINS",
  IS_IN = "IS_IN",
  IS_NOT_IN = "IS_NOT_IN",
  STARTS_WITH = "STARTS_WITH",
  ENDS_WITH = "ENDS_WITH",
  DOES_NOT_START_WITH = "DOES_NOT_START_WITH",
  DOES_NOT_END_WITH = "DOES_NOT_END_WITH",
  EXISTS = "EXISTS",
  DOES_NOT_EXIST = "DOES_NOT_EXIST",
}

export enum Logic {
  AND = "and",
  OR = "or",
  NULL = "null",
}

export interface Rule {
  id: number;
  type: RuleTypes;
  operator: RuleOperators;
  value: RuleValue;
  logic: Logic;
}

export type RuleValidationStatus = {
  passed: boolean;
  failedOperations?: RuleOperation[];
};

export interface RuleOperation {
  id: number;
  checkValue: string | number | boolean | undefined;
  value: string | number | boolean | undefined;
  process: () => boolean;
  logic: Logic;
}

export type RuleValue = {
  key?: string;
  value: string | boolean | number | undefined;
};

