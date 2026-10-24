import { TWO_SUM } from "@/lib/gemma/fixtures/two-sum";
import {
  TWO_SUM_BRUTE_BLOCKS,
  TWO_SUM_OPTIMIZED_BLOCKS,
} from "@/lib/gemma/fixtures/two-sum-blocks";
import { flattenTree } from "@/lib/puzzle/flatten";
import { PuzzleWorkspace } from "@/components/puzzle/PuzzleWorkspace";

export default function PuzzlePage() {
  // Flatten both solutions into individual tray pieces
  const optimizedItems = flattenTree(TWO_SUM_OPTIMIZED_BLOCKS);
  const bruteItems = flattenTree(TWO_SUM_BRUTE_BLOCKS);
  const allItems = [...optimizedItems, ...bruteItems];

  return (
    <PuzzleWorkspace
      title={TWO_SUM.title}
      difficulty={TWO_SUM.difficulty}
      plan="Use a hash map to store seen values. For each number, check if its complement exists in the map."
      complexity="O(n)"
      initialTray={allItems}
      answer={TWO_SUM_OPTIMIZED_BLOCKS}
    />
  );
}
