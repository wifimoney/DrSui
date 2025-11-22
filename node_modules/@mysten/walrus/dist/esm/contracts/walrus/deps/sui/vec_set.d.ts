import type { BcsType } from '@mysten/sui/bcs';
import { MoveStruct } from '../../../utils/index.js';
/**
 * A set data structure backed by a vector. The set is guaranteed not to contain
 * duplicate keys. All operations are O(N) in the size of the set
 *
 * - the intention of this data structure is only to provide the convenience of
 *   programming against a set API. Sets that need sorted iteration rather than
 *   insertion order iteration should be handwritten.
 */
export declare function VecSet<K extends BcsType<any>>(...typeParameters: [K]): MoveStruct<{
    contents: BcsType<import("@mysten/bcs").InferBcsType<K>[], Iterable<import("@mysten/bcs").InferBcsInput<K>> & {
        length: number;
    }, string>;
}, `0x2::vec_set::VecSet<${K["name"]}>`>;
