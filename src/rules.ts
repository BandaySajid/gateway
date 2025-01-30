import { IncomingHttpHeaders } from "http";

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

type Logic = "and" | "or" | null;

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

interface RuleOperation {
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

type ProcessedRule = {
  id: number;
  passed: boolean;
  logic: Logic;
};

export class RuleValidator {
  private rules: Rule[];
  // private headers: IncomingHttpHeaders;
  private url: URL;
  // private cookie: string | null;
  private method: string;
  // private userAgent: string | null;
  private ruleOperations: RuleOperation[];

  private processedRules: ProcessedRule[];

  constructor(
    rules: Rule[],
    url: string | URL,
    method: string,
    // headers: IncomingHttpHeaders,
    // cookie: string | null,
    // userAgent: string | null,
  ) {
    this.rules = rules;
    // this.headers = headers;
    this.url = typeof url === "string" ? new URL(url) : url;
    // this.cookie = cookie;
    this.method = method;

    this.ruleOperations = [];

    for (const rule of this.rules) {
      this.gather(rule.id, rule.type, rule.operator, rule.logic, rule.value);
    }

    this.processedRules = [];
  }

  private gather(
    id: number,
    rt: RuleTypes,
    operator: RuleOperators,
    logic: Logic,
    ruleValue: RuleValue | string,
  ) {
    let ro = { id, logic } as RuleOperation;

    if (rt === RuleTypes.FULL_URI) {
      ro.checkValue = this.url.toString();
    } else if (rt === RuleTypes.URI) {
      ro.checkValue = this.url.pathname + this.url.search;
    } else if (rt === RuleTypes.URI_PATH) {
      ro.checkValue = this.url.pathname;
    } else if (rt === RuleTypes.URI_QUERY_STRING) {
      ro.checkValue = this.url.search.slice(1);
    } else if (rt === RuleTypes.REQUEST_METHOD) {
      ro.checkValue = this.method;
    }
    // else if (rt === RuleTypes.HEADER) {
    //   if (ruleValue.key) {
    //     const h = this.headers[ruleValue.key];
    //     if (h) {
    //       ro.checkValue = h as string | number | boolean;
    //     }
    //   }
    // }

    ro.value = typeof ruleValue === "string" ? ruleValue : ruleValue.value;

    ro.process = (): boolean => {
      switch (operator) {
        case RuleOperators.EQUALS:
          return this.EQUALS(ro.checkValue as string, ro.value as string);
        case RuleOperators.NOT_EQUALS:
          return this.NOT_EQUALS(ro.checkValue as string, ro.value as string);
        case RuleOperators.GREATER_THAN:
          return this.GREATER_THAN(
            Number(ro.checkValue),
            Number(ro.value as number),
          );
        case RuleOperators.LESS_THAN:
          return this.LESS_THAN(Number(ro.checkValue), Number(ro.value));
        case RuleOperators.GREATER_THAN_OR_EQUAL:
          return this.GREATER_THAN_OR_EQUAL(
            Number(ro.checkValue),
            Number(ro.value),
          );
        case RuleOperators.LESS_THAN_OR_EQUAL:
          return this.LESS_THAN_OR_EQUAL(
            Number(ro.checkValue),
            Number(ro.value),
          );
        case RuleOperators.CONTAINS:
          return this.CONTAINS(ro.checkValue as string, ro.value as string);
        case RuleOperators.IS_IN:
          return this.IS_IN(ro.checkValue as string, ro.value as string);
        case RuleOperators.IS_NOT_IN:
          return this.IS_NOT_IN(ro.checkValue as string, ro.value as string);
        case RuleOperators.STARTS_WITH:
          return this.STARTS_WITH(ro.checkValue as string, ro.value as string);
        case RuleOperators.ENDS_WITH:
          return this.ENDS_WITH(ro.checkValue as string, ro.value as string);
        case RuleOperators.DOES_NOT_START_WITH:
          return this.DOES_NOT_START_WITH(
            ro.checkValue as string,
            ro.value as string,
          );
        case RuleOperators.DOES_NOT_END_WITH:
          return this.DOES_NOT_END_WITH(
            ro.checkValue as string,
            ro.value as string,
          );
        case RuleOperators.EXISTS:
          return this.EXISTS(ro.checkValue);
        case RuleOperators.DOES_NOT_EXIST:
          return this.DOES_NOT_EXIST(ro.checkValue);
        case RuleOperators.WILDCARD:
          return this.WILDCARD(ro.checkValue as string, ro.value as string);
        default:
          return false;
      }
    };

    this.ruleOperations.push(ro);
  }

  private evaluate() {
    let expression = "";
    for (let i = 0; i < this.processedRules.length; i++) {
      const rule = this.processedRules[i];
      if (rule.logic === "or") {
        expression += `) || (${rule.passed}`;
      } else if (rule.logic === "and") {
        expression += ` && ${rule.passed}`;
      } else {
        if (i === 0) {
          expression += "(";
        }
        expression += `${rule.passed}`;
      }

      if (
        i === this.processedRules.length - 1 &&
        expression[expression.length - 1] !== ")"
      ) {
        expression += `)`;
      }
    }

    return eval(expression);
  }

  validateAll(): RuleValidationStatus {
    let operations = [];

    for (const op of this.ruleOperations) {
      operations.push({ passed: op.process(), id: op.id });
      this.processedRules.push({
        passed: op.process(),
        id: op.id,
        logic: op.logic,
      });
    }

    const passed = this.evaluate();

    let failedOperations = [] as number[];

    if (!passed) {
      failedOperations = operations
        .filter((op) => op.passed === false)
        .map((o) => o.id);
    }

    return {
      passed,
      failedRules: failedOperations,
    } as RuleValidationStatus;
  }

  private WILDCARD(data: string, value: string): boolean {
    //https://*.amplizard.com/api/*
    let pass = true;
    if (value.includes("*")) {
      const sp = value.split("*");
      for (const s of sp) {
        const si = data.indexOf(s);
        const ei = si + s.length - 1;
        const d = data.slice(si, ei + 1);

        if (d !== s) {
          pass = false;
          break;
        }
      }
    } else {
      pass = this.EQUALS(data, value);
    }

    return pass;
  }

  private EQUALS(data: string, value: string): boolean {
    return data === value;
  }

  private NOT_EQUALS(data: string, value: string): boolean {
    return data !== value;
  }

  private GREATER_THAN(data: number, value: number): boolean {
    return data > value;
  }

  private LESS_THAN(data: number, value: number): boolean {
    return data < value;
  }

  private GREATER_THAN_OR_EQUAL(data: number, value: number): boolean {
    return data >= value;
  }

  private LESS_THAN_OR_EQUAL(data: number, value: number): boolean {
    return data <= value;
  }

  private CONTAINS(data: string, value: string): boolean {
    return data.includes(value);
  }

  private IS_IN(data: string, value: string): boolean {
    return value.split(",").includes(data);
  }

  private IS_NOT_IN(data: string, value: string): boolean {
    return !value.split(",").includes(data);
  }

  private STARTS_WITH(data: string, value: string): boolean {
    return data.startsWith(value);
  }

  private ENDS_WITH(data: string, value: string): boolean {
    return data.endsWith(value);
  }

  private DOES_NOT_START_WITH(data: string, value: string): boolean {
    return !data.startsWith(value);
  }

  private DOES_NOT_END_WITH(data: string, value: string): boolean {
    return !data.endsWith(value);
  }

  private EXISTS(data: any): boolean {
    return !!data;
  }

  private DOES_NOT_EXIST(data: any): boolean {
    return !data;
  }
}
