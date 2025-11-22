import { MoveStruct } from "../../../utils/index.js";
import { bcs } from "@mysten/sui/bcs";
import * as object from "./object.js";
const $moduleName = "0x2::table";
const Table = new MoveStruct({
  name: `${$moduleName}::Table`,
  fields: {
    /** the ID of this table */
    id: object.UID,
    /** the number of key-value pairs in the table */
    size: bcs.u64()
  }
});
export {
  Table
};
//# sourceMappingURL=table.js.map
