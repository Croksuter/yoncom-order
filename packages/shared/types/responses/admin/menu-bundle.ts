import * as Schema from "db/schema";

export type Update = {
  result: {
    bundleMenuId: string;
    items: Schema.MenuBundleItem[];
  };
};
