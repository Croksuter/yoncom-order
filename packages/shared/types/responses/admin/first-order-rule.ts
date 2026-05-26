import * as Schema from "db/schema";

export type Rule = Schema.FirstOrderRule & {
  menuCounts: Schema.FirstOrderRuleMenuCount[];
};

export type Get = {
  result: Rule;
};

export type Update = {
  result: Rule;
};
