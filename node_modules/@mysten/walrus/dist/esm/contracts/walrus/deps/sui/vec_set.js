import { bcs } from "@mysten/sui/bcs";
import { MoveStruct } from "../../../utils/index.js";
const $moduleName = "0x2::vec_set";
function VecSet(...typeParameters) {
  return new MoveStruct({
    name: `${$moduleName}::VecSet<${typeParameters[0].name}>`,
    fields: {
      contents: bcs.vector(typeParameters[0])
    }
  });
}
export {
  VecSet
};
//# sourceMappingURL=vec_set.js.map
