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
var vec_set_exports = {};
__export(vec_set_exports, {
  VecSet: () => VecSet
});
module.exports = __toCommonJS(vec_set_exports);
var import_bcs = require("@mysten/sui/bcs");
var import_utils = require("../../../utils/index.js");
const $moduleName = "0x2::vec_set";
function VecSet(...typeParameters) {
  return new import_utils.MoveStruct({
    name: `${$moduleName}::VecSet<${typeParameters[0].name}>`,
    fields: {
      contents: import_bcs.bcs.vector(typeParameters[0])
    }
  });
}
//# sourceMappingURL=vec_set.js.map
