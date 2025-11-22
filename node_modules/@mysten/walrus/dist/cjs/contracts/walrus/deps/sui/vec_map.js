"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
var vec_map_exports = {};
__export(vec_map_exports, {
  Entry: () => Entry,
  VecMap: () => VecMap
});
module.exports = __toCommonJS(vec_map_exports);
var import_bcs = require("@mysten/sui/bcs");
var import_utils = require("../../../utils/index.js");
const $moduleName = "0x2::vec_map";
function Entry(...typeParameters) {
  return new import_utils.MoveStruct({
    name: `${$moduleName}::Entry<${typeParameters[0].name}, ${typeParameters[1].name}>`,
    fields: {
      key: typeParameters[0],
      value: typeParameters[1]
    }
  });
}
function VecMap(...typeParameters) {
  return new import_utils.MoveStruct({
    name: `${$moduleName}::VecMap<${typeParameters[0].name}, ${typeParameters[1].name}>`,
    fields: {
      contents: import_bcs.bcs.vector(Entry(typeParameters[0], typeParameters[1]))
    }
  });
}
//# sourceMappingURL=vec_map.js.map
