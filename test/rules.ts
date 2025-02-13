import { RuleValidator } from "../src/rules.js";
import { RuleTypes, Logic, RuleOperators } from "../src/types.js";
import * as assert from 'assert';
import { describe, it } from "node:test";

const url = "https://example.com/api/resource?param1=value1&param2=value2";
const method = "GET";

export const testRuleValidator = () => {
  describe("RuleValidator", () => {
    it("should validate a single rule with EQUALS operator", () => {
      const rules = [
        {
          id: 1,
          type: RuleTypes.URI_PATH,
          operator: RuleOperators.EQUALS,
          value: { value: "/api/resource" },
          logic: Logic.NULL,
        },
      ];
      const validator = new RuleValidator(rules, url, method);
      const result = validator.validateAll();
      assert.strictEqual(result.passed, true);
    });

    it("should validate a single rule with NOT_EQUALS operator", () => {
      const rules = [
        {
          id: 1,
          type: RuleTypes.URI_PATH,
          operator: RuleOperators.NOT_EQUALS,
          value: { value: "/api/another/path" },
          logic: Logic.NULL,
        },
      ];
      const validator = new RuleValidator(rules, url, method);
      const result = validator.validateAll();
      assert.strictEqual(result.passed, true);
    });

    it("should validate a single rule with CONTAINS operator", () => {
      const rules = [
        {
          id: 1,
          type: RuleTypes.FULL_URI,
          operator: RuleOperators.CONTAINS,
          value: { value: "example.com" },
          logic: Logic.NULL,
        },
      ];
      const validator = new RuleValidator(rules, url, method);
      const result = validator.validateAll();
      assert.strictEqual(result.passed, true);
    });

    it("should validate a single rule with STARTS_WITH operator", () => {
      const rules = [
        {
          id: 1,
          type: RuleTypes.FULL_URI,
          operator: RuleOperators.STARTS_WITH,
          value: { value: "https://example.com" },
          logic: Logic.NULL,
        },
      ];
      const validator = new RuleValidator(rules, url, method);
      const result = validator.validateAll();
      assert.strictEqual(result.passed, true);
    });

    it("should validate a single rule with ENDS_WITH operator", () => {
      const rules = [
        {
          id: 1,
          type: RuleTypes.FULL_URI,
          operator: RuleOperators.ENDS_WITH,
          value: { value: "value2" },
          logic: Logic.NULL,
        },
      ];
      const validator = new RuleValidator(rules, url, method);
      const result = validator.validateAll();
      assert.strictEqual(result.passed, true);
    });

    it("should validate a single rule with REQUEST_METHOD operator", () => {
      const rules = [
        {
          id: 1,
          type: RuleTypes.REQUEST_METHOD,
          operator: RuleOperators.EQUALS,
          value: { value: "GET" },
          logic: Logic.NULL,
        },
      ];
      const validator = new RuleValidator(rules, url, method);
      const result = validator.validateAll();
      assert.strictEqual(result.passed, true);
    });

    it("should validate multiple rules with AND logic", () => {
      const rules = [
        {
          id: 1,
          type: RuleTypes.URI_PATH,
          operator: RuleOperators.EQUALS,
          value: { value: "/api/resource" },
          logic: Logic.NULL,
        },
        {
          id: 2,
          type: RuleTypes.REQUEST_METHOD,
          operator: RuleOperators.EQUALS,
          value: { value: "GET" },
          logic: Logic.AND,
        },
      ];
      const validator = new RuleValidator(rules, url, method);
      const result = validator.validateAll();
      assert.strictEqual(result.passed, true);
    });

    it("should validate multiple rules with OR logic", () => {
      const rules = [
        {
          id: 1,
          type: RuleTypes.URI_PATH,
          operator: RuleOperators.EQUALS,
          value: { value: "/api/resource" },
          logic: Logic.NULL,
        },
        {
          id: 2,
          type: RuleTypes.REQUEST_METHOD,
          operator: RuleOperators.EQUALS,
          value: { value: "POST" },
          logic: Logic.OR,
        },
      ];

      const validator = new RuleValidator(rules, url, method);
      const result = validator.validateAll();
      assert.strictEqual(result.passed, true);
    });

    it("should handle wildcard operator", () => {
      const rules = [
        {
          id: 1,
          type: RuleTypes.FULL_URI,
          operator: RuleOperators.WILDCARD,
          value: { value: "https://example.com/api/*" },
          logic: Logic.NULL,
        },
      ];
      const validator = new RuleValidator(rules, url, method);
      const result = validator.validateAll();
      assert.strictEqual(result.passed, true);
    });

    it("should handle DOES_NOT_START_WITH operator", () => {
      const rules = [
        {
          id: 1,
          type: RuleTypes.FULL_URI,
          operator: RuleOperators.DOES_NOT_START_WITH,
          value: { value: "http://example.com" },
          logic: Logic.NULL,
        },
      ];
      const validator = new RuleValidator(rules, url, method);
      const result = validator.validateAll();
      assert.strictEqual(result.passed, true);
    });

    it("should handle DOES_NOT_END_WITH operator", () => {
      const rules = [
        {
          id: 1,
          type: RuleTypes.FULL_URI,
          operator: RuleOperators.DOES_NOT_END_WITH,
          value: { value: "value3" },
          logic: Logic.NULL,
        },
      ];
      const validator = new RuleValidator(rules, url, method);
      const result = validator.validateAll();
      assert.strictEqual(result.passed, true);
    });

    it("should handle EXISTS operator", () => {
      const rules = [
        {
          id: 1,
          type: RuleTypes.URI_PATH,
          operator: RuleOperators.EXISTS,
          value: { value: "" },
          logic: Logic.NULL,
        },
      ];
      const validator = new RuleValidator(rules, url, method);
      const result = validator.validateAll();
      assert.strictEqual(result.passed, true);
    });

    it("should handle DOES_NOT_EXIST operator", () => {
      const rules = [
        {
          id: 1,
          type: RuleTypes.URI_PATH,
          operator: RuleOperators.DOES_NOT_EXIST,
          value: { value: "" },
          logic: Logic.NULL,
        },
      ];
      const validator = new RuleValidator(rules, "https://example.com", method);
      const result = validator.validateAll();
      assert.strictEqual(result.passed, false);
    });

    it("should handle URI_QUERY_STRING operator", () => {
      const rules = [
        {
          id: 1,
          type: RuleTypes.URI_QUERY_STRING,
          operator: RuleOperators.CONTAINS,
          value: { value: "param1=value1" },
          logic: Logic.NULL,
        },
      ];
      const validator = new RuleValidator(rules, url, method);
      const result = validator.validateAll();
      assert.strictEqual(result.passed, true);
    });

    it("should handle IS_IN operator", () => {
      const rules = [
        {
          id: 1,
          type: RuleTypes.REQUEST_METHOD,
          operator: RuleOperators.IS_IN,
          value: { value: "GET,POST" },
          logic: Logic.NULL,
        },
      ];
      const validator = new RuleValidator(rules, url, method);
      const result = validator.validateAll();
      assert.strictEqual(result.passed, true);
    });

    it("should handle IS_NOT_IN operator", () => {
      const rules = [
        {
          id: 1,
          type: RuleTypes.REQUEST_METHOD,
          operator: RuleOperators.IS_NOT_IN,
          value: { value: "POST,PUT" },
          logic: Logic.NULL,
        },
      ];
      const validator = new RuleValidator(rules, url, method);
      const result = validator.validateAll();
      assert.strictEqual(result.passed, true);
    });
  });
}
