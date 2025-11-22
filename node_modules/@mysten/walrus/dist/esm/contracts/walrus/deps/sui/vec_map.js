import { bcs } from "@mysten/sui/bcs";
import { MoveStruct } from "../../../utils/index.js";
const $moduleName = "0x2::vec_map";
function Entry(...typeParameters) {
  return new MoveStruct({
    name: `${$moduleName}::Entry<${typeParameters[0].name}, ${typeParameters[1].name}>`,
    fields: {
      key: typeParameters[0],
      value: typeParameters[1]
    }
  });
}
function VecMap(...typeParameters) {
  return new MoveStruct({
    name: `${$moduleName}::VecMap<${typeParameters[0].name}, ${typeParameters[1].name}>`,
    fields: {
      contents: bcs.vector(Entry(typeParameters[0], typeParameters[1]))
    }
  });
}
export {
  Entry,
  VecMap
};
//# sourceMappingURL=vec_map.js.map
