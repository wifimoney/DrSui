import { MoveStruct } from "../../../utils/index.js";
import { bcs } from "@mysten/sui/bcs";
const $moduleName = "0x2::object";
const UID = new MoveStruct({
  name: `${$moduleName}::UID`,
  fields: {
    id: bcs.Address
  }
});
export {
  UID
};
//# sourceMappingURL=object.js.map
